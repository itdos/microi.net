---
name: microi-ui
description: Use when building or documenting Microi.UI / MCI-UI for Vue 3 PC websites, responsive sites, uni-app mobile projects, theme palettes, shape modes, skeleton loading, safe areas, motion, and Microi brand frontend components.
---

# 吾码UI（Microi.UI / MCI-UI）

吾码UI（Microi.UI / MCI-UI）is the shared Microi frontend UI foundation for Vue 3 PC websites, responsive websites, and uni-app mobile projects. Use it for new Microi-facing products except `Microi.Client` admin pages, which continue to use Element Plus plus Microi theme tokens.

When the user does not name a UI style or UI library, default to Microi.UI for Microi mobile apps, PC websites, enterprise sites, product pages, docs pages, malls, member centers, and H5/uni-app work.

## When To Use

- New mobile H5 / uni-app apps, malls, member centers, asset pages, order flows, and activity pages.
- PC official sites, enterprise websites, product sites, docs sites, and responsive marketing/product pages.
- Project work involving Microi brand theme, palette switching, rounded/flat style switching, safe areas, skeleton loading, rich text display, and page motion.
- AI-generated frontends that should feel consistent across projects instead of scattering one-off CSS or third-party UI visual styles.

## Source Layout

- `Microi.UI/src/theme/tokens.css`: design tokens, palettes, shape modes, shadows, gradients, safe-area variables, skeleton colors.
- `Microi.UI/src/theme/index.css`: base classes such as `mci-page`, `mci-card`, `mci-skeleton`, page enter motion, hover lift, press feedback, sheen, focus ring, reduced-motion fallback.
- `Microi.UI/src/theme/runtime.js`: `initMciDesign`, `applyMciDesign`, `getMciDesign`, `toggleMciTheme`, `setMciTheme`, `setMciPalette`, `setMciShape`, `setMciMotion`.
- `Microi.UI/src/web`: Vue 3 web components.
- `Microi.UI/src/uniapp`: uni-app Vue 3 components.

## Required Defaults

- Call `initMciDesign()` at app startup or provide an equivalent project-level theme service.
- Support `theme: light | dark`, `palette: black | white | red | orange | yellow | green | cyan | blue | purple`, `shape: rounded | flat`, and `motion: full | reduced`.
- Wrap Microi.UI pages or embedded UI areas with `.mci-page` or `data-mci-ui-root` so resets, typography, tokens, and component styles are scoped and less likely to be overwritten by host projects or third-party CSS.
- Use `MciPage` as the page shell when possible. Pages should have entrance motion by default and respect top/bottom safe areas on mobile.
- For every UniApp/H5/mobile project, also apply `microi.skills/microi-mobile-app-quality/SKILL.md` as a mandatory quality gate.
- Use `MciSection` for major content sections, `MciCell` for settings/menu/list rows, `MciTabs` for segmented navigation, `MciMetricCard`/`MciAssetCard` for asset/summary numbers, `MciActionBar` for safe-area bottom actions, `MciAvatar` for member identity, `MciProductCard` for commerce/content grids, `MciFormField` for forms, `MciFilterBar` for list filters, `MciOrderCard` for orders/tasks, `MciModal` for dialogs, `MciUploader` for upload surfaces, `MciTimeline` for status records, `MciSteps` for workflows, and `MciThemePanel` for theme/palette/shape/motion configuration screens.
- When the same UI pattern appears in two or more places, extract a Microi.UI component or a project-level `mci-*` wrapper with props/slots for text, icons, actions, states, and small variants. Do not copy/paste cards, auth prompts, empty states, data states, action bars, filter bars, or button groups into separate pages.
- Dynamic data pages must show skeleton screens while first data is loading, not spinner-only or premature empty states.
- Rich text content must give text breathing room while allowing images to be `width:100%`.
- `MciUploader` and project upload wrappers must support re-select/replacement after a file is chosen, tap-to-fullscreen preview, close preview, upload progress, retry, and failure toast. Upload components must update only the bound file field, not reset the whole form.
- Do not hardcode colors, radius, shadows, or gradients in business pages; use `--mci-*` variables or project wrappers based on them.
- Buttons/cards/clickable cells must preserve hover/focus/pressed feedback. White and yellow palettes must use `--mci-text-on-primary` instead of fixed white text.
- Primary buttons, pill buttons, and action chips must use flex/inline-flex centering, explicit `align-items:center`, `justify-content:center`, stable height/min-height, and `line-height:1` on the text node. Text that should be centered must be visually centered on both axes, not merely padded until it looks close.

## Premium Mobile Visual Standard

Microi mobile apps must feel like polished mobile products, not admin forms squeezed into a phone viewport. For uni-app/H5 projects, use the Microi mobile premium layer before writing page-local CSS:

- Use `MciPage premium` or `.mci-page--mobile-premium` as the page shell for customer-facing, staff-facing, member-center, workbench, order, report, and form pages.
- First screens should have a strong visual anchor: a branded hero panel, identity banner, search/action capsule, or large status card. Do not start important mobile pages with a plain title and a flat list.
- Hero headlines must fit the real copy on common phone widths. For Chinese business titles, reduce display size before accepting ugly wrapping; primary buttons under the hero must never be covered by floating quick-action panels.
- Build mobile pages from layered blocks: hero/banner, floating quick-action panel, metric cards, section titlebars, content cards, bottom action/navigation. Avoid a monotonous vertical stack of identical white cards.
- Use soft radial page backgrounds, translucent glass panels, colored icon bubbles, pill tags, and elevated bottom bars through `--mci-*` tokens and `.mci-mobile-*` classes. Do not hardcode an unrelated third-party style name or library identity into Microi files.
- Use `.mci-mobile-hero`, `.mci-mobile-panel`, `.mci-mobile-bubble-grid`, `.mci-mobile-stat-grid`, `.mci-mobile-titlebar`, `.mci-mobile-chip-row`, `.mci-mobile-bottom-nav`, and `.mci-mobile-form-section` where the pattern fits.
- Login pages should use a top atmosphere area plus a floating form panel. The form panel needs clear mode switching, thick rounded inputs, high-contrast primary action, and enough empty space below.
- “My/Profile” pages should use an identity header, two or more highlighted shortcut cards, grouped function grids, and settings/info panels. Do not render profile pages as a plain list unless the product is intentionally utilitarian.
- Workbench/home pages should expose the next action within the first viewport: pending tasks, due plans, reports, repair entry, or quick actions. Metric cards should be scan-friendly and visually differentiated.
- List pages should use rich business cards with title, status pill, metadata, time, and primary action. Avoid table-like rows on mobile.
- Detail pages should use an overview hero/status block, sectioned facts, timeline/steps, media/report content, and a safe-area bottom action when an action is expected.
- Form pages should use section headers with small icon marks, large clean input areas, upload grids, colored option chips, and a fixed safe-area submit bar for long forms.
- Native `uni-app` tabBar may be used only when it is visually and technically stable. If H5/runtime validation shows tabBar slot/runtime errors or insufficient visual control, use a custom Microi bottom navigation component styled like `.mci-mobile-bottom-nav`.
- All high-polish choices must remain brand-aware: derive hero gradients, icon bubble colors, and button shadows from the project logo or configured `--mci-color-primary` / accent tokens.

### Mobile Icon, Button, And Motion Gate

- Bottom navigation, homepage quick actions, member-center shortcuts, grid actions, and floating actions must use recognizable icons. Single Chinese characters such as `首` / `单` / `报` / `我` are text placeholders, not icons.
- Prominent actions such as login, go-login, submit, confirm, repair, accept-order, upload-photo, and generate-report must be icon + text buttons with loading and pressed states.
- Native mini-program buttons such as `open-type="getPhoneNumber"` must be styled to match Microi primary buttons and must remove default button borders.
- Mobile pages must include restrained motion: hero/panel/card entrance, tap feedback, and skeleton shimmer or pulse. Motion must not cause layout shift, text clipping, or operational distraction.
- Visual acceptance must inspect bottom navigation, homepage shortcuts, profile shortcuts, login, empty-state action buttons, and fixed bottom submit buttons.
- Visual acceptance must also inspect the first viewport at 375px and 430px widths. Check hero title wrapping, hero action visibility, floating panel overlap, and the first content panel spacing.

## Style Isolation Rules

- Use only `mci-` prefixed public classes for shared styles. Do not ship generic global selectors such as `button {}`, `.card {}`, `.list {}`, or `img {}`.
- Put component-local details in Vue scoped styles or component root classes. Global token/reset rules must be limited to `.mci-page` or `[data-mci-ui-root]`.
- When adapting uni-ui, uView, TDesign, FirstUI, Element Plus, or VitePress Markdown content, wrap the third-party output and map its visible colors/radius/shadows to `--mci-*` variables instead of modifying library internals directly.
- For docs/official-site work, prefer a single VitePress theme layer that styles `VPDoc`, `VPHome`, tables, code blocks, sidebars, and feature cards consistently. Avoid per-document one-off CSS unless the page is a special showcase.

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
- If the user simply asks for a mobile app, website, enterprise site, mall, member center, asset page, or H5/uni-app page in a Microi workspace, treat Microi.UI as the default choice without waiting for explicit style instructions.
- If a third-party UI library is needed, normalize it through `--mci-*` tokens and wrappers.
- Add any new reusable component to `Microi.UI/src/web` and/or `Microi.UI/src/uniapp`, then export it from the matching `index.js`.
- Before adding page-local markup/styles, scan sibling pages and existing components for the same pattern. If two pages need the same structure with only copy, icon, route, or state differences, build one reusable component and pass those differences through props/slots/events.
- Update `microi.doc/docs/doc/system-engine/microi-ui.md` and, when the English homepage/sidebar links to it, `microi.doc/docs/en/doc/system-engine/microi-ui.md`.
- Validate with `npm run check`, `npm run pack:check`, and the relevant `microi.doc` build when docs changed.
- When the user asks for "automated tests", "fully automated testing", "全自动化测试", or equivalent after UI/frontend changes, include screenshot-based visual verification in the test chain whenever a browser/H5/devtools target is available. Builds and static checks alone are not enough.
- For official sites, docs sites, product pages, enterprise sites, and Microi mobile/H5 pages, take screenshots of the nav/header, hero/actions, auth/empty/data states, representative cards, and bottom bars. Verify nav/background contrast, button text vertical and horizontal centering, card background harmony, safe areas, and no text clipping before considering the UI done.
- When styling host frameworks such as VitePress, avoid broad overrides that accidentally turn a dark landing page into a light-header/light-card hybrid. Scope home-page and document-page styles separately.
