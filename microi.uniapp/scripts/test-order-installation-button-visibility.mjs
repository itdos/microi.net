import assert from 'node:assert/strict'
import test from 'node:test'
import { installationPositionButtonVisible } from '../src/tenants/xjy/order-installation-button-visibility.mjs'

const button = (code) => [{
  Id: '01KTX8VBDZYGFM318N3V9KX0BK',
  Name: '选择位置',
  V8CodeShow: code
}]

test('follows the platform false and true visibility settings', () => {
  assert.equal(installationPositionButtonVisible(JSON.stringify(button('// V8.Result = true ;\r\nV8.Result = false ;'))), false)
  assert.equal(installationPositionButtonVisible(button('V8.Result = true ;')), true)
})

test('keeps an unavailable or unsupported platform button hidden', () => {
  assert.equal(installationPositionButtonVisible('[]'), false)
  assert.equal(installationPositionButtonVisible(button('V8.Result = V8.Form.Enabled')), false)
  assert.equal(installationPositionButtonVisible('{broken'), false)
})
