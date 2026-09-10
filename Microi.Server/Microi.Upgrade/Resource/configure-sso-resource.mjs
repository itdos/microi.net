import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOfficialApiEnginePolicies } from './official-api-engine-notice.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const resourcePath = path.join(directory, 'app.microi.sso.json');
const pkg = JSON.parse(fs.readFileSync(resourcePath, 'utf8'));
const minimumPackageVersion = 'v7.6.1';

function semanticVersionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(String(value || '').trim());
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function compareSemanticVersions(left, right) {
  const leftParts = semanticVersionParts(left);
  const rightParts = semanticVersionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

const packageVersion = compareSemanticVersions(pkg.PackageInfo?.Version, minimumPackageVersion) >= 0
  ? String(pkg.PackageInfo.Version)
  : minimumPackageVersion;

function mergeChangeHistory(existingHistory) {
  const history = new Map();
  for (const item of Array.isArray(existingHistory) ? existingHistory : []) {
    if (item?.Version) history.set(String(item.Version), item);
  }
  const requiredHistory = [
    { Version: 'v7.6.1', Date: '2026-09-09', Description: '恢复已启用的存量 TokenLogin 配置投影，区分平台 DiyToken 验证与外部身份源；保持禁用连接、未配置 URL Token 和非白名单地址拒绝。' },
    { Version: 'v7.5.9', Date: '2026-08-30', Description: '将原 SsoProtocolGatewayController 的 24 个 OIDC、SAML2、CAS 与登录编排路由全部迁入官方 Managed 接口引擎；新增受控 HTTP 响应与 {OsClient} 路径模板能力，C# 仅保留不可由租户覆盖的协议、安全和票据原子，CreateIfMissing 个性化 Hook 继续归租户维护。' },
    { Version: 'v7.5.8', Date: '2026-08-26', Description: '将所有官方 Managed SSO 接口归一为 Platform 所有权，避免 Upgrade13 重放内置包时被误判为从平台资源降级到普通应用资源。' },
    { Version: 'v7.5.6', Date: '2026-08-25', Description: '统一官方 Managed 接口醒目恢复提示；SSO 安全事件经脱敏白名单调用 CreateIfMissing 租户 Hook，默认 Hook 仅返回成功。' },
    { Version: 'v7.5.2', Date: '2026-08-21', Description: '把连接投影、身份解析、绑定/JIT、角色映射、Claim 投影、审计和存量 Token 登录迁入 Managed 接口引擎；新增 CreateIfMissing 租户 Hook，C# 仅保留可信协议原子。' },
    { Version: 'v7.5.1', Date: '2026-08-21', Description: '补充宿主 SSO API、协议端点和客户端能力要求，防止旧宿主静默安装不可运行的配置包。' },
    { Version: 'v7.5.0', Date: '2026-08-21', Description: '建立双向 OIDC、SAML2、CAS 身份联邦配置模型、分组表单和双端模块视图。' }
  ];
  for (const item of requiredHistory) history.set(item.Version, item);
  return [...history.values()].sort((left, right) => compareSemanticVersions(right.Version, left.Version));
}
const tableId = 'a148a8e0-0a84-406c-b4e1-fdcc01273436';
const menuId = '48a11346-3b52-467a-9a41-86ec3dc6c975';
const engineSourceDirectory = path.resolve(
  directory,
  '..', '..', '..',
  'Microi-V8-Engine',
  'Microi吾码 (api.itdos.com)',
  'iTdos.Product.Internal',
  '接口引擎',
  'SSO身份联邦'
);

const tabs = [
  { Id: 'basic', Name: '基本信息', Sort: 10, _RawName: '基本信息' },
  { Id: 'oidc', Name: 'OIDC', Sort: 20, _RawName: 'OIDC' },
  { Id: 'saml', Name: 'SAML2', Sort: 30, _RawName: 'SAML2' },
  { Id: 'cas', Name: 'CAS', Sort: 40, _RawName: 'CAS' },
  { Id: 'mapping', Name: '账号与权限映射', Sort: 50, _RawName: '账号与权限映射' },
  { Id: 'security', Name: '安全与生命周期', Sort: 60, _RawName: '安全与生命周期' },
  { Id: 'legacy', Name: '兼容模式', Sort: 90, _RawName: '兼容模式' }
];

// name, label, type, component, tab, sort, required, options, description
const specs = [
  ['SsoKey', '连接标识', 'varchar(200)', 'Text', 'basic', 10, true, null, '稳定且唯一，例如 corp-oidc；发布后不要改名。'],
  ['Name', '显示名称', 'varchar(200)', 'Text', 'basic', 20, true, null, '登录页和管理页显示的连接名称。'],
  ['Direction', '集成方向', 'varchar(50)', 'Select', 'basic', 30, true, [['ExternalToMicroi', '外部系统 → 吾码'], ['MicroiToExternal', '吾码 → 外部系统']], '身份源登录吾码，或吾码向第三方提供登录。'],
  ['Protocol', '协议', 'varchar(50)', 'Select', 'basic', 40, true, [['OIDC', 'OpenID Connect'], ['SAML2', 'SAML 2.0'], ['CAS', 'CAS 1.0/2.0/3.0']], '新连接只使用标准协议；LegacyToken 只用于存量兼容。'],
  ['Description', '连接说明', 'varchar(500)', 'Textarea', 'basic', 50, false, null, '说明适用系统、负责人和变更窗口。'],
  ['Icon', '图标', 'varchar(500)', 'Text', 'basic', 60, false, null, '登录入口图标或受控资源地址。'],
  ['Sort', '排序', 'int', 'NumberText', 'basic', 70, false, null, '数字越小越靠前。'],
  ['IsDefault', '默认连接', 'int', 'Switch', 'basic', 80, false, null, '同一方向可指定默认连接。'],

  ['Issuer', 'Issuer', 'varchar(500)', 'Text', 'oidc', 110, false, null, '必须与元数据和 id_token 中的 issuer 完全一致。'],
  ['DiscoveryUrl', 'Discovery 地址', 'varchar(1000)', 'Text', 'oidc', 120, false, null, '优先使用 HTTPS .well-known/openid-configuration。'],
  ['AuthorizationEndpoint', '授权端点', 'varchar(1000)', 'Text', 'oidc', 130, false, null, '仅在不使用 Discovery 时填写。'],
  ['TokenEndpoint', 'Token 端点', 'varchar(1000)', 'Text', 'oidc', 140, false, null, '仅在不使用 Discovery 时填写。'],
  ['UserInfoEndpoint', 'UserInfo 端点', 'varchar(1000)', 'Text', 'oidc', 150, false, null, 'id_token Claim 不足时补充用户资料。'],
  ['JwksUri', 'JWKS 地址', 'varchar(1000)', 'Text', 'oidc', 160, false, null, '用于验证 id_token 签名。'],
  ['EndSessionEndpoint', '退出端点', 'varchar(1000)', 'Text', 'oidc', 170, false, null, '外部身份源的 RP-Initiated Logout 地址。'],
  ['IntrospectionEndpoint', '内省端点', 'varchar(1000)', 'Text', 'oidc', 180, false, null, '需要时记录外部 Token 内省端点。'],
  ['RevocationEndpoint', '撤销端点', 'varchar(1000)', 'Text', 'oidc', 190, false, null, '需要时记录外部 Token 撤销端点。'],
  ['ClientId', 'Client ID', 'varchar(500)', 'Text', 'oidc', 200, false, null, 'OIDC 客户端标识；对外模式下必须唯一。'],
  ['ClientAuthMethod', '客户端认证方式', 'varchar(50)', 'Select', 'oidc', 210, false, [['client_secret_basic', 'client_secret_basic'], ['client_secret_post', 'client_secret_post'], ['none', 'none（公共客户端 + PKCE）']], '机密客户端优先 client_secret_basic。'],
  ['Scopes', '允许 Scope', 'mediumtext', 'Textarea', 'oidc', 220, false, null, '每行一个；OIDC 必须包含 openid，可选 profile、email、roles。'],
  ['RedirectUris', '精确回调地址', 'mediumtext', 'Textarea', 'oidc', 230, false, null, '每行一个绝对 HTTPS URL；服务端精确匹配。'],
  ['PostLogoutRedirectUris', '精确退出回调', 'mediumtext', 'Textarea', 'oidc', 240, false, null, '每行一个绝对 HTTPS URL；服务端精确匹配。'],

  ['EntityId', 'SAML Entity ID', 'varchar(1000)', 'Text', 'saml', 310, false, null, '外部 IdP 或 SP 的精确 Entity ID。'],
  ['MetadataUrl', 'SAML Metadata 地址', 'varchar(1000)', 'Text', 'saml', 320, false, null, '用于交换实体、端点与证书元数据。'],
  ['SingleSignOnUrl', 'Single Sign-On 地址', 'varchar(1000)', 'Text', 'saml', 330, false, null, 'SAML 登录端点。'],
  ['SingleLogoutUrl', 'Single Logout 地址', 'varchar(1000)', 'Text', 'saml', 340, false, null, 'SAML 单点退出端点。'],
  ['AssertionConsumerServiceUrl', 'ACS 地址', 'varchar(1000)', 'Text', 'saml', 350, false, null, '吾码作为 IdP 时登记外部 SP 的精确 ACS。'],

  ['CasServerUrl', 'CAS Server 地址', 'varchar(1000)', 'Text', 'cas', 410, false, null, '外部 CAS 根地址；生产环境必须 HTTPS。'],
  ['CasVersion', 'CAS 版本', 'varchar(50)', 'Select', 'cas', 420, false, [['3.0', 'CAS 3.0'], ['2.0', 'CAS 2.0'], ['1.0', 'CAS 1.0']], '优先 CAS 3.0。'],

  ['SubjectClaim', '主体 Claim', 'varchar(200)', 'Text', 'mapping', 510, false, null, '默认 sub；必须稳定且不能复用。'],
  ['AccountClaim', '账号 Claim', 'varchar(200)', 'Text', 'mapping', 520, false, null, '默认 preferred_username。'],
  ['NameClaim', '姓名 Claim', 'varchar(200)', 'Text', 'mapping', 530, false, null, '默认 name。'],
  ['EmailClaim', '邮箱 Claim', 'varchar(200)', 'Text', 'mapping', 540, false, null, '默认 email。'],
  ['RoleClaim', '角色 Claim', 'varchar(200)', 'Text', 'mapping', 550, false, null, '默认 roles。'],
  ['ClaimMappings', 'Claim 映射 JSON', 'mediumtext', 'CodeEditor', 'mapping', 560, false, null, 'JSON 对象；只映射白名单业务属性。'],
  ['RoleMappings', '角色映射 JSON', 'mediumtext', 'CodeEditor', 'mapping', 570, false, null, '外部角色值到吾码 RoleId 的显式映射。'],
  ['ProvisioningMode', '账号开通策略', 'varchar(50)', 'Select', 'mapping', 580, false, [['BoundOnly', '仅允许已绑定身份'], ['JitCreate', '首次登录自动创建'], ['JitMatch', '按权威账号匹配']], '默认 BoundOnly；JIT 必须配置默认角色和治理流程。'],
  ['JitDefaultRoleIds', 'JIT 默认角色 Id', 'mediumtext', 'Textarea', 'mapping', 590, false, null, '每行一个 RoleId；禁止默认授予平台管理员。'],

  ['ClientSecretSettingKey', 'Client Secret 设置键', 'varchar(200)', 'Text', 'security', 610, false, null, '这里只保存 mci_system_setting 的 Key，绝不填写 Secret 明文。'],
  ['SigningCertificateSettingKey', '签名证书设置键', 'varchar(200)', 'Text', 'security', 620, false, null, '租户签名私钥证书设置键；空值使用自动生成的租户证书。'],
  ['ValidateCertSettingKey', '验签证书设置键', 'varchar(200)', 'Text', 'security', 630, false, null, '外部伙伴公开验签证书在 mci_system_setting 中的 Key。'],
  ['EncryptCertSettingKey', '加密证书设置键', 'varchar(200)', 'Text', 'security', 640, false, null, '断言加密证书在 mci_system_setting 中的 Key。'],
  ['RequireSignedAssertions', '要求签名断言', 'int', 'Switch', 'security', 650, false, null, '生产环境保持开启。'],
  ['EncryptAssertions', '加密 SAML 断言', 'int', 'Switch', 'security', 660, false, null, '启用前必须配置伙伴加密证书。'],
  ['RequirePkce', '要求 PKCE S256', 'int', 'Switch', 'security', 670, false, null, '生产环境保持开启。'],
  ['RequireNonce', '要求 nonce', 'int', 'Switch', 'security', 680, false, null, '生产环境保持开启。'],
  ['ValidateIssuer', '校验 issuer', 'int', 'Switch', 'security', 690, false, null, '生产环境保持开启。'],
  ['ValidateAudience', '校验 audience', 'int', 'Switch', 'security', 700, false, null, '生产环境保持开启。'],
  ['AllowPrivateEndpoint', '允许私网身份端点', 'int', 'Switch', 'security', 710, false, null, '只在受控内网部署显式开启，避免 SSRF。'],
  ['AllowLoopbackRedirectUri', '允许本机 HTTP 回调', 'int', 'Switch', 'security', 720, false, null, '仅开发环境 loopback；公网不可开启。'],
  ['AccessTokenLifetimeMinutes', 'Access Token 分钟', 'int', 'NumberText', 'security', 730, false, null, '范围 5–1440，建议 15。'],
  ['RefreshTokenLifetimeDays', 'Refresh Token 天数', 'int', 'NumberText', 'security', 740, false, null, '范围 1–90，默认 14。']
];

// 长 URL / Entity ID 使用 TEXT 族，避免大量 varchar 在 MySQL 中触发 65,535 字节行上限。
for (const spec of specs) if (spec[2] === 'varchar(1000)') spec[2] = 'mediumtext';

const generatedNames = new Set(specs.map((spec) => spec[0]));
const obsoleteNames = new Set(['ValidationCertificateSettingKey', 'EncryptionCertificateSettingKey']);
const managedNames = new Set([...generatedNames, ...obsoleteNames]);
pkg.DiyFields = pkg.DiyFields.filter((field) => !managedNames.has(field.Name));
pkg.PhysicalColumns = pkg.PhysicalColumns.filter((column) => !(
  column.TABLE_NAME === 'diy_sso' && managedNames.has(column.COLUMN_NAME)
));
const template = pkg.DiyFields.find((field) => field.Name === 'TokenName') || pkg.DiyFields[0];
const byName = new Map();
for (const field of pkg.DiyFields) {
  byName.set(field.Name, field);
  field.Tab = ['ServerSsoApi', 'ClientSsoApi', 'TokenName', 'GetTokenType'].includes(field.Name) ? 'legacy' : 'basic';
  if (field.Name === 'IsEnable') {
    field.Type = 'int';
    field.Component = 'Switch';
    field.Label = '是否启用';
    field.DefaultValue = '1';
    field.Description = '启用后才参与登录入口和协议端点。';
    field.Placeholder = field.Description;
  }
}
const legacyFieldPresentation = {
  ServerSsoApi: ['Text', '兼容旧版后端 TokenLogin 接口；新接入请使用 OIDC、SAML2 或 CAS。'],
  ClientSsoApi: ['Text', '兼容旧版前端跳转接口；新接入请使用标准协议。'],
  TokenName: ['Text', '兼容旧版 URL Token 参数名。'],
  GetTokenType: ['Radio', '兼容旧版 Token 获取方式。'],
  Remark: ['Textarea', '兼容配置备注。']
};
for (const [name, [component, description]] of Object.entries(legacyFieldPresentation)) {
  const field = byName.get(name);
  if (!field) continue;
  field.Component = component;
  field.Description = description;
  field.Placeholder = description;
  if (component === 'Textarea') field.FormWidth = 24;
}

const stableId = (index) => `75000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`;
const selectData = (items) => JSON.stringify((items || []).map(([Key, Value]) => ({ Key, Value })));
const secureDefaultOn = new Set(['RequirePkce', 'RequireNonce', 'ValidateIssuer', 'ValidateAudience', 'RequireSignedAssertions']);
for (let index = 0; index < specs.length; index += 1) {
  const [name, label, type, component, tab, sort, required, options, description] = specs[index];
  const field = { ...template };
  Object.assign(field, {
    Id: stableId(index), TableId: tableId, Name: name, Label: label, Type: type,
    Component: component, Tab: tab, Sort: sort, NotEmpty: required ? 1 : 0,
    Visible: 1, AppVisible: 1, Readonly: 0, Unique: name === 'SsoKey' ? 1 : 0,
    TableWidth: ['Description', 'Scopes', 'RedirectUris', 'PostLogoutRedirectUris'].includes(name) ? 220 : 150,
    Description: description, Placeholder: description,
    Data: component === 'Select' ? selectData(options) : '[]',
    Config: component === 'Select'
      ? JSON.stringify({ DataSource: 'KeyValue', SelectLabel: 'Value', SelectSaveField: 'Key', SelectSaveFormat: 'Text', EnableSearch: false, DataSourceSqlRemote: false })
      : '{}',
    CreateTime: '2026-08-21 06:00:00', UpdateTime: '2026-08-21 06:00:00'
  });
  if (component === 'Textarea' || component === 'CodeEditor') field.FormWidth = 24;
  else delete field.FormWidth;
  if (component === 'Switch') field.DefaultValue = secureDefaultOn.has(name) ? '1' : '0';
  else if (name === 'Sort') field.DefaultValue = '100';
  else if (name === 'AccessTokenLifetimeMinutes') field.DefaultValue = '15';
  else if (name === 'RefreshTokenLifetimeDays') field.DefaultValue = '14';
  else if (name === 'SubjectClaim') field.DefaultValue = 'sub';
  else if (name === 'AccountClaim') field.DefaultValue = 'preferred_username';
  else if (name === 'NameClaim') field.DefaultValue = 'name';
  else if (name === 'EmailClaim') field.DefaultValue = 'email';
  else if (name === 'RoleClaim') field.DefaultValue = 'roles';
  else if (name === 'ClientAuthMethod') field.DefaultValue = 'client_secret_basic';
  else if (name === 'ProvisioningMode') field.DefaultValue = 'BoundOnly';
  else if (name === 'CasVersion') field.DefaultValue = '3.0';
  else delete field.DefaultValue;
  pkg.DiyFields.push(field);
  byName.set(name, field);
}

const table = pkg.DiyTables.find((item) => item.Id === tableId) || pkg.DiyTables[0];
Object.assign(table, {
  Label: 'SSO 身份联邦',
  Description: '双向 OIDC、SAML2、CAS 身份联邦连接与存量 Token 兼容配置',
  Tabs: JSON.stringify(tabs), UpdateTime: '2026-08-21 06:00:00'
});

const newColumns = specs.map((spec, index) => ({
  TABLE_NAME: 'diy_sso', COLUMN_NAME: spec[0], COLUMN_TYPE: spec[2],
  DATA_TYPE: spec[2].replace(/\(.*/, ''), IS_NULLABLE: 'YES', COLUMN_DEFAULT: null,
  COLUMN_COMMENT: spec[1], COLUMN_KEY: spec[0] === 'SsoKey' ? 'UNI' : '', EXTRA: '',
  ORDINAL_POSITION: 13 + index
}));
pkg.PhysicalColumns.push(...newColumns);
const ddl = pkg.DDLStatements.find((item) => item.TableName === 'diy_sso');
const ddlLines = specs.map((spec) => `  \`${spec[0]}\` ${spec[2]} NULL COMMENT '${String(spec[1]).replaceAll("'", "''")}'`);
const baseDdlLines = ddl.DDL.split('\n').filter((line) => {
  const name = /^\s*`([^`]+)`/.exec(line)?.[1];
  return !name || !managedNames.has(name);
});
const closingIndex = baseDdlLines.findIndex((line) => /^\) ENGINE=/.test(line));
if (closingIndex < 1) throw new Error('diy_sso DDL closing line is missing');
baseDdlLines[closingIndex - 1] = baseDdlLines[closingIndex - 1].replace(/,+$/, '');
baseDdlLines.splice(closingIndex, 0, `${baseDdlLines[closingIndex - 1].endsWith(',') ? '' : ','}`);
// The standalone comma line above keeps the rewrite simple; fold it into the previous column.
baseDdlLines.splice(closingIndex, 1);
baseDdlLines[closingIndex - 1] += ',';
baseDdlLines.splice(closingIndex, 0, ...ddlLines.map((line, index) => index < ddlLines.length - 1 ? `${line},` : line));
ddl.DDL = baseDdlLines.join('\n').replace('`IsEnable` varchar(255)', '`IsEnable` int');

const menu = pkg.SysMenus.find((item) => item.Id === menuId) || pkg.SysMenus[0];
const ids = (names) => JSON.stringify(names.map((name) => byName.get(name)?.Id).filter(Boolean));
Object.assign(menu, {
  Name: 'SSO 身份联邦',
  Description: '配置外部系统登录吾码，以及吾码向其它系统提供 OIDC、SAML2、CAS 单点登录',
  TableDiyFieldIds: ids(['Name', 'SsoKey', 'Direction', 'Protocol', 'Issuer', 'ClientId', 'ProvisioningMode', 'IsEnable', 'Sort']),
  SearchFieldIds: ids(['Name', 'SsoKey', 'Direction', 'Protocol', 'Issuer', 'ClientId']),
  SortFieldIds: ids(['Sort', 'UpdateTime']),
  NotShowFields: ids(['Id', 'UserId', 'IsDeleted', 'ServerSsoApi', 'ClientSsoApi', 'TokenName', 'GetTokenType', 'ClientSecretSettingKey', 'SigningCertificateSettingKey', 'ValidateCertSettingKey', 'EncryptCertSettingKey']),
  DefaultOrderBy: 'Sort', TableCellWrap: 1, EnableViewSchema: 1,
  ViewSchemaVersion: '1.0', ViewConfigVersion: 3, UpdateTime: '2026-08-21 06:00:00'
});
menu.SelectFields = menu.TableDiyFieldIds;
menu.PageTabs = JSON.stringify([
  { Id: 'sso-all', Sort: 0, Name: '全部', Icon: 'fas fa-layer-group', IsVisible: true, V8Code: 'V8.SearchSet({});' },
  { Id: 'sso-inbound', Sort: 10, Name: '身份源 → 吾码', Icon: 'fas fa-right-to-bracket', IsVisible: true, V8Code: "V8.SearchSet([{ Name: 'Direction', Value: 'ExternalToMicroi', Type: '=' }]);" },
  { Id: 'sso-outbound', Sort: 20, Name: '吾码 → 外部系统', Icon: 'fas fa-arrow-up-right-from-square', IsVisible: true, V8Code: "V8.SearchSet([{ Name: 'Direction', Value: 'MicroiToExternal', Type: '=' }]);" },
  { Id: 'sso-oidc', Sort: 30, Name: 'OIDC', Icon: 'fas fa-id-card', IsVisible: true, V8Code: "V8.SearchSet([{ Name: 'Protocol', Value: 'OIDC', Type: '=' }]);" },
  { Id: 'sso-saml', Sort: 40, Name: 'SAML2', Icon: 'fas fa-certificate', IsVisible: true, V8Code: "V8.SearchSet([{ Name: 'Protocol', Value: 'SAML2', Type: '=' }]);" },
  { Id: 'sso-cas', Sort: 50, Name: 'CAS', Icon: 'fas fa-ticket', IsVisible: true, V8Code: "V8.SearchSet([{ Name: 'Protocol', Value: 'CAS', Type: '=' }]);" },
  { Id: 'sso-legacy', Sort: 90, Name: '兼容配置', Icon: 'fas fa-clock-rotate-left', IsVisible: true, V8Code: "V8.SearchSet([{ Name: 'SsoKey', Value: null, Type: '=' }]);" }
]);
menu.ViewSchema = JSON.stringify({ Views: [
  { Key: `${menuId}-list`, Scene: 'List', Device: 'PC', Enabled: true, Priority: 20, Layout: {
    Hero: { Eyebrow: 'IDENTITY FEDERATION', Title: 'SSO 身份联邦', Description: '一个控制面管理外部身份源与吾码对外单点登录服务', Metrics: [
      { Key: 'DataCount', Label: '连接总数', Source: 'DataCount', Icon: 'fas fa-network-wired', Tone: 'primary' },
      { Key: 'PageCount', Label: '本页连接', Source: 'PageCount', Icon: 'fas fa-list', Tone: 'info' }
    ] },
    List: { Density: 'Comfortable', Columns: [{ Key: 'identity', Field: 'Name', Lines: [
      { Name: 'SsoKey', Label: '连接标识', Tone: 'info', ShowLabel: true },
      { Name: 'Description', Label: '说明', Tone: 'muted', ShowLabel: false }
    ], TrailingFields: [
      { Name: 'Direction', Label: '方向', Icon: 'fas fa-right-left', Tone: 'primary', DisplayStyle: 'Tag' },
      { Name: 'Protocol', Label: '协议', Icon: 'fas fa-shield-halved', Tone: 'info', DisplayStyle: 'Tag' },
      { Name: 'IsEnable', Label: '状态', Icon: 'fas fa-circle', Tone: 'success', DisplayStyle: 'Tag' }
    ], MinWidth: 360, Align: 'Left' }] }
  } },
  { Key: `${menuId}-card`, Scene: 'Card', Device: 'Mobile', Enabled: true, Priority: 20, Layout: {
    Hero: { Eyebrow: 'IDENTITY FEDERATION', Title: 'SSO 身份联邦', Description: '双向标准协议连接', Metrics: [
      { Key: 'DataCount', Label: '连接总数', Source: 'DataCount', Icon: 'fas fa-network-wired', Tone: 'primary' }
    ] },
    Card: { Preset: 'Business', AvatarField: '', AvatarTextField: 'Name', TitleField: 'Name', AccentField: 'Protocol',
      StatusFields: [{ Name: 'Protocol', Label: '协议', DisplayStyle: 'Tag', Tone: 'primary' }, { Name: 'IsEnable', Label: '状态', DisplayStyle: 'Tag', Tone: 'success' }],
      SubtitleFields: [{ Name: 'SsoKey', Label: '连接标识', Tone: 'info' }], Fields: [{ Name: 'Description', Label: '说明', ShowLabel: true }],
      BottomFields: [{ Name: 'Direction', Label: '方向', Icon: 'fas fa-right-left', Tone: 'info', ShowLabel: true }],
      HideIndex: false, ShowCreateTime: false, ShowUpdateTime: true }
  } }
] });

Object.assign(pkg.PackageInfo, {
  AppId: 'app.microi.sso', Name: 'SSO 身份联邦', Version: packageVersion,
  ApplicationType: 'Platform', CreateTime: '2026-08-21T12:00:00.000Z',
  Description: 'Microi 吾码官方双向 SSO 应用：OIDC、SAML2、CAS 与存量 Token 兼容。全部公开 HTTP 路由、连接投影、JIT/绑定、角色映射、审计与租户 Hook 均由应用接口引擎交付；Microi.net 只保留签名验签、协议编解码、一次性票据和 DiyToken 等不可覆盖的可信原子。',
  RequiredPlatformCapabilities: [
    'ApiEngine:sso_capabilities',
    'ApiEngine:sso_complete_login',
    'ApiEngine:sso_http_begin',
    'ApiEngine:sso_http_oidc_discovery',
    'ApiEngine:sso_http_saml_idp_metadata',
    'ApiEngine:sso_http_cas_login',
    'ApiEngine:ResponseType=HTTP',
    'ApiEngine:TemplateRouteV1',
    'V8.Method.RunSsoProtocol',
    'V8.Method.CreateFederatedUser',
    'V8.Method.CreateSsoLoginTicket',
    'V8.Method.CompleteSsoLogin',
    'V8.Method.RotateSsoClientSecret',
    'ClientFeature:SsoFederationV1'
  ],
  ChangeHistory: mergeChangeHistory(pkg.PackageInfo.ChangeHistory),
  ...(packageVersion === 'v7.6.1' ? { ChangeLog: { Version: 'v7.6.1', Title: '恢复存量平台 Token 自动登录', ChangeType: 'Fix', Content: '恢复已启用的存量 TokenLogin 配置投影，区分平台 DiyToken 验证与外部身份源；保持禁用连接、未配置 URL Token 和非白名单地址拒绝。', ReleaseTime: '2026-09-09 16:30:00' } } : {}),
  FieldCount: pkg.DiyFields.length, PhysicalColumnCount: pkg.PhysicalColumns.length,
  ApiEngineCount: (pkg.SysApiEngines || []).length, DataSetCount: (pkg.DataSets || []).length,
  DataRowCount: 0
});
const engineSpecs = [
  ['75000000-1000-4000-8000-000000000001', 'sso_capabilities', 'SSO 公开能力', '[SSO]公开能力(sso_capabilities).js', 1, 0],
  ['75000000-1000-4000-8000-000000000002', 'sso_legacy_capabilities', 'SSO 存量兼容配置', '[SSO]兼容配置(sso_legacy_capabilities).js', 1, 0],
  ['75000000-1000-4000-8000-000000000003', 'sso_connection_runtime', 'SSO 连接运行时', '[SSO]连接运行时(sso_connection_runtime).js', 0, 1],
  ['75000000-1000-4000-8000-000000000004', 'sso_resolve_federated_identity', 'SSO 外部身份解析', '[SSO]身份解析(sso_resolve_federated_identity).js', 0, 1],
  ['75000000-1000-4000-8000-000000000005', 'sso_protocol_event', 'SSO 协议事件', '[SSO]协议事件(sso_protocol_event).js', 0, 1],
  ['75000000-1000-4000-8000-000000000006', 'sso_event_hook', 'SSO 租户事件扩展', '[SSO]租户事件扩展(sso_event_hook).js', 0, 1],
  ['75000000-1000-4000-8000-000000000007', 'sso_outbound_claims', 'SSO 对外 Claim 投影', '[SSO]对外Claim投影(sso_outbound_claims).js', 0, 1],
  ['75000000-1000-4000-8000-000000000008', 'sso_complete_login', 'SSO 完成登录', '[SSO]完成登录(sso_complete_login).js', 1, 0],
  ['75000000-1000-4000-8000-000000000009', 'sso_rotate_client_secret', 'SSO 轮换 OIDC 客户端密钥', '[SSO]轮换客户端密钥(sso_rotate_client_secret).js', 0, 0],
  ['75000000-1000-4000-8000-000000000010', 'sso_legacy_token_login', 'SSO 存量 Token 登录', '[SSO]存量Token登录(sso_legacy_token_login).js', 1, 0],
  ['75000000-1000-4000-8000-000000000011', 'sso_user_runtime', 'SSO 用户运行时', '[SSO]用户运行时(sso_user_runtime).js', 0, 1],
  ['75000000-2000-4000-8000-000000000001', 'sso_http_begin', 'SSO 发起登录', '[SSO]协议端点-发起登录(sso_http_begin).js', 1, 0, '/api/Sso/Begin', 'Begin'],
  ['75000000-2000-4000-8000-000000000002', 'sso_http_complete_authorization', 'SSO 完成授权', '[SSO]协议端点-完成授权(sso_http_complete_authorization).js', 0, 0, '/api/Sso/CompleteAuthorization', 'CompleteAuthorization'],
  ['75000000-2000-4000-8000-000000000003', 'sso_http_oidc_callback', 'OIDC 登录回调', '[SSO]协议端点-OIDC回调(sso_http_oidc_callback).js', 1, 0, '/api/Sso/OidcCallback', 'OidcCallback'],
  ['75000000-2000-4000-8000-000000000004', 'sso_http_oidc_discovery', 'OIDC Discovery', '[SSO]协议端点-OIDC发现(sso_http_oidc_discovery).js', 1, 0, '/sso/{OsClient}/.well-known/openid-configuration', 'OidcDiscovery'],
  ['75000000-2000-4000-8000-000000000005', 'sso_http_oidc_jwks', 'OIDC JWKS', '[SSO]协议端点-OIDCJWKS(sso_http_oidc_jwks).js', 1, 0, '/sso/{OsClient}/jwks', 'OidcJwks'],
  ['75000000-2000-4000-8000-000000000006', 'sso_http_oidc_authorize', 'OIDC 授权', '[SSO]协议端点-OIDC授权(sso_http_oidc_authorize).js', 1, 0, '/sso/{OsClient}/authorize', 'OidcAuthorize'],
  ['75000000-2000-4000-8000-000000000007', 'sso_http_oidc_token', 'OIDC Token', '[SSO]协议端点-OIDCToken(sso_http_oidc_token).js', 1, 0, '/sso/{OsClient}/token', 'OidcToken'],
  ['75000000-2000-4000-8000-000000000008', 'sso_http_oidc_userinfo', 'OIDC UserInfo', '[SSO]协议端点-OIDC用户信息(sso_http_oidc_userinfo).js', 1, 0, '/sso/{OsClient}/userinfo', 'OidcUserInfo'],
  ['75000000-2000-4000-8000-000000000009', 'sso_http_oidc_introspect', 'OIDC Token 内省', '[SSO]协议端点-OIDC内省(sso_http_oidc_introspect).js', 1, 0, '/sso/{OsClient}/introspect', 'OidcIntrospect'],
  ['75000000-2000-4000-8000-000000000010', 'sso_http_oidc_revoke', 'OIDC Token 撤销', '[SSO]协议端点-OIDC撤销(sso_http_oidc_revoke).js', 1, 0, '/sso/{OsClient}/revoke', 'OidcRevoke'],
  ['75000000-2000-4000-8000-000000000011', 'sso_http_oidc_logout', 'OIDC 退出', '[SSO]协议端点-OIDC退出(sso_http_oidc_logout).js', 1, 0, '/sso/{OsClient}/logout', 'OidcEndSession'],
  ['75000000-2000-4000-8000-000000000012', 'sso_http_cas_callback', 'CAS 登录回调', '[SSO]协议端点-CAS回调(sso_http_cas_callback).js', 1, 0, '/api/Sso/CasCallback', 'CasCallback'],
  ['75000000-2000-4000-8000-000000000013', 'sso_http_cas_login', 'CAS 登录', '[SSO]协议端点-CAS登录(sso_http_cas_login).js', 1, 0, '/cas/{OsClient}/login', 'CasLogin'],
  ['75000000-2000-4000-8000-000000000014', 'sso_http_cas_service_validate', 'CAS 2.0 票据校验', '[SSO]协议端点-CAS2校验(sso_http_cas_service_validate).js', 1, 0, '/cas/{OsClient}/serviceValidate', 'CasServiceValidate'],
  ['75000000-2000-4000-8000-000000000015', 'sso_http_cas_p3_service_validate', 'CAS 3.0 票据校验', '[SSO]协议端点-CAS3校验(sso_http_cas_p3_service_validate).js', 1, 0, '/cas/{OsClient}/p3/serviceValidate', 'CasServiceValidate'],
  ['75000000-2000-4000-8000-000000000016', 'sso_http_cas_validate', 'CAS 1.0 票据校验', '[SSO]协议端点-CAS1校验(sso_http_cas_validate).js', 1, 0, '/cas/{OsClient}/validate', 'CasValidate'],
  ['75000000-2000-4000-8000-000000000017', 'sso_http_cas_logout', 'CAS 退出', '[SSO]协议端点-CAS退出(sso_http_cas_logout).js', 1, 0, '/cas/{OsClient}/logout', 'CasLogout'],
  ['75000000-2000-4000-8000-000000000018', 'sso_http_saml_begin', 'SAML 外部登录发起', '[SSO]协议端点-SAML发起(sso_http_saml_begin).js', 1, 0, '/api/Sso/SamlBegin', 'SamlBegin'],
  ['75000000-2000-4000-8000-000000000019', 'sso_http_saml_acs', 'SAML 外部登录 ACS', '[SSO]协议端点-SAMLACS(sso_http_saml_acs).js', 1, 0, '/api/Sso/SamlAcs', 'SamlAcs'],
  ['75000000-2000-4000-8000-000000000020', 'sso_http_saml_login', 'SAML IdP 登录', '[SSO]协议端点-SAML登录(sso_http_saml_login).js', 1, 0, '/saml/{OsClient}/login', 'SamlLogin'],
  ['75000000-2000-4000-8000-000000000021', 'sso_http_saml_complete', 'SAML IdP 完成授权', '[SSO]协议端点-SAML完成(sso_http_saml_complete).js', 1, 0, '/api/Sso/SamlComplete', 'SamlComplete'],
  ['75000000-2000-4000-8000-000000000022', 'sso_http_saml_idp_metadata', 'SAML IdP Metadata', '[SSO]协议端点-SAMLIdP元数据(sso_http_saml_idp_metadata).js', 1, 0, '/saml/{OsClient}/metadata', 'SamlIdpMetadata'],
  ['75000000-2000-4000-8000-000000000023', 'sso_http_saml_sp_metadata', 'SAML SP Metadata', '[SSO]协议端点-SAMLSP元数据(sso_http_saml_sp_metadata).js', 1, 0, '/saml/{OsClient}/sp/{ConnectionKey}/metadata', 'SamlSpMetadata'],
  ['75000000-2000-4000-8000-000000000024', 'sso_http_saml_logout', 'SAML 退出', '[SSO]协议端点-SAML退出(sso_http_saml_logout).js', 1, 0, '/saml/{OsClient}/logout', 'SamlLogout']
];

// 公开协议端点的 JS 保持极薄：路径、匿名策略和版本属于应用资源；协议编解码、
// 签名验签、一次性票据及 DiyToken 仍由不可覆盖的可信原子负责。
for (const [, key, name, fileName, , , apiAddress, operation] of engineSpecs) {
  if (!operation) continue;
  const source = `/*\n * V8 ApiEngine\n * ApiEngineKey: ${key}\n * Version: v1.0.3\n * Function: ${name}；通过通用 HTTP 响应契约返回协议要求的状态码、响应头与正文。\n */\n\nreturn V8.Method.RunSsoProtocol({\n  Operation: '${operation}',\n  Param: V8.Param\n});\n`;
  fs.writeFileSync(path.join(engineSourceDirectory, fileName), source, 'utf8');
}

// 元数据版本和源码头版本共同参与后端升级门禁。已有 11 个编排引擎也必须随本次
// 协议路由闭包同步升级，避免出现“包版本已更新、源码仍宣称旧契约”的半升级状态。
for (const [, key, , fileName] of engineSpecs) {
  const sourcePath = path.join(engineSourceDirectory, fileName);
  const version = key === 'sso_legacy_capabilities' ? 'v1.0.4' : 'v1.0.3';
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace(/Version:\s*v?\d+\.\d+\.\d+/i, `Version: ${version}`);
  if (!source.includes(`Version: ${version}`)) {
    throw new Error(`SSO 接口引擎源码缺少可升级的版本声明：${key} (${fileName})`);
  }
  fs.writeFileSync(sourcePath, source.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n'), 'utf8');
}

pkg.SysApiEngines = engineSpecs.map(([id, key, name, fileName, allowAnonymous, stopHttp, apiAddress, operation]) => ({
  IsDeleted: 0,
  UserName: '管理员',
  UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
  CreateTime: '2026-08-21 12:00:00',
  Id: id,
  ChangeHistory: (key === 'sso_legacy_capabilities' ? '2026-09-09 16:30:00 v1.0.4 恢复原生 TokenLogin 配置投影并保留安全白名单\n' : '') + `2026-08-30 00:00:00 v1.0.3 将 SSO 公开协议路由全部迁入接口引擎并支持受控 HTTP 响应\n2026-08-25 00:00:00 v1.0.2 增加官方资源策略提示与 SSO 租户 Hook 安全合同\n2026-08-21 12:00:00 v1.0.1 创建接口引擎 ${key}\n`,
  Version: key === 'sso_legacy_capabilities' ? 'v1.0.4' : 'v1.0.3',
  LimitRecursion: 5000,
  LimitMemory: 2048,
  MaxStatements: 100000000,
  Timeout: 120,
  StopHttp: stopHttp,
  EnableLog: 0,
  Category: 'SSO身份联邦',
  Files: '[]',
  AllowAnonymous: allowAnonymous,
  ApiAddress: apiAddress || `/apiengine/${key}`,
  ...(operation ? { ResponseType: 'HTTP' } : {}),
  Lock: 0,
  ApiV8Code: fs.readFileSync(path.join(engineSourceDirectory, fileName), 'utf8').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n'),
  ApiRole: '[]',
  IsEnable: 1,
  ApiEngineKey: key,
  ApiName: name
}));
pkg.DataSets ||= [];
pkg.PackageInfo.ApiEngineCount = pkg.SysApiEngines.length;
pkg.ResourcePolicies = {
  SchemaVersion: 1,
  ApiEngines: Object.fromEntries(engineSpecs.map(([, key]) => [key, {
    Ownership: key === 'sso_event_hook' ? 'Tenant' : 'Platform',
    UpgradePolicy: key === 'sso_event_hook' ? 'CreateIfMissing' : 'Managed'
  }]))
};
normalizeOfficialApiEnginePolicies(pkg, 'app.microi.sso.json');
for (const engine of pkg.SysApiEngines) {
  engine.ApiV8Code = String(engine.ApiV8Code || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n*$/, '\n');
  const spec = engineSpecs.find(([, key]) => key === engine.ApiEngineKey);
  const sourcePath = path.join(engineSourceDirectory, spec[3]);
  if (fs.readFileSync(sourcePath, 'utf8') !== engine.ApiV8Code) {
    fs.writeFileSync(sourcePath, engine.ApiV8Code, 'utf8');
  }
}

fs.writeFileSync(resourcePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ fields: pkg.DiyFields.length, physicalColumns: pkg.PhysicalColumns.length, menus: pkg.SysMenus.length }));
