# Scenes3D — Unity WebGL 3D 场景插件

> go-view 集成 Unity WebGL 的 3D 场景组件。除了内置控制面板，还提供 **全局 JS API**，
> 可在其它插件的"基础事件 / 高级事件 / 交互事件"中调用，从而实现"点击图表 → 切换 Unity 相机画面 / 控制播放"等联动效果。

- 插件源码：[UnityWebGL/UnityScene/index.vue](UnityWebGL/UnityScene/index.vue)
- WebGL ↔ JS 桥接：[`MicroiWebGLBridge.jslib`](../../../../../../../任亿3D数字孪生/waiqiang-Anderson优化后/Assets/Plugins/WebGL/MicroiWebGLBridge.jslib)
- Unity 端脚本：`Assets/Scripts/MicroiGameManager.cs`、`MicroiCameraController.cs`、`MicroiSimpleCameraPath.cs`

---

## 1. 通信架构

```
┌────────────────────────────┐                      ┌──────────────────────────────┐
│  其它 go-view 插件          │                      │  Unity WebGL 场景            │
│  (按钮/列表/图表)           │                      │  ┌────────────────────────┐ │
│                            │  ① window.$microiUnity│   MicroiGameManager       │ │
│  基础事件: onClick(){      │ ───────────────────▶ │   - StartPlayback         │ │
│    window.$microiUnity     │   .first().jumpTo()  │   - PausePlayback         │ │
│      .first()              │                      │   - JumpToPosition(id)    │ │
│      .jumpTo('position_2') │                      │   - ...                   │ │
│  }                         │                      │  └────────────────────────┘ │
│                            │                      │  ┌────────────────────────┐ │
│  api.on('reachPosition',   │ ◀─────────────────── │  MicroiWebGLBridge.jslib   │ │
│    pos => { ... })         │  ② OnReachPosition() │  → window.onUnityReach... │ │
└────────────────────────────┘                      └──────────────────────────────┘
```

- **JS → Unity**：通过 `unityInstance.SendMessage(target, method, param?)`，`target` 默认是配置项中的"GameManager 名称"（默认 `Main Camera`），`method` 是 GameManager 上的 public 方法。
- **Unity → JS**：通过 `[DllImport("__Internal")]` 调用 jslib 中导出的函数，jslib 再调用 `window.onUnityXxx`。

---

## 2. 全局 API：`window.$microiUnity`

Unity 场景组件挂载完成后，会把自身控制 API 注册到 `window.$microiUnity`：

```ts
window.$microiUnity = {
  register(key, api),       // 内部使用
  unregister(key),          // 内部使用
  get(idOrName): UnityApi | undefined,  // 按 chartId 或 instanceName 取
  first(): UnityApi | null,             // 取第一个实例（最常用）
  all(): { [key: string]: UnityApi },   // 全部
  list(): string[]                      // 所有 key
}
```

### 2.1 单个实例 API（`UnityApi`）

| 方法 | 参数 | 说明 |
|------|------|------|
| `isReady()` | — | 是否加载完成 |
| `play()` | — | 开始/恢复播放（对应 `StartPlayback`） |
| `pause()` | — | 暂停播放 |
| `resume()` | — | 从暂停处恢复 |
| `stop()` | — | 完全停止 |
| `restart()` | — | 重新从头播放 |
| `jumpTo(id)` | `string \| number` | 跳转到指定相机/路径点。支持：<br>- `'position_2'`（精确 ID）<br>- `2`（数字，自动拼成 `'position_2'`） |
| `sendMessage(method, param?)` | `(string, string?)` | 用配置的 GameManager 调用任意方法 |
| `sendMessage(target, method, param)` | `(string, string, string)` | 自定义 target 对象 |
| `getInstance()` | — | 返回 Unity 原始 `unityInstance`（高级用途） |
| `on(eventName, fn)` | — | 监听 Unity → JS 事件 |
| `off(eventName, fn?)` | — | 取消监听（不传 fn 清空全部） |
| `chartId` | 属性 | 当前组件的 go-view chartId |
| `name` | 属性 | 实例名（在配置中设置） |

### 2.2 Unity → JS 事件

通过 `api.on(name, fn)` 订阅：

| eventName | 回调签名 | 触发时机 |
|-----------|----------|----------|
| `'reachPosition'` | `(positionId: string) => void` | 相机到达任一触发点（对应 jslib 的 `OnReachPosition`） |
| `'playbackComplete'` | `() => void` | 动画播放完成 |
| `'debug'` | `(msg: string) => void` | Unity 调试输出 |
| `'notification'` | `(title: string, msg: string) => void` | Unity 请求显示通知 |
| `'ready'` | `(api: UnityApi) => void` | Unity 加载完成 |
| `'error'` | `(err: any) => void` | 加载失败 |

---

## 3. 配置项

在右侧"对外 API"折叠区中：

- **instanceName**：实例名，留空也能用 `first()` / chartId 访问，但建议起一个有意义的名字（如 `factory3D`），方便多个 3D 场景共存时区分。

> 一个看板上若只有一个 Unity 场景，直接用 `window.$microiUnity.first()` 即可。

---

## 4. 在其它插件中调用（重点）

### 4.1 基础事件（推荐）

任何插件 → 右侧"事件"标签 → "基础事件配置" → 选择 `onClick` 等事件，写入：

```js
// 跳转到第 2 个相机视角
window.$microiUnity?.first()?.jumpTo('position_2')
```

或按实例名：

```js
window.$microiUnity?.get('factory3D')?.jumpTo(2)
```

**安全调用模板**（推荐复制使用）：

```js
const u = window.$microiUnity && window.$microiUnity.first()
if (u && u.isReady()) {
  u.jumpTo('position_2')
} else {
  console.warn('Unity 场景尚未加载完成')
}
```

### 4.2 表格/列表行点击 → 跳转对应相机

例如某表格每行带有 `cameraId` 字段：

```js
// mouseEvent.row 是当前点击行（视具体插件而定）
const cameraId = mouseEvent?.row?.cameraId || 'position_1'
window.$microiUnity?.first()?.jumpTo(cameraId)
```

### 4.3 多按钮联动

若使用 5 个按钮控件，分别对应 5 个相机点位，每个按钮的 `onClick` 写：

```js
// 按钮 1
window.$microiUnity?.first()?.jumpTo(1)
// 按钮 2
window.$microiUnity?.first()?.jumpTo(2)
// ……
```

### 4.4 监听 Unity 事件，反向控制其它插件

例如想在到达 `position_3` 时弹出图层、或刷新某个图表：

**方式 A：在 Unity 场景的"高级事件 → 渲染之后"中**：

```js
// e.component.exposed 即是 UnityApi
const api = e.component.exposed
api.on('reachPosition', (positionId) => {
  console.log('Unity 到达:', positionId)
  if (positionId === 'position_3') {
    // 调用其它插件的 components[id] 进行联动
    // 或修改 store
  }
})
```

**方式 B：在任意插件的 `onMounted`/基础事件中**：

```js
// 注意：Unity 可能尚未注册，建议轮询或监听 ready
const tryBind = () => {
  const u = window.$microiUnity?.first()
  if (!u) { setTimeout(tryBind, 200); return }
  u.on('reachPosition', (id) => {
    console.log('reach:', id)
  })
}
tryBind()
```

### 4.5 高级用法：直接调 `sendMessage`

GameManager 上自定义了别的方法（如 `SetWeather`、`HighlightObject`），可直接发：

```js
// 默认 target = 配置中的 GameManager 名（如 Main Camera）
window.$microiUnity.first().sendMessage('SetWeather', 'rainy')

// 自定义 target 对象
window.$microiUnity.first().sendMessage('Sun', 'SetIntensity', '0.5')
```

---

## 5. Unity 端：当前已支持的方法

由 [`MicroiGameManager.cs`](../../../../../../../任亿3D数字孪生/waiqiang-Anderson优化后/Assets/Scripts/MicroiGameManager.cs) 提供（挂在配置的 GameManager 物体上）：

| C# 方法 | JS 调用 | 说明 |
|---------|---------|------|
| `StartPlayback()` | `api.play()` | 播放/恢复 |
| `PausePlayback()` | `api.pause()` | 暂停 |
| `ResumePlayback()` | `api.resume()` | 继续 |
| `RestartPlayback()` | `api.restart()` | 重新播放 |
| `StopPlayback()` | `api.stop()` | 停止 |
| `JumpToPosition(string)` | `api.jumpTo(id)` | 跳转相机点位 |

**新增自定义方法的步骤：**

1. 在 `MicroiGameManager.cs` 中添加 `public void XXX(string param)` 方法（参数最多 1 个 string）。
2. Unity 重新打 WebGL 包，发布静态资源。
3. JS 直接 `api.sendMessage('XXX', 'param')` 即可，无需改前端。

---

## 6. 添加新相机点位

1. Unity 编辑器中选中带 `MicroiSimpleCameraPath` 组件的相机。
2. `waypoints` 数组添加新元素，填入 `target`（空物体 Transform）和 `positionId`（建议命名 `position_6`）。
3. 重新打包发布。
4. 在前端右侧配置面板调整"路径点数量"（控制底部数字按钮显示数量）。
5. 其它插件事件中即可：`api.jumpTo('position_6')`。

---

## 7. FAQ

**Q1：调用 `jumpTo` 没反应？**
- 检查 `api.isReady()` 是否为 `true`，未加载完时调用会被忽略。
- 控制台搜 `[Unity3D] SendMessage`，看是否打印；若打印了但 Unity 没反应，说明 GameManager 名称配置错误（默认 `Main Camera`，需与 Unity 场景中物体名一致，区分大小写和空格）。
- 检查 `positionId` 拼写是否与 Unity 中 `MicroiCameraWaypoint.positionId` 一致。

**Q2：如何区分多个 Unity 实例？**
- 给每个 Unity 场景插件设置不同的 `instanceName`，然后用 `window.$microiUnity.get('xxx')`。

**Q3：监听到达事件 `reachPosition` 不触发？**
- 仅 `MicroiSimpleCameraPath` 模式下，路径点的 `positionId` 字段非空时才触发。
- WebGL 构建必须包含 [`MicroiWebGLBridge.jslib`](../../../../../../../任亿3D数字孪生/waiqiang-Anderson优化后/Assets/Plugins/WebGL/MicroiWebGLBridge.jslib)。

**Q4：在预览页（非编辑器）中是否可用？**
- 可用。组件 `onMounted` 时即注册，所有页面（编辑/预览/独立发布）一致。

**Q5：组件销毁后会留下脏数据？**
- 不会。`onBeforeUnmount` 会从 `window.$microiUnity` 中移除自身注册。

---

## 8. 速查（复制即用代码片段）

```js
// 跳转
window.$microiUnity?.first()?.jumpTo('position_1')
window.$microiUnity?.first()?.jumpTo(2)                    // 数字快捷写法
window.$microiUnity?.get('factory3D')?.jumpTo('position_3')

// 播放控制
window.$microiUnity?.first()?.play()
window.$microiUnity?.first()?.pause()
window.$microiUnity?.first()?.stop()
window.$microiUnity?.first()?.restart()

// 自定义消息
window.$microiUnity?.first()?.sendMessage('CustomMethod', 'param')

// 监听 Unity 事件
window.$microiUnity?.first()?.on('reachPosition', id => console.log(id))
window.$microiUnity?.first()?.on('playbackComplete', () => console.log('done'))

// 等待加载完成再调用
const waitUnity = () => new Promise(r => {
  const tick = () => {
    const u = window.$microiUnity?.first()
    if (u && u.isReady()) r(u)
    else setTimeout(tick, 200)
  }
  tick()
})
// 用法：const u = await waitUnity(); u.jumpTo(1)
```
