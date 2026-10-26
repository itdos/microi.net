import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyPlatformReleaseEvidence} from '../Microi.Tests/ReleaseGate/release-test-matrix.mjs';
import {inspectDockerRemote} from './release-remote-collision.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const inside = (root, file) => { const relative = path.relative(root, file); return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)); };
function regular(file) {
  const full = path.resolve(file);
  for (let current = full; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Release session paths cannot use links');
    if (path.dirname(current) === current) break;
  }
  if (!fs.statSync(full).isFile()) throw Error('Release evidence must be a regular file');
  return full;
}
function fingerprint(file) { return {file: regular(file), sha256: digest(fs.readFileSync(file))}; }
function readJson(file) {
  regular(file);
  if (fs.statSync(file).size > 16 * 1024 * 1024) throw Error('Release session JSON is too large');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function imageId(image) {
  // containerd 的实际 .Id 可以是 manifest digest；禁止从 build 日志猜 config digest。
  const id = execFileSync('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], {encoding: 'utf8', windowsHide: true, timeout: 30000}).trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(id)) throw Error('Docker image identity is unavailable');
  return id;
}
function snapshotTree(directory) {
  const result = [];
  function walk(folder) {
    if (fs.lstatSync(folder).isSymbolicLink()) throw Error('Release artifact directory uses a link');
    for (const name of fs.readdirSync(folder).sort()) {
      const file = path.join(folder, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error('Release artifact uses a link');
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile()) result.push(fingerprint(file));
      else throw Error('Unsupported release artifact');
      if (result.length > 30000) throw Error('Release artifact inventory is too large');
    }
  }
  walk(directory);
  if (!result.length) throw Error('Release artifact directory is empty');
  return result;
}

// 日志只保存公开版本、路径与指纹，不保存发布密码、Token 或进程环境。
// 断点只决定是否执行某一步；原候选、TRX/TAP、加密、冒烟与远端门禁仍须独立验证。
export class ReleaseSession {
  constructor(file, {root = process.cwd(), verifyTests = verifyPlatformReleaseEvidence, inspectRemote = inspectDockerRemote, inspectImage = imageId} = {}) {
    this.file = path.resolve(file); this.root = root; this.adapters = {verifyTests, inspectRemote, inspectImage};
  }
  load(root = this.root) {
    const state = readJson(this.file);
    if (state.schema !== 'microi.release.session.v1' || state.root !== fs.realpathSync(root)
      || !/^\d+\.\d+\.\d+$/.test(state.version) || !Number.isSafeInteger(state.started)
      || state.started <= 0 || !inside(state.gateDir, this.file) || !state.stages || Array.isArray(state.stages)) throw Error('Release session identity does not match this workspace');
    return state;
  }
  save(state, fresh = false) {
    const temp = this.file + '.' + randomUUID() + '.tmp';
    if (fs.existsSync(this.file)) regular(this.file);
    if (fresh && fs.existsSync(this.file)) throw Error('Release session already exists; use --resume');
    fs.writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    try { fs.renameSync(temp, this.file); } catch (error) { fs.unlinkSync(temp); throw error; }
  }
  init(root, version, started, timingFile, gateDir, plan) {
    const state = {schema: 'microi.release.session.v1', root: fs.realpathSync(root), version, started: Number(started),
      timingFile: path.resolve(timingFile), gateDir: fs.realpathSync(gateDir), planHash: digest(plan), stages: {}};
    if (!inside(state.gateDir, this.file) || !/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(state.started) || state.started <= 0) throw Error('Invalid release session');
    this.save(state, true); return state;
  }
  plan(value) { if (this.load().planHash !== digest(value)) throw Error('Release channels or configuration changed; do not resume a different plan'); }
  bind(candidateFile, clientVersion) {
    const state = this.load(), candidate = readJson(candidateFile);
    if (candidate.scope !== 'PlatformRelease' || clientVersion !== state.version) throw Error('Frozen release version or scope mismatch');
    if (state.candidate && (state.candidate.sha256 !== fingerprint(candidateFile).sha256 || state.clientVersion !== clientVersion)) throw Error('Cannot replace a frozen release candidate');
    state.candidate = fingerprint(candidateFile); state.clientVersion = clientVersion; this.save(state);
  }
  checked(state, file) {
    const full = path.resolve(file);
    if (!inside(state.root, full) && !inside(state.gateDir, full)) throw Error('Release evidence is outside the workspace and gate directory');
    return fingerprint(full);
  }
  async decision(key) {
    const state = this.load(), stage = Object.hasOwn(state.stages, key) ? state.stages[key] : null;
    if (!stage) return 'run';
    for (const proof of stage.files) if (this.checked(state, proof.file).sha256 !== proof.sha256) throw Error('Completed release evidence changed: ' + key);
    if (stage.tree && JSON.stringify(snapshotTree(stage.tree.directory)) !== JSON.stringify(stage.tree.files)) throw Error('Completed release artifact changed: ' + key);
    if (key === 'tests') await this.adapters.verifyTests(state.testReceipt, state.candidate.file);
    if (stage.image && this.adapters.inspectImage(stage.image) !== stage.image) throw Error('Completed release image is missing or changed');
    if (stage.tag) {
      const current = this.adapters.inspectRemote(stage.tag.tag);
      if (current.state !== 'present' || current.digest !== stage.tag.digest) throw Error('Published Docker tag changed; refusing to overwrite it');
    }
    return 'reuse';
  }
  async seal(key, files = [], {tree, image, tagReceipt} = {}) {
    const state = this.load();
    if (!/^(?:tests|resources|client|backend|docs|image:[a-z0-9_-]+|nuget:[A-Za-z0-9_.-]+|docker:[A-Za-z0-9.:/_-]+)$/.test(key)) throw Error('Invalid release stage');
    if (!state.candidate || this.checked(state, state.candidate.file).sha256 !== state.candidate.sha256) throw Error('Frozen candidate receipt changed');
    const stage = {completedAt: new Date().toISOString(), files: files.map(file => this.checked(state, file))};
    if (key === 'tests') {
      if (files.length !== 1) throw Error('Original test evidence is required');
      await this.adapters.verifyTests(path.resolve(files[0]), state.candidate.file);
      state.testReceipt = path.resolve(files[0]);
    }
    if (tree) { if (!inside(state.root, path.resolve(tree))) throw Error('Artifact tree is outside workspace'); stage.tree = {directory: path.resolve(tree), files: snapshotTree(tree)}; }
    if (image) stage.image = this.adapters.inspectImage(image);
    if (tagReceipt) {
      const proof = readJson(tagReceipt);
      if (proof.schema !== 'microi.release.docker-published-tag.v1' || proof.published !== true || key !== 'docker:' + proof.tag
        || !/^sha256:[a-f0-9]{64}$/.test(proof.digest)) throw Error('Docker publication is not independently confirmed');
      stage.files.push(this.checked(state, tagReceipt)); stage.tag = {tag: proof.tag, digest: proof.digest};
    }
    state.stages[key] = stage; this.save(state); return stage;
  }
}

async function main() {
  const [mode, file, ...args] = process.argv.slice(2), session = new ReleaseSession(file);
  if (mode === 'init') { const [root, version, started, timing, gate, ...plans] = args; session.init(root, version, started, timing, gate, plans.join('\n')); }
  else if (mode === 'plan') session.plan(args.join('\n'));
  else if (mode === 'get') {
    const state = session.load(), fields = {version: state.version, started: state.started, timing: state.timingFile, gate: state.gateDir,
      candidate: state.candidate?.file || '', clientVersion: state.clientVersion || '', tests: state.testReceipt || ''};
    if (!Object.hasOwn(fields, args[0])) throw Error('Unknown release session field');
    process.stdout.write(String(fields[args[0]]));
  }
  else if (mode === 'decision') process.stdout.write(await session.decision(args[0]));
  else if (mode === 'bind') session.bind(args[0], args[1]);
  else if (mode === 'seal') await session.seal(args[0], args.slice(1));
  else if (mode === 'seal-tree') await session.seal(args[0], [], {tree: args[1], ...(args[2] ? {image: args[2]} : {})});
  else if (mode === 'seal-image') await session.seal(args[0], [], {image: args[1]});
  else if (mode === 'seal-backend') {
    const packages = fs.readFileSync(regular(args[1]), 'utf8').split('\0').filter(Boolean);
    if (!packages.length) throw Error('Backend package inventory is empty');
    await session.seal('backend', [args[0], ...packages]);
  }
  else if (mode === 'pending-packages') {
    const state = session.load(), output = path.resolve(args[1]);
    if (!inside(state.gateDir, output)) throw Error('Pending package list must be in release gate');
    const pending = [];
    for (const pkg of fs.readFileSync(regular(args[0]), 'utf8').split('\0').filter(Boolean))
      if (await session.decision('nuget:' + path.basename(pkg)) !== 'reuse') pending.push(pkg);
    fs.writeFileSync(output, pending.length ? pending.join('\0') + '\0' : '');
  }
  else if (mode === 'image') { const state = session.load(); if (await session.decision(args[0]) !== 'reuse' || !state.stages[args[0]].image) throw Error('Release image checkpoint missing'); process.stdout.write(state.stages[args[0]].image); }
  else if (mode === 'seal-tag') await session.seal('docker:' + args[0], [], {tagReceipt: args[1]});
  else throw Error('Unknown release session operation');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error('Release session refused: ' + error.message); process.exitCode = 2; });
