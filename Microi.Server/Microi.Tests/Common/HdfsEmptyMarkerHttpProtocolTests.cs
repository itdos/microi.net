using System.Text;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class HdfsEmptyMarkerHttpProtocolTests
{
    [Theory]
    [InlineData("false")]
    [InlineData("true")]
    [InlineData("null")]
    public async Task DedicatedNativeRouteForcesEmptyOnlyAfterJsonAndStillRequiresRealIdentity(string suppliedMode)
    {
        var context = new DefaultHttpContext();
        context.Request.ContentType = "application/json";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{\"FilePathName\":\"/itdos/file/attempt-original/\",\"Limit\":true,\"EmptyDirectoryOnly\":" + suppliedMode + "}"));
        var controller = new HDFSController { ControllerContext = new ControllerContext { HttpContext = context } };
        var param = new DiyUploadParam { _CurrentUser = new JObject { ["Id"] = "forged-admin", ["Level"] = DiyCommon.MaxRoleLevel } };
        var response = await controller.DeleteEmptyDirectoryMarker(param);
        var result = Assert.IsType<DosResult>(response.Value);
        Assert.NotEqual(1, result.Code); // 假请求身份不能接触任何桶。
        Assert.True(param.EmptyDirectoryOnly);
        Assert.True(param.Limit);
        Assert.Equal("/itdos/file/attempt-original/", param.FilePathName);
    }
}
