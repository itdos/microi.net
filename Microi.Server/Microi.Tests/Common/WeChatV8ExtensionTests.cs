using Jint;
using Microi.net;
using Org.BouncyCastle.Crypto;

namespace Microi.Tests.Common;

// 使用微信支付官方 SDK 的固定向量锁定 V8.WeChat AES-GCM 协议边界。
public sealed class WeChatV8ExtensionTests
{
    private const string ApiV3Key = "a7cde1ZJB1kG2e7VfTs3jQzaWizur8Gb";
    private const string AssociatedData = "associatedData";
    private const string Nonce = "uluk4a9R25RW";
    private const string Ciphertext = "ulwSiIajGClcvcOYvOQ7+l+0PAbzzwI=";

    [Fact]
    public void AesGcmDecrypt_UsesUtf8NonceAndAuthenticatesTrailingTag()
    {
        var weChat = new WeChat();

        var plaintext = weChat.AesGcmDecrypt(
            AssociatedData,
            Nonce,
            Ciphertext,
            ApiV3Key);

        Assert.Equal("message", plaintext);
    }

    [Fact]
    public void AesGcmDecrypt_RejectsTamperedAuthenticationTag()
    {
        var encrypted = Convert.FromBase64String(Ciphertext);
        encrypted[^1] ^= 0x01;
        var tamperedCiphertext = Convert.ToBase64String(encrypted);
        var weChat = new WeChat();

        Assert.Throws<InvalidCipherTextException>(() => weChat.AesGcmDecrypt(
            AssociatedData,
            Nonce,
            tamperedCiphertext,
            ApiV3Key));
    }

    [Fact]
    public void Registry_ExposesWorkingAesGcmDecryptThroughV8WeChat()
    {
        var engine = new Engine();
        engine.Execute("var V8 = {};");
        V8ExtensionRegistry.InjectAll(engine);
        engine.SetValue("associatedData", AssociatedData);
        engine.SetValue("nonce", Nonce);
        engine.SetValue("ciphertext", Ciphertext);
        engine.SetValue("apiV3Key", ApiV3Key);

        var plaintext = engine.Evaluate(
            "V8.WeChat.AesGcmDecrypt(associatedData, nonce, ciphertext, apiV3Key)").AsString();

        Assert.Equal("message", plaintext);
    }
}
