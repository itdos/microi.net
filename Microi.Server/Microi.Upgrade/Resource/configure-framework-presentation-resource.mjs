import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const packagePaths = [path.join(resourceDir, 'app.microi.saas-engine.json')];
if (process.argv.includes('--sync-base')) {
  packagePaths.push(path.join(resourceDir, '.resource-sync-base', 'app.microi.saas-engine.json'));
}

const SYS_CONFIG_TABLE_ID = 'c8570fa6-c10f-4014-8cb4-4b046e7ba69c';
const INTERFACE_STYLE_TAB_ID = 'f7e10da1-0b96-4624-90ea-07c7e6991b74';
const TARGET_VERSION = 'v7.5.21';
const OBSOLETE_FIELD_NAMES = new Set(['RenderSourceBadgeMode']);

const FIELD_IDS = {
  FrameworkWatermarkEnabled: '6d872b50-ef21-4cf3-8ec0-000000000002',
  FrameworkWatermarkContent: '6d872b50-ef21-4cf3-8ec0-000000000003',
  FrameworkWatermarkDirection: '6d872b50-ef21-4cf3-8ec0-000000000004',
  FrameworkWatermarkOpacity: '6d872b50-ef21-4cf3-8ec0-000000000005',
  FrameworkWatermarkDensity: '6d872b50-ef21-4cf3-8ec0-000000000006',
  FrameworkWatermarkFontSize: '6d872b50-ef21-4cf3-8ec0-000000000007',
  FrameworkPresentationGroup: '6d872b50-ef21-4cf3-8ec0-000000000008',
  InterfaceThemeNavigationGroup: '6d872b50-ef21-4cf3-8ec0-000000000009',
  InterfaceLoginExperienceGroup: '6d872b50-ef21-4cf3-8ec0-000000000010',
};

function maxVersion(current, target) {
  const parse = value => String(value || '').replace(/^v/i, '').split('.').map(part => Number(part) || 0);
  const left = parse(current);
  const right = parse(target);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return current;
    if ((left[index] || 0) < (right[index] || 0)) return target;
  }
  return current || target;
}

function keyValueConfig(source) {
  return JSON.stringify({
    ...JSON.parse(source || '{}'),
    DataSource: 'KeyValue',
    SelectLabel: 'Value',
    SelectSaveField: 'Key',
    SelectSaveFormat: 'Text',
    EnableSearch: false,
  });
}

function configurePackage(packagePath) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const table = pkg.DiyTables.find(item => item.Id === SYS_CONFIG_TABLE_ID || String(item.Name).toLowerCase() === 'sys_config');
  if (!table) throw new Error('SaaS 引擎包缺少 sys_config');

  pkg.DiyFields = pkg.DiyFields.filter(item => item.TableId !== table.Id || !OBSOLETE_FIELD_NAMES.has(item.Name));
  const tableFields = pkg.DiyFields.filter(item => item.TableId === table.Id);
  const byName = new Map(tableFields.map(item => [item.Name, item]));
  const switchConfig = byName.get('DisableAiAssistant')?.Config || '{}';
  const textConfig = byName.get('PageSizes')?.Config || '{}';
  const numberConfig = byName.get('V8NestedApiDepth')?.Config || textConfig;
  const radioConfig = keyValueConfig(byName.get('SysLogoType')?.Config || '{}');

  const definitions = [
    {
      name: 'FrameworkWatermarkEnabled', label: '开启框架水印', type: 'int', component: 'Switch',
      data: [], defaultValue: '0', sort: 1830, config: switchConfig,
      description: '默认关闭；开启后由吾码框架覆盖 100vw × 100vh，包含路由页面和弹层，水印不拦截鼠标、触摸或键盘操作。',
    },
    {
      name: 'FrameworkWatermarkContent', label: '框架水印内容', type: 'varchar(255)', component: 'Text',
      data: [], defaultValue: '$SysTitle$ - $UserName$', sort: 1840, config: textConfig, formWidth: 12,
      placeholder: '默认：$SysTitle$ - $UserName$',
      description: '留空时显示“系统标题 - 用户名”；用户名为空时自动回退为账号，均为空时只显示系统标题，不会输出 undefined/null。支持 $SysTitle$、$SysShortTitle$、$UserName$、$Account$、$Date$、$DateTime$ 及 {{UserName}} 形式。',
    },
    {
      name: 'FrameworkWatermarkDirection', label: '水印方向', type: 'varchar(25)', component: 'Radio',
      data: [
        { Key: 'DiagonalUp', Value: '斜向上' },
        { Key: 'DiagonalDown', Value: '斜向下' },
        { Key: 'Horizontal', Value: '水平' },
      ],
      defaultValue: 'DiagonalUp', sort: 1850, config: radioConfig, formWidth: 12,
      description: '控制水印文字的旋转方向；默认斜向上，兼顾可辨识性与正文可读性。',
    },
    {
      name: 'FrameworkWatermarkOpacity', label: '水印透明度', type: 'int', component: 'NumberText',
      data: [], defaultValue: '30', sort: 1860, config: numberConfig, formWidth: 6,
      description: '百分比；未设置、非法或为 0 时按 30 处理，运行时限制在 1–100。',
    },
    {
      name: 'FrameworkWatermarkDensity', label: '水印密度', type: 'varchar(25)', component: 'Radio',
      data: [
        { Key: 'Compact', Value: '紧密' },
        { Key: 'Comfortable', Value: '舒适' },
        { Key: 'Sparse', Value: '稀疏' },
      ],
      defaultValue: 'Comfortable', sort: 1870, config: radioConfig, formWidth: 12,
      description: '控制重复水印之间的水平和垂直间距；默认舒适密度适合常规后台页面。',
    },
    {
      name: 'FrameworkWatermarkFontSize', label: '水印字号', type: 'int', component: 'NumberText',
      data: [], defaultValue: '14', sort: 1880, config: numberConfig, formWidth: 6,
      description: '单位 px；未设置、非法或为 0 时按 14 处理，运行时限制在 8–72，并自动适配亮色和深色主题。',
    },
  ];

  for (const definition of definitions) {
    const current = byName.get(definition.name) || {};
    const next = {
      ...current,
      TableName: 'Sys_Config',
      AppVisible: 1,
      Tab: INTERFACE_STYLE_TAB_ID,
      Type: definition.type,
      Name: definition.name,
      InTableEdit: 0,
      Unique: 0,
      NameConfirm: 1,
      TableWidth: 140,
      Config: definition.config,
      TableId: table.Id,
      Readonly: 0,
      Encrypt: 0,
      BindRole: '[]',
      Component: definition.component,
      Visible: 1,
      IsLockField: 1,
      Data: JSON.stringify(definition.data),
      Sort: definition.sort,
      NotEmpty: 0,
      Label: definition.label,
      Id: current.Id || FIELD_IDS[definition.name],
      CreateTime: current.CreateTime || '2026-08-22 00:00:00',
      Description: definition.description,
      DefaultValue: definition.defaultValue,
    };
    if (definition.formWidth !== undefined) next.FormWidth = definition.formWidth;
    else delete next.FormWidth;
    if (definition.placeholder) next.Placeholder = definition.placeholder;
    else delete next.Placeholder;
    if (current.Name) Object.assign(current, next);
    else {
      pkg.DiyFields.push(next);
      byName.set(definition.name, next);
    }
  }

  const groupDefinitions = [
    {
      name: 'InterfaceThemeNavigationGroup', label: '主题与导航', sort: 1400,
      description: '主题色、菜单布局、Logo 与页面导航外观', icon: 'fas fa-palette',
      fields: [
        ['ThemeColor', 1410], ['MenuChildExpandMode', 1420], ['MenuBg', 1430], ['TopWidthFull', 1440],
        ['ActiveMenuColor', 1450], ['ActiveMenuBg', 1460], ['SysTitleColor', 1470], ['MenuBackgroundColor', 1480],
        ['MenuWidth', 1490], ['MenuWordColor', 1500], ['SysLogoType', 1510], ['SysLogoHeight', 1520],
        ['MenuBoxShadow', 1530], ['PageSizes', 1540], ['AnonymousDesktop', 1550],
      ],
    },
    {
      name: 'InterfaceLoginExperienceGroup', label: '登录界面与入口', sort: 1600,
      description: '登录遮罩、背景效果与各类安全登录入口', icon: 'fas fa-right-to-bracket',
      fields: [
        ['DisableFormMaskBlur', 1610], ['FormMaskBlur', 1620], ['LoginPasskeyDisplay', 1630], ['DisableLoginPasskey', 1640],
        ['LoginAuthenticatorDisplay', 1650], ['DisableLoginAuthenticator', 1660], ['LoginGiteeDisplay', 1670], ['DisableLoginGitee', 1680],
        ['LoginWeChatDisplay', 1690], ['DisableLoginWeChat', 1700], ['LoginGitHubDisplay', 1710], ['DisableLoginGitHub', 1720],
        ['IsAeroLogin', 1730], ['EnableSystemStyle', 1740],
      ],
    },
    {
      name: 'FrameworkPresentationGroup', label: 'AI 与框架水印', sort: 1800,
      description: 'AI 助手与全屏框架水印', icon: 'fas fa-fingerprint',
      scopeMode: 'FieldCount', fieldCount: 8,
      fields: [
        ['IsShowAiAssistant', 1810], ['DisableAiAssistant', 1820],
        ['FrameworkWatermarkEnabled', 1830], ['FrameworkWatermarkContent', 1840], ['FrameworkWatermarkDirection', 1850],
        ['FrameworkWatermarkOpacity', 1860], ['FrameworkWatermarkDensity', 1870], ['FrameworkWatermarkFontSize', 1880],
      ],
    },
  ];

  for (const group of groupDefinitions) {
    const current = byName.get(group.name) || {};
    const collapseGroupConfig = {
      DefaultCollapsed: true,
      ScopeMode: group.scopeMode || 'UntilNextGroup',
      Description: group.description,
      Icon: group.icon,
      Theme: 'primary',
      ShowFieldCount: true,
    };
    if (collapseGroupConfig.ScopeMode === 'FieldCount') {
      collapseGroupConfig.FieldCount = group.fieldCount || group.fields.length;
    }
    Object.assign(current, {
      TableName: 'Sys_Config', AppVisible: 1, Tab: INTERFACE_STYLE_TAB_ID,
      Type: '', Name: group.name, InTableEdit: 0, Unique: 0, NameConfirm: 1,
      Config: JSON.stringify({ CollapseGroup: collapseGroupConfig }),
      TableId: table.Id, Readonly: 0, Encrypt: 0, BindRole: '[]', Component: 'CollapseGroup',
      Visible: 1, IsLockField: 1, Data: '[]', Sort: group.sort, NotEmpty: 0,
      Label: group.label, Id: current.Id || FIELD_IDS[group.name],
      CreateTime: current.CreateTime || '2026-08-22 00:00:00', Description: group.description,
      DefaultValue: '', FormWidth: 24,
    });
    if (!byName.has(group.name)) {
      pkg.DiyFields.push(current);
      byName.set(group.name, current);
    }
    for (const [fieldName, sort] of group.fields) {
      const field = byName.get(fieldName);
      if (!field) continue;
      field.Tab = INTERFACE_STYLE_TAB_ID;
      field.Sort = sort;
    }
  }

  const physicalDefinitions = definitions.map(definition => [
    definition.name,
    definition.type === 'int' ? 'int(11)' : definition.type,
    definition.type === 'int' ? 'int' : 'varchar',
    definition.label,
  ]);
  pkg.PhysicalColumns = pkg.PhysicalColumns.filter(item => (
    String(item.TABLE_NAME).toLowerCase() !== 'sys_config' || !OBSOLETE_FIELD_NAMES.has(item.COLUMN_NAME)
  ));
  const sysConfigColumns = pkg.PhysicalColumns.filter(item => String(item.TABLE_NAME).toLowerCase() === 'sys_config');
  let nextOrdinal = Math.max(0, ...sysConfigColumns.map(item => Number(item.ORDINAL_POSITION || 0))) + 1;
  for (const [name, columnType, dataType, comment] of physicalDefinitions) {
    let physical = pkg.PhysicalColumns.find(item => String(item.TABLE_NAME).toLowerCase() === 'sys_config' && item.COLUMN_NAME === name);
    if (!physical) {
      physical = { TABLE_NAME: 'sys_config', COLUMN_NAME: name, ORDINAL_POSITION: nextOrdinal++ };
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

  const ddl = pkg.DDLStatements.find(item => String(item.TableName).toLowerCase() === 'sys_config');
  if (!ddl) throw new Error('SaaS 引擎包缺少 sys_config DDL');
  for (const name of OBSOLETE_FIELD_NAMES) {
    ddl.DDL = ddl.DDL.replace(new RegExp('\\n\\s*`' + name + '`[^\\n]*(?:,)?', 'u'), '');
  }
  for (const [name, columnType, , comment] of physicalDefinitions) {
    if (ddl.DDL.includes(`\`${name}\``)) continue;
    const closeIndex = ddl.DDL.lastIndexOf('\n) ENGINE');
    if (closeIndex < 0) throw new Error('无法定位 sys_config DDL 结束位置');
    const before = ddl.DDL.slice(0, closeIndex).replace(/,?\s*$/u, '');
    const after = ddl.DDL.slice(closeIndex);
    const ddlType = columnType === 'int(11)' ? 'int' : columnType;
    ddl.DDL = `${before},\n  \`${name}\` ${ddlType} NULL COMMENT '${comment.replaceAll("'", "''")}'${after}`;
  }

  const info = pkg.PackageInfo || (pkg.PackageInfo = {});
  info.Version = maxVersion(info.Version, TARGET_VERSION);
  const historyLine = '2026-08-22 v7.5.21 将框架来源标识改为框架内置常驻能力并移除“渲染来源标识”配置；菜单微服务标识可手动关闭且可查看源码、路由和运行信息，弹窗标识保持常驻；水印透明度空值或 0 默认回退 30。';
  if (!String(info.ChangeHistory || '').includes(historyLine)) {
    info.ChangeHistory = `${historyLine}\n${info.ChangeHistory || ''}`;
  }
  info.RequiredPlatformCapabilities = [...new Set([
    ...(info.RequiredPlatformCapabilities || []),
    'ClientFeature:FrameworkRenderSourceBadge',
    'ClientFeature:FrameworkWatermark',
  ])];
  info.FieldCount = pkg.DiyFields.length;
  info.DDLCount = pkg.DDLStatements.length;
  info.PhysicalColumnCount = pkg.PhysicalColumns.length;
  info.MenuCount = (pkg.SysMenus || []).length;
  info.TableCount = (pkg.DiyTables || []).length;
  info.ApiEngineCount = (pkg.SysApiEngines || []).length;
  info.DataSetCount = (pkg.DataSets || []).length;
  info.DataRowCount = (pkg.DataSets || []).reduce((total, item) => total + (Array.isArray(item.Rows) ? item.Rows.length : 0), 0);

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    packagePath,
    version: info.Version,
    fields: definitions.map(item => item.name),
    fieldCount: info.FieldCount,
    physicalColumnCount: info.PhysicalColumnCount,
  }, null, 2));
}

packagePaths.forEach(configurePackage);
