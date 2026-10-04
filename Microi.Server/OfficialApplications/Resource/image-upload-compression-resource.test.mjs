import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const resources = [
  ['app.microi.saas-engine.json', 'v7.5.22'],
  ['app.microi.store.json', 'v7.5.17'],
];

function compareVersions(left, right) {
  const parts = value => String(value).replace(/^v/i, '').split('.').map(Number);
  const leftParts = parts(left);
  const rightParts = parts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta) return delta;
  }
  return 0;
}

for (const [fileName, expectedVersion] of resources) {
  const pkg = JSON.parse(await readFile(new URL(`./${fileName}`, import.meta.url), 'utf8'));

  test(`${fileName} enables compression for every explicitly configured image upload`, () => {
    const imageFields = (pkg.DiyFields || []).filter(field => field.Component === 'ImgUpload');
    assert.ok(imageFields.length > 0);
    for (const field of imageFields) {
      const config = JSON.parse(field.Config || '{}');
      assert.notEqual(config.ImgUpload?.Preview, false, `${field.TableName}.${field.Name}`);
    }
  });

  test(`${fileName} declares the platform compression contract`, () => {
    assert.ok(
      compareVersions(pkg.PackageInfo.Version, expectedVersion) >= 0,
      `${fileName} must stay at or above the compression contract version ${expectedVersion}`,
    );
    assert.ok(pkg.PackageInfo.ChangeHistory.includes('500KB'));
    assert.ok(pkg.PackageInfo.ChangeHistory.includes('私有原图'));
    assert.ok(pkg.PackageInfo.RequiredPlatformCapabilities.includes(
      'ServerFeature:DefaultImageCompressionPrivateOrigin',
    ));
    assert.ok(pkg.PackageInfo.RequiredPlatformCapabilities.includes(
      'ClientFeature:ImgUploadCompressionDefault',
    ));
  });
}
