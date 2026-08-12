# v8-menu-buttons 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-menu-buttons-008 sha256=dd53500e57af81daec15456a538ac36b2c965faca61ba99de46c7ba0e3b4bbaa -->
## 8. 模式 F：后台任务按钮（长任务）

应用安装、初始化多语言、批量导入、批量修复、跨系统同步等可能超过浏览器或网关等待时间的操作，必须优先设计为后台任务。判断阈值：预计超过 2 分钟、500 条以上、1000 个以上扇出子操作、100 次以上外部调用，或总量未知且可能持续运行。前端按钮只负责提交任务，后台任务列表通过 WebSocket/SignalR 推送并以轮询兜底。

少量数据也可能因为单次 V8 根执行的累计分配量过大而需要拆分。如果业务天然支持“每片独立事务提交、失败后按剩余量安全恢复”，按钮可以在前端发起多个独立 HTTP 请求，并声明客户端分片协议：

```jsonc
{
  "Name": "批量生成主构件码",
  "Workload": {
    "ExecutionMode": "ClientChunked",
    "MaxItemsPerChunk": 40,
    "Resumable": true,
    "ExpectedItems": 200
  },
  "V8Code": "// 按 MaxItemsPerChunk 构造切片，并逐片 await V8.ApiEngine.Run(...)"
}
```

逐条独立调用可使用 `ExecutionMode: "ClientSequential"` 和 `MaxItemsPerChunk: 1`。该声明必须与真实代码一致，且每片是新的 HTTP 请求；在同一次接口引擎调用中仅把大数组切成多个循环，不会重置 Jint 累计内存。缺少明确单片上限、不能恢复、预计总耗时超过 2 分钟或总量未知时，仍应使用后台任务和持久化检查点。

推荐直接使用按钮字段：

```jsonc
{
  "Name": "安装",
  "BtnStyle": "primary",
  "ShowRow": true,
  "RunBackground": true,
  "ApiEngineKey": "import-microi-store-package",
  "Workload": { "ExpectedItems": 2000, "FanOutOperations": 10000, "ExpectedSeconds": 3000 },
  "BackgroundTaskOptions": {
    "IdempotencyKeyFields": ["Id", "Version"],
    "ConcurrencyKey": "microi-store-install",
    "BusinessTable": "sys_microistore",
    "BusinessStatusField": "TaskStatus",
    "BusinessTaskIdField": "BackgroundTaskId",
    "BusinessProgressField": "TaskProgress",
    "BusinessEtaField": "EstimatedEndTime"
  },
  "V8Code": "return { Package: V8.Form, _BackgroundTaskTitle: '安装应用：' + (V8.Form.Name || '') };"
}
```

也可以在 V8Code 中显式调用：

```js
V8.ApiEngine.RunBackground('import-microi-store-package', {
  Package: V8.Form
}, '安装应用：' + (V8.Form.Name || ''), {
  IdempotencyKey: 'install:' + V8.Form.Id + ':' + (V8.Form.Version || ''),
  ConcurrencyKey: 'microi-store-install',
  BusinessTable: 'sys_microistore',
  BusinessId: V8.Form.Id,
  BusinessStatusField: 'TaskStatus',
  BusinessTaskIdField: 'BackgroundTaskId',
  BusinessProgressField: 'TaskProgress',
  BusinessEtaField: 'EstimatedEndTime'
});
```

`Business*` 字段用于业务关联与受权限保护的状态标记。按钮提交成功后，前端使用当前用户的 `V8.FormEngine` 权限写入“后台处理中”和任务 Id；通用后台服务不会信任客户端传来的任意表名/字段名去绕过权限。接口引擎应在成功、失败和取消补偿路径用固定业务表/字段更新最终状态，任务 Id 始终保留用于打开通知中心详情。

接口引擎中必须上报真实进度。平台创建后台任务时会自动把 `_BackgroundTaskId` 注入 `V8.Param`，V8 代码不要自己生成任务 Id，也不要只在结束时写一个固定百分比。

```js
var backgroundTaskId = V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId || '';
var backgroundTask = V8.Param._BackgroundTask || {};
if (backgroundTask.BusinessTable && backgroundTask.BusinessId) {
  var taskPatch = { Id: backgroundTask.BusinessId };
  taskPatch[backgroundTask.BusinessStatusField] = '后台处理中';
  taskPatch[backgroundTask.BusinessTaskIdField] = backgroundTaskId;
  V8.FormEngine.UptFormData(backgroundTask.BusinessTable, taskPatch);
}
var reportProgress = function(current, total, msg) {
  if (!backgroundTaskId || !V8.Method || !V8.Method.UpdateBackgroundTask) return;
  V8.Method.UpdateBackgroundTask({
    _BackgroundTaskId: backgroundTaskId,
    Current: current,
    Total: total,
    Msg: msg,
    Message: msg
  });
};

reportProgress(1, 5, '正在读取数据');
// ...执行第 1 阶段
reportProgress(2, 5, '正在写入表结构');
// ...执行第 2 阶段
```

推荐用“已提交条数 / 总条数”上报 `Current/Total`，平台以共享数据库为事实源，Redis/SignalR 仅作缓存和推送，并根据真实吞吐估算结束时间。总量未知时只上报 `Current + Msg`，通知中心显示“计算进度中”，不要填写假的 `Total=100`。耗时循环中每提交一批数据调用一次，例如每 50 或 100 条更新；不能用计时器匀速增加百分比。

后台任务不能隐藏真实失败。失败时返回 `Code:0` 和清晰 `Msg`，并把关键阶段写入任务进度或系统日志。只有最终成功才显示 100%；失败/取消保留最后真实进度。

预计超过 10 分钟的任务必须分页/分片。每片只处理可在较短事务内提交的一批，仍有后续时返回 `Data.BackgroundTask.HasMore=true + Checkpoint + Current/Total`，平台持久化检查点并重新入队；最后一片返回普通 `Code:1`。重试副作用必须用稳定幂等键、数据库唯一约束和 `_BackgroundTaskFencingToken` 条件写入，不能依赖锁本身。

### 复盘：主租户默认值误清空子租户后台任务身份

- 触发场景：同一套前后端中，独立部署的主租户可正常执行后台安装，挂在平台主库下的子租户却间歇性提示“只有超级管理员才能安装”；数据库中的 admin 实际已经是最高等级。
- 根因：任务提交时虽然已从登录令牌保存可信用户快照，但后台线程脱离 HTTP 请求后再次调用 `GetCurrentToken()`，得到的只是服务默认主租户；普通接口的跨租户保护发现默认租户与任务 `OsClient` 不同，误把可信用户快照清空。线程是否赶在原请求上下文释放前运行还会造成偶发成功、偶发失败。
- 通用规则：后台任务必须在提交阶段由服务端读取并克隆 `CurrentUser + OsClient`，通过不暴露给客户端/V8 的可信执行入口传给接口引擎；客户端参数中的 `_CurrentUser` 必须删除。普通 HTTP 接口继续执行跨租户身份清空，但不得用无真实 Token 的默认租户结果覆盖后台任务可信身份。
- 自动化检查：使用“服务默认租户 A + 子租户 B”的部署配置，以 B 的超级管理员连续提交多次后台接口任务，并在原请求结束后才放行执行；断言每次 V8 的 `CurrentUser.Id/Level` 与提交者一致，同时验证携带 A Token 调用 B 普通接口仍会按匿名处理。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-009 sha256=84f41fd0ea02234d3d883ba73e894393a4f2a57c5f4fc51a985145f658dd3a8c -->
## 9. 通过 MCP 创建菜单 + 按钮（一次到位）

> AI 在 `microi_create_module` 调用时，把按钮 JSON **作为字符串** 传入对应字段。

```js
var moreBtns = [
  {
    Id: "01K...",
    Name: "指派",
    BtnStyle: "primary",
    IsVisible: true,
    ShowRow: true,
    V8CodeShow: "V8.Result = (V8.Form.Status == '待指派');",
    V8Code: `
var assignResult = await V8.ApiEngine.Run({
  ApiEngineKey: "aftersale_assign",
  Id: V8.Form.Id,
  AssigneeId: V8.Form.AssigneeId
});

V8.Tips(assignResult.Code == 1 ? "指派成功" : assignResult.Msg, assignResult.Code == 1);
V8.RefreshTable({ _PageIndex: 1 });
`
  }
];

var modulePayload = {
  name: "售后任务",
  diyTableId: "<TableId>",
  icon: "fab fa-first-order",
  moreBtns: JSON.stringify(moreBtns),
  formBtns: JSON.stringify([]),
  pageTabs: JSON.stringify([]),
  batchSelectMoreBtns: JSON.stringify([])
};
```

> ⚠️ 真实调用 `microi_create_module` 时传 `modulePayload.moreBtns` 这样的 JSON 字符串。不要为了“看起来短”把 `V8Code` 压成一行。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-010 sha256=0398a9fc35520d4b17b990efc565ba1d9f6050303e122dc128207adf08434aee -->
## 前端 FormEngine 权限与兼容

- 当前按钮所在菜单绑定表会由 scoped facade 自动补真实 `_SysMenuId`，历史按钮不需要逐个修改。
- 按钮跨表调用时不要把当前菜单 Id 传播给目标表；后端按当前用户对目标表的有效菜单权限缓存推断。
- 显式 `_SysMenuId`/`ModuleEngineKey` 会严格校验，伪造或借用其它表菜单不会回退兼容推断。
- 平台敏感表仍对普通客户端硬拒绝；Import/Export 必须走独立端点和专项菜单权限。
- TableChild 的 `_TableChildAuth` 由标准子表自动维护，业务按钮不得构造或跨父记录复用。
- 前端真实批量方法名是 `AddFormDataBatch/UptFormDataBatch/DelFormDataBatch`，没有 `AddTableData/UptTableData/DelTableData`。
- 状态推进、资产、库存、审批、批量副作用等业务动作必须调用 ApiEngine；FormEngine 只适合权限范围内的简单单表 CRUD。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-011 sha256=e2d7fb49de3af1ef244df5027086674b10d18ec830e765adbe252d094aa14490 -->
## 10. 与接口引擎配套的工作流

业务按钮通常与接口引擎配套：

1. **microi_create_engine** 先创建 ApiEngineKey（如 `aftersale_assign`），写好后端事务/校验/通知逻辑
2. **microi_create_module** 创建菜单时把按钮的 `V8Code` 设为 `V8.ApiEngine.Run({ApiEngineKey:'aftersale_assign',...})`
3. AI 在生成菜单时**应主动**：
   - 识别业务动作（指派/接单/审核/完成/驳回/导出/批量处理/状态推进）
   - 为每个动作创建一个接口引擎
   - 在 `moreBtns` / `formBtns` 中绑定按钮 → 接口

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-012 sha256=086e02210a949cc0a2c343e7f50c54c48079667999e9264ea5282c9caa951222 -->
## 10.1 后台直充/调账类行按钮

会员积分、余额、库存、额度等会改动资产的后台行按钮，必须采用“前端按钮只收参数，后端接口负责事务”的模式。

规则：
- `MoreBtns` 使用 `ShowRow:true`，按钮只负责 `V8.ConfirmTips` 弹窗、读取金额/备注、调用接口和刷新表格。
- 不要在 `V8Code` 里直接写 `V8.FormEngine.UptFormData` 改余额；余额更新、订单/流水生成、幂等校验都放到 ApiEngine。
- 后端接口必须校验 `MemberId/Amount`，金额必须大于 0，并同时写资产主表和对应流水表；如系统已有订单表参与统计，也要同步生成已完成/已支付订单。
- 资产主表更新、`SELECT ... FOR UPDATE` 和流水写入必须全部使用同一个 `V8.DbTrans`；禁止一部分用 `V8.Db`、另一部分写流水，否则后半段报错时可能留下单边余额变化。
- 备注字段要有默认值，例如 `平台直充积分`，并允许管理员在弹窗中修改。
- 验证时至少做一次小额测试，读回主表余额、订单表和流水表；测试备注要明确标识，方便审计。
- 还必须做一次回滚验收：故意让流水写入失败，回读资产主表确认余额完全未变，再修正输入完成成功验收。

按钮 V8Code 骨架。充值包含金额、备注、联动校验，属于可维护业务表单，应使用在线微服务页面，不要在 `ConfirmTips` 中拼接 `<input>/<textarea>`：

```js
var row = V8.Form || {};
V8.OpenAppDialog({
  AppKey: 'member_asset_admin',
  RoutePath: '/recharge',
  Title: '后台充值积分',
  Width: 'min(720px, calc(100vw - 32px))',
  Data: {
    MemberId: row.Id,
    MemberName: row.NickName || row.Phone || row.Id || ''
  },
  OnSuccess: function (result) {
    V8.Tips((result && result.message) || '充值成功', true);
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnError: function (error) {
    V8.Tips((error && error.message) || '充值失败', false);
  }
});
```

---

<!-- /microi-progressive:chunk -->
