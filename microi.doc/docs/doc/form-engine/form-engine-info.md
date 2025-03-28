# 表单引擎介绍
## 这篇文档可能会让读者对“表单引擎”有更新奇的看法：“原来表单引擎还能这样玩？”
> 可能大部分同学认为“表单引擎”是低代码的基础功能，这个没啥好吹的
> 但Microi吾码做到了“万物皆表单引擎”，以及一身黑科技

## “万物皆表单引擎”
> 这带来的“后果”是整个低代码平台只有**登录**、**桌面**是定制开发页面，其它所有页面均由表单引擎（或界面引擎）驱动

## “模块引擎”由表单引擎驱动
> 模块引擎即常规理解的“系统菜单配置”，包括了菜单基础配置、数据源配置、更多按钮配置、替换配置
> 优点：可以使用表单引擎去设计模块引擎，自由新增配置项
> 比如说前段时间刘老师需要给“菜单配置”新增一个“App是否显示”的配置项，10秒解决
<img src="https://static.itdos.com/upload/img/csdn/012ef3417a0edefe280ed22972b4bc32.png" />
<img src="https://static.itdos.com/upload/img/csdn/7197b448e310da3e0945937664f0047f.png" />

## “流程引擎”由表单引擎驱动
> 流程引擎的流程属性、节点属性也由表单引擎驱动
> 这带来的好处是开发者可自由新增流程、节点的可配置项
> 比如说我们想给节点属性新增一个自定义配置“”，仅需10秒
<img src="https://static.itdos.com/upload/img/csdn/812c3691ce7b2c7e9965accfc605891e.png">

## “接口引擎”由表单引擎驱动
> 接口引擎是Microi吾码平台的特色之一，在线使用javascript语法编写任何复杂的业务逻辑，适用于大型ERP、互联网等项目
> 开发者可自由给接口引擎添加可配置项，如：接口调用频率限制？
<img src="https://static.itdos.com/upload/img/csdn/0fccb24ace37b9b36f8f9de801fb7d90.png">

## “SaaS引擎”由表单引擎驱动
> SaaS引擎包含了租户的数据库、阿里云、MinIO、Redis、MQ、搜索引擎等独立配置
> 开发者可自由新增配置，如：租户允许登录？
<img src="https://static.itdos.com/upload/img/csdn/a16ab7aabec6834dff731d4db4b457d2.png">

## “表单引擎”也由表单引擎驱动
> 重头戏来了：表单引擎也由表单引擎驱动！即表单引擎列表、表单属性、字段属性也是由表单引擎驱动
> 博主也很难使用文字详细解释，后面出一期视频
<img src="https://static.itdos.com/upload/img/csdn/f4ead7346e69b9d362e50d3aafb9dcfe.png">

## 还有更多如任务调度、MQ等均由表单引擎驱动
> 后期再补充

## 黑科技
## 拓展表单组件
> 表单引擎组件库支持二次开发自由扩展，比如说我想增加一个“显示天气”组件
<img src="https://static.itdos.com/upload/img/csdn/9a37d32ab119cf8d9a8eee9230d916c2.png">
## 定制表单组件
> 表单设计里面可以任意嵌入自己开发的vue组件
> 嵌入的vue组件也能通过一句代码&lt;DiyForm TableId="1" /&gt;来调用表单引擎
<img src="https://static.itdos.com/upload/img/csdn/e67595311cdb3119244fc6ed0edb3a93.png">

## 二次开发引用表单组件
> 如图：定制开发一个比较复杂的页面，均可以通过一句代码来调用表单引擎设计好的表单进行编辑或新增
<img src="https://static.itdos.com/upload/img/csdn/caa80acf3b86e28ff78cd74514982a36.png">

## 强大的V8.FormEngine
* 见CSDN文章：[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)

## 丰富的V8事件
> 平台提供了非常丰富的前端事件、后端事件、键盘事件、值变更事件等等
> 比如说表单提交前在“前端事件”中判断哪些字段必填、哪些字段填写不符合规则
> 比如说表单提交前在“后端事件”中判断更严格的数据校验，防止通过postman调用接口绕开前端验证
> 相关CSDN文章：[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)

## 动态关联表单
> 比如说商品信息中，我的商品可能是饮水机、也可能是电脑
> 而饮水机我需要填写出水模式、出水龙头、制水能力等信息
> 而电脑我需要填写CPU、内存、显卡等信息
> 此时就可以用到动态关联表单，为商品分类设计多张表单引擎，然后动态调用
<img src="https://static.itdos.com/upload/img/csdn/a405352e6078d8868a6e42d7a12aca31.png">

## 更多黑科技后期再补充
> 感谢浏览