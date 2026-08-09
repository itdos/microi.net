/**
 * V8引擎 JavaScript API 智能提示定义
 * 用于Monaco编辑器提供代码自动完成功能
 *
 * 事实源: src/utils/diy.common.js、diy-form.vue、diy-form-full.vue、diy-table.vue
 * 官方文档: microi.doc/docs/doc/v8-engine/v8-client.md
 * @version 2.1.0
 * @date 2026-07-24
 */

// V8引擎完整API定义
export const V8ApiDefinitions = {
    V8: {
        label: "V8",
        kind: "Module",
        documentation: "V8引擎全局对象 - 前端V8引擎支持完整ES6语法",
        insertText: "V8",
        properties: {
            // ========== 表单相关属性 ==========
            Form: {
                label: "Form",
                kind: "Property",
                documentation: "访问当前表单字段值\n\n示例:\nvar id = V8.Form.Id;\nvar name = V8.Form.UserName;\n\n如果是下拉框组件:\nvar selectId = V8.Form.SelectUser.Id;",
                insertText: "Form"
            },
            OldForm: {
                label: "OldForm",
                kind: "Property",
                documentation: "访问表单修改前的字段值\n\n示例:\nvar oldName = V8.OldForm.UserName;",
                insertText: "OldForm"
            },
            Field: {
                label: "Field",
                kind: "Property",
                documentation: "访问当前表单字段属性\n\n包含属性: Name、Label、Config、Data(绑定数据源)、Readonly、Visible、Placeholder等\n\n示例:\nvar isReadonly = V8.Field.UserName.Readonly;",
                insertText: "Field"
            },
            FormMode: {
                label: "FormMode",
                kind: "Property",
                documentation: '获取当前Form打开的模式\n\n可能的值: Add(新增)、Edit(编辑)、View(预览)\n\n示例:\nif(V8.FormMode == "Add") {\n  V8.FormSet("ShenqingR", V8.CurrentUser.Name);\n}',
                insertText: "FormMode"
            },
            FormSubmitAction: {
                label: "FormSubmitAction",
                kind: "Property",
                documentation: "表单提交类型\n\n可能的值: Insert、Update、Delete\n\n注意: 在表单进入事件无法访问，只能在表单提交前、提交后访问",
                insertText: "FormSubmitAction"
            },
            CurrentUser: {
                label: "CurrentUser",
                kind: "Property",
                documentation: "访问当前登录用户信息\n\n示例:\nvar id = V8.CurrentUser.Id;\nvar name = V8.CurrentUser.Name;\nvar deptName = V8.CurrentUser.DeptName;",
                insertText: "CurrentUser"
            },
            CurrentToken: {
                label: "CurrentToken",
                kind: "Property",
                documentation: "当前登录身份 Token。Token 会随受保护请求续签轮换；不要写入 URL、日志或业务数据，也不要长期缓存旧值。",
                insertText: "CurrentToken"
            },
            SysConfig: {
                label: "SysConfig",
                kind: "Property",
                documentation: "访问当前租户允许公开给浏览器的系统设置脱敏投影。\n\n数据库、Redis、对象存储、MQ、密码、Secret、Token、Key、Connection、ClientSecrets、GlobalServerV8Code 等敏感字段不会注入前端。\n\n示例:\nvar sysTitle = V8.SysConfig.SysTitle;\nvar apiBase = V8.SysConfig.ApiBase;",
                insertText: "SysConfig"
            },
            SelectedData: {
                label: "SelectedData",
                kind: "Property",
                documentation: "获取已选择的行数组，每行包含了所有数据\n\n示例:\nvar selectData = V8.SelectedData;\nvar ids = selectData.map(item => item.Id);",
                insertText: "SelectedData"
            },
            ParentV8: {
                label: "ParentV8",
                kind: "Module",
                documentation: '子表中访问父表的V8对象\n\n可使用父表V8对象的所有功能\n\n示例:\nvar parentForm = V8.ParentV8.Form;\nV8.ParentV8.FormSet("字段名", "值");',
                insertText: "ParentV8"
            },
            OldValue: {
                label: "OldValue",
                kind: "Property",
                documentation: "当前字段旧值，仅在表格行内字段值变更上下文中可靠提供。普通表单字段事件应读取 V8.OldForm 或业务快照。",
                insertText: "OldValue"
            },
            ThisValue: {
                label: "ThisValue",
                kind: "Property",
                documentation: "当前字段事件的新值。下拉框通常是对象，文本/数字可能是原始值；表格行内部分数值控件可能传入 { New, Old }。",
                insertText: "ThisValue"
            },
            EventName: {
                label: "EventName",
                kind: "Property",
                documentation: "当前前端 V8 事件名，例如 FormIn、FormSubmitBefore、FormOut、FieldValueChange、FieldOnKeyup、TableFieldOnKeyup、FieldSlotButtonClick、V8BtnRun、V8BtnLimit、TableRowClick、PageTab。",
                insertText: "EventName"
            },
            Event: {
                label: "Event",
                kind: "Property",
                documentation: "显式传入当前 V8 的原生浏览器事件。插槽按钮等场景可用；键盘 V8 当前请使用 V8.KeyCode。",
                insertText: "Event"
            },
            KeyCode: {
                label: "KeyCode",
                kind: "Property",
                documentation: "键盘 V8 事件的 keyCode，例如 Enter 为 13。",
                insertText: "KeyCode"
            },
            TableId: {
                label: "TableId",
                kind: "Property",
                documentation: "当前 diy_table 的 Id。",
                insertText: "TableId"
            },
            TableName: {
                label: "TableName",
                kind: "Property",
                documentation: "当前 diy_table 的物理表名/表 Key。",
                insertText: "TableName"
            },
            TableModel: {
                label: "TableModel",
                kind: "Property",
                documentation: "当前 diy_table 模型。",
                insertText: "TableModel"
            },
            SysMenuId: {
                label: "SysMenuId",
                kind: "Property",
                documentation: "当前标准菜单的真实 sys_menu.Id。只读使用，不要伪造或传播给其它表。",
                insertText: "SysMenuId"
            },
            SysMenuModel: {
                label: "SysMenuModel",
                kind: "Property",
                documentation: "当前列表/菜单按钮上下文的 sys_menu 模型；非列表场景不保证存在。",
                insertText: "SysMenuModel"
            },
            DataAppend: {
                label: "DataAppend",
                kind: "Property",
                documentation: "打开表单、列表或弹窗时传入的附加业务数据。",
                insertText: "DataAppend"
            },
            TableRowId: {
                label: "TableRowId",
                kind: "Property",
                documentation: "当前记录 Id 或父子表关联值。",
                insertText: "TableRowId"
            },
            CurrentTableData: {
                label: "CurrentTableData",
                kind: "Property",
                documentation: "当前宿主已加载的当页数据。",
                insertText: "CurrentTableData"
            },
            TableRowSelected: {
                label: "TableRowSelected",
                kind: "Property",
                documentation: "列表批量按钮中当前勾选的行数组，兼容别名为 V8.SelectedData。",
                insertText: "TableRowSelected"
            },
            SearchParam: {
                label: "SearchParam",
                kind: "Property",
                documentation: "列表当前搜索快照：{ Keyword, Where }。",
                insertText: "SearchParam"
            },
            Row: {
                label: "Row",
                kind: "Property",
                documentation: "表格行事件中的当前行。",
                insertText: "Row"
            },
            Rows: {
                label: "Rows",
                kind: "Property",
                documentation: "表格行事件中的当前页行数组。",
                insertText: "Rows"
            },
            RowIndex: {
                label: "RowIndex",
                kind: "Property",
                documentation: "表格行事件中的当前行索引。",
                insertText: "RowIndex"
            },
            Result: {
                label: "Result",
                kind: "Property",
                documentation: "模板、按钮显隐和字段回调的显式输出值。",
                insertText: "Result"
            },
            ClientType: {
                label: "ClientType",
                kind: "Property",
                documentation: "当前客户端类型：PC、IOS、Android、H5、WeChat。",
                insertText: "ClientType"
            },
            OsClient: {
                label: "OsClient",
                kind: "Property",
                documentation: "当前租户 OsClient。",
                insertText: "OsClient"
            },

            // ========== 表单操作方法 ==========
            FormSet: {
                label: "FormSet",
                kind: "Method",
                documentation:
                    '给当前字段/行赋值。\n\n普通 diy-form 中会触发目标字段的值变更 V8；diy-table 列表/行内上下文只更新当前行和模板，不递归触发目标字段 V8。\n\n参数:\n  - fieldName: 字段名\n  - value: 字段值\n\nV8.Form.UserName = "张三" 是响应式静默赋值，不触发值变更事件。字段自身事件中避免 FormSet 同一字段形成循环。\n\n示例:\nV8.FormSet("UserName", "张三");\nV8.FormSet("SelectUser", { Id: 1, Name: "张三" });',
                insertText: "FormSet",
                snippet: 'FormSet("${1:fieldName}", ${2:value})'
            },
            FieldSet: {
                label: "FieldSet",
                kind: "Method",
                documentation:
                    '给当前表单字段属性赋值。\n\n普通表单支持 Config.Button.Loading 等 Config 点路径；列表和部分全屏按钮上下文只保证顶层属性可用，跨上下文代码优先使用 Visible/Readonly/Data 等顶层属性。\n\n参数:\n  - fieldName: 字段名\n  - propertyName: 属性名\n  - value: 属性值\n\n示例:\nV8.FieldSet("UserName", "Readonly", true);\nV8.FieldSet("SelectField", "Data", [{Id:1}, {Id:2}]);',
                insertText: "FieldSet",
                snippet: 'FieldSet("${1:fieldName}", "${2:propertyName}", ${3:value})'
            },
            FormSubmit: {
                label: "FormSubmit",
                kind: "Method",
                documentation:
                    '提交表单\n\n注意: 此函数会触发"前端表单提交前V8事件"\n不能在"前端表单提交前V8事件"调用此函数，否则会死循环\n\n参数:\n  - CloseForm: 是否关闭Form表单\n  - SavedType: 保存后的操作(Insert/Update/View)\n  - Callback: 回调函数\n\n示例:\nV8.FormSubmit({\n  CloseForm: true,\n  SavedType: "Insert",\n  Callback: function(result) { ... }\n});',
                insertText: "FormSubmit",
                snippet: 'FormSubmit({\n\tCloseForm: ${1:true},\n\tSavedType: "${2:Insert}",\n\tCallback: function(result) {\n\t\t${3:// 处理结果}\n\t}\n})'
            },
            FormClose: {
                label: "FormClose",
                kind: "Method",
                documentation: "强制关闭表单\n\n示例:\nV8.FormClose();",
                insertText: "FormClose",
                snippet: "FormClose()"
            },
            OpenForm: {
                label: "OpenForm",
                kind: "Method",
                documentation: '打开表单\n\n参数:\n  - formModel: 表单数据对象\n  - type: "View"/"Edit"/"Add"\n\n示例(在行更多V8按钮事件中):\nV8.OpenForm(V8.Form, "Edit");',
                insertText: "OpenForm",
                snippet: 'OpenForm(${1:V8.Form}, "${2|View,Edit,Add|}")'
            },
            OpenAnyForm: {
                label: "OpenAnyForm",
                kind: "Method",
                documentation:
                    '打开一个任意表单\n\n参数:\n  - TableName: 表名(必传)\n  - FormMode: 打开模式(必传) Add/Edit/View\n  - Id: 数据Id(Edit/View时必传)\n  - DialogType: 打开方式(可选) Dialog/Drawer\n  - Width: 弹出宽度(可选)\n  - DataAppend: 自定义附加数据(可选)\n  - EventReplace: 替换事件(可选)\n\n示例:\nV8.OpenAnyForm({\n  TableName: "Diy_User",\n  FormMode: "Edit",\n  Id: V8.Form.Id\n});',
                insertText: "OpenAnyForm",
                snippet: 'OpenAnyForm({\n\tTableName: "${1:TableName}",\n\tFormMode: "${2|Add,Edit,View|}",\n\tId: ${3:V8.Form.Id}\n})'
            },
            OpenAnyTable: {
                label: "OpenAnyTable",
                kind: "Method",
                documentation:
                    '打开一个任意列表\n\n参数:\n  - SysMenuId/ModuleEngineKey: 菜单Id或模块引擎Key(必传其一)\n  - DialogType: 打开方式 Dialog/Drawer，默认 Dialog\n  - Width: 弹窗宽度/抽屉尺寸，支持 80%、80vw、960px、960\n  - Direction: Drawer 方向 rtl/ltr/ttb/btt，默认 rtl\n  - MultipleSelect: 是否多选\n  - PropsWhere: 查询条件\n  - SubmitEvent: 提交事件回调\n\n示例:\nV8.OpenAnyTable({\n  SysMenuId: "xxx-xxx",\n  DialogType: "Drawer",\n  Width: "80vw",\n  MultipleSelect: true,\n  PropsWhere: [\n    ["FkId", "=", V8.Form.Id]\n  ],\n  SubmitEvent: async function(selectData, callback) {\n    callback({ Code: 1, Data: selectData });\n  }\n});',
                insertText: "OpenAnyTable",
                snippet:
                    'OpenAnyTable({\n\tSysMenuId: "${1:menuId}",\n\tDialogType: "${2|Dialog,Drawer|}",\n\tWidth: "${3:80vw}",\n\tMultipleSelect: ${4:true},\n\tPropsWhere: [\n\t\t["${5:FkId}", "=", ${6:V8.Form.Id}]\n\t],\n\tSubmitEvent: async function(selectData, callback) {\n\t\t${7:// 处理提交}\n\t\tcallback({ Code: 1, Data: selectData });\n\t}\n})'
            },
            // ========== 表格操作方法 ==========
            RefreshTable: {
                label: "RefreshTable",
                kind: "Method",
                documentation: "刷新当前 V8 所属的列表。\n\n参数:\n  - _PageIndex: 页码，传入 -1 表示跳转到最后一页\n\n主表单内指定子表请使用 V8.TableRefresh(子表字段, 参数)。\n\n示例:\nV8.RefreshTable({ _PageIndex: 1 });",
                insertText: "RefreshTable",
                snippet: "RefreshTable({ _PageIndex: ${1:1} })"
            },
            SearchSet: {
                label: "SearchSet",
                kind: "Method",
                documentation: '列表/PageTabs 替换搜索条件。数组按 _Where 处理；对象转换为各字段 Like 条件。\n\n示例:\nV8.SearchSet([\n  ["Age", ">=", 18]\n]);\nV8.SearchSet({ Status: "待办" });',
                insertText: "SearchSet",
                snippet: 'SearchSet([\n\t["${1:FieldName}", "${2:=}", ${3:value}]\n])'
            },
            SearchAppend: {
                label: "SearchAppend",
                kind: "Method",
                documentation: '列表/PageTabs 追加搜索条件。数组追加 _Where；对象合并到当前搜索模型。\n\n示例:\nV8.SearchAppend([\n  ["Age", ">=", 18]\n]);\nV8.SearchAppend({ OwnerId: V8.CurrentUser.Id });',
                insertText: "SearchAppend",
                snippet: 'SearchAppend([\n\t["${1:FieldName}", "${2:=}", ${3:value}]\n])'
            },

            // ========== FormEngine表单引擎 ==========
            FormEngine: {
                label: "FormEngine",
                kind: "Module",
                documentation: "前端受权限约束的单表 CRUD facade；不是后端 FormEngine 方法的一比一暴露。\n\n当前表自动注入真实 _SysMenuId；跨表不继承当前菜单，由后端按当前用户对目标表的菜单授权缓存推断。显式菜单会严格校验。_TableChildAuth 由标准 TableChild 自动维护，业务 V8 不得构造。敏感平台表对普通客户端硬拒绝。\n\n全部方法返回 Promise，并兼容可选 callback。Import/Export 不是本 facade 方法。\n\n详见: /doc/v8-engine/v8-client.html#v8-formengine",
                insertText: "FormEngine",
                methods: {
                    GetFormData: {
                        label: "GetFormData",
                        kind: "Method",
                        documentation:
                            '获取单条业务数据。支持 (table, params, callback?) 或 (params, callback?)，返回 Promise<DosResult>。\n\n参数:\n  - FormEngineKey: 表名（对象形式）\n  - Id: 主键ID(可选)\n  - _Where: 查询条件(可选)\n  - _SelectFields: 指定查询字段(可选)\n\n示例:\nvar result = await V8.FormEngine.GetFormData("Diy_Product", {\n  Id: V8.Form.ProductId\n});',
                        insertText: "GetFormData",
                        snippet: 'GetFormData("${1:FormEngineKey}", {\n\tId: "${2:id}"\n})'
                    },
                    GetFormDataAnonymous: {
                        label: "GetFormDataAnonymous",
                        kind: "Method",
                        documentation: "匿名获取单条数据。仅当目标 diy_table 明确开启匿名读取时可用；平台敏感表不会因匿名开关放行。返回 Promise<DosResult>。",
                        insertText: "GetFormDataAnonymous",
                        snippet: 'GetFormDataAnonymous("${1:FormEngineKey}", {\n\tId: "${2:id}",\n\tOsClient: V8.OsClient\n})'
                    },
                    GetTableData: {
                        label: "GetTableData",
                        kind: "Method",
                        documentation:
                            '获取业务数据列表。支持 (table, params, callback?) 或 (params, callback?)，返回 Promise<DosResult>。\n\n参数:\n  - _Where: 查询条件数组\n  - _SelectFields: 查询字段\n  - _PageSize/_PageIndex: 分页\n  - _OrderBy/_OrderByType/_OrderBys: 排序\n\n服务端菜单范围会强制追加，前端 _Where 只能缩小结果。\n\n示例:\nvar result = await V8.FormEngine.GetTableData("Diy_Product", {\n  _Where: [["Status", "=", 1]],\n  _PageSize: 20,\n  _PageIndex: 1\n});',
                        insertText: "GetTableData",
                        snippet: 'GetTableData("${1:FormEngineKey}", {\n\t_Where: [["${2:FieldName}", "${3:=}", ${4:value}]],\n\t_PageSize: ${5:20},\n\t_PageIndex: ${6:1}\n})'
                    },
                    GetTableTree: {
                        label: "GetTableTree",
                        kind: "Method",
                        documentation: "获取树形数据列表。前端方法名是 GetTableTree，不是后端文档中可能出现的 GetTableDataTree。返回 Promise<DosResult>。",
                        insertText: "GetTableTree",
                        snippet: 'GetTableTree("${1:FormEngineKey}", {\n\t_Where: []\n})'
                    },
                    AddFormData: {
                        label: "AddFormData",
                        kind: "Method",
                        documentation:
                            '新增单条业务数据。返回 Promise<DosResult>，也可传 callback。重要业务写入优先调用 ApiEngine，由后端完成事务、幂等和权限校验。\n\n示例:\nvar result = await V8.FormEngine.AddFormData("Diy_Comment", {\n  BusinessId: V8.Form.Id,\n  Content: "备注"\n});',
                        insertText: "AddFormData",
                        snippet: 'AddFormData("${1:FormEngineKey}", {\n\t${2:Name}: "${3:value}"\n})'
                    },
                    AddFormDataBatch: {
                        label: "AddFormDataBatch",
                        kind: "Method",
                        documentation: "前端批量新增封装，参数为包含 FormEngineKey 的行数组，返回 Promise<DosResult>。前端没有 AddTableData。",
                        insertText: "AddFormDataBatch",
                        snippet: 'AddFormDataBatch([\n\t{ FormEngineKey: "${1:TableName}", ${2:Field}: ${3:value} }\n])'
                    },
                    UptFormData: {
                        label: "UptFormData",
                        kind: "Method",
                        documentation:
                            '修改单条业务数据，Id 必传。返回 Promise<DosResult>，也可传 callback。\n\n示例:\nvar result = await V8.FormEngine.UptFormData("Diy_Product", {\n  Id: V8.Form.ProductId,\n  Status: 1\n});',
                        insertText: "UptFormData",
                        snippet: 'UptFormData("${1:FormEngineKey}", {\n\tId: "${2:id}",\n\t${3:Name}: "${4:value}"\n})'
                    },
                    UptFormDataBatch: {
                        label: "UptFormDataBatch",
                        kind: "Method",
                        documentation: "前端批量修改封装，参数为包含 FormEngineKey、Id 的行数组，返回 Promise<DosResult>。前端没有 UptTableData。",
                        insertText: "UptFormDataBatch",
                        snippet: 'UptFormDataBatch([\n\t{ FormEngineKey: "${1:TableName}", Id: "${2:id}", ${3:Field}: ${4:value} }\n])'
                    },
                    UptFormDataByWhere: {
                        label: "UptFormDataByWhere",
                        kind: "Method",
                        documentation: "按 _Where 修改数据。必须提供明确条件；高风险或跨表业务写入应使用 ApiEngine。返回 Promise<DosResult>。",
                        insertText: "UptFormDataByWhere",
                        snippet: 'UptFormDataByWhere("${1:FormEngineKey}", {\n\t_Where: [["${2:Field}", "=", ${3:value}]],\n\t${4:SaveField}: ${5:newValue}\n})'
                    },
                    DelFormData: {
                        label: "DelFormData",
                        kind: "Method",
                        documentation:
                            '按 Id 或 Ids 删除业务数据。返回 Promise<DosResult>，也可传 callback。高风险删除优先使用 ApiEngine。\n\n示例:\nvar result = await V8.FormEngine.DelFormData("Diy_Comment", {\n  Id: V8.Form.CommentId\n});',
                        insertText: "DelFormData",
                        snippet: 'DelFormData("${1:FormEngineKey}", {\n\tId: "${2:id}"\n})'
                    },
                    DelFormDataBatch: {
                        label: "DelFormDataBatch",
                        kind: "Method",
                        documentation: "前端批量删除封装，参数为包含 FormEngineKey、Id 的行数组，返回 Promise<DosResult>。前端没有 DelTableData。",
                        insertText: "DelFormDataBatch",
                        snippet: 'DelFormDataBatch([\n\t{ FormEngineKey: "${1:TableName}", Id: "${2:id}" }\n])'
                    },
                    DelFormDataByWhere: {
                        label: "DelFormDataByWhere",
                        kind: "Method",
                        documentation: "按明确 _Where 删除数据。高风险批量删除应使用 ApiEngine，并在后端做权限、范围、审计和幂等校验。返回 Promise<DosResult>。",
                        insertText: "DelFormDataByWhere",
                        snippet: 'DelFormDataByWhere("${1:FormEngineKey}", {\n\t_Where: [["${2:Field}", "=", ${3:value}]]\n})'
                    }
                }
            },

            // ========== ApiEngine接口引擎 ==========
            ApiEngine: {
                label: "ApiEngine",
                kind: "Module",
                documentation: "接口引擎。Run 支持 (key, params, callback?) 与 ({ApiEngineKey,...}, callback?)，均返回 Promise；长任务使用 RunBackground。",
                insertText: "ApiEngine",
                methods: {
                    Run: {
                        label: "Run",
                        kind: "Method",
                        documentation:
                            '执行接口引擎，返回 Promise 并兼容 callback。\n\n示例:\nvar result = await V8.ApiEngine.Run("order_approve", {\n  Id: V8.Form.Id\n});\nvar result2 = await V8.ApiEngine.Run({ ApiEngineKey: "order_approve", Id: V8.Form.Id });',
                        insertText: "Run",
                        snippet: 'Run("${1:ApiEngineKey}", {\n\t${2:ParamName}: ${3:value}\n})'
                    },
                    RunBackground: {
                        label: "RunBackground",
                        kind: "Method",
                        documentation: "启动持久化后台接口引擎任务：RunBackground(apiEngineKey, params, title, options?, callback?)，返回 Promise。options 可设置 IdempotencyKey、ConcurrencyKey、MaxAttempts、BusinessTable/BusinessId 及业务状态/任务Id/进度/ETA字段。未知总量显示为估算中，不生成假百分比。",
                        insertText: "RunBackground",
                        snippet: 'RunBackground("${1:ApiEngineKey}", {\n\t${2:ParamName}: ${3:value}\n}, "${4:任务标题}", {\n\tIdempotencyKey: ${5:businessId}\n})'
                    }
                }
            },

            DataSourceEngine: {
                label: "DataSourceEngine",
                kind: "Module",
                documentation: "数据源引擎。Run 支持 (key, params, callback?) 与 ({DataSourceKey,...}, callback?)，返回 Promise。GetData 已弃用。",
                insertText: "DataSourceEngine",
                methods: {
                    Run: {
                        label: "Run",
                        kind: "Method",
                        documentation: "执行数据源引擎，返回 Promise 并兼容 callback。",
                        insertText: "Run",
                        snippet: 'Run("${1:DataSourceKey}", {\n\t${2:Keyword}: ${3:value}\n})'
                    }
                }
            },

            // ========== 与后端同构的 HTTP 请求对象 ==========
            Http: {
                label: "Http",
                kind: "Module",
                documentation: "前端HTTP请求对象，参数与后端V8.Http一致；浏览器端必须使用await。",
                insertText: "Http",
                methods: {
                    Get: {
                        label: "Get",
                        kind: "Method",
                        documentation: "GET请求，返回原始响应文本。参数：Url、GetParam、Timeout/TimeOut、Headers/Header。",
                        insertText: "Get",
                        snippet: 'Get({\n\tUrl: "${1:/api/url}",\n\tGetParam: {\n\t\t${2:param}: ${3:value}\n\t}\n})'
                    },
                    GetResponse: {
                        label: "GetResponse",
                        kind: "Method",
                        documentation: "GET请求，返回Content、Headers、RawBytes、StatusCode、ErrorMessage。",
                        insertText: "GetResponse",
                        snippet: 'GetResponse({\n\tUrl: "${1:/api/url}",\n\tGetParam: {}\n})'
                    },
                    Post: {
                        label: "Post",
                        kind: "Method",
                        documentation: "POST请求，返回原始响应文本。参数：Url、GetParam、PostParam/PostParamString、ParamType、Timeout/TimeOut、Headers/Header。",
                        insertText: "Post",
                        snippet: 'Post({\n\tUrl: "${1:/api/url}",\n\tPostParam: {\n\t\t${2:param}: ${3:value}\n\t},\n\tParamType: "${4:json}"\n})'
                    },
                    PostResponse: {
                        label: "PostResponse",
                        kind: "Method",
                        documentation: "POST请求，返回完整响应对象。",
                        insertText: "PostResponse",
                        snippet: 'PostResponse({\n\tUrl: "${1:/api/url}",\n\tPostParam: {},\n\tParamType: "${2:json}"\n})'
                    },
                    Patch: {
                        label: "Patch",
                        kind: "Method",
                        documentation: "PATCH请求，返回原始响应文本。参数：Url、GetParam、PatchParam/PatchParamString、ParamType、Timeout/TimeOut、Headers/Header。",
                        insertText: "Patch",
                        snippet: 'Patch({\n\tUrl: "${1:/api/url}",\n\tPatchParam: {\n\t\t${2:param}: ${3:value}\n\t},\n\tParamType: "${4:json}"\n})'
                    },
                    PatchResponse: {
                        label: "PatchResponse",
                        kind: "Method",
                        documentation: "PATCH请求，返回完整响应对象。",
                        insertText: "PatchResponse",
                        snippet: 'PatchResponse({\n\tUrl: "${1:/api/url}",\n\tPatchParam: {},\n\tParamType: "${2:json}"\n})'
                    }
                }
            },

            // ========== Microi.AI ==========
            AI: {
                label: "AI",
                kind: "Module",
                documentation: "当前租户与登录用户绑定的 Microi.AI。浏览器自动携带并轮换 Token；调用参数不能覆盖 OsClient、用户、Endpoint、ApiKey 或 Authorization。所有方法返回 Promise。",
                insertText: "AI",
                methods: {
                    Chat: {
                        label: "Chat",
                        kind: "Method",
                        documentation: "AI 对话，默认 POST；参数可传 UserChatMsg、AiModel、AiModelId、SystemChatMsg、ConversationId、ReasoningEffort。",
                        insertText: "Chat",
                        snippet: 'Chat({\n\tUserChatMsg: "${1:问题}",\n\tAiModel: "${2:模型名称}"\n})'
                    },
                    ChatGet: {
                        label: "ChatGet",
                        kind: "Method",
                        documentation: "使用 GET 调用 AI 对话，仅适合不含附件或复杂对象的标量参数。",
                        insertText: "ChatGet",
                        snippet: 'ChatGet({ UserChatMsg: "${1:问题}", AiModel: "${2:模型名称}" })'
                    },
                    ChatStream: {
                        label: "ChatStream",
                        kind: "Method",
                        documentation: "SSE 打字机对话。第二个参数接收增量文本；Promise 返回最终 DosResult。第三个参数可传 Signal 取消请求。",
                        insertText: "ChatStream",
                        snippet: 'ChatStream({\n\tUserChatMsg: "${1:问题}",\n\tAiModel: "${2:模型名称}"\n}, function(chunk) {\n\t${3:console.log(chunk);}\n})'
                    },
                    RecognizeIntent: {
                        label: "RecognizeIntent",
                        kind: "Method",
                        documentation: "识别 chat/data/builder/project/code 意图。",
                        insertText: "RecognizeIntent",
                        snippet: 'RecognizeIntent({ UserChatMsg: "${1:问题}", AiModel: "${2:模型名称}" })'
                    },
                    NL2SQL: {
                        label: "NL2SQL",
                        kind: "Method",
                        documentation: "按当前登录用户菜单、角色和数据范围把自然语言转为只读查询并执行。",
                        insertText: "NL2SQL",
                        snippet: 'NL2SQL({ Question: "${1:问题}", AiModel: "${2:模型名称}" })'
                    },
                    NL2V8: {
                        label: "NL2V8",
                        kind: "Method",
                        documentation: "自然语言生成 V8 代码，仅平台管理员。",
                        insertText: "NL2V8",
                        snippet: 'NL2V8({ Question: "${1:需求}", AiModel: "${2:模型名称}" })'
                    },
                    NL2V8Stream: {
                        label: "NL2V8Stream",
                        kind: "Method",
                        documentation: "流式生成 V8 代码，仅平台管理员。",
                        insertText: "NL2V8Stream",
                        snippet: 'NL2V8Stream({ Question: "${1:需求}", AiModel: "${2:模型名称}" }, function(chunk) {\n\t${3:console.log(chunk);}\n})'
                    },
                    CreateMiniMaxVideo: {
                        label: "CreateMiniMaxVideo",
                        kind: "Method",
                        documentation: "创建 MiniMax 异步视频任务。浏览器不接触供应商密钥，返回签名 TaskHandle。",
                        insertText: "CreateMiniMaxVideo",
                        snippet: 'CreateMiniMaxVideo({ Prompt: "${1:办公室工作场景}", Model: "${2:MiniMax-Hailuo-2.3}", Duration: ${3:6}, Resolution: "${4:1080P}" })'
                    },
                    GetMiniMaxVideoTask: {
                        label: "GetMiniMaxVideoTask",
                        kind: "Method",
                        documentation: "使用签名 TaskHandle 查询视频任务；完成后返回签名 FileHandle。",
                        insertText: "GetMiniMaxVideoTask",
                        snippet: 'GetMiniMaxVideoTask({ TaskHandle: "${1:taskHandle}" })'
                    },
                    GetMiniMaxVideoFile: {
                        label: "GetMiniMaxVideoFile",
                        kind: "Method",
                        documentation: "使用签名 FileHandle 获取短时有效下载地址。",
                        insertText: "GetMiniMaxVideoFile",
                        snippet: 'GetMiniMaxVideoFile({ FileHandle: "${1:fileHandle}" })'
                    }
                }
            },

            // ========== 旧版 HTTP 请求方法（兼容保留） ==========
            Post: {
                label: "Post",
                kind: "Method",
                documentation: 'POST请求 - 自带token，默认Form Data格式\n\n示例:\nV8.Post("/api/xxx", { Id: 1 }, function(result) {\n  if(result.Code == 1) { ... }\n});',
                insertText: "Post",
                snippet: 'Post("${1:/api/xxx}", {\n\t${2:param}: ${3:value}\n}, function(result) {\n\tif(result.Code == 1) {\n\t\t${4:// 成功处理}\n\t}\n})'
            },
            Get: {
                label: "Get",
                kind: "Method",
                documentation: 'GET请求\n\n示例:\nV8.Get("/api/xxx", {}, function(result) {});',
                insertText: "Get",
                snippet: 'Get("${1:/api/xxx}", {}, function(result) {\n\t${2:// 处理结果}\n})'
            },

            // ========== UI交互方法 ==========
            Tips: {
                label: "Tips",
                kind: "Method",
                documentation:
                    '右下角弹出消息提示\n\n参数:\n  - msgContent: 消息内容\n  - success: true(成功,1秒后消失) / false(错误,5秒后消失)\n  - time: 提示框多少秒后消失(可选)\n\n示例:\nV8.Tips("操作成功", true);\nV8.Tips("错误信息", false, 10);',
                insertText: "Tips",
                snippet: 'Tips("${1:message}", ${2:true})'
            },
            ConfirmTips: {
                label: "ConfirmTips",
                kind: "Method",
                documentation:
                    '确认提示框（回调式，不返回等待用户选择的 Promise）。\n\ncontent 会按 HTML 渲染，只能使用可信或已转义内容；严禁直接拼接用户输入、接口文本或数据库富文本。复杂表单/列表/上传/步骤页面使用 V8.OpenAppDialog。\n\n参数:\n  - message: 确认消息\n  - okCallback: 确认回调\n  - cancelCallback: 取消回调(可选)\n  - option: 选项配置(可选)\n\n示例:\nV8.ConfirmTips("确认删除?", function() {\n  // 确认后的操作\n});',
                insertText: "ConfirmTips",
                snippet: 'ConfirmTips("${1:message}", function() {\n\t${2:// 确认后的操作}\n})'
            },

            // ========== 工具方法 ==========
            IsNull: {
                label: "IsNull",
                kind: "Method",
                documentation: '判断值是否为空\n\n当值为null、undefined、""(空字符串)、"null"、"undefined"时，均返回true\n\n示例:\nif(V8.IsNull(value)) { ... }',
                insertText: "IsNull",
                snippet: "IsNull(${1:value})"
            },
            NewGuid: {
                label: "NewGuid",
                kind: "Method",
                documentation: "生成前端GUID\n\n示例:\nvar newGuid = V8.NewGuid();",
                insertText: "NewGuid",
                snippet: "NewGuid()"
            },
            ChineseToPinyin: {
                label: "ChineseToPinyin",
                kind: "Method",
                documentation:
                    '中文转拼音\n\n参数:\n  - chinese: 中文字符串\n  - fullPyLen: 前几个字转换为全拼音\n  - type: 1(驼峰,默认) / 2(全大写) / 3(全小写)\n\n示例:\nvar pinyin = V8.ChineseToPinyin("你好吾码", 2, 1);',
                insertText: "ChineseToPinyin",
                snippet: 'ChineseToPinyin("${1:中文}", ${2:2}, ${3:1})'
            },

            // ========== Base64 编码/解码 ==========
            Base64: {
                label: "Base64",
                kind: "Module",
                documentation: "Base64 编码/解码工具；不是加密，不能用于保护密码或密钥。",
                insertText: "Base64",
                methods: {
                    encode: {
                        label: "encode",
                        kind: "Method",
                        documentation: "Base64编码",
                        insertText: "encode",
                        snippet: 'encode("${1:str}")'
                    },
                    decode: {
                        label: "decode",
                        kind: "Method",
                        documentation: "Base64解码",
                        insertText: "decode",
                        snippet: 'decode("${1:base64str}")'
                    },
                    isValid: {
                        label: "isValid",
                        kind: "Method",
                        documentation: "判断字符串是否为有效 Base64。",
                        insertText: "isValid",
                        snippet: 'isValid("${1:value}")'
                    }
                }
            },

            // ========== 路由和窗口 ==========
            Router: {
                label: "Router",
                kind: "Module",
                documentation: "路由对象",
                insertText: "Router",
                methods: {
                    Push: {
                        label: "Push",
                        kind: "Method",
                        documentation: '页面跳转\n\n示例:\nV8.Router.Push("/notice");',
                        insertText: "Push",
                        snippet: 'Push("${1:/path}")'
                    }
                }
            },
            Window: {
                label: "Window",
                kind: "Module",
                documentation: "窗口对象",
                insertText: "Window",
                methods: {
                    Open: {
                        label: "Open",
                        kind: "Method",
                        documentation: '打开新窗口\n\n示例:\nV8.Window.Open("https://microi.net");',
                        insertText: "Open",
                        snippet: 'Open("${1:url}")'
                    }
                }
            },

            // ========== 工作流 ==========
            WF: {
                label: "WF",
                kind: "Module",
                documentation: "工作流对象(WorkFlow)",
                insertText: "WF",
                methods: {
                    StartWork: {
                        label: "StartWork",
                        kind: "Method",
                        documentation:
                            '发起流程\n\n参数:\n  - FlowDesignId: 流程图Id(必传)\n  - TableRowId: 关联数据Id(必传)\n  - FormData: 表单数据(可选)\n\n示例:\nV8.WF.StartWork({\n  FlowDesignId: "xxx",\n  TableRowId: V8.Form.Id\n}, function(result) {\n  V8.Tips("发起成功!");\n});',
                        insertText: "StartWork",
                        snippet: 'StartWork({\n\tFlowDesignId: "${1:flowId}",\n\tTableRowId: ${2:V8.Form.Id}\n}, function(result) {\n\t${3:// 处理结果}\n})'
                    }
                }
            },

            // ========== 扫码功能 ==========
            Method: {
                label: "Method",
                kind: "Module",
                documentation: "V8扩展方法对象\n\n包含平台提供的扩展功能方法，如扫码等",
                insertText: "Method",
                methods: {
                    ScanCode: {
                        label: "ScanCode",
                        kind: "Method",
                        documentation: '扫一扫 — 调用摄像头扫描二维码/条形码\n\n异步方法，扫码结果存入 V8.ScanCodeRes\n支持：摄像头扫码、手动输入条码、图片上传识别\n\n示例:\nif (V8.Method?.ScanCode) {\n    await V8.Method.ScanCode();\n    if (V8.ScanCodeRes) {\n        V8.FormSet("Saoma", V8.ScanCodeRes);\n    }\n}',
                        insertText: "ScanCode",
                        snippet: "ScanCode()"
                    }
                }
            },
            Identity: {
                label: "Identity",
                kind: "Module",
                documentation: "登录后的强身份验证模块。前端只申请短期一次性票据；敏感业务接口必须在后端使用 V8.Method.ConsumeIdentityVerificationTicket 原子消费，不能仅相信前端成功结果。",
                insertText: "Identity",
                methods: {
                    GetCapabilities: {
                        label: "GetCapabilities",
                        kind: "Method",
                        documentation: "读取当前租户 Passkey、Authenticator TOTP、严格人脸及当前用户登记状态。",
                        insertText: "GetCapabilities",
                        snippet: "GetCapabilities()"
                    },
                    CreateActionHash: {
                        label: "CreateActionHash",
                        kind: "Method",
                        documentation: "使用 SHA-256 对稳定业务载荷生成 ActionHash。后端必须按同样的规范重算，不能直接相信前端摘要。",
                        insertText: "CreateActionHash",
                        snippet: "CreateActionHash(${1:JSON.stringify({ Id: V8.Form.Id, Action: 'Approve' })})"
                    },
                    Verify: {
                        label: "Verify",
                        kind: "Method",
                        documentation: "使用 Passkey、Authenticator TOTP 或严格人脸为自定义敏感操作申请一次性票据。Purpose 与 ActionHash 必填；Method=Totp 时同时传 6 位 Code。返回 Data.Ticket；票据只能在后端消费一次。",
                        insertText: "Verify",
                        snippet: "Verify({\n\tPurpose: \"${1:ApproveSensitiveOperation}\",\n\tActionHash: ${2:actionHash},\n\tMethod: \"${3:Auto}\"\n})"
                    },
                    RegisterPasskey: {
                        label: "RegisterPasskey",
                        kind: "Method",
                        documentation: "为当前登录用户登记 Passkey。通常优先引导用户进入个人设置统一管理。",
                        insertText: "RegisterPasskey",
                        snippet: "RegisterPasskey({ DeviceName: \"${1:我的设备}\" })"
                    }
                }
            },
            ScanCodeRes: {
                label: "ScanCodeRes",
                kind: "Property",
                documentation: "扫码结果\n\n调用 V8.Method.ScanCode() 后，扫码结果存入此属性\n\n示例:\nawait V8.Method.ScanCode();\nvar code = V8.ScanCodeRes;\nV8.FormSet(\"BarcodeField\", code);",
                insertText: "ScanCodeRes"
            },
            Print: {
                label: "Print",
                kind: "Module",
                documentation: "蓝牙打印模块\n\n提供 TSC(TSPL) 标签和 ESC/POS 小票的 BLE 直连打印。5+App 使用 plus.bluetooth；存在 navigator.bluetooth.requestDevice 的 PC/H5 浏览器使用 Web Bluetooth。PC/平板右上角和移动端【我的】页共用同一连接状态与连接页。V8.Print 存在不等于当前环境可连接，必须调用 isConnected() 并处理连接页结果。\n\n核心 API：\n- V8.Print.createNew() — 创建 TSC 标签指令构建器\n- V8.Print.createNewESC() — 创建 ESC/POS 票据指令构建器\n- await V8.Print.OpenBluetoothPage() — 打开连接页，关闭时返回是否已连接\n- await V8.Print.reconnect() — 使用已记住的授权或设备 ID 重连\n- V8.Print.getConnectionState() — 获取可展示的连接快照\n- V8.Print.subscribeConnection(listener) — 订阅连接状态\n- await V8.Print.prepareSend(data) — 进入应用级队列并串行分包写入\n- V8.Print.Send(data) — 内部分包状态机，业务代码不要直接调用\n- V8.Print.isConnected() — 检测当前连接\n- V8.Print.disconnect() — 主动断开并忘记设备\n- V8.Print.BLEInformation — 仅作诊断的连接元数据\n\n全部前端 V8 上下文共用一个 Print 实例和一条发送队列。业务代码仍应逐次 await，避免用 Promise.all 表达同一设备的并行打印。",
                insertText: "Print",
                methods: {
                    createNew: {
                        label: "createNew()",
                        documentation: '创建 TSC(TSPL) 标签打印指令构建器\n\n全部28个源码方法：init、addCommand、setSize、setSpeed、setDensity、setGap、setBline、setCountry、setCodepage、setCls、setFeed、setBackFeed、setDirection、setReference、setFromfeed、setHome、setSound、setLimitfeed、setBar、setBox、setErase、setReverse、setText、setQR、setBarCode、setBitmap、setPagePrint、getData。低层 addCommand 只允许固定可信命令。\n\n文字、二维码和条码内容会拼入协议字段，应移除引号、换行和控制字符并限制长度。setBitmap 需要 ImageData 风格的 {width,height,data}。\n\n示例:\nvar cmd = V8.Print.createNew();\ncmd.setSize(75, 65);\ncmd.setGap(2);\ncmd.setCls();\ncmd.setText(10, 10, "TSS24.BF2", 1, 1, "Hello");\ncmd.setQR(100, 100, "L", 5, "A", "https://microi.net");\ncmd.setPagePrint();\nawait V8.Print.prepareSend(cmd.getData());',
                        snippet: 'createNew()'
                    },
                    createNewESC: {
                        label: "createNewESC()",
                        documentation: '创建 ESC/POS 票据打印指令构建器\n\n全部25个源码方法：init、setText、setFontSize、bold、setUnderline、setUnderline2、setSelectSizeOfModuleForQRCode、setSelectErrorCorrectionLevelForQRCode、setStoreQRCodeData、setPrintQRCode、setHorTab、setAbsolutePrintPosition、setRelativePrintPositon、setSelectJustification、space、setLeftMargin、textMarginRight、rowSpace、setPrintingAreaWidth、setSound、setBitmap、setPrint、setPrintAndFeed、setPrintAndFeedRow、getData。注意源码公开拼写是 setRelativePrintPositon。\n\n示例:\nvar cmd = V8.Print.createNewESC();\ncmd.init();\ncmd.bold(1);\ncmd.setFontSize(16);\ncmd.setSelectJustification(1);\ncmd.setText("标题\\n");\ncmd.setPrintAndFeedRow(3);\nawait V8.Print.prepareSend(cmd.getData());',
                        snippet: 'createNewESC()'
                    },
                    OpenBluetoothPage: {
                        label: "OpenBluetoothPage()",
                        documentation: '打开蓝牙连接页面\n\n返回 Promise<boolean>，在弹窗关闭时解析；boolean 表示关闭时是否已连接。弹窗已打开时，重复调用返回同一个 Promise。首次选择 Web Bluetooth 设备必须由用户点击等手势触发。不要用 BLEInformation.deviceId 替代实时连接判断。\n\n示例:\nif (!V8.Print.isConnected()) {\n    var connected = await V8.Print.OpenBluetoothPage();\n    if (!connected || !V8.Print.isConnected()) return;\n}',
                        snippet: 'OpenBluetoothPage()'
                    },
                    prepareSend: {
                        label: "prepareSend(data)",
                        documentation: '发送打印数据到蓝牙打印机\n\n异步检查或恢复连接，并进入应用级共享队列后串行分包写入；无法恢复时打开连接页。必须 await，不要用 Promise.all 表达同一设备的并行打印。成功只表示 BLE 写入完成，不代表物理走纸或无缺纸故障。\n\n参数：data — 非空指令字节数组（由 createNew().getData() 或 createNewESC().getData() 返回）\n\n示例:\nvar cmd = V8.Print.createNew();\n// ... 构建指令 ...\nawait V8.Print.prepareSend(cmd.getData());',
                        snippet: 'prepareSend(${1:data})'
                    },
                    isConnected: {
                        label: "isConnected()",
                        documentation: '检测蓝牙是否已连接\n\n返回 boolean。Web 端检查实时 GATT 和写特征；5+App 根据连接事件维护的在线标记以及设备/写特征 ID 判断。任何环境都仍需捕获写入期间的物理断线。\n\n示例:\nif (V8.Print.isConnected()) {\n    // 可以尝试发送，仍需捕获写入异常\n}',
                        snippet: 'isConnected()'
                    },
                    reconnect: {
                        label: "reconnect(options)",
                        documentation: '使用已记住的设备重连\n\n返回 Promise<boolean>，不会弹出浏览器设备选择框。5+App 使用已保存 deviceId；Web 端仅在浏览器仍保留授权且支持 navigator.bluetooth.getDevices() 时可自动取回设备。失败后可调用 OpenBluetoothPage() 让用户重新选择。\n\n示例:\nvar connected = await V8.Print.reconnect();\nif (!connected) await V8.Print.OpenBluetoothPage();',
                        snippet: 'reconnect()'
                    },
                    getConnectionState: {
                        label: "getConnectionState()",
                        documentation: '获取连接状态快照\n\n返回 engine、supported、status、connected、remembered、deviceId、deviceName、autoReconnect、error、changedAt 等字段。用于展示状态；打印前仍以 isConnected() 和 prepareSend() 为准。',
                        snippet: 'getConnectionState()'
                    },
                    subscribeConnection: {
                        label: "subscribeConnection(listener)",
                        documentation: '订阅连接状态变化\n\n注册后立即收到一次当前快照，并在连接、断开、重连或不支持时继续回调。返回取消订阅函数，组件销毁时必须调用。\n\n示例:\nvar unsubscribe = V8.Print.subscribeConnection(function (state) {\n    console.log(state.status, state.deviceName);\n});\n// 页面销毁时 unsubscribe();',
                        snippet: 'subscribeConnection(${1:function (state) {\n\t$0\n}})'
                    },
                    disconnect: {
                        label: "disconnect()",
                        documentation: '主动断开蓝牙连接并忘记设备\n\n会停止自动重连并清除本地保存的设备信息；下次需要在连接页重新选择设备。\n\n示例:\nV8.Print.disconnect();',
                        snippet: 'disconnect()'
                    },
                    setOneTimeData: {
                        label: "setOneTimeData(bytes)",
                        documentation: '设置每次发送的字节数\n\n参数：bytes — 1-512 的整数；默认20，连接页内置候选20-190（步长10）。目标打印机真正支持的包长仍需实机验证。非法值会抛出异常。\n\n示例:\nV8.Print.setOneTimeData(100);',
                        snippet: 'setOneTimeData(${1:100})'
                    },
                    setPrinterNum: {
                        label: "setPrinterNum(num)",
                        documentation: '设置同一缓冲区的重复发送份数\n\n参数：num — 1-99 的整数，默认1；连接页内置候选1-9。非法值会抛出异常。不同内容的批次应逐条 await prepareSend，不使用此方法代替循环。\n\n示例:\nV8.Print.setPrinterNum(3); // 同一内容发送3份',
                        snippet: 'setPrinterNum(${1:1})'
                    }
                }
            }
        }
    }
};

/**
 * 生成Monaco编辑器的CompletionItem
 */
export function createV8CompletionItems(monaco, range) {
    const suggestions = [];

    suggestions.push({
        label: V8ApiDefinitions.V8.label,
        kind: monaco.languages.CompletionItemKind.Module,
        documentation: { value: V8ApiDefinitions.V8.documentation },
        insertText: V8ApiDefinitions.V8.insertText,
        range: range
    });

    return suggestions;
}

/**
 * 根据上下文获取V8属性的建议
 */
export function getV8PropertySuggestions(monaco, objectPath, range) {
    const suggestions = [];
    const parts = objectPath.split(".");

    if (parts.length === 1 && parts[0] === "V8") {
        // 获取V8的一级属性
        const properties = V8ApiDefinitions.V8.properties;
        for (const key in properties) {
            const prop = properties[key];
            const kindMap = {
                Property: monaco.languages.CompletionItemKind.Property,
                Method: monaco.languages.CompletionItemKind.Method,
                Module: monaco.languages.CompletionItemKind.Module
            };

            suggestions.push({
                label: prop.label,
                kind: kindMap[prop.kind] || monaco.languages.CompletionItemKind.Property,
                documentation: { value: prop.documentation },
                insertText: prop.snippet || prop.insertText,
                insertTextRules: prop.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                range: range
            });
        }
    } else if (parts.length === 2 && parts[0] === "V8") {
        // 获取二级属性的方法
        const secondLevel = parts[1];
        const property = V8ApiDefinitions.V8.properties[secondLevel];

        if (property && property.methods) {
            for (const key in property.methods) {
                const method = property.methods[key];
                suggestions.push({
                    label: method.label,
                    kind: monaco.languages.CompletionItemKind.Method,
                    documentation: { value: method.documentation },
                    insertText: method.snippet || method.insertText,
                    insertTextRules: method.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            }
        }
    }

    return suggestions;
}

export default {
    V8ApiDefinitions,
    createV8CompletionItems,
    getV8PropertySuggestions
};
