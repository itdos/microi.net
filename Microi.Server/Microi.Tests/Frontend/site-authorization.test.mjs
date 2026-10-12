import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isIndexablePage, filterSitemapItems } from '../../../microi.doc/docs/.vitepress/config/seo-policy.mjs';
import {
  readAuthorizationRequest, authorizationLoginUrl, validateAuthorizationContext,
  validateAuthorizationRedirect, createAuthorizationClient
} from '../../../microi.doc/docs/.vitepress/theme/utils/site-authorization.js';

const requestId = 'A'.repeat(43);
const context = {
  RequestId: requestId, ClientName: '客户工作台', RedirectUri: 'https://tenant.example.test/api/ExternalLogin/Callback?OsClient=tenant&Provider=Microi',
  Scopes: ['openid', 'profile'], ExpiresAt: '2099-01-01T00:00:00Z',
  CurrentUserId: 'official-user-1', CurrentAccount: 'official-account', CurrentName: '官方用户'
};

test('official authorization handoff accepts only opaque request ids and preserves the login return', () => {
  assert.equal(readAuthorizationRequest('?request=' + requestId), requestId);
  for (const input of ['', '?request=short', '?request=' + encodeURIComponent('A'.repeat(30) + '&redirect=evil')])
    assert.equal(readAuthorizationRequest(input), '');
  const login = new URL(authorizationLoginUrl(requestId), 'https://microi.net');
  assert.equal(login.pathname, '/login.html');
  assert.equal(login.searchParams.get('redirect'), '/microi-authorize.html?request=' + requestId);
  assert.equal(login.searchParams.has('token'), false);
});

test('authorization context requires the same request, a secure exact target and expected scopes', () => {
  assert.equal(validateAuthorizationContext(context, requestId).ClientName, '客户工作台');
  for (const invalid of [
    { ...context, RequestId: 'B'.repeat(43) }, { ...context, RedirectUri: 'javascript:alert(1)' },
    { ...context, RedirectUri: 'https://name:secret@tenant.example.test/callback' },
    { ...context, RedirectUri: 'https://tenant.example.test/callback#fragment' },
    { ...context, Scopes: ['openid', 'roles'] }, { ...context, ExpiresAt: '2000-01-01T00:00:00Z' },
    { ...context, CurrentUserId: '' }
  ]) assert.throws(() => validateAuthorizationContext(invalid, requestId));
});

test('completion redirect keeps the registered callback, query parameters and a fresh code', () => {
  const url = context.RedirectUri + '&code=' + 'C'.repeat(43) + '&state=opaque';
  assert.equal(validateAuthorizationRedirect(url, context.RedirectUri), url);
  for (const invalid of [
    'https://evil.invalid/callback?code=stolen', context.RedirectUri.replace('OsClient=tenant', 'OsClient=another') + '&code=stolen',
    context.RedirectUri + '&code=first&code=second', context.RedirectUri + '&code=stolen#fragment',
    context.RedirectUri + '&state=missing-code'
  ]) assert.throws(() => validateAuthorizationRedirect(invalid, context.RedirectUri));
});

test('official authorization API sends session only in headers, previews without completing, and saves rotation', async () => {
  const calls = [], memory = new Map([['microi_doc_token', 'old-session'], ['microi_doc_did', 'MicroiWeb:device']]);
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const client = createAuthorizationClient({ storage, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { status: 200, headers: { get: name => name === 'authorization' ? 'Bearer rotated-session' : null },
      json: async () => ({ Code: 1, Data: calls.length === 1 ? context : { RedirectUrl: context.RedirectUri + '&code=' + 'C'.repeat(43) } }) };
  }});
  assert.deepEqual(await client.preview(requestId), context);
  await client.complete(requestId, context.RedirectUri, context.CurrentUserId);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.microi.net/apiengine/sso_http_complete_authorization?OsClient=iTdos');
  assert.equal(calls[0].options.headers.authorization, 'Bearer old-session');
  assert.equal(calls[1].options.headers.authorization, 'Bearer rotated-session');
  assert.equal(JSON.parse(calls[0].options.body).Preview, true);
  assert.equal(JSON.parse(calls[1].options.body).Preview, false);
  assert.equal(JSON.parse(calls[1].options.body).ExpectedUserId, context.CurrentUserId);
  assert.equal(calls[0].url.includes('session'), false);
  assert.equal(calls[0].options.body.includes('session'), false);
});

test('official authorization distinguishes expired login and prevents blind completion after an API failure', async () => {
  const storage = { getItem: () => 'existing-session', setItem() {} };
  const client = createAuthorizationClient({ storage, fetchImpl: async () => ({
    status: 401, headers: { get() { return null; } }, json: async () => ({ Code: 1001, Msg: '登录已过期' })
  }) });
  await assert.rejects(client.preview(requestId), error => error.code === 'LOGIN_REQUIRED');
});

test('official website presents consent and reuses existing login/session primitives', () => {
  const source = readFileSync(new URL('../../../microi.doc/docs/.vitepress/theme/components/MicroiAuthorizePage.vue', import.meta.url), 'utf8');
  assert.match(source, /client\.preview/);
  assert.match(source, /client\.complete/);
  assert.match(source, /授权并继续/);
  assert.match(source, /authorizationLoginUrl/);
  assert.match(source, /context\.CurrentAccount/);
  assert.match(source, /context\.value\.CurrentUserId/);
  assert.doesNotMatch(source, /v-html|innerHTML|VITE_MICROI_API_BASE/);
});

test('official authorization is excluded from sitemap and classified as a standalone utility page', () => {
  assert.equal(isIndexablePage('/microi-authorize.html'), false);
  assert.deepEqual(filterSitemapItems([{ url: 'microi-authorize.html' }]), []);
  const readability = readFileSync(new URL('../../../microi.doc/scripts/check-doc-readability.mjs', import.meta.url), 'utf8');
  assert.match(readability, /\['microi-authorize\.md', 'Microi 登录授权页'\]/);
});
