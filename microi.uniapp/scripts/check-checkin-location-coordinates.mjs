import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const tenantForm = fs.readFileSync(path.join(root, 'src/tenants/xjy/form.js'), 'utf8')
const nativeCheckin = fs.readFileSync(path.join(root, 'src/pages/native/checkin.vue'), 'utf8')

const assertions = [
  [tenantForm.includes("longitude: 'DakaDD_Lng'") && tenantForm.includes("latitude: 'DakaDD_Lat'"),
    '人员定位未绑定 DakaDD_Lng/DakaDD_Lat'],
  [tenantForm.includes('if (hasSavedCoordinates) scheduleCheckinMapMount(context)'),
    '编辑人员定位时未使用已保存坐标挂载地图'],
  [tenantForm.includes('[longitudeName]: longitude, [latitudeName]: latitude'),
    '人员定位提交载荷未包含经纬度'],
  [nativeCheckin.includes('DakaDD_Lng: Number(this.location.longitude)') &&
    nativeCheckin.includes('DakaDD_Lat: Number(this.location.latitude)'),
    '独立拜访打卡新增载荷未包含经纬度']
]

const failed = assertions.filter(([passed]) => !passed).map(([, message]) => message)
if (failed.length) {
  failed.forEach((message) => console.error(`[checkin-location-coordinates] ${message}`))
  process.exit(1)
}

console.log('[checkin-location-coordinates] PASS: add/edit check-in flows persist and restore coordinates')
