"""只管理带归属标记的自有防火墙对象，不清空宿主或 Docker 的规则。"""
from __future__ import annotations

import ipaddress
import json
import shutil
import subprocess
import threading
import time

from store import GuardError, canonical_ip


TABLE = "microi_auth_guard"
CHAIN = "MICROI-AUTH-GUARD"
MARKER = "microi-auth-guard:v1"


def run_command(args, input_text=None, check=True):
    """参数数组调用固定程序；禁止 shell，超时与结果体均有限。"""
    try:
        result = subprocess.run(args, input=input_text, text=True, encoding="utf-8", errors="replace",
                                capture_output=True, timeout=15, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise GuardError("宿主防火墙命令不可用或超时：" + str(args[0]), 503) from exc
    if len(result.stdout) > 4 * 1024 * 1024:
        raise GuardError("防火墙回读超过安全上限。", 503)
    if check and result.returncode:
        # 不返回任意执行输出，避免其它规则/系统信息泄漏到 Web。
        raise GuardError("防火墙命令失败：" + str(args[0]) + "，退出码 " + str(result.returncode), 503)
    return result


class Firewall:
    def __init__(self, backend="auto", runner=run_command, finder=shutil.which, clock=time.time):
        self.runner, self.finder, self.clock = runner, finder, clock
        self.backend = backend
        self.lock = threading.RLock()
        self.last = {"status": "initializing", "backend": backend, "message": "尚未检查宿主防火墙。", "verified": False}
        self.redis_backends = set()

    def _run(self, args, text=None, check=True):
        return self.runner(args, input_text=text, check=check)

    def select(self):
        if self.backend == "auto":
            if self.finder("nft") and self._run(["nft", "-j", "list", "tables"], check=False).returncode == 0:
                self.backend = "nftables"
            elif self.finder("iptables") and self.finder("ip6tables"):
                self.backend = "iptables"
            else:
                raise GuardError("没有可用的 nftables 或 iptables/ip6tables；未启用网络封禁。", 503)
        if self.backend not in ("nftables", "iptables"):
            raise GuardError("不支持的防火墙后端。", 503)

    def status(self):
        with self.lock:
            return dict(self.last)

    def sync(self, bans, enabled=True, redis_backends=()):
        with self.lock:
            try:
                self.select()
                desired = {canonical_ip(row["ip"]): max(1, int(row["expiresAt"] - self.clock()))
                           for row in bans if row["expiresAt"] > self.clock()} if enabled else {}
                # Redis 原始后端禁止外部 forward 绕过；关闭密码计数也保留此拓扑边界。
                self.redis_backends = {canonical_ip(ip) for ip in redis_backends}
                actual = self._nft(desired) if self.backend == "nftables" else self._iptables(desired)
                if set(desired) != actual:
                    raise GuardError("封禁规则回读不一致。", 503)
                self.last = {"status": "ready", "backend": self.backend, "verified": True,
                             "message": "宿主与转发规则已回读；网络实测须独立验收。",
                             "observedAt": self.clock(), "blockedIps": len(actual),
                             "redisBackends": len(self.redis_backends), "packetTested": False,
                             "expiryMode": "kernel-timeout" if self.backend == "nftables" else "daemon-reconciled",
                             "automaticExpiryRequiresDaemon": self.backend == "iptables"}
                return actual
            except Exception as exc:
                self.last = {"status": "degraded", "backend": self.backend, "verified": False,
                             "message": str(exc)[:300], "observedAt": self.clock(), "packetTested": False}
                raise

    def _nft_read(self):
        result = self._run(["nft", "-j", "list", "table", "inet", TABLE], check=False)
        if result.returncode:
            return None
        try:
            objects = json.loads(result.stdout)["nftables"]
        except (ValueError, KeyError, TypeError) as exc:
            raise GuardError("nftables 返回格式无效。", 503) from exc
        tables = [o["table"] for o in objects if "table" in o]
        if not any(t.get("name") == TABLE and t.get("comment") == MARKER for t in tables):
            raise GuardError("同名 nftables 表没有吾码归属标记，保留现场。", 409)
        if any("dormant" in t.get("flags", []) for t in tables):
            raise GuardError("吾码 nftables 表已被设为 dormant，未执行拦截。", 503)
        return objects

    @staticmethod
    def _set_values(objects, name):
        for obj in objects:
            value = obj.get("set")
            if value and value.get("name") == name:
                result = set()
                for element in value.get("elem", []):
                    if isinstance(element, dict):
                        element = element.get("elem", {}).get("val")
                    result.add(canonical_ip(element))
                return result
        raise GuardError("防火墙集合缺失：" + name, 503)

    def _nft(self, desired):
        objects = self._nft_read()
        if objects is None:
            # 单事务创建全套自有结构，失败不会残留半套规则。
            text = f'''add table inet {TABLE} {{ comment "{MARKER}"; }}
add set inet {TABLE} banned4 {{ type ipv4_addr; flags timeout; }}
add set inet {TABLE} banned6 {{ type ipv6_addr; flags timeout; }}
add set inet {TABLE} redis4 {{ type ipv4_addr; }}
add set inet {TABLE} redis6 {{ type ipv6_addr; }}
add chain inet {TABLE} input {{ type filter hook input priority -10; policy accept; }}
add chain inet {TABLE} forward {{ type filter hook forward priority -10; policy accept; }}
add rule inet {TABLE} input ip saddr @banned4 drop comment "{MARKER}:input4"
add rule inet {TABLE} input ip6 saddr @banned6 drop comment "{MARKER}:input6"
add rule inet {TABLE} forward ip saddr @banned4 drop comment "{MARKER}:forward4"
add rule inet {TABLE} forward ip6 saddr @banned6 drop comment "{MARKER}:forward6"
add rule inet {TABLE} forward ip daddr @redis4 tcp dport 6379 drop comment "{MARKER}:redis4"
add rule inet {TABLE} forward ip6 daddr @redis6 tcp dport 6379 drop comment "{MARKER}:redis6"
'''
            self._run(["nft", "-f", "-"], text)
            objects = self._nft_read()
        self._verify_nft_structure(objects)
        commands = []
        for version in (4, 6):
            name = "banned" + str(version)
            actual = self._set_values(objects, name)
            needed = {ip for ip in desired if ipaddress.ip_address(ip).version == version}
            for ip in sorted(actual-needed):
                commands.append(f"delete element inet {TABLE} {name} {{ {ip} }}")
            for ip in sorted(needed-actual):
                commands.append(f"add element inet {TABLE} {name} {{ {ip} timeout {desired[ip]}s }}")
            name = "redis" + str(version)
            actual = self._set_values(objects, name)
            needed = {ip for ip in self.redis_backends if ipaddress.ip_address(ip).version == version}
            for ip in sorted(actual-needed):
                commands.append(f"delete element inet {TABLE} {name} {{ {ip} }}")
            for ip in sorted(needed-actual):
                commands.append(f"add element inet {TABLE} {name} {{ {ip} }}")
        if commands:
            self._run(["nft", "-f", "-"], "\n".join(commands) + "\n")
        verified = self._nft_read()
        self._verify_nft_structure(verified)
        for version in (4, 6):
            if self._set_values(verified, "redis"+str(version)) != {ip for ip in self.redis_backends if ipaddress.ip_address(ip).version == version}:
                raise GuardError("Redis 后端直连拦截规则回读失败。", 503)
        return self._set_values(verified, "banned4") | self._set_values(verified, "banned6")

    def _verify_nft_structure(self, objects):
        if objects is None:
            raise GuardError("nftables 自有表回读失败。", 503)
        chains = {obj["chain"]["name"]: obj["chain"] for obj in objects if "chain" in obj}
        rules = [obj["rule"] for obj in objects if "rule" in obj]
        if len(rules) != 6 or set(chains) != {"input", "forward"}:
            raise GuardError("吾码 nftables 表出现额外或缺失的链/规则。", 503)
        sets = {obj["set"]["name"]: obj["set"] for obj in objects if "set" in obj}
        if set(sets) != {"banned4", "banned6", "redis4", "redis6"}:
            raise GuardError("吾码 nftables 集合结构不匹配。", 503)
        for name, item in sets.items():
            if item.get("type") != ("ipv4_addr" if name.endswith("4") else "ipv6_addr") or set(item.get("flags", [])) != ({"timeout"} if name.startswith("banned") else set()):
                raise GuardError("吾码 nftables 集合类型或超时标志不匹配。", 503)
        for name in ("input", "forward"):
            item = chains.get(name, {})
            if item.get("hook") != name or item.get("type") != "filter" or item.get("prio") != -10 or item.get("policy") != "accept":
                raise GuardError("吾码 nftables 链结构被修改，拒绝假定拦截有效。", 503)
        # 不只检查注释：实际表达式必须包含对应源/目的集合及 drop。
        for chain, kind in (("input", "input"), ("forward", "forward"), ("forward", "redis")):
            for version in (4, 6):
                tag = f"{MARKER}:{kind}{version}"
                rules = [o["rule"] for o in objects if o.get("rule", {}).get("comment") == tag]
                field = "daddr" if kind == "redis" else "saddr"
                family = "ip" if version == 4 else "ip6"
                setname = ("redis" if kind == "redis" else "banned") + str(version)
                expected = [{"match": {"op": "==", "left": {"payload": {"protocol": family, "field": field}}, "right": "@"+setname}}]
                if kind == "redis":
                    expected.append({"match": {"op": "==", "left": {"payload": {"protocol": "tcp", "field": "dport"}}, "right": 6379}})
                expected.append({"drop": None})
                if len(rules) != 1 or rules[0].get("chain") != chain or rules[0].get("expr") != expected:
                    raise GuardError("吾码 nftables 拦截规则不匹配。", 503)

    def _iptables(self, desired):
        all_actual = set()
        for version, binary in ((4, "iptables"), (6, "ip6tables")):
            if not self.finder(binary):
                raise GuardError("缺少 " + binary + "，不能保证双栈封禁。", 503)
            base = [binary, "-w", "5"]
            result = self._run(base + ["-S", CHAIN], check=False)
            marker = ["-m", "comment", "--comment", MARKER, "-j", "RETURN"]
            if result.returncode:
                self._run(base + ["-N", CHAIN])
                self._run(base + ["-A", CHAIN] + marker)
            elif self._run(base + ["-C", CHAIN] + marker, check=False).returncode:
                raise GuardError("同名 iptables 链没有吾码归属标记。", 409)
            for target in ("INPUT", "FORWARD", "DOCKER-USER"):
                if target == "DOCKER-USER" and self._run(base + ["-S", target], check=False).returncode:
                    continue
                if self._run(base + ["-C", target, "-j", CHAIN], check=False).returncode:
                    self._run(base + ["-I", target, "1", "-j", CHAIN])
                # 必须位于接受已建立连接规则之前；不能只检查跳转存在。
                rules = self._run(base + ["-S", target]).stdout.splitlines()
                first = next((line for line in rules if line.startswith("-A ")), "")
                if first != "-A " + target + " -j " + CHAIN:
                    raise GuardError(target + " 中吾码跳转不是首条，无法保证拦截。", 503)
            lines = self._run(base + ["-S", CHAIN]).stdout.splitlines()
            existing = self._parse_iptables(lines)
            needed = {ip for ip in desired if ipaddress.ip_address(ip).version == version}
            needed_redis = {ip for ip in self.redis_backends if ipaddress.ip_address(ip).version == version}
            for ip in sorted(existing[0]-needed):
                self._run(base + ["-D", CHAIN, "-s", ip, "-j", "DROP"])
            for ip in sorted(needed-existing[0]):
                self._run(base + ["-I", CHAIN, "1", "-s", ip, "-j", "DROP"])
            # 直连后端只拦 forward，INPUT 中该目的地址不会是本机地址。
            for ip in sorted(existing[1]-needed_redis):
                self._run(base + ["-D", CHAIN, "-d", ip, "-p", "tcp", "--dport", "6379", "-j", "DROP"])
            for ip in sorted(needed_redis-existing[1]):
                self._run(base + ["-I", CHAIN, "1", "-d", ip, "-p", "tcp", "--dport", "6379", "-j", "DROP"])
            actual, redis = self._parse_iptables(self._run(base + ["-S", CHAIN]).stdout.splitlines())
            if actual != needed or redis != needed_redis:
                raise GuardError("iptables 封禁/Redis 后端规则回读失败。", 503)
            all_actual |= actual
        return all_actual

    @staticmethod
    def _parse_iptables(lines):
        import shlex
        banned, redis = set(), set()
        marker_seen = False
        for line in lines:
            words = shlex.split(line)
            if not words or words[0] in ("-N", "-P"):
                continue
            if words == ["-A", CHAIN, "-m", "comment", "--comment", MARKER, "-j", "RETURN"]:
                if marker_seen:
                    raise GuardError("吾码封禁链有重复归属 RETURN。", 503)
                marker_seen = True
                continue
            if marker_seen:
                raise GuardError("吾码封禁规则位于 RETURN 之后，无法拦截。", 503)
            prefix = words[:2]
            rule = words[2:]
            if prefix != ["-A", CHAIN]:
                raise GuardError("iptables 回读链不匹配。", 503)
            if len(rule) == 4 and rule[0] == "-s" and rule[2:] == ["-j", "DROP"]:
                network = ipaddress.ip_network(rule[1], strict=False)
                if network.num_addresses != 1:
                    raise GuardError("封禁链包含未登记网段。", 503)
                banned.add(str(network.network_address))
            elif rule[:1] == ["-d"] and rule[-4:] == ["--dport", "6379", "-j", "DROP"] and rule[2:-4] in (["-p", "tcp"], ["-p", "tcp", "-m", "tcp"]):
                network = ipaddress.ip_network(rule[1], strict=False)
                if network.num_addresses != 1:
                    raise GuardError("Redis 拦截包含未登记网段。", 503)
                redis.add(str(network.network_address))
            else:
                raise GuardError("吾码防火墙链出现未知规则，保留现场。", 409)
        if not marker_seen:
            raise GuardError("吾码封禁链缺少归属 RETURN。", 503)
        return banned, redis
