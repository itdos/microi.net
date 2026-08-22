import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const packagePaths = [path.join(resourceDir, 'app.microi.saas-engine.json')];
if (process.argv.includes('--sync-base')) {
  packagePaths.push(path.join(resourceDir, '.resource-sync-base', 'app.microi.saas-engine.json'));
}

const TARGET_VERSION = 'v7.5.20';
const ACCOUNT_TAB_ID = '01KGFAYTX0QP1F5Q1Z88X5RMVF';
const MORE_TAB_ID = '01KGFAYTX1S0KNYX09JGX71TWH';
const PERSONAL_TAB_ID = '01KGFAYTX109WCP98XJZP395VY';
const IDS = {
  ThemeColor: '97e9cc2f-a544-468c-b885-000000000001',
  ThemeMode: '97e9cc2f-a544-468c-b885-000000000002',
  MenuChildExpandMode: '97e9cc2f-a544-468c-b885-000000000003',
  PersonalHomeGroup: '97e9cc2f-a544-468c-b885-000000000004',
  PersonalThemeGroup: '97e9cc2f-a544-468c-b885-000000000005',
  PersonalDesktopGroup: '97e9cc2f-a544-468c-b885-000000000006',
  UserBasicProfileGroup: '97e9cc2f-a544-468c-b885-000000000007',
  UserAccountSecurityGroup: '97e9cc2f-a544-468c-b885-000000000008',
  UserOrganizationGroup: '97e9cc2f-a544-468c-b885-000000000009',
  UserExternalIdentityGroup: '97e9cc2f-a544-468c-b885-000000000010',
  UserAiUsageGroup: '97e9cc2f-a544-468c-b885-000000000011',
};

function maxVersion(current, target) {
  const parts = value => String(value || '').replace(/^v/i, '').split('.').map(part => Number(part) || 0);
  const left = parts(current);
  const right = parts(target);
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
  const table = pkg.DiyTables.find(item => String(item.Name || '').toLowerCase() === 'sys_user');
  if (!table) throw new Error('SaaS 引擎包缺少 sys_user');

  const fields = pkg.DiyFields.filter(item => item.TableId === table.Id);
  const byName = new Map(fields.map(item => [item.Name, item]));
  const baseConfig = byName.get('Name')?.Config || '{}';
  const radioConfig = keyValueConfig(byName.get('Lang')?.Config || baseConfig);

  const definitions = [
    {
      name: 'ThemeColor', label: '个人主题色', type: 'varchar(25)', component: 'ColorPicker',
      data: [], defaultValue: '', sort: 1310, config: baseConfig,
      description: '当前账号的主题色；留空时跟随系统设置。由框架右上角主题设置和个人中心保存，跨设备恢复。',
    },
    {
      name: 'ThemeMode', label: '个人显示模式', type: 'varchar(25)', component: 'Radio',
      data: [{ Key: 'light', Value: '浅色' }, { Key: 'dark', Value: '深色' }],
      defaultValue: 'light', sort: 1320, config: radioConfig,
      description: '当前账号的浅色/深色模式，保存后换设备登录仍会恢复。',
    },
    {
      name: 'MenuChildExpandMode', label: '个人菜单子级展开方式', type: 'varchar(25)', component: 'Radio',
      data: [
        { Key: 'System', Value: '跟随系统设置' },
        { Key: 'Down', Value: '向下展开' },
        { Key: 'Right', Value: '逐级向右展开' },
      ],
      defaultValue: 'System', sort: 1330, config: radioConfig,
      description: '当前账号可覆盖系统设置中的菜单子级展开方式；System 表示继续跟随租户全局配置。',
    },
  ];

  for (const definition of definitions) {
    const current = byName.get(definition.name) || {};
    Object.assign(current, {
      TableName: 'sys_user', TableId: table.Id, Id: current.Id || IDS[definition.name],
      Name: definition.name, Label: definition.label, Type: definition.type,
      Component: definition.component, Data: JSON.stringify(definition.data), Config: definition.config,
      Tab: PERSONAL_TAB_ID, Sort: definition.sort, DefaultValue: definition.defaultValue,
      Description: definition.description, Visible: 1, AppVisible: 1, Readonly: 0,
      NotEmpty: 0, Unique: 0, InTableEdit: 0, NameConfirm: 1, Encrypt: 0,
      BindRole: '[]', IsLockField: 1, TableWidth: 140,
      CreateTime: current.CreateTime || '2026-08-22 00:00:00',
    });
    delete current.FormWidth;
    if (!byName.has(definition.name)) {
      pkg.DiyFields.push(current);
      byName.set(definition.name, current);
    }
  }

  const groupDefinitions = [
    {
      name: 'UserBasicProfileGroup', label: '基本资料', tab: ACCOUNT_TAB_ID, sort: 100,
      description: '头像、账号、姓名与联系资料', icon: 'fas fa-id-card',
      fields: [['Avatar', 110], ['PublicAvatar', 120], ['No', 130], ['Account', 140], ['Name', 150], ['Email', 160], ['Phone', 170], ['Sex', 180], ['Remark', 190]],
    },
    {
      name: 'UserAccountSecurityGroup', label: '账号属性与状态', tab: ACCOUNT_TAB_ID, sort: 300,
      description: '账号类型、密码、状态与最近登录信息', icon: 'fas fa-user-shield',
      fields: [['UserType', 310], ['Pwd', 320], ['BtnDisplayPwd', 330], ['State', 340], ['PwdEncode', 350], ['LicenseType', 360], ['LastLoginIP', 370], ['LastLoginTime', 380]],
    },
    {
      name: 'UserOrganizationGroup', label: '组织与权限', tab: MORE_TAB_ID, sort: 500,
      description: '租户、组织、角色、岗位与级别信息', icon: 'fas fa-sitemap',
      fields: [['TenantDatabaseQuota', 510], ['TenantId', 520], ['TenantName', 530], ['DeptId', 540], ['DeptName', 550], ['DeptCode', 560], ['DeptIds', 570], ['RoleIds', 580], ['Level', 590], ['Jobs', 600], ['JobLevel', 610]],
    },
    {
      name: 'UserExternalIdentityGroup', label: '外部身份', tab: MORE_TAB_ID, sort: 700,
      description: 'Gitee、飞书、微信与小程序身份绑定', icon: 'fas fa-link',
      fields: [['GiteeUserId', 710], ['GiteeLogin', 720], ['GiteeStarVerified', 730], ['GiteeStarVerifiedAt', 740], ['GiteeStarRepository', 750], ['FeishuUnionId', 760], ['MiniProgramOpenId', 770], ['WxMpId', 780], ['WxAvatar', 790], ['WxNickName', 800], ['WxOpenId', 810]],
    },
    {
      name: 'UserAiUsageGroup', label: 'AI 额度与记录', tab: MORE_TAB_ID, sort: 900,
      description: 'AI Token 额度、消费与充值记录', icon: 'fas fa-robot',
      fields: [['AiTokenUsageRecords', 910], ['AiTokenRechargeRecords', 920]],
    },
    {
      name: 'PersonalHomeGroup', label: '语言与首页', tab: PERSONAL_TAB_ID, sort: 1100,
      description: '界面语言、登录后首页与菜单默认展开状态', icon: 'fas fa-house-user',
      fields: [['Lang', 1110], ['DefaultIndexUrl', 1120], ['OpenTreeMenu', 1130]],
    },
    {
      name: 'PersonalThemeGroup', label: '主题与菜单', tab: PERSONAL_TAB_ID, sort: 1300,
      description: '跨设备同步个人主题和菜单子级展开方式', icon: 'fas fa-palette',
      fields: [['ThemeColor', 1310], ['ThemeMode', 1320], ['MenuChildExpandMode', 1330]],
    },
    {
      name: 'PersonalDesktopGroup', label: '桌面外观', tab: PERSONAL_TAB_ID, sort: 1500,
      description: '桌面模式、背景、随机壁纸、访问历史与任务栏', icon: 'fas fa-desktop',
      fields: [['DesktopType', 1510], ['DesktopBg', 1520], ['RandomDesktopBg', 1530], ['DesktopDockMenu', 1540], ['PageHistory', 1550]],
    },
  ];

  for (const group of groupDefinitions) {
    const current = byName.get(group.name) || {};
    Object.assign(current, {
      TableName: 'sys_user', TableId: table.Id, Id: current.Id || IDS[group.name],
      Name: group.name, Label: group.label, Type: '', Component: 'CollapseGroup',
      Data: '[]', Config: JSON.stringify({ CollapseGroup: {
        DefaultCollapsed: true, ScopeMode: 'UntilNextGroup', Description: group.description,
        Icon: group.icon, Theme: 'primary', ShowFieldCount: true,
      } }),
      Tab: group.tab, Sort: group.sort, Description: group.description,
      Visible: 1, AppVisible: 1, FormWidth: 24, Readonly: 0, NotEmpty: 0,
      Unique: 0, InTableEdit: 0, NameConfirm: 1, Encrypt: 0, BindRole: '[]', IsLockField: 1,
      CreateTime: current.CreateTime || '2026-08-22 00:00:00',
    });
    if (!byName.has(group.name)) {
      pkg.DiyFields.push(current);
      byName.set(group.name, current);
    }
    for (const [fieldName, sort] of group.fields) {
      const field = byName.get(fieldName);
      if (!field) continue;
      field.Tab = group.tab;
      field.Sort = sort;
    }
  }

  const physicalColumns = pkg.PhysicalColumns.filter(item => String(item.TABLE_NAME || '').toLowerCase() === 'sys_user');
  let nextOrdinal = Math.max(0, ...physicalColumns.map(item => Number(item.ORDINAL_POSITION || 0))) + 1;
  for (const definition of definitions) {
    let physical = pkg.PhysicalColumns.find(item => String(item.TABLE_NAME || '').toLowerCase() === 'sys_user' && item.COLUMN_NAME === definition.name);
    if (!physical) {
      physical = { TABLE_NAME: 'sys_user', COLUMN_NAME: definition.name, ORDINAL_POSITION: nextOrdinal++ };
      pkg.PhysicalColumns.push(physical);
    }
    Object.assign(physical, {
      COLUMN_TYPE: definition.type,
      DATA_TYPE: 'varchar',
      IS_NULLABLE: 'YES',
      COLUMN_DEFAULT: null,
      COLUMN_COMMENT: definition.label,
      COLUMN_KEY: '',
      EXTRA: '',
    });
  }

  const ddl = pkg.DDLStatements.find(item => String(item.TableName || '').toLowerCase() === 'sys_user');
  if (!ddl) throw new Error('SaaS 引擎包缺少 sys_user DDL');
  for (const definition of definitions) {
    if (ddl.DDL.includes(`\`${definition.name}\``)) continue;
    const closeIndex = ddl.DDL.lastIndexOf('\n) ENGINE');
    if (closeIndex < 0) throw new Error('无法定位 sys_user DDL 结束位置');
    const before = ddl.DDL.slice(0, closeIndex).replace(/,?\s*$/u, '');
    const after = ddl.DDL.slice(closeIndex);
    ddl.DDL = `${before},\n  \`${definition.name}\` ${definition.type} NULL COMMENT '${definition.label}'${after}`;
  }

  const info = pkg.PackageInfo || (pkg.PackageInfo = {});
  info.Version = maxVersion(info.Version, TARGET_VERSION);
  const historyLine = '2026-08-22 v7.5.18 新增 sys_user 个人主题色、浅色/深色和菜单子级展开偏好，使用八个 CollapseGroup 归类账号、组织、外部身份、AI 记录与个人设置并支持跨设备恢复。';
  if (!String(info.ChangeHistory || '').includes(historyLine)) {
    info.ChangeHistory = `${historyLine}\n${info.ChangeHistory || ''}`;
  }
  info.RequiredPlatformCapabilities = [...new Set([
    ...(info.RequiredPlatformCapabilities || []),
    'ApiEngine:platform-user-update-preferences',
    'ClientFeature:PerUserVisualPreferences',
  ])];
  info.FieldCount = pkg.DiyFields.length;
  info.PhysicalColumnCount = pkg.PhysicalColumns.length;
  info.DDLCount = pkg.DDLStatements.length;

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    packagePath,
    version: info.Version,
    fields: definitions.map(item => item.name),
    groups: groupDefinitions.map(item => item.name),
    fieldCount: info.FieldCount,
    physicalColumnCount: info.PhysicalColumnCount,
  }, null, 2));
}

packagePaths.forEach(configurePackage);
