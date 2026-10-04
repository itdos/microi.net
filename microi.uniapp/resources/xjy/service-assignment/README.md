# 售后指派与人员范围修复

`manifest.json` 只包含当前 xjy 租户两个已有接口的 Managed 更新，不建表、改字段、改菜单、写任务或修改任务阶段、财务规则。

- `shouhoudd_zhipai` v1.0.4：同商家普通账号可指派任意角色的启用人员；跨商家能力要求主库用户等级与已绑定有效角色等级同时达到 9999。姓名、电话、指派人均取真实记录。批量最多 200 条且全部任务须存在、有效、可指派后统一更新。
- `get-sysUser-list` v1.1.4：当前用户须为主库有效账号；普通账号固定当前商家，平台管理员关键词增加商家名称。现有卡片、组织筛选、状态筛选与字段投影保持原契约。

候选代码与官方同步目录原始字节绑定，`engine.test.mjs` 验证版本、代码及资源策略一致性，并覆盖 RoleIds 内嵌旧等级不影响真实主库角色判定；原有任务人员与通讯录断言不降低。统一回归入口为 `Microi.Server/Microi.Tests/V8/xjy-service-assignment.test.mjs`。

```bash
node --test Microi.Server/Microi.Tests/V8/xjy-service-assignment.test.mjs microi.uniapp/scripts/test-directory-card-config.mjs
```

主任务已在登录的 xjy MCP 上完成结构 plan、`dryRun:true`、正式安装与缓存回读 Verified。服务端仅规范化版本头为以上实际版本；本地完整拼接通讯录两段回读，核对字符范围与 SHA-256 后同步原始字节，未再次发布。实际派单会修改任务，本次验证采用本地行为回归，未执行真实派单业务更改。后续写入超时先回读，不盲目重试。

四项同步判断：这是已有租户业务接口修复，通过本 Manifest 交付当前租户，不改其它系统或官方平台母版；既有中文 `v8-client.md` 示例原位补人员 Id/服务端信任边界；既有 `v8-security` 已覆盖主库用户、有效角色和数据范围决策，无需新增平台 Skill；现有 MCP plan/generate/回读工具足够，无需新增协议工具。
