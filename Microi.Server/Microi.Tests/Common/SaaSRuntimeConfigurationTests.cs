using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

namespace Dos.Common.Tests;

[Collection(SaaSRuntimeConfigurationCollection.Name)]
public class SaaSRuntimeConfigurationTests
{
    [Fact]
    public void MainTenantRuntimeSettings_AreReadFromSaaSEngineModel()
    {
        SaaSRuntimeConfigurationScope.Run(
            new JObject
            {
                ["PressGlobalMax"] = 1234,
                ["SecurityGuardEnabled"] = 0,
                ["SsrfAllowedHosts"] = "api.example.com"
            },
            () =>
        {
            Assert.Equal(
                1234,
                ConfigHelper.GetRuntimeConfigurationInt(
                    "PressureGuard:GlobalMaxConcurrentRequests",
                    2000));
            Assert.False(
                ConfigHelper.GetRuntimeConfigurationBool(
                    "SecurityGuard:Enabled",
                    true));
            Assert.Equal(
                "api.example.com",
                ConfigHelper.GetRuntimeConfigurationValue(
                    "SsrfProtection:AllowedHosts"));
        });
    }

    [Fact]
    public void SaaSRuntimeFieldNames_FitFormEngineAndKeepLegacyReadFallbacks()
    {
        Assert.All(Upgrade23.RuntimeFieldNames, fieldName =>
            Assert.True(fieldName.Length <= 30, $"SaaS 字段名超过 FormEngine 30 字符上限：{fieldName}"));

        SaaSRuntimeConfigurationScope.Run(
            new JObject
            {
                ["StartupRouteMaxConcurrency"] = 7,
                ["DiyLangCacheMaxChars"] = 123456,
                ["OrmCommandTimeoutSec"] = 88
            },
            () =>
            {
                Assert.Equal(7, ConfigHelper.GetRuntimeConfigurationInt(
                    "StartupLimits:DynamicRouteInitMaxConcurrency", 2));
                Assert.Equal(123456, ConfigHelper.GetRuntimeConfigurationInt(
                    "DiyLang:RuntimeCacheMaxCharacters", 5000000));
                Assert.Equal(88, ConfigHelper.GetRuntimeConfigurationInt(
                    "OrmLimits:DefaultCommandTimeoutSeconds", 600));
            });

        SaaSRuntimeConfigurationScope.Run(
            new JObject { ["OrmDefaultCommandTimeoutSeconds"] = 77 },
            () => Assert.Equal(77, ConfigHelper.GetRuntimeConfigurationInt(
                "OrmLimits:DefaultCommandTimeoutSeconds", 600)));

        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "23-UpgradeSaaSRuntimeSettings.cs"));
        Assert.Contains("new RuntimeField(name, label, \"mediumtext\"", source);
        Assert.Contains("PromoteExistingMySqlTextColumns", source);
        Assert.DoesNotContain("new RuntimeField(name, label, \"varchar(2000)\"", source);
    }

    [Fact]
    public void BackendRuntimeSettings_AreReadFromSaaSEngineModel()
    {
        SaaSRuntimeConfigurationScope.Run(
            new JObject
            {
                ["BackendAutoUpgradeDisabled"] = 1,
                ["BackendFreeCadExecutablePath"] = "/opt/freecad/bin/freecadcmd",
                ["BackendForwardedKnownProxies"] = "10.0.0.2",
                ["BackendLoginRsaPublicKey"] = "public-key"
            },
            () =>
            {
                Assert.True(ConfigHelper.GetRuntimeConfigurationBool(
                    "MicroiUpgrade:Disabled", false));
                Assert.Equal("/opt/freecad/bin/freecadcmd",
                    ConfigHelper.GetRuntimeConfigurationValue("Cad:FreeCadExecutablePath"));
                Assert.Equal("10.0.0.2",
                    ConfigHelper.GetRuntimeConfigurationValue("ForwardedHeaders:KnownProxies"));
                Assert.Equal("public-key",
                    ConfigHelper.GetRuntimeConfigurationValue("Security:LoginRsaPublicKey"));
            });
    }

    [Fact]
    public void LicenseRuntimeSettings_AreNotMappedFromSaaSEngineModel()
    {
        SaaSRuntimeConfigurationScope.Run(
            new JObject
            {
                ["BackendLicenseRetryMax"] = 7,
                ["BackendLicenseRetrySec"] = 15,
                ["BackendLicensePrivateKeyPath"] = "/run/secrets/license.pem",
                ["BackendLicenseRestoreMaxAttempts"] = 8,
                ["BackendLicenseRestoreRetrySeconds"] = 16
            },
            () =>
            {
                Assert.Equal(3, ConfigHelper.GetRuntimeConfigurationInt(
                    "License:RestoreMaxAttempts", 3));
                Assert.Equal(10, ConfigHelper.GetRuntimeConfigurationInt(
                    "License:RestoreRetrySeconds", 10));
                Assert.Null(ConfigHelper.GetRuntimeConfigurationValue(
                    "License:PrivateKeyPath"));
            });
    }

    [Fact]
    public void InstallationConfig_DoesNotAdvertiseBusinessTuningEnvironmentVariables()
    {
        var root = FindRepositoryRoot();
        var appSettings = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.net.Api",
            "appsettings.json"));
        var dockerDocument = File.ReadAllText(Path.Combine(
            root,
            "microi.doc",
            "docs",
            "doc",
            "getting-started",
            "docker-run.md"));
        var installer = File.ReadAllText(Path.Combine(
            root,
            "数据库、案例、文档、资料",
            "install-microi.sh"));
        var officialChineseDocs = string.Join(
            Environment.NewLine,
            Directory.GetFiles(
                    Path.Combine(root, "microi.doc", "docs", "doc"),
                    "*.md",
                    SearchOption.AllDirectories)
                .Where(path => !path.EndsWith(
                    Path.Combine("about", "update-log.md"),
                    StringComparison.OrdinalIgnoreCase))
                .Select(File.ReadAllText));

        Assert.DoesNotContain("EnvironmentVariables", appSettings);
        Assert.DoesNotContain("DevLoginBypass", appSettings);
        Assert.DoesNotContain("LicenseSecurity", appSettings);
        Assert.DoesNotContain("ForwardedHeaders", appSettings);
        Assert.DoesNotContain("\"Security\"", appSettings);
        Assert.DoesNotContain("MICROI_HTTP_MAX_REQUEST_BODY_MB", appSettings);
        Assert.DoesNotContain("MICROI_FILE_UPLOAD_MAX_MULTIPART_MB", appSettings);
        Assert.DoesNotContain("MICROI_PRESSURE_", appSettings);
        Assert.DoesNotContain("DOS_ORM_", appSettings);
        Assert.DoesNotContain("MICROI_TRANSLATE_", dockerDocument);
        Assert.DoesNotContain("APP_TRANSLATE_ENV", installer);
        Assert.DoesNotContain("- MICROI_TRANSLATE_PROVIDER=", installer);
        Assert.DoesNotContain("MICROI_CORS_ALLOW_", officialChineseDocs);
        Assert.DoesNotContain("MICROI_SSRF_", officialChineseDocs);
        Assert.DoesNotContain("MICROI_SPIDER_", officialChineseDocs);
        Assert.DoesNotContain("MICROI_TRANSLATE_", officialChineseDocs);
        Assert.DoesNotContain("MICROI_EXTENSION_DATABASE_CACHE_SECONDS", officialChineseDocs);
        Assert.DoesNotContain("MICROI_PROCESS_MEMORY_", officialChineseDocs);
        Assert.DoesNotContain("MICROI_DIY_LANG_CACHE_", officialChineseDocs);
        Assert.DoesNotContain("MICROI_SYSLOG_QUEUE_", officialChineseDocs);
        Assert.DoesNotContain("MICROI_SYSLOG_OVERFLOW_CAPACITY", officialChineseDocs);
        Assert.DoesNotContain("MICROI_SYSLOG_BATCH_SIZE", officialChineseDocs);
    }

    [Fact]
    public void ApiRuntimeEnvironmentVariables_AreRestrictedToBootstrapAllowList()
    {
        var root = FindRepositoryRoot();
        var allowedBootstrap = new HashSet<string>(StringComparer.Ordinal)
        {
            "OsClient", "OsClientType", "OsClientNetwork", "OsClientDbType",
            "OsClientDbConn", "OsClientRedisHost", "OsClientRedisPort",
            "OsClientRedisPwd", "OsClientRedisDataBase", "OsClientDbMongoConn"
        };
        var allowedFramework = new HashSet<string>(StringComparer.Ordinal)
        {
            "ASPNETCORE_ENVIRONMENT", "ASPNETCORE_URLS", "DOTNET_ENVIRONMENT",
            "DOTNET_RUNNING_IN_CONTAINER"
        };
        var serverRoot = Path.Combine(root, "Microi.Server");
        var violations = new List<string>();
        foreach (var path in Directory.GetFiles(serverRoot, "*.cs", SearchOption.AllDirectories))
        {
            var segments = path.Substring(serverRoot.Length)
                .Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (segments.Any(segment =>
                    segment.Equals("bin", StringComparison.OrdinalIgnoreCase)
                    || segment.Equals("obj", StringComparison.OrdinalIgnoreCase)
                    || segment.Equals("docs", StringComparison.OrdinalIgnoreCase)
                    || segment.Equals("tools", StringComparison.OrdinalIgnoreCase)
                    || segment.Equals("Microi.Tests", StringComparison.OrdinalIgnoreCase)
                    || segment.EndsWith(".Tests", StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            var source = File.ReadAllText(path);
            source = Regex.Replace(source, @"/\*.*?\*/|//[^\r\n]*", "", RegexOptions.Singleline);
            if (Regex.IsMatch(source,
                    "(?:System\\.)?Environment\\.GetEnvironmentVariable\\s*\\((?>\\s*)(?!\")"))
            {
                violations.Add(Path.GetRelativePath(root, path) + ": dynamic key");
                continue;
            }

            foreach (Match match in Regex.Matches(source,
                         "(?:System\\.)?Environment\\.GetEnvironmentVariable\\s*\\(\\s*\"(?<key>[^\"]+)\""))
            {
                var key = match.Groups["key"].Value;
                if (!allowedBootstrap.Contains(key) && !allowedFramework.Contains(key))
                {
                    violations.Add(Path.GetRelativePath(root, path) + ": " + key);
                }
            }
        }

        Assert.True(violations.Count == 0,
            "生产后端源码发现未授权环境变量读取：" + string.Join("；", violations));
    }

    [Theory]
    [InlineData("数据库、案例、文档、资料/install-microi.sh")]
    [InlineData("数据库、案例、文档、资料/install-microi-offline.sh")]
    public void OfficialInstaller_ApiServiceEmitsOnlyBootstrapEnvironmentVariables(string relativePath)
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(root,
            relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var block = Regex.Match(source,
            @"microi-install-api:\s*[\s\S]*?\n\s+environment:\s*(?<environment>[\s\S]*?)\n\s+volumes:");
        Assert.True(block.Success, "未找到 microi-install-api.environment 编排块。");

        var keys = Regex.Matches(block.Groups["environment"].Value,
                @"^\s*-\s*([A-Za-z][A-Za-z0-9_]*)=", RegexOptions.Multiline)
            .Select(match => match.Groups[1].Value)
            .ToHashSet(StringComparer.Ordinal);
        var expected = new HashSet<string>(StringComparer.Ordinal)
        {
            "OsClient", "OsClientType", "OsClientNetwork", "OsClientDbType",
            "OsClientDbConn", "OsClientRedisHost", "OsClientRedisPort",
            "OsClientRedisPwd", "OsClientRedisDataBase", "OsClientDbMongoConn"
        };

        Assert.True(expected.SetEquals(keys),
            $"API 环境变量不符合十项启动清单。实际：{string.Join(",", keys.OrderBy(x => x))}");
    }

    [Fact]
    public void OfficialInstaller_CreatesOnlyTheMissingExactMainTenant()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "数据库、案例、文档、资料", "install-microi.sh"));

        Assert.Contains("ensure_runtime_main_tenant", source);
        Assert.Contains("MICROI_MAIN_TENANT_MISSING", source);
        Assert.Contains("MICROI_MAIN_TENANT_DUPLICATE:", source);
        Assert.Contains("MICROI_MAIN_TENANT_READY", source);
        Assert.Contains("MICROI_AUTH_SECRET_SCHEMA_OK", source);
        Assert.Contains("generate_random_auth_secret", source);
        Assert.Contains("AuthSecret=CASE WHEN", source);
        Assert.Contains("JWT AuthSecret 已持久化", source);
        Assert.DoesNotContain(
            "UPDATE sys_osclients SET OsClient='${OS_CLIENT}'",
            source);
        Assert.Matches(
            @"INSERT INTO sys_osclients \(Id,OsClient,ClientName,OsClientType,OsClientNetwork,IsEnable,IsDeleted\)",
            source);
        Assert.Matches(
            @"OCR_CONFIG_SQL=.*OsClientType=.*RUNTIME_OS_CLIENT_TYPE.*OsClientNetwork=.*RUNTIME_OS_CLIENT_NETWORK",
            source);
        Assert.Matches(
            @"TRANSLATE_CONFIG_SQL=.*OsClientType=.*RUNTIME_OS_CLIENT_TYPE.*OsClientNetwork=.*RUNTIME_OS_CLIENT_NETWORK",
            source);

        var translateStarted = source.IndexOf(
            "LibreTranslate 翻译服务已安装并启动", StringComparison.Ordinal);
        var apiLiveness = source.IndexOf(
            "wait_for_microi_api '/api/Diagnostics/liveness'", StringComparison.Ordinal);
        var translateSchema = source.IndexOf(
            "等待 Upgrade31 创建 SaaS 引擎翻译字段", StringComparison.Ordinal);
        var translateConfig = source.IndexOf(
            "写入 SaaS 引擎 LibreTranslate 配置", StringComparison.Ordinal);
        Assert.True(translateStarted >= 0 && apiLiveness > translateStarted);
        Assert.True(translateSchema > apiLiveness && translateConfig > translateSchema);
        Assert.Contains(
            "registry.cn-hangzhou.aliyuncs.com/microios/libretranslate:1.9.6-microi1",
            source);
        Assert.Contains("install_libretranslate=\"${install_libretranslate:-1}\"", source);
        Assert.Contains("libretranslate_language_package=\"${libretranslate_language_package:-1}\"", source);
        Assert.Contains("默认是 1（安装）", source);
        Assert.Contains("等待 Upgrade29 创建 SaaS 引擎 OCR 字段（最长 15 秒）", source);
        Assert.Contains("for _ocr_schema_wait in $(seq 1 15)", source);
        Assert.DoesNotContain("5 分钟内未能从数据库回读全部 9 个 OCR 字段", source);
        Assert.Contains("等待 Upgrade31 创建 SaaS 引擎翻译字段（最长 15 秒）", source);
        Assert.Contains("for _translate_schema_wait in $(seq 1 15)", source);
        Assert.DoesNotContain("5 分钟内未能从数据库回读全部 4 个 LibreTranslate 配置字段", source);
        Assert.Contains("APP_API_PULL_POLICY=\"always\"", source);
        Assert.Contains("APP_CLIENT_PULL_POLICY=\"always\"", source);
        Assert.Contains("pull_policy: ${APP_API_PULL_POLICY}", source);
        Assert.Contains("pull_policy: ${APP_CLIENT_PULL_POLICY}", source);
        Assert.Contains("强制回源拉取最新镜像", source);
        Assert.Contains("print_generated_install_configuration()", source);
        Assert.Contains("print_install_recovery_summary()", source);
        Assert.Contains("trap 'on_install_exit \"$?\"' EXIT", source);
        Assert.Contains("INSTALL_RECOVERY_SUMMARY_ENABLED=1", source);
        Assert.Contains("print_generated_install_configuration \"recovery\"", source);
        Assert.Contains("print_generated_install_configuration \"success\"", source);
        Assert.Contains("安装未完成（退出码 ${exit_code}）", source);
        Assert.Contains("不代表所有服务均已安装或可用", source);
        Assert.Contains("原始失败原因位于本汇总上方，脚本仍以非零状态退出", source);
        Assert.Contains("OCR SaaS 配置: 未完成", source);
        Assert.Contains("exit \"${exit_code}\"", source);
        Assert.Contains("mysql --default-character-set=utf8mb4", source);
        Assert.Contains("MICROI_SCHEDULES_PAUSED", source);
        Assert.Contains("定时任务已全部暂停并回读一致", source);
        Assert.Contains("MINIMUM_PLATFORM_SERVER_VERSION=\"6.9.8.6\"", source);
        Assert.Contains("version_at_least()", source);
        Assert.Contains("平台完整升级链回读通过", source);
        var platformUpgradeReadback = source.IndexOf(
            "等待平台完整升级链推进到 ServerVersion", StringComparison.Ordinal);
        var apiConfigurationRestart = source.IndexOf(
            "重启新安装 API，使已回读的 OCR/翻译租户配置立即生效", StringComparison.Ordinal);
        Assert.True(platformUpgradeReadback > translateConfig);
        Assert.True(apiConfigurationRestart > platformUpgradeReadback);

        var mysqlInsert = Regex.Match(source,
            @"INSERT INTO sys_osclients \((?<columns>[^)]*)\)");
        Assert.True(mysqlInsert.Success);
        var columns = mysqlInsert.Groups["columns"].Value;
        Assert.DoesNotContain("DbConn", columns, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Redis", columns, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DbMongo", columns, StringComparison.OrdinalIgnoreCase);

        var headerVersion = Regex.Match(source,
            @"# 版本：(?<version>v\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})");
        var runtimeVersion = Regex.Match(source,
            "SCRIPT_VERSION=\"(?<version>v\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})\"");
        Assert.True(headerVersion.Success && runtimeVersion.Success);
        Assert.Equal(
            headerVersion.Groups["version"].Value,
            runtimeVersion.Groups["version"].Value);
    }

    [Fact]
    public void UpgradeHostedService_UsesTheHydratedRuntimeSessionInsteadOfPersistedDbConn()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "MicroiUpgradeHostedService.cs"));

        Assert.Contains("if (runtimeClient.Db == null)", source);
        Assert.DoesNotContain("OsClientModel?[\"DbConn\"]", source);
        Assert.Contains("运行时数据库会话尚未初始化", source);
    }

    [Fact]
    public void UpgradeSchemaWrites_PreserveTrustedClrProvenanceWithoutTrustingExternalJson()
    {
        var root = FindRepositoryRoot();
        var formEngineSource = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "FormEngine", "FormEngine.cs"));
        var upgradeSafetySource = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "UpgradeExecutionSafety.cs"));

        Assert.Contains("var sourceBaseParam = dynamicParam as BaseParam", formEngineSource);
        Assert.Contains("var sourceWasExternalJson = dynamicParam is JToken", formEngineSource);
        Assert.Contains("? InvokeType.Client.ToString()", formEngineSource);
        Assert.Contains("sourceBaseParam?._TrustedServerInvocation == true", formEngineSource);
        Assert.Contains("UpgradeTrustedFormEngine", upgradeSafetySource);
        Assert.Contains("_TrustedServerInvocation = true", upgradeSafetySource);
        Assert.Contains("new DiyTableParam", upgradeSafetySource);
        Assert.Contains("DiyFieldParam param", upgradeSafetySource);
    }

    [Fact]
    public void BackendRuntimeTab_ReconcileIsIdempotent()
    {
        var first = Upgrade30.ReconcileTabs("[]", out var firstChanged);
        var second = Upgrade30.ReconcileTabs(first, out var secondChanged);

        Assert.True(firstChanged);
        Assert.False(secondChanged);
        var tabs = JArray.Parse(second);
        var tab = Assert.Single(tabs.OfType<JObject>().Where(item =>
            item.Value<string>("Id") == Upgrade30.TabId));
        Assert.Equal(Upgrade30.TabName, tab.Value<string>("Name"));
        Assert.Equal(14, tab.Value<int>("Sort"));
        Assert.True(tab.Value<bool>("Display"));
        Assert.All(Upgrade30.RuntimeFieldNames, name => Assert.InRange(name.Length, 1, 30));
        Assert.All(Upgrade30.ObsoleteLicenseFieldNames,
            name => Assert.DoesNotContain(name, Upgrade30.RuntimeFieldNames));

        Assert.Equal(
            "ALTER TABLE `sys_osclients` DROP COLUMN `BackendLicenseRetryMax`",
            Upgrade30.BuildDropColumnSql(
                Dos.ORM.DatabaseType.MySql,
                "sys_osclients",
                "BackendLicenseRetryMax"));
        Assert.Equal(
            "ALTER TABLE [sys_osclients] DROP COLUMN [BackendLicenseRetryMax]",
            Upgrade30.BuildDropColumnSql(
                Dos.ORM.DatabaseType.SqlServer,
                "sys_osclients",
                "BackendLicenseRetryMax"));
        Assert.Equal(
            "ALTER TABLE \"sys_osclients\" DROP COLUMN \"BackendLicenseRetryMax\"",
            Upgrade30.BuildDropColumnSql(
                Dos.ORM.DatabaseType.PostgreSql,
                "sys_osclients",
                "BackendLicenseRetryMax"));
        Assert.Equal(
            "ALTER TABLE sys_osclients DROP COLUMN BackendLicenseRetryMax",
            Upgrade30.BuildDropColumnSql(
                Dos.ORM.DatabaseType.Oracle,
                "sys_osclients",
                "BackendLicenseRetryMax"));
        Assert.Throws<ArgumentException>(() => Upgrade30.BuildDropColumnSql(
            Dos.ORM.DatabaseType.MySql,
            "sys_osclients;DROP TABLE sys_user",
            "BackendLicenseRetryMax"));

        var migratedFieldTab = Upgrade30.ReconcileFieldTab(Upgrade30.TabName, out var fieldChanged);
        var stableFieldTab = Upgrade30.ReconcileFieldTab(Upgrade30.TabId, out var stableFieldChanged);
        Assert.True(fieldChanged);
        Assert.Equal(Upgrade30.TabId, migratedFieldTab);
        Assert.False(stableFieldChanged);
        Assert.Equal(Upgrade30.TabId, stableFieldTab);
    }

    [Fact]
    public void TranslateRuntimeTab_ReconcileIsIdempotent()
    {
        var original = "[{\"Id\":\"base\",\"Name\":\"基础\",\"Display\":true},{\"Id\":\"legacy\",\"Name\":\"翻译引擎\"}]";
        var first = Upgrade31.ReconcileTabs(original, out var firstChanged);
        var second = Upgrade31.ReconcileTabs(first, out var secondChanged);

        Assert.True(firstChanged);
        Assert.False(secondChanged);
        var tabs = JArray.Parse(second);
        Assert.Single(tabs.OfType<JObject>().Where(item =>
            item.Value<string>("Id") == Upgrade31.TabId));
        var tab = Assert.Single(tabs.OfType<JObject>().Where(item =>
            item.Value<string>("Name") == Upgrade31.TabName));
        Assert.Equal(15, tab.Value<int>("Sort"));
        Assert.True(tab.Value<bool>("Display"));
        Assert.Equal(7, Upgrade31.FieldNames.Count);
        Assert.Contains("TranslateProvider", Upgrade31.FieldNames);
        Assert.Contains("TranslateApiKey", Upgrade31.FieldNames);

        var upgradeSource = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "Microi.Server", "Microi.Upgrade",
            "31-UpgradeTranslateTenantSettings.cs"));
        Assert.DoesNotContain("Type = \"varchar", upgradeSource);
        Assert.Contains("Name = \"TranslateUrl\", Label = \"翻译服务地址\", Type = \"mediumtext\"", upgradeSource);

        var migratedFieldTab = Upgrade31.ReconcileFieldTab("", out var fieldChanged);
        var stableFieldTab = Upgrade31.ReconcileFieldTab(Upgrade31.TabId, out var stableFieldChanged);
        Assert.True(fieldChanged);
        Assert.Equal(Upgrade31.TabId, migratedFieldTab);
        Assert.False(stableFieldChanged);
        Assert.Equal(Upgrade31.TabId, stableFieldTab);
    }

    [Fact]
    public void BaseConfiguration_DoesNotRequestJwtSecretRotationOnRelease()
    {
        var root = FindRepositoryRoot();
        var appSettings = JObject.Parse(File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.net.Api",
            "appsettings.json")));

        Assert.Null(appSettings.SelectToken("Security.AuthSecretRotateVersion"));
        Assert.True(string.IsNullOrWhiteSpace(
            appSettings.SelectToken("Security.AuthSecret")?.Value<string>()));
    }

    [Fact]
    public void RuntimeSources_DoNotReadBusinessTuningEnvironmentVariables()
    {
        var root = FindRepositoryRoot();
        string Read(params string[] segments) => File.ReadAllText(
            Path.Combine(new[] { root }.Concat(segments).ToArray()));

        var processMemoryGuard = Read(
            "Microi.Server", "Microi.net.Api", "Services", "ProcessMemoryGuardService.cs");
        var sysLogQueue = Read(
            "Microi.Server", "Microi.net.Api", "Services", "SysLogQueueService.cs");
        var diyLangCache = Read(
            "Microi.Server", "Microi.Core", "FormEngine", "FormEngineLang.cs");
        var cache = Read(
            "Microi.Server", "Microi.Cache", "MicroiTwoLevelCache.cs");
        var translateEngine = Read(
            "Microi.Server", "Microi.net", "TranslateEngine", "TranslateEngine.cs");
        var v8Engine = Read(
            "Microi.Server", "Microi.net", "V8Engine", "V8Engine.cs");
        var runtimeConfigurationMap = Read(
            "Microi.Server", "Microi.net", "Common", "OsClient.cs");

        Assert.DoesNotContain("MICROI_PROCESS_MEMORY_GUARD_", processMemoryGuard);
        Assert.DoesNotContain("MICROI_SYSLOG_", sysLogQueue);
        Assert.DoesNotContain("MICROI_DIY_LANG_CACHE_", diyLangCache);
        Assert.DoesNotContain("MICROI_NODE_ID", cache);
        Assert.DoesNotContain("MICROI_TRANSLATE_", translateEngine);
        Assert.DoesNotContain("MICROI_V8_", v8Engine);
        Assert.DoesNotContain("DOS_ORM_", runtimeConfigurationMap);
        Assert.DoesNotContain("MICROI_PRESSURE_", runtimeConfigurationMap);
        Assert.DoesNotContain("MICROI_STARTUP_", runtimeConfigurationMap);
        Assert.DoesNotContain("MICROI_SECURITY_", runtimeConfigurationMap);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(directory.FullName, "microi.doc")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi 仓库根目录。");
    }
}
