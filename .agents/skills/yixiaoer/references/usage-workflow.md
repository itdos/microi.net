# yxer 使用流程文档

本文档面向实施、运营和使用同学，说明从首次安装到正式发布的标准使用流程。

## 1. 首次使用流程

### 步骤 1：安装 CLI

```bash
npm install -g @yixiaoermail/cli
```

### 步骤 2：初始化配置

```bash
yxer --version
yxer config init --api-key <apiKey>
```

### 步骤 3：安装 Skill

```bash
yxer skill sync
```

### 步骤 4：检查环境

```bash
yxer doctor
yxer config get
yxer skill show
```

## 2. 日常发布标准流程

所有发布任务建议固定按以下顺序执行。

### 步骤 1：检查环境

```bash
yxer doctor
```

### 步骤 2：查询目标账号

```bash
yxer accounts list 抖音 --json
```

确认目标账号可用，通常需要 `status=1`。

### 步骤 3：获取表单和 Schema

```bash
yxer prepare 抖音 video
yxer schema get 抖音 video
```

这一步用于确认必填字段、字段结构和枚举值。

### 步骤 4：上传资源

```bash
yxer upload --file .\video.mp4
yxer upload --file .\cover.jpg
```

说明：

- 图片、视频等资源必须先上传
- 不能直接在 payload 里手填外部 URL 冒充上传结果

### 步骤 5：查询复杂对象

按平台需要查询分类、位置、音乐、商品、合集或话题：

```bash
yxer query categories <account_id> --type video
yxer query locations <account_id> --query 上海
yxer query music <account_id> --query 热门
yxer query friends <account_id> [--red-id 小红书号] [--query 关键词]
```

### 步骤 6：填写 payload

标准结构示例：

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["抖音"],
  "publishChannel": "cloud",
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "<platformAccountId>",
        "contentPublishForm": {
          "formType": "task"
        }
      }
    ]
  }
}
```

### 步骤 7：校验

```bash
yxer validate 抖音 video .\payload.json
```

### 步骤 8：预演发布

```bash
yxer publish video 抖音 .\payload.json --dry-run
```

### 步骤 9：正式发布

```bash
yxer publish video 抖音 .\payload.json
```

## 3. 本机发布流程

当用户明确要求本机发布、本地发布或客户端发布时，必须使用 `local` 通道。

### 步骤 1：配置 `clientId`

```bash
yxer config set-local-client-id <clientId>
```

### 步骤 2：按本机模式校验

```bash
yxer validate 抖音 video .\payload.json --publish-channel local --client-id <clientId>
```

### 步骤 3：本机模式预演

```bash
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId> --dry-run
```

### 步骤 4：本机正式发布

```bash
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId>
```

## 4. AI Skill 使用流程

如果是 AI agent 调用本项目，推荐顺序如下：

1. 读取 `skills/yixiaoer/SKILL.md`
2. 读取 `skills/yixiaoer/references/workflows/common-rules.md`
3. 根据内容类型读取对应 workflow
4. 调用 `yxer doctor`
5. 调用 `yxer prepare` 和 `yxer schema get`
6. 生成 payload 后先 `validate`
7. 最后执行 `publish`

## 5. 常见故障处理

### `doctor` 提示 skill 未同步

执行：

```bash
yxer skill sync
```

### 云发布失败，提示代理问题

处理建议：

- 检查账号代理配置
- 必要时改为本机发布

### 本机发布失败，提示客户端不在线

处理建议：

- 启动并登录蚁小二客户端
- 重新执行本机发布

### 校验失败

处理建议：

- 回到 `prepare` 和 `schema get` 重新核对字段
- 不要猜字段，不要手写未经确认的复杂对象

## 6. 最小可用命令集

```bash
yxer doctor
yxer config get
yxer accounts list
yxer prepare <platform> <type>
yxer schema get <platform> <type>
yxer upload --file <file>
yxer validate <platform> <type> <payload.json>
yxer publish <type> <platform> <payload.json> --dry-run
yxer publish <type> <platform> <payload.json>
```
