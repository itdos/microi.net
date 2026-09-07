// 两个案例入口共用动态表单和照片选择组件，仅在此声明实际落库字段的差异。
const CASE_PHOTO_FIELDS = Object.freeze({
  diy_anli: 'Tupian',
  diy_anlice_child: 'KehuALZP'
})

export function casePhotoField(tableName) {
  return CASE_PHOTO_FIELDS[String(tableName || '').toLowerCase()] || ''
}

export function caseFieldDescription(tableName, fieldName) {
  const photoField = casePhotoField(tableName)
  if (!photoField) return ''
  if (fieldName === 'KehuPJ') return '从售后评价里面选择评论的内容'
  if (fieldName === photoField) return '包括门头照片、设备照片，可从客户安装任务中选取'
  return ''
}
