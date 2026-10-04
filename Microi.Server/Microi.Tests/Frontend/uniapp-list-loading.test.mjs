// 纳入 Full 的自动发现入口；真实小程序截图另由专项验收执行。
import test from 'node:test'
import { registerListLoadingTests } from '../../../microi.uniapp/scripts/list-loading.test.mjs'

registerListLoadingTests(test)
