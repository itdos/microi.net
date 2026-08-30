using System.Collections.Concurrent;
using System.Reflection;
using Dos.Common;
using Dos.ORM;

namespace Microi.Tests.Common;

public sealed class BackendFoundationHardeningTests
{
    [Fact]
    public void AttributeCaches_IsolateAttributeTypesAndSupportConcurrentReads()
    {
        var member = typeof(AttributeFixture).GetProperty(nameof(AttributeFixture.Value));
        Assert.NotNull(member);

        Assert.Single(member.DosGetCustomAttributes<FirstMarkerAttribute>(true));
        Assert.Single(member.DosGetCustomAttributes<SecondMarkerAttribute>(true));
        Assert.Single(DosORMCommonExpand.GetCustomAttributes<FirstMarkerAttribute>(member, true));
        Assert.Single(DosORMCommonExpand.GetCustomAttributes<SecondMarkerAttribute>(member, true));

        Parallel.For(0, 2_000, index =>
        {
            var commonCount = index % 2 == 0
                ? member.DosGetCustomAttributes<FirstMarkerAttribute>(true).Length
                : member.DosGetCustomAttributes<SecondMarkerAttribute>(true).Length;
            var ormCount = index % 2 == 0
                ? DosORMCommonExpand.GetCustomAttributes<FirstMarkerAttribute>(member, true).Length
                : DosORMCommonExpand.GetCustomAttributes<SecondMarkerAttribute>(member, true).Length;
            if (commonCount != 1 || ormCount != 1)
            {
                throw new InvalidOperationException("Attribute cache returned the wrong typed entry.");
            }
        });
    }

    [Fact]
    public void QueueHelper_DefaultsAreInitializedAndContentionIsBounded()
    {
        _ = new QueueHelper();
        Assert.NotNull(QueueHelper.Param);
        Assert.NotNull(QueueHelper.Param.Pool);

        var preservedPool = new ConcurrentDictionary<string, object>();
        preservedPool["active"] = new object();
        QueueHelper.Param = new QueueHelper.QueueParam
        {
            Pool = preservedPool,
            QueueCount = 0
        };
        _ = new QueueHelper();
        Assert.Same(preservedPool, QueueHelper.Param.Pool);

        var pool = new ConcurrentDictionary<string, object>();
        _ = new QueueHelper(new QueueHelper.QueueParam
        {
            Pool = pool,
            QueueCount = 0
        });
        var key = "test:" + Guid.NewGuid().ToString("N");
        var owner = new object();

        Assert.Same(owner, QueueHelper.In(key, owner));
        Assert.Null(QueueHelper.In(key, new object()));
        Assert.True(QueueHelper.Out(key));
        Assert.False(QueueHelper.Out(key));
        Assert.Null(QueueHelper.In(" ", owner));
        Assert.Equal(string.Empty, QueueHelper.In("null-value", null));
        Assert.True(QueueHelper.Out("null-value"));
    }

    [Fact]
    public void SerializationHandlers_CanBeReplacedDuringConcurrentReads()
    {
        var type = typeof(SerializableFixture);
        SerializationManager.TypeSerializeHandler serializeA = value =>
            "A:" + ((SerializableFixture)value).Value;
        SerializationManager.TypeSerializeHandler serializeB = value =>
            "B:" + ((SerializableFixture)value).Value;
        SerializationManager.TypeDeserializeHandler deserialize = text =>
            new SerializableFixture { Value = text[(text.IndexOf(':') + 1)..] };

        try
        {
            SerializationManager.RegisterSerializeHandler(type, serializeA, deserialize);
            Parallel.For(0, 2_000, index =>
            {
                SerializationManager.RegisterSerializeHandler(
                    type,
                    index % 2 == 0 ? serializeA : serializeB,
                    deserialize);
                var serialized = SerializationManager.Serialize(new SerializableFixture { Value = index.ToString() });
                if (!serialized.StartsWith("A:", StringComparison.Ordinal)
                    && !serialized.StartsWith("B:", StringComparison.Ordinal))
                {
                    throw new InvalidOperationException("Concurrent handler lookup returned an invalid value.");
                }
                var deserialized = (SerializableFixture)SerializationManager.Deserialize(type, serialized);
                if (deserialized.Value != index.ToString())
                {
                    throw new InvalidOperationException("Concurrent handler round trip failed.");
                }
            });
        }
        finally
        {
            SerializationManager.UnregisterSerializeHandler(type);
        }
    }

    [Fact]
    public void DynamicCallCaches_AreStableUnderParallelHotPathReads()
    {
        var type = typeof(DynamicCallsFixture);
        var method = type.GetMethod(nameof(DynamicCallsFixture.Add));
        var property = type.GetProperty(nameof(DynamicCallsFixture.Value));
        Assert.NotNull(method);
        Assert.NotNull(property);

        var invokers = new ConcurrentBag<FastInvokeHandler>();
        var creators = new ConcurrentBag<FastCreateInstanceHandler>();
        var getters = new ConcurrentBag<FastPropertyGetHandler>();
        var setters = new ConcurrentBag<FastPropertySetHandler>();
        Parallel.For(0, 2_000, _ =>
        {
            invokers.Add(DynamicCalls.GetMethodInvoker(method));
            creators.Add(DynamicCalls.GetInstanceCreator(type));
            getters.Add(DynamicCalls.GetPropertyGetter(property));
            setters.Add(DynamicCalls.GetPropertySetter(property));
        });

        var invoker = invokers.First();
        var creator = creators.First();
        var getter = getters.First();
        var setter = setters.First();
        Assert.All(invokers, item => Assert.Same(invoker, item));
        Assert.All(creators, item => Assert.Same(creator, item));
        Assert.All(getters, item => Assert.Same(getter, item));
        Assert.All(setters, item => Assert.Same(setter, item));

        var instance = (DynamicCallsFixture)creator();
        setter(instance, 7);
        Assert.Equal(7, getter(instance));
        Assert.Equal(12, invoker(instance, new object[] { 5, 7 }));
    }

    [Fact]
    public void DynamicCalls_SupportValueTypesAndStaticPropertiesAndValidateMetadata()
    {
        var structCreator = DynamicCalls.GetInstanceCreator(typeof(DynamicStructFixture));
        var structValue = structCreator();
        var structProperty = typeof(DynamicStructFixture).GetProperty(nameof(DynamicStructFixture.Value));
        Assert.NotNull(structProperty);
        var structSetter = DynamicCalls.GetPropertySetter(structProperty);
        var structGetter = DynamicCalls.GetPropertyGetter(structProperty);
        structSetter(structValue, 9);
        Assert.Equal(9, structGetter(structValue));
        var structMethod = typeof(DynamicStructFixture).GetMethod(nameof(DynamicStructFixture.Add));
        Assert.NotNull(structMethod);
        var structInvoker = DynamicCalls.GetMethodInvoker(structMethod);
        Assert.Equal(13, structInvoker(structValue, new object[] { 4 }));

        var staticProperty = typeof(DynamicStaticFixture).GetProperty(nameof(DynamicStaticFixture.Value));
        Assert.NotNull(staticProperty);
        var staticSetter = DynamicCalls.GetPropertySetter(staticProperty);
        var staticGetter = DynamicCalls.GetPropertyGetter(staticProperty);
        staticSetter(null, 11);
        Assert.Equal(11, staticGetter(null));

        Assert.Throws<ArgumentNullException>(() => DynamicCalls.GetMethodInvoker(null));
        Assert.Throws<ArgumentNullException>(() => DynamicCalls.GetInstanceCreator(null));
        Assert.Throws<ArgumentNullException>(() => DynamicCalls.GetPropertyGetter(null));
        Assert.Throws<ArgumentNullException>(() => DynamicCalls.GetPropertySetter(null));

        var readOnly = typeof(DynamicReadOnlyFixture).GetProperty(nameof(DynamicReadOnlyFixture.Value));
        Assert.NotNull(readOnly);
        Assert.Throws<ArgumentException>(() => DynamicCalls.GetPropertySetter(readOnly));
    }

    [AttributeUsage(AttributeTargets.Property)]
    private sealed class FirstMarkerAttribute : Attribute
    {
    }

    [AttributeUsage(AttributeTargets.Property)]
    private sealed class SecondMarkerAttribute : Attribute
    {
    }

    private sealed class AttributeFixture
    {
        [FirstMarker]
        [SecondMarker]
        public string Value { get; set; } = string.Empty;
    }

    public sealed class SerializableFixture
    {
        public string Value { get; set; } = string.Empty;
    }

    public sealed class DynamicCallsFixture
    {
        public int Value { get; set; }

        public int Add(int left, int right)
        {
            return left + right;
        }
    }

    public struct DynamicStructFixture
    {
        public int Value { get; set; }

        public int Add(int value)
        {
            return Value + value;
        }
    }

    public static class DynamicStaticFixture
    {
        public static int Value { get; set; }
    }

    public sealed class DynamicReadOnlyFixture
    {
        public int Value => 1;
    }
}
