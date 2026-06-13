---
name: production-readonly-audit
description: Microi 正式环境只读业务巡检规范。用于在不改动线上数据的前提下，检查会员、余额、订单、库存卡、奖励、积分、兑换金额、日志和结算正确性等生产业务数据。
---

# Microi 正式环境只读业务巡检

## 核心边界

- 正式环境已有真实用户、余额、订单、卡券或收益数据时，线上巡检默认是只读任务。
- 优先使用目标租户 MCP 的读表、查结构、查日志工具；不得调用新增、更新、删除、清库、重算、补发、扣减接口。
- 如果用户要求“检查是否正常”，先输出异常证据、影响范围、建议修复方式和回读验证方式；没有明确授权前，不修线上业务数据。
- MCP 不可用时，可使用官方后台登录 token + FormEngine `getTableData` 做只读兜底，但必须在结果中说明“非 MCP，只读 API 兜底”；不得调用 `add/upt/del/run` 维护接口。
- 任何资金/资产异常即使明显，也只能先报告。获得修复授权后，必须小范围条件更新，并在方案文档留下 SQL/接口说明、执行时间、影响行数和回读结果。

## 商城类固定巡检表

- 会员与团队：`mall_member`
- 提货卡与挂单：`mall_stock_card`、`mall_stock_card_listing`
- 抢购/约单/商品订单：`mall_buy_order`、`mall_appointment_order`、`mall_redeem_order`
- 积分/兑换金/奖励：`mall_point_log`、`mall_redeem_money_log`、`mall_reward_log`
- 上架服务费：`mall_storage_fee_order`
- 提货卡扣除/流转：`mall_stock_card_redeem`、`mall_stock_card_history`
- 规则配置：`mall_system_config`

## 固定检查项

- 提货卡：`CardNo` 必须为 6 位大写字母+数字；金额不得为负；`OwnerId` 必须存在；同一卡只能有一条活跃挂单；状态机必须和挂单/订单一致。
- 抢购订单：`PendingPay` 必须有关联锁定卡与付款截止时间；`Paid` 必须有支付凭证和付款时间；`Confirmed/Completed` 必须确认卡 OwnerId 已转为 BuyerId，并有对应流转历史。
- 上架服务费：服务费应等于持有价 × `PlatformServiceRate`；已支付服务费必须有对应负数积分流水。
- 推荐奖励：`Amount = BaseAmount × Rate / 100`；直推、间推、品牌补贴合计不得超过 `MaxPerformanceCommissionRate`；`Pending` 不得生成积分流水或增加余额；`Settled` 必须有积分流水并真实到账。
- 商品支付：提货卡专区订单必须生成 `mall_stock_card_redeem` 并扣卡余额；兑换金专区订单必须生成负数 `mall_redeem_money_log` 并扣兑换金。
- 会员资产：会员页展示的提货卡资产应以当前名下有效提货卡 `HoldPrice/StockValue` 汇总为准；如 `mall_member.StockValue` 是冗余字段，必须与实际资产保持一致。

## 输出要求

- 报告必须区分“硬错误”和“风险警告”。
- 不输出密码、token、支付凭证图片原文、完整身份证等敏感信息。
- 报告需包含巡检通道、读取表数量、状态分布、异常数量、核心异常证据、未覆盖范围。
