import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const iconRoot = path.join(resourceRoot, 'WebOSIcons', 'ios-skeuomorphic-v2');
const packageNames = [
  'app.microi.ai-engine.json',
  'app.microi.form-engine.json',
  'app.microi.message-notification.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
  'app.microi.sys-config.json',
  'app.microi.sys_user.json',
];
const expectedVersions = new Map([
  ['app.microi.ai-engine.json', 'v7.6.2'],
  ['app.microi.form-engine.json', 'v7.6.9'],
  ['app.microi.message-notification.json', 'v1.0.15'],
  ['app.microi.module-engine.json', 'v7.6.3'],
  ['app.microi.saas-engine.json', 'v7.7.24'],
  ['app.microi.sso.json', 'v7.5.10'],
  ['app.microi.sys-config.json', 'v6.3.12'],
  ['app.microi.sys_user.json', 'v7.6.4'],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compareVersions(left, right) {
  const parse = value => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/u.exec(String(value || '').trim());
    assert.ok(match, `invalid semantic version: ${value || '(empty)'}`);
    return match.slice(1).map(Number);
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpCanvas(buffer, fileName) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${fileName} must be a RIFF file`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `${fileName} must be a WebP file`);
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkType === 'VP8X') {
      return {
        alpha: Boolean(buffer[offset + 8] & 0x10),
        width: readUint24LE(buffer, offset + 12) + 1,
        height: readUint24LE(buffer, offset + 15) + 1,
      };
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error(`${fileName} is missing the VP8X canvas metadata`);
}

test('WebOS icon assets are compact, square, transparent and individually distinct', () => {
  const files = fs.readdirSync(iconRoot).filter(fileName => fileName.endsWith('.webp')).sort();
  assert.equal(files.length, 27);
  const hashes = new Set();
  for (const fileName of files) {
    const buffer = fs.readFileSync(path.join(iconRoot, fileName));
    assert.ok(buffer.length >= 15 * 1024, `${fileName} is unexpectedly small (${buffer.length} bytes)`);
    assert.ok(buffer.length <= 150 * 1024, `${fileName} exceeds the 150KB delivery ceiling (${buffer.length} bytes)`);
    assert.deepEqual(readWebpCanvas(buffer, fileName), { alpha: true, width: 320, height: 320 });
    hashes.add(crypto.createHash('sha256').update(buffer).digest('hex'));
  }
  assert.equal(hashes.size, files.length, 'each semantic category must have distinct artwork');
});

test('all official packages publish the image-first icon release with no legacy generated path', () => {
  for (const packageName of packageNames) {
    for (const sourceRoot of [resourceRoot, path.join(resourceRoot, '.resource-sync-base')]) {
      const packageModel = readJson(path.join(sourceRoot, packageName));
      const releasedVersion = expectedVersions.get(packageName);
      assert.ok(compareVersions(packageModel.PackageInfo.Version, releasedVersion) >= 0,
        `${packageName} regressed below the published WebOS icon release ${releasedVersion}`);
      assert.equal(packageModel.PackageInfo.ChangeLog?.Version, packageModel.PackageInfo.Version);
      const history = JSON.stringify(packageModel.PackageInfo.ChangeHistory || '');
      assert.match(history, new RegExp(releasedVersion.replaceAll('.', '\\.')));
      assert.match(history, /23–39KB/u);
      assert.doesNotMatch(JSON.stringify(packageModel), /\/microi\/menu-icons\/20260808\//u);
    }
  }
});

test('SaaS package upserts the complete 99-row WebOS icon catalog', () => {
  for (const sourceRoot of [resourceRoot, path.join(resourceRoot, '.resource-sync-base')]) {
    const packageModel = readJson(path.join(sourceRoot, 'app.microi.saas-engine.json'));
    const iconDataSet = packageModel.DataSets.find(item => item.TableName === 'microi_icon');
    assert.ok(iconDataSet, 'microi_icon DataSet is required');
    assert.equal(packageModel.PackageInfo.DataSetCount, packageModel.DataSets.length);
    assert.equal(packageModel.PackageInfo.DataRowCount,
      packageModel.DataSets.reduce((total, item) => total + (item.Rows?.length || 0), 0));
    assert.equal(iconDataSet.SelectionMode, 'Ids');
    assert.equal(iconDataSet.ConflictPolicy, 'UpsertById');
    assert.deepEqual(iconDataSet.ConflictFields, ['Id']);
    assert.equal(iconDataSet.Rows.length, 99);
    assert.equal(iconDataSet.RowIds.length, 99);
    assert.equal(new Set(iconDataSet.RowIds).size, 99);
    assert.deepEqual(new Set(iconDataSet.Rows.map(row => row.Id)), new Set(iconDataSet.RowIds));
    const iconPaths = new Set(iconDataSet.Rows.map(row => row.Icon));
    assert.equal(iconPaths.size, 27);
    for (const iconPath of iconPaths) {
      assert.match(iconPath, /^\/itdos\/microi\/webos-icons\/ios-skeuomorphic-v2\/202609\/[a-z0-9-]+\.webp$/u);
      assert.ok(fs.existsSync(path.join(iconRoot, path.basename(iconPath))), `${iconPath} has no bundled asset`);
    }
  }
});
