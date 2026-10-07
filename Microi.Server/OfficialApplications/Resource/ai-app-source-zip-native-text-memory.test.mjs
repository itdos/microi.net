import test from 'node:test';import assert from 'node:assert/strict';
import {runSourceZip,sourceFixture,sha256} from './ai-app-source-zip-harness.mjs';
function fixture(content,path='manifest.json'){
 const value=sourceFixture(1),row=value.rows[0];value.bytes.clear();row.FilePath=path;row.HdfsPath=value.app.PrivateSourcePath+'/'+path;row.Size=content.length;row.ContentHash=sha256(content);value.bytes.set(row.HdfsPath,content);return value;
}
// 六套系统的实际大 Manifest 会通过 CLR byte[] 的 Copy 转换产生大量 Jint 分配。
// 原生字符串仅在与原始字节摘要完全一致时采用；最终归档仍逐条校验。
test('大 UTF8 Manifest 导出复用既有文本/编码原子，避免 CLR 原始字节数组进入 Jint',async()=>{
 const bytes=Buffer.from(JSON.stringify({Title:'吾码',Entries:'业务原始数据\n'.repeat(400000)})),value=fixture(bytes);
 assert.ok(bytes.length>6*1024*1024);
 const result=await runSourceZip(value,{nativeTextRead:true});assert.equal(result.result.Code,1);assert.equal(result.state.textReads.length,1);assert.equal(result.state.reads.length,0);assert.equal(result.state.zipReads.length,1);
 assert.equal(result.state.textReads[0].MaxBytes,bytes.length);assert.deepEqual(Buffer.from(result.state.zips[0].Entries[0].FileByteBase64,'base64'),bytes);
});
test('BOM、换行和 UTF8 非 ASCII 字节均原样保留',async()=>{
 for(const bytes of [Buffer.alloc(0),Buffer.from('\ufeff中文\r\n😀\n')]){const r=await runSourceZip(fixture(bytes),{nativeTextRead:true});assert.equal(r.result.Code,1);assert.equal(r.state.reads.length,0);assert.deepEqual(Buffer.from(r.state.zips[0].Entries[0].FileByteBase64,'base64'),bytes);}
});
test('二进制内容不能通过有损 UTF8 解码替换，即使文件名为 JSON',async()=>{
 const bytes=Buffer.from([0,255,128,13,10]),r=await runSourceZip(fixture(bytes),{nativeTextRead:true});assert.equal(r.result.Code,1);assert.equal(r.state.textReads.length,1);assert.equal(r.state.reads.length,1);assert.deepEqual(Buffer.from(r.state.zips[0].Entries[0].FileByteBase64,'base64'),bytes);
});
for(const [name,options]of [['文本读取失败',{textStorageFailure:true}],['文本读取异常',{textStorageThrow:true}]])test(name+'不能退回另一条存储路径',async()=>{
 const r=await runSourceZip(fixture(Buffer.from('source')),{nativeTextRead:true,...options});assert.equal(r.result.Code,0);assert.equal(r.state.reads.length+r.state.zips.length,0);assert.equal(r.state.textReads.length,1);
});
test('读取期间同尺寸文本字节改变，最终归档仍被拒绝',async()=>{
 const r=await runSourceZip(fixture(Buffer.from('source')),{nativeTextRead:true,onTextRead:(state,bytes,param)=>bytes.set(param.FilePathName,Buffer.from('tamper'))});assert.equal(r.result.Code,0);assert.equal(r.result.Reason,'SOURCE_ZIP_ZIPVERIFY');assert.equal(r.state.zipReads.length,1);
});
test('新路径仍核验最终 ZIP 的实际字节摘要',async()=>{
 const r=await runSourceZip(fixture(Buffer.from('source')),{nativeTextRead:true,alterArchive:rows=>rows[0].FileByteBase64=Buffer.from('tamper').toString('base64')});assert.equal(r.result.Code,0);assert.equal(r.result.Reason,'SOURCE_ZIP_ZIPVERIFY');
});
test('缺少文本原子的旧宿主保留完整原始字节兼容路径',async()=>{
 const bytes=Buffer.from('old host'),r=await runSourceZip(fixture(bytes));assert.equal(r.result.Code,1);assert.equal(r.state.textReads.length,0);assert.equal(r.state.reads.length,1);assert.deepEqual(Buffer.from(r.state.zips[0].Entries[0].FileByteBase64,'base64'),bytes);
});
