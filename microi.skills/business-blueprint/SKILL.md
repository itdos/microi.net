---
name: business-blueprint
description: Microi 业务架构蓝图（System Blueprint）— 设计期系统知识图谱，AI 生成低代码系统时防幻觉的唯一事实源
---

# Microi 业务架构蓝图（System Blueprint）

## 这是什么

业务架构蓝图是 Microi 吾码的 **设计期系统总图**，不是 n8n / Dify / ComfyUI 那种运行时工作流。它一次同时承担三个职责：

1. **可视化总图** — 用户在前端 X6 画布拖拽节点，完整描述一个业务系统的组成
2. **AI 事实源** — AI 生成代码、表、接口引擎、菜单前必读的"宪法"，防止幻觉
3. **VSCode/插件上下文** — 编辑器侧边栏据此提供精准的字段/接口/事件补全

## 三层模型（同一画布内分层）

| 层 | 关注点 | 典型节点 shape |
|---|---|---|
| 领域层 Domain | ER：表、字段、外键 | `table`, `field`, `relation` |
| 流程层 Process | 跨表业务流：单据流转、状态机、子流程 | `start`, `task`, `decision`, `subDiagram`, `end` |
| 行为层 Behavior | V8 事件、接口引擎、菜单按钮、定时任务 | `engine`, `v8Event`, `menuBtn`, `job` |

每个节点通过 `refs` 字段反向指向平台真实资源（diy_table / sys_apiengine / sys_menu / V8 事件文件 ...）。

## 数据存储（system tables，已建好）

| 表 | 作用 |
|---|---|
| `sys_business_blueprint` | 蓝图主表（BlueprintData JSON 存全图） |
| `sys_blueprint_relation` | 反向引用索引（resource→blueprint，用于"这张表/接口被谁引用" + 漂移检测） |
| `sys_blueprint_history` | 历史快照（diff/回滚） |

## MCP 工具

| Tool | 用途 | 写入 |
|---|---|---|
| `microi_get_blueprint_schema` | 读取蓝图协议指南 | 否 |
| `microi_list_blueprints` | 列出当前 OsClient 所有蓝图 | 否 |
| `microi_get_blueprint` | 读取单个蓝图（含 BlueprintData） | 否 |
| `microi_save_blueprint` | 创建或更新蓝图 + 自动写历史 + 重建反向索引 | 是（需 confirmExecution） |
| `microi_delete_blueprint` | 软删除蓝图 | 是 |
| `microi_validate_blueprint` | 漂移检测：所有 refs 是否仍存在 | 否 |

## AI 工作流（强制约定）

### 场景 A：用户提需求让 AI 生成新系统

```
1. microi_list_blueprints              # 看是否已有相关蓝图
2. microi_get_blueprint(id)            # 有则读取作为上下文
3. microi_get_manifest_schema          # 读 manifest 协议
4. microi_plan_system / generate_system
5. microi_save_blueprint               # 同步写入/更新蓝图（含本次新增的表/引擎/菜单引用）
6. microi_validate_blueprint           # 验收
```

### 场景 B：用户让 AI 修改某张表 / 加字段 / 改接口引擎

```
1. microi_list_blueprints + 文本搜索目标 table/engine 名
2. 命中蓝图 → microi_get_blueprint 读取
3. 根据蓝图理解上下文（这张表属于哪个业务流？哪些节点引用它？）
4. 执行修改（add_field / upsert_engine / save_event_code 等）
5. microi_validate_blueprint           # 检查引用是否漂移
6. 若蓝图内容变化（如字段重命名）→ microi_save_blueprint 同步
```

### 场景 C：用户问"这张表是干什么的 / 哪个接口在用它"

```
1. microi_list_blueprints
2. 通过反向索引 sys_blueprint_relation 查 → 后端会自动用，AI 不直接读
   实际操作：microi_get_blueprint 找节点 refs 包含该资源的节点
3. 把节点的 label / 所属 diagram / 上下游 edges 反馈给用户
```

## BlueprintData 协议（写入时关键）

参考 `microi_get_blueprint_schema` 工具返回。最小可用结构：

```json
{
  "diagrams": [
    {
      "id": "diag_main",
      "type": "process",
      "name": "总流程",
      "nodes": [
        {
          "id": "n1",
          "shape": "task",
          "label": "客户建档",
          "x": 100, "y": 200,
          "refs": {
            "tables": ["crm_customer"],
            "engines": ["api_customer_create"],
            "v8Events": ["crm_customer:SubmitBeforeServerV8"]
          }
        }
      ],
      "edges": [
        { "source": "n1", "target": "n2", "label": "审核通过" }
      ]
    }
  ],
  "domainModel": {
    "entities": [
      { "table": "crm_customer", "x": 50, "y": 50,
        "relations": [{ "to": "crm_contact", "type": "1:N", "via": "CustomerId" }] }
    ]
  },
  "menuTree": {
    "requiredDepth": 2,
    "groups": [
      { "name": "客户中心", "children": ["客户管理", "联系人管理"] },
      { "name": "业务运营", "children": ["工单管理", "服务记录"] },
      { "name": "报表中心", "children": ["检测报告", "阅读日志"] }
    ]
  }
}
```

`refs` 内可填的资源类型：`tables` `fields`（"table.field"）`engines` `menus` `v8Events`（"table:eventType"）`dataSources` `printTemplates` `workflows` `pages` `jobs`。

后台菜单必须在蓝图阶段规划为至少两级结构。客户、设备、工单、报告、日志、配置等业务域应先形成父级菜单，再把具体 CRUD/报表/日志页面作为子菜单写入 Manifest/MCP；不要把所有模块平铺为一级菜单。

如果是改造已生成系统，蓝图不能停留在建议层。必须列出现有一级菜单、目标父级菜单、每个子菜单的 `ParentId` 迁移关系，并通过 MCP 回读 `sys_menu` 验证迁移完成。

## 角色与权限蓝图

从自然语言需求生成 Microi 业务系统时，必须把角色、菜单权限、移动端能力和数据范围写进蓝图，而不是只建表和菜单。

要求：

- 内部账号默认使用 `sys_user`，角色来源为 `sys_user.RoleIds` 关联 `sys_role`。移动端和接口引擎都应按 `RoleIds` / `V8.CurrentUser` 判断能力。
- 蓝图中至少列出角色矩阵：角色名、使用端、后台菜单范围、移动端可见页面、关键动作、数据范围。常见角色如超级管理员、客服、售后师傅、客户账号。
- 多角色账号按能力并集处理；超级管理员（如 `Level>=999` 或“超级管理员”角色）默认拥有全部内部能力。
- 客户账号不能简单获得后台客户、工单、报告全量菜单。客户侧数据应通过客户手机号登录 token、客户绑定表和接口行级过滤提供。
- 菜单权限使用 `sys_rolelimit` 控制入口；接口引擎仍要做业务级权限和行级数据过滤，不能只依赖菜单是否可见。
- Manifest/MCP 交付后必须回读 `sys_role`、`sys_menu`、`sys_rolelimit`，验证角色存在、菜单授权正确。
- 如果 MCP 的通用角色写入工具因 `UpdateTime cannot be null` 等系统字段问题失败，要记录工具缺口并使用平台修复后的专用角色工具。临时迁移可用一次性接口引擎和参数化 `V8.Db` 补建角色，但必须回读验证，且不要把临时接口作为长期业务接口。

角色矩阵示例：

| 角色 | 后台菜单 | 移动端能力 | 数据范围 |
|---|---|---|---|
| 售后师傅 | 维保运营、工单、维保记录、检测报告 | 查看工单、接单、到场、提交记录、生成报告 | 分配给自己或待接单工单 |
| 客服 | 客户中心、维保运营、客户报修、报告中心、资讯 | 查看客户与报修、调度工单、查看报告 | 公司内部客户服务数据 |
| 客户账号 | 默认无后台菜单 | 查看绑定客户的计划、记录、报告，提交报修 | 仅绑定客户 |

## 不要做的事

- ❌ 不要把蓝图当成运行时执行器（它不会自动跑接口、不会调度任务）
- ❌ 不要在审批工作流（jsPlumb / wf_flowdesign）里用蓝图替代 — 两者并存，蓝图是设计图，工作流是执行图
- ❌ 不要跳过 `microi_get_blueprint` 直接生成代码 — 会产生幻觉（编造字段名、引用不存在的引擎）
- ❌ 写入 BlueprintData 必须是合法 JSON 字符串（后端会用 JObject.Parse 校验）

## 边界

- 蓝图 SaaS 隔离：`sys_business_blueprint.OsClient` + `sys_blueprint_relation.OsClient` 联合索引，不会跨租户
- 多人协作：当前 v1 用最后写入覆盖；后续 v2 计划加 `LockedBy/LockedAt` + diff 合并
- 历史快照：每次 SaveBlueprint 都自动落 `sys_blueprint_history`，可通过 BlueprintId 时序回溯
