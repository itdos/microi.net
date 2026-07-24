# 🌐 翻译引擎

> 翻译引擎提供动态翻译和 `diy_lang` 多语言词条读取。固定界面文案优先使用词条，动态内容才调用翻译供应商。

---

## V8 API

```js
var translated = V8.TranslateEngine.Translate('张三', 'en');
var translated2 = V8.TranslateEngine.Translate('love', 'cn', 'en');

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

`GetLang` 返回词条文本，`GetLangData` 返回词条对象。

## LibreTranslate 开源自托管

LibreTranslate 是动态翻译的可选供应商，不是平台必装依赖，也不会替代 `diy_lang`。Docker 一键安装默认跳过；选择安装后可按套餐加载语言，并可追加语言 Key：

- 套餐 1（推荐）：简体中文 `zh`、繁体中文 `zt`、英语 `en`；
- 套餐 2：套餐 1 + 日语 `ja`、韩语 `ko`、越南语 `vi`、泰语 `th`、印度尼西亚语 `id`、马来语 `ms`、菲律宾语 `tl`；
- 套餐 3：脚本列出的全部 23 种语言。

加载语言越多，首次模型下载和健康检查时间越长。一键安装脚本会生成随机 API Key，等待服务就绪并确认 Key 注册成功；LibreTranslate 端口不会默认加入宿主机防火墙放行列表。

平台 API 可使用服务端环境变量连接：

```text
MICROI_TRANSLATE_PROVIDER=libretranslate
MICROI_TRANSLATE_URL=http://翻译服务地址:端口
MICROI_TRANSLATE_API_KEY=随机强密钥
MICROI_TRANSLATE_TIMEOUT=120
```

也可在 SaaS 引擎的租户配置中维护 `TranslateProvider`、`TranslateUrl`（兼容 `TranslateApiUrl` / `LibreTranslateUrl`）、`TranslateApiKey`（兼容 `TranslateKey`）和 `TranslateTimeout`。环境变量适合整套部署的服务端兜底；租户配置适合不同租户使用不同供应商或密钥。所有地址和密钥都只允许服务端读取。

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
