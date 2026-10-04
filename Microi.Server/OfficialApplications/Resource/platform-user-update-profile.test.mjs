import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(directory, 'platform-user-update-profile.js'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const runEngine = new AsyncFunction('V8', source)

function createV8(param) {
  let saved = null
  const current = {
    Id: 'user-157',
    Name: '赵157',
    Avatar: '/xjy/avatar/old.png'
  }
  return {
    V8: {
      Param: param,
      CurrentUser: current,
      Method: {
        PrepareCurrentUserProfileUpdate(securityParam) {
          assert.equal(Object.prototype.hasOwnProperty.call(securityParam, 'Avatar'), false)
          return {
            Code: 1,
            Data: {
              UserId: current.Id,
              OsClient: 'xjy',
              HasPublicAvatar: false,
              CurrentProfile: current
            }
          }
        },
        RefreshLoginUser() {
          return { Code: 1, Data: { ...current, ...(saved || {}) } }
        },
        AddSysLog() {}
      },
      ApiEngine: { Run: () => ({ Code: 1 }) },
      FormEngine: {
        UptFormData(tableName, form) {
          assert.equal(tableName, 'sys_user')
          saved = form
          return { Code: 1 }
        }
      }
    },
    saved: () => saved
  }
}

test('当前用户资料 V8 接口只把本租户头像目录写入当前登录用户', async () => {
  const fixture = createV8({
    Id: 'other-user',
    Name: '赵157',
    Avatar: '/xjy/avatar/202609/new.webp'
  })
  const result = await runEngine(fixture.V8)
  assert.equal(result.Code, 1)
  assert.deepEqual(fixture.saved(), {
    Id: 'user-157',
    Avatar: '/xjy/avatar/202609/new.webp'
  })
})

test('当前用户资料 V8 接口拒绝跨租户、URL 和非图片头像路径', async () => {
  const invalidPaths = [
    '/other/avatar/new.png',
    'https://example.test/xjy/avatar/new.png',
    '/xjy/avatar/not-image.txt',
    '/xjy/avatar/../member/new.png'
  ]
  for (const avatar of invalidPaths) {
    const fixture = createV8({ Name: '赵157', Avatar: avatar })
    const result = await runEngine(fixture.V8)
    assert.equal(result.Code, 0, avatar)
    assert.equal(fixture.saved(), null, avatar)
  }
})
