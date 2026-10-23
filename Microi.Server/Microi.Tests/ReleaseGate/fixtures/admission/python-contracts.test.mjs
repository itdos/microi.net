import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('formal native admission fixture enforces ownership, exact CAS, unknown outcomes and real private ACL',()=>{
  const result=spawnSync(process.env.MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON||(process.platform==='win32'?'python':'python3'),
    ['-B','-m','unittest','discover','-s',fileURLToPath(new URL('.',import.meta.url)),'-p','test_*.py','-v'],
    {windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stderr,/Ran [1-9]\d* tests/);assert.match(result.stderr,/\bOK\b/);assert.doesNotMatch(result.stderr,/skipped=/);
});
