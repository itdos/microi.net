using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class CurrentUserSqlPlaceholderTests
{
    [Fact]
    public void NullCurrentUserInValueBecomesValidFailClosedSql()
    {
        var user = new JObject
        {
            ["Level"] = 399,
            ["JianzhiDM"] = JValue.CreateNull()
        };
        var sql = "C.ZuzhiJGCODE in $CurrentUser.JianzhiDM$ and '$CurrentUser.Level$' = 399";

        var result = new FormEngine().ReplaceCurrentUser(sql, user);

        Assert.Equal("C.ZuzhiJGCODE in (NULL) and '399' = 399", result);
    }

    [Fact]
    public void MissingCurrentUserPropertyDoesNotLeaveAnExecutablePlaceholder()
    {
        var sql = "A.SiteId = '$CurrentUser.SiteId$' OR A.Code IN $CurrentUser.SiteCodes$";

        var result = new FormEngine().ReplaceCurrentUser(sql, new JObject());

        Assert.Equal("A.SiteId = 'NULL' OR A.Code IN (NULL)", result);
    }

    [Fact]
    public void StringNullFromLegacyUserExtensionAlsoFailsClosed()
    {
        var user = new JObject { ["SiteCodes"] = "null" };

        var result = new FormEngine().ReplaceCurrentUser(
            "A.Code IN $CurrentUser.SiteCodes$",
            user);

        Assert.Equal("A.Code IN (NULL)", result);
    }

    [Fact]
    public void LegacySqlListIsRebuiltAsEscapedValues()
    {
        var user = new JObject { ["SiteCodes"] = "('site-a','site-b')" };

        var result = new FormEngine().ReplaceCurrentUser(
            "A.Code IN $CurrentUser.SiteCodes$",
            user);

        Assert.Equal("A.Code IN ('site-a','site-b')", result);
    }

    [Fact]
    public void ParenthesizedListPlaceholderDoesNotProduceDoubleParentheses()
    {
        var user = new JObject { ["SiteCodes"] = new JArray("site-a", "site-b") };

        var result = new FormEngine().ReplaceCurrentUser(
            "A.Code IN ($CurrentUser.SiteCodes$)",
            user);

        Assert.Equal("A.Code IN ('site-a','site-b')", result);
    }

    [Fact]
    public void LegacyQuotedNullListFailsClosed()
    {
        var user = new JObject { ["SiteCodes"] = "('null')" };

        var result = new FormEngine().ReplaceCurrentUser(
            "A.Code IN $CurrentUser.SiteCodes$",
            user);

        Assert.Equal("A.Code IN (NULL)", result);
    }

    [Fact]
    public void PopulatedCurrentUserValueKeepsEscapingSingleQuotes()
    {
        var user = new JObject { ["Name"] = "O'Brien" };

        var result = new FormEngine().ReplaceCurrentUser(
            "A.Name = '$CurrentUser.Name$'",
            user);

        Assert.Equal("A.Name = 'O''Brien'", result);
    }
}
