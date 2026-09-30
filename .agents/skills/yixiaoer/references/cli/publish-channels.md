# 发布通道说明

`yxer publish` 支持两种发布通道：云发布 `cloud` 和本机发布 `local`。通道会影响任务由云端代理执行，还是由用户本机客户端执行。

## 通道定义

| 通道 | 值 | 执行位置 | 默认 |
| --- | --- | --- | --- |
| 云发布 | `cloud` | 蚁小二云端服务 | 是 |
| 本机发布 | `local` | 用户本机蚁小二客户端 | 否 |

用户未明确指定时，CLI 默认使用 `cloud`。本机发布必须显式使用 `--publish-channel local`，并提供可用的 `clientId`。

## 参数来源优先级

发布通道只在当前命令执行时解析一次，优先级如下：

1. 显式 flag：`--publish-channel cloud|local`
2. 旧版第四位置参数：仅在已明确为 `local` 时兼容读取 `clientId`
3. payload 字段：`publishChannel` / `clientId`
4. 本地配置：`yxer config set-local-client-id <clientId>`，仅用于本机发布的 `clientId`
5. 默认值：`cloud`

云发布会移除 `clientId`，避免把本机连接信息带入云端请求。第四位置参数只为旧版兼容保留，新流程应使用 `--publish-channel local --client-id <clientId>`。

## 推荐命令

云发布：

```bash
yxer validate 抖音 video .\payload.json
yxer publish video 抖音 .\payload.json --dry-run
yxer publish video 抖音 .\payload.json
```

本机发布：

```bash
yxer validate 抖音 video .\payload.json --publish-channel local --client-id <clientId>
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId> --dry-run
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId>
```

如果已经配置默认本机客户端：

```bash
yxer config set-local-client-id <clientId>
yxer validate 抖音 video .\payload.json --publish-channel local
yxer publish video 抖音 .\payload.json --publish-channel local --dry-run
yxer publish video 抖音 .\payload.json --publish-channel local
```

## Dry-run 元数据

`yxer publish --dry-run` 会返回最终请求和通道解析结果。发布前应检查：

| 字段 | 含义 |
| --- | --- |
| `data.meta.effectivePublishChannel` | 最终生效通道 |
| `data.meta.publishChannelSource` | 通道来源：`flag`、`payload`、`positional`、`default` |
| `data.meta.clientIdSource` | `clientId` 来源：`flag`、`payload`、`positional`、`config`、`none` |
| `data.meta.requestHash` | 最终请求指纹，用于确认 dry-run 和正式发布使用同一份请求 |

`validate`、`publish --dry-run` 和正式 `publish` 必须使用同一份 `payload.json` 和同一套通道参数。

## 失败与回退

- 云发布报账号代理、云端代理或代理不存在问题时，可以提示用户检查代理配置，或在用户确认后改为本机发布。
- 本机发布报客户端不在线、获取在线设备失败时，应提示用户启动并登录蚁小二客户端，或在用户确认后改回云发布。
- `--auto-fallback-local` 不作为默认路径，只能在用户明确授权自动切换到本机发布时使用。

## 禁止行为

- 用户明确要求本机发布时仍默认走 `cloud`
- 本机发布缺少 `clientId`
- `validate`、`publish --dry-run`、正式 `publish` 使用不同通道参数
- 根据服务端默认值猜测通道，而不是以 CLI 解析结果为准
