---
name: microi-mobile-app-quality
description: Microi mobile app quality gate for UniApp/H5/WeChat mini programs. Use when creating, redesigning, fixing, testing, or delivering any Microi mobile project, including login, tab navigation, quick actions, buttons, animations, menu hierarchy, and mobile visual acceptance.
applyTo: "**/*.{vue,js,ts,css,scss,json,md}"
---

# Microi Mobile App Quality Gate

This skill is mandatory for every Microi UniApp/H5/WeChat mini program delivery. It records recurring mobile mistakes that must not be repeated.

Automatic trigger: if a task touches a Microi mobile app, H5, WeChat mini program, App build, uni-app project, login page, tabbar, homepage, profile page, workbench, report page, visual redesign, or mobile acceptance, apply this skill even when the user does not explicitly name it.

## 1. Navigation And Quick Actions Must Use Real Icons

Bottom navigation, homepage quick entries, member-center shortcuts, grid actions, and floating actions must show recognizable icons above or beside text.

Required:
- Use Microi.UI icons, project `mci-icon-*` CSS icons, iconfont, or a stable bundled icon component.
- Bottom nav items such as Home, Orders, Reports, Repair, Mine must show icons, not Chinese single-character substitutes like `首` / `单` / `报` / `我`.
- Homepage entry grids and Mine/Profile shortcuts must follow the same rule.
- Profile/settings/info blocks such as theme, tenant, version, account, about, customer binding, and service entries must use real icons. Do not use single Chinese characters such as `租` / `版` / `客` as icon substitutes.
- Icons must be real visual symbols and must not rely on remote placeholder images.
- If SVG or image icons are used, assets must be local, versioned, and checked for mini-program packaging.

Forbidden:
- Text-only nav icons.
- Single Chinese characters used as fake icons.
- Missing-icon placeholders, 404 remote icons, or emoji-only icon systems.

Acceptance:
- Inspect every bottom nav and homepage/member shortcut in screenshots.
- Confirm icon plus label is visible, aligned, and tappable on H5, WeChat mini program, and App build targets.

## 2. Do Not Guess Microi Frontend SDK Login APIs

Before writing login code, inspect the local project SDK wrapper such as `src/utils/microi.v8.js`, `src/utils/api.js`, or the standard `microi.uniapp` login implementation.

Required:
- Use the actual exported API. If the SDK exposes `V8.Login(param)`, do not write `V8.Login.Login(...)`.
- Staff/account login should call the platform login endpoint through the project SDK wrapper, normally `/api/SysUser/Login` or `V8.Login(param)`.
- Token extraction must support both response headers and response body fallback.
- The first test after login implementation must include a real click on the login button and a console/network check.

Forbidden:
- Inventing nested SDK objects.
- Treating interface-engine login and `SysUser` account login as the same contract.
- Shipping a login page without testing the actual button path.

Acceptance:
- H5 route `/pages/login/login` or the project login route opens without console errors.
- Clicking account login never throws `V8.Login.Login is not a function`.

## 3. OsClient Headers Must Not Be Duplicated

Microi requests must send one case-insensitive OsClient header only. Browser, proxy, or server runtimes may merge duplicate case variants such as `OsClient` and `osclient` into `lxwb, lxwb`, which breaks tenant recognition.

Required:
- Build request headers through a helper that deletes existing case-insensitive matches before setting `osclient`.
- Prefer one canonical header key, normally lowercase `osclient`, with a single value such as `lxwb`.
- Apply the same case-insensitive de-duplication to `Authorization` / `authorization` and any other singleton auth headers.
- Request body/query may include `OsClient` when the Microi endpoint contract needs it, but headers must still contain only one `osclient` value.

Forbidden:
- Setting both `headers.OsClient` and `headers.osclient`.
- Setting both `headers.Authorization` and `headers.authorization`.
- Shipping after seeing a network header value like `lxwb, lxwb`.

Acceptance:
- Inspect the login request in the network panel or request adapter logs.
- Confirm the header is exactly `osclient: lxwb` for the target tenant, not comma-merged.

## 4. Important Buttons Must Be Icon Buttons

Prominent actions must use polished icon + text buttons.

Required:
- Login, Go Login, Submit, Save, Confirm, Accept Order, Repair, Generate Report, Upload Photo, and primary hero actions must include an icon.
- Buttons must have visible pressed state, loading state, disabled state, and enough height for touch.
- Primary buttons should use project brand gradient or solid brand color, with restrained shadow and safe text contrast.
- Native mini-program buttons such as `open-type="getPhoneNumber"` must be styled to match `mci-btn` and remove default borders.

Forbidden:
- Plain text-only primary buttons in hero, empty state, login, or fixed bottom bars.
- Buttons whose text is not vertically centered.
- Buttons without loading feedback for async actions.

Acceptance:
- Screenshot empty states, login, and form submit pages.
- Confirm the primary action has an icon, proper loading copy, and active feedback.

## 5. Hero Text And Floating Panels Must Not Overlap

Mobile first screens often combine a large hero and a floating quick-action panel. This layout must be visually inspected because oversized Chinese headlines and aggressive negative margins can cause awkward line breaks or cover primary buttons.

Required:
- Hero titles must use a size that fits the real Chinese copy at common 375px and 430px phone widths.
- Keep line-height relaxed enough for two-line Chinese headlines; avoid huge display text inside compact operational heroes.
- When using a floating quick-action panel, reserve bottom padding inside the hero for actions and keep the negative margin shallow enough that it overlaps only decorative space.
- Primary hero buttons must remain fully visible and tappable, including shadow and rounded bottom edge.

Forbidden:
- Hero title wrapping into an ugly single-character or two-character second line.
- Floating panels covering login/report/submit buttons.
- Solving overlap by hiding buttons or reducing tap targets below mobile usability.

Acceptance:
- Screenshot the first viewport at 375px and 430px widths.
- Check the hero headline, primary/secondary buttons, and the next floating panel for clipping or overlap.

## 6. Backend Menus Must Be Planned And Written As At Least Two Levels

For real business systems, backend menus must not be dumped as many first-level menus.

Required:
- Create parent menu groups first, then child CRUD modules under those groups.
- A business module with more than three related pages must have a parent folder menu.
- Suggested grouping examples:
  - Customer Center: Customers, Sites, Contacts, Customer Account Binding.
  - Equipment Center: Equipment Ledger, Equipment Templates, Maintenance Parameters.
  - Maintenance Operations: Plans, Work Orders, Service Records, Repair Requests.
  - Report Center: Inspection Reports, Read Logs, Print/Share Templates.
  - System Configuration: Dictionaries, Jobs, Integration Settings.
- When using Manifest/MCP, include parent modules and child modules explicitly. `ParentId` must be set for child modules.
- Dry-run plans must list the final menu tree, not only flat menu names.
- If the user asks to fix an existing backend with MCP, do the remote work: read `sys_menu`, create missing parent `SecondMenu` rows, update existing child `ParentId` / `Sort`, grant admin role permission to new parent menus, then read back the menu tree.
- Do not stop at writing this rule into a skill when the user explicitly asks to modify the current MCP tenant.

Forbidden:
- Creating all generated modules directly under root.
- Mixing customer master data, work orders, reports, logs, and settings at the same menu level.

Acceptance:
- After MCP generation, read back `sys_menu` and confirm menu depth.
- The final response must mention the actual menu tree written through MCP and any permission refresh performed.

## 7. Mobile Pages Need Motion, But Motion Must Be Useful

Mobile products should not feel like static admin forms.

Required:
- Use subtle entrance animation for page hero, panels, cards, and important action areas.
- Use pressed feedback for tap targets.
- Skeleton loading should shimmer or pulse lightly.
- Decorative motion should be low amplitude and must not distract from task completion.
- Respect reduced-motion preferences where supported.

Forbidden:
- Entire app with no interaction feedback.
- Heavy looping animations on dense operational lists.
- Motion that causes layout shifts or overlaps text.

Acceptance:
- Browser/device inspection confirms cards, panels, buttons, or skeletons have visible but restrained motion.
- No animation causes horizontal overflow, text clipping, or fixed-bar jitter.

## 8. Login Page Must Be A Direct Login Surface

The login page must not force users to switch between two identity tabs before they can log in.

Required:
- For H5/App, provide one account-or-phone + password form. Do not place a separate phone-only customer login form next to the account/password form unless the backend explicitly supports and requires that second path.
- For WeChat mini programs, make phone authorization the default login surface using `<button open-type="getPhoneNumber">`. Account/password login may be a secondary fallback, but it must be collapsed or secondary, not displayed as a full second login system beside phone authorization.
- In WeChat mini programs, phone quick login must pass the returned phone `code` to the backend, and must also call `uni.login()` to get a fresh `LoginCode` when the backend needs OpenId/UnionId.
- In H5/App fallback, provide manual phone input only if the backend supports phone login.
- Make login copy clear: account/phone + password is one path; WeChat phone authorization is the mini-program default path.
- Do not show internal implementation metadata on the login page such as current tenant, OsClient, mobile build version, API host, or debug version blocks.

Forbidden:
- Staff/Customer tab switch as the primary login model unless the user explicitly requires it.
- Two simultaneously visible full login systems such as “account + password” plus “phone input login” on the same screen.
- Pretending the frontend can directly read a WeChat phone number from `getPhoneNumber`; modern WeChat returns a code.
- Implementing phone login only as a text input when the target is WeChat mini program.
- Showing tenant/version/debug blocks to end users.

Acceptance:
- Inspect the standard reference at `microi.uniapp/src/pages/login/index.vue` before implementing.
- Test account login path and phone-login button rendering.
- Build H5 and WeChat mini program targets.

## 9. Theme Switching Must Be Real And Global

When a customer asks for an alternate visual style, keep the current accepted theme as a named option instead of overwriting it unless the user explicitly asks to remove it.

Required:
- Name each theme by visual intent, not by temporary customer wording. Examples: `清新绿红`, `品牌经典`, `专业深色`.
- Persist theme choice with `uni.setStorageSync` or the project theme runtime.
- Make the theme switch available before login when the product has a Mine/Profile/Settings page that can be opened while logged out.
- Show theme switching as a compact "Switch Theme" action that opens a modal/bottom sheet. Do not dump every theme option directly on the Mine/Profile page unless the page is explicitly a settings page.
- Apply theme state to every page root, fixed bottom nav, empty states, skeletons, buttons, cards, and H5 desktop phone shell. A theme that only changes the current page is incomplete.
- Mini-program builds cannot rely only on `document.documentElement`; use page root classes, CSS variables, or a cross-platform theme service.
- If page-local scoped CSS hardcodes colors, add theme-aware overrides or refactor to `--mci-*` variables.
- On H5, theme changes must not destabilize uni-app router patching. If reactive page-root class switching causes scheduler/`parentNode`/`updateSlots` errors, use a stable page class plus a theme service that applies `html/body` attributes and repairs page-root classes after route DOM changes.
- Bottom navigation must guard against tapping the active route, debounce repeated taps, and defer route changes briefly after a theme switch so DOM/theme updates finish before `uni.reLaunch`.

Forbidden:
- Deleting a previously accepted design when adding a customer-preference theme.
- A theme switch whose effect disappears after navigation or app restart.
- Theme cards/options using text-only fake icons.
- Theme switching that breaks bottom navigation or produces Vue scheduler errors.

Acceptance:
- Switch themes on the logged-out Mine/Profile page and navigate to Home, Login, List, Detail, and Form pages.
- Confirm bottom nav, primary buttons, cards, empty state, and page background all change consistently.
- Reload the H5 page or restart the mini program and confirm the selected theme is restored.
- Run screenshot verification for every route in `pages.json` under every named theme. Check text contrast, especially shortcut cards, report cards, empty states, bottom nav, hero text, and modal/sheet content.

## 10. Report/List Detail Auth Must Preserve User Identity

List-to-detail navigation must keep the caller identity model. Staff, customer, and public/share routes may need different APIs even when they open the same visual report detail page.

Required:
- If staff can see a report list through authenticated FormEngine or backend account APIs, report detail must use the same staff-authenticated path or pass a valid staff token.
- If customers open reports, use customer token or binding-aware interface engines.
- If external users open a shared report, use a share token route and do not require staff/customer login.
- Do not send an empty `CustomerToken` for staff users and then interpret the backend response as "not logged in".
- Preserve current session before opening detail pages and avoid clearing staff token unless an authenticated staff endpoint actually returns an auth-expired code.

Forbidden:
- Reusing a customer anonymous report-detail engine for staff list clicks without a staff credential path.
- Redirecting to login after clicking a report/list item that was already visible to the logged-in user.

Acceptance:
- Test staff list -> report/detail, customer list -> report/detail, and share-token detail separately.
- Confirm no unexpected login redirect happens after clicking a visible card.

## Final Delivery Checklist

Before marking a mobile project complete:
- Icons: bottom nav, homepage quick actions, profile shortcuts, primary buttons.
- Login: one account/phone + password path for H5/App, WeChat phone authorization as mini-program default, no simultaneous duplicate login systems, no tenant/version/debug blocks, SDK API verified.
- Buttons: icon + text, pressed state, loading state.
- Menus: backend planned as at least two-level tree.
- Headers: `osclient` is a single canonical header value, not duplicated by case.
- First viewport: hero text and floating quick panels are screenshot-checked for no clipping or overlap.
- Motion: entrance, tap, skeleton animation present and restrained.
- Theme: named themes persist, can be switched while logged out, and affect all pages plus bottom navigation.
- Theme QA: every `pages.json` route is screenshot-checked in every named theme; no low-contrast text and no Vue scheduler/router errors after switching theme then navigating.
- Auth QA: list-to-detail routes preserve staff/customer/share identity and do not redirect visible items back to login.
- Verification: `build:h5`, `build:mp-weixin`, and `build:app` when scripts exist; H5 route smoke test and console check.
