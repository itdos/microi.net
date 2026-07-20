import { DiyCommon } from '@/utils/microi.net.import'
import JSEncrypt from 'jsencrypt'
import config from '@/config.json'

const API_BASE = '/api/HDFS'
const API_ENGINE_RUN = '/api/ApiEngine/Run'
const DEFAULT_LOGIN_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`

const normalizeApiBase = (apiBase = '') => String(apiBase || '').replace(/\/+$/, '')

const isEnabledFlag = (value) => {
  if (value === true || value === 1) return true
  if (typeof value !== 'string') return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const responseJson = async (response, fallbackMessage) => {
  let result = null
  try {
    result = await response.json()
  } catch (error) {
    throw new Error(fallbackMessage)
  }
  if (!response.ok) {
    throw new Error(result?.Msg || fallbackMessage)
  }
  return result
}

const arrayBufferToDataUrl = (buffer, contentType = 'image/png') => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return `data:${contentType};base64,${btoa(binary)}`
}

const getBucketScope = (limit = true) => limit ? 'private' : 'public'

const getMinioConnection = (platform = {}) => ({
  Endpoint: platform.endpoint || '',
  AccessKey: platform.accessKey || '',
  SecretKey: platform.secretKey || '',
  Region: platform.region || '',
  PrivateBucketName: platform.privateBucket || '',
  PublicBucketName: platform.publicBucket || '',
  RootPath: platform.rootPath || ''
})

const getUploadHeaders = () => ({
  authorization: 'Bearer ' + DiyCommon.Authorization()
})

const encryptPassword = (password) => {
  const publicKey = config && config.LoginRsaPublicKey === false
    ? ''
    : (config && config.LoginRsaPublicKey) || window.MicroiLoginPublicKey || DEFAULT_LOGIN_RSA_PUBLIC_KEY
  if (!publicKey || !String(publicKey).trim()) return password
  const encrypt = new JSEncrypt()
  encrypt.setPublicKey(publicKey)
  return encrypt.encrypt(password)
}

const postByDiyCommon = (url, param) => new Promise((resolve, reject) => {
  DiyCommon.Post(
    url,
    param,
    (result, headers) => resolve({ result, headers }),
    (error) => reject(error)
  )
})

const uploadByXhr = ({ url, files, path, limit, osClient = '', headers = {}, onProgress }) => new Promise((resolve, reject) => {
  const formData = new FormData()
  formData.append('Path', path || '')
  formData.append('Limit', limit)
  formData.append('Preview', false)
  formData.append('Multiple', true)
  if (osClient) {
    formData.append('OsClient', osClient)
  }

  Array.from(files || []).forEach(file => {
    formData.append('files', file, file.name)
  })

  const xhr = new XMLHttpRequest()
  xhr.open('POST', url, true)
  Object.keys(headers || {}).forEach(key => {
    if (headers[key]) xhr.setRequestHeader(key, headers[key])
  })
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && typeof onProgress === 'function') {
      onProgress(Math.round((event.loaded / event.total) * 100), event)
    }
  }
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== 4) return
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        resolve(JSON.parse(xhr.responseText))
      } catch (e) {
        resolve(xhr.responseText)
      }
    } else {
      reject(new Error(xhr.responseText || `HTTP ${xhr.status}`))
    }
  }
  xhr.onerror = () => reject(new Error('上传请求失败'))
  xhr.send(formData)
})

export const fileSyncApi = {
  getCurrentPlatform() {
    return {
      apiBase: normalizeApiBase(DiyCommon.GetApiBase()),
      osClient: DiyCommon.GetOsClient()
    }
  },

  async runApiEngine(apiEngineKey, param = {}, platform = null) {
    if (!platform || platform.platformType === 'current') {
      return DiyCommon.ApiEngine.Run(apiEngineKey, param)
    }

    const apiBase = normalizeApiBase(platform.apiBase)
    const token = platform.token || platform.authorization || ''
    const headers = {
      'Content-Type': 'application/json',
      OsClient: platform.osClient || '',
      authorization: token && !token.startsWith('Bearer ') ? `Bearer ${token}` : token
    }
    const resp = await fetch(`${apiBase}${API_ENGINE_RUN}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ApiEngineKey: apiEngineKey, ...param })
    })
    return responseJson(resp, `远程接口 ${apiEngineKey} 调用失败`)
  },

  async loginRemote(platform) {
    const apiBase = normalizeApiBase(platform.apiBase)
    const encryptedPwd = encryptPassword(platform.password)
    if (!encryptedPwd) {
      return { result: { Code: 0, Msg: '密码加密失败' }, authorization: '' }
    }
    const loginParam = {
      Account: platform.account,
      Pwd: encryptedPwd,
      OsClient: platform.osClient,
      _ClientType: 'PC'
    }
    if (platform.captchaRequired) {
      loginParam._CaptchaId = platform.captchaId || ''
      loginParam._CaptchaValue = platform.captchaValue || ''
    }

    const resp = await fetch(`${apiBase}/api/SysUser/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        OsClient: platform.osClient || ''
      },
      body: JSON.stringify(loginParam)
    })
    const result = await responseJson(resp, '远程平台登录请求失败')
    const authorization = resp.headers.get('authorization') || result?.DataAppend?.Token || result?.Data?.Token || ''
    return { result, authorization }
  },

  async getRemoteLoginConfig(platform) {
    const apiBase = normalizeApiBase(platform.apiBase)
    const resp = await fetch(`${apiBase}/api/FormEngine/GetSysConfig`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        OsClient: platform.osClient || ''
      },
      body: JSON.stringify({
        _SearchEqual: { IsEnable: 1 },
        OsClient: platform.osClient
      })
    })
    const result = await responseJson(resp, '获取远程登录配置失败')
    if (result.Code !== 1 || !result.Data) {
      throw new Error(result.Msg || '获取远程登录配置失败')
    }
    return {
      sysConfig: result.Data,
      captchaRequired: isEnabledFlag(result.Data.EnableCaptcha)
    }
  },

  async getRemoteCaptcha(platform) {
    const apiBase = normalizeApiBase(platform.apiBase)
    const query = new URLSearchParams({ OsClient: platform.osClient || '' })
    const resp = await fetch(`${apiBase}/api/Captcha/GetCaptcha?${query.toString()}`, {
      method: 'GET',
      headers: { OsClient: platform.osClient || '' },
      cache: 'no-store'
    })
    if (!resp.ok) {
      throw new Error('获取远程登录验证码失败')
    }
    const captchaId = resp.headers.get('captchaid') || ''
    if (!captchaId) {
      throw new Error('远程平台未返回验证码标识')
    }
    return {
      captchaId,
      image: arrayBufferToDataUrl(
        await resp.arrayBuffer(),
        resp.headers.get('content-type') || 'image/png'
      )
    }
  },

  async getFileCabinetCapability(platform) {
    const result = await this.runApiEngine('mci_file_sync_capability', {}, platform)
    if (result?.Code !== 1 || !result.Data) {
      const error = new Error(result?.Msg || '远程平台未返回文件柜同步能力')
      error.code = result?.Code
      error.engineKey = 'mci_file_sync_capability'
      throw error
    }
    return result.Data
  },

  listRemoteConnections() {
    return DiyCommon.ApiEngine.Run('mci_file_remote_connection', { Action: 'list' })
  },

  getRemoteConnection(id) {
    return DiyCommon.ApiEngine.Run('mci_file_remote_connection', { Action: 'get', Id: id })
  },

  saveRemoteConnection(param = {}) {
    return DiyCommon.ApiEngine.Run('mci_file_remote_connection', { Action: 'save', ...param })
  },

  logoutRemoteConnection(id, error = '') {
    return DiyCommon.ApiEngine.Run('mci_file_remote_connection', {
      Action: error ? 'invalidate' : 'logout',
      Id: id,
      Error: error
    })
  },

  deleteRemoteConnection(id) {
    return DiyCommon.ApiEngine.Run('mci_file_remote_connection', { Action: 'delete', Id: id })
  },

  async postHdfs(platform, url, param = {}) {
    if (!platform || platform.platformType === 'current') {
      const { result } = await postByDiyCommon(url, param)
      return result
    }

    const apiBase = normalizeApiBase(platform.apiBase)
    const headers = {
      'Content-Type': 'application/json',
      OsClient: platform.osClient || '',
      authorization: platform.authorization || ''
    }
    const resp = await fetch(`${apiBase}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...param, OsClient: platform.osClient })
    })
    return responseJson(resp, '远程文件系统请求失败')
  },

  async postCurrentHdfs(url, param = {}) {
    const { result } = await postByDiyCommon(url, param)
    return result
  },

  probeMinio(platform, ensureBuckets = false) {
    return this.postCurrentHdfs(`${API_BASE}/ProbeMinio`, {
      Connection: getMinioConnection(platform),
      EnsureBuckets: ensureBuckets
    })
  },

  listObjects(platform, path, limit = true, keyword = '', marker = '', recursive = false) {
    if (platform?.platformType === 'minio') {
      return this.postCurrentHdfs(`${API_BASE}/ListMinioObjects`, {
        Connection: getMinioConnection(platform),
        Path: path || '',
        Limit: limit,
        Keyword: keyword,
        Recursive: recursive,
        MaxKeys: 10000
      })
    }
    return this.postHdfs(platform, `${API_BASE}/ListObjects`, {
      Path: path || '',
      Limit: limit,
      _Keyword: keyword,
      Marker: marker,
      Recursive: recursive
    })
  },

  createFolder(platform, fullPath, limit = true) {
    if (platform?.platformType === 'minio') {
      return this.postCurrentHdfs(`${API_BASE}/CreateMinioFolder`, {
        Connection: getMinioConnection(platform),
        FilePathName: fullPath,
        Limit: limit
      })
    }
    return this.postHdfs(platform, `${API_BASE}/CreateFolder`, {
      FilePathName: fullPath,
      Limit: limit
    })
  },

  moveObject(platform, sourcePath, destPath, limit = true) {
    return this.postHdfs(platform, `${API_BASE}/MoveObject`, {
      FilePathName: sourcePath,
      Path: destPath,
      Limit: limit
    })
  },

  syncMinioObject(param = {}) {
    return this.postCurrentHdfs(`${API_BASE}/SyncMinioObject`, {
      SourcePlatformType: param.sourcePlatform?.platformType || '',
      TargetPlatformType: param.targetPlatform?.platformType || '',
      SourceConnection: param.sourcePlatform?.platformType === 'minio'
        ? getMinioConnection(param.sourcePlatform)
        : null,
      TargetConnection: param.targetPlatform?.platformType === 'minio'
        ? getMinioConnection(param.targetPlatform)
        : null,
      SourcePath: param.sourcePath || '',
      TargetPath: param.targetPath || '',
      SourceLimit: param.sourceLimit !== false,
      TargetLimit: param.targetLimit !== false,
      SyncRule: param.syncRule || 'ignore'
    })
  },

  getPrivateFileUrl(platform, filePathName, limit = true) {
    return this.postHdfs(platform, `${API_BASE}/GetPrivateFileUrl`, {
      FilePathName: filePathName,
      Limit: limit
    })
  },

  uploadFiles(platform, files, path, limit = true, onProgress) {
    const apiBase = platform?.platformType === 'remote'
      ? normalizeApiBase(platform.apiBase)
      : normalizeApiBase(DiyCommon.GetApiBase())
    const headers = platform?.platformType === 'remote'
      ? { authorization: platform.authorization || '', OsClient: platform.osClient || '' }
      : getUploadHeaders()

    return uploadByXhr({
      url: `${apiBase}${API_BASE}/FileManageUpload`,
      files,
      path,
      limit,
      osClient: platform?.platformType === 'remote' ? platform.osClient : '',
      headers,
      onProgress
    })
  }
}

/**
 * 文件管理 API
 */
export const fileManageApi = {
  /**
   * 列出指定路径下的文件和文件夹
   * @param {string} path - 前缀路径（如 "osclient/upload/"）
   * @param {boolean} limit - 是否私有桶
   * @param {string} keyword - 搜索关键字
   */
  listObjects(path, limit = true, keyword = '') {
    return new Promise((resolve, reject) => {
      DiyCommon.Post(
        `${API_BASE}/ListObjects`,
        { Path: path || '', Limit: limit, _Keyword: keyword },
        (result) => resolve(result),
        (error) => reject(error)
      )
    })
  },

  /**
   * 创建文件夹
   * @param {string} fullPath - 文件夹完整路径
   * @param {boolean} limit - 是否私有桶
   */
  createFolder(fullPath, limit = true) {
    return new Promise((resolve, reject) => {
      DiyCommon.Post(
        `${API_BASE}/CreateFolder`,
        { FilePathName: fullPath, Limit: limit },
        (result) => resolve(result),
        (error) => reject(error)
      )
    })
  },

  /**
   * 删除文件或文件夹
   * @param {string} fullPath - 文件完整路径（文件夹需以"/"结尾）
   * @param {boolean} limit - 是否私有桶
   */
  deleteObject(fullPath, limit = true) {
    return new Promise((resolve, reject) => {
      DiyCommon.Post(
        `${API_BASE}/DeleteObject`,
        { FilePathName: fullPath, Limit: limit },
        (result) => resolve(result),
        (error) => reject(error)
      )
    })
  },

  /**
   * 重命名文件或文件夹
   * @param {string} oldPath - 原路径
   * @param {string} newPath - 新路径
   * @param {boolean} limit - 是否私有桶
   */
  renameObject(oldPath, newPath, limit = true) {
    return new Promise((resolve, reject) => {
      DiyCommon.Post(
        `${API_BASE}/RenameObject`,
        { FilePathName: oldPath, Path: newPath, Limit: limit },
        (result) => resolve(result),
        (error) => reject(error)
      )
    })
  },

  /**
   * 移动文件
   * @param {string} sourcePath - 原路径
   * @param {string} destPath - 目标路径
   * @param {boolean} limit - 是否私有桶
   */
  moveObject(sourcePath, destPath, limit = true) {
    return new Promise((resolve, reject) => {
      DiyCommon.Post(
        `${API_BASE}/MoveObject`,
        { FilePathName: sourcePath, Path: destPath, Limit: limit },
        (result) => resolve(result),
        (error) => reject(error)
      )
    })
  },

  /**
   * 获取私有文件临时访问URL
   * @param {string} filePathName - 文件路径
   * @param {boolean} limit - 是否私有桶（默认true）
   */
  getPrivateFileUrl(filePathName, limit = true) {
    return new Promise((resolve, reject) => {
      DiyCommon.Post(
        `${API_BASE}/GetPrivateFileUrl`,
        { FilePathName: filePathName, Limit: limit },
        (result) => resolve(result),
        (error) => reject(error)
      )
    })
  },

  /**
   * 获取上传地址
   */
  getUploadUrl() {
    return DiyCommon.GetApiBase() + `${API_BASE}/FileManageUpload`
  },

  getUploadHeaders,

  uploadFiles(files, path, limit = true, onProgress) {
    return uploadByXhr({
      url: this.getUploadUrl(),
      files,
      path,
      limit,
      headers: getUploadHeaders(),
      onProgress
    })
  },

  runEngine(apiEngineKey, param = {}) {
    return DiyCommon.ApiEngine.Run(apiEngineKey, param)
  },

  trashQuery({ path = '', paths = [], limit = true, pageSize = 1000 } = {}) {
    return this.runEngine('mci_file_trash_query', {
      Prefix: path,
      Paths: paths,
      Limit: limit,
      BucketScope: getBucketScope(limit),
      PageSize: pageSize
    })
  },

  trashMark(items, limit = true) {
    return this.runEngine('mci_file_trash_mark', {
      Items: items,
      Limit: limit,
      BucketScope: getBucketScope(limit)
    })
  },

  trashRestore(items, limit = true) {
    return this.runEngine('mci_file_trash_restore', {
      Items: items,
      Limit: limit,
      BucketScope: getBucketScope(limit)
    })
  },

  recordSyncTask(param = {}) {
    return this.runEngine('mci_file_sync_record', param)
  },

  getSyncTasks(param = {}) {
    return DiyCommon.FormEngine.GetTableData('mci_file_sync_task', {
      _PageIndex: 1,
      _PageSize: 20,
      _OrderBy: 'CreateTime',
      _OrderByType: 'DESC',
      ...param
    })
  },

  getSyncItems(taskId, param = {}) {
    return DiyCommon.FormEngine.GetTableData('mci_file_sync_item', {
      _Where: [['TaskId', '=', taskId]],
      _PageIndex: 1,
      _PageSize: 10000,
      _OrderBy: 'CreateTime',
      _OrderByType: 'ASC',
      ...param
    })
  }
}
