# 设计说明

## 状态流

`Microi Job -> Queued -> Drafting -> QualityReview -> Ready -> Publishing -> Published`

异常终态包括 `BlockedQuality`、`NeedsReview` 和 `Failed`。抖音、快手缺少合格视频/原生图文时必须进入 `BlockedQuality`，不允许自动降级成低质素材。

## 分布式与重启恢复

- `mci_ai_content_item.SlotKey` 保证同一时段只创建一次。
- `mci_ai_publish_task.IdempotencyKey` 保证同一内容、帐号和内容类型只进入一次发布队列。
- 认领使用数据库条件更新、`LeaseUntil` 和单调递增 `FencingToken`；完成回写必须匹配认领人和 token。
- `mci_ai_publish_attempt.AttemptKey` 对每次外部副作用建立唯一事实记录。
- Quartz 集群只负责触发；业务唯一约束仍是最终幂等事实源。
- `mci-ai-scheduler-reconcile` 只在 Quartz 已保存而旧节点未落 `diy_schedule_job` 元数据时，由管理员以 Server 调用模式幂等补齐；它不创建第二个触发器。

## 密钥边界

MiniMax 密钥只在 Microi.AI 服务端读取。应用表只保存服务器签名句柄和临时下载 URL。yxer/蚁小二凭据只在本机连接器配置中；商城包、接口引擎、日志、PayloadJson 和数据库均不得出现这些凭据。

## 质量门禁

短视频平台只接受两类资产：人工/视觉审核通过且评分不低于 80 的视频；或 6～9 张审核通过、手机可读、信息不重复的原生竖版卡片。质量规则比“发布全部帐号”优先。
