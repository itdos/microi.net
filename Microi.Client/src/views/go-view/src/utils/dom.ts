const editableSelector = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="textbox"]',
  '.n-input',
  '.n-input-number',
  '.n-input-number-input',
  '.n-input__input',
  '.n-input__input-el',
  '.n-input__textarea',
  '.n-input__textarea-el',
  '.n-base-selection',
  '.n-base-select-menu',
  '.n-select-menu',
  '.n-date-panel',
  '.n-color-picker',
  '.monaco-editor',
  '.cm-editor'
].join(', ')

export const isEditableEventTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  if (!element?.closest) return false

  const editableElement = element.closest(editableSelector) as HTMLElement | null
  if (!editableElement) return false

  if ('disabled' in editableElement && Boolean((editableElement as HTMLInputElement).disabled)) return false
  if (editableElement.getAttribute('aria-disabled') === 'true') return false
  return true
}
