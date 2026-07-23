# Microi UniApp Copilot Instructions

Follow `/AGENTS.md` and `/docs/architecture.md`.

- Keep standard product code free of tenant table names, field names, routes,
  assets, and copy.
- Put customer-specific behavior in `src/tenants/<tenant>/` and configuration in
  `profiles/<profile>/`.
- Prefer authorized `sys_menu` plus `diy_table/diy_field` metadata and physical
  ViewSchema fields over hard-coded forms.
- Read metadata through `V8.FormEngine.GetDiyTableModel/GetDiyFieldList`; never
  query protected `diy_table/diy_field` with ordinary CRUD or duplicate raw
  metadata endpoint URLs in pages.
- Never use retired `DiyConfig`, arbitrary frontend V8, `eval`, or
  `new Function`.
- Preserve the default `xjy` delivery and validate both standard and xjy
  profiles for platform changes.
- Do not hand-edit `src/generated/`.
