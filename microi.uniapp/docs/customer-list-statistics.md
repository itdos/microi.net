# 客户管理列表统计

`pages/business/list?key=customers` 从集福鲤平台客户管理菜单读取四项指标：租赁总价、买断总价、包年换芯总价、预期交易金额。前三项复用 `xjy-customer-contract-totals` 的合同商品口径，最后一项读取列表 `DataAppend.StatisticsFields`；平台统计列包含真实 `lease/buyOut/changeXin/YuqiJYJE` 字段。

合作状态按钮右上角显示纯数字。角标遵循当前账号可见范围、关键词、时间和高级筛选，不随快捷状态按钮选择而丢失其它状态的数量；金额同时遵循当前选中的快捷状态。全部状态数量包含后台存量的其它或空状态。

统计下方左侧“仅有效期内”开关默认开启，只影响租赁和包年换芯金额。有效合同要求已审批、未断约、合同开始日期 ≤ 当前服务端日期 ≤ 合同结束日期。关闭后按全部已审批和已到期合同累计，包含已断约历史；买断始终保持累计口径，预期交易金额不受开关影响。

接口一次读取完整授权客户范围及订单，按商品金额聚合，不累加客户端当前分页。不写客户、合同、商品或合同状态。权限失败、响应截断和查询超限明确失败。顶部买断直接累加所有授权且符合筛选的客户卡片 `Buyout.All`，包括零值，返回 `BuyoutCustomerCount` 供范围核对。租赁和换芯按开关选择逐客户的 `Current` 或 `All` 金额累加；任何一项存在历史缺失金额时，仍显示已获取金额之和，并明确提示“合计仅含已获取金额”和待核对项数，不因单条缺失把整项合计改为 `-`，也不把缺失金额当作已确认的零价。状态数量照常返回。

历史买断或“买断＋包年换芯”商品的 `Zongjia` 为空时，若设备实际单价 `ShebeiSJDJ` 与数量 `Shuliang` 均完整且非负，按两者乘积在数据库 decimal 运算中保留两位小数后纳入买断总价；已有总价（含零价）始终优先。此兼容计算同时适用于客户卡片和顶部汇总，不回写合同数据。`ShijiJG` 包含耗材价格，不作为设备金额的替代来源；单价或数量也缺失时仍提示待核对。

PC 客户管理工具栏通过模块 `PageBtns` 配置“仅有效期内：开启/关闭”状态按钮，默认开启。按钮源码为 `src/tenants/xjy/module-buttons/customer-validity-toggle.js`，配置定义为 `profiles/xjy/metadata/customer-validity-button.json`；不修改后台框架源码，也不在客户表新增开关字段。按钮只修改当前页面 PC 列表 `ViewSchema.Hero.Metrics[].ParamMap.ValidOnly` 并普通刷新，保留关键词、高级筛选和页码，不将某个用户的选择保存成全局配置。小程序的 `Filters.ValidOnly` 优先于 PC 顶层 `ValidOnly`，缺省仍开启；PC 的 `_Search/_SearchEqual/_SearchDateTime/_SearchNumber` 经同一客户菜单授权入口传递，合计遵循完整筛选范围。

接口可提交源码为 `src/tenants/xjy/api-engines/xjy-customer-contract-totals.js`；工作区 `Microi-V8-Engine` 对应文件是平台同步镜像。平台配置增量及视觉测试共同读取 `profiles/xjy/metadata/customer-list-statistics.json`，只更新客户菜单的指标和统计字段，保留其它列表及详情配置。

验收命令：`npm run check:customer-list-summary`、`npm run build:mp-weixin`、`npm run build:h5`。视觉验收使用 `XJY_VISUAL_TARGET=customers npm run visual:xjy`，覆盖三个手机视口、数字角标、四项指标、默认开启和切换后的金额变化。视觉数据为明确的测试替身；真实金额与权限通过同租户 MCP 单独验收。

PC 按钮专项验收：`node --test tests/customer-validity-button.test.mjs`，执行现有平台统计请求代码核对参数、请求合并和筛选。真实 PC 页面另核对默认状态、往返切换、筛选及分页，截图与验收报告不包含认证秘密。

## 专属客服与列表数据权限

客户管理菜单原有 `SqlWhere` 已包含“同商家且 `ZhuanshuKFID = 当前用户 Id`”。专属客服名称 `ZhuanshuKF` 和电话仅用于显示，不能代替人员 ID。搜索出现“客户查重结果”表示记录存在，但未进入当前普通列表的权限范围。

2026-10-23 排查确认：小程序客户人员联动缺少客服 `idName`，选择客服时只保存名称和电话，造成客户详情有客服、列表却无法匹配权限。`src/tenants/xjy/form.js` 已补齐 `ZhuanshuKFID` 的选择、隐藏字段提交和清空联动。客户 `SubmitBeforeServerV8` v1.1.3 已同步目标 xjy 租户：对旧客户端按客户所属商家、精确姓名、可用 ID/电话补齐关联；重名、跨商家或查询失败拒绝保存；无关增量和删除保持原行为。

截图中的“全功能测试赵157”已单独补齐客服 ID，并回读确认。同商家、同客服检查另发现“宁波海欣控股集团有限公司”也缺少客服 ID，按唯一同名人员补齐后回读；该商家该客服名下的空 ID 查询已为 0。两条记录只补关联 ID，客户菜单 `SqlWhere` 未修改。源码同步单文件正文一致、冲突为 0，事件 meta 与文件时间已校准。定向回归 `node --test tests/customer-service-assignment.test.mjs` 覆盖新增、编辑、清空、实际提交参数及服务端旧客户端/拒绝路径。真实客服账号登录与截图尚未覆盖，等待用户刷新复核。

验证边界：架构检查、查重检查通过；完整 `check:ui` 在既有菜单隔离测试引用缺失的 Git 对象 `44096d7a1` 处停止。案例/跟进测试的依赖缺失已用修改前源码复现。机器可用内存约 1.2 GB，未运行全量构建或发布小程序；线上数据修复和服务端防漏存校验已生效。

四项同步适用性：这是 xjy 客户业务关联修复，无平台协议或通用能力变更，因此无需修改官方应用商城母版、官方中文文档或通用 Skills；本项目文档记录原因和验证边界。现有 MCP 的字段读取、业务行更新及表单事件保存/回读已覆盖本次修复，无需新增工具。
