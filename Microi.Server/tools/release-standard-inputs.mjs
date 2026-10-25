import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// 创建人方案被公开根仓忽略，但一键入口优先选择它；只冻结这个固定方案的原始字节，
// 不按方案内容复制闭源目录，也不提供任意外部项目的装配入口。
async function snapshotFounderSolution(root) {
  const name = 'Microi.Server/Microi.Anderson.sln', file = path.join(root, name);
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Founder solution must be a regular file without symbolic links');
  const server = path.join(root, 'Microi.Server');
  if ((await fs.lstat(server)).isSymbolicLink()) throw Error('Founder solution directory uses a symbolic link');
  const bytes = await fs.readFile(file), text = bytes.toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (bytes.length > 1024 * 1024 || !text.startsWith('Microsoft Visual Studio Solution File,')) throw Error('Invalid founder solution format');
  const allowed = new Set([
    'Microi.net.Api', 'Microi.WeChat', 'Microi.Captcha', 'Microi.OCR', 'Microi.Vision', 'Dos.ORM', 'Dos.Common',
    'Microi.Office', 'Microi.HDFS', 'Microi.Cache', 'Microi.SearchEngine', 'Microi.MQ', 'Microi.Job', 'Microi.Spider',
    'Microi.V8Engine', 'Microi.AI', 'Microi.MCP', 'Microi.MQTT', 'Microi.Core', 'Microi.Upgrade', 'Microi.MongoDB',
    'Microi.Translate', 'Microi.Tests', 'Microi.SSO', 'Microi.net', 'Microi.WorkFlow',
  ].map(project => project + '/' + project + '.csproj'));
  const folders = '2150E333-8FDC-42A3-9474-1A3956D46DE8', types = new Set(['9A19103F-16F7-4668-BE54-9A1E7A4F7556', 'FAE04EC0-301F-11D3-BF4B-00C04F79EFBC']);
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*Project\s*\(/.test(line)) continue;
    const match = /^\s*Project\("\{([A-Fa-f0-9-]{36})\}"\)\s*=\s*"[^"\r\n]+",\s*"([^"\r\n]+)",\s*"\{[A-Fa-f0-9-]{36}\}"\s*$/.exec(line);
    if (!match) throw Error('Malformed founder solution Project declaration');
    if (match[1].toUpperCase() === folders) continue; // 方案文件夹是虚拟节点，不能作为可执行项目读取。
    const project = match[2].replaceAll('\\', '/');
    if (!types.has(match[1].toUpperCase()) || !allowed.has(project) || seen.has(project)) throw Error('Unsafe or duplicate founder solution project path');
    seen.add(project);
    let current = server;
    for (const part of project.split('/')) {
      current = path.join(current, part);
      const item = await fs.lstat(current);
      if (item.isSymbolicLink()) throw Error('Founder solution project uses a symbolic link');
    }
    if (!(await fs.lstat(current)).isFile()) throw Error('Founder solution project must be a regular file');
  }
  if (!seen.size) throw Error('Founder solution must declare an approved project');
  return {[name]: createHash('sha256').update(bytes).digest('hex')};
}

// Full 读取的标准产品责任源码按唯一契约冻结，即使它们被根公开仓忽略。
// 只记录指纹，不把这些私有文件暂存或复制进公开仓。
export async function snapshotStandardInputs(root, {includeTestInputs = true, testPolicy = 'Full'} = {}) {
  if (!['Full', 'PlatformRelease'].includes(testPolicy)) throw Error('Unknown standard-input test policy');
  const founder = await snapshotFounderSolution(root);
  // 同版本免测 Docker 发布仍冻结实际方案；不要求未执行的产品测试私有夹具。
  if (!includeTestInputs) return founder;
  const contractPath = path.join(root, 'AI-Project/标准产品套件/source-contract.json');
  let bytes;
  try { bytes = await fs.readFile(contractPath); }
  catch (error) { if (error.code === 'ENOENT') return founder; throw error; }
  const contract = JSON.parse(bytes.toString('utf8'));
  if (contract.schemaVersion !== 1 || contract.target?.apiBase !== 'https://api.microi.net'
    || String(contract.target?.osClient).toLowerCase() !== 'itdos'
    || (testPolicy === 'Full' && (!Array.isArray(contract.applications) || contract.applications.length !== 6))) {
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
  const files = {...founder}, hash = data => createHash('sha256').update(data).digest('hex');
  const skipped = new Set(['.git', 'node_modules', 'dist', 'bin', 'obj', 'TestResults', '__pycache__', '.resource-sync-base']);
  const safeRelative = value => typeof value === 'string' && value.length > 0
    && !value.includes('\\') && !path.isAbsolute(value) && !/^[A-Za-z]:/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..');
  function declaredRelative(value) {
    if (!safeRelative(value)) throw Error('Unsafe declared source: a relative path is required');
    return value;
  }
  files[path.relative(root, contractPath).replaceAll('\\', '/')] = hash(bytes);
  if (testPolicy === 'PlatformRelease') {
    // README 的平台/独立业务应用边界：只冻结本模式实际消费的平台短信母版，
    // 不因同步目录存在而把六产品、独立 AI/邮箱/3D/worker/抽奖源码变成发布前置。
    await addSettingsInput();
    return files;
  }
  const keys = new Set();
  const requirementsRoot = await inside(declaredRelative(contract.requirementsRoot));
  for (const app of contract.applications) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(app.appKey) || keys.has(app.appKey)) throw Error('Invalid standard application identity');
    keys.add(app.appKey);
    // Full 直接读取各应用声明的需求正文；共享文档按同一路径自然去重，不扫描其它项目资料。
    await addInput(path.relative(root, path.join(requirementsRoot, declaredRelative(app.requirements))));
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

  // Full 的服务器包装与前端 Three 回归还读取唯一官方清单中的 AI/邮箱/3D/worker，以及抽奖
  // 契约声明的源与交付输入。只冻结这些已声明文件，不扫描其它应用或复制私有正文。
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
    if (official.SchemaVersion !== 1 || official.Origin?.ApiBase !== 'https://api.microi.net'
      || official.Origin?.OsClient !== 'iTdos' || !Array.isArray(official.Applications) || !Array.isArray(official.Repositories))
      throw Error('Invalid official test input source contract');
    // 只冻结服务器与前端门禁实际使用的责任入口，不遍历其它在线应用。
    for (const appKey of ['microi-ai-cad', 'ai-employee-center', 'mci-email', 'microi-3d-engine']) {
      const matches = official.Applications.filter(app => app.AppKey === appKey);
      if (matches.length !== 1) throw Error('Declared official test application must have one owner');
      await exactFiles(matches[0]);
    }
    const repositories = official.Repositories.filter(item => item.RepositoryKey === 'microi.openclaw');
    if (repositories.length !== 1) throw Error('Declared official test repository must have one owner');
    const repository = repositories[0], repositoryRoot = await inside(declaredRelative(repository.SourceRoot));
    // 每次 capture/verify 都核验真实独立仓身份；仅在父根仓中找到同一个 HEAD 不能冒充 worker 来源。
    let gitMetadata;
    try { gitMetadata = await fs.lstat(path.join(repositoryRoot, '.git')); }
    catch (error) { if (error.code === 'ENOENT') throw Error('Official worker requires its own independent Git repository'); throw error; }
    if (gitMetadata.isSymbolicLink() || (!gitMetadata.isDirectory() && !gitMetadata.isFile()))
      throw Error('Official worker independent Git metadata must not use a symbolic link');
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(repository.GitCommit || '')) throw Error('Invalid official worker GitCommit');
    const gitTop = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: repositoryRoot, encoding: 'utf8', timeout: 10000, windowsHide: true}).trim();
    if ((await fs.realpath(gitTop)) !== (await fs.realpath(repositoryRoot))) throw Error('Official worker repository root differs from declared SourceRoot');
    let workspaceHasGit = false;
    try { await fs.lstat(path.join(root, '.git')); workspaceHasGit = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (workspaceHasGit) {
      const commonDirectory = async cwd => fs.realpath(path.resolve(cwd,
        execFileSync('git', ['rev-parse', '--git-common-dir'], {cwd, encoding: 'utf8', timeout: 10000, windowsHide: true}).trim()));
      if ((await commonDirectory(root)) === (await commonDirectory(repositoryRoot)))
        throw Error('Official worker requires independent Git metadata instead of the workspace repository');
    }
    const head = execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {cwd: repositoryRoot, encoding: 'utf8', timeout: 10000, windowsHide: true}).trim();
    if (head !== repository.GitCommit) throw Error('Official worker HEAD differs from declared GitCommit');
    await exactFiles(repository);
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
    // manifest 是实际安装正文的入口；引擎文件即使未重复列入 sourceFiles，也必须按 manifest 声明冻结。
    const manifest = JSON.parse((await addInput(path.relative(root, path.join(applicationRoot, 'manifest.json')))).toString('utf8'));
    if (manifest.schemaVersion !== 2 || manifest.app?.key !== lottery.AppKey || !Array.isArray(manifest.engines))
      throw Error('Invalid lottery manifest source ownership');
    for (const engine of manifest.engines)
      await addInput(path.relative(root, path.join(applicationRoot, declaredRelative(engine?.sourceFile))));
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
  // 仅中央产品 Full 中实际存在的两个消费者启用此依赖；固定同步 profile 与精确 Key，不发现其它租户。
  const readers = [
    ['microi.uniapp/scripts/test-directory-card-config.mjs', ['get-sysUser-list']],
    ['microi.uniapp/scripts/test-task-assignee-search.mjs', ['get-sysUser-list', 'shouhoudd_zhipai']],
  ], engineKeys = new Set();
  for (const [reader, requiredKeys] of testPolicy === 'Full' ? readers : []) {
    try { await fs.lstat(path.join(root, reader)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await addInput(reader);
    for (const key of requiredKeys) engineKeys.add(key);
  }
  if (engineKeys.size) {
    const engineRoot = await inside('Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎');
    const matches = new Map([...engineKeys].map(key => [key, []]));
    async function findDeclaredEngines(directory) {
      for (const entry of (await fs.readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) await findDeclaredEngines(full);
        else if (entry.isFile()) for (const key of engineKeys)
          if (entry.name.endsWith('(' + key + ').js')) matches.get(key).push(full);
      }
    }
    await findDeclaredEngines(engineRoot);
    for (const [key, names] of matches) {
      if (names.length !== 1) throw Error(names.length ? 'Ambiguous synced xjy test ApiEngineKey: ' + key : 'Synced xjy test ApiEngineKey not found: ' + key);
      await addInput(path.relative(root, names[0]));
    }
  }
  // 系统设置回归直接比较主租户短信母版正文；固定该输入，不遍历其它接口或租户。
  async function addSettingsInput() {
    let settingsReaderExists = false;
    try { await fs.lstat(path.join(root, 'Microi.Server/OfficialApplications/Resource/tenant-system-settings-resource.test.mjs')); settingsReaderExists = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (settingsReaderExists) {
      // 母版在租户接口目录；不要求同级独立 AI应用 目录或其中的产品先存在。
      const tenantSource = await inside(path.dirname(declaredRelative(contract.sourceParent)));
      await addInput(path.relative(root, path.join(tenantSource, '接口引擎/未分类/[系统]发送阿里云短信(send_sms_reg).js')));
    }
  }
  await addSettingsInput();
  return files;
}
