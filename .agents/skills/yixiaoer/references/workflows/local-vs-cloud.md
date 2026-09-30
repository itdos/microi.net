# 发布通道判断工作流

> 适用范围：任何会触发 `validate`、`publish --dry-run`、正式 `publish` 的任务。

## 何时读取

- 用户提到“云发布 / 本机发布 / 本地发布 / 客户端发布”
- 当前任务已经进入发布阶段，需要确定通道
- 云发布或本机发布刚刚失败，需要回退

## 决策树

1. 用户明确要求本机/本地/客户端发布：走 `local`。
2. 用户明确要求不要走云端代理：走 `local`。
3. 用户未指定发布通道：默认走 `cloud`。
4. 云发布遇到代理错误且用户接受切换：改走 `local`。
5. 本机发布提示客户端不在线且用户不便保持在线：改走 `cloud`。

## 本机发布门禁

- 必须显式带 `--publish-channel local`
- 必须确认 `clientId`
- `validate`、`publish --dry-run`、正式 `publish` 必须保持同一套通道参数
- 通道只在当前命令执行时解析一次；最终以 CLI 返回的 `publishChannel` 为准，不要根据服务端默认值猜测

## clientId 获取方式

1. 显式 flags：`--client-id <clientId>`
2. 本地默认配置：`yxer config set-local-client-id <clientId>`
3. payload 中已有 `clientId`

第四个位置参数 `yxer publish <type> <platform> <payload.json> <clientId>` 只用于旧版兼容，不再推荐 Agent 使用。

通道和 clientId 的优先级为：显式 flag > 旧版第四位置参数 > payload > 本地配置（仅 local 的 clientId）> 默认 cloud。cloud 发布会主动移除 clientId，避免把本机连接信息误带到云端。

## 推荐命令

```bash
yxer config get
yxer validate 抖音 video .\payload.json --publish-channel local --client-id <clientId>
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId> --dry-run
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId>
```

`publish --dry-run` 的 `data.meta` 会返回 `effectivePublishChannel`、`publishChannelSource`、`clientIdSource` 和 `requestHash`。正式发布前应确认这些值与授权意图一致；`requestHash` 用于确认 validate、dry-run 和最终 payload 没有被中途替换。

## 回退策略

- 云发布报“账号代理不存在”：提示检查代理配置，或改走本机发布
- 本机发布报“客户端不在线”或“获取在线设备列表失败”：提示用户启动并登录客户端，或改回云发布
- 不默认使用 `--auto-fallback-local`；该参数只在用户明确授权自动切换通道时使用

## 严禁行为

- 用户明确要求本机发布时仍默认走 `cloud`
- 本机发布未确认 `clientId`
- `validate` 用云发布、`publish` 却改成本机发布
