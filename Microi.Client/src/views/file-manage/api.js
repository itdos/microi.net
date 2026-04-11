import { DiyCommon } from '@/utils/microi.net.import'

const API_BASE = '/api/HDFS'

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
  }
}
