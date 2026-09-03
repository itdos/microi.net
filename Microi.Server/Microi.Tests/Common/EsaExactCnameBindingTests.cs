using Jint;
using Microi.net;
using Newtonsoft.Json;

namespace Microi.Tests.Common;

public sealed class EsaExactCnameBindingTests
{
    private const string SiteName = "microi.net";
    private const string RecordName = "hongdi-dev.microi.net";
    private const string OriginDomain = "dev.chongstech.com";
    private const long SiteId = 10001;
    private const long RecordId = 20002;

    [Theory]
    [InlineData("true")]
    [InlineData("1")]
    public void ManagedResource_AcceptsValidatedMcpRuntimeMetadata(string authorizationMarker)
    {
        var summary = ExecuteManagedResource($$"""
            {
              TenantKey: 'hongdi-dev',
              _RequireApiRoleAuthorization: {{authorizationMarker}},
              _TraceParent: '00-daa279013d1e7446c25bab27f05118d6-c015ba856c2e9d69-01'
            }
            """);

        Assert.Equal("1|Verified|1", summary);
    }

    [Theory]
    [InlineData("{ TenantKey: 'hongdi-dev', _RequireApiRoleAuthorization: false }")]
    [InlineData("{ TenantKey: 'hongdi-dev', _RequireApiRoleAuthorization: '1' }")]
    [InlineData("{ TenantKey: 'hongdi-dev', _TraceParent: 'invalid' }")]
    [InlineData("{ TenantKey: 'hongdi-dev', _TraceParent: '00-00000000000000000000000000000000-c015ba856c2e9d69-01' }")]
    [InlineData("{ TenantKey: 'hongdi-dev', UnexpectedRuntimeField: true }")]
    public void ManagedResource_RejectsMalformedOrUnknownRuntimeMetadata(string paramExpression)
    {
        var summary = ExecuteManagedResource(paramExpression);

        Assert.Equal("0|RejectedInput|0", summary);
    }

    [Fact]
    public void Registry_ExposesExactEsaBindingAndRejectsWildcardBeforeNetwork()
    {
        Assert.Contains(V8ExtensionRegistry.GetRegisteredNames(),
            name => string.Equals(name, "Alidns", StringComparison.OrdinalIgnoreCase));

        var engine = new Engine();
        engine.Execute("var V8 = {};");
        V8ExtensionRegistry.InjectAll(engine);

        var summary = engine.Evaluate(
            """
            (function () {
                var result = V8.Alidns.EnsureExactESACnameRecord({
                    SiteName: 'microi.net',
                    RecordName: '*.microi.net',
                    OriginDomain: 'dev.chongstech.com',
                    AccessKeyId: 'test-access-key-id',
                    AccessKeySecret: 'test-access-key-secret'
                });
                return result.Code + '|' + result.Msg;
            })()
            """).AsString();

        Assert.StartsWith("0|", summary, StringComparison.Ordinal);
        Assert.Contains("禁止使用通配符", summary);
    }

    [Theory]
    [InlineData("*.microi.net", RecordName, OriginDomain)]
    [InlineData(SiteName, "*.microi.net", OriginDomain)]
    [InlineData(SiteName, RecordName, "*.chongstech.com")]
    public void EnsureExactESACnameRecord_RejectsEveryWildcardSurface(
        string siteName,
        string recordName,
        string originDomain)
    {
        var factoryCalled = false;
        var subject = new Alidns((_, _) =>
        {
            factoryCalled = true;
            return new FakeEsaClient();
        }, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam(siteName, recordName, originDomain));

        Assert.Equal(0, result.Code);
        Assert.Contains("禁止使用通配符", result.Msg);
        Assert.False(factoryCalled);
    }

    [Theory]
    [InlineData("https://dev.chongstech.com")]
    [InlineData("dev.chongstech.com:443")]
    [InlineData("127.0.0.1")]
    public void EnsureExactESACnameRecord_RejectsNonDomainOrigins(string originDomain)
    {
        var factoryCalled = false;
        var subject = new Alidns((_, _) =>
        {
            factoryCalled = true;
            return new FakeEsaClient();
        }, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam(originDomain: originDomain));

        Assert.Equal(0, result.Code);
        Assert.False(factoryCalled);
    }

    [Fact]
    public void EnsureExactESACnameRecord_RejectsRecordOutsideExactSite()
    {
        var factoryCalled = false;
        var subject = new Alidns((_, _) =>
        {
            factoryCalled = true;
            return new FakeEsaClient();
        }, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(
            NewParam(recordName: "hongdi-dev.example.com"));

        Assert.Equal(0, result.Code);
        Assert.Contains("目标 SiteName 下", result.Msg);
        Assert.False(factoryCalled);
    }

    [Fact]
    public void EnsureExactESACnameRecord_CreatesFixedSafePolicyAndStrongReadsBack()
    {
        var fake = ActiveSiteClient();
        string capturedAccessKeyId = null;
        string capturedAccessKeySecret = null;
        var subject = new Alidns((accessKeyId, accessKeySecret) =>
        {
            capturedAccessKeyId = accessKeyId;
            capturedAccessKeySecret = accessKeySecret;
            return fake;
        }, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(1, result.Code);
        Assert.Equal("test-access-key-id", capturedAccessKeyId);
        Assert.Equal("test-access-key-secret", capturedAccessKeySecret);
        Assert.Equal(1, fake.CreateCount);
        Assert.Equal(0, fake.UpdateCount);
        Assert.Equal(1, fake.GetCount);
        Assert.NotNull(fake.LastSpec);
        Assert.Equal(SiteId, fake.LastSpec.SiteId);
        Assert.Equal(SiteName, fake.LastSpec.SiteName);
        Assert.Equal(RecordName, fake.LastSpec.RecordName);
        Assert.Equal(OriginDomain, fake.LastSpec.OriginDomain);

        var data = Assert.IsType<EsaExactCnameResult>(result.Data);
        Assert.Equal("Created", data.Action);
        Assert.Equal("CNAME", data.RecordType);
        Assert.Equal("Domain", data.SourceType);
        Assert.True(data.Proxied);
        Assert.Equal("web", data.BizName);
        Assert.Equal("follow_origin_domain", data.HostPolicy);
        Assert.Equal(OriginDomain, data.OriginHost);
        Assert.Equal(OriginDomain, data.OriginSni);
        Assert.Equal("80", data.HttpPorts);
        Assert.Equal("443", data.HttpsPorts);
        Assert.Equal(1, data.Ttl);
        Assert.True(data.ControlPlaneVerified);
        Assert.True(data.BareDomainReady);
        Assert.Equal("Ready", data.DataPlaneStatus);
        Assert.Equal(200, data.HttpStatus);
        Assert.Equal("NotRequested", data.OriginProtectionDiagnosticStatus);
        Assert.Equal(0, fake.GetOriginProtectionCount);

        var serialized = JsonConvert.SerializeObject(result);
        Assert.DoesNotContain(capturedAccessKeyId, serialized, StringComparison.Ordinal);
        Assert.DoesNotContain(capturedAccessKeySecret, serialized, StringComparison.Ordinal);
    }

    [Fact]
    public void EnsureExactESACnameRecord_UpdatesOnlyTheSingleExactRecord()
    {
        var fake = ActiveSiteClient();
        fake.Records.Add(new EsaRecordSnapshot
        {
            SiteId = SiteId,
            RecordId = RecordId,
            RecordName = RecordName,
            RecordType = "A",
            Value = "192.0.2.5",
            SourceType = "IP",
            Proxied = false,
            Ttl = 600
        });
        // 即使列表中夹带通配记录，精确过滤也绝不能选择或修改它。
        fake.Records.Add(DesiredRecord(30003, "*.microi.net"));
        var subject = new Alidns((_, _) => fake, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(1, result.Code);
        Assert.Equal("Updated", Assert.IsType<EsaExactCnameResult>(result.Data).Action);
        Assert.Equal(0, fake.CreateCount);
        Assert.Equal(1, fake.UpdateCount);
        Assert.Equal(RecordId, fake.LastUpdatedRecordId);
        var wildcard = Assert.Single(fake.Records, item => item.RecordName == "*.microi.net");
        Assert.Equal(30003, wildcard.RecordId);
    }

    [Fact]
    public void EnsureExactESACnameRecord_IsNoOpWhenExactRecordAlreadyMatches()
    {
        var fake = ActiveSiteClient();
        fake.Records.Add(DesiredRecord());
        var subject = new Alidns((_, _) => fake, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(1, result.Code);
        Assert.Equal("Unchanged", Assert.IsType<EsaExactCnameResult>(result.Data).Action);
        Assert.Equal(0, fake.CreateCount);
        Assert.Equal(0, fake.UpdateCount);
        Assert.Equal(1, fake.GetCount);
    }

    [Fact]
    public void EnsureExactESACnameRecord_ControlPlaneSuccessButHttp5xxIsNotReady()
    {
        var fake = ActiveSiteClient();
        fake.Records.Add(DesiredRecord());
        var subject = new Alidns(
            (_, _) => fake,
            (_, _) => EsaDataPlaneProbeResult.Failed(
                "HttpServerError",
                "精确域名返回 HTTP 5xx，数据面尚未就绪。",
                503));

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(1, result.Code);
        var data = Assert.IsType<EsaExactCnameResult>(result.Data);
        Assert.True(data.ControlPlaneVerified);
        Assert.False(data.BareDomainReady);
        Assert.Equal("HttpServerError", data.DataPlaneStatus);
        Assert.Equal(503, data.HttpStatus);
        Assert.Equal("NotRequested", data.OriginProtectionDiagnosticStatus);
        Assert.Equal(0, fake.GetOriginProtectionCount);
    }

    [Fact]
    public void EnsureExactESACnameRecord_Http522ReturnsReadOnlyOriginProtectionDiagnostic()
    {
        var fake = ActiveSiteClient();
        fake.Records.Add(DesiredRecord());
        fake.OriginProtection = new EsaOriginProtectionSnapshot
        {
            OriginProtection = "on",
            OriginConverge = "off",
            AutoConfirmIPList = "off",
            NeedUpdate = true,
            CurrentIPv4Cidrs = new List<string> { "47.0.0.0/8" },
            LatestIPv4Cidrs = new List<string> { "47.0.0.0/8", "8.8.8.0/24" },
            AddedIPv4Cidrs = new List<string> { "8.8.8.0/24" },
            RemovedIPv4Cidrs = new List<string>(),
            UnchangedIPv4Cidrs = new List<string> { "47.0.0.0/8" }
        };
        var subject = new Alidns(
            (_, _) => fake,
            (_, _) => EsaDataPlaneProbeResult.Failed(
                "OriginConnectionTimeout",
                "精确域名返回 HTTP 522，ESA 尚未成功连接源站。",
                522));

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(1, result.Code);
        var data = Assert.IsType<EsaExactCnameResult>(result.Data);
        Assert.True(data.ControlPlaneVerified);
        Assert.False(data.BareDomainReady);
        Assert.Equal("OriginConnectionTimeout", data.DataPlaneStatus);
        Assert.Equal(522, data.HttpStatus);
        Assert.Equal("Available", data.OriginProtectionDiagnosticStatus);
        Assert.Equal("on", data.OriginProtection);
        Assert.Equal("off", data.OriginConverge);
        Assert.Equal("off", data.AutoConfirmIPList);
        Assert.True(data.NeedUpdate);
        Assert.Equal(new[] { "47.0.0.0/8" }, data.CurrentIPv4Cidrs);
        Assert.Equal(new[] { "8.8.8.0/24" }, data.AddedIPv4Cidrs);
        Assert.Equal(1, fake.GetOriginProtectionCount);
        Assert.Equal(SiteId, fake.LastOriginProtectionSiteId);
        Assert.Equal(0, fake.OriginProtectionMutationCount);
    }

    [Theory]
    [InlineData("microi.net", "example.com")]
    [InlineData("hongdi-dev.microi.net.evil.example", "microi.net")]
    [InlineData("", "microi.net")]
    public void DataPlaneProbe_RejectsTargetOutsideVerifiedSite(string recordName, string siteName)
    {
        Assert.False(EsaExactDataPlaneProbe.IsExactRecordWithinVerifiedSite(recordName, siteName));
    }

    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("10.20.30.40")]
    [InlineData("169.254.1.1")]
    [InlineData("192.168.1.1")]
    [InlineData("::1")]
    [InlineData("fd00::1")]
    public void DataPlaneProbe_RejectsNonPublicResolvedAddress(string address)
    {
        Assert.False(EsaExactDataPlaneProbe.IsPublicInternetAddress(
            System.Net.IPAddress.Parse(address)));
    }

    [Theory]
    [InlineData("8.8.8.8")]
    [InlineData("1.1.1.1")]
    [InlineData("2606:4700:4700::1111")]
    public void DataPlaneProbe_AcceptsPublicResolvedAddress(string address)
    {
        Assert.True(EsaExactDataPlaneProbe.IsPublicInternetAddress(
            System.Net.IPAddress.Parse(address)));
    }

    [Fact]
    public void EnsureExactESACnameRecord_ReconcilesAmbiguousCreateWithoutDuplicate()
    {
        var fake = ActiveSiteClient();
        fake.ThrowAfterCreate = true;
        var subject = new Alidns((_, _) => fake, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(1, result.Code);
        Assert.Equal("ReconciledAfterCreate", Assert.IsType<EsaExactCnameResult>(result.Data).Action);
        Assert.Equal(1, fake.CreateCount);
        Assert.Equal(0, fake.UpdateCount);
        Assert.Single(fake.Records);
    }

    [Fact]
    public void EnsureExactESACnameRecord_FailsClosedWhenStrongReadbackDrifts()
    {
        var fake = ActiveSiteClient();
        fake.Records.Add(DesiredRecord());
        fake.ForceReadbackHostPolicy = "follow_hostname";
        var subject = new Alidns((_, _) => fake, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(0, result.Code);
        Assert.Contains("强回读不一致", result.Msg);
        Assert.Equal(0, fake.CreateCount);
        Assert.Equal(0, fake.UpdateCount);
    }

    [Fact]
    public void EnsureExactESACnameRecord_RequiresOneActiveExactSite()
    {
        var fake = new FakeEsaClient();
        fake.Sites.Add(new EsaSiteSnapshot
        {
            SiteId = SiteId,
            SiteName = SiteName,
            Status = "offline"
        });
        var subject = new Alidns((_, _) => fake, ReadyProbe);

        var result = subject.EnsureExactESACnameRecord(NewParam());

        Assert.Equal(0, result.Code);
        Assert.Contains("active", result.Msg);
        Assert.Equal(0, fake.CreateCount);
        Assert.Equal(0, fake.UpdateCount);
    }

    private static EsaExactCnameParam NewParam(
        string siteName = SiteName,
        string recordName = RecordName,
        string originDomain = OriginDomain)
    {
        return new EsaExactCnameParam
        {
            SiteName = siteName,
            RecordName = recordName,
            OriginDomain = originDomain,
            AccessKeyId = "test-access-key-id",
            AccessKeySecret = "test-access-key-secret"
        };
    }

    private static EsaDataPlaneProbeResult ReadyProbe(string _, string __)
    {
        return EsaDataPlaneProbeResult.ReadyResult(200);
    }

    private static string ExecuteManagedResource(string paramExpression)
    {
        var source = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(),
            "Microi.Server",
            "Microi.Upgrade",
            "Resource",
            "admin-ensure-saas-tenant-domain-binding.js"));
        var engine = new Engine();
        engine.SetValue("managedSource", source);
        engine.Execute("var runManagedDomainBinding = new Function('V8', managedSource);");
        engine.Execute($$"""
            var managedAtomicCalls = 0;
            var managedV8 = {
              Param: {{paramExpression}},
              OsClient: 'iTdos',
              CurrentUser: { Level: 9999 },
              OsClientModel: {
                OsClient: 'iTdos',
                AlidnsKeyId: 'test-access-key-id',
                AlidnsKeySecret: 'test-access-key-secret'
              },
              Method: {
                AuthorizeAdminTenantDomainBinding: function () { return { Code: 1 }; }
              },
              FormEngine: {
                GetFormData: function (table, query) {
                  var where = query._Where || [];
                  for (var index = 0; index < where.length; index++) {
                    if (where[index][0] === 'OsClient' && where[index][2] === 'iTdos') {
                      return { Code: 1, Data: {
                        Id: 'main-row-id', OsClient: 'iTdos',
                        DomainName: 'dev.chongstech.com', IsEnable: 1
                      } };
                    }
                  }
                  return { Code: 1, Data: {
                    Id: 'tenant-row-id', OsClient: 'hongdi-dev',
                    DomainName: 'hongdi-dev.microi.net', IsEnable: 1
                  } };
                }
              },
              Alidns: {
                EnsureExactESACnameRecord: function () {
                  managedAtomicCalls += 1;
                  return { Code: 1, Data: {
                    Action: 'Created', SiteName: 'microi.net', RecordId: 20002,
                    ControlPlaneVerified: true, BareDomainReady: true,
                    DataPlaneStatus: 'Ready', HttpStatus: 200, Diagnostic: 'ready',
                    RecordName: 'hongdi-dev.microi.net', RecordType: 'CNAME',
                    OriginDomain: 'dev.chongstech.com', OriginHost: 'dev.chongstech.com',
                    OriginSni: 'dev.chongstech.com', HostPolicy: 'follow_origin_domain',
                    Proxied: true
                  } };
                }
              }
            };
            var managedResult = runManagedDomainBinding(managedV8);
            var managedSummary = String(managedResult.Code) + '|'
              + String(managedResult.Data && managedResult.Data.DomainBindingStatus) + '|'
              + String(managedAtomicCalls);
            """);
        return engine.Evaluate("managedSummary").AsString();
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi 工作区根目录。");
    }

    private static FakeEsaClient ActiveSiteClient()
    {
        var fake = new FakeEsaClient();
        fake.Sites.Add(new EsaSiteSnapshot
        {
            SiteId = SiteId,
            SiteName = SiteName,
            Status = "active"
        });
        return fake;
    }

    private static EsaRecordSnapshot DesiredRecord(
        long recordId = RecordId,
        string recordName = RecordName)
    {
        return new EsaRecordSnapshot
        {
            SiteId = SiteId,
            RecordId = recordId,
            RecordName = recordName,
            RecordType = "CNAME",
            Value = OriginDomain,
            SourceType = "Domain",
            Proxied = true,
            BizName = "web",
            HostPolicy = "follow_origin_domain",
            HttpPorts = "80",
            HttpsPorts = "443",
            Ttl = 1
        };
    }

    private sealed class FakeEsaClient : IEsaExactRecordClient
    {
        public List<EsaSiteSnapshot> Sites { get; } = new();
        public List<EsaRecordSnapshot> Records { get; } = new();
        public int CreateCount { get; private set; }
        public int UpdateCount { get; private set; }
        public int GetCount { get; private set; }
        public bool ThrowAfterCreate { get; set; }
        public string ForceReadbackHostPolicy { get; set; }
        public EsaOriginProtectionSnapshot OriginProtection { get; set; }
        public int GetOriginProtectionCount { get; private set; }
        public long? LastOriginProtectionSiteId { get; private set; }
        public int OriginProtectionMutationCount { get; private set; }
        public long? LastUpdatedRecordId { get; private set; }
        public EsaExactCnameSpec LastSpec { get; private set; }

        public IReadOnlyList<EsaSiteSnapshot> ListSites(string siteName)
        {
            return Sites.ToList();
        }

        public IReadOnlyList<EsaRecordSnapshot> ListRecords(long siteId, string recordName)
        {
            return Records.ToList();
        }

        public long CreateExactCname(EsaExactCnameSpec spec)
        {
            CreateCount++;
            LastSpec = CopySpec(spec);
            Records.Add(DesiredFromSpec(spec, RecordId));
            if (ThrowAfterCreate)
            {
                throw new InvalidOperationException("simulated ambiguous create response");
            }
            return RecordId;
        }

        public void UpdateExactCname(long recordId, EsaExactCnameSpec spec)
        {
            UpdateCount++;
            LastUpdatedRecordId = recordId;
            LastSpec = CopySpec(spec);
            var index = Records.FindIndex(item => item.RecordId == recordId);
            if (index < 0) throw new InvalidOperationException("record not found");
            Records[index] = DesiredFromSpec(spec, recordId);
        }

        public EsaRecordSnapshot GetRecord(long recordId)
        {
            GetCount++;
            var record = Records.SingleOrDefault(item => item.RecordId == recordId);
            if (record == null) return null;
            var copy = CopyRecord(record);
            if (!string.IsNullOrWhiteSpace(ForceReadbackHostPolicy))
            {
                copy.HostPolicy = ForceReadbackHostPolicy;
            }
            return copy;
        }

        public EsaOriginProtectionSnapshot GetOriginProtection(long siteId)
        {
            GetOriginProtectionCount++;
            LastOriginProtectionSiteId = siteId;
            return OriginProtection;
        }

        private static EsaExactCnameSpec CopySpec(EsaExactCnameSpec spec)
        {
            return new EsaExactCnameSpec
            {
                SiteId = spec.SiteId,
                SiteName = spec.SiteName,
                RecordName = spec.RecordName,
                OriginDomain = spec.OriginDomain
            };
        }

        private static EsaRecordSnapshot DesiredFromSpec(EsaExactCnameSpec spec, long recordId)
        {
            return new EsaRecordSnapshot
            {
                SiteId = spec.SiteId,
                RecordId = recordId,
                RecordName = spec.RecordName,
                RecordType = "CNAME",
                Value = spec.OriginDomain,
                SourceType = "Domain",
                Proxied = true,
                BizName = "web",
                HostPolicy = "follow_origin_domain",
                HttpPorts = "80",
                HttpsPorts = "443",
                Ttl = 1
            };
        }

        private static EsaRecordSnapshot CopyRecord(EsaRecordSnapshot record)
        {
            return new EsaRecordSnapshot
            {
                SiteId = record.SiteId,
                RecordId = record.RecordId,
                RecordName = record.RecordName,
                RecordType = record.RecordType,
                Value = record.Value,
                SourceType = record.SourceType,
                Proxied = record.Proxied,
                BizName = record.BizName,
                HostPolicy = record.HostPolicy,
                HttpPorts = record.HttpPorts,
                HttpsPorts = record.HttpsPorts,
                Ttl = record.Ttl
            };
        }
    }
}
