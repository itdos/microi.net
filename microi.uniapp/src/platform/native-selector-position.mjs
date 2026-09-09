// Portal coordinates use the same viewport as boundingClientRect, not the child list.
export function positionNativeSelector(rect, viewport, keyboardHeight = 0) {
  const width = viewport.windowWidth
  const gap = 14 * width / 750
  const topEdge = Math.max(viewport.top || 0, (viewport.capsuleTop || 0) + (viewport.capsuleHeight || 0)) + 8
  const bottomEdge = viewport.windowHeight - Math.max(viewport.bottom || 0, keyboardHeight) - 8
  const triggerWidth = Math.min(rect.width, width - 16)
  const left = Math.max(8, Math.min(rect.left, width - triggerWidth - 8))
  // When the keyboard covers the source field, keep the same search input above it.
  const top = Math.max(topEdge, Math.min(rect.top, bottomEdge - rect.height))
  const below = Math.max(0, bottomEdge - top - rect.height - gap - 2)
  const above = Math.max(0, top - topEdge - gap - 2)
  const placement = below < 350 && above > below ? 'top' : 'bottom'
  const listHeight = Math.min(420 * width / 750, placement === 'top' ? above : below)
  return { top, left, width: triggerWidth, height: rect.height, gap, placement, listHeight }
}
