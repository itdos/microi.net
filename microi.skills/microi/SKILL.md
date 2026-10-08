---
name: microi
description: Microi吾码快捷入口。连接租户、初始化 MCP、调用 V8 接口引擎、设计业务系统、AI 员工、自动化测试与发布时使用。可通过 /microi 调用。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# Microi吾码

默认使用简体中文。先完整读取同级 `../workspace-conventions/SKILL.md`，完成身份识别与四项同步检查，再完整读取 `../microi-codex/SKILL.md` 并按任务选择同级专项 Skill。

使用已登录的 `microi` CLI/MCP 连接；多连接明确选择 profile，先只读盘点再执行已授权操作。复用当前租户接口引擎、应用商城和现有业务资源，不创建第二套 Token，不把凭据放入命令行、回答或公开产物。

尚未连接时引导用户使用 Microi Agent 功能区的“服务器连接（MCP）”；官方 AI 账号在“Microi吾码 → 账号与资源”登录。工作区初始化后读取该工作区已有规则，不能覆盖客户已有改动。
