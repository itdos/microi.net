// import { getSysConfig } from '@/utils/sysconfig.js'
import { callApiEngine } from '@/platform/business-runtime.js'
import { stripRegionFromAddress } from '@/platform/region-value.mjs'

export { stripRegionFromAddress } from '@/platform/region-value.mjs'

function textValue(value) {
  if (Array.isArray(value)) return value.find(Boolean) || ''
  if (value && typeof value === 'object') {
    return value.formattedAddress || value.formatted_address || value.address ||
      [
        value.province,
        value.city,
        value.district,
        value.street,
        value.streetNum || value.streetNumber
      ].map(textValue).filter(Boolean).join('')
  }
  return value === null || value === undefined ? '' : String(value)
}

function compactRegion(values) {
  const region = values.map(textValue).map((item) => item.trim()).filter(Boolean)
  if (region.length === 2 && /^(北京市|上海市|天津市|重庆市)$/.test(region[0])) {
    region.splice(1, 0, region[0])
  }
  return region.slice(0, 3)
}

export function inferRegionFromAddress(address = '') {
  const value = String(address || '').trim()
  if (!value) return []
  const province = value.match(/^(.+?(?:省|自治区|特别行政区))/)?.[1] ||
    value.match(/^(北京市|上海市|天津市|重庆市)/)?.[1] || ''
  const rest = province ? value.slice(province.length) : value
  const city = rest.match(/^(.+?市)/)?.[1] || (/^(北京市|上海市|天津市|重庆市)$/.test(province) ? province : '')
  const districtRest = city ? rest.slice(city.length) : rest
  const district = districtRest.match(/^(.+?(?:区|县|旗))/)?.[1] || ''
  return compactRegion([province, city, district])
}

export async function reverseGeocode(longitude, latitude, options = {}) {
  const lng = Number(longitude)
  const lat = Number(latitude)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('定位坐标无效')
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) throw new Error('定位坐标超出有效范围')

  const apiEngineKey = String(options.apiEngineKey || '').trim()
  if (!apiEngineKey) throw new Error('未配置地址解析接口引擎')
  const result = await callApiEngine(apiEngineKey, {
    Longitude: lng,
    Latitude: lat
  })
  if (!result || Number(result.Code) !== 1) {
    throw new Error(result?.Data?.ProviderMessage || result?.Msg || '地址解析失败')
  }

  const data = result.Data || {}
  const address = textValue(data.address).trim()
  let region = Array.isArray(data.region) ? compactRegion(data.region) : []
  if (!region.length) {
    region = compactRegion([
      data.province,
      data.city || data.province,
      data.district
    ])
  }
  if (!address) throw new Error('地址解析接口未返回有效地址')

  return {
    address,
    region: region.length ? region : inferRegionFromAddress(address),
    longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : lng,
    latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : lat
  }
}

export function normalizeChosenLocation(location = {}, geocode = null) {
  const longitude = Number(location.longitude ?? geocode?.longitude)
  const latitude = Number(location.latitude ?? geocode?.latitude)
  const pickedAddress = [textValue(location.address), textValue(location.name)]
    .map((item) => String(item || '').trim())
    .filter((item, index, values) => item && !values.slice(0, index).some((other) => other.includes(item)))
    .join('')
  const address = String(geocode?.address || pickedAddress || '').trim()
  return {
    address,
    region: geocode?.region?.length ? geocode.region : inferRegionFromAddress(address),
    longitude,
    latitude
  }
}

export default {
  inferRegionFromAddress,
  reverseGeocode,
  normalizeChosenLocation,
  stripRegionFromAddress
}
