import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = relativePath => readFile(path.join(clientRoot, relativePath), "utf8");

function sourceSection(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(end > start, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function assertOrdered(source, markers) {
    let cursor = -1;
    for (const marker of markers) {
        const index = source.indexOf(marker, cursor + 1);
        assert.ok(index > cursor, `expected ${marker} after the preceding authorization step`);
        cursor = index;
    }
}

test("the user store repairs authorization before roles and protected routes are initialized", async () => {
    const userSource = await readSource("src/pinia/modules/user.js");
    const permissionSource = await readSource("src/permission.js");
    const getInfo = sourceSection(userSource, "        async getInfo() {", "        // user logout");
    const changeRolesStart = userSource.indexOf("        async changeRoles(role) {");
    assert.ok(changeRolesStart >= 0, "changeRoles action was not found");
    const changeRoles = userSource.slice(changeRolesStart);
    const authenticatedGuard = permissionSource.slice(permissionSource.indexOf("    if (hasToken) {"));

    assertOrdered(getInfo, [
        "await this.ensureAuthorizationSnapshot(result.Data || {})",
        "this.setRoles("
    ]);
    assertOrdered(changeRoles, [
        "await this.getInfo()",
        "permissionStore.generateRoutes"
    ]);
    assertOrdered(authenticatedGuard, [
        "await userStore.getInfo()",
        "permissionStore.generateRoutes"
    ]);
});

test("GotoSystem repairs the login projection before assigning roles or generating routes", async () => {
    const loginSource = await readSource("src/views/login/index.vue");
    const gotoSystem = sourceSection(loginSource, "        async GotoSystem() {", "</script>");

    assertOrdered(gotoSystem, [
        "await self.userStore.ensureAuthorizationSnapshot(",
        "self.diyStore.setCurrentUser(authorizedUser)",
        "self.userStore.setRoles(roles)",
        "permissionStore.generateRoutes(roles)"
    ]);
});

test("App force-refreshes an invalid cached projection and rejects a stale-identity response", async () => {
    const appSource = await readSource("src/App.vue");
    const refresh = sourceSection(appSource, "        async RefreshTokenWithLock(forceAuthorizationRefresh = false) {", "        async PageInit() {");
    const pageInit = sourceSection(appSource, "        async PageInit() {", "        IsAnonymousRoute() {");

    assert.match(
        refresh,
        /!forceAuthorizationRefresh\s*&&\s*\(!expires\s*\|\|\s*new Date\(\) < new Date\(expires\)\)/,
        "forced authorization repair must bypass the normal unexpired-token early return"
    );
    assertOrdered(refresh, [
        "var authorization = self.$localStorageManager.get(\"Token\")",
        "isAuthorizationResponseForActiveIdentity(",
        "self.diyStore.setCurrentUser(result.Data)"
    ]);
    assert.match(
        refresh,
        /isAuthorizationResponseForActiveIdentity\(\s*authorization,\s*self\.DiyCommon\.getToken\(\),\s*result\.Data\s*\)/,
        "the refresh response must still belong to the active token before replacing CurrentUser"
    );
    assertOrdered(pageInit, [
        "!hasCurrentUserAuthorizationSnapshot(cachedCurrentUser)",
        "await self.RefreshTokenWithLock(authorizationNeedsRepair)"
    ]);
});

test("a bad authorization projection cannot mark roles as initialized", async () => {
    const userSource = await readSource("src/pinia/modules/user.js");
    const ensureAuthorization = sourceSection(
        userSource,
        "        async ensureAuthorizationSnapshot(candidateUser) {",
        "        // get user info"
    );
    const getInfo = sourceSection(userSource, "        async getInfo() {", "        // user logout");
    const repairAwait = getInfo.indexOf("await this.ensureAuthorizationSnapshot(result.Data || {})");
    const roleAssignment = getInfo.indexOf("this.setRoles(");

    assert.match(ensureAuthorization, /hasCurrentUserAuthorizationSnapshot\(repairResult\.Data\)/);
    assert.match(ensureAuthorization, /throw error;/, "an invalid repair result must reject initialization");
    assert.ok(repairAwait >= 0, "authorization repair await was not found");
    assert.ok(roleAssignment > repairAwait, "roles must only be assigned after a valid authorization snapshot");
    assert.equal(
        (getInfo.match(/this\.setRoles\(/g) || []).length,
        1,
        "getInfo must not have a fallback branch that initializes roles after repair failure"
    );
    // async getInfo 通过 await 直接传播修复失败；实际执行而非要求特定 catch/reject 写法。
    const repairError = new Error('authorization repair failed');
    let assignedRoles = 0;
    const options = vm.runInNewContext(userSource.replace(/^import\s[\s\S]*?;\s*/gm, '')
        .replace(/^export /gm, '') + '\nuseUserStore;', {
        defineStore: (_, value) => value,
        DiyApi: { GetCurrentUser: () => '/apiengine/platform-current-user' },
        DiyCommon: { PostAsync: async () => ({ Code: 1, Data: { Id: 'user' } }) }
    });
    await assert.rejects(options.actions.getInfo.call({
        ensureAuthorizationSnapshot: async () => { throw repairError; },
        setRoles: () => { assignedRoles++; }
    }), error => error === repairError);
    assert.equal(assignedRoles, 0, 'repair failure must reject getInfo without initializing roles');
});
