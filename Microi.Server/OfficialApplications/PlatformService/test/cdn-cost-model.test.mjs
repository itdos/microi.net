import test from 'node:test'
import assert from 'node:assert/strict'
import {usageSummary} from '../src/cdn-model.js'
test('计费用量按返回的真实间隔求字节和，不积分带宽',()=>{const result=usageSummary({Unit:'bytes',DataInterval:3600,RequestedInterval:300,UsageDataPerInterval:{DataModule:[{TimeStamp:'2026-10-01T00:00:00Z',Value:'1024'},{TimeStamp:'2026-10-01T01:00:00Z',Value:2048}]}});assert.deepEqual(result,{total:3072,points:2,interval:3600});assert.throws(()=>usageSummary({Unit:'bps',BpsDataPerInterval:{DataModule:[{Value:999999999}]}}));assert.throws(()=>usageSummary({Unit:'bytes',DataInterval:900,UsageDataPerInterval:{DataModule:[]}}))})
test('重复采样和非法流量不能展示成可信总量',()=>{const row={TimeStamp:'2026-10-01T00:00:00Z',Value:100};assert.throws(()=>usageSummary({Unit:'bytes',DataInterval:300,UsageDataPerInterval:{DataModule:[row,row]}}));assert.throws(()=>usageSummary({Unit:'bytes',DataInterval:300,UsageDataPerInterval:{DataModule:[{...row,Value:-1}]}}))})
