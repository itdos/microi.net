# 平台参考索引

平台字段和差异说明已收敛到 skill 包内部。Agent 应优先从本目录进入，而不是回到仓库根目录漫游。

## 通用索引

- 图文：`./imageText/index.md`
- 视频：`./video/index.md`
- 文章：`./article/index.md`

## 使用原则

1. 先走工作流和 `yxer` CLI。
2. 只有在构造平台特有字段时，才继续查具体平台文档。
3. 如果字段来源可以由 `yxer query categories`、`yxer query locations`、`yxer query music`、`yxer query friends` 等命令获得，优先用命令，不要手写对象；小红书用户艾特支持用 `--red-id` 查询陌生人。

## 维护约束

- 平台文档的 skill 内副本应与仓库根目录维护态文档保持同步
- skill 运行时优先读取本目录，不应再依赖任何根级历史平台副本
