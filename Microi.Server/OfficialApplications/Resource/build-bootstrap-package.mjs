import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
// 发行包保留完整功能；仅此显式清单可进入启动恢复面，不能随平台包新增功能自动膨胀。
export const bootstrapEngines = [
  'platform-os-client-by-domain', 'platform-sys-config', 'platform-lang-bundle',
  'platform-current-user', 'platform-private-file-url', 'platform-sys-user-public-info',
  'platform-login-wallpapers', 'microi-init', 'platform-service-health',
  'platform-runtime-custom-hook', 'platform-sys-user-session',
  'platform_auth_login_event', 'platform_auth_login_hook',
  'platform-sys-menu', 'platform-background-task', 'platform-marketplace-source',
  'platform-marketplace-source-hook', 'platform-tenant-system-settings', 'platform-system-settings-custom-hook',
  'get-microi-store', 'get-microi-store-model',
  'get-microi-store-versions', 'get-microi-store-legacy-route',
  'import-microi-store-package', 'bulk-import-microi-store-packages', 'microi-store-package-storage'
];
export const bootstrapTables = [
  'diy_table', 'diy_field', 'sys_apiengine', 'sys_menu', 'sys_user', 'sys_role',
  'sys_rolelimit', 'sys_dept', 'sys_config', 'sys_osclients', 'diy_lang',
  'mci_system_setting', 'sys_microiservice', 'sys_microiservice_page',
  'sys_microistore', 'sys_microistoreversion', 'sys_microistore_changelog',
  'sys_microistore_package', 'mci_ai_app_file', 'mci_ai_app_version', 'mic_data_version'
];

// SaaS configuration is hydrated from the physical row by OsClient, before the
// form engine runs. Its complete administration UI belongs to the optional SaaS
// application, not to ordinary login or marketplace recovery. Physical columns
// remain intact for historical schemas and compiled entity compatibility.
export const bootstrapPhysicalOnlyTables = ['sys_osclients'];
// SaaS referrals and user invitations are optional application features. Their
// indexes must not block login/marketplace recovery on an older core schema.
export const bootstrapIndexes = [
  'ux_microistore_package_content', 'ix_microistore_package_store_version',
  'ix_microistore_package_status'
];

// The form designer persists defaults for every control in every field.Config.
// Copying unrelated upload/tree/map controls into a Text field costs hundreds of
// KB in the startup package. Keep shared/unknown settings and only remove known
// control-specific settings for a different control; do not infer empty defaults.
const componentConfigPrefixes = [
  ['NumberText', ['NumberText']], ['Textarea', ['Textarea']],
  ['Divider', ['Divider']], ['Text', ['Text']],
  ['DateTime', ['DateTime']], ['AutoNumber', ['AutoNumber']],
  ['ImgUpload', ['ImgUpload']], ['FileUpload', ['FileUpload']],
  ['Upload', ['ImgUpload', 'FileUpload']], ['DevComponent', ['DevComponent']],
  ['TableChild', ['TableChild']], ['Map', ['Map']], ['Button', ['Button']],
  ['Department', ['Department']], ['Cascader', ['Cascader']],
  ['SelectTree', ['SelectTree']], ['CodeEditor', ['CodeEditor']], ['RichText', ['RichText']]
];
const knownComponentConfigKeys = new Set([
  'AutoNumber', 'AutoNumberFields', 'AutoNumberFixed', 'AutoNumberLength',
  'Button', 'Cascader', 'CodeEditor', 'CodeEditorMode', 'DateTimeType', 'Department',
  'DevComponentName', 'DevComponentPath', 'Divider', 'DividerPosition',
  'FileUpload', 'FileUploadLimit', 'FileUploadMultiple', 'FileUploadTips',
  'ImgUpload', 'ImgUploadLimit', 'ImgUploadMultiple', 'ImgUploadTips', 'MapCompany',
  'NumberText', 'NumberTextBtn', 'NumberTextBtnPosition', 'NumberTextMath',
  'NumberTextMax', 'NumberTextMin', 'NumberTextPrecision', 'NumberTextStep',
  'RichText', 'SelectTree', 'TableChild', 'TableChildCallbackField',
  'TableChildFkFieldName', 'TableChildRowClickV8', 'TableChildSysMenuId',
  'TableChildSysMenuName', 'TableChildTableId', 'TextApend', 'TextApendPosition',
  'TextAutocomplete', 'TextIcon', 'TextIconPosition', 'TextShowPassword',
  'Textarea', 'Upload', 'UploadMaxCount'
]);

export function projectBootstrapField(field) {
  const result = structuredClone(field);
  // Composite/custom controls may deliberately reuse another control's settings.
  // Only the elementary controls with an independent value contract are compacted.
  if (!['Text', 'Textarea', 'NumberText', 'DateTime', 'Switch'].includes(field.Component)) return result;
  if (!result.Config || typeof result.Config !== 'string') return result;
  let config;
  try { config = JSON.parse(result.Config); }
  // Older packages can contain a legacy configuration literal with raw V8
  // newlines. This is a size optimization, not a migration of that format.
  catch { return result; }
  if (!config || typeof config !== 'object' || Array.isArray(config)) return result;
  for (const key of Object.keys(config)) {
    if (!knownComponentConfigKeys.has(key)) continue;
    const group = componentConfigPrefixes.find(([prefix]) => key.startsWith(prefix));
    if (group && !group[1].includes(field.Component)) delete config[key];
  }
  result.Config = JSON.stringify(config);
  return result;
}

export function buildBootstrapPackage() {
  const names = ['form-engine', 'module-engine', 'sys_user', 'sys-config', 'saas-engine', 'store'];
  const packages = names.map(name => JSON.parse(fs.readFileSync(path.join(directory, `app.microi.${name}.json`))));
  const store = packages.at(-1);
  const tables = new Map(), engines = new Map(), fields = new Map(), columns = new Map(), ddl = new Map(), tableDdlCandidates = new Map();
  const policies = {};
  for (const pkg of packages) {
    for (const table of pkg.DiyTables || []) {
      if (!bootstrapTables.includes(table.Name.toLowerCase())) continue;
      const tableName = table.Name.toLowerCase();
      const physicalOnly = bootstrapPhysicalOnlyTables.includes(tableName);
      // Omitted UI properties are not retirement instructions: an already
      // installed SaaS application's metadata and tenant settings stay owned by it.
      tables.set(tableName, physicalOnly ? {Id:table.Id, Name:table.Name, Description:table.Description} : structuredClone(table));
      if (!physicalOnly) for (const field of pkg.DiyFields || []) {
        if (field.TableId === table.Id) fields.set(`${tableName}/${field.Name}`, projectBootstrapField(field));
      }
    }
    for (const column of pkg.PhysicalColumns || []) if (bootstrapTables.includes(column.TABLE_NAME.toLowerCase())) columns.set(`${column.TABLE_NAME.toLowerCase()}/${column.COLUMN_NAME}`, column);
    for (const row of pkg.DDLStatements || []) {
      // 门禁转换是可选操作，不能将旧索引或数据冲突扩大为登录和商城启动障碍。
      if (row.ApplicationStreamGateContract === true) continue;
      if (!bootstrapTables.includes(row.TableName.toLowerCase())) continue;
      const index = row.DDL.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+[`\[]?([^`\]\s]+)/i);
      const identity = `${row.TableName.toLowerCase()}/${index ? index[1] : 'table'}`;
      if (index) {
        if (bootstrapIndexes.includes(index[1])) ddl.set(identity, row);
      }
      else {
        const candidates = tableDdlCandidates.get(row.TableName.toLowerCase()) || [];
        candidates.push(row);
        tableDdlCandidates.set(row.TableName.toLowerCase(), candidates);
      }
    }
    for (const engine of pkg.SysApiEngines || []) {
      if (!bootstrapEngines.includes(engine.ApiEngineKey)) continue;
      if (engines.has(engine.ApiEngineKey)) throw Error(`恢复接口存在多个所有者：${engine.ApiEngineKey}`);
      engines.set(engine.ApiEngineKey, engine);
      policies[engine.ApiEngineKey] = pkg.ResourcePolicies.ApiEngines[engine.ApiEngineKey];
    }
  }
  for (const [table, candidates] of tableDdlCandidates) {
    const physical = new Set([...columns.values()].filter(c => c.TABLE_NAME.toLowerCase() === table).map(c => c.COLUMN_NAME.toLowerCase()));
    const compatible = candidates.filter(row => [...row.DDL.matchAll(/(?:^|[,\n(])\s*`([A-Za-z_][A-Za-z0-9_]*)`\s+[A-Za-z]/g)].every(([, name]) => physical.has(name.toLowerCase())));
    if (!compatible.length) throw Error(`恢复表没有与物理列一致的建表契约：${table}`);
    // 历史 UI 分组和按钮不属于物理表；只消费列闭合的现行基础定义。
    ddl.set(`${table}/table`, compatible.at(-1));
  }
  for (const key of bootstrapEngines) if (!engines.has(key)) throw Error(`恢复接口缺失：${key}`);
  for (const name of bootstrapTables) if (!tables.has(name)) throw Error(`恢复表缺失：${name}`);
  const importer = structuredClone(engines.get('import-microi-store-package'));
  importer.ApiV8Code = fs.readFileSync(path.join(directory, 'import-package.js'), 'utf8');
  engines.set('import-microi-store-package', importer);
  // 从完整官方包投影，沿用原接口的资源策略和正文；不制造第二份可编辑业务源码。
  const pkg = {
    PackageInfo: {Name:'启动与应用商城恢复基础', AppId:'app.microi.bootstrap', Version:'v1.0.2',
      ApplicationType:'Platform', IncludeSource:false, RequiredPlatformCapabilities:[]},
    // 空库必须先创建表，再创建独立索引；Map 的收集顺序不代表 DDL 依赖顺序。
    DDLStatements:[...ddl.entries()].filter(([key]) => key.endsWith('/table')).map(([, row]) => row)
      .concat([...ddl.entries()].filter(([key]) => !key.endsWith('/table')).map(([, row]) => row)),
    PhysicalColumns:[...columns.values()],
    DiyTables:[...tables.values()], DiyFields:[...fields.values()],
    SysMenus:store.SysMenus.filter(menu => menu.ModuleEngineKey === 'sys_microistore' || menu.ModuleEngineKey === 'sys_microistore_changelog'),
    SysApiEngines:bootstrapEngines.map(key => engines.get(key)),
    DataSets:[], ScheduleJobs:[],
    ApplicationBundles:structuredClone(store.ApplicationBundles),
    ResourcePolicies:{ApiEngines:policies}
  };
  for (const bundle of pkg.ApplicationBundles) {
    bundle.Routes = bundle.Routes.filter(route => route.RoutePath === '/marketplace');
    const snapshot = JSON.stringify(bundle.Routes);
    bundle.MicroService.RouteSnapshotJson = snapshot;
    bundle.MicroService.RouteSnapshotHash = createHash('sha256').update(snapshot).digest('hex');
    bundle.MicroService.RouteCount = bundle.Routes.length;
  }
  // 空库也须拥有商城菜单的最小祖先链，不携带同级的 SSO/AI/备份等菜单。
  const menus = new Map(packages.flatMap(pkg => pkg.SysMenus || []).map(menu => [menu.Id, menu]));
  for (const menu of [...pkg.SysMenus]) {
    let parent = menu.ParentId;
    const visited = new Set([menu.Id]);
    while (parent && !/^0+$/.test(parent.replaceAll('-', ''))) {
      if (visited.has(parent)) throw Error('商城菜单祖先形成循环');
      visited.add(parent);
      const ancestor = menus.get(parent);
      if (!ancestor) throw Error(`商城菜单祖先缺失：${parent}`);
      if (!pkg.SysMenus.some(item => item.Id === parent)) pkg.SysMenus.unshift(structuredClone(ancestor));
      parent = ancestor.ParentId;
    }
  }
  const tableIds = new Map(pkg.DiyTables.map(table => [table.Name.toLowerCase(), table.Id]));
  for (const [identity, field] of fields) field.TableId = tableIds.get(identity.split('/')[0]);
  return pkg;
}

export function bootstrapOutputs() {
  return new Map([
    ['app.microi.bootstrap.json', `${JSON.stringify(buildBootstrapPackage(), null, 2)}\n`],
    ['import-package.js', fs.readFileSync(path.join(directory, 'import-package.js'), 'utf8')]
  ]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.resolve(directory, '../../Microi.Upgrade/Resource');
  for (const [name, content] of bootstrapOutputs()) {
    const filename = path.join(target, name);
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== content) throw Error(`启动资源漂移，请先重新生成：${name}`);
    } else fs.writeFileSync(filename, content);
  }
  console.log('启动与商城恢复资源一致：2 个文件；可选应用不进入升级程序集。');
}
