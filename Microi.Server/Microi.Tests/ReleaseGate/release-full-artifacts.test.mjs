import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source=fs.readFileSync(fileURLToPath(new URL('../run-tests.ps1',import.meta.url)),'utf8');
const start=source.indexOf("if ($Mode -eq 'Full') {",source.indexOf('# Full 的 restore/build/test/list package'));
const end=source.indexOf('Write-Host "Restoring Microi.Tests',start);
assert.ok(start>0&&end>start,'actual Full SDK output isolation block must exist');
const isolation=source.slice(start,end);
function run(binary,args,options){return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,options);let output='';
    child.stdout.on('data',value=>output+=value);child.stderr.on('data',value=>output+=value);
    child.once('error',reject);child.once('exit',code=>resolve({code,output}));
});}
function files(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(root,entry.name)):[path.join(root,entry.name)]);}
test('two actual concurrent SDK builds and package audits use their Full result directories without touching shared bin/obj',async()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'microi-full-artifacts-'));
    const binary=[process.env.MICROI_TEST_POWERSHELL,'pwsh','powershell'].filter(Boolean).find(value=>spawnSync(value,['-NoProfile','-Command','$PSVersionTable.PSVersion.ToString()']).status===0);
    assert.ok(binary,'PowerShell is required; output isolation regression never skips');
    fs.mkdirSync(path.join(root,'source'));
    const project=path.join(root,'source/fixture.csproj'),harness=path.join(root,'harness.ps1');
    fs.writeFileSync(project,'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>');
    fs.writeFileSync(path.join(root,'source/Source.cs'),'public sealed class IsolationFixture { public int Value => 1; }');
    fs.writeFileSync(harness,`param([string]$ResultsDirectory,[string]$Project)\n$ErrorActionPreference='Stop'\n$Mode='Full'\n${isolation}\ndotnet build $Project --disable-build-servers -m:1 -nr:false -p:UseSharedCompilation=false -v:quiet\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\ndotnet list $Project package --no-restore\nexit $LASTEXITCODE\n`);
    try{
        const results=await Promise.all(['api','pc'].map(scope=>run(binary,['-NoProfile','-File',harness,'-ResultsDirectory',path.join(root,scope),'-Project',project],{cwd:root,env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1'}})));
        for(const result of results)assert.equal(result.code,0,result.output);
        for(const scope of ['api','pc']){
            const output=files(path.join(root,scope,'.net-artifacts'));
            assert.ok(output.some(name=>name.endsWith('fixture.dll')),output.join('\n'));
            assert.ok(output.some(name=>name.endsWith('project.assets.json')),output.join('\n'));
        }
        assert.ok(!fs.existsSync(path.join(root,'source/obj')));assert.ok(!fs.existsSync(path.join(root,'source/bin')));
    }finally{fs.rmSync(root,{recursive:true,force:true});}
});
