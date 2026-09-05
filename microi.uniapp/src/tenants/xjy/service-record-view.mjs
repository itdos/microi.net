function toArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  if (typeof value === 'string') {
    try {
      return toArray(JSON.parse(value))
    } catch (error) {
      return []
    }
  }
  return typeof value === 'object' ? [value] : []
}

export function normalizeServiceRecordSnapshots(value) {
  // 兼容历史记录中 JSON 字符串/数组混存，并保留原始照片值供私有地址解析。
  return toArray(value).map((service) => ({
    ...(service || {}),
    ShouhouSPArr: toArray(service && service.ShouhouSPArr).map((device) => ({
      ...(device || {}),
      _photoSources: toArray(device && device.JieguoTP),
      _photos: []
    }))
  }))
}

export function serviceRecordPhotoContext(device = {}, runtimeUrls = {}) {
  // 优先采用生成档案时固化的源表上下文，确保跨页面仍按原权限读取私有图片。
  const stored = device._PrivateFileContext && (device._PrivateFileContext.JieguoTP || device._PrivateFileContext) || {}
  return {
    formEngineKey: stored.FormEngineKey || 'diy_shouhousp',
    formDataId: stored.FormDataId || device.Id || '',
    fieldId: stored.FieldId || '',
    sysMenuId: stored.SysMenuId || '',
    runtimeUrls: runtimeUrls || {}
  }
}

function text(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength)
}

function photoPath(photo) {
  if (typeof photo === 'string') return text(photo, 1000)
  if (!photo || typeof photo !== 'object') return ''
  return text(photo.Path || photo.FilePathName || photo.FilePath || photo.FullPath, 1000)
}

export function normalizeServiceRecordPhotoPayload(value) {
  return toArray(value).slice(0, 9).map((photo) => {
    const path = photoPath(photo)
    if (!path) return null
    const source = typeof photo === 'object' && photo ? photo : {}
    return {
      Id: text(source.Id || source.id, 64),
      Path: path,
      Name: text(source.Name || source.FileName || source.name, 255),
      Size: Number.isFinite(Number(source.Size)) ? Number(source.Size) : 0,
      CreateTime: text(source.CreateTime, 25),
      State: source.State === undefined || source.State === null ? 1 : Number(source.State),
      ContentType: text(source.ContentType || source.Type, 100)
    }
  }).filter(Boolean)
}

export function buildServiceRecordUpdatePayload({ recordId, updateTime, form, snapshots } = {}) {
  // 页面只提交允许人工修订的快照字段；照片仅提交稳定元数据，临时地址和私有文件上下文不会回写。
  return {
    Action: 'Update',
    Id: text(recordId, 36),
    ExpectedUpdateTime: text(updateTime, 40),
    KaishiSJ: text(form && form.KaishiSJ, 10),
    JieshuSJ: text(form && form.JieshuSJ, 10),
    Snapshots: toArray(snapshots).map((service) => ({
      Id: text(service && service.Id, 36),
      Leixing: text(service && service.Leixing, 100),
      FinishTime: text(service && service.FinishTime, 25),
      ShouhouRY: text(service && service.ShouhouRY, 100),
      Neirong: text(service && service.Neirong, 5000),
      ShouhouSPArr: toArray(service && service.ShouhouSPArr).map((device) => ({
        Id: text(device && device.Id, 36),
        AnzhuangWZ: text(device && device.AnzhuangWZ, 255),
        JieguoTP: normalizeServiceRecordPhotoPayload(device && device.JieguoTP)
      }))
    }))
  }
}

export function cloneServiceRecordEditState(form, snapshots) {
  return JSON.parse(JSON.stringify({
    form: { KaishiSJ: form && form.KaishiSJ || '', JieshuSJ: form && form.JieshuSJ || '' },
    snapshots: Array.isArray(snapshots) ? snapshots : []
  }))
}
