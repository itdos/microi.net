import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// 接入正式 Unit 的 Node 自动发现；这些边界回归不冒充真实供应商、CA或主机重启验收。
for(const [filename,minimum] of [['panel-host-nginx-boundary.test.py',12],['panel-external-acme.test.py',14]]) {
  test('Python acceptance boundary: '+filename,()=>{
    const result=spawnSync(process.platform==='win32'?'python':'python3',['-B',fileURLToPath(new URL(filename,import.meta.url)),'-v'],
      {windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
    assert.equal(result.error,undefined);assert.equal(result.status,0,result.stdout+result.stderr);
    const count=Number(result.stderr.match(/Ran (\d+) tests? in /)?.[1]);
    assert(count>=minimum,'Expected nonzero complete boundary coverage');assert.match(result.stderr,/^OK\s*$/m);
    assert.doesNotMatch(result.stderr,/skipped=|expected failures=|unexpected successes=/i);
  });
}
