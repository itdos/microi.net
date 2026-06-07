---
name: microi-ui
description: Use when building or documenting Microi.UI / MCI-UI for Vue 3 PC websites, responsive sites, uni-app mobile projects, theme palettes, shape modes, skeleton loading, safe areas, motion, and Microi brand frontend components.
---

# Microi.UI / MCI-UI

Microi.UI is the shared Microi frontend UI foundation for Vue 3 PC websites, responsive websites, and uni-app mobile projects. Use it for new Microi-facing products except `Microi.Client` admin pages, which continue to use Element Plus plus Microi theme tokens.

## When To Use

- New mobile H5 / uni-app apps, malls, member centers, asset pages, order flows, and activity pages.
- PC official sites, enterprise websites, product sites, docs sites, and responsive marketing/product pages.
- Project work involving Microi brand theme, palette switching, rounded/flat style switching, safe areas, skeleton loading, rich text display, and page motion.
- AI-generated frontends that should feel consistent across projects instead of scattering one-off CSS or third-party UI visual styles.

## Source Layout

- `Microi.UI/src/theme/tokens.css`: design tokens, palettes, shape modes, shadows, gradients, safe-area variables, skeleton colors.
- `Microi.UI/src/theme/index.css`: base classes such as `mci-page`, `mci-card`, `mci-skeleton`, page enter motion, hover lift, press feedback, sheen, focus ring, reduced-motion fallback.
- `Microi.UI/src/theme/runtime.js`: `initMciDesign`, `setMciTheme`, `setMciPalette`, `setMciShape`, `setMciMotion`.
- `Microi.UI/src/web`: Vue 3 web components.
- `Microi.UI/src/uniapp`: uni-app Vue 3 components.

## Required Defaults

- Call `initMciDesign()` at app startup or provide an equivalent project-level theme service.
- Support `theme: light | dark`, `palette: black | white | red | orange | yellow | green | cyan | blue | purple`, `shape: rounded | flat`, and `motion: full | reduced`.
- Use `MciPage` as the page shell when possible. Pages should have entrance motion by default and respect top/bottom safe areas on mobile.
- Dynamic data pages must show skeleton screens while first data is loading, not spinner-only or premature empty states.
- Rich text content must give text breathing room while allowing images to be `width:100%`.
- Do not hardcode colors, radius, shadows, or gradients in business pages; use `--mci-*` variables or project wrappers based on them.
- Buttons/cards/clickable cells must preserve hover/focus/pressed feedback. White and yellow palettes must use `--mci-text-on-primary` instead of fixed white text.

## Vue 3 Web Usage

```js
import { createApp } from 'vue';
import MciUI, { initMciDesign } from '@microi/mci-ui/web';
import '@microi/mci-ui/theme';

initMciDesign({ theme: 'light', palette: 'red', shape: 'rounded', motion: 'full' });

createApp(App).use(MciUI).mount('#app');
```

## UniApp Usage

```js
import MciUI, { initMciDesign } from '@/mci-ui/uniapp/index.js';
import '@/mci-ui/theme/index.css';

initMciDesign({ theme: 'light', palette: 'red', shape: 'rounded', motion: 'full' });
app.use(MciUI);
```

For non-H5 uni-app targets, DOM attributes may not exist. Store the preference through `initMciDesign()` and pass `shape`, `safeTop`, `safeBottom`, or project theme classes into page shells/components where needed.

## AI Implementation Checklist

- Start from `microi.skills/ui-design/SKILL.md` and this skill before designing the UI.
- Prefer `Microi.UI` components or project-level `mci-*` wrappers over direct `uni-ui/uView/TDesign/FirstUI` visual styling.
- If a third-party UI library is needed, normalize it through `--mci-*` tokens and wrappers.
- Add any new reusable component to `Microi.UI/src/web` and/or `Microi.UI/src/uniapp`, then export it from the matching `index.js`.
- Update `microi.doc/docs/doc/system-engine/microi-ui.md` when changing public usage, philosophy, runtime API, component list, or project rules.
- Validate with `node --check` for JS entry/runtime files and `npm pack --dry-run` in `Microi.UI`.
