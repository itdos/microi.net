# Microi AI 应用前端基线

## 目录

1. 技术选择
2. 标准目录
3. 最小配置
4. 分层契约
5. 通用实时通信
6. 质量门

## 技术选择

“最主流”不是永远固定的单一框架。Microi 的默认标准选择 Vue 3 + Vite + TypeScript，是因为 Microi.Client、Microi.UI 和既有开发者能力均以 Vue 3 为主，同时 Vue 官方的新项目脚手架也是 Vite + TypeScript。需要 React/Next、Svelte 或其它框架时，用户必须明确选择，并仍遵守平台 SDK、租户、发布和验收契约。

版本策略：使用 Microi 当前维护的脚手架版本并提交 `package-lock.json`；升级依赖时单独提交、重新构建和截图，不让普通业务修改顺带漂移工具链。

## 标准目录

```text
AI应用/{appKey}/
  .microi-micro-app.json
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.ts
    App.vue
    env.d.ts
    components/
    pages/
    composables/
    domain/
    services/
    platform/
      microi.ts
      microi.v8.js
  tests/
  dist/                  # MicroService 默认；Web 项目可按清单使用 build/
```

`node_modules`、`dist/build`、覆盖率和本地环境文件不进入私有源码包。接口引擎源码按应用 Manifest 维护，但不被打进浏览器产物。

## 最小配置

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
})
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "useDefineForClassFields": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "tests/**/*.ts"]
}
```

推荐脚本：

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "typecheck": "vue-tsc --noEmit",
    "test": "vitest run",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "verify": "npm run test && npm run build"
  }
}
```

没有浏览器业务测试时可以先用 Node 原生测试，但复杂应用应使用 Vitest；关键 UI 流程使用 Playwright。不要为了“看起来主流”无条件加入 Router、Pinia、Element Plus或大型渲染库。

## 分层契约

```text
Vue SFC/pages
    -> composables/use-cases
        -> domain pure TypeScript
        -> services (ApiEngine / Realtime / Audio)
            -> platform Microi SDK and host context
```

- `domain` 只接收普通数据并返回普通数据。
- `services` 负责协议和 DTO，不把 HTTP/SignalR 对象泄漏到页面。
- `composables` 负责生命周期、忙碌态和错误恢复。
- `components/pages` 只消费可显示状态和明确动作。

## 通用实时通信

需要订单进度、协同状态或多人房间等实时刷新时，默认使用接口引擎通用 SignalR v2 契约；不要为应用新建业务专用 Hub。业务命令、订阅授权、事务和按用户裁剪的 Snapshot 均由接口引擎实现，SignalR 只发送事务提交后的公共投影。

- Hub 固定为 `/api-engine-realtime`，客户端调用 `SubscribeChannel({ ChannelKey, SubjectId })`，监听 `RealtimeEvent`。
- 连接必须使用普通登录 Token。现有 AccessKey 没有 `realtime:subscribe` scope，平台会拒绝其连接；在平台正式增加并校验该 scope 前，不得绕过此限制。
- 每次订阅或续租都会重新调用 `realtime_{channel_key}_authorize`，授权接口必须以 `V8.CurrentUser` 为准，不能信任客户端传入的用户、租户或接口 Key。
- 订阅按 30 秒时隙租约管理。客户端以服务端返回的 `RenewAfterMilliseconds` 安排下一次 `SubscribeChannel`，不得写死续租周期；页面隐藏后仍需订阅时继续续租，退出资源、注销或组件卸载时调用 `UnsubscribeChannel` 并清理定时器。
- 客户端按 `EventId` 去重、按 `Version` 忽略旧事件并检测缺口。连接失败、续租失败、重连或版本跳跃时，立即回退到业务 HTTP `Snapshot`，且始终保留有界轮询兜底。
- 接口引擎只能在成功结果的 `DataAppend.RealtimeEvent` 中声明 `Data` 公共投影；私有手牌、Token、密钥、用户专属字段和完整服务端状态只能由鉴权后的 Snapshot 返回。

续租应串行执行，避免一个页面产生重叠授权请求：

```ts
const subscription = { ChannelKey: 'room_updates', SubjectId: roomId }
let renewTimer: ReturnType<typeof setTimeout> | undefined

async function renewRealtimeLease() {
  clearTimeout(renewTimer)
  try {
    const lease = await connection.invoke<{
      ProtocolVersion: number
      RenewAfterMilliseconds: number
      LeaseExpiresAt: string
    }>('SubscribeChannel', subscription)
    renewTimer = setTimeout(
      () => void renewRealtimeLease(),
      Math.max(1_000, lease.RenewAfterMilliseconds),
    )
  } catch {
    await refreshSnapshot()
    renewTimer = setTimeout(() => void renewRealtimeLease(), 3_000)
  }
}
```

当前服务端还会在共享 Redis 中按租户和用户限制订阅授权频率，所有标签页和 API 节点共享计数。应用不得依赖单节点内存节流，也不得通过并发续租消耗限额。

## 质量门

- TypeScript 严格检查无错误；`any` 只能位于有说明的平台兼容边界。
- 每个写接口有请求 Id、重复提交保护和服务端校验。
- 构建资产使用相对路径，稳定入口与不可变版本入口均可打开。
- stage 前冻结 `CurrentVersion + AppVersion`，finalize 同时提交两项前置条件；旧请求晚到、应用身份漂移或清单收缩对账失败时不切换稳定入口。
- 生产 JS 不含 localhost、凭据、私有牌面、服务端源码或 source map。
- 首屏、登录/未登录、加载、空、错误、权限、成功状态均有响应式截图。
- Canvas/WebGL、音频和实时连接在隐藏/卸载时释放，并有低性能降级。
- 实时客户端已验证续租会重复授权、Token/资格撤销后停止收到事件，以及 SignalR/Redis 暂不可用时可通过 HTTP Snapshot 收敛。
