import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(permissionSource, /directLoginResult\.Data/);
  assert.match(permissionSource, /ssoApiResult\.Data/);
  assert.match(permissionSource, /await getAuthorizedUserDefaultIndexUrl\(directLoginResult\.Data\)/);
  assert.match(permissionSource, /await getAuthorizedUserDefaultIndexUrl\(ssoApiResult\.Data\)/);
  assert.match(permissionSource, /hasAccessibleRoutePath\(accessRoutes, candidatePath\)/);
});

test("every signed-in user can save a route selected from current authorized routes", () => {
  assert.match(navbarSource, /OpenPersonalSettings/);
  assert.match(navbarSource, /BuildDefaultRouteOptions\(this\.routes\)/);
  assert.match(navbarSource, /\/api\/SysUser\/UpdateMyDefaultIndexUrl/);
  assert.match(navbarSource, /DefaultIndexUrl/);
  assert.match(navbarSource, /权限变化后若原页面不可访问，登录时会自动回退/);
});
