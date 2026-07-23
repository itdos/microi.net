# Microi.UI Adapter Boundary

This directory is the only place where a third-party UI component library may
be imported.

- Public components use the `mci-*` prefix.
- Business pages and tenant modules import the adapter, never the provider.
- Microi.UI tokens, states, safe areas and accessibility remain authoritative.
- Add a provider only for a real capability gap and verify bundle size plus
  WeChat/H5 screenshots before adoption.

`uni-ui` is the preferred optional primitive provider for standard cross-platform
controls. Its default visual language must not leak through an adapter.
