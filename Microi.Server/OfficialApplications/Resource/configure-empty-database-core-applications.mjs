import fs from 'node:fs';
import {createHash} from 'node:crypto';

// This changes the SQL generator for a new isolated template, never a live
// tenant's installed applications. Runtime bootstrap is separately projected.
const file = new URL('./app.microi.saas-engine.json', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const engine = pkg.SysApiEngines.find(item => item.ApiEngineKey === 'admin_get_empty_database_sanitization_sql');
if (!engine) throw new Error('Empty-database generator is missing');
const keys = ['app.microi.bootstrap', 'app.microi.store', 'app.microi.form-engine',
  'app.microi.module-engine', 'app.microi.sys-config', 'app.microi.sys_user'];
const marker = 'EMPTY_DATABASE_CORE_APPLICATIONS_V1';
if (!engine.ApiV8Code.includes(marker)) {
  const begin = engine.ApiV8Code.indexOf('function isCorePlatformApp(app) {');
  const end = engine.ApiV8Code.indexOf('\nfunction collectPackageTableNames', begin);
  if (begin < 0 || end < 0) throw new Error('Core classification boundary changed');
  const replacement = `// ${marker}: new templates retain only login, metadata and marketplace applications.\n`
    + `var corePlatformApplicationKeys = ${JSON.stringify(keys)};\n`
    + `function isCorePlatformApp(app) {\n`
    + `  var appKey = text(app.AppKey).toLowerCase();\n`
    + `  if (appKey === "microi-platform-service") return true;\n`
    + `  var runtimeType = text(app.ApplicationType) || text(app.AppType);\n`
    + `  return runtimeType.toLowerCase() === "platform" && corePlatformApplicationKeys.indexOf(appKey) >= 0;\n}\n`;
  engine.ApiV8Code = engine.ApiV8Code.slice(0, begin) + replacement + engine.ApiV8Code.slice(end);
  const broadPredicate = /LOWER\(COALESCE\(AppKey, ''\)\) LIKE 'app\.microi\.%'\s+OR LOWER\(COALESCE\(AppKey, ''\)\) = 'microi-wechat-content-security'/;
  if (!broadPredicate.test(engine.ApiV8Code)) throw new Error('SQL classification boundary changed');
  engine.ApiV8Code = engine.ApiV8Code.replace(broadPredicate,
    "LOWER(COALESCE(AppKey, '')) IN (${corePlatformApplicationKeys.map(sqlLiteral).join(', ')})");
  engine.ApiV8Code = engine.ApiV8Code.replace('Version: v1.6.5', 'Version: v1.6.6')
    .replace('清理业务应用，完整保留官方平台应用', '清理可选应用，仅保留登录与商城核心应用');
  engine.Version = 'v1.6.6';
  pkg.PackageInfo.Version = 'v8.4.34';
  const content = '新空库仅保留应用商城、表单引擎、模块引擎、系统设置和系统账号等启动核心资源；可选平台应用由用户从商城安装。SQL 生成阶段保持只读，不卸载既有租户应用。';
  pkg.PackageInfo.ChangeHistory = '2026-10-20 v8.4.34 ' + content + '\n' + pkg.PackageInfo.ChangeHistory;
  pkg.PackageInfo.ChangeLog = {Version:'v8.4.34', Title:'缩小新空库默认平台应用范围', ChangeType:'Improvement', Content:content, ReleaseTime:'2026-10-20 01:23:00'};
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}
console.log(JSON.stringify({version:pkg.PackageInfo.Version,engineVersion:engine.Version,
  sourceSha256:createHash('sha256').update(engine.ApiV8Code).digest('hex')}));
