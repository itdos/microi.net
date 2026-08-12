# Microi Unity SDK

`com.microi.unity` 是 Microi吾码面向 Unity 2022.3 LTS 与 WebGL 的客户端 SDK。它负责浏览器宿主桥接、DiyToken 请求头、V8 接口引擎调用、通用 WebGL 构建和可恢复的 Editor 优化工具；业务表、权限、幂等和流程仍由 Microi 表单引擎 / V8 接口引擎负责。

## 为什么不放进 `Microi.Server`

Unity 客户端依赖 `UnityEngine`、`UnityWebRequest`、WebGL `.jslib` 和 UPM 包结构，而 `Microi.Server` 是 .NET 10 服务端解决方案。把两者编译成同一个服务端类库会制造错误的运行时依赖，也无法被 Unity Package Manager 直接安装。因此本 SDK 位于仓库根目录；只有平台级、不可由 V8 复用的可信协议原子能力才应进入 `Microi.Server`。

## 安装

在 Unity 项目的 `Packages/manifest.json` 中添加本地依赖：

```json
{
  "dependencies": {
    "com.microi.unity": "file:../../../Microi.Unity"
  }
}
```

发布为 Git/UPM 包后，也可以改用带版本标签的 Git URL。

## V8 接口引擎调用

1. 在场景中新建对象并挂载 `MicroiApiClient`。
2. 设置 `Api Base Url` 与 `OsClient`，或让 Microi 页面宿主在 WebGL 就绪后调用 `ApplyMicroiHostContext`。
3. 通过协程调用接口引擎：

```csharp
StartCoroutine(client.PostJson(
    "app_unity_taoyuan_bootstrap",
    "{}",
    response => Debug.Log(response.RawJson)));
```

请求固定使用 `/apiengine/{ApiEngineKey}`，并自动附带：

- `osclient`
- `apiengine: 1`
- `authorization: Bearer {DiyToken}`（存在时）
- `did`（存在时）

SDK 会读取响应头中轮换后的 `authorization`，只保存在内存并通知 WebGL 宿主。禁止把 DiyToken 写进 URL、场景、Prefab、日志或版本库。

## WebGL 宿主约定

Unity 实例加载完成后，宿主页面向名为 `MicroiApiClient` 的对象发送：

```js
unityInstance.SendMessage('MicroiApiClient', 'ApplyMicroiHostContext', JSON.stringify({
  ApiBaseUrl: 'https://api.example.com',
  OsClient: 'tenant-key',
  Authorization: 'current-diy-token',
  Did: 'browser-device-id'
}))
```

`.jslib` 对外发出以下可选回调：

- `window.onMicroiUnityReady()`
- `window.onMicroiUnityAuthorizationRotated(token, requestToken)`
- `window.onMicroiUnityEvent(name, jsonPayload)`

跨域部署时，API 必须允许 WebGL 页面 Origin，并暴露 `authorization` 响应头；生产环境优先同源反向代理。

## 架构边界

- Unity：输入、渲染、角色、局部状态、离线降级。
- V8 接口引擎：业务规则、身份、数据权限、幂等、表单引擎编排。
- `Microi.Server`：只提供通用平台协议、安全和底层原子能力，不承载某个游戏的业务 Controller。
- 实时多人：需要时复用平台通用实时协议并以 `OsClient + EventId` 做租户隔离和幂等，不用进程内字典保存全局房间状态。

## Editor 工具箱

安装包后可从 `Microi → Unity → Toolbox` 使用：

- 相机点按完整层级路径预览、导出和导入，导入支持 Unity Undo；
- 仅对选中场景根节点执行按材质 Mesh 合并，精确记录源 Renderer 并可恢复；
- 仅对 Project 窗口选中目录分析和优化贴图，执行前写入完整 importer JSON 备份；
- 场景 Mesh、三角面、材质、Camera、Light 结构统计，不用经验值冒充 FPS；
- Camera 深度精度诊断、选中 Camera 的可撤销 near/far 调整；
- WebGL Balanced / High Definition 质量预设，修改前写入可恢复 JSON；
- 删除选中层级中 `CameraPoint_` 的多余 Camera 组件，不扫描或误改其它对象。

工具箱生成内容只写入项目自己的 `Assets/MicroiGenerated` 或 `ProjectSettings/MicroiUnityBackups`。Mesh 恢复时保留生成的 `.asset`，便于审计和源码管理；确认无引用后再由项目维护者删除。

## 来源说明

本包从 `AI-Project/任亿3D数字孪生/waiqiang-Anderson优化后` 中识别并重新设计了可复用边界。原项目的场景、模型、镜头脚本和素材没有被移动或删除；项目特有功能应作为 Samples 或业务项目代码继续演进。

现已提取并重写 WebGL 浏览器桥接、通用构建入口、Microi V8/DiyToken 客户端，以及相机点、Mesh、贴图、质量和深度诊断工具。新版工具箱补齐了选择范围、预览、`Undo`、Importer/质量备份和精确恢复引用，不沿用旧版“按名称扫描整个场景/工程”的行为。客户场景、旧合并 Mesh、镜头路径、触发区、设备字段和业务 GameManager 继续留在原项目，避免 Prefab GUID 断裂或把项目业务混入公共 SDK。
