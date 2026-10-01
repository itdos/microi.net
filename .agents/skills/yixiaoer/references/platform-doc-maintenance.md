# 平台文档维护规范

本文档定义 `skills/yixiaoer/references/platforms/` 与根目录历史文档副本的角色分工，避免平台文档长期双轨漂移。

## 目录角色

- `skills/yixiaoer/references/platforms/`
  - skill 运行时唯一有效的平台文档入口
  - Agent 读取平台差异时，必须优先读取这里
  - 这里的内容优先级最高
- 根目录历史平台文档副本
  - 仅供仓库人工查阅、比对和批量编辑
  - 不再作为 skill 或 agent 主入口

## 维护原则

1. 平台文档发生变更时，先更新 `skills/yixiaoer/references/platforms/`
2. 如果仍保留根目录副本，同一轮变更内必须同步更新
3. 若两处内容冲突，以 `skills/yixiaoer/references/platforms/` 为准
4. 新增平台或新增字段时，所有引用路径应指向 skill 内平台目录

## 引用规范

- skill 入口：`skills/yixiaoer/SKILL.md`
- 任务分域：`skills/yixiaoer/references/domains/`
- 平台索引：`skills/yixiaoer/references/platforms/*/index.md`
- 平台细节：`skills/yixiaoer/references/platforms/<type>/<platform>.md`

## 禁止事项

- 不要再把历史平台副本写成“唯一入口”
- 不要在 workflow 中把根目录历史副本作为 agent 默认跳转路径
- 不要只修改历史副本而遗漏 skill 内平台文档
