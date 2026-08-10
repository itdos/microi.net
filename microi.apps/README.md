# Microi吾码官方应用商城发行包

`microi.apps/` 保存可审计、可测试、可发布的官方应用商城发行包工程，不是某个服务器或租户的前端 AI 应用源码根。

发行包可以包含：

- 低代码系统 Manifest、表单/字段/菜单/权限定义；
- 接口引擎源码与 `Managed` / `CreateIfMissing` 资源策略；
- 任务、种子数据、安装与升级合同测试；
- 应用商城离线包生成逻辑，以及从权威前端项目生成的运行产物。

当前目录中：

- `ai-platform-studio/` 是 AI 平台治理的商城发行包；它的 MicroService 唯一可编辑源码位于对应服务器与租户的 `Microi-V8-Engine/.../AI应用/ai-platform-studio/`。
- `ai-content-operations/` 是纯低代码的 AI 内容运营安装包，没有独立 MicroService 工程。
- `wechat-content-security/` 是微信内容安全协议与接口引擎安装包，不是前端 AI 应用。

Web、UniApp、MicroService 项目统一放在：

```text
Microi-V8-Engine/{系统名称} ({ApiBase域名})/{OsClient}.{OsClientType}.{OsClientNetwork}/AI应用/{appKey}/
```

应用商城发行包需要前端产物或可选源码时，只能从该当前服务器、当前租户的唯一项目构建或打包；禁止在 `microi.apps/{packageKey}/microservice/` 再维护一份可编辑副本。
