---
name: microi-frontend-sdk
description: Microi frontend SDK usage rules for Vue 3, uni-app, H5, PC websites, and Microi.Client extensions. Use when creating or modifying frontend request, token, upload, file URL, ApiEngine, FormEngine, or app bootstrap code.
---

# Microi Frontend SDK

All Vue 3 frontend projects should use `microi.skills/microi.v8.js` as the shared Microi frontend SDK. Do not start a new project by copying old Vue2/Vuex request wrappers or by hand-writing another token, upload, file URL, ApiEngine, or FormEngine layer.

## Required Pattern

Copy the SDK into the project source tree, usually:

- uni-app: `src/utils/microi.v8.js`
- PC Vue 3 website: `src/utils/microi.v8.js`
- Microi.Client extension page: reuse the existing platform request layer when present, otherwise import the SDK from a local utility module.

Create exactly one configured instance in the project request module:

```js
import { createMicroiV8 } from './microi.v8.js';

export const V8 = createMicroiV8({
  apiBase: config.apiBase,
  fileServer: config.fileServer,
  webBase: config.webBase,
  osClient: config.osClient,
  tokenKey: 'microi_token',
  userKey: 'microi_user',
  formQueryEngineKey: 'mall_form_query',
  maxConcurrent: 8,
  appendOsClientQuery: true,
  onAuthExpired: () => {
    V8.clearToken();
    uni.reLaunch({ url: '/pages/login/login' });
  }
});
```

Mount it in Vue 3 bootstrap:

```js
import { V8 } from './utils/request.js';

export function createApp() {
  const app = createSSRApp(App);
  V8.install(app);
  return { app };
}
```

Pages and business API modules should import the configured instance or wrapper functions from the project request module, not from the canonical skill file directly.

## What Must Use The SDK

- `ApiEngine.Run`: direct `/apiengine/{key}` calls should use `V8.ApiEngine.Run(key, data)`.
- Legacy `/api/ApiEngine/Run` calls should use `V8.ApiEngine.RunLegacy(key, data)` only for old systems that still require it.
- FormEngine CRUD should use `V8.FormEngine.*` or thin project wrappers such as `formEngineGet`.
- Upload should use `V8.uploadFile`.
- Images, avatars, rich text images, QR codes, payment proofs, certificates, and private files should use `V8.assetUrl`, `V8.resolveFileUrl`, or `V8.resolveAvatarUrl`.
- Token and user storage should use `V8.getToken`, `V8.setToken`, `V8.clearToken`, `V8.getUser`, and `V8.setUser`.
- Safe area data should use `V8.getSafeArea` when JavaScript needs platform values; CSS should still use `env(safe-area-inset-*)`.

## Project Wrapper Rule

Keep business-facing function names stable. If an existing project exports `callEngine`, `formEngineGet`, `getImageUrl`, `parseImages`, or `uploadFile`, keep those exports and delegate internally to `V8`. This avoids broad page churn while still enforcing one SDK.

Correct:

```js
export function callEngine(key, params = {}, options = {}) {
  return V8.ApiEngine.Run(key, params, { checkCode: true, ...options });
}

export function getImageUrl(value) {
  return V8.assetUrl(value);
}
```

Avoid:

```js
uni.request({ url: apiBase + '/apiengine/' + key, header: { Token: token } });
```

## Vue 3 Only

New Microi frontend work is Vue 3 only. Do not add Vue2, Vuex, `Vue.prototype`, or conditional Vue2/uni-app compilation into `microi.v8.js`. State management belongs to the project, usually Pinia or local composables; the SDK owns only platform access, request, auth, upload, asset URLs, and small utilities.

## UI Independence

The SDK must not import Element Plus, uni-ui, uView, TDesign, FirstUI, Pinia, Vue Router, or axios. UI feedback is provided through configurable adapters:

- `toast(message)`
- `confirm(message)`
- `onAuthExpired(body, V8)`
- optional `requestAdapter(options)`

This keeps the same SDK usable in uni-app, PC websites, admin extensions, and docs demos.

## Verification

After changing a project to use the SDK:

- Run the relevant build or type check.
- Test at least one authenticated ApiEngine call and one anonymous call.
- Test one image or upload JSON field through `assetUrl`.
- Test token expiry behavior if the task touched auth.
- For uni-app H5, verify the SDK works in both mobile viewport and PC browser mobile shell.

## Pair With MCI-UI

The SDK handles platform capability; MCI-UI handles product interface. New Microi Vue3 projects should combine both:

- `microi.skills/microi.v8.js` for request, token, upload, file URL, ApiEngine/FormEngine.
- `Microi.UI/src/theme` for `--mci-*` design tokens.
- `Microi.UI/src/uniapp` for mobile/UniApp components.
- `Microi.UI/src/web` for PC official sites and responsive websites.

Do not solve UI state, skeleton loading, rich text spacing, or safe-area layout inside the SDK. Use MCI-UI components for that layer.
