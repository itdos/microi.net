# MQTT Engine (IoT Internet of Things)
> * Integrate MQTT server, support 485, zigbee, Bluetooth, Modbus Internet of things device MQTT gateway, interface engine online write business logic code, make IoT Internet of things development efficiency increased 10 times
## Example: Writing business logic in an interface engine
```javascript
var eventName = V8.EventName;
if(eventName == 'StartServer'){//服务器端启动MQTT服务

}else if(eventName == 'Connected'){//客户端连接时

}else if(eventName == 'Disconnected'){//客户端断开连接时

}else if(eventName == 'MessageReceived'){//客户端发送消息时，并且服务器已经收到消息
  var addResult = V8.FormEngine.AddFormData('mci_mqtt_log', {
    Data : V8.MQTT.ClientId + '-' + V8.MQTT.Topic + '-' + JSON.stringify(V8.MQTT.Payload)
  });
  if(addResult.Code != 1){
    V8.FormEngine.AddFormData('mci_mqtt_log', {
      Data : JSON.stringify(addResult)
    });
  }

}else if(eventName == 'StopServer'){//服务器端停止MQTT服务

}else{
  return { Code : 0, Msg : '错误的MQTT事件！' };
}
```