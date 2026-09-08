using Jint;
using Microi.net;
using MimeKit;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class V8EmailTests
{
    private static JObject Message() => new()
    {
        ["UserName"] = "sender@example.com", ["To"] = "receiver@example.com",
        ["Subject"] = "中文与 Emoji 📮", ["TextBody"] = "邮件正文", ["MessageId"] = "stable-123@example.com"
    };

    [Fact]
    public void Registry_exposes_email_to_real_javascript()
    {
        var engine = new Engine();
        engine.Execute("var V8 = {};");
        V8ExtensionRegistry.InjectAll(engine);
        var result = engine.Evaluate("V8.Email.TestConnection({Host:'https://bad.example', UserName:'x', Credential:'secret'}).Code");
        Assert.Equal(0, result.AsNumber());
    }

    [Fact]
    public void Mime_preserves_unicode_recipients_reply_headers_and_attachment_bytes()
    {
        var input = Message();
        input["Cc"] = new JArray("copy@example.com");
        input["Bcc"] = "private@example.com";
        input["InReplyTo"] = "original@example.com";
        input["Attachments"] = new JArray(new JObject { ["FileName"] = "../中文.txt", ["ContentType"] = "text/plain", ["FileByteBase64"] = "YWJjAA==" });
        using var message = V8Email.BuildMessage(input);
        Assert.Equal("中文与 Emoji 📮", message.Subject);
        Assert.Equal("stable-123@example.com", message.MessageId);
        Assert.Equal("original@example.com", message.InReplyTo);
        Assert.Single(message.To); Assert.Single(message.Cc); Assert.Single(message.Bcc);
        var part = Assert.IsAssignableFrom<MimePart>(Assert.Single(message.Attachments));
        Assert.Equal("中文.txt", part.FileName);
        using var bytes = new MemoryStream();
        part.Content.DecodeTo(bytes);
        Assert.Equal(new byte[] { 97, 98, 99, 0 }, bytes.ToArray());
    }

    [Theory]
    [InlineData("Subject", "")]
    [InlineData("TextBody", "")]
    public void Empty_optional_message_fields_are_supported(string field, string value)
    {
        var input = Message(); input[field] = value;
        using var message = V8Email.BuildMessage(input);
        Assert.NotNull(message.Body);
    }

    [Theory]
    [InlineData("missing-domain")]
    [InlineData("x@example.com\r\nBcc: victim@example.com")]
    [InlineData("<x@example.com>")]
    public void Message_id_rejects_header_injection_and_invalid_values(string value)
    {
        var input = Message(); input["MessageId"] = value;
        Assert.Throws<ArgumentException>(() => V8Email.BuildMessage(input));
    }

    [Fact]
    public void Empty_recipient_list_is_rejected_before_network()
    {
        var input = Message(); input["To"] = "";
        Assert.Throws<ArgumentException>(() => V8Email.BuildMessage(input));
    }

    [Fact]
    public void Cleartext_transport_and_password_echo_are_rejected()
    {
        var result = new V8Email().TestConnection(new { Host = "localhost", Security = "None", Credential = "should-never-appear", UserName = "user@example.com" });
        Assert.Equal(0, result.Code);
        Assert.DoesNotContain("should-never-appear", result.Msg);
        Assert.Contains("SSL/TLS", result.Msg);
    }

    [Fact]
    public void Oversized_attachment_is_rejected_before_decoding()
    {
        var input = Message();
        input["Attachments"] = new JArray(new JObject { ["FileName"] = "large.bin", ["FileByteBase64"] = new string('A', 15 * 1024 * 1024) });
        Assert.Throws<ArgumentException>(() => V8Email.BuildMessage(input));
    }

    [Fact]
    public void Credential_protection_requires_trusted_tenant_context()
    {
        Assert.Throws<InvalidOperationException>(() => new V8Email().ProtectCredential("test-authorization-code"));
    }

    [Fact]
    public void Invalid_send_does_not_claim_delivery_or_echo_credentials()
    {
        var input = Message(); input["Credential"] = "never-echo"; input["Host"] = "bad://host";
        var result = new V8Email().Send(input);
        Assert.Equal(0, result.Code);
        Assert.Equal("Failed", JObject.FromObject((object)result.Data)["DeliveryState"]?.ToString());
        Assert.DoesNotContain("never-echo", result.Msg);
    }
}
