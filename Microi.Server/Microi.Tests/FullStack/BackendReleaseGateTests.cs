using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.FullStack;

[CollectionDefinition(CollectionName, DisableParallelization = true)]
public sealed class BackendReleaseGateCollection
{
    public const string CollectionName = "Microi backend full-stack release gate";
}

[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
public class BackendReleaseGateTests
{
    [Fact]
    [Trait("Suite", "TenantSmoke")]
    public async Task AuthenticatedTenantSmoke_ValidatesHealthConfigurationAndFormEngineReads()
    {
        var settings = ReleaseGateSettings.FromEnvironment();
        using var client = settings.CreateClient();

        using var healthResponse = await client.GetAsync(
            "api/Diagnostics/health",
            TestContext.Current.CancellationToken);
        Assert.True(
            healthResponse.IsSuccessStatusCode,
            $"Health endpoint returned HTTP {(int)healthResponse.StatusCode}.");

        var currentUser = await PostAndRequireSuccessAsync(
            client,
            "api/SysUser/GetCurrentUser",
            new JsonObject { ["OsClient"] = settings.OsClient });
        Assert.NotNull(ReadProperty(currentUser, "Data"));

        var sysConfig = await PostAndRequireSuccessAsync(
            client,
            "api/FormEngine/GetSysConfig",
            new JsonObject { ["OsClient"] = settings.OsClient });
        var publicConfigNode = Assert.IsType<JsonObject>(ReadProperty(sysConfig, "Data"));
        var publicConfig = JObject.Parse(publicConfigNode.ToJsonString());
        var reprojected = TenantConfigurationSecurity.CreatePublicSysConfigProjection(publicConfig);
        Assert.True(
            JToken.DeepEquals(publicConfig, reprojected),
            "GetSysConfig returned a field that the public security projection would remove.");

        var tableQuery = new JsonObject
        {
            ["FormEngineKey"] = "diy_table",
            ["OsClient"] = settings.OsClient,
            ["_SelectFields"] = new JsonArray("Id", "Name"),
            ["_PageIndex"] = 1,
            ["_PageSize"] = 1
        };
        var tables = await PostAndRequireSuccessAsync(
            client,
            "api/FormEngine/GetTableData",
            tableQuery);
        Assert.IsType<JsonArray>(ReadProperty(tables, "Data"));

        var countQuery = new JsonObject
        {
            ["FormEngineKey"] = "diy_table",
            ["OsClient"] = settings.OsClient
        };
        var count = await PostAndRequireSuccessAsync(
            client,
            "api/FormEngine/GetTableDataCount",
            countQuery);
        Assert.True(ReadDataCount(count) > 0, "diy_table metadata count was empty.");
    }

    [Fact]
    [Trait("Suite", "ApiEngine")]
    public async Task ApiEngine_GetAndJsonPostTransports_AreCallable()
    {
        var settings = ReleaseGateSettings.FromEnvironment(requireApiEngine: true);
        using var client = settings.CreateClient();
        var probe = $"microi-release-gate-{Guid.NewGuid():N}";
        var encodedKey = Uri.EscapeDataString(settings.ApiEngineKey);
        var encodedTenant = Uri.EscapeDataString(settings.OsClient);
        var enginePath = $"apiengine/{encodedKey}--OsClient--{encodedTenant}--";

        var postBody = new JsonObject { ["Probe"] = probe, ["Transport"] = "json" };
        if (settings.ApiEngineReturnsDosResult)
        {
            var postResult = await PostAndRequireSuccessAsync(client, enginePath, postBody);
            Assert.Equal(1, ReadCode(postResult));
        }
        else
        {
            using var postResponse = await client.PostAsJsonAsync(
                enginePath,
                postBody,
                TestContext.Current.CancellationToken);
            Assert.NotNull(await ReadJsonNodeAsync(postResponse, enginePath + " POST"));
        }

        using var getResponse = await client.GetAsync(
            enginePath + "?Probe=" + Uri.EscapeDataString(probe) + "&Transport=url",
            TestContext.Current.CancellationToken);
        if (settings.ApiEngineReturnsDosResult)
        {
            var getResult = await ReadJsonAsync(getResponse, enginePath + " GET");
            Assert.Equal(1, ReadCode(getResult));
        }
        else
        {
            Assert.NotNull(await ReadJsonNodeAsync(getResponse, enginePath + " GET"));
        }
    }

    [Fact]
    [Trait("Suite", "WriteReleaseGate")]
    public async Task FormEngineCrud_WorksAgainstIsolatedTenantTable()
    {
        var settings = ReleaseGateSettings.FromEnvironment(requireFormEngine: true);
        Assert.Equal(
            "YES",
            Environment.GetEnvironmentVariable("MICROI_TEST_ALLOW_WRITES"));
        using var client = settings.CreateClient();
        // Keep the probe compatible with legacy varchar(20) test fields.
        var prefix = $"mrg{DateTime.UtcNow:HHmmss}{Guid.NewGuid():N}"[..13];

        try
        {
            var singleName = prefix + "s";
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/AddFormData",
                settings.NewForm(singleName));

            var single = await FindSingleAsync(client, settings, singleName);
            var singleId = RequireString(single, "Id");

            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/GetFormData",
                settings.NewForm(null, new JsonObject { ["Id"] = singleId }));

            var count = await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/GetTableDataCount",
                settings.QueryByName(singleName));
            Assert.True(ReadDataCount(count) >= 1, "GetTableDataCount did not find the inserted row.");

            var updatedName = prefix + "u";
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/UptFormData",
                settings.NewForm(updatedName, new JsonObject { ["Id"] = singleId }));
            await FindSingleAsync(client, settings, updatedName);

            var byWhereName = prefix + "w";
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/AddFormData",
                settings.NewForm(byWhereName));
            var byWhereUpdatedName = prefix + "x";
            var updateByWhere = settings.NewForm(byWhereUpdatedName);
            updateByWhere["_Where"] = NewWhere(settings.NameField, "=", byWhereName);
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/UptFormDataByWhere",
                updateByWhere);
            await FindSingleAsync(client, settings, byWhereUpdatedName);

            var batchNames = new[]
            {
                prefix + "b1",
                prefix + "b2"
            };
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/AddFormDataBatch",
                new JsonArray(batchNames.Select(name => settings.NewForm(name)).ToArray()));

            var batchRows = await FindByPrefixAsync(client, settings, prefix + "b");
            Assert.Equal(2, batchRows.Count);
            var batchUpdates = new JsonArray();
            foreach (var row in batchRows)
            {
                var id = RequireString(row, "Id");
                var currentName = RequireString(row, settings.NameField);
                batchUpdates.Add(settings.NewForm(
                    currentName + "u",
                    new JsonObject { ["Id"] = id }));
            }
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/UptFormDataBatch",
                batchUpdates);

            var updatedBatchRows = await FindByPrefixAsync(client, settings, prefix + "b");
            Assert.All(
                updatedBatchRows,
                row => Assert.EndsWith(
                    "u",
                    RequireString(row, settings.NameField),
                    StringComparison.Ordinal));

            var deleteByWhere = settings.NewForm(null);
            deleteByWhere["_Where"] = NewWhere(settings.NameField, "=", byWhereUpdatedName);
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/DelFormDataByWhere",
                deleteByWhere);

            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/DelFormData",
                settings.NewForm(null, new JsonObject { ["Id"] = singleId }));

            var batchDeletes = new JsonArray(
                updatedBatchRows
                    .Select(row => settings.NewForm(
                        null,
                        new JsonObject { ["Id"] = RequireString(row, "Id") }))
                    .ToArray());
            await PostAndRequireSuccessAsync(
                client,
                "api/FormEngine/DelFormDataBatch",
                batchDeletes);

            var afterDelete = await FindByPrefixAsync(client, settings, prefix);
            Assert.Empty(afterDelete);

        }
        finally
        {
            // Cleanup is deliberately best-effort so the original assertion remains visible.
            // The isolated release-gate table must not contain production data.
            var cleanup = settings.NewForm(null);
            cleanup["_Where"] = NewWhere(settings.NameField, "StartLike", prefix);
            try
            {
                await client.PostAsJsonAsync(
                    "api/FormEngine/DelFormDataByWhere",
                    cleanup,
                    TestContext.Current.CancellationToken);
            }
            catch
            {
                // The failed test report contains the unique prefix for manual cleanup.
            }
        }
    }

    private static async Task<JsonObject> FindSingleAsync(
        HttpClient client,
        ReleaseGateSettings settings,
        string name)
    {
        var rows = await FindAsync(client, settings, "=", name);
        Assert.Single(rows);
        return rows[0];
    }

    private static Task<List<JsonObject>> FindByPrefixAsync(
        HttpClient client,
        ReleaseGateSettings settings,
        string prefix)
    {
        return FindAsync(client, settings, "StartLike", prefix);
    }

    private static async Task<List<JsonObject>> FindAsync(
        HttpClient client,
        ReleaseGateSettings settings,
        string operation,
        string value)
    {
        var query = settings.NewForm(null);
        query["_Where"] = NewWhere(settings.NameField, operation, value);
        query["_SelectFields"] = new JsonArray("Id", settings.NameField);
        query["_PageIndex"] = 1;
        query["_PageSize"] = 100;

        var response = await PostAndRequireSuccessAsync(
            client,
            "api/FormEngine/GetTableData",
            query);
        var data = response["Data"] as JsonArray ?? new JsonArray();
        return data
            .OfType<JsonObject>()
            .ToList();
    }

    private static JsonArray NewWhere(string field, string operation, string value)
    {
        return new JsonArray(new JsonArray(field, operation, value));
    }

    private static async Task<JsonObject> PostAndRequireSuccessAsync(
        HttpClient client,
        string path,
        JsonNode body)
    {
        using var response = await client.PostAsJsonAsync(path, body);
        var result = await ReadJsonAsync(response, path);
        var code = ReadCode(result);
        var message = ReadProperty(result, "Msg")?.GetValue<string>() ?? string.Empty;
        Assert.True(
            code == 1,
            $"{path} returned Code={code}, Msg={message}");
        return result;
    }

    private static async Task<JsonObject> ReadJsonAsync(
        HttpResponseMessage response,
        string operation)
    {
        return Assert.IsType<JsonObject>(await ReadJsonNodeAsync(response, operation));
    }

    private static async Task<JsonNode> ReadJsonNodeAsync(
        HttpResponseMessage response,
        string operation)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(
            response.IsSuccessStatusCode,
            $"{operation} returned HTTP {(int)response.StatusCode}: {text}");
        Assert.False(string.IsNullOrWhiteSpace(text), $"{operation} returned an empty body.");

        JsonNode? node;
        try
        {
            node = JsonNode.Parse(text);
        }
        catch (JsonException ex)
        {
            throw new Xunit.Sdk.XunitException(
                $"{operation} returned non-JSON content: {ex.Message}; body={text}");
        }

        return node ?? throw new Xunit.Sdk.XunitException(
            $"{operation} returned JSON null.");
    }

    private static int ReadCode(JsonObject result)
    {
        return ReadProperty(result, "Code")?.GetValue<int>()
               ?? throw new Xunit.Sdk.XunitException(
                   $"Response has no numeric Code: {result.ToJsonString()}");
    }

    private static int ReadDataCount(JsonObject result)
    {
        return ReadProperty(result, "DataCount")?.GetValue<int>() ?? 0;
    }

    private static string RequireString(JsonObject value, string propertyName)
    {
        var text = ReadProperty(value, propertyName)?.GetValue<string>();
        return !string.IsNullOrWhiteSpace(text)
            ? text
            : throw new Xunit.Sdk.XunitException(
                $"Response row has no {propertyName}: {value.ToJsonString()}");
    }

    private static JsonNode? ReadProperty(JsonObject value, string propertyName)
    {
        return value.FirstOrDefault(
                item => string.Equals(
                    item.Key,
                    propertyName,
                    StringComparison.OrdinalIgnoreCase))
            .Value;
    }

    private sealed class ReleaseGateSettings
    {
        public required Uri ApiBase { get; init; }
        public required string OsClient { get; init; }
        public required string Token { get; init; }
        public required string FormEngineKey { get; init; }
        public required string ApiEngineKey { get; init; }
        public required string NameField { get; init; }
        public required string DeviceId { get; init; }
        public required bool ApiEngineReturnsDosResult { get; init; }

        public static ReleaseGateSettings FromEnvironment(
            bool requireFormEngine = false,
            bool requireApiEngine = false)
        {
            static string Require(string name)
            {
                var value = Environment.GetEnvironmentVariable(name);
                return !string.IsNullOrWhiteSpace(value)
                    ? value.Trim()
                    : throw new Xunit.Sdk.XunitException(
                        $"FullStack release gate requires environment variable {name}.");
            }

            var apiBaseText = Require("MICROI_TEST_API_BASE");
            if (!Uri.TryCreate(apiBaseText.TrimEnd('/') + "/", UriKind.Absolute, out var apiBase))
            {
                throw new Xunit.Sdk.XunitException(
                    $"MICROI_TEST_API_BASE is not an absolute URL: {apiBaseText}");
            }

            static string Optional(string name)
            {
                return Environment.GetEnvironmentVariable(name)?.Trim() ?? string.Empty;
            }

            var formEngineKey = Optional("MICROI_TEST_FORM_ENGINE_KEY");
            if (requireFormEngine && string.IsNullOrWhiteSpace(formEngineKey))
            {
                throw new Xunit.Sdk.XunitException(
                    "Write release gate requires environment variable MICROI_TEST_FORM_ENGINE_KEY.");
            }
            var apiEngineKey = Optional("MICROI_TEST_API_ENGINE_KEY");
            if (requireApiEngine && string.IsNullOrWhiteSpace(apiEngineKey))
            {
                throw new Xunit.Sdk.XunitException(
                    "ApiEngine release gate requires environment variable MICROI_TEST_API_ENGINE_KEY.");
            }

            return new ReleaseGateSettings
            {
                ApiBase = apiBase,
                OsClient = Require("MICROI_TEST_OSCLIENT"),
                Token = Require("MICROI_TEST_TOKEN"),
                FormEngineKey = formEngineKey,
                ApiEngineKey = apiEngineKey,
                NameField = Environment.GetEnvironmentVariable("MICROI_TEST_NAME_FIELD")?.Trim()
                            ?? "Name",
                DeviceId = Environment.GetEnvironmentVariable("MICROI_TEST_DID")?.Trim()
                           ?? "Microi.Tests",
                ApiEngineReturnsDosResult = !string.Equals(
                    Optional("MICROI_TEST_API_ENGINE_RESPONSE_MODE"),
                    "Any",
                    StringComparison.OrdinalIgnoreCase)
            };
        }

        public HttpClient CreateClient()
        {
            var client = new HttpClient
            {
                BaseAddress = ApiBase,
                Timeout = TimeSpan.FromMinutes(3)
            };
            client.DefaultRequestHeaders.TryAddWithoutValidation("authorization", Token);
            client.DefaultRequestHeaders.TryAddWithoutValidation("did", DeviceId);
            client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
            return client;
        }

        public JsonObject NewForm(string? name, JsonObject? values = null)
        {
            values ??= new JsonObject();
            values["FormEngineKey"] = FormEngineKey;
            values["OsClient"] = OsClient;
            if (name != null)
            {
                values[NameField] = name;
            }
            return values;
        }

        public JsonObject QueryByName(string name)
        {
            var query = NewForm(null);
            query["_Where"] = NewWhere(NameField, "=", name);
            return query;
        }
    }
}
