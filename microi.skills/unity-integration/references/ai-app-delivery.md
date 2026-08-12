# Unity AI 应用与商城交付

## 唯一源码

官方 AI 应用源码放在当前官方连接对应的：

```text
Microi-V8-Engine/<connection>/<product>/AI应用/<appKey>/
```

同一应用的 Vue 外壳、Unity 构建接入、V8 源码、Manifest、资源策略、测试和发布合约都从这里生成。Unity 工程可以保留服务端镜像，但必须由唯一源码生成并做一致性检查。

最小文件：

```text
.microi-micro-app.json
app.json
package.json
microi.routes.json
package-contract.json
resource-policies.json
system.manifest.json
src/
public/
server/engines/
scripts/
tests/
```

## Web 外壳

- Vue 3 + Vite + TypeScript。
- 复用工作区标准 `microi.v8.js` 与 `microi-ai-app-auth.js`，不要复制改造出第二套认证协议。
- 匿名模式可以承载公开多人玩法，但必须使用服务端签发、只存哈希、可过期的会话秘密；个人持久化接口仍要求 DiyToken。
- `ApplicationType=Web`，独立入口为 `index.html`。
- 构建状态明确区分 `available` 与 `publishable`；无真实 Unity WASM/Data 时禁止正式发布。
- WebGL 公屏优先使用可访问的 DOM 输入控件并拦截键盘传播；Windows 可使用原生 UI/UIToolkit。不要在外壳和 Unity 中重复绘制同一组操作提示。

## 多人租约与公屏交付

- 在线角色的事实源使用按 `OsClient` 隔离的共享数据库/Redis，不能使用 API 节点静态字典；客户端心跳周期必须短于租约超时。
- 加入响应只向本人返回会话秘密；数据库保存 SHA-256，位置快照只公开昵称、受限坐标、朝向、动作与房间版本。
- 正常卸载/离开主动调用 leave；浏览器崩溃、断网或 `kill -9` 依靠服务端租约自然失效，并通过两个真实客户端测量消失时间。
- 公屏接口校验在线会话、内容长度、表情白名单、速率窗口和请求幂等；公开读取只返回有限时间窗和有限条数。
- 轮询是兼容基线；接入 WebSocket/SignalR 时仍保留共享租约为事实源，并用 V8 授权接口签发短期频道权限。

## WebGL 与 Windows 双端交付

- WebGL 与 Windows 必须来自同一个 Unity 工程、场景和语义版本；禁止用旧本地包搭配新网页版本。
- Windows 默认交付 x64 安装包，至少包含当前用户安装、开始菜单入口和卸载信息；没有明确需求时不申请管理员权限。
- 外壳应给出醒目的本地版下载入口，并同时显示版本、文件大小与 SHA-256；文件名包含语义版本，旧版本 URL 不覆盖。
- 安装包属于公开运行资产，不属于私有源码。同步 `directory` 前必须排除 `public/downloads` 等生成目录，再把完整安装包随 `dist` 走流式资产发布；禁止拆分 Base64 或伪装成源码规避单文件上限。
- 发布后从公网地址重新下载完整 EXE，比较字节数和 SHA-256；本地制包成功、MCP 返回文件 Id 或 HTTP HEAD 成功都不能替代完整回读。
- 本地验收至少覆盖静默安装、主程序存在、可启动和卸载入口；签名状态、SmartScreen 信誉和硬件帧率必须单独如实说明。

## 商城资源

游戏进度表使用应用前缀 `app_*`，不要占用平台保留的 `mci_*` 名称。技术幂等表可以不创建可见菜单；玩家运营表创建父菜单 + 子数据菜单，隐藏 UserId、RequestId、哈希等技术字段。

接口策略示例：

```json
{
  "SchemaVersion": 1,
  "ApiEngines": {
    "app_game_bootstrap": { "Ownership": "Application", "UpgradePolicy": "Managed" },
    "app_game_save": { "Ownership": "Application", "UpgradePolicy": "Managed" },
    "app_game_after_save": { "Ownership": "Tenant", "UpgradePolicy": "CreateIfMissing" }
  }
}
```

租户 Hook 使用新的稳定 Key；首次安装后归租户维护，同 Key 后续版本不能改回 `Managed`。

## 官方发布顺序

只有当前 MCP 明确绑定官方 `https://api.itdos.com`、`OsClient=iTdos` 且用户已授权写入时才执行：

1. `microi_list_applications` 按精确 AppKey/中文名查重。
2. 读取远端应用上下文、源码版本、运行版本、行版本/围栏与路由快照。
3. 本地完成类型检查、测试、真实 Unity 构建和 dist 完整性校验。
4. 先同步私有源码；生成的 Unity、安装包与构建证据目录不得混入源码清单。任何期望版本不一致都停止重基线。
5. 发布不可变 Web 运行版本，回读入口、文件数、哈希、状态与公开 URL。
6. 若同时交付 Windows，从稳定公网地址下载完整安装包并核对大小、SHA-256 和版本；在线入口还要加载真实 WASM/Data。
7. 调用官方 `ai_app_publish_store` 生成并发布精确版本的应用商城包。超时属于结果不确定，必须回读包正文和 ZIP 后才能决定是否重试。
8. 回读 `sys_microistore` 的 AppKey、版本、状态、预览图、包摘要与资源策略，断言 `AppVersion == PackageInfo.Version == PreparedAssets.PackageVersion`。
9. 在官网 `/apps.html` 和 `/app-detail.html?app=<appKey>` 做公开页面回读。
10. 在一个非官方测试租户安装，回读表、菜单、接口和 Hook 所有权；再验证升级不覆盖租户 Hook。
11. 多人应用用两个独立浏览器会话互相验证昵称、位置、公屏；强制关闭一端，确认超过约定租约后另一端不再看到该角色。

源码同步、运行发布、商城发布、官网可见、目标租户安装是五项独立事实。任一步只有受理 ID 或 `doing` 状态，都不能报告最终成功。

## 版本与回滚

- 运行产物不可变；相同版本不可覆盖为不同哈希。
- 商城版本必须精确对应已验证运行版本与 Manifest。
- 升级遵循先扩展、后迁移、再收缩；新旧运行版本短暂并存时协议向前/向后兼容。
- 回滚恢复上一不可变运行版本；数据库变更需要显式兼容/补偿方案，不能用文件回滚伪装数据回滚。
