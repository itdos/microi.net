# v8-menu-buttons 详细参考 3

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-menu-buttons-013 sha256=1d6b1f06fb41007012f9ce2b57913404549a40d1e52f6a87a69f8079c6bf6919 -->
## 10. 反模式（避免）

❌ 把所有业务逻辑塞进 `V8Code`，不创建接口引擎
✅ 前端 `V8Code` 只负责弹窗/确认/刷新；业务逻辑写在接口引擎

❌ 依赖非布尔返回值隐藏按钮
✅ 需要隐藏时显式 `return false;` 或 `V8.Result = false;`；未返回布尔值默认显示

❌ `MoreBtns` 不写 `ShowRow:true`，按钮看不见
✅ 行内必须 `ShowRow:true`

❌ 在 `diy-table.vue` / 卡片模板 / action-width mixin 中按模块、Url 或表名硬编码业务行按钮，或为单个业务面板新增 `V8.Open<业务名>`
✅ 入口完整保存在 `sys_menu.MoreBtns`；主前端组件用 `V8.OpenDialog`，在线微服务用 `V8.OpenAppDialog`；验收同时回读按钮 JSON、打开模块引擎设计器，并检查运行态

❌ 按钮 `Id` 重复或省略
✅ 用 ULID/GUID 保证唯一

❌ `BatchSelectMoreBtns` 用 `V8.Form` 取数据
✅ 必须用 `V8.TableRowSelected`

❌ 在 `V8.ConfirmTips` 中拼接复杂 HTML、表单、列表、Tab、代码编辑器或多步骤向导
✅ 先用 `microi_list_applications` / `microi_get_application_context` 查找现有微服务；优先在已有微服务新增页面，否则通过 MCP 创建微服务，再用 `V8.OpenAppDialog` 打开

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-014 sha256=746db9437039915f805d5e2e34741506060ee8739ea1a436ae3f7af8bb0ccdfc -->
## 10.2 复杂定制弹窗必须使用微服务

`V8.ConfirmTips` 只适合纯文本确认或极少量一次性输入。出现以下任一情况即视为复杂页面：三个以上字段、响应式布局、联动校验、上传、表格、Tab、步骤条、代码编辑器、需要复用、后续会持续迭代。

复杂页面标准流程：

1. `microi_list_applications({ appType: 'MicroService' })` 获取现有微服务及文件清单。
2. `microi_get_application_context({ appIdOrKey: '<AppKey>' })` 读取完整源码，判断应新增页面还是新建应用。
3. 新建时使用 `microi_create_microservice` 注册元数据，`microi_sync_microservice_source` 上传私有源码，`microi_publish_microservice` 上传公有编译产物和页面路由。
4. 菜单按钮只负责调用 `V8.OpenAppDialog`，把业务数据放入 `Data`，通过 `OnSuccess / OnError / OnClose` 与宿主交互。

```js
V8.OpenAppDialog({
  AppKey: 'official-admin-app',
  RoutePath: '/tenant/create',
  Title: '创建租户',
  Width: 'min(960px, calc(100vw - 32px))',
  Data: { Source: 'SaaSMenu' },
  OnSuccess: function (result) {
    V8.Tips((result && result.message) || '处理成功', true);
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnError: function (error) {
    V8.Tips((error && error.message) || '页面处理失败', false);
  }
});
```

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-015 sha256=c019984973cb3c722e63c34f268440f300fdd8e2e672fd629e9d6769a676ffa8 -->
## 11. ⚠️ `V8.CurrentUser` 拿不到的历史陷阱（必看）

### 现象
`diy-form-full.vue`（弹窗 / 详情 / 全屏表单）的 `FormBtns` / `PageBtns` / `PageTabs` / `BatchSelectMoreBtns` / `ExportMoreBtns` 中：
- 编写 `V8.CurrentUser._IsAdmin` 总是 `undefined`
- `V8CodeShow` 里靠用户角色判断的隐藏逻辑全部失效
- 但 `diy-table.vue` 的 `MoreBtns` 同样代码却**正常**

### 根因（2026-05 已修）
`diy.common.js` 中有一个**进程级单例缓存** `DiyCommon._V8BaseInstance`：
```js
// 旧 BUG 写法
DiyCommon._V8BaseInstance = {
  CurrentUser : store.state.DiyStore.GetCurrentUser,   // ← Pinia getter 不在 $state 里，永远 undefined
  CurrentToken: DiyCommon.getToken(),                  // ← 只算了一次，登录态变化后过期
  SysConfig   : store.state.DiyStore.SysConfig,
  ...
}
```
- `store.state.DiyStore` 是 Pinia 的 `$state` 兼容层，**只有 state 字段**，**不包含 getter**。`GetCurrentUser` 是 getter → 取到 `undefined`。
- `_V8BaseInstance` 是模块级单例，第一次构建后所有 `InitV8Code` 都会 `Object.assign(V8, _V8BaseInstance)`。
- `diy-form-full.vue` 调用顺序是：`SetV8DefaultValue` → `InitV8Code` → `Object.assign` 把 V8.CurrentUser 改回 undefined。
- `diy-table.vue` 调用顺序是：`InitV8Code` → `SetV8DefaultValue`，新鲜值后写胜出，所以没问题。

### 正确做法
1. **不要把会话级 / 用户级状态写进进程级单例缓存**（CurrentUser / Token / SysConfig）。
2. 在 `InitV8Code` / `InitV8CodeSync` 的 `Object.assign` 之后，调用 `DiyCommon._RefreshV8DynamicContext(V8)`，始终从 `useDiyStore()` 实例（而不是 `$state`）取最新值：
   ```js
   var diyStore = getDiyStore();
   V8.CurrentUser = diyStore.GetCurrentUser;   // Pinia getter，必须经 store 实例
   V8.SysConfig   = diyStore.SysConfig;
   V8.CurrentToken= DiyCommon.getToken();
   ```
3. 任何按钮组件（包括将来新增的 `PageBtns`、自定义 Tab 等）都**不需要**再单独 set `CurrentUser`，统一由 `_RefreshV8DynamicContext` 保证。

### AI 编写按钮时的检查清单
- [ ] `V8CodeShow` 中读 `V8.CurrentUser.RoleName` / `V8.CurrentUser._IsAdmin` 之前，**不**做 `if (!V8.CurrentUser)` 容错回写——容错会反过来掩盖框架问题。
- [ ] 不要在 `V8Code` 里 `Object.assign(V8, {...})`，避免再次覆盖动态字段。
- [ ] 后端接口引擎/表单事件禁止用 `setTimeout` 把业务工作延伸到请求结束之后；可靠异步任务必须使用后台任务、MQ、定时任务或持久化 outbox，并具备幂等与失败恢复。
- [ ] 前端按钮若确需 `setTimeout`，仅限当前页面生命周期内的短时 UI 延迟/防抖。必须保存定时器句柄，在弹窗关闭、组件卸载或租户切换时清理；回调执行前还要确认页面仍有效且 `OsClient` 未变化。前端定时器不能承担写库、同步、通知或其它可靠业务任务。

<!-- /microi-progressive:chunk -->
