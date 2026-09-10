import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { advanceOfficialPackageVersion, ensureMinimumPackageVersion } from './resource-sync-core.mjs';

export const hdfsUploadRuleFieldId = '01M223PCHQ7H2929ERKK8M4XTB';
export const hdfsUploadRuleVersions = {
  'app.microi.sys-config.json': 'v6.4.4',
  'app.microi.saas-engine.json': 'v8.3.8',
};
export const hdfsUploadRulesDescription = '目录支持*（单层）、**（多层）、?（单字符）、[a-z]/[!0-9]及{目录A,目录B}，可组合且区分大小写；**须独占一层。角色填Id数组或开启所有登录用户，公有上传须单独允许。仅授权业务目录，不授予读取或平台保留目录权限。保存后缓存生效；通配符需后端v8.2.9+。';
export const hdfsUploadRulesConfig = { JsonTable: { Columns: [
  { Key: 'Path', Label: '允许目录', Component: 'Text', Width: 280, Placeholder: 'files/{inspection,quality}/**' },
  { Key: 'RoleIds', Label: '授权角色Id数组', Component: 'Text', Width: 260, Placeholder: '["角色Id"]' },
  { Key: 'AllAuthenticated', Label: '所有登录用户', Component: 'Switch', Width: 130 },
  { Key: 'IncludeSubdirectories', Label: '包含子目录', Component: 'Switch', Width: 130 },
  { Key: 'AllowPublic', Label: '允许公有文件', Component: 'Switch', Width: 130 },
] } };

export function configureHdfsUploadPermissions(input, resourceName) {
  const pkg = structuredClone(input);
  const table = pkg.DiyTables.find(row => row.Name.toLowerCase() === 'sys_config');
  assert.ok(table, '包必须拥有系统设置表');
  const tab = JSON.parse(table.Tabs).find(row => row.Name === '开发配置');
  assert.ok(tab, '保留已有开发配置 Tab 和文件运行环境分组');
  const current = pkg.DiyFields.find(row => row.TableId === table.Id && row.Name === 'HdfsUploadRules');
  const field = {
    TableName: table.Name, TableId: table.Id, Id: hdfsUploadRuleFieldId,
    Name: 'HdfsUploadRules', Label: '文件上传权限', Type: 'mediumtext', Component: 'JsonTable',
    Tab: tab.Id, Sort: 1850, Visible: 1, AppVisible: 1, Readonly: 0, NotEmpty: 0, Unique: 0,
    InTableEdit: 0, Encrypt: 0, FormWidth: 24, TableWidth: 150, NameConfirm: 1,
    BindRole: '[]', Data: '[]', DefaultValue: '[]', IsLockField: 0,
    Config: JSON.stringify(hdfsUploadRulesConfig), Description: hdfsUploadRulesDescription,
  };
  if (current) Object.assign(current, field); else pkg.DiyFields.push(field);
  if (!pkg.PhysicalColumns.some(row => row.TABLE_NAME.toLowerCase() === 'sys_config' && row.COLUMN_NAME === field.Name)) {
    const columns = pkg.PhysicalColumns.filter(row => row.TABLE_NAME.toLowerCase() === 'sys_config');
    pkg.PhysicalColumns.push({
      TABLE_NAME: 'sys_config', COLUMN_NAME: field.Name, COLUMN_TYPE: 'mediumtext', DATA_TYPE: 'mediumtext',
      IS_NULLABLE: 'YES', COLUMN_DEFAULT: null, COLUMN_COMMENT: field.Label, COLUMN_KEY: '', EXTRA: '',
      ORDINAL_POSITION: Math.max(...columns.map(row => Number(row.ORDINAL_POSITION) || 0)) + 1,
    });
  }
  const ddl = pkg.DDLStatements.find(row => row.TableName.toLowerCase() === 'sys_config');
  assert.ok(ddl, '必须提供空数据库安装用的 DDL');
  if (!ddl.DDL.includes('`HdfsUploadRules`')) {
    assert.ok(ddl.DDL.includes('`DisableTaskScheduling`'), '系统设置建表锚点缺失');
    ddl.DDL = ddl.DDL.replace(/(  `DisableTaskScheduling`[^\n]+\n)/,
      "$1  `HdfsUploadRules` mediumtext NULL COMMENT '文件上传权限',\n");
  }
  // 只升级字段和可空物理列，绝不把母库规则作为数据种子覆盖租户自己的授权。
  for (const set of pkg.DataSets || []) if (String(set.TableName).toLowerCase() === 'sys_config')
    assert.ok((set.Rows || []).every(row => !Object.hasOwn(row, field.Name)), '禁止随包覆盖租户上传规则');
  const version = hdfsUploadRuleVersions[resourceName];
  assert.ok(version, '仅处理拥有系统设置的两个官方包');
  const content = '文件上传权限增加目录通配符说明与配置示例，支持*、**、?、字符集合/范围和花括号候选组合，减少旧移动端和微服务目录逐条授权。后端继续校验实际路径、有效角色、公私桶与平台保留目录；不覆盖任何租户既有授权。通配符需后端v8.2.9+。';
  // Re-running an older configurator must not replace a later release's history.
  const versionProbe = { Version: pkg.PackageInfo.Version };
  if (ensureMinimumPackageVersion(versionProbe, version) === version) {
    pkg.PackageInfo.ChangeLog = { ...pkg.PackageInfo.ChangeLog, Version: pkg.PackageInfo.Version,
      Title: '文件上传目录通配符授权', ChangeType: 'Feature', Content: content };
    advanceOfficialPackageVersion(pkg.PackageInfo, version, '2026-09-09 13:00:00');
  }
  pkg.PackageInfo.FieldCount = pkg.DiyFields.length;
  pkg.PackageInfo.PhysicalColumnCount = pkg.PhysicalColumns.length;
  return pkg;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.ok(process.argv.includes('--write'), '使用 --write 明确更新本地候选包；不修改同步基线');
  for (const name of Object.keys(hdfsUploadRuleVersions)) {
    const file = new URL(name, import.meta.url);
    fs.writeFileSync(file, JSON.stringify(configureHdfsUploadPermissions(JSON.parse(fs.readFileSync(file, 'utf8')), name), null, 2) + '\n');
    console.log(name + '：已更新上传权限契约');
  }
}
