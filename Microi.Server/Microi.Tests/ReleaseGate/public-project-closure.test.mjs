import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const git = spawnSync('git', ['ls-files', '-z', '--', 'Microi.Server'], {
  cwd: workspace, encoding: 'utf8', windowsHide: true
});
const gitUntracked = spawnSync('git', ['ls-files', '-z', '--others', '--exclude-standard', '--', 'Microi.Server'], {
  cwd: workspace, encoding: 'utf8', windowsHide: true
});
const gitRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: workspace, encoding: 'utf8', windowsHide: true
});
// Gitee ZIP 没有 .git：仍检查磁盘引用闭包；Git 克隆额外校验每个依赖确实进入索引。
function sourceFiles(directory) {
  const files = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.isDirectory() && !['bin', 'obj', '.git'].includes(item.name))
      files.push(...sourceFiles(path.join(directory, item.name)));
    else if (item.isFile()) files.push(path.relative(workspace, path.join(directory, item.name)).replaceAll('\\', '/'));
  }
  return files;
}
const fromGit = git.status === 0 && gitRoot.status === 0
  && path.resolve(gitRoot.stdout.trim()) === workspace;
const relocatedProjects = new Map([
  ['Microi.Server/ThirdParty/MongoDB.Driver/MongoDB.Driver.Compatibility.csproj',
    'Microi.Server/Microi.MongoDB.Driver/Microi.MongoDB.Driver.csproj'],
  ['Microi.Server/ThirdParty/NPOI/Core/NPOI.Core.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.Core/Microi.NPOI.Core.csproj'],
  ['Microi.Server/ThirdParty/NPOI/Microi.NPOI.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.csproj'],
  ['Microi.Server/ThirdParty/NPOI/OOXML/NPOI.OOXML.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.OOXML/Microi.NPOI.OOXML.csproj'],
  ['Microi.Server/ThirdParty/NPOI/OpenXml4Net/NPOI.OpenXml4Net.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.OpenXml4Net/Microi.NPOI.OpenXml4Net.csproj'],
  ['Microi.Server/ThirdParty/NPOI/OpenXmlFormats/NPOI.OpenXmlFormats.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.OpenXmlFormats/Microi.NPOI.OpenXmlFormats.csproj']
]);

function selectPublicSourceFiles(tracked, untracked, exists) {
  const missingTrackedProjects = [...tracked].filter(file => file.endsWith('.csproj') && !exists(file));
  const addedProjects = [...untracked].filter(file => file.endsWith('.csproj') && exists(file));
  if (missingTrackedProjects.length === 0 && addedProjects.length === 0)
    return { files: new Set(tracked), mode: 'git-index', missingTrackedProjects };
  // 发布候选可以先于 Git 交付；只在项目迁移期间使用未忽略的实际源码，
  // 并要求每个删除的旧项目有明确的新项目承接，避免把误删当作成功闭包。
  const files = new Set([...tracked, ...untracked].filter(exists));
  return { files, mode: 'working-candidate', missingTrackedProjects };
}

const tracked = new Set(fromGit ? git.stdout.split('\0').filter(Boolean) : []);
const untracked = new Set(fromGit && gitUntracked.status === 0
  ? gitUntracked.stdout.split('\0').filter(Boolean) : []);
const selected = fromGit
  ? selectPublicSourceFiles(tracked, untracked, file => fs.existsSync(path.join(workspace, file)))
  : { files: new Set(sourceFiles(path.join(workspace, 'Microi.Server'))), mode: 'source-archive', missingTrackedProjects: [] };
const available = selected.files;
const protectedRoots = fs.readFileSync(path.join(workspace, '.public-repo-protected-paths'), 'utf8')
  .split(/\r?\n/).filter(line => line && !line.startsWith('#'));

function projectReferenceTarget(project, include) {
  // csproj 的 Windows 分隔符必须在解析 .. 之前归一化，Mac/Linux 才能核对同一真实项目。
  return path.relative(workspace,
    path.resolve(workspace, path.dirname(project), include.replaceAll('\\', '/'))).replaceAll('\\', '/');
}

function missingProjectReferences(available) {
  const missing = [];
  for (const project of available) {
    if (!project.endsWith('.csproj')) continue;
    const source = fs.readFileSync(path.join(workspace, project), 'utf8');
    for (const match of source.matchAll(/<ProjectReference\b[^>]*\bInclude="([^"]+)"/g)) {
      if (match[1].includes('$(')) continue;
      const target = projectReferenceTarget(project, match[1]);
      // 私有源码由公开方案的 NuGet 模式提供；根公开仓不能收进这些目录。
      if (protectedRoots.some(root => target === root || target.startsWith(root + '/'))) continue;
      if (!available.has(target) || !fs.existsSync(path.join(workspace, target)))
        missing.push(`${project} -> ${target}`);
    }
  }
  return missing;
}

function solutionProjects(source) {
  return new Map([...source.matchAll(/^Project\("[^"\r\n]+"\) = "[^"\r\n]+", "([^"\r\n]+\.csproj)", "(\{[^}]+\})"/gm)]
    .map(match => [projectReferenceTarget('Microi.Server/solution.sln', match[1]), match[2]]));
}

function missingSolutionProjects(projects) {
  const missing = new Set();
  const visited = new Set();
  const pending = [...projects.keys()];
  // CLI 的递归 restore 会掩盖方案漏项；VS 只收集已加载项目的 NuGet 图，
  // 因此公开依赖（包括 ReferenceOutputAssembly=false 的独立进程）也必须在方案中。
  while (pending.length) {
    const project = pending.pop();
    if (visited.has(project)) continue;
    visited.add(project);
    if (!available.has(project)) continue;
    const source = fs.readFileSync(path.join(workspace, project), 'utf8');
    for (const match of source.matchAll(/<ProjectReference\b[^>]*\bInclude="([^"]+)"/g)) {
      if (match[1].includes('$(')) continue;
      const target = projectReferenceTarget(project, match[1]);
      if (protectedRoots.some(root => target === root || target.startsWith(root + '/'))) continue;
      if (!projects.has(target)) missing.add(target);
      pending.push(target);
    }
  }
  return [...missing].sort();
}

test('公开解决方案包含全部传递项目及每种构建配置，不依赖 CLI 递归还原补漏', () => {
  const source = fs.readFileSync(path.join(workspace, 'Microi.Server/Microi.net.sln'), 'utf8');
  const projects = solutionProjects(source);
  assert.ok(projects.size > 0);
  assert.deepEqual([...projects.keys()].filter(project => protectedRoots.some(root => project.startsWith(root + '/'))), []);
  assert.deepEqual(missingSolutionProjects(projects), []);
  const configurations = [...source.matchAll(/^\s*(\w+\|[^=\r\n]+?)\s*=\s*\1\s*$/gm)].map(match => match[1]);
  assert.ok(configurations.includes('Debug|Any CPU'));
  assert.ok(configurations.includes('Release|Any CPU'));
  assert.equal(new Set(projects.values()).size, projects.size, '项目 GUID 不能重复');
  for (const [project, guid] of projects) {
    assert.ok(available.has(project), `方案项目未公开交付：${project}`);
    for (const configuration of configurations)
      for (const mapping of ['ActiveCfg', 'Build.0'])
        assert.ok(source.includes(`${guid}.${configuration}.${mapping} = `), `${project} 缺少 ${configuration}.${mapping}`);
  }
});

test('文件存在但解决方案漏列驱动、NPOI、Panel 或独立诊断夹具时仍失败', () => {
  const projects = solutionProjects(fs.readFileSync(path.join(workspace, 'Microi.Server/Microi.net.sln'), 'utf8'));
  for (const target of [
    'Microi.Server/Microi.MongoDB.Driver/Microi.MongoDB.Driver.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.OOXML/Microi.NPOI.OOXML.csproj',
    'Microi.Server/Microi.Panel/Microi.Panel.csproj',
    'Microi.Server/Microi.MemoryDiagnostics/Microi.MemoryDiagnostics.csproj',
    'Microi.Server/Microi.Tests/Fixtures/DatabasePoolNode/DatabasePoolNode.csproj',
    'Microi.Server/Microi.Tests/Fixtures/MemoryDiagnosticsNode/Microi.MemoryDiagnostics.Fixture.csproj'
  ]) {
    assert.ok(available.has(target), `夹具文件必须真实存在：${target}`);
    const without = new Map(projects); without.delete(target);
    assert.ok(missingSolutionProjects(without).includes(target), target);
  }
});

test('Windows 和 Unix csproj 引用解析为同一真实路径，保护目录仍按规范路径识别', () => {
  const project = 'Microi.Server/Microi.Cache/Microi.Cache.csproj';
  for (const dependency of ['Dos.Common', 'Microi.Core', 'Microi.net']) {
    const expected = `Microi.Server/${dependency}/${dependency}.csproj`;
    assert.equal(projectReferenceTarget(project, `..\\${dependency}\\${dependency}.csproj`), expected);
    assert.equal(projectReferenceTarget(project, `../${dependency}/${dependency}.csproj`), expected);
  }
  const protectedTarget = projectReferenceTarget(project, '..\\Microi.net\\Microi.net.csproj');
  assert.ok(protectedRoots.some(root => protectedTarget.startsWith(root + '/')));
  assert.equal(projectReferenceTarget('Microi.Server/Microi.Tests/Microi.Tests.csproj',
    'Fixtures\\DatabasePoolNode\\DatabasePoolNode.csproj'),
  'Microi.Server/Microi.Tests/Fixtures/DatabasePoolNode/DatabasePoolNode.csproj');
});

test('干净 Git 候选严格使用索引；迁移候选仅接受有明确替代的新项目', () => {
  const oldProject = 'Microi.Server/ThirdParty/MongoDB.Driver/MongoDB.Driver.Compatibility.csproj';
  const newProject = relocatedProjects.get(oldProject);
  const clean = selectPublicSourceFiles(new Set([oldProject]), new Set(), () => true);
  assert.equal(clean.mode, 'git-index');
  assert.deepEqual([...clean.files], [oldProject]);
  const moved = selectPublicSourceFiles(new Set([oldProject]), new Set([newProject]), file => file === newProject);
  assert.equal(moved.mode, 'working-candidate');
  assert.deepEqual([...moved.files], [newProject]);
  assert.deepEqual(moved.missingTrackedProjects, [oldProject]);
  assert.equal(relocatedProjects.get(oldProject), newProject);
});

test('公开源码的项目引用形成完整闭包', () => {
  if (fromGit) assert.equal(gitUntracked.status, 0, '无法读取 Git 未跟踪候选文件');
  for (const oldProject of selected.missingTrackedProjects)
    assert.ok(relocatedProjects.has(oldProject) && available.has(relocatedProjects.get(oldProject)),
      `删除的公开项目缺少已声明替代项目：${oldProject}`);
  assert.deepEqual([...available].filter(file => protectedRoots.some(root => file === root || file.startsWith(root + '/'))), []);
  assert.deepEqual(missingProjectReferences(available), []);
  const driver = 'Microi.Server/Microi.MongoDB.Driver/Microi.MongoDB.Driver.csproj';
  const panel = 'Microi.Server/Microi.Panel/Microi.Panel.csproj';
  for (const required of [driver, panel,
    'Microi.Server/Microi.MongoDB.Driver/upstream-3.11.2.source.zip',
    'Microi.Server/Microi.NPOI/Microi.NPOI.csproj',
    'Microi.Server/Microi.NPOI/upstream-2.8.1.source.zip'])
    assert.ok(available.has(required), `公开源码候选缺少 ${required} (${selected.mode})`);
});

test('公开候选缺少 MongoDB 驱动、NPOI 或面板项目时会失败', () => {
  for (const target of [
    'Microi.Server/Microi.MongoDB.Driver/Microi.MongoDB.Driver.csproj',
    'Microi.Server/Microi.NPOI/Microi.NPOI.csproj',
    'Microi.Server/Microi.Panel/Microi.Panel.csproj'
  ]) {
    const without = new Set(available); without.delete(target);
    assert.ok(missingProjectReferences(without).some(item => item.endsWith(' -> ' + target)), target);
  }
});
