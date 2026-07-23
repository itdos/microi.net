import { V8, getUser } from '@/utils/request.js'
import { callApiEngine } from '@/platform/business-runtime.js'
import { parseJson } from '@/platform/native-form.js'
import { addTaskDevices } from '@/utils/xjy-task.js'

function requireParentId(parentId) {
  if (parentId) return true
  uni.showToast({ title: '请先保存当前表单', icon: 'none' })
  return false
}

export function validateOpenTableContext({ field, form }) {
  if (['XuanzeSHSB', 'XuanzeGLSP', 'XuanzeFA', 'XuanzeFAXX'].includes(field.Name) && !form.KehuID) {
    return '请先选择客户'
  }
  return ''
}

export function appendOpenTableWhere({ field, form, where }) {
  const fieldName = field.Name
  if (fieldName === 'XuanzeSHSB') where.push({ Name: 'KehuID', Type: '=', Value: form.KehuID || '' })
  if (fieldName === 'XuanzeFA' || fieldName === 'XuanzeFAXX') {
    where.push({ Name: 'KehuID', Type: '=', Value: form.KehuID || '' })
  }
  if (fieldName === 'XuanzeGLSP') where.push({ Name: 'ShangpinLXZ', Type: '=', Value: '1' })
  if (fieldName === 'XuanzeLX') where.push({ Name: 'ShangpinLXZ', Type: '=', Value: '2' })
  if (fieldName === 'XuanzheGLPJ') where.push({ Name: 'ShangpinLX', Type: '=', Value: '耗材' })
  if (fieldName === 'XuanzeZP') where.push({ Name: 'KehuID', Type: '=', Value: form.KehuID || '' })
  return where
}

export async function submitTenantOpenTableSelection({ tableName, parentId, field, form, rows }) {
  const selected = Array.isArray(rows) ? rows : []
  const parentTable = String(tableName || '').toLowerCase()
  const fieldName = field.Name

  if (parentTable === 'diy_dingdan' && fieldName === 'XuanzeGLSP') {
    if (!requireParentId(parentId)) return { matched: true, handled: false }
    if (!form.KehuID) throw new Error('请先选择客户')
    const user = getUser() || {}
    if (!user.TenantId) throw new Error('当前帐号未关联商家，无法添加商品')
    const result = await callApiEngine('ordergoods', {
      goods: selected,
      KehuID: form.KehuID,
      DingdanID: parentId
    })
    if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '商品添加失败')
    uni.$emit('microi:data-changed', { table: 'Diy_DingdanSP', parentId })
    return { matched: true, handled: true }
  }

  if (parentTable === 'diy_dingdan' && (fieldName === 'XuanzeFA' || fieldName === 'XuanzeFAXX')) {
    if (!requireParentId(parentId)) return { matched: true, handled: false }
    if (!form.KehuID) throw new Error('请先选择客户')
    const result = await callApiEngine('fangan_to_dingdansp', {
      KehuID: form.KehuID,
      DingdanID: parentId,
      FangAnList: selected
    })
    if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '方案商品添加失败')
    uni.$emit('microi:data-changed', { table: 'Diy_DingdanSP', parentId })
    return { matched: true, handled: true }
  }

  if (parentTable === 'diy_shouhoudd' && fieldName === 'XuanzeSHSB') {
    if (!requireParentId(parentId)) return { matched: true, handled: false }
    if (!form.KehuID) throw new Error('请先选择客户')
    await addTaskDevices(parentId, selected)
    uni.$emit('microi:data-changed', { table: 'diy_shouhousp', parentId })
    return { matched: true, handled: true }
  }

  if (parentTable === 'diy_dingdansp' && fieldName === 'XuanzeLX') {
    if (!requireParentId(parentId)) return { matched: true, handled: false }
    const result = await callApiEngine('AddOrderLX', {
      LvXin: selected,
      DingdanSPID: parentId,
      DingdanID: form.DingdanID
    })
    if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '滤芯添加失败')
    uni.$emit('microi:data-changed', { table: 'diy_dingdansphc', parentId })
    return { matched: true, handled: true }
  }

  if (fieldName === 'XuanzeZP') {
    const images = []
    const photoFields = ['KehuSCZP', 'JieguoTP', 'PingjiaST', 'ZhuipingT']
    selected.forEach((row) => photoFields.forEach((name) => {
      const values = parseJson(row[name], [])
      if (Array.isArray(values)) images.push(...values)
    }))
    form.Tupian = images
    return { matched: true, handled: true, changedField: 'Tupian' }
  }

  if (parentTable === 'diy_shangpin' && fieldName === 'XuanzheGLPJ') {
    if (!requireParentId(parentId)) return { matched: true, handled: false }
    const source = await V8.FormEngine.GetTableData('Diy_Shangpin', {
      _Where: [{ Name: 'Id', Type: 'In', Value: selected.map((item) => item.Id) }],
      _PageIndex: 1,
      _PageSize: 300
    })
    if (!source || Number(source.Code) !== 1) throw new Error((source && source.Msg) || '耗材读取失败')
    const payload = (source.Data || []).map((item) => ({
      FormEngineKey: 'Diy_ShangpinLx',
      _RowModel: { ...item, Id: '', ShangpinID: parentId }
    }))
    const result = await V8.FormEngine.AddFormDataBatch(payload)
    if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '关联耗材失败')
    uni.$emit('microi:data-changed', { table: 'Diy_ShangpinLx', parentId })
    return { matched: true, handled: true }
  }

  return { matched: false }
}

export default {
  appendOpenTableWhere,
  validateOpenTableContext,
  submitTenantOpenTableSelection
}
