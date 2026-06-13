---
name: microi-ui
description: Use when building or documenting Microi.UI / MCI-UI for Vue 3 websites, responsive sites, uni-app mobile projects, theme palettes, shape modes, premium mobile UI, skeleton loading, safe areas, motion, and Microi brand frontend components.
applyTo: "**/*.{vue,js,ts,css,scss,md,json}"
---

# Microi.UI / MCI-UI

Microi.UI is the shared frontend design system for Microi products. Use it for Vue 3 websites, responsive sites, H5, and uni-app mobile projects. PC admin pages can still use Element Plus, but their visual tokens, loading states, empty states, motion, and brand colors should align with `--mci-*` tokens.

When the user asks for a Microi mobile app, H5, mini-program, customer portal, staff app, member center, official site, product site, activity page, dashboard, or report page and does not name another design system, default to Microi.UI.

This is an automatic rule. Do not wait for the user to explicitly say "follow `microi.skills/microi-ui/SKILL.md`". If the repository, requirement, file path, or project context belongs to the Microi ecosystem and the work touches frontend UI, website UI, H5, uni-app, mini-program, customer/staff/member pages, reports, dashboards, or visual polish, load and apply this skill by default.

## Core Promise

Microi.UI is not only a component set. It is a visual delivery standard for AI-built software:

- Every first viewport must have a clear visual anchor.
- Every page must use brand-aware color and component hierarchy.
- Every important action must be obvious, beautiful, and reachable.
- Every list/detail/form must be built from reusable scene patterns, not copied one-off CSS.
- Every mobile page must respect safe areas, loading states, pressed feedback, and bottom actions.

## Source Layout

- `Microi.UI/src/theme/tokens.css`: design tokens, palettes, radius, shadows, motion, mobile scene variables.
- `Microi.UI/src/theme/index.css`: base classes, page shell, mobile premium primitives, skeleton, motion, bottom navigation, rich cards, sheets, form options.
- `Microi.UI/src/theme/runtime.js`: `initMciDesign`, `applyMciDesign`, `getMciDesign`, `toggleMciTheme`, `setMciTheme`, `setMciPalette`, `setMciShape`, `setMciMotion`.
- `Microi.UI/src/web`: Vue 3 web components.
- `Microi.UI/src/uniapp`: uni-app Vue 3 components.

## Required Defaults

- Call `initMciDesign()` at app startup or provide an equivalent project-level theme service.
- Support `theme: light | dark`, `palette: black | white | red | orange | yellow | green | cyan | blue | purple`, `shape: rounded | flat`, and `motion: full | reduced`.
- Wrap Microi.UI pages or embedded UI areas with `.mci-page` or `[data-mci-ui-root]`.
- Use `MciPage` as the page shell. Mobile customer/staff/member pages should usually use `premium`.
- Do not hardcode colors, shadows, radius, gradients, or safe-area spacing in business pages. Use `--mci-*` variables or `mci-*` classes.
- Only public shared classes with `mci-` prefix are allowed. Do not introduce external UI library names, copied class names, or generic globals such as `.card`, `.list`, `button {}`.
- If a UI pattern appears in two or more pages, extract a Microi.UI component or project-level `mci-*` wrapper.
- Dynamic pages must show skeleton screens during first load, not spinner-only or premature empty states.
- Prominent buttons must use icon plus text, centered with flex, stable height, loading state, and pressed feedback.
- Native mini-program buttons such as `open-type="getPhoneNumber"` must be styled as Microi primary buttons and remove default button borders.
- API headers must pass `OsClient` as one exact value such as `lxwb`, never duplicated values such as `lxwb, lxwb`.

## Component Selection

- `MciPage`: page shell, safe area, motion, premium mobile background.
- `MciHeroPanel`: branded first-viewport hero/status panel.
- `MciBottomNav`: custom bottom navigation with icon, badge, active state, optional raised center item.
- `MciButton`: primary, plain, gold, cool, ghost actions.
- `MciCard`: general content container.
- `MciCell`: settings/menu/list rows.
- `MciSection`: major sections.
- `MciTabs`: segmented navigation and content switching.
- `MciMetricCard` / `MciAssetCard`: numbers, assets, summaries.
- `MciOrderCard`: orders, work orders, tasks, repair requests.
- `MciActionBar`: safe-area bottom actions.
- `MciAvatar`: member/customer/staff identity.
- `MciProductCard`: commerce/content grids.
- `MciFormField`: forms and data entry.
- `MciFilterBar`: list search/filter area.
- `MciModal`: dialogs and confirmations.
- `MciUploader`: image/file upload.
- `MciTimeline`: service records, repair progress, approval records.
- `MciSteps`: workflows and status stages.
- `MciSkeleton`: loading placeholders.
- `MciDataState`: empty/error/success states.
- `MciRichText`: reports, articles, instructions.

## Premium Mobile Visual Standard

Mobile apps must feel like polished products, not admin forms squeezed into a phone viewport.

Use these primitives before writing page-local CSS:

- `.mci-page--mobile-premium`
- `.mci-mobile-hero`
- `.mci-mobile-panel`
- `.mci-mobile-bubble-grid`
- `.mci-mobile-stat-grid`
- `.mci-mobile-titlebar`
- `.mci-mobile-chip-row`
- `.mci-mobile-bottom-nav`
- `.mci-mobile-rich-card`
- `.mci-mobile-meta-grid`
- `.mci-mobile-option-grid`
- `.mci-mobile-photo-grid`
- `.mci-mobile-sheet`
- `.mci-mobile-chart-card`
- `.mci-mobile-kpi-strip`
- `.mci-mobile-empty-result`

### First Viewport Rule

The first viewport must show one of these anchors:

- branded hero panel with CTA
- identity/member header
- workbench status card
- report/status overview
- search plus category panel
- image-led content hero
- KPI dashboard summary

Do not start a mobile page with only a flat title and a plain list.

### Layering Rule

High-quality mobile pages should usually compose:

1. atmosphere background or hero
2. floating quick-action or stats panel
3. titlebar with action
4. rich business cards
5. bottom navigation or fixed action bar

Avoid a monotonous stack of identical white cards.

### Icon Rule

Bottom navigation, home quick actions, profile shortcuts, grid actions, floating actions, empty-state actions, settings/info rows, theme options, and primary buttons must use recognizable icons. Single Chinese characters such as `租`, `版`, `客`, or `我` are placeholders, not icons.

### Motion Rule

Use restrained motion: page entrance, staggered cards, tap feedback, skeleton shimmer, optional hero idle/sheen. Motion must not cause layout shift, clipped text, or operational distraction. Respect `motion: reduced`.

## Mobile Scene Blueprints

### Login / Register

- Do not force role switching unless the business explicitly has separate login systems.
- H5/App login should normally be one account-or-phone + password form, not separate account and phone login blocks shown together.
- WeChat mini-program login should default to phone authorization with `<button open-type="getPhoneNumber">`; account/password fallback can exist as a secondary collapsed option when staff login is required.
- For Microi account login, use the platform login flow correctly; do not call nonexistent methods.
- For WeChat mini-program customer login, support phone authorization and registration/binding.
- Do not show current tenant, OsClient, API host, mobile version, or debug metadata blocks to end users on login/profile pages.
- Use top atmosphere plus floating form panel.
- Inputs must be thick, rounded, readable, and grouped.
- Primary login / go-login / phone login buttons must be icon plus text, high contrast, and full width where appropriate.
- Show social/quick-login entries only when they actually work.

### Home / Workbench

- Expose the next action in the first viewport: pending orders, due plans, reports, repairs, approvals, or quick actions.
- Use `MciHeroPanel` or `.mci-mobile-hero`.
- Use floating quick actions with icons.
- Use metric cards for counts and status.
- Use rich cards for recent tasks or reports.
- Hero text must fit 375px and 430px widths. Reduce title size before accepting ugly wrapping.
- Floating panels must not cover hero buttons.

### Profile / My

- Use identity header with avatar, name, role/customer, status, and at least one visual badge.
- Use two or more highlighted shortcut cards or a service grid.
- Group settings and business entries into panels.
- Theme switching can live here and must be usable before login when the profile page is reachable while logged out.
- Settings/info rows must use real icons. Do not use single-character badges as icons for tenant, version, theme, or account entries.
- Do not render profile as a plain list unless the product is intentionally utilitarian.

### Theme Options

- If a customer requests a new visual style after a prior design was accepted, preserve the prior design as a named theme unless the user explicitly asks to remove it.
- Theme names should describe visual intent, such as `清新绿红`, `品牌经典`, or `专业深色`.
- Persist the selected theme and apply it to page roots, fixed bottom nav, buttons, cards, empty states, skeletons, forms, reports, and H5 desktop phone shell.
- For uni-app and WeChat mini-programs, do not rely only on `document.documentElement`; bind theme class or variables at every page root through a project-level theme service.
- On profile/settings pages, expose theme switching as a compact action that opens a bottom sheet or modal. Do not render all theme choices directly on the main profile page unless the page is explicitly a full settings page.
- H5 uni-app theme switching must not break router patching. If reactive root class changes cause `parentNode`, `scheduler flush`, or `updateSlots` errors, keep Vue page classes stable and let the theme service apply/repair `html/body` attributes and page-root theme classes after DOM changes.
- After switching theme, bottom navigation must still route cleanly. Guard active-route taps, debounce repeated taps, and defer navigation briefly if needed.
- Screenshot every route in `pages.json` for every named theme. Text in shortcut cards, report cards, empty states, modals, and bottom nav must remain high contrast.

### List

- Mobile lists should use business cards, not table-like rows.
- Each card needs title, status pill, key metadata, time, and primary action.
- Add filter/search/tabs above lists when data types differ.
- Use skeleton cards during loading and meaningful empty states.
- Long titles and metadata must ellipsize or wrap intentionally without breaking card height.

### Detail / Report

- Start with overview hero/status block.
- Then show facts, timeline/steps, media, rich report content, and action area.
- Important status must be visible without scrolling.
- Reports should use `MciRichText`, readable line height, image max width, and share/read/confirm actions.
- If an action is expected, use `MciActionBar` or fixed safe-area submit bar.
- Preserve the viewer identity from list to detail: staff report cards should open staff-authenticated detail data, customer cards should open CustomerToken detail data, and shared links should open ShareToken detail data. Do not redirect a logged-in user to login after they click a card that was already visible to them.

### Form / Upload

- Use section headers with small icon marks.
- Use large clean input areas and enough vertical spacing.
- Use colored option chips or option cards for important choices.
- Upload surfaces must support re-select/replacement, preview, close preview, progress, retry, and failure toast.
- Long forms need a fixed safe-area submit bar.

### Bottom Navigation

- Prefer `MciBottomNav` when native tabbar limits visual quality or causes runtime issues.
- Must include icons, labels, active state, and stable tap targets.
- Raised center action is allowed for create/scan/repair/report actions.
- Do not use text-only navigation.

### Popup / Sheet / Dialog

- Use dimmed overlay, clear sheet radius, handle line for bottom sheets, and compact action hierarchy.
- Bottom sheets should not cover irreversible actions without confirmation.
- Confirmation dialogs should show clear icon/status and one primary action.

### Chart / Dashboard

- Numbers come before charts.
- Use 2-4 high-signal metrics in the first screen.
- Use a small palette; do not make every chart a rainbow.
- For dense dashboards, choose either clean light analytics or dark command-center style, not a random mix.

### Messages / Social / News

- Messages need avatar/icon, type, title, summary, time, unread marker, and action if needed.
- Social/content feeds need strong media ratio, author identity, tags, and engagement actions.
- News/content pages need category tabs, hero or featured story, and readable cards.

### Commerce / Activity

- Use image-led cards, price/status anchors, promotional tags, and bottom purchase/action area.
- Cart/order pages need visible selection state, quantity controls, totals, and fixed checkout bar.
- Activity pages need a campaign hero, progress/status, reward/action panels, and rules panel.

## Website / PC Site Standard

- Build the actual product/site experience, not a generic landing shell.
- First viewport must make the brand/product/place/object obvious.
- For landing heroes, use real/generated bitmap imagery or an immersive interactive scene when appropriate. Do not rely on decorative gradients alone.
- Hero text should not sit inside a card.
- SaaS/CRM/operation sites should be quiet, dense, scannable, and work-focused.
- Product/venue/portfolio sites can be more visual, but the primary object must be inspectable.
- Use `MciHeroPanel`, `MciSection`, `MciCard`, `MciMetricCard`, and `MciButton` before page-local CSS.

## Backend Menu Pairing

When creating a Microi low-code system, backend menus should not all be first-level menus. Use at least two levels for real systems:

- Customer Center: customers, contacts, bindings.
- Asset/Device Center: equipment/assets.
- Operation Center: plans, orders, records, repairs.
- Report Center: reports, read logs.
- System/Config Center: dictionaries, settings, templates.

The mobile app information architecture should match these business domains where practical.

## AI Implementation Checklist

- Auto-detect this skill for Microi frontend, website, H5, uni-app, mini-program, customer portal, staff app, member center, dashboard, report, activity, and visual redesign tasks.
- Read this skill and `microi.skills/ui-design/SKILL.md` before designing UI.
- Inspect the logo/brand colors and derive palette before writing pages.
- Choose scene blueprint first, component second, CSS last.
- Use Microi.UI components or project-level `mci-*` wrappers over direct third-party visual styling.
- Update `Microi.UI` when a reusable pattern appears across projects.
- Update `microi.doc/docs/doc/system-engine/microi-ui.md` when Microi.UI behavior or standards change.
- Validate with `npm run check`, `npm run pack:check`, and docs build when possible.
- For UI/frontend work, use screenshot-based visual verification when a browser/H5/devtools target is available.
- For named themes, run screenshot verification across all `pages.json` routes in each theme and inspect console logs after switching theme then navigating.
- Inspect at 375px and 430px widths for mobile pages.
- Check hero title wrapping, action visibility, floating panel overlap, bottom nav icons, empty states, form submit bars, and button centering.

## Prohibited Output

- No external UI library identity or copied class prefix inside Microi.UI files or docs.
- No text-only bottom navigation.
- No single-character fake icons for settings/profile/theme/info entries.
- No generic global CSS selectors.
- No duplicate `OsClient` header values.
- No login calls to undefined API methods.
- No simultaneous duplicate login systems on one login page unless explicitly required.
- No user-facing current-tenant, API-host, or mobile-version debug blocks.
- No theme switch that only affects one page or disappears after navigation/restart.
- No profile page that dumps all theme options inline when a switch button plus sheet/modal would be cleaner.
- No theme switch that causes uni-app router/scheduler errors after bottom navigation.
- No report/list detail route that loses the staff/customer/share auth context and redirects visible items to login.
- No all-first-level backend menu planning for business systems.
- No page that has only plain lists, plain buttons, and no visual anchor when the product is customer/staff-facing.
