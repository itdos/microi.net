import test from 'node:test';
import assert from 'node:assert/strict';
import { siteLoginRedirect } from '../docs/.vitepress/theme/utils/site-login.js';
test('login redirect preserves personal center routes and rejects loops and external authorities',()=>{
 const origin='https://microi.net';
 assert.equal(siteLoginRedirect('?redirect=%2Fprofile.html%23%2Foverview',origin),'/profile.html#/overview');
 for(const value of ['//evil.invalid','/\\evil.invalid','/login.html','/login','/login.html?redirect=again','\n//evil.invalid'])
  assert.equal(siteLoginRedirect('?redirect='+encodeURIComponent(value),origin),'/profile.html#/overview');
 assert.equal(siteLoginRedirect('?redirect=%2Fprofile.html%23%2Fbilling',origin),'/profile.html#/billing');
});
