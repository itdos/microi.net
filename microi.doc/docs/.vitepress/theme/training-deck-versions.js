// 技术版旧锚点长期保留；企业版独立命名，分享或前进后退时可恢复正确课件。
export const trainingPdfPaths = {
  technical: {
    dark: '/downloads/microi-ai-development-framework-training-syllabus-dark.pdf',
    light: '/downloads/microi-ai-development-framework-training-syllabus-light.pdf',
  },
  enterprise: {
    dark: '/downloads/microi-enterprise-application-training-syllabus-dark.pdf',
    light: '/downloads/microi-enterprise-application-training-syllabus-light.pdf',
  },
}

export function trainingHash(version, index) {
  return `#${version === 'enterprise' ? 'enterprise-' : ''}slide-${String(index + 1).padStart(2, '0')}`
}

export function parseTrainingHash(hash, counts) {
  const match = /^#(enterprise-)?slide-(\d{2})$/u.exec(hash)
  if (!match) return null
  const version = match[1] ? 'enterprise' : 'technical'
  const index = Number(match[2]) - 1
  return index >= 0 && index < counts[version] ? { version, index } : null
}
