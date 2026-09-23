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

function missingProjectReferences(available) {
  const missing = [];
  for (const project of available) {
    if (!project.endsWith('.csproj')) continue;
    const source = fs.readFileSync(path.join(workspace, project), 'utf8');
    for (const match of source.matchAll(/<ProjectReference\b[^>]*\bInclude="([^"]+)"/g)) {
      if (match[1].includes('$(')) continue;
      const target = path.relative(workspace,
        path.resolve(workspace, path.dirname(project), match[1])).replaceAll('\\', '/');
      // 私有源码由公开方案的 NuGet 模式提供；根公开仓不能收进这些目录。
      if (protectedRoots.some(root => target === root || target.startsWith(root + '/'))) continue;
      if (!available.has(target) || !fs.existsSync(path.join(workspace, target)))
        missing.push(`${project} -> ${target}`);
    }
  }
  return missing;
}

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
