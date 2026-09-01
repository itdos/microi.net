import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatPlatformSysConfigFailure } from "../src/utils/platform-bootstrap-diagnostics.js";

test("legacy database backoff becomes an actionable Chinese message", () => {
    const message = formatPlatformSysConfigFailure({
        Code: 0,
        Msg: "Database connection is temporarily unavailable. Retry after 85 seconds.[GetTableData]"
    });

    assert.match(message, /数据库连接失败/);
    assert.match(message, /85 秒/);
    assert.match(message, /主租户/);
    assert.match(message, /数据库连接/);
    assert.match(message, /只读数据库连接/);
    assert.match(message, /Data Source\/Server/);
    assert.doesNotMatch(message, /temporarily unavailable/i);
});

test("structured invalid-host failure explains container-visible addresses and redacts raw details", () => {
    const message = formatPlatformSysConfigFailure({
        Code: 0,
        Msg: "Password=top-secret; Server=wrong-host",
        DataAppend: {
            ErrorType: "TenantDatabaseConnection",
            ErrorCode: "DatabaseHostInvalid",
            RetryAfterSeconds: 47
        }
    });

    assert.match(message, /数据库服务器地址无效/);
    assert.match(message, /后端容器解析和访问/);
    assert.match(message, /Docker 网络/);
    assert.match(message, /47 秒/);
    assert.doesNotMatch(message, /top-secret|wrong-host/);
});

test("startup loading screen presents database failures as tenant configuration failures", async () => {
    const source = await readFile(
        new URL("../public/static/js/microi.loading.js", import.meta.url),
        "utf8"
    );

    assert.match(source, /租户数据库连接失败/);
    assert.match(source, /系统无法读取当前租户配置/);
    assert.match(source, /修复租户数据库配置后点击/);
});
