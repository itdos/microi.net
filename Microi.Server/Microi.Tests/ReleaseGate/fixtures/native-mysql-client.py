"""Test-only MySQL transport. Private configuration stays on disk; SQL uses stdin."""
import ctypes
import json
import os
import pathlib
import re
import stat
import sys
import uuid

MARKER = "_mci_gate_fixture_owner"


class GuardError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def require(value, code):
    if not value:
        raise GuardError(code)


def validate_config(config):
    require(isinstance(config, dict) and set(config) == {"taskId", "owner", "connection", "database"}, "INVALID_CONFIG")
    task, owner, database = config["taskId"], config["owner"], config["database"]
    require(isinstance(task, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{15,79}", task), "INVALID_TASK")
    require(isinstance(owner, str) and owner.startswith("microservice-gate-contract-"), "INVALID_OWNER")
    try:
        nonce = uuid.UUID(owner.removeprefix("microservice-gate-contract-"))
    except (ValueError, AttributeError):
        raise GuardError("INVALID_OWNER") from None
    require(owner == "microservice-gate-contract-" + str(nonce) and nonce.version == 4
            and nonce.variant == uuid.RFC_4122, "INVALID_OWNER")
    require(isinstance(database, str) and re.fullmatch(r"mci_gate_[a-f0-9]{32}", database)
            and database == "mci_gate_" + nonce.hex, "INVALID_DATABASE")
    connection = config["connection"]
    require(isinstance(connection, dict) and set(connection) == {"host", "port", "user", "password"}, "INVALID_CONNECTION")
    require(connection["host"] == "127.0.0.1", "NON_LOOPBACK_REJECTED")
    require(type(connection["port"]) is int and 1024 <= connection["port"] <= 65535, "INVALID_PORT")
    require(isinstance(connection["user"], str) and 0 < len(connection["user"]) <= 128, "INVALID_CONNECTION")
    require(isinstance(connection["password"], str) and 0 < len(connection["password"]) <= 4096, "INVALID_CONNECTION")
    return config


def verify_private_acl(path):
    if os.name != "nt":
        metadata = path.stat()
        require(metadata.st_uid == os.getuid() and metadata.st_mode & 0o077 == 0, "PRIVATE_CONFIG_ACL")
        return
    from ctypes import wintypes
    security, kernel = ctypes.WinDLL("advapi32", use_last_error=True), ctypes.WinDLL("kernel32", use_last_error=True)
    security.GetNamedSecurityInfoW.argtypes = [wintypes.LPWSTR, wintypes.DWORD, wintypes.DWORD,
        ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)]
    security.GetNamedSecurityInfoW.restype = wintypes.DWORD
    security.GetSecurityDescriptorControl.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.WORD), ctypes.POINTER(wintypes.DWORD)]
    security.GetAce.argtypes = [ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p)]
    security.ConvertSidToStringSidW.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.LPWSTR)]
    security.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    security.GetTokenInformation.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]

    def sid_text(pointer):
        text = wintypes.LPWSTR()
        require(security.ConvertSidToStringSidW(pointer, ctypes.byref(text)), "PRIVATE_CONFIG_ACL")
        try:
            return text.value
        finally:
            kernel.LocalFree(ctypes.cast(text, ctypes.c_void_p))

    token, size = wintypes.HANDLE(), wintypes.DWORD()
    require(security.OpenProcessToken(kernel.GetCurrentProcess(), 8, ctypes.byref(token)), "PRIVATE_CONFIG_ACL")
    try:
        security.GetTokenInformation(token, 1, None, 0, ctypes.byref(size))
        buffer = ctypes.create_string_buffer(size.value)
        require(security.GetTokenInformation(token, 1, buffer, size, ctypes.byref(size)), "PRIVATE_CONFIG_ACL")
        current_sid = sid_text(ctypes.c_void_p.from_buffer(buffer).value)
    finally:
        kernel.CloseHandle(token)
    dacl, descriptor = ctypes.c_void_p(), ctypes.c_void_p()
    require(security.GetNamedSecurityInfoW(str(path), 1, 4, None, None, ctypes.byref(dacl), None, ctypes.byref(descriptor)) == 0, "PRIVATE_CONFIG_ACL")
    try:
        control, revision = wintypes.WORD(), wintypes.DWORD()
        require(dacl.value and security.GetSecurityDescriptorControl(descriptor, ctypes.byref(control), ctypes.byref(revision)), "PRIVATE_CONFIG_ACL")
        # ACL header: revision, reserved, size, AceCount, reserved.
        count = ctypes.c_ushort.from_address(dacl.value + 4).value
        principals = set()
        for index in range(count):
            ace = ctypes.c_void_p()
            require(security.GetAce(dacl, index, ctypes.byref(ace)), "PRIVATE_CONFIG_ACL")
            # Inheritance is safe when the effective DACL still grants only these principals.
            require(ctypes.c_ubyte.from_address(ace.value).value == 0, "PRIVATE_CONFIG_ACL")
            principals.add(sid_text(ace.value + 8))
        require(principals == {current_sid, "S-1-5-18"}, "PRIVATE_CONFIG_ACL")
    finally:
        kernel.LocalFree(descriptor)


def load_config(value):
    path = pathlib.Path(value)
    require(path.is_absolute() and path.is_file() and not path.is_symlink(), "INVALID_CONFIG_PATH")
    require(os.path.normcase(os.path.abspath(path)) == os.path.normcase(os.path.realpath(path)), "INVALID_CONFIG_PATH")
    require(stat.S_ISREG(path.stat().st_mode) and path.stat().st_size <= 16384, "INVALID_CONFIG_PATH")
    verify_private_acl(path)
    return validate_config(json.loads(path.read_text(encoding="utf-8-sig")))


def sql_code(text):
    require(isinstance(text, str) and 0 < len(text) <= 1024 * 1024, "INVALID_SQL")
    # Keep identifiers but erase literals/comments before checking database controls.
    require("/*!" not in text, "UNSAFE_SQL")
    pattern = r"'(?:\\.|''|[^'\\])*'|\"(?:\\.|\"\"|[^\"\\])*\"|/\*[\s\S]*?\*/|--(?=\s)[^\r\n]*|#[^\r\n]*"
    return re.sub(pattern, " ", text).replace("`", "")


def validate_sql(text, database):
    code = sql_code(text)
    require(not re.search(r"\b(?:CREATE|DROP|ALTER)\s+(?:DATABASE|SCHEMA)\b|(?:^|;)\s*(?:USE|GRANT|REVOKE|FLUSH|RESET|SHUTDOWN|KILL|CALL|INSTALL|UNINSTALL|SET|LOCK|UNLOCK)\b|\bLOAD\s+DATA\b|\bINTO\s+(?:OUTFILE|DUMPFILE)\b|\bRENAME\s+TABLE\b", code, re.I), "UNSAFE_SQL")
    require(not re.search(r"\b" + MARKER + r"\b", code, re.I), "OWNER_TABLE_PROTECTED")
    for match in re.finditer(r"\b(?:FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES|USING)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\.", code, re.I):
        require(match.group(1).lower() in {database, "information_schema"}, "CROSS_DATABASE_REJECTED")
    for match in re.finditer(r"\b(?:INDEX|KEY)\s+[A-Za-z_][A-Za-z0-9_]*\s+ON\s+([A-Za-z_][A-Za-z0-9_]*)\s*\.", code, re.I):
        require(match.group(1).lower() == database, "CROSS_DATABASE_REJECTED")
    require(not re.search(r"\b(?:mysql|sys|performance_schema)\s*\.", code, re.I), "CROSS_DATABASE_REJECTED")


def verify_owner(cursor, config):
    cursor.execute("SELECT TaskId,Owner FROM `" + config["database"] + "`.`" + MARKER + "` WHERE Id=1")
    rows = cursor.fetchall()
    require(len(rows) == 1 and tuple(rows[0]) == (config["taskId"], config["owner"]), "OWNER_MISMATCH")


def handle(config, request, connector):
    validate_config(config)
    require(isinstance(request, dict) and request.get("op") in {"init", "query", "cleanup"}, "INVALID_REQUEST")
    require(set(request) == ({"op", "sql"} if request["op"] == "query" else {"op"}), "INVALID_REQUEST")
    database = config["database"]
    if request["op"] == "query":
        validate_sql(request["sql"], database)
    with connector(config["connection"]) as connection:
        with connection.cursor() as cursor:
            if request["op"] == "init":
                cursor.execute("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=%s", (database,))
                require(not cursor.fetchall(), "DATABASE_ALREADY_EXISTS")
                # No IF NOT EXISTS: a racing/pre-existing database must fail closed.
                cursor.execute("CREATE DATABASE `" + database + "` CHARACTER SET utf8mb4")
                cursor.execute("CREATE TABLE `" + database + "`.`" + MARKER + "` (Id int PRIMARY KEY,TaskId varchar(80) NOT NULL,Owner varchar(100) NOT NULL)")
                cursor.execute("INSERT INTO `" + database + "`.`" + MARKER + "` (Id,TaskId,Owner) VALUES (1,%s,%s)", (config["taskId"], config["owner"]))
                verify_owner(cursor, config)
                return []
            verify_owner(cursor, config)
            if request["op"] == "cleanup":
                cursor.execute("DROP DATABASE `" + database + "`")
                return []
            connection.select_db(database)
            cursor.execute(request["sql"])
            rows = []
            while True:
                if cursor.description:
                    names = [column[0] for column in cursor.description]
                    rows.extend({name: None if value is None else (value.decode("utf-8") if isinstance(value, bytes) else str(value))
                                 for name, value in zip(names, row)} for row in cursor.fetchall())
                if not cursor.nextset():
                    break
            return rows


def safe_error(error):
    if isinstance(error, GuardError):
        return error.code
    if error.args and error.args[0] == 1062:
        return "MYSQL_DUPLICATE_ENTRY"
    return "MYSQL_NATIVE_FAILED"


def main():
    try:
        require(len(sys.argv) == 3 and sys.argv[1] == "--config", "INVALID_ARGUMENTS")
        config = load_config(sys.argv[2])
        request = json.loads(sys.stdin.read(1024 * 1024 + 1))
        import pymysql
        from pymysql.constants import CLIENT

        def connect(settings):
            return pymysql.connect(**settings, charset="utf8mb4", autocommit=True,
                connect_timeout=5, read_timeout=15, write_timeout=15, client_flag=CLIENT.MULTI_STATEMENTS)

        rows = handle(config, request, connect)
        print(json.dumps({"ok": True, "database": config["database"], "rows": rows}, ensure_ascii=False))
        return 0
    except Exception as error:
        # Never echo a driver exception, SQL, configuration, password or traceback.
        print(json.dumps({"ok": False, "errorCode": safe_error(error)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
