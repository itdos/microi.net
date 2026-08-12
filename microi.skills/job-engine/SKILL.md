---
name: job-engine
description: Microi 定时任务与可靠后台任务规范。用于配置 Microi.Job、Quartz 和接口引擎任务，设计多节点租约、幂等、重试、停机排空、恢复、进度与验收。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi Job 定时与后台任务

## 何时使用

- 周期扫描、补偿、归档：`Microi.Job`
- 用户触发的长耗时安装/导入/同步：菜单后台任务
- 可靠跨服务异步：MQ + outbox/inbox
- 请求内等待外部结果：`await`，不要创建后台线程

禁止用后端 `setTimeout`、`Task.Run`、`static bool` 或本机定时器承载可靠业务。

## 平台对象

Quartz 管理能力包含查询、添加、更新、暂停、恢复、删除任务。任务配置、接口引擎代码和执行日志属于控制面，只允许 `Level >= 9999` 维护；业务用户只能触发明确授权的后台动作。

任务通常调用稳定的 `ApiEngineKey`。接口引擎返回 `Code=1` 只表示本次执行成功，不代表调度系统可忽略重试与幂等。

## 多节点设计

每个任务必须同时具备：

1. 分布式租约：Key 至少含 `OsClient + JobKey + 计划时间/业务分片`，有唯一持有者、TTL、续租和仅持有者释放。
2. 业务幂等：稳定 `IdempotencyKey/EventId`、数据库唯一约束或条件状态迁移。
3. 可恢复状态：待处理、处理中、成功、失败、下次重试时间写共享数据库/Redis/MQ。
4. fencing：锁可能过期的资金、库存等任务使用版本号/条件更新拒绝旧持有者写入。

锁只能减少并发，不能替代幂等。

## 任务骨架

```js
// 接口引擎由 Job 调用；JobRunId/FireTime 由调度层传入
var idempotencyKey = String(V8.Param.JobRunId || '');
if (!idempotencyKey) return { Code: 0, Msg: '缺少 JobRunId' };

// 推荐调用专用后端能力，以唯一约束抢占执行记录
var claim = V8.FormEngine.AddFormData('job_execution', {
  JobKey: 'daily_order_summary',
  IdempotencyKey: idempotencyKey,
  Status: 'Running'
});
if (claim.Code !== 1) return { Code: 1, Msg: '已执行或正在执行' };

// 分页处理；每个业务副作用仍需自己的幂等键
return { Code: 1, Data: { IdempotencyKey: idempotencyKey } };
```

实际项目优先由数据库唯一索引和接口引擎事务完成抢占，不能仅用“先查再新增”。该唯一索引必须声明在 Manifest `tables[].indexes`，并用 `microi_create_table_index` 创建、`microi_get_table_indexes` 回读；禁止在 Job/V8 内手写 `CREATE INDEX`。任务扫描还应按实际 SQL 建立 `(OsClient, Status, NextRetryTime)` 或 `(OsClient, JobKey, ScheduleTime)` 等组合索引。

## 失败、重试与停机

- 失败记录错误分类、重试次数和 `NextRetryTime`，采用有上限退避；永久错误进入人工处理。
- 外部调用设置超时；无法确认对方是否成功时用业务幂等号查询，不盲目重发。
- 服务停机先停止接单，再在有限宽限期排空或持久化；重启扫描未完成任务。
- 若要求 `kill -9` 前也零丢失，业务成功响应前必须获得共享 outbox/MQ/WAL 持久化确认。

## 后台按钮

满足任一条件即按后台任务设计：预计超过 2 分钟、500 条以上、1000 个以上扇出子操作、100 次以上外部调用、总量未知且可能持续运行，或安装/初始化/批量导入/批量生成/全量同步/迁移/备份。预计超过 10 分钟时，仅设置 `RunBackground=true` 仍不够，必须按 checkpoint 分片，每片独立事务。

菜单按钮设置 `RunBackground/BackgroundTask/IsBackgroundTask=true` 和 `ApiEngineKey`，并配置 `BackgroundTaskOptions`：

- `IdempotencyKey` 或 `IdempotencyKeyFields`：跨节点、重试和重复点击保持稳定。
- `ConcurrencyKey`：DDL、安装等不能并行的工作使用同一租约组。
- `BusinessTable + BusinessId`：关联业务记录。
- `BusinessStatusField + BusinessTaskIdField`：业务记录至少标记“后台处理中”和任务 Id；推荐再配置 `BusinessProgressField + BusinessEtaField`。

按钮提交成功后，平台前端会通过当前用户的 `V8.FormEngine` 权限把业务记录标记为“后台处理中”并写入任务 Id；后台服务不能直接相信客户端字段名而绕过表单权限。接口引擎仍必须在最后一片或异常补偿中把该业务记录改成“已完成 / 失败 / 已取消”，并保留任务 Id 供详情追溯：

```js
var task = V8.Param._BackgroundTask || {};
if (task.BusinessTable && task.BusinessId) {
  var patch = { Id: task.BusinessId };
  patch[task.BusinessStatusField] = '后台处理中';
  patch[task.BusinessTaskIdField] = task.Id;
  V8.FormEngine.UptFormData(task.BusinessTable, patch);
}
```

不得让通用后台服务按客户端传入的任意表名/字段名直接写库；需要脱离前端自动标记的专用任务，应在受控接口引擎中使用固定表名和固定字段名。

接口通过 `V8.Method.UpdateBackgroundTask({Current,Total,Msg,Log})` 上报已提交的真实工作量，`Log`/`AppendLog` 用于追加任务详情（不得包含密码、Token 或密钥）。平台按实际吞吐计算 `EstimatedEndTime`；总量未知时不传 `Total`，通知中心显示“不定进度/估算中”，禁止用固定 10%、阶段占位或计时器伪造进度。失败和取消停在最后真实进度，不得显示 100%。

分片接口在仍有后续工作时返回：

```js
return {
  Code: 1,
  Data: {
    BackgroundTask: {
      HasMore: true,
      Checkpoint: { LastId: lastId },
      Current: committedCount,
      Total: totalCount,
      NextDelaySeconds: 1,
      Msg: '本批已提交，等待下一批'
    }
  }
};
```

最后一片返回普通 `Code:1`。每个业务副作用还要用 `_BackgroundTaskIdempotencyKey + 业务行Id` 建唯一约束；`_BackgroundTaskFencingToken` 用于拒绝租约过期旧执行者的写入。

## 长任务的 Jint 预算

后台 Worker 最终仍调用接口引擎，因此每个执行片段都受 `Timeout`、`MaxStatements`、单层累计分配预算、根调用树累计分配预算、JavaScript 递归和接口嵌套深度限制。`LimitMemory=2048` 表示当前片段累计分配了多少托管字节，不表示实时占用或预留 2GB 物理内存。

- 总任务运行 10 分钟、30 分钟或数小时是允许的；单个连续 Jint 调用不应承担全部时长。
- 每片在预算内提交事务并返回 `HasMore + Checkpoint`；Worker 重新入队后会创建新的 Jint Engine，新片重新获得超时、语句和累计分配预算。
- `V8.ApiEngine.Run` 的多层编排可以保留。新版父子单层分配隔离后，子接口不会被所有祖先重复计费，但根调用树仍有整体预算；循环调用由独立的嵌套深度上限终止。
- 捕获失败时读取 `DataAppend.V8Limit.Code`。内存/调用树/语句/超时分别缩小批次，递归错误修复函数递归，嵌套深度错误检查循环编排；不要统一归因于服务器资源不足。
- 可记录 `V8.Limits` 到脱敏诊断日志，但不要在每条业务数据上重复输出。
- 若分片提交会破坏“全部成功或全部回滚”的业务原子性，可为受控接口开启 `sys_apiengine.V8Unlimited`，并继续使用后台任务承载进度。该模式仍受进程常驻内存、取消、并发、接口嵌套深度和数据库限制；必须评估长事务锁/日志/回滚，保留幂等重试，并为每个下游接口和表后端事件分别配置，不能由根接口自动继承。

## MCP 工作流

1. 读取表、接口引擎和现有任务。
2. 先设计幂等键、状态机、租约和补偿。
3. `microi_save_job` 保存任务，写入需明确确认。
4. 回读任务 cron、启用状态、Key、接口引擎。
5. 两节点同时触发、重复投递、持有者中止、Redis 故障和滚动升级验收。

## 验收清单

- [ ] 任务配置仅管理员可改
- [ ] 两节点同一时刻触发，业务副作用仅一次
- [ ] 重复消息/请求不会重复扣减或生成流水
- [ ] 锁持有者退出后可恢复，无永久死锁
- [ ] 失败可重试、可追踪、可人工补偿
- [ ] 新旧版本滚动共存，状态和消息合约兼容
- [ ] 未知总量不显示假百分比；已知总量由 Current/Total 唯一推导
- [ ] ETA 来自真实吞吐，样本不足时明确显示“估算中”
- [ ] 业务记录可通过 BackgroundTaskId 跳转通知中心排查
- [ ] 超过 10 分钟的任务有 checkpoint，重启后从最后已提交批次恢复
- [ ] 单片低于超时/语句/累计分配预算，任务总时长不依赖放大单次接口上限
- [ ] 嵌套接口没有循环调用，且错误日志包含结构化 `V8Limit` 分类和调用路径
