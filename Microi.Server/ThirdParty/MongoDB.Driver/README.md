# MongoDB 平台兼容驱动

平台存在 MongoDB 3.6（wire version 6）数据源；原版 C# 驱动 3.10+ 要求服务端至少 4.4。
直接降回 2.30 会重新引入已公开的驱动漏洞，因此本目录从上游 **3.11.2** 构建兼容程序集，BSON 也统一使用 3.11.2。

`upstream-3.11.2.source.zip` 保存该标签的全部 Driver C# 源码和四个被引用的 Shared 文件，均保持上游原文。完整来源和摘要见 `provenance.json`；构建先校验摘要，再解压至 `obj`。许可证和上游公开签名文件一并保留。此项目不发布 NuGet。

唯一替换文件是 `WireVersion.Compatibility.cs`：最低协议从 9 改为 6。握手、SCRAM、TLS、BSON、特性协商、安全修复、重试与高版本能力检查均保留。没有修改服务端自报版本，也没有关闭单项功能版本检查。低于 wire version 6 仍拒绝连接。

这是 Microi 对平台实际使用路径的兼容维护，不表示 MongoDB 官方继续支持 3.6，也不修复旧 MongoDB 服务端自身的缺陷。兼容矩阵必须验证真实 3.6 和 7.x 服务端的认证、CRUD、索引、日志幂等写入、游标、租户隔离及异常返回。新增 MongoDB 操作必须补入该矩阵；升级上游时重建归档、核对安全公告并重新验收，禁止仅改版本号或摘要。

还原上游源码：对归档执行标准 ZIP 解压即可。审查补丁时，将归档中的 `MongoDB.Driver/Core/Misc/WireVersion.cs` 与替换文件比较；除中文说明和 `minWireVersion` 参数外不得有差异。

## 源码拉取与 NU1105 排查

`MongoDB.Driver.Compatibility.csproj`、`upstream-3.11.2.source.zip` 和 `Microi.Panel/Microi.Panel.csproj` 都属于根公开仓的普通文件。若还原提示找不到这两个项目文件，先在根仓检查 `git rev-parse HEAD`、`git ls-files Microi.Server/ThirdParty/MongoDB.Driver/MongoDB.Driver.Compatibility.csproj Microi.Server/Microi.Panel/Microi.Panel.csproj` 与磁盘上的实际文件。`git ls-files` 有记录但磁盘缺失时，检查本地 sparse checkout、下载/解压结果或防护软件；仓库记录也缺失时，拉取 Gitee `master` 最新提交或重新完整克隆。公开源码使用 `Microi.Server/Microi.net.sln`，它从 NuGet 获取独立闭源组件；不要把创建人内部的 `Microi.Anderson.sln` 当作公开构建入口。

统一回归入口中的 `ReleaseGate/public-project-closure.test.mjs` 会扫描根仓跟踪的公开项目引用，并在驱动或面板项目缺失时失败。此检查只验证源码包完整性，不代替 MongoDB 3.6/7.x 的真实数据库兼容验收。
