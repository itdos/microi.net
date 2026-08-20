#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../../');
const packagePath = resolve(scriptDirectory, 'app.microi.saas-engine.json');
const storePackagePath = resolve(scriptDirectory, 'app.microi.store.json');
const releaseContractPath = resolve(scriptDirectory, 'platform-service-release.json');
const releaseContract = JSON.parse(await readFile(releaseContractPath, 'utf8'));
if (releaseContract?.SchemaVersion !== 1 || releaseContract?.AppKey !== 'microi-platform-service') {
  throw new Error('平台内置微服务发布契约无效');
}
const maxAssetCount = Number(releaseContract?.RuntimeDelivery?.MaxAssetCount || 0);
const maxTotalBytes = Number(releaseContract?.RuntimeDelivery?.MaxTotalBytes || 0);
if (
  releaseContract?.SourceRole !== 'CanonicalReleaseSource'
  || releaseContract?.RuntimeDelivery?.Primary !== 'DatabaseOnly'
  || releaseContract?.RuntimeDelivery?.Mirror !== 'HashVerifiedHdfsOrCdn'
  || maxAssetCount !== 256
  || maxTotalBytes !== 5 * 1024 * 1024
) {
  throw new Error('平台内置微服务发布契约必须固定为唯一源码根、DatabaseOnly 启动产物和哈希校验镜像');
}
const applicationRoot = resolve(repositoryRoot, String(releaseContract.SourceRoot || ''));
const relativeApplicationRoot = relative(repositoryRoot, applicationRoot).replaceAll('\\', '/');
if (!releaseContract.SourceRoot || relativeApplicationRoot.startsWith('../') || relativeApplicationRoot === '..') {
  throw new Error('平台内置微服务唯一源码根必须位于完整开发工作区内');
}
const distRoot = resolve(applicationRoot, 'dist');

const argumentValue = (name, fallback = '') => {
  const prefix = `${name}=`;
  const argument = process.argv.find(value => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
};

const sourcePackageModel = JSON.parse(await readFile(resolve(applicationRoot, 'package.json'), 'utf8'));
const sourcePackageVersion = String(sourcePackageModel?.version || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(sourcePackageVersion)) {
  throw new Error(`唯一源码根 package.json 版本无效：${sourcePackageVersion || '(empty)'}`);
}
const version = argumentValue('--version', `v${sourcePackageVersion}`);
const applicationVersionArgument = argumentValue('--application-version');
const sourceManifestHashOverride = argumentValue('--source-manifest-hash');
const runtimeManifestHashOverride = argumentValue('--runtime-manifest-hash');
const verifyOnly = process.argv.includes('--verify-only');
const requireCleanSource = process.argv.includes('--require-clean-source');
const timestamp = new Date(argumentValue('--timestamp', new Date().toISOString()));
if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error(`无效微服务版本：${version}`);
if (version !== `v${sourcePackageVersion}`) {
  throw new Error(`发布版本必须与唯一源码根 package.json 一致：source=v${sourcePackageVersion}, requested=${version}`);
}
if (Number.isNaN(timestamp.getTime())) throw new Error('时间戳无效');
for (const [label, value] of [
  ['源码清单哈希', sourceManifestHashOverride],
  ['运行清单哈希', runtimeManifestHashOverride],
]) {
  if (value && !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label}必须是 64 位小写 SHA-256`);
}

let sourceGitCommit = '';
if (requireCleanSource) {
  try {
    sourceGitCommit = execFileSync('git', ['-C', applicationRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
    const sourceStatus = execFileSync(
      'git',
      ['-C', applicationRoot, 'status', '--porcelain=v1', '--untracked-files=all', '--', '.'],
      { encoding: 'utf8', windowsHide: true },
    ).trim();
    if (sourceStatus) {
      throw new Error(`唯一源码根仍有未提交修改：\n${sourceStatus}`);
    }
  } catch (error) {
    throw new Error(`无法证明平台内置微服务来自干净的 Git 提交：${error?.message || error}`);
  }
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalizePath = value => value.replaceAll('\\', '/');
const deepClone = value => JSON.parse(JSON.stringify(value));

function replaceByIdentity(target, source, identity) {
  const sourceItems = source.filter(identity);
  const sourceKeys = new Set(sourceItems.map(item => identity(item)));
  const preserved = target.filter(item => !sourceKeys.has(identity(item)));
  return [...preserved, ...deepClone(sourceItems)];
}

function synchronizeStoreRuntimeSchema(storePackage, saasPackage) {
  const requiredTableNames = new Set(['sys_microiservice', 'sys_microiservice_page']);
  const sourceTables = (saasPackage.DiyTables || []).filter(table => requiredTableNames.has(table?.Name));
  if (sourceTables.length !== requiredTableNames.size) {
    throw new Error('SaaS 引擎包缺少 sys_microiservice / sys_microiservice_page 元数据');
  }
  const sourceTableIds = new Set(sourceTables.map(table => String(table.Id || '')));
  const sourceFields = (saasPackage.DiyFields || []).filter(field => (
    requiredTableNames.has(field?.TableName) || sourceTableIds.has(String(field?.TableId || ''))
  ));
  const sourceDdls = (saasPackage.DDLStatements || []).filter(statement => {
    const text = JSON.stringify(statement || '').toLowerCase();
    return text.includes('sys_microiservice');
  });
  if (!sourceFields.length || sourceDdls.length < requiredTableNames.size) {
    throw new Error('SaaS 引擎包的微服务表字段或 DDL 不完整');
  }

  storePackage.DiyTables = replaceByIdentity(
    storePackage.DiyTables || [],
    sourceTables,
    item => String(item?.Name || '').toLowerCase(),
  );
  storePackage.DiyFields = replaceByIdentity(
    storePackage.DiyFields || [],
    sourceFields,
    item => String(item?.Id || `${item?.TableName || ''}:${item?.Name || ''}`).toLowerCase(),
  );
  storePackage.DDLStatements = replaceByIdentity(
    storePackage.DDLStatements || [],
    sourceDdls,
    item => String(item?.Id || item?.TableName || item?.Name || JSON.stringify(item)).toLowerCase(),
  );
}

function refreshPackageCounts(packageModel) {
  const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
  const dataSets = Array.isArray(packageModel.DataSets) ? packageModel.DataSets : [];
  info.MenuCount = (packageModel.SysMenus || []).length;
  info.TableCount = (packageModel.DiyTables || []).length;
  info.FieldCount = (packageModel.DiyFields || []).length;
  info.FlowCount = (packageModel.WorkFlows || packageModel.Workflows || []).length;
  info.NodeCount = (packageModel.WFNodes || packageModel.WorkFlowNodes || []).length;
  info.LineCount = (packageModel.WFLines || packageModel.WorkFlowLines || []).length;
  info.DDLCount = (packageModel.DDLStatements || []).length;
  // 旧数据包没有单独的 PhysicalColumns 数组；此计数由发布器按目标数据库口径
  // 生成，不能在仅同步微服务元数据时误清零。
  if (Array.isArray(packageModel.PhysicalColumns)) {
    info.PhysicalColumnCount = packageModel.PhysicalColumns.length;
  }
  info.ApiEngineCount = (packageModel.SysApiEngines || []).length;
  info.DataSetCount = dataSets.length;
  info.DataRowCount = dataSets.reduce((sum, item) => sum + ((item?.Rows || item?.Data || []).length || 0), 0);
  info.AiApplicationCount = (packageModel.ApplicationBundles || []).length;
  info.IncludeSource = false;
}

async function collectFiles(root, excludedDirectories = new Set()) {
  const output = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) output.push(fullPath);
    }
  }
  await visit(root);
  return output;
}

function contentType(path) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.webp': 'image/webp',
  })[extname(path).toLowerCase()] || 'application/octet-stream';
}

const packageModel = JSON.parse(await readFile(packagePath, 'utf8'));
const storePackageModel = JSON.parse(await readFile(storePackagePath, 'utf8'));
let databaseBackupDialogCount = 0;
for (const menu of packageModel.SysMenus || []) {
  if (!menu.PageBtns) continue;
  let buttons;
  try { buttons = typeof menu.PageBtns === 'string' ? JSON.parse(menu.PageBtns) : menu.PageBtns; }
  catch { continue; }
  if (!Array.isArray(buttons)) continue;
  for (const button of buttons) {
    if (button?.Id !== 'database-backup-page-btn') continue;
    button.V8Code = String(button.V8Code || '')
      .replace(/Width:\s*'[^']*'/, "Width: '80%'")
      .replace("Width: '80%',", "Width: '80%',\n  BodyHeight: 'min(820px, calc(100vh - 160px))',");
    databaseBackupDialogCount++;
  }
  menu.PageBtns = typeof menu.PageBtns === 'string' ? JSON.stringify(buttons) : buttons;
}
if (databaseBackupDialogCount !== 1) {
  throw new Error(`数据库定时备份弹层契约数量异常：${databaseBackupDialogCount}`);
}
const routeDefinitions = JSON.parse(await readFile(resolve(applicationRoot, 'microi.routes.json'), 'utf8'));
const bundle = (packageModel.ApplicationBundles || []).find(
  item => item?.Application?.AppKey === 'microi-platform-service',
);
if (!bundle) throw new Error('SaaS 引擎包中缺少 microi-platform-service');
const applicationVersion = Number(
  applicationVersionArgument || bundle?.Application?.CurrentVersion || 0,
);
if (!Number.isInteger(applicationVersion) || applicationVersion < 1) {
  throw new Error('应用版本号必须为正整数');
}
const embeddedVersion = String(bundle?.VersionNo || '');
const embeddedApplicationVersion = Number(bundle?.Application?.CurrentVersion || 0);
if (!verifyOnly && version !== embeddedVersion && !applicationVersionArgument) {
  throw new Error(`源码版本已从 ${embeddedVersion || '(empty)'} 变为 ${version}；必须显式传 --application-version=<递增整数>`);
}
if (!verifyOnly && version !== embeddedVersion && applicationVersion <= embeddedApplicationVersion) {
  throw new Error(`新源码版本的应用版本号必须大于 ${embeddedApplicationVersion}`);
}

const distFiles = await collectFiles(distRoot);
const buildAssets = [];
for (const fullPath of distFiles) {
  const bytes = await readFile(fullPath);
  const path = normalizePath(relative(distRoot, fullPath));
  buildAssets.push({
    Path: path,
    FileName: basename(path),
    ContentType: contentType(path),
    FileByteBase64: bytes.toString('base64'),
    Size: bytes.length,
    Sha256: sha256(bytes),
  });
}
if (!buildAssets.some(asset => asset.Path === 'index.html')) throw new Error('微服务构建缺少 index.html');
if (buildAssets.length > maxAssetCount) throw new Error(`微服务构建文件数 ${buildAssets.length} 超过 ${maxAssetCount}`);
const totalSize = buildAssets.reduce((sum, asset) => sum + asset.Size, 0);
if (totalSize > maxTotalBytes) throw new Error(`微服务构建大小 ${totalSize} 超过 ${maxTotalBytes} 字节`);

const sourceFiles = await collectFiles(applicationRoot, new Set(['dist', 'node_modules']));
const sourceFingerprint = [];
for (const fullPath of sourceFiles) {
  const bytes = await readFile(fullPath);
  sourceFingerprint.push(`${normalizePath(relative(applicationRoot, fullPath))}:${sha256(bytes)}:${bytes.length}`);
}
const localSourceManifestHash = sha256(sourceFingerprint.join('\n'));
// Keep this byte-for-byte identical to the MCP v3 directory publisher.
const runtimeFingerprint = buildAssets.map(asset => `${asset.Path}\t${asset.Sha256}\t${asset.Size}`);
const localRuntimeManifestHash = sha256(runtimeFingerprint.join('\n'));
const sourceManifestHash = sourceManifestHashOverride || localSourceManifestHash;
const runtimeManifestHash = runtimeManifestHashOverride || localRuntimeManifestHash;
if (sourceManifestHashOverride && sourceManifestHashOverride !== localSourceManifestHash) {
  throw new Error(`源码清单哈希与唯一源码根不一致：expected=${sourceManifestHashOverride}, actual=${localSourceManifestHash}`);
}
if (runtimeManifestHashOverride && runtimeManifestHashOverride !== localRuntimeManifestHash) {
  throw new Error(`运行清单哈希与 dist 不一致：expected=${runtimeManifestHashOverride}, actual=${localRuntimeManifestHash}`);
}
const isoTime = timestamp.toISOString();
const localTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(timestamp);
const manifestAssets = buildAssets.map(asset => ({
  Path: asset.Path,
  FilePathName: `database://microi-platform-service/${version}/${asset.Path}`,
  StableFilePathName: `database://microi-platform-service/${asset.Path}`,
  Sha256: asset.Sha256,
  Size: asset.Size,
  IsEntry: asset.Path === 'index.html',
}));
const runtimeManifest = {
  SchemaVersion: 2,
  MsKey: 'microi-platform-service',
  BuildVersion: version,
  EntryPath: 'index.html',
  StorageMode: 'db',
  PublishStatus: 'Published',
  VerificationStatus: 'Verified',
  RequestId: runtimeManifestHash,
  DeliveryBatchId: `database-${runtimeManifestHash.slice(0, 24)}`,
  SourceManifestHash: sourceManifestHash,
  RuntimeManifestHash: runtimeManifestHash,
  VerifiedAt: isoTime,
  PublishedAt: isoTime,
  Assets: manifestAssets,
};

function assertRelease(condition, message) {
  if (!condition) throw new Error(message);
}

function comparableBuildAssets(assets) {
  return (assets || []).map(asset => ({
    Path: asset.Path,
    FileName: asset.FileName,
    ContentType: asset.ContentType,
    FileByteBase64: asset.FileByteBase64,
    Size: Number(asset.Size),
    Sha256: asset.Sha256,
  }));
}

function comparableManifestAssets(assets) {
  return (assets || []).map(asset => ({
    Path: asset.Path,
    FilePathName: asset.FilePathName,
    StableFilePathName: asset.StableFilePathName,
    Sha256: asset.Sha256,
    Size: Number(asset.Size),
    IsEntry: asset.IsEntry === true,
  }));
}

function validateEmbeddedBundle(candidate, label) {
  assertRelease(candidate?.Application?.AppKey === releaseContract.AppKey, `${label} AppKey 不正确`);
  assertRelease(candidate?.VersionNo === version, `${label} VersionNo 与唯一源码版本不一致`);
  assertRelease(candidate?.Application?.BuildVersion === version, `${label} Application.BuildVersion 不一致`);
  assertRelease(Number(candidate?.Application?.CurrentVersion) === applicationVersion, `${label} Application.CurrentVersion 不一致`);
  assertRelease(candidate?.AssetStoragePolicy?.Source === 'NotIncluded', `${label} 必须声明 Source=NotIncluded`);
  assertRelease(candidate?.AssetStoragePolicy?.Build === 'DatabaseOnly', `${label} 必须声明 Build=DatabaseOnly`);
  assertRelease(candidate?.IncludeSource === false, `${label} 不能携带可编辑源码`);
  assertRelease(candidate?.PackageAssets?.IncludeSource === false, `${label} PackageAssets 不能携带源码`);
  assertRelease(!candidate?.PackageAssets?.SourceZip && !candidate?.PackageAssets?.BuildZip, `${label} 不能保留重复 ZIP 资产`);
  assertRelease((candidate?.SourceFiles || []).length === 0, `${label} SourceFiles 必须为空`);
  assertRelease(candidate?.EntryPath === 'index.html', `${label} 入口必须为 index.html`);
  assertRelease(candidate?.MicroService?.StorageMode === 'db', `${label} StorageMode 必须为 db`);
  assertRelease(candidate?.MicroService?.MsUrl === 'db', `${label} MsUrl 必须为 db`);
  assertRelease(candidate?.MicroService?.BuildVersion === version, `${label} MicroService.BuildVersion 不一致`);
  assertRelease(candidate?.MicroService?.DistHash === localRuntimeManifestHash, `${label} DistHash 与 dist 不一致`);
  assertRelease(Number(candidate?.MicroService?.AssetCount) === buildAssets.length, `${label} AssetCount 不一致`);
  assertRelease(Number(candidate?.MicroService?.TotalSize) === totalSize, `${label} TotalSize 不一致`);
  assertRelease(
    JSON.stringify(comparableBuildAssets(candidate?.BuildAssets)) === JSON.stringify(comparableBuildAssets(buildAssets)),
    `${label} 数据库内联构建资产与唯一源码 dist 不一致`,
  );

  let embeddedManifest;
  try { embeddedManifest = JSON.parse(candidate?.MicroService?.AssetManifestJson || '{}'); }
  catch { throw new Error(`${label} AssetManifestJson 不是有效 JSON`); }
  assertRelease(embeddedManifest?.SchemaVersion === 2, `${label} 运行清单版本不正确`);
  assertRelease(embeddedManifest?.MsKey === releaseContract.AppKey, `${label} 运行清单 MsKey 不正确`);
  assertRelease(embeddedManifest?.BuildVersion === version, `${label} 运行清单版本不一致`);
  assertRelease(embeddedManifest?.StorageMode === 'db', `${label} 运行清单必须使用 db`);
  assertRelease(embeddedManifest?.SourceManifestHash === localSourceManifestHash, `${label} 源码清单哈希已漂移`);
  assertRelease(embeddedManifest?.RuntimeManifestHash === localRuntimeManifestHash, `${label} 运行清单哈希已漂移`);
  assertRelease(
    JSON.stringify(comparableManifestAssets(embeddedManifest?.Assets)) === JSON.stringify(comparableManifestAssets(manifestAssets)),
    `${label} 运行资产清单与唯一源码 dist 不一致`,
  );

  const expectedRoutes = routeDefinitions.map(route => String(route?.path || '').trim());
  const actualRoutes = (candidate?.Routes || []).map(route => String(route?.RoutePath || '').trim());
  assertRelease(JSON.stringify(actualRoutes) === JSON.stringify(expectedRoutes), `${label} 路由与 microi.routes.json 不一致`);
  for (const route of candidate?.Routes || []) {
    assertRelease(route?.BuildVersion === version, `${label} 路由 ${route?.RoutePath || '(unknown)'} 版本不一致`);
    assertRelease(route?.EntryPath === 'index.html', `${label} 路由 ${route?.RoutePath || '(unknown)'} 入口不一致`);
  }
  const marketplaceRoute = (candidate?.Routes || []).find(route => route?.RoutePath === '/marketplace');
  assertRelease(marketplaceRoute?.IsEnable === 1, `${label} 缺少启用的 /marketplace 路由`);
}

function validateReleaseTargets() {
  const configuredTargets = (releaseContract.PackageTargets || []).map(normalizePath);
  const actualTargets = [packagePath, storePackagePath].map(path => normalizePath(relative(repositoryRoot, path)));
  assertRelease(JSON.stringify(configuredTargets) === JSON.stringify(actualTargets), '发布契约的数据包目标与脚本不一致');

  validateEmbeddedBundle(bundle, 'SaaS 引擎包');
  const storeBundles = (storePackageModel.ApplicationBundles || [])
    .filter(item => item?.Application?.AppKey === releaseContract.AppKey);
  assertRelease(storeBundles.length === 1, `应用商城包平台微服务数量异常：${storeBundles.length}`);
  validateEmbeddedBundle(storeBundles[0], '应用商城包');

  const marketplaceMenus = (storePackageModel.SysMenus || []).filter(menu => menu?.Url === '/microi-store');
  assertRelease(marketplaceMenus.length === 1, `应用商城主菜单数量异常：${marketplaceMenus.length}`);
  const marketplaceMenu = marketplaceMenus[0];
  assertRelease(marketplaceMenu?.OpenType === 'MicroService', '应用商城主菜单必须由微服务宿主承载');
  assertRelease(marketplaceMenu?.ComponentPath === '/micro-app/host', '应用商城主菜单宿主路径不正确');
  assertRelease(marketplaceMenu?.MicroServiceKey === releaseContract.AppKey, '应用商城主菜单未绑定平台微服务');
  assertRelease(marketplaceMenu?.MicroServiceRoutePath === '/marketplace', '应用商城主菜单未绑定 /marketplace');
}

if (verifyOnly) {
  validateReleaseTargets();
  process.stdout.write(JSON.stringify({
    verified: true,
    releaseContractPath,
    applicationRoot,
    sourceRole: releaseContract.SourceRole,
    sourceGitCommit,
    version,
    applicationVersion,
    files: buildAssets.length,
    totalSize,
    sourceManifestHash: localSourceManifestHash,
    runtimeManifestHash: localRuntimeManifestHash,
    runtimeDelivery: releaseContract.RuntimeDelivery,
  }, null, 2) + '\n');
  process.exit(0);
}

bundle.VersionNo = version;
bundle.EntryPath = 'index.html';
bundle.IncludeSource = false;
bundle.Application.CurrentVersion = applicationVersion;
bundle.Application.BuildVersion = version;
bundle.PackageAssets.IncludeSource = false;
bundle.PackageAssets.PackageVersion = version;
bundle.PackageAssets.PreparedTime = localTime;
delete bundle.PackageAssets.SourceZip;
delete bundle.PackageAssets.BuildZip;
bundle.MicroService.UpdateTime = localTime;
bundle.MicroService.MsUrl = 'db';
bundle.MicroService.StorageMode = 'db';
bundle.MicroService.BuildVersion = version;
bundle.MicroService.AssetManifestJson = JSON.stringify(runtimeManifest);
bundle.MicroService.AssetsJson = JSON.stringify(manifestAssets);
bundle.MicroService.DistHash = runtimeManifestHash;
bundle.MicroService.AssetCount = buildAssets.length;
bundle.MicroService.TotalSize = String(totalSize);
bundle.MicroService.PublishTime = localTime;
const existingRoutes = new Map((bundle.Routes || []).map(route => [route.RoutePath, route]));
bundle.Routes = routeDefinitions.map(routeDefinition => {
  const routePath = String(routeDefinition.path || '').trim();
  if (!routePath.startsWith('/')) throw new Error(`微服务路由必须以 / 开头：${routePath}`);
  const existing = existingRoutes.get(routePath) || {};
  return {
    Id: existing.Id || sha256(`microi-platform-service:${routePath}`).slice(0, 26).toUpperCase(),
    CreateTime: existing.CreateTime || localTime,
    UpdateTime: localTime,
    UserId: existing.UserId || bundle.MicroService.UserId || bundle.Application.OwnerUserId || '',
    UserName: existing.UserName || bundle.MicroService.UserName || bundle.Application.OwnerName || '',
    IsDeleted: 0,
    MicroServiceId: bundle.MicroService.Id,
    MicroServiceKey: 'microi-platform-service',
    PageKey: String(routeDefinition.name || routePath.slice(1)),
    PageTitle: String(routeDefinition.title || routeDefinition.name || routePath),
    RoutePath: routePath,
    EntryPath: 'index.html',
    MenuUrl: `/micro-app/microi-platform-service${routePath}`,
    Sort: Number(routeDefinition.sort || 0),
    IsHome: routeDefinition.isHome === true || Number(routeDefinition.isHome) === 1 ? 1 : 0,
    IsEnable: 1,
    BuildVersion: version,
    RouteMetaJson: existing.RouteMetaJson || '{}',
    SourceDirName: 'microi-platform-service',
  };
});
const marketplaceRoute = bundle.Routes.find(route => route.RoutePath === '/marketplace');
if (!marketplaceRoute) throw new Error('平台微服务缺少 /marketplace 路由');
let marketplaceRouteMeta = {};
try { marketplaceRouteMeta = JSON.parse(marketplaceRoute.RouteMetaJson || '{}') || {}; }
catch { marketplaceRouteMeta = {}; }
const legacyMarketplaceUrls = Array.isArray(marketplaceRouteMeta.LegacyMenuUrls)
  ? marketplaceRouteMeta.LegacyMenuUrls
  : [];
if (!legacyMarketplaceUrls.includes('/microi-store')) legacyMarketplaceUrls.push('/microi-store');
marketplaceRouteMeta.LegacyMenuUrls = legacyMarketplaceUrls;
marketplaceRoute.LegacyMenuUrls = legacyMarketplaceUrls;
marketplaceRoute.RouteMetaJson = JSON.stringify(marketplaceRouteMeta);
for (const route of bundle.Routes) {
  route.UpdateTime = localTime;
  route.BuildVersion = version;
}
bundle.BuildAssets = buildAssets;
bundle.SourceFiles = [];

// 应用商城菜单本身由平台内置微服务承载。商城包必须能被一个尚未安装 SaaS
// 引擎包的普通租户独立安装；不能只交付菜单，再把运行时隐式留在另一个应用包。
const marketplaceMenus = (storePackageModel.SysMenus || []).filter(menu => menu?.Url === '/microi-store');
if (marketplaceMenus.length !== 1) {
  throw new Error(`应用商城主菜单数量异常：${marketplaceMenus.length}`);
}
Object.assign(marketplaceMenus[0], {
  OpenType: 'MicroService',
  IsMicroiService: 1,
  ComponentPath: '/micro-app/host',
  MicroServiceKey: 'microi-platform-service',
  MsKey: 'microi-platform-service',
  MicroServiceRoutePath: '/marketplace',
  LegacyMenuUrl: '/microi-store',
});
storePackageModel.ApplicationBundles = (storePackageModel.ApplicationBundles || [])
  .filter(item => item?.Application?.AppKey !== 'microi-platform-service');
storePackageModel.ApplicationBundles.push(deepClone(bundle));
synchronizeStoreRuntimeSchema(storePackageModel, packageModel);
refreshPackageCounts(storePackageModel);

validateReleaseTargets();
await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
await writeFile(storePackagePath, `${JSON.stringify(storePackageModel, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({
  releaseContractPath,
  applicationRoot,
  sourceRole: releaseContract.SourceRole,
  packagePath,
  storePackagePath,
  version,
  applicationVersion,
  files: buildAssets.length,
  totalSize,
  sourceManifestHash,
  runtimeManifestHash,
  localSourceManifestHash,
  localRuntimeManifestHash,
}, null, 2) + '\n');
