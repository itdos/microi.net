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
import { initMciDesign, setMciPalette, setMciShape } from '@microi/mci-ui/runtime';

initMciDesign({
  theme: 'light',
  palette: 'red', // black | white | red | orange | yellow | green | cyan | blue | purple
  shape: 'rounded', // rounded | flat
  motion: 'full' // full | reduced
});

setMciPalette('blue');
setMciShape('flat');
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
- `MciNavbar`: mobile navigation shell
- `MciButton`: brand button with variants, pressed feedback, optional sheen, and shape tokens
- `MciCard`: compact surface/card with elevation, hover lift, optional sheen, and glass/focus variants
- `MciSkeleton`: skeleton loading for data pages
- `MciDataState`: loading/empty/error state wrapper
- `MciRichText`: mobile-friendly rich text container with image/text spacing rules

## Design Rule

Business pages should import MCI-UI components or project-level wrappers based on MCI-UI. Third-party UI libraries may be used under the hood, but their visual language should be normalized through `--mci-*` tokens and `mci-*` components.
