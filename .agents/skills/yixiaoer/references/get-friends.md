# 获取小红书用户/艾特对象 (Get Friends)

用于查询可在小红书描述中艾特的完整用户对象，支持按小红书号搜索不在当前账号好友列表中的陌生人。查询结果是发布时 `<friend>` 标签的唯一数据来源。

## 1. 调用指令

按小红书号精确查询：

```bash
yxer query friends <account_id> --red-id <小红书号> --json
```

也可以按小红书号或昵称搜索：

```bash
yxer query friends <account_id> --query <关键词> --json
# --keyword 是 --query 的别名
```

`account_id` 必须是小红书账号的蚁小二账号 ID。`--red-id` 会把小红书号作为远端搜索关键词发送，再对返回对象的 `raw.red_id` 做精确匹配，因此不会局限于好友列表。

契约对照：CLI 网关参数名是 `keyWord`；蚁小二客户端直连小红书接口的参数名是 `keyword`。两者语义相同，都是用户搜索关键词。

CLI 会保留后端返回的完整用户对象放在 JSON 的 `data` 中；不要根据昵称或其他自然语言自行构造对象。

## 2. 在小红书描述中艾特用户

小红书的艾特内容写在 `contentPublishForm.description` 的 HTML 中，不是单独的 `friends` 字段：

```html
<p>记录生活 <friend raw='用户查询结果的完整 JSON 序列化字符串'>@用户名称</friend></p>
```

组装规则：

1. 执行 `yxer query friends <account_id> --red-id <小红书号> --json`，从 `data.list` 中选择目标用户。
2. 将选中的完整用户对象序列化为 JSON，写入 `<friend>` 的 `raw` 属性；不能只保留 ID、昵称或内部 `raw` 子对象。
3. 标签正文使用 `@` 加上查询结果中的 `yixiaoerName`，并将最终 HTML 放入 `description`。
4. 用同一份 payload 执行 `yxer validate` 和 `yxer publish --dry-run`；CLI 会保留 `<friend>` 标签，不会把它改写成普通文本。

`raw` 是 HTML 属性中的字符串，因此生成 JSON payload 时需要按 JSON 规则转义其中的双引号。用户对象必须来自本次 CLI 查询。

## 3. 返回对象使用约束

- `data.list` 中的每一项都是一个完整用户对象，发布时整体透传。
- 对陌生人也必须使用查询返回的完整对象；不要手写 `red_id`、昵称或一个简化的 `raw` 对象。
- 查询结果为空时不要编造兜底对象，应让用户确认小红书号、账号登录状态或平台返回结果。
- 返回多个用户时，应根据用户明确的小红书号、昵称或稳定 ID 选择，不能默认选择第一项。
