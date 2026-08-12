# 微信小程序内容安全应用

本目录位于官方租户的 `AI应用/wechat-content-security`，是该平台应用及应用商城包的唯一可审计源码。它没有独立前端运行时，不属于 `Microi.Upgrade` 启动迁移，也不会在 API 启动时逐租户执行；工作区不得在 `microi.apps/` 维护平行副本。

- `core.js`：官方受管核心接口。C# 只完成微信协议验签、AES 解密与 AppId 校验，状态更新、日志和 Hook 编排在这里完成。
- `status-batch.js`：官方受管批量状态接口。按当前 DiyToken 用户读取共享 Redis 中自己的审核记录，供 UniApp 多图审核合并轮询。
- `extension.js`：租户扩展接口模板。策略为 `CreateIfMissing`，首次安装后应用更新永不覆盖，也不得把同一 Key 改回 `Managed` 接管。
- `app.microi.wechat-content-security.json`：由 `node build-package.mjs` 生成并发布到官方应用商城。

发布前执行 `npm run verify`，确保包文件与三份接口引擎源码一致且资源所有权策略通过测试。

微信后台推荐填写：

```text
https://你的API域名/api/WeChatContentSecurity/Callback--OsClient--你的OsClient--
```

普通 HTTP 调试也支持 `?OsClient=你的OsClient`，不使用 `?o=`。
