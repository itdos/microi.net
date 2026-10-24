import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source=fs.readFileSync(fileURLToPath(new URL('../run-tests.ps1',import.meta.url)),'utf8');
const start=source.indexOf("if ($Mode -eq 'Full' -or $Mode -eq 'PlatformRelease') {",source.indexOf('# Full 的 restore/build/test/list package'));
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
    fs.writeFileSync(project,'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework><OutputType>Exe</OutputType></PropertyGroup></Project>');
    fs.writeFileSync(path.join(root,'source/Source.cs'),'using System; Console.WriteLine(AppContext.BaseDirectory); public sealed class IsolationFixture { public int Value => 1; }');
    fs.writeFileSync(harness,`param([string]$ResultsDirectory,[string]$Project)\n$ErrorActionPreference='Stop'\n$Mode='Full'\n$serverRoot=Join-Path $PSScriptRoot 'source'\n${isolation}\ndotnet build $Project --disable-build-servers -m:1 -nr:false -p:UseSharedCompilation=false -v:quiet\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\n$builtDll=@(Get-ChildItem -LiteralPath $env:ArtifactsPath -Filter fixture.dll -File -Recurse)[0].FullName\n$observedBase=(& dotnet $builtDll | Select-Object -Last 1)\nif ($LASTEXITCODE -ne 0 -or -not $observedBase.StartsWith($env:ArtifactsPath,[StringComparison]::OrdinalIgnoreCase)) { throw "SDK output lost workspace link: $observedBase" }\ndotnet list $Project package --no-restore\nexit $LASTEXITCODE\n`);
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

test('solution Release inherits both executable fixture configurations and copies actual outputs in normal and isolated layouts',async()=>{
    const projectSource=fs.readFileSync(fileURLToPath(new URL('../Microi.Tests.csproj',import.meta.url)),'utf8');
    const inheritance=projectSource.match(/<ShouldUnsetParentConfigurationAndPlatform>[^<]+<\/ShouldUnsetParentConfigurationAndPlatform>/)?.[0];
    const copyTarget=projectSource.match(/<Target Name="CopyMemoryDiagnosticsFixture"[\s\S]*?<\/Target>/)?.[0];
    assert.ok(inheritance&&copyTarget,'真实中央测试项目必须保留配置继承与输出强回读目标');
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'microi-fixture-configuration-'));
    try{
        // 两种布局各用全新目录；只把父项目放进 solution，复现 SDK 对未映射引用的配置处理。
        for(const isolated of [false,true]){
            const folder=path.join(root,isolated?'artifacts':'normal'),parent=path.join(folder,'Parent');
            fs.mkdirSync(parent,{recursive:true});
            fs.writeFileSync(path.join(parent,'Parent.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework><EnableDefaultCompileItems>false</EnableDefaultCompileItems>'+inheritance+'</PropertyGroup><ItemGroup><Compile Include="Library.cs"/><ProjectReference Include="Fixtures/MemoryDiagnosticsNode/Microi.MemoryDiagnostics.Fixture.csproj" ReferenceOutputAssembly="false"/><ProjectReference Include="Fixtures/DatabasePoolNode/DatabasePoolNode.csproj" ReferenceOutputAssembly="false"/></ItemGroup>'+copyTarget+'</Project>');
            fs.writeFileSync(path.join(parent,'Library.cs'),'public class Library {}');
            for(const [name,project,assembly]of [['MemoryDiagnosticsNode','Microi.MemoryDiagnostics.Fixture','Microi.MemoryDiagnostics.Fixture'],['DatabasePoolNode','DatabasePoolNode','Microi.PoolRecoveryNode']]){
                const child=path.join(parent,'Fixtures',name);fs.mkdirSync(child,{recursive:true});
                fs.writeFileSync(path.join(child,project+'.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework><OutputType>Exe</OutputType><AssemblyName>'+assembly+'</AssemblyName></PropertyGroup></Project>');
                fs.writeFileSync(path.join(child,'Program.cs'),'System.Console.WriteLine(typeof(Program).Assembly.GetCustomAttributes(typeof(System.Reflection.AssemblyConfigurationAttribute),false) is object[] a ? ((System.Reflection.AssemblyConfigurationAttribute)a[0]).Configuration : "missing");');
            }
            const id='{00000000-0000-0000-0000-000000000001}';
            fs.writeFileSync(path.join(folder,'Fixture.sln'),'Microsoft Visual Studio Solution File, Format Version 12.00\nProject("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Parent", "Parent\\Parent.csproj", "'+id+'"\nEndProject\nGlobal\nGlobalSection(SolutionConfigurationPlatforms) = preSolution\nRelease|Any CPU = Release|Any CPU\nEndGlobalSection\nGlobalSection(ProjectConfigurationPlatforms) = postSolution\n'+id+'.Release|Any CPU.ActiveCfg = Release|Any CPU\n'+id+'.Release|Any CPU.Build.0 = Release|Any CPU\nEndGlobalSection\nEndGlobal\n');
            const artifacts=path.join(folder,'output'),args=['build','Fixture.sln','-c','Release','--disable-build-servers','-m:1','-nr:false','-p:UseSharedCompilation=false','-v:quiet',...(isolated?['-p:UseArtifactsOutput=true','-p:ArtifactsPath='+artifacts]:[])];
            const result=await run('dotnet',args,{cwd:folder,env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});assert.equal(result.code,0,result.output);
            const memory=isolated?path.join(artifacts,'bin/Microi.MemoryDiagnostics.Fixture/release'):path.join(parent,'Fixtures/MemoryDiagnosticsNode/bin/Release/net10.0');
            const pool=isolated?path.join(artifacts,'bin/DatabasePoolNode/release'):path.join(parent,'Fixtures/DatabasePoolNode/bin/Release/net10.0');
            const copied=isolated?path.join(artifacts,'bin/Parent/release/Fixtures/MemoryDiagnosticsNode'):path.join(parent,'bin/Release/net10.0/Fixtures/MemoryDiagnosticsNode');
            for(const [directory,assembly]of [[memory,'Microi.MemoryDiagnostics.Fixture'],[pool,'Microi.PoolRecoveryNode'],[copied,'Microi.MemoryDiagnostics.Fixture']]){
                for(const suffix of ['.dll','.deps.json','.runtimeconfig.json'])assert.ok(fs.existsSync(path.join(directory,assembly+suffix)),directory+suffix);
                const executed=await run('dotnet',[path.join(directory,assembly+'.dll')],{cwd:folder,env:process.env});assert.equal(executed.code,0,executed.output);assert.equal(executed.output.trim(),'Release');
            }
        }
    }finally{fs.rmSync(root,{recursive:true,force:true});}
});
