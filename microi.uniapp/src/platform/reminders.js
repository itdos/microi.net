import appConfig from '@/config.js'
import { getUser } from '@/utils/request.js'

function storageKeys() {
  const user = getUser() || {}
  const identity = user.Id || user.Account || 'guest'
  const keys = [`mci:${appConfig.profileId || 'default'}:reminders:${identity}`]
  if (appConfig.profileId === 'xjy') keys.push(`xjy:reminders:${identity}`)
  return keys
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter((item) => item && item.Id) : []
}

export function loadReminders() {
  const keys = storageKeys()
  for (const key of keys) {
    try {
      const list = normalizeList(uni.getStorageSync(key))
      if (list.length) {
        if (key !== keys[0]) uni.setStorageSync(keys[0], list)
        return list
      }
    } catch (error) {}
  }
  return []
}

function persistReminders(list) {
  uni.setStorageSync(storageKeys()[0], list)
}

export function saveReminder(form = {}) {
  const list = loadReminders()
  const now = new Date().toISOString()
  const item = {
    Id: form.Id || `reminder-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    CustomerId: form.CustomerId || '',
    CustomerName: form.CustomerName || '',
    RemindTime: form.RemindTime || '',
    Title: String(form.Title || '').trim(),
    Content: String(form.Content || '').trim(),
    Done: Boolean(form.Done),
    CreateTime: form.CreateTime || now,
    UpdateTime: now
  }
  const index = list.findIndex((row) => row.Id === item.Id)
  if (index >= 0) list.splice(index, 1, item)
  else list.unshift(item)
  persistReminders(list)
  return item
}

export function toggleReminder(id, done) {
  const list = loadReminders()
  const item = list.find((row) => row.Id === id)
  if (!item) return null
  item.Done = Boolean(done)
  item.UpdateTime = new Date().toISOString()
  persistReminders(list)
  return item
}

export function removeReminder(id) {
  persistReminders(loadReminders().filter((row) => row.Id !== id))
}

export default {
  loadReminders,
  saveReminder,
  toggleReminder,
  removeReminder
}
