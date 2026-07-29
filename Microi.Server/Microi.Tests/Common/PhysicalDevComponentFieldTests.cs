using Microi.net;

namespace Microi.Tests.Common;

public class PhysicalDevComponentFieldTests
{
    [Fact]
    public void DevComponent_WithDatabaseType_IsPersistedAsARealDataField()
    {
        Assert.False(DiyCommon.IsNotRealDataField("DevComponent", "mediumtext"));
        Assert.False(DiyCommon.IsNotRealDataField("devcomponent", "varchar(255)"));
    }

    [Fact]
    public void DisplayOnlyDevComponent_AndOtherLayoutComponents_RemainVirtual()
    {
        Assert.True(DiyCommon.IsNotRealDataField("DevComponent", ""));
        Assert.True(DiyCommon.IsNotRealDataField("DevComponent", null));
        Assert.True(DiyCommon.IsNotRealDataField("Divider", "varchar(255)"));
        Assert.False(DiyCommon.IsNotRealDataField(null, "varchar(255)"));
    }

    [Fact]
    public void FieldDesignClassification_RemainsBackwardCompatible()
    {
        Assert.True(DiyCommon.IsNotRealFieldComponent("DevComponent"));
        Assert.False(DiyCommon.IsNotRealFieldComponent("CodeEditor"));
    }
}
