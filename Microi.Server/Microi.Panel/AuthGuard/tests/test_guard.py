"""仅使用临时 SQLite/日志与受控假防火墙，不访问 Docker 或宿主规则。"""
import copy
import contextlib
import datetime
import io
import json
import os
import pathlib
import struct
import sys
import tempfile
import time
import unittest
import urllib.parse
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from store import GuardError, Store, canonical_ip
from daemon import Guard, main
from collectors import (DockerCollector, FileCollector, JournalCollector, OWNER, PLUGIN, PROXY, PROXY_BIND,
                        PROXY_PORT, RESOURCE, docker_messages, parse_failure, peer_ip, iso_time, timestamp, line_time)
from firewall import CHAIN, MARKER, TABLE, Firewall


class Clock:
    value = 1800000000.0
    def __call__(self):
        return self.value


class FakeFirewall:
    def __init__(self):
        self.fail = False
        self.ips = set()
        self.backends = set()
        self.calls = []
    def sync(self, bans, enabled=True, redis_backends=()):
        self.calls.append((copy.deepcopy(bans), enabled, tuple(redis_backends)))
        if self.fail:
            raise GuardError("模拟内核拒绝", 503)
        self.ips = {b["ip"] for b in bans} if enabled else set()
        self.backends = set(redis_backends)
        return self.ips
    def status(self):
        return {"verified": not self.fail, "status": "degraded" if self.fail else "ready"}


class GuardTests(unittest.TestCase):
    def setUp(self):
        root = pathlib.Path(__file__).resolve().parents[4] / ".tmp"
        root.mkdir(exist_ok=True)
        self.scratch = tempfile.TemporaryDirectory(prefix="auth-guard-tests-", dir=root)
        self.clock = Clock()
        self.path = pathlib.Path(self.scratch.name) / "guard.sqlite3"
        self.store = Store(self.path, self.clock)
        self.firewall = FakeFirewall()
        self.guard = Guard(self.store, self.firewall)

    def tearDown(self):
        self.store.close()
        self.scratch.cleanup()

    def fail(self, number, ip="198.51.100.25", service="ssh"):
        return self.guard.failure(ip, "test:"+str(number), service)

    def policy(self, **patch):
        return self.guard.update_policy(dict(patch, expectedRevision=self.store.policy()["revision"]))

    def test_three_cross_service_failures_ban_only_source(self):
        self.assertFalse(self.fail(1)["banned"])
        self.assertFalse(self.fail(2, service="mysql")["banned"])
        third = self.fail(3, service="mongodb")
        self.assertTrue(third["banned"])
        self.assertTrue(third["ban"]["applied"])
        self.assertEqual(3, third["ban"]["failedAttempts"])
        self.assertEqual(86400, third["ban"]["expiresAt"]-third["ban"]["bannedAt"])
        self.assertFalse(self.guard.is_banned("198.51.100.26"))

    def test_same_event_cannot_count_twice_even_after_restart(self):
        self.fail(1)
        self.assertEqual("duplicate", self.fail(1)["ignoredReason"])
        self.store.close()
        self.store = Store(self.path, self.clock)
        self.guard = Guard(self.store, self.firewall)
        self.assertEqual("duplicate", self.fail(1)["ignoredReason"])
        self.assertFalse(self.fail(2)["banned"])

    def test_concurrent_duplicate_is_atomic(self):
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=4) as executor:
            outcomes = list(executor.map(lambda _: self.fail(1), range(16)))
        self.assertEqual(1, sum(r["accepted"] for r in outcomes))

    def test_cumulative_default_does_not_reset_on_idle(self):
        self.fail(1)
        self.clock.value += 86401
        self.fail(2)
        self.clock.value += 86401
        self.assertTrue(self.fail(3)["banned"])

    def test_rolling_window_not_inactivity_window(self):
        self.policy(windowSeconds=10)
        self.fail(1)
        self.clock.value += 8
        self.fail(2)
        self.clock.value += 8
        self.assertFalse(self.fail(3)["banned"])
        receipt = self.guard.dispatch("POST", "/check", {"ip": "198.51.100.25"})
        self.assertEqual([self.clock.value-8, self.clock.value], receipt["recentFailureTimes"])
        self.clock.value += 1
        self.assertTrue(self.fail(4)["banned"])

    def test_expiry_clears_count_and_reconciles_firewall(self):
        for n in range(3):
            self.fail(n)
        self.clock.value += 86401
        self.guard.sync()
        self.assertEqual(set(), self.firewall.ips)
        self.assertEqual(1, self.fail(4)["count"])

    def test_manual_unban_failure_preserves_ledger(self):
        for n in range(3):
            self.fail(n)
        self.firewall.fail = True
        with self.assertRaises(GuardError) as caught:
            self.guard.unban("198.51.100.25")
        self.assertEqual(503, caught.exception.status)
        self.assertTrue(self.guard.is_banned("198.51.100.25"))

    def test_manual_unban_success_clears_count_and_rolling_history(self):
        self.policy(windowSeconds=60)
        for n in range(3):
            self.fail(n)
        result = self.guard.unban("198.51.100.25")
        self.assertTrue(result["firewallVerified"])
        self.assertFalse(self.guard.is_banned("198.51.100.25"))
        self.assertEqual(1, self.fail(4)["count"])

    def test_stale_logs_after_unban_do_not_reban(self):
        start = self.clock.value
        self.fail(1)
        self.clock.value += 1
        self.guard.unban("198.51.100.25")
        result = self.guard.failure("198.51.100.25", "late-log", "ssh", start)
        self.assertEqual("stale", result["ignoredReason"])
        receipt = self.guard.dispatch("POST", "/check", {"ip": "198.51.100.25"})
        self.assertEqual(0, receipt["failedAttempts"])
        self.assertEqual(self.clock.value, receipt["resetEpoch"])
        self.assertIsNone(receipt["lastFailure"])
        self.assertIsNone(receipt["ban"])

    def test_counter_receipt_and_firewall_freshness(self):
        result = self.fail(1)
        self.assertEqual(1, result["failedAttempts"])
        self.assertEqual(self.clock.value, result["lastFailure"])
        self.guard.sync()
        self.guard.last_sync = time.time()-31
        self.assertFalse(self.guard.status()["firewall"]["verified"])
        self.assertTrue(self.guard.dispatch("POST", "/check", {"ip": "198.51.100.25"})["firewall"]["stale"])

    def assert_receipt(self, receipt):
        for name in ("ip", "banned", "ban", "policy", "failedAttempts", "lastFailure", "resetEpoch", "recentFailureTimes", "observedAt", "firewall"):
            self.assertIn(name, receipt)
        self.assertEqual("198.51.100.25", receipt["ip"])
        self.assertIs(type(receipt["banned"]), bool)
        self.assertIs(type(receipt["failedAttempts"]), int)
        self.assertGreater(receipt["policy"]["generation"], 0)
        self.assertIsInstance(receipt["policy"]["revision"], str)
        self.assertIsInstance(receipt["observedAt"], (int, float))

    def test_complete_check_and_failure_contract_including_ignored_branches(self):
        body = {"ip": "::ffff:198.51.100.25", "eventId": "panel-contract", "service": "panel"}
        for _ in range(2):
            self.assert_receipt(self.guard.dispatch("POST", "/failures", body))
        self.assert_receipt(self.guard.dispatch("POST", "/check", {"ip": body["ip"]}))
        self.fail(2)
        self.assert_receipt(self.fail(3))
        self.assert_receipt(self.fail(4))
        self.policy(allowlist=["198.51.100.25"])
        receipt = self.guard.dispatch("POST", "/failures", body)
        self.assert_receipt(receipt)
        self.assertFalse(receipt["banned"])
        self.assertIsNone(receipt["ban"])
        self.assertEqual(0, receipt["failedAttempts"])
        self.policy(enabled=False)
        self.assert_receipt(self.guard.dispatch("POST", "/failures", body))

    def cli_unban(self, uid=0, receipt=None):
        guard = self.guard
        requests = []
        class Connection:
            def __init__(self, path):
                self.path = path
            def request(self, method, path, body=None, headers=None):
                requests.append((method, path, json.loads(body)))
                try:
                    result = guard.dispatch(method, path, json.loads(body)) if receipt is None else receipt
                    code = 200
                except GuardError as exc:
                    result, code = {"error": str(exc)}, exc.status
                self.response = SimpleNamespace(status=code, read=lambda _: json.dumps(result).encode())
            def getresponse(self):
                return self.response
            def close(self):
                pass
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch("daemon.UnixHTTP", Connection), patch("daemon.os.geteuid", return_value=uid, create=True), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = main(["--socket", "/controlled-test.sock", "--unban", "198.51.100.25"])
        return code, requests, stdout.getvalue(), stderr.getvalue()

    def test_root_unban_cli_calls_typed_socket_api_and_requires_readback(self):
        for n in range(3):
            self.fail(n)
        code, requests, out, _ = self.cli_unban()
        self.assertEqual(0, code)
        self.assertEqual([("POST", "/unban", {"ip": "198.51.100.25"})], requests)
        self.assertTrue(json.loads(out)["firewallVerified"])
        self.assertFalse(self.guard.is_banned("198.51.100.25"))
        for n in range(5, 8):
            self.fail(n)
        self.firewall.fail = True
        code, _, out, err = self.cli_unban()
        self.assertEqual(1, code)
        self.assertEqual("", out)
        self.assertIn("error", json.loads(err))
        self.assertTrue(self.guard.is_banned("198.51.100.25"))

    def test_unban_cli_rejects_non_root_and_incomplete_success(self):
        code, requests, _, _ = self.cli_unban(uid=1000)
        self.assertEqual(1, code)
        self.assertEqual([], requests)
        code, _, _, _ = self.cli_unban(receipt={"ip": "198.51.100.25", "banned": False, "removed": True})
        self.assertEqual(1, code)

    def test_policy_generation_survives_restart(self):
        self.assertEqual(1, self.store.policy()["generation"])
        self.policy(maxFailures=4)
        self.store.close()
        self.store = Store(self.path, self.clock)
        self.guard = Guard(self.store, self.firewall)
        self.assertEqual(2, self.guard.policy()["generation"])
        self.policy(maxFailures=3)
        self.assertEqual(3, self.guard.policy()["generation"])

    def test_loopback_ipv4mapped_and_explicit_cidr_allowed(self):
        self.assertEqual("allowlisted", self.fail(1, "::ffff:127.0.0.1")["ignoredReason"])
        self.policy(allowlist=["198.51.100.0/24"])
        self.assertEqual("allowlisted", self.fail(2)["ignoredReason"])
        self.assertTrue(self.fail(3, "192.168.1.6")["accepted"])

    def test_allowlist_change_unbans_and_cas_protects_policy(self):
        revision = self.store.policy()["revision"]
        for n in range(3):
            self.fail(n)
        self.policy(allowlist=["198.51.100.25"])
        self.assertFalse(self.guard.is_banned("198.51.100.25"))
        with self.assertRaises(GuardError) as caught:
            self.guard.update_policy({"enabled": False, "expectedRevision": revision})
        self.assertEqual(409, caught.exception.status)

    def test_allowlist_stays_unbanned_through_poll_and_restart(self):
        for n in range(3):
            self.fail(n)
        self.policy(allowlist=["198.51.100.0/24"])
        self.guard.poll()
        self.assertEqual(set(), self.firewall.ips)
        self.store.close()
        self.store = Store(self.path, self.clock)
        self.guard = Guard(self.store, self.firewall)
        self.guard.sync()
        self.assertFalse(self.guard.is_banned("198.51.100.25"))
        self.assertEqual(set(), self.firewall.ips)

    def test_automatic_unban_keeps_pending_ledger_when_kernel_rejects_removal(self):
        for n in range(3):
            self.fail(n)
        self.clock.value += 86401
        self.firewall.fail = True
        self.assertFalse(self.guard.sync())
        self.assertTrue(self.store.bans()[0]["pendingRemoval"])
        self.assertTrue(self.guard.is_banned("198.51.100.25"))
        self.assertEqual({"198.51.100.25"}, self.firewall.ips)
        self.firewall.fail = False
        self.assertTrue(self.guard.sync())
        self.assertEqual([], self.store.bans())
        self.assertEqual(1, self.fail(4)["count"])

    def test_disabled_policy_removes_network_bans_and_does_not_count(self):
        for n in range(3):
            self.fail(n)
        self.policy(enabled=False)
        self.assertEqual(set(), self.firewall.ips)
        self.assertEqual("disabled", self.fail(4)["ignoredReason"])
        self.assertFalse(self.guard.dispatch("POST", "/check", {"ip": "198.51.100.25"})["banned"])

    def test_firewall_error_cannot_be_reported_as_applied(self):
        self.firewall.fail = True
        for n in range(3):
            result = self.fail(n)
        self.assertTrue(result["banned"])
        self.assertFalse(result["ban"]["applied"])
        self.assertEqual("degraded", self.guard.status()["health"])

    def test_ban_reconciles_after_restart(self):
        for n in range(3):
            self.fail(n)
        self.store.close()
        self.store = Store(self.path, self.clock)
        firewall = FakeFirewall()
        self.guard = Guard(self.store, firewall)
        self.guard.sync()
        self.assertEqual({"198.51.100.25"}, firewall.ips)

    def test_untrusted_api_fields_and_service_are_rejected(self):
        with self.assertRaises(GuardError):
            self.policy(nativeLogs=[{"path": "/etc/shadow"}])
        with self.assertRaises(GuardError):
            self.guard.dispatch("POST", "/failures", {"ip": "198.51.100.25", "eventId": "x", "service": "ssh"})
        for ip in ("example.test", "198.51.100.25; reboot", "0.0.0.0", "fe80::1%eth0", "224.0.0.1"):
            with self.assertRaises(GuardError):
                canonical_ip(ip)

    def test_invalid_policy_ranges_rejected(self):
        for field, value in (("maxFailures", True), ("maxFailures", 0), ("banSeconds", -1),
                             ("windowSeconds", 86401), ("allowlist", ["0.0.0.0/0"])):
            with self.assertRaises(GuardError):
                self.policy(**{field: value})

    def test_capacity_failure_visible_and_transaction_rolls_back(self):
        import store as module
        old = module.MAX_TRACKED_IPS
        try:
            module.MAX_TRACKED_IPS = 1
            self.fail(1)
            with self.assertRaises(GuardError):
                self.fail(2, "198.51.100.26")
            self.assertEqual(1, self.store.summary()["recentEvents"])
        finally:
            module.MAX_TRACKED_IPS = old

    def test_native_file_initial_baseline_then_cursor_dedupe(self):
        path = pathlib.Path(self.scratch.name) / "auth.log"
        line = "2027-01-15T08:00:00+00:00 host sshd[123]: Failed password for user from 198.51.100.25 port 1234 ssh2\n"
        path.write_text(line, encoding="utf-8")
        reported = []
        source = FileCollector(self.store, lambda *a, **k: reported.append((a, k)), {"id": "test", "kind": "ssh", "path": str(path)})
        source.poll()
        self.assertEqual([], reported)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(line)
        source.poll()
        source.poll()
        self.assertEqual(1, len(reported))

    def test_engine_logs_since_is_unix_seconds_and_replay_keeps_exact_count(self):
        base = int(self.clock.value)
        prefix = iso_time(base).replace("Z", "")
        dates = [prefix+fraction+"Z" for fraction in (".000000001", ".100000001", ".900000001")]
        line = json.dumps({"c": "ACCESS", "id": 5286307, "msg": "Failed to authenticate",
                           "attr": {"client": "198.51.100.25:42128", "result": 18, "isSpeculative": True, "isClusterMember": False}})
        logs = [date+" "+line for date in dates]
        paths = []
        test = self
        class Client:
            def get(self, path):
                paths.append(path)
                query = urllib.parse.parse_qs(urllib.parse.urlsplit(path).query)
                test.assertEqual([str(base)], query["since"])
                test.assertTrue(query["since"][0].isdigit())
                raw = ("\n".join(logs)+"\n").encode()
                return b"\x02\0\0\0"+struct.pack(">I", len(raw))+raw
        cid = "d"*64
        self.store.set_cursor("docker:"+cid, {"since": iso_time(base+0.05)})
        self.clock.value += 1
        detail = {"HostConfig": {"LogConfig": {"Type": "json-file"}}, "Config": {"Tty": False}}
        source = DockerCollector(self.store, self.guard.failure, Client())
        source._logs(cid, "mongodb", detail, {})
        self.assertEqual(2, self.store.receipt("198.51.100.25")["failedAttempts"])
        self.assertEqual(dates[-1], self.store.cursor("docker:"+cid)["since"])
        self.store.close()
        self.store = Store(self.path, self.clock)
        self.guard = Guard(self.store, self.firewall)
        source = DockerCollector(self.store, self.guard.failure, Client())
        source._logs(cid, "mongodb", detail, {})
        self.assertEqual(2, self.store.receipt("198.51.100.25")["failedAttempts"])
        # 相同纳秒、相同正文的另一条真实事件仍须计数，不能以秒粒度游标丢弃。
        logs.append(logs[-1])
        source._logs(cid, "mongodb", detail, {})
        self.assertEqual(3, self.store.receipt("198.51.100.25")["failedAttempts"])
        self.assertTrue(self.guard.is_banned("198.51.100.25"))
        self.assertEqual(3, len(paths))

    def test_journal_empty_initial_cursor_does_not_drop_first_new_event(self):
        replies = ["", json.dumps({"__CURSOR": "s=cursor", "__REALTIME_TIMESTAMP": "1800000000000000",
                                   "MESSAGE": "Failed password for user from 198.51.100.25 port 1234 ssh2",
                                   "_UID": "0", "_EXE": "/usr/sbin/sshd"})]
        reported = []
        source = JournalCollector(self.store, lambda *a, **k: reported.append(a),
                                  lambda *a, **k: SimpleNamespace(returncode=0, stdout=replies.pop(0)))
        source.poll()
        source.poll()
        self.assertEqual(1, len(reported))

    def docker_source(self, legacy=False):
        cid, network = "a"*64, "b"*64
        labels = {OWNER: "powner", RESOURCE: "cache", PLUGIN: "redis"}
        if not legacy:
            labels.update({PROXY: "true", PROXY_PORT: "16379", PROXY_BIND: "0.0.0.0"})
        listing = [{"Id": cid, "Labels": labels}]
        detail = {"Config": {"Labels": labels}, "HostConfig": {"PortBindings": {}, "NetworkMode": "mci-panel-powner-cache-guard"},
                  "NetworkSettings": {"Networks": {"mci-panel-powner-cache-guard": {"IPAddress": "172.18.0.2", "NetworkID": network}}}}
        network_detail = {"Containers": {cid: {}}}
        class Client:
            fail = False
            desktop_labels = False
            changed_security_label = False
            def json(self, path):
                if self.fail:
                    raise GuardError("模拟 Docker 不可用", 503)
                if path.startswith("/containers/json?"):
                    result = copy.deepcopy(listing)
                    if self.desktop_labels:
                        result[0]["Labels"]["desktop.docker.io/ports.scheme"] = "v2"
                        result[0]["Labels"]["desktop.docker.io/mounts/fixture"] = "/lab"
                    return result
                if path == "/containers/"+cid+"/json":
                    result = copy.deepcopy(detail)
                    if self.changed_security_label:
                        result["Config"]["Labels"][PROXY_PORT] = "16380"
                    return result
                if path == "/networks/"+network:
                    return network_detail
                raise AssertionError(path)
        client = Client()
        return DockerCollector(self.store, self.guard.failure, client), client, network_detail

    def test_redis_topology_checked_and_backend_deny_retained_on_failure(self):
        source, client, network = self.docker_source()
        self.assertEqual("initializing", source.poll()[0]["status"])
        self.assertEqual("cache", source.proxy_entries[0]["id"])
        self.assertEqual(["172.18.0.2"], source.redis_backends)
        client.fail = True
        self.assertEqual("degraded", source.poll()[0]["status"])
        self.assertEqual(1, len(source.proxy_entries))
        client.fail = False
        network["Containers"]["c"*64] = {}
        self.assertEqual("degraded", source.poll()[0]["status"])
        self.assertEqual([], source.proxy_entries)
        self.assertEqual(["172.18.0.2"], source.redis_backends)

    def test_runtime_labels_do_not_override_security_label_comparison(self):
        source, client, _ = self.docker_source()
        client.desktop_labels = True
        self.assertEqual("initializing", source.poll()[0]["status"])
        self.assertEqual(1, len(source.proxy_entries))
        client.changed_security_label = True
        self.assertEqual("degraded", source.poll()[0]["status"])
        self.assertEqual([], source.proxy_entries)

    def test_systemd_keeps_mounted_socket_directory_across_stop_and_restart(self):
        import configparser
        unit = configparser.ConfigParser(interpolation=None)
        unit.read(pathlib.Path(__file__).resolve().parents[1] / "microi-auth-guard.service", encoding="utf-8")
        self.assertEqual("yes", unit["Service"]["RuntimeDirectoryPreserve"])
        self.assertEqual("microi-auth-guard", unit["Service"]["RuntimeDirectory"])
        self.assertEqual("0700", unit["Service"]["RuntimeDirectoryMode"])
        self.assertEqual("0077", unit["Service"]["UMask"])

    def test_legacy_redis_reports_migration_without_mutating_topology(self):
        source, _, _ = self.docker_source(legacy=True)
        self.assertEqual("needs-migration", source.poll()[0]["status"])
        self.assertEqual([], source.proxy_entries)
        self.assertEqual([], source.redis_backends)

    def test_proxy_listener_requires_verified_backend_deny_first(self):
        source, _, _ = self.docker_source()
        test = self
        class Proxy:
            calls = 0
            def reconcile(self, entries):
                self.calls += 1
                test.assertEqual({"172.18.0.2"}, test.firewall.backends)
                return [{"id": "cache", "state": "listening"}]
            def status(self):
                return []
        proxy = Proxy()
        self.guard.docker, self.guard.proxy = source, proxy
        self.firewall.fail = True
        self.guard.poll()
        self.assertEqual(0, proxy.calls)
        self.assertEqual("degraded", self.guard.adapters[0]["status"])
        self.firewall.fail = False
        self.guard.poll()
        self.assertEqual(1, proxy.calls)
        self.assertEqual("protecting", self.guard.adapters[0]["status"])


class ParserTests(unittest.TestCase):
    def test_nanosecond_docker_timestamp_and_locale_independent_syslog(self):
        self.assertEqual(timestamp("2026-10-26T10:00:00.123456Z"), timestamp("2026-10-26T10:00:00.123456789Z"))
        self.assertIsNotNone(line_time("ssh", "Oct 26 10:00:00 host sshd[123]: Failed password for user from 198.51.100.25 port 42 ssh2"))
        self.assertIsNone(line_time("ssh", "Bad 99 25:61:99 malformed"))

    def test_ssh_matches_password_only_and_rejects_username_injection(self):
        self.assertEqual("198.51.100.25", parse_failure("ssh", "Failed password for invalid user a from 198.51.100.25 port 42 ssh2"))
        for line in ("Failed publickey for a from 198.51.100.25 port 42 ssh2",
                     "Disconnected from authenticating user a 198.51.100.25 port 42 [preauth]",
                     "Failed password for fake from 203.0.113.9 port 42 ssh2 from 198.51.100.25 port 42 ssh2",
                     "Failed password for a from attacker.example port 42 ssh2"):
            self.assertIsNone(parse_failure("ssh", line))

    def test_mysql_only_fixed_authentication_failure(self):
        line = "2026-10-26T10:20:30.000000Z 23 [Note] [MY-010926] [Server] Access denied for user 'a'@'198.51.100.25' (using password: YES)"
        self.assertEqual("198.51.100.25", parse_failure("mysql", line))
        for altered in (line.replace("MY-010926", "MY-010914"), line.replace("198.51.100.25", "host.example"),
                        line+" to database 'secret'", line.replace("user 'a'", "user 'a'@'203.0.113.9'")):
            self.assertIsNone(parse_failure("mysql", altered))

    def test_mongo_json_reason_and_source_not_message(self):
        data = {"c": "ACCESS", "id": 5286307, "msg": "Failed to authenticate", "attr": {"result": 18, "client": "[2001:db8::25]:1234"}}
        self.assertEqual("2001:db8::25", parse_failure("mongodb", json.dumps(data)))
        data["attr"]["result"] = 337
        self.assertIsNone(parse_failure("mongodb", json.dumps(data)))
        data["attr"]["result"] = 18
        data["attr"]["isSpeculative"] = True
        self.assertEqual("2001:db8::25", parse_failure("mongodb", json.dumps(data)))
        data["attr"]["isClusterMember"] = True
        self.assertIsNone(parse_failure("mongodb", json.dumps(data)))

    def test_peer_and_multiplex_framing(self):
        self.assertEqual("2001:db8::1", peer_ip("[2001:db8::1]:6379"))
        self.assertIsNone(peer_ip("198.51.100.25;reboot:6379"))
        line = b"2026-10-26T10:00:00.123456789Z message\n"
        frame = b"\x02\0\0\0"+struct.pack(">I", len(line))+line
        self.assertEqual(1, len(docker_messages(frame)))
        for corrupt in (frame[:-1], b"invalid", b"\x03"+frame[1:]):
            with self.assertRaises(GuardError):
                docker_messages(corrupt)


def nft_fixture():
    values = [{"table": {"family": "inet", "name": TABLE, "comment": MARKER}}]
    for name in ("banned4", "banned6", "redis4", "redis6"):
        values.append({"set": {"name": name, "elem": [], "type": "ipv4_addr" if name.endswith("4") else "ipv6_addr", "flags": ["timeout"] if name.startswith("banned") else []}})
    for name in ("input", "forward"):
        values.append({"chain": {"name": name, "type": "filter", "hook": name, "prio": -10, "policy": "accept"}})
    for chain, kind in (("input", "input"), ("forward", "forward"), ("forward", "redis")):
        for version in (4, 6):
            field = "daddr" if kind == "redis" else "saddr"
            setname = ("redis" if kind == "redis" else "banned")+str(version)
            expr = [{"match": {"op": "==", "left": {"payload": {"protocol": "ip" if version == 4 else "ip6", "field": field}}, "right": "@"+setname}}]
            if kind == "redis":
                expr.append({"match": {"op": "==", "left": {"payload": {"protocol": "tcp", "field": "dport"}}, "right": 6379}})
            expr.append({"drop": None})
            values.append({"rule": {"chain": chain, "comment": f"{MARKER}:{kind}{version}", "expr": expr}})
    return values


class FirewallTests(unittest.TestCase):
    def test_nft_shape_rejects_accept_disguised_with_same_comment(self):
        fixture = nft_fixture()
        firewall = Firewall("nftables")
        firewall._verify_nft_structure(fixture)
        fixture[-1]["rule"]["expr"][-1] = {"accept": None}
        with self.assertRaises(GuardError):
            firewall._verify_nft_structure(fixture)

    def test_nft_dual_stack_readback_and_no_host_flush(self):
        fixture = nft_fixture()
        calls = []
        def runner(args, input_text=None, check=True):
            calls.append((args, input_text))
            if input_text:
                for line in input_text.splitlines():
                    import re
                    match = re.fullmatch(r"add element inet microi_auth_guard (\w+) \{ ([a-fA-F0-9:.]+)(?: timeout \d+s)? \}", line)
                    self.assertIsNotNone(match)
                    for obj in fixture:
                        if obj.get("set", {}).get("name") == match[1]:
                            obj["set"]["elem"].append(match[2])
            return SimpleNamespace(returncode=0, stdout=json.dumps({"nftables": fixture}))
        firewall = Firewall("nftables", runner=runner, clock=lambda: 1000)
        actual = firewall.sync([{"ip": "198.51.100.25", "expiresAt": 1100}, {"ip": "2001:db8::25", "expiresAt": 1100}], redis_backends=["172.18.0.2"])
        self.assertEqual({"198.51.100.25", "2001:db8::25"}, actual)
        self.assertTrue(firewall.status()["verified"])
        self.assertFalse(any("flush" in str(call) for call in calls))

    def test_foreign_same_named_table_is_never_modified(self):
        calls = []
        def runner(args, input_text=None, check=True):
            calls.append(input_text)
            return SimpleNamespace(returncode=0, stdout=json.dumps({"nftables": [{"table": {"name": TABLE}}]}))
        firewall = Firewall("nftables", runner=runner)
        with self.assertRaises(GuardError):
            firewall.sync([])
        self.assertEqual([None], calls)
        self.assertFalse(firewall.status()["verified"])

    def test_iptables_parse_exact_host_and_backend_rules(self):
        rules = [f"-N {CHAIN}", f"-A {CHAIN} -s 198.51.100.25/32 -j DROP",
                 f"-A {CHAIN} -d 172.18.0.2/32 -p tcp -m tcp --dport 6379 -j DROP",
                 f'-A {CHAIN} -m comment --comment "{MARKER}" -j RETURN']
        self.assertEqual(({"198.51.100.25"}, {"172.18.0.2"}), Firewall._parse_iptables(rules))
        with self.assertRaises(GuardError):
            Firewall._parse_iptables([f"-A {CHAIN} -s 198.51.100.0/24 -j DROP"])
        with self.assertRaises(GuardError):
            Firewall._parse_iptables([rules[-1], rules[1]])


if __name__ == "__main__":
    unittest.main()
