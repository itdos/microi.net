---
name: unity-integration
description: Microi吾码 Unity、UPM SDK、WebGL、3D 游戏/数字孪生、DiyToken/V8 通讯、AI 应用商城交付与完整验收规范。用于评估或提取 Unity 工具箱，创建 Microi.Unity 包，开发 WebGL 场景，接入 Microi.Client 宿主与 V8 接口，引入可授权素材，发布可安装 AI 应用，或审查 Unity 代码是否错误进入 Microi.Server。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi Unity 完整交付

目标不是“做出一个 Unity 工程”，而是交付一条可复用、可安装、可升级、可验证的 Microi 3D 应用链。

## 按任务读取参考

| 当前任务 | 必须读取 |
|---|---|
| 新建或调用 `Microi.Unity` | `references/sdk-api.md` |
| WebGL 模板、Microi.Client/AI 应用宿主、性能与部署 | `references/webgl-hosting.md` |
| AI 应用源码、商城包、官方发布与安装回读 | `references/ai-app-delivery.md` |
| 从已有客户项目提取 Unity 工具箱或素材 | `references/toolbox-migration.md` |

若任务横跨多项，逐个读取相应参考，不从文件名猜协议。

## 先做架构裁决

1. Unity 客户端 SDK 使用仓库根级 UPM 包：`Microi.Unity/package.json`。
2. `UnityEngine`、`UnityWebRequest`、Editor API 和 `.jslib` 不进入 `Microi.Server` 的 .NET 类库。
3. 玩家进度、设备状态、任务、积分和交互记录优先由 V8 接口引擎编排。
4. 只有缺失的平台级可信协议、鉴权、密钥隔离或底层原子能力，才允许修改 `Microi.Server`；修改前必须说明 V8 为什么无法完成。
5. 实时房间、租约、进度和去重事实必须按 `OsClient` 存入共享数据库、Redis 或可靠消息系统，不能用单节点内存字典当事实源。

推荐目录：

```text
Microi.Unity/                         公共 UPM SDK
├─ Runtime/Api/                       UnityWebRequest 与 DosResult
├─ Runtime/WebGL/                     C# 浏览器桥
│  └─ Plugins/WebGL/*.jslib
├─ Editor/                            通用构建工具
└─ Samples~/                          可运行最小示例

AI-Project/<project>/Unity/           具体 Unity 工程与场景
Microi-V8-Engine/.../AI应用/<appKey>/ 唯一 AI 应用源码与商城资源
microi.doc/docs/doc/system-engine/    官方长期文档
```

## 标准工作流

### 1. 发现与盘点

- 读取 Unity 版本、渲染管线、`Packages/manifest.json`、场景、Editor、Runtime、WebGL Plugins 和现有构建脚本。
- 搜索 Microi.Client 已有 Unity 宿主、现有 V8 Key、官方 AI 应用是否重名。
- 为模型、动作、贴图、字体、音频逐项记录来源、作者、许可证、版本和是否允许再分发。
- 在启动 Unity、Node、浏览器或构建前检查物理内存、同类进程、端口与任务归属。

### 2. 分离公共能力与业务能力

- API 客户端、DosResult、上下文注入、Token 轮换、浏览器事件和通用构建工具进入 UPM。
- 相机路径、触发区、特定场景模型、关卡、客户设备协议与业务脚本留在具体项目。
- 首次提取采用复制和重构；新包完成引用替换与回归前，不移动或删除旧项目文件。
- 公共包必须有 `package.json`、asmdef、README、LICENSE、CHANGELOG 与 Sample。

### 3. 建立 WebGL 宿主握手

- Unity 就绪后由宿主用 `SendMessage` 注入 `ApiBaseUrl/OsClient/Authorization/Did`。
- 会话只保存在运行时内存；禁止 Token 进入 URL、场景、Prefab、日志、构建产物或版本库。
- `.jslib` 只提供稳定事件：ready、authorization rotated、business event。
- Token 轮换回调同时携带发起请求时的旧 Token；宿主先做迟到响应保护，再更新统一会话。
- 页面离屏暂停；组件卸载调用 Unity `Quit()`，清理 iframe/Canvas、WASM、WebGL 上下文、监听器与全局回调。

### 4. 用 V8 设计服务端

```text
POST {ApiBase}/apiengine/{ApiEngineKey}
Content-Type: application/json
osclient: {OsClient}
apiengine: 1
authorization: Bearer {DiyToken}
did: {DeviceId}
```

- 身份只取 `V8.CurrentUser`；禁止相信客户端 UserId、角色、部门或权限结论。
- 重新校验坐标、数量、字符串长度、状态转换和资源归属。
- 写接口使用稳定 `RequestId/EventId` + 数据库唯一索引/幂等台账；锁不能替代幂等。
- 接口引擎 `Code=1` 自动提交，失败返回其它 Code 自动回滚，不手动 Commit/Rollback。
- 表、索引、菜单、接口与权限通过应用 Manifest 安装，不为游戏资源新增 `Microi.Upgrade` 定制迁移。
- 所有接口必须声明 `ResourcePolicies.ApiEngines`：官方核心 `Managed`；租户扩展 `CreateIfMissing`，后续升级不覆盖。

### 5. 构建可安装 AI 应用

- `ApplicationType` 使用 `Web`；Vue 3 + Vite + TypeScript 作为页面外壳，Unity Canvas/WebGL 与普通 DOM 分层。
- 官方租户的 `AI应用/<appKey>` 是私有源码、构建脚本、V8、Manifest 与商城合约的唯一编辑根。
- 页面必须 poster-first：未启动时不下载大体积 WASM/Data；提供加载、错误、重试、全屏、退出和低性能提示。
- 构建门禁必须拒绝缺失 Unity 产物的“空壳发布”，并校验 WASM、Data、体积、哈希、本机地址、source map 与疑似硬编码 Token。
- 先同步私有源码，再发布不可变 Web 产物，最后生成/发布商城包；三个动作分别回读。

### 6. 补齐官网与 Skill

- 长期能力在中文官网“系统引擎”下建立独立页面，并加入 `mapping_zh.json`、视觉画像与文档责任映射。
- 页面优先使用主视觉、架构卡、步骤卡和折叠技术细节；不要用连续大段文字堆满屏幕。
- 不手工维护 `microi.doc/docs/en/`，不因普通功能文档修改 `about/update-log.md`。
- 文档至少覆盖：架构边界、UPM 安装、宿主握手、V8 请求、安全、CORS、构建、部署、商城安装和分层验收。

## 资产与视觉红线

- AI 生成素材保存逐图提示词、生成时间、用途和源文件；不要只提交最终图片。
- 网络素材必须允许商业使用和再分发；许可证不清晰就改用原创、程序化或明确授权素材。
- 官方包不携带客户专属场景、品牌秘密、私有协议或无法追溯的二进制模型。
- “超清”不能只靠大纹理：同时控制材质、光照、阴影、LOD、裁剪、像素比和下载体积。
- 支持浅/深色外壳、键盘焦点、减少动效偏好、响应式安全区与清晰错误状态。

## WebGL 质量基线

- 使用仓库已验证的 Unity LTS；WebGL 采用兼容的 Built-in 或 URP，不走 HDRP。
- 校验 WebGL 2、WASM、正确 MIME、gzip/Brotli 响应头或解压回退、高 DPI 上限、全屏、键鼠/手柄、焦点恢复和退出释放。
- WebGL 必须经 HTTP(S) 验收，不能用 `file://`。
- Unity 2022.3 不把移动浏览器描述为官方支持；移动端需要独立触控、内存、画质和弱网测试。
- 程序化创建、反射或字符串类型名先用 `link.xml` 精确保留；若 WebGL 仍报告原生 `class ID` 被裁剪，可对该构建关闭 `PlayerSettings.stripEngineCode`，但必须复核包体和浏览器控制台。
- WebGL 模板设置 `autoSyncPersistentDataPath: true`，并把弃用警告也纳入控制台验收。
- 同一次高资源阶段只运行一个 Unity/Node/浏览器重任务，并遵守工作区 OOM 保护。

## 分层验收矩阵

| 证据层 | 必须断言 |
|---|---|
| 源码 | UPM 可解析、C# 编译、V8/Manifest/策略测试、安全扫描 |
| Unity Editor | Play、移动、奔跑、跳跃、碰撞、交互、暂停恢复 |
| WebGL | IL2CPP/WASM 构建成功，Loader/Data/WASM 完整 |
| 浏览器 | HTTP 加载、全屏、输入、控制台、DPR、退出释放 |
| Microi 租户 | 当前用户隔离、Token 轮换、保存重放、无权失败 |
| 多节点 | 重复投递、节点切换、失败恢复时副作用仅一次 |
| AI 应用 | 私有源码回读、运行版本哈希、列表/详情公开可见 |
| 应用商城 | 包版本/策略回读，非官方租户安装与升级通过 |

任何未执行层都要明确写成未验证或受阻。应用受理编号、源码测试或本地构建不能替代公开 URL、真实租户和非官方安装证据。

## 停止发布的条件

- Unity 许可证未激活或 WebGL 模块缺失。
- Unity 构建只有外壳，没有真实 WASM/Data。
- 素材许可证、AI 提示词或资产来源不可追溯。
- 正式产物出现本机地址、Token、source map 或超限单文件。
- 官方应用重名、目标版本不明确、远端源码/运行版本基线未回读。
- 商城包缺少 `ResourcePolicies.ApiEngines`，或把租户 Hook 错设为 `Managed`。
