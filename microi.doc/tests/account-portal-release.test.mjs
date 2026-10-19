import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePortalSource, validatePortalBundle, assertSourceUnchanged, assertCandidatePublished, releaseSourceProvenance } from '../scripts/check-account-portal.mjs';

const read = name => fs.readFileSync(new URL(`../docs/.vitepress/theme/${name}`, import.meta.url), 'utf8');
const profile = read('components/ProfilePage.vue');
const invitation = read('components/InvitationTree.vue');
const login = read('components/LoginPage.vue');
test('个人中心正式源码必须包含七页与邀请注册', () => validatePortalSource(profile, invitation, login));
test('旧版四页源码即使构建成功也拒绝发布', () => {
  const old = profile.replace(/const menuKeys\s*=\s*\[[^\]]+\]/, "const menuKeys = ['overview', 'create', 'ai', 'account']");
  assert.throws(() => validatePortalSource(old, invitation, login), /缺少路由/);
});
test('HTML 引用的旧主题包不能被 dist 中其它新文件掩盖', () => {
  assert.throws(() => validatePortalBundle('official_tenant_center overview create ai account'), /缺少/);
});
test('构建期间共享源码漂移必须重建', () => {
  const name = 'docs/.vitepress/theme/components/ProfilePage.vue';
  assert.throws(() => assertSourceUnchanged({ [name]: 'candidate' }, { [name]: 'changed' }), /构建期间源码变化/);
});

const candidateHash = 'a'.repeat(40);
function publicationFixture({ refs = 'refs/remotes/github-microi.net/codex/candidate', remoteHash = candidateHash, unavailable = false } = {}) {
  return args => {
    if (args[0] === 'for-each-ref') return refs;
    if (args[0] === 'rev-parse') return candidateHash;
    if (args[0] === 'ls-remote') {
      if (unavailable) throw new Error('remote unavailable');
      return `${remoteHash}\t${args[3]}`;
    }
    throw new Error('unexpected git command');
  };
}

test('GitHub 官方远端真实分支回读可证明候选源码已交付', () => {
  assert.equal(assertCandidatePublished(publicationFixture()), 'refs/remotes/github-microi.net/codex/candidate');
});

test('Gitee 官方远端继续支持原有交付', () => {
  assert.equal(assertCandidatePublished(publicationFixture({ refs: 'refs/remotes/origin/master' })), 'refs/remotes/origin/master');
});

test('本地 tracking ref 与实际远端不一致时不得声称源码已交付', () => {
  assert.throws(() => assertCandidatePublished(publicationFixture({ remoteHash: 'b'.repeat(40) })), /实际远端分支/);
});

test('没有发布分支或远端不可核验时不得声称源码已交付', () => {
  for (const fixture of [{ refs: '' }, { unavailable: true }, { refs: 'refs/remotes/unverified/master' }, { refs: 'refs/remotes/origin/HEAD' }]) {
    assert.throws(() => assertCandidatePublished(publicationFixture(fixture)), /实际远端分支/);
  }
});

test('一个官方远端不可达时必须独立回读另一个远端', () => {
  const fallback = publicationFixture();
  const git = args => {
    if (args[0] === 'for-each-ref') return 'refs/remotes/origin/codex/candidate\nrefs/remotes/github-microi.net/codex/candidate';
    if (args[0] === 'ls-remote' && args[2] === 'origin') throw new Error('Gitee unavailable');
    return fallback(args);
  };
  assert.equal(assertCandidatePublished(git), 'refs/remotes/github-microi.net/codex/candidate');
});

test('远端离线、认证失败或超额不能阻塞本地已提交的制品候选', () => {
  const calls = [];
  const git = args => {
    calls.push(args);
    if (args[0] === 'rev-parse' || args[0] === 'hash-object') return candidateHash;
    throw new Error('remote quota exceeded or authentication unavailable');
  };
  const result = releaseSourceProvenance({ 'docs/example.md': Buffer.from('committed') }, git);
  assert.equal(result.SourceCommit, candidateHash);
  assert.equal(result.SourceDelivery.Status, 'not-verified');
  assert.equal(calls.some(args => ['ls-remote', 'fetch', 'push', 'for-each-ref'].includes(args[0])), false);
});

test('解除远端依赖后仍拒绝未提交源码，不允许把不明候选发布出去', () => {
  const git = args => args[0] === 'hash-object' ? 'b'.repeat(40) : candidateHash;
  assert.throws(() => releaseSourceProvenance({ 'docs/example.md': Buffer.from('dirty') }, git), /发布源码尚未提交/);
});
