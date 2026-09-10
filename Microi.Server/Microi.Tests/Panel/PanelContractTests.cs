using Microi.Panel;
using Microi.Panel.Panel;
using Microsoft.AspNetCore.DataProtection;

namespace Microi.Tests.Panel;

public sealed class PanelContractTests
{
    [Theory]
    [InlineData("nginx")][InlineData("mysql")][InlineData("postgresql")][InlineData("sqlserver")]
    [InlineData("oracle")][InlineData("minio")][InlineData("redis")][InlineData("mongodb")]
    [InlineData("translate")][InlineData("ocr")]
    public void CatalogProvidesRequiredPlugins(string id)
    {
        var plugin = PanelCatalog.Get(id);
        Assert.NotEmpty(plugin.Versions);
        Assert.All(plugin.Versions, version => Assert.NotEqual("latest", version.Id));
        Assert.NotEmpty(plugin.DataPath);
    }

    [Fact]
    public void InstallationHasIsolatedIdentityAndPersistentData()
    {
        var plan = PanelCatalog.Prepare(new() { PluginId = "mysql", Version = "8.4.11", Name = "customer-db", Password = "Test-Strong-Password-48" }, "panel-a");
        Assert.Equal("mci-panel-panel-a-customer-db", plan.ContainerName);
        Assert.Equal("127.0.0.1", plan.BindAddress);
        Assert.Equal("mci-panel-panel-a-customer-db-data", plan.VolumeName);
        Assert.Equal("panel-a", plan.OwnerId);
        Assert.Contains("registry.cn-hangzhou.aliyuncs.com/", plan.Image);
    }

    [Theory]
    [InlineData("../other")][InlineData("/var/lib/mysql")][InlineData("other;rm")][InlineData("a b")]
    public void CannotInjectNamesOrPaths(string name) => Assert.Throws<OpsException>(() => PanelCatalog.Prepare(new()
    { PluginId = "redis", Version = "7.4.11", Name = name, Password = "Test-Strong-Password-48" }, "panel-a"));

    [Fact]
    public void UnknownVersionCannotBecomeAnArbitraryImage() => Assert.Throws<OpsException>(() => PanelCatalog.Prepare(new()
    { PluginId = "mysql", Version = "attacker/repo:latest", Name = "db", Password = "Test-Strong-Password-48" }, "panel-a"));

    [Fact]
    public void SqlServerNeedsExplicitEditionAndLicenseAcknowledgement() => Assert.Throws<OpsException>(() => PanelCatalog.Prepare(new()
    { PluginId = "sqlserver", Version = "2022-CU26-GDR1", Name = "db", Password = "Test-Strong-Password-48" }, "panel-a"));

    [Fact]
    public void PluginsDoNotGrantHostPrivileges()
    {
        var plan = PanelCatalog.Prepare(new() { PluginId = "redis", Version = "7.4.11", Name = "cache", Password = "Test-Strong-Password-48" }, "panel-a");
        var config = PanelDockerConfig.Create(plan, "sha256:" + new string('a', 64));
        Assert.False(config["HostConfig"]!["Privileged"]!.GetValue<bool>());
        Assert.Null(config["HostConfig"]!["Binds"]);
        Assert.Equal("mci-panel-panel-a", config["HostConfig"]!["NetworkMode"]!.GetValue<string>());
        Assert.DoesNotContain("docker.sock", config.ToJsonString());
    }

    [Fact]
    public async Task InstallationLedgerDeduplicatesConcurrentRequestsAndSurvivesRestart()
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../.tmp/panel-20260910/tests", Guid.NewGuid().ToString("N")));
        var options = new OpsOptions { DataDir = root, LogDir = root };
        var protection = new EphemeralDataProtectionProvider();
        var resource = PanelCatalog.Prepare(new() { PluginId = "redis", Version = "7.4.11", Name = "cache", Password = "Sensitive-Secret-987654" }, "panel-a");
        var request = Guid.NewGuid().ToString(); string operationId;
        using (var store = new OpsStore(options))
        {
            var repo = new PanelRepository(options, store, protection);
            var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Task.Run(() => repo.Enqueue("Install", request, resource, "tester"))));
            operationId = results[0].Id;
            Assert.All(results, op => Assert.Equal(operationId, op.Id));
            Assert.Single(repo.Resources()); Assert.Single(repo.Operations());
            Assert.Equal("Sensitive-Secret-987654", repo.Resource("cache").Environment["REDISCLI_AUTH"]);
            Assert.DoesNotContain("Sensitive-Secret-987654", System.Text.Json.JsonSerializer.Serialize(repo.Resource("cache").Public()));
            resource.Version = "changed";
            Assert.Throws<OpsException>(() => repo.Enqueue("Install", request, resource, "tester"));
        }
        using (var store = new OpsStore(options))
        {
            var repo = new PanelRepository(options, store, protection);
            Assert.Equal(operationId, Assert.Single(repo.Operations(true)).Id);
            Assert.Equal("Sensitive-Secret-987654", repo.Resource("cache").Environment["REDISCLI_AUTH"]);
            var op = repo.Operation(operationId); op.State = "Failed"; repo.SaveOperation(op);
            Assert.Equal(operationId, repo.Retry(operationId).Id); Assert.Single(repo.Operations(true));
            Assert.Throws<OpsException>(() => repo.Retry(operationId));
            // 从 SQLite 读取实际已提交列，包含 WAL 中尚未检查点的数据；不能只扫主文件而漏检秘密。
            using var database = new Microsoft.Data.Sqlite.SqliteConnection(new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder
            { DataSource = Path.Combine(root, "ops.db"), Mode = Microsoft.Data.Sqlite.SqliteOpenMode.ReadOnly }.ToString());
            database.Open();
            using var command = database.CreateCommand();
            command.CommandText = "SELECT body_cipher FROM panel_resources UNION ALL SELECT body FROM panel_operations";
            using var reader = command.ExecuteReader(); var rows = 0;
            while (reader.Read()) { rows++; Assert.DoesNotContain("Sensitive-Secret-987654", reader.GetString(0)); }
            Assert.Equal(2, rows);
        }
    }

    [Fact]
    public void ExternalContainersCannotBeAdoptedByName()
    {
        var resource = PanelCatalog.Prepare(new() { PluginId = "redis", Version = "7.4.11", Name = "cache", Password = "Test-Strong-Password-48" }, "panel-a");
        var external = System.Text.Json.Nodes.JsonNode.Parse("{\"Config\":{\"Labels\":{\"io.microi.panel.owner\":\"another-panel\",\"io.microi.panel.resource\":\"cache\"}}}")!;
        Assert.Throws<OpsException>(() => PanelDockerConfig.AssertOwned(external, resource));
    }

    [Fact]
    public void DatabaseReadinessExcludesTemporarySocketOnlyBootstrapServers()
    {
        var mysql = string.Join(' ', PanelDockerConfig.Healthcheck("mysql")!);
        Assert.Contains("--protocol=TCP", mysql); Assert.Contains("MYSQL_ROOT_PASSWORD", mysql);
        var postgres = string.Join(' ', PanelDockerConfig.Healthcheck("postgresql")!);
        Assert.Contains("PGPASSWORD", postgres); Assert.Contains("-h127.0.0.1", postgres);
        Assert.Contains("ON_ERROR_STOP=1", postgres); Assert.Contains("SELECT 1", postgres);
    }

    [Fact]
    public void CapacityIncludesOtherRunningPluginsAndCurrentFreeMemory()
    {
        const long GiB=1024L*1024*1024;
        PanelCapacity.Assert(8*GiB,4*GiB,2048,[1024,2048]);
        Assert.Throws<OpsException>(()=>PanelCapacity.Assert(8*GiB,8*GiB,4096,[2048,2048]));
        Assert.Throws<OpsException>(()=>PanelCapacity.Assert(16*GiB,2*GiB,2048,[]));
        Assert.Throws<OpsException>(()=>PanelCapacity.Assert(0,null,256,[]));
    }

    [Fact]
    public void OcrUsesPreloadedModelVolumeAndPublishedResourceRequirements()
    {
        var plugin=PanelCatalog.Get("ocr");
        var plan=PanelCatalog.Prepare(new(){Name="ocr",PluginId="ocr",Version=plugin.Versions[0].Id},"panel-a");
        var config=PanelDockerConfig.Create(plan,"sha256:"+new string('b',64));
        Assert.Equal("/home/microi/.paddlex",plugin.DataPath);
        Assert.Equal(8192,plan.MemoryMb);
        Assert.Equal(4L*1024*1024*1024,config["HostConfig"]!["ShmSize"]!.GetValue<long>());
        Assert.True(config["HostConfig"]!["Init"]!.GetValue<bool>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void TranslationUsesTheEntrypointsSingleWorkerOptionIncludingRetainedPlans(bool legacyPlan)
    {
        var plugin = PanelCatalog.Get("translate");
        var plan = PanelCatalog.Prepare(new() { Name = "translate", PluginId = plugin.Id, Version = plugin.Versions[0].Id }, "panel-a");
        if (legacyPlan) { plan.Environment.Remove("LT_THREADS"); plan.Environment["LT_WORKERS"] = "1"; }
        var config = PanelDockerConfig.Create(plan, "sha256:" + new string('c', 64));
        var environment = config["Env"]!.AsArray().Select(value => value!.GetValue<string>()).ToArray();
        Assert.Contains("LT_THREADS=1", environment);
        Assert.Contains("LT_LOAD_ONLY=zh,en", environment);
        Assert.DoesNotContain(environment, value => value.StartsWith("LT_WORKERS=", StringComparison.Ordinal));
        // 旧任务的参数快照保持不变；兼容归一化只作用于将要创建的容器配置。
        if (legacyPlan) Assert.Equal("1", plan.Environment["LT_WORKERS"]);
    }

    [Fact]
    public void SqlServerRejectsPredictablyInvalidPasswordsBeforeCreatingResources()
    {
        var error=Assert.Throws<OpsException>(()=>PanelCatalog.Prepare(new(){Name="sql",PluginId="sqlserver",Version="2022-CU26-GDR1",AcceptLicense=true,Password="onlylowercasepassword"},"panel-a"));
        Assert.Contains("至少三类",error.Message);
    }
}
