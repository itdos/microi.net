import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildAccessLoginUrl,
    isAccessRouteAllowed,
    normalizeAccessRoute
} from "../src/views/system/components/user-access-key-utils.js";
import {
    hasAuthorizationIdentityChanged,
    normalizeAuthorizationToken
} from "../src/utils/auth-transition.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

test("auto-login URL keeps tenant and does not copy unrelated query parameters", () => {
    const url = buildAccessLoginUrl({
        origin: "http://localhost:61500",
        pathname: "/index.html",
        osClient: "iTdos",
        loginPath: "/#/access-login?access_key=masked&redirect=%2Fmic%2Fdashboard"
    });

    assert.equal(
        url,
        "http://localhost:61500/?OsClient=iTdos#/access-login?access_key=masked&redirect=%2Fmic%2Fdashboard"
    );
});

test("full page URL is converted to a clean hash route", () => {
    assert.equal(
        normalizeAccessRoute("http://localhost:61500/?OsClient=iTdos#/mic/data-dashboard/preview/abc?ShowClassicTop=0"),
        "/mic/data-dashboard/preview/abc"
    );
});

test("wildcard supports canonical and legacy values", () => {
    assert.equal(normalizeAccessRoute("/*"), "*");
    assert.equal(isAccessRouteAllowed(["*"], "/mic/anything"), true);
    assert.equal(isAccessRouteAllowed(["/mic/a"], "/mic/b"), false);
});

test("auth transition treats anonymous-to-session and session replacement as stale requests", () => {
    assert.equal(normalizeAuthorizationToken("Bearer abc"), "abc");
    assert.equal(hasAuthorizationIdentityChanged("", "new-token"), true);
    assert.equal(hasAuthorizationIdentityChanged("old-token", "new-token"), true);
    assert.equal(hasAuthorizationIdentityChanged("same-token", "same-token"), false);
    assert.equal(hasAuthorizationIdentityChanged("", ""), false);
});

test("access-key exchange is isolated from stale bearer credentials", () => {
    const source = fs.readFileSync(
        path.resolve(testDir, "../src/views/login/access-login.vue"),
        "utf8"
    );

    assert.match(source, /BeginAuthTransition/);
    assert.match(source, /skipAuthorization:\s*true/);
    assert.match(source, /suppressAuthFailure:\s*true/);
    assert.match(source, /scrubAccessKeyFromAddressBar\(\)/);
});

test("system-account access key entry is driven by MoreBtns instead of table templates", () => {
    const tableSource = fs.readFileSync(
        path.resolve(testDir, "../src/views/form-engine/diy-table.vue"),
        "utf8"
    );
    const tableUtilsSource = fs.readFileSync(
        path.resolve(testDir, "../src/views/form-engine/mixins/table-utils.mixin.js"),
        "utf8"
    );

    assert.doesNotMatch(tableSource, /ShouldShowRowAccessKeyAction/);
    assert.doesNotMatch(tableSource, /IsSystemAccountTable/);
    assert.doesNotMatch(tableSource, />\s*访问密钥\s*</);
    assert.doesNotMatch(tableUtilsSource, /访问密钥|ShouldShowRowAccessKeyAction/);
    assert.doesNotMatch(tableSource, /OpenUserAccessKeys|UserAccessKeyDialog|UserAccessKeyPanel/);

    const componentRegistry = fs.readFileSync(
        path.resolve(testDir, "../src/utils/microi.net.import.js"),
        "utf8"
    );
    const apiDefinitions = fs.readFileSync(
        path.resolve(testDir, "../src/views/form-engine/diy-components/v8-api-definitions.js"),
        "utf8"
    );
    const accessKeyPanel = fs.readFileSync(
        path.resolve(testDir, "../src/views/system/components/user-access-key-panel.vue"),
        "utf8"
    );
    assert.match(componentRegistry, /app\.component\("UserAccessKeyPanel", UserAccessKeyPanel\)/);
    assert.doesNotMatch(apiDefinitions, /OpenUserAccessKeys/);
    assert.match(accessKeyPanel, /DataAppend:\s*\{\s*type:\s*Object/);
    assert.match(accessKeyPanel, /props\.DataAppend\?\.User/);
});
