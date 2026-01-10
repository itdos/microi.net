using System;
using OpenAI;
using OpenAI.Chat;
using System.ClientModel;
using System.ClientModel.Primitives;
using System.Collections.Generic;
using Dos.Common;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiAI : IMicroiAI
    {
        public IFormEngine _formEngine;
        public MicroiAI(IFormEngine formEngine)
        {
            _formEngine = formEngine;
        }
        public static ChatClient aiClient = null;
        public async Task<DosResult> Chat(AiParam param)
        {
            if (param.UserChatMsg.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "请输入您的消息！");
            }
            // if(param.Endpoint.DosIsNullOrWhiteSpace()){
            //     return new DosResult(0, null, "Endpoint不能为空！");
            // }
            if (param.AiModel.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "AiModel不能为空！");
            }
            // if(param.ApiKey.DosIsNullOrWhiteSpace()){
            //     return new DosResult(0, null, "请传入对应模型的ApiKey！");
            // }
            var aiInfoResult = await _formEngine.GetFormDataAsync("mic_ai", new
            {
                _Where = new List<DiyWhere>() {
                    new DiyWhere(){
                        Name = "AiModel",
                        Value = param.AiModel,
                        Type = "="
                    },
                    new DiyWhere(){
                        Name = "IsEnable",
                        Value = "1",
                        Type = "="
                    }
                },
            });
            if (aiInfoResult.Code != 1)
            {
                return new DosResult(0, null, aiInfoResult.Msg);
            }
            var aiInfo = aiInfoResult.Data;

            var apiKey = aiInfo.ApiKey;// "sk-cc10682a92b24a64a2c314fc7dc97b3a";
            ApiKeyCredential cred = new ApiKeyCredential(apiKey);
            if (aiClient == null)
            {
                //支持所有模型（如deepseek、通义、ChatGPT）deepseek-r1:1.5b 需要修改为动态传入模型+版本号  "deepseek-r1:1.5b"
                aiClient = new ChatClient(param.AiModel, cred, new OpenAIClientOptions
                {
                    Endpoint = new Uri(aiInfo.Endpoint),// new Uri("http://127.0.0.1:11434/v1"),
                    UserAgentApplicationId = "webmote",//自定义id
                    ProjectId = "deepseek-test",//自定义对话标题
                    RetryPolicy = ClientRetryPolicy.Default
                });
            }

            //自定义AI角色
            var systemChatMessage = ((string)aiInfo.SystemChatMsg).DosIsNullOrWhiteSpace("你是一个乐于助人的助手。");
            List<ChatMessage> messages = new List<ChatMessage>()
            {
                new SystemChatMessage(systemChatMessage),
                new UserChatMessage(param.UserChatMsg)
            };
            var result = aiClient.CompleteChat(messages);
            if (result?.Value != null)
            {
                return new DosResult(1, result.Value.Content[0].Text);
            }
            else
            {
                return new DosResult(0, null, "AI请求失败！");
            }

        }
    }
}