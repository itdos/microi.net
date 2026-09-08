import assert from 'node:assert/strict';

export const feishuUserIdFieldId = '01M209HE1SHW9YA970T1KT22MY';
export const feishuUserIdRelease = {
  'app.microi.sys_user.json': 'v7.6.8',
  'app.microi.saas-engine.json': 'v8.3.5',
};
export function configureFeishuUserIdResource(input, resourceName) {
  const pkg = structuredClone(input);
  const table = pkg.DiyTables.find(row => row.Name.toLowerCase() === 'sys_user');
  assert.ok(table, 'Package must own sys_user');
  const union = pkg.DiyFields.find(row => row.TableId === table.Id && row.Name === 'FeishuUnionId');
  assert.ok(union, 'Existing FeishuUnionId metadata is required as the layout anchor');
  if (!pkg.DiyFields.some(row => row.TableId === table.Id && row.Name === 'FeishuUserId')) {
    pkg.DiyFields.push({
      TableName: table.Name, TableId: table.Id, Id: feishuUserIdFieldId,
      Name: 'FeishuUserId', Label: '飞书UserId', Type: 'varchar(100)', Component: 'Text',
      Tab: union.Tab, Sort: Number(union.Sort) + 5, Visible: 1, AppVisible: 1,
      Readonly: 1, NotEmpty: 0, Unique: 0, InTableEdit: 0, Encrypt: 0,
      FormWidth: null, TableWidth: 150, NameConfirm: 1, Config: '{}', Data: '[]',
      Description: '飞书租户内用户标识 user_id；用于已验证飞书身份的绑定与历史接口兼容，与飞书 UnionId 不同。仅由可信的身份绑定流程写入，不从客户端直接推断或替换。'
    });
  }
  if (!pkg.PhysicalColumns.some(row => row.TABLE_NAME.toLowerCase() === 'sys_user' && row.COLUMN_NAME === 'FeishuUserId')) {
    const columns = pkg.PhysicalColumns.filter(row => row.TABLE_NAME.toLowerCase() === 'sys_user');
    pkg.PhysicalColumns.push({
      TABLE_NAME: 'sys_user', COLUMN_NAME: 'FeishuUserId', COLUMN_TYPE: 'varchar(100)', DATA_TYPE: 'varchar',
      IS_NULLABLE: 'YES', COLUMN_DEFAULT: null, COLUMN_COMMENT: '飞书UserId', COLUMN_KEY: '', EXTRA: '',
      ORDINAL_POSITION: Math.max(...columns.map(row => Number(row.ORDINAL_POSITION) || 0)) + 1
    });
  }
  const ddl = pkg.DDLStatements.find(row => row.TableName.toLowerCase() === 'sys_user');
  assert.ok(ddl, 'sys_user creation DDL required');
  if (!ddl.DDL.includes('`FeishuUserId`')) {
    assert.ok(ddl.DDL.includes('`FeishuUnionId`'), 'DDL layout anchor missing');
    ddl.DDL = ddl.DDL.replace(/(  `FeishuUnionId`[^\n]+\n)/, "$1  `FeishuUserId` varchar(100) NULL COMMENT '飞书UserId',\n");
  }
  const version = feishuUserIdRelease[resourceName];
  assert.ok(version, 'Only the owning official account/base packages may be modified');
  const content = '补齐 sys_user.FeishuUserId 的字段元数据、跨数据库物理列与建表 DDL，兼容旧飞书/ERP 入口按 user_id 或 Account 查询；不删除旧查询条件，不覆盖用户身份数据，缺失字段继续严格拒绝查询。';
  const history = `2026-09-08 ${version} ${content}`;
  pkg.PackageInfo.Version = version;
  pkg.PackageInfo.FieldCount = pkg.DiyFields.length;
  pkg.PackageInfo.PhysicalColumnCount = pkg.PhysicalColumns.length;
  if (!(pkg.PackageInfo.ChangeHistory || '').includes(history)) pkg.PackageInfo.ChangeHistory = history + '\n' + (pkg.PackageInfo.ChangeHistory || '');
  pkg.PackageInfo.ChangeLog = { Version: version, Title: '旧飞书用户标识字段兼容修复', ChangeType: 'Fix', Content: content, ReleaseTime: '2026-09-08 18:48:00' };
  return pkg;
}
