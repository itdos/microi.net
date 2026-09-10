import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const readPrimaryFieldId = 'f04a8b57-9d9a-44b2-9f13-b491290c5101';
export const readPrimaryCapability = 'ServerFeature:FormEngineReadPrimaryV1';
const version = 'v7.7.4';
const description = '新增按表主库读取配置：原生行、计数、汇总、树及导出共用目标表主库策略；NULL/0保留默认，显式事务不变。必须同步部署支持该策略的后端，不能仅凭字段存在声明即时授权。';

/** 精确追加表配置声明；不修改其它字段、租户数据或已经发布的同步基线。 */
export function configureReadPrimary(input) {
  const pkg = structuredClone(input);
  if (!['v7.7.3', version].includes(pkg.PackageInfo?.Version))
    throw new Error(`ReadPrimary 配置只接受 v7.7.3 或 ${version} 候选`);
  const table = pkg.DiyTables.find(x => x.Name === 'diy_table');
  const ddl = pkg.DDLStatements.find(x => x.TableName === 'diy_table');
  if (!table || !ddl) throw new Error('缺少 diy_table 声明');
  const matches = pkg.DiyFields.filter(x => x.TableId === table.Id && x.Name === 'ReadPrimary');
  if (matches.length > 1 || matches[0] && matches[0].Id !== readPrimaryFieldId)
    throw new Error('ReadPrimary 字段标识冲突');
  if (!matches.length && pkg.DiyFields.some(x => x.Id === readPrimaryFieldId))
    throw new Error('ReadPrimary 稳定 Id 已被其它字段占用');
  const tabs = JSON.parse(table.Tabs);
  const field = {
    Id: readPrimaryFieldId, TableId: table.Id, TableName: table.Name,
    Name: 'ReadPrimary', Label: '主库读取', Type: 'int', Component: 'Switch',
    Description: '开启后，原生列表、计数、汇总、树和导出读取本表所属主库。保留显式事务；不能修复旧事务快照。',
    Tab: tabs[0].Id, Sort: 750, Visible: 1, AppVisible: 1, Readonly: 0,
    NotEmpty: 0, NameConfirm: 1, InTableEdit: 0, Unique: 0, IsLockField: 0,
    Data: '[]', Config: '{}', FormWidth: null, TableWidth: 120,
  };
  if (matches.length) Object.assign(matches[0], field); else pkg.DiyFields.push(field);
  const physical = pkg.PhysicalColumns.filter(x => x.TABLE_NAME === 'diy_table' && x.COLUMN_NAME === 'ReadPrimary');
  if (physical.length > 1) throw new Error('ReadPrimary 物理声明重复');
  const column = {
    TABLE_NAME: 'diy_table', COLUMN_NAME: 'ReadPrimary',
    ORDINAL_POSITION: physical[0]?.ORDINAL_POSITION ?? Math.max(...pkg.PhysicalColumns.filter(x => x.TABLE_NAME === 'diy_table').map(x => Number(x.ORDINAL_POSITION))) + 1,
    COLUMN_TYPE: 'int', DATA_TYPE: 'int', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null,
    COLUMN_COMMENT: '主库读取', COLUMN_KEY: '', EXTRA: '',
  };
  if (physical.length) Object.assign(physical[0], column); else pkg.PhysicalColumns.push(column);
  if (!ddl.DDL.includes('`ReadPrimary`')) {
    const at = ddl.DDL.lastIndexOf('\n) ENGINE');
    if (at < 0) throw new Error('diy_table DDL 结束位置不明确');
    ddl.DDL = ddl.DDL.slice(0, at).replace(/,?\s*$/, '') + ",\n  `ReadPrimary` int NULL COMMENT '主库读取'" + ddl.DDL.slice(at);
  }
  // 不把所有表批量设为1，也不为现有租户数据写入发布方的默认值。
  pkg.PackageInfo.Version = version;
  pkg.PackageInfo.RequiredPlatformCapabilities = [...new Set([...(pkg.PackageInfo.RequiredPlatformCapabilities || []), readPrimaryCapability])];
  const log = { Version: version, Title: '表单主库读取策略', ChangeType: 'Feature', Content: description, ReleaseTime: '2026-09-10 14:00:00' };
  pkg.PackageInfo.ChangeLog = log;
  const history = `2026-09-10 ${version} ${description}`;
  if (!String(pkg.PackageInfo.ChangeHistory).includes(history)) pkg.PackageInfo.ChangeHistory = history + '\n' + (pkg.PackageInfo.ChangeHistory || '');
  pkg.PackageInfo.FieldCount = pkg.DiyFields.length;
  pkg.PackageInfo.PhysicalColumnCount = pkg.PhysicalColumns.length;
  return pkg;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.join(path.dirname(fileURLToPath(import.meta.url)), 'app.microi.form-engine.json');
  fs.writeFileSync(target, JSON.stringify(configureReadPrimary(JSON.parse(fs.readFileSync(target, 'utf8'))), null, 2) + '\n');
  console.log(JSON.stringify({ package: 'app.microi.form-engine', version, field: readPrimaryFieldId }));
}
