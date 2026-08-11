# Microi.Unity SDK API

## 包边界

`Microi.Unity` 是 Unity Package Manager 包，不是普通 .NET 类库。Runtime 代码兼容项目选定的 Unity LTS 和 C# 语言级别；Editor 代码使用独立 asmdef，不能被播放器编译。

## Editor Toolbox 菜单与边界

| 菜单 | 能力 | 可恢复保证 |
|---|---|---|
| `Camera Points...` | 按前缀与完整层级路径导入导出 Transform/Camera | 导入注册 Unity Undo |
| `Mesh Combine...` | 对选中场景根节点按材质合并 Mesh | 精确保存源 Renderer；Restore 或 Undo；生成 Mesh 资产保留 |
| `Texture Optimization...` | 对 Project 窗口选中目录分析和修改 importer | 修改前写 `ProjectSettings/MicroiUnityBackups` JSON，可恢复 |
| `Analyze Active Scene` | Mesh、顶点、三角面、材质、Camera、Light 统计 | 只读，不把结构统计换算成虚假 FPS |
| `Analyze Camera Depth Precision` | near/far 深度比诊断 | 只读 |
| `WebGL Quality and Depth...` | Balanced/High Definition 画质和选中 Camera 深度 | 画质先备份 JSON；Camera 使用 Undo |
| `Remove Camera Components...` | 清理选中层级里的 `CameraPoint_` Camera | 仅选中范围，支持 Undo |

禁止把工具改回全场景、全工程无范围扫描。凡是修改 AssetImporter、质量设置或生成 Mesh 的新功能，都必须先定义备份、恢复和失败中断语义。

```text
Runtime/Api/MicroiApiClient.cs
Runtime/Api/MicroiApiModels.cs
Runtime/WebGL/MicroiWebGLBridge.cs
Runtime/WebGL/Plugins/WebGL/MicroiWebGLBridge.jslib
Editor/MicroiWebGLBuildUtility.cs
Samples~/V8ApiQuickStart/
```

## MicroiApiClient

场景保持一个名称稳定的 `MicroiApiClient` GameObject。主要方法：

- `Configure(baseUrl, osClient, did)`：规范化 API 地址和租户上下文。
- `SetAuthorization(tokenOrBearerValue)`：去掉 Bearer 前缀，仅保存在内存。
- `ClearAuthorization()`：登出或宿主切换时清空会话。
- `ApplyMicroiHostContext(json)`：供 WebGL `SendMessage` 调用。
- `Post<TRequest,TData>()`：类型化 DosResult 请求。
- `PostJson()`：发送原始 JSON；ApiEngineKey 只允许字母、数字、点、下划线与短横线。

事件：

- `HostContextApplied`：宿主上下文完成更新。
- `AuthorizationRotated`：响应头返回新 DiyToken。

不要把 Token 暴露为可序列化字段或 Unity Inspector 字段。日志只允许记录状态，不输出请求头、Token 或完整敏感响应。

## DosResult 模型

成功判断同时考虑 HTTP 状态和 `Code=1`。`Code=1001/1002` 应交给宿主认证层处理，不能由 Unity 自行伪造新 Token。

```csharp
StartCoroutine(client.Post<SaveRequest, SaveData>(
    "app_unity_taoyuan_save",
    request,
    result => Apply(result.Data),
    failure => ShowRetry(failure.Msg)));
```

`JsonUtility` 不适合任意字典和顶层数组；复杂协议应增加稳定 DTO，或在明确兼容的 JSON 库上建立独立适配层。

## WebGL Bridge

C# 调用：

- `MicroiWebGLBridge.NotifyReady()`
- `MicroiWebGLBridge.NotifyAuthorizationRotated(token, requestToken)`
- `MicroiWebGLBridge.Emit(eventName, jsonPayload)`

`.jslib` 只转换字符串并调用页面全局函数，不缓存会话。非 WebGL/Editor 下的业务事件可以写脱敏调试日志，便于 Play 验收。

## Editor 构建工具

公共构建工具负责：

- 确认 WebGL BuildTargetSupport 已安装；
- 选择场景与模板；
- 固定 WebGL 2/WASM 和兼容压缩策略；
- 建立输出目录并生成可追溯构建结果；
- 失败时返回非零进程码，不生成“成功”哨兵。

特定游戏的场景创建、PlayerSettings 和输出路径配置放项目 Editor 脚本，调用公共工具，不硬编码进 UPM。
