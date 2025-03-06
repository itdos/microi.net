using Grpc.Core;
using Microi.net.Grpc.Server;
using Microi.net;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net.Grpc.Server.Services;

public class SysUserProtoService : SysUserProto.SysUserProtoBase
{
    private readonly ILogger<SysUserProtoService> _logger;
    public SysUserProtoService(ILogger<SysUserProtoService> logger)
    {
        _logger = logger;
    }

    public override Task<SysUserReply> Login(SysUserRequest request, ServerCallContext context)
    {
        SysUserParam param = new SysUserParam();
        param.Account = request.Account;
        param.Pwd = request.Pwd;
        param.OsClient = request.OsClient;
        try
        {
            //param.LastLoginIP = IPHelper.GetClientIP(HttpContext);
        }
        catch (Exception)
        {
            
        }
        var result = new SysUserLogic().Login(param).Result;
        if (result.Code == 1)
        {
            var sysUser = result.Data;
            #region 获取该用户access_token。--2019-07-17 若获取失败则登录失败。
            var getTokenResult = DiyToken.GetAccessToken<JObject>(new DiyTokenParam<JObject>()
            {
                CurrentUser = sysUser,
                OsClient = param.OsClient
            }).Result;
            if (getTokenResult.Code != 1)
            {
                return Task.FromResult(new SysUserReply
                {
                    Code = 0,
                    Msg = getTokenResult.Msg
                });
            }
            #endregion

            #region 过滤掉不该返回的字段，也可以map ViewModel
            sysUser.Pwd = "";
            #endregion

            result.Data = sysUser;
            result.DataAppend = new
            {
                SysMenuHomePage = (new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam() { OsClient = param.OsClient }).Result).Data
            };

            return Task.FromResult(new SysUserReply
            {
                Code = 1,
                Msg = getTokenResult.Msg ?? ""
            });
        }
        return Task.FromResult(new SysUserReply
        {
            Code = 0,
            Msg = result.Msg
        });
    }
}