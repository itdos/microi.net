import { V8, getUser } from '@/utils/request.js'
import { callApiEngine } from '@/platform/business-runtime.js'
import { parseJson } from '@/platform/native-form.js'
import { addTaskDevices } from '@/utils/xjy-task.js'
import { casePhotoField } from './case-form.mjs'

const AFTER_SALES_PHOTO_MENU_ID = 'd9ed1fb9-1770-46e8-9662-31399aeece67'
const AFTER_SALES_PHOTO_FIELDS = {
  KehuSCZP: 'af3784ec-e035-429f-8593-6a37512477ae',
  JieguoTP: '59274024-77b5-4c6e-82f3-472947321073',
  PingjiaST: '5b372a6a-32b9-42a1-8375-be991e90d74f',
  ZhuipingT: '9f4f1382-5a2a-44ed-893f-f18fe4dbe833'
}

export function customerCaseChildField(parentTableName, field) {
  if (String(parentTableName || '').toLowerCase() !== 'diy_kehu' || field.Name !== 'KehuAL') return field
  const config = field.config || parseJson(field.Config, {}) || {}
  const child = config.TableChild || {}
  const parsedRelations = parseJson(child.FieldRelations, [])
  const relations = Array.isArray(parsedRelations) ? parsedRelations : []
  // 兼容现有客户案例子表配置：新增时从已加载的客户详情带入城市、概况。
  // 只扩展页面使用的字段副本，继续由通用 FieldRelations 处理传值。
  const extra = ['Chengshi', 'KehuGK'].filter((name) =>
    !relations.some((relation) => Array.isArray(relation) && relation[1] === name)
  ).map((name) => [name, name])
  if (!extra.length) return field
  return {
    ...field,
    config: { ...config, TableChild: { ...child, FieldRelations: [...relations, ...extra] } }
  }
}

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
  // 未选客户时沿用照片菜单的服务端授权范围，不能附加 KehuID='' 把所有正常任务过滤掉。
  if (fieldName === 'XuanzeZP' && String(form.KehuID || '').trim()) {
    where.push({ Name: 'KehuID', Type: '=', Value: form.KehuID })
  }
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
    // 同一个选择器服务客户案例及案例册快照；照片和临时预览必须落在各自的实际字段。
    const photoField = casePhotoField(tableName) || 'Tupian'
    const images = []
    const previewTasks = []
    selected.forEach((row) => Object.entries(AFTER_SALES_PHOTO_FIELDS).forEach(([name, fieldId]) => {
      const values = parseJson(row[name], [])
      if (!Array.isArray(values)) return
      values.filter(Boolean).forEach((value) => {
        const image = typeof value === 'object' ? { ...value } : { Path: String(value) }
        images.push(image)
        if (!image.Id || !image.Path || !row.Id) return
        // zhy：新增案例尚未入库，必须用照片原始售后单及原字段鉴权；临时 URL 仅写运行态 RealPath。
        previewTasks.push(V8.resolveFileUrl(image, {
          formEngineKey: 'Diy_ShouhouDD',
          formDataId: row.Id,
          fieldId,
          sysMenuId: AFTER_SALES_PHOTO_MENU_ID
        }).then((url) => {
          if (url) form[`${photoField}_${image.Id}_RealPath`] = url
        }))
      })
    }))
    await Promise.all(previewTasks)
    // 允许选中暂无照片的任务，但不能因此清空案例已有的上传照片。
    if (!images.length) throw new Error('所选售后任务暂无照片，请选择其他任务')
    form[photoField] = images
    return { matched: true, handled: true, changedField: photoField }
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
  customerCaseChildField,
  appendOpenTableWhere,
  validateOpenTableContext,
  submitTenantOpenTableSelection
}
