const OFFICE_FILE_TYPES = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'])

export const isOfficeFileType = (type) => OFFICE_FILE_TYPES.has(String(type || '').toLowerCase())

export const isOfficeHistoryPath = (path) => String(path || '').replace(/^\/+/, '').split('/')[1] === '.microi-office-history'

export const createFileCabinetOfficeSession = (file, { limit, sysMenuId }) => {
  if (!file?.filePath || !isOfficeFileType(file.type) || !sysMenuId) {
    throw new Error('文件柜Office会话缺少权威对象或菜单')
  }
  return {
    fileCabinetMode: true,
    fileCabinetPath: file.filePath,
    fileCabinetLimit: limit === true,
    filePathName: file.filePath,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    isPrivate: limit === true,
    canEdit: true,
    enableOfficeVersion: true,
    sysMenuId
  }
}

// OnlyOffice uses the key as its collaboration-room identity. It must be stable
// across browsers for the same persisted version and change after a save.
export const createOfficeDocumentKey = ({ tenant, bucket, path, version, updatedAt }) => {
  const raw = `${tenant || ''}|${bucket || ''}|${path || ''}|${version || ''}|${updatedAt || ''}`
  let hash = 2166136261
  let secondary = 5381
  for (let index = 0; index < raw.length; index++) {
    hash = Math.imul(hash ^ raw.charCodeAt(index), 16777619) >>> 0
    secondary = ((secondary << 5) + secondary + raw.charCodeAt(index)) >>> 0
  }
  return `document-${hash.toString(16)}-${secondary.toString(16)}`
}
