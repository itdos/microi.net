using Microi.net;

namespace Microi.Tests.Common;

public sealed class ChatContactProjectionTests
{
    [Fact]
    public void Display_name_prefers_name_then_account_and_never_uses_internal_id()
    {
        Assert.Equal("张三", ChatContactProjection.ResolveDisplayName(
            " 张三 ", "旧名称", "zhangsan", "old-account"));
        Assert.Equal("zhangsan", ChatContactProjection.ResolveDisplayName(
            " ", "", " zhangsan ", "old-account"));
        Assert.Equal("未命名用户", ChatContactProjection.ResolveDisplayName(
            null, null, null, null));

        Assert.Equal("目录姓名", ChatContactProjection.ResolvePublicDirectoryName(
            " 目录姓名 ", "directory-account"));
        Assert.Equal("directory-account", ChatContactProjection.ResolvePublicDirectoryName(
            " ", " directory-account "));
        Assert.Equal("未命名用户", ChatContactProjection.ResolvePublicDirectoryName(
            null, null));

        Assert.Equal("current-account", ChatContactProjection.ResolveAccount(
            " current-account ", "stored-account"));
        Assert.Equal("stored-account", ChatContactProjection.ResolveAccount(
            " ", " stored-account "));
    }

    [Fact]
    public void Contact_projection_contains_only_chat_identity_fields_and_safe_display_fallback()
    {
        var source = new MessageChatContactList
        {
            UserId = "viewer-id",
            UserName = "查看者",
            UserAccount = "viewer",
            ContactUserId = "internal-contact-id",
            ContactUserName = " ",
            ContactUserAccount = "stored-account",
            ContactUserAvatar = "/old-avatar.png",
            LastMessage = "hello",
            UnRead = 2
        };

        var projected = ChatContactProjection.Create(
            source,
            currentContactName: "",
            currentContactAccount: "current-account",
            currentContactAvatar: "/current-avatar.png");

        Assert.Equal("current-account", projected.ContactUserName);
        Assert.Equal("current-account", projected.ContactUserAccount);
        Assert.Equal("/current-avatar.png", projected.ContactUserAvatar);
        Assert.Equal("internal-contact-id", projected.ContactUserId);
        Assert.Equal("hello", projected.LastMessage);
        Assert.Equal(2, projected.UnRead);

        var publicFields = typeof(MessageChatContactListDto)
            .GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);
        Assert.Contains("ContactUserAccount", publicFields);
        Assert.DoesNotContain("Phone", publicFields);
        Assert.DoesNotContain("Email", publicFields);
        Assert.DoesNotContain("Pwd", publicFields);
    }

    [Fact]
    public void Message_projection_carries_only_sender_and_receiver_accounts_for_display_fallback()
    {
        var fields = typeof(MessageBodyDto)
            .GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("FromUserAccount", fields);
        Assert.Contains("ToUserAccount", fields);
        Assert.DoesNotContain("Phone", fields);
        Assert.DoesNotContain("Email", fields);
        Assert.DoesNotContain("Pwd", fields);
    }

    [Fact]
    public void System_messages_share_the_single_AI_assistant_identity()
    {
        Assert.True(ChatAssistantIdentity.IsAssistant(" ai "));
        Assert.False(ChatAssistantIdentity.IsAssistant("admin"));

        var message = ChatAssistantIdentity.CreateSystemMessage("平台维护", "user-1");
        var dto = ChatAssistantIdentity.CreateSystemMessageDto("参数错误", "user-2");

        Assert.Equal("AI", message.FromUserId);
        Assert.Equal("AI助手", message.FromUserName);
        Assert.Equal("AI", message.FromUserAccount);
        Assert.Equal("系统消息", message.Type);
        Assert.Equal("user-1", message.ToUserId);
        Assert.Equal("AI", dto.FromUserId);
        Assert.Equal("AI助手", dto.FromUserName);
        Assert.Equal("user-2", dto.ToUserId);
        Assert.DoesNotContain("admin", new[] { message.FromUserId, message.FromUserName, dto.FromUserId, dto.FromUserName });
    }
}
