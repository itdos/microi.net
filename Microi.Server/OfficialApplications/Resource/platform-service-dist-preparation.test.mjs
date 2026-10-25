import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { preparePlatformServiceDist } from './prepare-platform-service-dist.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const fixtureParent = path.join(repositoryRoot, '.tmp');
  await mkdir(fixtureParent, { recursive: true });
  const root = await mkdtemp(path.join(fixtureParent, 'platform-dist-preparation-'));
  t.after(async () => {
    assert.equal(path.dirname(root), fixtureParent);
    assert.ok(path.basename(root).startsWith('platform-dist-preparation-'));
    await rm(root, { recursive: true, force: true });
  });
  const sourceRelative = 'Microi.Server/OfficialApplications/PlatformService';
  const resourceRelative = 'Microi.Server/OfficialApplications/Resource';
  const source = path.join(root, sourceRelative);
  const resources = path.join(root, resourceRelative);
  await mkdir(source, { recursive: true });
  await mkdir(resources, { recursive: true });
  const packageText = JSON.stringify({ name: 'microi-platform-service', version: '2.0.28' });
  await writeFile(path.join(source, 'package.json'), packageText);
  const sourceHash = sha(`package.json\t${sha(packageText)}\t${Buffer.byteLength(packageText)}`);
  const assets = [['assets/main.js', 'window.ready = true;'], ['index.html', '<script src="./assets/main.js"></script>']]
    .map(([Path, text]) => ({ Path, Size: Buffer.byteLength(text), Sha256: sha(text), FileByteBase64: Buffer.from(text).toString('base64') }));
  const runtimeHash = sha(assets.map(asset => `${asset.Path}\t${asset.Sha256}\t${asset.Size}`).join('\n'));
  const bundle = {
    Application: { AppKey: 'microi-platform-service', CurrentVersion: 28 },
    VersionNo: 'v2.0.28', AssetStoragePolicy: { Build: 'DatabaseOnly' },
    MicroService: { StorageMode: 'db', DistHash: runtimeHash, AssetManifestJson: JSON.stringify({ SourceManifestHash: sourceHash, RuntimeManifestHash: runtimeHash }) },
    BuildAssets: assets,
  };
  const targets = ['saas-engine', 'store', 'message-notification', 'sys-log'].map(name => `${resourceRelative}/app.microi.${name}.json`);
  const contract = {
    SchemaVersion: 1, AppKey: 'microi-platform-service', SourceRoot: sourceRelative,
    SourceRole: 'CanonicalReleaseSource', RuntimeDelivery: { Primary: 'DatabaseOnly', MaxAssetCount: 256, MaxTotalBytes: 5 * 1024 * 1024 }, PackageTargets: targets,
  };
  await writeFile(path.join(resources, 'platform-service-release.json'), JSON.stringify(contract));
  for (const target of targets) await writeFile(path.join(root, target), JSON.stringify({ ApplicationBundles: [bundle] }));
  return { root, source, targets, bundle, assets };
}

test('clean checkout restores exact embedded bytes and repeat preparation is read-only', async t => {
  const f = await fixture(t);
  assert.equal((await preparePlatformServiceDist(f.root)).status, 'RestoredEmbedded');
  for (const asset of f.assets) assert.equal(await readFile(path.join(f.source, 'dist', asset.Path), 'base64'), asset.FileByteBase64);
  assert.equal((await preparePlatformServiceDist(f.root)).status, 'VerifiedExisting');
});

test('changed canonical source rejects recovery before creating dist', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.source, 'changed.js'), 'changed');
  await assert.rejects(preparePlatformServiceDist(f.root), /source mismatch/);
  await assert.rejects(access(path.join(f.source, 'dist')), { code: 'ENOENT' });
});

test('all four packages are checked before any recovery writes', async t => {
  const f = await fixture(t);
  f.bundle.BuildAssets[0].FileByteBase64 = Buffer.from('corrupted').toString('base64');
  await writeFile(path.join(f.root, f.targets[3]), JSON.stringify({ ApplicationBundles: [f.bundle] }));
  await assert.rejects(preparePlatformServiceDist(f.root), /hash or size mismatch/);
  await assert.rejects(access(path.join(f.source, 'dist')), { code: 'ENOENT' });
});

test('unsafe embedded paths are rejected before creating dist', async t => {
  const f = await fixture(t);
  f.bundle.BuildAssets[0].Path = '../outside.js';
  await writeFile(path.join(f.root, f.targets[0]), JSON.stringify({ ApplicationBundles: [f.bundle] }));
  await assert.rejects(preparePlatformServiceDist(f.root), /asset path/);
  await assert.rejects(access(path.join(f.source, 'dist')), { code: 'ENOENT' });
});

test('existing divergent dist is preserved and fails preparation', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.source, 'dist'));
  await writeFile(path.join(f.source, 'dist/index.html'), 'existing local build');
  await assert.rejects(preparePlatformServiceDist(f.root), /refusing to overwrite/);
  assert.equal(await readFile(path.join(f.source, 'dist/index.html'), 'utf8'), 'existing local build');
});

test('formal release prepares the embedded platform service before candidate capture and tests', async () => {
  const script = await readFile(path.join(repositoryRoot, 'Microi一键编译发布.sh'), 'utf8');
  const preparation = script.indexOf('node Microi.Server/OfficialApplications/Resource/prepare-platform-service-dist.mjs');
  const freeze = script.indexOf('release-candidate.mjs capture');
  const tests = script.indexOf('-File Microi.Server/Microi.Tests/run-tests.ps1');
  assert.ok(preparation >= 0 && preparation < freeze && freeze < tests);
});
