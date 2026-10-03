import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const draft = readFileSync(path.join(here, 'official-ai-app-cdn-backfill.v8.js'), 'utf8');
const h = input => createHash('sha256').update(input).digest('hex');
// 与 V8ObjectHashStream 相同：WireSha256 是原始字节的 Base64 ASCII 文本摘要。
const hashBase64 = bytes => h(Buffer.from(bytes).toString('base64'));
const clone = input => JSON.parse(JSON.stringify(input));
const manifestHash = rows => h(rows.toSorted((a,b) => a.Path < b.Path ? -1 : a.Path > b.Path ? 1 : 0)
  .map(a => `${a.Path}\t${a.Sha256}\t${a.Size}`).join('\n'));
function fixture(count = 6) {
  const data = { storeReads: 0, copies: [], writes: [], primaryReads: [], objects: new Map(), calls: [], count };
  data.store = { Id: 'app-id', AppKey: 'test-game', CurrentVersion: 3, PublishFence: 4,
    PublishRowVersion: 4, ActivePublishVersionId: 'mciav-a', CommittedPublishVersionId: 'mciav-a',
    PublishState: 'RepairRequired' };
  data.version = { Id: 'mciav-a', AppId: 'app-id', VersionNo: 'v1.3.0', PublishProtocolVersion: 3,
    PublishState: 'RepairRequired', RequestId: 'test-game:v1.3.0:abcdef', RequestFingerprint: 'a'.repeat(64),
    FencingToken: 4, EntryPath: 'index.html' };
  data.version.ReleasePrefix = 'microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/test-game/releases/v1.3.0/requests/' + 'a'.repeat(64);
  data.manifest = [{Path: 'index.html', Sha256: h('index'), Size: 5, IsEntry: true}];
  for (let i = 0; i < count; i++) {
    const bytes = Buffer.from(JSON.stringify({ id: i, serialized: 'Cocos import asset' }));
    const asset = {Path: `assets/resources/import/0a/resource-${i}@f9941.dead0.json`, Sha256: h(bytes), Size: bytes.length, IsEntry: false};
    data.manifest.push(asset);
    data.objects.set(`itdos/micro-app/test-game/v1.3.0/${asset.Path.replace('@','%40')}`, bytes);
  }
  data.commitManifest = () => {
    data.version.AssetManifestJson = JSON.stringify(data.manifest);
    data.version.RuntimeManifestHash = manifestHash(data.manifest);
    data.store.CommittedRuntimeManifestHash = data.version.RuntimeManifestHash;
    if (data.param) {
      data.param.ExpectedRuntimeManifestHash = data.version.RuntimeManifestHash;
      data.param.ExpectedCommittedRuntimeManifestHash = data.version.RuntimeManifestHash;
    }
  };
  data.commitManifest();
  data.param = {Action: 'RepairCommittedCdnAliases', AppId:'app-id', ConfirmAppId: 'app-id',
    ExpectedAppKey: 'test-game', ExpectedVersionId: 'mciav-a', ExpectedVersionNo: 'v1.3.0',
    ExpectedRequestId: data.version.RequestId, ExpectedRequestFingerprint: data.version.RequestFingerprint,
    ExpectedRuntimeManifestHash: data.version.RuntimeManifestHash, ExpectedCommittedPublishVersionId: 'mciav-a',
    ExpectedCommittedRuntimeManifestHash: data.version.RuntimeManifestHash, ExpectedCurrentVersion: '3',
    ExpectedPublishFence: '4', ExpectedPublishRowVersion: '4', AliasStart: 0, AliasCount: 2, DryRun: false};
  data.base = 'itdos/micro-app/test-game/';
  data.target = index => data.base + 'v1.3.0/' + data.manifest[index + 1].Path;
  data.fixed = index => data.base + data.manifest[index + 1].Path;
  data.source = index => data.target(index).replace('@', '%40');
  data.run = () => {
    const V8 = { Param: data.param, OsClient: 'iTdos', CurrentUser: {Level: data.level ?? 9999},
      SysConfig: {FileServer: 'https://static.itdos.com'},
      EncryptHelper: { Sha256Hex: h },
      FormEngine: new Proxy({
        GetFormData(table, params) {
          if (table === 'sys_microistore') {
            data.storeReads++;
            data.onStoreRead?.(data.storeReads);
            return {Code: 1, Data: clone(data.replicaStore ?? data.store)};
          }
          assert.equal(table, 'mci_ai_app_version');
          assert.equal(params.Id, data.version.Id);
          return {Code:1, Data: clone(data.version)};
        },
        GetTableData(table) { assert.equal(table,'mci_ai_app_version'); return {Code:1,Data:[clone(data.version)]}; }
      }, {get(target, key) { if (!(key in target)) return () => {data.writes.push(key);throw new Error('DB mutation forbidden');}; return target[key]; }}),
      Db: {
        FromSql(sql) {
          // 主库夹具只允许正式动作的两条参数化只读查询，任何写语句直接失败。
          const match=/^SELECT [A-Za-z,]+ FROM (sys_microistore|mci_ai_app_version) WHERE Id=@Id$/.exec(sql);
          assert.ok(match, 'Unexpected SQL: '+sql);
          data.primaryReads.push(sql);
          if(data.primaryThrows) throw new Error('primary database unavailable');
          const table=match[1];let boundId;
          return {
            AddInParameter(name,id) {assert.equal(name,'@Id');boundId=id;return this;},
            First() {
              if(data.primaryMissing)return null;
              if(table==='sys_microistore') {
                assert.equal(boundId,data.store.Id);data.storeReads++;data.onStoreRead?.(data.storeReads);
                return clone(data.store);
              }
              assert.equal(boundId,data.version.Id);return clone(data.version);
            }
          };
        }
      },
      Method: {
        ObjectExist(params) {
          assert.equal(params.Limit,false); assert.equal(params.OsClient,'iTdos');
          data.onExist?.(params.FilePathName);
          data.calls.push(['exists', params.FilePathName]);
          return {Code:1,Data:data.objects.has(params.FilePathName)};
        },
        GetObjectSha256(params) {
          assert.equal(params.Limit,false);
          data.onDigest?.(params.FilePathName);
          const bytes = data.objects.get(params.FilePathName);
          if (!bytes) return {Code:0,Msg:'NoSuchKey'};
          return {Code:1,Data:{Sha256:h(bytes),WireSha256:data.wireFor?.(params.FilePathName,bytes) ?? data.wireOverride ?? hashBase64(bytes),Size:bytes.length}};
        },
        CopyObject(params) {
          assert.equal(params.Limit,false); assert.equal(params.OsClient,'iTdos');
          assert.ok(!params.FilePathName.includes('https:'));
          data.copies.push(clone(params));
          data.onCopy?.(params);
          if (data.copyFails) return {Code:0,Msg:'storage unavailable'};
          const source = data.objects.get(params.FilePathName);
          assert.ok(source); data.objects.set(params.Path, Buffer.from(data.copyCorrupt ? 'wrong' : source));
          return {Code:1};
        }
      }
    };
    if (data.missingMethod) delete V8.Method[data.missingMethod];
    if (data.missingPrimary) delete V8.Db;
    return vm.runInNewContext('(function(V8){' + draft + '\n})(V8)', {V8}, {timeout: 3000});
  };
  return data;
}
function refuses(f, pattern, copies = 0) { const r=f.run(); assert.equal(r.Code,0,JSON.stringify(r));
  if(pattern) assert.match(r.Msg,pattern); assert.equal(f.copies.length,copies); assert.equal(f.writes.length,0);return r; }
test('default DryRun verifies frozen canonical hash and plans aliases without writing', () => {
  const f=fixture();delete f.param.DryRun; const before=JSON.stringify([f.store,f.version]);const r=f.run();
  assert.equal(r.Code,1,JSON.stringify(r));assert.equal(r.Data.DryRun,true);assert.equal(r.Data.AliasCount,2);
  assert.equal(r.Data.TotalAliases,6);assert.equal(r.Data.NextAliasStart,2);assert.equal(f.copies.length,0);
  assert.equal(JSON.stringify([f.store,f.version]),before);assert.equal(f.writes.length,0);
});
test('JObject-shaped inherited empty Path getter does not become a caller selector', () => {
  const f=fixture();delete f.param.DryRun;let inheritedReads=0;
  // 模拟 CLR JObject 暴露 JToken.Path；请求本身没有这个字段。
  const clrPrototype=Object.create(null);
  Object.defineProperty(clrPrototype,'Path',{enumerable:true,get(){inheritedReads++;return '';}});
  Object.setPrototypeOf(f.param,clrPrototype);
  const r=f.run();assert.equal(r.Code,1,JSON.stringify(r));assert.equal(r.Data.DryRun,true);
  assert.equal(f.copies.length,0);assert.equal(inheritedReads,0);
});
test('JObject-shaped params retain explicit authorized copy fields after normalization', () => {
  const f=fixture();Object.setPrototypeOf(f.param,{get Path(){return '';}});
  const r=f.run();assert.equal(r.Code,1,JSON.stringify(r));assert.equal(r.Data.DryRun,false);
  assert.equal(f.copies.length,4);assert.equal(f.writes.length,0);
});
test('explicit own empty Path remains forbidden even with a CLR-shaped prototype', () => {
  const f=fixture();Object.setPrototypeOf(f.param,{get Path(){return '';}});
  Object.defineProperty(f.param,'Path',{value:'',enumerable:true});
  refuses(f,/不接受调用方路径\/来源参数：Path/);assert.equal(f.calls.length,0);
});
test('inherited expected binding cannot substitute for an explicit request field', () => {
  const f=fixture();delete f.param.ExpectedPublishFence;
  Object.setPrototypeOf(f.param,{ExpectedPublishFence:'4'});
  refuses(f,/ExpectedPublishFence 缺失/);assert.equal(f.calls.length,0);
});
for (const state of ['ProjectionPending','RepairRequired','Completed']) test(state+' repairs both raw canonical aliases and preserves encoded sources', () => {
  const f=fixture();f.store.PublishState=state;f.version.PublishState=state;const before=JSON.stringify([f.store,f.version]);
  const r=f.run();assert.equal(r.Code,1,JSON.stringify(r));assert.equal(f.copies.length,4);
  for(let i=0;i<2;i++) {assert.deepEqual(f.objects.get(f.target(i)),f.objects.get(f.source(i)));
    assert.deepEqual(f.objects.get(f.fixed(i)),f.objects.get(f.source(i)));}
  assert.equal(JSON.stringify([f.store,f.version]),before);assert.equal(r.Data.PublicationCompletedByThisAction,false);
  assert.equal(r.Data.AtomicCreateOnly,false);assert.equal(f.writes.length,0);
});
test('replay skips existing exact aliases, including size verification', () => {
  const f=fixture();assert.equal(f.run().Code,1);f.copies.length=0;assert.equal(f.run().Code,1);assert.equal(f.copies.length,0);
});
test('five aliases max and next cursor never includes arbitrary runtime objects', () => {
  const f=fixture();f.param.AliasCount=5;const r=f.run();assert.equal(r.Code,1);assert.equal(f.copies.length,10);assert.equal(r.Data.NextAliasStart,5);
  f.copies.length=0;f.param.AliasStart=5;assert.equal(f.run().Data.AliasCount,1);assert.equal(f.copies.length,2);
});
for (const [field, val] of [['AliasCount',6],['AliasCount',0],['AliasCount',1.2],['AliasStart',-1],['AliasStart',6],['AliasStart','0e1'],['DryRun','0']])
  test('rejects invalid '+field+'='+val, () => {const f=fixture();f.param[field]=val;refuses(f);});
for (const field of ['ExpectedAppKey','ExpectedVersionId','ExpectedVersionNo','ExpectedRequestId','ExpectedRequestFingerprint','ExpectedRuntimeManifestHash',
  'ExpectedCommittedPublishVersionId','ExpectedCommittedRuntimeManifestHash','ExpectedCurrentVersion','ExpectedPublishFence','ExpectedPublishRowVersion']) {
  test('requires explicit binding '+field, () => {const f=fixture();delete f.param[field];refuses(f,/缺失/);});
  test('rejects stale binding '+field, () => {const f=fixture();f.param[field]=field.includes('Hash')||field.includes('Fingerprint')?'f'.repeat(64)
    :field==='ExpectedVersionNo'?'v9.9.9':field==='ExpectedCurrentVersion'||field.includes('Fence')||field.includes('RowVersion')?'99':'other';refuses(f);});
}
test('rejects admin downgrade before any storage access',()=>{const f=fixture();f.level=10;refuses(f,/管理员/);assert.equal(f.calls.length,0);});
test('requires existing explicit app confirmation',()=>{const f=fixture();f.param.ConfirmAppId='other';refuses(f,/ConfirmAppId/);});
for(const state of ['ReleaseVerified','Verifying','PointerCommitted','Superseded']) test('rejects unsupported state '+state,()=>{
  const f=fixture();f.version.PublishState=state;refuses(f,/仅允许/);
});
for(const field of ['SourcePath','StagePath','FilePathName','Path','DestPath','Bucket','Limit','AssetsJson','AssetManifestJson'])
  test('rejects caller object selector '+field,()=>{const f=fixture();f.param[field]='https://external.example/x';refuses(f,/不接受/);});
test('whole-batch preflight refuses existing conflict in later alias before writing earlier alias',()=>{
  const f=fixture();f.objects.set(f.fixed(1),Buffer.from('existing different content'));refuses(f,/异字节/);
});
test('wrong source bytes reject even when canonical aliases missing',()=>{const f=fixture();f.objects.set(f.source(0),Buffer.from('wrong'));refuses(f,/异字节/);});
test('missing encoded source fails closed with no upload or URL fallback',()=>{const f=fixture();f.objects.delete(f.source(0));refuses(f,/不存在/);});
test('raw manifest hash and distinct Base64 wire hash accept the real primitive contract',()=>{
  const f=fixture();const bytes=f.objects.get(f.source(0));assert.notEqual(h(bytes),hashBase64(bytes));
  const r=f.run();assert.equal(r.Code,1,JSON.stringify(r));assert.equal(f.copies.length,4);
  const first=r.Data.Inspected[0];assert.equal(first.SourceDigest.Sha256,h(bytes));
  assert.equal(first.SourceDigest.WireSha256,hashBase64(bytes));
  assert.equal(r.Data.Copied[0].WireSha256,first.SourceDigest.WireSha256);
});
test('raw mismatch is rejected even when wire hash happens to equal the frozen raw hash',()=>{
  const f=fixture();const original=f.objects.get(f.source(0));
  f.objects.set(f.source(0),Buffer.alloc(original.length,0));f.wireOverride=f.manifest[1].Sha256;
  refuses(f,/异字节/);assert.equal(f.calls.filter(c=>c[1]===f.target(0)).length,0);
});
for(const malformed of ['', 'not-a-hash', 'f'.repeat(63), 'g'.repeat(64)])
  test('malformed source wire digest fails closed: '+JSON.stringify(malformed),()=>{
    const f=fixture();f.wireOverride=malformed;refuses(f,/wire hash 格式/);
  });
test('existing target with same raw bytes but different wire digest fails preflight',()=>{
  const f=fixture();f.objects.set(f.target(0),f.objects.get(f.source(0)));
  f.wireFor=p=>p===f.target(0)?'f'.repeat(64):undefined;
  refuses(f,/wire hash 与来源/);
});
test('post-copy target wire mismatch stops after the first attempted alias',()=>{
  const f=fixture();f.wireFor=p=>p===f.target(0)?'f'.repeat(64):undefined;
  const r=refuses(f,/wire hash 与来源/,1);assert.equal(r.Data.RequiresReadback,true);
  assert.equal(r.Data.Copied.length,1);assert.equal(r.Data.Copied[0].WireSha256,undefined);
});
test('source wire drift after preflight is rejected before copy despite matching raw bytes',()=>{
  const f=fixture();let digests=0;
  f.wireFor=p=>p===f.source(0)&&++digests>1?'f'.repeat(64):undefined;
  refuses(f,/wire hash 与来源/);
});
test('same hash field with forged size is rejected by actual object length',()=>{
  const f=fixture();f.manifest[1].Size++;f.commitManifest();refuses(f,/异字节/);
});
test('full frozen manifest canonical hash is recomputed, not trusted from row alone',()=>{
  const f=fixture();f.manifest[0].Size++;f.version.AssetManifestJson=JSON.stringify(f.manifest);refuses(f,/CanonicalManifestHash/);
});
for(const bad of ['../x@f9941.json','assets/resources/import/0a/../secret@f9941.json','assets/resources/import/0a/x%40f9941.json',
  'https://other/x@f9941.json','/itdos/x@f9941.json','assets/scripts/private@f9941.ts','SOURCE@f9941.json',
  'assets/resources/import/0a/a\\b@f9941.json']) test('rejects source or traversal path '+bad,()=>{
  const f=fixture();f.manifest[1].Path=bad;f.commitManifest();refuses(f);
});
test('explicit private-scoped import JSON is refused',()=>{const f=fixture();f.manifest[1].StorageScope='Private';f.commitManifest();refuses(f,/public runtime/);});
test('duplicate manifest paths reject even with case changes',()=>{
  const f=fixture();f.manifest.push({...f.manifest[1],Path:f.manifest[1].Path.toUpperCase()});f.commitManifest();refuses(f,/重复/);
});
test('derived release identity must match exact current tenant/app/version/fingerprint',()=>{
  const f=fixture();f.version.ReleasePrefix=f.version.ReleasePrefix.replace('/itdos/','/another/');refuses(f,/ReleasePrefix/);
});
test('new active publish version aborts before copy',()=>{const f=fixture();f.store.ActivePublishVersionId='new-version';refuses(f,/ActiveVersionId/);});
test('version fencing token must equal current publication fence',()=>{const f=fixture();f.version.FencingToken=3;refuses(f,/FencingToken/);});
test('pre-copy fresh store read stops after concurrent pointer change',()=>{
  const f=fixture();f.onStoreRead=n=>{if(n===3)f.store.CommittedPublishVersionId='newer';};refuses(f,/CommittedVersion/);
});
test('post-copy changed binding returns honest partial evidence and stops remaining objects',()=>{
  const f=fixture();f.onCopy=()=>{f.store.PublishRowVersion++;};const r=refuses(f,/PublishRowVersion/,1);
  assert.equal(r.Data.Copied.length,1);assert.equal(r.Data.Attempted.length,1);assert.equal(r.Data.RequiresReadback,true);
  assert.ok(f.objects.has(f.target(0)));assert.ok(!f.objects.has(f.fixed(0)));
});
test('changed frozen manifest mid-flight aborts without copy',()=>{
  const f=fixture();
  f.onStoreRead=n=>{if(n===3)f.version.AssetManifestJson=f.version.AssetManifestJson.replace('index.html','other.html');};
  refuses(f,/AssetManifestJson/);
});
test('target becomes conflicting after preflight: recheck prevents overwrite',()=>{
  const f=fixture();let seen=0;f.onExist=p=>{if(p===f.target(0)&&++seen===2)f.objects.set(p,Buffer.from('racing other bytes'));};refuses(f,/异字节/);
});
test('failed copy reports uncertain side effect and requires readback',()=>{
  const f=fixture();f.copyFails=true;const r=refuses(f,/复制失败/,1);assert.equal(r.Data.Copied.length,0);assert.equal(r.Data.RequiresReadback,true);
});
test('corrupted copied bytes fail post-write verification and do not delete anything',()=>{
  const f=fixture();f.copyCorrupt=true;const r=refuses(f,/异字节/,1);assert.equal(r.Data.RequiresReadback,true);assert.ok(f.objects.has(f.target(0)));
});
for(const method of ['ObjectExist','GetObjectSha256','CopyObject']) test('required capability '+method+' fails closed',()=>{
  const f=fixture();f.missingMethod=method;refuses(f,/缺少可信/);
});
test('fixed primary read helper rejects unknown tables before SQL execution',()=>{
  const begin=draft.indexOf('function readCommittedCdnAliasPrimaryRow(');
  const end=draft.indexOf('function repairCommittedCdnAliases()',begin);
  assert.ok(begin>0&&end>begin);
  let calls=0;
  const readPrimary=vm.runInNewContext('('+draft.slice(begin,end).trim()+')',
    {V8:{Db:{FromSql(){calls++;throw new Error('should not execute');}}}});
  assert.throws(()=>readPrimary('sys_user','id'),/固定白名单/);assert.equal(calls,0);
});
test('primary read exception fails closed with no object mutation',()=>{
  const f=fixture();f.primaryThrows=true;refuses(f,/primary database unavailable/);assert.equal(f.calls.length,0);
});
test('missing primary capability fails closed without replica fallback',()=>{
  const f=fixture();f.missingPrimary=true;refuses(f,/主库读取能力/);assert.equal(f.calls.length,0);
});
test('missing primary row fails closed without replica fallback',()=>{
  const f=fixture();f.primaryMissing=true;refuses(f,/主库发布绑定失败/);assert.equal(f.calls.length,0);
});
test('stale FormEngine replica cannot hide a changed primary publication fence',()=>{
  const f=fixture();f.replicaStore=clone(f.store);f.store.PublishFence++;
  refuses(f,/PublishFence/);assert.ok(f.primaryReads.length>=2);assert.equal(f.calls.length,0);
});
test('stale FormEngine replica cannot hide a changed primary committed pointer',()=>{
  const f=fixture();f.replicaStore=clone(f.store);f.store.CommittedPublishVersionId='new-committed';
  refuses(f,/CommittedVersion/);assert.ok(f.primaryReads.length>=2);assert.equal(f.calls.length,0);
});
test('147-file generic Cocos manifest keeps 39 aliases and validates every in-memory source',()=>{
  // 用固定通用资源构造大清单，正式回归不依赖任务目录、真实租户或游戏产物。
  const f=fixture(39);
  for(let i=0;i<107;i++) {
    const bytes=Buffer.from('compiled-runtime-asset-'+i);
    f.manifest.push({Path:'assets/main/native/0a/fixture-'+String(i).padStart(3,'0')+'.bin',Sha256:h(bytes),Size:bytes.length,IsEntry:false});
  }
  f.commitManifest();delete f.param.DryRun;f.param.AliasCount=5;
  assert.equal(f.manifest.length,147);
  let checked=0;
  for(let cursor=0;cursor<39;cursor+=5) {
    f.param.AliasStart=cursor;const r=f.run();assert.equal(r.Code,1,JSON.stringify(r));
    assert.equal(r.Data.TotalAliases,39);checked+=r.Data.AliasCount;
    for(const item of r.Data.Inspected) {
      const bytes=f.objects.get(item.Source);assert.equal(h(bytes),item.Asset.Sha256);assert.equal(bytes.length,item.Asset.Size);
      assert.ok(item.Targets.every(target=>target.Missing));
    }
  }
  assert.equal(checked,39);assert.equal(f.copies.length,0);
});
