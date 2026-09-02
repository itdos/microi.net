import { post } from '@/utils/request.js'

const PUBLIC_ENGINE = '/apiengine/xjy-complaint-public'
const USER_ENGINE = '/apiengine/xjy-complaint-user'

async function invoke(url, data, auth) {
  const result = await post(url, data, auth)
  if (!result || Number(result.Code) !== 1) {
    const error = new Error((result && result.Msg) || '投诉举报服务暂不可用')
    error.code = Number(result && result.Code || 0)
    throw error
  }
  return result
}

export function getComplaintBootstrap(auth = false) {
  return invoke(auth ? USER_ENGINE : PUBLIC_ENGINE, { Action: 'Bootstrap' }, auth)
}

export function submitComplaint(data) {
  return invoke(USER_ENGINE, { Action: 'Submit', ...data }, true)
}

export function getMyComplaints(params = {}) {
  return invoke(USER_ENGINE, { Action: 'MyList', ...params }, true)
}

export function getMyComplaintDetail(id) {
  return invoke(USER_ENGINE, { Action: 'Detail', Id: id }, true)
}

export function runComplaintAction(action, id, data = {}) {
  return invoke(USER_ENGINE, { Action: action, Id: id, ...data }, true)
}

export function getPublicComplaints(params = {}) {
  return invoke(PUBLIC_ENGINE, { Action: 'List', ...params }, false)
}

export function getPublicComplaintDetail(id) {
  return invoke(PUBLIC_ENGINE, { Action: 'Detail', Id: id }, false)
}
