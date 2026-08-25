import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createMemoryHistory, createRouter } from "vue-router";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(clientRoot, "src");

async function readSourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (["bin", "dist", "generated"].includes(entry.name)) continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await readSourceFiles(fullPath));
        } else if (/\.(?:js|mjs|vue)$/i.test(entry.name)) {
            files.push({ path: fullPath, source: await readFile(fullPath, "utf8") });
        }
    }
    return files;
}

test("platform bootstrap uses Managed routes with one isolated SysConfig compatibility fallback", async function () {
    const files = await readSourceFiles(sourceRoot);
    const legacyRoutes = /\/api\/(?:Os\/GetOsClientByDomain|(?:FormEngine|DiyTable)\/GetSysConfig|FormEngine\/GetLangBundle|FormEngine\/GetLoginWallpapers|SysUser\/(?:GetCurrentUser|GetSysUserPublicInfo|AddSysUser|UptSysUser|DelSysUser|GetSysUser|RefreshLoginUser)(?![A-Za-z0-9_])|HDFS\/GetPrivateFileUrl|sms\/send|SysUser\/reg)/i;
    for (const file of files) {
        if (file.path.endsWith(path.join("utils", "platform-sys-config.js"))) {
            assert.match(file.source, /const LEGACY_SYS_CONFIG_URL = "\/api\/FormEngine\/GetSysConfig"/);
            const withoutApprovedFallback = file.source.replace("/api/FormEngine/GetSysConfig", "");
            assert.doesNotMatch(withoutApprovedFallback, legacyRoutes, file.path);
            continue;
        }
        assert.doesNotMatch(file.source, legacyRoutes, file.path);
    }
    const source = files.map(file => file.source).join("\n");

    for (const key of [
        "platform-os-client-by-domain",
        "platform-sys-config",
        "platform-lang-bundle",
        "platform-login-wallpapers",
        "send_sms_reg",
        "platform_auth_sms_login",
        "platform-current-user",
        "platform-private-file-url",
        "platform-sys-user-public-info",
        "platform-sys-user-admin"
    ]) {
        assert.match(source, new RegExp(`/apiengine/${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), key);
    }
});

test("system-account management uses action-scoped Managed ApiEngine without generic FormEngine writes", async function () {
    const apiSource = await readFile(path.join(sourceRoot, "utils", "api.itdos.js"), "utf8");
    const manageSource = await readFile(path.join(sourceRoot, "views", "system", "sysuser-manage.vue"), "utf8");
    const hostSource = await readFile(path.join(sourceRoot, "views", "micro-app", "host.vue"), "utf8");

    for (const action of ["AddSysUser", "UptSysUser", "DelSysUser", "GetSysUser"]) {
        assert.match(apiSource, new RegExp(`platform-sys-user-admin\\?Action=${action}`), action);
    }
    assert.match(hostSource, /platform-sys-user-admin\?Action=RefreshLoginUser/);
    assert.match(manageSource, /DiyApi\.AddSysUser\(\)/);
    assert.match(manageSource, /DiyApi\.UptSysUser\(\)/);
    assert.doesNotMatch(manageSource, /\/api\/FormEngine\/(?:AddFormData|UptFormData)/i);
});

test("anonymous bootstrap and language requests explicitly omit Authorization", async function () {
    const osClientSource = await readFile(path.join(sourceRoot, "utils", "itdos.osclient.js"), "utf8");
    const sysConfigSource = await readFile(path.join(sourceRoot, "utils", "platform-sys-config.js"), "utf8");
    const commonSource = await readFile(path.join(sourceRoot, "utils", "diy.common.js"), "utf8");
    const loginSource = await readFile(path.join(sourceRoot, "views", "login", "index.vue"), "utf8");
    const remoteSource = await readFile(path.join(sourceRoot, "views", "file-manage", "api.js"), "utf8");

    assert.match(osClientSource, /platform-os-client-by-domain[\s\S]{0,400}skipAuthorization:\s*true/);
    assert.match(osClientSource, /getPlatformSysConfig\(DiyCommon/);
    assert.match(sysConfigSource, /PLATFORM_SYS_CONFIG_URL\s*=\s*["']\/apiengine\/platform-sys-config/);
    assert.match(sysConfigSource, /LEGACY_SYS_CONFIG_URL\s*=\s*["']\/api\/FormEngine\/GetSysConfig/);
    assert.match(sysConfigSource, /function anonymousRequest[\s\S]{0,300}skipAuthorization:\s*true/);
    assert.match(commonSource, /platform-lang-bundle[\s\S]{0,500}skipAuthorization:\s*true/);
    assert.match(loginSource, /getPlatformSysConfig\(self\.DiyCommon/);
    assert.match(loginSource, /platform-login-wallpapers[\s\S]{0,500}skipAuthorization:\s*true/);
    assert.match(loginSource, /send_sms_reg[\s\S]{0,500}skipAuthorization:\s*true/);
    assert.match(loginSource, /platform_auth_sms_login[\s\S]{0,900}skipAuthorization:\s*true/);
    assert.match(remoteSource, /platform-sys-config[\s\S]{0,300}apiengine:\s*['"]1['"]/);
});

test("SysConfig fallback is narrow and retries only missing-engine or unsupported-route failures", async function () {
    const modulePath = pathToFileURL(path.join(sourceRoot, "utils", "platform-sys-config.js")).href;
    const {
        getPlatformSysConfig,
        shouldFallbackPlatformSysConfig
    } = await import(modulePath);

    assert.equal(shouldFallbackPlatformSysConfig({ response: { status: 404 } }), true);
    assert.equal(shouldFallbackPlatformSysConfig({ response: { status: 401 } }), false);
    assert.equal(shouldFallbackPlatformSysConfig({ Code: 0, Msg: "密码错误" }), false);
    assert.equal(shouldFallbackPlatformSysConfig({
        Code: 0,
        Msg: "NoExistData 表名：sys_apiengine 条件：ApiEngineKey='platform-sys-config'"
    }), true);

    const calls = [];
    const diyCommon = {
        async PostAsync(options) {
            calls.push(options);
            if (calls.length === 1) {
                return {
                    Code: 0,
                    Msg: "不存在的数据！表名：sys_apiengine，ApiAddress='/apiengine/platform-sys-config'"
                };
            }
            return { Code: 1, Data: { SysTitle: "兼容成功" } };
        }
    };
    const result = await getPlatformSysConfig(diyCommon, { OsClient: "tenant-a" });
    assert.equal(result.Code, 1);
    assert.deepEqual(calls.map(item => item.url), [
        "/apiengine/platform-sys-config",
        "/api/FormEngine/GetSysConfig"
    ]);
    assert.ok(calls.every(item => item.skipAuthorization === true));
});

test("SMS registration uses the managed login token contract without changing password login", async function () {
    const loginSource = await readFile(path.join(sourceRoot, "views", "login", "index.vue"), "utf8");
    const regStart = loginSource.indexOf("        async Reg() {");
    const regEnd = loginSource.indexOf("        GetCaptcha(", regStart);
    const passwordLoginStart = loginSource.indexOf("        async Login() {");
    const passwordLoginEnd = loginSource.indexOf("        async GotoSystem()", passwordLoginStart);
    assert.ok(regStart >= 0 && regEnd > regStart, "Reg method was not found");
    assert.ok(passwordLoginStart >= 0 && passwordLoginEnd > passwordLoginStart, "Login method was not found");

    const regSource = loginSource.slice(regStart, regEnd);
    const passwordLoginSource = loginSource.slice(passwordLoginStart, passwordLoginEnd);
    assert.match(regSource, /Phone:\s*registeredPhone/);
    assert.match(regSource, /SmsCode:\s*self\.RegModel\.SmsCaptchaValue/);
    assert.match(regSource, /Password:\s*registeredPassword/);
    assert.doesNotMatch(regSource, /encryptPassword|encryptedPwd/);
    assert.match(regSource, /DataAppend\?\.Token\s*\|\|\s*result\.Data\?\.Authorization/);
    assert.match(regSource, /ApplyAuthorizationToken\(token,\s*""\)/);
    assert.match(regSource, /CompleteIdentityLogin\(result\)/);

    assert.match(passwordLoginSource, /DiyApi\.Login\(\)/);
    assert.match(passwordLoginSource, /loginParam\._CaptchaId\s*=\s*self\.CaptchaId/);
    assert.match(passwordLoginSource, /loginParam\._CaptchaValue\s*=\s*self\.CaptchaValue/);
});

test("private resource capability requests carry explicit trusted resource kinds", async function () {
    const commonSource = await readFile(path.join(sourceRoot, "utils", "diy.common.js"), "utf8");
    const deptSource = await readFile(path.join(sourceRoot, "views", "system", "sysdept-manage.vue"), "utf8");
    const tableOperationsSource = await readFile(path.join(sourceRoot, "views", "form-engine", "mixins", "diy-table-operations.mixin.js"), "utf8");

    assert.match(commonSource, /ResourceKind:\s*"UserAvatar"[\s\S]{0,100}ResourceId:\s*userId/);
    assert.match(deptSource, /ResourceKind:\s*"DeptImportTemplate"[\s\S]{0,100}ResourceId:\s*self\.CurrentSysDeptModel\.Id/);
    assert.match(tableOperationsSource, /ResourceKind:\s*"MenuImportTemplate"[\s\S]{0,100}ResourceId:\s*self\.SysMenuModel\.Id/);
});

test("file manager and XJY service records fail closed without authoritative resource context", async function () {
    const fileApiSource = await readFile(path.join(sourceRoot, "views", "file-manage", "api.js"), "utf8");
    const filePageSource = await readFile(path.join(sourceRoot, "views", "file-manage", "index.vue"), "utf8");
    const fileSyncSource = await readFile(path.join(sourceRoot, "views", "file-manage", "components", "FileSyncDialog.vue"), "utf8");
    const serviceRecordSource = await readFile(path.join(sourceRoot, "views", "custom", "xjy", "ServiceRecord.vue"), "utf8");

    assert.match(fileApiSource, /ResourceKind:\s*['"]FileManagerObject['"]/);
    assert.match(fileApiSource, /ResourceId:\s*resourceId[\s\S]{0,80}FilePathName:\s*resourceId/);
    assert.match(fileApiSource, /SysMenuId:\s*trustedSysMenuId/);
    assert.match(fileApiSource, /if\s*\(!trustedSysMenuId\)\s*throw new Error/);
    assert.doesNotMatch(fileApiSource, /\$\{API_BASE\}\/GetPrivateFileUrl/);

    assert.match(filePageSource, /route\.meta\?\.Id\s*\|\|\s*route\.meta\?\.SysMenuId/);
    assert.doesNotMatch(filePageSource, /fileManagerSysMenuId[\s\S]{0,120}route\.(?:query|params)/);
    assert.match(fileSyncSource, /FileManagerSysMenuId/);
    assert.match(fileSyncSource, /sourcePlatform\.sysMenuId/);

    assert.match(serviceRecordSource, /ResourceKind:\s*"FormField"/);
    assert.match(serviceRecordSource, /FormDataId:\s*String\(recordContext\.FormDataId\s*\|\|\s*row\.Id/);
    assert.match(serviceRecordSource, /FieldId:\s*context\.FieldId/);
    assert.match(serviceRecordSource, /SysMenuId:\s*context\.SysMenuId/);
    assert.match(serviceRecordSource, /!context\.FormEngineKey\s*\|\|\s*!context\.FormDataId\s*\|\|\s*!context\.FieldId\s*\|\|\s*!context\.SysMenuId/);
    assert.match(serviceRecordSource, /resolve\(""\);[\s\S]{0,80}return;/);
});

test("file manager route is supplied only by the authoritative dynamic menu", async function () {
    const routerSource = await readFile(path.join(sourceRoot, "router", "index.js"), "utf8");
    assert.doesNotMatch(routerSource, /path:\s*["']\/file-manage["'][\s\S]{0,300}name:\s*["']file-manage["']/);

    const authoritativeMenuId = "menu-file-manager-authoritative";
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{
            path: "/file-manage",
            name: "menu_file_manager_authoritative",
            component: { render: () => null },
            meta: { Id: authoritativeMenuId }
        }]
    });
    const resolved = router.resolve("/file-manage");
    assert.equal(resolved.name, "menu_file_manager_authoritative");
    assert.equal(resolved.meta.Id, authoritativeMenuId);
});

test("private CAD previews bind the derived object to the authoritative form file", async function () {
    const fileUploadSource = await readFile(path.join(sourceRoot, "views", "form-engine", "diy-field-component", "diy-fileupload.vue"), "utf8");

    assert.match(fileUploadSource, /ResourceKind:\s*['"]FormFieldDerivedPreview['"]/);
    assert.match(fileUploadSource, /OriginalFilePathName:\s*storagePath[\s\S]{0,100}FilePathName:\s*previewStoragePath/);
    assert.match(fileUploadSource, /if\s*\(!storagePath\)[\s\S]{0,240}return;/);
    assert.match(fileUploadSource, /FormEngineKey:\s*props\.DiyTableModel\.Name[\s\S]{0,300}FormDataId:[\s\S]{0,200}FieldId:[\s\S]{0,120}SysMenuId:/);
    assert.doesNotMatch(fileUploadSource, /ResourceKind:\s*['"]FormFieldDerivedPreview['"][\s\S]{0,300}ResourceId:/);
});

test("private sys_user avatars resolve only in view state and never persist signed URLs", async function () {
    const chatSource = await readFile(path.join(sourceRoot, "views", "chat", "index.vue"), "utf8");
    const mobileMessageSource = await readFile(path.join(sourceRoot, "views", "mobile", "message.vue"), "utf8");
    const mobileChatSource = await readFile(path.join(sourceRoot, "views", "mobile", "chat.vue"), "utf8");
    const fileSyncSource = await readFile(path.join(sourceRoot, "views", "file-manage", "components", "FileSyncDialog.vue"), "utf8");
    const workflowSource = await readFile(path.join(sourceRoot, "views", "workflow", "component", "workflow-history.vue"), "utf8");
    const fullDataSource = await readFile(path.join(sourceRoot, "views", "form-engine", "mixins", "diy-form-full-data.mixin.js"), "utf8");
    const fullDialogSource = await readFile(path.join(sourceRoot, "views", "form-engine", "mixins", "diy-form-full-dialog.mixin.js"), "utf8");

    assert.match(chatSource, /getUserAvatarViewUrl\(avatar, userId\)[\s\S]{0,900}GetUserAvatarUrl\(source, id\)/);
    assert.match(chatSource, /ToUserAvatar:\s*self\.GetCurrentLastContact\.ContactUserAvatar/);
    assert.match(chatSource, /FromUserAvatar:\s*self\.GetCurrentUser\.Avatar\s*\|\|\s*""/);
    assert.doesNotMatch(chatSource, /(?:ToUserAvatar|FromUserAvatar):\s*self\.DiyCommon\.GetServerPath/);

    assert.match(mobileMessageSource, /getUserAvatarViewUrl\(msg\.ContactUserAvatar, msg\.ContactUserId\)/);
    assert.match(mobileMessageSource, /DiyCommon\.GetUserAvatarUrl\(source, id\)/);
    assert.match(mobileMessageSource, /ContactUserAvatar:\s*message\.FromUserAvatar\s*\|\|\s*''/);

    assert.match(mobileChatSource, /getUserAvatarViewUrl\(msg\.avatar, msg\.FromUserId\)/);
    assert.match(mobileChatSource, /getUserAvatarViewUrl\(currentUser\.Avatar, currentUser\.Id\)/);
    assert.match(mobileChatSource, /DiyCommon\.GetUserAvatarUrl\(source, id\)/);
    assert.match(mobileChatSource, /FromUserAvatar:\s*currentUser\.value\.Avatar\s*\|\|\s*''/);
    assert.match(mobileChatSource, /avatar:\s*(?:message|r)\.FromUserAvatar\s*\|\|\s*''/);
    assert.doesNotMatch(mobileChatSource, /:src="(?:msg\.avatar|currentUser\.Avatar)"/);

    assert.match(fileSyncSource, /:src="form\.(?:source|target)\.remoteUserAvatarUrl\s*\|\|\s*''"/);
    assert.match(fileSyncSource, /runApiEngine\('platform-private-file-url',[\s\S]{0,400}ResourceKind:\s*'UserAvatar'[\s\S]{0,100}ResourceId:\s*userId/);
    assert.match(fileSyncSource, /toRemotePlatform\(platformConfig\)/);
    assert.doesNotMatch(fileSyncSource, /:src="form\.(?:source|target)\.remoteUser\.Avatar/);

    assert.match(workflowSource, /ResolveWorkflowUserAvatar\(sender\)/);
    assert.match(workflowSource, /GetUserAvatarUrl\(user\.Avatar, user\.Id\)/);
    assert.doesNotMatch(workflowSource, /GetServerPath\(searchUser\[0\]\.Avatar\)/);

    assert.match(fullDataSource, /GetUserAvatarUrl\(rawAvatar, item\.UserId\)/);
    assert.match(fullDialogSource, /userId = item\.AccountUserId \|\| item\.UserId[\s\S]{0,180}GetUserAvatarUrl\(rawAvatar, userId\)/);
    assert.doesNotMatch(fullDataSource, /GetServerPath\(item\.Avatar\)/);
    assert.doesNotMatch(fullDialogSource, /GetServerPath\(item\.Avatar\)/);
});
