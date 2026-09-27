---
title: 吾码 AI CAD 与 SolidWorks 插件
description: 通过吾码 AI 应用和接口引擎生成受限设计计划，在 SolidWorks 桌面插件中创建原生零件、装配和工程图，并回读 BOM 与加工工艺草案。
---

# 吾码 AI CAD 与 SolidWorks 插件

吾码 AI CAD 将自然语言需求转为可审阅的参数计划，再由 **SolidWorks 软件内的桌面插件**执行建模。设计人员可以从同一个示例查看零件、装配、BOM、工艺草案和二维工程图的交付流程。

当前发布的是 **v1.0.0 技术预览**：[打开 AI 应用](/app-detail.html?app=microi-ai-cad)、[查看产品展示页](/ai-cad.html)、[下载 SolidWorks 插件包](https://static.itdos.com/itdos/mcp/assets/ai-cad/plugin/202609/MicroiAiCad_Addin-v1_0_0.zip)。插件已完成本地构建；本机尚未安装获许可的 SolidWorks，因此软件内自动建模、装配、出图及文件回读仍待真实运行验收。

## 工作流程

| 步骤 | 执行位置 | 产物与检查点 |
| --- | --- | --- |
| 1. 描述设计 | 吾码 AI 应用 | 输入尺寸、材料、孔位及装配需求；保留原始指令。 |
| 2. 生成并校验计划 | 吾码 AI + 接口引擎 | 形成受限的零件与装配参数，检查尺寸范围、类型和实例数量。 |
| 3. 创建原生模型 | SolidWorks 桌面插件 | 在 SolidWorks 中创建并保存 `SLDPRT` 零件和 `SLDASM` 装配。 |
| 4. 回读与交付 | 桌面插件 + 吾码工作台 | 由已保存的模型和组件树生成 BOM、加工工艺草案及关联 `SLDDRW` 二维图。 |

首版计划支持法兰、矩形板、轴与圆柱形螺栓，尺寸统一使用毫米。示例 **FLC-120 法兰联轴器**包含法兰、定位轴和连接螺栓。装配坐标、配合、公差、刀具、夹具及工艺参数须由工程师确认。

## 五张 4K 示例截图

以下为已渲染的 **3840 × 2160 工作台示例界面**，展示设计计划和参数化示意。它们不是 SolidWorks 软件内截图，也不表示生产图纸已经通过软件验收。点击图片可查看原图。

<div class="mci-doc-screenshot-grid">
  <figure><a href="/images/ai-cad/01-modeling.png" target="_blank" rel="noopener noreferrer"><img src="/images/ai-cad/01-modeling.png" width="3840" height="2160" loading="lazy" alt="吾码 AI CAD 4K 建模工作台：自然语言需求、参数计划和三维示意模型"></a><figcaption>自然语言建模与参数计划。</figcaption></figure>
  <figure><a href="/images/ai-cad/02-assembly.png" target="_blank" rel="noopener noreferrer"><img src="/images/ai-cad/02-assembly.png" width="3840" height="2160" loading="lazy" alt="吾码 AI CAD 4K 装配工作台：联轴器零件实例及装配结构示意"></a><figcaption>零件实例与装配结构。</figcaption></figure>
  <figure><a href="/images/ai-cad/03-bom.png" target="_blank" rel="noopener noreferrer"><img src="/images/ai-cad/03-bom.png" width="3840" height="2160" loading="lazy" alt="吾码 AI CAD 4K BOM 工作台：零件名称、材料、规格及数量预览"></a><figcaption>设计阶段 BOM 清单。</figcaption></figure>
  <figure><a href="/images/ai-cad/04-process.png" target="_blank" rel="noopener noreferrer"><img src="/images/ai-cad/04-process.png" width="3840" height="2160" loading="lazy" alt="吾码 AI CAD 4K 工艺工作台：可审阅的加工工序草案"></a><figcaption>加工工艺草案。</figcaption></figure>
  <figure><a href="/images/ai-cad/05-drawing.png" target="_blank" rel="noopener noreferrer"><img src="/images/ai-cad/05-drawing.png" width="3840" height="2160" loading="lazy" alt="吾码 AI CAD 4K 图纸工作台：二维视图示意及关联工程图输出流程"></a><figcaption>二维工程图输出流程。</figcaption></figure>
</div>

## 验收边界

- **已具备**：吾码 AI 应用、接口引擎计划校验、示例数据、五张 4K 展示截图及已构建的 SolidWorks 插件包。
- **待实测**：在安装并授权 SolidWorks 的 Windows 环境中加载插件，执行真实零件与装配建模，打开生成的工程图，并与模型逐项核对 BOM 和工艺文件。
- **工程审查**：自动生成的几何、材料、装配关系、加工步骤及工程图仍需设计人员审阅后使用。

