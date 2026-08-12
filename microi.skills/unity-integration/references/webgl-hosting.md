# WebGL 宿主、性能与部署

## Poster-first 生命周期

1. 首屏只加载 DOM、主视觉和轻量构建状态。
2. 用户点击“进入 3D”后才创建 iframe/Canvas 并下载 Loader、Data、WASM。
3. 加载中显示真实进度，不用无限假动画。
4. 页面不可见或离开视口时 `SendMessage(..., SetHostPaused, true)`。
5. 重回前台恢复；离开页面调用 `Quit()` 并移除全部监听与全局回调。

错误状态至少区分：构建缺失、Loader 下载失败、Unity 初始化失败、浏览器能力不足、网络/CORS 失败。错误页仍应保留重试、返回与文档入口。

## 上下文注入

宿主在 Unity ready 后调用：

```js
unityInstance.SendMessage('MicroiApiClient', 'ApplyMicroiHostContext', JSON.stringify({
  ApiBaseUrl: runtime.apiBase,
  OsClient: runtime.osClient,
  Authorization: runtime.token,
  Did: runtime.did
}))
```

- 不使用 `?token=`、`?osClient=` 或 `?apiBase=` 传会话。
- iframe 同源时可读取父窗口内存上下文；跨域时由父页面显式 SendMessage，不能放宽为 `postMessage('*')` 接收秘密。
- 若使用 `postMessage`，发送与接收双方都校验精确 Origin、消息类型和结构。

## Token 轮换

Unity 发送 `(newToken, requestToken)`。宿主只在当前 Token 仍等于 `requestToken`（或统一认证库明确允许）时覆盖，防止先发请求后到达的旧响应回滚新会话。

更新顺序：统一认证库 → 微应用宿主 → 当前内存上下文 → 再注入 Unity。任何日志和业务事件都不得携带 Token。

## 性能分档

- 桌面 DPR 上限通常不超过 2；移动实验档建议 1.0–1.25。
- 阴影距离、级联、粒子、后处理、LOD 与贴图分辨率按设备档位联动。
- 首次下载和解压峰值要纳入浏览器内存；不能只看压缩包大小。
- 大型孪生数据按区域/层级流式加载，避免把全部模型放入一个 Data 包。
- 尊重 `prefers-reduced-motion`；DOM 外壳禁用非必要动效，Unity 内按项目需求提供镜头/粒子降级。

## 静态服务器

常见文件类型：

| 文件 | MIME |
|---|---|
| `.wasm` | `application/wasm` |
| `.js` | `application/javascript` |
| `.data` | `application/octet-stream` |
| `.json` | `application/json` |

预压缩 `.gz/.br` 必须返回匹配的 `Content-Encoding`，不能只靠扩展名。若托管方不能配置响应头，构建时启用 Unity 解压回退，并实测性能。

正式验收使用 HTTP(S)，检查状态码、MIME、Content-Encoding、CORS、缓存、Service Worker、控制台错误、全屏和退出后的内存/GPU 回落。
