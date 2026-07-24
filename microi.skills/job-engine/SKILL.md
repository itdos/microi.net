---
name: job-engine
description: Microi 定时任务与可靠后台任务规范。用于配置 Microi.Job、Quartz 和接口引擎任务，设计多节点租约、幂等、重试、停机排空、恢复、进度与验收。
---

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

实际项目优先由数据库唯一索引和接口引擎事务完成抢占，不能仅用“先查再新增”。

## 失败、重试与停机

- 失败记录错误分类、重试次数和 `NextRetryTime`，采用有上限退避；永久错误进入人工处理。
- 外部调用设置超时；无法确认对方是否成功时用业务幂等号查询，不盲目重发。
- 服务停机先停止接单，再在有限宽限期排空或持久化；重启扫描未完成任务。
- 若要求 `kill -9` 前也零丢失，业务成功响应前必须获得共享 outbox/MQ/WAL 持久化确认。

## 后台按钮

菜单按钮设置 `RunBackground/BackgroundTask/IsBackgroundTask=true` 和 `ApiEngineKey`。接口通过 `V8.Method.UpdateBackgroundTask` 上报进度；进度是共享状态，不能只放当前 API 节点内存。

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
