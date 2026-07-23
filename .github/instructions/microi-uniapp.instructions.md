---
applyTo: "microi.uniapp/**"
---

# Microi UniApp Repository Instructions

Before changing `microi.uniapp`, read `microi.uniapp/AGENTS.md`,
`microi.uniapp/docs/architecture.md`, and `microi.uniapp/CONTRIBUTING.md`.

- Keep `src/platform`, `src/pages/module`, `src/pages/native-form`, and shared
  `mci-*` components tenant-neutral.
- Put customer-only routes, fields, workflows, presets, and assets in
  `src/tenants/<tenant>` plus `profiles/<tenant>`.
- Prefer authorized `sys_menu`, `diy_table`, `diy_field`, physical ViewSchema
  fields, and ActionSchema. Never use retired `DiyConfig` or arbitrary frontend
  V8/eval.
- Access cached form metadata through
  `V8.FormEngine.GetDiyTableModel/GetDiyFieldList`; do not use ordinary CRUD
  against protected `diy_table/diy_field` or add raw metadata URLs to pages.
- Preserve the checked-in `xjy` default and validate both `standard` and `xjy`
  profiles after platform changes.
- Do not hand-edit generated bridges. Resolve their merge conflicts from
  Profile sources and run `npm run profile:sync -- xjy`.
