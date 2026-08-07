# 🌐 翻译引擎

> 翻译引擎提供动态翻译和 `diy_lang` 多语言词条读取。固定界面文案优先使用词条，动态内容才调用翻译供应商。

---

## V8 API

```js
// 兼容入口：Data 直接是单条译文字符串
var translated = V8.TranslateEngine.Translate('张三', 'en');
var translated2 = V8.TranslateEngine.Translate('love', 'cn', 'en');

// 完整 LibreTranslate 文本能力：单条/批量、自动检测、HTML、候选译文
var detail = V8.TranslateEngine.TranslateText({
  SourceTexts: ['你好', '世界'],
  FromLang: 'auto',
  Lang: 'en',
  Format: 'text', // text | html
  Alternatives: 2
});

var detections = V8.TranslateEngine.Detect({ SourceText: 'Bonjour tout le monde' });
var languages = V8.TranslateEngine.GetLanguages();
var health = V8.TranslateEngine.Health();

var noAuth = V8.TranslateEngine.GetLang('NoAuth');
var noLogin = V8.TranslateEngine.GetLang('NoLogin', 'cn');
var langCode = V8.TranslateEngine.GetLangCode('NoLogin');
var langData = V8.TranslateEngine.GetLangData('NoLogin');
```

`Translate` 返回 `DosResult`：

```js
var result = V8.TranslateEngine.Translate('你好', 'en');
if (result.Code !== 1) {
  return { Code: 0, Msg: result.Msg || '翻译失败' };
}
return { Code: 1, Data: result.Data };
```

`TranslateText.Data` 使用稳定统一结构：`Provider`、`IsBatch`、`SourceLanguage`、`TargetLanguage`、`Format`、`TranslatedText`、`TranslatedTexts`、`DetectedLanguage(s)`、`Alternatives` 和 `AlternativeGroups`。`GetLanguages.Data` 中每项包含 `Code`、`Name`、`Targets`，应以它作为当前容器实际已安装语言和可达语言对的事实源。

文件翻译支持 TXT、HTML、ODT、ODP、DOCX、PPTX、XLSX、EPUB 和 PDF：

```js
var fileResult = V8.TranslateEngine.TranslateFile({
  FileByteBase64: V8.FilesByteBase64['contract.docx'],
  FileName: 'contract.docx',
  FromLang: 'auto',
  Lang: 'en'
});
if (fileResult.Code !== 1) return fileResult;

// 接口引擎需开启“响应文件”后再返回
return {
  Code: 1,
  Data: {
    FileName: fileResult.Data.FileName,
    ContentType: fileResult.Data.ContentType,
    FileByteBase64: fileResult.Data.FileByteBase64
  }
};
```

若 LibreTranslate 启用了 suggestions，可提交改进建议：

```js
var suggestion = V8.TranslateEngine.Suggest({
  SourceText: 'Hello',
  SuggestedText: '你好',
  FromLang: 'en',
  Lang: 'zh'
});
```

该操作会写入翻译服务，不能用于普通“多候选翻译”；候选译文使用 `TranslateText.Alternatives`。

`GetLang` 返回 `diy_lang` 词条文本，`GetLangData` 返回词条对象。它们不调用 LibreTranslate。

### 能力边界

| LibreTranslate 业务能力 | V8 方法 | 说明 |
|---|---|---|
| 单条纯文本 | `Translate` / `TranslateText` | 旧入口保持兼容，新入口返回完整结构 |
| 批量、HTML、候选译文、自动检测 | `TranslateText` | 批量最多 50 条、总计 20 万字符；单条最多 5 万字符；候选最多 10 个 |
| 独立语言检测 | `Detect` | 返回语言和置信度列表 |
| 已安装语言及可达目标 | `GetLanguages` | 直接回读当前租户服务 |
| 文件翻译 | `TranslateFile` | 输入最大 20 MB，译后返回最大 25 MB |
| 建议反馈 | `Suggest` | 服务未启用 suggestions 时明确失败 |
| 健康/安全能力摘要 | `Health` | 不返回内部地址、API Key 或前端设置 |

LibreTranslate 的 `/frontend/settings`、API Key 管理、`/metrics` 和 Web UI 属于运维控制面，不能从普通 V8、HTTP 客户端或 MCP 透传。官方原生业务端点可参考 [LibreTranslate API](https://docs.libretranslate.com/api/)；吾码调用方只使用上表的租户网关，不直接拼接容器地址。

## HTTP 与 MCP 调用

已登录客户端可以调用以下后端接口；请求体中的 `OsClient` 会被忽略，以验证后的 Token 租户为准：

- `POST /api/Translate/TranslateText`
- `POST /api/Translate/Detect`
- `POST /api/Translate/Languages`
- `POST /api/Translate/TranslateFile`
- `POST /api/Translate/Suggest`
- `POST /api/Translate/Health`

吾码 MCP 提供同一套租户绑定能力：

- `microi_translate`
- `microi_detect_language`
- `microi_list_translate_languages`
- `microi_translate_file`
- `microi_suggest_translation`
- `microi_get_translate_health`

MCP 文本工具只接受文本、语言、格式和候选数；不能传 `OsClient`、Endpoint、API Key、Authorization 或任意 Header。文件翻译必须传 `confirmExecution="TRANSLATE_FILE"`，建议写入必须传 `confirmExecution="TRANSLATE_SUGGEST"`；审计只记录长度、SHA-256 和语言，不记录原文、译文、本机路径或凭据。大文件结果应写入新的绝对 `outputFilePath`，避免 Base64 进入 AI 上下文。

## LibreTranslate 开源自托管

LibreTranslate 是动态翻译供应商，不会替代 `diy_lang`。吾码 Docker 一键安装默认安装 LibreTranslate，直接按 Enter 使用基础套餐 1；如明确不需要动态翻译，可在安装提示输入 `0` 跳过。安装时可按套餐加载语言，并可追加语言 Key：

- 套餐 1（推荐）：简体中文 `zh`、繁体中文 `zt`、英语 `en`；
- 套餐 2：套餐 1 + 日语 `ja`、韩语 `ko`、越南语 `vi`、泰语 `th`、印度尼西亚语 `id`、马来语 `ms`、菲律宾语 `tl`；
- 套餐 3：脚本列出的全部 23 种语言。

加载语言越多，首次模型下载时间越长。一键安装脚本会在正式容器启动前用同版本镜像生成并回读随机 API Key 数据库，随后让模型在后台初始化，不阻塞平台主体安装。LibreTranslate 诊断端口只绑定 `127.0.0.1`，不会加入宿主机防火墙放行列表；平台 API 通过内部 Docker 网络访问。

平台 API 统一从 SaaS 引擎租户配置读取 `TranslateProvider`、`TranslateUrl`（兼容 `TranslateApiUrl` / `LibreTranslateUrl`）、`TranslateApiKey`（兼容 `TranslateKey`）和 `TranslateTimeout`。API 启动时的幂等升级会创建独立“翻译引擎”Tab 及字段；一键安装在 API 存活后立即回读 Upgrade31 的 4 个物理字段，每秒一次、最多 15 秒，字段存在后才写入主租户并立即回读验证，所以旧数据库不会再因 `Unknown column 'TranslateProvider'` 中断，也不会因镜像过旧白等 5 分钟。不同租户可维护各自的供应商与密钥。无需给 API 容器增加翻译环境变量，所有地址和密钥都只允许服务端读取。

完整的语言清单、ASCII 编排目录、`docker compose -p microi-libretranslate` 命令和安全注意事项见 [Docker 部署一键安装](../getting-started/docker-run)。

## 租户边界

V8 调用统一绑定当前 `V8TenantContext`。普通租户脚本在参数中传其它 `OsClient` 不会读取主租户或其它租户的词条、供应商和密钥。只有非 V8 的可信平台 C# 调用，或主租户明确授权的控制面调用，才能指定目标租户。

Provider、Endpoint、Key、Secret、ApiKey 等只保存在服务端租户配置；不能写入前端 `SysConfig`、日志、错误响应或业务表。

## 动态翻译安全

- 源/目标语言使用白名单；
- 限制单条长度、批量条数、总字符和超时；
- 用户隐私、合同、身份证、Token、密码和内部提示词不得发送给未批准供应商；
- 缓存 Key 使用 `OsClient + Provider + From + To + 文本哈希`，不把原文写入 Key/日志；
- 大批量翻译使用 Job/MQ/outbox，按源文本版本幂等写回。

词条或供应商配置修改后刷新共享租户缓存，并从另一 API 节点验证新值；不能依赖逐节点重启。

完整规范见 `microi.skills/translate-engine/SKILL.md` 与[平台安全与兼容基线](../more/security)。
