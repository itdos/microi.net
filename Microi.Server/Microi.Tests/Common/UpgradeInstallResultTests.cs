using System.Dynamic;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class UpgradeInstallResultTests
{
    [Fact]
    public void FailureWithoutOptionalData_PreservesOriginalMessage()
    {
        dynamic result = new ExpandoObject();
        result.Code = 0;
        result.Msg = "原始导入失败";
        Assert.Equal("原始导入失败", UpgradeAppStore.GetInstallFailureMessage((object)result));
    }

    [Fact]
    public void StructuredFailure_OnlyIncludesApprovedDiagnosticFields()
    {
        var result = JObject.Parse("{Code:0,Msg:'失败',Data:{'失败资源':'diy_table/example','错误堆栈':'at import','Param':'private-input'}}");
        var message = UpgradeAppStore.GetInstallFailureMessage(result);
        Assert.Contains("diy_table/example", message);
        Assert.Contains("at import", message);
        Assert.DoesNotContain("private-input", message);
    }

    [Fact]
    public void SuccessAndMalformedResponses_AreDistinguished()
    {
        Assert.Null(UpgradeAppStore.GetInstallFailureMessage(new DosResult(1)));
        Assert.Null(UpgradeAppStore.GetInstallFailureMessage(JObject.Parse("{Code:'1'}")));
        Assert.NotEmpty(UpgradeAppStore.GetInstallFailureMessage(null));
        Assert.NotEmpty(UpgradeAppStore.GetInstallFailureMessage(new { Msg = "缺少状态" }));
    }
}
