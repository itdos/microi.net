import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = relativePath => readFile(path.join(clientRoot, relativePath), "utf8");

test("cold-start identity is resolved before the protected menu tree", async () => {
    const source = await readSource("src/permission.js");
    const tokenBranch = source.indexOf("    if (hasToken) {");
    const identityProbe = source.indexOf("await userStore.getInfo()", tokenBranch);
    const menuRequest = source.indexOf("permissionStore.generateRoutes", tokenBranch);

    assert.ok(tokenBranch >= 0, "authenticated route branch was not found");
    assert.ok(identityProbe > tokenBranch, "identity preflight was not found");
    assert.ok(menuRequest > identityProbe, "menu generation must happen after identity preflight");
    assert.doesNotMatch(
        source.slice(identityProbe, menuRequest),
        /setRoles\(\["admin"\]\)/,
        "a cached token must not be promoted to an authenticated role before validation"
    );
    assert.match(source, /Number\(error\.code \?\? error\.Code\)/);
});

test("current-user failure preserves the authentication code and authoritative message", async () => {
    const source = await readSource("src/pinia/modules/user.js");
    assert.match(source, /const error = new Error\(result\?\.Msg/);
    assert.match(source, /error\.code = result\?\.Code/);
    assert.match(source, /error\.DataAppend = result\?\.DataAppend/);
    assert.match(source, /setCurrentUser\(currentUser\)/);
});

test("the login entry silently consumes expired or missing authentication", async () => {
    const source = await readSource("src/utils/diy.common.js");
    const app = await readSource("src/App.vue");
    assert.match(source, /IsLoginEntryRoute: function \(\)/);
    assert.match(source, /hashPath === "\/login"/);
    assert.match(source, /hashPath === "\/access-login"/);
    assert.match(source, /isAuthenticationFailure && DiyCommon\.IsLoginEntryRoute\(\)/);
    assert.match(source, /error\.response\.status == 401 && DiyCommon\.IsLoginEntryRoute\(\)/);
    assert.doesNotMatch(source, /Microi\.AuthFailureMessage|SaveAuthFailureMessage|ConsumeAuthFailureMessage/);
    assert.doesNotMatch(app, /ConsumeAuthFailureMessage|authFailureMessage/);
});
