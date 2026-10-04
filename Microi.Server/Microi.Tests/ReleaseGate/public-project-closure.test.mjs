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
const available = new Set(fromGit ? git.stdout.split('\0').filter(Boolean)
  : sourceFiles(path.join(workspace, 'Microi.Server')));
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

test('公开源码的项目引用形成完整闭包', () => {
  assert.deepEqual(missingProjectReferences(available), []);
  const driver = 'Microi.Server/ThirdParty/MongoDB.Driver/MongoDB.Driver.Compatibility.csproj';
  const panel = 'Microi.Server/Microi.Panel/Microi.Panel.csproj';
  for (const required of [driver, panel, 'Microi.Server/ThirdParty/MongoDB.Driver/upstream-3.11.2.source.zip'])
    assert.ok(available.has(required), `Gitee 源码缺少 ${required}`);
});

test('公开仓缺少 MongoDB 驱动或面板项目时会失败', () => {
  for (const target of [
    'Microi.Server/ThirdParty/MongoDB.Driver/MongoDB.Driver.Compatibility.csproj',
    'Microi.Server/Microi.Panel/Microi.Panel.csproj'
  ]) {
    const without = new Set(available); without.delete(target);
    assert.ok(missingProjectReferences(without).some(item => item.endsWith(' -> ' + target)), target);
  }
});
