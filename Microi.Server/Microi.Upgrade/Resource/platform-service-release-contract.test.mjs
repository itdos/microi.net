import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const directory = import.meta.dirname;
const repositoryRoot = path.resolve(directory, "../../..");

async function readJson(fileName) {
  return JSON.parse(await readFile(path.resolve(directory, fileName), "utf8"));
}

function platformBundle(packageModel) {
  return packageModel.ApplicationBundles.find(
    item => item?.Application?.AppKey === "microi-platform-service",
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function versionWeight(value) {
  const [major, minor, patch] = String(value || "")
    .replace(/^v/i, "")
    .split(".")
    .slice(0, 3)
    .map(item => Number(item) || 0);
  return major * 1_000_000 + minor * 1_000 + patch;
}

async function collectFiles(root) {
  const result = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const fullPath = path.resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) result.push(fullPath);
    }
  }
  await visit(root);
  return result;
}

test("平台内置微服务只从显式发布契约解析正式源码根", async () => {
  const contract = await readJson("platform-service-release.json");
  const script = await readFile(path.resolve(directory, "embed-platform-service-bundle.mjs"), "utf8");
  const resourcePublisher = await readFile(path.resolve(directory, "refresh-resources.mjs"), "utf8");
  const sourcePackage = JSON.parse(await readFile(
    path.resolve(repositoryRoot, contract.SourceRoot, "package.json"),
    "utf8",
  ));

  assert.equal(contract.SchemaVersion, 1);
  assert.equal(contract.AppKey, "microi-platform-service");
  assert.equal(contract.SourceRole, "CanonicalReleaseSource");
  assert.equal(contract.RuntimeDelivery.Primary, "DatabaseOnly");
  assert.equal(contract.RuntimeDelivery.Mirror, "HashVerifiedHdfsOrCdn");
  assert.equal(contract.RuntimeDelivery.MaxAssetCount, 256);
  assert.equal(contract.RuntimeDelivery.MaxTotalBytes, 5 * 1024 * 1024);
  assert.match(sourcePackage.version, /^\d+\.\d+\.\d+$/);
  assert.match(script, /platform-service-release\.json/);
  assert.match(script, /--verify-only/);
  assert.match(script, /--refresh-candidate/);
  assert.match(script, /--require-clean-source/);
  assert.match(script, /--saas-package-version/);
  assert.match(script, /--store-package-version/);
  assert.match(script, /刷新未发布候选包时，微服务版本、应用整数版本和两个官方包版本必须全部保持不变/);
  assert.doesNotMatch(script, /AI-Project\/microi\/AI应用\/microi-platform-service/);
  assert.doesNotMatch(script, /Microi-V8-Engine\/.*microi-platform-service/);
  assert.match(resourcePublisher, /if \(publish\) \{[\s\S]*changedPlatformServicePackages[\s\S]*await verifyPlatformServiceReleaseSource\(\)/);
  assert.match(resourcePublisher, /两个内置包与官网内容一致，本次仅发布其它资源/);
  assert.match(resourcePublisher, /\[verifierPath, '--verify-only', '--require-clean-source'\]/);
  assert.ok(
    resourcePublisher.indexOf("verifyPlatformServiceReleaseSource();")
      < resourcePublisher.indexOf("await publishResources(remoteChanges)"),
    "正式发布必须先通过平台微服务唯一源码门禁",
  );
});

test("两个官方基线包携带同一份可离线启动的数据库运行产物", async () => {
  const contract = await readJson("platform-service-release.json");
  const [saasPackage, storePackage, saasSyncBase, storeSyncBase, sourcePackage] = await Promise.all([
    readJson("app.microi.saas-engine.json"),
    readJson("app.microi.store.json"),
    readJson(".resource-sync-base/app.microi.saas-engine.json"),
    readJson(".resource-sync-base/app.microi.store.json"),
    JSON.parse(await readFile(path.resolve(repositoryRoot, contract.SourceRoot, "package.json"), "utf8")),
  ]);
  const saasBundle = platformBundle(saasPackage);
  const storeBundle = platformBundle(storePackage);

  assert.ok(saasBundle);
  assert.ok(storeBundle);
  for (const bundle of [saasBundle, storeBundle]) {
    assert.equal(bundle.AssetStoragePolicy.Source, "NotIncluded");
    assert.equal(bundle.AssetStoragePolicy.Build, "DatabaseOnly");
    assert.equal(bundle.MicroService.StorageMode, "db");
    assert.equal(bundle.MicroService.MsUrl, "db");
    assert.equal(bundle.IncludeSource, false);
    assert.deepEqual(bundle.SourceFiles, []);
    assert.ok(bundle.BuildAssets.length > 0 && bundle.BuildAssets.length <= 256);
    assert.ok(bundle.BuildAssets.reduce((sum, asset) => sum + Number(asset.Size), 0) <= 5 * 1024 * 1024);
    assert.ok(bundle.BuildAssets.some(asset => asset.Path === "index.html"));

    for (const asset of bundle.BuildAssets) {
      const bytes = Buffer.from(asset.FileByteBase64, "base64");
      assert.equal(bytes.length, Number(asset.Size), `${asset.Path} 大小不一致`);
      assert.equal(sha256(bytes), asset.Sha256, `${asset.Path} 哈希不一致`);
    }

    const runtimeFingerprint = bundle.BuildAssets
      .map(asset => `${asset.Path}\t${asset.Sha256}\t${asset.Size}`)
      .join("\n");
    const manifest = JSON.parse(bundle.MicroService.AssetManifestJson);
    assert.equal(sha256(runtimeFingerprint), bundle.MicroService.DistHash);
    assert.equal(manifest.RuntimeManifestHash, bundle.MicroService.DistHash);
    assert.match(manifest.SourceManifestHash, /^[a-f0-9]{64}$/);
    assert.equal(manifest.StorageMode, "db");
  }

  assert.equal(saasBundle.VersionNo, storeBundle.VersionNo);
  assert.equal(saasBundle.VersionNo, `v${sourcePackage.version}`);
  assert.equal(saasBundle.Application.CurrentVersion, storeBundle.Application.CurrentVersion);
  assert.equal(saasBundle.MicroService.DistHash, storeBundle.MicroService.DistHash);
  assert.deepEqual(saasBundle.BuildAssets, storeBundle.BuildAssets);
  assert.deepEqual(saasBundle.Routes, storeBundle.Routes);

  const distRoot = path.resolve(repositoryRoot, contract.SourceRoot, "dist");
  const distFiles = await collectFiles(distRoot);
  const expectedAssets = [];
  for (const filePath of distFiles) {
    const bytes = await readFile(filePath);
    expectedAssets.push({
      Path: path.relative(distRoot, filePath).replaceAll("\\", "/"),
      Size: bytes.length,
      Sha256: sha256(bytes),
      FileByteBase64: bytes.toString("base64"),
    });
  }
  assert.deepEqual(
    saasBundle.BuildAssets.map(asset => ({
      Path: asset.Path,
      Size: Number(asset.Size),
      Sha256: asset.Sha256,
      FileByteBase64: asset.FileByteBase64,
    })),
    expectedAssets,
    "官方数据包内嵌运行时必须与唯一源码根的 dist 字节级一致",
  );
  assert.ok(versionWeight(saasPackage.PackageInfo.Version) >= versionWeight(saasSyncBase.PackageInfo.Version));
  assert.ok(versionWeight(storePackage.PackageInfo.Version) >= versionWeight(storeSyncBase.PackageInfo.Version));
  assert.ok(versionWeight(saasBundle.VersionNo) >= versionWeight(platformBundle(saasSyncBase).VersionNo));
  assert.ok(versionWeight(storeBundle.VersionNo) >= versionWeight(platformBundle(storeSyncBase).VersionNo));
});
