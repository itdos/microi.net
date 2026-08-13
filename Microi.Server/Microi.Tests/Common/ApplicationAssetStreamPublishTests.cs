using Microi.net;
using Newtonsoft.Json.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace Dos.Common.Tests;

public class ApplicationAssetStreamPublishTests
{
    [Fact]
    public void BuildStatusData_AdvertisesLegacyCapsAndUncappedResumableTransport()
    {
        var data = JObject.FromObject(V8McpLogic.BuildStatusData(new CurrentToken
        {
            OsClient = "iTdos"
        }));

        Assert.Equal("iTdos", data.Value<string>("OsClient"));
        var protocol = data.Value<string>("ApplicationAssetStreamProtocol");
        Assert.Contains(protocol, new[] { "2.0", "3.0", "Unavailable" });
        Assert.NotNull(data.Property("ApplicationStreamPublishMode"));
        Assert.NotNull(data.Property("ApplicationStreamGateEpoch"));
        Assert.NotNull(data.Property("ApplicationAssetStreamGateReady"));
        if (!data.Value<bool>("ApplicationAssetStreamGateReady"))
        {
            Assert.Equal("Unavailable", protocol);
            Assert.Equal("Unavailable", data.Value<string>("ApplicationStreamPublishMode"));
        }
        Assert.Equal(128L * 1024 * 1024, data.Value<long>("ApplicationAssetStreamMaxFileBytes"));
        Assert.Equal(1024L * 1024 * 1024, data.Value<long>("ApplicationAssetStreamMaxTotalBytes"));
        Assert.Equal(8, data.Value<int>("ApplicationAssetStreamIoConcurrency"));
        Assert.Equal(128L * 1024 * 1024, data.Value<long>("ApplicationAssetStreamReadBudgetBytes"));
        Assert.Equal("legacy-single-request", data.Value<string>("ApplicationAssetStreamLimitsApplyTo"));
        Assert.True(data.Value<bool>("ApplicationAssetResumableSupported"));
        Assert.Equal(1, data.Value<int>("ApplicationAssetResumableProtocolVersion"));
        Assert.Equal(16L * 1024 * 1024, data.Value<long>("ApplicationAssetResumableDefaultChunkBytes"));
        Assert.Equal(1024L * 1024 * 1024, data.Value<long>("ApplicationAssetResumableMaxChunkBytes"));
        Assert.Equal(10_000, data.Value<int>("ApplicationAssetResumableMaxParts"));
        Assert.Equal(10_000L * 1024 * 1024 * 1024, data.Value<long>("ApplicationAssetResumableMaxObjectBytes"));
        Assert.Equal(0, data.Value<long>("ApplicationAssetResumableProductSizeLimitBytes"));
    }

    [Fact]
    public void CommittedV3Manifest_AcceptsFiveGiBLogicalAssetThroughResumableTransport()
    {
        const long fiveGiB = 5L * 1024 * 1024 * 1024;
        var manifest = new JArray
        {
            new JObject
            {
                ["Path"] = "index.html",
                ["Sha256"] = new string('a', 64),
                ["Size"] = fiveGiB,
                ["IsEntry"] = true
            }
        };
        var version = new JObject
        {
            ["EntryPath"] = "index.html",
            ["AssetManifestJson"] = manifest.ToString(Newtonsoft.Json.Formatting.None),
            ["RuntimeManifestHash"] = V8McpLogic.ComputeMicroServiceManifestHash(manifest)
        };

        Assert.Null(V8McpLogic.ValidateApplicationAssetV3CommittedManifest(version));
    }

    [Fact]
    public void CommittedV3Manifest_RejectsLogicalAssetBeyondProviderBoundary()
    {
        var tooLarge = V8McpLogic.ApplicationAssetResumableMaxObjectBytes + 1L;
        var manifest = new JArray
        {
            new JObject
            {
                ["Path"] = "index.html",
                ["Sha256"] = new string('a', 64),
                ["Size"] = tooLarge,
                ["IsEntry"] = true
            }
        };
        var version = new JObject
        {
            ["EntryPath"] = "index.html",
            ["AssetManifestJson"] = manifest.ToString(Newtonsoft.Json.Formatting.None),
            ["RuntimeManifestHash"] = V8McpLogic.ComputeMicroServiceManifestHash(manifest)
        };

        Assert.Contains(
            "Size 超限",
            V8McpLogic.ValidateApplicationAssetV3CommittedManifest(version));
    }

    [Fact]
    public void ValidateStreamPublishOperator_DoesNotPropagateDynamicJValueBinding()
    {
        var validate = typeof(V8McpLogic).GetMethod(
            "ValidateStreamPublishOperator",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(validate);

        var token = new CurrentToken
        {
            OsClient = "iTdos",
            CurrentUser = new JObject
            {
                ["Id"] = "stream-publisher-test",
                ["Level"] = new JValue(DiyCommon.MaxRoleLevel)
            }
        };

        var result = validate.Invoke(null, new object[]
        {
            token,
            "iTdos",
            "application-asset:upload",
            "stream-publisher-test"
        });

        Assert.Null(result);
    }

    [Fact]
    public void ValidateStreamPublishOperator_RejectsNonAdministratorWithoutBinderFailure()
    {
        var validate = typeof(V8McpLogic).GetMethod(
            "ValidateStreamPublishOperator",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(validate);

        var token = new CurrentToken
        {
            OsClient = "iTdos",
            CurrentUser = new JObject
            {
                ["Id"] = "stream-publisher-low-role-test",
                ["Level"] = new JValue(1)
            }
        };

        var result = Assert.IsType<DosResult<object>>(validate.Invoke(null, new object[]
        {
            token,
            "iTdos",
            "application-asset:upload",
            "stream-publisher-test"
        }));

        Assert.Equal(0, result.Code);
        Assert.Contains("超级管理员", result.Msg);
    }

    [Theory]
    [InlineData("MinIO", "MinIO")]
    [InlineData("S3", "S3")]
    [InlineData("", "Aliyun")]
    public void NormalizeApplicationAssetHdfsType_HandlesJValueWithoutDynamicBinding(
        string configuredType,
        string expected)
    {
        dynamic rollingUpgradeConfig = new JObject
        {
            ["HDFS"] = new JValue(configuredType)
        };

        var actual = V8McpLogic.NormalizeApplicationAssetHdfsType((object)rollingUpgradeConfig);

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void NormalizeApplicationAssetHdfsType_HandlesObjectShapedLegacyConfig()
    {
        object legacyConfig = new Dictionary<string, object>
        {
            ["HDFS"] = new JValue("MinIO")
        };

        Assert.Equal("MinIO", V8McpLogic.NormalizeApplicationAssetHdfsType(legacyConfig));
    }

    [Fact]
    public void NormalizeApplicationAssetHdfsType_DefaultsToAliyunWhenConfigurationIsMissing()
    {
        Assert.Equal("Aliyun", V8McpLogic.NormalizeApplicationAssetHdfsType(null));
        Assert.Equal("Aliyun", V8McpLogic.NormalizeApplicationAssetHdfsType(new JObject()));
    }

    [Theory]
    [InlineData("index.html", "index.html")]
    [InlineData("assets\\app.js", "assets/app.js")]
    [InlineData("css/theme.dark.css", "css/theme.dark.css")]
    public void NormalizeRelativePath_ReturnsPortableSafePath(string input, string expected)
    {
        Assert.Equal(expected, V8McpLogic.NormalizeApplicationAssetRelativePath(input));
    }

    [Theory]
    [InlineData("")]
    [InlineData("../index.html")]
    [InlineData("assets/../index.html")]
    [InlineData("/index.html")]
    [InlineData("assets//app.js")]
    [InlineData("C:/build/index.html")]
    [InlineData("versions/v1.0.0/index.html")]
    [InlineData("latest/index.html")]
    [InlineData(".microi-integrity/a.ok")]
    [InlineData("assets/app?.js")]
    public void NormalizeRelativePath_RejectsTraversalAndPublisherNamespaces(string input)
    {
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetRelativePath(input));
    }

    [Theory]
    [InlineData("1.2.3", "v1.2.3")]
    [InlineData("V01.002.0003", "v1.2.3")]
    [InlineData("v0.0.0", "v0.0.0")]
    public void NormalizeVersion_ReturnsCanonicalSemanticVersion(string input, string expected)
    {
        Assert.Equal(expected, V8McpLogic.NormalizeApplicationAssetVersion(input));
    }

    [Theory]
    [InlineData("1")]
    [InlineData("v1.2")]
    [InlineData("v1.2.3.4")]
    [InlineData("latest")]
    public void NormalizeVersion_RejectsNonSemanticVersion(string input)
    {
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetVersion(input));
    }

    [Theory]
    [InlineData("12345678")]
    [InlineData("publish:01K123456789")]
    [InlineData("asset.request_01-K")]
    public void NormalizeRequestId_AcceptsStableSafeValues(string requestId)
    {
        Assert.Equal(requestId, V8McpLogic.NormalizeApplicationAssetRequestId(requestId));
    }

    [Theory]
    [InlineData("")]
    [InlineData("1234567")]
    [InlineData("request id")]
    [InlineData("request/id")]
    [InlineData("../request")]
    [InlineData("request\r\nheader")]
    public void NormalizeRequestId_RejectsShortOrUnsafeValues(string requestId)
    {
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetRequestId(requestId));
    }

    [Fact]
    public void NormalizeRequestId_EnforcesMaximumLength()
    {
        Assert.Equal(128, V8McpLogic.NormalizeApplicationAssetRequestId(new string('a', 128)).Length);
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetRequestId(new string('a', 129)));
    }

    [Fact]
    public void NormalizeDeliveryBatchId_UsesDatabaseSafeEightToFiftyCharacterRange()
    {
        Assert.Equal("12345678", V8McpLogic.NormalizeApplicationAssetDeliveryBatchId("12345678"));
        Assert.Equal(50, V8McpLogic.NormalizeApplicationAssetDeliveryBatchId(new string('b', 50)).Length);
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetDeliveryBatchId("1234567"));
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetDeliveryBatchId(new string('b', 51)));
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetDeliveryBatchId("batch/unsafe"));
    }

    [Fact]
    public void MissingRequestAndBatchIds_AreDerivedDeterministicallyWithoutRandomState()
    {
        var resolveRequest = typeof(V8McpLogic).GetMethod(
            "ResolveApplicationAssetRequestId",
            BindingFlags.NonPublic | BindingFlags.Static);
        var resolveBatch = typeof(V8McpLogic).GetMethod(
            "ResolveApplicationAssetDeliveryBatchId",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(resolveRequest);
        Assert.NotNull(resolveBatch);

        var firstRequest = Assert.IsType<string>(resolveRequest.Invoke(null, new object[] { null, "publish", "stable-seed" }));
        var secondRequest = Assert.IsType<string>(resolveRequest.Invoke(null, new object[] { null, "publish", "stable-seed" }));
        var firstBatch = Assert.IsType<string>(resolveBatch.Invoke(null, new object[] { null, "stable-seed" }));
        var secondBatch = Assert.IsType<string>(resolveBatch.Invoke(null, new object[] { null, "stable-seed" }));

        Assert.Equal(firstRequest, secondRequest);
        Assert.InRange(firstRequest.Length, 8, 128);
        Assert.Equal(firstBatch, secondBatch);
        Assert.InRange(firstBatch.Length, 8, 50);
    }

    [Fact]
    public void StreamMetadataPrimaryKeys_AreDeterministicBoundedAndBusinessKeyScoped()
    {
        var fileId = V8McpLogic.BuildApplicationStreamRecordId(
            "file",
            "iTdos",
            "app-id",
            "dist/index.html");
        var sameFileId = V8McpLogic.BuildApplicationStreamRecordId(
            "file",
            "itdos",
            "app-id",
            "dist/index.html");
        var otherFileId = V8McpLogic.BuildApplicationStreamRecordId(
            "file",
            "iTdos",
            "app-id",
            "dist/assets/app.js");
        var versionId = V8McpLogic.BuildApplicationStreamRecordId(
            "version",
            "iTdos",
            "app-id",
            "v2.0.5");
        var microServiceId = V8McpLogic.BuildApplicationStreamRecordId(
            "microservice",
            "iTdos",
            "app-id",
            "landlord-arena");

        Assert.Equal(fileId, sameFileId);
        Assert.Equal(36, fileId.Length);
        Assert.Equal(36, versionId.Length);
        Assert.Equal(36, microServiceId.Length);
        Assert.StartsWith("mciaf-", fileId, StringComparison.Ordinal);
        Assert.StartsWith("mciav-", versionId, StringComparison.Ordinal);
        Assert.StartsWith("mcims-", microServiceId, StringComparison.Ordinal);
        Assert.NotEqual(fileId, otherFileId);
        Assert.NotEqual(fileId, versionId);
        Assert.Throws<ArgumentException>(() => V8McpLogic.BuildApplicationStreamRecordId(
            "unknown", "iTdos", "app-id", "key"));
    }

    [Fact]
    public void ConcurrentFileMetadataReadback_RequiresExactBusinessAndContentFacts()
    {
        var row = new JObject
        {
            ["AppId"] = "app-id",
            ["FilePath"] = "dist/index.html",
            ["ContentHash"] = new string('a', 64),
            ["Size"] = 100,
            ["HdfsPath"] = "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            ["PublishHdfsPath"] = "itdos/ai-app-publish/app/index.html",
            ["StorageScope"] = "PublicBuildStream"
        };
        Assert.Null(V8McpLogic.ValidateApplicationStreamFileMetadata(
            row,
            "app-id",
            "dist/index.html",
            new string('a', 64),
            100,
            "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            "itdos/ai-app-publish/app/index.html"));

        Assert.Contains(
            "ContentHash 不一致",
            V8McpLogic.ValidateApplicationStreamFileMetadata(
                row,
                "app-id",
                "dist/index.html",
                new string('b', 64),
                100,
                "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
                "itdos/ai-app-publish/app/index.html"));
    }

    [Fact]
    public void StreamArchivePlan_ArchivesOnlyObsoleteActiveDistRows()
    {
        var obsolete = new JObject
        {
            ["Id"] = "obsolete-public-build",
            ["AppId"] = "app-id",
            ["FilePath"] = "dist/assets/app.old-hash.js",
            ["ContentHash"] = new string('a', 64),
            ["StorageScope"] = "PublicBuildStream",
            ["Version"] = 4
        };
        var current = new JObject
        {
            ["Id"] = "current-public-build",
            ["AppId"] = "app-id",
            ["FilePath"] = "dist/index.html",
            ["StorageScope"] = "PublicBuildStream",
            ["Version"] = 2
        };
        var privateSource = new JObject
        {
            ["Id"] = "private-source",
            ["AppId"] = "app-id",
            ["FilePath"] = "dist/source/main.ts",
            ["StorageScope"] = "Private",
            ["Version"] = 8
        };
        var nonDistPublic = new JObject
        {
            ["Id"] = "non-dist-public",
            ["AppId"] = "app-id",
            ["FilePath"] = "source/main.ts",
            ["StorageScope"] = "PublicBuildStream",
            ["Version"] = 3
        };

        var updates = V8McpLogic.BuildApplicationStreamArchiveUpdates(
            new[] { obsolete, current, privateSource, nonDistPublic },
            new[] { "dist/index.html", "dist/assets/app.new-hash.js" });

        var update = Assert.Single(updates);
        Assert.Equal("obsolete-public-build", update.Value<string>("Id"));
        Assert.Equal("app-id", update.Value<string>("AppId"));
        Assert.Equal("dist/assets/app.old-hash.js", update.Value<string>("FilePath"));
        Assert.Equal("PublicBuildStream", update.Value<string>("PreviousStorageScope"));
        Assert.Equal(4, update.Value<int>("PreviousVersion"));
        Assert.Equal("PublicBuildStreamArchived", update.Value<string>("StorageScope"));
        Assert.Equal(5, update.Value<int>("Version"));
        Assert.Equal("PublicBuildStream", obsolete.Value<string>("StorageScope"));
        Assert.DoesNotContain(updates, item => item.Value<string>("Id") == "current-public-build");
        Assert.DoesNotContain(updates, item => item.Value<string>("Id") == "private-source");
        Assert.DoesNotContain(updates, item => item.Value<string>("Id") == "non-dist-public");
    }

    [Fact]
    public void StreamArchivePlan_CarriesTheExactOldSnapshotNeededForAtomicCas()
    {
        var stale = new JObject
        {
            ["Id"] = "stale-row",
            ["AppId"] = "app-id",
            ["FilePath"] = "dist/assets/stale.js",
            ["StorageScope"] = "PublicBuildStream",
            ["Version"] = 9
        };

        var update = Assert.Single(V8McpLogic.BuildApplicationStreamArchiveUpdates(
            new[] { stale },
            new[] { "dist/index.html" }));

        Assert.Equal("app-id", update.Value<string>("AppId"));
        Assert.Equal("dist/assets/stale.js", update.Value<string>("FilePath"));
        Assert.Equal("PublicBuildStream", update.Value<string>("PreviousStorageScope"));
        Assert.Equal(9, update.Value<int>("PreviousVersion"));
        Assert.Equal("PublicBuildStreamArchived", update.Value<string>("StorageScope"));
        Assert.Equal(10, update.Value<int>("Version"));

        // Simulate a newer publish reactivating/changing the row after the old
        // owner built its plan. The old snapshot remains unchanged, so the DB
        // UPDATE ... WHERE Version=9/active must affect zero rows.
        stale["StorageScope"] = "PublicBuildStream";
        stale["Version"] = 10;
        Assert.Equal(9, update.Value<int>("PreviousVersion"));
        Assert.NotEqual(stale.Value<int>("Version"), update.Value<int>("PreviousVersion"));
    }

    [Fact]
    public void ExistingStreamFileRows_FailClosedForMissingIdsWrongAppsAndDuplicateBusinessKeys()
    {
        var valid = new JObject
        {
            ["Id"] = "file-row",
            ["AppId"] = "app-id",
            ["FilePath"] = "dist/index.html"
        };
        Assert.Null(V8McpLogic.ValidateApplicationStreamExistingFileRows(new[] { valid }, "app-id"));

        var missingId = (JObject)valid.DeepClone();
        missingId.Remove("Id");
        Assert.Contains("缺少 Id", V8McpLogic.ValidateApplicationStreamExistingFileRows(
            new[] { missingId }, "app-id"));

        var wrongApp = (JObject)valid.DeepClone();
        wrongApp["AppId"] = "other-app";
        Assert.Contains("AppId 不一致", V8McpLogic.ValidateApplicationStreamExistingFileRows(
            new[] { wrongApp }, "app-id"));

        var duplicate = (JObject)valid.DeepClone();
        duplicate["Id"] = "file-row-2";
        Assert.Contains("重复", V8McpLogic.ValidateApplicationStreamExistingFileRows(
            new[] { valid, duplicate }, "app-id"));
    }

    [Fact]
    public void FinalizeIdentityAndExpectedStatePreconditions_AreFailClosed()
    {
        var app = new JObject
        {
            ["Id"] = "immutable-app-id",
            ["AppKey"] = "landlord-arena"
        };
        Assert.Null(V8McpLogic.ValidateApplicationStreamIdentity(
            app, "immutable-app-id", "landlord-arena"));
        Assert.Contains("Id 已漂移", V8McpLogic.ValidateApplicationStreamIdentity(
            app, "other-id", "landlord-arena"));
        Assert.Contains("AppKey 已漂移", V8McpLogic.ValidateApplicationStreamIdentity(
            app, "immutable-app-id", "mahjong-club"));

        Assert.Contains("ExpectedCurrentVersion", V8McpLogic.ValidateApplicationStreamFinalizePreconditions(
            new JObject()));
        Assert.Contains("ExpectedAppVersion", V8McpLogic.ValidateApplicationStreamFinalizePreconditions(
            new JObject { ["ExpectedCurrentVersion"] = 7 }));
        Assert.Null(V8McpLogic.ValidateApplicationStreamFinalizePreconditions(new JObject
        {
            ["ExpectedCurrentVersion"] = 7,
            ["ExpectedAppVersion"] = JValue.CreateNull()
        }));
    }

    [Fact]
    public void ApplicationTerminalCas_UsesTheCompleteOldPointerSnapshot()
    {
        var buildWhere = typeof(V8McpLogic).GetMethod(
            "BuildApplicationStreamAppSnapshotWhere",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(buildWhere);
        var app = new JObject
        {
            ["Id"] = "immutable-app-id",
            ["AppKey"] = "landlord-arena",
            ["CurrentVersion"] = 7,
            ["AppVersion"] = "v2.0.4",
            ["Status"] = "Published",
            ["PublicPublishPath"] = "itdos/ai-app-publish/landlord-arena/index.html",
            ["LastBuildTaskId"] = "delivery-old"
        };

        var where = Assert.IsType<List<object>>(buildWhere.Invoke(null, new object[]
        {
            app,
            "immutable-app-id",
            "landlord-arena"
        }));
        var serialized = JArray.FromObject(where).ToString(Newtonsoft.Json.Formatting.None);

        Assert.Contains("\"Id\",\"=\",\"immutable-app-id\"", serialized);
        Assert.Contains("\"AppKey\",\"=\",\"landlord-arena\"", serialized);
        Assert.Contains("\"CurrentVersion\",\"=\",7", serialized);
        Assert.Contains("\"AppVersion\",\"=\",\"v2.0.4\"", serialized);
        Assert.Contains("\"LastBuildTaskId\",\"=\",\"delivery-old\"", serialized);

        // A later owner that commits CurrentVersion=8 makes this old predicate
        // false at the database, regardless of an expired owner's local lease.
        app["CurrentVersion"] = 8;
        Assert.Contains("\"CurrentVersion\",\"=\",7", serialized);
        Assert.DoesNotContain("\"CurrentVersion\",\"=\",8", serialized);
    }

    [Fact]
    public void StreamArchivePlan_IsRetryConvergentAndFailsClosedForMalformedActiveRows()
    {
        var alreadyArchived = new JObject
        {
            ["Id"] = "already-archived",
            ["FilePath"] = "dist/assets/removed.js",
            ["StorageScope"] = "PublicBuildStreamArchived",
            ["Version"] = 2
        };
        Assert.Empty(V8McpLogic.BuildApplicationStreamArchiveUpdates(
            new[] { alreadyArchived },
            new[] { "dist/index.html" }));

        var reappearingCurrentPath = (JObject)alreadyArchived.DeepClone();
        reappearingCurrentPath["StorageScope"] = "PublicBuildStream";
        Assert.Empty(V8McpLogic.BuildApplicationStreamArchiveUpdates(
            new[] { reappearingCurrentPath },
            new[] { "dist/assets/removed.js" }));

        var malformedActive = new JObject
        {
            ["FilePath"] = "dist/assets/orphan.js",
            ["StorageScope"] = "PublicBuildStream"
        };
        Assert.Throws<InvalidOperationException>(() =>
            V8McpLogic.BuildApplicationStreamArchiveUpdates(
                new[] { malformedActive },
                new[] { "dist/index.html" }));

        malformedActive["Id"] = "orphan-id";
        Assert.Throws<InvalidOperationException>(() =>
            V8McpLogic.BuildApplicationStreamArchiveUpdates(
                new[] { malformedActive },
                new[] { "dist/index.html" }));
    }

    [Fact]
    public void ValidateApplicationAssetContent_AcceptsVerifiedHtmlEntry()
    {
        var bytes = Encoding.UTF8.GetBytes("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>");
        var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        var error = V8McpLogic.ValidateApplicationAssetContent("index.html", bytes.Length, sha256, bytes, true);

        Assert.Null(error);
    }

    [Fact]
    public void ValidateApplicationAssetContent_StrictlyRejectsStoredSizeOrHashMismatch()
    {
        var bytes = Encoding.UTF8.GetBytes("immutable application asset");
        var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        Assert.Contains(
            "大小不一致",
            V8McpLogic.ValidateApplicationAssetContent("assets/app.js", bytes.Length + 1, sha256, bytes, false));
        Assert.Contains(
            "SHA-256 不一致",
            V8McpLogic.ValidateApplicationAssetContent("assets/app.js", bytes.Length, new string('0', 64), bytes, false));
    }

    [Fact]
    public void ValidateIntegrityMarker_AcceptsExactLegacyOrRequestAwareMarker()
    {
        var marker = new JObject
        {
            ["AppKey"] = "landlord-arena",
            ["VersionNo"] = "v2.0.5",
            ["RelativePath"] = "assets/app.js",
            ["Sha256"] = new string('a', 64),
            ["Size"] = 123,
            ["RequestId"] = "asset-12345678"
        };

        Assert.Null(V8McpLogic.ValidateApplicationAssetIntegrityMarker(
            Encoding.UTF8.GetBytes(marker.ToString()),
            "landlord-arena",
            "v2.0.5",
            "assets/app.js",
            new string('a', 64),
            123));

        marker.Remove("RequestId");
        Assert.Null(V8McpLogic.ValidateApplicationAssetIntegrityMarker(
            Encoding.UTF8.GetBytes(marker.ToString()),
            "landlord-arena",
            "v2.0.5",
            "assets/app.js",
            new string('a', 64),
            123));
    }

    [Fact]
    public void ValidateIntegrityMarker_FailsClosedOnMalformedOrMismatchedMetadata()
    {
        Assert.Contains(
            "有效 JSON",
            V8McpLogic.ValidateApplicationAssetIntegrityMarker(
                Encoding.UTF8.GetBytes("not-json"),
                "app",
                "v1.0.0",
                "index.html",
                new string('a', 64),
                10));

        var marker = new JObject
        {
            ["AppKey"] = "app",
            ["VersionNo"] = "v1.0.0",
            ["RelativePath"] = "index.html",
            ["Sha256"] = new string('a', 64),
            ["Size"] = 11
        };
        Assert.Contains(
            "Size 不一致",
            V8McpLogic.ValidateApplicationAssetIntegrityMarker(
                Encoding.UTF8.GetBytes(marker.ToString()),
                "app",
                "v1.0.0",
                "index.html",
                new string('a', 64),
                10));
    }

    [Theory]
    [InlineData("app.js", "<html><head></head><body></body></html>", "入口必须是 HTML")]
    [InlineData("index.html", "<div id=\"app\"></div>", "不是完整 HTML")]
    public void ValidateApplicationAssetContent_RejectsInvalidEntry(string path, string content, string expected)
    {
        var bytes = Encoding.UTF8.GetBytes(content);

        var error = V8McpLogic.ValidateApplicationAssetContent(path, bytes.Length, "", bytes, true);

        Assert.Contains(expected, error);
    }

    [Fact]
    public void PublishedReplay_RequiresExactRequestBatchAndImmutableMetadata()
    {
        var buildLog = new JObject
        {
            ["Mode"] = "StreamedAssets",
            ["RequestId"] = "publish-request-01",
            ["DeliveryBatchId"] = "delivery-batch-01",
            ["SourceManifestHash"] = new string('a', 64),
            ["RuntimeManifestHash"] = new string('b', 64),
            ["PublishStatus"] = "Published",
            ["RuntimeVerified"] = true,
            ["AssetCount"] = 2,
            ["TotalSize"] = 321
        };
        var version = new JObject
        {
            ["Status"] = "Published",
            ["VersionNo"] = "v2.0.5",
            ["PublishPath"] = "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            ["FileCount"] = 2,
            ["TotalSize"] = 321,
            ["BuildLog"] = buildLog.ToString(Newtonsoft.Json.Formatting.None)
        };

        Assert.Null(V8McpLogic.ValidatePublishedApplicationStreamReplay(
            version,
            "v2.0.5",
            "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            "publish-request-01",
            "delivery-batch-01",
            new string('a', 64),
            new string('b', 64),
            2,
            321));

        Assert.Contains(
            "RequestId 不一致",
            V8McpLogic.ValidatePublishedApplicationStreamReplay(
                version,
                "v2.0.5",
                "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
                "publish-request-02",
                "delivery-batch-01",
                new string('a', 64),
                new string('b', 64),
                2,
                321));
        Assert.Contains(
            "DeliveryBatchId 不一致",
            V8McpLogic.ValidatePublishedApplicationStreamReplay(
                version,
                "v2.0.5",
                "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
                "publish-request-01",
                "delivery-batch-02",
                new string('a', 64),
                new string('b', 64),
                2,
                321));

        buildLog["HasExpectedCurrentVersion"] = true;
        buildLog["ExpectedCurrentVersion"] = 7;
        buildLog["HasExpectedAppVersion"] = true;
        buildLog["ExpectedAppVersion"] = "v2.0.4";
        version["BuildLog"] = buildLog.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Null(V8McpLogic.ValidatePublishedApplicationStreamReplay(
            version,
            "v2.0.5",
            "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            "publish-request-01",
            "delivery-batch-01",
            new string('a', 64),
            new string('b', 64),
            2,
            321,
            7,
            true,
            "v2.0.4"));
        Assert.Contains("ExpectedCurrentVersion 不一致", V8McpLogic.ValidatePublishedApplicationStreamReplay(
            version,
            "v2.0.5",
            "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            "publish-request-01",
            "delivery-batch-01",
            new string('a', 64),
            new string('b', 64),
            2,
            321,
            8,
            true,
            "v2.0.4"));
    }

    [Fact]
    public void PublishedReplay_AcceptsLegacyBuildLogWithoutRequestIdWhenBatchAndContentMatch()
    {
        var buildLog = new JObject
        {
            ["Mode"] = "StreamedAssets",
            ["DeliveryBatchId"] = "delivery-batch-01",
            ["SourceManifestHash"] = "",
            ["RuntimeManifestHash"] = new string('b', 64),
            ["PublishStatus"] = "Published",
            ["RuntimeVerified"] = true,
            ["AssetCount"] = 1,
            ["TotalSize"] = 100
        };
        var version = new JObject
        {
            ["Status"] = "Published",
            ["VersionNo"] = "v1.0.4",
            ["PublishPath"] = "itdos/ai-app-publish/app/versions/v1.0.4/index.html",
            ["FileCount"] = 1,
            ["TotalSize"] = 100,
            ["BuildLog"] = buildLog.ToString(Newtonsoft.Json.Formatting.None)
        };

        Assert.Null(V8McpLogic.ValidatePublishedApplicationStreamReplay(
            version,
            "v1.0.4",
            "itdos/ai-app-publish/app/versions/v1.0.4/index.html",
            "publish-request-01",
            "delivery-batch-01",
            "",
            new string('b', 64),
            1,
            100));
    }

    [Fact]
    public void ExistingVerifiedVersion_RejectsImmutableManifestConflictBeforeUpsert()
    {
        var buildLog = new JObject
        {
            ["Mode"] = "StreamedAssets",
            ["RequestId"] = "publish-request-01",
            ["DeliveryBatchId"] = "delivery-batch-01",
            ["SourceManifestHash"] = new string('a', 64),
            ["RuntimeManifestHash"] = new string('b', 64),
            ["PublishStatus"] = "Verified",
            ["RuntimeVerified"] = true,
            ["AssetCount"] = 1,
            ["TotalSize"] = 100
        };
        var version = new JObject
        {
            ["Status"] = "Verified",
            ["VersionNo"] = "v2.0.5",
            ["PublishPath"] = "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            ["FileCount"] = 1,
            ["TotalSize"] = 100,
            ["BuildLog"] = buildLog.ToString(Newtonsoft.Json.Formatting.None)
        };

        Assert.Null(V8McpLogic.ValidateApplicationStreamVersionMetadata(
            version,
            "v2.0.5",
            "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            "publish-request-01",
            "delivery-batch-01",
            new string('a', 64),
            new string('b', 64),
            1,
            100));
        Assert.Contains(
            "RuntimeManifestHash 不一致",
            V8McpLogic.ValidateApplicationStreamVersionMetadata(
                version,
                "v2.0.5",
                "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
                "publish-request-01",
                "delivery-batch-01",
                new string('a', 64),
                new string('c', 64),
                1,
                100));
        Assert.Contains(
            "TotalSize 不一致",
            V8McpLogic.ValidateApplicationStreamVersionMetadata(
                version,
                "v2.0.5",
                "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
                "publish-request-01",
                "delivery-batch-01",
                new string('a', 64),
                new string('b', 64),
                1,
                101));
    }

    [Fact]
    public void PublishedApplicationMetadata_AllowsMissingLegacyAppVersionButRejectsConflict()
    {
        var app = new JObject
        {
            ["Status"] = "Published",
            ["PublicPublishPath"] = "itdos/ai-app-publish/app/index.html",
            ["LastBuildTaskId"] = "delivery-batch-01"
        };
        Assert.Null(V8McpLogic.ValidatePublishedApplicationMetadataReplay(
            app,
            "v2.0.5",
            "itdos/ai-app-publish/app/index.html",
            "delivery-batch-01"));

        app["AppVersion"] = "v2.0.4";
        Assert.Contains(
            "AppVersion",
            V8McpLogic.ValidatePublishedApplicationMetadataReplay(
                app,
                "v2.0.5",
                "itdos/ai-app-publish/app/index.html",
                "delivery-batch-01"));
    }

    [Fact]
    public void ExpectedPublishState_IsOptionalAndCanonicalizesNullOrEmptyAppVersion()
    {
        var app = new JObject
        {
            ["CurrentVersion"] = 7,
            ["AppVersion"] = JValue.CreateNull()
        };

        Assert.Null(V8McpLogic.ValidateApplicationStreamExpectedState(
            app,
            new JObject(),
            out var omittedCurrentVersion,
            out var omittedAppVersionSupplied,
            out var omittedAppVersion));
        Assert.Null(omittedCurrentVersion);
        Assert.False(omittedAppVersionSupplied);
        Assert.Null(omittedAppVersion);

        Assert.Null(V8McpLogic.ValidateApplicationStreamExpectedState(
            app,
            new JObject
            {
                ["ExpectedCurrentVersion"] = 7,
                ["ExpectedAppVersion"] = JValue.CreateNull()
            },
            out var expectedCurrentVersion,
            out var expectedAppVersionSupplied,
            out var expectedAppVersion));
        Assert.Equal(7, expectedCurrentVersion);
        Assert.True(expectedAppVersionSupplied);
        Assert.Equal(string.Empty, expectedAppVersion);

        app["AppVersion"] = string.Empty;
        Assert.Null(V8McpLogic.ValidateApplicationStreamExpectedState(
            app,
            new JObject { ["ExpectedAppVersion"] = string.Empty },
            out _,
            out expectedAppVersionSupplied,
            out expectedAppVersion));
        Assert.True(expectedAppVersionSupplied);
        Assert.Equal(string.Empty, expectedAppVersion);
    }

    [Fact]
    public void ExpectedPublishState_FailsClosedOnMalformedOrChangedBaseline()
    {
        var app = new JObject
        {
            ["CurrentVersion"] = 7,
            ["AppVersion"] = "v2.0.4"
        };

        Assert.Contains("必须是非负 int", V8McpLogic.ValidateApplicationStreamExpectedState(
            app,
            new JObject { ["ExpectedCurrentVersion"] = "7" },
            out _,
            out _,
            out _));
        Assert.Contains("ExpectedCurrentVersion 不一致", V8McpLogic.ValidateApplicationStreamExpectedState(
            app,
            new JObject { ["ExpectedCurrentVersion"] = 8 },
            out _,
            out _,
            out _));
        Assert.Contains("ExpectedAppVersion 不一致", V8McpLogic.ValidateApplicationStreamExpectedState(
            app,
            new JObject { ["ExpectedAppVersion"] = "v2.0.3" },
            out _,
            out _,
            out _));
        Assert.Contains("必须是字符串或 null", V8McpLogic.ValidateApplicationStreamExpectedState(
            app,
            new JObject { ["ExpectedAppVersion"] = 204 },
            out _,
            out _,
            out _));
    }

    [Fact]
    public void ExpectedPublishState_ParsesCompleteFingerprintBeforeReportingLiveMismatch()
    {
        var error = V8McpLogic.ValidateApplicationStreamExpectedState(
            new JObject
            {
                ["CurrentVersion"] = 8,
                ["AppVersion"] = "v2.0.5"
            },
            new JObject
            {
                ["ExpectedCurrentVersion"] = 7,
                ["ExpectedAppVersion"] = "v2.0.4"
            },
            out var expectedCurrentVersion,
            out var expectedAppVersionSupplied,
            out var expectedAppVersion);

        Assert.Contains("ExpectedCurrentVersion 不一致", error);
        Assert.Equal(7, expectedCurrentVersion);
        Assert.True(expectedAppVersionSupplied);
        Assert.Equal("v2.0.4", expectedAppVersion);

        Assert.Contains("必须是字符串或 null", V8McpLogic.ValidateApplicationStreamExpectedState(
            new JObject
            {
                ["CurrentVersion"] = 8,
                ["AppVersion"] = "v2.0.5"
            },
            new JObject
            {
                ["ExpectedCurrentVersion"] = 7,
                ["ExpectedAppVersion"] = 204
            },
            out _,
            out _,
            out _));
    }

    [Fact]
    public void ConsumedBaselineReplay_AllowsOnlyExactPublishedOrVerifiedRecoveryRequest()
    {
        const string versionNo = "v2.0.5";
        const string versionPath = "itdos/ai-app-publish/app/versions/v2.0.5/index.html";
        const string applicationPath = "itdos/ai-app-publish/app/index.html";
        const string requestId = "publish-request-01";
        const string deliveryBatchId = "delivery-batch-01";
        var sourceManifestHash = new string('a', 64);
        var runtimeManifestHash = new string('b', 64);
        const int fileCount = 2;
        const long totalSize = 4096;

        JObject BuildVersion(string status, int expectedBaselineVersion = 7)
        {
            var published = string.Equals(status, "Published", StringComparison.Ordinal);
            return new JObject
            {
                ["VersionNo"] = versionNo,
                ["PublishPath"] = versionPath,
                ["FileCount"] = fileCount,
                ["TotalSize"] = totalSize,
                ["Status"] = status,
                ["BuildLog"] = new JObject
                {
                    ["Mode"] = "StreamedAssets",
                    ["RequestId"] = requestId,
                    ["DeliveryBatchId"] = deliveryBatchId,
                    ["SourceManifestHash"] = sourceManifestHash,
                    ["RuntimeManifestHash"] = runtimeManifestHash,
                    ["PublishStatus"] = status,
                    ["AliasStatus"] = published ? "Published" : "Pending",
                    ["StableAliasesVerified"] = published,
                    ["RuntimeVerified"] = true,
                    ["AssetCount"] = fileCount,
                    ["TotalSize"] = totalSize,
                    ["HasExpectedCurrentVersion"] = true,
                    ["ExpectedCurrentVersion"] = expectedBaselineVersion,
                    ["HasExpectedAppVersion"] = true,
                    ["ExpectedAppVersion"] = "v2.0.4"
                }.ToString(Newtonsoft.Json.Formatting.None)
            };
        }

        var targetApp = new JObject
        {
            ["CurrentVersion"] = 8,
            ["AppVersion"] = versionNo,
            ["Status"] = "Published",
            ["PublicPublishPath"] = applicationPath,
            ["LastBuildTaskId"] = deliveryBatchId
        };
        Assert.Contains("ExpectedCurrentVersion 不一致", V8McpLogic.ValidateApplicationStreamExpectedValues(
            targetApp,
            7,
            true,
            "v2.0.4"));

        foreach (var status in new[] { "Published", "Verified" })
        {
            // The application CAS advances the exact request baseline once:
            // ExpectedCurrentVersion 7 must converge to CurrentVersion 8.
            Assert.Null(V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
                targetApp,
                BuildVersion(status),
                versionNo,
                versionPath,
                applicationPath,
                requestId,
                deliveryBatchId,
                sourceManifestHash,
                runtimeManifestHash,
                fileCount,
                totalSize,
                7,
                true,
                "v2.0.4"));
        }

        foreach (var driftedCurrentVersion in new[] { 9, 99 })
        {
            var driftedCounterApp = (JObject)targetApp.DeepClone();
            driftedCounterApp["CurrentVersion"] = driftedCurrentVersion;
            Assert.Contains("CurrentVersion 不一致", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
                driftedCounterApp,
                BuildVersion("Published"),
                versionNo,
                versionPath,
                applicationPath,
                requestId,
                deliveryBatchId,
                sourceManifestHash,
                runtimeManifestHash,
                fileCount,
                totalSize,
                7,
                true,
                "v2.0.4"));
        }

        var overflowApp = (JObject)targetApp.DeepClone();
        overflowApp["CurrentVersion"] = int.MaxValue;
        Assert.Contains("+ 1 溢出", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            overflowApp,
            BuildVersion("Published", int.MaxValue),
            versionNo,
            versionPath,
            applicationPath,
            requestId,
            deliveryBatchId,
            sourceManifestHash,
            runtimeManifestHash,
            fileCount,
            totalSize,
            int.MaxValue,
            true,
            "v2.0.4"));

        Assert.Contains("版本状态不是 Verified 或 Published", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            targetApp,
            BuildVersion("Pending"),
            versionNo,
            versionPath,
            applicationPath,
            requestId,
            deliveryBatchId,
            sourceManifestHash,
            runtimeManifestHash,
            fileCount,
            totalSize,
            7,
            true,
            "v2.0.4"));

        var publishedVersion = BuildVersion("Published");
        Assert.Contains("RequestId", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            targetApp, publishedVersion, versionNo, versionPath, applicationPath,
            "publish-request-02", deliveryBatchId, sourceManifestHash, runtimeManifestHash,
            fileCount, totalSize, 7, true, "v2.0.4"));
        Assert.Contains("DeliveryBatchId", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            targetApp, publishedVersion, versionNo, versionPath, applicationPath,
            requestId, "delivery-batch-02", sourceManifestHash, runtimeManifestHash,
            fileCount, totalSize, 7, true, "v2.0.4"));
        Assert.Contains("ExpectedCurrentVersion", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            targetApp, publishedVersion, versionNo, versionPath, applicationPath,
            requestId, deliveryBatchId, sourceManifestHash, runtimeManifestHash,
            fileCount, totalSize, 6, true, "v2.0.4"));

        var missingRequestVersion = BuildVersion("Published");
        var missingRequestBuildLog = JObject.Parse(missingRequestVersion.Value<string>("BuildLog"));
        missingRequestBuildLog.Remove("RequestId");
        missingRequestVersion["BuildLog"] = missingRequestBuildLog.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Contains("RequestId 缺失", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            targetApp, missingRequestVersion, versionNo, versionPath, applicationPath,
            requestId, deliveryBatchId, sourceManifestHash, runtimeManifestHash,
            fileCount, totalSize, 7, true, "v2.0.4"));

        var missingFingerprintVersion = BuildVersion("Published");
        var missingFingerprintBuildLog = JObject.Parse(missingFingerprintVersion.Value<string>("BuildLog"));
        missingFingerprintBuildLog.Remove("HasExpectedCurrentVersion");
        missingFingerprintBuildLog.Remove("ExpectedCurrentVersion");
        missingFingerprintBuildLog.Remove("HasExpectedAppVersion");
        missingFingerprintBuildLog.Remove("ExpectedAppVersion");
        missingFingerprintVersion["BuildLog"] = missingFingerprintBuildLog.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Contains("缺少完整 ExpectedState 指纹", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            targetApp, missingFingerprintVersion, versionNo, versionPath, applicationPath,
            requestId, deliveryBatchId, sourceManifestHash, runtimeManifestHash,
            fileCount, totalSize, 7, true, "v2.0.4"));

        var driftedApp = (JObject)targetApp.DeepClone();
        driftedApp["LastBuildTaskId"] = "delivery-batch-other";
        Assert.Contains("尚未处于", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            driftedApp, publishedVersion, versionNo, versionPath, applicationPath,
            requestId, deliveryBatchId, sourceManifestHash, runtimeManifestHash,
            fileCount, totalSize, 7, true, "v2.0.4"));
        Assert.Contains("版本元数据不存在", V8McpLogic.ValidateApplicationStreamConsumedBaselineReplay(
            targetApp, null, versionNo, versionPath, applicationPath,
            requestId, deliveryBatchId, sourceManifestHash, runtimeManifestHash,
            fileCount, totalSize, 7, true, "v2.0.4"));
    }

    [Fact]
    public void ExpectedPublishFingerprint_RejectsReplayWithDifferentBaseline()
    {
        var version = new JObject
        {
            ["BuildLog"] = new JObject
            {
                ["HasExpectedCurrentVersion"] = true,
                ["ExpectedCurrentVersion"] = 7,
                ["HasExpectedAppVersion"] = true,
                ["ExpectedAppVersion"] = string.Empty
            }.ToString(Newtonsoft.Json.Formatting.None)
        };

        Assert.Null(V8McpLogic.ValidateApplicationStreamExpectedFingerprint(
            version,
            7,
            true,
            null));
        Assert.Contains("ExpectedCurrentVersion 不一致", V8McpLogic.ValidateApplicationStreamExpectedFingerprint(
            version,
            8,
            true,
            string.Empty));
        Assert.Contains("ExpectedAppVersion 不一致", V8McpLogic.ValidateApplicationStreamExpectedFingerprint(
            version,
            7,
            true,
            "v2.0.4"));
        Assert.Contains("ExpectedAppVersion 提供状态不一致", V8McpLogic.ValidateApplicationStreamExpectedFingerprint(
            version,
            7,
            false,
            null));

        version["BuildLog"] = "{}";
        Assert.Null(V8McpLogic.ValidateApplicationStreamExpectedFingerprint(
            version,
            null,
            false,
            null));
        // Rolling-upgrade rows predate persisted baseline fields. New finalize
        // calls still require both live baselines; the app-state gate + terminal
        // CAS fence them while the legacy immutable version can be replayed.
        Assert.Null(V8McpLogic.ValidateApplicationStreamExpectedFingerprint(
            version,
            7,
            true,
            "v2.0.4"));
    }

    [Fact]
    public void AppliedPublishBatch_DistinguishesVerifiedRetryBeforeAndAfterApplicationUpdate()
    {
        var app = new JObject
        {
            ["CurrentVersion"] = 8,
            ["Status"] = "Published",
            ["AppVersion"] = "v2.0.5",
            ["PublicPublishPath"] = "itdos/ai-app-publish/app/index.html",
            ["LastBuildTaskId"] = "delivery-batch-01"
        };
        Assert.True(V8McpLogic.IsApplicationStreamPublishApplied(
            app,
            "v2.0.5",
            "itdos/ai-app-publish/app/index.html",
            "delivery-batch-01"));
        Assert.True(V8McpLogic.IsApplicationStreamPublishApplied(
            app,
            "v2.0.5",
            "itdos/ai-app-publish/app/index.html",
            "delivery-batch-01",
            7));

        app["CurrentVersion"] = 9;
        Assert.False(V8McpLogic.IsApplicationStreamPublishApplied(
            app,
            "v2.0.5",
            "itdos/ai-app-publish/app/index.html",
            "delivery-batch-01",
            7));
        app["CurrentVersion"] = int.MaxValue;
        Assert.False(V8McpLogic.IsApplicationStreamPublishApplied(
            app,
            "v2.0.5",
            "itdos/ai-app-publish/app/index.html",
            "delivery-batch-01",
            int.MaxValue));

        app["CurrentVersion"] = 8;
        app["LastBuildTaskId"] = "delivery-batch-previous";
        Assert.False(V8McpLogic.IsApplicationStreamPublishApplied(
            app,
            "v2.0.5",
            "itdos/ai-app-publish/app/index.html",
            "delivery-batch-01"));
    }

    [Fact]
    public void PublishedApplicationUpdate_WritesBusinessAppVersionAndStableRequestFacts()
    {
        var buildUpdate = typeof(V8McpLogic).GetMethod(
            "BuildStreamPublishedApplicationUpdate",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(buildUpdate);
        var update = Assert.IsType<JObject>(buildUpdate.Invoke(null, new object[]
        {
            new JObject { ["Id"] = "app-id", ["CurrentVersion"] = 7 },
            "app-key",
            "v2.0.5",
            "https://files/app/index.html",
            "itdos/ai-app-publish/app/index.html",
            "publish-request-01",
            "delivery-batch-01",
            12,
            new string('b', 64),
            false
        }));

        Assert.Equal("v2.0.5", update["AppVersion"]?.Value<string>());
        Assert.Equal(8, update["CurrentVersion"]?.Value<int>());
        Assert.Equal("delivery-batch-01", update["LastBuildTaskId"]?.Value<string>());
        Assert.Contains("publish-request-01", update["LastBuildMsg"]?.Value<string>());

        var retryUpdate = Assert.IsType<JObject>(buildUpdate.Invoke(null, new object[]
        {
            new JObject { ["Id"] = "app-id", ["CurrentVersion"] = 8 },
            "app-key",
            "v2.0.5",
            "https://files/app/index.html",
            "itdos/ai-app-publish/app/index.html",
            "publish-request-01",
            "delivery-batch-01",
            12,
            new string('b', 64),
            true
        }));
        Assert.Equal(8, retryUpdate["CurrentVersion"]?.Value<int>());
    }

    [Fact]
    public void StreamPublishLimits_BoundEachByteArrayAndTheWholeManifest()
    {
        Assert.Equal(128L * 1024 * 1024, V8McpLogic.ApplicationAssetStreamMaxFileBytes);
        Assert.Equal(1L * 1024 * 1024 * 1024, V8McpLogic.ApplicationAssetStreamMaxTotalBytes);
        Assert.True(V8McpLogic.ApplicationAssetStreamMaxTotalBytes
                    > V8McpLogic.ApplicationAssetStreamMaxFileBytes);
        Assert.Equal(8, V8McpLogic.ApplicationAssetStreamIoConcurrency);
        Assert.Equal(128L * 1024 * 1024, V8McpLogic.ApplicationAssetStreamReadBudgetBytes);
        Assert.Equal(1L * 1024 * 1024, V8McpLogic.GetApplicationAssetReadBudgetReservationBytes(0));
        Assert.Equal(1L * 1024 * 1024, V8McpLogic.GetApplicationAssetReadBudgetReservationBytes(1));
        Assert.Equal(2L * 1024 * 1024, V8McpLogic.GetApplicationAssetReadBudgetReservationBytes(
            1L * 1024 * 1024 + 1));
        Assert.Equal(
            V8McpLogic.ApplicationAssetStreamReadBudgetBytes,
            V8McpLogic.GetApplicationAssetReadBudgetReservationBytes(
                V8McpLogic.ApplicationAssetStreamMaxFileBytes));
        Assert.Equal(
            V8McpLogic.ApplicationAssetStreamReadBudgetBytes,
            V8McpLogic.GetApplicationAssetReadBudgetReservationBytes(long.MaxValue));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            V8McpLogic.GetApplicationAssetReadBudgetReservationBytes(-1));
    }

    [Fact]
    public async Task ByteWeightedStorageBudget_IsSharedAcrossRequestsAndSerializesMaxFiles()
    {
        var firstEntered = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseFirst = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondEntered = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var maxFileBytes = V8McpLogic.ApplicationAssetStreamMaxFileBytes;

        var first = V8McpLogic.RunApplicationAssetBoundedParallelAsync(
            new[] { maxFileBytes },
            async (_, _) =>
            {
                firstEntered.TrySetResult(true);
                await releaseFirst.Task;
                return (string)null!;
            },
            cancellationToken: TestContext.Current.CancellationToken,
            maxDegreeOfParallelism: 8,
            declaredByteSize: size => size);
        await firstEntered.Task;

        var second = V8McpLogic.RunApplicationAssetBoundedParallelAsync(
            new[] { maxFileBytes },
            (_, _) =>
            {
                secondEntered.TrySetResult(true);
                return Task.FromResult((string)null!);
            },
            cancellationToken: TestContext.Current.CancellationToken,
            maxDegreeOfParallelism: 8,
            declaredByteSize: size => size);

        bool secondEnteredBeforeRelease;
        try
        {
            var firstCompletion = await Task.WhenAny(
                secondEntered.Task,
                Task.Delay(100, TestContext.Current.CancellationToken));
            secondEnteredBeforeRelease = ReferenceEquals(firstCompletion, secondEntered.Task);
        }
        finally
        {
            releaseFirst.TrySetResult(true);
            await Task.WhenAll(first, second);
        }

        Assert.False(secondEnteredBeforeRelease);
        Assert.True(secondEntered.Task.IsCompletedSuccessfully);
        Assert.Null(await first);
        Assert.Null(await second);
    }

    [Fact]
    public async Task BoundedStorageWorkers_ClampRequestedConcurrencyToTheHardCap()
    {
        var active = 0;
        var peak = 0;
        var items = Enumerable.Range(0, 64).ToArray();

        var error = await V8McpLogic.RunApplicationAssetBoundedParallelAsync(
            items,
            async (_, cancellationToken) =>
            {
                var current = Interlocked.Increment(ref active);
                while (true)
                {
                    var observed = Volatile.Read(ref peak);
                    if (current <= observed
                        || Interlocked.CompareExchange(ref peak, current, observed) == observed)
                    {
                        break;
                    }
                }
                try
                {
                    await Task.Delay(20, cancellationToken);
                    return (string)null!;
                }
                finally
                {
                    Interlocked.Decrement(ref active);
                }
            },
            cancellationToken: TestContext.Current.CancellationToken,
            maxDegreeOfParallelism: 64);

        Assert.Null(error);
        Assert.InRange(peak, 2, V8McpLogic.ApplicationAssetStreamIoConcurrency);
    }

    [Fact]
    public async Task BoundedStorageWorkers_StopClaimingWorkAfterTheFirstFailure()
    {
        var started = 0;
        var items = Enumerable.Range(0, 100).ToArray();

        var error = await V8McpLogic.RunApplicationAssetBoundedParallelAsync(
            items,
            async (item, cancellationToken) =>
            {
                Interlocked.Increment(ref started);
                if (item == 0)
                {
                    await Task.Delay(30, cancellationToken);
                    return "first-storage-failure";
                }
                await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
                return (string)null!;
            },
            cancellationToken: TestContext.Current.CancellationToken,
            maxDegreeOfParallelism: 4);

        Assert.Equal("first-storage-failure", error);
        Assert.InRange(Volatile.Read(ref started), 1, 4);
    }

    [Fact]
    public void ImmutableRuntimeMarker_ControlsEntryFirstPromotionWithoutChangingLegacyOrder()
    {
        var markedEntry = Encoding.UTF8.GetBytes(
            "<html DATA-MICROI-IMMUTABLE-RUNTIME=\"v2\"><head></head><body></body></html>");
        var legacyEntry = Encoding.UTF8.GetBytes(
            "<html><head></head><body></body></html>");

        Assert.True(V8McpLogic.HasApplicationImmutableRuntimeMarker(markedEntry));
        Assert.False(V8McpLogic.HasApplicationImmutableRuntimeMarker(legacyEntry));
        Assert.True(
            V8McpLogic.GetApplicationAssetPromotionPriority(true, true)
            < V8McpLogic.GetApplicationAssetPromotionPriority(true, false));
        Assert.True(
            V8McpLogic.GetApplicationAssetPromotionPriority(false, true)
            > V8McpLogic.GetApplicationAssetPromotionPriority(false, false));
    }

    [Fact]
    public void FencingToken_IsValidatedButNotPartOfImmutableReplayFingerprint()
    {
        var buildLog = new JObject
        {
            ["Mode"] = "StreamedAssets",
            ["RequestId"] = "publish-request-01",
            ["DeliveryBatchId"] = "delivery-batch-01",
            ["FencingToken"] = 11,
            ["SourceManifestHash"] = new string('a', 64),
            ["RuntimeManifestHash"] = new string('b', 64),
            ["PublishStatus"] = "Published",
            ["RuntimeVerified"] = true,
            ["AssetCount"] = 1,
            ["TotalSize"] = 100
        };
        var version = new JObject
        {
            ["Status"] = "Published",
            ["VersionNo"] = "v2.0.5",
            ["PublishPath"] = "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            ["FileCount"] = 1,
            ["TotalSize"] = 100,
            ["BuildLog"] = buildLog.ToString(Newtonsoft.Json.Formatting.None)
        };

        Assert.Null(V8McpLogic.ValidatePublishedApplicationStreamReplay(
            version,
            "v2.0.5",
            "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            "publish-request-01",
            "delivery-batch-01",
            new string('a', 64),
            new string('b', 64),
            1,
            100));

        buildLog["FencingToken"] = 12;
        version["BuildLog"] = buildLog.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Null(V8McpLogic.ValidatePublishedApplicationStreamReplay(
            version,
            "v2.0.5",
            "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
            "publish-request-01",
            "delivery-batch-01",
            new string('a', 64),
            new string('b', 64),
            1,
            100));

        buildLog["FencingToken"] = 0;
        version["BuildLog"] = buildLog.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Contains(
            "FencingToken",
            V8McpLogic.ValidatePublishedApplicationStreamReplay(
                version,
                "v2.0.5",
                "itdos/ai-app-publish/app/versions/v2.0.5/index.html",
                "publish-request-01",
                "delivery-batch-01",
                new string('a', 64),
                new string('b', 64),
                1,
                100));
    }

    [Fact]
    public void RenewableLock_PureConfigurationAndOwnerParsingAreFailClosed()
    {
        Assert.Contains(
            "Expiry",
            MicroiLock.ValidateLeaseConfiguration(new MicroiLockParam()));
        Assert.Contains(
            "MaxLeaseDuration",
            MicroiLock.ValidateLeaseConfiguration(new MicroiLockParam
            {
                Expiry = TimeSpan.FromMinutes(1),
                AutoRenew = true
            }));
        Assert.Contains(
            "不能小于",
            MicroiLock.ValidateLeaseConfiguration(new MicroiLockParam
            {
                Expiry = TimeSpan.FromMinutes(2),
                AutoRenew = true,
                MaxLeaseDuration = TimeSpan.FromMinutes(1)
            }));
        Assert.Null(MicroiLock.ValidateLeaseConfiguration(new MicroiLockParam
        {
            Expiry = TimeSpan.FromMinutes(1),
            AutoRenew = true,
            MaxLeaseDuration = TimeSpan.FromHours(1)
        }));
        Assert.Equal(
            TimeSpan.FromMinutes(5),
            MicroiLock.ResolveAcquireTimeout(new MicroiLockParam
            {
                Expiry = TimeSpan.FromMinutes(5)
            }));
        Assert.Equal(
            TimeSpan.FromMinutes(1),
            MicroiLock.ResolveAcquireTimeout(new MicroiLockParam
            {
                Expiry = TimeSpan.FromMinutes(5),
                AcquireTimeout = TimeSpan.FromMinutes(1)
            }));
        Assert.Equal(1000, MicroiLock.CalculateLeaseRenewIntervalMilliseconds(TimeSpan.FromSeconds(3)));
        Assert.Equal(30000, MicroiLock.CalculateLeaseRenewIntervalMilliseconds(TimeSpan.FromHours(2)));
        Assert.True(MicroiLock.TryParseFencingToken("42:01KOWNER", out var fencingToken));
        Assert.Equal(42, fencingToken);
        Assert.False(MicroiLock.TryParseFencingToken("0:owner", out _));
        Assert.False(MicroiLock.TryParseFencingToken("owner-only", out _));
    }

    [Fact]
    public void RenewableLockAndPublisher_SourceKeepAtomicLeaseAndSideEffectGuards()
    {
        var serverRoot = FindServerRoot();
        var lockSource = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net",
            "Common",
            "DiyLock.cs"));
        Assert.Contains("StringSetAsync(", lockSource);
        Assert.Contains("When.NotExists", lockSource);
        Assert.Contains("StringIncrementAsync(", lockSource);
        Assert.Contains("redis.call('psetex'", lockSource);
        Assert.Contains("redis.call('pexpire'", lockSource);
        Assert.Contains("redis.call('del'", lockSource);
        Assert.Contains("Task.Delay(waitTime, param.CancellationToken)", lockSource);
        Assert.DoesNotContain("await cache.GetAsync(key)", lockSource);
        Assert.DoesNotContain("await cache.RemoveAsync(key)", lockSource);

        var publisherSource = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "V8Engine",
            "V8McpLogic.ApplicationAssetStream.cs"));
        var runtimeSource = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "V8Engine",
            "V8McpLogic.ApplicationAssetStreamV3.Runtime.cs"));
        Assert.Equal(2, CountOccurrences(publisherSource, "}, async lease =>"));
        Assert.Contains("ExecuteApplicationAssetSideEffect(", publisherSource);
        Assert.Contains("FencingToken = fencingToken", publisherSource);
        Assert.Contains("GetApplicationAssetPromotionPriority(", publisherSource);
        Assert.Contains("DefaultStreamPublishIoConcurrency = 8", publisherSource);
        Assert.Contains("MaxStreamPublishIoConcurrency = 8", publisherSource);
        Assert.Contains("MaxStreamPublishReadInFlightBytes = MaxStreamPublishFileBytes", publisherSource);
        Assert.Contains("ApplicationAssetReadBudgetAllocation", publisherSource);
        Assert.Contains("ApplicationAssetReadBudgetUnits", publisherSource);
        Assert.Contains("using var storedReadBudget = await AcquireApplicationAssetReadBudgetAsync(", publisherSource);
        Assert.Contains("checked(expectedCurrentVersion.Value + 1)", publisherSource);
        Assert.Equal(5, CountOccurrences(
            publisherSource,
            "RunApplicationAssetBoundedParallelAsync("));
        Assert.Equal(5, CountOccurrences(publisherSource, "declaredByteSize:"));
        Assert.Contains("Task.Run(WorkerLoop, CancellationToken.None)", publisherSource);
        Assert.Contains("ReadApplicationObjectBytes(", publisherSource);
        Assert.Contains("ReturnFileType = \"Byte\"", publisherSource);
        Assert.Contains("NetworkIsInternet = false", publisherSource);
        Assert.DoesNotContain("ReadPublishedMicroServiceAssetBytes(", publisherSource);
        Assert.Equal(2, CountOccurrences(
            publisherSource,
            "AcquireTimeout = TimeSpan.FromMinutes(1)"));
        Assert.Contains("Expiry = TimeSpan.FromMinutes(10)", publisherSource);
        Assert.Contains("Expiry = TimeSpan.FromMinutes(5)", publisherSource);
        Assert.DoesNotContain("20L * 1024 * 1024 * 1024", publisherSource);
        Assert.Contains("[\"HasExpectedCurrentVersion\"] = expectedCurrentVersion.HasValue", publisherSource);
        Assert.Contains("[\"HasExpectedAppVersion\"] = expectedAppVersionSupplied", publisherSource);
        Assert.Contains("ActiveStreamBuildStorageScope = \"PublicBuildStream\"", publisherSource);
        Assert.Contains("ArchivedStreamBuildStorageScope = \"PublicBuildStreamArchived\"", publisherSource);
        Assert.Contains("\"AND\", \"FilePath\", \"StartLike\", \"dist/\"", publisherSource);
        Assert.Contains("new[] { ActiveStreamBuildStorageScope, ArchivedStreamBuildStorageScope }", publisherSource);
        Assert.Contains("[\"StorageScope\"] = ActiveStreamBuildStorageScope", publisherSource);
        Assert.Contains("Key = $\"V8Mcp:ApplicationAsset:{TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant()}:{appId}", publisherSource);
        Assert.Contains("Key = BuildApplicationAssetPublishLockKey(osClient, appId)", publisherSource);
        Assert.Contains("ValidateApplicationStreamIdentity(lockedApp, appId, appKey)", publisherSource);
        Assert.Contains("ValidateApplicationStreamIdentity(app, expectedAppId, expectedAppKey)", publisherSource);
        Assert.Contains("ValidateApplicationStreamFinalizePreconditions(param)", publisherSource);
        Assert.Contains("var fileIdentityPreflight = await ReadApplicationStreamFileRows(", publisherSource);
        Assert.Contains("同一 AppId + VersionNo 存在重复版本记录", publisherSource);
        Assert.Contains("同一 MsKey 存在重复微服务运行记录", publisherSource);
        Assert.Contains("existingVersionIdError = ValidateApplicationStreamExistingRecordId(", publisherSource);
        Assert.Contains("existingServiceIdError = ValidateApplicationStreamExistingRecordId(", publisherSource);
        Assert.Contains("UptFormDataByWhereAsync(", publisherSource);
        Assert.Contains("result.DataCount != 1", publisherSource);
        Assert.Contains("[\"AliasStatus\"]", publisherSource);
        Assert.Contains("\"Pending\"", publisherSource);
        Assert.True(CountOccurrences(
            publisherSource,
            "ExpectedCurrentVersion = expectedCurrentVersion") >= 3);
        Assert.True(CountOccurrences(
            publisherSource,
            "ExpectedAppVersion = expectedAppVersionSupplied ? expectedAppVersion : null") >= 3);

        var finalizeCoreOffset = publisherSource.IndexOf(
            "private static async Task<DosResult<object>> FinalizeApplicationStreamPublishCore",
            StringComparison.Ordinal);
        var leasedApplicationReadOffset = publisherSource.IndexOf(
            "var app = await FindAiApplication(osClient, expectedAppId)",
            finalizeCoreOffset,
            StringComparison.Ordinal);
        var expectedStateGateOffset = publisherSource.IndexOf(
            "ParseApplicationStreamExpectedState(",
            leasedApplicationReadOffset,
            StringComparison.Ordinal);
        var existingVersionReadOffset = publisherSource.IndexOf(
            "var existingVersion = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(\"mci_ai_app_version\"",
            expectedStateGateOffset,
            StringComparison.Ordinal);
        var consumedBaselineReplayOffset = publisherSource.IndexOf(
            "ValidateApplicationStreamConsumedBaselineReplay(",
            existingVersionReadOffset,
            StringComparison.Ordinal);
        var replayOffset = publisherSource.IndexOf(
            "if (publishedReplay)",
            expectedStateGateOffset,
            StringComparison.Ordinal);
        var immutableValidationOffset = publisherSource.IndexOf(
            "var immutableVersionValidationError = await RunApplicationAssetBoundedParallelAsync(",
            expectedStateGateOffset,
            StringComparison.Ordinal);
        var promotionOffset = publisherSource.IndexOf(
            "var promotionGroups = stableAliasTargets",
            immutableValidationOffset,
            StringComparison.Ordinal);
        var fileMetadataSideEffectOffset = publisherSource.IndexOf(
            "var fileReconcileResult = await ReconcileStreamPublishedFiles(",
            replayOffset,
            StringComparison.Ordinal);
        var versionMetadataSideEffectOffset = publisherSource.IndexOf(
            "var versionResult = await UpsertStreamPublishVersion(",
            fileMetadataSideEffectOffset,
            StringComparison.Ordinal);
        var finalAliasVerificationOffset = publisherSource.IndexOf(
            "var finalAliasVerificationError = await RunApplicationAssetBoundedParallelAsync(",
            promotionOffset,
            StringComparison.Ordinal);
        Assert.True(finalizeCoreOffset >= 0);
        Assert.True(leasedApplicationReadOffset > finalizeCoreOffset);
        Assert.True(expectedStateGateOffset > leasedApplicationReadOffset);
        Assert.True(immutableValidationOffset > expectedStateGateOffset);
        Assert.True(existingVersionReadOffset > immutableValidationOffset);
        Assert.True(consumedBaselineReplayOffset > existingVersionReadOffset);
        Assert.True(replayOffset > consumedBaselineReplayOffset);
        Assert.True(fileMetadataSideEffectOffset > replayOffset);
        Assert.True(versionMetadataSideEffectOffset > fileMetadataSideEffectOffset);
        Assert.True(promotionOffset > versionMetadataSideEffectOffset);
        Assert.True(finalAliasVerificationOffset > promotionOffset);
        var committedAliasVerificationOffset = publisherSource.IndexOf(
            "var committedAliasVerificationError = await RunApplicationAssetBoundedParallelAsync(",
            finalAliasVerificationOffset,
            StringComparison.Ordinal);
        var terminalVersionOffset = publisherSource.IndexOf(
            "var publishVersionResult = await UpsertStreamPublishVersion(",
            finalAliasVerificationOffset,
            StringComparison.Ordinal);
        Assert.True(terminalVersionOffset > finalAliasVerificationOffset);
        Assert.True(committedAliasVerificationOffset > terminalVersionOffset);

        var reconcileDefinitionOffset = publisherSource.IndexOf(
            "private static async Task<DosResult> ReconcileStreamPublishedFiles(",
            StringComparison.Ordinal);
        var reconcileEndOffset = publisherSource.IndexOf(
            "public static async Task<DosResult<object>> UploadApplicationAssetStream(",
            reconcileDefinitionOffset,
            StringComparison.Ordinal);
        Assert.True(reconcileDefinitionOffset >= 0);
        Assert.True(reconcileEndOffset > reconcileDefinitionOffset);
        var reconcileSource = publisherSource.Substring(
            reconcileDefinitionOffset,
            reconcileEndOffset - reconcileDefinitionOffset);
        Assert.Contains("await UpsertStreamPublishedFile(", reconcileSource);
        Assert.Contains("BuildApplicationStreamArchiveUpdates(", reconcileSource);
        Assert.Contains("ExecuteApplicationAssetConditionalUpdate(", reconcileSource);
        Assert.Contains("new List<object> { \"AND\", \"AppId\", \"=\", archiveAppId }", reconcileSource);
        Assert.Contains("new List<object> { \"AND\", \"StorageScope\", \"=\", previousStorageScope }", reconcileSource);
        Assert.Contains("new List<object> { \"AND\", \"Version\", \"=\", previousVersion }", reconcileSource);
        Assert.Contains("archivedReadback", reconcileSource);
        Assert.Contains("已拒绝提交终态", reconcileSource);
        Assert.DoesNotContain("DelFormData", reconcileSource);
        Assert.DoesNotContain("DeleteObject", reconcileSource);

        var replayReconcileOffset = publisherSource.IndexOf(
            "var replayFileReconcileResult = await ReconcileStreamPublishedFiles(",
            replayOffset,
            StringComparison.Ordinal);
        var replaySuccessOffset = publisherSource.IndexOf(
            "相同 RequestId 与 DeliveryBatchId 的已发布版本及稳定入口均已严格校验",
            replayOffset,
            StringComparison.Ordinal);
        Assert.True(replayReconcileOffset > replayOffset);
        Assert.True(replaySuccessOffset > replayReconcileOffset);
        Assert.DoesNotContain("RestoreMicroServiceSnapshot(", publisherSource);
        Assert.DoesNotContain("RestoreMicroServicePageSnapshots(", publisherSource);

        var controllerSource = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Controllers",
            "V8EngineController.cs"));
        Assert.Contains("RequestSizeLimit(136314880L)", controllerSource);
        Assert.Contains("MultipartBodyLengthLimit = 136314880L", controllerSource);
        Assert.Contains("form[\"ContentEncoding\"]", controllerSource);
        Assert.Contains("new GZipStream(transportStream, CompressionMode.Decompress, true)", controllerSource);
        Assert.Contains("decodedLength > V8McpLogic.ApplicationAssetStreamMaxFileBytes", controllerSource);
        Assert.Contains("FileOptions.DeleteOnClose", controllerSource);
        Assert.Contains("stream.Length", controllerSource);
        Assert.Contains("NumberStyles.None", controllerSource);
        Assert.Contains("CultureInfo.InvariantCulture", controllerSource);
        Assert.Contains("out var expectedCurrentVersion", controllerSource);
        Assert.Contains("protocolParam[fieldName] = expectedCurrentVersion", controllerSource);
        Assert.Contains("RouteSnapshotJson = request.RouteSnapshotJson", runtimeSource);
        Assert.Equal(
            2,
            CountOccurrences(runtimeSource, "RouteSnapshotJson = plan.RouteSnapshotJson"));
        Assert.DoesNotContain(
            ".AddInParameter(\"@now\", DateTime.Now)",
            runtimeSource);
        Assert.DoesNotContain(
            ".AddInParameter(\"@now\", now)",
            runtimeSource);
        Assert.Equal(
            16,
            CountOccurrences(
                runtimeSource,
                ".AddInParameter(\"@now\", System.Data.DbType.DateTime,"));
    }

    [Fact]
    public void ComputeMicroServiceManifestHash_IsStableAcrossInputOrder()
    {
        var left = JArray.Parse("[{\"Path\":\"index.html\",\"Sha256\":\"aa\",\"Size\":2},{\"Path\":\"assets/app.js\",\"Sha256\":\"bb\",\"Size\":3}]");
        var right = new JArray(left.Reverse());

        Assert.Equal(
            V8McpLogic.ComputeMicroServiceManifestHash(left),
            V8McpLogic.ComputeMicroServiceManifestHash(right));
    }

    private static int CountOccurrences(string value, string pattern)
    {
        if (string.IsNullOrEmpty(value) || string.IsNullOrEmpty(pattern)) return 0;
        var count = 0;
        var offset = 0;
        while ((offset = value.IndexOf(pattern, offset, StringComparison.Ordinal)) >= 0)
        {
            count++;
            offset += pattern.Length;
        }
        return count;
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.net.Api"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Core")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi.Server 根目录。");
    }
}
