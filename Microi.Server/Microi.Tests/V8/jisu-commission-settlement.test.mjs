// 客户结算报表由应用目录维护唯一源码和回归；纳入 run-tests.ps1 自动发现入口。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import '../../../Microi-V8-Engine/myzsl (api.chongstech.com)/jisu1.Product.Internal/AI应用/jisu-sync-commission/settlement/settlement-report.test.mjs';
test('本次核对结论必须绑定客户实际原文件，换文件后不得复用旧结果',()=>{
 const contract=JSON.parse(fs.readFileSync(new URL('../../../Microi-V8-Engine/myzsl (api.chongstech.com)/jisu1.Product.Internal/AI应用/jisu-sync-commission/settlement/source-contract.json',import.meta.url),'utf8'));
 const file=fs.readFileSync(new URL('../../../'+contract.sourceFile,import.meta.url));
 assert.equal(createHash('sha256').update(file).digest('hex'),contract.sha256);
});
