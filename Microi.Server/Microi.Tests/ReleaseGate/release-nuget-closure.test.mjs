import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { enumeratePendingPackages } from '../../tools/release-encryption.mjs';
import { verifyNugetClosure } from '../../tools/release-nuget-closure.mjs';

const source = fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh', import.meta.url)), 'utf8');
const start = source.indexOf('if [ "$PUSH_NUGET" = true ] || {'), end = source.indexOf('# --- DLL 加密', start);
assert.ok(start > 0 && end > start);
const packBlock = source.slice(start, end);
const budgetFunctions = source.slice(source.indexOf('# 从交互选项完成开始计时'), source.indexOf('# Windows (Git Bash) 下'));
const names = ['Microi.NPOI.Core', 'Microi.NPOI.OpenXml4Net', 'Microi.NPOI.OpenXmlFormats', 'Microi.NPOI.OOXML', 'Microi.NPOI', 'Microi.Office'];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const quote = value => "'" + value.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";
const gitExec = process.platform === 'win32' ? execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim() : '';
const bash = process.platform === 'win32' ? path.resolve(gitExec, '../../..', 'bin/bash.exe') : 'bash';
function run(root, args) {
    const result = spawnSync('dotnet', args, { cwd: root, encoding: 'utf8', env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1' } });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + result.stderr); return result;
}
function fixture(root) {
    const server = path.join(root, 'Microi.Server'); fs.mkdirSync(server, { recursive: true });
    const projects = names.map(name => path.join(server, name.startsWith('Microi.NPOI.') ? 'Microi.NPOI/' + name : name, name + '.csproj'));
    for (const [index, project] of projects.entries()) {
        fs.mkdirSync(path.dirname(project), { recursive: true });
        const dependencies = index === 5 ? [4] : index === 4 ? [0, 1, 2, 3] : Array.from({ length: index }, (_, i) => i);
        fs.writeFileSync(project, '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework><Version>8.5.10</Version><GeneratePackageOnBuild>true</GeneratePackageOnBuild><EnableDefaultCompileItems>false</EnableDefaultCompileItems>' + (index === 4 ? '<IncludeBuildOutput>false</IncludeBuildOutput>' : '') + '</PropertyGroup><ItemGroup><Compile Include="Library.cs"/>' + dependencies.map(i => '<ProjectReference Include="' + path.relative(path.dirname(project), projects[i]).replaceAll('\\', '/') + '" />').join('') + '</ItemGroup><Target Name="RejectBuildDuringPack" BeforeTargets="BeforeBuild"><Error Condition="\'$(PackOnly)\' == \'true\'" Text="Pack must not enter Build"/></Target></Project>');
        fs.writeFileSync(path.join(path.dirname(project), 'Library.cs'), 'public class C' + index + ' {}');
    }
    // 方案只包含 Office，真实复现方案外五个引用的 SDK 配置与打包行为。
    const id = '{00000000-0000-0000-0000-000000000001}', solution = path.join(server, 'Fixture.sln');
    fs.writeFileSync(solution, 'Microsoft Visual Studio Solution File, Format Version 12.00\nProject("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Microi.Office", "Microi.Office\\Microi.Office.csproj", "' + id + '"\nEndProject\nGlobal\nGlobalSection(SolutionConfigurationPlatforms) = preSolution\nRelease|Any CPU = Release|Any CPU\nEndGlobalSection\nGlobalSection(ProjectConfigurationPlatforms) = postSolution\n' + id + '.Release|Any CPU.ActiveCfg = Release|Any CPU\n' + id + '.Release|Any CPU.Build.0 = Release|Any CPU\nEndGlobalSection\nEndGlobal\n');
    const list = path.join(root, 'pending.nul');
    const pending = () => { const files = enumeratePendingPackages(server, '8.5.10'); fs.writeFileSync(list, Buffer.from(files.join('\0') + '\0')); return files; };
    return { server, projects, solution, list, pending };
}

test('actual SDK reproduces missing NPOI packages and Debug references; production Release build and explicit pack close all five references', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-npoi-pack-'));
    try {
        const f = fixture(root), build = ['build', f.solution, '-c', 'Release', '--disable-build-servers', '-m:1', '-nr:false', '-p:UseSharedCompilation=false', '-p:GeneratePackageOnBuild=false', '-v:q'];
        run(root, build);
        for (const [i, project] of f.projects.slice(0, 4).entries()) {
            assert.ok(fs.existsSync(path.join(path.dirname(project), 'bin/Debug/net10.0', names[i] + '.dll')));
            assert.ok(!fs.existsSync(path.join(path.dirname(project), 'bin/Release/net10.0', names[i] + '.dll')));
        }
        assert.equal(enumeratePendingPackages(f.server, '8.5.10').length, 0, '正常构建显式关闭隐式打包');
        run(root, ['pack', f.solution, '-c', 'Release', '--no-build', '-p:GeneratePackageOnBuild=false', '-p:BuildProjectReferences=false', '-v:q']);
        assert.equal(f.pending().length, 1, '旧方案 Pack 成功却只有 Office 包');
        assert.throws(() => verifyNugetClosure(f.server, '8.5.10', f.list), /Microi.Office -> Microi.NPOI/);
        const inheritance = source.match(/dotnet build "\$SLN_FILE"[^\n]*(-p:ShouldUnsetParentConfigurationAndPlatform=false)/)?.[1];
        assert.ok(inheritance, '一键正式构建必须显式保留方案外引用的 Release 配置');
        run(root, [...build, inheritance]);
        const dlls = f.projects.slice(0, 4).map((project, i) => path.join(path.dirname(project), 'bin/Release/net10.0', names[i] + '.dll'));
        const before = dlls.map(hash);
        const packed = spawnSync(bash, ['--noprofile', '--norc', '-s'], { cwd: root, encoding: 'utf8', input: `set -o pipefail\nprint_divider(){ :; }; print_step(){ :; }; print_success(){ :; }; print_fail(){ printf '%s\\n' "$*" >&2; exit 17; }\n${budgetFunctions}\nPUSH_NUGET=true; HAS_ENCRYPT=false; DEPLOY_MODE=4; _MICROI_NET_PROJECT=absent; SLN_FILE=Microi.Server/Fixture.sln; VERSION=8.5.10; _BUILD_EXTRA_ARGS='-p:PackOnly=true'; RED=''; NC='';\n${packBlock}` });
        assert.ifError(packed.error); assert.equal(packed.status, 0, packed.stdout + packed.stderr);
        assert.deepEqual(dlls.map(hash), before, 'Pack 未重新编译 Release DLL');
        assert.equal(f.pending().length, 6);
        const proof = verifyNugetClosure(f.server, '8.5.10', f.list); assert.equal(proof.count, 6);
        const aggregate = proof.packages.find(p => p.id === 'Microi.NPOI');
        assert.deepEqual(aggregate.dependencies.map(d => d.id).sort(), names.slice(0, 4).sort());
        for (const missing of ['Microi.NPOI', ...names.slice(0, 4)]) {
            const packageFile = f.pending().find(file => path.basename(file) === `${missing}.8.5.10.nupkg`), bytes = fs.readFileSync(packageFile);
            fs.unlinkSync(packageFile); f.pending();
            assert.throws(() => verifyNugetClosure(f.server, '8.5.10', f.list), /Missing same-release NuGet dependency/, missing);
            fs.writeFileSync(packageFile, bytes);
        }
        f.pending();
        // 独立 ZIP/XML 读取器也必须读回完整集合，不能依赖 Python 才能发布。
        if (process.platform === 'win32') {
            const cli = fileURLToPath(new URL('../../tools/release-nuget-closure.mjs', import.meta.url));
            const fallback = spawnSync(process.execPath, [cli, f.server, '8.5.10', f.list], { encoding: 'utf8', env: { ...process.env, PATH: path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0') } });
            assert.equal(fallback.status, 0, fallback.stderr);
        }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('production pack orders children before aggregate and retains no-build reference guards', () => {
    let previous = -1;
    for (const name of names.slice(0, 5)) {
        const position = packBlock.indexOf(name + '.csproj', previous + 1); assert.ok(position > previous, name); previous = position;
    }
    assert.match(packBlock, /dotnet pack "Microi.Server\/Microi.NPOI\/\$_npoi_project"[^\n]*--no-build[^\n]*-p:GeneratePackageOnBuild=false[^\n]*-p:BuildProjectReferences=false/);
    const check = source.indexOf('node Microi.Server/tools/release-nuget-closure.mjs');
    const push = source.indexOf('secure-nuget-push.mjs push', check); assert.ok(check > 0 && push > check);
});
