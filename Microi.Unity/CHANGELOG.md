# Changelog

## 1.0.1 - 2026-08-14

- 修复 WebGL 宿主上下文为空时覆盖 SDK 默认 `ApiBaseUrl`、`OsClient` 与 `Did`，导致匿名 V8 联机不可用的问题。
- 保持退出登录时清理授权信息，同时允许 WebGL 与 Windows 独立运行继续使用项目配置的匿名接口引擎。

## 1.0.0 - 2026-08-11

- 新增 UnityWebRequest 版 V8 接口引擎客户端。
- 新增 DiyToken 内存注入、响应头轮换与 WebGL 宿主同步。
- 新增 WebGL JavaScript 桥接与通用构建工具。
- 从既有数字孪生项目安全重构相机点、Mesh 合并恢复、贴图备份优化、场景诊断、质量预设和 Camera 深度工具。
- 新增 V8 API Quick Start 样例。
