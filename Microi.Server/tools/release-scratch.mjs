import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const marker = 'microi-scratch-owner.json';
const tools = path.dirname(fileURLToPath(import.meta.url));
function assertAncestors(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Scratch ancestor is a link: ${current}`);
    if (current === path.dirname(current)) break;
  }
}
export function createReleaseScratch(parent) {
  parent = path.resolve(parent);
  if (parent === path.parse(parent).root) throw new Error('Scratch parent cannot be a filesystem root');
  assertAncestors(parent);
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'release-scratch-'));
  const owner = { schema: 1, parent, directory, token: randomUUID(), createdAt: new Date().toISOString() };
  // 新建目录后登记双份身份；不接管已经存在的目录。
  fs.writeFileSync(path.join(directory, marker), JSON.stringify(owner), { flag: 'wx' });
  fs.writeFileSync(`${directory}.owner.json`, JSON.stringify(owner), { flag: 'wx' });
  return directory;
}
function assertTree(directory) {
  assertAncestors(directory);
  for (const name of fs.readdirSync(directory)) {
    const entry = path.join(directory, name), stat = fs.lstatSync(entry);
    if (name === '.git' || stat.isSymbolicLink()) throw new Error(`Scratch contains Git or a link: ${entry}`);
    if (!(stat.mode & 0o200)) throw new Error(`Scratch contains a read-only entry: ${entry}`);
    if (stat.isDirectory()) assertTree(entry);
  }
}
export function cleanupReleaseScratch(directory) {
  directory = path.resolve(directory);
  assertAncestors(directory);
  const leaseFile = `${directory}.owner.json`;
  if (fs.lstatSync(leaseFile).isSymbolicLink()) throw new Error('Scratch owner record is a link');
  const owner = JSON.parse(fs.readFileSync(leaseFile, 'utf8'));
  if (owner.schema !== 1 || owner.directory !== directory || path.dirname(directory) !== owner.parent ||
      !/^release-scratch-[A-Za-z0-9]+$/.test(path.basename(directory)) || typeof owner.token !== 'string') {
    throw new Error('Scratch ownership or boundary mismatch');
  }
  const receipt = `${directory}.cleanup.json`;
  const result = { directory, cleaned: false, finishedAt: new Date().toISOString() };
  try {
    if (fs.existsSync(directory)) {
      const markerFile = path.join(directory, marker);
      if (fs.lstatSync(markerFile).isSymbolicLink() || fs.readFileSync(markerFile, 'utf8') !== JSON.stringify(owner)) {
        throw new Error('Scratch owner identity changed');
      }
      const relativeCwd = path.relative(directory, process.cwd());
      if (!relativeCwd || (!relativeCwd.startsWith(`..${path.sep}`) && relativeCwd !== '..' && !path.isAbsolute(relativeCwd))) {
        throw new Error('Scratch is the current working directory');
      }
      assertTree(directory);
      if (process.platform === 'win32') {
        // 普通 PowerShell 删除保留系统保护；不用 rimraf 的 chmod/强制重试。
        const run = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
          path.join(tools, 'Remove-MicroiReleaseScratch.ps1'), '-LiteralPath', directory, '-ExpectedParent', owner.parent],
        { encoding: 'utf8', windowsHide: true });
        if (run.error || run.status !== 0) throw new Error(run.error?.message || run.stderr.trim() || `Scratch cleanup exited ${run.status}`);
      } else {
        fs.rmSync(directory, { recursive: true, force: false, maxRetries: 0 });
      }
    }
    if (fs.existsSync(directory)) throw new Error('Scratch cleanup readback failed');
    fs.unlinkSync(leaseFile);
    result.cleaned = true;
  } catch (error) {
    result.error = error.message;
    throw error;
  } finally {
    // 只保留小回执；清理错误与发布结果分别记录。
    try {
      if (fs.existsSync(receipt) && (!fs.lstatSync(receipt).isFile() || JSON.parse(fs.readFileSync(receipt, 'utf8')).directory !== directory)) {
        throw new Error('Scratch receipt identity changed');
      }
      fs.writeFileSync(receipt, JSON.stringify(result, null, 2));
    } catch (error) {
      if (!result.error) throw error;
      console.error(`Cannot write scratch cleanup receipt: ${error.message}`);
    }
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, target] = process.argv.slice(2);
    if (!target || !path.isAbsolute(target)) throw new Error('Usage: release-scratch.mjs create|cleanup <absolute-path>');
    if (mode === 'create') console.log(createReleaseScratch(target));
    else if (mode === 'cleanup') cleanupReleaseScratch(target);
    else throw new Error(`Unknown scratch action: ${mode}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
