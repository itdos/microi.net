---
name: translate-engine
description: Microi 翻译引擎与多语言词条规范。用于 V8.TranslateEngine 文本/批量/HTML/检测/语言列表/文件/建议/健康能力、HTTP 与 MCP 翻译调用、GetLang 词条、供应商配置、租户隔离、缓存和验收。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi TranslateEngine

## API

```js
var r1 = V8.TranslateEngine.Translate('你好', 'en');
var r2 = V8.TranslateEngine.Translate('hello', 'cn', 'en');
var full = V8.TranslateEngine.TranslateText({
  SourceTexts: ['你好', '世界'], FromLang: 'auto', Lang: 'en',
  Format: 'text', Alternatives: 2
});
var detected = V8.TranslateEngine.Detect({ SourceText: 'Bonjour' });
var languages = V8.TranslateEngine.GetLanguages();
var health = V8.TranslateEngine.Health();
var suggestion = V8.TranslateEngine.Suggest({
  SourceText: 'Hello', SuggestedText: '你好', FromLang: 'en', Lang: 'zh'
});
var text = V8.TranslateEngine.GetLang('NoAuth', 'cn');
var item = V8.TranslateEngine.GetLangData('NoAuth');
var code = V8.TranslateEngine.GetLangCode('NoAuth');
```

`Translate` 返回 `DosResult`，`Data` 为兼容的单条译文字符串。`TranslateText` 返回包含单条/批量译文、检测语言、候选译文和格式的完整结构。其余业务方法：

| 方法 | 契约 |
|---|---|
| `TranslateText` | `SourceText/SourceTexts` 二选一；`FromLang=auto`；`Format=text/html`；`Alternatives=0..10` |
| `Detect` | 返回 `{Language, Confidence}[]` |
| `GetLanguages` | 返回当前服务真实安装的 `{Code,Name,Targets}[]` |
| `TranslateFile` | TXT/HTML/ODT/ODP/DOCX/PPTX/XLSX/EPUB/PDF Base64 输入，Base64 文件输出 |
| `Suggest` | 写入启用了 suggestions 的 LibreTranslate 服务；不是多候选翻译 |
| `Health` | 只返回健康和业务能力摘要，不返回 URL/Key |
| `GetLang/GetLangData/GetLangCode` | 读取 `diy_lang`，不调用翻译供应商 |

LibreTranslate 的 `/frontend/settings`、API Key 管理、`/metrics` 和 Web UI 是运维控制面，不得从普通 V8/HTTP/MCP 代理。

文件入口的完整名称是 `V8.TranslateEngine.TranslateFile({...})`，不要把叶子名误当全局函数。

## 租户与密钥

- V8 调用统一绑定当前 `V8TenantContext`。普通租户传其它 `OsClient` 不会跨租户翻译或读取配置。
- 普通租户未配置供应商时失败关闭，不得隐式回退借用主租户翻译地址、密钥或额度。
- Provider、Endpoint、Key、Secret、ApiKey 等只保存在服务端租户配置；不得进入前端 `SysConfig`、日志、错误响应或业务表。
- 主租户显式跨租户只允许可信控制面 C# 调用，不由 HTTP 参数建立信任。

## 词条优先

界面固定文案优先维护 `diy_lang` 词条，不要每次调用第三方翻译。Key 使用稳定英文标识，中文、英文等语言值统一回读。缺失词条应返回可诊断 fallback，而不是把密钥或供应商错误展示给用户。

## 动态翻译

- 校验源语言和目标语言白名单。
- 限制单条长度、批量条数、总字符数和超时。
- 用户隐私、合同、身份证、Token、密码和内部提示词不应发送到未批准的第三方供应商。
- 缓存 Key 包含 `OsClient + Provider + From + To + 文本哈希`；不要把原文直接作为 Redis Key 或日志。
- 供应商限流/失败使用有上限重试和熔断；不要无限重试阻塞 V8。

## LibreTranslate 自托管

LibreTranslate 是动态翻译供应商，不是 `diy_lang` 的替代品。一键安装默认部署；安装选择直接 Enter 等同 `1`，语言套餐直接 Enter 等同基础套餐 `1`。只有用户明确输入 `0` 才跳过编排。语言预设为：

1. `zh,zt,en`；
2. 预设 1 加 `ja,ko,vi,th,id,ms,tl`；
3. 安装脚本列出的全部语言。

用户可追加经过白名单校验的语言 Key。语言越多，首次模型下载越慢；一键安装不得等待模型下载或 HTTP 就绪。应先用同版本镜像独立初始化持久化 `api_keys.db`、写入并回读随机 API Key，再启动正式容器并确认其进入运行状态，让语言模型在容器中继续初始化，不阻塞吾码主体安装。

服务端统一从 SaaS 引擎租户配置读取 `TranslateProvider`、`TranslateUrl`（兼容 `TranslateApiUrl` / `LibreTranslateUrl`）、`TranslateApiKey`（兼容 `TranslateKey`）和 `TranslateTimeout`；不要再为翻译供应商增加 API 容器环境变量。密钥不得进入前端、日志或文档示例的固定默认值。

一键安装在 API Key 数据库预初始化成功、正式容器进入运行状态后，先启动平台 API，让共享升级租约中的幂等迁移补齐 `sys_osclients` 物理字段和 `diy_field` 元数据；API liveness 后立即回读 Upgrade31 的 4 个翻译物理字段，每秒一次且最多 15 秒，正常升级应首轮命中，镜像过旧或迁移失败应快速报错。只有数据库回读确认字段已存在，才能把当前 `OsClient` 的 `TranslateProvider=LibreTranslate`、Docker 内网 `TranslateUrl`、匹配的 `TranslateApiKey` 和超时写入并立即回读一致性。禁止在 API/Upgrade 启动前直接更新新字段，也禁止遇到 `Unknown column` 后由安装器伪造元数据。任一步失败都应终止安装。日志只显示 Provider 与 URL，禁止输出密钥。模型尚未完成时翻译能力可以暂时不可用，但不得拖住其它服务的安装。

吾码公开镜像固定为 `registry.cn-hangzhou.aliyuncs.com/microios/libretranslate:1.9.6-microi1`。该镜像基于 1.9.6 固定摘要，仅把与 `requests 2.31.0` 不兼容的 `chardet 7.x` 固定为 `5.2.0`，构建必须同时通过 `pip check` 和将 warning 视为 error 的 `import requests`。安装脚本不得通过隐藏所有 Python warning 来掩盖依赖漂移。

独立编排应使用 ASCII 目录和显式项目名 `docker compose -p microi-libretranslate`；只供平台 API 调用时，不默认开放 LibreTranslate 宿主机防火墙端口。需要公网调用时必须由运维显式配置 TLS、反向代理、访问控制、限流和强 API Key。

## HTTP 与 MCP

已登录 HTTP 入口固定为 `/api/Translate/TranslateText|Detect|Languages|TranslateFile|Suggest|Health`。Controller 必须用验证后的 Token 覆盖请求体 `OsClient`，不得接受 endpoint/key/header。

覆盖审计所用的标准路由为 `/api/translate/detect`、`/api/translate/languages`、`/api/translate/translatefile`、`/api/translate/suggest` 和 `/api/translate/health`；它们都服从同一登录与租户绑定规则。

MCP 固定工具：`microi_translate`、`microi_detect_language`、`microi_list_translate_languages`、`microi_translate_file`、`microi_suggest_translation`、`microi_get_translate_health`。文件翻译需要 `confirmExecution=TRANSLATE_FILE`，建议写入需要 `confirmExecution=TRANSLATE_SUGGEST`；审计只记录长度、SHA-256、语言和输出模式，不记录文本、文件内容、本机路径或凭据。大文件结果落到新的绝对路径，不允许覆盖已有文件。

## 安全硬上限

- 单条文本 5 万字符，单批最多 50 条/20 万字符，候选最多 10 个；
- 文件输入 20 MB、输出 25 MB；MCP 内联 Base64 额外限制为 2 MB；
- Provider URL 必须是无内嵌凭据的绝对 HTTP(S) 地址；禁用自动重定向；文件下载只允许与配置服务同源；
- 上游失败不回显响应体、堆栈、原文、内部 URL 或密钥；
- 语言缓存可作为节点级优化，但 Key 必须使用 `OsClient + URL + API Key 哈希`，不能含密钥明文，也不能作为共享事实源。

## 批量与后台任务

大量内容翻译使用 Job/MQ/outbox。每条记录保存源文本版本与目标语言，只有源版本未变化时写回结果；事件用稳定 Id 幂等。后端 `setTimeout/Task.Run` 不是可靠后台任务。

## 配置与缓存更新

词条或供应商配置修改后：

1. 回读当前租户配置或 `diy_lang`。
2. 递增共享配置版本/清理租户缓存。
3. 在另一个 API 节点验证新值，无需重启。
4. 确认旧请求失败不会覆盖新翻译。

## 验收清单

- [ ] `Translate` 的 `DosResult` 契约处理正确
- [ ] 词条优先，动态翻译只用于动态内容
- [ ] 普通租户无法伪造 `OsClient`
- [ ] 密钥、原始隐私文本和供应商堆栈不泄露
- [ ] 长度、批量、超时、限流和费用上限生效
- [ ] 一路 Enter 默认部署 LibreTranslate 基础套餐 1；显式输入 0 才跳过
- [ ] API Key 数据库预初始化成功且正式容器已启动
- [ ] LibreTranslate 内部端口未被安装脚本默认加入防火墙放行列表
- [ ] 翻译字段由幂等升级创建，安装器在 API 启动后最多 15 秒回读 schema 才写入配置
- [ ] 缓存按租户/供应商/语言隔离
- [ ] 多节点配置失效与批量幂等通过
- [ ] V8、HTTP、MCP 六类业务入口一致，运维面未被代理

### 复盘：模型下载期间健康检查误报成功导致 API Key 注册失败

- 触发场景：一键安装日志仍显示 `Updating Language models` / `Downloading ...`，脚本却已经进入 API Key 注册并报失败。
- 根因：LibreTranslate 1.9.6 的 `scripts/healthcheck.py` 在 `/tmp/booting.flag` 存在时直接返回成功；这只表示容器仍处于受支持的启动阶段，不表示 HTTP 服务或 `api_keys.db` 已就绪。
- 通用规则：不能把自带 healthcheck 当作模型和 HTTP 已就绪证明，也不能因此在一键安装中持续等待。安装器应在正式容器启动前独立创建并验证 API Key 数据库，容器启动只证明服务已安装；真实翻译可用性由运行期健康检查体现。
- 自动化检查：用同版本镜像在不执行入口脚本、不下载模型的条件下创建临时 `api_keys.db`，回读 Key 后启动正式容器；断言安装脚本不存在模型等待循环，随后清理隔离容器与卷。

### 复盘：首次语言模型下载阻塞整套一键安装

- 触发场景：国内服务器下载 LibreTranslate 语言模型极慢或网络不可达，一键安装每 30 秒输出一次等待状态，直到 3600 秒后失败，导致吾码其它服务无法继续安装。
- 根因：安装脚本把“翻译服务容器已安装”与“全部语言模型和 HTTP 已可用”绑定成同一个同步完成条件，并把 API Key 数据库初始化放在模型下载之后。
- 通用规则：API Key 数据库必须由同版本镜像在启动正式服务前预初始化并持久化；Compose 启动成功且容器进入运行状态后立即继续吾码安装。语言模型初始化属于服务自身后台过程，不得设置为主体安装的同步门禁，也不得循环输出累计等待秒数。
- 自动化检查：静态断言脚本没有模型等待、3600 秒超时及真实翻译同步烟测；隔离运行密钥初始化命令，验证数据库非空、随机 Key 可回读且终端不输出 Key，再验证正式容器能够使用同一持久卷启动。
