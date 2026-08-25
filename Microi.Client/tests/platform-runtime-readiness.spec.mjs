import assert from "node:assert/strict";
import test from "node:test";

import {
    PLATFORM_SYS_MENU_BOOTSTRAP_RETRY_DELAYS_MS,
    createPlatformSysMenuBootstrapError,
    isPlatformSysMenuBootstrapPending
} from "../src/utils/platform-runtime-readiness.js";

test("menu bootstrap retries only the missing managed startup dependency", () => {
    assert.equal(isPlatformSysMenuBootstrapPending({
        Code: 0,
        Msg: "NoExistData表名：sys_apiengine条件：ApiAddress='/apiengine/platform-sys-menu'"
    }), true);
    assert.equal(isPlatformSysMenuBootstrapPending({
        response: {
            status: 404,
            data: { message: "platform-sys-menu not found in sys_apiengine" }
        }
    }), true);
    assert.equal(isPlatformSysMenuBootstrapPending({
        Code: 1001,
        Msg: "platform-sys-menu in sys_apiengine"
    }), false);
    assert.equal(isPlatformSysMenuBootstrapPending(new Error("network error")), false);
});

test("menu bootstrap retry is bounded and ends with an actionable error", () => {
    assert.equal(PLATFORM_SYS_MENU_BOOTSTRAP_RETRY_DELAYS_MS.length, 12);
    assert.ok(PLATFORM_SYS_MENU_BOOTSTRAP_RETRY_DELAYS_MS.every(delay => delay > 0 && delay <= 5000));
    assert.ok(
        PLATFORM_SYS_MENU_BOOTSTRAP_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0) < 60_000
    );

    const error = createPlatformSysMenuBootstrapError({ Code: 0 });
    assert.equal(error.reasonCode, "PLATFORM_SYS_MENU_NOT_READY");
    assert.match(error.message, /v7\.5\.49/);
});
