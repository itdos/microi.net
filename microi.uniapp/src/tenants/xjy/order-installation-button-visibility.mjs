const INSTALLATION_POSITION_BUTTON_ID = '01KTX8VBDZYGFM318N3V9KX0BK'

export function installationPositionButtonVisible(pageButtons) {
  let buttons = pageButtons
  if (typeof buttons === 'string') {
    try { buttons = JSON.parse(buttons) } catch { return false }
  }
  if (!Array.isArray(buttons)) return false
  const button = buttons.find((item) => String(item?.Id || '') === INSTALLATION_POSITION_BUTTON_ID)
  if (!button || button.IsVisible === false || button.IsVisible === 0 || button.IsVisible === '0') return false

  // The mini program cannot execute PC front-end V8. Only accept the platform's
  // explicit boolean visibility setting; unknown scripts stay hidden.
  const code = String(button.V8CodeShow || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\r\n]*/g, '')
    .trim()
  if (!code) return true
  const match = /^V8\.Result\s*=\s*(true|false)\s*;?$/i.exec(code)
  return match ? match[1].toLowerCase() === 'true' : false
}
