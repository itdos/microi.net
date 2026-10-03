import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

// 测试候选可以指定独立源码；默认始终读取正式唯一源码，不修改运行 API 配置。
const source = await fs.readFile(process.env.MODULE_TEXT_TEST_SOURCE || new URL('./ai-app-publish-store.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0, `missing ${name}`);
  const text = source.slice(start, end < 0 ? source.length : end);
  const closing = text.lastIndexOf('}');
  return text.slice(0, closing + 1);
}
function harness({textResult = {Code:1,Data:'\uFEFF中文模块\r\nexport default "原始正文";'}, urlResult = {Code:1,Data:'https://private.example.test/one-use'}, textMethod=true}={}) {
  const calls=[], bytes=Buffer.from([0,255,1,239,187,191]), context={
    V8:{OsClient:'test-tenant',Method:{GetPrivateFileUrl(p){calls.push({Kind:'URL',Params:structuredClone(p)});return urlResult;}},
      Base64:{StringToBase64(v){return Buffer.from(String(v),'utf8').toString('base64');}},
      Http:{GetResponse(p){calls.push({Kind:'HTTP',Params:structuredClone(p)});return {RawBytes:bytes};}}},
    System:{Convert:{ToBase64String(v){return Buffer.from(v).toString('base64');}}}
  };
  if(textMethod)context.V8.Method.GetPrivateFileText=p=>{calls.push({Kind:'Text',Params:structuredClone(p)});if(textResult instanceof Error)throw textResult;return textResult;};
  vm.createContext(context);vm.runInContext(['text','isBlank','readFileBase64','isTextFile'].map(extract).join('\n'),context);
  return {calls,bytes,context,read(path,limit=true){return context.readFileBase64('/test-tenant/current-source/'+path,context.isTextFile(path),limit);}};
}

for(const suffix of ['.mjs','.cjs','.mts','.cts'])test(`现代 ${suffix} 源码使用当前租户文本字节读取，不发行额外浏览器审计URL`,()=>{
  const h=harness(),path='nested/module'+suffix;
  assert.equal(h.context.isTextFile(path),true);
  const base64=h.read(path);assert.equal(Buffer.from(base64,'base64').toString('utf8'),'\uFEFF中文模块\r\nexport default "原始正文";');
  assert.deepEqual(h.calls,[{Kind:'Text',Params:{OsClient:'test-tenant',FilePathName:'/test-tenant/current-source/'+path,Limit:true}}]);
});

test('大小写现代扩展和历史文本扩展仍只读取准确原文件',()=>{
  for(const path of ['entry.MJS','types.d.MTS','entry.CTS','package.json','legacy.js','style.css','component.vue','README','file.md','script.ts']){
    const h=harness();h.read(path);assert.equal(h.calls.length,1);assert.equal(h.calls[0].Kind,'Text');assert.equal(h.calls[0].Params.FilePathName,'/test-tenant/current-source/'+path);
  }
});

test('二进制扩展、脚本后附伪扩展及路径后缀不误转UTF8，原RawBytes逐字节保留',()=>{
  for(const path of ['image.png','font.woff2','file.zip','module.mjs.png','module.mts.bin','module.mjs/']){
    const h=harness();assert.equal(h.context.isTextFile(path),false);assert.equal(h.read(path),h.bytes.toString('base64'));assert.deepEqual(h.calls.map(x=>x.Kind),['URL','HTTP']);
  }
});

test('文本原子Code0或Code2保持原审计URL回退且固定当前租户和原Limit',()=>{
  for(const Code of [0,2]){const h=harness({textResult:{Code,Msg:'first read unavailable'}});assert.equal(h.read('module.mjs',false),h.bytes.toString('base64'));assert.deepEqual(h.calls.map(x=>x.Kind),['Text','URL','HTTP']);assert.equal(h.calls[0].Params.Limit,false);assert.equal(h.calls[1].Params.Limit,false);assert.equal(h.calls[1].Params.OsClient,'test-tenant');}
});

test('缺少历史文本原子的旧宿主仍保留原已授权URL回退',()=>{
  const h=harness({textMethod:false});assert.equal(h.read('module.mjs'),h.bytes.toString('base64'));assert.deepEqual(h.calls.map(x=>x.Kind),['URL','HTTP']);
});

test('既有私有审计票据失败保持失败关闭，不能输出URL或触发HTTP旁路',()=>{
  const h=harness({textResult:{Code:0},urlResult:{Code:0,Msg:'private audit unavailable'}});assert.throws(()=>h.read('module.mjs'),/private audit unavailable/);assert.deepEqual(h.calls.map(x=>x.Kind),['Text','URL']);
});

test('文本原子真实异常继续拒绝，不在异常时自动发行另一访问URL',()=>{
  const h=harness({textResult:new Error('permission revoked')});assert.throws(()=>h.read('module.mjs'),/permission revoked/);assert.deepEqual(h.calls.map(x=>x.Kind),['Text']);
});

test('同一文本读取返回空文件仍是Code1准确字节，无额外URL和网络读取',()=>{
  const h=harness({textResult:{Code:1,Data:''}});assert.equal(h.read('empty.mjs'),'');assert.deepEqual(h.calls.map(x=>x.Kind),['Text']);
});
