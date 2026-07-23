/**
 * Mobile UI provider boundary.
 *
 * Microi.UI owns tokens, layout, states, accessibility and final appearance.
 * Native UniApp controls are the default implementation. A third-party control
 * library may be used only behind an mci-* adapter when it fills a real
 * capability gap; business pages must never import it directly.
 */
export const UI_PROVIDER_POLICY = Object.freeze({
  productLayer: 'Microi.UI',
  defaultPrimitiveLayer: 'uni-app-native',
  optionalPrimitiveLayer: 'uni-ui',
  adapterDirectory: 'src/platform/ui/adapters',
  directBusinessImportsAllowed: false
})

export function getControlProvider(componentName = '') {
  const name = String(componentName || '').trim()
  if (!name) return UI_PROVIDER_POLICY.defaultPrimitiveLayer
  return 'mci'
}

export default {
  UI_PROVIDER_POLICY,
  getControlProvider
}
