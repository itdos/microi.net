# 发布排查工作流

> 适用范围：用户提到“发布失败”“查记录”“为什么没发出去”“帮我排查这个任务”“看一下历史发布”。

## 何时读取

- 发布失败后需要回查
- 用户提供错误信息或错误截图
- 用户想看最近的发布记录

## 标准步骤

1. 先确认问题属于哪一类：环境、账号、payload、资源、通道、平台返回错误
2. 执行 `yxer query records [--platform P] [--limit N] [--status S] [--json]`
3. 需要删除单个平台已发布作品时，执行 `yxer publish delete preview <task_set_id>` 查看作品信息，再用 `yxer publish delete from-record <task_set_id> --index N --dry-run` 按序号确认目标。
4. 结合最近一次 `validate` / `publish` 输出定位错误阶段
5. 回到对应 workflow：
   - 账号问题：[`account-selection.md`](./account-selection.md)
   - 通道问题：[`local-vs-cloud.md`](./local-vs-cloud.md)
   - payload 结构问题：[`payload-sourcing.md`](./payload-sourcing.md)
   - 发布类型问题：对应 `publish-video.md` / `publish-imageText.md` / `publish-article.md`

## 错误分类

- `doctor` 失败：环境问题
- `accounts list` 无可用账号：账号状态问题
- `prepare` / `schema get` 异常：平台能力或定义问题
- `upload` 失败：本地文件或 URL 资源问题
- `validate` 失败：payload 结构或字段值问题
- `publish --dry-run` 失败：发布前检查问题
- 正式 `publish` 失败：通道、代理、客户端在线状态或平台返回错误

## Instagram 视频特殊排查

- 如果错误包含 `The media could not be fetched from the provided URI`、`Video download failed`、`创建发布容器失败`，优先检查视频资源 key 或 URL 路径里是否带中文文件名。
- Instagram/Meta 会主动拉取视频 URL；带中文路径的媒体 URL 可能被 Meta 下载器直接判为 HTTP 400。
- 修复方式：把原视频重命名为英文、数字、连字符或下划线，再重新执行 `yxer upload`，并用新的 `video.key` 更新 payload 后重试发布。

## 推荐命令

```bash
yxer query records --platform 抖音 --limit 10 --json
yxer publish delete preview <task_set_id>
yxer publish delete from-record <task_set_id> --index 1 --dry-run
yxer doctor
yxer validate 抖音 video .\payload.json
```

## 规则

- 排查优先读错误信息和记录，不要先重写 payload
- 若错误发生在 `validate`，不要跳过它直接重试 `publish`
- 若用户给的是历史任务，先看 `yxer query records`，不要立刻重新发布

## 严禁行为

- 不看错误输出就盲目重试
- 未区分错误阶段就建议用户换平台或重发
- 直接修改业务内容，掩盖真实结构问题
