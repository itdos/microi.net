import defaultSettings from '@/settings'

const title = defaultSettings.title || 'microi.services.framework'

export default function getPageTitle(pageTitle) {
  if (pageTitle) {
    return `${pageTitle} - ${title}`
  }
  return `${title}`
}
