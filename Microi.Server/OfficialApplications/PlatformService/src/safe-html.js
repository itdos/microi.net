import DOMPurify from 'dompurify'

const DETAIL_SANITIZE_OPTIONS = Object.freeze({
  USE_PROFILES: { html: true },
  ALLOW_ARIA_ATTR: true,
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'form'],
  FORBID_ATTR: ['style', 'srcdoc', 'formaction']
})

/**
 * 商城详情来自可联邦访问的其它租户，必须先净化再交给 v-html。
 * 保留 class 以支持官方详情排版，但不接受样式、脚本、表单或嵌入页面。
 */
export function sanitizeMarketplaceHtml(value) {
  const sanitized = String(DOMPurify.sanitize(String(value || ''), DETAIL_SANITIZE_OPTIONS))
  if (typeof document === 'undefined') return sanitized

  const template = document.createElement('template')
  template.innerHTML = sanitized
  template.content.querySelectorAll('a[href]').forEach(link => {
    link.target = '_blank'
    link.rel = 'noopener noreferrer nofollow'
  })
  template.content.querySelectorAll('img').forEach(image => {
    image.loading = 'lazy'
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
  })
  return template.innerHTML
}

export function marketplaceHtmlToText(value) {
  const sanitized = sanitizeMarketplaceHtml(value)
  if (typeof document === 'undefined') {
    return sanitized.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const template = document.createElement('template')
  template.innerHTML = sanitized
  return String(template.content.textContent || '').replace(/\s+/g, ' ').trim()
}
