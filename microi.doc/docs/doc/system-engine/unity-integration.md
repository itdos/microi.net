---
title: Unity 3D 与 WebGL 集成
description: 用 Microi.Unity、Unity WebGL 与 V8 接口引擎交付游戏、数字孪生和沉浸式应用。
outline: [2, 3]
---

<div class="mci-unity-doc-page" aria-hidden="true"></div>

<section class="unity-doc-hero">
  <div class="unity-doc-hero__copy">
    <p class="unity-doc-eyebrow">SYSTEM ENGINE · REAL-TIME 3D</p>
    <h1>让 Unity 场景，成为<br><em>可安装的吾码应用</em></h1>
    <p class="unity-doc-lead">Unity 负责实时 3D，Microi.Unity 负责浏览器桥接，V8 接口引擎负责身份、权限与数据。游戏、数字孪生、展厅，都沿用同一条交付链。</p>
    <div class="unity-doc-actions">
      <a class="is-primary" href="/app-detail.html?app=microi-unity-taoyuan">查看桃源云梦</a>
      <a href="#五分钟接入">五分钟接入</a>
    </div>
    <div class="unity-doc-badges" aria-label="核心能力">
      <span>UPM SDK</span><span>WebGL 2</span><span>DiyToken</span><span>V8 API</span>
    </div>
  </div>
  <figure class="unity-doc-hero__visual">
    <img src="/images/microi-unity-taoyuan-heroine.png" alt="晨雾桃园山谷中的原创古风女主" />
    <figcaption><b>桃源云梦</b><span>原创 Unity WebGL 样板</span></figcaption>
  </figure>
</section>

<section class="unity-doc-pillars" aria-label="Microi Unity 三层架构">
  <article><i>01</i><b>Unity / WebGL</b><p>场景、角色、物理、镜头与输入</p></article>
  <article><i>02</i><b>Microi.Unity</b><p>UPM SDK、会话注入与宿主事件</p></article>
  <article><i>03</i><b>V8 接口引擎</b><p>权限、业务规则与可靠持久化</p></article>
</section>

## 一套能力，三种交付

<div class="unity-doc-usecases">
  <article>
    <span>GAME</span>
    <h3>Web 3D 游戏</h3>
    <p>角色漫游、收集任务、排行榜与账号进度。</p>
  </article>
  <article>
    <span>TWIN</span>
    <h3>数字孪生</h3>
    <p>设备状态、告警、工单与实时场景联动。</p>
  </article>
  <article>
    <span>SHOWROOM</span>
    <h3>沉浸式展厅</h3>
    <p>园区、产线、文旅与产品的在线全屏展示。</p>
  </article>
</div>

Microi 已有大屏 Unity 加载能力与项目级工具。现在补齐的是公共 UPM SDK、稳定的 V8 通讯约定、可恢复的 Editor 工具箱、官方文档、Skill，以及可安装的完整 AI 应用样板。

<div class="unity-doc-decision">
  <span>架构结论</span>
  <div><b>Microi.Unity 放在仓库根级</b><p>它依赖 UnityEngine、UnityWebRequest 与 WebGL `.jslib`，属于 Unity Package Manager 包。</p></div>
  <div><b>不放进 Microi.Server</b><p>常规进度、设备状态和任务由 V8 编排；只有缺失的平台级可信原子能力才扩展服务端。</p></div>
</div>

## 从项目工具，升级为安全工具箱

旧数字孪生项目里的工具很实用，但会按名称扫描全场景、批量修改全工程资源。公共 SDK 采用更严格的可恢复边界：先选范围、再预览，修改前留下 Undo 或 JSON 备份。

<div class="unity-doc-install-grid">
  <article><b>相机点</b><p>按完整层级路径导入导出；变换与 Camera 设置均支持 Undo。</p></article>
  <article><b>Mesh 合并</b><p>只处理选中根节点，精确记录源 Renderer，不靠名称猜测恢复。</p></article>
  <article><b>贴图优化</b><p>只处理选中资源目录，修改 importer 前生成完整 JSON 备份。</p></article>
  <article><b>超清与性能</b><p>场景结构、深度精度与两档 WebGL 画质；真实 FPS 交给 Profiler 和浏览器验证。</p></article>
</div>

入口统一位于 `Microi → Unity → Toolbox`。生成 Mesh 放入项目的 `Assets/MicroiGenerated`，备份放入 `ProjectSettings/MicroiUnityBackups`；镜头路径、设备字段和客户业务脚本仍留在原项目 Adapter，避免破坏 Prefab GUID。

## 数据如何流动

<section class="unity-doc-flow" aria-label="Unity 与 Microi 通讯流程">
  <article><i>1</i><b>吾码页面</b><p>读取当前 ApiBase、OsClient、DiyToken 与设备标识。</p></article>
  <span aria-hidden="true">→</span>
  <article><i>2</i><b>WebGL 宿主</b><p>Unity 就绪后，用 SendMessage 把上下文注入内存。</p></article>
  <span aria-hidden="true">→</span>
  <article><i>3</i><b>Microi.Unity</b><p>用 UnityWebRequest 调用稳定的接口引擎 Key。</p></article>
  <span aria-hidden="true">→</span>
  <article><i>4</i><b>V8 + 数据库</b><p>验证身份与边界，以唯一请求号幂等保存。</p></article>
</section>

<div class="unity-doc-note is-security">
  <b>会话只进内存</b>
  <p>DiyToken 不进入 URL、场景、Prefab、日志或静态配置。宿主收到轮换 Token 时还会校验请求旧值，避免迟到响应覆盖新会话。</p>
</div>

## 桃源云梦 · 官方 AI 应用

<section class="unity-doc-app">
  <div class="unity-doc-app__poster">
    <img src="/images/microi-unity-taoyuan-heroine.png" alt="桃源云梦应用预览" />
  </div>
  <div class="unity-doc-app__body">
    <p class="unity-doc-eyebrow">MICROI AI APPLICATION · WEB</p>
    <h3>走进云海桃园，寻回九枚桃花灵韵</h3>
    <p>操控原创古风女主云绮行走、奔跑、跳跃；未登录可离线漫游，登录后由 V8 接口引擎恢复并保存进度。</p>
    <ul>
      <li><b>原创可分发</b><span>程序化场景与角色，不夹带来源不明模型</span></li>
      <li><b>完整商城包</b><span>Web 产物、2 张表、3 个接口和运营菜单</span></li>
      <li><b>租户可扩展</b><span>保存后 Hook 首次创建，官方升级永不覆盖</span></li>
    </ul>
    <div class="unity-doc-actions">
      <a class="is-primary" href="/apps.html">前往 AI 应用列表</a>
      <a href="/app-detail.html?app=microi-unity-taoyuan">应用详情</a>
    </div>
  </div>
</section>

安装后会得到：

<div class="unity-doc-install-grid">
  <article><b>在线游戏</b><p>全屏 WebGL 外壳、海报预载、失败降级与退出释放。</p></article>
  <article><b>玩家数据</b><p><code>app_unity_taoyuan_player</code> 保存当前快照。</p></article>
  <article><b>幂等台账</b><p><code>app_unity_taoyuan_save_log</code> 抵御重试与节点切换。</p></article>
  <article><b>运营菜单</b><p>查看玩家名称、灵韵数量、版本与最近在线。</p></article>
</div>

## 五分钟接入

### 1. 安装 UPM 包

在 Unity 项目的 `Packages/manifest.json` 添加：

```json
{
  "dependencies": {
    "com.microi.unity": "file:../../../Microi.Unity"
  }
}
```

<div class="unity-doc-code-caption"><b>公共包只放可复用能力</b><span>Runtime API · WebGL Bridge · Safe Toolbox · Editor Build · Samples</span></div>

### 2. 调用接口引擎

```csharp
StartCoroutine(client.PostJson(
    "app_unity_taoyuan_bootstrap",
    "{}",
    response => Debug.Log(response.IsSuccess ? "ready" : response.Msg)));
```

请求会自动携带：

```http
POST /apiengine/app_unity_taoyuan_bootstrap
Content-Type: application/json
osclient: {OsClient}
apiengine: 1
authorization: Bearer {DiyToken}
did: {DeviceId}
```

### 3. 页面注入上下文

```js
unityInstance.SendMessage('MicroiApiClient', 'ApplyMicroiHostContext', JSON.stringify({
  ApiBaseUrl: apiBase,
  OsClient: osClient,
  Authorization: currentDiyToken,
  Did: browserDeviceId
}))
```

<div class="unity-doc-events">
  <article><code>onMicroiUnityReady()</code><span>场景可接收上下文</span></article>
  <article><code>onMicroiUnityAuthorizationRotated()</code><span>安全同步轮换 Token</span></article>
  <article><code>onMicroiUnityEvent()</code><span>向宿主发送业务事件</span></article>
</div>

页面不可见时应暂停场景；真正离开时调用 `Quit()`。只隐藏 Canvas 不会释放 WebGL、WASM 与 GPU 内存。

## V8 服务端基线

<section class="unity-doc-rules">
  <article><i>身份</i><b>只信 V8.CurrentUser</b><p>拒绝客户端传入 UserId 冒充其他玩家。</p></article>
  <article><i>校验</i><b>重新验证状态变化</b><p>坐标、数量、文本长度都由服务端裁决。</p></article>
  <article><i>幂等</i><b>RequestId + 唯一索引</b><p>多节点、重试、断线恢复只产生一次结果。</p></article>
  <article><i>升级</i><b>Manifest + ResourcePolicies</b><p>核心接口 Managed，租户 Hook CreateIfMissing。</p></article>
</section>

<details class="unity-doc-details">
  <summary>查看幂等保存核心片段</summary>

```js
var user = V8.CurrentUser || {};
if (!user.Id) return { Code: 0, Msg: '未登录或 DiyToken 已失效。' };

var requestId = String(V8.Param.RequestId || '').trim();
if (!/^[A-Za-z0-9._:-]{16,80}$/.test(requestId)) {
  return { Code: 0, Msg: 'RequestId 格式不合法。' };
}

var replay = V8.FormEngine.GetFormData('app_unity_taoyuan_save_log', {
  _Where: [['RequestId', '=', requestId]]
});
if (replay && replay.Code === 1) {
  return { Code: 1, Data: { Replayed: true } };
}

// 继续校验坐标与进度，再写玩家快照和唯一幂等日志。
```

</details>

## WebGL 构建与上线

<div class="unity-doc-command">
  <span>UNITY 2022.3 LTS</span>
  <code>Microi → Taoyuan → Build WebGL</code>
  <p>构建脚本固定 WebGL 2、WASM、模板、场景与产物目录。</p>
</div>

```powershell
$unityExe = Join-Path $env:MICROI_UNITY_EDITOR_ROOT 'Unity.exe'
$projectPath = Join-Path $env:MICROI_REPOSITORY_ROOT 'AI-Project\microi\Unity'
& $unityExe `
  -batchmode -nographics -quit `
  -projectPath $projectPath `
  -executeMethod Microi.Taoyuan.Editor.TaoyuanWebGLBuild.Build
```

`MICROI_UNITY_EDITOR_ROOT` 指向 Unity Editor 目录，`MICROI_REPOSITORY_ROOT` 指向吾码仓库根目录；示例不绑定开发者电脑的盘符。

::: warning 程序化场景要单独检查 IL2CPP 裁剪
`GameObject.CreatePrimitive`、反射或字符串类型名不会完整出现在静态调用图中。先用 `link.xml` 精确保留动态类型；若浏览器仍出现 `class ID`、`class has been stripped` 或碰撞体缺失，程序化 WebGL 构建应关闭 `PlayerSettings.stripEngineCode`，再用包体变化与零错误控制台验收。模板同时启用 `autoSyncPersistentDataPath`，避免旧式文件系统同步警告。
:::

<div class="unity-doc-checks">
  <span>✓ 正确的 WASM / Data MIME</span>
  <span>✓ gzip / Brotli Content-Encoding</span>
  <span>✓ HTTP(S) 运行，不使用 file://</span>
  <span>✓ 桌面 64 位浏览器实测</span>
</div>

Unity 2022.3 的官方 WebGL 支持以桌面浏览器为主。移动端需要单独做触控、内存、画质和弱网分档，不能用桌面构建通过代替。

## 验收不是一句“能运行”

<div class="unity-doc-gates">
  <article><span>01</span><b>源码</b><p>UPM、C#、V8、Manifest 与安全扫描</p></article>
  <article><span>02</span><b>Editor</b><p>Play、移动、跳跃、碰撞与收集</p></article>
  <article><span>03</span><b>WebGL</b><p>IL2CPP、WASM 与完整静态产物</p></article>
  <article><span>04</span><b>浏览器</b><p>加载、全屏、焦点、退出与控制台</p></article>
  <article><span>05</span><b>真实租户</b><p>Token、用户隔离、重放和无权请求</p></article>
  <article><span>06</span><b>商城</b><p>公开列表、详情、安装、升级与回读</p></article>
</div>

每一层都是独立证据。源码检查不能描述成线上成功，应用受理编号也不能替代公开页面与非官方租户安装回读。

## 继续深入

<div class="unity-doc-links">
  <a href="/doc/system-engine/visualization-engine"><b>3D、CAD 与数据大屏</b><span>场景承载与可视化入口 →</span></a>
  <a href="/doc/v8-engine/api-engine"><b>接口引擎</b><span>编写可即时生效的后端 API →</span></a>
  <a href="/doc/system-engine/app-store"><b>应用商城</b><span>打包、安装与版本升级 →</span></a>
  <a href="https://docs.unity3d.com/cn/2022.3/Manual/webgl-browsercompatibility.html" target="_blank" rel="noreferrer"><b>Unity WebGL 兼容性</b><span>查看 Unity 2022.3 官方说明 ↗</span></a>
</div>
