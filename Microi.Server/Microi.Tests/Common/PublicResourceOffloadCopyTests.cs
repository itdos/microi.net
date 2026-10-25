using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public sealed class PublicResourceOffloadCopyTests
{
    private static readonly byte[] Bytes = System.Text.Encoding.UTF8.GetBytes("verified-public-model");
    private static JObject Asset() => new() { ["ObjectKey"] = "tenant/app/model.glb", ["Path"] = "assets/model.glb", ["Size"] = Bytes.Length,
        ["Sha256"] = Convert.ToHexString(SHA256.HashData(Bytes)).ToLowerInvariant() };

    [Fact]
    public async Task CopiesAndFullyReadsBackThenResumeDoesNotDownloadSourceOrUploadAgain()
    {
        var source = new Store { Body = Bytes }; var target = new Store();
        await Copy(source, target);
        Assert.Equal(Bytes, target.Body); Assert.Equal(1, target.Writes); Assert.Equal(1, source.Reads);
        await Copy(source, target);
        Assert.Equal(1, target.Writes); Assert.Equal(1, source.Reads); Assert.Equal(0, source.Deletes + target.Deletes);
    }

    [Theory]
    [InlineData("SourceReadFailure")]
    [InlineData("SourceHashMismatch")]
    [InlineData("SourceOversize")]
    [InlineData("SourceShort")]
    [InlineData("ExistenceUnknown")]
    [InlineData("ExistingMismatch")]
    public async Task UnprovenOrCorruptSourceNeverProducesTargetWrite(string failure)
    {
        var source = new Store { Body = Bytes }; var target = new Store();
        if (failure == "SourceReadFailure") source.ReadFailure = true;
        if (failure == "SourceHashMismatch") source.Body = new byte[Bytes.Length];
        if (failure == "SourceOversize") source.Body = new byte[Bytes.Length + 1];
        if (failure == "SourceShort") source.Body = new byte[Bytes.Length - 1];
        if (failure == "ExistenceUnknown") target.ReadFailure = true;
        if (failure == "ExistingMismatch") target.Body = new byte[Bytes.Length];
        await Assert.ThrowsAnyAsync<Exception>(() => Copy(source, target));
        Assert.Equal(0, target.Writes); Assert.Equal(0, source.Deletes + target.Deletes);
    }

    [Fact]
    public async Task UnknownUploadOutcomeReconcilesExistingBytesBeforeRetry()
    {
        var source = new Store { Body = Bytes }; var target = new Store { UnknownWriteOutcome = true };
        await Assert.ThrowsAsync<InvalidOperationException>(() => Copy(source, target));
        Assert.Equal(Bytes, target.Body);
        target.UnknownWriteOutcome = false;
        await Copy(source, target);
        Assert.Equal(1, target.Writes); Assert.Equal(1, source.Reads);
    }

    [Fact]
    public async Task CorruptTargetReadbackCannotBeAcknowledged()
    {
        var source = new Store { Body = Bytes }; var target = new Store { CorruptWrite = true };
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => Copy(source, target));
        Assert.Equal("BackupReadbackMismatch", error.Message);
    }

    [Fact]
    public async Task CancellationCannotUploadOrDelete()
    {
        var source = new Store { Body = Bytes }; var target = new Store();
        using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => PublicResourceOffloadRuntime.CopyVerifiedAssetAsync(source, null!, target, null!, Asset(), "replica/model.glb", cancellation.Token));
        Assert.Equal(0, target.Writes + target.Deletes + source.Deletes);
    }

    [Theory]
    [InlineData("disabled")]
    [InlineData("copying")]
    [InlineData("newVersion")]
    [InlineData("newConfig")]
    [InlineData("staleHealth")]
    [InlineData("newHash")]
    [InlineData("newSize")]
    [InlineData("differentPath")]
    public void RuntimeChangeAlwaysFallsBackToAuthoritativeOriginal(string mutation)
    {
        var asset = Asset();
        var state = new JObject { ["Enabled"] = true, ["State"] = "Ready", ["Version"] = "v1", ["TargetConfigHash"] = "config1", ["HealthValidUntilUtc"] = 101L, ["Assets"] = new JArray(asset.DeepClone()) };
        Assert.True(PublicResourceOffloadRuntime.ReadyAssetMatches(state, "config1", "v1", "assets/model.glb", asset, 100));
        if (mutation == "disabled") state["Enabled"] = false;
        if (mutation == "copying") state["State"] = "Copying";
        if (mutation == "newVersion") state["Version"] = "v2";
        if (mutation == "newConfig") state["TargetConfigHash"] = "config2";
        if (mutation == "staleHealth") state["HealthValidUntilUtc"] = 100;
        if (mutation == "newHash") asset["Sha256"] = new string('0', 64);
        if (mutation == "newSize") asset["Size"] = Bytes.Length + 1;
        Assert.False(PublicResourceOffloadRuntime.ReadyAssetMatches(state, "config1", "v1", mutation == "differentPath" ? "other.glb" : "assets/model.glb", asset, 100));
    }

    private static Task Copy(Store source, Store target) => PublicResourceOffloadRuntime.CopyVerifiedAssetAsync(source, null!, target, null!, Asset(), "replica/model.glb", CancellationToken.None);

    private sealed class Store : IMicroiHDFS
    {
        internal byte[]? Body; internal int Reads, Writes, Deletes;
        internal bool ReadFailure, UnknownWriteOutcome, CorruptWrite;
        public async Task<DosResult> CopyObjectToStream(HDFSParam param)
        {
            param.CancellationToken.ThrowIfCancellationRequested(); Reads++;
            if (ReadFailure) return new DosResult(0, null, "provider diagnostics excluded");
            if (Body == null) return new DosResult(0, null, "missing") { DataAppend = new JObject { ["StorageReadErrorCode"] = "NoSuchKey" } };
            await param.FileStream.WriteAsync(Body, 0, Body.Length, param.CancellationToken);
            return new DosResult(1);
        }
        public async Task<DosResult> PutObject(HDFSParam param)
        {
            Writes++; using var output = new MemoryStream(); await param.FileStream.CopyToAsync(output); Body = output.ToArray();
            if (CorruptWrite) Body[0] ^= 1;
            return new DosResult(UnknownWriteOutcome ? 0 : 1);
        }
        public Task<DosResult> DeleteObject(HDFSParam param) { Deletes++; throw new Exception("Deletion forbidden"); }
        public Task<DosResult> Upload(DiyUploadParam p, Microsoft.AspNetCore.Http.HttpContext c = null!) => throw new NotSupportedException();
        public Task<DosResult<bool>> ObjectExist(HDFSParam p) => throw new NotSupportedException();
        public Task<DosResult> GetPrivateFileUrl(HDFSParam p) => throw new NotSupportedException();
        public Task<DosResult> GetPrivateFileUrl(DiyUploadParam p) => throw new NotSupportedException();
        public Task<DosResult> GetPrivateFileByte(DiyUploadParam p) => throw new NotSupportedException();
        public Task<DosResult> ListObjects(HDFSParam p) => throw new NotSupportedException();
        public Task<DosResult> CreateFolder(HDFSParam p) => throw new NotSupportedException();
        public Task<DosResult> CopyObject(HDFSParam p) => throw new NotSupportedException();
        public Task<DosResult> MoveObject(HDFSParam p) => throw new NotSupportedException();
    }
}
