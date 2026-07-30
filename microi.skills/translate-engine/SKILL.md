---
name: translate-engine
description: Microi 翻译引擎与多语言词条规范。用于 V8.TranslateEngine.Translate、GetLang、GetLangData、语言码、供应商配置、租户隔离、缓存、批量翻译和验收。
---

# Microi TranslateEngine

## API

```js
var r1 = V8.TranslateEngine.Translate('你好', 'en');
var r2 = V8.TranslateEngine.Translate('hello', 'cn', 'en');
var text = V8.TranslateEngine.GetLang('NoAuth', 'cn');
var item = V8.TranslateEngine.GetLangData('NoAuth');
var code = V8.TranslateEngine.GetLangCode('NoAuth');
```

`Translate` 返回 `DosResult`，不要把结果对象当字符串；先检查 `Code`，再读取 `Data`。`GetLang` 返回词条文本。

## 租户与密钥

- V8 调用统一绑定当前 `V8TenantContext`。普通租户传其它 `OsClient` 不会跨租户翻译或读取配置。
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

LibreTranslate 是可选动态翻译供应商，不是 `diy_lang` 的替代品。一键安装默认不部署；只有用户明确选择时才生成编排、随机 API Key 和语言模型清单。语言预设为：

1. `zh,zt,en`；
2. 预设 1 加 `ja,ko,vi,th,id,ms,tl`；
3. 安装脚本列出的全部语言。

用户可追加经过白名单校验的语言 Key。语言越多，首次模型下载越慢；一键安装不得等待模型下载或 HTTP 就绪。应先用同版本镜像独立初始化持久化 `api_keys.db`、写入并回读随机 API Key，再启动正式容器并确认其进入运行状态，让语言模型在容器中继续初始化，不阻塞吾码主体安装。

服务端统一从 SaaS 引擎租户配置读取 `TranslateProvider`、`TranslateUrl`（兼容 `TranslateApiUrl` / `LibreTranslateUrl`）、`TranslateApiKey`（兼容 `TranslateKey`）和 `TranslateTimeout`；不要再为翻译供应商增加 API 容器环境变量。密钥不得进入前端、日志或文档示例的固定默认值。

一键安装在 API Key 数据库预初始化成功、正式容器进入运行状态后，必须把当前 `OsClient` 的 `TranslateProvider=LibreTranslate`、局域网基础地址 `TranslateUrl`、匹配的 `TranslateApiKey` 和超时写入 `sys_osclients`，并立即回读一致性；任一步失败都应终止安装。日志只显示 Provider 与 URL，禁止输出密钥。模型尚未完成时翻译能力可以暂时不可用，但不得拖住其它服务的安装。

独立编排应使用 ASCII 目录和显式项目名 `docker compose -p microi-libretranslate`；只供平台 API 调用时，不默认开放 LibreTranslate 宿主机防火墙端口。需要公网调用时必须由运维显式配置 TLS、反向代理、访问控制、限流和强 API Key。

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
- [ ] LibreTranslate 未选择时不部署；选择后 API Key 数据库预初始化成功且正式容器已启动
- [ ] LibreTranslate 内部端口未被安装脚本默认加入防火墙放行列表
- [ ] 缓存按租户/供应商/语言隔离
- [ ] 多节点配置失效与批量幂等通过

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
