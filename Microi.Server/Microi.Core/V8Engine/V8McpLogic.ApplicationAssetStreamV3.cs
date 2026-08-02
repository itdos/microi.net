using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>
    /// Pure protocol-v3 primitives for application-asset publishing.
    ///
    /// A v3 release is immutable and addressed by the complete tenant/kind/app/
    /// version/request-fingerprint identity. The stable resolver is deliberately
    /// versionless: a future database CAS will choose its immutable target. This
    /// file performs no database, object-storage, cache, HTTP or controller work.
    /// </summary>
    public static partial class V8McpLogic
    {
        private const int ApplicationAssetV3TenantMaxLength = 64;
        private const int ApplicationAssetV3KindMaxLength = 32;
        private const int ApplicationAssetV3AppMaxLength = 128;
        private const int ApplicationAssetV3VersionMaxLength = 64;
        private const int ApplicationAssetV3PathSegmentMaxLength = 255;
        // mci_ai_app_file.FilePath/PublishHdfsPath/HdfsPath are varchar(1000).
        // Enforce both the logical path and final immutable object key before
        // any storage or database side effect; never rely on DB truncation.
        private const int ApplicationAssetV3PersistedPathMaxLength = 1000;

        private static readonly Regex ApplicationAssetV3IdentitySegmentRegex = new Regex(
            "^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex ApplicationAssetV3RequestFingerprintRegex = new Regex(
            "^[a-f0-9]{64}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly HashSet<string> ApplicationAssetV3ReservedPathSegments =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "root",
                "latest"
            };

        public enum ApplicationAssetV3PublishState
        {
            Prepared = 1,
            Verifying = 2,
            ReleaseVerified = 3,
            PointerCommitted = 4,
            ProjectionPending = 5,
            RepairRequired = 6,
            Completed = 7,
            FailedBeforeCommit = 8,
            LegacyUnverified = 9,
            ManualReview = 10,
            Superseded = 11
        }

        public enum ApplicationAssetV3PointerCommitMode
        {
            Invalid = 0,
            Insert = 1,
            Advance = 2,
            Idempotent = 3
        }

        public sealed class ApplicationAssetV3ReleaseIdentity
        {
            public string Tenant { get; set; }
            public string Kind { get; set; }
            public string AppKey { get; set; }
            public string Version { get; set; }
            public string RequestFingerprint { get; set; }
        }

        /// <summary>
        /// Serializable state required by a future pointer-row compare-and-swap.
        /// ReleaseEntryPath and PublishIdentityKey bind the row to one immutable
        /// release; StableResolverPath is the versionless public address.
        /// </summary>
        public sealed class ApplicationAssetV3PointerSnapshot
        {
            public ApplicationAssetV3ReleaseIdentity Release { get; set; }
            public long Generation { get; set; }
            public ApplicationAssetV3PublishState PublishState { get; set; }
            public string EntryRelativePath { get; set; }
            public string ReleaseEntryPath { get; set; }
            public string StableResolverPath { get; set; }
            public string PublishIdentityKey { get; set; }
        }

        public sealed class ApplicationAssetV3PointerCommitValidation
        {
            public bool IsValid { get; set; }
            public ApplicationAssetV3PointerCommitMode Mode { get; set; }
            public string Error { get; set; }
        }

        private static readonly HashSet<(ApplicationAssetV3PublishState From, ApplicationAssetV3PublishState To)>
            ApplicationAssetV3AllowedTransitions =
                new HashSet<(ApplicationAssetV3PublishState From, ApplicationAssetV3PublishState To)>
                {
                    (ApplicationAssetV3PublishState.Prepared, ApplicationAssetV3PublishState.Verifying),
                    (ApplicationAssetV3PublishState.Prepared, ApplicationAssetV3PublishState.FailedBeforeCommit),
                    (ApplicationAssetV3PublishState.Verifying, ApplicationAssetV3PublishState.ReleaseVerified),
                    (ApplicationAssetV3PublishState.Verifying, ApplicationAssetV3PublishState.FailedBeforeCommit),
                    (ApplicationAssetV3PublishState.ReleaseVerified, ApplicationAssetV3PublishState.PointerCommitted),
                    (ApplicationAssetV3PublishState.ReleaseVerified, ApplicationAssetV3PublishState.FailedBeforeCommit),
                    (ApplicationAssetV3PublishState.FailedBeforeCommit, ApplicationAssetV3PublishState.Prepared),
                    // After the pointer commit there is no transition back to a
                    // pre-commit state. Projection failures can only roll forward.
                    (ApplicationAssetV3PublishState.PointerCommitted, ApplicationAssetV3PublishState.ProjectionPending),
                    (ApplicationAssetV3PublishState.PointerCommitted, ApplicationAssetV3PublishState.RepairRequired),
                    (ApplicationAssetV3PublishState.PointerCommitted, ApplicationAssetV3PublishState.Completed),
                    (ApplicationAssetV3PublishState.ProjectionPending, ApplicationAssetV3PublishState.RepairRequired),
                    (ApplicationAssetV3PublishState.ProjectionPending, ApplicationAssetV3PublishState.Completed),
                    (ApplicationAssetV3PublishState.RepairRequired, ApplicationAssetV3PublishState.ProjectionPending),
                    (ApplicationAssetV3PublishState.RepairRequired, ApplicationAssetV3PublishState.Completed),
                    (ApplicationAssetV3PublishState.Completed, ApplicationAssetV3PublishState.Superseded),
                    (ApplicationAssetV3PublishState.LegacyUnverified, ApplicationAssetV3PublishState.ManualReview),
                    (ApplicationAssetV3PublishState.ManualReview, ApplicationAssetV3PublishState.Superseded)
                };

        public static string ValidateApplicationAssetV3ReleaseIdentity(
            ApplicationAssetV3ReleaseIdentity identity)
        {
            if (identity == null) return "v3 release identity 不能为空";

            var error = ValidateApplicationAssetV3IdentitySegment(
                identity.Tenant,
                "Tenant",
                ApplicationAssetV3TenantMaxLength);
            if (error != null) return error;

            error = ValidateApplicationAssetV3IdentitySegment(
                identity.Kind,
                "Kind",
                ApplicationAssetV3KindMaxLength);
            if (error != null) return error;

            error = ValidateApplicationAssetV3IdentitySegment(
                identity.AppKey,
                "AppKey",
                ApplicationAssetV3AppMaxLength);
            if (error != null) return error;

            error = ValidateApplicationAssetV3IdentitySegment(
                identity.Version,
                "Version",
                ApplicationAssetV3VersionMaxLength);
            if (error != null) return error;

            if (!ApplicationAssetV3RequestFingerprintRegex.IsMatch(
                    identity.RequestFingerprint ?? string.Empty))
            {
                return "RequestFingerprint 必须是 64 位小写十六进制 SHA-256";
            }

            return null;
        }

        public static string ValidateApplicationAssetV3RelativePath(string relativePath)
        {
            string ignored;
            return TryNormalizeApplicationAssetV3RelativePath(relativePath, out ignored);
        }

        /// <summary>
        /// Immutable object prefix. Every release key contains all five isolation
        /// dimensions and never emits the legacy mutable root/latest namespaces.
        /// </summary>
        public static string BuildApplicationAssetV3ReleasePrefix(
            ApplicationAssetV3ReleaseIdentity identity)
        {
            ThrowApplicationAssetV3Validation(
                ValidateApplicationAssetV3ReleaseIdentity(identity),
                nameof(identity));

            return string.Join("/", new[]
            {
                "microi",
                "application-assets",
                "v3",
                "tenants",
                EscapeApplicationAssetV3Segment(identity.Tenant),
                "kinds",
                EscapeApplicationAssetV3Segment(identity.Kind),
                "apps",
                EscapeApplicationAssetV3Segment(identity.AppKey),
                "releases",
                EscapeApplicationAssetV3Segment(identity.Version),
                "requests",
                identity.RequestFingerprint
            });
        }

        public static string BuildApplicationAssetV3ReleaseEntryPath(
            ApplicationAssetV3ReleaseIdentity identity,
            string entryRelativePath)
        {
            string normalizedEntryPath;
            ThrowApplicationAssetV3Validation(
                TryNormalizeApplicationAssetV3RelativePath(entryRelativePath, out normalizedEntryPath),
                nameof(entryRelativePath));
            var releaseEntryPath = BuildApplicationAssetV3ReleasePrefix(identity)
                                   + "/assets/"
                                   + normalizedEntryPath;
            if (releaseEntryPath.Length > ApplicationAssetV3PersistedPathMaxLength)
            {
                throw new ArgumentException(
                    "v3 immutable object path 超过数据库 varchar(1000) 边界。",
                    nameof(entryRelativePath));
            }
            return releaseEntryPath;
        }

        /// <summary>
        /// Durable idempotency/commit identity. This is suitable for a unique
        /// database key or inbox key; it includes every release dimension.
        /// </summary>
        public static string BuildApplicationAssetV3PublishIdentityKey(
            ApplicationAssetV3ReleaseIdentity identity)
        {
            ThrowApplicationAssetV3Validation(
                ValidateApplicationAssetV3ReleaseIdentity(identity),
                nameof(identity));
            return string.Join(":", new[]
            {
                "Microi",
                EscapeApplicationAssetV3Segment(identity.Tenant),
                "ApplicationAssetV3",
                EscapeApplicationAssetV3Segment(identity.Kind),
                EscapeApplicationAssetV3Segment(identity.AppKey),
                EscapeApplicationAssetV3Segment(identity.Version),
                identity.RequestFingerprint
            });
        }

        /// <summary>
        /// Stable public route. Version and request fingerprint intentionally do
        /// not appear in the URL; a future resolver reads the committed pointer
        /// and serves only its immutable ReleaseEntryPath target.
        /// </summary>
        public static string BuildApplicationAssetV3StableResolverPath(
            ApplicationAssetV3ReleaseIdentity identity,
            string relativeAssetPath)
        {
            ThrowApplicationAssetV3Validation(
                ValidateApplicationAssetV3ReleaseIdentity(identity),
                nameof(identity));
            string normalizedAssetPath;
            ThrowApplicationAssetV3Validation(
                TryNormalizeApplicationAssetV3RelativePath(relativeAssetPath, out normalizedAssetPath),
                nameof(relativeAssetPath));

            return string.Join("/", new[]
            {
                string.Empty,
                "micro-app",
                "v3",
                "tenants",
                EscapeApplicationAssetV3Segment(identity.Tenant),
                "kinds",
                EscapeApplicationAssetV3Segment(identity.Kind),
                "apps",
                EscapeApplicationAssetV3Segment(identity.AppKey),
                "assets",
                normalizedAssetPath
            });
        }

        public static bool CanTransitionApplicationAssetV3PublishState(
            ApplicationAssetV3PublishState from,
            ApplicationAssetV3PublishState to)
        {
            return ValidateApplicationAssetV3PublishStateTransition(from, to) == null;
        }

        public static string ValidateApplicationAssetV3PublishStateTransition(
            ApplicationAssetV3PublishState from,
            ApplicationAssetV3PublishState to)
        {
            if (!Enum.IsDefined(typeof(ApplicationAssetV3PublishState), from))
                return "原 PublishState 不合法";
            if (!Enum.IsDefined(typeof(ApplicationAssetV3PublishState), to))
                return "目标 PublishState 不合法";
            if (from == to) return null;
            return ApplicationAssetV3AllowedTransitions.Contains((from, to))
                ? null
                : $"不允许 PublishState 从 {from} 转换到 {to}";
        }

        /// <summary>
        /// Validate the complete expected/target contract needed by a future
        /// atomic pointer CAS. It does not perform the CAS. A successful Advance
        /// requires target.Generation == expected.Generation + 1; an exact
        /// readback is Idempotent. A committed pointer can never move backwards.
        /// </summary>
        public static ApplicationAssetV3PointerCommitValidation ValidateApplicationAssetV3PointerCommit(
            ApplicationAssetV3PointerSnapshot expected,
            ApplicationAssetV3PointerSnapshot target)
        {
            var targetError = ValidateApplicationAssetV3PointerSnapshot(target, "Target");
            if (targetError != null) return InvalidApplicationAssetV3PointerCommit(targetError);

            if (expected == null)
            {
                return target.Generation == 1
                    ? ValidApplicationAssetV3PointerCommit(ApplicationAssetV3PointerCommitMode.Insert)
                    : InvalidApplicationAssetV3PointerCommit("首次指针提交的 Target.Generation 必须为 1");
            }

            var expectedError = ValidateApplicationAssetV3PointerSnapshot(expected, "Expected");
            if (expectedError != null) return InvalidApplicationAssetV3PointerCommit(expectedError);

            if (!SameApplicationAssetV3ResolverScope(expected.Release, target.Release))
                return InvalidApplicationAssetV3PointerCommit("Expected 与 Target 的 Tenant/Kind/AppKey 不一致");

            if (AreExactApplicationAssetV3PointerSnapshots(expected, target))
                return ValidApplicationAssetV3PointerCommit(ApplicationAssetV3PointerCommitMode.Idempotent);

            if (expected.Generation == long.MaxValue)
                return InvalidApplicationAssetV3PointerCommit("Expected.Generation 已达到上限");
            if (target.Generation != expected.Generation + 1)
                return InvalidApplicationAssetV3PointerCommit(
                    "Target.Generation 必须严格等于 Expected.Generation + 1");

            if (SameApplicationAssetV3Release(expected.Release, target.Release))
            {
                return InvalidApplicationAssetV3PointerCommit(
                    "同一不可变 release 只能精确幂等回读，不能提升指针代际");
            }

            return ValidApplicationAssetV3PointerCommit(ApplicationAssetV3PointerCommitMode.Advance);
        }

        private static string ValidateApplicationAssetV3IdentitySegment(
            string value,
            string fieldName,
            int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value)) return fieldName + " 不能为空";
            if (!string.Equals(value, value.Trim(), StringComparison.Ordinal))
                return fieldName + " 不能包含首尾空白";
            if (value.Length > maxLength) return fieldName + " 长度超限";
            if (!ApplicationAssetV3IdentitySegmentRegex.IsMatch(value))
                return fieldName + " 只能包含字母、数字、点、下划线和短横线";
            if (ApplicationAssetV3ReservedPathSegments.Contains(value))
                return fieldName + " 不能使用 v3 保留段 root/latest";
            return null;
        }

        private static string TryNormalizeApplicationAssetV3RelativePath(
            string relativePath,
            out string normalizedPath)
        {
            normalizedPath = null;
            if (string.IsNullOrWhiteSpace(relativePath)) return "v3 相对路径不能为空";
            if (relativePath.Length > ApplicationAssetV3PersistedPathMaxLength)
                return "v3 原始相对路径超过数据库 varchar(1000) 边界";
            if (!string.Equals(relativePath, relativePath.Trim(), StringComparison.Ordinal))
                return "v3 相对路径不能包含首尾空白";
            if (relativePath.StartsWith("/", StringComparison.Ordinal))
                return "v3 路径必须是相对路径";
            if (relativePath.IndexOf('\\') >= 0)
                return "v3 路径禁止反斜杠";
            if (relativePath.IndexOf('%') >= 0
                || relativePath.IndexOf('?') >= 0
                || relativePath.IndexOf('#') >= 0)
            {
                return "v3 路径禁止预编码、查询串或片段";
            }

            var segments = relativePath.Split('/');
            var encodedSegments = new List<string>(segments.Length);
            foreach (var segment in segments)
            {
                if (segment.Length == 0) return "v3 路径包含空目录段";
                if (segment == "." || segment == "..") return "v3 路径禁止目录遍历";
                if (ApplicationAssetV3ReservedPathSegments.Contains(segment))
                    return "v3 路径禁止 mutable root/latest 段";
                if (segment.Length > ApplicationAssetV3PathSegmentMaxLength)
                    return "v3 路径目录段长度超限";
                for (var i = 0; i < segment.Length; i++)
                {
                    if (char.IsControl(segment[i])) return "v3 路径禁止控制字符";
                }

                string canonicalSegment;
                try
                {
                    canonicalSegment = segment.Normalize(NormalizationForm.FormC);
                }
                catch (ArgumentException)
                {
                    return "v3 路径包含无效 Unicode";
                }
                if (!string.Equals(segment, canonicalSegment, StringComparison.Ordinal))
                    return "v3 路径必须使用 Unicode NFC 规范形式";
                encodedSegments.Add(Uri.EscapeDataString(canonicalSegment));
            }

            normalizedPath = string.Join("/", encodedSegments);
            if (normalizedPath.Length > ApplicationAssetV3PersistedPathMaxLength)
            {
                normalizedPath = null;
                return "v3 规范化相对路径超过数据库 varchar(1000) 边界";
            }
            return null;
        }

        private static string ValidateApplicationAssetV3PointerSnapshot(
            ApplicationAssetV3PointerSnapshot snapshot,
            string name)
        {
            if (snapshot == null) return name + " 指针不能为空";
            var identityError = ValidateApplicationAssetV3ReleaseIdentity(snapshot.Release);
            if (identityError != null) return name + ".Release 不合法：" + identityError;
            if (!IsApplicationAssetV3PointerCommittedState(snapshot.PublishState))
                return name + ".PublishState 必须至少是 PointerCommitted";
            if (snapshot.Generation <= 0) return name + ".Generation 必须大于 0";

            var relativePathError = ValidateApplicationAssetV3RelativePath(snapshot.EntryRelativePath);
            if (relativePathError != null)
                return name + ".EntryRelativePath 不合法：" + relativePathError;

            var expectedReleasePath = BuildApplicationAssetV3ReleaseEntryPath(
                snapshot.Release,
                snapshot.EntryRelativePath);
            if (!string.Equals(snapshot.ReleaseEntryPath, expectedReleasePath, StringComparison.Ordinal))
                return name + ".ReleaseEntryPath 与不可变 release identity 不一致";

            var expectedResolverPath = BuildApplicationAssetV3StableResolverPath(
                snapshot.Release,
                snapshot.EntryRelativePath);
            if (!string.Equals(snapshot.StableResolverPath, expectedResolverPath, StringComparison.Ordinal))
                return name + ".StableResolverPath 不一致";

            var expectedPublishIdentityKey = BuildApplicationAssetV3PublishIdentityKey(snapshot.Release);
            if (!string.Equals(snapshot.PublishIdentityKey, expectedPublishIdentityKey, StringComparison.Ordinal))
                return name + ".PublishIdentityKey 未按完整 release identity 隔离";

            return null;
        }

        private static bool SameApplicationAssetV3ResolverScope(
            ApplicationAssetV3ReleaseIdentity left,
            ApplicationAssetV3ReleaseIdentity right)
        {
            return left != null
                   && right != null
                   && string.Equals(left.Tenant, right.Tenant, StringComparison.Ordinal)
                   && string.Equals(left.Kind, right.Kind, StringComparison.Ordinal)
                   && string.Equals(left.AppKey, right.AppKey, StringComparison.Ordinal);
        }

        public static bool IsApplicationAssetV3PointerCommittedState(
            ApplicationAssetV3PublishState state)
        {
            return state == ApplicationAssetV3PublishState.PointerCommitted
                   || state == ApplicationAssetV3PublishState.ProjectionPending
                   || state == ApplicationAssetV3PublishState.RepairRequired
                   || state == ApplicationAssetV3PublishState.Completed;
        }

        /// <summary>
        /// Business fencing is database-monotonic and survives Redis loss or
        /// rebuild. Redis lease fencing tokens remain diagnostics only and must
        /// never become the persisted cross-restart truth source.
        /// </summary>
        public static long BuildApplicationAssetV3NextPublishFence(long expectedPublishFence)
        {
            if (expectedPublishFence < 0)
                throw new ArgumentOutOfRangeException(nameof(expectedPublishFence));
            return checked(expectedPublishFence + 1L);
        }

        private static bool SameApplicationAssetV3Release(
            ApplicationAssetV3ReleaseIdentity left,
            ApplicationAssetV3ReleaseIdentity right)
        {
            return SameApplicationAssetV3ResolverScope(left, right)
                   && string.Equals(left.Version, right.Version, StringComparison.Ordinal)
                   && string.Equals(
                       left.RequestFingerprint,
                       right.RequestFingerprint,
                       StringComparison.Ordinal);
        }

        private static bool AreExactApplicationAssetV3PointerSnapshots(
            ApplicationAssetV3PointerSnapshot left,
            ApplicationAssetV3PointerSnapshot right)
        {
            return SameApplicationAssetV3Release(left.Release, right.Release)
                   && left.Generation == right.Generation
                   && left.PublishState == right.PublishState
                   && string.Equals(left.EntryRelativePath, right.EntryRelativePath, StringComparison.Ordinal)
                   && string.Equals(left.ReleaseEntryPath, right.ReleaseEntryPath, StringComparison.Ordinal)
                   && string.Equals(left.StableResolverPath, right.StableResolverPath, StringComparison.Ordinal)
                   && string.Equals(left.PublishIdentityKey, right.PublishIdentityKey, StringComparison.Ordinal);
        }

        private static string EscapeApplicationAssetV3Segment(string value)
        {
            return Uri.EscapeDataString(value);
        }

        private static void ThrowApplicationAssetV3Validation(string error, string parameterName)
        {
            if (error != null) throw new ArgumentException(error, parameterName);
        }

        private static ApplicationAssetV3PointerCommitValidation ValidApplicationAssetV3PointerCommit(
            ApplicationAssetV3PointerCommitMode mode)
        {
            return new ApplicationAssetV3PointerCommitValidation
            {
                IsValid = true,
                Mode = mode,
                Error = null
            };
        }

        private static ApplicationAssetV3PointerCommitValidation InvalidApplicationAssetV3PointerCommit(
            string error)
        {
            return new ApplicationAssetV3PointerCommitValidation
            {
                IsValid = false,
                Mode = ApplicationAssetV3PointerCommitMode.Invalid,
                Error = error
            };
        }
    }
}
