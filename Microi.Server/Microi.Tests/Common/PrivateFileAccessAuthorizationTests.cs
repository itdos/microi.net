using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class PrivateFileAccessAuthorizationTests
{
    [Fact]
    public void DefaultFormFieldResource_RequiresTheFullAuthoritativeTuple()
    {
        var param = new DiyUploadParam
        {
            FilePathName = "iTdos/private/order.pdf"
        };

        Assert.NotNull(PrivateFileAccessAuthorization.ValidateResourceContext(param, out var kind));
        Assert.Equal(PrivateFileAccessAuthorization.FormFieldResourceKind, kind);

        param.FormEngineKey = "orders";
        param.FormDataId = "order-1";
        param.FieldId = "attachment-field";
        param.SysMenuId = "orders-menu";
        Assert.Null(PrivateFileAccessAuthorization.ValidateResourceContext(param, out kind));
        Assert.Equal(PrivateFileAccessAuthorization.FormFieldResourceKind, kind);
    }

    [Theory]
    [InlineData("UserAvatar")]
    [InlineData("MenuImportTemplate")]
    [InlineData("DeptImportTemplate")]
    public void SpecialResourceKinds_RequireAnExactAuthoritativeRecordId(string resourceKind)
    {
        var param = new DiyUploadParam
        {
            ResourceKind = resourceKind,
            FilePathName = "iTdos/private/resource.bin"
        };
        Assert.NotNull(PrivateFileAccessAuthorization.ValidateResourceContext(param, out _));

        param.ResourceId = "record-1";
        Assert.Null(PrivateFileAccessAuthorization.ValidateResourceContext(param, out var normalizedKind));
        Assert.Equal(resourceKind, normalizedKind);
    }

    [Fact]
    public void FileManagerObject_RequiresSingleExactObjectKeyAndAuthoritativeMenu()
    {
        var param = new DiyUploadParam
        {
            OsClient = "iTdos",
            ResourceKind = PrivateFileAccessAuthorization.FileManagerObjectResourceKind,
            ResourceId = "iTdos/private/design/A.pdf",
            FilePathName = "ITDOS/private/design/A.pdf",
            SysMenuId = "file-manager-menu"
        };

        Assert.Null(PrivateFileAccessAuthorization.ValidateResourceContext(param, out var kind));
        Assert.Equal(PrivateFileAccessAuthorization.FileManagerObjectResourceKind, kind);
        Assert.True(PrivateFileAccessAuthorization.TryNormalizeFileManagerObjectPath(param, out var normalized));
        Assert.Equal("/itdos/private/design/A.pdf", normalized);

        param.FilePathName = "iTdos/private/design/a.pdf";
        Assert.False(PrivateFileAccessAuthorization.TryNormalizeFileManagerObjectPath(param, out _));

        param.FilePathName = "iTdos/private/design/A.pdf";
        param.FilePathNames = new List<string> { "iTdos/private/design/A.pdf" };
        Assert.NotNull(PrivateFileAccessAuthorization.ValidateResourceContext(param, out _));
    }

    [Fact]
    public void CadDerivedPreview_RequiresFullFormContextAndOneOriginalPath()
    {
        var param = new DiyUploadParam
        {
            OsClient = "iTdos",
            ResourceKind = PrivateFileAccessAuthorization.FormFieldDerivedPreviewResourceKind,
            FilePathName = "iTdos/private/design/Part_preview.dxf",
            OriginalFilePathName = "iTdos/private/design/Part.dwg",
            FormEngineKey = "design_asset",
            FormDataId = "asset-1",
            FieldId = "cad-file-field",
            SysMenuId = "design-menu"
        };

        Assert.Null(PrivateFileAccessAuthorization.ValidateResourceContext(param, out var kind));
        Assert.Equal(PrivateFileAccessAuthorization.FormFieldDerivedPreviewResourceKind, kind);

        param.OriginalFilePathName = null;
        Assert.NotNull(PrivateFileAccessAuthorization.ValidateResourceContext(param, out _));
        param.OriginalFilePathName = "iTdos/private/design/Part.dwg";
        param.FilePathNames = new List<string> { param.FilePathName };
        Assert.NotNull(PrivateFileAccessAuthorization.ValidateResourceContext(param, out _));
    }

    [Theory]
    [InlineData("iTdos/private/design/Part.dwg", "iTdos/private/design/Part_preview.dxf")]
    [InlineData("iTdos/private/design/Part.step", "iTdos/private/design/Part_preview.stl")]
    [InlineData("iTdos/private/design/Part.stp", "iTdos/private/design/Part_preview.stl")]
    public void CadDerivedPreview_UsesTheConverterExactSameDirectoryRule(
        string original,
        string preview)
    {
        var param = new DiyUploadParam
        {
            OsClient = "iTdos",
            ResourceKind = PrivateFileAccessAuthorization.FormFieldDerivedPreviewResourceKind,
            OriginalFilePathName = original,
            FilePathName = preview
        };

        Assert.True(PrivateFileAccessAuthorization.TryResolveCadDerivedPreviewPath(
            param,
            out var normalized));
        Assert.Equal("/itdos/" + preview.Substring("iTdos/".Length), normalized);
        Assert.True(CadDerivedPreviewPath.TryGetConvertedPath(original, out var sharedPath));
        Assert.Equal(preview, sharedPath);
        Assert.Equal(
            sharedPath,
            CadFileConverter.GetConvertedPath(original, System.IO.Path.GetExtension(original)));

        param.FilePathName = preview.Replace("/design/", "/other/");
        Assert.False(PrivateFileAccessAuthorization.TryResolveCadDerivedPreviewPath(param, out _));
        param.FilePathName = preview + ".bak";
        Assert.False(PrivateFileAccessAuthorization.TryResolveCadDerivedPreviewPath(param, out _));
    }

    [Fact]
    public void CadDerivedPreview_RequiresAuthoritativeOriginalAndCaseExactDerivedObject()
    {
        var authoritative = JArray.Parse("""
            [{ "Path": "iTdos/private/design/Part.dwg", "Name": "Part.dwg" }]
            """);
        var param = new DiyUploadParam
        {
            OsClient = "iTdos",
            OriginalFilePathName = "iTdos/private/design/Part.dwg",
            FilePathName = "iTdos/private/design/Part_preview.dxf"
        };

        Assert.True(PrivateFileAccessAuthorization.IsAuthorizedCadDerivedPreview(
            authoritative,
            param,
            out var normalized));
        Assert.Equal("/itdos/private/design/Part_preview.dxf", normalized);

        param.OriginalFilePathName = "iTdos/private/design/Other.dwg";
        Assert.False(PrivateFileAccessAuthorization.IsAuthorizedCadDerivedPreview(
            authoritative,
            param,
            out _));
        param.OriginalFilePathName = "iTdos/private/design/Part.dwg";
        param.FilePathName = "iTdos/private/design/part_preview.dxf";
        Assert.False(PrivateFileAccessAuthorization.IsAuthorizedCadDerivedPreview(
            authoritative,
            param,
            out _));
    }

    [Theory]
    [InlineData("/file-manage/index")]
    [InlineData("/views/file-manage/index.vue")]
    [InlineData("@/views/file-manage/index.vue")]
    public void FileManagerMenu_UsesExactKnownComponentPaths(string componentPath)
    {
        Assert.True(PrivateFileAccessAuthorization.IsFileManagerMenu(new JObject
        {
            ["ComponentPath"] = componentPath
        }));
        Assert.False(PrivateFileAccessAuthorization.IsFileManagerMenu(new JObject
        {
            ["ComponentPath"] = componentPath + "-lookalike"
        }));
    }

    [Fact]
    public void FileManagerObject_DeniesOrdinaryMenuUserAndAccessKeySession()
    {
        var ordinaryMenuUser = new JObject
        {
            ["Id"] = "ordinary-user",
            ["Level"] = DiyCommon.MaxRoleLevel - 1,
            ["MenuIds"] = new JArray("file-manager-menu")
        };
        var ordinaryDenied = PrivateFileAccessAuthorization
            .RequireFileManagerPlatformAdmin(ordinaryMenuUser);
        Assert.NotNull(ordinaryDenied);
        Assert.Contains("超级管理员", ordinaryDenied!.Msg);

        var accessKeyAdmin = new JObject
        {
            ["Id"] = "access-key-admin",
            ["Level"] = DiyCommon.MaxRoleLevel,
            ["_AccessKeySession"] = true
        };
        var accessKeyDenied = PrivateFileAccessAuthorization
            .RequireFileManagerPlatformAdmin(accessKeyAdmin);
        Assert.NotNull(accessKeyDenied);
        Assert.Contains("访问密钥", accessKeyDenied!.Msg);

        Assert.Null(PrivateFileAccessAuthorization.RequireFileManagerPlatformAdmin(new JObject
        {
            ["Id"] = "platform-admin",
            ["Level"] = DiyCommon.MaxRoleLevel
        }));
    }

    [Fact]
    public void UnknownResourceKind_AndBarePath_FailClosed()
    {
        var unknown = new DiyUploadParam
        {
            ResourceKind = "AnyPrivatePath",
            ResourceId = "record-1",
            FilePathName = "iTdos/private/secret.txt"
        };
        Assert.NotNull(PrivateFileAccessAuthorization.ValidateResourceContext(unknown, out _));

        var bare = new DiyUploadParam
        {
            ResourceKind = "UserAvatar",
            ResourceId = "user-1"
        };
        Assert.NotNull(PrivateFileAccessAuthorization.ValidateResourceContext(bare, out _));
    }

    [Fact]
    public void AuthoritativeFieldMatching_IsExactAndAppliesToEveryRequestedPath()
    {
        var authoritative = JArray.Parse("""
            [
              { "Path": "iTdos/avatar/user-1.png", "Name": "avatar.png" },
              { "Path": "iTdos/avatar/user-1-small.png", "Name": "small.png" }
            ]
            """);

        Assert.True(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            authoritative,
            new[]
            {
                "iTdos/avatar/user-1.png",
                "iTdos/avatar/user-1-small.png"
            }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            authoritative,
            new[] { "iTdos/avatar/user-1.png.bak" }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            authoritative,
            new[]
            {
                "iTdos/avatar/user-1.png",
                "iTdos/avatar/other-user.png"
            }));
        Assert.True(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JValue.CreateString("iTdos/private/A.pdf"),
            new[] { "ITDOS/private/A.pdf" }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JValue.CreateString("iTdos/private/A.pdf"),
            new[] { "iTdos/private/a.pdf" }));
    }

    [Fact]
    public void UploadMetadata_OnlyAuthoritativePathPropertiesCanGrantAccess()
    {
        const string requested = "iTdos/private/order/Invoice.pdf";
        Assert.True(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JObject.Parse("""{ "Path": "iTdos/private/order/Invoice.pdf", "Name": "display.pdf" }"""),
            new[] { requested }));
        Assert.True(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JArray.Parse("""[{ "FilePathName": "iTdos/private/order/Invoice.pdf" }]"""),
            new[] { requested }));

        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JObject.Parse("""{ "Name": "iTdos/private/order/Invoice.pdf" }"""),
            new[] { requested }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JObject.Parse("""{ "Size": "iTdos/private/order/Invoice.pdf" }"""),
            new[] { requested }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JObject.Parse("""{ "Metadata": { "Custom": "iTdos/private/order/Invoice.pdf" } }"""),
            new[] { requested }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JArray.Parse("""["iTdos/private/order/Invoice.pdf"]"""),
            new[] { requested }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JObject.Parse("""{ "Path": "https://foreign.example/iTdos/private/order/Invoice.pdf" }"""),
            new[] { requested }));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPaths(
            JValue.CreateString("https://foreign.example/iTdos/private/order/Invoice.pdf"),
            new[] { requested }));
    }

    [Fact]
    public void OfficeVersions_UseOnlyAuthoritativePropertiesAndPreserveObjectKeyCase()
    {
        var authoritative = JObject.Parse("""
        {
          "Path": "iTdos/private/order/Invoice.docx",
          "Versions": [
            { "Path": "iTdos/private/order/Invoice_v1.0.0.docx" },
            { "Name": "iTdos/private/order/forged.docx" }
          ]
        }
        """);

        Assert.True(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPath(
            authoritative,
            "ITDOS/private/order/Invoice_v1.0.0.docx"));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPath(
            authoritative,
            "iTdos/private/order/invoice_v1.0.0.docx"));
        Assert.False(PrivateFileAccessAuthorization.AuthoritativeValueReferencesPath(
            authoritative,
            "iTdos/private/order/forged.docx"));
    }

    [Fact]
    public void AuthorizationFailureLog_RedactsSecretsPathsUrlsAndBusinessIds()
    {
        const string guid = "12345678-1234-1234-1234-123456789abc";
        const string ulid = "01KQ12PHR2FEG3BRQ1CN3ZY6B4";
        var exception = new InvalidOperationException(
            "Bearer bearer-secret Password=password-secret Token=token-secret " +
            "https://files.example/private/a.pdf /huayou/file/private/a.pdf " +
            @"C:\storage\huayou\private\a.pdf \\server\share\secret.pdf " +
            "huayou/file/private/no-leading-slash.pdf " +
            "{\"AccessKeyId\":\"access-secret\",\"SecretAccessKey\":\"secret-key\"}\r\nforged-log " +
            guid + " " + ulid);

        var sanitized = PrivateFileAccessAuthorization.SanitizeAuthorizationException(exception);

        Assert.Contains("System.InvalidOperationException", sanitized);
        Assert.Contains("HResult=", sanitized);
        Assert.Matches(@"MessageSha256=[0-9a-f]{64}$", sanitized);
        Assert.DoesNotContain("bearer-secret", sanitized);
        Assert.DoesNotContain("password-secret", sanitized);
        Assert.DoesNotContain("token-secret", sanitized);
        Assert.DoesNotContain("files.example", sanitized);
        Assert.DoesNotContain("huayou", sanitized);
        Assert.DoesNotContain("server", sanitized);
        Assert.DoesNotContain("access-secret", sanitized);
        Assert.DoesNotContain("secret-key", sanitized);
        Assert.DoesNotContain("forged-log", sanitized);
        Assert.DoesNotContain("\r", sanitized);
        Assert.DoesNotContain("\n", sanitized);
        Assert.DoesNotContain(guid, sanitized);
        Assert.DoesNotContain(ulid, sanitized);
    }

    [Fact]
    public void AuthorizationFailureLog_RedactsDatabaseMessagesCompletely()
    {
        var sanitized = PrivateFileAccessAuthorization.SanitizeAuthorizationException(
            new InvalidOperationException("SELECT Secret FROM diy_field WHERE Id = 'business-id'"));

        Assert.Matches(@"MessageSha256=[0-9a-f]{64}$", sanitized);
        Assert.DoesNotContain("Secret", sanitized);
        Assert.DoesNotContain("business-id", sanitized);
    }

    [Fact]
    public void FieldIdentity_ExactIdWinsOverAConflictingFieldName()
    {
        var idMatch = JObject.Parse("""{ "Id": "shared-key", "Name": "ActualField" }""");
        var nameMatch = JObject.Parse("""{ "Id": "other-field", "Name": "shared-key" }""");

        Assert.Same(
            idMatch,
            PrivateFileAccessAuthorization.PreferExactFieldIdMatch(idMatch, nameMatch));
        Assert.Same(
            nameMatch,
            PrivateFileAccessAuthorization.PreferExactFieldIdMatch(null, nameMatch));
    }

    [Fact]
    public void FieldAuthorizationSource_UsesPrimaryTenantDatabaseAndTableBoundProjection()
    {
        var source = File.ReadAllText(Path.Combine(
            FindServerRoot(), "Microi.Core", "Security", "PrivateFileAccessAuthorization.cs"));
        var methodStart = source.IndexOf(
            "private static Task<JObject> ResolveDiyFieldModelAsync",
            StringComparison.Ordinal);
        var nextMethod = source.IndexOf("/// <summary>", methodStart, StringComparison.Ordinal);
        Assert.True(methodStart >= 0 && nextMethod > methodStart);
        var method = source.Substring(methodStart, nextMethod - methodStart);

        Assert.Contains("OsClientExtend.ClientList.TryGetValue", method);
        Assert.Contains("authorizationClient?.Db == null", method);
        Assert.Contains("authorizationClient.Db", method);
        Assert.Contains("d.Id", method);
        Assert.Contains("d.TableId", method);
        Assert.Contains("d.Name", method);
        Assert.Contains("d.Component", method);
        Assert.Contains("d.IsDeleted", method);
        Assert.Contains("d.IsDeleted == 0", method);
        Assert.Contains("d.TableId == tableId", method);
        Assert.Contains("d.Id == fieldId", method);
        Assert.Contains("d.Name == fieldId", method);
        Assert.True(
            method.IndexOf("d.Id == fieldId", StringComparison.Ordinal)
            < method.IndexOf("d.Name == fieldId", StringComparison.Ordinal));
        Assert.DoesNotContain("d.Id == fieldId || d.Name == fieldId", method);
        Assert.Contains("PreferExactFieldIdMatch", method);
        Assert.DoesNotContain("OsClientExtend.GetClient", method);
        Assert.DoesNotContain("GetDiyFieldModel", method);
        Assert.DoesNotContain("DbRead", method);
    }

    private static string FindServerRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Microi.Core", "Microi.Core.csproj")))
                return directory.FullName;
            var nested = Path.Combine(directory.FullName, "Microi.Server");
            if (File.Exists(Path.Combine(nested, "Microi.Core", "Microi.Core.csproj")))
                return nested;
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Microi.Server root was not found.");
    }
}
