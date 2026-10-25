#!/usr/bin/env node
// A clean checkout recovers the exact embedded runtime only when its source bytes match.
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalized = value => value.replaceAll('\\', '/');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));

async function filesBelow(root, excluded = new Set()) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (excluded.has(entry.name) && (entry.isDirectory() || entry.isSymbolicLink())) continue;
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Platform service input cannot contain links');
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  await visit(root);
  return files;
}

async function fingerprint(root, excluded) {
  const rows = [];
  for (const file of await filesBelow(root, excluded)) {
    const bytes = await readFile(file);
    rows.push(`${normalized(path.relative(root, file))}\t${sha256(bytes)}\t${bytes.length}`);
  }
  return sha256(rows.join('\n'));
}

export async function preparePlatformServiceDist(repositoryRoot) {
  const resourceRoot = path.resolve(repositoryRoot, 'Microi.Server/OfficialApplications/Resource');
  const contract = await readJson(path.join(resourceRoot, 'platform-service-release.json'));
  const sourcePath = 'Microi.Server/OfficialApplications/PlatformService';
  const expectedTargets = ['saas-engine', 'store', 'message-notification', 'sys-log']
    .map(name => `Microi.Server/OfficialApplications/Resource/app.microi.${name}.json`);
  if (contract.SchemaVersion !== 1 || contract.AppKey !== 'microi-platform-service'
      || contract.SourceRoot !== sourcePath || contract.SourceRole !== 'CanonicalReleaseSource'
      || contract.RuntimeDelivery?.Primary !== 'DatabaseOnly'
      || contract.RuntimeDelivery?.MaxAssetCount !== 256
      || contract.RuntimeDelivery?.MaxTotalBytes !== 5 * 1024 * 1024
      || JSON.stringify(contract.PackageTargets) !== JSON.stringify(expectedTargets)) {
    throw new Error('Invalid platform service release contract');
  }
  const sourceRoot = path.resolve(repositoryRoot, sourcePath);
  if (!(await lstat(sourceRoot)).isDirectory()) throw new Error('Canonical source root must be a real directory');
  const sourceHash = await fingerprint(sourceRoot, new Set(['dist', 'node_modules']));
  const sourcePackage = await readJson(path.join(sourceRoot, 'package.json'));
  let reference;
  for (const target of expectedTargets) {
    const model = await readJson(path.resolve(repositoryRoot, target));
    const bundles = (model.ApplicationBundles || []).filter(item => item?.Application?.AppKey === contract.AppKey);
    if (bundles.length !== 1) throw new Error(`Missing or duplicate platform service bundle: ${target}`);
    const bundle = bundles[0];
    const manifest = JSON.parse(bundle.MicroService?.AssetManifestJson || '{}');
    if (manifest.SourceManifestHash !== sourceHash || bundle.VersionNo !== `v${sourcePackage.version}`) {
      throw new Error(`Platform service source mismatch: ${target}; rebuild and embed the current source before release`);
    }
    if (bundle.AssetStoragePolicy?.Build !== 'DatabaseOnly' || bundle.MicroService?.StorageMode !== 'db') {
      throw new Error(`Platform service runtime is not database embedded: ${target}`);
    }
    const assets = bundle.BuildAssets;
    if (!Array.isArray(assets) || !assets.length || assets.length > 256) throw new Error('Invalid runtime asset count');
    const names = new Set();
    let totalBytes = 0;
    for (const asset of assets) {
      const name = asset.Path;
      if (typeof name !== 'string' || !name || /[\\:\x00-\x1f]/.test(name)
          || name.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)
            || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
          || names.has(name.toLowerCase())) throw new Error('Invalid or duplicate runtime asset path');
      names.add(name.toLowerCase());
      const bytes = Buffer.from(asset.FileByteBase64 || '', 'base64');
      if (bytes.toString('base64') !== asset.FileByteBase64 || bytes.length !== Number(asset.Size)
          || sha256(bytes) !== asset.Sha256) throw new Error(`Runtime asset hash or size mismatch: ${name}`);
      totalBytes += bytes.length;
    }
    const runtimeHash = sha256(assets.map(asset => `${asset.Path}\t${asset.Sha256}\t${asset.Size}`).join('\n'));
    if (!names.has('index.html') || totalBytes > 5 * 1024 * 1024
        || runtimeHash !== bundle.MicroService.DistHash || runtimeHash !== manifest.RuntimeManifestHash) {
      throw new Error('Invalid embedded runtime manifest');
    }
    const identity = JSON.stringify({ assets, runtimeHash, version: bundle.VersionNo, applicationVersion: bundle.Application.CurrentVersion });
    if (reference && reference.identity !== identity) throw new Error('Embedded platform service runtimes disagree');
    reference = { identity, assets, runtimeHash, totalBytes };
  }
  const distRoot = path.join(sourceRoot, 'dist');
  const existing = await lstat(distRoot).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing) {
    if (!existing.isDirectory() || await fingerprint(distRoot) !== reference.runtimeHash) {
      throw new Error('Existing platform service dist differs from embedded runtime; refusing to overwrite it');
    }
    return { status: 'VerifiedExisting', sourceHash, runtimeHash: reference.runtimeHash, assetCount: reference.assets.length };
  }
  const stagingPrefix = path.join(path.dirname(sourceRoot), '.platform-service-dist-');
  const stagingRoot = await mkdtemp(stagingPrefix);
  try {
    for (const asset of reference.assets) {
      const file = path.join(stagingRoot, ...asset.Path.split('/'));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(asset.FileByteBase64, 'base64'), { flag: 'wx' });
    }
    if (await fingerprint(stagingRoot) !== reference.runtimeHash) throw new Error('Recovered runtime bytes do not match manifest');
    await rename(stagingRoot, distRoot);
  } finally {
    // This randomly generated sibling is owned by this invocation; never remove an existing dist.
    if (!path.resolve(stagingRoot).startsWith(path.resolve(stagingPrefix))) throw new Error('Unsafe staging cleanup target');
    await rm(stagingRoot, { recursive: true, force: true });
  }
  return { status: 'RestoredEmbedded', sourceHash, runtimeHash: reference.runtimeHash, assetCount: reference.assets.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  console.log(JSON.stringify(await preparePlatformServiceDist(root)));
}
