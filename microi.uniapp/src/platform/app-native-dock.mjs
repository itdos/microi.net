const NATIVE_DOCK_ID = 'mci-app-native-dock'

let nativeView = null
let nativeState = null
let nativeStateSignature = ''
let nativeStructureSignature = ''
let switching = false

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const localAsset = (value) => {
  const path = String(value || '').replace(/^\/+/, '')
  return path ? `_www/${path}` : ''
}

export const buildNativeDockLayout = (windowWidth, safeBottom = 0, aiEnabled = true, tabCount = 4, windowHeight = 667) => {
  const width = Math.max(320, numberOr(windowWidth, 375))
  const viewportHeight = Math.max(320, numberOr(windowHeight, 667))
  const bottom = Math.max(0, numberOr(safeBottom, 0))
  const padding = 12
  const gap = aiEnabled ? 8 : 0
  const aiSize = aiEnabled ? 56 : 0
  const top = 7
  const pillHeight = 58
  const height = 72 + bottom
  const pillWidth = width - padding * 2 - gap - aiSize
  return {
    width,
    windowHeight: viewportHeight,
    height,
    top: Math.max(0, viewportHeight - height),
    safeBottom: bottom,
    pill: { left: padding, top, width: pillWidth, height: pillHeight },
    ai: aiEnabled ? { left: padding + pillWidth + gap, top, width: aiSize, height: aiSize } : null,
    tabWidth: pillWidth / Math.max(1, tabCount)
  }
}

export const nativeDockTargetAt = (clientX, layout, tabCount = 4) => {
  const x = numberOr(clientX, -1)
  if (!layout || x < 0) return { type: 'none', index: -1 }
  if (layout.ai && x >= layout.ai.left && x <= layout.ai.left + layout.ai.width) {
    return { type: 'ai', index: -1 }
  }
  const pill = layout.pill
  if (x < pill.left || x > pill.left + pill.width) return { type: 'none', index: -1 }
  const index = Math.min(Math.max(0, tabCount - 1), Math.floor((x - pill.left) / layout.tabWidth))
  return { type: 'tab', index }
}

const drawTags = (state, layout) => {
  const activeColor = state.primaryColor || '#2563EB'
  const inactiveColor = '#667991'
  const tags = [
    {
      tag: 'rect', id: 'dock-background',
      rectStyles: { color: '#F1F6FB' },
      position: { top: '0px', left: '0px', width: '100%', height: '100%' }
    },
    {
      tag: 'rect', id: 'dock-pill',
      rectStyles: { color: '#FFFFFF', radius: '29px', borderColor: '#D7E0EB', borderWidth: '1px' },
      position: { top: `${layout.pill.top}px`, left: `${layout.pill.left}px`, width: `${layout.pill.width}px`, height: `${layout.pill.height}px` }
    }
  ]

  state.items.forEach((item, index) => {
    const left = layout.pill.left + layout.tabWidth * index
    const selected = index === state.activeIndex
    const iconPath = selected ? (item.selectedIconPath || item.iconPath) : item.iconPath
    tags.push({
      tag: 'img', id: `tab-icon-${index}`, src: localAsset(iconPath),
      position: { top: '12px', left: `${left + (layout.tabWidth - 24) / 2}px`, width: '24px', height: '24px' }
    })
    tags.push({
      tag: 'font', id: `tab-label-${index}`, text: String(item.text || ''),
      textStyles: { align: 'center', color: selected ? activeColor : inactiveColor, size: '12px', weight: selected ? 'bold' : 'normal' },
      position: { top: '36px', left: `${left}px`, width: `${layout.tabWidth}px`, height: '19px' }
    })
  })

  if (layout.ai) {
    tags.push({
      tag: 'rect', id: 'dock-ai-circle',
      rectStyles: { color: '#FFFFFF', radius: '28px', borderColor: '#D7E6F3', borderWidth: '2px' },
      position: { top: `${layout.ai.top}px`, left: `${layout.ai.left}px`, width: `${layout.ai.width}px`, height: `${layout.ai.height}px` }
    })
    tags.push({
      tag: 'img', id: 'dock-ai-image', src: '_www/static/mci/ai/assistant-robot.png',
      position: { top: `${layout.ai.top + 4}px`, left: `${layout.ai.left + 4}px`, width: '48px', height: '48px' }
    })
    tags.push({
      tag: 'font', id: 'dock-ai-label', text: 'AI',
      textStyles: { align: 'center', color: activeColor, size: '11px', weight: 'bold' },
      position: { top: `${layout.ai.top + 39}px`, left: `${layout.ai.left}px`, width: `${layout.ai.width}px`, height: '15px' }
    })
  }
  return tags
}

const redraw = () => {
  if (!nativeView || !nativeState) return
  const layout = buildNativeDockLayout(nativeState.windowWidth, nativeState.safeBottom, nativeState.aiEnabled, nativeState.items.length, nativeState.windowHeight)
  nativeState.layout = layout
  nativeView.setStyle({ left: '0px', top: `${layout.top}px`, width: '100%', height: `${layout.height}px`, backgroundColor: '#F1F6FB' })
  nativeView.draw(drawTags(nativeState, layout))
}

const stateSignature = (state) => JSON.stringify({
  activeIndex: state.activeIndex,
  aiEnabled: state.aiEnabled,
  safeBottom: numberOr(state.safeBottom),
  windowWidth: numberOr(state.windowWidth, 375),
  windowHeight: numberOr(state.windowHeight, 667),
  primaryColor: state.primaryColor,
  items: state.items.map((item) => [item.pagePath, item.text, item.iconPath, item.selectedIconPath])
})

const structureSignature = (state) => JSON.stringify({
  aiEnabled: state.aiEnabled,
  safeBottom: numberOr(state.safeBottom),
  windowWidth: numberOr(state.windowWidth, 375),
  windowHeight: numberOr(state.windowHeight, 667),
  itemCount: state.items.length
})

const handleNativeClick = (event = {}) => {
  if (!nativeState || switching) return
  const target = nativeDockTargetAt(event.clientX, nativeState.layout, nativeState.items.length)
  if (target.type === 'ai') {
    // NativeObj.View sits above every WebView. Hide it before opening a
    // non-tab route so it cannot remain visible over the assistant page.
    if (nativeView) nativeView.hide()
    uni.navigateTo({
      url: '/pages/ai/index',
      fail() { if (nativeView) nativeView.show() }
    })
    return
  }
  if (target.type !== 'tab' || target.index === nativeState.activeIndex) return
  const item = nativeState.items[target.index]
  if (!item) return
  switching = true
  nativeState.activeIndex = target.index
  redraw()
  nativeStateSignature = stateSignature(nativeState)
  try { if (typeof uni.$emit === 'function') uni.$emit('mci:tab-route', item.pagePath) } catch (error) {}
  uni.switchTab({
    url: `/${item.pagePath}`,
    fail() { redraw(); uni.showToast({ title: '页面切换失败，请重试', icon: 'none' }) },
    complete() { switching = false }
  })
}

export const setAppNativeDockVisible = (visible) => {
  if (!nativeView) return false
  try {
    if (visible) nativeView.show()
    else nativeView.hide()
    return true
  } catch (error) {
    console.error('[MciNativeDock] failed to update visibility:', error && (error.message || error))
    return false
  }
}

const ensureNativeView = (layout) => {
  if (nativeView) return nativeView
  const stale = plus.nativeObj.View.getViewById(NATIVE_DOCK_ID)
  if (stale) stale.close()
  nativeView = new plus.nativeObj.View(NATIVE_DOCK_ID, {
    left: '0px', top: `${layout.top}px`, width: '100%', height: `${layout.height}px`, backgroundColor: '#F1F6FB'
  })
  nativeView.addEventListener('click', handleNativeClick, false)
  return nativeView
}

export const syncAppNativeDock = (options = {}) => {
  if (typeof plus === 'undefined' || !plus.nativeObj || !plus.nativeObj.View) return false
  try {
    if (options.visible === false) {
      if (nativeView) nativeView.hide()
      return true
    }
    const items = Array.isArray(options.items) ? options.items.slice(0, 4) : []
    if (!items.length) return false
    const aiEnabled = options.aiResolved === true
      ? options.aiEnabled === true
      : (nativeState ? nativeState.aiEnabled : options.aiEnabled === true)
    const nextState = {
      items,
      activeIndex: Math.max(0, numberOr(options.activeIndex, 0)),
      aiEnabled,
      safeBottom: options.safeBottom,
      windowWidth: options.windowWidth,
      windowHeight: options.windowHeight,
      primaryColor: options.primaryColor || '#2563EB',
      layout: null
    }
    const nextStateSignature = stateSignature(nextState)
    const nextStructureSignature = structureSignature(nextState)
    if (nativeView && nativeStateSignature === nextStateSignature) {
      nativeView.show()
      return true
    }
    if (nativeView && nativeStructureSignature && nativeStructureSignature !== nextStructureSignature) {
      nativeView.close()
      nativeView = null
    }
    nativeState = nextState
    const layout = buildNativeDockLayout(nativeState.windowWidth, nativeState.safeBottom, nativeState.aiEnabled, items.length, nativeState.windowHeight)
    ensureNativeView(layout)
    redraw()
    nativeStateSignature = nextStateSignature
    nativeStructureSignature = nextStructureSignature
    nativeView.show()
    return true
  } catch (error) {
    console.error('[MciNativeDock] native dock unavailable:', error && (error.message || error))
    return false
  }
}
