# v8-frontend-events 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-frontend-events-006 sha256=f9b273e42b9bf94893ecef53797876a373ad92d46f421c90c603c52259bbd2d2 -->
## 列表事件

### TableRowClick — 行点击

```javascript
// V8.Form === 被点击的行
console.log('点击行：', V8.Form.Id);
// 自定义跳转
V8.OpenAnyForm({ TableName: 'OrderDetail', Id: V8.Form.Id, FormMode: 'View' });
```

### OpenTableBefore — 打开列表前（拦截/初始化筛选）

```javascript
// 固定弹出表格的可选数据范围；搜索、高级筛选、分页不会移除此条件
V8.OpenTableSetWhere(V8.Field.CustomerId, [
  ['OwnerId', '=', V8.CurrentUser.Id]
]);
```

### OpenTableSubmit — 列表查询提交前（追加条件）

```javascript
// V8.Param 是即将发起查询的参数
V8.Param._Where = V8.Param._Where || [];
V8.Param._Where.push(['DeptId', '=', V8.CurrentUser.DeptId]);
```

### PageTab — 页签切换

```javascript
// PageTab："待办"
V8.SearchSet({ Status: '待办' });
V8.RefreshTable({ _PageIndex: 1 });
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-007 sha256=3a8ad420eed127357a6b5e799792325bc5c152ff8607722a7dc96c252fae0da2 -->
## 常用前端 API

| API | 说明 |
|-----|------|
| `V8.Tips(msg, ok?)` | 浮层提示。`ok=true` 绿色 |
| `V8.ConfirmTips(msg, cb)` | 回调式确认弹窗；内容按 HTML 渲染，只能传可信/已转义文本 |
| `V8.FormSet(field, value)` | 普通表单会触发目标字段 V8；列表上下文只更新当前行/模板 |
| `V8.FieldSet(field, prop, value)` | 设置字段属性；跨上下文只依赖顶层 Visible/Required/Readonly/Data |
| `V8.FormSubmit({CloseForm:true})` | 提交当前表单 |
| `V8.RefreshTable({_PageIndex:1})` | 刷新表格（-1 保持当前页） |
| `V8.SearchSet({field: value})` | 设置筛选条件 |
| `V8.OpenAnyForm({...})` | 打开任意表单（弹窗/抽屉） |
| `V8.OpenAnyTable({...})` | 打开任意列表 |
| `V8.OpenDialog({...})` | 打开自定义弹窗 |
| `V8.OpenAppDialog({...})` | 按 AppKey 打开已发布在线微服务页面，支持 Dialog/Drawer 与结果回调 |
| `V8.ApiEngine.Run({ApiEngineKey, ...})` | 调接口引擎（前端，参数对象格式） |
| `V8.FormEngine.GetTableData(name, params, cb)` | 前端查列表（参数对象、回调或 await） |
| `V8.Post(url, data, cb, errCb, headers, contentType)` | 通用 POST |
| `V8.Method.ScanCode({...})` | 调用当前终端支持的扫码能力 |
| `V8.Print.isConnected()` | 检查当前 BLE 写特征或 Android SPP Socket 是否仍可用 |
| `V8.Print.OpenBluetoothPage()` | 在用户手势中打开蓝牙连接页，返回 Promise |
| `V8.Print.reconnect()` | 使用已记住的设备授权或设备 ID 尝试重连 |
| `V8.Print.getConnectionState()` | 获取连接、设备、传输、型号、指令、记忆和错误状态快照 |
| `V8.Print.subscribeConnection(listener)` | 订阅应用级共享连接状态，返回取消订阅函数 |
| `V8.Print.getPrinterProfile()` | 查看自动识别或手工选择后的型号配置 |
| `V8.Print.setPrinterProfile(mode)` | 广播名无法识别时选 `zicox-cc4` 等型号；旧业务通常不调用 |
| `V8.Print.prepareSend(bytes)` | 按型号适配后串行分包发送 TSPL、CPCL 或 ESC/POS，必须 `await` |

`V8.OpenAnyForm` 只发起打开动作，不返回“用户关闭后的 Promise”。需要替换
子表单保存时，通过 `EventReplace.Submit(v8, param, callback)` 注册提交替换；
其中小写 `v8` 是子表单上下文，外层 `V8` 仍是父上下文。自定义提交结束后
必须调用 `callback(DosResult)`，否则子表单会一直等待。

### 蓝牙打印最小安全流程

```javascript
if (!V8.Print) {
  V8.Tips('当前客户端未加载蓝牙打印能力', false);
  return;
}

if (!V8.Print.isConnected()) {
  var connected = await V8.Print.OpenBluetoothPage();
  if (!connected || !V8.Print.isConnected()) return;
}

var command = V8.Print.createNew(); // 同一 TSC 调用：GP-M322 原 TSPL，CC4 自动转 CPCL
command.setSize(60, 40);
command.setGap(2);
command.setCls();
command.setText(20, 20, 'TSS24.BF2', 1, 1, '测试标签');
command.setPagePrint();

try {
  await V8.Print.prepareSend(command.getData());
  V8.Tips('打印数据已发送', true);
} catch (error) {
  V8.Tips('发送失败：' + (error.message || error), false);
}
```

PC/平板顶部导航与移动端【我的】页共用同一个应用级 `V8.Print` 实例，用户可先在全局入口连接，再进入任意模块打印。佳博 GP-M322 路径必须保持原 TSPL 字节不变；ZICOX CC4 只转换有明确 CPCL 等价语义的高层 TSC 调用，不支持的命令必须在首包写入前失败，禁止盲目透传乱码。Android 5+App 的 CC4 可在 BLE 失败时使用已配对 SPP，Web 端不能使用经典蓝牙。

`prepareSend` 内部会把不同 V8 上下文排入同一发送队列；成功只证明字节已经写入 BLE 特征或 SPP 输出流，不代表打印机已走纸、无缺纸或无硬件故障。批量打印仍应逐条 `await`，不得用固定 `setTimeout` 猜测完成时间，也不要用 `Promise.all` 表达同一设备的并行打印。完整挂载范围、双型号连接、协议映射、批量恢复、安全与硬件验收见 `references/bluetooth-print.md`；源码级 TSC/ESC/CPCL 方法表见 `references/bluetooth-print-api.md`。

### 常用上下文差异

| 变量 | 可用范围 |
|------|----------|
| `V8.OldForm` | 普通表单已加载旧数据后可用；服务端提交前/后事件也可用 |
| `V8.OldValue` | 仅表格行内字段值变更可靠提供 |
| `V8.Event` | 插槽按钮等显式传原生事件的场景；键盘事件使用 `V8.KeyCode` |
| `V8.Row/Rows/RowIndex` | 表格行事件 |
| `V8.TableRowSelected/SelectedData` | 列表批量按钮，互为兼容别名 |
| `V8.SearchParam` | 列表 `{Keyword, Where}` 搜索快照 |
| `V8.SysMenuModel` | 列表/菜单按钮 |
| `V8.DataAppend` | 打开表单、列表、弹窗时传入的附加数据 |

### 在线微服务弹窗 V8.OpenAppDialog

复杂定制页面使用 `V8.OpenAppDialog`，不要在 V8 事件中内嵌大量 HTML/CSS：

```js
V8.OpenAppDialog({
  AppKey: 'customer_profile_editor',       // 必传：sys_microiservice.MsKey
  RoutePath: '/edit',                      // 可选，默认 /
  Version: '',                             // 可选，空值自动使用当前 BuildVersion
  Title: '编辑客户资料',
  TitleIcon: 'fas fa-user-edit',
  Width: 'min(920px, calc(100vw - 32px))',
  OpenType: 'Dialog',                      // Dialog / Drawer
  Data: { id: V8.Form.Id },                // 子应用 dialogData，只放普通数据
  OnSuccess: function (data) {
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnCancel: function (data) {},
  OnError: function (error) {
    V8.Tips(error.message || '加载失败', false);
  }
});
```

子应用用 `window.microApp.getData()` 获取自动下发的 `apiBase`、`osClient`、`token`、`appKey`、`version`、`microRoute`、`dialog` 和 `dialogData`；用 `window.microApp.dispatch({type:'app-dialog:success', data:{...}})` 返回成功结果。完整参数表和结果协议见 `v8-menu-buttons/SKILL.md`。

### ConfirmTips 的 HTML 安全边界

`V8.ConfirmTips` 当前是 callback API，且内容使用 HTML 模式渲染。只传固定文案或经过 HTML 转义的简单展示；严禁直接拼接用户输入、接口消息、数据库富文本和不可信 URL。三个以上字段、上传、表格、Tab、步骤条、代码编辑器或需要复用的页面必须使用 `V8.OpenAppDialog`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-008 sha256=eebeb0230087c0deb368baac02bd39bb4b5aa054ed19d9aa43be9447f8ef1d6d -->
## 前端 FormEngine 菜单上下文与兼容授权

前端 V8 不需要为每个历史项目手工补 `_SysMenuId`。新版 PC 表单引擎通过作用域 FormEngine facade 透明处理菜单上下文：

- V8 调用的目标表就是当前菜单绑定表时，facade 自动注入真实 `_SysMenuId`；如果业务代码已经显式传入 `_SysMenuId` 或兼容的 `ModuleEngineKey`，平台保留显式值，由后端做严格精确校验。
- V8 查询其它表时，不得把当前主表菜单 Id 带给目标表。facade 保持无菜单，由后端根据当前登录用户有效角色可访问的 `sys_menu` 缓存推断该目标表及当前操作权限。
- 历史 V8 的对象参数、`表名 + 参数`、Promise、回调、批量参数等调用形式继续兼容。业务代码不得自行伪造角色、菜单或 `_TrustedServerInvocation`。
- 平台敏感表仍对普通客户端硬拒绝；Import/Export 仍必须携带目标模块的真实菜单上下文及专项权限，不能依赖无菜单推断。
- 菜单配置的 `SqlWhere`、`SqlJoin` / `JoinTables` 由后端追加到真实查询。前端追加 `_Where` 只能进一步缩小结果，不能扩大或覆盖服务端数据范围。
- 标准 `TableChild` 自动携带内部 `_TableChildAuth` 关系提示。服务端仍会重载父/子表、菜单和字段配置，校验父记录范围并强制子表外键；业务 V8 禁止构造、缓存、跨父记录复用该对象。

```javascript
// 假设当前菜单绑定 Customer：平台 facade 自动注入真实菜单，无需历史 V8 手工改造
var current = await V8.FormEngine.GetFormData('Customer', { Id: V8.Form.Id });

// 跨表：不要传当前表的菜单 Id；后端按用户对 Product 的菜单授权推断
var products = await V8.FormEngine.GetTableData('Product', {
  _Where: [['Status', '=', 1]],
  _PageSize: 20
});
```

后端接口引擎和后端表单 V8 不是浏览器调用链：平台只在服务端内部构造参数时写入 `_TrustedServerInvocation`，所以它们调用 `V8.FormEngine` 不要求 `_SysMenuId`。该标记不能从浏览器 JSON、URL 或表单参数获得，前端 V8 也不得尝试设置。

### 前端 FormEngine 方法矩阵

前端 facade 当前公开 `GetFormData`、`GetFormDataAnonymous`、`GetTableData`、`GetTableTree`、`AddFormData`、`AddFormDataBatch`、`UptFormData`、`UptFormDataBatch`、`UptFormDataByWhere`、`DelFormData`、`DelFormDataBatch`、`DelFormDataByWhere`。全部返回 Promise，并兼容可选 callback。

前端没有 `GetTableDataCount`、`GetTableDataTree`（前端名称是 `GetTableTree`）、`AddTableData`、`UptTableData`、`DelTableData`、`AddField`。Import/Export 是独立端点与专项菜单权限，也不是 facade 方法。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-009 sha256=5e83f07a0fbcebf1eb02f3af5aa58936b3d1c3d19b0a6a0b1a0f14c66fcd6177 -->
## 异步写法（async/await vs 回调）

```javascript
// ✅ 推荐 async/await
var r = await V8.FormEngine.GetTableData('Product', { _PageSize: 10 });
if (r.Code === 1) { /* ... */ }

// ✅ 也可回调式
V8.FormEngine.GetTableData('Product', { _PageSize: 10 }, function(r) {
  if (r.Code === 1) { /* ... */ }
});
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-010 sha256=3ca077a857ffc9f58c7290e26c7e106c0e882897b1b9b669c66b4fe7615c3821 -->
## 死循环陷阱

❌ **禁止** 在 `SubmitFormV8.js` 里调用 `V8.FormSubmit()` —— 会无限递归
⚠️ **避免** 在 `FieldValueChange` 里 `V8.FormSet(同字段)` —— 前端会阻止同步直接重入，但异步回写或多字段互相赋值仍可能形成循环；需要静默赋值时使用 `V8.Form.字段名 = value`
❌ **禁止** 在 `InFormV8.js` 里写大量同步 `V8.FormEngine.Get*` —— 阻塞渲染

### 下拉框对象赋值

```javascript
// 会更新下拉选项并触发 SelectUser 的值变更 V8。
// 对象至少包含 SelectSaveField、SelectLabel 对应的属性；字段事件需要的其它属性也要传入。
V8.FormSet('SelectUser', { Id: 'u1', Name: '张三', DeptId: 'd1' });

// 响应式静默赋值：界面会更新，但不触发目标字段 V8，
// 也不会执行 FormSet 的修改字段记录、模板通知等处理。
V8.Form.SelectUser = { Id: 'u1', Name: '张三', DeptId: 'd1' };
```

<!-- /microi-progressive:chunk -->
