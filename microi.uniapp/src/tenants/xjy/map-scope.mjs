// 行政区查询与附近查询互斥，避免远处城市再次被手机当前位置的半径截掉。
export const MAP_RADIUS_OPTIONS = Object.freeze([1, 3, 5, 10, 15, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 6000])

export function mapRegionNames(region = []) {
  const names = []
  for (const value of region.slice(0, 3)) {
    const name = String(value || '').trim()
    if (!name || name === '全部') break
    names.push(name)
  }
  return names
}

export function mapRegionWhere(region, field = 'Chengshi') {
  return mapRegionNames(region).map(Value => ({ Name: field, Type: 'Like', Value }))
}

export function mapRegionLabel(region = []) {
  const names = mapRegionNames(region)
  return names.length ? names.join(' / ') : (region.length ? '全国' : '选择省市区')
}
