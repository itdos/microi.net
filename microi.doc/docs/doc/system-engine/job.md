# ⏰ 任务调度与后台任务

> Microi.Job 基于 Quartz 调度接口引擎或定制 .NET Job。可靠任务必须同时设计多节点租约、业务幂等、重试和重启恢复。

---

## 能力选择

| 需求 | 推荐 |
|---|---|
| 周期扫描、对账、补偿、归档 | Microi.Job |
| 用户触发的安装、导入、批量同步 | 菜单后台任务 |
| 可靠跨服务异步 | MQ + outbox/inbox |
| 请求内等待外部结果 | `await` |

后端 `setTimeout`、`Task.Run`、`static bool`、普通 `lock` 和本机定时器不能承载可靠业务。

## 管理能力

平台支持查询、添加、更新、暂停、恢复和删除任务。任务配置、接口引擎和执行日志属于控制面，只允许 `Level >= 9999` 维护。日常管理应使用任务调度 UI/Controller，不要直接修改 Quartz 表或要求重启容器。

## 多节点与幂等

同一任务可能在每个 API/Worker 节点同时到点。每个任务必须具备：

1. 分布式租约：Key 包含 `OsClient + JobKey + 计划时间/分片`，有 TTL、唯一持有者、续租和仅持有者释放。
2. 稳定幂等键：例如 `JobRunId`、业务日期、消息 `EventId`。
3. 数据库唯一约束或条件状态迁移，保证副作用仅一次。
4. 共享 checkpoint：待处理、处理中、成功、失败、重试次数和下次重试时间。

锁只能减少并发，不能代替幂等。资金、库存、积分和流水需要版本/条件更新，防止锁过期后的旧持有者继续写入。

## 接口引擎任务

任务调用稳定的 `ApiEngineKey`，调度层应传 `JobRunId` 与触发时间。接口引擎先以唯一约束抢占执行记录，再分页处理；不能使用“先查询、再新增”的非原子去重。

```js
var runId = String(V8.Param.JobRunId || '');
if (!runId) return { Code: 0, Msg: '缺少 JobRunId' };

// 实际项目由专用执行表唯一索引或接口引擎原子能力完成 claim。
// 每项业务副作用还要有自己的幂等键。
return { Code: 1, Data: { JobRunId: runId } };
```

## 失败与恢复

- 外部调用设置超时；无法确认对方是否成功时按业务幂等号查询，不能盲目重发。
- 重试使用有上限退避；永久错误进入人工处理。
- 服务停机先停止接单，再在有限宽限期排空或持久化；重启后扫描未完成任务。
- 要求 `kill -9` 窗口零丢失时，业务成功响应前必须取得共享 outbox/MQ/WAL 的持久化确认。

## 后台按钮

长耗时菜单按钮设置 `RunBackground/BackgroundTask/IsBackgroundTask=true` 并绑定 `ApiEngineKey`。接口通过 `V8.Method.UpdateBackgroundTask` 上报进度；进度保存在共享存储，不只放当前节点内存。

## 最低验收

至少启动两个节点连接同一数据库/Redis，覆盖：同时到点、重复投递、锁持有者中途退出、Redis 短暂故障、写入后响应前重启和滚动升级。最终断言业务副作用仅一次、无永久死锁、未完成任务可恢复。

完整规范见 `microi.skills/job-engine/SKILL.md` 与[平台安全与兼容基线](../more/security)。
