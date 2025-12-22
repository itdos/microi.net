# 消息队列
## 介绍
>* 平台目前支持RabbitMQ消息队列

## RabbitMQ Docker编排
>* 端口1673是web管理面板
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

## SaaS引擎MQ配置
>* MQHost：192.168.31.199
>* MQPort：1672
>* MQUserName：root
>* MQPassword：password123456
>* MQVitrualHost：/

## 创建一个消息队列
>* [diy_queue_receive]表新增一条数据，如：
>* Type：接口引擎
>* QueueName：test_queue
>* ApiEngineKey：messagetest

## 生产一个消息
```js
V8.Post('/api/mq/sendmsg', {
  QueueName : 'messagetest2',
  Msg : 'test-msg',
}, function(result){
  if(result.Code == 1){
    V8.Tips('生产消息成功！');
  }else{
    V8.Tips('生产消息失败：' + result.Msg, false);
  }
}, null, {}, 'json');
```

## 消费一个消息
>* 在接口引擎[messagetest]中
```js
//消费消息
var message = V8.Param.Message;
V8.Method.AddSysLog({
	Type : '消息队列消费者', //日志类型，自定义文字，如：接口日志、性能日志、登录日志等
	Title : '消息队列消费者', //日志标题，如：张三登录了系统
	Content: '消费消息：' + message, //日志内容，如：张三在2024-12-12 20:13通过扫码登录了系统 
	OtherInfo : '', //其它信息，如：{ Append : 'test' }
	Remark : '', //日志备注
	Level : 1,//日志等级
});
return { Code : 1, Msg : '成功消费消息：' + message };
```