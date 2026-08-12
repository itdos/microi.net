# page-engine 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=page-engine-011 sha256=44c991a664b2379ed0d88b8f307e8cfbff27e4c349270cd9872f856f0d0b570b -->
## 版本历史、并发保存与回滚

修改现有页面时必须先读取页面详情中的 `CurrentHash`，保存时把它作为 `expectedHash` 传入，并填写简短 `changeSummary`。不要仅凭本地旧 JSON 覆盖远端页面。

| MCP 工具 | 用途 |
|---|---|
| `microi_list_page_history` | 获取历史元数据与当前哈希 |
| `microi_get_page_history` | 获取指定不可变快照 |
| `microi_compare_page_versions` | 结构化比较两个版本；右侧省略时比较当前页面 |
| `microi_export_page_design` | 导出 `microi.page.v1` 设计包 |
| `microi_rollback_page_design` | 使用 `expectedCurrentHash` 回滚并新增审计版本 |

- 内容规范化后哈希未变化时，不应新增空历史。
- 遇到哈希冲突先重新读取、比较，再决定合并或重做；禁止去掉 `expectedHash` 强行覆盖。
- 回滚不是删除：目标快照成为新当前版本，回滚前内容仍保留。
- 写后必须再次读取页面详情和历史，确认 `CurrentHash`、版本号、变更摘要和 JSON 一致。
- 页面历史属于当前租户数据库；不要假定业务表有物理 `OsClient` 列。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-012 sha256=61a83f536eede477a85d7d49cadf516e705d7d67510c189f9fb6ab0e72ba63db -->
## 本地撤销、Vue 源码桥与资产包

- 设计器本地历史最多 50 步、总计最多 20MB；连续编辑允许合并，但保存前必须刷新当前 `CurrentHash`。
- `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`、`Ctrl/Cmd+Y` 不能抢占输入框、textarea、contenteditable 或代码编辑器自己的撤销行为。
- 本地 Undo/Redo 不是审计版本；跨会话恢复仍使用服务端历史与 CAS。
- Page JSON → Vue SFC 只使用确定性 `microi.page.sfc.v1` 模板；禁止 eval、动态执行用户 JSON 或注入任意 import。
- Vue SFC → Page JSON 只接受平台生成标记、完整元数据和匹配 Hash；任意手写 Vue、第三方 SFC 或未知 script 必须拒绝。
- 导入源码后先规范化、显示 Diff，再由用户确认写入；不得因为“解析成功”直接覆盖当前页面。
- 可复用组件/区块使用治理中心 `microi.asset.v1`，声明 Props、Setters、DataAdapters、Platforms 和 DependencyPackages；调用 `mci-asset-publish` DryRun 后再发布。
- 资产依赖必须检查缺失、语义版本范围、循环和最大深度；运行时使用 `mci-asset-resolve` 返回的 `LoadOrder`。
- 复杂页面需要完整工程能力时提升为前端微服务；不要承诺任意 Vue 源码无损反编译回界面引擎。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-013 sha256=d78e797960620f983fc73f8485c0e928937474340efe6c2ec8923cfd5f4a28f2 -->
## 生成 JSON 注意事项

1. **编号唯一**：`wrapperOption.number` 和 `widgetOption.number` 页面内唯一（随机5位整数）
2. **关联一致**：`widgetOption.wrapperNumber` 必须等于所在容器的 `wrapperOption.number`
3. **高度合理**：容器高度 >= 内部组件高度之和
4. **widgetParams 完整**：必须包含该组件定义的所有参数，不能遗漏
5. **栅格布局**：span 总和 24 为一行，如 span=12 的两个容器为两列布局
6. **数据来源**：接口引擎 value 使用稳定路径 `$ApiBase$/apiengine/{Key}`，由运行时通过 `osclient` Header 传入 `$OsClient$`；只有无法设置 Header/Form/Query 的 GET/HEAD 或第三方回调才使用特殊租户路径
7. **formConfig 完整**：所有字段都应包含，不能省略
8. **选项卡容器**：组件放在 `tabWidgetMap[tabKey][]` 中，不放在 `widgetList` 中
<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-014 sha256=18fecb3e402daeb1f95e8f501c4456455a4c1a3b9de83208d03676f5cbf1cf84 -->
## 经营看板周期筛选与布局规则

- 老板驾驶舱、经营看板、CRM/订单/售后统计页面，所有统计类组件默认都要提供统一周期筛选：本日、本周、本月、本季、本年、去年，以及“更多”里的自定义时间范围和业务条件。
- 指标名称不要写死为“月订单金额、月新增客户、月跟进活跃”等固定月份口径。优先使用“订单金额、新增客户、跟进活跃”等中性名称；如业务需要展示周期前缀，运行态会根据当前 `period` 自动显示为“本日/本周/本月/本季/本年/去年”。
- `statistic`、`progress` 这类内容型组件在运行态必须允许按内容自适应高度。生成 JSON 时也要按数据条数预留高度：统计卡片按每行列数计算行数，避免首次打开时出现卡片底部被遮挡或容器内部滚动条。
- 有远程数据源的图表/表格/统计组件，点击周期按钮必须真实触发接口请求，并把 `period`、`_period`、`startDate`、`endDate` 等查询条件传给接口。接口返回数据时不要清空组件已有的 `searchData`，除非明确返回新的完整筛选配置。
- 接口返回的指标名、图例名、表格列名禁止固定写成“月新增客户、月订单金额”等，必须根据最终生效周期输出“本日/本周/本月/本季/本年/去年/自定义”或保持中性名称；否则切换周期后文案会和数据口径冲突。
- `/mic/autopage/:Id` 面向最终用户运行态展示，应渲染 `formRenderer`；设计器入口才渲染 `formDesigner`，避免导航、组件面板、引导遮罩干扰看板访问和自动化截图。
<!-- /microi-progressive:chunk -->
