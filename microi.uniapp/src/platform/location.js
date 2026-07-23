import { getSysConfig } from '@/utils/sysconfig.js'

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

function amapKey(config = {}) {
  return config.AMapKey || config.AmapKey || config.GaodeMapKey || config.MapKey || ''
}

function requestAmapReverseGeocode(key, longitude, latitude) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: 'https://restapi.amap.com/v3/geocode/regeo',
      method: 'GET',
      data: {
        key,
        location: `${longitude},${latitude}`,
        extensions: 'base',
        radius: 1000,
        batch: false,
        roadlevel: 0
      },
      success: (response) => {
        const body = response && response.data ? response.data : {}
        if (String(body.status) !== '1' || !body.regeocode) {
          reject(new Error(body.info || '地址解析失败'))
          return
        }
        resolve(body.regeocode)
      },
      fail: (error) => reject(new Error(error?.errMsg || '地址解析失败'))
    })
  })
}

export async function reverseGeocode(longitude, latitude) {
  const lng = Number(longitude)
  const lat = Number(latitude)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('定位坐标无效')
  const config = await getSysConfig()
  const key = amapKey(config || {})
  if (!key) throw new Error('未配置高德地图 Key')
  const result = await requestAmapReverseGeocode(key, lng, lat)
  const component = result.addressComponent || {}
  const address = textValue(result.formatted_address)
  const region = compactRegion([
    component.province,
    component.city || component.province,
    component.district
  ])
  return {
    address,
    region: region.length ? region : inferRegionFromAddress(address),
    longitude: lng,
    latitude: lat
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
  normalizeChosenLocation
}
