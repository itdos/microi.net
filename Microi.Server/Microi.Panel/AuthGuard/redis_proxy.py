"""Redis RESP authentication observer for the independently privileged host guard.

The upstream must be a guard-verified, unpublished managed Redis endpoint. This
module deliberately does not accept PROXY headers, terminate TLS, or log commands.
State and ban expiry belong to the guard's durable ledger, not to this process.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import contextlib
import ipaddress
import threading
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Awaitable, Callable


class ProtocolError(Exception):
    """Only static, non-secret reason codes are ever raised by the parser."""


class BannedConnection(Exception):
    pass


@dataclass(frozen=True)
class ProxyLimits:
    max_connections: int = 256
    max_pending: int = 1024
    max_arguments: int = 65536
    max_header: int = 16384
    max_bulk: int = 512 * 1024 * 1024
    max_frame: int = 1024 * 1024 * 1024
    max_elements: int = 1_000_000
    max_depth: int = 64
    chunk_size: int = 65536
    idle_seconds: float = 300
    connect_seconds: float = 5
    callback_seconds: float = 10


def normalize_ip(value: str) -> str:
    address = ipaddress.ip_address(value.split("%", 1)[0])
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    return str(address)


@dataclass
class _Frame:
    kind: bytes
    value: bytes = b""
    count: int | None = None
    items: tuple["_Frame", ...] = ()

    @property
    def authentication_error(self) -> bool:
        if self.kind not in (b"-", b"!"):
            return False
        value = self.value.upper()
        return value == b"WRONGPASS" or value.startswith(b"WRONGPASS ") or value in (
            b"ERR INVALID PASSWORD", b"ERR INVALID USERNAME-PASSWORD PAIR"
        )


@dataclass
class _Command:
    ready: asyncio.Event = field(default_factory=asyncio.Event)
    completed: asyncio.Event = field(default_factory=asyncio.Event)
    name: bytes = b""
    authentication: bool = False
    argument_count: int = 0
    remaining: int | None = None


class _Wire:
    def __init__(self, reader, writer, limits):
        self.reader, self.writer, self.limits = reader, writer, limits
        self.frame_bytes = 0
        self.elements = 0
        self.held: bytearray | None = None

    async def read(self, length):
        data = await asyncio.wait_for(self.reader.readexactly(length), self.limits.idle_seconds)
        self.frame_bytes += len(data)
        if self.frame_bytes > self.limits.max_frame:
            raise ProtocolError("frame_limit")
        return data

    async def line(self, first=b""):
        try:
            rest = await asyncio.wait_for(self.reader.readuntil(b"\r\n"), self.limits.idle_seconds)
        except (asyncio.LimitOverrunError, ValueError):
            raise ProtocolError("header_limit") from None
        self.frame_bytes += len(rest)
        if len(first) + len(rest) > self.limits.max_header or self.frame_bytes > self.limits.max_frame:
            raise ProtocolError("header_limit")
        return first + rest

    async def send(self, data):
        if self.held is not None:
            # 仅暂存决定是否允许 CLIENT REPLY 所需的短前缀；不缓冲业务大值。
            if len(self.held) + len(data) > self.limits.max_header:
                raise ProtocolError("command_prefix_limit")
            self.held.extend(data)
            return
        self.writer.write(data)
        await asyncio.wait_for(self.writer.drain(), self.limits.idle_seconds)

    async def release(self):
        held, self.held = self.held, None
        if held:
            await self.send(held)

    async def body(self, length, capture=0):
        if length < 0 or length > self.limits.max_bulk:
            raise ProtocolError("bulk_limit")
        prefix = bytearray()
        while length:
            chunk = await self.read(min(length, self.limits.chunk_size))
            if len(prefix) < capture:
                prefix.extend(chunk[:capture - len(prefix)])
            await self.send(chunk)
            length -= len(chunk)
        trailer = await self.read(2)
        if trailer != b"\r\n":
            raise ProtocolError("bulk_terminator")
        await self.send(trailer)
        return bytes(prefix)


def _number(value: bytes, maximum: int, allow_null=False) -> int:
    if allow_null and value == b"-1":
        return -1
    if not value or len(value) > 20 or any(c < 48 or c > 57 for c in value):
        raise ProtocolError("invalid_length")
    result = int(value)
    if result > maximum:
        raise ProtocolError("length_limit")
    return result


async def _response(wire: _Wire, first=None, depth=0, on_error=None, path=()) -> _Frame:
    if depth > wire.limits.max_depth:
        raise ProtocolError("nesting_limit")
    wire.elements += 1
    if wire.elements > wire.limits.max_elements:
        raise ProtocolError("element_limit")
    kind = first if first is not None else await wire.read(1)
    if kind in (b"+", b"-", b":", b",", b"(", b"#", b"_"):
        line = await wire.line(kind)
        frame = _Frame(kind, line[1:-2][:160])
        if kind == b"-" and on_error:
            # 必须先持久化再向客户端写错误，客户端提前 RST 不能抹掉已发生的认证失败。
            await on_error(path, frame)
        await wire.send(line)
        return frame
    if kind in (b"$", b"!", b"="):
        line = await wire.line(kind)
        value = line[1:-2]
        if kind == b"!":
            count = _number(value, wire.limits.max_header)
            payload = await wire.read(count + 2)
            if payload[-2:] != b"\r\n":
                raise ProtocolError("bulk_terminator")
            frame = _Frame(kind, payload[:-2][:160], count)
            if on_error:
                await on_error(path, frame)
            await wire.send(line + payload)
            return frame
        await wire.send(line)
        if value == b"?" and kind == b"$":
            prefix, total = bytearray(), 0
            while True:
                chunk_line = await wire.line()
                if not chunk_line.startswith(b";"):
                    raise ProtocolError("streamed_bulk_chunk")
                count = _number(chunk_line[1:-2], wire.limits.max_bulk)
                total += count
                if total > wire.limits.max_bulk:
                    raise ProtocolError("bulk_limit")
                await wire.send(chunk_line)
                if count == 0:
                    break
                part = await wire.body(count, max(0, 160 - len(prefix)))
                prefix.extend(part)
            return _Frame(kind, bytes(prefix))
        count = _number(value, wire.limits.max_bulk, allow_null=kind == b"$")
        return _Frame(kind, await wire.body(count, 160) if count >= 0 else b"", count)
    if kind not in (b"*", b"%", b"~", b">", b"|"):
        raise ProtocolError("unsupported_response")
    line = await wire.line(kind)
    value = line[1:-2]
    streamed = value == b"?"
    count = None if streamed else _number(value, wire.limits.max_elements, allow_null=kind == b"*")
    await wire.send(line)
    items = []
    index = 0
    length = None if count is None else count * (2 if kind in (b"%", b"|") else 1)
    while length is None or index < length:
        child_first = await wire.read(1)
        if streamed and child_first == b".":
            terminator = await wire.read(2)
            if terminator != b"\r\n" or (kind in (b"%", b"|") and index % 2):
                raise ProtocolError("aggregate_terminator")
            await wire.send(b".\r\n")
            break
        child = await _response(wire, child_first, depth + 1, on_error, path + (index,))
        # 只保留识别 Pub/Sub 所需的三个字段，EXEC 认证结果逐项处理，不留业务响应。
        if depth <= 1 and index < 3:
            items.append(child)
        index += 1
    return _Frame(kind, count=count, items=tuple(items))


def _inline_tokens(line: bytes) -> list[bytes]:
    """Redis sdssplitargs-compatible quotes for bounded legacy inline requests."""
    result, token, index = [], bytearray(), 0
    while index < len(line):
        while index < len(line) and line[index] in b" \t\r\n\v\f":
            index += 1
        if index == len(line):
            break
        token.clear()
        quote = None
        while index < len(line):
            value = line[index]
            if quote is None and value in b" \t\r\n\v\f":
                break
            if value in (34, 39) and quote is None:
                quote = value
            elif quote is not None and value == quote:
                quote = None
                if index + 1 < len(line) and line[index + 1] not in b" \t\r\n\v\f":
                    raise ProtocolError("inline_quote")
                index += 1
                break
            elif value == 92 and quote == 34 and index + 1 < len(line):
                index += 1
                escaped = line[index]
                if escaped == 120 and index + 2 < len(line):
                    try:
                        token.append(int(line[index + 1:index + 3], 16))
                    except ValueError:
                        token.append(escaped)
                    else:
                        index += 2
                else:
                    token.extend({110:b"\n", 114:b"\r", 116:b"\t", 98:b"\b", 97:b"\a"}.get(escaped, bytes([escaped])))
            elif value == 92 and quote == 39 and index + 1 < len(line) and line[index + 1] == 39:
                index += 1
                token.append(39)
            else:
                token.append(value)
            index += 1
        if quote is not None:
            raise ProtocolError("inline_quote")
        result.append(bytes(token))
    return result


def _forbidden(name, arguments):
    # 禁止会隐藏认证结果或切换到非 RESP 字节流的命令，不能悄悄放过防护盲区。
    return name in (b"MONITOR", b"SYNC", b"PSYNC", b"PROXY") or (
        name == b"CLIENT" and len(arguments) >= 2
        and arguments[0] == b"REPLY" and arguments[1] in (b"OFF", b"SKIP")
    )


def _option(value, original_length=None):
    # Redis HELLO/CLIENT 在 C 层以 strcasecmp 识别选项，NUL 后缀不能绕过 AUTH/REPLY 识别。
    if b"\x00" in value:
        return value.split(b"\x00", 1)[0].upper()
    return value.upper() if original_length is None or original_length <= len(value) else b""


async def _request(wire: _Wire, command: _Command):
    wire.frame_bytes = 0
    wire.held = bytearray()
    first = await wire.read(1)
    if first != b"*":
        # TLS/PROXY headers and malformed binary inputs fail closed, never become an IP identity.
        if (first[0] < 32 and first not in b" \t\v\f") or first in b"$+-:!%~>|_#=(,":
            raise ProtocolError("unsupported_request")
        line = await wire.line(first)
        parts = _inline_tokens(line[:-2])
        if not parts or len(parts) > wire.limits.max_arguments:
            raise ProtocolError("command_arguments")
        command.name, command.argument_count = parts[0].upper(), len(parts)
        upper = [_option(part) for part in parts[1:]]
        if _forbidden(command.name, upper):
            raise ProtocolError("command_hides_authentication")
        command.authentication = command.name == b"AUTH" and len(parts) in (2, 3)
        if command.name == b"HELLO":
            index = 2
            while index < len(parts):
                value = _option(parts[index])
                if value == b"AUTH" and index + 2 < len(parts):
                    command.authentication = True
                    index += 3
                elif value == b"SETNAME" and index + 1 < len(parts):
                    index += 2
                else:
                    break
        command.ready.set()
        wire.held = None
        await wire.send(line)
        return
    header = await wire.line(first)
    count = _number(header[1:-2], wire.limits.max_arguments)
    if count == 0:
        raise ProtocolError("empty_command")
    command.argument_count = count
    await wire.send(header)
    client_args, hello_skip = [], 0
    for index in range(count):
        header = await wire.line()
        if not header.startswith(b"$"):
            raise ProtocolError("command_argument_type")
        length = _number(header[1:-2], wire.limits.max_bulk)
        await wire.send(header)
        capture = index == 0 or (command.name == b"CLIENT" and index <= 2) or (
            command.name == b"HELLO" and index >= 2 and hello_skip == 0)
        value = await wire.body(length, 64 if capture else 0)
        value = _option(value, length)
        if index == 0:
            command.name = value
            if _forbidden(command.name, []):
                raise ProtocolError("command_hides_authentication")
            command.authentication = value == b"AUTH" and count in (2, 3)
            if value != b"CLIENT":
                await wire.release()
        elif command.name == b"CLIENT" and index <= 2:
            client_args.append(value)
            if _forbidden(command.name, client_args):
                raise ProtocolError("command_hides_authentication")
            if index == 2 or index == count - 1:
                await wire.release()
        elif command.name == b"HELLO" and index >= 2:
            if hello_skip:
                hello_skip -= 1
            elif value == b"AUTH" and index + 2 < count:
                command.authentication, hello_skip = True, 2
            elif value == b"SETNAME" and index + 1 < count:
                hello_skip = 1
            else:
                # 未知选项将由 Redis 返回语法错误；后面的字符串不是 AUTH 选项。
                hello_skip = count
    await wire.release()
    command.ready.set()


_SUBSCRIPTIONS = {b"SUBSCRIBE": "channel", b"UNSUBSCRIBE": "channel", b"PSUBSCRIBE": "pattern",
                  b"PUNSUBSCRIBE": "pattern", b"SSUBSCRIBE": "shard", b"SUNSUBSCRIBE": "shard"}
_MESSAGES = {b"message", b"pmessage", b"smessage"}


class RedisProxy:
    """Bounded plain-RESP proxy. The three callbacks are asynchronous and trusted."""

    def __init__(self, target_resolver: Callable[[], Awaitable[tuple[str, int]]],
                 on_failure: Callable[[str, str], Awaitable[object]],
                 is_banned: Callable[[str], Awaitable[bool]], *, host="127.0.0.1", port=0,
                 limits: ProxyLimits | None = None):
        self.target_resolver, self.on_failure, self.is_banned = target_resolver, on_failure, is_banned
        self.host, self.port, self.limits = host, port, limits or ProxyLimits()
        self.server = None
        self.connections: dict[asyncio.Task, str] = {}
        self.watchdog = None
        self.last_error = ""
        self.accepted_connections = 0
        self.authentication_failures = 0

    async def start(self):
        self.server = await asyncio.start_server(self._accept, self.host, self.port, limit=self.limits.max_header)
        self.port = self.server.sockets[0].getsockname()[1]
        self.watchdog = asyncio.create_task(self._reap_banned())
        return self

    async def _callback(self, call):
        return await asyncio.wait_for(call, self.limits.callback_seconds)

    async def _reap_banned(self):
        # 一个服务触发共享封禁后，已连接会话也退出；不能只拦新连接。
        while True:
            await asyncio.sleep(1)
            try:
                for ip in set(self.connections.values()):
                    if await self._callback(self.is_banned(ip)):
                        for task, peer in list(self.connections.items()):
                            if peer == ip:
                                task.cancel()
            except asyncio.CancelledError:
                raise
            except Exception:
                self.last_error = "guard_callback_failed"
                for task in list(self.connections):
                    task.cancel()

    async def _accept(self, reader, writer):
        task = asyncio.current_task()
        backend = None
        children = []
        try:
            if len(self.connections) >= self.limits.max_connections:
                return
            peer = writer.get_extra_info("peername")
            if not peer:
                return
            ip = normalize_ip(peer[0])
            self.connections[task] = ip
            if await self._callback(self.is_banned(ip)):
                return
            host, port = await self._callback(self.target_resolver())
            upstream_reader, backend = await asyncio.wait_for(
                asyncio.open_connection(host, port, limit=self.limits.max_header), self.limits.connect_seconds)
            self.accepted_connections += 1
            pending: deque[_Command] = deque()
            pending_space = asyncio.Event()
            pending_space.set()
            session_id, failure_sequence = uuid.uuid4().hex, 0
            newly_banned = False
            transaction: list[_Command] | None = None
            resp3 = False
            subscription_counts = {"channel": 0, "pattern": 0, "shard": 0}

            async def failed():
                nonlocal failure_sequence, newly_banned
                failure_sequence += 1
                self.authentication_failures += 1
                await self._callback(self.on_failure(ip, f"redis:{session_id}:{failure_sequence}"))
                if await self._callback(self.is_banned(ip)):
                    newly_banned = True

            async def requests():
                wire = _Wire(reader, backend, self.limits)
                while True:
                    while len(pending) >= self.limits.max_pending:
                        pending_space.clear()
                        await asyncio.wait_for(pending_space.wait(), self.limits.idle_seconds)
                    command = _Command()
                    # 在转发首字节前入队，快速上游也不能使响应抢在请求元数据前面。
                    pending.append(command)
                    await _request(wire, command)
                    if command.authentication:
                        # 密码猜测管道必须等待逐次结果，避免第三次判定前继续发送下一次 AUTH。
                        await asyncio.wait_for(command.completed.wait(), self.limits.idle_seconds)

            async def responses():
                nonlocal transaction, resp3
                wire = _Wire(upstream_reader, writer, self.limits)
                while True:
                    wire.frame_bytes, wire.elements = 0, 0
                    first = await wire.read(1)
                    command = pending[0] if pending else None

                    async def authentication_error(path, frame):
                        if not frame.authentication_error or command is None:
                            return
                        await asyncio.wait_for(command.ready.wait(), self.limits.idle_seconds)
                        if not path and command.authentication:
                            await failed()
                        elif len(path) == 1 and command.name == b"EXEC" and transaction and path[0] < len(transaction):
                            if transaction[path[0]].authentication:
                                await failed()

                    frame = await _response(wire, first, on_error=authentication_error)
                    if newly_banned:
                        raise BannedConnection()
                    if frame.kind == b"|":
                        continue
                    label = frame.items[0].value.lower() if frame.items else b""
                    ack_name = label.upper()
                    is_ack = (ack_name in _SUBSCRIPTIONS and len(frame.items) == 3
                              and frame.items[2].kind == b":" and (frame.kind == b">" or (
                                  frame.kind == b"*" and not resp3 and command and command.name == ack_name)))
                    if is_ack:
                        if command and command.name == ack_name:
                            await asyncio.wait_for(command.ready.wait(), self.limits.idle_seconds)
                        kind = _SUBSCRIPTIONS[ack_name]
                        if command and command.name == ack_name and command.remaining is None:
                            command.remaining = max(1, command.argument_count - 1) if command.argument_count > 1 else max(1, subscription_counts[kind])
                        if len(frame.items) == 3 and frame.items[2].kind == b":":
                            total = _number(frame.items[2].value, self.limits.max_elements)
                            previous = subscription_counts["shard"] if kind == "shard" else (
                                subscription_counts["channel"] + subscription_counts["pattern"])
                            subscription_counts[kind] = max(0, subscription_counts[kind] + total - previous)
                        if not command or command.name != ack_name:
                            continue
                        command.remaining -= 1
                        if command.remaining > 0:
                            continue
                    elif frame.kind == b">" or (frame.kind == b"*" and not resp3
                                               and sum(subscription_counts.values()) and label in _MESSAGES):
                        continue
                    if command is None:
                        raise ProtocolError("response_without_request")
                    await asyncio.wait_for(command.ready.wait(), self.limits.idle_seconds)
                    if frame.kind == b"+" and frame.value == b"QUEUED" and transaction is not None:
                        if len(transaction) >= self.limits.max_pending:
                            raise ProtocolError("transaction_limit")
                        transaction.append(command)
                    elif command.name == b"MULTI" and frame.kind == b"+" and frame.value == b"OK":
                        transaction = []
                    elif command.name in (b"EXEC", b"DISCARD", b"RESET"):
                        transaction = None
                        if command.name == b"RESET" and frame.kind == b"+":
                            resp3 = False
                            subscription_counts.update(channel=0, pattern=0, shard=0)
                    if command.name == b"HELLO" and frame.kind in (b"%", b"*"):
                        resp3 = frame.kind == b"%"
                    pending.popleft()
                    command.completed.set()
                    pending_space.set()

            children = [asyncio.create_task(requests()), asyncio.create_task(responses())]
            done, _ = await asyncio.wait(children, return_when=asyncio.FIRST_COMPLETED)
            for item in done:
                item.result()
        except (BannedConnection, asyncio.IncompleteReadError, ConnectionError, asyncio.CancelledError):
            pass
        except ProtocolError:
            # 错误码只在状态中出现；不回显攻击者协议字节、用户名或密码。
            self.last_error = "protocol_rejected"
        except TimeoutError:
            self.last_error = "connection_timeout"
        except Exception:
            self.last_error = "upstream_or_guard_unavailable"
        finally:
            for item in children:
                item.cancel()
            if children:
                await asyncio.gather(*children, return_exceptions=True)
            for output in (backend, writer):
                if output is not None:
                    output.close()
                    with contextlib.suppress(Exception, asyncio.CancelledError):
                        await asyncio.wait_for(output.wait_closed(), 2)
            self.connections.pop(task, None)

    async def close(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        if self.watchdog:
            self.watchdog.cancel()
            await asyncio.gather(self.watchdog, return_exceptions=True)
        active = list(self.connections)
        for task in active:
            task.cancel()
        if active:
            await asyncio.gather(*active, return_exceptions=True)


class RedisProxyManager:
    """Synchronous guard adapter; all socket work belongs to one bounded loop."""

    def __init__(self, on_auth_failure, is_banned, get_policy):
        self.on_auth_failure, self.is_banned, self.get_policy = on_auth_failure, is_banned, get_policy
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run, name="microi-redis-guard", daemon=True)
        self.proxies = {}
        self.entries = {}
        self.errors = {}
        self.closed = False
        self.thread.start()

    def _run(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()
        self.loop.run_until_complete(self.loop.shutdown_asyncgens())
        self.loop.run_until_complete(self.loop.shutdown_default_executor())
        self.loop.close()

    def _submit(self, coroutine):
        if self.closed:
            coroutine.close()
            raise RuntimeError("redis_proxy_manager_closed")
        future = asyncio.run_coroutine_threadsafe(coroutine, self.loop)
        try:
            return future.result(timeout=15)
        except concurrent.futures.TimeoutError:
            future.cancel()
            raise TimeoutError("redis_proxy_operation_timeout") from None

    async def _reconcile(self, entries):
        desired = {}
        for entry in entries:
            item = {key: entry[key] for key in ("id", "bindAddress", "listenPort", "backendHost", "backendPort")}
            item["bindAddress"] = str(ipaddress.ip_address(item["bindAddress"]))
            item["backendHost"] = str(ipaddress.ip_address(item["backendHost"]))
            if not isinstance(item["id"], str) or not item["id"] or item["id"] in desired:
                raise ValueError("invalid_redis_proxy_identity")
            if any(type(item[key]) is not int or not 1 <= item[key] <= 65535 for key in ("listenPort", "backendPort")):
                raise ValueError("invalid_redis_proxy_port")
            desired[item["id"]] = item
        for identity in list(self.entries):
            if desired.get(identity) != self.entries[identity]:
                proxy = self.proxies.pop(identity, None)
                if proxy:
                    await proxy.close()
                self.entries.pop(identity, None)
                self.errors.pop(identity, None)
        for identity, item in desired.items():
            if identity in self.proxies:
                continue
            self.entries[identity] = item

            async def target(config=item):
                return config["backendHost"], config["backendPort"]

            async def failure(ip, event_id):
                policy = await asyncio.to_thread(self.get_policy)
                if policy.get("enabled", True):
                    return await asyncio.to_thread(self.on_auth_failure, ip, event_id, "redis")

            async def banned(ip):
                policy = await asyncio.to_thread(self.get_policy)
                return bool(policy.get("enabled", True) and await asyncio.to_thread(self.is_banned, ip))

            proxy = RedisProxy(target, failure, banned, host=item["bindAddress"], port=item["listenPort"])
            try:
                await proxy.start()
                self.proxies[identity] = proxy
                self.errors.pop(identity, None)
            except Exception:
                await proxy.close()
                self.errors[identity] = "listen_failed"
        return self._status()

    def reconcile(self, entries):
        return self._submit(self._reconcile(entries))

    def _status(self):
        result = []
        for identity, entry in self.entries.items():
            proxy = self.proxies.get(identity)
            result.append({"id": identity, "listenPort": entry["listenPort"], "bindAddress": entry["bindAddress"],
                           "state": "listening" if proxy else "error", "error": self.errors.get(identity, ""),
                           "lastConnectionError": proxy.last_error if proxy else "",
                           "activeConnections": len(proxy.connections) if proxy else 0,
                           "authenticationFailures": proxy.authentication_failures if proxy else 0,
                           "protocol": "RESP2/RESP3", "tls": False})
        return result

    async def _async_status(self):
        return self._status()

    def status(self):
        return self._submit(self._async_status())

    async def _close(self):
        for proxy in list(self.proxies.values()):
            await proxy.close()
        self.proxies.clear()

    def close(self):
        if self.closed:
            return
        self._submit(self._close())
        self.closed = True
        self.loop.call_soon_threadsafe(self.loop.stop)
        self.thread.join(timeout=15)
        if self.thread.is_alive():
            raise TimeoutError("redis_proxy_shutdown_timeout")
