import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('.', import.meta.url);
const importer = await readFile(new URL('import-package.js', root), 'utf8');
const model = await readFile(new URL('get-microi-store-model.js', root), 'utf8');
const publisher = await readFile(new URL('ai-app-publish-store.js', root), 'utf8');

test('legacy public Path and private signed URLs are both resolved before tenant-local fallback', () => {
  assert.match(
    importer,
    /firstTextParam\(\[asset\.FullPath, asset\.Url, asset\.url, asset\.FileUrl, asset\.Path\]\)/u,
  );
  assert.match(importer, /storeModelAppend\.ApplicationAssetDownloadUrls/u);
  assert.match(importer, /Object\.prototype\.hasOwnProperty\.call\(applicationAssetDownloadUrls, signedCandidate\)/u);
  assert.match(importer, /Limit: privateAsset/u);
  assert.doesNotMatch(importer, /throw new Error\('获取ZIP公开地址失败/u);
});

test('selected marketplace identity and version are bound to the immutable package body', () => {
  assert.match(importer, /MARKETPLACE_PACKAGE_IDENTITY_BINDING_V1/u);
  assert.match(importer, /MARKETPLACE_PACKAGE_IDENTITY_MISMATCH/u);
  assert.match(importer, /MARKETPLACE_PACKAGE_VERSION_MISMATCH/u);
});

test('private build distribution is supported and signed only by the authoritative source', () => {
  assert.match(importer, /publichdfs\|public-hdfs\|privatehdfs\|private-hdfs\|hdfs/u);
  assert.match(model, /privateApplicationAssetDownloadUrls\(selected\)/u);
  assert.match(model, /packageAssetBelongsToApplication/u);
  assert.match(model, /Limit: true/u);
  assert.match(publisher, /Build: storeVisibility \? 'PublicHdfs' : 'PrivateHdfs'/u);
});
