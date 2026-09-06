using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microi.Ops;

if (args.Length == 2 && args[0] == "--certificate")
{
    Directory.CreateDirectory(args[1]);
    using var key = RSA.Create(2048);
    var request = new CertificateRequest("CN=localhost", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    var names = new SubjectAlternativeNameBuilder(); names.AddDnsName("localhost"); names.AddDnsName("host.docker.internal");
    request.CertificateExtensions.Add(names.Build());
    using var cert = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(7));
    File.WriteAllText(Path.Combine(args[1], "fixture-cert.pem"), cert.ExportCertificatePem());
    File.WriteAllText(Path.Combine(args[1], "fixture-key.pem"), key.ExportPkcs8PrivateKeyPem());
    Console.WriteLine("Created local fixture certificate."); return;
}
var output = Path.GetFullPath(args.Length > 0 ? args[0] : Path.Combine(Path.GetTempPath(), "microi-ops-tests-" + Guid.NewGuid().ToString("N")));
Directory.CreateDirectory(output);
var options = new OpsOptions { DataDir = Path.Combine(output, "data"), LogDir = Path.Combine(output, "logs"), AdminUsername = "operator", AdminPassword = "random-test-password" };
var count = 0;
void Check(bool value, string name) { if (!value) throw new Exception("FAILED: " + name); count++; Console.WriteLine("PASS " + name); }
using (var store = new OpsStore(options))
{
    var plan = new UpdatePlan(); store.AddPlan(plan);
    var requestId = Guid.NewGuid().ToString(); var first = store.Enqueue(plan.Id, requestId, "operator");
    var concurrent = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => Task.Run(() => store.Enqueue(plan.Id, requestId, "operator"))));
    Check(concurrent.All(x => x.Id == first.Id) && store.Tasks().Count == 1, "concurrent retry deduplicates task");
    try { store.Enqueue("another-plan", requestId, "operator"); Check(false, "request identity"); } catch (OpsException) { Check(true, "request cannot change plan"); }
    try { store.Enqueue(plan.Id, Guid.NewGuid().ToString(), "operator"); Check(false, "active exclusion"); } catch (OpsException) { Check(true, "one active task per host"); }
    store.Set("platform", new PlatformSession { Account = "old", TokenCipher = "encrypted-old" });
    var expected = store.Get<PlatformSession>("platform")!;
    store.Set<PlatformSession?>("platform", null);
    Check(!store.CompareExchange("platform", expected, new PlatformSession { Account = "old" }), "late flush cannot undo logout");
    store.Set("policy", new UpdatePolicy { Mode = "Automatic" });
    var oldPolicy = store.Get<UpdatePolicy>("policy")!;
    store.Set("policy", new UpdatePolicy { Mode = "Manual" });
    Check(!store.CompareExchange("policy", oldPolicy, new UpdatePolicy { Mode = "Automatic" }), "late scheduler cannot re-enable automatic mode");
    var entry = new OpsEvent { OccurredAt = DateTimeOffset.UtcNow.AddMonths(-1), Action = "UpdateSucceeded" };
    store.AddEvent(entry, "platform-a"); store.AddEvent(entry, "platform-a");
    Check(store.PendingEvents("platform-a") == 1 && store.PendingEvents("platform-b") == 0, "outbox is idempotent and platform-bound");
    store.EventResult(entry.EventId, false); Check(store.PendingEvents("platform-a") == 1, "failed delivery keeps durable event");
    store.EventResult(entry.EventId, true); Check(store.PendingEvents("platform-a") == 0, "receipt acknowledges one event");
    var pendingOld = new OpsEvent { OccurredAt = DateTimeOffset.UtcNow.AddDays(-40), Action = "UpdateFailed" };
    store.AddEvent(pendingOld, "platform-a");
    var unused = new UpdatePlan { Created = DateTimeOffset.UtcNow.AddDays(-40) }; store.AddPlan(unused);
    store.PruneDelivered(14);
    Check(store.Events().Any(x => x.EventId == pendingOld.EventId) && !store.Events().Any(x => x.EventId == entry.EventId), "retention preserves pending events and removes acknowledged events");
    try { store.Plan(unused.Id); Check(false, "unused plan pruning"); } catch (OpsException) { Check(store.Plan(plan.Id).Id == plan.Id, "retention preserves task plans and removes unused plans"); }
    var blockedPath = Path.Combine(output, "not-a-directory"); File.WriteAllText(blockedPath, "fixture");
    var audit = new OpsAudit(store, new OpsOptions { LogDir = blockedPath });
    audit.Write("TxtFailure", "operator", "The durable record must survive a TXT path failure.");
    Check(audit.LastFileError.Length > 0 && store.Events().Any(x => x.Action == "TxtFailure"), "TXT failure preserves durable audit without failing the operation");
    first.State = "Succeeded"; store.SaveTask(first);
    Check(store.FindTask(requestId, true)?.Id == first.Id, "completed task remains retrievable by stable request");
    try { using var other = new OpsStore(options); Check(false, "instance lock"); } catch (IOException) { Check(true, "second controller cannot open same state volume"); }
}
using (var reopened = new OpsStore(options)) Check(reopened.Get<UpdatePolicy>("policy")?.Mode == "Manual" && reopened.Tasks().Count == 1, "reopen preserves policy and task history");
Check(options.ValidatePassword("operator", "random-test-password") && !options.ValidatePassword("operator", "wrong"), "independent credential verification");
Check(new UpdatePolicy { WindowStartHour = 22, WindowEndHour = 3, TimeZone = "UTC" }.InWindow(DateTimeOffset.Parse("2026-09-06T01:00:00Z")), "maintenance window crosses midnight");
Check(!Redaction.Clean("password=do-not-log token=private https://name:pwd@host/").Contains("do-not-log"), "sensitive diagnostics redacted");
Check(!Redaction.Clean("{\"password\":\"quoted secret with spaces\"}").Contains("with spaces"), "quoted secrets do not leak suffixes");
Check(!Redaction.Clean("Authorization: Bearer private-token").Contains("private-token"), "bearer authorization is redacted");
var unrelated = System.Text.Json.Nodes.JsonNode.Parse("{\"Config\":{\"Cmd\":[\"--interval\",\"300\",\"other-app\"]}}");
Check(UpdateCoordinator.ExplicitWatchtowerTargets(unrelated)?.SetEquals(new[] { "other-app" }) == true, "unrelated explicit Watchtower scope is recognized");
Check(UpdateCoordinator.ExplicitWatchtowerTargets(System.Text.Json.Nodes.JsonNode.Parse("{\"Config\":{\"Cmd\":[\"--scope\",\"unknown\"]}}")) == null, "unknown Watchtower scope never assumed safe");
Console.WriteLine($"All {count} Ops regression checks passed. Evidence: {output}");
