# 客户合同金额只读聚合

`engine.js` 是接口 `xjy-customer-contract-totals` 的唯一可编辑源码，
`manifest.json` 是携带同一正文和版本的派生交付包。接口仅由这个租户资源
声明为 `Managed`，不修改现有审批、客户金额回写或合同状态任务。
更新源码后同步生成 Manifest 的 `engines[0].code/version`，通过测试确认一致。

请求：

```json
{"CustomerIds":["客户Id"],"CustomerSysMenuId":"当前真实客户菜单Id"}
```

响应的金额使用两位小数字符串，客户端校验后显示：

```json
{"Code":1,"Data":{"Customers":{"客户Id":{"Rental":{"Current":"100.00","All":"160.00"},"Buyout":{"All":"500.00"},"AnnualFilter":{"Current":"30.00","All":"60.00"}}},"AsOf":"2026-10-02","Scope":"统计范围说明","CurrentDefinition":"有效合同说明"}}
```

所有金额只汇总当前账号可见且未删除的已审批、已到期订单商品；已断约历史
计入 `All`。当前金额要求 `DingdanZT=已审批`、`HetongZT=未断约`，并满足
`HetongKSSJ ≤ 服务端今天 ≤ HetongJSSJ`，起止当天都有效。两个合同日期均为
租户实时 Schema 的 `varchar(25)`；缺失或非法日期不认定为当前有效合同。
`FuwuKSSJ/FuwuJSSJ` 是服务周期，不能替代合同周期。已到期纳入历史是因为
既有 `endTimeCheckDingdan` 会把服务期结束的已审批订单改为“已到期”。

商品合作方式以 `HezuoFS` 标签为准，只有标签为空才兼容实时字典
`HezuoFSZ`：1 买断、2 租赁、3 包年换芯、4 买断＋包年换芯、5 赠送、
ShiJi 试机。租赁累计 `Zongjia`；买断累计买断和组合商品的 `Zongjia`；
包年换芯累计纯换芯和组合商品的 `LvxinZJ`。两个金额已经包含商品数量，
不再乘数量、合同年数或单价，也不使用订单 `DingdanJE` 拆分。赠送、试机、
待审批、作废、软删除不计入。未知合作方式或缺少应计金额明确返回 `Code=0`。

权限与读取计划：

1. 固定租户 `xjy` 和 `https://api.jifulii.com`，从
   `V8.Method.GetCurrentToken()` 取得原请求活动会话，核对用户与租户。
   参数中的 Token、用户、ApiBase 和服务器可信标记不参与授权。
2. 经普通 HTTP `POST /api/FormEngine/GetTableData` 批量读取客户 Id，
   携带真实客户 `_SysMenuId`。只取 Id、固定平面排序并核对完整 DataCount。
   一项客户不在可见范围就失败，不返回部分零值。
3. 用同一会话读取整批客户的已审批/已到期订单 Id。订单未指定菜单时仍由
   平台当前用户授权缓存合并同表菜单查询范围或精确表级 Read 权限。
   每页1000项、最多5000项，稳定计数、页长、重复编号或截断异常都失败。
   这是整批订单分页，查询次数与客户数无关，不逐客户请求。
4. 两次参数化 SQL 分别读取这些授权订单的合同元数据、按客户聚合商品。
   Id 只通过 `AddInParameter` 绑定；SQL不接受动态表名、字段、角色判断或
   调用方SQL。不调用可信服务器 FormEngine 来冒充客户端权限。

没有授权订单可返回真实零；授权拒绝、HTTP/数据库失败、读取被截断或
并发计数变化返回 `Code=0`，客户端显示未获取并可重试。接口不写业务数据、
状态或缓存，不记录/返回 Token。`AsOf` 是服务端日期，权限查询和后续SQL
是分阶段只读操作，不承诺跨所有阶段的数据库快照隔离。

离线行为回归执行引擎实际 SQL，由 SQLite 测试数据库验证分类、金额、
日期及参数化语义；HTTP授权使用可拒绝/截断的替身，不能代替线上真实权限
与 MySQL 验收。测试含1001订单跨页、50客户常数查询、组合拆分、结束当天、
已到期/已断约历史、标签与字典冲突、删除/待审、注入值与失败路径。

```sh
node --test microi.uniapp/resources/xjy/customer-contract-totals/engine.test.mjs
node --test Microi.Server/Microi.Tests/UniApp/customer-contract-totals.test.mjs
```

后一入口同时导入服务端回归，已归入统一 `Microi.Tests` 自动发现。发布方需
先 plan/dryRun，再保存、回读精确代码/版本/哈希，最后验证真实普通用户权限、
实时金额和小程序展示。此目录本身不执行远端写入。
