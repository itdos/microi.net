using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

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
