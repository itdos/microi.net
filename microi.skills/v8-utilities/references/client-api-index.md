# 前端 V8 API 索引

本索引对应 `microi.doc/docs/doc/v8-engine/v8-client.md` 和当前
`Microi.Client` V8 定义。业务表字段如 `V8.Form.OrderNo` 不属于平台函数，
应按实际表结构理解。

## 上下文与状态

| API/变量 | 说明 |
|---|---|
| `V8.Form`、`V8.OldForm` | 当前表单与已加载旧值 |
| `V8.FormMode` | `Add`、`Edit`、`View` |
| `V8.FormSubmitAction` | 提交动作 |
| `V8.FormOutAction`、`V8.FormOutAfterAction` | 表单关闭/保存后的动作状态 |
| `V8.LoadMode` | `Design` 或真实运行模式 |
| `V8.EventName`、`V8.Event`、`V8.KeyCode` | 当前事件、原生事件和键码 |
| `V8.ThisValue`、`V8.OldValue` | 当前字段值；`OldValue` 主要用于表格行内事件 |
| `V8.TableId`、`V8.TableName`、`V8.TableModel` | 当前表/表单元数据 |
| `V8.Row`、`V8.Rows`、`V8.RowIndex`、`V8.TableRowId` | 行事件上下文 |
| `V8.TableRowSelected`、`V8.SelectedData` | 批量选中行，兼容别名 |
| `V8.CurrentTableData` | 当前页表格数据 |
| `V8.SearchParam` | 当前搜索快照 |
| `V8.SysMenuId`、`V8.SysMenuModel` | 当前授权菜单 |
| `V8.CurrentUser`、`V8.CurrentToken` | 当前用户和 Token；不得输出到日志/URL |
| `V8.OsClient`、`V8.SysConfig`、`V8.ClientType` | 租户、客户端配置和终端类型 |
| `V8.DataAppend` | 打开表单、列表或弹窗时传入的附加数据 |
| `V8.ParentV8`、`V8.ParentForm` | 子表/弹窗访问父上下文 |
| `V8.ParentV8.Form` | 读取父级表单数据 |
| `V8.ParentV8.FormSet(field,value)` | 从子表调用父表字段赋值与联动 |
| `V8.ApiReplace` | 当前表单/列表接口替换配置，只读使用 |
| `V8.Result` | 模板或事件输出槽 |

## 表单与字段

| API | 说明 |
|---|---|
| `V8.FormSet(field,value)` | 设置字段值并触发相应联动 |
| `V8.Field` | 当前字段模型集合 |
| `V8.FieldSet(field,prop,value)` | 修改 `Visible/Required/Readonly/Data` 等属性 |
| `V8.FormSubmit(options)` | 提交表单；SubmitFormV8 内不得再次调用 |
| `V8.FormClose()` | 强制关闭表单 |
| `V8.CloseThisDialog()` | 关闭当前宿主弹窗/微应用弹窗 |
| `V8.ReloadForm()` | 重新加载当前表单 |
| `V8.HideFormBtn(...)` | 隐藏表单按钮 |
| `V8.HideFormTab(name)`、`V8.ShowFormTab(name)`、`V8.ClickFormTab(name)` | 页签显隐与切换 |
| `V8.GetFormTabs()` | 获取当前表单页签 |
| `V8.ShowTableChildHideField(child,fields)` | 强制显示子表隐藏列并刷新 |
| `V8.GetChildTableData(fieldName)` | 获取指定子表数据 |
| `V8.RefreshChildTable(field,row?)` | 刷新子表 |

## 列表与搜索

| API | 说明 |
|---|---|
| `V8.RefreshTable({_PageIndex})` | 刷新当前列表 |
| `V8.SearchSet(value)` | 替换当前模块搜索条件 |
| `V8.SearchAppend(value)` | 追加当前模块搜索条件 |
| `V8.OpenTableSetWhere(field,where)` | 设置弹出表格不可被临时搜索覆盖的固定范围 |
| `V8.AppendSearchChildTable(field,value)` | 历史兼容；新代码优先 `OpenTableSetWhere` |
| `V8.TableSearchSet(field,value)` | 替换指定子表/表格搜索 |
| `V8.TableSearchAppend(field,value)` | 追加指定子表/表格搜索 |
| `V8.TableRefresh(field,param)` | 刷新指定子表/表格 |
| `V8.ClearTableSelection()` | 清空当前列表勾选 |

## 交互与导航

| API | 说明 |
|---|---|
| `V8.Tips(msg,ok?)` | 消息提示 |
| `V8.ConfirmTips(content,callback,options?)` | HTML 模式确认框，只传可信/转义内容 |
| `V8.Router.Push(...)` | 站内路由 |
| `V8.Window.Open(...)` | 打开窗口 |
| `V8.OpenForm(...)`、`V8.OpenFormWF(...)` | 历史表单/工作流打开入口 |
| `V8.OpenAnyForm(options)` | 打开任意表单 |
| `V8.OpenAnyTable(options)` | 打开任意列表 |
| `V8.OpenDialog(options)` | 打开主前端已注册 Vue 组件 |
| `V8.OpenAppDialog(options)` | 打开已发布 MicroService 页面 |
| `V8.WF.StartWork(...)`、`V8.FormWF` | 前端工作流入口/当前工作流数据 |

三个以上输入、上传、表格、步骤条、Tab 或代码编辑器使用
`V8.OpenAppDialog`，不要在 V8 代码中拼大段 HTML。

## 网络与引擎

| API | 说明 |
|---|---|
| `V8.Http.Get(options)`、`V8.Http.Post(options)`、`V8.Http.PatchResponse(options)` | 推荐前端 HTTP Promise API |
| `V8.Post(...)`、`V8.Get(...)` | 历史回调 API，兼容保留 |
| `V8.ApiEngine.Run(...)` | 调用接口引擎，支持 Promise/回调 |
| `V8.ApiEngine.RunBackground(...)` | 提交持久后台任务 |
| `V8.DataSourceEngine` | 前端数据源引擎对象 |
| `V8.DataSourceEngine.Run(...)` | 运行数据源引擎；旧 `GetData` 已弃用 |
| `V8.FormEngine.GetTableData(...)` | 查询列表 |
| `V8.FormEngine.GetFormData(...)` | 查询单条 |
| `V8.FormEngine.DelFormData(...)` | 删除；权限仍由服务端校验 |

前端 `V8.FormEngine` 真实方法以当前客户端定义为准，均可按 Promise 使用；
不要给前端方法虚构后端专用的 `GetTableDataAsync` 名称。标准前端运行时没有公开
`V8.ModuleEngine`，模块关联查询使用接口引擎、数据源引擎或受控 FormEngine。

## 工具能力

| API | 说明 |
|---|---|
| `V8.IsNull(value)` | 兼容判断 `null/undefined/''/'null'/'undefined'` |
| `V8.ChineseToPinyin(text,fullPyLen,type)` | 中文转拼音 |
| `V8.NewGuid()` | 前端生成 GUID |
| `await V8.NewServerGuid()` | 请求服务端生成 GUID |
| `V8.Base64.encode(value)` | 前端 Base64 编码 |
| `V8.Base64.decode(value)` | 前端 Base64 解码 |
| `V8.Base64.isValid(value)` | 判断字符串是否为有效 Base64 |
| `V8._` | Underscore 实例，如 `V8._.where(...)` |
| `V8.Action.GetDateTimeNow()` | 兼容的前端全局时间函数 |
| `V8.AddSysLog(...)` | 前端发起系统日志记录；不得含秘密 |
| `V8.SendSystemMessage(...)` | 发送站内系统消息 |
| `await V8.Method.ScanCode()` | 扫码；成功值同时写入 `V8.ScanCodeRes` |
| `V8.Print.*` | BLE 标签/小票打印，见蓝牙打印参考 |
| `V8.Identity.GetCapabilities()` | 读取当前租户强身份能力和本人登记状态 |
| `V8.Identity.CreateActionHash(value)` | 为稳定业务命令生成 SHA-256 摘要 |
| `V8.Identity.RegisterPasskey(options?)` | 登记当前用户 Passkey |
| `V8.Identity.Verify({Purpose,ActionHash,Method})` | 完成 Passkey/严格人脸验证并取得一次性后端票据 |

扫码应优先接收 Promise 返回值；兼容代码可在调用后读取 `V8.ScanCodeRes`。
`V8.Identity` 是强身份验证模块。`V8.Identity.Verify` 的成功结果不能直接授权业务；后端必须重读权威数据、重算摘要并调用 `V8.Method.ConsumeIdentityVerificationTicket`。
蓝牙打印完整 API 包含 `V8.Print.createNew`、`V8.Print.createNewESC`、
`V8.Print.OpenBluetoothPage`、`V8.Print.isConnected`、
`V8.Print.prepareSend`、`V8.Print.Send`、`V8.Print.setOneTimeData`、
`V8.Print.setPrinterNum`、`V8.Print.disconnect` 和
`V8.Print.BLEInformation`。其中 `Send` 依赖 `prepareSend` 设置的共享分包游标，
只作内部状态机入口；业务代码必须调用并 `await prepareSend`。当前挂载范围、连接
真实性和串行约束见
[`bluetooth-print.md`](../../v8-frontend-events/references/bluetooth-print.md)，TSC/ESC
完整方法见
[`bluetooth-print-api.md`](../../v8-frontend-events/references/bluetooth-print-api.md)。

## 主前端源码帮助对象

`DiyCommon.GetApiBase()` 是 `Microi.Client` 主前端源码内部取得 API 根地址的帮助
方法，不属于租户前端 V8 的稳定公开对象。V8 代码优先使用受控 `V8.Http` 和
`V8.SysConfig.ApiBase`；MicroService 从宿主数据读取 `apiBase`，不要假设子应用
全局存在 `DiyCommon`。
