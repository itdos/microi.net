import assert from 'node:assert/strict'
import test from 'node:test'

import {
  checkinDetailFormOptions,
  checkinTimeLabel,
  normalizeCheckinStatistics
} from '../src/platform/checkin-statistics.mjs'

test('兼容 sign_statistics 旧版数字返回', () => {
  assert.deepEqual(normalizeCheckinStatistics({ Code: 1, Data: 2 }), { count: 2, times: [], records: [] })
})

test('解析今日打卡总数和倒序时间列表', () => {
  assert.deepEqual(normalizeCheckinStatistics({
    Code: 1,
    Data: {
      Count: 2,
      Times: ['2026-08-12 14:33:04', '2026-08-12T09:12:08']
    }
  }), {
    count: 2,
    times: ['2026-08-12 14:33:04', '2026-08-12 09:12:08'],
    records: [
      { id: '', time: '2026-08-12 14:33:04' },
      { id: '', time: '2026-08-12 09:12:08' }
    ]
  })
})

test('解析带 Id 的打卡记录并生成只读详情跳转参数', () => {
  const statistics = normalizeCheckinStatistics({
    Count: 1,
    Records: [{ Id: 'checkin-1', Time: '2026-08-12 14:33:04' }]
  })
  assert.deepEqual(statistics.records, [{ id: 'checkin-1', time: '2026-08-12 14:33:04' }])
  assert.deepEqual(checkinDetailFormOptions(statistics.records[0]), {
    table: 'Diy_location',
    rowId: 'checkin-1',
    mode: 'View',
    title: '打卡详情',
    menuAliases: ['打卡记录', '拜访打卡', '打卡'],
    includeRelated: false
  })
})

test('打卡时间在今日面板使用紧凑时分秒展示', () => {
  assert.equal(checkinTimeLabel('2026-08-12 14:33:04'), '14:33:04')
})

test('相同秒内的多次打卡仍逐条展示', () => {
  const statistics = normalizeCheckinStatistics({
    Count: 2,
    Times: ['2026-08-12 14:33:04', '2026-08-12 14:33:04']
  })
  assert.equal(statistics.times.length, 2)
})
