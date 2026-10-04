import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { copy, runSourceZip, sha256, sourceFixture, sourceZipCode } from './ai-app-source-zip-harness.mjs';

function expectBlocked(run, reason) {
  assert.equal(run.result.Code, 0);
  if (reason) assert.equal(run.result.Reason, `SOURCE_ZIP_${reason}`);
  assert.equal(run.state.writes, 0);
  assert.doesNotMatch(JSON.stringify(run.result), /https?:|FilePathName|private upstream|committed-current/);
}

test('399 当前私有源码与历史冲突、upload/v*、未提交源严格分离', async () => {
  const fixture = sourceFixture(399);
  for (let index = 0; index < 43; index++) {
    const row = copy(fixture.rows[index]);
    row.Id = `old-${index}`; row.VersionId = 'historical-source'; row.StorageScope = 'PrivateSourceStaged';
    row.HdfsPath = `/itdos/ai-app-source-staged/${fixture.app.Id}/old/${row.FilePath}`;
    fixture.rows.push(row);
  }
  for (const [scope, path] of [['PublicBuildStreamArchived', 'upload/v0.1/index.html'], ['PublicBuildStream', 'build/index.html'], ['ApplicationAssetMultipartSession', 'upload/v0.2/assets/app.js']]) fixture.rows.push({ ...copy(fixture.rows[0]), Id: scope, VersionId: 'v-old', StorageScope: scope, FilePath: path });
  fixture.rows.push({ ...copy(fixture.rows[0]), Id: 'uncommitted', VersionId: 'stream-session', StorageScope: 'PrivateSourceStaged' });
  fixture.rows.push({ ...copy(fixture.rows[0]), Id: 'directory', IsDirectory: 1 });
  fixture.rows.push({ ...copy(fixture.rows[0]), Id: 'deleted', IsDeleted: 1 });
  fixture.rows.push({ ...copy(fixture.rows[0]), Id: 'inactive', HdfsPath: `/itdos/ai-app-source/${fixture.app.Id}/previous/package.json` });
  const run = await runSourceZip(fixture);
  assert.equal(run.result.Code, 1);
  assert.equal(run.result.Data.FileCount, 399);
  assert.equal(run.state.reads.length, 399);
  assert.equal(run.state.zips.length, 1);
  assert.equal(new Set(run.state.zips[0].Entries.map(entry => entry.Path)).size, 399);
  assert.equal(run.state.signedUrls + run.state.httpReads + run.state.writes, 0);
  for (const entry of run.state.zips[0].Entries) {
    const expected = fixture.rows.find(row => row.StorageScope === 'Private' && row.VersionId === null && row.FilePath === entry.Path && row.HdfsPath.startsWith(fixture.app.PrivateSourcePath));
    assert.equal(sha256(Buffer.from(entry.FileByteBase64, 'base64')), expected.ContentHash);
  }
  assert.equal(run.result.Data.SourceManifestHash, sha256(Buffer.from(fixture.rows.slice(0, 399).sort((a, b) => a.FilePath < b.FilePath ? -1 : 1).map(row => `${row.FilePath}\t${row.ContentHash}\t${row.Size}`).join('\n'))));
  assert.ok(run.state.queries.every(query => query._Where.some(condition => condition.includes('VersionId')) && query._Where.some(condition => condition.includes('StorageScope'))));
});

test('分页超过1000份、二进制、空文件与已激活 staged 根均可完整导出', async () => {
  const fixture = sourceFixture(1001), zero = fixture.rows[2];
  fixture.bytes.set(zero.HdfsPath, Buffer.alloc(0)); zero.Size = 0; zero.ContentHash = sha256(Buffer.alloc(0));
  const run = await runSourceZip(fixture);
  assert.equal(run.result.Code, 1); assert.equal(run.result.Data.FileCount, 1001);
  assert.equal(run.state.queries.length, 6);
  const entry = run.state.zips[0].Entries.find(item => item.Path === zero.FilePath);
  assert.equal(entry.FileByteBase64, '');
  assert.deepEqual(Buffer.from(run.state.zips[0].Entries.find(item => item.Path === fixture.rows[1].FilePath).FileByteBase64, 'base64'), fixture.bytes.get(fixture.rows[1].HdfsPath));
});

test('旧租户相对私有根与 source/ 包装兼容，但仍只读取该根', async () => {
  const fixture = sourceFixture(1);
  fixture.app.PrivateSourcePath = `ai-app-source/${fixture.app.Id}`;
  const row = fixture.rows[0], content = fixture.bytes.get(row.HdfsPath);
  row.FilePath = `source/${row.FilePath}`; row.HdfsPath = `${fixture.app.PrivateSourcePath}/${row.FilePath}`;
  fixture.bytes.set(`/itdos/${row.HdfsPath}`, content);
  const run = await runSourceZip(fixture);
  assert.equal(run.result.Code, 1); assert.equal(run.state.zips[0].Entries[0].Path, 'package.json');
});

for (const [title, configure, reason] of [
  ['空活动基线', fixture => { fixture.app.PrivateSourcePath = ''; }, 'BASELINE'],
  ['没有当前源不能回退历史', fixture => { fixture.rows.forEach(row => { row.VersionId = 'old'; row.StorageScope = 'PrivateSourceStaged'; }); }, 'EMPTY'],
  ['跨租户配置根', fixture => { fixture.app.PrivateSourcePath = fixture.app.PrivateSourcePath.replace('/itdos/', '/other/'); }, 'BASELINE'],
  ['非应用的私有根', fixture => { fixture.app.PrivateSourcePath = '/itdos/ai-app-source/another-app'; }, 'BASELINE'],
  ['目录名相邻不能前缀命中', fixture => { fixture.rows.forEach(row => { row.HdfsPath = row.HdfsPath.replace('committed-current/', 'committed-current-other/'); }); }, 'EMPTY'],
  ['同名重复', fixture => { fixture.rows.push({ ...copy(fixture.rows[0]), Id: 'duplicate' }); }, 'DUPLICATE'],
  ['大小写重复', fixture => { const row = copy(fixture.rows[0]); row.Id = 'case'; row.FilePath = row.FilePath.toUpperCase(); row.HdfsPath = `${fixture.app.PrivateSourcePath}/${row.FilePath}`; fixture.rows.push(row); }, 'DUPLICATE'],
  ['非法摘要', fixture => { fixture.rows[0].ContentHash = ''; }, 'METADATA'],
  ['单文件超过上限', fixture => { fixture.rows[0].Size = 268435457; }, 'METADATA'],
  ['路径穿越', fixture => { fixture.rows[0].FilePath = '../secret'; }, 'PATH'],
  ['编码路径穿越', fixture => { fixture.rows[0].FilePath = '%2e%2e/secret'; }, 'PATH'],
  ['绝对归档名', fixture => { fixture.rows[0].FilePath = '/package.json'; }, 'METADATA'],
  ['元数据路径与对象后缀不一致', fixture => { fixture.rows[0].HdfsPath = `${fixture.app.PrivateSourcePath}/different.json`; }, 'METADATA'],
  ['当前私有根内运行产物不得伪装源码', fixture => { const row = fixture.rows[0]; row.FilePath = 'upload/v1/index.html'; row.HdfsPath = `${fixture.app.PrivateSourcePath}/${row.FilePath}`; }, 'METADATA']
]) test(`${title}失败关闭且不读取或生成ZIP`, async () => {
  const fixture = sourceFixture(); configure(fixture);
  const run = await runSourceZip(fixture); expectBlocked(run, reason);
  assert.equal(run.state.reads.length + run.state.zips.length, 0);
});

for (const [title, options, reason] of [
  ['请求跨租户', { param: { OsClient: 'other' } }, 'TENANT'],
  ['显式历史版本', { param: { VersionNo: 'v1.0.0' } }, 'VERSION'],
  ['显式版本Id', { param: { VersionId: 'old' } }, 'VERSION'],
  ['AppId与ProjectId冲突', { param: { ProjectId: 'other' } }, 'APPLICATION'],
  ['匿名用户', { userId: '' }, 'FORBIDDEN'],
  ['访问密钥会话', { currentUser: { _AccessKeySession: true } }, 'FORBIDDEN'],
  ['前端伪造Level不能代替当前权威用户', { currentUser: { Level: 9999 }, onUser: state => { state.user.Level = 0; state.app.UserId = 'another'; } }, 'FORBIDDEN'],
  ['缺少权威Level不授予超级权限', { onUser: state => { delete state.user.Level; state.app.UserId = 'another'; } }, 'FORBIDDEN'],
  ['停用用户', { onUser: state => { state.user.State = 0; } }, 'FORBIDDEN'],
  ['删除用户', { onUser: state => { state.user.IsDeleted = 1; } }, 'FORBIDDEN'],
  ['元数据查询失败', { metadataFailure: true }, 'METADATA'],
  ['查询声明丢行', { dataCount: 100 }, 'METADATA'],
  ['HDFS错误', { storageFailure: true }, 'STORAGE'],
  ['HDFS异常', { storageThrow: true }, 'RUNTIME_PrivateBytes'],
  ['ZIP原子失败', { zipFailure: true }, 'ZIP']
]) test(`${title}不输出可发布文件`, async () => { expectBlocked(await runSourceZip(sourceFixture(), options), reason); });

test('可信管理员可导出，但普通非拥有者不能导出', async () => {
  const fixture = sourceFixture(); fixture.app.UserId = 'another'; fixture.user.Level = 9999;
  assert.equal((await runSourceZip(fixture)).result.Code, 1);
  fixture.user.Level = 9998; expectBlocked(await runSourceZip(fixture), 'FORBIDDEN');
});

test('文件数及累计解压大小超限在下载前停止', async () => {
  const tooMany = await runSourceZip(sourceFixture(20001)); expectBlocked(tooMany, 'LIMIT');
  assert.equal(tooMany.state.reads.length + tooMany.state.zips.length, 0);
  const tooLarge = sourceFixture(9); tooLarge.rows.forEach(row => { row.Size = 268435456; });
  const run = await runSourceZip(tooLarge); expectBlocked(run, 'LIMIT');
  assert.equal(run.state.reads.length + run.state.zips.length, 0);
});

test('旧节点原生SHA不可用时兼容算法仍严格核验原始字节', async () => {
  const run = await runSourceZip(sourceFixture(), { nativeHashFailure: true, zipReaderMissing: true });
  assert.equal(run.result.Code, 1); assert.equal(run.state.zips.length, 1);
  const drift = await runSourceZip(sourceFixture(), { nativeHashFailure: true, zipReaderMissing: true, onRead: (state, bytes, param) => { bytes.set(param.FilePathName, Buffer.alloc(bytes.get(param.FilePathName).length, 88)); } });
  expectBlocked(drift, 'HASH'); assert.equal(drift.state.zips.length, 0);
});

test('ES5 raw-byte SHA匹配空、填充边界、二进制与长文件的NodeCrypto权威向量', async () => {
  for (const length of [0, 1, 55, 56, 63, 64, 65, 1000, 131073, 1048576]) {
    const fixture = sourceFixture(1), row = fixture.rows[0], bytes = Buffer.alloc(length);
    for (let index = 0; index < length; index++) bytes[index] = (index * 31 + 255) & 255;
    row.ContentHash = sha256(bytes); row.Size = bytes.length; fixture.bytes.set(row.HdfsPath, bytes);
    const run = await runSourceZip(fixture, { nativeHashFailure: true, zipReaderMissing: true });
    assert.equal(run.result.Code, 1, `raw byte vector length ${length}`);
    assert.deepEqual(Buffer.from(run.state.zips[0].Entries[0].FileByteBase64, 'base64'), bytes);
  }
});

test('现有ExtractZip优先校验最终归档字节，无需Jint逐文件哈希', async () => {
  const run = await runSourceZip(sourceFixture(399), { nativeHashFailure: true });
  assert.equal(run.result.Code, 1); assert.equal(run.state.hashFactories, 0); assert.equal(run.state.zipReads.length, 1);
  assert.deepEqual(run.state.zipReads[0], { MaxFileCount: 20000, MaxEntryBytes: 268435456, MaxTotalBytes: 2147483648, MaxCompressionRatio: 1000 });
  const alias = await runSourceZip(sourceFixture(), { readZipAlias: true, nativeHashFailure: true });
  assert.equal(alias.result.Code, 1); assert.equal(alias.state.zipReads.length, 1); assert.equal(alias.state.hashFactories, 0);
});

for (const [title, options, reason] of [
  ['最终ZIP条目同大小字节篡改', { alterArchive: rows => { rows[0].FileByteBase64 = Buffer.alloc(Buffer.from(rows[0].FileByteBase64, 'base64').length, 88).toString('base64'); } }, 'ZIPVERIFY'],
  ['最终ZIP路径篡改', { alterArchive: rows => { rows[0].Path = 'extra.bin'; } }, 'ZIPVERIFY'],
  ['最终ZIP重复路径', { alterArchive: rows => { rows[1].Path = rows[0].Path; } }, 'ZIPVERIFY'],
  ['最终ZIP增加条目', { alterArchive: rows => { rows.push(copy(rows[0])); } }, 'ZIPVERIFY'],
  ['最终ZIP缺少条目', { alterArchive: rows => { rows.pop(); } }, 'ZIPVERIFY'],
  ['最终ZIP字节大小变化', { alterArchive: rows => { rows[0].FileByteBase64 = Buffer.from('x').toString('base64'); } }, 'ZIPVERIFY'],
  ['解压原子SHA不匹配', { alterReader: data => { data.Entries[0].Sha256 = 'a'.repeat(64); } }, 'ZIPVERIFY'],
  ['解压原子Size不匹配', { alterReader: data => { data.Entries[0].Size++; } }, 'ZIPVERIFY'],
  ['解压原子总量不匹配', { alterReader: data => { data.TotalSize++; } }, 'ZIPVERIFY'],
  ['解压原子计数不匹配', { alterReader: data => { data.FileCount++; } }, 'ZIPVERIFY'],
  ['解压原子失败', { zipReaderFailure: true }, 'ZIPVERIFY'],
  ['解压原子异常', { zipReaderThrow: true }, 'RUNTIME_ZipVerify']
]) test(`${title}既有原子失败不退回、不输出ZIP`, async () => {
  const run = await runSourceZip(sourceFixture(), { ...options, nativeHashFailure: true });
  expectBlocked(run, reason); assert.equal(run.state.zipReads.length, 1); assert.equal(run.state.hashFactories, 0);
});

for (const [title, options, reason, afterZip] of [
  ['同大小字节漂移', { onRead: (state, bytes, param) => { bytes.set(param.FilePathName, Buffer.alloc(bytes.get(param.FilePathName).length, 88)); } }, 'ZIPVERIFY', true],
  ['存储字节大小漂移', { onRead: (state, bytes, param) => { bytes.set(param.FilePathName, Buffer.alloc(1)); } }, 'SIZE', false],
  ['读取期间活动根改变', { onRead: state => { state.app.PrivateSourcePath = state.app.PrivateSourcePath.replace('committed-current', 'new-root'); } }, 'EMPTY', false],
  ['读取期间撤权', { onRead: state => { state.user.State = 0; } }, 'FORBIDDEN', false],
  ['读取期间行摘要改变', { onRead: state => { if (state.reads.length === 3) state.rows[0].ContentHash = 'a'.repeat(64); } }, 'CHANGED', false],
  ['ZIP生成期间活动根改变', { onZip: state => { state.app.PrivateSourcePath = ''; } }, 'BASELINE', true],
  ['ZIP生成期间撤权', { onZip: state => { state.user.State = 0; } }, 'FORBIDDEN', true]
]) test(`${title}拒绝返回旧快照`, async () => {
  const run = await runSourceZip(sourceFixture(), options); expectBlocked(run, reason);
  assert.equal(run.state.zips.length, afterZip ? 1 : 0);
});

test('防御拒绝引擎查询返回的跨租户/历史/目录/删除/非私有行', async () => {
  for (const override of [{ AppId: 'other' }, { VersionId: 'old' }, { StorageScope: 'PublicBuildStream' }, { IsDirectory: 1 }, { IsDeleted: 1 }, { HdfsPath: '/other/ai-app-source/app-source-test/secret' }]) {
    const fixture = sourceFixture(); Object.assign(fixture.rows[0], override);
    const run = await runSourceZip(fixture, { unsafeRows: true }); expectBlocked(run, 'METADATA');
    assert.equal(run.state.reads.length + run.state.zips.length, 0);
  }
});

test('官方完整包正文与独立canonical源码相同，保持Managed归属', async () => {
  const model = JSON.parse(await readFile(new URL('./app.microi.store.json', import.meta.url), 'utf8'));
  const engine = model.SysApiEngines.find(item => item.ApiEngineKey === 'ai_app_download_source_zip');
  assert.equal(engine.ApiV8Code, sourceZipCode);
  assert.equal(engine.Version, sourceZipCode.match(/Version:\s*(v\d+\.\d+\.\d+)/)[1]);
  assert.ok(engine.Version.localeCompare('v1.2.5', undefined, { numeric: true }) >= 0, 'verified compatibility baseline cannot be downgraded');
  assert.match(sourceZipCode, /所属官方应用：应用商城/);
  assert.match(sourceZipCode, /OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
});
