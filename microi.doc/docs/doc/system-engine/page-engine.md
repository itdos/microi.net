# 🎨 界面引擎

> **自定义界面设计、ECharts 图表等可视化能力**

---

## 📸 预览图

![界面引擎预览1](https://static.itdos.com/upload/img/csdn/8d07494649c34c7981495bdb28551451.png#pic_center)
![界面引擎预览2](https://static.itdos.com/upload/img/csdn/3aae333deaec41a588ed985df5644375.png#pic_center)

## 界面引擎
>* 实际项目开发中，往往【**表单引擎表格**】并不能满足客户领导的需求，因此诞生了Microi吾码界面引擎
>* 所有控件均支持数据源配置，可通过[**接口引擎**](https://microi.blog.csdn.net/article/details/143968454)来提供数据源

## 试用地址
>Microi吾码界面引擎：[https://microi.net/page-engine](https://microi.net/page-engine)
## npm组件集成方式
>npm i microi-pageengine@latest
>必须是Vue3 + Vite 项目, 任意页面即可集成 ,以下代码是集成demo
::: details 展开查看 JavaScript 代码（99 行）
```javascript
<template>
  <!-- 页面设计器 -->
  <formDesigner :remoteObj="remoteObj" />
  <!-- 页面渲染器 -->
  <!-- <formRenderer :remoteObj="remoteObj" /> -->
</template>
<script setup>
  
//引入组件
import { formDesigner, EventBus, usePageEngineStore } from 'microi-pageengine' 
//引入样式
import 'microi-pageengine/style.css' 

//本地组件
import { useRouter } from 'vue-router'
import { createPinia } from 'pinia'
import { onMounted, onBeforeUnmount, ref } from 'vue'

//用自己的路由处理组件内部跳转,通过EventBus监听处理内部事件,主打一个自由自在,随心所欲.
const router = useRouter()

//状态机传参,npm包没包把pinia打包进去,正所谓巧妇难为无米之炊,给她传一个完事
const pinia = createPinia()
const pageEngineStore = usePageEngineStore(pinia)

//传入数据,这个数据不知道什么格式,可以在设计器拖拽几个组件查看下页面JSON ,和渲染JSON一毛一样的
const remoteObj = ref({})

//模拟加载远程数据
const loadFormData = () => {}

onMounted(() => {
  
  //如果需要token,设置token,该token一经接收即刻存入pinia状态机,每次调用接口通过拦截器自动处理token头,无需每次手动写,持久化用的localStorage ,可以F12查看
  pageEngineStore.setToken('')
  
  //下面这一大串监听,其实也可以写到一个事件里,通过key value 键值对来区分,暂时先这么着吧
  
  //监听保存页面JSON事件
  EventBus.on('saveFormJson', (saveFormJson) => {
    console.log('saveFormJson', saveFormJson)
  })

  //监听日历选择日期事件
  EventBus.on('calendarSelDate', (data) => {
    console.log('calendarSelDate', data)
  })

  //卡片更多跳转
  EventBus.on('cartMoreLink', (linkurl, linktype) => {
    console.log('cartMoreLink', linkurl, linktype)
    if (linktype == 'router') {
      router.push(linkurl)
    }
  })

  //链接组件跳转
  EventBus.on('linkWidget', (linkurl, linktype) => {
    console.log('linkWidget', linkurl, linktype)
    if (linktype == 'router') {
      router.push(linkurl)
    }
  })

  //鱼骨图跳转
  EventBus.on('fishWidget', (linkurl) => {
    console.log('监听fishWidget', linkurl)
    router.push(linkurl)
  })

  //步骤跳转
  EventBus.on('stepsWidget', (id, linkurl) => {
    console.log('监听stepsWidget', id, linkurl)
    router.push(linkurl)
  })

})

//销毁
onBeforeUnmount(() => {
  EventBus.off('saveFormJson')
  EventBus.off('calendarSelDate')
  EventBus.off('cartMoreLink')
  EventBus.off('linkWidget')
  EventBus.off('fishWidget')
  EventBus.off('stepsWidget')
})
</script>

<style>
.dark {
  background: #252525;
  color: white;
}
.light {
  background-color: white;
  color: black;
}
</style>
```
:::

## iframe模式集成方式
>这种模式说白了就是百搭,把低代码设计器当成一个在线工具,它是无状态的,不依赖任何前端和后端,高内聚低耦合,可集成任意平台.假以时日自定义扩展组件有上百个时,完全可以独当一面成为一方霸主,独立产品. 平台集成使用Iframe,把页面设计器嵌入到自己页面中,通过postMessage方式与父页面进行通信,父页面可以获取到设计器生成的页面JSON,也可以把token传给设计器

>数据通信使用 postMessage 方式
>父页面(对接平台)通过 postMessage 向子页面发送数据,这里主要传token ,子页面(页面设计引擎组件) 使用 window.addEventListener 监听并接收数据

```javascript
//设计引擎调用
<template>
<iframe ref="myIframe" id="iframe" src="https://www.nbweixin.cn/autopage/"  frameborder="0" style="width: 100%; height: 100%"></iframe>
</template>
methods: {
 sendMessageToIframe() {
      const iframe = this.$refs.myIframe;
      // 要发送的数据
      const dataToSend = {
        pageEngineToken: "token 值"
      };
      // 使用 postMessage 发送数据给 iframe
      iframe.contentWindow.postMessage(dataToSend, "*");
  }
 }
```
## 页面版本、比较与回滚

界面引擎保存不再只是覆盖 `mic_page.JsonObj`。每次内容真实变化时，服务端会生成规范化 JSON 的 SHA-256，并在同一数据库事务中写入历史快照；内容未变化时不会制造空历史。

设计器标题栏提供历史、版本差异、导入、导出和回滚。保存与回滚都携带当前 `CurrentHash`：若页面已被另一位管理员或 AI 修改，服务端返回冲突并要求重新加载，禁止最后写入者静默覆盖。

| MCP 工具 | 作用 |
|---|---|
| `microi_list_page_history` | 分页列出历史元数据和当前哈希 |
| `microi_get_page_history` | 读取一个不可变页面快照 |
| `microi_compare_page_versions` | 比较两个快照，或比较历史与当前页面 |
| `microi_export_page_design` | 导出 `microi.page.v1` 设计包、页面元数据和哈希 |
| `microi_rollback_page_design` | 带预期哈希回滚，并创建新的审计版本 |

回滚不会删除历史。目标快照会成为新的当前内容，回滚前状态仍留在版本链中，便于再次审计或恢复。AI 修改页面时应遵循“读取详情及当前哈希 → 保存 → 回读新哈希与历史”的顺序。

## 撤销重做、Vue 源码桥与物料资产

设计器本地历史与服务端版本承担不同职责：

- 本地 Undo/Redo 保存最近 50 步且总计不超过 20MB，用于当前编辑会话快速撤销；连续小修改会合并，避免每次键入制造一个快照。
- `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z` 和 `Ctrl/Cmd+Y` 只在画布上下文生效；输入框、代码编辑器或浏览器原生编辑区域保持自己的撤销栈。
- 服务端不可变历史跨会话、跨设备和跨节点保留，最终保存仍使用 `ExpectedHash`；本地撤销不能绕过并发保护。

界面引擎提供确定性的 Page JSON ↔ Vue SFC 桥接，用于源码预览和有限往返：

1. Page JSON 先规范化，再生成带 `microi.page.sfc.v1` 标记的 Vue 单文件组件；
2. template、script 和 style 都来自平台白名单模板，不执行页面 JSON 中的任意代码；
3. 反向导入只接受平台生成且 Hash/标记完整的 SFC，拒绝任意 Vue 工程或未知脚本；
4. 导入后再次规范化并比较页面 Hash，确认后才写入设计器状态。

可复用区块和组件应发布为治理中心的 `microi.asset.v1` 资产包，声明 Props、Setters、DataAdapters、目标平台和依赖版本。发布前执行 DryRun、依赖循环/版本范围检查，运行端按确定性加载顺序解析。复杂页面仍可提升为独立前端微服务；源码桥不承诺把任意手写 Vue 无损反编译为低代码 JSON。

## 界面引擎由吾码团队成员lisaisai开发
> 更多完整说明见博文：[https://lisaisai.blog.csdn.net/article/details/143928130](https://lisaisai.blog.csdn.net/article/details/143928130)

