import fs from 'node:fs';
import path from 'node:path';

export function copyOnlineAiMcpRuntime(staging, destination) {
  const source = fs.realpathSync(staging);
  const entries = [];
  const activeDirectories = new Set();
  function inspect(relativeName) {
    const file = path.join(source, relativeName);
    const target = fs.realpathSync(file);
    const relative = path.relative(source, target);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`MCP runtime link escapes its staging directory: ${file}`);
    }
    const stat = fs.statSync(target);
    if (!stat.isDirectory() && !stat.isFile()) throw new Error(`Unsupported MCP runtime entry: ${file}`);
    entries.push({ relativeName, target, directory: stat.isDirectory(), mode: stat.mode });
    if (!stat.isDirectory()) return;
    if (activeDirectories.has(target)) throw new Error(`Cyclic MCP runtime directory link: ${file}`);
    activeDirectories.add(target);
    for (const name of fs.readdirSync(target)) inspect(path.join(relativeName, name));
    activeDirectories.delete(target);
  }
  for (const name of ['package.json', 'dist', 'node_modules']) inspect(name);
  // A runtime is a complete production snapshot; stale dependencies cannot survive a rebuild.
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) {
    const file = path.join(destination, entry.relativeName);
    if (entry.directory) fs.mkdirSync(file, { recursive: true, mode: entry.mode & 0o777 });
    else {
      // Copy the resolved regular file; bin wrappers remain usable after staging is removed.
      fs.copyFileSync(entry.target, file);
      fs.chmodSync(file, entry.mode & 0o777);
    }
  }
  if (!fs.existsSync(path.join(destination, 'dist/index.js'))) {
    throw new Error('The packaged MCP entry point is missing');
  }
}
