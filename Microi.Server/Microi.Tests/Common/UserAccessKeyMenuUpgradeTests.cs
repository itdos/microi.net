using System;
using System.Linq;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class UserAccessKeyMenuUpgradeTests
{
    [Fact]
    public void Upgrade26_preserves_customer_buttons_and_adds_the_canonical_dynamic_action()
    {
        var existing = new JArray
        {
            new JObject
            {
                ["Id"] = "customer-button",
                ["Name"] = "客户按钮",
                ["V8Code"] = "V8.Tips('ok', true);"
            }
        };

        var result = Upgrade26.ReconcileMoreButtons(existing.ToString(), out var changed);
        var buttons = JArray.Parse(result).OfType<JObject>().ToArray();

        Assert.True(changed);
        Assert.Equal("6.9.8.1", Upgrade26.Version);
        Assert.Equal(2, buttons.Length);
        Assert.Contains(buttons, button => (string?)button["Id"] == "customer-button");

        var accessKey = Assert.Single(buttons, button =>
            (string?)button["Id"] == Upgrade26.AccessKeyButtonId);
        Assert.Equal("访问密钥", (string?)accessKey["Name"]);
        Assert.True((bool?)accessKey["ShowRow"]);
        Assert.Contains("typeof V8.OpenDialog", (string?)accessKey["V8CodeShow"]);
        Assert.Contains("V8.OpenDialog({", (string?)accessKey["V8Code"]);
        Assert.Contains("ComponentName: \"UserAccessKeyPanel\"", (string?)accessKey["V8Code"]);
        Assert.Contains("DataAppend: { User: user }", (string?)accessKey["V8Code"]);
    }

    [Fact]
    public void Upgrade26_is_idempotent_and_collapses_legacy_duplicates()
    {
        var canonical = new JArray(Upgrade26.BuildAccessKeyButton()).ToString();
        var same = Upgrade26.ReconcileMoreButtons(canonical, out var sameChanged);

        Assert.False(sameChanged);
        Assert.Equal(canonical, same);

        var duplicates = new JArray
        {
            Upgrade26.BuildAccessKeyButton(),
            new JObject
            {
                ["Id"] = "legacy-access-key",
                ["Name"] = "访问密钥",
                ["V8Code"] = "V8.OpenUserAccessKeys(V8.Form);"
            }
        };
        var reconciled = JArray.Parse(
            Upgrade26.ReconcileMoreButtons(duplicates.ToString(), out var duplicateChanged));

        Assert.True(duplicateChanged);
        Assert.Single(reconciled.OfType<JObject>(), button =>
            (string?)button["Id"] == Upgrade26.AccessKeyButtonId);
        Assert.Single(reconciled.OfType<JObject>(), button =>
            (string?)button["Name"] == "访问密钥");
    }

    [Fact]
    public void Upgrade26_rejects_malformed_button_json_without_overwriting_it()
    {
        var error = Assert.Throws<FormatException>(() =>
            Upgrade26.ReconcileMoreButtons("{not-json}", out _));

        Assert.Contains("停止写入以保护现有按钮", error.Message);
        Assert.Throws<FormatException>(() =>
            Upgrade26.ReconcileMoreButtons("{}", out _));
    }
}
