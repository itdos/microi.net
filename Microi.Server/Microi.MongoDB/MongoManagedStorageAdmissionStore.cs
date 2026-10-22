using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using Dos.Common;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Microi.net
{
    /// <summary>
    /// 固定 Managed 范围的存储准入。单租户单文档中的 Phase 和 Active 同时原子更新，
    /// 防止“确认排空后，旧请求又写入”。在途登记不设 TTL，租约过期不是副作用已结束的证明。
    /// 该内部实现仅注入宿主服务，不暴露到 V8.MongoDb，也不读取可伪造的请求 boolean。
    /// </summary>
    internal sealed class MongoManagedStorageAdmissionStore : IManagedStorageAdmissionStore
    {
        private const string AllowedScope = "platform-chat-runtime";
        private const string CollectionName = "managed_storage_admission";
        private const int MaximumActive = 128;
        private static readonly FilterDefinitionBuilder<BsonDocument> F = Builders<BsonDocument>.Filter;
        private static readonly UpdateDefinitionBuilder<BsonDocument> U = Builders<BsonDocument>.Update;
        private static string Tenant(string tenant, string scope)
        {
            if (scope != AllowedScope || string.IsNullOrWhiteSpace(tenant)
                || !Regex.IsMatch(tenant, "^[A-Za-z0-9_-]{1,80}$"))
                throw new InvalidOperationException("ManagedStorageScopeInvalid");
            return tenant.ToLowerInvariant();
        }
        private static void Token(string value)
        {
            if (value == null || !Regex.IsMatch(value, "^[a-f0-9]{32}$"))
                throw new InvalidOperationException("ManagedStorageIdentityInvalid");
        }
        private static IMongoCollection<BsonDocument> Collection(string tenant, string scope)
        {
            tenant = Tenant(tenant, scope);
            var host = new MongodbHost
            {
                Connection = OsClient.GetClient(tenant).OsClientModel["DbMongoConnection"].Val<string>(),
                DataBase = "diy_chat_" + tenant, Table = CollectionName
            };
            // 准入不能从副本旧快照判断排空，也不能把未多数确认的登记当成执行许可。
            // 只覆盖宿主协议集合，不改变租户业务集合或连接配置。
            return MongodbClient<BsonDocument>.MongodbDatabase(host).GetCollection<BsonDocument>(CollectionName)
                .WithReadPreference(ReadPreference.Primary)
                .WithReadConcern(ReadConcern.Majority)
                .WithWriteConcern(WriteConcern.WMajority);
        }
        private static FilterDefinition<BsonDocument> Key(string tenant, string scope) =>
            F.Eq("_id", scope) & F.Eq("Tenant", tenant) & F.Eq("Schema", 1);
        private static BsonDocument ReadDocument(IMongoCollection<BsonDocument> collection, string tenant, string scope, CancellationToken cancel)
        {
            var document = collection.Find(F.Eq("_id", scope), new FindOptions { MaxTime = TimeSpan.FromSeconds(10) }).FirstOrDefault(cancel);
            if (document != null) Validate(document, tenant, scope);
            return document;
        }
        private static void Validate(BsonDocument document, string tenant, string scope)
        {
            if (document.GetValue("Tenant", "").AsString != tenant || document.GetValue("_id", "").AsString != scope
                || document.GetValue("Schema", 0) != 1 || !document.TryGetValue("Active", out var active) || !active.IsBsonDocument
                || !document.TryGetValue("ActiveCount", out var count) || !count.IsInt32 || count.AsInt32 < 0 || count.AsInt32 > MaximumActive
                || active.AsBsonDocument.ElementCount != count.AsInt32
                || !document.TryGetValue("Maintenance", out var maintenance) || !maintenance.IsBsonDocument
                || maintenance.AsBsonDocument.ElementCount != 0 && maintenance.AsBsonDocument.ElementCount != 2
                || !new[] { "Open", "Draining", "Maintenance" }.Contains(document.GetValue("Phase", "").AsString)
                || document.GetValue("Phase", "").AsString == "Maintenance" && count.AsInt32 != 0)
                throw new InvalidOperationException("ManagedStorageStateInvalid");
            foreach (var entry in active.AsBsonDocument)
            {
                Token(entry.Name);
                if (!entry.Value.IsBsonDocument) throw new InvalidOperationException("ManagedStorageStateInvalid");
                Token(entry.Value.AsBsonDocument.GetValue("ProcessInstance", "").AsString);
            }
            if (maintenance.AsBsonDocument.ElementCount != 0)
            {
                Token(maintenance["Token"].AsString); Token(maintenance["ProcessInstance"].AsString);
                if (document["Phase"].AsString != "Maintenance") throw new InvalidOperationException("ManagedStorageStateInvalid");
            }
        }
        private static void Initialize(IMongoCollection<BsonDocument> collection, string tenant, string scope, CancellationToken cancel)
        {
            var initial = new BsonDocument
            {
                ["_id"] = scope, ["Tenant"] = tenant, ["Schema"] = 1, ["Phase"] = "Open",
                ["Epoch"] = "", ["OperationId"] = "", ["Revision"] = 0L,
                ["Active"] = new BsonDocument(), ["ActiveCount"] = 0, ["Maintenance"] = new BsonDocument()
            };
            try { collection.InsertOne(initial, cancellationToken: cancel); }
            catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { }
        }
        private static ManagedStorageGate Snapshot(BsonDocument document, string tenant, string scope)
        {
            if (document == null) throw new InvalidOperationException("ManagedStorageStateMissing");
            Validate(document, tenant, scope);
            return new ManagedStorageGate
            {
                OsClient = tenant, Scope = scope, Phase = document["Phase"].AsString,
                Epoch = document.GetValue("Epoch", "").AsString, OperationId = document.GetValue("OperationId", "").AsString,
                Revision = document.GetValue("Revision", 0L).ToInt64(), ActiveCount = document["ActiveCount"].AsInt32,
                MaintenanceActiveCount = document["Maintenance"].AsBsonDocument.ElementCount == 0 ? 0 : 1
            };
        }
        private static FindOneAndUpdateOptions<BsonDocument> Options => new FindOneAndUpdateOptions<BsonDocument>
        { ReturnDocument = ReturnDocument.After, MaxTime = TimeSpan.FromSeconds(10) };

        public ManagedStorageTicket Enter(string tenant, string scope, string token, string processInstance)
        {
            tenant = Tenant(tenant, scope); Token(token); Token(processInstance);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var collection = Collection(tenant, scope); var activePath = "Active." + token;
            for (var attempt = 0; attempt < 2; attempt++)
            {
                BsonDocument actual = null;
                try
                {
                    actual = collection.FindOneAndUpdate(Key(tenant, scope) & F.Eq("Phase", "Open")
                        & F.Lt("ActiveCount", MaximumActive) & F.Exists(activePath, false),
                        U.Set(activePath, new BsonDocument { ["ProcessInstance"] = processInstance, ["StartedAt"] = DateTime.UtcNow })
                            .Inc("ActiveCount", 1).Inc("Revision", 1L), Options, deadline.Token);
                }
                catch (Exception error) when (error is MongoException || error is TimeoutException || error is OperationCanceledException)
                {
                    // 未知 ACK 不得执行脚本；只有相同宿主生成身份的持久登记回读成功才算获取准入。
                    using var recover = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    actual = ReadDocument(collection, tenant, scope, recover.Token);
                }
                actual = actual ?? ReadDocument(collection, tenant, scope, deadline.Token);
                if (actual == null)
                {
                    Initialize(collection, tenant, scope, deadline.Token);
                    continue;
                }
                Validate(actual, tenant, scope);
                if (actual["Active"].AsBsonDocument.TryGetValue(token, out var entry)
                    && entry.AsBsonDocument.GetValue("ProcessInstance", "").AsString == processInstance)
                    return new ManagedStorageTicket { Tenant = tenant, Scope = scope, Token = token, ProcessInstance = processInstance };
                throw new InvalidOperationException(actual["Phase"].AsString == "Open" ? "ManagedStorageAdmissionCapacityOrUnknown" : "ManagedStorageMaintenanceInProgress");
            }
            throw new InvalidOperationException("ManagedStorageAdmissionUnknown");
        }

        public ManagedStorageTicket EnterMaintenance(string tenant, string scope, string epoch, string token, string processInstance)
        {
            tenant = Tenant(tenant, scope); Token(epoch); Token(token); Token(processInstance);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var collection = Collection(tenant, scope);
            BsonDocument actual = null;
            try
            {
                actual = collection.FindOneAndUpdate(Key(tenant, scope) & F.Eq("Phase", "Maintenance") & F.Eq("Epoch", epoch)
                    & F.Eq("ActiveCount", 0) & F.Eq("Active", new BsonDocument()) & F.Eq("Maintenance", new BsonDocument()),
                    U.Set("Maintenance", new BsonDocument { ["Token"] = token, ["ProcessInstance"] = processInstance }).Inc("Revision", 1L), Options, deadline.Token);
            }
            catch (Exception error) when (error is MongoException || error is TimeoutException || error is OperationCanceledException) { }
            using var recover = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            actual = actual ?? ReadDocument(collection, tenant, scope, recover.Token);
            var state = Snapshot(actual, tenant, scope);
            var holder = actual["Maintenance"].AsBsonDocument;
            if (state.Epoch != epoch || state.Phase != "Maintenance" || holder.GetValue("Token", "").AsString != token
                || holder.GetValue("ProcessInstance", "").AsString != processInstance)
                throw new InvalidOperationException("ManagedStorageMaintenanceBusyOrUnknown");
            return new ManagedStorageTicket { Tenant = tenant, Scope = scope, Token = token, ProcessInstance = processInstance, IsMaintenance = true };
        }

        public bool Release(ManagedStorageTicket ticket)
        {
            var tenant = Tenant(ticket.Tenant, ticket.Scope); Token(ticket.Token); Token(ticket.ProcessInstance);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var collection = Collection(tenant, ticket.Scope); var activePath = "Active." + ticket.Token;
            BsonDocument result;
            try
            {
                result = ticket.IsMaintenance
                    ? collection.FindOneAndUpdate(Key(tenant, ticket.Scope) & F.Eq("Maintenance.Token", ticket.Token)
                        & F.Eq("Maintenance.ProcessInstance", ticket.ProcessInstance), U.Set("Maintenance", new BsonDocument()).Inc("Revision", 1L), Options, deadline.Token)
                    : collection.FindOneAndUpdate(Key(tenant, ticket.Scope) & F.Eq(activePath + ".ProcessInstance", ticket.ProcessInstance)
                        & F.Gt("ActiveCount", 0), U.Unset(activePath).Inc("ActiveCount", -1).Inc("Revision", 1L), Options, deadline.Token);
            }
            catch (Exception error) when (error is MongoException || error is TimeoutException || error is OperationCanceledException)
            {
                result = null;
            }
            // 不按 TTL/心跳删除在途登记。归还 ACK 未知只回读，失败保留阻塞状态供恢复。
            using var recover = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            result = result ?? ReadDocument(collection, tenant, ticket.Scope, recover.Token);
            if (result == null) return false;
            Validate(result, tenant, ticket.Scope);
            return ticket.IsMaintenance
                ? result["Maintenance"].AsBsonDocument.GetValue("Token", "").AsString != ticket.Token
                : !result["Active"].AsBsonDocument.Contains(ticket.Token);
        }

        public ManagedStorageGate Begin(string tenant, string scope, string operationId, string proposedEpoch)
        {
            tenant = Tenant(tenant, scope); Token(operationId); Token(proposedEpoch);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var collection = Collection(tenant, scope);
            if (ReadDocument(collection, tenant, scope, deadline.Token) == null) Initialize(collection, tenant, scope, deadline.Token);
            var previous = ReadDocument(collection, tenant, scope, deadline.Token);
            if (previous["OperationId"].AsString == operationId) return Snapshot(previous, tenant, scope);
            BsonDocument actual = null;
            try
            {
                actual = collection.FindOneAndUpdate(Key(tenant, scope) & F.Eq("Phase", "Open") & F.Ne("OperationId", operationId),
                    U.Set("Phase", "Draining").Set("Epoch", proposedEpoch).Set("OperationId", operationId).Inc("Revision", 1L), Options, deadline.Token);
            }
            catch (Exception error) when (error is MongoException || error is TimeoutException || error is OperationCanceledException) { }
            using var recover = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            actual = actual ?? ReadDocument(collection, tenant, scope, recover.Token);
            var state = Snapshot(actual, tenant, scope);
            if (state.OperationId != operationId) throw new InvalidOperationException("ManagedStorageMaintenanceBusyOrUnknown");
            return state;
        }
        public ManagedStorageGate Drain(string tenant, string scope, string epoch)
        {
            tenant = Tenant(tenant, scope); Token(epoch);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var collection = Collection(tenant, scope);
            var state = ReadDocument(collection, tenant, scope, deadline.Token);
            if (Snapshot(state, tenant, scope).Epoch != epoch) throw new InvalidOperationException("ManagedStorageEpochMismatch");
            // Active 空集必须和计数同时符合；坏状态绝不能凭计数 0 宣告已排空。
            var result = collection.FindOneAndUpdate(Key(tenant, scope) & F.Eq("Epoch", epoch) & F.Eq("Phase", "Draining")
                & F.Eq("ActiveCount", 0) & F.Eq("Active", new BsonDocument()), U.Set("Phase", "Maintenance").Inc("Revision", 1L), Options, deadline.Token);
            var actual = Snapshot(result ?? ReadDocument(collection, tenant, scope, deadline.Token), tenant, scope);
            if (actual.Epoch != epoch) throw new InvalidOperationException("ManagedStorageEpochMismatch");
            return actual;
        }
        public ManagedStorageGate Read(string tenant, string scope)
        {
            tenant = Tenant(tenant, scope);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            return Snapshot(ReadDocument(Collection(tenant, scope), tenant, scope, deadline.Token), tenant, scope);
        }
        public ManagedStorageGate End(string tenant, string scope, string epoch, long expectedRevision)
        {
            tenant = Tenant(tenant, scope); Token(epoch);
            if (expectedRevision < 0 || expectedRevision == long.MaxValue) throw new InvalidOperationException("ManagedStorageRevisionInvalid");
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var collection = Collection(tenant, scope);
            var previous = ReadDocument(collection, tenant, scope, deadline.Token);
            if (Snapshot(previous, tenant, scope).Epoch != epoch) throw new InvalidOperationException("ManagedStorageEpochMismatch");
            // 业务状态读取后有任一维护请求领取/归还票据，都必须重新校验业务状态。
            // 防止 Abort 读到“尚未开始”，随后 Start 已提交，却仍被旧 Abort 开闸。
            var result = collection.FindOneAndUpdate(Key(tenant, scope) & F.Eq("Epoch", epoch) & F.Eq("Phase", "Maintenance")
                & F.Eq("Revision", expectedRevision)
                & F.Eq("ActiveCount", 0) & F.Eq("Active", new BsonDocument()) & F.Eq("Maintenance", new BsonDocument()),
                U.Set("Phase", "Open").Inc("Revision", 1L), Options, deadline.Token);
            var actual = Snapshot(result ?? ReadDocument(collection, tenant, scope, deadline.Token), tenant, scope);
            if (actual.Epoch != epoch) throw new InvalidOperationException("ManagedStorageEpochMismatch");
            if (actual.Phase != "Open" || actual.Revision != expectedRevision + 1)
                throw new InvalidOperationException("ManagedStorageNotDrainedOrRevisionChanged");
            return actual;
        }
    }
}
