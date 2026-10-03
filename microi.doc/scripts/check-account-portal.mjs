import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
export const portalRoutes = ['overview', 'systems', 'create', 'licenses', 'invitations', 'ai', 'account'];
const sourceFiles = [
  'docs/.vitepress/theme/components/ProfilePage.vue',
  'docs/.vitepress/theme/components/InvitationTree.vue',
  'docs/.vitepress/theme/components/LoginPage.vue',
  'docs/.vitepress/theme/profile-i18n.ts',
  'docs/.vitepress/theme/styles/mainstream.scss'
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

function main() {
  const source = Object.fromEntries(sourceFiles.map(name => [name, fs.readFileSync(path.join(project, name))]));
  validatePortalSource(source[sourceFiles[0]].toString(), source[sourceFiles[1]].toString(), source[sourceFiles[2]].toString());
  const hashes = Object.fromEntries(Object.entries(source).map(([name, value]) => [name, sha(value)]));
  const git = args => execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
  const commit = git(['rev-parse', 'HEAD']);
  if (process.argv.includes('--require-committed')) {
    // 全站发布会覆盖其它页面，个人中心不能只存在于共享工作区的未提交差异中。
    for (const name of sourceFiles) {
      const committed = execFileSync('git', ['show', `HEAD:microi.doc/${name}`], { cwd: project });
      if (sha(committed) !== hashes[name]) throw new Error(`发布源码尚未提交：${name}`);
    }
    git(['merge-base', '--is-ancestor', 'HEAD', '@{upstream}']);
  }
  const snapshot = path.resolve(project, '../.tmp/microi-doc-build/account-portal-source.json');
  if (!process.argv.includes('--dist')) {
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    fs.writeFileSync(snapshot, JSON.stringify(hashes, null, 2));
    console.log('个人中心源码检查通过：7 个页面、邀请注册、邀请树、系统授权。');
    return;
  }
  assertSourceUnchanged(JSON.parse(fs.readFileSync(snapshot, 'utf8')), hashes);
  const dist = path.join(project, 'docs/.vitepress/dist');
  const html = fs.readFileSync(path.join(dist, 'profile.html'), 'utf8');
  const themeRef = html.match(/(?:src|href)="(\/assets\/chunks\/theme\.[A-Za-z0-9_-]+\.js)"/)?.[1];
  if (!themeRef) throw new Error('profile.html 没有引用可验证的主题包。');
  const theme = fs.readFileSync(path.join(dist, themeRef.slice(1)));
  validatePortalBundle(theme.toString());
  const manifest = { SchemaVersion: 1, SourceCommit: commit, Routes: portalRoutes, SourceSha256: hashes, Files: { '/profile.html': sha(html), [themeRef]: sha(theme), '/login.html': sha(fs.readFileSync(path.join(dist, 'login.html'))) } };
  fs.writeFileSync(path.join(dist, 'account-portal-release.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('个人中心产物检查通过；已生成公开哈希回读清单 account-portal-release.json。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
