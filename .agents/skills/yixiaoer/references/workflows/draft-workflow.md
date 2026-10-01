# 草稿工作流

> 适用范围：用户提到“保存草稿”“先存草稿”“不要立即发布”“稍后再发”。

## 何时读取

- 用户要保存蚁小二内部草稿
- 用户把“草稿”和“发布”混在一起描述，需要分流

## 先做类型判断

先确认用户说的是哪一种：

- 蚁小二内部草稿：走 `yxer draft save <payload.json>`
- 平台草稿箱：仍走正常 `publish`，只是平台字段里可能体现草稿语义

若用户只说“保存草稿”，不要直接执行，先区分这两种。

## 蚁小二草稿标准步骤

1. 先判断发布类型：`video` / `imageText` / `article`
2. 读取 [`payload-sourcing.md`](./payload-sourcing.md)
3. 如 payload 尚未成型，按对应发布工作流补齐账号、schema、资源和动态字段
4. 生成或修正草稿 payload
5. 执行 `yxer draft save <payload.json> [--dry-run]`

微信公众号文章如果来源是 Word 文档，使用 `yxer draft import <article.docx>`，并同时传入账号 ID 和横版封面。该入口会提取 DOCX 内嵌图片、上传到素材库并替换为稳定 URL；竖版或正方形封面在上传前拒绝，不自动裁剪。

## 规则

- `yxer draft save` 保存的是蚁小二内部草稿，不等同于平台草稿箱
- 草稿 payload 仍应使用统一发布结构，不要另造 schema
- 若用户后续要正式发布，仍需回到对应发布 workflow，先 `validate` 再 `publish`

## 推荐命令

```bash
yxer draft save .\draft-payload.json --dry-run
yxer draft save .\draft-payload.json
yxer draft import .\article.docx --cover .\horizontal-cover.jpg --account-id <online-account-id> --author 蚁小二 --draft-id <existing-draft-id> --dry-run
```

## 严禁行为

- 把 `yxer draft save` 当成平台草稿发布
- 用户没确认草稿类型就直接执行
- 省略账号、资源、动态字段准备，直接存一个不完整 payload
