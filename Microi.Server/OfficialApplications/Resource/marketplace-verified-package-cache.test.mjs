import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modelSource = readFileSync(new URL('./get-microi-store-model.js', import.meta.url), 'utf8');
const importerSource = readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const runModel = new Function('V8', 'System', modelSource);
const loadStart = importerSource.indexOf('var loadMarketplacePackage = function');
const loadEnd = importerSource.indexOf('var authoritativeStoreModel = null;', loadStart);
const loadImport = new Function('V8', 'System', 'storeApiBase', 'storeOsClient', 'debugLog',
  'function firstTextParam(values) { return String(values.find(v => v !== undefined && v !== null && String(v).trim()) || "").trim(); }\n'
  + importerSource.slice(loadStart, loadEnd) + '\nreturn loadMarketplacePackage;');
const sha = text => createHash('sha256').update(String(text), 'utf8').digest('hex');
const system = { Text: { Encoding: { UTF8: { GetByteCount: text => Buffer.byteLength(String(text), 'utf8'), GetString: String } } } };
const body = JSON.stringify({ PackageInfo: { Name: '验证包', Version: 'v1.0.0' }, SysMenus: [{ Id: 'menu-1', Name: '示例' }] });
function fixture() {
  const cache = new Map(), gets = [], sets = [], reads = [];
  let download = body, permitted = true;
  const row = { Id: 'app-1', AppPakcet: '', AppVersion: 'v1.0.0', IsPublic: 1,
    PackageHdfsPath: '/tenant/packages/immutable.json', PackageStorageMode: 'HdfsPublic',
    PackageSha256: sha(body), PackageSize: Buffer.byteLength(body), StoreVersionId: 'snapshot-1',
    PackageDownloadUrl: 'https://files.example.test/immutable.json?signature=first' };
  const v8 = { OsClient: 'tenant', Param: { Id: row.Id, IncludePackage: false, IncludePackageSummary: true },
    CurrentUser: { Id: 'user-1' }, SysConfig: { FileServer: 'https://files.example.test' },
    EncryptHelper: { Sha256Hex: sha }, Method: { GetPrivateFileUrl: () => ({ Code: 1, Data: row.PackageDownloadUrl }), GetCurrentToken: () => null },
    Cache: { Get(key) { gets.push(key); return cache.get(key); }, Set(key, value, ttl) { sets.push({ key, ttl }); cache.set(key, value); return true; } },
    Http: { GetResponse(request) { reads.push(request.Url); return { StatusCode: 200, Content: download }; } },
    FormEngine: { GetFormData() { return permitted ? { Code: 1, Data: { ...row } } : { Code: 2 }; }, GetTableData() { return { Code: 1, Data: [] }; } } };
  const debug = {};
  return { row, v8, cache, gets, sets, reads, debug, setDownload: value => { download = value; }, deny: () => { permitted = false; },
    model: () => runModel(v8, system), importer: (source = 'https://source.example.test', tenant = 'origin') => loadImport(v8, system, source, tenant, debug)(row, '测试包') };
}

test('重复详情与分片只下载一次，命中仍核验原始字节；私有签名轮换不破坏缓存', () => {
  for (const kind of ['model', 'importer']) {
    const f = fixture();
    for (let i = 0; i < 20; i++) { f.row.PackageDownloadUrl = 'https://files.example.test/immutable.json?signature=' + i; const r = f[kind](); if (kind === 'model') assert.equal(r.Code, 1); else assert.equal(r, body); }
    assert.equal(f.reads.length, 1); assert.equal(f.sets.length, 1); assert.equal(f.sets[0].ttl, 900);
    assert.equal(f.cache.size, 1); assert.doesNotMatch([...f.cache.values()][0], /signature=|PackageDownloadUrl/);
    if (kind === 'model') assert.equal(f.model().DataAppend.PackageContentRead.Source, 'VerifiedCache');
    else assert.equal(f.debug.marketplace_package_read.NetworkBytes, 0);
  }
});

test('同一详情响应同时要求摘要与旧正文时只读取一次', () => {
  const f = fixture(); f.v8.Param.IncludePackage = true;
  const result = f.model(); assert.equal(result.Code, 1); assert.equal(f.reads.length, 1);
  assert.equal(result.DataAppend.PackageContentRead.NetworkBytes, Buffer.byteLength(body));
});

test('当前权限撤回、应用不存在时不能从热缓存读取', () => {
  const f = fixture(); assert.equal(f.model().Code, 1); const cacheReads = f.gets.length;
  f.row.IsPublic = 0; f.v8.CurrentUser = null; assert.equal(f.model().Code, 2);
  f.deny(); assert.equal(f.model().Code, 2); assert.equal(f.gets.length, cacheReads); assert.equal(f.reads.length, 1);
});

test('来源、租户、指针与快照变化失效，固定槽不会按版本无限增键', () => {
  const f = fixture(); f.importer(); f.importer('https://another.example.test'); f.importer('https://another.example.test', 'another');
  f.row.PackageHdfsPath = '/tenant/packages/another.json'; f.importer();
  f.row.StoreVersionId = 'snapshot-2'; f.importer(); f.v8.OsClient = 'other-tenant'; f.importer();
  assert.equal(f.reads.length, 6); assert.equal(f.cache.size, 2);
});

test('缓存污染不能返回未验证正文，下载校验失败不写缓存', () => {
  for (const kind of ['model', 'importer']) {
    const f = fixture(); f[kind](); const [key, value] = [...f.cache.entries()][0];
    const bad = JSON.parse(value); bad.Content = body.replace('验证包', '伪造包'); f.cache.set(key, JSON.stringify(bad));
    f.setDownload(bad.Content); if (kind === 'model') assert.equal(f.model().Code, 0); else assert.throws(() => f.importer(), /下载校验失败/);
    assert.equal(f.sets.length, 1); f.setDownload(body); f[kind](); assert.equal(f.reads.length, 3);
  }
});

test('缓存异常回退受验证下载，非整数大小与超缓存上限不写缓存', () => {
  const f = fixture(); f.v8.Cache.Get = () => { throw Error('unavailable'); }; f.v8.Cache.Set = () => { throw Error('unavailable'); };
  assert.equal(f.importer(), body); assert.equal(f.model().Code, 1);
  f.row.PackageSize += 0.5; assert.throws(() => f.importer(), /合法字节数/); assert.equal(f.model().Code, 0);
  const large = fixture(); large.row.PackageSize = 64 * 1024 * 1024 + 1;
  assert.throws(() => large.importer(), /下载校验失败/); assert.equal(large.gets.length, 0); assert.equal(large.sets.length, 0);
});

test('安装分片仍先请求权威商城模型，正文缓存不进入持久任务参数', () => {
  const call = importerSource.indexOf('Package = loadMarketplacePackage(storeModel');
  const authorization = importerSource.lastIndexOf('postMarketplaceReadWithRetry(', call);
  assert.ok(authorization >= 0 && authorization < call);
  const bulk = readFileSync(new URL('./bulk-import-packages.js', import.meta.url), 'utf8');
  const child = bulk.slice(bulk.indexOf('var childParam = {'), bulk.indexOf('report(Math.max', bulk.indexOf('var childParam = {')));
  assert.doesNotMatch(child, /\bPackage\s*:/); assert.match(child, /StoreVersionId: item.StoreVersionId/);
});
