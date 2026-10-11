# NPOI 可核验源码构建

NPOI 2.7.6 的 ImageSharp 2.1.11 传递依赖存在公开漏洞。ImageSharp 的修复版只支持 .NET 8，不能直接替换平台 netstandard2.1 库的依赖。此处使用上游 NPOI 2.8.1 的完整生产源码，其图像处理已迁移至 SkiaSharp；归档中的源码文件保持上游原文。

源码来自 `nissl-lab/npoi` 的 `2.8.1-rc2` 正式发布标签。`provenance.json` 保存原始下载归档、精简生产源码归档及每个源文件的 SHA-256。构建必须先校验归档摘要，随后解压至各项目 `obj`，由正常一键发布编译；构建时不下载可变源码，不引用上游预编译 NPOI NuGet 包。

四个定制程序集分别使用 `Microi.NPOI.Core`、`Microi.NPOI.OOXML`、`Microi.NPOI.OpenXml4Net`、`Microi.NPOI.OpenXmlFormats`；公开命名空间保持上游原样，统一目标框架为 netstandard2.1。上游 SkiaSharp 依赖统一为平台既有 4.150.1。两个 XSSF 文件仅将已移除的 SKPaint 文本测量改为其现有 SKFont.MeasureText 调用；替换文件统一换行与尾随空白；原文在归档中保留，替换文件与摘要见 Compatibility 和来源回执。`Microi.NPOI` 是平台源码构建的聚合包，依赖四个 Microi.NPOI.* 源码构建包，各包包含相应 Microi 定制程序集、实际依赖、许可证和来源回执；它并非上游官方二进制包，也不使用官方 NPOI 包标识。

上游源码使用 Apache-2.0 许可证。保留 `LICENSE`、源码版权声明和上游公开 strong-name 签名文件。另保留上游 `OSMFEULA.txt` 以便核对分发边界：第 2、4 节明确允许独立编译与分发源码生成的二进制，无需使用其官方预编译包。没有设置 `AcceptNPOIOSMFLicense` 或移除官方包的许可检查。

验收包括旧版 xls、新版 xlsx 的中文、数字、公式、样式、图片缩放及读写回环，以及 docx 中文与嵌入图片回环。完整发布继续执行 NuGet 漏洞审计；任何漏洞或源码摘要变化均阻止发布。

升级必须同时重编译引用方并交付完整平台；程序集名称变更不保证旧的预编译扩展二进制兼容。不能在同一项目同时引用本定制包和官方 NPOI 包，两者公开类型命名空间相同。普通新项目优先评估当前官方稳定版及其二进制许可；平台保留此受核验源码构建作为 SkiaSharp 与既有 API 的兼容组件。
