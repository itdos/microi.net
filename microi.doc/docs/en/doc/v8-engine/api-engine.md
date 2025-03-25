# Interface Engine
## Introduction
>* As one of the highlights of the platform, the interface engine can solve very complex business logic and uniformly manage custom interfaces.
>* The interface engine is driven by the form engine
! [Insert image description here](https://static.itdos.com/upload/img/csdn/QQ20250311-213524@2x.png)


## Supports all backend V8 functions
> see article:[Microi code-V8 function list-backend](https://microi.blog.csdn.net/article/details/143623433)

## Support Get and Post requests
> whether you are through get or post, you can successfully request the interface engine

## Support form-data and payload-json requests
> Whether your request is form-data or payload-json, it is supported.

## V8.Param can receive form-data, payload/json, url three parameter types
```javascript
//支持接收3种类型的参数，均使用V8.Param.***访问
var id = V8.Param.Id;
```

## Return data
> Return data to the front end, which can be JSON, string, Html, file, etc.
```javascript
//新版返回方式
return { Code : 1, Data : [] }
return '直接返回字符串';
//旧版返回方式
//V8.Result = { Code : 1, Data : [] }
```

# Interface Configuration
## Name, Key, Custom Interface Address, Enable
> 4 basic configurations, with any name and key. it is recommended to use/apiengine/beginning uniformly for the custom interface address. of course, you can customize it to [/api111/b2222/c333/d444], and [enable] must be checked

## distributed lock
>* For interfaces in some scenarios, distributed locks must be used. For example, inventory is deducted after the order shipment is approved to prevent the inventory from becoming negative. (Of course, you can also use message queues, which are explained in other articles)
>* Opening a distributed lock can set a distributed lock Key, which is very useful. For example, when we want to increase or decrease the inventory of commodity a, the distributed lock Key can be set to the Id of commodity a. at this time, different commodities go to different distributed lock keys and line up in different teams, thus greatly improving the concurrent throughput.
>* If the distributed lock Key is not set, 1000 people have to queue up when calling this interface at the same time.

## Allow anonymous calls
>* By default, the interface engine must pass in the token to be called, otherwise an error will be reported 1001 the interface engine is not logged in.
>* When anonymous calls are enabled, the token does not need to be passed in, but note that access to **V8.CurrentUser** in the V8 engine is null.

## Response File
> the test access interface engine address will download the picture directly:[https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos](https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos)
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
## Interface Test
> Interface Engine form provides the ability for the interface to run tests (driven by the form engine)



