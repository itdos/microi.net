using System;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string ChanjetCallbackV2ApiEngineKey = "platform-chanjet-callback-v2";

        /// <summary>
        /// 仅供畅捷通 V2 官方 Managed 接口引擎调用的最小解密校验原子。
        /// 租户、接口 Key 与私密配置均取可信执行上下文，调用方不能覆盖。
        /// </summary>
        public DosResult DecodeChanjetCallbackV2(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(ChanjetCallbackV2ApiEngineKey);
            if (denied != null) return denied;

            try
            {
                var request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                if (request.Properties().Any(property =>
                        !string.Equals(
                            property.Name,
                            "EncryptedMessage",
                            StringComparison.Ordinal)))
                {
                    return Invalid();
                }

                var encryptedToken = request["EncryptedMessage"];
                if (encryptedToken == null || encryptedToken.Type != JTokenType.String)
                    return Invalid();
                var encryptedMessage = encryptedToken.Value<string>();

                var osClient = V8TenantContext.Current?.OsClient;
                if (!ChanjetV2ProtocolGatewaySettings.TryLoad(osClient, out var settings))
                    return Failure("Disabled", "畅捷通回调未启用。");

                return ChanjetV2CallbackProtocol.TryDecode(
                        encryptedMessage,
                        settings,
                        out var safeMessage)
                    ? new DosResult(1, safeMessage)
                    : Invalid();
            }
            catch
            {
                // 不记录第三方密文、租户密钥或解密异常细节。
                return Invalid();
            }
        }

        private static DosResult Invalid()
        {
            return Failure("Invalid", "畅捷通回调消息无效。");
        }

        private static DosResult Failure(string kind, string message)
        {
            return new DosResult(0, null, message)
            {
                DataAppend = new JObject { ["FailureKind"] = kind }
            };
        }
    }
}
