"""真实本地 TCP 的协议组件回归；不是 Redis 实例/宿主防火墙的商业验收回执。"""

import asyncio
import contextlib
import importlib.util
import io
import pathlib
import socket
import sys
import unittest
from collections import Counter

sys.dont_write_bytecode = True
SOURCE = pathlib.Path(__file__).resolve().parents[1] / "redis_proxy.py"
spec = importlib.util.spec_from_file_location("microi_redis_proxy", SOURCE)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
RedisProxy, ProxyLimits = module.RedisProxy, module.ProxyLimits


def command(*parts):
    parts = [part if isinstance(part, bytes) else str(part).encode() for part in parts]
    return b"*%d\r\n" % len(parts) + b"".join(b"$%d\r\n" % len(part) + part + b"\r\n" for part in parts)


def bulk(data):
    return b"$%d\r\n" % len(data) + data + b"\r\n"


async def request(reader):
    first = await reader.readexactly(1)
    line = await reader.readline()
    if first != b"*":
        # 独立夹具仅识别无转义 inline；转义解析通过显式协议帧测试。
        return (first + line).strip().split()
    result = []
    for _ in range(int(line)):
        length = await reader.readline()
        if not length.startswith(b"$"):
            raise ValueError("fixture bad bulk")
        value = await reader.readexactly(int(length[1:]))
        if await reader.readexactly(2) != b"\r\n":
            raise ValueError("fixture bad terminator")
        result.append(value)
    return result


async def reply(reader):
    kind = await reader.readexactly(1)
    line = (await reader.readline())[:-2]
    if kind in (b"+", b"-", b":", b"_"):
        return kind, line
    if kind in (b"$", b"!", b"="):
        count = int(line)
        if count < 0:
            return kind, None
        data = await reader.readexactly(count)
        assert await reader.readexactly(2) == b"\r\n"
        return kind, data
    if kind in (b"*", b">", b"%", b"~", b"|"):
        count = int(line)
        if count < 0:
            return kind, None
        return kind, [await reply(reader) for _ in range(count * (2 if kind in (b"%", b"|") else 1))]
    raise AssertionError("fixture unexpected reply kind")


class RedisProtocolFixture:
    """Small deterministic upstream. Auth callbacks exercise sockets, not ACL LOG."""

    def __init__(self):
        self.server = None
        self.writers = set()
        self.tasks = set()
        self.commands = Counter()
        self.values = {}
        self.auth_attempts = 0

    async def start(self):
        self.server = await asyncio.start_server(self.handle, "127.0.0.1", 0)
        return self.server.sockets[0].getsockname()[1]

    async def close(self):
        self.server.close()
        await self.server.wait_closed()
        for writer in list(self.writers):
            writer.close()
        for task in list(self.tasks):
            task.cancel()
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)

    async def handle(self, reader, writer):
        task = asyncio.current_task()
        self.tasks.add(task)
        self.writers.add(writer)
        transaction = None
        protocol = 2
        subscribed = set()

        def evaluate(parts):
            nonlocal protocol
            name = parts[0].upper()
            hello_options = [p.split(b"\x00", 1)[0].upper() for p in parts[2:]]
            if name == b"AUTH" or (name == b"HELLO" and b"AUTH" in hello_options):
                self.auth_attempts += 1
                if parts[-1] != b"correct":
                    return b"-WRONGPASS invalid username-password pair or user is disabled.\r\n"
                if name == b"AUTH":
                    return b"+OK\r\n"
            if name == b"HELLO":
                protocol = int(parts[1])
                return b"%1\r\n+proto\r\n:3\r\n"
            if name == b"PING":
                return b"+PONG\r\n"
            if name == b"SET":
                self.values[parts[1]] = parts[2]
                return b"+OK\r\n"
            if name == b"GET":
                return bulk(self.values[parts[1]]) if parts[1] in self.values else b"$-1\r\n"
            if name == b"FAILNOAUTH":
                return b"-NOAUTH Authentication required.\r\n"
            if name == b"FAILNOPERM":
                return b"-NOPERM this user has no permissions to run the command\r\n"
            if name == b"BLOBFAIL":
                return b"!%d\r\n" % len(b"WRONGPASS fake non-auth command error") + b"WRONGPASS fake non-auth command error\r\n"
            if name == b"BIG":
                return bulk(b"binary\x00\xff\r\n" * 120000)
            if name == b"PUSH":
                return b">2\r\n+invalidate\r\n*1\r\n$3\r\nkey\r\n+OK\r\n"
            if name == b"FAKEPUBSUB":
                return b"*3\r\n" + bulk(parts[1]) + bulk(b"data") + b":1\r\n"
            if name == b"ATTR":
                return b"|1\r\n+ttl\r\n:1\r\n+OK\r\n"
            if name == b"STREAM":
                return b"$?\r\n;3\r\nabc\r\n;4\r\ndefg\r\n;0\r\n"
            if name == b"STREAMARRAY":
                return b"*?\r\n:1\r\n:2\r\n.\r\n"
            if name in (b"SUBSCRIBE", b"UNSUBSCRIBE"):
                output = bytearray()
                for channel in parts[1:] or list(subscribed) or [None]:
                    if name == b"SUBSCRIBE":
                        subscribed.add(channel)
                    else:
                        subscribed.discard(channel)
                    output.extend((b">3\r\n" if protocol == 3 else b"*3\r\n") + bulk(name.lower()))
                    output.extend(bulk(channel) if channel else b"$-1\r\n")
                    output.extend(b":%d\r\n" % len(subscribed))
                if name == b"SUBSCRIBE":
                    output.extend((b">3\r\n" if protocol == 3 else b"*3\r\n") + bulk(b"message") + bulk(parts[1]) + bulk(b"news"))
                return bytes(output)
            return b"+OK\r\n"

        try:
            while True:
                parts = await request(reader)
                name = parts[0].upper()
                self.commands[name] += 1
                if name == b"MULTI":
                    transaction = []
                    response = b"+OK\r\n"
                elif name == b"EXEC":
                    if transaction is None:
                        response = b"-ERR EXEC without MULTI\r\n"
                    else:
                        response = b"*%d\r\n" % len(transaction) + b"".join(evaluate(item) for item in transaction)
                        transaction = None
                elif name == b"DISCARD":
                    transaction = None
                    response = b"+OK\r\n"
                elif transaction is not None:
                    transaction.append(parts)
                    response = b"+QUEUED\r\n"
                else:
                    response = evaluate(parts)
                writer.write(response)
                await writer.drain()
        except (asyncio.IncompleteReadError, ConnectionError, asyncio.CancelledError, ValueError):
            pass
        finally:
            self.tasks.discard(task)
            self.writers.discard(writer)
            writer.close()
            with contextlib.suppress(Exception):
                await writer.wait_closed()


class RedisProxyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = RedisProtocolFixture()
        port = await self.fixture.start()
        self.failures = []
        self.counts = Counter()
        self.banned = set()
        self.clients = []

        async def target():
            return "127.0.0.1", port

        async def failure(ip, event_id):
            self.failures.append((ip, event_id))
            self.counts[ip] += 1
            if self.counts[ip] >= 3:
                self.banned.add(ip)

        async def is_banned(ip):
            return ip in self.banned

        self.proxy = await RedisProxy(target, failure, is_banned, limits=ProxyLimits(idle_seconds=3)).start()

    async def asyncTearDown(self):
        for _, writer in self.clients:
            writer.close()
            with contextlib.suppress(Exception):
                await writer.wait_closed()
        await self.proxy.close()
        await self.fixture.close()
        self.assertEqual({}, self.proxy.connections)

    async def connect(self, source="127.0.0.1"):
        pair = await asyncio.open_connection("127.0.0.1", self.proxy.port, local_addr=(source, 0))
        self.clients.append(pair)
        return pair

    async def exchange(self, pair, *parts):
        reader, writer = pair
        writer.write(command(*parts))
        await writer.drain()
        return await asyncio.wait_for(reply(reader), 3)

    async def assert_closed(self, reader):
        try:
            self.assertEqual(b"", await asyncio.wait_for(reader.read(1), 3))
        except ConnectionResetError:
            pass  # 未消费攻击数据时，操作系统允许用 RST 终止已封禁的连接。

    async def test_third_failure_bans_and_pipeline_does_not_reach_fourth_auth(self):
        reader, writer = await self.connect()
        writer.write(command("AUTH", "bad") * 10)
        await writer.drain()
        for _ in range(3):
            self.assertEqual(b"-", (await reply(reader))[0])
        self.assertEqual(b"", await asyncio.wait_for(reader.read(1), 3))
        self.assertEqual(3, self.fixture.auth_attempts)
        self.assertEqual(3, len(self.failures))
        self.assertEqual(3, len(set(event for _, event in self.failures)))
        reader2, writer2 = await self.connect()
        writer2.write(command("AUTH", "correct"))
        await writer2.drain()
        await self.assert_closed(reader2)

    async def test_other_source_keeps_working_and_manual_unban_allows_reconnect(self):
        pair = await self.connect("127.0.0.1")
        for _ in range(3):
            await self.exchange(pair, "AUTH", "bad")
        other = await self.connect("127.0.0.2")
        self.assertEqual((b"+", b"OK"), await self.exchange(other, "AUTH", "correct"))
        self.assertEqual((b"+", b"PONG"), await self.exchange(other, "PING"))
        self.assertEqual({"127.0.0.1"}, self.banned)
        self.banned.clear()
        self.counts.clear()
        fresh = await self.connect()
        self.assertEqual((b"+", b"OK"), await self.exchange(fresh, "AUTH", "correct"))

    async def test_success_and_binary_large_pipeline_preserve_data(self):
        pair = await self.connect()
        self.assertEqual((b"+", b"OK"), await self.exchange(pair, "AUTH", "correct"))
        value = b"\xff\x00\r\n*3\r\n" * 100000
        reader, writer = pair
        writer.write(command("SET", "binary", value) + command("GET", "binary") + command("PING"))
        await writer.drain()
        self.assertEqual((b"+", b"OK"), await reply(reader))
        self.assertEqual((b"$", value), await reply(reader))
        self.assertEqual((b"+", b"PONG"), await reply(reader))
        self.assertFalse(self.failures)

    async def test_fragmented_hello_auth_and_resp3_push_do_not_misattribute(self):
        pair = await self.connect()
        reader, writer = pair
        frame = command("HELLO", 3, "AUTH", "default", "bad")
        for part in frame:
            writer.write(bytes([part]))
            await writer.drain()
            await asyncio.sleep(0)
        self.assertEqual(b"-", (await reply(reader))[0])
        self.assertEqual(1, len(self.failures))
        self.assertEqual(b"%", (await self.exchange(pair, "HELLO", 3, "AUTH", "default", "correct"))[0])
        writer.write(command("PUSH") + command("AUTH", "bad") + command("PING"))
        await writer.drain()
        self.assertEqual(b">", (await reply(reader))[0])
        self.assertEqual((b"+", b"OK"), await reply(reader))
        self.assertEqual(b"-", (await reply(reader))[0])
        self.assertEqual((b"+", b"PONG"), await reply(reader))
        self.assertEqual(2, len(self.failures))

    async def test_noauth_noperm_and_non_auth_wrongpass_do_not_ban(self):
        pair = await self.connect()
        for name in ("FAILNOAUTH", "FAILNOPERM", "BLOBFAIL"):
            await self.exchange(pair, name)
        self.assertFalse(self.failures)
        self.assertEqual((b"+", b"PONG"), await self.exchange(pair, "PING"))

    async def test_business_arrays_cannot_spoof_pubsub_and_hide_auth_errors(self):
        pair = await self.connect()
        reader, writer = pair
        writer.write(command("FAKEPUBSUB", "subscribe") + command("AUTH", "bad")
                     + command("FAKEPUBSUB", "message") + command("AUTH", "bad"))
        await writer.drain()
        for expected in (b"*", b"-", b"*", b"-"):
            self.assertEqual(expected, (await asyncio.wait_for(reply(reader), 3))[0])
        self.assertEqual(2, len(self.failures))

    async def test_resp3_business_arrays_during_subscription_are_not_pushes(self):
        pair = await self.connect()
        await self.exchange(pair, "HELLO", 3)
        reader, writer = pair
        writer.write(command("SUBSCRIBE", "one") + command("FAKEPUBSUB", "message") + command("AUTH", "bad"))
        await writer.drain()
        for expected in (b">", b">", b"*", b"-"):
            self.assertEqual(expected, (await asyncio.wait_for(reply(reader), 3))[0])
        self.assertEqual(1, len(self.failures))

    async def test_exec_counts_failed_auth_children_not_queued(self):
        pair = await self.connect()
        for parts in (("MULTI",), ("AUTH", "bad"), ("GET", "missing"), ("AUTH", "bad")):
            await self.exchange(pair, *parts)
        self.assertFalse(self.failures)
        result = await self.exchange(pair, "EXEC")
        self.assertEqual(b"*", result[0])
        self.assertEqual(2, len(self.failures))
        await self.exchange(pair, "AUTH", "bad")
        self.assertEqual(3, len(self.failures))

    async def test_discard_does_not_count_unexecuted_auth(self):
        pair = await self.connect()
        await self.exchange(pair, "MULTI")
        await self.exchange(pair, "AUTH", "bad")
        await self.exchange(pair, "DISCARD")
        self.assertFalse(self.failures)
        self.assertEqual((b"+", b"PONG"), await self.exchange(pair, "PING"))

    async def test_pubsub_resp2_multi_ack_unsolicited_message_and_unsubscribe_all(self):
        pair = await self.connect()
        reader, writer = pair
        writer.write(command("SUBSCRIBE", "one", "two"))
        await writer.drain()
        self.assertEqual(b"subscribe", (await reply(reader))[1][0][1])
        self.assertEqual(b"subscribe", (await reply(reader))[1][0][1])
        self.assertEqual(b"message", (await asyncio.wait_for(reply(reader), 3))[1][0][1])
        writer.write(command("UNSUBSCRIBE") + command("AUTH", "bad") + command("PING"))
        await writer.drain()
        for _ in range(2):
            self.assertEqual(b"unsubscribe", (await reply(reader))[1][0][1])
        self.assertEqual(b"-", (await reply(reader))[0])
        self.assertEqual((b"+", b"PONG"), await reply(reader))
        self.assertEqual(1, len(self.failures))

    async def test_resp3_subscription_push_ack_preserves_following_auth_mapping(self):
        pair = await self.connect()
        await self.exchange(pair, "HELLO", 3)
        reader, writer = pair
        writer.write(command("SUBSCRIBE", "one", "two") + command("AUTH", "bad"))
        await writer.drain()
        for _ in range(3):
            self.assertEqual(b">", (await reply(reader))[0])
        self.assertEqual(b"-", (await reply(reader))[0])
        self.assertEqual(1, len(self.failures))

    async def test_attributes_and_streamed_frames_keep_next_reply_aligned(self):
        pair = await self.connect()
        reader, writer = pair
        writer.write(command("ATTR") + command("STREAM") + command("STREAMARRAY") + command("AUTH", "bad"))
        await writer.drain()
        self.assertEqual(b"|", (await reply(reader))[0])
        self.assertEqual((b"+", b"OK"), await reply(reader))
        streamed = b"$?\r\n;3\r\nabc\r\n;4\r\ndefg\r\n;0\r\n"
        aggregate = b"*?\r\n:1\r\n:2\r\n.\r\n"
        self.assertEqual(streamed, await reader.readexactly(len(streamed)))
        self.assertEqual(aggregate, await reader.readexactly(len(aggregate)))
        self.assertEqual(b"-", (await reply(reader))[0])
        self.assertEqual(1, len(self.failures))

    async def test_auth_response_suppression_commands_are_not_forwarded(self):
        for parts in (("CLIENT", "REPLY", "OFF"), ("CLIENT", "REPLY", "SKIP"),
                      ("CLIENT", b"REPLY\x00suffix", b"OFF\x00suffix"),
                      ("MONITOR",), ("SYNC",), ("PSYNC", "?", -1)):
            reader, writer = await self.connect()
            writer.write(command(*parts) + command("AUTH", "bad"))
            await writer.drain()
            self.assertEqual(b"", await asyncio.wait_for(reader.read(1), 3))
        self.assertEqual(0, self.fixture.auth_attempts)
        self.assertEqual(0, self.fixture.commands[b"CLIENT"])
        self.assertFalse(self.failures)

    async def test_hello_auth_nul_suffix_cannot_hide_failed_authentication(self):
        pair = await self.connect()
        self.assertEqual(b"-", (await self.exchange(pair, "HELLO", 3, b"AUTH\x00" + b"x" * 100, "default", "bad"))[0])
        self.assertEqual(1, len(self.failures))

    async def test_inline_auth_and_inline_reply_suppression(self):
        reader, writer = await self.connect()
        writer.write(b"AUTH bad\r\n")
        await writer.drain()
        self.assertEqual(b"-", (await reply(reader))[0])
        self.assertEqual(1, len(self.failures))
        writer.write(b'"CLIENT" "REPLY" "OFF"\r\nAUTH bad\r\n')
        await writer.drain()
        self.assertEqual(b"", await asyncio.wait_for(reader.read(1), 3))
        self.assertEqual(1, self.fixture.auth_attempts)

    async def test_inline_c_whitespace_cannot_hide_reply_suppression(self):
        for separator in (b"\v", b"\f", b"\t"):
            reader, writer = await self.connect()
            writer.write(separator + b"CLIENT" + separator + b"REPLY" + separator + b"OFF\r\nAUTH bad\r\n")
            await writer.drain()
            await self.assert_closed(reader)
        self.assertEqual(0, self.fixture.auth_attempts)

    async def test_malformed_tls_and_proxy_header_never_claim_source_ip(self):
        for payload in (b"\x16\x03\x01\x00\x10", b"PROXY TCP4 203.0.113.5 127.0.0.1 1234 6379\r\n",
                        b"*2\r\n$4\r\nAUTH\r\n$999999999999999999\r\n", b"*1\r\n$4\r\nAUTHxx"):
            reader, writer = await self.connect()
            writer.write(payload)
            await writer.drain()
            self.assertEqual(b"", await asyncio.wait_for(reader.read(1), 3))
        self.assertFalse(self.failures)
        self.assertEqual(0, self.fixture.auth_attempts)

    async def test_shutdown_closes_existing_sessions_and_listener(self):
        reader, writer = await self.connect()
        await self.exchange((reader, writer), "PING")
        await self.proxy.close()
        self.assertEqual(b"", await asyncio.wait_for(reader.read(1), 3))
        self.assertEqual({}, self.proxy.connections)
        with self.assertRaises(OSError):
            await asyncio.open_connection("127.0.0.1", self.proxy.port)

    async def test_external_ban_disconnects_already_authenticated_connection(self):
        reader, writer = await self.connect()
        await self.exchange((reader, writer), "AUTH", "correct")
        self.banned.add("127.0.0.1")
        self.assertEqual(b"", await asyncio.wait_for(reader.read(1), 2))

    async def test_no_password_material_in_status_or_error_output(self):
        capture = io.StringIO()
        with contextlib.redirect_stderr(capture), contextlib.redirect_stdout(capture):
            pair = await self.connect()
            await self.exchange(pair, "AUTH", "test-secret-never-log-7fa3")
        self.assertNotIn("test-secret", capture.getvalue())
        self.assertNotIn("test-secret", self.proxy.last_error)
        self.assertFalse(any("test-secret" in event for _, event in self.failures))

    async def test_guard_write_failure_closes_connection_without_logging_callback_text(self):
        async def broken(ip, event):
            raise RuntimeError("private-secret-in-underlying-provider-error")

        self.proxy.on_failure = broken
        reader, writer = await self.connect()
        writer.write(command("AUTH", "bad") + command("AUTH", "bad"))
        await writer.drain()
        await self.assert_closed(reader)
        self.assertEqual(1, self.fixture.auth_attempts)
        self.assertNotIn("private-secret", self.proxy.last_error)

    async def test_auth_event_is_recorded_before_client_disconnect_or_write_error(self):
        class DisconnectedWriter:
            def write(self, data):
                raise ConnectionResetError("peer reset")

            async def drain(self):
                pass

        for payload in (b"-WRONGPASS invalid username-password pair\r\n", b"!9\r\nWRONGPASS\r\n"):
            reader = asyncio.StreamReader()
            reader.feed_data(payload)
            reader.feed_eof()
            events = []

            async def record(path, frame):
                if frame.authentication_error:
                    events.append(path)

            with self.assertRaises(ConnectionResetError):
                await module._response(module._Wire(reader, DisconnectedWriter(), ProxyLimits()), on_error=record)
            self.assertEqual([()], events)

    async def test_connection_capacity_preserves_existing_client(self):
        self.proxy.limits = ProxyLimits(max_connections=1, idle_seconds=3)
        first = await self.connect()
        await self.exchange(first, "PING")
        reader, writer = await self.connect()
        writer.write(command("AUTH", "bad"))
        await writer.drain()
        await self.assert_closed(reader)
        self.assertEqual((b"+", b"PONG"), await self.exchange(first, "PING"))
        self.assertEqual(0, self.fixture.auth_attempts)

    async def test_bulk_limit_rejects_payload_without_authentication_event(self):
        self.proxy.limits = ProxyLimits(max_bulk=128, idle_seconds=3)
        reader, writer = await self.connect()
        writer.write(command("SET", "key", b"x" * 129))
        await writer.drain()
        await self.assert_closed(reader)
        self.assertFalse(self.failures)

    async def test_manager_reconcile_disable_enable_status_and_cleanup(self):
        counts, banned, policy = Counter(), set(), {"enabled": False}

        def record(ip, event_id, service):
            self.assertEqual("redis", service)
            counts[ip] += 1
            if counts[ip] >= 3:
                banned.add(ip)
            return ip in banned

        manager = module.RedisProxyManager(record, lambda ip: ip in banned, lambda: policy)
        with socket.socket() as reserved:
            reserved.bind(("127.0.0.1", 0))
            port = reserved.getsockname()[1]
        entry = {"id": "fixture-redis", "bindAddress": "127.0.0.1", "listenPort": port,
                 "backendHost": "127.0.0.1", "backendPort": self.fixture.server.sockets[0].getsockname()[1]}
        try:
            status = await asyncio.to_thread(manager.reconcile, [entry])
            self.assertEqual("listening", status[0]["state"])
            pair = await asyncio.open_connection("127.0.0.1", port)
            self.clients.append(pair)
            for _ in range(4):
                await self.exchange(pair, "AUTH", "bad")
            self.assertEqual({}, counts)
            policy["enabled"] = True
            for _ in range(3):
                await self.exchange(pair, "AUTH", "bad")
            await self.assert_closed(pair[0])
            self.assertEqual(3, counts["127.0.0.1"])
            status = await asyncio.to_thread(manager.status)
            self.assertEqual(7, status[0]["authenticationFailures"])
            self.assertFalse(status[0]["tls"])
            await asyncio.to_thread(manager.reconcile, [])
            self.assertEqual([], await asyncio.to_thread(manager.status))
            with self.assertRaises(OSError):
                await asyncio.open_connection("127.0.0.1", port)
        finally:
            await asyncio.to_thread(manager.close)
        self.assertFalse(manager.thread.is_alive())

    async def test_manager_reports_bind_failure_and_preserves_other_listener(self):
        manager = module.RedisProxyManager(lambda *args: False, lambda ip: False, lambda: {"enabled": True})
        entry = {"id": "occupied", "bindAddress": "127.0.0.1", "listenPort": self.proxy.port,
                 "backendHost": "127.0.0.1", "backendPort": self.fixture.server.sockets[0].getsockname()[1]}
        try:
            status = await asyncio.to_thread(manager.reconcile, [entry])
            self.assertEqual("error", status[0]["state"])
            self.assertEqual("listen_failed", status[0]["error"])
            pair = await self.connect()
            self.assertEqual((b"+", b"PONG"), await self.exchange(pair, "PING"))
        finally:
            await asyncio.to_thread(manager.close)

    def test_ip_normalization_and_inline_escaping(self):
        self.assertEqual("127.0.0.1", module.normalize_ip("::ffff:127.0.0.1"))
        self.assertEqual("2001:db8::1", module.normalize_ip("2001:0db8::1"))
        self.assertEqual([b"CLIENT", b"REPLY", b"OFF"], module._inline_tokens(b'"CL\x49ENT" "REPLY" "OFF"'))
        self.assertEqual([b"CLIENT", b"REPLY", b"OFF"], module._inline_tokens(b'"CL\\x49ENT" "REPLY" "OFF"'))


if __name__ == "__main__":
    unittest.main()
