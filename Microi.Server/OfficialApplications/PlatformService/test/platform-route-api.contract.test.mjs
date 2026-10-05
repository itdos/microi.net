import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('platform routes select all source components and preserve their API contracts', () => {
  const routes = JSON.parse(read('microi.routes.json'));
  const main = read('src/main.js');
  const tenant = read('src/CreateSaasTenant.vue');
  const tenantUpgrade = read('src/TenantDatabaseUpgrade.vue');
  const installer = read('src/OfflinePackageInstaller.vue');
  const backup = read('src/DatabaseBackup.vue');
  const personalSettings = read('src/PersonalSettings.vue');
  const observability = read('src/SystemObservability.vue');
  const observabilityTable = read('src/components/ObservabilityTable.vue');
  const marketplace = read('src/Marketplace.vue');

  assert.deepEqual(routes.map(route => route.path), [
    '/create-empty-tenant',
    '/tenant-database-upgrade',
    '/app-store-data-selector',
    '/app-package-selector',
    '/offline-package-installer',
    '/database-backup',
    '/personal-settings',
    '/system-settings',
    '/system-observability',
    '/marketplace',
    '/platform-ops',
    '/platform-reminders',
    '/saas-promotion',
    '/saas-trial'
  ]);
  const observabilityRoute = routes.find(route => route.path === '/system-observability');
  assert.deepEqual(observabilityRoute.legacyMenuUrls, ['/syslog', '/mic-system-monitor']);
  assert.equal(observabilityRoute.retireLegacyMenus, true);
  for (const component of [
    'CreateSaasTenant',
    'TenantDatabaseUpgrade',
    'AppStoreDataSelector',
    'AppPackageSelector',
    'OfflinePackageInstaller',
    'DatabaseBackup',
    'PersonalSettings',
    'SystemSettings',
    'SystemObservability',
    'Marketplace',
    'PlatformOps',
    'PlatformReminders',
    'SaasPromotion',
    'SaasPublicTrial'
  ]) assert.match(main, new RegExp(`import ${component} from`));
  const publicTrial = routes.find(route => route.path === '/saas-trial');
  assert.equal(publicTrial.RouteMetaJson.Anonymous, true);
  assert.equal(publicTrial.SourceFile, 'src/SaasPublicTrial.vue');
  assert.equal(routes.find(route => route.path === '/saas-promotion').RouteMetaJson?.Anonymous, undefined);
  assert.match(main, /createApp,\s*h,\s*nextTick,\s*shallowRef/);
  assert.match(main, /const activeRoute = shallowRef\(readRoute\(hostData\)\)/);
  assert.match(main, /h\(resolveRootComponent\(activeRoute\.value\),\s*\{ key: activeRoute\.value, initialSection:/);
  assert.match(main, /initialSection: activeRoute\.value\.includes\('xiaoxitongzhisz'\) \? 'Business'/);
  assert.equal(routes.find(route=>route.path==='/platform-reminders').title,'消息通知');
  assert.deepEqual(routes.find(route=>route.path==='/platform-reminders').legacyMenuUrls,['/xiaoxitongzhisz']);
  assert.match(main, /window\.microApp\?\.addDataListener\?\.\(handleHostData\)/);
  assert.match(main, /activeRoute\.value = nextRoute/);
  assert.match(main, /window\.location\.pathname/);
  assert.match(main, /requestAnimationFrame\(\(\)\s*=>\s*requestAnimationFrame\(notifyHostReady\)\)/);
  assert.match(main, /window\.addEventListener\('mounted',\s*scheduleHostReady/);
  assert.match(main, /rendered,/);

  const microi = read('src/microi.js');
  assert.match(microi, /microApp\.forceDispatch\(payload\)[\s\S]*?return true/);
  assert.match(microi, /webBase:\s*data\.webBase\s*\|\|\s*data\.WebBase/);
  assert.match(microi, /return false/);

  assert.match(tenant, /ApiEngineKey:\s*'admin_create_empty_saas_tenant'/);
  assert.match(tenant, /Action:\s*'Detail'/);
  assert.match(tenant, /Action:\s*'Cancel'/);
  assert.match(tenant, /BeforeVersion/);
  assert.match(tenant, /uploadTenantDatabaseZip/);
  assert.match(tenant, /onProgress:\s*applyUploadProgress/);
  assert.match(tenant, /暂停上传/);
  assert.match(tenant, /默认支持 500MB/);
  assert.match(tenant, /服务端心跳/);
  assert.match(tenant, /heartbeatNow\.value\s*=\s*Date\.now\(\)/);
  assert.match(tenant, /taskLogLines/);
  assert.match(tenant, /lines\.slice\(-200\)/);
  assert.match(tenant, /RuntimeApiBase:\s*runtimeLaunchContext\.apiBase/);
  assert.match(tenant, /RuntimeWebBase:\s*runtimeLaunchContext\.webBase/);
  assert.match(tenant, /PendingExternalBinding|tenantLaunchProjection/);
  assert.match(tenant, /不代表已绑定/);
  const sdk = read('src/utils/microi.v8.js');
  assert.match(sdk, /InitiateTenantDatabaseUpload/);
  assert.match(sdk, /UploadTenantDatabasePart/);
  assert.match(sdk, /GetTenantDatabaseUploadStatus/);
  assert.match(sdk, /CompleteTenantDatabaseUpload/);
  assert.match(sdk, /application\/octet-stream/);
  assert.match(sdk, /sha256HexBlob/);
  assert.match(tenantUpgrade, /TargetApiEngineKey:\s*'admin_upgrade_saas_tenant_database'/);
  assert.match(tenantUpgrade, /Action:\s*'Detail'/);
  assert.match(tenantUpgrade, /Action:\s*'Cancel'/);
  assert.match(tenantUpgrade, /ServerVersion/);
  assert.match(tenantUpgrade, /AlreadyCurrent/);
  assert.doesNotMatch(tenant, /DbConn|DbReadConn/);
  assert.doesNotMatch(tenantUpgrade, /DbConn|DbReadConn|Password\s*:/);
  assert.match(installer, /ApiEngineKey:\s*'import-microi-store-package'/);
  assert.match(backup, /\/api\/V8Engine\/GetDatabaseBackupSettings/);
  assert.match(backup, /\/api\/V8Engine\/SaveDatabaseBackupSettings/);
  assert.match(backup, /\/api\/V8Engine\/RunDatabaseBackup/);
  assert.match(backup, /FormEngineKey:'mci_database_backup'/);
  assert.match(backup, /\/apiengine\/database-backup-download/);
  assert.match(backup, /window\.open\('about:blank', '_blank'\)/);
  assert.match(backup, /downloadWindow\.location\.replace\(url\.href\)/);
  assert.doesNotMatch(backup, /window\.location\.(?:href|assign|replace)\s*[=(]/);
  assert.doesNotMatch(backup, /anchor\.download/);
  assert.match(personalSettings, /terminalData\?\.Terminals/);
  assert.match(personalSettings, /item\.ConnectionId\s*\|\|\s*item\.DeviceClientId/);

  assert.match(observability, /\/apiengine\/mci-system-observability-query/);
  assert.match(observability, /\/apiengine\/mci-system-observability-action/);
  assert.match(observability, /const tabs = \[\{key:'logs',label:'系统日志'/);
  assert.match(observability, /const activeTab = ref\('logs'\)/);
  for (const label of ['日志总数', '错误日志', '警告日志', '慢 SQL', '慢执行', '异常', '日志类型']) {
    assert.match(observability, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(observability, /日志详情/);
  assert.match(observability, /parsePerformanceSteps/);
  assert.match(observability, /openLogDetail/);
  assert.match(observability, /:page-sizes="\[15,30,50,100,200\]"/);
  assert.match(observabilityTable, /defaultPageSize:\s*\{\s*type:\s*Number,\s*default:\s*15\s*\}/);
  assert.match(observabilityTable, /pageSizes:\s*\{\s*type:\s*Array,\s*default:\s*\(\)\s*=>\s*\[15,\s*30,\s*50,\s*100\]\s*\}/);
  assert.match(observabilityTable, /type="search"/);
  assert.match(observabilityTable, /每页/);
  assert.match(observability, /热点接口/);
  assert.match(observability, /原“安全访问日志、恶意攻击事件、IP 封锁记录”三个菜单的数据管理已合并到这里/);
  assert.match(observability, /CPU \/ 内存趋势/);
  assert.match(observability, /接口引擎调用排行/);
  assert.match(observability, /最近登录用户/);
  assert.match(observability, /完成旧菜单合并/);
  assert.match(observability, /RetireLegacyMenus/);
  assert.match(observability, /网络流量/);
  assert.match(observability, /网卡累计接收/);
  assert.match(observability, /帐号 \/ 匿名/);
  assert.match(observability, /大文件 \/ 可疑传输明细/);
  assert.match(observability, /Action:'TrafficDetails'/);
  assert.match(observability, /NetworkTraffic/);
  assert.match(observability, /TrafficHistory/);
  assert.match(observability, /setGlobalOverlay/);
  assert.match(observability, /obs-two-line/);
  assert.match(observability, /prefers-reduced-motion:reduce/);
  assert.match(observability, /trafficRiskTooltip/);
  assert.match(observabilityTable, /rowClass/);
  assert.match(observability, /subscribeContext\(applyContext/);
  assert.doesNotMatch(observability, /\/api\/systemmonitor\//i);
  assert.doesNotMatch(observability, /\/api\/syslog\/(?:getsyslog|getlogtypes|getsyslogstats|getdockerlogs)/i);
  assert.doesNotMatch(observability, /fetch\s*\(/);
  assert.doesNotMatch(observability, /window\.(?:alert|confirm|prompt)\s*\(/);

  assert.match(marketplace, /const SETTINGS_KEY = 'Marketplace\.Sources'/);
  assert.match(marketplace, /client\.post\('\/api\/MarketplaceSource\/Query'/);
  assert.doesNotMatch(marketplace, /fetch\s*\(/);
  assert.match(marketplace, /ApiBase \+ OsClient/);
  assert.match(marketplace, /每个主租户与子租户都可以发布公开或私有应用/);
  assert.match(marketplace, /Type:'current'/);
  assert.match(marketplace, /Type:'official'/);
  assert.match(marketplace, /currentSource\(\)/);
  assert.match(marketplace, /sameAsCurrent\(effectiveSource\.value\)/);
  assert.match(marketplace, /当前租户不能把应用安装到自身/);
  assert.match(marketplace, /bulk-import-microi-store-packages/);
  assert.match(marketplace, /import-microi-store-package/);
  assert.match(marketplace, /MICROI MARKETPLACE/);
  assert.match(marketplace, /canPreviewApp\(app\)/);
  assert.match(marketplace, /canDevelopApp\(app\)/);
});

test('observability engines keep orchestration in ApiEngine and trusted host atoms minimal', () => {
  const query = read('engines/mci-system-observability-query.js');
  const action = read('engines/mci-system-observability-action.js');
  assert.match(query, /V8\.FormEngine\.GetTableDataCount/);
  assert.match(query, /V8\.FormEngine\.GetTableData\("diy_table"/);
  assert.match(query, /V8\.Method\.GetSystemObservability/);
  assert.match(query, /mci_security_access_log/);
  assert.match(query, /mci_security_attack_event/);
  assert.match(query, /mci_security_ip_block/);
  assert.match(query, /RecentLogins/);
  assert.match(query, /ElapsedMs/);
  assert.match(query, /BlockStartTime/);
  assert.match(query, /action == "LegacyMenus"/);
  assert.match(query, /action == "TrafficHistory"/);
  assert.match(query, /mci_network_traffic_rollup/);
  assert.match(query, /DimensionType/);
  assert.match(query, /01KMQNYHKVGTT7TDSQZ8A9HAFF/);
  assert.match(action, /V8\.Method\.ManageSystemObservability/);
  assert.match(action, /action == "RetireLegacyMenus"/);
  assert.match(action, /V8\.FormEngine\.DelFormData\("sys_menu"/);
  assert.match(action, /NoOp: true/);
  assert.match(action, /RefreshLoginUser/);
  assert.doesNotMatch(query + action, /V8\.Db(?:Read)?\.FromSql/);
  assert.doesNotMatch(query + action, /docker\s+(?:logs|stats)/i);
});

test('marketplace keeps one compact themed first-screen hierarchy', () => {
  const marketplace = read('src/Marketplace.vue');
  const compactStyle = read('src/marketplace-compact.css');

  assert.match(marketplace, /class="hero-metrics"/);
  assert.doesNotMatch(marketplace, /<section\s+class="metrics"/);
  assert.match(marketplace, /<section class="market-toolbar">[\s\S]*?class="market-toolbar__source-context"[\s\S]*?<\/section>/);
  assert.match(marketplace, /import '\.\/marketplace-compact\.css'/);
  assert.match(compactStyle, /\.market-hero\s*\{[\s\S]*?min-height:\s*58px[\s\S]*?background:\s*transparent/);
  assert.match(compactStyle, /\.hero-copy::before\s*\{[\s\S]*?background:\s*var\(--accent-brand\)/);
  assert.match(compactStyle, /\.market-tabs button\.active\s*\{[\s\S]*?background:\s*color-mix/);
  assert.match(compactStyle, /\.market-toolbar__source-context\s*\{[\s\S]*?border-top:\s*1px solid var\(--line\)/);
  assert.match(compactStyle, /@media\s*\(max-width:\s*760px\)/);
  assert.doesNotMatch(compactStyle, /#[0-9a-f]{6}\s*!important/i);
});
