import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageModel = JSON.parse(await readFile(
  new URL("./app.microi.saas-engine.json", import.meta.url),
  "utf8",
));

test("SaaS engine delivers role and department management as low-code tree-table resources", () => {
  assert.equal(packageModel.PackageInfo.Version, "v7.4.8");

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
