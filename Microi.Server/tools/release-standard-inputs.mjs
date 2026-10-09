import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Full 读取的标准产品责任源码按唯一契约冻结，即使它们被根公开仓忽略。
// 只记录指纹，不把这些私有文件暂存或复制进公开仓。
export async function snapshotStandardInputs(root) {
  const contractPath = path.join(root, 'AI-Project/标准产品套件/source-contract.json');
  let bytes;
  try { bytes = await fs.readFile(contractPath); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  const contract = JSON.parse(bytes.toString('utf8'));
  if (contract.schemaVersion !== 1 || contract.target?.apiBase !== 'https://api.itdos.com'
    || String(contract.target?.osClient).toLowerCase() !== 'itdos'
    || !Array.isArray(contract.applications) || contract.applications.length !== 6) {
    throw Error('Invalid standard product source contract');
  }
  async function inside(value) {
    if (typeof value !== 'string' || path.isAbsolute(value)) throw Error('Standard source must be relative');
    const full = path.resolve(root, value), relative = path.relative(root, full);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep)) throw Error('Standard source escapes workspace');
    let current = root;
    for (const part of relative.split(path.sep)) {
      current = path.join(current, part);
      if ((await fs.lstat(current)).isSymbolicLink()) throw Error('Standard source uses a symbolic link');
    }
    return full;
  }
  await inside(path.relative(root, contractPath));
  const files = {}, hash = data => createHash('sha256').update(data).digest('hex');
  const skipped = new Set(['.git', 'node_modules', 'dist', 'bin', 'obj', 'TestResults', '__pycache__', '.resource-sync-base']);
  files[path.relative(root, contractPath).replaceAll('\\', '/')] = hash(bytes);
  const keys = new Set();
  for (const app of contract.applications) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(app.appKey) || keys.has(app.appKey)) throw Error('Invalid standard application identity');
    keys.add(app.appKey);
    const folder = await inside(path.join(contract.sourceParent, app.appKey));
    async function walk(directory) {
      for (const name of (await fs.readdir(directory)).sort()) {
        if (skipped.has(name)) continue;
        const full = path.join(directory, name), stat = await fs.lstat(full);
        if (stat.isSymbolicLink()) throw Error('Standard source uses a symbolic link');
        if (stat.isDirectory()) await walk(full);
        else if (stat.isFile()) files[path.relative(root, full).replaceAll('\\', '/')] = hash(await fs.readFile(full));
        else throw Error('Standard source must be a regular file');
      }
    }
    await walk(folder);
  }
  return files;
}
