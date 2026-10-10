import { trainingDownloads } from './training-downloads.js'

function downloadPath(filename) {
  const asset = trainingDownloads.find(row => row.legacyPath === `/downloads/${filename}`)
  if (!asset) throw new Error(`培训下载清单缺少文件：${filename}`)
  return asset.url
}

// 下载链接只引用已验签的官方 CDN；课件锚点继续保持原有版本和页码语义。
export const trainingPdfPaths = {
  technical: {
    dark: downloadPath('microi-ai-development-framework-training-syllabus-dark.pdf'),
    light: downloadPath('microi-ai-development-framework-training-syllabus-light.pdf'),
  },
  enterprise: {
    dark: downloadPath('microi-enterprise-application-training-syllabus-dark.pdf'),
    light: downloadPath('microi-enterprise-application-training-syllabus-light.pdf'),
  },
}

const trainingPptxPaths = {
  technical: {
    dark: downloadPath('microi-ai-development-framework-training-syllabus-dark.pptx'),
    light: downloadPath('microi-ai-development-framework-training-syllabus-light.pptx'),
  },
  enterprise: {
    dark: downloadPath('microi-enterprise-application-training-syllabus-dark.pptx'),
    light: downloadPath('microi-enterprise-application-training-syllabus-light.pptx'),
  },
}

// PDF/PPTX 上传后各有独立内容指纹目录，不能从 PDF 后缀推导；未知版本仍回退到技术版。
export function trainingPptxPath(version, isDark) {
  const edition = version === 'enterprise' ? 'enterprise' : 'technical'
  return trainingPptxPaths[edition][isDark ? 'dark' : 'light']
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
