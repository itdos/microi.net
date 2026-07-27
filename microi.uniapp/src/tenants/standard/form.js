export function createState() {
  return {}
}

export async function initialize() {}

export function getPresentation() {
  return {}
}

export async function runPresentationAction() {}

export function getFieldPresentation() {
  return {}
}

export function getFieldActions() {
  return []
}

export async function runFieldAction() {}

export async function handleFieldSelect() {}

export async function handleFieldChange() {}

export async function beforeSubmit() {
  return {}
}

export async function afterSubmit() {}

export function getBusyMessage() {
  return ''
}

export function dispose() {}

export default {
  createState,
  initialize,
  getPresentation,
  runPresentationAction,
  getFieldPresentation,
  getFieldActions,
  runFieldAction,
  handleFieldChange,
  handleFieldSelect,
  beforeSubmit,
  afterSubmit,
  getBusyMessage,
  dispose
}
