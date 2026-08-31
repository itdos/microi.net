using System.Collections;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class UpgradeApiEngineCacheSnapshotTests
{
    [Fact]
    public void CachePlan_ResolvesAliasesAndSerializesOnlyOwnedFastExpandoSnapshots()
    {
        var nested = new Dictionary<string, object>
        {
            ["Mode"] = "before"
        };
        var backing = new CopyToFailingDictionary(new Dictionary<string, object>
        {
            ["Id"] = "engine-id",
            ["ApiEngineKey"] = "engine-before",
            ["ApiAddress"] = "/api/engine-before",
            ["ApiRoutes"] = "/api/engine-before-alias",
            ["ApiV8Code"] = "return 'before';",
            ["Metadata"] = nested
        });
        var dynamicRow = EntityUtils.FastExpando.Attach(backing);

        var plan = MicroiUpgrade.BuildApiEngineCacheSnapshotPlan(
            new object[] { dynamicRow });

        backing["ApiEngineKey"] = "engine-after";
        backing["ApiAddress"] = "/api/engine-after";
        backing["ApiV8Code"] = "return 'after';";
        backing["AddedAfterSnapshot"] = true;
        nested["Mode"] = "after";

        Assert.Equal(0, backing.CopyToCalls);
        Assert.Contains("engine-before", plan.Resolution.Aliases.Keys);
        Assert.Contains("/api/engine-before", plan.Resolution.Aliases.Keys);
        Assert.Contains("/api/engine-before-alias", plan.Resolution.Aliases.Keys);
        Assert.DoesNotContain("engine-after", plan.Resolution.Aliases.Keys);
        Assert.All(
            plan.Resolution.Aliases.Values,
            owner => Assert.IsType<JObject>(owner.ApiEngine));

        var cached = JObject.Parse(plan.Payloads["engine-before"]);
        Assert.Equal("engine-before", cached.Value<string>("ApiEngineKey"));
        Assert.Equal("/api/engine-before", cached.Value<string>("ApiAddress"));
        Assert.Equal("return 'before';", cached.Value<string>("ApiV8Code"));
        Assert.Equal("before", cached["Metadata"]?.Value<string>("Mode"));
        Assert.Null(cached["AddedAfterSnapshot"]);
    }

    private sealed class CopyToFailingDictionary : IDictionary<string, object>
    {
        private readonly Dictionary<string, object> _inner;

        internal CopyToFailingDictionary(Dictionary<string, object> inner)
        {
            _inner = inner;
        }

        internal int CopyToCalls { get; private set; }

        public object this[string key]
        {
            get => _inner[key];
            set => _inner[key] = value;
        }

        public ICollection<string> Keys => _inner.Keys;
        public ICollection<object> Values => _inner.Values;
        public int Count => _inner.Count;
        public bool IsReadOnly => false;

        public void Add(string key, object value) => _inner.Add(key, value);
        public bool ContainsKey(string key) => _inner.ContainsKey(key);
        public bool Remove(string key) => _inner.Remove(key);
        public bool TryGetValue(string key, out object value) => _inner.TryGetValue(key, out value!);
        public void Add(KeyValuePair<string, object> item) =>
            ((ICollection<KeyValuePair<string, object>>)_inner).Add(item);
        public void Clear() => _inner.Clear();
        public bool Contains(KeyValuePair<string, object> item) =>
            ((ICollection<KeyValuePair<string, object>>)_inner).Contains(item);

        public void CopyTo(KeyValuePair<string, object>[] array, int arrayIndex)
        {
            CopyToCalls++;
            throw new ArgumentException(
                "The number of elements in the dictionary is greater than the available space in the destination array.");
        }

        public bool Remove(KeyValuePair<string, object> item) =>
            ((ICollection<KeyValuePair<string, object>>)_inner).Remove(item);
        public IEnumerator<KeyValuePair<string, object>> GetEnumerator() => _inner.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
}
