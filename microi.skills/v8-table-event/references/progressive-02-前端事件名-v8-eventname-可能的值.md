# v8-table-event 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-table-event-011 sha256=20342f03d457bd86d1d3e4b80ee8f2ffa254f0b60312a18bc3dab2ce2d448308 -->
## 前端事件名（V8.EventName 可能的值）

| 值 | 说明 |
|---|---|
| `FormIn` | 进入表单事件 |
| `FormSubmitBefore` | 提交前事件 |
| `FormOut` | 离开表单事件 |
| `FieldValueChange` | 字段值变更事件 |
| `FieldOnKeyup` | 文本框键盘事件 |
| `TableFieldOnKeyup` | 表格行内文本框键盘事件 |
| `FieldSlotButtonClick` | 单行文本插槽按钮点击事件 |
| `V8BtnRun` | V8 按钮执行事件 |
| `V8BtnLimit` | V8 按钮是否显示事件 |
| `BtnFormDetailRun` | 详情按钮 V8 按钮 |
| `TableRowClick` | 表格行点击 V8 事件 |
| `OpenTableBefore` | 弹出表格前事件 |
| `OpenTableSubmit` | 弹出表格提交事件 |
| `PageTab` | 多 Tab 页签 V8 事件 |
| `WFNodeStart` | 流程节点开始 V8 事件 |
| `WFNodeEnd` | 流程节点结束 V8 事件 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-012 sha256=380fc790dcf02a27f8b47d9a894b98cb90ebc7ea6b57a5b30075d3d9d32a0262 -->
## 注意事项

- 前端事件可使用 `window` 对象和 `async/await`，后端事件不可以
- 后端提交前/后事件返回 `{ Code: 0, Msg: '...' }` 可阻止数据写入并回滚事务
- 直接修改 `V8.Form` 的字段值即可改变最终写入的数据
- 后端事件中使用 `V8.FormEngine` 默认是 Server 调用，不触发目标表事件；`_InvokeType:'Client'` 恰好会触发目标表事件，不能用于“避免递归”
- `_InvokeType:'Server'` 只表达事件调用语义，不是客户端授权开关；浏览器伪造它不会获得受信任权限
- `V8.FormSubmitAction` 的值是 `'Insert'`/`'Update'`/`'Delete'`（非 Add/Upt/Del）
- 在 DataFilterV8 中使用 `V8.CacheData` 缓存查询结果，避免每行执行 N+1 查询
- 表事件调用下游接口时，`diy_table.V8Unlimited` 不会自动放开下游接口；下游 `sys_apiengine.V8Unlimited` 必须独立配置，避免一次开关无边界扩散到整条调用链

### 复盘：提交后事件误把增量表单当作完整记录

- 触发场景：插件、MCP 或后端只更新代码等少数字段时，`SubmitAfterServerV8` 直接对 `V8.Form.Id`、业务 Key 调用 `toLowerCase()`，保存动作因字段未出现在增量参数中而异常。
- 根因：事件假设 `V8.Form` 始终包含整行数据，没有兼容稀疏更新（sparse patch）。
- 通用规则：提交后事件使用非本次必传字段前，必须从 `V8.OldForm` 合并兜底，或凭已有 `Id` 回查当前记录；调用字符串方法前先显式 `String(...)` 并校验空值。写缓存时应缓存合并后的完整模型，不能用稀疏对象覆盖整行缓存。
- 自动化检查：分别只更新一个普通字段、只更新大文本代码字段并执行一次完整表单保存；事件均不得报错，按 Id、唯一 Key 和可选地址回读缓存都应得到完整记录。
<!-- /microi-progressive:chunk -->
