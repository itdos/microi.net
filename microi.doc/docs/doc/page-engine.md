# 预览图
![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/8d07494649c34c7981495bdb28551451.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/3aae333deaec41a588ed985df5644375.png#pic_center)

# 界面引擎
>* 实际项目开发中，往往【**表单引擎表格**】并不能满足客户领导的需求，因此诞生了Microi吾码界面引擎
>* 所有控件均支持数据源配置，可通过[**接口引擎**](https://microi.blog.csdn.net/article/details/143968454)来提供数据源

# 试用地址
>Microi吾码界面引擎：[https://microi.net/page-engine](https://microi.net/page-engine)
# npm组件集成方式
>npm i microi-pageengine@latest
>必须是Vue3 + Vite 项目, 任意页面即可集成 ,以下代码是集成demo
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

# iframe模式集成方式
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
# 界面引擎由吾码团队成员lisaisai开发
> 更多完整说明见博文：[https://lisaisai.blog.csdn.net/article/details/143928130](https://lisaisai.blog.csdn.net/article/details/143928130)

