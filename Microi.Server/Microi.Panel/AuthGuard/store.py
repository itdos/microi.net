"""宿主认证防护的持久事实源；不依赖被保护的任何数据库服务。"""
from __future__ import annotations

import ipaddress
import json
import math
import sqlite3
import threading
import time
import uuid
from pathlib import Path


DEFAULT_POLICY = {"enabled": True, "maxFailures": 3, "banSeconds": 86400,
                  "windowSeconds": 0, "allowlist": [], "revision": "initial-v1", "generation": 1}
MAX_TRACKED_IPS = 100000
MAX_BANS = 10000
MAX_EVENTS = 500000


class GuardError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def canonical_ip(value):
    """只接受数字地址；禁止 DNS、zone id、端口与代理头进入防火墙参数。"""
    if not isinstance(value, str) or len(value) > 45 or "%" in value:
        raise GuardError("来源必须是数字 IPv4/IPv6 地址。")
    try:
        address = ipaddress.ip_address(value)
    except ValueError as exc:
        raise GuardError("来源必须是数字 IPv4/IPv6 地址。") from exc
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    if address.is_unspecified or address.is_multicast:
        raise GuardError("不允许未指定地址或组播地址。")
    return str(address)


def validate_policy(patch, current, require_revision=True):
    if not isinstance(patch, dict):
        raise GuardError("策略必须是 JSON 对象。")
    fields = {"enabled", "maxFailures", "banSeconds", "windowSeconds", "allowlist", "expectedRevision"}
    if set(patch) - fields:
        raise GuardError("策略包含不允许修改的字段；日志来源只能由宿主配置。")
    if require_revision and (type(patch.get("expectedRevision")) is not str or
                             patch["expectedRevision"] != current["revision"]):
        raise GuardError("防护策略已变化，请刷新后重试。", 409)
    value = dict(current)
    for key in fields - {"expectedRevision"}:
        if key in patch:
            value[key] = patch[key]
    if type(value["enabled"]) is not bool:
        raise GuardError("enabled 必须是布尔值。")
    for key, low, high in (("maxFailures", 1, 100), ("banSeconds", 60, 31536000),
                           ("windowSeconds", 0, 86400)):
        if type(value[key]) is not int or not low <= value[key] <= high:
            raise GuardError(f"{key} 必须在 {low}–{high} 之间。")
    if not isinstance(value["allowlist"], list) or len(value["allowlist"]) > 256:
        raise GuardError("白名单最多允许 256 个 IP/CIDR。")
    networks = []
    for item in value["allowlist"]:
        if not isinstance(item, str) or len(item) > 49 or "%" in item:
            raise GuardError("白名单必须是数字 IP/CIDR。")
        try:
            network = ipaddress.ip_network(item, strict=False)
        except ValueError as exc:
            raise GuardError("白名单必须是数字 IP/CIDR。") from exc
        if network.prefixlen == 0:
            raise GuardError("不允许将整个 IPv4/IPv6 互联网加入白名单。")
        networks.append(str(network))
    value["allowlist"] = sorted(set(networks))
    value["revision"] = str(uuid.uuid4())
    value["generation"] = current.get("generation", 1) + 1
    return value


class Store:
    """同一宿主只有一个代理进程；线程共用事务锁，SQLite 保存重启事实。"""
    def __init__(self, path, clock=time.time):
        self.clock = clock
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(path), timeout=5, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=FULL;
            PRAGMA busy_timeout=5000;
            CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, ip TEXT NOT NULL,
                service TEXT NOT NULL, occurred REAL NOT NULL, seen REAL NOT NULL, counted INTEGER NOT NULL DEFAULT 1);
            CREATE INDEX IF NOT EXISTS ix_events_ip_time ON events(ip,occurred);
            CREATE INDEX IF NOT EXISTS ix_events_seen ON events(seen);
            CREATE TABLE IF NOT EXISTS counters (ip TEXT PRIMARY KEY, count INTEGER NOT NULL,
                first REAL NOT NULL, last REAL NOT NULL, service TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS bans (ip TEXT PRIMARY KEY, created REAL NOT NULL,
                expires REAL NOT NULL, reason TEXT NOT NULL, service TEXT NOT NULL,
                applied INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS resets (ip TEXT PRIMARY KEY, before REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS cursors (source TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred REAL NOT NULL, action TEXT NOT NULL, ip TEXT, detail TEXT NOT NULL);
        """)
        if "counted" not in {row[1] for row in self.db.execute("PRAGMA table_info(events)")}:
            self.db.execute("ALTER TABLE events ADD COLUMN counted INTEGER NOT NULL DEFAULT 1")
        with self.lock, self.db:
            self.db.execute("INSERT OR IGNORE INTO metadata VALUES('policy',?)", (json.dumps(DEFAULT_POLICY),))
            self.db.execute("INSERT OR IGNORE INTO metadata VALUES('activated',?)", (str(clock()),))
            policy = json.loads(self.db.execute("SELECT value FROM metadata WHERE key='policy'").fetchone()[0])
            if "generation" not in policy:
                policy["generation"] = 1
                self.db.execute("UPDATE metadata SET value=? WHERE key='policy'", (json.dumps(policy),))

    def close(self):
        with self.lock:
            self.db.close()

    def policy(self):
        with self.lock:
            return json.loads(self.db.execute("SELECT value FROM metadata WHERE key='policy'").fetchone()[0])

    def _audit(self, action, ip=None, detail=""):
        self.db.execute("INSERT INTO audit(occurred,action,ip,detail) VALUES(?,?,?,?)",
                        (self.clock(), action, ip, detail[:300]))

    def update_policy(self, patch):
        with self.lock, self.db:
            value = validate_policy(patch, self.policy())
            self.db.execute("UPDATE metadata SET value=? WHERE key='policy'", (json.dumps(value),))
            self._audit("policy", detail="revision=" + str(value["revision"]))
            # 修改白名单会解除对应现有封禁；禁用只移除规则，保留可恢复台账。
            for row in self.db.execute("SELECT ip FROM bans").fetchall():
                if self.allowed(row[0], value):
                    self._unban(row[0], "allowlist")
            return value

    def allowed(self, ip, policy=None, local_ips=()):
        address = ipaddress.ip_address(canonical_ip(ip))
        if address.is_loopback or str(address) in local_ips:
            return True
        return any(address in ipaddress.ip_network(net) for net in (policy or self.policy())["allowlist"])

    def cursor(self, source):
        with self.lock:
            row = self.db.execute("SELECT value FROM cursors WHERE source=?", (source,)).fetchone()
            return json.loads(row[0]) if row else None

    def set_cursor(self, source, value):
        with self.lock, self.db:
            self.db.execute("INSERT INTO cursors VALUES(?,?) ON CONFLICT(source) DO UPDATE SET value=excluded.value",
                            (source, json.dumps(value)))

    def failure(self, ip, event_id, service, occurred=None, local_ips=()):
        ip = canonical_ip(ip)
        if not isinstance(event_id, str) or not 1 <= len(event_id) <= 256 or any(ord(c) < 32 for c in event_id):
            raise GuardError("eventId 无效。")
        if not isinstance(service, str) or not 1 <= len(service) <= 80 or any(ord(c) < 32 for c in service):
            raise GuardError("service 无效。")
        now = self.clock()
        occurred = now if occurred is None else occurred
        if type(occurred) not in (int, float) or not math.isfinite(occurred) or occurred > now + 60:
            raise GuardError("认证事件时间无效。")
        with self.lock, self.db:
            policy = self.policy()
            if not policy["enabled"]:
                return {"accepted": False, "ignoredReason": "disabled", "banned": False}
            if self.allowed(ip, policy, local_ips):
                return {"accepted": False, "ignoredReason": "allowlisted", "banned": False}
            activated = float(self.db.execute("SELECT value FROM metadata WHERE key='activated'").fetchone()[0])
            reset = self.db.execute("SELECT before FROM resets WHERE ip=?", (ip,)).fetchone()
            before = max(activated, reset[0] if reset else 0)
            if occurred < before or (policy["windowSeconds"] and occurred < now - policy["windowSeconds"]):
                return {"accepted": False, "ignoredReason": "stale", "banned": bool(self.ban(ip))}
            # 去重历史有明确边界；超出边界不能静默重算累计计数。
            if occurred < now - 172800:
                raise GuardError("认证事件早于两天去重保留边界，无法安全重放；该来源防护降级。", 503)
            if self.db.execute("SELECT 1 FROM events WHERE id=?", (event_id,)).fetchone():
                return {"accepted": False, "ignoredReason": "duplicate", "banned": bool(self.ban(ip))}
            existing_ban = self.ban(ip)
            if existing_ban:
                return {"accepted": False, "ignoredReason": "already-banned", "banned": True, "ban": existing_ban}
            # 达上限时显式退化，不能驱逐累计计数后仍声称防护完整。
            previous = self.db.execute("SELECT * FROM counters WHERE ip=?", (ip,)).fetchone()
            if previous is None and self.db.execute("SELECT COUNT(*) FROM counters").fetchone()[0] >= MAX_TRACKED_IPS:
                raise GuardError("来源计数容量已满，防护降级；请检查攻击与保留策略。", 503)
            if self.db.execute("SELECT COUNT(*) FROM events").fetchone()[0] >= MAX_EVENTS:
                raise GuardError("认证事件去重容量已满，防护降级。", 503)
            self.db.execute("INSERT INTO events(id,ip,service,occurred,seen) VALUES(?,?,?,?,?)", (event_id, ip, service, occurred, now))
            if policy["windowSeconds"]:
                count = self.db.execute("SELECT COUNT(*) FROM events WHERE ip=? AND counted=1 AND occurred>=? AND occurred>=?",
                                        (ip, now-policy["windowSeconds"], before)).fetchone()[0]
            else:
                count = (previous["count"] if previous else 0) + 1
            self.db.execute("INSERT INTO counters VALUES(?,?,?,?,?) ON CONFLICT(ip) DO UPDATE SET "
                            "count=excluded.count,last=excluded.last,service=excluded.service",
                            (ip, count, occurred, occurred, service))
            ban = self.ban(ip)
            if count >= policy["maxFailures"] and ban is None:
                if self.db.execute("SELECT COUNT(*) FROM bans").fetchone()[0] >= MAX_BANS:
                    raise GuardError("封禁容量已满，无法新增防火墙规则。", 503)
                self.db.execute("INSERT INTO bans(ip,created,expires,reason,service) VALUES(?,?,?,?,?)",
                                (ip, now, now + policy["banSeconds"], "authentication-failures", service))
                self._audit("ban-requested", ip, str(count))
                ban = self.ban(ip)
            return {"accepted": True, "banned": ban is not None, "count": count, "ban": ban}

    def ban(self, ip):
        with self.lock:
            # 到期台账保留至内核移除回读成功，不能把仍在拦截的 IP 显示为已解封。
            row = self.db.execute("SELECT * FROM bans WHERE ip=?", (canonical_ip(ip),)).fetchone()
            return self._ban_public(row) if row else None

    def _ban_public(self, row):
        count = self.db.execute("SELECT count FROM counters WHERE ip=?", (row["ip"],)).fetchone()
        return {"ip": row["ip"], "createdAt": row["created"], "expiresAt": row["expires"],
                "bannedAt": row["created"], "failedAttempts": count[0] if count else 0,
                "reason": row["reason"], "service": row["service"], "applied": bool(row["applied"]),
                "error": row["error"], "pendingRemoval": row["expires"] <= self.clock()}

    def bans(self):
        with self.lock:
            return [self._ban_public(row) for row in self.db.execute("SELECT * FROM bans ORDER BY created DESC")]

    def _unban(self, ip, reason):
        self.db.execute("DELETE FROM bans WHERE ip=?", (ip,))
        self.db.execute("DELETE FROM counters WHERE ip=?", (ip,))
        self.db.execute("UPDATE events SET counted=0 WHERE ip=?", (ip,))
        self.db.execute("INSERT INTO resets VALUES(?,?) ON CONFLICT(ip) DO UPDATE SET before=excluded.before", (ip, self.clock()))
        self._audit("unban-" + reason, ip)

    def unban(self, ip):
        ip = canonical_ip(ip)
        with self.lock, self.db:
            self._unban(ip, "manual")

    def receipt(self, ip, local_ips=()):
        ip = canonical_ip(ip)
        with self.lock:
            policy = self.policy()
            row = self.db.execute("SELECT count,last FROM counters WHERE ip=?", (ip,)).fetchone()
            reset = self.db.execute("SELECT before FROM resets WHERE ip=?", (ip,)).fetchone()
            ignored = not policy["enabled"] or self.allowed(ip, policy, local_ips)
            count = row["count"] if row and not ignored else 0
            times = []
            if count and policy["windowSeconds"]:
                times = [item[0] for item in self.db.execute("SELECT occurred FROM events WHERE ip=? AND counted=1 AND occurred>=? ORDER BY occurred LIMIT 100",
                                                            (ip, self.clock()-policy["windowSeconds"]))]
                count = len(times)
            return {"failedAttempts": count, "lastFailure": row["last"] if row and not ignored else None,
                    "resetEpoch": reset[0] if reset else None,
                    "recentFailureTimes": times, "ban": None if ignored else self.ban(ip)}

    def expire(self, verified_ips):
        """仅在整个期望规则集合已回读后确认自动解封。"""
        with self.lock, self.db:
            for row in self.db.execute("SELECT ip FROM bans WHERE expires<=?", (self.clock(),)).fetchall():
                if row[0] not in verified_ips:
                    self._unban(row[0], "expired")

    def mark_applied(self, ips, error=""):
        ips = set(ips)
        with self.lock, self.db:
            self.db.execute("UPDATE bans SET applied=0,error=?", (error[:300],))
            self.db.executemany("UPDATE bans SET applied=1,error='' WHERE ip=?", [(ip,) for ip in ips])

    def prune(self):
        with self.lock, self.db:
            # 保留超过最大滑动窗口的去重历史；cursor 保证旧来源不会重新遍历。
            self.db.execute("DELETE FROM events WHERE seen<?", (self.clock()-172800,))
            self.db.execute("DELETE FROM audit WHERE id NOT IN (SELECT id FROM audit ORDER BY id DESC LIMIT 10000)")
            self.db.execute("DELETE FROM resets WHERE before<?", (self.clock()-172800,))
        with self.lock:
            self.db.execute("PRAGMA wal_checkpoint(PASSIVE)")

    def summary(self):
        with self.lock:
            return {"trackedIps": self.db.execute("SELECT COUNT(*) FROM counters").fetchone()[0],
                    "recentEvents": self.db.execute("SELECT COUNT(*) FROM events").fetchone()[0],
                    "recentAudit": [dict(row) for row in self.db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT 100")],
                    "counters": [dict(row) for row in self.db.execute("SELECT * FROM counters ORDER BY last DESC LIMIT 200")]}
