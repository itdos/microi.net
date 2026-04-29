# 🤖AI engine

> This document has been merged with the "Full AI Programming Guide", please visit [→ Full AI Programming Guide](https://microi.net/doc/v8-engine/ai-apiengine) for complete content, including:
>-🌐Online AI programming (upload db.json/document to AI)
>-💻Local AI programming (VS Code plug-in Copilot / Claude Code / Cursor)
>-🔗Call AI large model in V8 code (content of this page)

---

## 💡Calling a Large AI Model in V8 Code

You can directly request Microi's built-in AI interface in the interface engine or V8 form event to realize code checking, natural language to SQL, intelligent question answering and other capabilities.

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

For more use and best practices, please refer to [AI Programming Guide → Mode 3: Call AI Large Model in V8 Code](https://microi.net/doc/v8-engine/ai-apiengine# Mode 3-Call-AI-Large Model in-v8-Code).
