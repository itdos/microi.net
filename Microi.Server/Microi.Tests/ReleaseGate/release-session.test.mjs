import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {ReleaseSession} from '../../tools/release-session.mjs';
import {createReleaseScratch, cleanupReleaseScratch} from '../../tools/release-scratch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const area = path.join(root, '.tmp/release-resume-hardening-20261026/fixtures');
fs.mkdirSync(area, {recursive: true});
const gitPath = process.platform === 'win32' ? execFileSync('git', ['--exec-path'], {encoding: 'utf8'}).trim() : '';
const bashPath = process.platform === 'win32' ? path.resolve(gitPath, '../../..', 'bin/bash.exe') : 'bash';
const entrySource = fs.readFileSync(path.join(root, 'Microi一键编译发布.sh'), 'utf8');
function bashRun(body) {
  const result = spawnSync(bashPath, ['--noprofile', '--norc', '-s'], {cwd: root, encoding: 'utf8', timeout: 15000, input: 'set -e\nset -o pipefail\n' + body});
  assert.ifError(result.error); return result;
}
function fixture(t, adapters = {}) {
  const directory = createReleaseScratch(area);
  t.after(() => cleanupReleaseScratch(directory));
  const gate = path.join(directory, 'gate'); fs.mkdirSync(gate);
  const candidate = path.join(gate, 'candidate.json');
  fs.writeFileSync(candidate, JSON.stringify({scope: 'PlatformRelease', files: {a: 'a'}, sourceHead: 'a'.repeat(40)}));
  const session = new ReleaseSession(path.join(gate, 'session.json'), {root: directory, ...adapters});
  session.init(directory, '8.7.3', 1792959990, path.join(gate, 'timing.jsonl'), gate, 'all-channels');
  session.bind(candidate, '8.7.3');
  return {directory, gate, candidate, session};
}
test('resume parser selects the original complete platform flow instead of a partial rerun', () => {
  const entry = process.env.MICROI_TEST_RELEASE_ENTRY || path.join(root, 'Microi一键编译发布.sh');
  const source = fs.readFileSync(entry, 'utf8');
  const policy = source.slice(source.indexOf('MICROI_FULL_ONLY=false'), source.indexOf('# 从交互选项完成开始计时'));
  const git = process.platform === 'win32' ? execFileSync('git', ['--exec-path'], {encoding: 'utf8'}).trim() : '';
  const bash = process.platform === 'win32' ? path.resolve(git, '../../..', 'bin/bash.exe') : 'bash';
  const result = spawnSync(bash, ['--noprofile', '--norc', '-s', '--', '--resume=/original/session.json'],
    {cwd: root, encoding: 'utf8', timeout: 15000, input: `${policy}\nprintf 'COMPLETE=%s\\nRESUME=%s\\n' "$MICROI_COMPLETE_PLATFORM_RELEASE" "$MICROI_RELEASE_RESUME"\n`});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /COMPLETE=true/);
  assert.match(result.stdout, /RESUME=\/original\/session.json/);
});
test('new process keeps the first start, version and channel plan', t => {
  const {session, directory} = fixture(t);
  const recovered = new ReleaseSession(session.file, {root: directory});
  assert.equal(recovered.load().started, 1792959990);
  assert.equal(recovered.load().version, '8.7.3');
  recovered.plan('all-channels');
  assert.throws(() => recovered.plan('website-only'), /configuration changed/);
  assert.throws(() => recovered.init(directory, '8.7.4', 1792960000, 'other', path.dirname(session.file), 'all-channels'), /already exists/);
});
test('failed or absent tests cannot become a reusable checkpoint', async t => {
  const {session, gate} = fixture(t, {verifyTests: async () => {throw Error('raw TRX failed');}});
  const receipt = path.join(gate, 'tests.json'); fs.writeFileSync(receipt, '{}');
  assert.equal(await session.decision('tests'), 'run');
  await assert.rejects(session.seal('tests', [receipt]), /raw TRX failed/);
  assert.equal(await session.decision('tests'), 'run');
});
test('test reuse invokes the original raw-evidence verifier again', async t => {
  let verified = 0;
  const {session, gate} = fixture(t, {verifyTests: async () => {verified++;}});
  const receipt = path.join(gate, 'tests.json'); fs.writeFileSync(receipt, '{"original":true}');
  await session.seal('tests', [receipt]);
  assert.equal(await session.decision('tests'), 'reuse');
  assert.equal(verified, 2);
  fs.writeFileSync(receipt, '{"original":false}');
  await assert.rejects(session.decision('tests'), /evidence changed/);
});
test('completed packages are reusable without waiting on the public package index', async t => {
  const {session, directory} = fixture(t, {inspectRemote: () => {throw Error('must not wait for CDN');}});
  const pkg = path.join(directory, 'Package.8.7.3.nupkg'); fs.writeFileSync(pkg, 'accepted-package-bytes');
  await session.seal('nuget:Package.8.7.3.nupkg', [pkg]);
  assert.equal(await session.decision('nuget:Package.8.7.3.nupkg'), 'reuse');
  fs.writeFileSync(pkg, 'different-package-bytes');
  await assert.rejects(session.decision('nuget:Package.8.7.3.nupkg'), /evidence changed/);
});
test('Docker stores actual image ID rather than guessing a config digest', async t => {
  const manifestId = 'sha256:' + 'a'.repeat(64), configId = 'sha256:' + 'b'.repeat(64);
  const {session} = fixture(t, {inspectImage: image => image === 'microi-web:latest' || image === manifestId ? manifestId : configId});
  await session.seal('image:client', [], {image: 'microi-web:latest'});
  assert.equal(session.load().stages['image:client'].image, manifestId);
  assert.equal(await session.decision('image:client'), 'reuse');
});
test('remaining-only publication never downgrades a remotely advanced Docker tag', async t => {
  const hash = 'sha256:' + 'a'.repeat(64); let remote = hash;
  const {session, gate} = fixture(t, {inspectRemote: () => ({state: 'present', digest: remote})});
  const proof = path.join(gate, 'published.json'), tag = 'registry.example/platform/api:v8.7.3';
  fs.writeFileSync(proof, JSON.stringify({schema: 'microi.release.docker-published-tag.v1', tag, published: true, digest: hash}));
  await session.seal('docker:' + tag, [], {tagReceipt: proof});
  assert.equal(await session.decision('docker:' + tag), 'reuse');
  remote = 'sha256:' + 'c'.repeat(64);
  await assert.rejects(session.decision('docker:' + tag), /refusing to overwrite/);
});
test('failed Docker confirmation is not recorded as published', async t => {
  const {session, gate} = fixture(t), tag = 'registry.example/platform/api:latest';
  const proof = path.join(gate, 'unknown.json'); fs.writeFileSync(proof, JSON.stringify({published: false, tag}));
  await assert.rejects(session.seal('docker:' + tag, [], {tagReceipt: proof}), /not independently confirmed/);
  assert.equal(await session.decision('docker:' + tag), 'run');
});
test('website-only recovery preserves built output but detects additions and drift', async t => {
  const {session, directory} = fixture(t), dist = path.join(directory, 'dist'); fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'index.html'), 'frozen website');
  await session.seal('docs', [], {tree: dist});
  assert.equal(await session.decision('docs'), 'reuse');
  assert.equal(await session.decision('image:api'), 'run');
  fs.writeFileSync(path.join(dist, 'unexpected.js'), 'changed');
  await assert.rejects(session.decision('docs'), /artifact changed/);
});
test('frozen candidate cannot be replaced and evidence cannot escape the release boundary', async t => {
  const {session, candidate} = fixture(t);
  assert.throws(() => session.bind(candidate, '8.7.4'), /version or scope mismatch/);
  await assert.rejects(session.seal('backend', [fileURLToPath(import.meta.url)]), /outside/);
  fs.writeFileSync(candidate, JSON.stringify({scope: 'PlatformRelease', files: {b: 'b'}}));
  await assert.rejects(session.seal('resources'), /candidate receipt changed/);
});
const dockerFunction = entrySource.slice(entrySource.indexOf('docker_push_plan() {'), entrySource.indexOf('\nif [ ${#SELECTED_API_PLANS[@]} -gt 0 ] || [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then', entrySource.indexOf('docker_push_plan() {')));
const shellFakes = String.raw`
print_step(){ :; }; print_info(){ :; }; print_success(){ :; }; print_warning(){ :; }; print_fail(){ echo "REFUSED:$*" >&2; exit 7; }
run_release_command(){ printf 'CALL:%s\n' "$*"; }
node(){ if [ "$1" = session-tool ]; then case "$2" in image) printf 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';; esac; else command node "$@"; fi; }
MICROI_RELEASE_SESSION=session.json
MICROI_RELEASE_SESSION_TOOL=session-tool
MICROI_RELEASE_GATE_DIR=/gate
MICROI_RELEASE_CANDIDATE=/candidate.json
MICROI_RELEASE_TEST_POLICY=PlatformRelease
MICROI_ENCRYPTION_RECEIPT=/encrypted.json
PUBLISH_DIR=/publish
DOCKER_REGISTRY=registry.example
DOCKER_NAMESPACE=platform
BUILD_CLIENT=true
PUBLISH_BACKEND=true
HAS_ENCRYPT=false
`;
test('actual Docker function resumes only the remaining tag without rebuilding an image', () => {
  const result = bashRun(shellFakes + String.raw`
release_stage_needed(){ case "$1" in image:*|docker:*:latest) return 1;; *) return 0;; esac; }
` + dockerFunction + '\ndocker_push_plan "PC|client|microi-web|web:{latest},web:{version}" 8.7.3\n');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /CALL:docker build /);
  assert.doesNotMatch(result.stdout, /CALL:docker push .*:latest/);
  assert.match(result.stdout, /CALL:docker push registry\.example\/platform\/web:v8\.7\.3/);
  assert.match(result.stdout, /release-artifact\.mjs verify client/);
});
test('empty frontend version fails before Docker build or upload', () => {
  const result = bashRun(shellFakes + '\nrelease_stage_needed(){ return 0; }\n' + dockerFunction + '\ndocker_push_plan "PC|client|microi-web|web:{latest},web:{version}" ""\n');
  assert.equal(result.status, 7);
  assert.doesNotMatch(result.stdout, /CALL:docker (?:build|push)/);
});
test('actual website recovery does not prepare, build or republish other products', () => {
  const begin = entrySource.indexOf('# ─── 阶段（条件）: 发布官方网站文档');
  const end = entrySource.indexOf('# ─── 本地产物路径提示', begin);
  const result = bashRun(shellFakes + String.raw`
release_stage_needed(){ case "$1" in docs|docker:registry.cn-beijing.aliyuncs.com/*) return 1;; *) return 0;; esac; }
ensure_docker_running(){ :; }
DOCKER_USERNAME=fixture
DOCKER_PASSWORD=fixture
DOCKER_REGION=hangzhou
START_TIME=1792959990
VERSION=8.7.3
PUBLISH_DOC=true
print_phase(){ :; }
` + entrySource.slice(begin, end));
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /install --frozen-lockfile|docs:build|CALL:docker build |microi-api|microi-web|nuget-push/);
  const pushes = result.stdout.split('\n').filter(line => line.startsWith('CALL:docker push '));
  assert.deepEqual(pushes, ['CALL:docker push registry.cn-hangzhou.aliyuncs.com/microios/microi-doc:latest']);
});
for (const status of [524, 403]) test(`resource recovery reads back once only for ambiguous HTTP ${status}`, t => {
  const {directory} = fixture(t), counter = path.join(directory, 'calls.txt').replaceAll('\\', '/');
  const begin = entrySource.indexOf('publish_resources_with_readback() {');
  const end = entrySource.indexOf('\n# 后端发布产物', begin);
  const result = bashRun([
    'MICROI_RELEASE_SCRATCH=' + JSON.stringify(directory.replaceAll('\\', '/')),
    'counter=' + JSON.stringify(counter),
    'print_warning(){ :; }',
    `run_release_command(){ echo call >> "$counter"; if [ "$(wc -l < "$counter")" -eq 1 ]; then echo 'HTTP ${status}'; return 1; fi; echo recovered; }`,
    entrySource.slice(begin, end),
    'publish_resources_with_readback',
  ].join('\n'));
  assert.equal(result.status, status === 524 ? 0 : 1, result.stderr);
  assert.equal(fs.readFileSync(counter, 'utf8').trim().split('\n').length, status === 524 ? 2 : 1);
});
