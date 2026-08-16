#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../../');
const packagePath = resolve(scriptDirectory, 'app.microi.saas-engine.json');
const applicationRoot = resolve(repositoryRoot, 'AI-Project/microi/AI应用/microi-platform-service');
const distRoot = resolve(applicationRoot, 'dist');

const argumentValue = (name, fallback = '') => {
  const prefix = `${name}=`;
  const argument = process.argv.find(value => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
};

const version = argumentValue('--version', 'v1.5.7');
const applicationVersion = Number(argumentValue('--application-version', '14'));
const sourceManifestHashOverride = argumentValue('--source-manifest-hash');
const runtimeManifestHashOverride = argumentValue('--runtime-manifest-hash');
const timestamp = new Date(argumentValue('--timestamp', new Date().toISOString()));
if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error(`无效微服务版本：${version}`);
if (!Number.isInteger(applicationVersion) || applicationVersion < 1) throw new Error('应用版本号必须为正整数');
if (Number.isNaN(timestamp.getTime())) throw new Error('时间戳无效');
for (const [label, value] of [
  ['源码清单哈希', sourceManifestHashOverride],
  ['运行清单哈希', runtimeManifestHashOverride],
]) {
  if (value && !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label}必须是 64 位小写 SHA-256`);
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalizePath = value => value.replaceAll('\\', '/');

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
const bundle = (packageModel.ApplicationBundles || []).find(
  item => item?.Application?.AppKey === 'microi-platform-service',
);
if (!bundle) throw new Error('SaaS 引擎包中缺少 microi-platform-service');

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
if (buildAssets.length > 256) throw new Error(`微服务构建文件数 ${buildAssets.length} 超过 256`);
const totalSize = buildAssets.reduce((sum, asset) => sum + asset.Size, 0);
if (totalSize > 5 * 1024 * 1024) throw new Error(`微服务构建大小 ${totalSize} 超过 5MB`);

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
for (const route of bundle.Routes || []) {
  route.UpdateTime = localTime;
  route.BuildVersion = version;
}
bundle.BuildAssets = buildAssets;
bundle.SourceFiles = [];

await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({
  packagePath,
  version,
  applicationVersion,
  files: buildAssets.length,
  totalSize,
  sourceManifestHash,
  runtimeManifestHash,
  localSourceManifestHash,
  localRuntimeManifestHash,
}, null, 2) + '\n');
