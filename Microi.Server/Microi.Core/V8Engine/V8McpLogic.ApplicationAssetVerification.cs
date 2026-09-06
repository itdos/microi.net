using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        private const string ApplicationAssetVerificationContract = "microi-release-verification/1";
        private const int ApplicationAssetVerificationBatchFiles = 32;

        private static DosResult<object> ReadApplicationAssetV3VerificationStatus(string osClient, JObject app, JObject param)
        {
            var error = ParseApplicationAssetV3ProtocolRequest(param, out var request);
            if (error != null) return new DosResult<object>(0, null, error);
            error = BuildApplicationAssetV3PublishPlan(osClient, app, param, request, out var plan);
            if (error != null) return new DosResult<object>(0, null, error);
            var appId = SafeJString(app, "Id");
            var versions = ReadApplicationAssetV3VersionRowsStrong(osClient, appId, plan.VersionNo, null, false);
            if (versions.Count != 1 || SafeJString(versions[0], "PublishState") != "Verifying") return null;
            var version = versions[0];
            error = ValidateApplicationAssetV3VersionImmutableFacts(version,
                BuildApplicationStreamRecordId("version", osClient, appId, plan.VersionNo + "\n" + request.RequestFingerprint),
                request, plan, BuildApplicationAssetV3BuildLog(request, plan).ToString(Formatting.None));
            if (error != null) return new DosResult<object>(0, null, "冻结校验请求冲突：" + error);
            return request.PublishMode == "stage" ? BuildApplicationAssetVerificationPending(app, version, request, plan)
                : new DosResult<object>(0, new { RetrySafe = true, VersionId = SafeJString(version, "Id") },
                    "后台校验尚未完成；请查询同一 stage 请求，等待 ReleaseVerified 后 finalize。");
        }

        // Checkpoint 仅保存在受保护的平台版本行中，不接受客户端进度或客户端校验结论。
        private static JObject ReadApplicationAssetVerificationCheckpoint(JObject version)
        {
            try
            {
                var checkpoint = JObject.Parse(SafeJString(version, "Remark"));
                return checkpoint.Value<string>("Contract") == ApplicationAssetVerificationContract
                    ? checkpoint : null;
            }
            catch { return null; }
        }

        public static bool ValidateApplicationAssetVerificationProgress(
            string actualHash, string expectedHash, int count, int total, long bytes, long totalBytes)
        {
            return !string.IsNullOrWhiteSpace(expectedHash)
                && string.Equals(actualHash, expectedHash, StringComparison.Ordinal)
                && count >= 0 && count <= total && total > 0
                && bytes >= 0 && bytes <= totalBytes
                && (count != total || bytes == totalBytes);
        }

        private static bool HasApplicationAssetV3VerificationProof(
            JObject version, ApplicationAssetV3ProtocolRequest request, ApplicationAssetV3PublishPlan plan)
        {
            var checkpoint = ReadApplicationAssetVerificationCheckpoint(version);
            if (checkpoint == null || !TryParseApplicationAssetV3PublishState(version, out var state)
                || (state != ApplicationAssetV3PublishState.ReleaseVerified && !IsApplicationAssetV3PointerCommittedState(state)))
                return false;
            return checkpoint.Value<bool?>("Complete") == true
                && checkpoint.Value<int?>("VerifiedCount") == plan.FileCount
                && checkpoint.Value<long?>("VerifiedBytes") == plan.TotalSize
                && checkpoint.Value<string>("RuntimeManifestHash") == plan.RuntimeManifestHash
                && checkpoint.Value<string>("RequestFingerprint") == request.RequestFingerprint
                && checkpoint.Value<string>("RequestId") == request.RequestId
                && ValidateApplicationAssetV3VersionImmutableFacts(version,
                    SafeJString(version, "Id"), request, plan,
                    BuildApplicationAssetV3BuildLog(request, plan).ToString(Formatting.None)) == null;
        }

        private static DosResult<object> BuildApplicationAssetVerificationPending(
            JObject app, JObject version, ApplicationAssetV3ProtocolRequest request, ApplicationAssetV3PublishPlan plan)
        {
            var checkpoint = ReadApplicationAssetVerificationCheckpoint(version);
            // 复用既有回执的完整身份、门禁、路径和 CAS 字段，但明确标示未校验、未提交。
            var staged = BuildApplicationAssetV3StageResult(app, version, request, plan, true);
            var data = JObject.FromObject(staged.Data);
            data["PhaseState"] = "Verifying";
            data["PublishState"] = "Verifying";
            data["Pending"] = true;
            data["Completed"] = false;
            data["PointerState"] = "Uncommitted";
            data["RetryAfterMs"] = 5000;
            data["VerificationTaskId"] = SafeJString(version, "Id");
            data["VerifiedCount"] = checkpoint?.Value<int?>("VerifiedCount") ?? 0;
            data["VerifiedBytes"] = checkpoint?.Value<long?>("VerifiedBytes") ?? 0;
            data["TotalCount"] = plan.FileCount;
            data["TotalBytes"] = plan.TotalSize;
            data["LastError"] = SafeJString(version, "LastError");
            data["RetrySafe"] = true;
            return new DosResult<object>(1, data, "发布目录正在后台逐字节校验；请用同一冻结请求查询，尚未切换稳定入口。");
        }

        private static async Task<DosResult<object>> StageApplicationAssetV3VerificationAsync(
            string osClient, JObject app, ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan, IMicroiLockLease lease)
        {
            await lease.EnsureHeldAsync().ConfigureAwait(false);
            var appId = SafeJString(app, "Id");
            var versionId = BuildApplicationStreamRecordId("version", osClient, appId,
                plan.VersionNo + "\n" + request.RequestFingerprint);
            var buildLog = BuildApplicationAssetV3BuildLog(request, plan).ToString(Formatting.None);
            var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            using (var trans = OsClientExtend.GetClient(osClient).Db.BeginTransaction())
            {
                var coordinate = ResolveApplicationAssetStreamGateCoordinate(osClient);
                var gate = ReadApplicationAssetStreamGateStrong(osClient, coordinate.OsClientType,
                    coordinate.OsClientNetwork, trans, true);
                var error = ValidateApplicationAssetStreamGate(gate, request.ProtocolVersion, request.ExpectedGateEpoch);
                if (error != null) return new DosResult<object>(0, null, error);
                var lockedApp = ReadApplicationAssetV3AppStrong(osClient, appId, trans, true);
                error = ValidateApplicationStreamIdentity(lockedApp, appId, plan.AppKey);
                if (error != null) return new DosResult<object>(0, null, error);
                var rows = ReadApplicationAssetV3VersionRowsStrong(osClient, appId, plan.VersionNo, trans, true);
                if (rows.Count > 1) return new DosResult<object>(0, null, "同一 AppId+VersionNo 存在多个版本，拒绝入队。");
                if (rows.Count == 1)
                {
                    var version = rows[0];
                    error = ValidateApplicationAssetV3VersionImmutableFacts(version, versionId, request, plan, buildLog);
                    if (error != null) return new DosResult<object>(0, null, "冻结校验请求冲突：" + error);
                    if (!TryParseApplicationAssetV3PublishState(version, out var state))
                        return new DosResult<object>(0, null, "校验任务状态不合法。");
                    if (state == ApplicationAssetV3PublishState.Verifying)
                        return BuildApplicationAssetVerificationPending(lockedApp, version, request, plan);
                    if (state == ApplicationAssetV3PublishState.ReleaseVerified)
                        return BuildApplicationAssetV3StageResult(lockedApp, version, request, plan, true);
                    if (IsApplicationAssetV3PointerCommittedState(state))
                    {
                        error = ValidateApplicationAssetV3StableResolverTarget(osClient, lockedApp, version);
                        return error == null ? BuildApplicationAssetV3StageResult(lockedApp, version, request, plan, true)
                            : new DosResult<object>(0, null, error);
                    }
                    return new DosResult<object>(0, new { VersionId = versionId, RetrySafe = false },
                        "校验未完成：" + SafeJString(version, "LastError"));
                }
                error = ValidateApplicationAssetV3AppExpectedState(lockedApp, request)
                    ?? ValidateApplicationAssetV3ExpectedVersionRow(rows, request, appId, plan.VersionNo, true);
                if (error != null) return new DosResult<object>(0, null, error);
                var fence = BuildApplicationAssetV3NextPublishFence(request.ExpectedPublishFence);
                if (InsertApplicationAssetV3Version(trans, dialect, versionId, lockedApp, request, plan,
                        buildLog, fence, 1L, ApplicationAssetV3PublishState.Verifying) != 1)
                    throw new InvalidOperationException("校验任务持久化失败。");
                var checkpoint = new JObject
                {
                    ["Contract"] = ApplicationAssetVerificationContract,
                    ["RequestId"] = request.RequestId,
                    ["RequestFingerprint"] = request.RequestFingerprint,
                    ["RuntimeManifestHash"] = plan.RuntimeManifestHash,
                    ["VerifiedCount"] = 0, ["VerifiedBytes"] = 0L,
                    ["Complete"] = false, ["Failures"] = 0
                };
                if (trans.FromSql($"UPDATE {Q("mci_ai_app_version")} SET {Q("Remark")}=@checkpoint "
                        + $"WHERE {Q("Id")}=@id AND {Q("RowVersion")}=1 AND {Q("PublishState")}=@state")
                    .AddInParameter("@checkpoint", checkpoint.ToString(Formatting.None))
                    .AddInParameter("@id", versionId).AddInParameter("@state", "Verifying").ExecuteNonQuery() != 1)
                    throw new InvalidOperationException("校验任务初始进度持久化失败。");
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                trans.Commit();
                var snapshot = BuildApplicationAssetV3VersionSnapshot(versionId, appId, request, plan,
                    buildLog, fence, 1L, ApplicationAssetV3PublishState.Verifying);
                snapshot["Remark"] = checkpoint.ToString(Formatting.None);
                return BuildApplicationAssetVerificationPending(lockedApp, snapshot, request, plan);
            }
        }

        private static async Task<DosResult<object>> VerifyApplicationAssetV3BatchAsync(
            string osClient, JObject app, JObject version, IMicroiLockLease lease, CancellationToken cancellationToken)
        {
            var checkpoint = ReadApplicationAssetVerificationCheckpoint(version);
            if (checkpoint == null) return new DosResult<object>(0, null, "校验任务没有可信 checkpoint。");
            if (DateTimeOffset.TryParse(checkpoint.Value<string>("RetryAfterUtc"), out var retryAt)
                && retryAt > DateTimeOffset.UtcNow)
                return new DosResult<object>(1, new { Pending = true }, "依赖暂不可用，等待持久化重试时间。");
            var error = TryRehydrateApplicationAssetV3RecoveryContext(osClient, app, version,
                out var request, out var plan, out var buildLog, beforePointerCommit: true);
            if (error != null)
            {
                await SaveApplicationAssetVerificationCheckpoint(osClient, version, checkpoint,
                    "FailedBeforeCommit", error, lease).ConfigureAwait(false);
                return new DosResult<object>(0, null, error);
            }
            var coordinate = ResolveApplicationAssetStreamGateCoordinate(osClient);
            error = ValidateApplicationAssetStreamGate(ReadApplicationAssetStreamGateStrong(osClient,
                coordinate.OsClientType, coordinate.OsClientNetwork, null, false), request.ProtocolVersion, request.ExpectedGateEpoch);
            if (error != null) return new DosResult<object>(0, null, error);
            error = ValidateApplicationAssetV3VersionImmutableFacts(version, SafeJString(version, "Id"), request, plan, buildLog);
            var verified = checkpoint.Value<int?>("VerifiedCount") ?? -1;
            var verifiedBytes = checkpoint.Value<long?>("VerifiedBytes") ?? -1L;
            if (error != null || checkpoint.Value<string>("RequestId") != request.RequestId
                || checkpoint.Value<string>("RequestFingerprint") != request.RequestFingerprint
                || !ValidateApplicationAssetVerificationProgress(checkpoint.Value<string>("RuntimeManifestHash"),
                    plan.RuntimeManifestHash, verified, plan.FileCount, verifiedBytes, plan.TotalSize)
                || plan.Assets.Take(Math.Max(0, verified)).Sum(asset => asset.Size) != verifiedBytes)
                return new DosResult<object>(0, null, error ?? "校验进度与冻结 manifest 不一致。");

            // 认领先推进数据库 RowVersion。失联旧节点即使仍在读存储，也不能覆盖新节点的进度。
            await SaveApplicationAssetVerificationCheckpoint(osClient, version, checkpoint, "Verifying", null, lease).ConfigureAwait(false);
            var batch = plan.Assets.Skip(verified).Take(ApplicationAssetVerificationBatchFiles).ToList();
            try
            {
                var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                error = await RunApplicationAssetBoundedParallelAsync(batch, async (asset, token) =>
                {
                    token.ThrowIfCancellationRequested();
                    var marker = await ReadApplicationObjectBytes(hdfs, clientModel, asset.Paths.IntegrityMarkerPath).ConfigureAwait(false);
                    var markerError = ValidateApplicationAssetV3IntegrityMarker(marker, plan.Identity,
                        asset.RelativePath, asset.Sha256, asset.Size, request.RequestId);
                    if (markerError != null) return asset.RelativePath + "：" + markerError;
                    token.ThrowIfCancellationRequested();
                    var bytes = await ReadApplicationObjectBytes(hdfs, clientModel, asset.Paths.VersionPath).ConfigureAwait(false);
                    token.ThrowIfCancellationRequested();
                    return ValidateApplicationAssetContent(asset.RelativePath, asset.Size, asset.Sha256, bytes, asset.IsEntry);
                }, cancellationToken, declaredByteSize: asset => asset.Size).ConfigureAwait(false);
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex) { error = ex.GetBaseException().Message; }
            cancellationToken.ThrowIfCancellationRequested();
            if (error != null)
            {
                var failures = (checkpoint.Value<int?>("Failures") ?? 0) + 1;
                checkpoint["Failures"] = failures;
                checkpoint["RetryAfterUtc"] = DateTimeOffset.UtcNow.AddSeconds(Math.Min(300, 15 * failures)).ToString("O");
                await SaveApplicationAssetVerificationCheckpoint(osClient, version, checkpoint,
                    failures >= 5 ? "FailedBeforeCommit" : "Verifying", error, lease).ConfigureAwait(false);
                return new DosResult<object>(0, null, "后台校验未通过：" + error);
            }
            checkpoint["VerifiedCount"] = verified + batch.Count;
            checkpoint["VerifiedBytes"] = verifiedBytes + batch.Sum(asset => asset.Size);
            checkpoint["Failures"] = 0;
            checkpoint.Remove("RetryAfterUtc");
            checkpoint["Complete"] = verified + batch.Count == plan.FileCount;
            checkpoint["VerifiedAtUtc"] = DateTimeOffset.UtcNow.ToString("O");
            var complete = checkpoint.Value<bool>("Complete");
            await SaveApplicationAssetVerificationCheckpoint(osClient, version, checkpoint,
                complete ? "ReleaseVerified" : "Verifying", null, lease).ConfigureAwait(false);
            return new DosResult<object>(1, new { Pending = !complete, Completed = complete,
                VerifiedCount = verified + batch.Count, TotalCount = plan.FileCount }, "后台校验进度已持久化。");
        }

        private static async Task SaveApplicationAssetVerificationCheckpoint(
            string osClient, JObject version, JObject checkpoint, string nextState, string error, IMicroiLockLease lease)
        {
            await lease.EnsureHeldAsync().ConfigureAwait(false);
            var oldRow = SafeApplicationAssetV3Long(version, "RowVersion", -1L);
            if (oldRow < 1 || oldRow == long.MaxValue) throw new InvalidOperationException("校验 RowVersion 不合法。");
            var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            using (var trans = OsClientExtend.GetClient(osClient).Db.BeginTransaction())
            {
                var count = trans.FromSql($"UPDATE {Q("mci_ai_app_version")} SET {Q("Remark")}=@checkpoint,"
                        + $"{Q("RowVersion")}=@nextRow,{Q("PublishState")}=@state,{Q("Status")}=@state,"
                        + $"{Q("LastError")}=@error,{Q("UpdateTime")}=@now "
                        + $"WHERE {Q("Id")}=@id AND {Q("AppId")}=@appId AND {Q("RowVersion")}=@oldRow "
                        + $"AND {Q("PublishState")}=@verifying AND {Q("RequestFingerprint")}=@fingerprint "
                        + $"AND {Q("RuntimeManifestHash")}=@hash AND {Q("FencingToken")}=@fence")
                    .AddInParameter("@checkpoint", checkpoint.ToString(Formatting.None))
                    .AddInParameter("@nextRow", oldRow + 1).AddInParameter("@state", nextState)
                    .AddInParameter("@error", error).AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                    .AddInParameter("@id", SafeJString(version, "Id")).AddInParameter("@appId", SafeJString(version, "AppId"))
                    .AddInParameter("@oldRow", oldRow).AddInParameter("@verifying", "Verifying")
                    .AddInParameter("@fingerprint", SafeJString(version, "RequestFingerprint"))
                    .AddInParameter("@hash", SafeJString(version, "RuntimeManifestHash"))
                    .AddInParameter("@fence", SafeApplicationAssetV3Long(version, "FencingToken", -1L)).ExecuteNonQuery();
                if (count != 1) throw new InvalidOperationException("校验 checkpoint CAS 失败；已保留当前权威进度。");
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                trans.Commit();
            }
            version["RowVersion"] = oldRow + 1;
            version["Remark"] = checkpoint.ToString(Formatting.None);
            version["PublishState"] = nextState;
            version["LastError"] = error;
        }
    }
}
