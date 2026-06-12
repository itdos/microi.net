# MCI-UI

MCI-UI is the shared Microi design and component foundation for new Vue 3 frontends:

- Mobile H5 / uni-app apps
- PC official sites, product sites, docs sites, and responsive websites
- Independent Microi frontend projects outside the Element Plus admin system

Microi.Client admin remains Element Plus. MCI-UI provides Microi brand tokens and project-facing components so new products do not directly scatter `uni-ui`, `uView`, `TDesign`, `FirstUI`, or one-off CSS styles across pages.

## Structure

```text
Microi.UI/
  src/theme/       CSS tokens and common styles
  src/web/         Vue 3 web components for PC websites and responsive pages
  src/uniapp/      uni-app Vue 3 components for mobile projects
```

## Design Runtime

MCI-UI supports project-level theme, motion, and shape preferences:

```js
import {
  initMciDesign,
  setMciPalette,
  setMciShape,
  toggleMciTheme
} from '@microi/mci-ui/runtime';

initMciDesign({
  theme: 'light',
  palette: 'red', // black | white | red | orange | yellow | green | cyan | blue | purple
  shape: 'rounded', // rounded | flat
  motion: 'full' // full | reduced
});

setMciPalette('blue');
setMciShape('flat');
toggleMciTheme();
```

- `rounded` is recommended for mobile commerce, membership, consumer apps, and brand pages.
- `flat` is recommended for B-side websites, dashboards, and tool-style pages. Flat mode still keeps borders, shadows, hover lift, and pressed feedback.
- `palette` controls the brand primary color while preserving contrast through `--mci-text-on-primary`.
- Page shells use entrance motion by default. Data pages should pair the page shell with skeleton loading states.

## Web Usage

```js
import { createApp } from 'vue';
import MciUI from '@microi/mci-ui/web';
import '@microi/mci-ui/theme';

const app = createApp(App);
app.use(MciUI);
app.mount('#app');
```

## UniApp Usage

Copy or alias `Microi.UI/src/uniapp` into the project, then install in `src/main.js`:

```js
import MciUI from '@/mci-ui/uniapp/index.js';
import '@/mci-ui/theme/index.css';

export function createApp() {
  const app = createSSRApp(App);
  app.use(MciUI);
  return { app };
}
```

## Component Baseline

- `MciPage`: safe-area aware page shell
- `MciHeroPanel`: branded first-viewport hero/status panel
- `MciBottomNav`: custom icon bottom navigation with active state, badge, and optional raised center action
- `MciNavbar`: mobile navigation shell
- `MciButton`: brand button with variants, pressed feedback, optional sheen, and shape tokens
- `MciCard`: compact surface/card with elevation, hover lift, optional sheen, and glass/focus variants
- `MciCell`: list/settings/menu row for mobile and web surfaces
- `MciSection`: section shell with title, description, eyebrow, and actions
- `MciThemePanel`: ready-to-use theme/palette/shape/motion switcher
- `MciTabs`: segmented navigation for categories, filters, and state tabs
- `MciMetricCard`: asset, income, dashboard, and campaign metric card
- `MciActionBar`: safe-area aware bottom action bar
- `MciAvatar`: member/user avatar with fallback text
- `MciProductCard`: commerce product card for malls and activity grids
- `MciFormField`: labeled form field with help/error states
- `MciFilterBar`: filter/search action bar for list pages
- `MciAssetCard`: balance, points, income, and dashboard asset card
- `MciOrderCard`: order, approval, task, and service record card
- `MciModal`: modal dialog with mask, header, body, and footer slots
- `MciUploader`: upload drop-zone/chooser shell
- `MciTimeline`: timeline for status flow and activity records
- `MciSteps`: process steps for orders, workflows, and onboarding
- `MciSkeleton`: skeleton loading for list, grid, banner, detail, and metric pages
- `MciDataState`: loading/empty/error state wrapper
- `MciRichText`: mobile-friendly rich text container with image/text spacing rules

## Premium Mobile Layer

For mobile H5 and uni-app products, MCI-UI provides an opinionated high-polish composition layer. Use it when building workbenches, member centers, mobile order flows, report pages, staff task apps, customer service apps, and other product-grade mobile experiences.

- `MciPage premium` or `.mci-page--mobile-premium`: safe-area page shell with soft branded background and bottom-nav spacing.
- `.mci-mobile-hero`: large branded first-screen panel for identity, status, and core actions.
- `.mci-mobile-panel`: elevated translucent panel for floating content, grouped actions, forms, and detail blocks.
- `.mci-mobile-bubble-grid` / `.mci-mobile-bubble`: icon shortcut grids.
- `.mci-mobile-stat-grid` / `.mci-mobile-stat`: mobile dashboard metrics.
- `.mci-mobile-titlebar`: section title and action row.
- `.mci-mobile-chip-row` / `.mci-mobile-chip`: colored option tags and compact states.
- `.mci-mobile-bottom-nav`: custom bottom navigation when native tabBar is too limited or unstable.
- `.mci-mobile-rich-card`: rich business list card with title, status, meta, media, and actions.
- `.mci-mobile-meta-grid`: detail fields and key-value facts.
- `.mci-mobile-option-grid`: card/chip-style form choices.
- `.mci-mobile-photo-grid`: photo upload/display grid.
- `.mci-mobile-sheet`: polished bottom sheet container.
- `.mci-mobile-chart-card` / `.mci-mobile-kpi-strip`: chart and dashboard surfaces.
- `.mci-mobile-empty-result`: empty state with icon, title, description, and action.
- `.mci-mobile-form-section`: long-form section rhythm with icon marks.

The premium layer is intentionally brand-neutral. Project palettes, logo colors, and `--mci-color-primary` drive the final visual identity.

## Scene Rules

- Login pages use an atmosphere area plus floating form panel. Primary login and phone-login buttons must be icon + text.
- Home/workbench pages expose the next action in the first viewport.
- Profile pages use identity headers, shortcut cards, grouped grids, and settings panels.
- Mobile lists use rich business cards, not table-like rows.
- Detail/report pages start with a status overview, then facts, timeline, media, rich text, and safe-area actions.
- Long forms use section headers, option cards, upload grids, and fixed bottom submit bars.
- Bottom navigation must include icons and active states. Text-only navigation is not acceptable.
- Charts put KPI numbers before graphics and keep palettes controlled.

## Quality Checks

```bash
npm run check
npm run pack:check
```

## Design Rule

Business pages should import MCI-UI components or project-level wrappers based on MCI-UI. Third-party UI libraries may be used under the hood, but their visual language should be normalized through `--mci-*` tokens and `mci-*` components.

Wrap pages or embedded UI areas with `.mci-page` or `data-mci-ui-root`. Microi.UI keeps its reset, typography, media, and token defaults scoped under these roots where possible, which reduces accidental overrides from host projects, Markdown renderers, and third-party component libraries.

Shared classes must keep the `mci-` prefix. Avoid generic global selectors such as `button`, `.card`, `.list`, or `img` in business projects; customize with component props, `--mci-*` variables, or project-level wrappers.
