using System;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        private const string PageResourceType = "Page";
        private const string PageVersionTable = "mci_resource_version";

        public static async Task<DosResult<object>> SavePageEngineVersioned(
            string osClient,
            string pageId,
            string title,
            string number,
            string desc,
            string jsonStr,
            string routePath = null,
            string componentPath = null,
            string expectedCurrentHash = null,
            string changeSummary = null,
            object currentToken = null)
        {
            try
            {
                var normalized = NormalizePageEngineJsonObj(jsonStr);
                if (!normalized.Ok) return new DosResult<object>(0, null, normalized.Msg);
                jsonStr = normalized.Value;
                changeSummary = (changeSummary ?? "保存界面引擎配置").Trim();
                if (changeSummary.Length > 2000)
                    return new DosResult<object>(0, null, "ChangeSummary 最多 2000 个字符");

                if (string.IsNullOrWhiteSpace(pageId))
                {
                    var created = await SavePageEngine(osClient, pageId, title, number, desc, jsonStr,
                        routePath, componentPath).ConfigureAwait(false);
                    if (created.Code != 1) return created;
                    var createdObject = JObject.FromObject(created.Data ?? new { });
                    pageId = createdObject["PageId"].Val<string>();
                    var createdRow = await LoadPageEngineRow(osClient, pageId).ConfigureAwait(false);
                    if (createdRow == null)
                        return new DosResult<object>(0, null, "界面创建成功但回读失败");
                    var snapshot = BuildPageEngineSnapshot(createdRow);
                    var hash = ComputeBlueprintContentHash(snapshot.ToString(Formatting.None));
                    var historyAvailable = PageVersionStoreAvailable(osClient);
                    string historyId = null;
                    if (historyAvailable)
                    {
                        var user = ExtractBlueprintUser(currentToken);
                        historyId = InsertPageVersion(BpDbWrite(osClient), pageId, snapshot, hash,
                            changeSummary, user.userId, user.userName);
                    }
                    return new DosResult<object>(1, new
                    {
                        Message = $"界面引擎 [{title}] 创建成功",
                        PageId = pageId,
                        CurrentHash = hash,
                        HistoryId = historyId,
                        HistoryAvailable = historyAvailable
                    });
                }

                var current = await LoadPageEngineRow(osClient, pageId).ConfigureAwait(false);
                if (current == null) return new DosResult<object>(2, null, "页面不存在");
                var currentSnapshot = BuildPageEngineSnapshot(current);
                var currentHash = ComputeBlueprintContentHash(currentSnapshot.ToString(Formatting.None));
                if (!string.IsNullOrWhiteSpace(expectedCurrentHash) &&
                    !string.Equals(currentHash, expectedCurrentHash, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(0, new
                    {
                        Conflict = true,
                        ExpectedCurrentHash = expectedCurrentHash,
                        ActualCurrentHash = currentHash,
                        PageId = pageId
                    }, "界面已被其他用户或节点修改，请重新加载后再保存");
                }

                var targetRow = new JObject
                {
                    ["Id"] = pageId,
                    ["Title"] = string.IsNullOrWhiteSpace(title) ? current["Title"] : title,
                    ["Number"] = string.IsNullOrWhiteSpace(number) ? current["Number"] : number,
                    ["Desc"] = string.IsNullOrWhiteSpace(desc) ? current["Desc"] : desc,
                    ["RoutePath"] = string.IsNullOrWhiteSpace(routePath) ? current["RoutePath"] : routePath,
                    ["ComponentPath"] = string.IsNullOrWhiteSpace(componentPath) ? current["ComponentPath"] : componentPath,
                    ["JsonObj"] = jsonStr
                };
                var targetSnapshot = BuildPageEngineSnapshot(targetRow);
                var targetHash = ComputeBlueprintContentHash(targetSnapshot.ToString(Formatting.None));
                if (string.Equals(currentHash, targetHash, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"界面引擎 [{targetRow["Title"].Val<string>()}] 内容未变化",
                        PageId = pageId,
                        CurrentHash = currentHash,
                        Unchanged = true,
                        HistoryAvailable = PageVersionStoreAvailable(osClient)
                    });
                }

                var historyEnabled = PageVersionStoreAvailable(osClient);
                var actor = ExtractBlueprintUser(currentToken);
                string versionId = null;
                using (var trans = BpDbWrite(osClient).BeginTransaction())
                {
                    try
                    {
                        var affected = UpdatePageEngineInTransaction(trans, current, targetRow);
                        if (affected != 1) throw new PageEngineConcurrencyException();
                        if (historyEnabled)
                        {
                            versionId = InsertPageVersion(trans, pageId, targetSnapshot, targetHash,
                                changeSummary, actor.userId, actor.userName);
                        }
                        trans.Commit();
                    }
                    catch
                    {
                        try { trans.Rollback(); } catch { }
                        throw;
                    }
                }

                return new DosResult<object>(1, new
                {
                    Message = $"界面引擎 [{targetRow["Title"].Val<string>()}] 更新成功",
                    PageId = pageId,
                    PreviousHash = currentHash,
                    CurrentHash = targetHash,
                    HistoryId = versionId,
                    HistoryAvailable = historyEnabled,
                    Unchanged = false
                });
            }
            catch (PageEngineConcurrencyException)
            {
                return new DosResult<object>(0, new { Conflict = true }, "界面在保存过程中已发生变化，请重新加载后再操作");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存界面引擎失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ListPageEngineHistory(
            string osClient, string pageId, int pageIndex = 1, int pageSize = 50)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(pageId)) return new DosResult<object>(0, null, "PageId 不能为空");
                if (!PageVersionStoreAvailable(osClient)) return PageVersionStoreMissing();
                var page = await LoadPageEngineRow(osClient, pageId).ConfigureAwait(false);
                if (page == null) return new DosResult<object>(2, null, "页面不存在");
                pageIndex = Math.Max(1, pageIndex);
                pageSize = Math.Max(1, Math.Min(100, pageSize));
                var offset = (pageIndex - 1) * pageSize;
                var total = Convert.ToInt32(BpDbRead(osClient).FromSql(
                        "SELECT COUNT(*) FROM `mci_resource_version` WHERE `ResourceType`=?type AND `ResourceId`=?id AND (`IsDeleted` IS NULL OR `IsDeleted`=0)")
                    .AddInParameter("?type", PageResourceType).AddInParameter("?id", pageId).ToScalar() ?? 0);
                var rows = ReadRowsAsJArray(BpDbRead(osClient).FromSql(
                        "SELECT `Id`,`ResourceId`,`ResourceKey`,`VersionNo`,`ContentHash`,`SourceVersionId`,`ChangeSummary`,`Status`,`PublishedTime`,`CreateTime`,`UserId`,`UserName` " +
                        "FROM `mci_resource_version` WHERE `ResourceType`=?type AND `ResourceId`=?id AND (`IsDeleted` IS NULL OR `IsDeleted`=0) " +
                        "ORDER BY `CreateTime` DESC " + BuildSafePaginationClause(offset, pageSize))
                    .AddInParameter("?type", PageResourceType).AddInParameter("?id", pageId));
                var currentSnapshot = BuildPageEngineSnapshot(page);
                return new DosResult<object>(1, new
                {
                    PageId = pageId,
                    PageTitle = page["Title"].Val<string>(),
                    CurrentHash = ComputeBlueprintContentHash(currentSnapshot.ToString(Formatting.None)),
                    Total = total,
                    PageIndex = pageIndex,
                    PageSize = pageSize,
                    Items = rows
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取界面历史失败：" + ex.Message);
            }
        }

        public static Task<DosResult<object>> GetPageEngineHistory(string osClient, string pageId, string historyId)
        {
            try
            {
                if (!PageVersionStoreAvailable(osClient)) return Task.FromResult(PageVersionStoreMissing());
                var history = LoadPageVersion(osClient, pageId, historyId);
                if (history == null) return Task.FromResult(new DosResult<object>(2, null, "目标界面历史不存在或不属于当前页面"));
                return Task.FromResult(new DosResult<object>(1, (object)history));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取界面历史详情失败：" + ex.Message));
            }
        }

        public static async Task<DosResult<object>> ComparePageEngineVersions(
            string osClient, string pageId, string leftHistoryId = null, string rightHistoryId = null)
        {
            try
            {
                if (!PageVersionStoreAvailable(osClient)) return PageVersionStoreMissing();
                var page = await LoadPageEngineRow(osClient, pageId).ConfigureAwait(false);
                if (page == null) return new DosResult<object>(2, null, "页面不存在");
                JObject left;
                if (string.IsNullOrWhiteSpace(leftHistoryId))
                {
                    var latest = ReadRowsAsJArray(BpDbRead(osClient).FromSql(
                            "SELECT `Id`,`VersionNo`,`ContentHash`,`SnapshotJson`,`ChangeSummary`,`CreateTime`,`UserName` FROM `mci_resource_version` " +
                            "WHERE `ResourceType`=?type AND `ResourceId`=?id AND (`IsDeleted` IS NULL OR `IsDeleted`=0) ORDER BY `CreateTime` DESC LIMIT 1")
                        .AddInParameter("?type", PageResourceType).AddInParameter("?id", pageId));
                    left = latest.FirstOrDefault() as JObject;
                }
                else left = LoadPageVersion(osClient, pageId, leftHistoryId);
                if (left == null) return new DosResult<object>(2, null, "左侧历史版本不存在");

                var rightIsCurrent = string.IsNullOrWhiteSpace(rightHistoryId);
                JObject right;
                if (rightIsCurrent)
                {
                    var snapshot = BuildPageEngineSnapshot(page);
                    right = new JObject
                    {
                        ["Id"] = pageId,
                        ["VersionNo"] = "current",
                        ["ContentHash"] = ComputeBlueprintContentHash(snapshot.ToString(Formatting.None)),
                        ["SnapshotJson"] = snapshot.ToString(Formatting.None),
                        ["ChangeSummary"] = "当前草稿",
                        ["CreateTime"] = page["UpdateTime"]
                    };
                }
                else right = LoadPageVersion(osClient, pageId, rightHistoryId);
                if (right == null) return new DosResult<object>(2, null, "右侧历史版本不存在");
                var leftJson = left["SnapshotJson"].Val<string>() ?? "{}";
                var rightJson = right["SnapshotJson"].Val<string>() ?? "{}";
                if (leftJson.Length > BlueprintDiffMaxJsonChars || rightJson.Length > BlueprintDiffMaxJsonChars)
                    return new DosResult<object>(0, null, "界面内容超过在线差异比较上限，请导出后离线比较");
                var diff = BuildBlueprintJsonDiff(leftJson, rightJson, BlueprintDiffMaxChanges);
                diff["PageId"] = pageId;
                diff["PageTitle"] = page["Title"].Val<string>() ?? "";
                diff["Left"] = BuildPageVersionDescriptor(left, false);
                diff["Right"] = BuildPageVersionDescriptor(right, rightIsCurrent);
                return new DosResult<object>(1, diff);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "比较界面版本失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ExportPageEngine(string osClient, string pageId)
        {
            try
            {
                var page = await LoadPageEngineRow(osClient, pageId).ConfigureAwait(false);
                if (page == null) return new DosResult<object>(2, null, "页面不存在");
                var snapshot = BuildPageEngineSnapshot(page);
                return new DosResult<object>(1, new
                {
                    FileName = $"{SafePageFileName(page["Number"].Val<string>() ?? page["Title"].Val<string>() ?? pageId)}.microi-page.json",
                    ContentType = "application/json;charset=utf-8",
                    ContentHash = ComputeBlueprintContentHash(snapshot.ToString(Formatting.None)),
                    Snapshot = snapshot
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "导出界面失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> RollbackPageEngine(
            string osClient, JObject param, object currentToken = null)
        {
            try
            {
                if (!PageVersionStoreAvailable(osClient)) return PageVersionStoreMissing();
                var pageId = param?["PageId"].Val<string>();
                var historyId = param?["HistoryId"].Val<string>();
                var expectedHash = param?["ExpectedCurrentHash"].Val<string>();
                if (string.IsNullOrWhiteSpace(pageId) || string.IsNullOrWhiteSpace(historyId) || string.IsNullOrWhiteSpace(expectedHash))
                    return new DosResult<object>(0, null, "PageId、HistoryId和ExpectedCurrentHash不能为空");
                var current = await LoadPageEngineRow(osClient, pageId).ConfigureAwait(false);
                if (current == null) return new DosResult<object>(2, null, "页面不存在");
                var currentSnapshot = BuildPageEngineSnapshot(current);
                var currentHash = ComputeBlueprintContentHash(currentSnapshot.ToString(Formatting.None));
                if (!string.Equals(currentHash, expectedHash, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(0, new { Conflict = true, ExpectedCurrentHash = expectedHash, ActualCurrentHash = currentHash },
                        "界面已被其他用户或节点修改，请重新比较后再回滚");
                }
                var targetVersion = LoadPageVersion(osClient, pageId, historyId);
                if (targetVersion == null) return new DosResult<object>(2, null, "目标界面历史不存在或不属于当前页面");
                var targetSnapshot = JObject.Parse(targetVersion["SnapshotJson"].Val<string>() ?? "{}");
                var targetRow = PageRowFromSnapshot(targetSnapshot, pageId);
                var normalized = NormalizePageEngineJsonObj(ToJsonString(targetRow["JsonObj"]));
                if (!normalized.Ok) return new DosResult<object>(0, null, "目标历史快照损坏：" + normalized.Msg);
                targetRow["JsonObj"] = normalized.Value;
                var normalizedTargetSnapshot = BuildPageEngineSnapshot(targetRow);
                var targetHash = ComputeBlueprintContentHash(normalizedTargetSnapshot.ToString(Formatting.None));
                if (string.Equals(currentHash, targetHash, StringComparison.OrdinalIgnoreCase))
                    return new DosResult<object>(1, new { PageId = pageId, HistoryId = historyId, CurrentHash = currentHash, Reused = true }, "目标版本已是当前版本");
                var changeSummary = param?["ChangeSummary"].Val<string>() ?? $"回滚到界面历史 {historyId}";
                if (changeSummary.Length > 2000) return new DosResult<object>(0, null, "ChangeSummary 最多 2000 个字符");
                var actor = ExtractBlueprintUser(currentToken);
                string rollbackVersionId;
                using (var trans = BpDbWrite(osClient).BeginTransaction())
                {
                    try
                    {
                        var affected = UpdatePageEngineInTransaction(trans, current, targetRow);
                        if (affected != 1) throw new PageEngineConcurrencyException();
                        rollbackVersionId = InsertPageVersion(trans, pageId, normalizedTargetSnapshot, targetHash,
                            changeSummary, actor.userId, actor.userName, historyId);
                        trans.Commit();
                    }
                    catch
                    {
                        try { trans.Rollback(); } catch { }
                        throw;
                    }
                }
                return new DosResult<object>(1, new
                {
                    PageId = pageId,
                    HistoryId = historyId,
                    RollbackVersionId = rollbackVersionId,
                    PreviousHash = currentHash,
                    CurrentHash = targetHash,
                    RolledBack = true
                }, "界面已按历史快照回滚，并创建新的审计版本");
            }
            catch (PageEngineConcurrencyException)
            {
                return new DosResult<object>(0, new { Conflict = true }, "界面在回滚过程中已发生变化，请重新读取后再操作");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "回滚界面失败：" + ex.Message);
            }
        }

        internal static JObject BuildPageEngineSnapshotForTest(JObject row) => BuildPageEngineSnapshot(row);

        private static async Task<JObject> LoadPageEngineRow(string osClient, string pageId)
        {
            if (string.IsNullOrWhiteSpace(pageId)) return null;
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mic_page", new
            {
                OsClient = osClient,
                Id = pageId,
                _SelectFields = new[] { "Id", "Title", "Number", "Desc", "RoutePath", "ComponentPath", "JsonObj", "CreateTime", "UpdateTime", "OsClient" }
            }).ConfigureAwait(false);
            if (result.Code != 1 || result.Data == null) return null;
            return result.Data as JObject ?? JObject.FromObject(result.Data);
        }

        private static JObject BuildPageEngineSnapshot(JObject row)
        {
            var normalized = NormalizePageEngineJsonObj(ToJsonString(row?["JsonObj"]));
            if (!normalized.Ok) throw new InvalidOperationException(normalized.Msg);
            return new JObject
            {
                ["SchemaVersion"] = "microi.page.v1",
                ["Page"] = new JObject
                {
                    ["Id"] = row?["Id"].Val<string>() ?? "",
                    ["Title"] = row?["Title"].Val<string>() ?? "",
                    ["Number"] = row?["Number"].Val<string>() ?? "",
                    ["Desc"] = row?["Desc"].Val<string>() ?? "",
                    ["RoutePath"] = row?["RoutePath"].Val<string>() ?? "",
                    ["ComponentPath"] = row?["ComponentPath"].Val<string>() ?? "",
                    ["JsonObj"] = JToken.Parse(normalized.Value)
                }
            };
        }

        private static JObject PageRowFromSnapshot(JObject snapshot, string pageId)
        {
            var page = snapshot?["Page"] as JObject ?? snapshot;
            if (page == null) throw new InvalidOperationException("界面快照缺少 Page 对象");
            return new JObject
            {
                ["Id"] = pageId,
                ["Title"] = page["Title"].Val<string>() ?? "",
                ["Number"] = page["Number"].Val<string>() ?? "",
                ["Desc"] = page["Desc"].Val<string>() ?? "",
                ["RoutePath"] = page["RoutePath"].Val<string>() ?? "",
                ["ComponentPath"] = page["ComponentPath"].Val<string>() ?? "",
                ["JsonObj"] = page["JsonObj"]?.DeepClone() ?? new JObject()
            };
        }

        private static int UpdatePageEngineInTransaction(
            Dos.ORM.DbTrans trans, JObject current, JObject target)
        {
            return trans.FromSql("UPDATE `mic_page` SET `Title`=?title,`Number`=?number,`Desc`=?desc,`RoutePath`=?route,`ComponentPath`=?component,`JsonObj`=?json,`UpdateTime`=NOW() " +
                    "WHERE `Id`=?id " +
                    "AND COALESCE(`Title`,'')=?oldTitle AND COALESCE(`Number`,'')=?oldNumber AND COALESCE(`Desc`,'')=?oldDesc " +
                    "AND COALESCE(`RoutePath`,'')=?oldRoute AND COALESCE(`ComponentPath`,'')=?oldComponent AND COALESCE(`JsonObj`,'')=?oldJson")
                .AddInParameter("?title", target["Title"].Val<string>() ?? "")
                .AddInParameter("?number", target["Number"].Val<string>() ?? "")
                .AddInParameter("?desc", target["Desc"].Val<string>() ?? "")
                .AddInParameter("?route", target["RoutePath"].Val<string>() ?? "")
                .AddInParameter("?component", target["ComponentPath"].Val<string>() ?? "")
                .AddInParameter("?json", ToJsonString(target["JsonObj"]))
                .AddInParameter("?id", current["Id"].Val<string>())
                .AddInParameter("?oldTitle", current["Title"].Val<string>() ?? "")
                .AddInParameter("?oldNumber", current["Number"].Val<string>() ?? "")
                .AddInParameter("?oldDesc", current["Desc"].Val<string>() ?? "")
                .AddInParameter("?oldRoute", current["RoutePath"].Val<string>() ?? "")
                .AddInParameter("?oldComponent", current["ComponentPath"].Val<string>() ?? "")
                .AddInParameter("?oldJson", ToJsonString(current["JsonObj"]))
                .ExecuteNonQuery();
        }

        private static string InsertPageVersion(
            Dos.ORM.DbSession session, string pageId, JObject snapshot, string hash,
            string summary, string userId, string userName, string sourceVersionId = null)
        {
            var page = snapshot["Page"] as JObject ?? new JObject();
            var id = Ulid.NewUlid().ToString();
            session.FromSql("INSERT INTO `mci_resource_version` " +
                    "(`Id`,`ResourceType`,`ResourceId`,`ResourceKey`,`VersionNo`,`ContentHash`,`SnapshotJson`,`SourceVersionId`,`ChangeSummary`,`Status`,`PublishedTime`,`CreateTime`,`UpdateTime`,`UserId`,`UserName`,`IsDeleted`) " +
                    "VALUES(?id,?type,?rid,?rkey,?version,?hash,?snapshot,?source,?summary,'Published',NOW(),NOW(),NOW(),?uid,?unm,0)")
                .AddInParameter("?id", id).AddInParameter("?type", PageResourceType)
                .AddInParameter("?rid", pageId).AddInParameter("?rkey", page["Number"].Val<string>() ?? pageId)
                .AddInParameter("?version", DateTime.UtcNow.ToString("yyyyMMddHHmmssfff"))
                .AddInParameter("?hash", hash).AddInParameter("?snapshot", snapshot.ToString(Formatting.None))
                .AddInParameter("?source", sourceVersionId ?? "").AddInParameter("?summary", summary ?? "")
                .AddInParameter("?uid", userId ?? "").AddInParameter("?unm", userName ?? "")
                .ExecuteNonQuery();
            return id;
        }

        private static string InsertPageVersion(
            Dos.ORM.DbTrans trans, string pageId, JObject snapshot, string hash,
            string summary, string userId, string userName, string sourceVersionId = null)
        {
            var page = snapshot["Page"] as JObject ?? new JObject();
            var id = Ulid.NewUlid().ToString();
            trans.FromSql("INSERT INTO `mci_resource_version` " +
                    "(`Id`,`ResourceType`,`ResourceId`,`ResourceKey`,`VersionNo`,`ContentHash`,`SnapshotJson`,`SourceVersionId`,`ChangeSummary`,`Status`,`PublishedTime`,`CreateTime`,`UpdateTime`,`UserId`,`UserName`,`IsDeleted`) " +
                    "VALUES(?id,?type,?rid,?rkey,?version,?hash,?snapshot,?source,?summary,'Published',NOW(),NOW(),NOW(),?uid,?unm,0)")
                .AddInParameter("?id", id).AddInParameter("?type", PageResourceType)
                .AddInParameter("?rid", pageId).AddInParameter("?rkey", page["Number"].Val<string>() ?? pageId)
                .AddInParameter("?version", DateTime.UtcNow.ToString("yyyyMMddHHmmssfff"))
                .AddInParameter("?hash", hash).AddInParameter("?snapshot", snapshot.ToString(Formatting.None))
                .AddInParameter("?source", sourceVersionId ?? "").AddInParameter("?summary", summary ?? "")
                .AddInParameter("?uid", userId ?? "").AddInParameter("?unm", userName ?? "")
                .ExecuteNonQuery();
            return id;
        }

        private static JObject LoadPageVersion(string osClient, string pageId, string historyId)
        {
            if (string.IsNullOrWhiteSpace(pageId) || string.IsNullOrWhiteSpace(historyId)) return null;
            var rows = ReadRowsAsJArray(BpDbRead(osClient).FromSql(
                    "SELECT `Id`,`ResourceId`,`ResourceKey`,`VersionNo`,`ContentHash`,`SnapshotJson`,`SourceVersionId`,`ChangeSummary`,`Status`,`PublishedTime`,`CreateTime`,`UserId`,`UserName` " +
                    "FROM `mci_resource_version` WHERE `ResourceType`=?type AND `ResourceId`=?rid AND `Id`=?id AND (`IsDeleted` IS NULL OR `IsDeleted`=0) LIMIT 1")
                .AddInParameter("?type", PageResourceType).AddInParameter("?rid", pageId).AddInParameter("?id", historyId));
            return rows.FirstOrDefault() as JObject;
        }

        private static JObject BuildPageVersionDescriptor(JObject source, bool isCurrent)
        {
            return new JObject
            {
                ["Id"] = source?["Id"].Val<string>() ?? "",
                ["VersionNo"] = source?["VersionNo"].Val<string>() ?? "",
                ["ChangeSummary"] = source?["ChangeSummary"].Val<string>() ?? "",
                ["CreateTime"] = source?["CreateTime"].Val<string>() ?? "",
                ["UserName"] = source?["UserName"].Val<string>() ?? "",
                ["ContentHash"] = source?["ContentHash"].Val<string>() ?? "",
                ["IsCurrent"] = isCurrent
            };
        }

        private static bool PageVersionStoreAvailable(string osClient)
        {
            try { return OsClientExtend.GetClient(osClient)?.Db?.TableExists(PageVersionTable) == true; }
            catch { return false; }
        }

        private static DosResult<object> PageVersionStoreMissing()
        {
            return new DosResult<object>(0, new { RequiredTable = PageVersionTable, RequiredApplication = "ai-platform-studio" },
                "界面版本治理尚未安装，请先安装或更新 Microi吾码 AI 平台治理中心应用");
        }

        private static string SafePageFileName(string value)
        {
            var invalid = System.IO.Path.GetInvalidFileNameChars();
            var safe = new string((value ?? "page").Select(c => invalid.Contains(c) ? '_' : c).ToArray()).Trim();
            return string.IsNullOrWhiteSpace(safe) ? "page" : safe;
        }

        private sealed class PageEngineConcurrencyException : Exception
        {
        }
    }
}
