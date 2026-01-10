using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8引擎内置方法/函数接口
    /// </summary>
    public interface IV8Method
    {
        /// <summary>
        /// 解析查询条件
        /// </summary>
        List<DiyWhere> ParseWhere(object whereParam);

        /// <summary>
        /// 获取客户端IP地址
        /// </summary>
        DosResult<string> GetClientIP();

        /// <summary>
        /// 设置系统用户角色信息
        /// </summary>
        JObject SetSysUserRoleInfo(dynamic userModel, string osClient);

        /// <summary>
        /// 刷新登录用户身份信息，token以旧换新
        /// </summary>
        DosResult<dynamic> RefreshLoginUser(string userId, string osClient = null);

        /// <summary>
        /// 获取当前token
        /// </summary>
        CurrentToken GetCurrentToken(string token = null, string osClient = null);

        /// <summary>
        /// 动态参数转换为上传参数
        /// </summary>
        DiyUploadParam DynamicToDiyUploadParam(dynamic dynamicParam);

        /// <summary>
        /// 获取私有文件地址
        /// </summary>
        DosResult GetPrivateFileUrl(dynamic dynamicParam);

        /// <summary>
        /// 上传文件
        /// </summary>
        DosResult Upload(dynamic dynamicParam);

        /// <summary>
        /// 获取访问token
        /// </summary>
        DosResult<CurrentToken> GetAccessToken(dynamic dynamicParam);

        /// <summary>
        /// 获取当前时间戳
        /// </summary>
        long GetTimestamp();

        /// <summary>
        /// 动态参数转换为系统日志参数
        /// </summary>
        SysLogParam DynamicToSysLogParam(dynamic dynamicParam);

        /// <summary>
        /// 添加系统日志
        /// </summary>
        DosResult AddSysLog(dynamic dynamicParam);
    }
}