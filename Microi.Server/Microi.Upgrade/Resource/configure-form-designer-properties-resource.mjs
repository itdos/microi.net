import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(here, 'app.microi.form-engine.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

function maxVersion(current, target) {
  const parse = (value) => String(value || '').replace(/^v/i, '').split('.').map((part) => Number(part) || 0);
  const left = parse(current);
  const right = parse(target);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return current;
    if ((left[index] || 0) < (right[index] || 0)) return target;
  }
  return current || target;
}
const table = pkg.DiyTables.find((item) => String(item.Name).toLowerCase() === 'diy_table');
if (!table) throw new Error('app.microi.form-engine.json 缺少 diy_table');

const WORKBENCH_TAB_ID = 'a1b2c3d4-1111-4a11-8111-000000000001';
const TITLE_TAB_ID = 'a1b2c3d4-1111-4a11-8111-000000000002';
const EVENT_TAB_ID = '84fb2e1e-111a-4e44-b76b-65a2adf8a0d5';

const parsedTabs = JSON.parse(table.Tabs || '[]');
const tabsById = new Map(parsedTabs.map((item) => [item.Id, item]));
tabsById.set(WORKBENCH_TAB_ID, {
  Name: '工作台与分组',
  EnName: 'WorkbenchAndSections',
  Display: true,
  Sort: 3,
  Id: WORKBENCH_TAB_ID,
  Icon: 'fas fa-layer-group',
  _RawName: '工作台与分组',
});
tabsById.set(TITLE_TAB_ID, {
  Name: '标题、说明与记录切换',
  EnName: 'TitlesAndRecordSelector',
  Display: true,
  Sort: 4,
  Id: TITLE_TAB_ID,
  Icon: 'fas fa-heading',
  _RawName: '标题、说明与记录切换',
});
table.Tabs = JSON.stringify([...tabsById.values()].sort((a, b) => Number(a.Sort || 0) - Number(b.Sort || 0)));
table.TabsPosition = 'top';

const fields = pkg.DiyFields.filter((item) => item.TableId === table.Id);
const byName = new Map(fields.map((item) => [item.Name, item]));
const textConfig = byName.get('FormOpenWidth')?.Config || '{}';
const radioConfig = byName.get('TabsPosition')?.Config || '{}';
const textareaConfig = byName.get('FormArticle')?.Config || '{"Textarea":{"DefaultRows":5},"Unique":{"Type":"Alone"}}';
const switchConfig = byName.get('V8Unlimited')?.Config || '{}';

const definitions = [
  ['FormPresentationMode', '表单呈现模式', 'varchar(50)', 'Radio', '["ControlCenter","Standard"]', 'ControlCenter', WORKBENCH_TAB_ID, 1460, textConfig, undefined],
  ['FormPresentationDensity', '表单信息密度', 'varchar(50)', 'Radio', '["Compact","Comfortable"]', 'Compact', WORKBENCH_TAB_ID, 1470, radioConfig, undefined],
  ['FormNavigationTitle', '分组导航标题', 'varchar(255)', 'Text', '[]', '表单分组', WORKBENCH_TAB_ID, 1480, textConfig, undefined],
  ['FormNavigationCountText', '分组数量文案', 'varchar(255)', 'Text', '[]', '{count} 项', WORKBENCH_TAB_ID, 1490, textConfig, undefined],
  ['FormSectionNavigation', '分组导航方式', 'varchar(50)', 'Radio', '["Auto","Tabs"]', 'Auto', WORKBENCH_TAB_ID, 1500, radioConfig, undefined],
  ['FormSectionEyebrow', '分组眉题', 'varchar(255)', 'Text', '[]', 'FORM SECTION', WORKBENCH_TAB_ID, 1510, textConfig, undefined],
  ['FormRequiredCountText', '必填数量文案', 'varchar(255)', 'Text', '[]', '{count} 必填项', WORKBENCH_TAB_ID, 1520, textConfig, undefined],
  ['FormWorkbenchEyebrow', '工作台眉题', 'varchar(255)', 'Text', '[]', 'FORM WORKBENCH', TITLE_TAB_ID, 1530, textConfig, undefined],
  ['FormWorkbenchDescription', '工作台说明', 'mediumtext', 'Textarea', '[]', undefined, TITLE_TAB_ID, 1540, textareaConfig, 24],
  ['FormNavigationFooterTitle', '导航底部标题', 'varchar(255)', 'Text', '[]', undefined, TITLE_TAB_ID, 1550, textConfig, undefined],
  ['FormNavigationFooterHtml', '导航底部说明（HTML）', 'mediumtext', 'Textarea', '[]', undefined, TITLE_TAB_ID, 1560, textareaConfig, 24],
  ['FormRecordSelectorPlaceholder', '记录选择器占位文字', 'varchar(255)', 'Text', '[]', '搜索并切换记录', TITLE_TAB_ID, 1570, textConfig, undefined],
  ['FormRecordSelectorLabelFields', '记录选择器显示字段', 'mediumtext', 'Textarea', '[]', undefined, TITLE_TAB_ID, 1580, textareaConfig, 24],
  ['V8Limit', 'V8运行限制', 'int', 'Switch', '[]', '0', EVENT_TAB_ID, 2490, switchConfig, undefined],
];

const ids = [
  'a1b2c3d4-2111-4a11-8111-000000000001', 'a1b2c3d4-2111-4a11-8111-000000000002',
  'a1b2c3d4-2111-4a11-8111-000000000003', 'a1b2c3d4-2111-4a11-8111-000000000004',
  'a1b2c3d4-2111-4a11-8111-000000000005', 'a1b2c3d4-2111-4a11-8111-000000000006',
  'a1b2c3d4-2111-4a11-8111-000000000007', 'a1b2c3d4-2111-4a11-8111-000000000008',
  'a1b2c3d4-2111-4a11-8111-000000000009', 'a1b2c3d4-2111-4a11-8111-000000000010',
  'a1b2c3d4-2111-4a11-8111-000000000011', 'a1b2c3d4-2111-4a11-8111-000000000012',
  'a1b2c3d4-2111-4a11-8111-000000000013', 'a1b2c3d4-2111-4a11-8111-000000000014',
];

definitions.forEach((definition, index) => {
  const [name, label, type, component, data, defaultValue, tab, sort, config, formWidth] = definition;
  const current = byName.get(name) || {};
  const next = {
    ...current,
    TableName: 'diy_table',
    AppVisible: 1,
    Type: type,
    Name: name,
    InTableEdit: 0,
    Unique: 0,
    NameConfirm: 1,
    TableWidth: 130,
    Config: config,
    TableId: table.Id,
    Readonly: 0,
    Encrypt: 0,
    BindRole: '[]',
    Component: component,
    Visible: 1,
    IsLockField: 1,
    Data: data,
    Sort: sort,
    NotEmpty: 0,
    Label: label,
    Tab: tab,
    Id: current.Id || ids[index],
    CreateTime: current.CreateTime || '2026-08-21 00:00:00',
  };
  if (defaultValue !== undefined) next.DefaultValue = defaultValue;
  else delete next.DefaultValue;
  if (formWidth !== undefined) next.FormWidth = formWidth;
  else delete next.FormWidth;
  if (name === 'V8Limit') {
    next.Description = '默认关闭，后端表单 V8 事件不设置 Jint 单次执行超时、最大语句数、函数递归和累计分配预算；只有打开后才启用这些限制。进程/容器常驻内存保护、取消、并发、嵌套深度、权限沙箱和数据库保护始终生效。';
  }
  if (current.Name) Object.assign(current, next);
  else pkg.DiyFields.push(next);
});

const tabsPosition = byName.get('TabsPosition');
if (!tabsPosition) throw new Error('缺少 diy_table.TabsPosition 元数据');
tabsPosition.Tab = WORKBENCH_TAB_ID;

const legacyPresentation = byName.get('FormPresentation');
if (!legacyPresentation) throw new Error('缺少 diy_table.FormPresentation 元数据');
legacyPresentation.Visible = 0;
legacyPresentation.AppVisible = 0;
legacyPresentation.Description = '旧版兼容，只读迁移源；新版设计器统一维护 diy_table 物理属性字段。';
legacyPresentation.Label = '旧版表单工作台配置（兼容）';

const legacyUnlimited = byName.get('V8Unlimited');
if (!legacyUnlimited) throw new Error('缺少 diy_table.V8Unlimited 元数据');
legacyUnlimited.Visible = 0;
legacyUnlimited.AppVisible = 0;
legacyUnlimited.IsDeleted = 1;
legacyUnlimited.IsLockField = 1;
legacyUnlimited.Description = '旧版反向开关，仅在 V8Limit 字段不存在时用于运行时兼容；新版设计器、MCP 与 Manifest 不再写入。';

const physicalDefinitions = [
  ['V8Limit', 'int(11)', 'int', 'V8运行限制'],
  ['FormPresentationMode', 'varchar(50)', 'varchar', '表单呈现模式'],
  ['FormPresentationDensity', 'varchar(50)', 'varchar', '表单信息密度'],
  ['FormNavigationTitle', 'varchar(255)', 'varchar', '分组导航标题'],
  ['FormNavigationCountText', 'varchar(255)', 'varchar', '分组数量文案'],
  ['FormSectionNavigation', 'varchar(50)', 'varchar', '分组导航方式'],
  ['FormSectionEyebrow', 'varchar(255)', 'varchar', '分组眉题'],
  ['FormRequiredCountText', 'varchar(255)', 'varchar', '必填数量文案'],
  ['FormWorkbenchEyebrow', 'varchar(255)', 'varchar', '工作台眉题'],
  ['FormWorkbenchDescription', 'mediumtext', 'mediumtext', '工作台说明'],
  ['FormNavigationFooterTitle', 'varchar(255)', 'varchar', '导航底部标题'],
  ['FormNavigationFooterHtml', 'mediumtext', 'mediumtext', '导航底部说明'],
  ['FormRecordSelectorPlaceholder', 'varchar(255)', 'varchar', '记录选择器占位文字'],
  ['FormRecordSelectorLabelFields', 'mediumtext', 'mediumtext', '记录选择器显示字段'],
];

let nextOrdinal = Math.max(...pkg.PhysicalColumns.filter((item) => item.TABLE_NAME === 'diy_table').map((item) => Number(item.ORDINAL_POSITION || 0))) + 1;
for (const [name, columnType, dataType, comment] of physicalDefinitions) {
  let physical = pkg.PhysicalColumns.find((item) => item.TABLE_NAME === 'diy_table' && item.COLUMN_NAME === name);
  if (!physical) {
    physical = { TABLE_NAME: 'diy_table', COLUMN_NAME: name, ORDINAL_POSITION: nextOrdinal++ };
    pkg.PhysicalColumns.push(physical);
  }
  Object.assign(physical, {
    COLUMN_TYPE: columnType,
    DATA_TYPE: dataType,
    IS_NULLABLE: 'YES',
    COLUMN_DEFAULT: null,
    COLUMN_COMMENT: comment,
    COLUMN_KEY: '',
    EXTRA: '',
  });
}

const ddl = pkg.DDLStatements.find((item) => String(item.TableName).toLowerCase() === 'diy_table');
if (!ddl) throw new Error('缺少 diy_table DDL');
for (const [name, columnType, , comment] of physicalDefinitions) {
  const ddlType = columnType === 'int(11)' ? 'int' : columnType;
  if (ddl.DDL.includes(`\`${name}\``)) continue;
  const closeIndex = ddl.DDL.lastIndexOf('\n) ENGINE');
  if (closeIndex < 0) throw new Error('无法定位 diy_table DDL 结束位置');
  const before = ddl.DDL.slice(0, closeIndex).replace(/,?\s*$/u, '');
  const after = ddl.DDL.slice(closeIndex);
  ddl.DDL = `${before},\n  \`${name}\` ${ddlType} NULL COMMENT '${comment.replaceAll("'", "''")}'${after}`;
}

pkg.PackageInfo.Version = maxVersion(pkg.PackageInfo.Version, 'v7.5.1');
pkg.PackageInfo.Description = '表单引擎基础资源。工作台与分组、标题说明和记录切换均使用 diy_table 物理属性；表后端 V8 事件统一使用正向 V8Limit。';
const historyLine = '2026-08-21 v7.5.1 将表单工作台配置迁移为 diy_table 物理属性并新增两个属性 Tab；TabsPosition 默认 top；新增正向 V8Limit，隐藏旧 FormPresentation/V8Unlimited 兼容字段。';
if (!String(pkg.PackageInfo.ChangeHistory || '').includes(historyLine)) {
  pkg.PackageInfo.ChangeHistory = `${historyLine}\n${pkg.PackageInfo.ChangeHistory || ''}`.trim();
}
pkg.PackageInfo.RequiredPlatformCapabilities = [...new Set([
  ...(pkg.PackageInfo.RequiredPlatformCapabilities || []),
  'ServerField:DiyTable.V8Limit',
  'ServerFeature:DiyTablePresentationPhysicalFields',
])];
pkg.PackageInfo.FieldCount = pkg.DiyFields.length;
pkg.PackageInfo.DDLCount = pkg.DDLStatements.length;
pkg.PackageInfo.PhysicalColumnCount = pkg.PhysicalColumns.length;

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  packagePath,
  version: pkg.PackageInfo.Version,
  fieldCount: pkg.PackageInfo.FieldCount,
  physicalColumnCount: pkg.PackageInfo.PhysicalColumnCount,
  tabs: JSON.parse(table.Tabs).map((item) => item.Name),
}, null, 2));
