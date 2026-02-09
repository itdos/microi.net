const state = {
  // 子表保存是否开启表内编辑/新增功能
  Child_Sys_Menu: {},
  // 子表保存开启表内编辑/新增数据
  Child_TableData_Edit: {},
  // 子表必填项
  Child_Table_Required: {}
}

const mutations = {
  // 子表新增类型
  SET_CHILD_SYS_MENU(state, data) {
    const { DiyTableId, AddBtnType } = data
    if (state.Child_Sys_Menu.hasOwnProperty(DiyTableId)) {
      state.Child_Sys_Menu[DiyTableId] = AddBtnType
    } else {
      state.Child_Sys_Menu = {
       ...state.Child_Sys_Menu,
        [DiyTableId]: AddBtnType
      }
    }
  },
  // 保存子表开启表内编辑/新增数据
  SET_CHILD_TABLE_DATA_EDIT(state, data) {
    // 判断数据是否存在，不存在则添加，存在则更新
    // obj: 当前行数据，Name: 字段名，parentId: 父级Id，Guid: 关联主表唯一标识
    const { obj, Name, parentId, Guid } = data
    if (state.Child_TableData_Edit.hasOwnProperty(parentId)) {
      const parentData = state.Child_TableData_Edit[parentId]
      if (parentData.hasOwnProperty(Guid)) {
        const parentChildData = parentData[Guid]
        // console.log('更新数据', Guid,parentData[Guid])
        const index = parentChildData.findIndex(item => item.Id === obj.Id)
        if (index > -1) {
          // 更新数据
          if (parentChildData[index]._FormData[Name]) {
            parentChildData[index]._FormData[Name] = obj._FormData[Name]
          } else {
            parentChildData[index]._FormData = {...parentChildData[index]._FormData,...obj._FormData}
          }
        } else {
          parentChildData.push(obj)
        }
      } else {
        parentData[Guid] = [obj]
      }
    } else {
      state.Child_TableData_Edit = {
       ...state.Child_TableData_Edit,
        [parentId]: {
          [Guid]: [obj]
        }
      }
    }
    console.log('state.Child_Table_Required', state.Child_TableData_Edit)
  },
  // 保存子表必填项
  SET_CHILD_TABLE_REQUIRED(state, data) {
    // 判断数据是否存在，不存在则添加，存在则更新
    const { requiredData, TableId } = data
    if (state.Child_Table_Required.hasOwnProperty(TableId)) {
      state.Child_Table_Required[TableId] = requiredData
    } else {
      state.Child_Table_Required = {
       ...state.Child_Table_Required,
        [TableId]: requiredData
      }
    }
  }
}

const actions = {

}

const getters = {
 

}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}