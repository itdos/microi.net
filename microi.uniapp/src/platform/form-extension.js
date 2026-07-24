import tenantForm from '@/generated/tenant-form.js'

const extension = tenantForm && typeof tenantForm === 'object' ? tenantForm : {}

function invoke(name, context, ...args) {
  const handler = extension[name]
  if (typeof handler !== 'function') return undefined
  return handler(context, ...args)
}

export function createTenantFormState(context = {}) {
  return invoke('createState', context) || {}
}

export async function initializeTenantForm(context = {}) {
  return invoke('initialize', context)
}

export function getTenantFormPresentation(context = {}) {
  const presentation = invoke('getPresentation', context)
  return presentation && typeof presentation === 'object' ? presentation : {}
}

export async function runTenantFormPresentationAction(context = {}, action = {}) {
  return invoke('runPresentationAction', context, action)
}

export function getTenantFormFieldPresentation(context = {}, field = {}) {
  const presentation = invoke('getFieldPresentation', context, field)
  return presentation && typeof presentation === 'object' ? presentation : {}
}

export function getTenantFormFieldActions(context = {}, field = {}) {
  const actions = invoke('getFieldActions', context, field)
  return Array.isArray(actions) ? actions.filter((item) => item && item.key && item.label) : []
}

export async function runTenantFormFieldAction(context = {}, field = {}, action = {}) {
  return invoke('runFieldAction', context, field, action)
}

export async function handleTenantFormFieldSelect(context = {}, payload = {}) {
  return invoke('handleFieldSelect', context, payload)
}

export async function prepareTenantFormSubmit(context = {}) {
  const result = await invoke('beforeSubmit', context)
  return result && typeof result === 'object' ? result : {}
}

export async function notifyTenantFormSaved(context = {}, result = {}) {
  return invoke('afterSubmit', context, result)
}

export function tenantFormBusyMessage(context = {}) {
  const result = invoke('getBusyMessage', context)
  return result ? String(result) : ''
}

export function disposeTenantForm(context = {}) {
  return invoke('dispose', context)
}

export default {
  createTenantFormState,
  initializeTenantForm,
  getTenantFormPresentation,
  runTenantFormPresentationAction,
  getTenantFormFieldPresentation,
  getTenantFormFieldActions,
  runTenantFormFieldAction,
  handleTenantFormFieldSelect,
  prepareTenantFormSubmit,
  notifyTenantFormSaved,
  tenantFormBusyMessage,
  disposeTenantForm
}
