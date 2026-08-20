import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageModel = JSON.parse(await readFile(
  new URL("./app.microi.saas-engine.json", import.meta.url),
  "utf8",
));

function sourceHash(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

test("SaaS engine declares every changed legacy managed-engine baseline", () => {
  const fixtures = {
    admin_get_empty_database_sanitization_sql: {
      current: "4431ff8e4de593cc2a67b2656cfb4455f90e3aa05de6e60492331139b52efa8c",
      base: "3f877b2f71deb2c553ed6d3515839e307a1e82ecbf45d7bbc865ca1380cc4df0",
      compatible: ["db42fca3c905fdd1ecf42586c3cfc40bb3b292a647118ca14c416743f7dbccc6"],
    },
    admin_build_sanitized_empty_database: {
      current: "edfb9655511decd2d6660d61077d521a811bcab923a45e889ac54969b0ae205d",
      base: "85b761933d95ab62267a5dbd3bdd480c47b841897214dfae2f5c2ded70260508",
      compatible: [],
    },
  };

  for (const [key, expected] of Object.entries(fixtures)) {
    const engine = packageModel.SysApiEngines.find((item) => item.ApiEngineKey === key);
    const policy = packageModel.ResourcePolicies.ApiEngines[key];
    assert.ok(engine, `${key} engine missing`);
    assert.equal(sourceHash(engine.ApiV8Code), expected.current);
    assert.equal(policy.UpgradePolicy, "Managed");
    assert.equal(policy.BaseHash, expected.base);
    assert.deepEqual(policy.CompatibleBaseHashes || [], expected.compatible);
  }
});

test("SaaS engine delivers role and department management as low-code tree-table resources", () => {
  const versionParts = String(packageModel.PackageInfo.Version || "")
    .replace(/^v/u, "")
    .split(".")
    .map(Number);
  assert.ok(versionParts.length === 3 && versionParts.every(Number.isInteger));
  assert.ok(
    versionParts[0] > 7
      || (versionParts[0] === 7 && versionParts[1] > 4)
      || (versionParts[0] === 7 && versionParts[1] === 4 && versionParts[2] >= 8),
    `SaaS engine package version ${packageModel.PackageInfo.Version} predates the low-code role/dept delivery`,
  );

  const roleTable = packageModel.DiyTables.find((item) => item.Name === "sys_role");
  const departmentTable = packageModel.DiyTables.find((item) => item.Name === "sys_dept");
  const roleLimitTable = packageModel.DiyTables.find((item) => item.Name === "sys_rolelimit");
  assert.ok(roleTable);
  assert.ok(departmentTable);
  assert.ok(roleLimitTable);
  assert.match(roleTable.SubmitBeforeServerV8, /Version: v1\.0\.2/u);
  assert.match(roleTable.SubmitAfterServerV8, /Version: v1\.0\.1/u);
  assert.match(departmentTable.SubmitBeforeServerV8, /Version: v1\.0\.1/u);
  assert.match(departmentTable.SubmitAfterServerV8, /Version: v1\.0\.0/u);
  assert.equal(departmentTable.IsTree, 1);
  assert.equal(departmentTable.TreeParentField, "ParentId");

  const permissionField = packageModel.DiyFields.find(
    (item) => item.TableId === roleTable.Id && item.Name === "RolePermissionDetails",
  );
  assert.equal(permissionField.Component, "DevComponent");
  assert.equal(permissionField.IsVirtual, 1);
  assert.deepEqual(JSON.parse(permissionField.Config), {
    DevComponentName: "SysrolePermissionField",
    DevComponentPath: "/views/system/components/sysrole-permission-field.vue",
  });
  assert.equal(packageModel.PhysicalColumns.some(
    (item) => item.TABLE_NAME === "sys_role" && item.COLUMN_NAME === "RolePermissionDetails",
  ), false);

  for (const route of ["/system/role", "/system/dept"]) {
    const menu = packageModel.SysMenus.find((item) => item.Url === route);
    assert.ok(menu, `${route} menu missing`);
    assert.equal(menu.ComponentPath, "/diy/left-right/LeftTreeJoinRightForm");
  }

  const dataSet = packageModel.DataSets.find(
    (item) => item.TableName === "diy_LeftJoinRightView",
  );
  assert.equal(dataSet.ConflictPolicy, "UpsertById");
  assert.deepEqual(new Set(dataSet.RowIds), new Set([
    "01M0CZAY7TSGSTC2RK6CVQTM17",
    "01M0CZAYK3JW93QY0ZY3WD860G",
  ]));
  assert.ok(dataSet.Rows.some(
    (item) => item.GuanlianBD === "sys_dept"
      && item.ZibiaoGLZD === "DeptIds"
      && item.GuanlianPPLJ === "Like",
  ));
  assert.ok(dataSet.Rows.some(
    (item) => item.GuanlianBD === "sys_dept"
      && item.ZibiaoGLZD === "ParentId"
      && item.GuanlianPPLJ === "=",
  ));
});
