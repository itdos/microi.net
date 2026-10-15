import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectMonotonicPackageVersion } from './package-version-monotonic.mjs';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const releaseTime = '2026-10-13 12:00:00';
const fieldDefinitions = [
  {
    name: 'MicroiLoginEnabled', id: '01M3VQ00000000000000000001', label: '启用 Microi 登录', sort: 1715, prototype: 'GiteeLoginEnabled',
    description: '允许通过吾码官方账号登录已绑定的本地账号；先在官方登记本部署独立的公共客户端和精确回调，再在安全与服务接入配置 ClientId。使用 PKCE，无需 ClientSecret。',
  },
  {
    name: 'DisableLoginMicroi', id: '01M3VQ00000000000000000002', label: '关闭Microi登录入口', sort: 1815, prototype: 'DisableLoginGitee',
    description: '默认显示 Microi 登录入口；显式开启此负向开关后隐藏入口。显示入口不代表能力已经启用或客户端已经登记。',
  },
];

const settingTemplate = (suffix, value, description, sort, id) => ({
  Id: id, CreateTime: releaseTime, IsDeleted: 0,
  ConfigKey: `Login.Microi.${suffix}`, ConfigValue: value, ValueType: 'String',
  Category: '安全与服务接入', Description: description,
  IsPublic: 0, IsSecret: 0, IsEnabled: 0, Sort: sort, ValueSource: 'OfficialDefault',
});

// 仅交付空客户端模板；每个部署的 ClientId 和官方精确回调登记都由该部署单独维护。
// Microi 为 PKCE 公共客户端，不能生成或分发公共 ClientSecret。
export const microiLoginSettingTemplates = Object.freeze([
  settingTemplate('ClientId', '', '本部署在吾码官方登记的独立公共 Client ID（AuthMethod=none，PKCE S256）', 300, '01M3VQ00000000000000000011'),
  settingTemplate('Scope', 'openid profile email', 'Microi OIDC 授权范围；必须包含 openid', 301, '01M3VQ00000000000000000012'),
  settingTemplate('Name', 'Microi 登录', 'Microi 登录入口显示名称', 302, '01M3VQ00000000000000000013'),
  settingTemplate('Description', '使用已绑定的吾码官方账号安全登录', 'Microi 登录入口说明', 303, '01M3VQ00000000000000000014'),
]);

function hideSwitchSort(pkg, table, prototype, fallback) {
  const fields = pkg.DiyFields.filter(item => item.TableId === table.Id && item.Tab === prototype.Tab);
  const loginGroup = fields.find(item => item.Name === 'InterfaceLoginExperienceGroup' && item.Component === 'CollapseGroup');
  if (!loginGroup) throw new Error('Microi 登录资源缺少登录入口分组');
  const start = Number(loginGroup.Sort);
  const nextGroup = fields.filter(item => item.Component === 'CollapseGroup' && Number(item.Sort) > start)
    .sort((left, right) => Number(left.Sort) - Number(right.Sort))[0];
  const end = nextGroup ? Number(nextGroup.Sort) : Infinity;
  const giteeHide = fields.find(item => item.Name === 'DisableLoginGitee');
  // 独立系统设置与 SaaS 空库的既有布局区间不同；只移动本字段，不改写其它分组。
  const preferred = [giteeHide ? Number(giteeHide.Sort) + 10 : NaN, fallback, start + 15, start + 1];
  const sort = preferred.find(value => Number.isFinite(value) && value > start && value < end);
  if (sort === undefined) throw new Error('Microi 登录入口分组没有可用排序区间');
  return sort;
}

function configureFields(pkg, prototypes) {
  const table = pkg.DiyTables.find(item => item.Name.toLowerCase() === 'sys_config');
  if (!table) throw new Error('Microi 登录资源缺少 sys_config 表');
  const ddl = pkg.DDLStatements.find(item => item.TableName.toLowerCase() === 'sys_config' && /CREATE\s+TABLE/i.test(item.DDL));
  if (!ddl) throw new Error('Microi 登录资源缺少 sys_config 建表声明');
  let ordinal = Math.max(0, ...pkg.PhysicalColumns.filter(item => item.TABLE_NAME.toLowerCase() === 'sys_config').map(item => Number(item.ORDINAL_POSITION) || 0));
  for (const definition of fieldDefinitions) {
    const prototype = pkg.DiyFields.find(item => item.TableId === table.Id && item.Name === definition.prototype) || prototypes.get(definition.prototype);
    if (!prototype) throw new Error(`Microi 登录资源缺少系统设置开关原型：${definition.prototype}`);
    let field = pkg.DiyFields.find(item => item.TableId === table.Id && item.Name === definition.name);
    if (!field) {
      field = { ...structuredClone(prototype), Id: definition.id, CreateTime: releaseTime };
      pkg.DiyFields.push(field);
    } else {
      const identity = { Id: field.Id, CreateTime: field.CreateTime };
      Object.assign(field, structuredClone(prototype), identity);
    }
    Object.assign(field, {
      TableName: table.Name, TableId: table.Id, Name: definition.name, Label: definition.label,
      Type: 'int', Component: 'Switch', DefaultValue: '0', Visible: 1, AppVisible: 1,
      Sort: definition.name === 'DisableLoginMicroi' ? hideSwitchSort(pkg, table, prototype, definition.sort) : definition.sort,
      Tab: prototype.Tab, Description: definition.description, NotEmpty: 0,
    });
    delete field.FormWidth;
    let physical = pkg.PhysicalColumns.find(item => item.TABLE_NAME.toLowerCase() === 'sys_config' && item.COLUMN_NAME === definition.name);
    if (!physical) {
      physical = { TABLE_NAME: 'sys_config', COLUMN_NAME: definition.name, ORDINAL_POSITION: ++ordinal };
      pkg.PhysicalColumns.push(physical);
    }
    Object.assign(physical, {
      COLUMN_TYPE: 'int(11)', DATA_TYPE: 'int', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null,
      COLUMN_COMMENT: definition.label, COLUMN_KEY: '', EXTRA: '',
    });
    if (!ddl.DDL.includes(`\`${definition.name}\``)) {
      const close = ddl.DDL.lastIndexOf('\n)');
      if (close < 0) throw new Error('无法定位 sys_config 建表声明结束位置');
      ddl.DDL = `${ddl.DDL.slice(0, close).replace(/,?\s*$/, '')},\n  \`${definition.name}\` int NULL COMMENT '${definition.label}'${ddl.DDL.slice(close)}`;
    }
  }
}

function configurePrivateTemplates(pkg) {
  const dataSet = pkg.DataSets.find(item => item.TableName.toLowerCase() === 'mci_system_setting');
  if (!dataSet || dataSet.ConflictPolicy !== 'InsertIfMissing') throw new Error('Microi 登录配置必须按 InsertIfMissing 交付');
  for (const template of microiLoginSettingTemplates) {
    if (!dataSet.Rows.some(item => item.ConfigKey.toLowerCase() === template.ConfigKey.toLowerCase())) {
      dataSet.Rows.push(structuredClone(template));
    }
  }
}

function configureBinding(pkg, source) {
  const key = 'platform-external-login-binding';
  const engine = pkg.SysApiEngines.find(item => item.ApiEngineKey === key);
  if (!engine || pkg.ResourcePolicies.ApiEngines[key]?.UpgradePolicy !== 'Managed') throw new Error('Microi 登录缺少官方托管绑定接口');
  engine.ApiV8Code = source;
  engine.Version = 'v1.1.1';
  const history = '2026-10-14 v1.1.1 本人列表与解绑通过一次性可信宿主调用进入内部引擎，并在租户 Hook 前消费授权；保持 StopHttp、当前用户及绑定归属校验。';
  if (!String(engine.ChangeHistory || '').includes(history)) engine.ChangeHistory = `${history}\n${engine.ChangeHistory || ''}`;
  const capabilities = pkg.PackageInfo.RequiredPlatformCapabilities || [];
  pkg.PackageInfo.RequiredPlatformCapabilities = [...new Set([
    ...capabilities.filter(item => !String(item).startsWith(`ApiEngine:${key}@`)),
    `ApiEngine:${key}@v1.1.1`,
  ])];
}

function configureRelease(pkg, version, content, options = {}) {
  const info = pkg.PackageInfo;
  const selectedVersion = selectMonotonicPackageVersion(info.Version, version);
  // 较新包的发布元数据归其原有功能，不能被历史生成器降级或改写。
  if (selectedVersion === version) {
    info.Version = version;
    const timestamp = options.releaseTime || releaseTime;
    info.ChangeLog = { Version: version, Title: options.title || 'Microi 官方账号登录与绑定', ChangeType: options.changeType || 'Feature', Content: content, ReleaseTime: timestamp };
    const line = `${timestamp.slice(0, 10)} ${version} ${content}`;
    if (Array.isArray(info.ChangeHistory)) {
      if (!info.ChangeHistory.some(item => item.Version === version)) info.ChangeHistory.unshift({ Version: version, Date: timestamp.slice(0, 10), Description: content });
    } else if (!String(info.ChangeHistory || '').split(/\r?\n/).includes(line)) {
      info.ChangeHistory = `${line}\n${info.ChangeHistory || ''}`;
    }
  }
  info.FieldCount = pkg.DiyFields.length;
  info.PhysicalColumnCount = pkg.PhysicalColumns.length;
  info.ApiEngineCount = pkg.SysApiEngines.length;
  info.DataSetCount = pkg.DataSets.length;
  info.DataRowCount = pkg.DataSets.reduce((total, dataSet) => total + (dataSet.Rows?.length || 0), 0);
}

export function configureMicroiLoginPackages(models, bindingSource) {
  const sysConfig = models.get('sys-config');
  const saas = models.get('saas-engine');
  const prototypes = new Map(fieldDefinitions.map(definition => [definition.prototype, sysConfig.DiyFields.find(item => item.Name === definition.prototype)]));
  configureFields(sysConfig, prototypes);
  // SaaS 空库仍快照 sys_config；同步同名声明防止安装顺序造成字段差异。
  configureFields(saas, prototypes);
  configurePrivateTemplates(saas);
  configureBinding(saas, bindingSource);
  configureRelease(sysConfig, 'v8.4.9', '系统设置新增 Microi 登录能力与关闭入口开关，默认不启用；每个部署使用独立公共 ClientId、PKCE S256 与精确官方回调登记，无需 ClientSecret，保留已有租户配置。需同步更新平台前后端。');
  saas.PackageInfo.ServerMinVersion = selectMonotonicPackageVersion(saas.PackageInfo.ServerMinVersion, '8.5.10');
  configureRelease(saas, 'v8.4.23', '修复外部账号列表和解绑被内部 StopHttp 边界阻断；已认证本人由可信宿主建立当前租户的一次性授权，并在租户 Hook 前消费。内部引擎仍禁止 HTTP，保留绑定归属校验，不携带客户端实例或用户绑定。需部署相应后端修复。', { releaseTime: '2026-10-14 14:25:00', title: '外部账号列表与解绑可信调用修复', changeType: 'Fix' });
  return models;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = ['sys-config', 'saas-engine'];
  const models = new Map(names.map(name => [name, JSON.parse(fs.readFileSync(path.join(resourceRoot, `app.microi.${name}.json`), 'utf8'))]));
  configureMicroiLoginPackages(models, fs.readFileSync(path.join(resourceRoot, 'platform-external-login-binding.js'), 'utf8'));
  for (const [name, model] of models) {
    const file = path.join(resourceRoot, `app.microi.${name}.json`);
    const result = `${JSON.stringify(model, null, 2)}\n`;
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== result) throw new Error(`Microi 登录资源漂移：${name}`);
    } else fs.writeFileSync(file, result);
  }
  console.log('Microi 登录声明资源一致：系统设置、SaaS 配置模板与外部身份绑定。');
}
