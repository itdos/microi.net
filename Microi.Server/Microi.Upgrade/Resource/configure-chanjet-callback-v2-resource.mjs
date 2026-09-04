import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(resourceRoot, 'app.microi.saas-engine.json');
const sourcePath = path.join(resourceRoot, 'platform-chanjet-callback-v2.js');
const previousPackageVersion = 'v7.8.26';
const targetPackageVersion = 'v7.8.27';
const targetEngineVersion = 'v1.0.1';
const releaseTime = '2026-09-04 19:48:00';
const changeContent =
  '纠正畅捷通 V2 回调架构：/api/Message/ReceiveV2 由 Managed HTTP 接口引擎多路由承载，' +
  '后端仅提供固定接口 Key、固定当前租户且不暴露密钥的最小解密校验原子；保留 CreateIfMissing 租户 Hook，旧回调和旧接口引擎不变。';

const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const packageInfo = packageModel.PackageInfo ||= {};
const currentVersion = String(packageInfo.Version || '');
if (![previousPackageVersion, targetPackageVersion].includes(currentVersion)) {
  throw new Error(
    `SaaS 引擎包必须从 ${previousPackageVersion} 生成 ${targetPackageVersion}，` +
    `当前为 ${currentVersion || '<missing>'}`,
  );
}

const managed = packageModel.SysApiEngines?.find(
  (item) => item.ApiEngineKey === 'platform-chanjet-callback-v2',
);
if (!managed) throw new Error('缺少 platform-chanjet-callback-v2。');

packageInfo.Version = targetPackageVersion;
const historyLine = `2026-09-04 ${targetPackageVersion} ${changeContent}`;
const existingHistory = String(packageInfo.ChangeHistory || '');
packageInfo.ChangeHistory = existingHistory.startsWith(historyLine)
  ? existingHistory
  : `${historyLine}\n${existingHistory}`;
packageInfo.ChangeLog = {
  Version: targetPackageVersion,
  Title: '畅捷通 V2 回调回归接口引擎',
  ChangeType: 'BugFix',
  Content: changeContent,
  ReleaseTime: releaseTime,
};

const capabilities = Array.isArray(packageInfo.RequiredPlatformCapabilities)
  ? packageInfo.RequiredPlatformCapabilities
  : [];
packageInfo.RequiredPlatformCapabilities = [...new Set([
  ...capabilities.filter(
    (item) => item !== 'ApiEngine:platform-chanjet-callback-v2@v1.0.0',
  ),
  'V8.Method.DecodeChanjetCallbackV2',
  `ApiEngine:platform-chanjet-callback-v2@${targetEngineVersion}`,
])];

managed.UpdateTime = releaseTime;
managed.StopHttp = 0;
managed.EnableLog = 0;
managed.AllowAnonymous = 1;
managed.Version = targetEngineVersion;
managed.ApiAddress = '/apiengine/platform-chanjet-callback-v2';
managed.ApiRoutes = '/api/Message/ReceiveV2';
managed.ResponseType = 'HTTP';
managed.ApiRemark =
  '公开 HTTP 回调由接口引擎承载；AES/AppKey 校验只调用固定当前租户和固定 ApiEngineKey 的最小 V8 原子，业务写入由租户 Hook 扩展。';
managed.ApiV8Code = fs.readFileSync(sourcePath, 'utf8');
const engineHistoryLine =
  `${releaseTime} ${targetEngineVersion} 移除 Controller 回调入口，改由 Managed HTTP 接口引擎多路由调用租户绑定解密原子。`;
const engineHistory = String(managed.ChangeHistory || '');
managed.ChangeHistory = engineHistory.startsWith(engineHistoryLine)
  ? engineHistory
  : `${engineHistoryLine}\n${engineHistory}`;

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  packageVersion: packageInfo.Version,
  engineVersion: managed.Version,
  apiAddress: managed.ApiAddress,
  apiRoutes: managed.ApiRoutes,
  responseType: managed.ResponseType,
  stopHttp: managed.StopHttp,
  allowAnonymous: managed.AllowAnonymous,
}, null, 2)}\n`);
