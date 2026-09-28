<template>
  <main class="ai-cad-landing">
    <section class="ai-cad-hero">
      <div class="ai-cad-hero-copy">
        <span class="ai-cad-eyebrow">MICROI AI × SOLIDWORKS</span>
        <span class="ai-cad-release">技术预览 · v1.0.0</span>
        <h1>把设计语言，变成<br><em>可编辑的原生模型</em></h1>
        <p>吾码 AI 将自然语言整理为受限参数计划；SolidWorks 桌面插件在软件内部创建零件、装配和关联工程图，再从已保存的模型读取 BOM 与工艺草案依据。</p>
        <div class="ai-cad-actions">
          <a class="primary" href="/app-detail.html?app=microi-ai-cad">查看 AI 应用 <span aria-hidden="true">↗</span></a>
          <a class="secondary" href="#ai-cad-gallery">浏览 4K 截图 <span aria-hidden="true">↓</span></a>
          <a class="secondary" href="https://static.itdos.com/itdos/mcp/assets/ai-cad/plugin/202609/MicroiAiCad_Addin-v1_0_0.zip" target="_blank" rel="noopener noreferrer">下载插件包 <span aria-hidden="true">↘</span></a>
        </div>
        <p class="ai-cad-disclosure">当前展示的是工作台示例界面。SolidWorks 插件已完成本地构建，真实建模与出图仍待安装有许可证的 SolidWorks 后验收。</p>
      </div>
      <figure class="ai-cad-hero-visual">
        <img src="/images/ai-cad/01-modeling.png" width="3840" height="2160" alt="吾码 AI CAD 工作台 4K 截图：自然语言建模指令、零部件结构和参数化三维示意预览" />
        <figcaption>工作台示例 · 3840 × 2160 · 预览模型为参数化示意</figcaption>
      </figure>
    </section>

    <section class="ai-cad-section ai-cad-value" aria-labelledby="ai-cad-value-title">
      <div class="ai-cad-section-head"><span class="ai-cad-eyebrow">FROM INTENT TO MODEL</span><h2 id="ai-cad-value-title">设计链路清楚，模型来源可追溯</h2></div>
      <div class="ai-cad-flow">
        <div><span>01</span><strong>自然语言设计</strong><p>在吾码工作台输入尺寸、材料、孔位和装配需求。</p></div>
        <div><span>02</span><strong>参数计划校验</strong><p>接口引擎约束零件种类、几何范围、材料与实例数量。</p></div>
        <div><span>03</span><strong>SolidWorks 执行</strong><p>桌面插件创建原生 SLDPRT、SLDASM 和关联 SLDDRW 图纸。</p></div>
        <div><span>04</span><strong>模型回读交付</strong><p>从装配组件树统计 BOM；从零件实体边界与模型属性形成工艺草案。</p></div>
      </div>
    </section>

    <section id="ai-cad-gallery" class="ai-cad-section ai-cad-gallery" aria-labelledby="ai-cad-gallery-title">
      <div class="ai-cad-section-head"><span class="ai-cad-eyebrow">PRODUCT GALLERY</span><h2 id="ai-cad-gallery-title">五张 4K 工作台截图</h2><p>以下图片均来自真实渲染的示例工作台，显示设计计划与参数化示意；不是 SolidWorks 软件内截图或已验证的生产图纸。点击图片可查看原始 3840 × 2160 像素。</p></div>
      <div class="ai-cad-gallery-grid">
        <figure v-for="shot in gallery" :key="shot.file">
          <a :href="'/images/ai-cad/' + shot.file" target="_blank" rel="noopener noreferrer" :aria-label="'查看 ' + shot.title + ' 4K 原图'"><img :src="'/images/ai-cad/' + shot.file" :alt="shot.alt" width="3840" height="2160" loading="lazy" /></a>
          <figcaption><span>{{ shot.number }}</span><strong>{{ shot.title }}</strong><small>{{ shot.caption }}</small></figcaption>
        </figure>
      </div>
    </section>

    <section class="ai-cad-section ai-cad-scope" aria-labelledby="ai-cad-scope-title">
      <div><span class="ai-cad-eyebrow">CURRENT SCOPE</span><h2 id="ai-cad-scope-title">从一个可复核的样例开始</h2><p>内置 FLC-120 法兰联轴器示例，包含法兰、定位轴和连接螺栓。首版插件限制为法兰、矩形板、轴与圆柱形螺栓，所有尺寸为毫米。装配坐标、配合、公差、刀具、夹具和工艺参数均需工程师确认。</p></div>
      <div class="ai-cad-scope-stats"><div><strong>3</strong><span>示例零件种类</span></div><div><strong>7</strong><span>示例装配实例</span></div><div><strong>4</strong><span>交付文件类型</span></div></div>
    </section>
  </main>
</template>

<script setup lang="ts">
const gallery = [
  { number: '02', file: '02-assembly.png', title: '装配结构', caption: '零件实例与坐标预览', alt: '吾码 AI CAD 4K 截图：联轴器装配结构、实例坐标和参数化三维示意' },
  { number: '03', file: '03-bom.png', title: 'BOM 清单', caption: '设计阶段数量预览', alt: '吾码 AI CAD 4K 截图：零件名称、材料、规格和设计阶段 BOM 数量' },
  { number: '04', file: '04-process.png', title: '加工工艺', caption: '可审阅工序草案', alt: '吾码 AI CAD 4K 截图：加工工艺流程与示例工序草案' },
  { number: '05', file: '05-drawing.png', title: '二维工程图', caption: '关联出图流程示意', alt: '吾码 AI CAD 4K 截图：法兰二维视图示意和 SolidWorks 工程图输出说明' },
]
</script>
