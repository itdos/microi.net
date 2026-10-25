import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
export const portalRoutes = ['overview', 'systems', 'create', 'licenses', 'invitations', 'star-gift-registration', 'ai', 'account'];
const sourceFiles = [
  'docs/.vitepress/theme/components/ProfilePage.vue',
  'docs/.vitepress/theme/components/InvitationTree.vue',
  'docs/.vitepress/theme/components/LoginPage.vue',
  'docs/.vitepress/theme/profile-i18n.ts',
  'docs/.vitepress/theme/styles/mainstream.scss',
  'docs/.vitepress/theme/components/ProfileStarGiftRecords.vue',
  'server/api-engines/official-star-gift-records.js'
];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`${label}缺少 ${marker}，禁止把旧版个人中心发布到整个官网。`);
}

export function validatePortalSource(profile, invitation, login) {
  const keys = profile.match(/const menuKeys\s*=\s*\[([^\]]+)\]/)?.[1] || '';
  for (const route of portalRoutes) {
    if (!new RegExp(`['"]${route}['"]`).test(keys)) throw new Error(`个人中心缺少路由 ${route}`);
  }
  for (const key of ['official_account_invitations', 'official_account_licenses', 'portal-overview']) requireText(profile, key, '个人中心源码');
  for (const field of ['Avatar', 'Account', 'Name', 'CreateTime', 'LastWebsiteLoginTime']) requireText(invitation, `node.${field}`, '邀请树源码');
  requireText(login, 'InviteCode: inviteCode.value', '邀请注册源码');
}

export function validatePortalBundle(theme) {
  // 检查 HTML 实际引用的主题包，不能用 dist 中未被引用的新文件证明旧入口已经更新。
  for (const marker of ['official_account_invitations', 'official_account_licenses', 'portal-overview', 'LastWebsiteLoginTime', 'InviteCode']) requireText(theme, marker, '个人中心构建产物');
  for (const route of portalRoutes) if (!new RegExp(`['"]${route}['"]`).test(theme)) throw new Error(`个人中心构建产物缺少路由 ${route}`);
}

export function assertSourceUnchanged(expected, actual) {
  for (const name of sourceFiles) if (expected[name] !== actual[name]) throw new Error(`个人中心构建期间源码变化：${name}；请重建后发布。`);
}

export function assertCommittedSource(source, git) {
  for (const [name, bytes] of Object.entries(source)) {
    // Compare Git's committed representation, including the configured clean
    // filters. A legitimate CRLF checkout must not fail this text-source gate.
    // Raw source/build hashes remain unchanged and still detect byte drift.
    const committed = git(['rev-parse', `HEAD:microi.doc/${name}`]);
    const candidate = git(['hash-object', `--path=${name}`, '--stdin'], bytes);
    if (candidate !== committed) throw new Error(`发布源码尚未提交：${name}`);
  }
}

export function assertCandidatePublished(git) {
  // 两个既有官方远端均可交付源码；必须向实际服务器回读分支，不能仅凭本地 tracking ref 放行。
  const refs = git(['for-each-ref', '--format=%(refname)', '--contains', 'HEAD', 'refs/remotes/origin/', 'refs/remotes/github-microi.net/']).split('\n').filter(Boolean);
  for (const ref of refs) {
    const match = /^refs\/remotes\/(origin|github-microi\.net)\/(.+)$/.exec(ref);
    if (!match || match[2] === 'HEAD') continue;
    try {
      const expected = git(['rev-parse', ref]);
      const remoteRef = `refs/heads/${match[2]}`;
      const advertised = git(['ls-remote', '--exit-code', match[1], remoteRef]).split(/\r?\n/).some(line => {
        const [hash, name] = line.trim().split(/\s+/);
        return /^[a-f0-9]{40}$/.test(hash) && hash === expected && name === remoteRef;
      });
      if (advertised) return ref;
    } catch { /* 单个官方远端不可达时，继续独立核验另一个官方远端。 */ }
  }
  throw new Error('候选提交尚未在 origin 或 github-microi.net 的实际远端分支核验发布。');
}

export function releaseSourceProvenance(source, git) {
  assertCommittedSource(source, git);
  // 不将网络、认证、配额错误转换成制品发布失败；也不把本地 tracking ref 当作交付回执。
  return { SourceCommit: git(['rev-parse', 'HEAD']), SourceDelivery: { Status: 'not-verified' } };
}

function main() {
  const source = Object.fromEntries(sourceFiles.map(name => [name, fs.readFileSync(path.join(project, name))]));
  validatePortalSource(source[sourceFiles[0]].toString(), source[sourceFiles[1]].toString(), source[sourceFiles[2]].toString());
  const hashes = Object.fromEntries(Object.entries(source).map(([name, value]) => [name, sha(value)]));
  const git = (args, input) => execFileSync('git', args, { cwd: project, encoding: 'utf8', timeout: 30000, ...(input === undefined ? {} : { input }) }).trim();
  const commit = git(['rev-parse', 'HEAD']);
  const provenance = process.argv.includes('--require-committed')
    ? releaseSourceProvenance(source, git)
    : { SourceCommit: commit, SourceDelivery: { Status: 'not-verified' } };
  if (process.argv.includes('--require-committed')) {
    // 源码必须在本地候选中完整提交；远端交付单独记录，不阻塞合格制品。
    try { git(['diff', '--quiet', 'HEAD', '--', ':(top)microi.doc']); }
    catch { throw new Error('官网构建输入存在未提交改动，请先冻结本地候选。'); }
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ':(top)microi.doc']);
    if (untracked) throw new Error('官网构建输入包含未提交的新文件，请先核对归属并提交。');
    console.log('官网本地候选提交检查通过；Git 远端交付由独立回执记录。');
  }
  if (process.argv.includes('--verify-source-delivery')) {
    try { provenance.SourceDelivery = { Status: 'verified', Ref: assertCandidatePublished(git) }; }
    catch { provenance.SourceDelivery = { Status: 'pending' }; }
    console.log(`源码远端交付状态：${provenance.SourceDelivery.Status}（不影响制品门禁）。`);
  }
  const snapshot = path.resolve(project, '../.tmp/microi-doc-build/account-portal-source.json');
  if (!process.argv.includes('--dist')) {
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    fs.writeFileSync(snapshot, JSON.stringify(hashes, null, 2));
    console.log('个人中心源码检查通过：8 个页面、邀请注册、邀请树、系统授权与角色限定活动登记。');
    return;
  }
  assertSourceUnchanged(JSON.parse(fs.readFileSync(snapshot, 'utf8')), hashes);
  const dist = path.join(project, 'docs/.vitepress/dist');
  const html = fs.readFileSync(path.join(dist, 'profile.html'), 'utf8');
  const themeRef = html.match(/(?:src|href)="(\/assets\/chunks\/theme\.[A-Za-z0-9_-]+\.js)"/)?.[1];
  if (!themeRef) throw new Error('profile.html 没有引用可验证的主题包。');
  const theme = fs.readFileSync(path.join(dist, themeRef.slice(1)));
  validatePortalBundle(theme.toString());
  const manifest = { SchemaVersion: 2, ...provenance, Routes: portalRoutes, SourceSha256: hashes, Files: { '/profile.html': sha(html), [themeRef]: sha(theme), '/login.html': sha(fs.readFileSync(path.join(dist, 'login.html'))) } };
  fs.writeFileSync(path.join(dist, 'account-portal-release.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('个人中心产物检查通过；已生成公开哈希回读清单 account-portal-release.json。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
