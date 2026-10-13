import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const source = fs.readFileSync(new URL('../Microi.Tests.csproj', import.meta.url), 'utf8');
const copyTarget = source.match(/  <Target Name="CopyMemoryDiagnosticsFixture"[\s\S]*?<\/Target>/)?.[0];
assert.ok(copyTarget, 'The real fixture copy target must exist');
const guid = '{6DF52337-6138-4C50-BBC4-487700A02ED7}';

function workspace(broken = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-memory-fixture-build-'));
  const project = path.join(root, 'Microi.Tests');
  const fixture = path.join(project, 'Fixtures/MemoryDiagnosticsNode');
  fs.mkdirSync(fixture, {recursive: true});
  fs.writeFileSync(path.join(fixture, 'Microi.MemoryDiagnostics.Fixture.csproj'), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework><OutputType>Exe</OutputType><AssemblyName>Microi.MemoryDiagnostics.Fixture</AssemblyName></PropertyGroup></Project>`);
  fs.writeFileSync(path.join(fixture, 'Program.cs'), broken ? '#error fixture_build_must_fail\n' : 'System.Console.WriteLine("real fixture");\n');
  fs.writeFileSync(path.join(project, 'Marker.cs'), 'public sealed class FixtureBuildMarker {}\n');
  fs.writeFileSync(path.join(project, 'Microi.Tests.csproj'), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework><IsPackable>false</IsPackable></PropertyGroup><ItemGroup><Compile Remove="Fixtures/**/*.cs"/><ProjectReference Include="Fixtures/MemoryDiagnosticsNode/Microi.MemoryDiagnostics.Fixture.csproj" ReferenceOutputAssembly="false"/></ItemGroup>\n${copyTarget}\n</Project>`);
  // 保留真实故障的图：解决方案仅列父工程，夹具由 ProjectReference 引用；不预先生成任何 DLL。
  fs.writeFileSync(path.join(root, 'Fixture.sln'), `Microsoft Visual Studio Solution File, Format Version 12.00\n# Visual Studio Version 17\nProject("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Microi.Tests", "Microi.Tests\\Microi.Tests.csproj", "${guid}"\nEndProject\nGlobal\n\tGlobalSection(SolutionConfigurationPlatforms) = preSolution\n\t\tDebug|Any CPU = Debug|Any CPU\n\t\tRelease|Any CPU = Release|Any CPU\n\tEndGlobalSection\n\tGlobalSection(ProjectConfigurationPlatforms) = postSolution\n\t\t${guid}.Debug|Any CPU.ActiveCfg = Debug|Any CPU\n\t\t${guid}.Debug|Any CPU.Build.0 = Debug|Any CPU\n\t\t${guid}.Release|Any CPU.ActiveCfg = Release|Any CPU\n\t\t${guid}.Release|Any CPU.Build.0 = Release|Any CPU\n\tEndGlobalSection\nEndGlobal\n`);
  return {root, project, fixture};
}
function build(w, solution, artifacts) {
  const args = ['build', solution ? 'Fixture.sln' : 'Microi.Tests/Microi.Tests.csproj', '-c', 'Release', '-m:1', '--disable-build-servers', '-nr:false', '-p:UseSharedCompilation=false', '-v:quiet'];
  if (artifacts) args.push('--artifacts-path', path.join(w.root, 'artifacts'));
  return spawnSync('dotnet', args, {cwd: w.root, encoding: 'utf8', windowsHide: true, timeout: 120000,
    env: {...process.env, MSBUILDDISABLENODEREUSE: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1'}, maxBuffer: 4 * 1024 * 1024});
}
function verifyCopies(w, artifacts) {
  const source = artifacts ? path.join(w.root, 'artifacts/bin/Microi.MemoryDiagnostics.Fixture/release') : path.join(w.fixture, 'bin/Release/net10.0');
  const copied = artifacts ? path.join(w.root, 'artifacts/bin/Microi.Tests/release/Fixtures/MemoryDiagnosticsNode') : path.join(w.project, 'bin/Release/net10.0/Fixtures/MemoryDiagnosticsNode');
  for (const suffix of ['.dll', '.deps.json', '.runtimeconfig.json']) {
    const name = 'Microi.MemoryDiagnostics.Fixture' + suffix;
    assert.deepEqual(fs.readFileSync(path.join(copied, name)), fs.readFileSync(path.join(source, name)), name);
  }
}
function cleanup(w) {
  // 仅删除本用例分配的精确临时目录；不读取或修改仓库已有 bin/obj 和其它任务目录。
  assert.equal(path.dirname(w.root), path.resolve(os.tmpdir()));
  assert.ok(path.basename(w.root).startsWith('microi-memory-fixture-build-'));
  fs.rmSync(w.root, {recursive: true, force: true});
}

test('fresh Release solution builds and copies the actual Release fixture outside the solution graph', () => {
  const w = workspace();
  try {
    const result = build(w, true, false);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    verifyCopies(w, false);
  } finally { cleanup(w); }
});
test('isolated SDK artifact output retains the actual executable runtime and dependency bytes', () => {
  const w = workspace();
  try {
    const result = build(w, false, true);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    verifyCopies(w, true);
  } finally { cleanup(w); }
});
test('a real fixture compile error fails the parent build without a fabricated output', () => {
  const w = workspace(true);
  try {
    const result = build(w, true, false);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /fixture_build_must_fail/);
    assert.equal(fs.existsSync(path.join(w.project, 'bin/Release/net10.0/Fixtures/MemoryDiagnosticsNode/Microi.MemoryDiagnostics.Fixture.dll')), false);
  } finally { cleanup(w); }
});
