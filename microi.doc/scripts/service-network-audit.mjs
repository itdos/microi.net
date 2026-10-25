import { serviceNetwork, serviceContactPoint } from '../docs/.vitepress/config/service-network.mjs'
import { SITE_URL } from '../docs/.vitepress/config/seo-policy.mjs'
import { decodeHtml } from './seo-discovery.mjs'

// 审计构建后的 SSR HTML，避免“源码有数据”被误报成搜索引擎实际可读。
export function auditServiceNetworkHtml(html, { structured = false } = {}) {
  const failures = []
  const section = html.match(/<section\b[^>]*data-mci-public-fact="service-network"[^>]*>[\s\S]*?<\/section>/)?.[0] || ''
  const text = decodeHtml(section.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ')
  if (!section) return ['服务地区缺少 SSR 正文']
  if (!section.includes(`data-reviewed-on="${serviceNetwork.reviewedOn}"`)) failures.push('核实日期与公开事实源不一致')
  for (const value of [serviceNetwork.contactName, serviceNetwork.telephone, serviceNetwork.source, serviceNetwork.scope]) {
    if (!text.includes(value)) failures.push(`可见服务说明缺少事实源字段：${value}`)
  }
  if (!section.includes(`href="tel:${serviceNetwork.telephone}"`)) failures.push('缺少统一电话联系入口')
  const rows = [...(section.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0] || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(([, row]) => [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => decodeHtml(cell.replace(/<[^>]*>/g, ''))))
  const expectedRows = serviceNetwork.regions.map(region => [region.name, region.level])
  if (JSON.stringify(rows) !== JSON.stringify(expectedRows)) failures.push('SSR 地区表与已确认的六地区或行政区划口径不一致')
  if (structured) {
    try {
      const graph = JSON.parse(html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || '')['@graph']
      const page = graph.find(item => item['@type'] === 'ContactPage')
      if (page?.url !== `${SITE_URL}/contact/`) failures.push('联系页结构化身份不正确')
      const organization = graph.find(item => item['@id'] === `${SITE_URL}/#organization` && item['@type'] === 'Organization')
      if (JSON.stringify(organization?.contactPoint) !== JSON.stringify(serviceContactPoint(SITE_URL))) failures.push('ContactPoint 与可见服务事实不一致')
      if (organization?.address || organization?.branchOf || graph.some(item => item['@type'] === 'LocalBusiness')) failures.push('服务覆盖不能被标注为未确认的实体办公地点')
    } catch { failures.push('服务结构化数据不可解析') }
  }
  return failures
}
