import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readPlatformServiceSource } from "./helpers/platform-service-source.mjs";

const loginSource = await readFile(
  new URL("../src/views/login/index.vue", import.meta.url),
  "utf8",
);
const permissionSource = await readFile(
  new URL("../src/permission.js", import.meta.url),
  "utf8",
);
const navbarSource = await readFile(
  new URL("../src/layout/components/Navbar.vue", import.meta.url),
  "utf8",
);

test("password login prioritizes the authorized user default route", () => {
  assert.match(loginSource, /LoginResult\.Data\.DefaultIndexUrl/);
  assert.match(loginSource, /var userDefaultIndexUrl[\s\S]*?SysConfig\.DefaultIndexUrl[\s\S]*?SysMenuHomePage\.Url/);
  assert.match(loginSource, /var isRegisteredRoute[\s\S]*?hasAccessibleRoutePath/);
  assert.match(loginSource, /if \(!isRegisteredRoute\(url\) && fallbackUrl\)/);
  assert.match(permissionSource, /routePath === "\/login" \|\| routePath === "\/access-login"/);
});

test("direct-token and SSO guards use the same user-route precedence", () => {
  assert.match(permissionSource, /function getUserDefaultIndexUrl/);
  assert.match(permissionSource, /async function getAuthorizedUserDefaultIndexUrl/);
  assert.match(permissionSource, /const usesDiyToken[\s\S]*?DiyApi\.TokenLogin\(\)\.toLowerCase\(\)/);
  assert.match(permissionSource, /ssoApiResult\.Data/);
  assert.match(permissionSource, /await DiyCommon\.PostAsync\(diySso\.ClientSsoApi/);
  assert.match(permissionSource, /await getAuthorizedUserDefaultIndexUrl\(ssoApiResult\.Data\)/);
  assert.match(permissionSource, /hasAccessibleRoutePath\(accessRoutes, candidatePath\)/);
});

test("signed-in users save their own route through the platform service and login rechecks access", async () => {
  const personalSettings = readPlatformServiceSource("src/PersonalSettings.vue");
  const preferencesEngine = await readFile(new URL("../../Microi.Server/Microi.Upgrade/Resource/platform-user-update-preferences.js", import.meta.url), "utf8");
  assert.match(navbarSource, /OpenPersonalSettings/);
  assert.match(navbarSource, /\/micro-app\/microi-platform-service\/personal-settings/);
  assert.match(personalSettings, /client\.ApiEngine\.Run\('platform-user-update-preferences'/);
  assert.match(personalSettings, /DefaultIndexUrl: preference\.DefaultIndexUrl/);
  assert.match(personalSettings, /登录时仍会按当前菜单权限检查并自动回退/);
  assert.match(preferencesEngine, /!V8\.CurrentUser \|\| !V8\.CurrentUser\.Id/);
  assert.match(preferencesEngine, /var updateModel = \{ Id: userId \}/);
  assert.match(permissionSource, /hasAccessibleRoutePath\(accessRoutes, candidatePath\)/);
});
