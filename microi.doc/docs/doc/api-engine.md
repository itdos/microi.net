# 接口引擎
## 接口引擎简介
>* 接口引擎做为平台的亮点之一，能解决非常复杂的业务逻辑，统一管理定制接口
>* 接口引擎由表单引擎驱动

## 支持所有后端V8函数
>见文章：[Microi吾码-V8函数列表-后端](https://microi.blog.csdn.net/article/details/143623433)
## 支持Get、Post请求
>无论您是通过get还是post，均能成功请求接口引擎
## 支持form-data、payload-json请求
>无论您的请求是form-data还是payload-json，均支持
## V8.Param能接收form-data、payload/json、url三种参数类型
```javascript
//支持接收3种类型的参数，均使用V8.Param.***访问
var id = V8.Param.Id;
```


# 接口配置
## 名称、Key、自定义接口地址、启用
>4个基础配置，名称随意，key随意，自定义接口地址建议统一使用/apiengine/开头，当然您要自定义为【/api111/b2222/c333/d444】也可以，【启用】一定要勾选

## 分布式锁
>* 某些场景的接口，必须使用分布式锁，如：订单发货审批通过后扣除库存，防止库存变为负数。（当然也可以使用消息队列，这种方式其它文章讲解）
>* 开启分布式锁可以设定分布式锁Key，这个大有用处。比如说当我们要给商品A进行库存增减时，分布式锁Key就可以设置为商品A的Id，此时不同的商品走不同的分布式锁Key、排不同的队，大大提高并发吞吐量。
>* 若不设置分布式锁Key，那么1000个人同时调用此接口，都得排队
## 允许匿名调用
>* 接口引擎默认必须传入token才能被调用，否则会报错1001未登录
>* 当开启允许匿名调用时，则无需传入token，但注意在V8引擎中访问**V8.CurrentUser**为null
## 响应文件
>测试访问接口引擎地址会直接下载图片：[https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos](https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos)
```javascript
var downResult = V8.Http.GetResponse({
  Url : 'https://static.itdos.com/itdos/img/20230623/WechatIMG21753.png'
});
var imgByte = downResult.RawBytes;
V8.Result = {
  Code : 1,
  Data : {
    FileName : '测试响应文件.png',
    ContentType : 'image/png',
    FileByteBase64 : System.Convert.ToBase64String(imgByte)
  }
};
```
## 接口测试
>接口引擎表单提供了接口运行测试的功能（由表单引擎驱动）

# 接口引擎实战-系列文档
>* **接口引擎实战-发送第三方短信**：[https://microi.blog.csdn.net/article/details/143990546](https://microi.blog.csdn.net/article/details/143990546)
>* **接口引擎实战-发送阿里云短信**：[https://microi.blog.csdn.net/article/details/143990603](https://microi.blog.csdn.net/article/details/143990603)
>* **接口引擎实战-微信小程序授权手机号登录**：[https://microi.blog.csdn.net/article/details/144106817](https://microi.blog.csdn.net/article/details/144106817)
>* **接口引擎实战-微信v3支付JSAPI下单**：[https://microi.blog.csdn.net/article/details/144156119](https://microi.blog.csdn.net/article/details/144156119)
>* **接口引擎实战-微信支付回调接口**：[https://microi.blog.csdn.net/article/details/144168810](https://microi.blog.csdn.net/article/details/144168810)
>* **接口引擎实战-MongoDB相关操作**：[https://microi.blog.csdn.net/article/details/144434527](https://microi.blog.csdn.net/article/details/144434527)
