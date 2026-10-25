#nullable enable
using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Microi.net;
using Xunit;

namespace Microi.Tests.Common;

public sealed class ManagedPublicResourceRouteTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);
    private static readonly byte[] TestKey = Enumerable.Range(1, 32).Select(value => (byte)value).ToArray();
    private const string Hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private const long GiB = 1073741824;

    [Fact]
    public void CompleteTrustedEvidenceAtThresholdRoutesOnlyTheCurrentObject()
    {
        var current = Context();
        using var codec = Codec();
        var proof = Evidence(current);
        var result = ManagedPublicResourceRoute.Resolve(current, codec.IssueForTrustedProducer(proof), codec, Now);
        Assert.True(result.UseBackup);
        Assert.Equal("VerifiedBackup", result.ReasonCode);
        Assert.Equal("https://hub.example.com:1120/public-bucket/itdos/managed-public/v1/" + Hash + "/" + Hash + "/tree.glb", result.SelectedUrl);
        Assert.Equal(proof.TargetConfigHash, result.ConfigHash);
        Assert.Equal(proof.HealthValidUntilUtc, result.ExpiresAtUtc);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Ready")]
    [InlineData("{\"Ready\":true,\"ActualBytes\":1073741824,\"StrictTls\":true}")]
    [InlineData("mfr1.test.fake.fake")]
    public void OrdinaryRowsOrUnsignedClaimsNeverEnableRouting(string? receipt)
    {
        var current = Context();
        using var codec = Codec();
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, receipt!, codec, Now), "TrustedReceiptRequired");
    }

    [Fact]
    public void MissingCodecOrDisposedCodecFailsClosed()
    {
        var current = Context();
        var codec = Codec();
        var receipt = codec.IssueForTrustedProducer(Evidence(current));
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, receipt, null!, Now), "TrustedReceiptRequired");
        codec.Dispose();
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, receipt, codec, Now), "TrustedReceiptRequired");
        Assert.Throws<ObjectDisposedException>(() => codec.IssueForTrustedProducer(Evidence(current)));
    }

    [Theory]
    [InlineData("disabled", "AuthoritativePublicVersionRequired")]
    [InlineData("private", "AuthoritativePublicVersionRequired")]
    [InlineData("dependencyGroup", "UnsupportedDeliveryScope")]
    [InlineData("otherSourceTenant", "CurrentTenantRequired")]
    [InlineData("otherPathTenant", "InvalidResourceIdentity")]
    [InlineData("revision", "ResourceIdentityChanged")]
    [InlineData("hash", "ResourceIdentityChanged")]
    [InlineData("size", "ResourceIdentityChanged")]
    [InlineData("object", "ResourceIdentityChanged")]
    [InlineData("id", "ResourceIdentityChanged")]
    [InlineData("malformedId", "InvalidResourceIdentity")]
    [InlineData("destination", "TargetConfigurationChanged")]
    [InlineData("bucket", "TargetConfigurationChanged")]
    [InlineData("missingBucket", "BackupConfigurationInvalid")]
    [InlineData("sourceBase", "TargetConfigurationChanged")]
    [InlineData("threshold", "TargetConfigurationChanged")]
    [InlineData("window", "UnsupportedWindow")]
    [InlineData("missingThreshold", "ThresholdMissingOrInvalid")]
    [InlineData("zeroThreshold", "ThresholdMissingOrInvalid")]
    [InlineData("missingBackup", "BackupConfigurationInvalid")]
    public void AuthorityAndConfigurationChangesInvalidateOldReceipt(string change, string reason)
    {
        var current = Context();
        using var codec = Codec();
        var receipt = codec.IssueForTrustedProducer(Evidence(current));
        switch (change)
        {
            case "disabled": current.Enabled = false; break;
            case "private": current.IsAuthoritativePublicVersion = false; break;
            case "dependencyGroup": current.DeliveryScope = "DependencyGroup"; break;
            case "otherSourceTenant": current.SourceTenant = "microi_demo"; break;
            case "otherPathTenant": current.ObjectKey = "microi_demo/3d/tree.glb"; break;
            case "revision": current.SourceRevision = new string('a', 64); break;
            case "hash": current.ContentHash = new string('a', 64); break;
            case "size": current.Size++; break;
            case "object": current.ObjectKey = "itdos/3d/warehouse.glb"; break;
            case "id": current.ResourceId = "another-resource"; break;
            case "malformedId": current.ResourceId += "\n"; break;
            case "destination": current.FileServerBak = "https://other.example.com"; break;
            case "bucket": current.BackupPublicBucket = "another-bucket"; break;
            case "missingBucket": current.BackupPublicBucket = ""; break;
            case "sourceBase": current.FileServer = "https://other-source.example.com"; break;
            case "threshold": current.FileServerBakThresholdGiB = 2; break;
            case "window": current.FileServerBakWindowHours = 12; break;
            case "missingThreshold": current.FileServerBakThresholdGiB = null; break;
            case "zeroThreshold": current.FileServerBakThresholdGiB = 0; break;
            case "missingBackup": current.FileServerBak = ""; break;
        }
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, receipt, codec, Now), reason);
    }

    [Theory]
    [InlineData("tenant", "ResourceIdentityChanged")]
    [InlineData("sourceTenant", "ResourceIdentityChanged")]
    [InlineData("receiptExpired", "ReceiptExpiredOrInvalid")]
    [InlineData("receiptFuture", "ReceiptExpiredOrInvalid")]
    [InlineData("receiptTooLong", "ReceiptExpiredOrInvalid")]
    [InlineData("incomplete", "CompleteDeliveryCoverageRequired")]
    [InlineData("partialSource", "CompleteDeliveryCoverageRequired")]
    [InlineData("wrongMetric", "CompleteDeliveryCoverageRequired")]
    [InlineData("windowExpired", "TrafficWindowExpiredOrInvalid")]
    [InlineData("windowShort", "TrafficWindowExpiredOrInvalid")]
    [InlineData("windowFuture", "TrafficWindowExpiredOrInvalid")]
    [InlineData("watermarkGap", "TrafficWindowExpiredOrInvalid")]
    [InlineData("watermarkAfterCollection", "TrafficWindowExpiredOrInvalid")]
    [InlineData("collectedFuture", "TrafficWindowExpiredOrInvalid")]
    [InlineData("freshnessExpired", "TrafficWindowExpiredOrInvalid")]
    [InlineData("freshnessUnbounded", "TrafficWindowExpiredOrInvalid")]
    [InlineData("belowThreshold", "TrafficBelowThresholdOrInvalid")]
    [InlineData("overflowBytes", "TrafficBelowThresholdOrInvalid")]
    [InlineData("replicaHash", "VerifiedReplicaRequired")]
    [InlineData("mutableReplicaPath", "VerifiedReplicaRequired")]
    [InlineData("writeOnceUnknown", "VerifiedReplicaRequired")]
    [InlineData("replicaSize", "VerifiedReplicaRequired")]
    [InlineData("replicaOld", "VerifiedReplicaRequired")]
    [InlineData("replicaExpiryBoundary", "VerifiedReplicaRequired")]
    [InlineData("replicaFuture", "VerifiedReplicaRequired")]
    [InlineData("tlsBypassed", "FreshStrictTlsHealthRequired")]
    [InlineData("signedReadOnly", "FreshStrictTlsHealthRequired")]
    [InlineData("healthOld", "FreshStrictTlsHealthRequired")]
    [InlineData("healthFuture", "FreshStrictTlsHealthRequired")]
    [InlineData("healthExpired", "FreshStrictTlsHealthRequired")]
    [InlineData("healthUnbounded", "FreshStrictTlsHealthRequired")]
    public void EvenAuthenticatedStaleIncompleteOrInconsistentFactsFailClosed(string change, string reason)
    {
        var current = Context();
        using var codec = Codec();
        var proof = Evidence(current);
        var clock = Now.ToUnixTimeSeconds();
        switch (change)
        {
            case "tenant": proof.Tenant = "other"; break;
            case "sourceTenant": proof.SourceTenant = "other"; break;
            case "receiptExpired": proof.ExpiresAtUtc = clock; break;
            case "receiptFuture": proof.IssuedAtUtc = clock + 1; break;
            case "receiptTooLong": proof.ExpiresAtUtc = clock + 301; break;
            case "incomplete": proof.CoverageComplete = false; break;
            case "partialSource": proof.CoverageScope = "OssOnly"; break;
            case "wrongMetric": proof.Metric = "ObjectSize"; break;
            case "windowExpired": proof.WindowEndUtc = clock - 172801; proof.WindowStartUtc = proof.WindowEndUtc - 86400; break;
            case "windowShort": proof.WindowStartUtc++; break;
            case "windowFuture": proof.WindowEndUtc = clock + 1; proof.WindowStartUtc = proof.WindowEndUtc - 86400; break;
            case "watermarkGap": proof.ObservedThroughUtc = proof.WindowEndUtc - 1; break;
            case "watermarkAfterCollection": proof.ObservedThroughUtc = proof.CollectedAtUtc + 1; break;
            case "collectedFuture": proof.CollectedAtUtc = clock + 1; break;
            case "freshnessExpired": proof.TrafficFreshUntilUtc = clock; break;
            case "freshnessUnbounded": proof.TrafficFreshUntilUtc = proof.WindowEndUtc + 172801; break;
            case "belowThreshold": proof.ActualBytes = GiB - 1; break;
            case "overflowBytes": proof.ActualBytes = long.MaxValue; break;
            case "replicaHash": proof.ReplicaSha256 = new string('a', 64); break;
            case "mutableReplicaPath": proof.ReplicaObjectKey = current.ObjectKey; break;
            case "writeOnceUnknown": proof.ReplicaWriteOnceVerified = false; break;
            case "replicaSize": proof.ReplicaSize++; break;
            case "replicaOld": proof.ReplicaVerifiedAtUtc = clock - 86401; break;
            case "replicaExpiryBoundary": proof.ReplicaVerifiedAtUtc = clock - 86400; break;
            case "replicaFuture": proof.ReplicaVerifiedAtUtc = clock + 1; break;
            case "tlsBypassed": proof.StrictTls = false; break;
            case "signedReadOnly": proof.AnonymousReadVerified = false; break;
            case "healthOld": proof.HealthVerifiedAtUtc = clock - 301; break;
            case "healthFuture": proof.HealthVerifiedAtUtc = clock + 1; break;
            case "healthExpired": proof.HealthValidUntilUtc = clock; break;
            case "healthUnbounded": proof.HealthValidUntilUtc = proof.HealthVerifiedAtUtc + 301; break;
        }
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, codec.IssueForTrustedProducer(proof), codec, Now), reason);
    }

    [Theory]
    [InlineData("http://hub.example.com:1120/public-bucket")]
    [InlineData("https://user@hub.example.com/public-bucket")]
    [InlineData("https://hub.example.com/public-bucket?target=other")]
    [InlineData("https://hub.example.com/public-bucket#fragment")]
    [InlineData("https://hub.example.com/a/../public-bucket")]
    [InlineData("https://hub.example.com/a/./public-bucket")]
    [InlineData("https://hub.example.com//public-bucket")]
    [InlineData("https://hub.example.com/public-bucket//")]
    [InlineData("https://hub.example.com/%2e%2e/public-bucket")]
    [InlineData("https://hub.example.com/public%2fbucket")]
    [InlineData("https://hub.example.com\\public-bucket")]
    [InlineData("https://hub.example.com/public-bucket\n")]
    [InlineData("//hub.example.com/public-bucket")]
    [InlineData("https://127.0.0.1/public-bucket")]
    public void AmbiguousOrInsecureBackupConfigurationCannotBeSignedIntoValidity(string target)
    {
        var current = Context();
        current.FileServerBak = target;
        using var codec = Codec();
        Assert.False(ManagedPublicResourceRoute.TryConfigHash(current, out _, out _));
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, "Ready", codec, Now), "BackupConfigurationInvalid");
    }

    [Theory]
    [InlineData("../private")]
    [InlineData("itdos/other")]
    [InlineData("itdos?acl")]
    [InlineData("itdos%2fprivate")]
    [InlineData("itdos\n")]
    [InlineData("a..b")]
    [InlineData("127.0.0.1")]
    public void TargetBucketMustBeAnExplicitUnambiguousStorageBinding(string bucket)
    {
        var current = Context();
        current.BackupPublicBucket = bucket;
        using var codec = Codec();
        Assert.False(ManagedPublicResourceRoute.TryConfigHash(current, out _, out _));
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, "Ready", codec, Now), "BackupConfigurationInvalid");
    }

    [Theory]
    [InlineData("itdos/../other/file.js")]
    [InlineData("itdos/%2e%2e/file.js")]
    [InlineData("itdos//file.js")]
    [InlineData("itdos/file.js?token=secret")]
    [InlineData("itdos/file.js#hash")]
    [InlineData("itdos/private/document.pdf")]
    [InlineData("itdos/private-source/source.zip")]
    [InlineData("itdos/PrivateSource/source.zip")]
    [InlineData("itdos/.env")]
    [InlineData("itdos/.git/config")]
    [InlineData("itdos/source/file.js")]
    [InlineData("microi/application-assets/v3/tenants/other/file.js")]
    [InlineData("https://other.example.com/file.js")]
    public void ObjectIdentityCannotEscapeCurrentTenantPublicNamespace(string key)
    {
        var current = Context();
        current.ObjectKey = key;
        using var codec = Codec();
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, "Ready", codec, Now), "InvalidResourceIdentity");
    }

    [Theory]
    [InlineData("itdos/3d/树.glb", "%E6%A0%91.glb")]
    [InlineData("microi/application-assets/v3/tenants/itdos/app/versions/v1/assets/a.js", "a.js")]
    public void ExactSelectedPublicObjectHasAnEncodedVersionedReplicaInCurrentNamespace(string key, string escapedLeaf)
    {
        var current = Context();
        current.ObjectKey = key;
        using var codec = Codec();
        var result = ManagedPublicResourceRoute.Resolve(current, codec.IssueForTrustedProducer(Evidence(current)), codec, Now);
        Assert.True(result.UseBackup);
        Assert.Equal("https://hub.example.com:1120/public-bucket/itdos/managed-public/v1/" + Hash + "/" + Hash + "/" + escapedLeaf, result.SelectedUrl);
    }

    [Fact]
    public void VersionOrContentChangeCannotReuseAnOldMutableReplicaAddress()
    {
        var current = Context();
        Assert.True(ManagedPublicResourceRoute.TryReplicaObjectKey(current, out var first));
        current.SourceRevision = new string('a', 64);
        Assert.True(ManagedPublicResourceRoute.TryReplicaObjectKey(current, out var second));
        Assert.NotEqual(first, second);
        current.ContentHash = new string('b', 64);
        Assert.True(ManagedPublicResourceRoute.TryReplicaObjectKey(current, out var third));
        Assert.NotEqual(second, third);
        Assert.StartsWith("itdos/managed-public/v1/", third, StringComparison.Ordinal);
        Assert.DoesNotContain("/3d/", third, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("invalidUnicode")]
    [InlineData("longUtf8")]
    [InlineData("longReplicaLeaf")]
    public void UnrepresentableOrOversizeObjectKeysFailClosed(string kind)
    {
        var current = Context();
        current.ObjectKey = kind switch
        {
            "invalidUnicode" => "itdos/" + (char)0xd800 + ".glb",
            "longUtf8" => "itdos/" + new string('树', 400),
            _ => "itdos/" + new string('a', 900)
        };
        using var codec = Codec();
        Assert.False(ManagedPublicResourceRoute.TryReplicaObjectKey(current, out _));
        AssertOriginal(current, ManagedPublicResourceRoute.Resolve(current, "Ready", codec, Now), "InvalidResourceIdentity");
    }

    [Fact]
    public void WrongKeyRotationOrModifiedPayloadCannotAuthenticate()
    {
        var current = Context();
        using var codec = Codec();
        var receipt = codec.IssueForTrustedProducer(Evidence(current));
        using var otherKey = new ManagedPublicResourceReceiptCodec("test", Enumerable.Repeat((byte)9, 32).ToArray());
        using var otherKeyId = new ManagedPublicResourceReceiptCodec("rotated", TestKey);
        Assert.False(otherKey.TryRead(receipt, out _));
        Assert.False(otherKeyId.TryRead(receipt, out _));
        var pieces = receipt.Split('.');
        var bytes = Decode(pieces[2]);
        bytes[bytes.Length - 1] ^= 1;
        pieces[2] = Encode(bytes);
        Assert.False(codec.TryRead(string.Join(".", pieces), out _));
        Assert.False(codec.TryRead(receipt.Replace("mfr1.", "mfr2.", StringComparison.Ordinal), out _));
        Assert.False(codec.TryRead(receipt + ".extra", out _));
        Assert.False(codec.TryRead(new string('a', 20000), out _));
    }

    [Theory]
    [InlineData("truncated")]
    [InlineData("trailingBytes")]
    [InlineData("negativeStringLength")]
    [InlineData("hugeStringLength")]
    [InlineData("invalidUtf8")]
    [InlineData("nonCanonicalBoolean")]
    public void AuthenticatedMalformedBinaryFailsWithoutReturningPartialEvidence(string change)
    {
        using var codec = Codec();
        var payload = Decode(codec.IssueForTrustedProducer(Evidence(Context())).Split('.')[2]);
        switch (change)
        {
            case "truncated": payload = payload.Take(payload.Length - 1).ToArray(); break;
            case "trailingBytes": payload = payload.Concat(new byte[] { 0 }).ToArray(); break;
            case "negativeStringLength": BitConverter.GetBytes(-1).CopyTo(payload, 0); break;
            case "hugeStringLength": BitConverter.GetBytes(int.MaxValue).CopyTo(payload, 0); break;
            case "invalidUtf8": payload[4] = 0xff; break;
            case "nonCanonicalBoolean":
                using (var stream = new MemoryStream(payload))
                using (var reader = new BinaryReader(stream))
                {
                    for (var i = 0; i < 7; i++) { var length = reader.ReadInt32(); stream.Position += length; }
                    stream.Position += 8;
                    for (var i = 0; i < 3; i++) { var length = reader.ReadInt32(); stream.Position += length; }
                    payload[(int)stream.Position] = 2;
                }
                break;
        }
        Assert.False(codec.TryRead(SignTestPayload(payload), out var result));
        Assert.Null(result);
    }

    [Fact]
    public void ReceiptHasCanonicalBase64AndIsolatedOwnedKeyMaterial()
    {
        var supplied = (byte[])TestKey.Clone();
        using var codec = new ManagedPublicResourceReceiptCodec("test", supplied);
        Array.Clear(supplied);
        var receipt = codec.IssueForTrustedProducer(Evidence(Context()));
        using var verifier = Codec();
        Assert.True(verifier.TryRead(receipt, out _));
        var parts = receipt.Split('.');
        parts[2] += "=";
        Assert.False(codec.TryRead(string.Join(".", parts), out _));
        Assert.Throws<ArgumentException>(() => new ManagedPublicResourceReceiptCodec("test", new byte[16]));
        Assert.Throws<ArgumentException>(() => new ManagedPublicResourceReceiptCodec("unsafe.key", TestKey));
        Assert.Throws<ArgumentException>(() => new ManagedPublicResourceReceiptCodec("test\n", TestKey));
    }

    private static ManagedPublicResourceContext Context() => new()
    {
        Tenant = "iTdos", SourceTenant = "iTdos", ResourceId = "resource-01", SourceRevision = Hash,
        ObjectKey = "itdos/3d/tree.glb", DeliveryScope = "StandalonePublicObject", ContentHash = Hash, Size = 1024,
        IsAuthoritativePublicVersion = true, Enabled = true,
        OriginalUrl = "https://file.example.com/itdos/3d/tree.glb", FileServer = "https://file.example.com",
        FileServerBak = "https://hub.example.com:1120", BackupPublicBucket = "public-bucket", FileServerBakThresholdGiB = 1,
        FileServerBakWindowHours = 24
    };

    private static ManagedPublicResourceEvidence Evidence(ManagedPublicResourceContext current)
    {
        Assert.True(ManagedPublicResourceRoute.TryConfigHash(current, out var config, out _));
        Assert.True(ManagedPublicResourceRoute.TryReplicaObjectKey(current, out var replicaKey));
        var clock = Now.ToUnixTimeSeconds();
        return new()
        {
            Tenant = current.Tenant, SourceTenant = current.SourceTenant, ResourceId = current.ResourceId,
            SourceRevision = current.SourceRevision, ObjectKey = current.ObjectKey, DeliveryScope = current.DeliveryScope, ContentHash = current.ContentHash,
            Size = current.Size, TargetConfigHash = config, Metric = "PublicDeliveryBytes", CoverageScope = "AllManagedDelivery",
            CoverageComplete = true, WindowStartUtc = clock - 90000, WindowEndUtc = clock - 3600,
            ObservedThroughUtc = clock - 3600, CollectedAtUtc = clock - 60, TrafficFreshUntilUtc = clock + 3600,
            ActualBytes = GiB, ReplicaSha256 = current.ContentHash, ReplicaObjectKey = replicaKey, ReplicaWriteOnceVerified = true, ReplicaSize = current.Size,
            ReplicaVerifiedAtUtc = clock - 30, StrictTls = true, AnonymousReadVerified = true, HealthVerifiedAtUtc = clock - 10,
            HealthValidUntilUtc = clock + 120, IssuedAtUtc = clock, ExpiresAtUtc = clock + 240
        };
    }

    private static ManagedPublicResourceReceiptCodec Codec() => new("test", TestKey);
    private static void AssertOriginal(ManagedPublicResourceContext current, ManagedPublicResourceRouteDecision result, string reason)
    {
        Assert.False(result.UseBackup);
        Assert.Equal(reason, result.ReasonCode);
        Assert.Equal(current.OriginalUrl, result.SelectedUrl);
        Assert.Null(result.ConfigHash);
        Assert.Equal(0, result.ExpiresAtUtc);
    }
    private static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static byte[] Decode(string text) => Convert.FromBase64String(text.Replace('-', '+').Replace('_', '/').PadRight((text.Length + 3) / 4 * 4, '='));
    private static string SignTestPayload(byte[] payload)
    {
        var body = "mfr1.test." + Encode(payload);
        using var hmac = new HMACSHA256(TestKey);
        return body + "." + Encode(hmac.ComputeHash(Encoding.UTF8.GetBytes("Microi.ManagedPublicResourceRoute.receipt.v1\n" + body)));
    }
}
