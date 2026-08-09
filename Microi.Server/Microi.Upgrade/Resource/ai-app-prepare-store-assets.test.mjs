import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('.', import.meta.url);
const source = await readFile(new URL('ai-app-prepare-store-assets.js', root), 'utf8');
const publisher = await readFile(new URL('ai-app-publish-store.js', root), 'utf8');
const replicaSync = await readFile(new URL('application-store-replica-sync.mjs', root), 'utf8');
const packageModel = JSON.parse(await readFile(new URL('app.microi.store.json', root), 'utf8'));
const embedded = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'ai_app_prepare_store_assets');

test('prepared asset manifests bind the exact application package version', () => {
  assert.match(source, /Version: v1\.1\.9/u);
  assert.match(source, /function normalizeExactVersion\(value\)/u);
  assert.match(source, /PackageVersion: packageVersion/u);
  assert.match(source, /packageVersionOf\(option\.PackageVersion \|\| V8\.Param\.PackageVersion, app\.AppVersion\)/u);
  assert.match(source, /PackageVersion 必须是 v1\.2\.3 形式的精确语义版本/u);
});

test('publisher forwards its requested exact version to the ZIP preparer', () => {
  assert.match(
    publisher,
    /V8\.ApiEngine\.Run\('ai_app_prepare_store_assets',[\s\S]*?PackageVersion: text\(V8\.Param\.AppVersion\),[\s\S]*?PackageVersion: text\(V8\.Param\.AppVersion\)/u,
  );
});

test('standalone preparer is synchronized into the embedded marketplace package', () => {
  assert.match(replicaSync, /resourceName: 'ai-app-prepare-store-assets\.js',[\s\S]*?apiEngineKey: 'ai_app_prepare_store_assets'/u);
  assert.ok(embedded, 'embedded marketplace package lacks ai_app_prepare_store_assets');
  assert.equal(embedded.Version, 'v1.1.9');
  assert.equal(String(embedded.ApiV8Code || '').replace(/\r\n/g, '\n').trim(), source.replace(/\r\n/g, '\n').trim());
});
