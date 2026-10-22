import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

async function run(result, enabled, hook = { Code: 1 }) {
  const source = fs.readFileSync(new URL('./platform-hdfs-upload.js', import.meta.url), 'utf8');
  let calls = 0;
  const context = vm.createContext({ V8: {
    CurrentUser: { Id: 'upload-user' }, Param: {},
    Method: {
      UploadCurrentRequestAsync: async () => { calls++; return structuredClone(result); },
      IsLegacyUploadCompatibilityEnabled: () => enabled,
    },
    ApiEngine: { Run: () => hook },
  } });
  const response = await new vm.Script(`(async function(){${source}\n})()`).runInContext(context);
  return { response: JSON.parse(JSON.stringify(response)), calls };
}
const file = { Path: '/tenant/img/202609/前.jpg', Name: '前.jpg', Size: 575599,
  Id: 'new-id', Url: 'https://example.test/private-ticket', Limit: true, OriginalSize: 600000 };

test('三个精确 POST 上传地址先进入可信文件流桥，再由桥权威选择接口引擎', () => {
  const route = fs.readFileSync(new URL('../../Microi.net.Api/Handler/DynamicApiEngine.cs', import.meta.url), 'utf8');
  const matcher = route.match(/internal static bool IsHdfsUploadProtocolRoute\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(matcher, 'DynamicRoute 必须保留精确上传协议桥，不能直接执行依赖流上下文的 Managed V8');
  assert.match(matcher[1], /if\s*\(!HttpMethods\.IsPost\(requestMethod\)\)\s*return false;/);
  assert.deepEqual([...matcher[1].matchAll(/string\.Equals\(requestPath, "([^"]+)", StringComparison\.OrdinalIgnoreCase\)/g)]
    .map(match => match[1]).sort(), ['/api/hdfs/upload', '/api/upload', '/apiengine/platform-hdfs-upload']);
  assert.doesNotMatch(matcher[1], /StartsWith|Regex|NormalizeApiEngineRouteAddress/);
  const dispatch = route.indexOf('if (IsHdfsUploadProtocolRoute(requestMethod, originalPath))');
  assert.ok(dispatch >= 0 && dispatch < route.indexOf('var addressCacheKey ='), '文件流协议桥必须先于通用缓存路由执行');
  assert.match(route, /if \(IsHdfsUploadProtocolRoute\(requestMethod, originalPath\)\)\s*\{\s*return null;\s*\}/,
    '三个协议必须撤销动态候选，交精确 attribute 上传端点唯一匹配，不能按 controller/action 展开全部别名');
  const bridge = fs.readFileSync(new URL('../../Microi.net.Api/Controllers/HDFSController.UploadApiEngine.cs', import.meta.url), 'utf8');
  assert.match(bridge, /ResolveConfiguredEngine/);
  assert.match(bridge, /GetConfiguredModel/);
  assert.match(bridge, /GetConfiguredByMultiRoute/);
  assert.match(bridge, /if \(configured.Code != 1\) return Json\(configured\);/);
  assert.ok(bridge.indexOf('if (configured.Data == null)') < bridge.indexOf('"CompiledFallback"'));
  assert.ok(bridge.indexOf('"IsEnable"') < bridge.indexOf('HdfsUploadRequestContext.Enter'));
  assert.ok(bridge.indexOf('"StopHttp"') < bridge.indexOf('HdfsUploadRequestContext.Enter'));
});

test('开关关闭保留新版对象及数组协议', async () => {
  for (const data of [file, [file]]) {
    const input = { Code: 1, Data: data, DataAppend: { Preserved: true } };
    const output = await run(input, false);
    assert.deepEqual(output.response, input);
    assert.equal(output.calls, 1);
  }
});
test('开启时单文件也恢复旧数组并补属性，私有地址不改为公有', async () => {
  for (const data of [file, [file], [file, file]]) {
    const { response } = await run({ Code: 1, Data: data }, true);
    assert.equal(Array.isArray(response.Data), true);
    assert.equal(response.Data.length, Array.isArray(data) ? data.length : 1);
    const row = response.Data[0];
    for (const [key, value] of Object.entries(file)) assert.deepEqual(row[key], value);
    assert.deepEqual({ url: row.url, type: row.type, size: row.size, duration: row.duration,
      uploading: row.uploading, progress: row.progress, path: row.path, name: row.name, id: row.id },
    { url: file.Url, type: 'image', size: 575599, duration: 0, uploading: false,
      progress: 100, path: file.Path, name: '前', id: file.Id });
  }
});
test('图片视频音频普通附件与无扩展名的旧类型、名称契约', async () => {
  for (const [name, type, legacyName] of [['A.GIF','image','A'],['a.mp4','video','a'],
    ['a.mp3','audio','a'],['a.pdf','file','a'],['README','file','README'],['a.b.jpeg','image','a.b']]) {
    const { response } = await run({ Code: 1, Data: { ...file, Name: name } }, true);
    assert.equal(response.Data[0].type, type);
    assert.equal(response.Data[0].name, legacyName);
  }
});
test('上传失败不美化为完成状态，Hook 支持扩展返回', async () => {
  const failure = { Code: 0, Msg: 'quota denied', Data: null };
  assert.deepEqual((await run(failure, true)).response, failure);
  const custom = { Code: 1, Data: { ...file, BusinessTag: 'custom' } };
  assert.deepEqual((await run({ Code: 1, Data: file }, true, { Code: 1, UploadResult: custom })).response, custom);
});

test('新租户与存量包均带可空默认关闭字段，上传引擎只有一个包拥有', () => {
  const packages = ['app.microi.sys-config.json','app.microi.saas-engine.json'].map(name =>
    JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8')));
  for (const pkg of packages) {
    const field = pkg.DiyFields.find(row => row.Name === 'CompatiblePlatformOldVersion');
    assert.equal(field.Component,'Switch');assert.equal(String(field.DefaultValue),'0');
    assert.equal(field.Visible,1);assert.equal(field.AppVisible,1);
    const col=pkg.PhysicalColumns.find(row => row.COLUMN_NAME===field.Name);
    assert.equal(col.IS_NULLABLE,'YES');
    assert.ok(pkg.DDLStatements.some(row=>row.DDL.includes('`CompatiblePlatformOldVersion` int NULL')));
    for(const set of pkg.DataSets||[]) if(String(set.TableName).toLowerCase()==='sys_config')
      assert.ok((set.Rows||[]).every(row=>!Object.hasOwn(row,field.Name)));
  }
  for(const key of ['platform-hdfs-upload','platform-hdfs-upload-hook']){
    assert.equal(packages.flatMap(pkg=>pkg.SysApiEngines).filter(row=>row.ApiEngineKey===key).length,1);
    assert.equal(packages[0].ResourcePolicies.ApiEngines[key].UpgradePolicy,key.endsWith('-hook')?'CreateIfMissing':'Managed');
  }
});
