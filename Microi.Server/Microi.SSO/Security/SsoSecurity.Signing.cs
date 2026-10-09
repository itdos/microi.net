using System;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Microi.net
{
    public static partial class SsoSecurity
    {
        // OIDC 私钥每次从当前租户的可信设置加载，并由请求材料释放。签名器不能
        // 跨请求缓存引用该 RSA；共用禁用缓存的工厂不会保存密钥，也不影响平台
        // DiyToken 或其它插件的全局 CryptoProviderFactory 默认行为。
        private static readonly CryptoProviderFactory RequestScopedRsaFactory = new CryptoProviderFactory
        {
            CacheSignatureProviders = false
        };

        /// <summary>
        /// 为由调用方在请求结束释放的 RSA 创建签名/验签 Key，防止后续同私钥请求
        /// 复用已释放 RSA 的签名器。调用方继续负责 RSA 生命周期与租户密钥隔离。
        /// </summary>
        public static RsaSecurityKey CreateRequestScopedRsaKey(RSA rsa, string keyId)
        {
            if (rsa == null) throw new ArgumentNullException(nameof(rsa));
            return new RsaSecurityKey(rsa)
            {
                KeyId = keyId,
                CryptoProviderFactory = RequestScopedRsaFactory
            };
        }
    }
}
