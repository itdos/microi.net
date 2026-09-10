function isEmptyValue(value) {
  return value === undefined || value === null || value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.trim() === '[]')
}

export function leadFollowupDefaultValues({
  mode = '',
  rowId = '',
  form = {},
  currentTime = '',
  currentUser = {},
  timeField = 'GenjinSJ',
  userField = 'GenjinR'
} = {}) {
  if (mode !== 'Add' || rowId) return {}

  const values = {}
  if (isEmptyValue(form[timeField]) && String(currentTime || '').trim()) {
    values[timeField] = String(currentTime).trim()
  }

  const userName = String(currentUser.Name || currentUser.Account || '').trim()
  if (isEmptyValue(form[userField]) && userName) {
    values[userField] = [{
      Id: currentUser.Id || '',
      Name: userName
    }]
  }
  return values
}
