import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePortalSource, validatePortalBundle, assertSourceUnchanged } from '../scripts/check-account-portal.mjs';

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
