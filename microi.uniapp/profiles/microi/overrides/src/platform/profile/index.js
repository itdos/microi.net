import appConfig from '@/config.js'

export function hasFeature(name) {
  return appConfig.features && appConfig.features[name] === true
}

export function getProfileRoute(name, fallback = '') {
  return (appConfig.routes && appConfig.routes[name]) || fallback
}

export function getBrandText(name, fallback = '') {
  const value = appConfig[name]
  return value === undefined || value === null || value === '' ? fallback : value
}

export const activeProfileId = appConfig.profileId || 'microi'

export default {
  activeProfileId,
  hasFeature,
  getProfileRoute,
  getBrandText
}
