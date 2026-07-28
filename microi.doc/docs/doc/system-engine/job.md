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

以下任一条件成立时按后台任务设计：预计超过 2 分钟、500 条以上、1000 个以上扇出子操作、100 次以上外部调用、总量未知且可能持续运行，或属于安装、初始化、批量导入/生成、全量同步、迁移、备份。

长耗时菜单按钮设置 `RunBackground/BackgroundTask/IsBackgroundTask=true` 并绑定 `ApiEngineKey`。`BackgroundTaskOptions` 至少配置稳定 `IdempotencyKey`；需要串行执行的 DDL/安装配置 `ConcurrencyKey`；关联业务数据时配置 `BusinessTable/BusinessId/BusinessStatusField/BusinessTaskIdField`，业务记录至少写“后台处理中”和任务 Id，用户即可去通知中心查看详情。

按钮提交成功后，前端通过当前用户正常的 `V8.FormEngine` 权限写入上述状态；通用后台服务不会按客户端传入的任意表名/字段名直接写库。接口引擎需要在完成、失败或取消补偿路径更新业务记录的最终状态。专用无人值守任务应在接口引擎中固定表名和字段名，不能把任意写库权限交给请求参数。

接口通过 `V8.Method.UpdateBackgroundTask({Current,Total,Msg})` 上报已提交的真实工作量。平台根据采样吞吐计算预计结束时间并标记可信度：

- 已知总量：百分比只由 `Current/Total` 推导。
- 未知总量：不要传 `Total=100`，界面显示“不定进度/积累真实样本后估算”。
- 失败或取消：停在最后真实进度，只有最终成功显示 100%。
- SignalR 仅负责实时推送，页面会轮询共享数据库兜底。

预计超过 10 分钟的任务必须分片。每片在短事务内提交一批，仍有后续时返回 `Data.BackgroundTask`：

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

平台持久化 checkpoint 后重新入队；最后一片返回普通 `Code:1`。节点异常时租约过期后由其它节点恢复，旧节点的写入由 fencing token 和业务唯一约束拒绝。

## 最低验收

至少启动两个节点连接同一数据库/Redis，覆盖：同时到点、重复投递、锁持有者中途退出、Redis 短暂故障、写入后响应前重启和滚动升级。最终断言业务副作用仅一次、无永久死锁、未完成任务可恢复，并核对通知中心的真实分子/分母、ETA、日志以及失败/取消不显示 100%。

完整规范见 `microi.skills/job-engine/SKILL.md` 与[平台安全与兼容基线](../more/security)。
