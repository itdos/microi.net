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

## Conversation history and usage audit

The conversation sidebar supports archiving, restoring, and editing a title. A title change updates every `mic_ai_record.Content.Title` entry with the same `ConversationId`.

Runtime errors such as license or network failures are displayed for that request only and are excluded from future model context. Existing conversations that contain an old open-source-license warning therefore recover normally after the license becomes valid.

The profile AI relay page shows paginated usage records with time, model, the first 50 characters of the actual user input, input tokens, output tokens, deduction, remaining balance, and source. It also shows paginated Token recharge records. Usage is written only after a successful upstream response. The relay prefers upstream `usage` values, requests `include_usage` for streaming responses, and does not charge failed upstream calls. Balance deduction and log insertion share one transaction with row locking. The authenticated `official_ai_usage` API engine always filters by the current user.

The official Users module provides a per-user **Recharge Token** action. The frontend only collects the amount and remark; `official_ai_token_admin` updates the account and writes `mci_ai_token_recharge` in the backend transaction, with `RequestId` preventing duplicate credits. User details expose both usage and recharge records as read-only child tables.
