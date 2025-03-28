# The AI engine

## 用法
```javascript
var option = {
  url : V8.SysConfig.ApiBase + '/api/ai/chat',
  data : {
    UserChatMsg : `帮我快速检查一下我的javascript代码是否有问题：${V8.Form.ApiV8Code}`,
    AiModel : 'deepseek-r1:1.5b',
  },
  dataType : 'json',
  success : function(result){
    if(result.Code == 1){
      V8.FormSet('AiCheckResult', result.Data)
    }else{
      V8.FormSet('AiCheckResult', result.Msg)
    }
  }
};
V8.Post(option);
```