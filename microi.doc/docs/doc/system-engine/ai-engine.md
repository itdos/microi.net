# 🤖 AI 引擎

> 本文档已与「AI 编程全指南」合并，请访问 [→ AI 编程全指南](https://microi.net/doc/v8-engine/ai-apiengine)，获取完整内容，包括：
> - 🌐 在线 AI 编程（上传 db.json / 文档给 AI）
> - 💻 本地 AI 编程（VS Code 插件 + Copilot / Claude Code / Cursor）
> - 🔗 在 V8 代码中调用 AI 大模型（本页内容）

---

## 💡 在 V8 代码中调用 AI 大模型

可以在接口引擎或 V8 表单事件中直接请求 Microi 内置 AI 接口，实现代码检查、自然语言转 SQL、智能问答等能力。

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

更多用法与最佳实践，请参阅 [AI 编程全指南 → 模式三：在 V8 代码中调用 AI 大模型](https://microi.net/doc/v8-engine/ai-apiengine#模式三-在-v8-代码中调用-ai-大模型)。
