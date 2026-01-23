# メッセージキュー
## 紹介
> * プラットフォームは現在RabbitMQメッセージキューをサポートしています

## RabbitMQ Docker編成
> * ポート1673はweb管理パネル
```shell
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:management-alpine
    container_name: rabbitmq
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1672:5672"
      - "1673:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=root
      - RABBITMQ_DEFAULT_PASS=password123456
    volumes:
      - /etc/localtime:/etc/localtime
      - /volume1/docker/rabbitmq/lib:/var/lib/rabbitmq
      - /volume1/docker/rabbitmq/log:/var/log/rabbitmq
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
```

## SaaSエンジンMQ構成
> * MQHost:192.168.31.199
> * MQPort:1672
> * MQUserName:root
> * MQPassword:password123456
> * MQVitrualHost:/

## メッセージキューを作成します
> * [Diy _ queue _ receive] テーブルに次のようなデータが追加されました
> * Type: インターフェースエンジン
> * QueueName:test _ queue
> * ApiEngineKey:message test

## 生産メッセージ
```js
//前端调用生产消息接口
V8.Post('/api/mq/sendmsg', {
  //必传：消息队列名称
  QueueName : 'test_queue',
  //必传：消息内容。如：抢购的商品Id + 数量
  Message : JSON.stringify({ ProductId : '123'， Count : 2}),
}, function(result){
  if(result.Code == 1){
    V8.Tips('生产消息成功！');
  }else{
    V8.Tips('生产消息失败：' + result.Msg, false);
  }
}, null, {}, 'json');

//后端接口引擎或后端V8事件调用生产消息接口
V8.MQ.SendMsg('test_queue', { 
  ProductId : '123'， 
  Count : 2
  }
);
```

## 消費情報
> * メッセージキューの作成時に指定されたapiengine key: message test
```js
//接口引擎自动消费消息
//包含：Id（消息Id）、Message（消息内容）、CurrentUserId（生产消息的用户Id）
var message = V8.Param.Message;//object类型
var messageStr = JSON.stringify(message);
//实现您的业务逻辑，如扣除库存...
V8.Method.AddSysLog({
	Type : '消息队列消费者', //日志类型，自定义文字，如：接口日志、性能日志、登录日志等
	Title : '消息队列消费者', //日志标题，如：张三登录了系统
	Content: '消费消息：' + messageStr, //日志内容，如：张三在2024-12-12 20:13通过扫码登录了系统 
	OtherInfo : '', //其它信息，如：{ Append : 'test' }
	Remark : '', //日志备注
	Level : 1,//日志等级
});
return { Code : 1, Msg : '成功消费消息：' + messageStr };
```