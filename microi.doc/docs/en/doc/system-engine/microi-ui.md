# Microi UI

Microi UI (MCI-UI) is the shared frontend UI foundation for Microi Vue 3 websites, responsive sites, mobile H5 apps, and uni-app projects. It provides brand tokens, theme runtime, base components, motion rules, skeleton loading, safe-area handling, and a stable target for AI-generated frontends.

Microi.Client admin pages continue to use Element Plus. Microi UI is mainly for official sites, enterprise websites, product sites, docs sites, mobile malls, membership centers, activity pages, and independent Web apps.

## Why Microi UI

There are already excellent UI libraries such as uni-ui, uView UI, TDesign, FirstUI, Element Plus, Naive UI, and Arco Design Vue. Microi UI exists to solve Microi ecosystem problems:

- Keep Microi brand style consistent across projects.
- Give AI a stable component and token system instead of one-off CSS.
- Share one theme model across Web and mobile.
- Support light/dark mode, black/white/red/orange/yellow/green/cyan/blue/purple palettes, rounded/flat shapes, and reduced motion.
- Allow third-party libraries to be used as low-level capabilities while normalizing the final visual language through `--mci-*` tokens and `mci-*` wrappers.

## Usage

```js
import { createApp } from 'vue';
import MciUI, { initMciDesign } from '@microi/mci-ui/web';
import '@microi/mci-ui/theme';

initMciDesign({
  theme: 'light',
  palette: 'red',
  shape: 'rounded',
  motion: 'full'
});

createApp(App).use(MciUI).mount('#app');
```

## Runtime

```js
import {
  initMciDesign,
  setMciTheme,
  setMciPalette,
  setMciShape,
  setMciMotion,
  toggleMciTheme
} from '@microi/mci-ui/runtime';

setMciPalette('blue');
setMciShape('flat');
toggleMciTheme();
```

## Components

- `MciPage`: safe-area aware page shell with entrance motion.
- `MciNavbar`: mobile navigation shell.
- `MciButton`: brand button with variants, pressed feedback, optional sheen, and shape tokens.
- `MciCard`: surface/card with elevation, hover lift, optional sheen, glass and focus variants.
- `MciSection`: section shell with title, description, eyebrow, and actions.
- `MciCell`: list/settings/menu row for mobile and Web surfaces.
- `MciThemePanel`: ready-to-use theme, palette, shape, and motion switcher.
- `MciTabs`: segmented tabs for categories, filters, and state navigation.
- `MciMetricCard`: metric card for asset, income, dashboard, and campaign pages.
- `MciActionBar`: safe-area aware bottom action bar.
- `MciAvatar`: user/member avatar with fallback initials.
- `MciProductCard`: commerce product card for mall and activity grids.
- `MciSkeleton`: skeleton loading for list, grid, banner, detail, and metric pages.
- `MciDataState`: loading/empty/error state wrapper.
- `MciRichText`: mobile-friendly rich text container.

## AI Rule

When using AI to build Microi frontend projects, require:

```text
Use Microi UI / MCI-UI.
Follow microi.skills/ui-design/SKILL.md and microi.skills/microi-ui/SKILL.md.
Support light/dark, all core palettes, rounded/flat, skeleton loading, safe areas, page entrance motion, and click feedback.
Do not hardcode colors, shadows, gradients, or radius in business pages.
```

When the user does not specify a UI style, Microi AI work should default to Microi UI for mobile apps, PC websites, enterprise sites, product pages, docs pages, malls, member centers, H5, and uni-app projects.
