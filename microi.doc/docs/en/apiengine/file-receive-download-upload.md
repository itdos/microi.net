# Receiving, downloading, and uploading files in the interface engine
```js
//接收到的文件列表
var filesByteBase64 = V8.FilesByteBase64;
var upResult1 = {};
if(filesByteBase64){
  //不建议使用调用接口的方式，性能较差，虽然也是可以的
  /*
  var upResult1 = V8.Http.Post({
    Url : V8.SysConfig.ApiBase + '/api/HDFS/Upload',
    FilesByteBase64 : filesByteBase64,
    PostParam : {
      Limit : false, //是否上传到私有桶
      Preview : false, //如果是图片，是否压缩
      Path : '/img'//上传到的路径前缀
    },
    Headers : {
      authorization : 'Bearer ' + V8.Method.GetCurrentToken().Token
    }
  });
  */
  //建议直接调用已封装好的上传函数
  upResult1 = V8.Method.Upload({
    FilesByteBase64 : filesByteBase64,
    Limit : false, //是否上传到私有桶
    Preview : false, //如果是图片，是否压缩
    Path : '/test-upload', //上传到的路径前缀
    //Multiple : true,//editor上传多张图片这个接口会调用多次，每次都是单图
    OsClient : V8.OsClient
  });
}

var downResult = V8.Http.GetResponse({
  Url : 'https://static.itdos.com/itdos/img/20230623/WechatIMG21753.png'
});
var imgByte = downResult.RawBytes;
//不建议使用调用接口的方式，性能较差，虽然也是可以的
/*
var upResult2 = V8.Http.Post({
  Url : V8.SysConfig.ApiBase + '/api/HDFS/Upload',
  FilesByteBase64 : { 'fileName1.png' : System.Convert.ToBase64String(imgByte) },
  PostParam : {
    Limit : false, //是否上传到私有桶
    Preview : false, //如果是图片，是否压缩
    Path : '/img'//上传到的路径前缀
  },
  Headers : {
    authorization : 'Bearer ' + V8.Method.GetCurrentToken().Token
  }
});
*/
//建议直接调用已封装好的上传函数
var upResult2 = V8.Method.Upload({
  FilesByteBase64 : { 'fileName1.png' : System.Convert.ToBase64String(imgByte) },
  Limit : false, //是否上传到私有桶
  Preview : false, //如果是图片，是否压缩
  Path : '/test-upload', //上传到的路径前缀
  //Multiple : true,//editor上传多张图片这个接口会调用多次，每次都是单图
  OsClient : V8.OsClient
});
upResult2.DataAppend = {
  upResult1 : upResult1
};
return upResult2;
```