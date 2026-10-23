import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('../run-tests.ps1', import.meta.url));
const source = fs.readFileSync(runner, 'utf8');
const powershell = ['pwsh', 'powershell'].map(binary => ({ binary, result: spawnSync(binary, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8', windowsHide: true }) })).find(row => row.result.status === 0)?.binary;

test('the Desktop gate uses native host tools only within its restored PATH scope', () => {
  const start = source.indexOf('$originalDesktopTestPath = $env:Path');
  const end = source.indexOf('Pop-Location', start);
  const scope = source.slice(start, end);
  assert.match(scope, /Get-MicroiDesktopTestPath -OriginalPath \$originalDesktopTestPath -NodeHome \$env:MICROI_DESKTOP_NODE_HOME/);
  assert.match(scope, /npm test -- --maxWorkers=1 --no-file-parallelism/);
  assert.match(scope, /finally\s*\{\s*\$env:Path = \$originalDesktopTestPath/);
});

test('the real Git Bash to Node chain rejects GNU drive parsing and round-trips with native tar', () => {
  assert.ok(powershell, 'PowerShell is required to exercise the actual release function');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-desktop-native-tools-'));
  try {
    const probe = path.join(directory, 'probe.cjs');
    fs.writeFileSync(probe, `const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.join(process.env.MICROI_NATIVE_TOOLS_TEST_DIR,process.argv[2]);fs.mkdirSync(root);const input=path.join(root,'input'),output=path.join(root,'output'),archive=path.join(root,'asset.tgz');fs.mkdirSync(input);fs.mkdirSync(output);const payload=Buffer.from('native Windows tar preserves drive paths');fs.writeFileSync(path.join(input,'cloudflared'),payload);
const pack=cp.spawnSync('tar',['-czf',archive,'-C',input,'cloudflared'],{encoding:'utf8',windowsHide:true,timeout:10000});let unpack=null,matched=false;if(pack.status===0){unpack=cp.spawnSync('tar',['-xzf',archive,'-C',output],{encoding:'utf8',windowsHide:true,timeout:10000});if(unpack.status===0)matched=fs.readFileSync(path.join(output,'cloudflared')).equals(payload);}console.log(JSON.stringify({node:process.execPath,version:process.version,pack:pack.status,unpack:unpack?.status,matched,error:pack.stderr}));`);
    const driver = path.join(directory, 'driver.ps1');
    fs.writeFileSync(driver, `$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($env:MICROI_NATIVE_TOOLS_TEST_SOURCE,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Release runner parse failure'}
$functions=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-MicroiDesktopTestPath'},$true))
if($functions.Count -ne 1){throw 'Actual release PATH function is missing or duplicated'}
Invoke-Expression $functions[0].Extent.Text
$original=$env:Path
$plain=Get-MicroiDesktopTestPath -OriginalPath 'original-sentinel' -NodeHome '' -WindowsHost $false
$prefixed=Get-MicroiDesktopTestPath -OriginalPath 'original-sentinel' -NodeHome 'node-sentinel' -WindowsHost $false
$before=$null;$after=$null;$node=$null;$tar=$null;$system=$null
try {
  if($env:MICROI_NATIVE_TOOLS_TEST_WINDOWS -eq '1') {
    $before=(& $env:MICROI_NATIVE_TOOLS_TEST_NODE $env:MICROI_NATIVE_TOOLS_TEST_PROBE before)|ConvertFrom-Json
    $env:Path=Get-MicroiDesktopTestPath -OriginalPath $original -NodeHome (Split-Path -Parent $env:MICROI_NATIVE_TOOLS_TEST_NODE) -WindowsHost $true
    $node=(Get-Command node).Source;$tar=(Get-Command tar).Source
    $system=[Environment]::GetFolderPath([Environment+SpecialFolder]::System)
    $after=(& $env:MICROI_NATIVE_TOOLS_TEST_NODE $env:MICROI_NATIVE_TOOLS_TEST_PROBE after)|ConvertFrom-Json
  }
} finally {$env:Path=$original}
[pscustomobject]@{plain=$plain;prefixed=$prefixed;before=$before;after=$after;node=$node;tar=$tar;system=$system;restored=($env:Path -ceq $original)}|ConvertTo-Json -Depth 10 -Compress
`, 'utf8');
    const env = { ...process.env, MICROI_NATIVE_TOOLS_TEST_SOURCE: runner, MICROI_NATIVE_TOOLS_TEST_DIR: directory, MICROI_NATIVE_TOOLS_TEST_NODE: process.execPath, MICROI_NATIVE_TOOLS_TEST_PROBE: probe, MICROI_NATIVE_TOOLS_TEST_DRIVER: driver, MICROI_NATIVE_TOOLS_TEST_POWERSHELL: powershell, MICROI_NATIVE_TOOLS_TEST_WINDOWS: process.platform === 'win32' ? '1' : '0' };
    let result;
    if (process.platform === 'win32') {
      const found = spawnSync('where.exe', ['git.exe'], { encoding: 'utf8', windowsHide: true });
      assert.equal(found.status, 0, 'Git is required for the original Windows release entry');
      const bash = found.stdout.trim().split(/\r?\n/).map(git => path.resolve(path.dirname(git), '../bin/bash.exe')).find(candidate => fs.existsSync(candidate));
      assert.ok(bash, 'The installed Git Bash entry must be present');
      result = spawnSync(bash, ['-c', 'exec "$MICROI_NATIVE_TOOLS_TEST_POWERSHELL" -NoProfile -File "$MICROI_NATIVE_TOOLS_TEST_DRIVER"'], { env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    } else {
      result = spawnSync(powershell, ['-NoProfile', '-File', driver], { env, encoding: 'utf8', timeout: 30000 });
    }
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout.trim().replace(/^\uFEFF/, ''));
    assert.equal(actual.plain, 'original-sentinel');
    assert.equal(actual.prefixed, `node-sentinel${path.delimiter}original-sentinel`);
    assert.equal(actual.restored, true);
    if (process.platform === 'win32') {
      assert.notEqual(actual.before.pack, 0, 'The original Git Bash GNU tar drive-path failure must be reproduced');
      assert.match(actual.before.error, /Cannot connect to [A-Za-z]:/);
      assert.equal(path.resolve(actual.node).toLowerCase(), path.resolve(process.execPath).toLowerCase(), 'Configured Node remains first');
      assert.equal(path.resolve(actual.tar).toLowerCase(), path.join(actual.system, 'tar.exe').toLowerCase());
      assert.equal(actual.after.pack, 0);
      assert.equal(actual.after.unpack, 0);
      assert.equal(actual.after.matched, true);
      assert.equal(actual.after.version, process.version);
    }
  } finally {
    // 本测试仅创建上面 mkdtemp 的目录，不接触发布候选或任何借用夹具。
    fs.rmSync(directory, { recursive: true });
  }
});
