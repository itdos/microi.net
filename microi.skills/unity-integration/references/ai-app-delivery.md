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
- 匿名模式只允许离线/公开玩法；持久化接口仍要求 DiyToken。
- `ApplicationType=Web`，独立入口为 `index.html`。
- 构建状态明确区分 `available` 与 `publishable`；无真实 Unity WASM/Data 时禁止正式发布。

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
4. 使用当前协议的 preflight/stage/finalize 同步私有源码；任何期望版本不一致都停止重基线。
5. 发布不可变 Web 运行版本，回读入口、文件数、哈希、状态与公开 URL。
6. 调用官方 `ai_app_publish_store` 生成并发布精确版本的应用商城包。
7. 回读 `sys_microistore` 的 AppKey、版本、状态、预览图、包摘要与资源策略。
8. 在官网 `/apps.html` 和 `/app-detail.html?app=<appKey>` 做公开页面回读。
9. 在一个非官方测试租户安装，回读表、菜单、接口和 Hook 所有权；再验证升级不覆盖租户 Hook。

源码同步、运行发布、商城发布、官网可见、目标租户安装是五项独立事实。任一步只有受理 ID 或 `doing` 状态，都不能报告最终成功。

## 版本与回滚

- 运行产物不可变；相同版本不可覆盖为不同哈希。
- 商城版本必须精确对应已验证运行版本与 Manifest。
- 升级遵循先扩展、后迁移、再收缩；新旧运行版本短暂并存时协议向前/向后兼容。
- 回滚恢复上一不可变运行版本；数据库变更需要显式兼容/补偿方案，不能用文件回滚伪装数据回滚。
