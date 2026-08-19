import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const detailSource = fs.readFileSync(new URL('../src/pages/task/device.vue', import.meta.url), 'utf8')
const listSource = fs.readFileSync(new URL('../src/pages/task/devices.vue', import.meta.url), 'utf8')
const mapSource = fs.readFileSync(new URL('../src/pages/task/map.vue', import.meta.url), 'utf8')
const taskSource = fs.readFileSync(new URL('../src/utils/xjy-task.js', import.meta.url), 'utf8')
const tenantFormSource = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
const saveTaskDeviceSource = taskSource.slice(
  taskSource.indexOf('export async function saveTaskDevice'),
  taskSource.indexOf('export async function addTaskDevices')
)
const pageConfigs = [
  JSON.parse(fs.readFileSync(new URL('../src/pages.json', import.meta.url), 'utf8')),
  JSON.parse(fs.readFileSync(new URL('../profiles/xjy/pages.json', import.meta.url), 'utf8'))
]

test('任务设备处理结果允许为空提交', () => {
  assert.match(detailSource, /<text>处理结果<\/text><text class="section-heading__hint">选填<\/text>/)
  assert.doesNotMatch(detailSource, /section-heading__required[^>]*>必填/)
  assert.doesNotMatch(detailSource, /请填写处理结果/)
  assert.doesNotMatch(detailSource, /!this\.form\.ChuliJG\.trim\(\)/)
  assert.match(detailSource, /await saveTaskDevice\(this\.id, this\.taskType, \{[\s\S]*\.\.\.this\.form,[\s\S]*_LocationUpdated: this\.locationUpdated[\s\S]*\}, this\.device\)/)
})

test('任务设备列表可按名称型号编号和安装位置检索', () => {
  assert.match(listSource, /placeholder="搜索设备名称、型号、编号、安装位置"/)
  assert.match(listSource, /loadTaskDevicesPage\(this\.taskId, \{[^}]*keyword: this\.keyword/s)
  assert.match(taskSource, /const keyword = String\(options\.keyword \|\| ''\)\.trim\(\)/)
  for (const field of ['ShebeiMC', 'ShangpinMC', 'ShebeiXH', 'ShangpinXH', 'ShebeiBH', 'AnzhuangWZ']) {
    assert.match(taskSource, new RegExp(`Name: '${field}', Type: 'Like', Value: keyword`))
  }
  assert.match(taskSource, /GroupStart: true/)
  assert.match(taskSource, /GroupEnd: true/)
})

test('任务设备列表在默认配置和 xjy Profile 中均已注册', () => {
  for (const config of pageConfigs) {
    const taskPackage = config.subPackages.find((item) => item.root === 'pages/task')
    assert.ok(taskPackage)
    assert.ok(taskPackage.pages.some((item) => item.path === 'devices'))
  }
})

test('安装位置在卡片展示并随设备表单提交', () => {
  assert.match(listSource, /安装位置：\{\{ device\.position \|\| '暂未维护' \}\}/)
  assert.match(detailSource, /const FORM_FIELDS = \[[^\]]*'AnzhuangWZ'/)
  assert.match(detailSource, /v-model\.trim="form\.AnzhuangWZ"/)
  assert.match(detailSource, /form\.AnzhuangWZ \|\| '暂未维护安装位置'/)
  assert.match(taskSource, /const payload = \{ Id: id, \.\.\.taskValues,/)
})

test('任务设备现场定位同步客户设备坐标且不向售后子表提交未知字段', () => {
  assert.match(detailSource, /@tap="locateDevice"/)
  assert.match(detailSource, /locating \? '定位中…' : '现场定位'/)
  assert.match(detailSource, /stripRegionFromAddress\(location\.address, location\.region\)/)
  assert.match(detailSource, /this\.form\.KehuSB_Lat = Number\(location\.latitude\)/)
  assert.match(detailSource, /this\.form\.KehuSB_Lng = Number\(location\.longitude\)/)
  assert.match(saveTaskDeviceSource, /KehuSB_Lat: latitude,[\s\S]*KehuSB_Lng: longitude,[\s\S]*_LocationUpdated: locationUpdated,[\s\S]*\.\.\.taskValues/)
  assert.match(saveTaskDeviceSource, /V8\.FormEngine\.UptFormData\('Diy_KehuSB', customerDeviceValues\)/)
  assert.match(saveTaskDeviceSource, /Name: 'DingdanSPID'/)
  assert.match(saveTaskDeviceSource, /Name: 'ShangpinBH'/)
  assert.match(saveTaskDeviceSource, /V8\.FormEngine\.GetFormData\('diy_shebeiwz', \{[\s\S]*_Where: installationWhere/)
  assert.match(saveTaskDeviceSource, /AnzhuangWZ: taskValues\.AnzhuangWZ \|\| '',[\s\S]*installationValues\.AnzhuangWZ_Lat = Number\(latitude\)[\s\S]*installationValues\.AnzhuangWZ_Lng = Number\(longitude\)/)
  assert.match(saveTaskDeviceSource, /V8\.FormEngine\.UptFormData\('diy_shebeiwz', installationValues\)/)
  assert.match(saveTaskDeviceSource, /V8\.FormEngine\.UptFormData\('diy_shouhousp', payload\)/)
  assert.doesNotMatch(saveTaskDeviceSource, /const payload = \{ Id: id, \.\.\.values/)
})

test('任务设备坐标按客户设备优先、客户默认位置兜底', () => {
  assert.match(taskSource, /_SelectFields: \['Id', 'KehuID', 'DingdanSPID', 'ShebeiBH', 'AnzhuangWZ', 'KehuSB_Lat', 'KehuSB_Lng'\]/)
  assert.match(taskSource, /DingdanSPID: taskDevice\.DingdanSPID \|\| \(customerDevice && customerDevice\.DingdanSPID\) \|\| ''/)
  assert.match(taskSource, /customerDevice && validCoordinatePair\(customerDevice\.KehuSB_Lat, customerDevice\.KehuSB_Lng\)/)
  assert.match(taskSource, /customer\.KehuDT_Lat/)
  assert.match(taskSource, /customer\.KehuDT_Lng/)
  assert.match(mapSource, /withCustomerCoordinateDefaults\(rows\)/)
  assert.match(mapSource, /_SelectFields: \['Id', 'KehuDT_Lat', 'KehuDT_Lng'\]/)
  assert.match(mapSource, /CoordinateSource: 'customer-default'/)
})

test('任务设备地图通过任务专用接口加载坐标', () => {
  const loadTaskDevicesSource = mapSource.slice(
    mapSource.indexOf('async loadTaskDevices()'),
    mapSource.indexOf('async loadTaskMap()')
  )
  assert.match(loadTaskDevicesSource, /callApiEngine\('get_location_shebei-v2', \{ TaskId: this\.taskId \}\)/)
  assert.match(loadTaskDevicesSource, /equipmentByTaskDeviceId\.get\(String\(taskDevice\.Id\)\)/)
  assert.doesNotMatch(loadTaskDevicesSource, /GetTableData\('Diy_KehuSB'/)
})

test('任务设备地图使用红色未完成与蓝色已完成定位样式', () => {
  assert.match(mapSource, /marker\.iconPath = complete \? '\/static\/xjy\/business\/dw\.png' : '\/static\/xjy\/business\/dwRed\.png'/)
  assert.match(mapSource, /bgColor: complete \? '#0091eb' : '#e5484d'/)
  assert.match(mapSource, /\.status-dot\.unfinished \{ background: #e5484d; \}/)
  assert.match(mapSource, /\.status-dot\.complete \{ background: #0091eb; \}/)
  const redMarker = fs.statSync(new URL('../src/static/xjy/business/dwRed.png', import.meta.url))
  assert.ok(redMarker.size > 0)
})

test('订单安装位置表单提供定位按钮并显式提交隐藏坐标', () => {
  assert.match(tenantFormSource, /key: 'xjy-installation-position-location'/)
  assert.match(tenantFormSource, /label: context\.state\.locating \? '定位中…' : '现场定位'/)
  assert.match(tenantFormSource, /iconType: 'location'/)
  assert.match(tenantFormSource, /position: 'label'/)
  assert.match(tenantFormSource, /await locateInstallationPosition\(context\)/)
  assert.match(tenantFormSource, /installationPositionCustomer\(context\)/)
  assert.match(tenantFormSource, /KehuDT_Lat/)
  assert.match(tenantFormSource, /stripRegionFromAddress\(location\.address, location\.region\)/)
  assert.match(tenantFormSource, /installationLocationValues/)
})

test('设备处理分区默认展开且支持折叠', () => {
  for (const section of ['result', 'resultPhotos', 'installPhotos', 'scene', 'equipment']) {
    assert.match(detailSource, new RegExp(`${section}: true`))
    assert.match(detailSource, new RegExp(`v-show="sectionOpen\\.${section}"`))
    assert.match(detailSource, new RegExp(`toggleSection\\('${section}'\\)`))
  }
  assert.match(detailSource, /toggleSection\(name\) \{ this\.sectionOpen\[name\] = !this\.sectionOpen\[name\] \}/)
})
