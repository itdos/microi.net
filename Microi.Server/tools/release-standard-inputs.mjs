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

  // Full 的跨工程包装还读取唯一官方清单中的 AI/邮箱/worker，以及抽奖
  // 契约声明的源与交付输入。只冻结这些已声明文件，不扫描其它应用或复制私有正文。
  const safeRelative = value => typeof value === 'string' && value.length > 0
    && !value.includes('\\') && !path.isAbsolute(value) && !/^[A-Za-z]:/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..');
  function declaredRelative(value) {
    if (!safeRelative(value)) throw Error('Unsafe declared source: a relative path is required');
    return value;
  }
  async function addInput(value) {
    const full = await inside(value);
    if (!(await fs.lstat(full)).isFile()) throw Error('Declared source must be a regular file');
    const bytes = await fs.readFile(full);
    files[path.relative(root, full).replaceAll('\\', '/')] = hash(bytes);
    return bytes;
  }
  async function optionalContract(value) {
    try { return JSON.parse((await addInput(value)).toString('utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function exactFiles(source) {
    const sourceRoot = await inside(declaredRelative(source.SourceRoot));
    if (!Array.isArray(source.Files) || !source.Files.length || source.FileCount !== source.Files.length)
      throw Error('Invalid declared official source file count');
    const names = new Set();
    for (const file of source.Files) {
      const name = declaredRelative(file.Path), key = name.toLowerCase();
      if (names.has(key)) throw Error('Duplicate declared official source file');
      names.add(key);
      if (!/^[a-f0-9]{64}$/.test(file.Sha256) || !Number.isSafeInteger(file.Size) || file.Size < 0)
        throw Error('Invalid declared official source fingerprint');
      // 原始官方 SHA/LocalTestOverlay 由业务门禁逐字节验证；候选保存实际字节 SHA，
      // 使 Full 后任一输入变化都会成为漂移，不能用合同旧 SHA 掩盖实际文件变化。
      await addInput(path.relative(root, path.join(sourceRoot, name)));
    }
  }
  const official = await optionalContract('Microi.Server/Microi.Tests/V8/official-application-source-contract.json');
  if (official) {
    if (official.SchemaVersion !== 1 || official.Origin?.ApiBase !== 'https://api.itdos.com'
      || official.Origin?.OsClient !== 'iTdos' || !Array.isArray(official.Applications) || !Array.isArray(official.Repositories))
      throw Error('Invalid official test input source contract');
    // 当前 Full 实际使用的责任入口；同合同中未执行的独立 3D 应用不扩大冻结范围。
    for (const appKey of ['microi-ai-cad', 'ai-employee-center', 'mci-email']) {
      const matches = official.Applications.filter(app => app.AppKey === appKey);
      if (matches.length !== 1) throw Error('Declared official test application must have one owner');
      await exactFiles(matches[0]);
    }
    const repositories = official.Repositories.filter(item => item.RepositoryKey === 'microi.openclaw');
    if (repositories.length !== 1) throw Error('Declared official test repository must have one owner');
    await exactFiles(repositories[0]);
  }
  const lottery = await optionalContract('Microi.Server/Microi.Tests/V8/event-lottery-release.json');
  if (lottery) {
    if (lottery.SchemaVersion !== 1 || lottery.AppKey !== 'event-lottery-studio' || !Array.isArray(lottery.DeliveryTests))
      throw Error('Invalid lottery test input source contract');
    const sourceRoot = await inside(declaredRelative(lottery.SourceRoot)), applicationRoot = path.dirname(sourceRoot);
    if (path.basename(sourceRoot) !== 'source') throw Error('Unsafe lottery source root: expected declared source directory');
    async function addDeclaredList(base, names) {
      if (!Array.isArray(names) || !names.length) throw Error('Declared lottery inputs cannot be empty');
      const seen = new Set();
      for (const name of names) {
        declaredRelative(name);
        if (seen.has(name.toLowerCase())) throw Error('Duplicate declared lottery input');
        seen.add(name.toLowerCase());
        await addInput(path.relative(root, path.join(base, name)));
      }
    }
    const sourceContract = JSON.parse((await addInput(path.relative(root, path.join(sourceRoot, 'package-contract.json')))).toString('utf8'));
    const deliveryContract = JSON.parse((await addInput(path.relative(root, path.join(applicationRoot, 'package-contract.json')))).toString('utf8'));
    for (const value of [sourceContract, deliveryContract]) {
      if (value.schemaVersion !== 2 || value.applicationKey !== lottery.AppKey) throw Error('Invalid lottery declared package inputs');
    }
    // SourceRoot 的完整源码和外侧 helper/scenarios 已在两份版本化包合同中精确列出。
    // 不遍历 appParent，避免把 build、恢复点、凭据或其它独立测试意外纳入。
    await addDeclaredList(sourceRoot, sourceContract.sourceFiles);
    await addDeclaredList(applicationRoot, deliveryContract.deliveryFiles);
    await addInput(path.relative(root, path.join(sourceRoot, declaredRelative(lottery.BehaviorTest))));
    const deliveryTests = new Set();
    for (const name of lottery.DeliveryTests) {
      if (typeof name !== 'string' || !name || name.includes('\\') || path.isAbsolute(name) || /^[A-Za-z]:/.test(name))
        throw Error('Unsafe lottery delivery test: relative path is required');
      const full = path.resolve(sourceRoot, name), relative = path.relative(applicationRoot, full);
      if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative))
        throw Error('Lottery delivery test escapes declared application');
      if (deliveryTests.has(relative.toLowerCase())) throw Error('Duplicate declared lottery delivery test');
      deliveryTests.add(relative.toLowerCase());
      await addInput(path.relative(root, full));
    }
  }
  return files;
}
