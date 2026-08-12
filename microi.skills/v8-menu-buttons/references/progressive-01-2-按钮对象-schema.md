# v8-menu-buttons 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-menu-buttons-004 sha256=f18f04c54a81c7aaf5c79867eda0f7ec716a5e9b05c723dae9b77cde127326f3 -->
## 2. 按钮对象 Schema

```jsonc
{
  "Id": "01K...",            // ULID 或 GUID，必填且唯一
  "Sort": 0,                  // 排序
  "Name": "指派",             // 中文按钮名
  "Icon": "fas fa-user",      // 可选，FontAwesome 类名
  "BtnStyle": "primary",      // primary | success | warning | danger | (空)
  "IsVisible": true,          // 是否参与渲染（false 则完全隐藏）
  "ShowRow": true,            // MoreBtns 必填：true 显示在行内，false 收进"更多"
  "V8CodeShow": "...",        // 显隐表达式 JS：return true/false 或赋值 V8.Result=true/false
  "V8Code": "...",            // 点击执行的 JS（前端 V8 上下文）
  "Url": "",                  // 可选：直接跳转 URL（不与 V8Code 同用）
  "TargetSysMenuId": "",      // 仅 PageTabs：关联另一个 sys_menu.Id，替换路由并完整加载目标模块
  "RunBackground": false,      // 可选：true 时以后台任务执行接口引擎
  "BackgroundTask": false,     // 可选：兼容别名
  "IsBackgroundTask": false,   // 可选：兼容别名
  "ApiEngineKey": "",          // 可选：后台任务要执行的接口引擎 Key
  "BadgeEnabled": true,         // 可选：显示统计角标
  "BadgeApiEngineKey": "button_counts",
  "BadgeValuePath": "",        // 可选：如 Data.Rows.{RowId}.button-id
  "BadgeField": "",            // 行按钮读当前行；PageTab/页面按钮读模块 StatisticsFields，不请求接口
  "BadgeTone": "primary",      // primary/success/warning/danger/info
  "BadgeMax": 99,
  "BadgeShowZero": false,
  "BadgeRefreshSeconds": 60
}
```

### 统计角标接口契约

角标适用于附件数、日志数、未处理子记录等“点击按钮后有明确行动”的数量。
`PageTabs/MoreBtns/PageBtns/BatchSelectMoreBtns/ExportMoreBtns/FormBtns` 都可配置。前端按不同
`BadgeApiEngineKey` 分组，每个接口仅调用一次，并传入 `Ids`（当前页行 Id）、
`ButtonKeys`、`SysMenuId/_SysMenuId`、`DiyTableId` 和筛选上下文。

推荐一次返回页面级与逐行结果：

```js
return {
  Code: 1,
  Data: {
    Buttons: { 'button-id': 12 },
    Rows: {
      'row-id-1': { 'button-id': 2 },
      'row-id-2': { 'button-id': 0 }
    }
  }
};
```

按钮和 PageTab 必须有稳定 `Id`，否则只能回退用 `Name` 匹配。`Data.Buttons` 同时用于页面按钮和 PageTabs；页签可通过 `BadgeValuePath=Data.Buttons.{TabId}` 显式取值。PageTabs/页面按钮若使用 `BadgeField`，必须同时把该字段加入模块 `StatisticsFields`，读取页面汇总值。不要在按钮 V8、Tab V8、模板引擎或每行
生命周期里单独查数量；后端应按 `Ids` 批量 `GROUP BY`，并继续应用租户、菜单和数据权限。
统计失败只隐藏角标，不能阻断按钮本身或 PageTab 切换。

### JsonTable 内嵌选择器的数据源代理

`PageTabs/MoreBtns/PageBtns/BatchSelectMoreBtns/ExportMoreBtns/FormBtns` 都是 `JsonTable` 字段，
其中的列对象不是独立 `diy_field`。内嵌 `Select/Radio/Checkbox/Autocomplete/Cascader/SelectTree`
一旦使用 `Sql/DataSource/ApiEngine` 服务端数据源，必须在列的 `Config.DataSourceFieldId` 中填写
同租户、同表内一个真实且权限等价的 `diy_field.Id`。禁止把内嵌列的 `Key` 或列 `Id` 当成
字段 Id，否则打开“模块设计-按钮”时会触发“DiyField 数据不存在”，并使同批字段数据加载失败。

远程 SQL 搜索还应同时设置 `DataSourceSqlRemote=true`，使用 `$Keyword$` 参数并限制返回条数；
应用包回归测试必须逐个校验所有按钮集合的代理字段真实存在、保存字段/显示字段一致。

### PageTabs 关联模块

- 列表页固定顺序为“模块 Hero（标题/副标题/动态指标）→ PageTabs → 查询与表格”；PageTabs 不能渲染到 Hero 上方，也不能重复承担模块标题。
- `TargetSysMenuId` 为空时，页签仍在当前模块执行 `V8Code` 和重新查询。
- `TargetSysMenuId` 指向其它模块时，点击会替换当前路由，并使用目标模块自己的表单引擎、字段、查询接口替换、按钮和分页配置完整初始化。
- 目标模块可以设置 `Display=0、AppDisplay=0` 隐藏左侧菜单，但必须给使用角色分配菜单权限，否则动态路由中找不到目标模块。
- 组成一组的所有模块应保存同一套 PageTabs；跨模块页签负责导航，目标模块加载后再根据路由 `Tab` 执行对应页签 V8。
- 禁止在 `diy-table` 或 mixin 中按模块名、Url、表名写死页签数据源。

### V8CodeShow（显隐控制）—— 支持 `return` 和 `V8.Result`

未配置 `V8CodeShow`，或代码执行后既没有 `return true/false`、也没有设置
`V8.Result = true/false` 时，显示条件默认按“显示”处理；只有明确
`return false` 或 `V8.Result = false` 才由显示条件隐藏按钮。角色按钮权限仍是
独立约束，不应通过省略显示条件绕过。

推荐写法：直接返回布尔值。

```js
// 仅当状态为"待指派"且无负责人时显示
return V8.Form.Status == '待指派' && !V8.Form.AssigneeId;
```

兼容旧写法：给 `V8.Result` 赋布尔值。

```js
// 仅当状态为"待指派"且无负责人时显示
if (V8.Form.Status == '待指派' && !V8.Form.AssigneeId) {
  V8.Result = true;
} else {
  V8.Result = false;
}
```

### V8Code 上下文常用变量
| 变量 | 说明 |
|------|------|
| `V8.Form` | 当前行/表单数据 |
| `V8.FormMode` | `Add` / `Edit` / `View` |
| `V8.TableId` | 当前 diy_table 的 Id |
| `V8.TableRowSelected` | 批量按钮里勾选的行数组 |
| `V8.CurrentUser` | 登录用户 |
| `V8.ClientType` | `PC` / `IOS` / `Android` / `H5` / `WeChat` |
| `V8.Tips(msg, ok?)` | 浮层提示 |
| `V8.ConfirmTips(msg, cb)` | 确认弹窗 |
| `V8.RefreshTable({_PageIndex:1})` | 刷新列表 |
| `V8.SearchSet({Field:value})` | 设置/重置筛选条件（PageTabs 常用）|
| `V8.OpenAnyForm({...})` | 弹出任意表单（核心：可替换提交事件）|
| `V8.OpenAppDialog({...})` | 按 AppKey 打开已发布在线微服务定制页 |
| `V8.FormSubmit({...})` | 提交当前表单 |
| `V8.FormSet(field, val)` | 普通表单触发目标字段 V8；列表上下文只更新当前行/模板 |
| `V8.ApiEngine.Run({...})` | 调用接口引擎（业务逻辑必走）|
| `V8.ApiEngine.RunBackground(...)` | 启动后台任务（用于安装、导入、初始化等长任务）|

### V8Code 格式化强制要求
- AI、MCP、VS Code 插件或脚本生成 `V8Code` / `V8CodeShow` 时，必须保存为可读的多行 JavaScript，包含换行和缩进；禁止把完整逻辑压成一整行。
- 写入 `sys_menu.MoreBtns/FormBtns/PageTabs/BatchSelectMoreBtns` 等 JSON 字符串时，也要先按 `.js` 文件格式组织代码，再通过 `JSON.stringify` 或等价方式转义保存。
- `V8.OpenAnyTable`、`V8.OpenAnyForm`、`V8.ApiEngine.Run`、确认弹窗、回调函数等嵌套结构必须分行，回调内部逻辑至少缩进一级。
- 只允许极短的单表达式显隐代码写成一行，例如 `V8.Result = true;`；一旦包含 `if`、`return`、`function`、`async`、数组/对象字面量或接口调用，就必须多行格式化。

格式化示例：
```js
var projectId = V8.Form && V8.Form.Id ? V8.Form.Id : "";
if (!projectId) {
  V8.Tips("缺少项目Id，无法打开关联清单。", false);
  return;
}

V8.OpenAnyTable({
  SysMenuId: "01K...",
  DialogType: "Drawer",
  Width: "80vw",
  MultipleSelect: false,
  PropsWhere: [
    ["XiangmuID", "=", projectId]
  ],
  SubmitEvent: async function(selectData, callback) {
    callback({
      Code: 1,
      Data: selectData
    });
  }
});
```

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-005 sha256=1dddbfaac5cd9a350686ff72c47f1cd5ed022bcdc425a7d54b790537df445cd5 -->
## 5. 模式 C：状态机推进（无需弹窗）

```js
var next = '';
switch (V8.Form.Status) {
  case '待完成': next = '待验收'; break;
  case '待验收': next = '待评价'; break;
}
if (next) {
  var result = await V8.ApiEngine.Run('order_advance_status', {
    Id: V8.Form.Id,
    ExpectedStatus: V8.Form.Status,
    NextStatus: next
  });
  V8.Tips(result.Code == 1 ? '状态已更新' : result.Msg, result.Code == 1);
  if (result.Code == 1) V8.RefreshTable({ _PageIndex: -1 });
}
```

状态机必须由接口引擎校验当前状态、目标状态、权限和并发版本；不要在前端直接更新状态字段。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-006 sha256=86eb74f9e150eb398b010f2cc0a00920669e12f2e6f2729f2443250659e5c0bd -->
## 6. 模式 D：批量操作（BatchSelectMoreBtns）

```js
var rows = V8.TableRowSelected;
if (!rows || rows.length == 0) { V8.Tips('请先勾选数据'); return; }
var ids = rows.map(function (r) { return r.Id; });
V8.ConfirmTips('确认删除选中的 ' + ids.length + ' 条？', function () {
  V8.ApiEngine.Run('order_batch_delete', {
    Ids: ids
  }, function (r) {
    if (r.Code == 1) { V8.Tips('删除成功'); V8.RefreshTable({ _PageIndex: 1 }); }
    else V8.Tips(r.Msg, false);
  });
});
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-007 sha256=cb0ccac7faf880e55f33a510fdf43b024ace93d5c80618ddd6a40ca3efbcbb1b -->
## 7. 模式 E：PageTabs 切换筛选

```js
// PageTab："待办"
V8.SearchSet({ Status: '待办' });

// PageTab："全部"
V8.SearchSet({ Status: '' });
```

`V8CodeShow` 控制此 Tab 在哪种端显示：
```js
// 只在 App 端显示
return V8.ClientType != 'PC';
```

---

<!-- /microi-progressive:chunk -->
