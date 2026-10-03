import provinceData from '@province-city-china/province'
import cityData from '@province-city-china/city'
import areaData from '@province-city-china/area'
import {
  REGION_ALL_VALUE,
  normalizeRegionSelection
} from './region-value.mjs'

const ALL_OPTION = Object.freeze({ code: '*', name: REGION_ALL_VALUE })
const DIRECT_MUNICIPALITY_CODES = new Set(['11', '12', '31', '50'])
const PROVINCES = normalizeRows(provinceData)
const CITIES_BY_PROVINCE = groupRows(cityData, (item) => item.province || item.code.slice(0, 2))
const AREAS_BY_PROVINCE = groupRows(areaData, (item) => item.province || item.code.slice(0, 2))
const AREAS_BY_CITY = groupRows(areaData, (item) => `${item.province || item.code.slice(0, 2)}${item.city || item.code.slice(2, 4)}`)

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    ...item,
    code: String(item && item.code || ''),
    name: String(item && item.name || '').trim()
  })).filter((item) => item.code && item.name)
}

function groupRows(rows, keyOf) {
  return normalizeRows(rows).reduce((result, item) => {
    const key = String(keyOf(item) || '')
    if (!result[key]) result[key] = []
    result[key].push(item)
    return result
  }, Object.create(null))
}

function safeIndex(value, rows) {
  const index = Number(value)
  return Number.isInteger(index) && index >= 0 && index < rows.length ? index : 0
}

function indexByName(rows, name) {
  const value = String(name || '').trim()
  const index = rows.findIndex((item) => item.name === value)
  return index >= 0 ? index : 0
}

function citiesFor(province) {
  const key = String(province && (province.province || province.code.slice(0, 2)) || '')
  const rows = CITIES_BY_PROVINCE[key] || []
  if (!rows.length && DIRECT_MUNICIPALITY_CODES.has(key)) {
    return [ALL_OPTION, { code: `${key}0000`, name: province.name, province: key, direct: true }]
  }
  return [ALL_OPTION, ...rows]
}

function areasFor(city) {
  if (!city || city.name === REGION_ALL_VALUE) return [ALL_OPTION]
  if (city.direct) return [ALL_OPTION, ...(AREAS_BY_PROVINCE[city.province] || [])]
  return [ALL_OPTION, ...(AREAS_BY_CITY[city.code.slice(0, 4)] || [])]
}

export function createRegionPickerState(value = []) {
  const [provinceName, cityName, districtName] = normalizeRegionSelection(value)
  const provinceIndex = indexByName(PROVINCES, provinceName)
  const province = PROVINCES[provinceIndex]
  const cities = citiesFor(province)
  const cityIndex = indexByName(cities, cityName)
  const areas = areasFor(cities[cityIndex])
  const districtIndex = indexByName(areas, districtName)
  return {
    columns: [PROVINCES, cities, areas],
    indexes: [provinceIndex, cityIndex, districtIndex]
  }
}

export function updateRegionPickerState(state, column, value) {
  const current = state && Array.isArray(state.indexes) ? state.indexes : [0, 0, 0]
  let [provinceIndex, cityIndex, districtIndex] = current
  const changedColumn = Number(column)

  if (changedColumn === 0) {
    provinceIndex = safeIndex(value, PROVINCES)
    cityIndex = 0
    districtIndex = 0
  } else {
    provinceIndex = safeIndex(provinceIndex, PROVINCES)
    const cities = citiesFor(PROVINCES[provinceIndex])
    if (changedColumn === 1) {
      cityIndex = safeIndex(value, cities)
      districtIndex = 0
    } else {
      cityIndex = safeIndex(cityIndex, cities)
      const areas = areasFor(cities[cityIndex])
      districtIndex = safeIndex(value, areas)
    }
  }

  const province = PROVINCES[provinceIndex]
  const cities = citiesFor(province)
  cityIndex = safeIndex(cityIndex, cities)
  const areas = areasFor(cities[cityIndex])
  districtIndex = safeIndex(districtIndex, areas)
  return {
    columns: [PROVINCES, cities, areas],
    indexes: [provinceIndex, cityIndex, districtIndex]
  }
}

export function regionPickerSelection(state, indexes = null) {
  const next = Array.isArray(indexes)
    ? updateRegionPickerState({ ...state, indexes }, 2, indexes[2])
    : state
  const columns = next && Array.isArray(next.columns) ? next.columns : [[], [], []]
  const values = next && Array.isArray(next.indexes) ? next.indexes : [0, 0, 0]
  return columns.map((rows, index) => rows[safeIndex(values[index], rows)]?.name || '').filter(Boolean)
}

export default {
  createRegionPickerState,
  updateRegionPickerState,
  regionPickerSelection
}
