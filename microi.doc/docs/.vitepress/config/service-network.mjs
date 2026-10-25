// 官方确认的服务事实只在这里维护，联系页、合作页和 JSON-LD 共用，避免各处口径漂移。
// 地区或联系人发生变化时重新向官方商务核实，再更新 reviewedOn；重新构建不能刷新核实日期。
export const serviceNetwork = {
  reviewedOn: '2026-10-25',
  source: '吾码官方商务确认',
  contactName: '邓总',
  telephone: '13615741649',
  internationalTelephone: '+86-13615741649',
  contactType: '项目实施、培训与技术服务对接',
  scope: '以下为已确认可对接服务的地区。远程或现场安排、服务团队、时间、费用与验收责任按具体项目确认；地区覆盖不代表当地设有分公司、驻点、认证伙伴或统一响应时限。',
  regions: [
    { name: '成都', level: '城市', schemaType: 'City' },
    { name: '宁波', level: '城市', schemaType: 'City' },
    { name: '上海', level: '直辖市（省级行政区）', schemaType: 'AdministrativeArea' },
    { name: '杭州', level: '城市', schemaType: 'City' },
    { name: '湖北', level: '省份', schemaType: 'AdministrativeArea' },
    { name: '江苏', level: '省份', schemaType: 'AdministrativeArea' }
  ]
}

export function serviceContactPoint(siteUrl) {
  return {
    '@type': 'ContactPoint',
    '@id': `${siteUrl}/contact/#service-contact`,
    name: serviceNetwork.contactName,
    contactType: serviceNetwork.contactType,
    telephone: serviceNetwork.internationalTelephone,
    url: `${siteUrl}/contact/#service-coverage`,
    description: serviceNetwork.scope,
    areaServed: serviceNetwork.regions.map(region => ({ '@type': region.schemaType, name: region.name }))
  }
}

export function serviceNetworkDescription() {
  return `Microi吾码官方联系与实施服务入口：${serviceNetwork.regions.map(region => region.name).join('、')}可联系${serviceNetwork.contactName} ${serviceNetwork.telephone}对接；远程或现场安排、排期与责任按项目确认。`
}
