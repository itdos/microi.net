# 客户管理列表统计

`pages/business/list?key=customers` 从集福鲤平台客户管理菜单读取四项指标：租赁总价、买断总价、包年换芯总价、预期交易金额。前三项复用 `xjy-customer-contract-totals` 的合同商品口径，最后一项读取列表 `DataAppend.StatisticsFields`；平台统计列包含真实 `lease/buyOut/changeXin/YuqiJYJE` 字段。

合作状态按钮右上角显示纯数字。角标遵循当前账号可见范围、关键词、时间和高级筛选，不随快捷状态按钮选择而丢失其它状态的数量；金额同时遵循当前选中的快捷状态。全部状态数量包含后台存量的其它或空状态。

统计下方左侧“仅有效期内”开关默认开启，只影响租赁和包年换芯金额。有效合同要求已审批、未断约、合同开始日期 ≤ 当前服务端日期 ≤ 合同结束日期。关闭后按全部已审批和已到期合同累计，包含已断约历史；买断始终保持累计口径，预期交易金额不受开关影响。

接口一次读取完整授权客户范围及订单，按商品金额聚合，不累加客户端当前分页。不写客户、合同、商品或合同状态。权限失败、响应截断和查询超限明确失败；历史缺少合作方式或金额只影响相应指标，该指标显示 `-`，旁边提示待核对项数，其余完整指标和状态数量继续显示。

历史买断或“买断＋包年换芯”商品的 `Zongjia` 为空时，若设备实际单价 `ShebeiSJDJ` 与数量 `Shuliang` 均完整且非负，按两者乘积在数据库 decimal 运算中保留两位小数后纳入买断总价；已有总价（含零价）始终优先。此兼容计算同时适用于客户卡片和顶部汇总，不回写合同数据。`ShijiJG` 包含耗材价格，不作为设备金额的替代来源；单价或数量也缺失时仍提示待核对。

接口可提交源码为 `src/tenants/xjy/api-engines/xjy-customer-contract-totals.js`；工作区 `Microi-V8-Engine` 对应文件是平台同步镜像。平台配置增量及视觉测试共同读取 `profiles/xjy/metadata/customer-list-statistics.json`，只更新客户菜单的指标和统计字段，保留其它列表及详情配置。

验收命令：`npm run check:customer-list-summary`、`npm run build:mp-weixin`、`npm run build:h5`。视觉验收使用 `XJY_VISUAL_TARGET=customers npm run visual:xjy`，覆盖三个手机视口、数字角标、四项指标、默认开启和切换后的金额变化。视觉数据为明确的测试替身；真实金额与权限通过同租户 MCP 单独验收。
