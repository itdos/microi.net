"""Offline SQL structure check; never connects to a server or opens a disk DB.

SQLite parses and executes the shared CREATE TABLE/INDEX grammar in :memory:.
Only MySQL column COMMENT and terminal ENGINE/CHARSET options are removed.
This proves separators, column declarations and index references, not MySQL
engine/storage/collation behavior or an actual application-package installation.
"""
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parent
OWNED = {"mci_file_resource", "mci_file_traffic_window", "mci_file_replica"}


def structural_sql(sql):
    sql = re.sub(r"\s+COMMENT\s+'(?:[^']|'')*'", "", sql, flags=re.I)
    return re.sub(r"\)\s+ENGINE=InnoDB\s+DEFAULT\s+CHARSET=utf8mb4\s*;?\s*$", ");", sql, flags=re.I)


def check(package_name, tables):
    package = json.loads((ROOT / package_name).read_text(encoding="utf-8"))
    db = sqlite3.connect(":memory:")
    checked = []
    try:
        rows = [row for row in package["DDLStatements"] if row["TableName"].lower() in tables]
        for row in rows:
            db.execute(structural_sql(row["DDL"]))
        for table in tables:
            created = next(row["DDL"] for row in rows if row["TableName"].lower() == table and row["DDL"].upper().startswith("CREATE TABLE"))
            declared = re.findall(r"^\s+`([^`]+)`\s+", created, re.M)
            actual = [row[1] for row in db.execute('PRAGMA table_info("' + table + '")')]
            assert declared == actual, (table, "column declarations differ from SQL parse")
            assert len(declared) == len(set(name.lower() for name in declared)), (table, "duplicate columns")
            if table == "sys_config":
                assert {"FileServerBak", "FileServerBakThresholdGiB", "FileServerBakWindowHours"}.issubset(set(actual))
                # Demonstrate that the actual parser rejects the two historical
                # malformed comma variants; this is not a text-presence check.
                malformed = [
                    created.replace("`DisableTaskScheduling` int NULL COMMENT '停用任务调度',", "`DisableTaskScheduling` int NULL COMMENT '停用任务调度'"),
                    created.replace("`CompatiblePlatformOldVersion` int NULL COMMENT '兼容平台旧版本',", "`CompatiblePlatformOldVersion` int NULL COMMENT '兼容平台旧版本',,"),
                ]
                for text in malformed:
                    assert text != created
                    with sqlite3.connect(":memory:") as negative:
                        try:
                            negative.execute(structural_sql(text))
                        except sqlite3.Error:
                            pass
                        else:
                            raise AssertionError("malformed delimiter unexpectedly parsed")
            checked.append({"Table": table, "Columns": len(actual)})
        return {"Package": package_name, "Statements": len(rows), "Tables": checked, "Result": "Passed"}
    finally:
        db.close()


if __name__ == "__main__":
    for name, tables in [
        ("app.microi.sys-log.json", OWNED),
        ("app.microi.sys-config.json", {"sys_config"}),
        ("app.microi.saas-engine.json", {"sys_config"}),
    ]:
        print(json.dumps(check(name, tables), ensure_ascii=False))
