#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：Sys_TrainerManageLogic
* Copyright(c) www.iTdos.com
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：
* 创建日期：2016/10/28 11:00:49
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web;
//using System.Web.Configuration;
using Dos.Common;
using Dos.ORM;
// using Esprima.Ast;
using Microi.net.Model;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;


namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public partial class SysUserLogic
    {
        private readonly IMicroiWeChat _templateMessageInterface;
        private readonly IV8Engine _v8Engine = new V8Engine();
        private static FormEngine _formEngine;// = new FormEngine();
        public static List<string> CantUpt = new List<string>()
        {
            //Guid.Parse("446C7239-E0D0-412D-B84C-A9C2F82AF44C"),
            //Guid.Parse("9C2C228A-B4AF-4B78-BE81-C0309F579DF7"),
            //Guid.Parse("FF832B1D-41A6-42A9-8E5D-C0874B9D5B33"),
            //Guid.Parse("95B3BC3F-CAEB-4FEB-9F7E-CC7E922E6032"),
        };

        public SysUserLogic()
        {
            _formEngine = new FormEngine();
        }
        public SysUserLogic(IMicroiWeChat templateMessageInterface)
        {
            _templateMessageInterface = templateMessageInterface;
            _formEngine = new FormEngine(templateMessageInterface);
        }

        //public async Task<DosResultList<SysUser>> GetSysUserPublicInfo(SysUserParam param)
        //{
        //    if (param.OsClient.DosIsNullOrWhiteSpace())
        //    {
        //        param.OsClient = DiyToken.GetCurrentOsClient();
        //    }
        //    if (param.OsClient.DosIsNullOrWhiteSpace())
        //    {
        //        return new DosResultList<SysUser>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
        //    }
        //    DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
        //    var msg = "";
        //    var where = new Where<SysUser>();
        //    if (!string.IsNullOrWhiteSpace(param._Keyword))
        //    {
        //        where.And(d => d.Account.Like(param._Keyword)
        //                    || d.Name.Like(param._Keyword)
        //                    || d.Phone.Like(param._Keyword)
        //                    || d.Remark.Like(param._Keyword)
        //                    );
        //    }
        //    if (!string.IsNullOrWhiteSpace(param.Account))
        //    {
        //        where.And(d => d.Account.Like(param.Account));
        //    }
        //    if (param.DeptId != null)
        //    {
        //        where.And(d => d.DeptId == param.DeptId || d.DeptIds.Like(param.DeptId.ToString()));
        //    }
        //    if (param.Ids != null)
        //    {
        //        where.And(d => d.Id.In(param.Ids));
        //    }
        //    if (!string.IsNullOrWhiteSpace(param.RealName))
        //    {
        //        where.And(d => d.Name.Like(param.RealName));
        //    }
        //    if (!string.IsNullOrWhiteSpace(param.Phone))
        //    {
        //        where.And(d => d.Phone.Like(param.Phone));
        //    }
        //    if (!string.IsNullOrWhiteSpace(param.Remark))
        //    {
        //        where.And(d => d.Remark.Like(param.Remark));
        //    }
        //    var fs = dbSession.From<SysUser>();
        //    if (param.IsDeleted != null)
        //    {
        //        where.And(d => d.IsDeleted == param.IsDeleted.Value);
        //    }
        //    fs.Where(where);

        //    var dataCount = fs.Count();

        //    fs.OrderByDescending(d => d.CreateTime);
        //    if (param._PageIndex != null && param._PageSize != null)
        //    {
        //        fs.Page(param._PageSize.Value, param._PageIndex.Value);
        //    }
        //    else {
        //        fs.Top(100);
        //    }
        //    var list = fs.ToList();
        //    return new DosResultList<SysUser>(1, list, null, dataCount);
        //}
        public async Task<DosResultList<SysUser>> GetSysUser(SysUserParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<SysUser>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            var where = new Where<SysUser>();

            //默认情况下不指定Level
            //if (param._CurrentSysUser != null && param._CurrentSysUser._IsAdmin != true && param._LevelLimit != false)
            //{
            //    if (param._CurrentSysUser.DeptId == null)
            //    {
            //        where.And(d => d.Level <= param._CurrentSysUser.Level);
            //    }
            //    else
            //    {
            //        where.And(d => d.Level <= param._CurrentSysUser.Level && d.DeptIds.Like(param._CurrentSysUser.DeptId.ToString()));
            //    }
            //}

            #region 2023-03-22:如果当前用户是在独立机构下，只返回独立机构下的人员
            if (param._CurrentSysUser != null && !param._CurrentSysUser.DeptId.DosIsNullOrWhiteSpace() && param._LevelLimit != false)
            {
                try
                {
                    var deptModelResult = await _formEngine.GetFormDataAsync(new
                    {
                        FormEngineKey = "Sys_Dept",
                        Id = param._CurrentSysUser.DeptId,
                        OsClient = param.OsClient
                    });
                    if (deptModelResult.Code == 1)
                    {
                        var deptModel = deptModelResult.Data;
                        var codes = ((string)deptModel.Code).Split('-');
                        var searchCodes = new List<string>();
                        var tempIndex = 0;
                        foreach (var code in codes)
                        {
                            if (tempIndex > 0)
                            {
                                searchCodes.Add(searchCodes[tempIndex - 1] + code + "-");
                            }
                            else
                            {
                                searchCodes.Add(code + "-");
                            }
                            tempIndex++;
                        }
                        var deptListResult = await _formEngine.GetTableDataAsync(new
                        {
                            FormEngineKey = "Sys_Dept",
                            _OrderBy = "Code",
                            _OrderByType = "ASC",
                            _Where = new List<DiyWhere>() {
                                        new DiyWhere(){
                                            Name = "Code",
                                            Value = JsonConvert.SerializeObject(searchCodes),
                                            Type = "In"
                                        }
                                    },
                            OsClient = param.OsClient
                        });
                        if (deptListResult.Code == 1)
                        {
                            var deptList = deptListResult.Data;
                            foreach (var dept in deptList)
                            {
                                if (dept.IsCompany == 1)
                                {
                                    var likeDeptCode = (string)dept.Code;
                                    var likeDeptId = (string)dept.Id;
                                    //2023-05-15新增：也要返回兼职的人
                                    where.And(d => d.DeptCode.StartsWith(likeDeptCode) || d.DeptIds.Like(likeDeptId));
                                    break;
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
Console.WriteLine("未处理的异常：" + ex.Message);
                }
            }
            #endregion


            if (!string.IsNullOrWhiteSpace(param._Keyword))
            {
                where.And(d => d.Account.Like(param._Keyword)
                            || d.Name.Like(param._Keyword)
                            || d.Phone.Like(param._Keyword)
                            || d.Remark.Like(param._Keyword)
                            );
            }
            if (!string.IsNullOrWhiteSpace(param.Account))
            {
                where.And(d => d.Account.Like(param.Account));
            }
            if (param.DeptId != null)
            {
                where.And(d => d.DeptId == param.DeptId || d.DeptIds.Like(param.DeptId.ToString()));
            }
            if (param.Ids != null)
            {
                where.And(d => d.Id.In(param.Ids));
            }
            if (param.State != null)
            {
                where.And(d => d.State == param.State);
            }
            if (!string.IsNullOrWhiteSpace(param.RealName))
            {
                where.And(d => d.Name.Like(param.RealName));
            }
            if (!string.IsNullOrWhiteSpace(param.Phone))
            {
                where.And(d => d.Phone.Like(param.Phone));
            }
            if (!string.IsNullOrWhiteSpace(param.Remark))
            {
                where.And(d => d.Remark.Like(param.Remark));
            }
            //var fs = DbClassiTdos.DbSession.From<SysUser>();
            var fs = dbSession.From<SysUser>()
                                .Select(new SysUser().GetFields());
            var fkIds = new List<string>();

            #region 2022-04-07注意：In（多个）查询和Like（双边%%）一样，几乎不走索引，还不如使用Like算了？实际上应该LeftJoin表然后使用or = ？
            if (param.GroupIds != null && param.GroupIds.Any())
            {
                //fs.Select<SysUserFk>((a, b) => new { a.All });
                //fs.InnerJoin<SysUserFk>((a, b) => a.Id == b.UserId && b.FkId.In(param.GroupIds) && b.Type == "Group");
                
            }
            if (param.PostIds != null && param.PostIds.Any())
            {
                //fs.Select<SysUserFk>((a, b) => new { a.All });
                //fs.InnerJoin<SysUserFk>((a, c) => a.Id == c.UserId && c.FkId.In(param.PostIds) && c.Type == "Post");
            }

            if (param.RoleIds != null && param.RoleIds.Any())
            {
                //fs.Select<SysUserFk>((a, b) => new { a.All });
                //fs.InnerJoin<SysUserFk>((a, d) => a.Id == d.UserId && d.FkId.In(param.RoleIds) && d.Type == "Role");

                var where2 = new Where<SysUser>();
                foreach (var item in param.RoleIds)
                {
                    where2.Or(d => d.RoleIds.Like(item.ToString()));
                }
                where.And(where2.ToWhereClip());
            }
            //if (param._RoleIds != null && param._RoleIds.Any())
            //{
            //    fs.Select<SysUserFk>((a, b) => new { a.All });
            //    fs.InnerJoin<SysUserFk>((a, d) => a.Id == d.UserId &&param._RoleIds.Contains() && d.Type == "Role");
            //}
            if (param.DeptIds != null && param.DeptIds.Any())
            {
                //fs.Select<SysUserFk>((a, b) => new { a.All });
                //fs.InnerJoin<SysUserFk>((a, e) => a.Id == e.UserId && e.FkId.In(param.DeptIds) && e.Type == "Dept");

                var where2 = new Where<SysUser>();
                foreach (var item in param.DeptIds)
                {
                    foreach (var deptId in item)
                    {
                        where2.Or(d => d.DeptIds.Like(deptId.ToString()) || d.DeptId == deptId);
                    }
                }
                where.And(where2.ToWhereClip());
            }
            #endregion
            if (param.IsDeleted != null)
            {
                where.And(d => d.IsDeleted == param.IsDeleted.Value);
            }
            else
            {
                where.And(d => d.IsDeleted == 0);
            }
            fs.Where(where);

            var dataCount = fs.Count();

            fs.OrderByDescending(d => d.CreateTime);
            if (param._PageIndex != null && param._PageSize != null)
            {
                fs.Page(param._PageSize.Value, param._PageIndex.Value);
            }



            var sysUserList = fs.ToList();

            #region 循环获取每个用户的角色
            //取所有角色
            var allRoles = await new SysRoleLogic().GetSysRole(new SysRoleParam()
            {
                IsDeleted = 0,
                OsClient = param.OsClient
            });

            ////取所有用户的所有角色
            //var allUserRoles = await new SysUserFkLogic().GetSysUserFk(new SysUserFkParam()
            //{
            //    UserIds = sysUserList.Select(d => d.Id).ToList(),
            //    OsClient = param.OsClient
            //});
            foreach (var user in sysUserList)
            {
                //取当前用户的所有角色Id
                //var roleIds = allUserRoles.Where(d => d.UserId == item.Id && d.Type == "Role").Select(d => d.FkId).ToList();

                var roleIds = new List<string>();
                if (!user.RoleIds.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        if(!user.RoleIds.Contains("{")){
                            var roleIdsList = JsonConvert.DeserializeObject<List<string>>(user.RoleIds) ?? new List<string>();
                            roleIds = roleIdsList;
                        }else{
                            var rolesList = JsonConvert.DeserializeObject<List<SysRole>>(user.RoleIds) ?? new List<SysRole>();
                            roleIds = rolesList.Select(d => d.Id).ToList();
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                        var rolesList = JsonConvert.DeserializeObject<List<SysRole>>(user.RoleIds) ?? new List<SysRole>();
                        roleIds = rolesList.Select(d => d.Id).ToList();
                        ////取当前用户所有角色
                        //var roleIdsResult = await new SysUserFkLogic().GetSysUserFk(new SysUserFkParam()
                        //{
                        //    UserId = param._CurrentSysUser.Id,
                        //    Type = "Role",
                        //    OsClient = param.OsClient
                        //});//, dbSession
                        //roleIds = roleIdsResult.Select(d => d.FkId).ToList();
                    }
                    //再取所有角色
                    var roleList = allRoles.Data.Where(d => roleIds.Contains(d.Id)).ToList();//.Select(d=>new { d.Id ,d.Name})
                    user._Roles = roleList;
                    //await GetSysUserOtherInfo(item, param.OsClient);
                }
                else
                {
                    user._Roles = new List<SysRole>();
                }
            }
            #endregion

            return new DosResultList<SysUser>(1, sysUserList, null, dataCount);
        }
        /// <summary>
        /// 传入Id或Account
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<SysUser>> GetSysUserModel(SysUserParam param)
        {
            if ((param.Id.DosIsNullOrWhiteSpace() && string.IsNullOrWhiteSpace(param.Account))
                )
            {
                return new DosResult<SysUser>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<SysUser>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            SysUser model = null;
            if (!param.Id.DosIsNullOrWhiteSpace())
            {
                //model = await SysUserCache.GetSysUserModel(param.Id, param.OsClient);
            }
            else if (!param.Account.DosIsNullOrWhiteSpace())
            {
                //model = await SysUserCache.GetSysUserModel(param.Account, param.OsClient);
            }
            if (model != null)
            {
                return new DosResult<SysUser>(1, model);
            }


            //model = SysUserRepository.First(d => d.Id == param.Id || d.Account == param.Account);
            model = dbSession.From<SysUser>()
                            .Select(new SysUser().GetFields())
                            .Where(d => d.Id == param.Id || d.Account == param.Account).First();
            if (model == null)
            {
                return new DosResult<SysUser>(0, null, DiyMessage.GetLang(param.OsClient,  "NoAccount", param._Lang));
            }

            await GetSysUserOtherInfo(model, param.OsClient);


            //SysUserCache.SetSysUserModel(model, param.OsClient);
            return new DosResult<SysUser>(1, model);
        }
        /// <summary>
        /// 传入Id或Account
        /// </summary>
        /// <param name="param"></param>
        /// <returns>返回的是JObject类型的dynamic</returns>
        public async Task<DosResult<dynamic>> GetDiySysUserModel(SysUserParam param)
        {
            if ((param.Id.DosIsNullOrWhiteSpace() && string.IsNullOrWhiteSpace(param.Account))
                )
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            dynamic model = null;
            var _where = new List<DiyWhere>();
            if (!param.Id.DosIsNullOrWhiteSpace())
            {
                //model = await SysUserCache.GetDiySysUserModel(param.Id, param.OsClient);
                _where.Add(new DiyWhere()
                {
                    Name = "Id",
                    Value = param.Id,
                    Type = "="
                });
            }
            else if (!param.Account.DosIsNullOrWhiteSpace())
            {
                //model = await SysUserCache.GetDiySysUserModel(param.Account, param.OsClient);
                _where.Add(new DiyWhere()
                {
                    Name = "Account",
                    Value = param.Account,
                    Type = "="
                });
            }
            if (model != null)
            {
                return new DosResult<dynamic>(1, model);
            }

            //model = SysUserRepository.First(d => d.Id == param.Id || d.Account == param.Account);
            //model = dbSession.From<SysUser>()
            //                .Select(new SysUser().GetFields())
            //                .Where(d => d.Id == param.Id || d.Account == param.Account).First<dynamic>();

            var modelDynamicResult = await _formEngine.GetFormDataAsync(new
            {
                FormEngineKey = "Sys_User",
                _Where = _where,
                OsClient = param.OsClient
            });
            if (modelDynamicResult.Code != 1)
            {
                return modelDynamicResult;
            }
            model = modelDynamicResult.Data;


            if (model == null)
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "NoAccount", param._Lang));
            }

            JObject resultModel = JObject.FromObject(model);
            await GetSysUserOtherInfo(resultModel, param.OsClient);
            //SysUserCache.SetDiySysUserModel(model, param.OsClient);
            return new DosResult<dynamic>(1, resultModel);
        }

        public class SysConfigPwd
        {
            //PwdShortestLength
            //PwdContainNumber
            //PwdContainSpecial
            //PwdContainUpperLower
            //PwdAllowErrorCount
            //PwdErrorLockTime
            //PwdAllowMultiLogin
            public int PwdShortestLength { get; set; }
            public bool? PwdContainNumber { get; set; }
            public bool? PwdContainSpecial { get; set; }
            public bool? PwdContainUpperLower { get; set; }
            public int PwdAllowErrorCount { get; set; }
            public int PwdErrorLockTime { get; set; }
            public bool? PwdAllowMultiLogin { get; set; }
        }
        public async Task<string> CheckPwd(string pwd, string Lang = "")
        {
            if (Lang.DosIsNullOrWhiteSpace())
            {
                Lang = DiyMessage.Lang;
            }
            #region 密码强度
            try
            {
                var paramPwd = new DiyTableRowParam();
                paramPwd.TableName = "Sys_Config";
                paramPwd._SearchEqual = new Dictionary<string, string>();
                paramPwd._SearchEqual.Add("IsEnable", "1");
                var diySysConfigResult = await new DiyTableLogic().GetDiyTableRowModel<SysConfigPwd>(paramPwd);
                if (diySysConfigResult.Code == 1)
                {
                    var sysConfig = diySysConfigResult.Data;
                    if (sysConfig.PwdShortestLength != 0 && sysConfig.PwdShortestLength > 0)
                    {
                        if (pwd.Length < sysConfig.PwdShortestLength)
                        {
                            return "密码最低长度：" + sysConfig.PwdShortestLength;
                        }
                    }
                    else
                    {
                        if (pwd.Length < 6 || pwd.Length > 20)
                        {
                            return DiyMessage.GetLang("",  "PwdLength", Lang);
                        }
                    }
                    if (sysConfig.PwdContainNumber == true)
                    {
                        var tempList = new List<int>() { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
                        if (!tempList.Any(d => pwd.Contains(d.ToString())))
                        {
                            return "密码必须包含数字！";
                        }
                    }
                    if (sysConfig.PwdContainSpecial == true)
                    {
                        var tempList = new List<string>() { "~", "`", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "=", "+", "[", "{", "]", "}", "\\",
                                                            "、", "【", "】", "|", "·", ";", ":", "\"", "'", ",", "<", "《", "。", ".", "》", ">", "/", "?", "？", "、", "￥", "……" };
                        if (!tempList.Any(d => pwd.Contains(d.ToString())))
                        {
                            return "密码必须包含特殊字符！";
                        }
                    }
                }
                else
                {
                    if (pwd.Length < 6 || pwd.Length > 20)
                    {
                        return DiyMessage.GetLang("",  "PwdLength", Lang);
                    }
                }

            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                if (pwd.Length < 6 || pwd.Length > 20)
                {
                    return DiyMessage.GetLang("",  "PwdLength", Lang);
                }
            }


            #endregion
            return "";
        }
        /// <summary>
        /// 新增用户。必传：Account、Pwd
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> AddSysUser(SysUserParam param)
        {
            #region Check
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            //if (param.DeptId == null)
            //{
            //    return new DosResult(0, null, "组织机构必选！");
            //}
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            var isPass = false;
            var errorMsg = "";
            param.Account = param.Account.DosTrim();
            if (string.IsNullOrEmpty(param.Account) || string.IsNullOrWhiteSpace(param.Pwd))
            {
                errorMsg = DiyMessage.GetLang(param.OsClient,  "AccountNoNull", param._Lang); goto CheckEnd;
            }
            if (param.Account.Length < 2 || param.Account.Length > 20)
            {
                errorMsg = DiyMessage.GetLang(param.OsClient,  "AccountLength", param._Lang); goto CheckEnd;
            }
            var checkPwdResult = await CheckPwd(param.Pwd);
            if (!checkPwdResult.DosIsNullOrWhiteSpace())
            {
                errorMsg = checkPwdResult; goto CheckEnd;
            }
            //if (SysUserRepository.Any(d => d.Account == param.Account))
            if (dbSession.From<SysUser>().Where(d => d.Account == param.Account).Count() > 0)
            {
                errorMsg = DiyMessage.GetLang(param.OsClient,  "HaveAccount", param._Lang); goto CheckEnd;
            }
            isPass = true;
        CheckEnd:
            if (!isPass)
            {
                return new DosResult(0, null, errorMsg);
            }

            
            #endregion


            #region  通用新增
            var model = MapperHelper.Map<object, SysUser>(param);
            model.Id = Guid.NewGuid().ToString();
            #endregion end

            if (model.DeptId != null)
            {
                var deptModel = await new SysDeptLogic().GetSysDeptModel(new SysDeptParam()
                {
                    Id = model.DeptId
                });
                if (deptModel.Code != 1)
                {
                    return new DosResult(0, null, deptModel.Msg);
                }
                if (deptModel.Data.Code.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "部门编码为空，请修改部门！");
                }
                if (model.DeptCode != deptModel.Data.Code)
                {
                    model.DeptCode = deptModel.Data.Code;
                }
            }
           
            #region 处理No

            //var thisYear = DateTime.Parse((DateTime.Now.Year) + "-01-01");
            //var nextYear = DateTime.Parse((DateTime.Now.Year + 1) + "-01-01");
            //var tCount = SysUserRepository.Count(d => d.CreateTime < nextYear && d.CreateTime >= thisYear);
            //tCount++;
            //var tCountStr = "";
            //if (tCount >= 1000)
            //{
            //    tCountStr = tCount.ToString();
            //}
            //else
            //{
            //    var length = 4 - tCount.ToString().Length;
            //    for (int i = 0; i < length; i++)
            //    {
            //        tCountStr += "0";
            //    }
            //    tCountStr += tCount;
            //}
            //model.No = "Hr" + DateTime.Now.Year + "#" + tCountStr;
            #endregion
            model.State = param.State ?? 1;
            //model.InitCalendar = param.InitCalendar ?? false;
            model.CreateTime = DateTime.Now;
            if (!param._EncodePwd.DosIsNullOrWhiteSpace())
            {
                model.Pwd = param._EncodePwd;
            }
            else {
                model.Pwd = EncryptHelper.DESEncode(param.Pwd);
            }
            model.Account = param.Account.DosTrim();
            model.Sex = param.Sex;
            //model.RealName = param.Name;
            using (var trans = dbSession.BeginTransaction())//DbClassiTdos.DbSession
            {
                var count = 0;

                //var fkList = new List<SysUserFk>();
                #region 外键数据
                //if (param.GroupIds != null)
                //{
                //    foreach (var paramGroupId in param.GroupIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Group",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //}
                //if (param.RoleIds != null)
                //{
                //    foreach (var paramGroupId in param.RoleIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Role",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //}
                //if (param.DeptIds != null)
                //{
                //    foreach (var paramGroupId in param.DeptIds)
                //    {
                //        foreach (var item in paramGroupId)
                //        {
                //            fkList.Add(new SysUserFk()
                //            {
                //                Id = Guid.NewGuid().ToString(),
                //                UserId = model.Id,
                //                FkId = item,//paramGroupId,
                //                Type = "Dept",
                //                CreateTime = DateTime.Now
                //            });
                //        }

                //    }
                //}
                //if (param.PostIds != null)
                //{
                //    foreach (var paramGroupId in param.PostIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Post",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //}

                //if (fkList.Any())
                //{
                //    trans.Delete<SysUserFk>(d =>
                //        d.UserId == model.Id && (d.Type == "Group" || d.Type == "Role" || d.Type == "Dept" ||
                //                                 d.Type == "Post"));
                //    count += trans.Insert(fkList);
                //}
                #endregion
                //var count = SysUserRepository.Insert(model);
                if (model.Name.DosIsNullOrWhiteSpace())
                {
                    model.Name = model.Account;
                }
                count += trans.Insert(model);
                trans.Commit();
                return new DosResult(count > 0 ? 1 : 0, model, count > 0 ? "" : DiyMessage.GetLang(param.OsClient,  "Line0", param._Lang));
            }
        }

        /// <summary>
        /// 新增用户。必传：Account、Pwd
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> AddSysUserDynamic(SysUserParam param)
        {
            #region Check
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            //if (param.DeptId == null)
            //{
            //    return new DosResult(0, null, "组织机构必选！");
            //}
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            var isPass = false;
            var errorMsg = "";
            param.Account = param.Account.DosTrim();
            if (string.IsNullOrEmpty(param.Account) || string.IsNullOrWhiteSpace(param.Pwd))
            {
                errorMsg = DiyMessage.GetLang(param.OsClient,  "AccountNoNull", param._Lang); goto CheckEnd;
            }
            if (param.Account.Length < 2 || param.Account.Length > 20)
            {
                errorMsg = DiyMessage.GetLang(param.OsClient,  "AccountLength", param._Lang); goto CheckEnd;
            }
            var checkPwdResult = await CheckPwd(param.Pwd);
            if (!checkPwdResult.DosIsNullOrWhiteSpace())
            {
                errorMsg = checkPwdResult; goto CheckEnd;
            }
            //if (SysUserRepository.Any(d => d.Account == param.Account))
            if (dbSession.From<SysUser>().Where(d => d.Account == param.Account).Count() > 0)
            {
                errorMsg = DiyMessage.GetLang(param.OsClient,  "HaveAccount", param._Lang); goto CheckEnd;
            }
            isPass = true;
        CheckEnd:
            if (!isPass)
            {
                return new DosResult(0, null, errorMsg);
            }


            #endregion


            #region  通用新增
            var model = MapperHelper.Map<object, SysUser>(param);
            model.Id = Guid.NewGuid().ToString();
            #endregion end

            if (model.DeptId != null)
            {
                var deptModel = await new SysDeptLogic().GetSysDeptModel(new SysDeptParam()
                {
                    Id = model.DeptId
                });
                if (deptModel.Code != 1)
                {
                    return new DosResult(0, null, deptModel.Msg);
                }
                if (deptModel.Data.Code.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "部门编码为空，请修改部门！");
                }
                if (model.DeptCode != deptModel.Data.Code)
                {
                    model.DeptCode = deptModel.Data.Code;
                }
            }

            #region 处理No

            //var thisYear = DateTime.Parse((DateTime.Now.Year) + "-01-01");
            //var nextYear = DateTime.Parse((DateTime.Now.Year + 1) + "-01-01");
            //var tCount = SysUserRepository.Count(d => d.CreateTime < nextYear && d.CreateTime >= thisYear);
            //tCount++;
            //var tCountStr = "";
            //if (tCount >= 1000)
            //{
            //    tCountStr = tCount.ToString();
            //}
            //else
            //{
            //    var length = 4 - tCount.ToString().Length;
            //    for (int i = 0; i < length; i++)
            //    {
            //        tCountStr += "0";
            //    }
            //    tCountStr += tCount;
            //}
            //model.No = "Hr" + DateTime.Now.Year + "#" + tCountStr;
            #endregion
            model.State = param.State ?? 1;
            //model.InitCalendar = param.InitCalendar ?? false;
            model.CreateTime = DateTime.Now;
            if (!param._EncodePwd.DosIsNullOrWhiteSpace())
            {
                model.Pwd = param._EncodePwd;
            }
            else
            {
                model.Pwd = EncryptHelper.DESEncode(param.Pwd);
            }
            model.Account = param.Account.DosTrim();
            model.Sex = param.Sex;
            //model.RealName = param.Name;
            using (var trans = dbSession.BeginTransaction())//DbClassiTdos.DbSession
            {
                var count = 0;

                //var fkList = new List<SysUserFk>();
                #region 外键数据
                //if (param.GroupIds != null)
                //{
                //    foreach (var paramGroupId in param.GroupIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Group",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //}
                //if (param.RoleIds != null)
                //{
                //    foreach (var paramGroupId in param.RoleIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Role",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //}
                //if (param.DeptIds != null)
                //{
                //    foreach (var paramGroupId in param.DeptIds)
                //    {
                //        foreach (var item in paramGroupId)
                //        {
                //            fkList.Add(new SysUserFk()
                //            {
                //                Id = Guid.NewGuid().ToString(),
                //                UserId = model.Id,
                //                FkId = item,//paramGroupId,
                //                Type = "Dept",
                //                CreateTime = DateTime.Now
                //            });
                //        }

                //    }
                //}
                //if (param.PostIds != null)
                //{
                //    foreach (var paramGroupId in param.PostIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Post",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //}

                //if (fkList.Any())
                //{
                //    trans.Delete<SysUserFk>(d =>
                //        d.UserId == model.Id && (d.Type == "Group" || d.Type == "Role" || d.Type == "Dept" ||
                //                                 d.Type == "Post"));
                //    count += trans.Insert(fkList);
                //}
                #endregion
                //var count = SysUserRepository.Insert(model);
                if (model.Name.DosIsNullOrWhiteSpace())
                {
                    model.Name = model.Account;
                }
                count += trans.Insert(model);
                trans.Commit();
                return new DosResult(count > 0 ? 1 : 0, model, count > 0 ? "" : DiyMessage.GetLang(param.OsClient,  "Line0", param._Lang));
            }
        }

        public class EncodePwdResult
        {
            public bool IsPass { get; set; }
            public string EncodePwd { get; set; }
        }
        /// <summary>
        /// param必须包含OsClient、_CurrentSysUser、Account
        /// needEqualPwd是加密后的原密码
        /// </summary>
        /// <param name="param"></param>
        /// <param name="oriPwd"></param>
        /// <returns></returns>
        /// <exception cref="Exception"></exception>
        public async Task<EncodePwdResult> GetEncodePwd(dynamic sysUser, string osClient, string needEncodePwd , string dbEncodedPwd , string encodedPwd, string needEncodeAccount)
        {
            var desEncodePwd = EncryptHelper.DESEncode(needEncodePwd);
            var v8EncodePwd = "";
            DbSession dbSession = OsClient.GetClient(osClient).Db;
            DbSession dbRead = OsClient.GetClient(osClient).DbRead;
            //取系统设置
            //var sysConfig = await _formEngine.GetFormDataAsync(new
            //{
            //    FormEngineKey = "Sys_Config",
            //    _SearchEqual = new
            //    {
            //        IsEnable = 1
            //    },
            //    OsClient = osClient
            //});
            var sysConfig = await _formEngine.GetSysConfig(osClient);
            if (!encodedPwd.DosIsNullOrWhiteSpace())
            {
                if (encodedPwd == dbEncodedPwd)
                {
                    return new EncodePwdResult()
                    {
                        EncodePwd = encodedPwd,
                        IsPass = true
                    };
                }
                return new EncodePwdResult()
                {
                    EncodePwd = encodedPwd,
                    IsPass = false
                };
            }
            else
            {
                //先获取1次V8加密后的代码（考虑到有些人一开始是V8加密，后来改成了DES）
                if (sysConfig.Code == 1)//sysUser.PwdEncode != "DES"  && sysConfig.Data.PwdEncode == "V8"
                {
                    #region 先执行全局服务器端v8引擎代码
                    var v8EngineParam = new V8EngineParam()
                    {
                        CurrentUser = null, // param._CurrentSysUser,
                        Db = dbSession,
                        DbRead = dbRead,
                        DiyTableLogic = new DiyTableLogic(),
                        Action = new Dictionary<string, object>(),
                        Param = new Dictionary<string, object>(),
                        OsClient = osClient,

                    };
                    try
                    {
                        var GlobalServerV8Code = (string)sysConfig.Data.GlobalServerV8Code;
                        //解密
                        try
                        {
                            if(DiyCommon.IsBase64String(GlobalServerV8Code)){
                                GlobalServerV8Code = Encoding.Default.GetString(Convert.FromBase64String(GlobalServerV8Code));
                            }
                        }
                        catch (Exception ex)
                        {
                        }
                        v8EngineParam.V8Code = GlobalServerV8Code;
                        v8EngineParam = _v8Engine.Run(v8EngineParam);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                        //throw new Exception("执行[全局服务器端V8引擎代码]出现错误：" + ex.Message);
                    }
                    #endregion
                    #region 执行密码V8
                    v8EngineParam.Param.Add("PwdType", "Encode");
                    v8EngineParam.Param.Add("Account", needEncodeAccount);
                    v8EngineParam.Param.Add("Pwd", needEncodePwd);
                    v8EngineParam.Param.Add("SysConfig", sysConfig.Data);
                    //解密
                    try
                    {
                        var PwdV8 = (string)sysConfig.Data.PwdV8;
                        if(DiyCommon.IsBase64String(PwdV8)){
                            sysConfig.Data.PwdV8 = Encoding.Default.GetString(Convert.FromBase64String(PwdV8));
                        }
                    }
                    catch (Exception ex) { }
                        
                
                    //然后执行服务器端数据处理v8引擎代码
                    try
                    {
                        v8EngineParam.V8Code = (string)sysConfig.Data.PwdV8;

                        v8EngineParam = _v8Engine.Run(v8EngineParam);
                        if (v8EngineParam.Result != null)
                        {
                            v8EncodePwd = v8EngineParam.Result.ToString();
                            
                        }
                    }
                    catch (Exception ex)
                {
Console.WriteLine("未处理的异常：" + ex.Message);
                }
                    #endregion
                }

                //获取加密后要返回的密码，可能是V8，也可能是DES
                var encodedPwdResult = "";
                try
                {
                    if (sysUser.PwdEncode == "DES")
                        encodedPwdResult = desEncodePwd;
                    else if (sysUser.PwdEncode == "V8" || sysConfig.Data.PwdEncode == "V8")
                        encodedPwdResult = v8EncodePwd.DosIsNullOrWhiteSpace() ? desEncodePwd : v8EncodePwd;
                    else
                        encodedPwdResult = desEncodePwd;
                }
                catch (Exception ex)
                {
                    Console.WriteLine("未处理的异常：" + ex.Message);
                    encodedPwdResult = desEncodePwd;
                }

                //如果不需要比对密码
                if (dbEncodedPwd.DosIsNullOrWhiteSpace())
                {
                    return new EncodePwdResult()
                    {
                        EncodePwd = encodedPwdResult,
                        IsPass = false
                    };
                }
                //如果需要对比密码
                return new EncodePwdResult()
                {
                    EncodePwd = encodedPwdResult,
                    IsPass = dbEncodedPwd == desEncodePwd || dbEncodedPwd == v8EncodePwd
                };
            }
            
        }

        /// <summary>
        /// 用户登录。必传：Account、Pwd
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<dynamic>> Login(SysUserParam param)
        {
            //LogHelper.Debug("开始1", "调试Login_");
            if (string.IsNullOrWhiteSpace(param.Account) || string.IsNullOrWhiteSpace(param.Pwd)
                //|| param.OsClient.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountNoNull", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            //LogHelper.Debug("开始2", "调试Login_");

            var clientModel = OsClient.GetClient(param.OsClient);
            DbSession dbSession = clientModel.Db;
            DbSession dbRead = clientModel.DbRead;
            var dbInfo = DiyCommon.GetDbInfo(clientModel.DbType);

            param.Account = param.Account.DosTrim();
            ////如果是爱居，判断 mac地址是否注册
            //if (param.OsClient == "Aijuhome" && param.Account.ToLower() != "admin")
            //{
            //    return new DosResult(0, null, "Mac地址未注册！请联系总部。");
            //}
            //LogHelper.Debug("开始3", "调试Login_");

            var pwd = "";// EncryptHelper.DESEncode(param.Pwd);
            //2023-05-23：----
            //var modelDynamic = dbRead.From<SysUser>()
            //                    .Select(new SysUser().GetFields())
            //                    .Where(d => d.Account == param.Account && d.IsDeleted == 0)
            //                    .First<dynamic>();// && d.Pwd == pwd
            var modelDynamicResult = await _formEngine.GetFormDataAsync(new {
                FormEngineKey = "Sys_User",
                _Where = new List<DiyWhere>() {
                    new DiyWhere() {
                        Name = "Account",
                        Value = param.Account,
                        Type = "="
                    }
                },
                OsClient = param.OsClient
            });
            if (modelDynamicResult.Code == 2)
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountOrPwdError", param._Lang));
            }
            if (modelDynamicResult.Code != 1)
            {
                modelDynamicResult.Msg = "获取Sys_User表信息出现错误：" + modelDynamicResult.Msg;
                return modelDynamicResult;
            }
            var modelDynamic = modelDynamicResult.Data;
            //-----end
            if (modelDynamic == null)
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountOrPwdError", param._Lang));
            }

            var encodePwdResult = await GetEncodePwd(modelDynamic, param.OsClient, param.Pwd, (string)modelDynamic.Pwd, param._EncodePwd, param.Account);
            if (!encodePwdResult.IsPass)
            {
                //错误3次处理
                //model.PwdErrorCount = model.PwdErrorCount + 1;
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountOrPwdError", param._Lang));
            }
            pwd = encodePwdResult.EncodePwd;

            //var model = SysUserRepository.First(d => d.Account == param.Account && d.Pwd == pwd);
            //先取帐号，再判断密码是否正确
            //LogHelper.Debug("开始4", "调试Login_");
            if (modelDynamic.State != 1)
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountStop", param._Lang));
            }

            //判断所属主要部门是否启用
            if (modelDynamic.DeptId != null)
            {
                var deptModel = await new SysDeptLogic().GetSysDeptModel(new SysDeptParam() { 
                    Id = (string)modelDynamic.DeptId,
                    OsClient = param.OsClient
                });
                if (deptModel.Code == 1 && deptModel.Data.State != 1)
                {
                    return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient,  "DeptStop", param._Lang));
                }
            }

            //model.GroupName = "";
            //var groupIds = SysUserFkRepository.Query(d => d.UserId == model.Id && d.Type == "Group").Select(d => d.FkId).ToList();
            //if (groupIds.Any())
            //{
            //    var groupModels = SysGroupRepository.Query(d => d.Id.In(groupIds));
            //    if (groupModels.Any())
            //    {
            //        model.GroupName = groupModels.OrderBy(d => d.ParentId).First().Name;
            //    }
            //}
            JObject model = JObject.FromObject(modelDynamic);
            await GetSysUserOtherInfo(model, param.OsClient);

            Task.Run(() =>
            {
                //model.LastLoginIP = IPHelper.GetClientIP(param._HttpContext);
                //model.LastLoginIP = param.LastLoginIP;
                //model.PwdErrorCount = 0;
                //2022-07-03注释
                //dbSession.Update(model);
            });
            //LogHelper.Debug("开始8", "调试Login_");

           
                new SysLogLogic().AddSysLog(new Microi.net.SysLogParam()
                {
                    Type = "登录日志",
                    Title = (((string)modelDynamic.Name).DosIsNullOrWhiteSpace() ? modelDynamic.Account : modelDynamic.Name) + "登录了系统",
                    //IP = IPHelper.GetClientIP(HttpContext),
                    OsClient = param.OsClient
                });
           

            return new DosResult<dynamic>(1, model);
        }
        /// <summary>
        /// 用户登录。必传：Account、Pwd
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<JObject>> DiyLogin(SysUserParam param)
        {
            //LogHelper.Debug("开始1", "调试Login_");
            if (string.IsNullOrWhiteSpace(param.Account) || string.IsNullOrWhiteSpace(param.Pwd)
                //|| param.OsClient.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountNoNull", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            //LogHelper.Debug("开始2", "调试Login_");

            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            DbSession dbRead = OsClient.GetClient(param.OsClient).DbRead;

            param.Account = param.Account.DosTrim();
            ////如果是爱居，判断 mac地址是否注册
            //if (param.OsClient == "Aijuhome" && param.Account.ToLower() != "admin")
            //{
            //    return new DosResult(0, null, "Mac地址未注册！请联系总部。");
            //}
            //LogHelper.Debug("开始3", "调试Login_");
            var model = dbRead.From<SysUser>()
                            .Select(new SysUser().GetFields())
                            .Where(d => d.Account == param.Account).First<dynamic>();// && d.Pwd == pwd
            var pwd = "";// EncryptHelper.DESEncode(param.Pwd);
            if (model == null)
            {
                return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountOrPwdError", param._Lang));
            }
            var encodeResult = await GetEncodePwd(model, param.OsClient, param.Pwd, (string)model.Pwd, param._EncodePwd, param.Account);
            if (!encodeResult.IsPass)
            {
                //错误3次处理
                //model.PwdErrorCount = model.PwdErrorCount + 1;
                return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountOrPwdError", param._Lang));
            }
            pwd = encodeResult.EncodePwd;
            //var model = SysUserRepository.First(d => d.Account == param.Account && d.Pwd == pwd);
            //先取帐号，再判断密码是否正确
            //LogHelper.Debug("开始4", "调试Login_");


            //var modelResult = await new FormEngine().GetFormDataAsync(new DiyTableRowParam
            //{
            //    TableName = "Sys_User",
            //    _SearchEqual = new Dictionary<string, string>() {
            //        { "Account" , param.Account },
            //    },
            //    OsClient = param.OsClient
            //});
            //if (modelResult.Code != 1)
            //{
            //    return new DosResult<JObject>(0, null, modelResult.Msg);
            //}
            //var model = modelResult.Data;


            if (model == null)
            {
                return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountOrPwdError", param._Lang));
            }
            if (model.State != 1)
            {
                return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountStop", param._Lang));
            }

            //判断所属主要部门是否启用
            if (model.DeptId != null)
            {
                //var deptModel = await new SysDeptLogic().GetSysDeptModel(new SysDeptParam()
                //{
                //    Id = model.DeptId,
                //    OsClient = param.OsClient
                //});
                var deptId = (string)model.DeptId;
                var deptModel = dbRead.From<SysDept>().Where(d => d.Id == deptId).First<dynamic>();// && d.Pwd == pwd

                //if (deptModel.Code == 1 && deptModel.Data.State != 1)
                if (deptModel.State != 1)
                {
                    return new DosResult<JObject>(0, null, DiyMessage.GetLang(param.OsClient,  "DeptStop", param._Lang));
                }
            }

            JObject resultModel = JObject.FromObject(model);

            await GetSysUserOtherInfo(resultModel, param.OsClient);

            new SysLogLogic().AddSysLog(new Microi.net.SysLogParam()
            {
                Type = "登录日志",
                Title = (model.Name == "" ? model.Account : model.Name) + "登录了系统",
                //IP = IPHelper.GetClientIP(HttpContext),
                OsClient = param.OsClient
            });

            return new DosResult<JObject>(1, resultModel);
        }

        public async Task<DosResult<dynamic>> RefreshLoginUser(string userId, string osClient)
        {
            if (userId.DosIsNullOrWhiteSpace() || osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, "刷新用户信息参数错误！");
            }
            var DiyCacheBase = new MicroiCacheRedis(osClient);

            DosResult<dynamic> userModelResult = null;
            try
            {
                //包含扩展信息
                CurrentToken<JObject> currentToken = await DiyCacheBase.GetAsync<CurrentToken<JObject>>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                if (currentToken != null)
                {
                    //userModelResult = await new SysUserLogic().GetDiySysUserModel(new SysUserParam()
                    //{
                    //    Id = currentToken.CurrentUser["Id"].ToString(),
                    //    OsClient = currentToken.OsClient
                    //});
                    userModelResult = await _formEngine.GetFormDataAsync(new {
                        FormEngineKey = "sys_user",
                        Id = currentToken.CurrentUser["Id"].ToString(),
                        _Where = new List<DiyWhere>() {
                                        new DiyWhere(){
                                            Name = "State",
                                            Value = "1",
                                            Type = "="
                                        }
                                    },
                    });
                    if (userModelResult.Code == 1)
                    {
                        var errorMsg = "";
                        #region GetSysUserOtherInfo
                        JObject sysUser = JObject.FromObject(userModelResult.Data);

                        //2022-11-17 从Sys_User表的RoleIds字段中获取所有角色Id
                        var roleIds = new List<string>();
                        try
                        {
                            try
                            {
                                roleIds = JsonConvert.DeserializeObject<List<string>>(sysUser["RoleIds"].Value<string>());
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine("未处理的异常：" + ex.Message);
                                var roles = JsonConvert.DeserializeObject<List<SysRole>>(sysUser["RoleIds"].Value<string>());
                                roleIds = roles.Select(d => d.Id).ToList();
                            }
                            if (!roleIds.Any())
                            {
                                sysUser.Add("_IsAdmin", false);
                                sysUser.Add("_Roles", JToken.FromObject(new List<SysRole>()));
                                sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
                            }
                            else
                            {
                                var roleList = await _formEngine.GetTableDataAsync<SysRole>(new
                                {
                                    FormEngineKey = "sys_role",
                                    _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "Id",
                                                Value = JsonConvert.SerializeObject(roleIds),
                                                Type = "In"
                                            }
                                        },
                                    //Ids = roleIds,
                                    OsClient = osClient
                                });

                                sysUser.Add("_Roles", JToken.FromObject(roleList.Data));


                                //var sysMenuLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                                //{
                                //    RoleIds = roleList.Data.Select(d => d.Id).ToList(),
                                //    OsClient = osClient
                                //});

                                var sysMenuLimits = await _formEngine.GetTableDataAsync<SysRoleLimit>(new
                                {
                                    FormEngineKey = "sys_rolelimit",
                                    _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "RoleId",
                                                Value = JsonConvert.SerializeObject(roleList.Data.Select(d => d.Id).ToList()),
                                                Type = "In"
                                            }
                                        },
                                    OsClient = osClient
                                });
                                if (sysMenuLimits.Code == 1)
                                {
                                    sysUser.Add("_RoleLimits", JToken.FromObject(sysMenuLimits.Data));
                                }
                                else
                                {
                                    sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
                                }
                                sysUser.Add("_IsAdmin", sysUser["Level"].Value<int>() >= 999);
                            }
                        }
                        catch (Exception ex)
                        {
                            errorMsg = ex.Message;
                            sysUser.Add("_IsAdmin", false);
                            sysUser.Add("_Roles", JToken.FromObject(new List<SysRole>()));
                            sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
                        }

                        #endregion


                        //currentToken.CurrentUser = userModelResult.Data;
                        //2024-02-04
                        currentToken.CurrentUser = sysUser;// JObject.FromObject(userModelResult.Data);
                        await DiyCacheBase.SetAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}", currentToken);
                        return new DosResult<dynamic>(1, currentToken.CurrentUser, "", new {
                            ErrorMsg = errorMsg
                        });
                    }
                    else
                    {
                        goto SysUserToken;
                    }
                }
                else
                {
                    goto SysUserToken;
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                goto SysUserToken;
            }

        SysUserToken:
            //不包含扩展信息
            CurrentToken<SysUser> sysUserToken = await DiyCacheBase.GetAsync<CurrentToken<SysUser>>($"Microi:{osClient}:LoginTokenSysUser:{userId}");

            if (sysUserToken == null)
            {
                return new DosResult<dynamic>(0, null, "未获取到身份缓存信息！");
            }
            //userModelResult = await new SysUserLogic().GetDiySysUserModel(new SysUserParam()
            //{
            //    Id = sysUserToken.CurrentUser.Id,
            //    OsClient = sysUserToken.OsClient
            //});
            userModelResult = await _formEngine.GetFormDataAsync(new
            {
                FormEngineKey = "sys_user",
                Id = sysUserToken.CurrentUser.Id,
                _Where = new List<DiyWhere>() {
                                        new DiyWhere(){
                                            Name = "State",
                                            Value = "1",
                                            Type = "="
                                        }
                                    },
            });

            if (userModelResult.Code != 1)
            {
                return userModelResult;
            }
            sysUserToken.CurrentUser = userModelResult.Data;
            
            await DiyCacheBase.SetAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}", sysUserToken);

            return new DosResult<dynamic>(1, sysUserToken.CurrentUser);
        }


        public async Task GetSysUserOtherInfo(JObject sysUser, string OsClient)
        {

            #region 查询用户角色
            //var roles = await new SysUserFkLogic().GetSysUserFk(new SysUserFkParam()
            //{
            //    UserId = sysUser["Id"].Value<string>(),
            //    Type = "Role",
            //    OsClient = OsClient
            //});
            //var roleIds = roles.Select(d => d.FkId).ToList<string>();
            //2022-11-17 从Sys_User表的RoleIds字段中获取所有角色Id
            var roleIds = new List<string>();
            try
            {
                try
                {
                    if(!sysUser["RoleIds"].Value<string>().Contains("{")){
                        roleIds = JsonConvert.DeserializeObject<List<string>>(sysUser["RoleIds"].Value<string>());
                    }else{
                        var roles = JsonConvert.DeserializeObject<List<SysRole>>(sysUser["RoleIds"].Value<string>());
                        roleIds = roles.Select(d => d.Id).ToList();
                    }
                }
                catch (Exception ex)
                {
                    var roles = JsonConvert.DeserializeObject<List<SysRole>>(sysUser["RoleIds"].Value<string>());
                    roleIds = roles.Select(d => d.Id).ToList();
                }
            }
            catch (Exception ex)
            {
                sysUser.Add("_IsAdmin", false);
                sysUser.Add("_Roles", JToken.FromObject(new List<SysRole>()));
                sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
                return;
            }
            if (!roleIds.Any())
            {
                sysUser.Add("_IsAdmin", false);
                sysUser.Add("_Roles", JToken.FromObject(new List<SysRole>()));
                sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
                return;
            }

            var roleList = await new SysRoleLogic().GetSysRole(new SysRoleParam()
            {
                Ids = roleIds,
                OsClient = OsClient
            });
            sysUser.Add("_Roles", JToken.FromObject(roleList.Data));


            var sysMenuLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
            {
                RoleIds = roleList.Data.Select(d => d.Id).ToList(),
                OsClient = OsClient
            });

            sysUser.Add("_RoleLimits", JToken.FromObject(sysMenuLimits));

            //var sysAdminRoleId = "5DB47859-35A3-411A-A1F7-99482E057D24".ToLower();
            //sysUser.Add("_IsAdmin", roleIds.Contains(sysAdminRoleId));

            sysUser.Add("_IsAdmin", sysUser["Level"].Value<int>() >= 999);
            #endregion
        }
        public async Task GetSysUserOtherInfo(SysUser sysUser, string OsClient)
        {

            #region 查询用户角色
            //var roles = await new SysUserFkLogic().GetSysUserFk(new SysUserFkParam()
            //{
            //    UserId = sysUser.Id,
            //    Type = "Role",
            //    OsClient = OsClient
            //});
            //var roleIds = roles.Select(d => d.FkId).ToList<string>();

            //2022-11-17 从Sys_User表的RoleIds字段中获取所有角色Id
            var roleIds = new List<string>();
            var emptyArr = new List<string>();
            try
            {
                try
                {
                    roleIds = JsonConvert.DeserializeObject<List<string>>(sysUser.RoleIds);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("未处理的异常：" + ex.Message);
                    var roleLists = JsonConvert.DeserializeObject<List<SysRole>>(sysUser.RoleIds);
                    roleIds = roleLists.Select(d => d.Id).ToList();
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                sysUser._IsAdmin = false;
                sysUser._Roles = new List<SysRole>();
                sysUser._RoleLimits = new List<SysRoleLimit>();
                return;
            }
            if (!roleIds.Any())
            {
                sysUser._IsAdmin = false;
                sysUser._Roles = new List<SysRole>();
                sysUser._RoleLimits = new List<SysRoleLimit>();
                return;
            }

            var roleList = await new SysRoleLogic().GetSysRole(new SysRoleParam()
            {
                Ids = roleIds,
                OsClient = OsClient
            });
            sysUser._Roles = roleList.Data;


            var sysMenuLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
            {
                RoleIds = sysUser._Roles.Select(d => d.Id).ToList(),
                OsClient = OsClient
            });

            sysUser._RoleLimits = sysMenuLimits;

            //var sysAdminRoleId = "5DB47859-35A3-411A-A1F7-99482E057D24".ToLower();
            //sysUser._IsAdmin = roleIds.Contains(sysAdminRoleId);

            sysUser._IsAdmin = sysUser.Level >= 999;
            #endregion
        }
        public async Task<DosResult<SysUser>> LoginByAccount(SysUserParam param)
        {
            if (string.IsNullOrWhiteSpace(param.Account))
            {
                return new DosResult<SysUser>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountNoNull", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<SysUser>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            DbSession dbRead = OsClient.GetClient(param.OsClient).DbRead;
            param.Account = param.Account.DosTrim();
            var model = dbRead.From<SysUser>()
                                .Select(new SysUser().GetFields())
                                .Where(d => d.Account == param.Account).First();
            if (model == null)
            {
                return new DosResult<SysUser>(0, null, "帐号不存在");
            }
            if (model.State != 1)
            {
                return new DosResult<SysUser>(0, null, DiyMessage.GetLang(param.OsClient,  "AccountStop", param._Lang));
            }
            //判断所属主要部门是否启用
            if (model.DeptId != null)
            {
                var deptModel = await new SysDeptLogic().GetSysDeptModel(new SysDeptParam()
                {
                    Id = model.DeptId,
                    OsClient = param.OsClient
                });
                if (deptModel.Code == 1 && deptModel.Data.State != 1)
                {
                    return new DosResult<SysUser>(0, null, DiyMessage.GetLang(param.OsClient,  "DeptStop", param._Lang));
                }
            }

            await GetSysUserOtherInfo(model, param.OsClient);

           
            new SysLogLogic().AddSysLog(new Microi.net.SysLogParam()
            {
                Type = "登录日志",
                Title = (model.Name.DosIsNullOrWhiteSpace() ? model.Account : model.Name) + "登录了系统",
                //Content = "param：" + JsonConvert.SerializeObject(param),
                //IP = IPHelper.GetClientIP(HttpContext),
                OsClient = param.OsClient
            });
           

            return new DosResult<SysUser>(1, model);
        }
        /// <summary>
        /// 修改用户。必传：Id或Account
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptSysUser(SysUserParam param)
        {
            #region Check
            if (param.Id.DosIsNullOrWhiteSpace() || param._CurrentSysUser == null
                //|| param.OsClient.DosIsNullOrWhiteSpace()
                )// || param.Account.DosIsNullOrWhiteSpace()
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            //&& CantUpt.Contains(param.Id)
            if (param._CurrentSysUser.Account.ToLower() != "admin"
                && param._CurrentSysUser.Id != param.Id)
            {
                //return new DosResult(0, null, "系统内置默认帐号禁止修改！");
            }
            #endregion
            //var model = SysUserRepository.First(d => d.Id == param.Id);
            var modelDynamic = dbSession.From<SysUser>()
                                .Select(new SysUser().GetFields())
                                .Where(d => d.Id == param.Id).First<dynamic>();
            var model = ((JObject)JObject.FromObject(modelDynamic)).ToObject<SysUser>();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "NoAccount", param._Lang));
            }
            //如果修改了帐号
            param.Account = param.Account.DosTrim();
            if (model.Account != param.Account.DosTrim() && !param.Account.DosIsNullOrWhiteSpace())
            {
                param.OldAccount = model.Account;
                if (param.Account.Length < 2 || param.Account.Length > 20)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "AccountLength", param._Lang));
                }
                //if (SysUserRepository.Any(d => d.Account == param.Account))
                if (dbSession.From<SysUser>().Where(d => d.Account == param.Account).Count() > 0)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "HaveAccount", param._Lang));
                }
            }

            try
            {
                if (!param.Pwd.DosIsNullOrWhiteSpace())
                {
                    param.Pwd = Encoding.Default.GetString(Convert.FromBase64String(param.Pwd));
                }
            }
            catch (Exception ex) { Console.WriteLine("未处理的异常：" + ex.Message); }
                        
                
            try
            {
                if (!param.NewPwd.DosIsNullOrWhiteSpace())
                {
                    param.NewPwd = Encoding.Default.GetString(Convert.FromBase64String(param.NewPwd));
                }
            }
            catch (Exception ex) { Console.WriteLine("未处理的异常：" + ex.Message); }
                        
                

            //如果修改了密码（如果是用户，则需要验证旧密码）
            if (!param.Pwd.DosIsNullOrWhiteSpace() && !param.NewPwd.DosIsNullOrWhiteSpace())
            {
                
                var encodePwdResult = await GetEncodePwd(modelDynamic, param.OsClient, param.Pwd, (string)model.Pwd, param._EncodePwd, model.Account);
                if (!encodePwdResult.IsPass)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "OldPwdError", param._Lang));
                }

                var checkPwdResult = await CheckPwd(param.NewPwd);
                if (!checkPwdResult.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, checkPwdResult);
                }

                var newPwd = "";
                if (!param._EncodeNewPwd.DosIsNullOrWhiteSpace())
                {
                    newPwd = param._EncodeNewPwd;
                }
                else
                {
                    //newPwd = EncryptHelper.DESEncode(param.NewPwd);
                    //newPwd = (await GetEncodePwd(param)).EncodePwd;
                    newPwd = (await GetEncodePwd(modelDynamic, param.OsClient, param.NewPwd, "", param._EncodeNewPwd, model.Account)).EncodePwd;
                }

                model.Pwd = newPwd;// EncryptHelper.DESEncode(param.NewPwd);
                param.Pwd = model.Pwd;
            }
            else if (!param.Pwd.DosIsNullOrWhiteSpace() && param._CurrentSysUser.Account.ToLower() == "admin")
            {
                var checkPwdResult = await CheckPwd(param.Pwd);
                if (!checkPwdResult.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, checkPwdResult);
                }

                var pwd = "";
                pwd = (await GetEncodePwd(modelDynamic, param.OsClient, param.Pwd, "", param._EncodePwd, model.Account)).EncodePwd;
                param.Pwd = pwd;// EncryptHelper.DESEncode(param.Pwd);
                model.Pwd = param.Pwd;
            }
            //如果是管理员，直接修改密码
            else if (!param.NewPwd.DosIsNullOrWhiteSpace() && param._CurrentSysUser._IsAdmin == true)
            {
                var checkPwdResult = await CheckPwd(param.NewPwd);
                if (!checkPwdResult.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, checkPwdResult);
                }

                var newPwd = (await GetEncodePwd(modelDynamic, param.OsClient, param.NewPwd, "", param._EncodeNewPwd, model.Account)).EncodePwd;
                model.Pwd = newPwd;//EncryptHelper.DESEncode(param.NewPwd);
                param.Pwd = model.Pwd;
            }
            else//if (!param.Pwd.DosIsNullOrWhiteSpace())
            {
                param.Pwd = null;
            }



            #region  通用修改
            //var modelJson = JObject.Parse(JsonConvert.SerializeObject(model));
            //var paramJson = JObject.Parse(JsonConvert.SerializeObject(param));
            //var modelList = modelJson.Properties();
            //var paramList = paramJson.Properties();
            //foreach (var l in modelList)
            //{
            //    if (paramList.Any(d => d.Name == l.Name))
            //    {
            //        var val = paramList.First(d => d.Name == l.Name).Value;
            //        if (val.Type == JTokenType.Object || val.Type == JTokenType.Array || (val.Type != JTokenType.Null && ((Newtonsoft.Json.Linq.JValue)(val)).Value != null))
            //        {
            //            if (val.Type == JTokenType.Object || val.Type == JTokenType.Array)
            //            {
            //                l.Value = JsonConvert.SerializeObject(val);
            //            }
            //            else
            //            {
            //                l.Value = val;
            //            }
            //        }
            //    }
            //}
            //model = JsonConvert.DeserializeObject<SysUser>(JsonConvert.SerializeObject(modelJson));
            model = MapperHelper.MapNotNull<object, SysUser>(param);
            #endregion end
            //if (model.DeptId == null)
            //{
            //    return new DosResult(0, null, "组织机构必选！");
            //}
            if (model.DeptId != null)
            {
                var deptModel = await new SysDeptLogic().GetSysDeptModel(new SysDeptParam()
                {
                    Id = model.DeptId
                });
                if (deptModel.Code != 1)
                {
                    return new DosResult(0, null, deptModel.Msg);
                }
                if (deptModel.Data.Code.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "部门编码为空，请修改部门！");
                }
                if (model.DeptCode != deptModel.Data.Code)
                {
                    model.DeptCode = deptModel.Data.Code;
                }
            }
            

            if (param.DeptIds == null)
            {
                //model.DeptIds = "[]";
            }
            else
            {
                try
                {
                    model.DeptIds = JsonConvert.SerializeObject(param.DeptIds);
                }
                catch (Exception)
                {
                }
            }
            if (param.RoleIds == null)
            {
                //model.RoleIds = "[]";
            }
            else {
                try
                {
                    model.RoleIds = JsonConvert.SerializeObject(param.RoleIds);
                }
                catch (Exception)
                {
                }
            }

            //修复 Name、MobilePhone字段值
            if (!model.Name.DosIsNullOrWhiteSpace())
            {
                //model.RealName = model.Name;
            }
            if (!model.Phone.DosIsNullOrWhiteSpace())
            {
                //model.MobilePhone = model.Phone;
            }

            var count = 0;


            using (var trans = dbSession.BeginTransaction())//DbClassiTdos.DbSession.BeginTransaction()
            {
                //var fkList = new List<SysUserFk>();

                #region 外键数据
                //var allFk = trans.From<SysUserFk>().Where(d => d.UserId == model.Id).ToList();
                //if (param.GroupIds != null)
                //{
                //    fkList = new List<SysUserFk>();
                //    foreach (var paramGroupId in param.GroupIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Group",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //    trans.Delete<SysUserFk>(d => d.UserId == model.Id && d.Type == "Group");
                //    allFk.RemoveAll(d => d.UserId == model.Id && d.Type == "Group");
                //    if (fkList.Any())
                //    {
                //        foreach (var sysUserFk in fkList)
                //        {
                //            if (!allFk.Any(d => d.FkId == sysUserFk.FkId))
                //            {
                //                count += trans.Insert(sysUserFk);
                //            }
                //        }
                //    }
                //}
                //if (param.RoleIds != null)
                //{
                //    fkList = new List<SysUserFk>();
                //    foreach (var paramGroupId in param.RoleIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Role",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //    trans.Delete<SysUserFk>(d => d.UserId == model.Id && d.Type == "Role");
                //    allFk.RemoveAll(d => d.UserId == model.Id && d.Type == "Role");
                //    if (fkList.Any())
                //    {
                //        foreach (var sysUserFk in fkList)
                //        {
                //            if (!allFk.Any(d => d.FkId == sysUserFk.FkId))
                //            {
                //                count += trans.Insert(sysUserFk);
                //            }
                //        }
                //    }
                //}
                //if (param.DeptIds != null)
                //{
                //    fkList = new List<SysUserFk>();
                //    foreach (var paramGroupId in param.DeptIds)
                //    {
                //        foreach (var item in paramGroupId)
                //        {
                //            fkList.Add(new SysUserFk()
                //            {
                //                Id = Guid.NewGuid().ToString(),
                //                UserId = model.Id,
                //                FkId = item, //paramGroupId,
                //                Type = "Dept",
                //                CreateTime = DateTime.Now
                //            });
                //        }

                //    }
                //    trans.Delete<SysUserFk>(d => d.UserId == model.Id && d.Type == "Dept");
                //    allFk.RemoveAll(d => d.UserId == model.Id && d.Type == "Dept");
                //    if (fkList.Any())
                //    {
                //        foreach (var sysUserFk in fkList)
                //        {
                //            if (!allFk.Any(d => d.FkId == sysUserFk.FkId))
                //            {
                //                count += trans.Insert(sysUserFk);
                //            }
                //        }
                //    }
                //}
                //if (param.PostIds != null)
                //{
                //    fkList = new List<SysUserFk>();
                //    foreach (var paramGroupId in param.PostIds)
                //    {
                //        fkList.Add(new SysUserFk()
                //        {
                //            Id = Guid.NewGuid().ToString(),
                //            UserId = model.Id,
                //            FkId = paramGroupId,
                //            Type = "Post",
                //            CreateTime = DateTime.Now
                //        });
                //    }
                //    trans.Delete<SysUserFk>(d => d.UserId == model.Id && d.Type == "Post");
                //    allFk.RemoveAll(d => d.UserId == model.Id && d.Type == "Post");
                //    if (fkList.Any())
                //    {
                //        foreach (var sysUserFk in fkList)
                //        {
                //            if (!allFk.Any(d => d.FkId == sysUserFk.FkId))
                //            {
                //                count += trans.Insert(sysUserFk);
                //            }
                //        }
                //    }
                //}

                #endregion

                count = trans.Update(model);
                try
                {
                    new SysLogLogic().AddSysLog(new SysLogParam()
                    {
                        Api = "SysUserLogic/UptSysUser",
                        Title = param._CurrentSysUser.Account + "修改了" + model.Account,
                        Content = "修改了用户资料为：" + JsonConvert.SerializeObject(model),
                        OsClient = param.OsClient,
                        //IP = IPHelper.GetClientIP(),//DiyHttpContext.Current
                        Level = 1,
                        Param = JsonConvert.SerializeObject(param),
                        Type = "修改账户信息",
                    });
                }
                catch (Exception)
                {
                }
                
                //var SysUser = JSON.ToObject<SysUser>(HttpContext.Current.Session[WebConfigurationManager.AppSettings["SysUserSession"]].ToString());
                //if (model.Id == SysUser.Id)
                //{
                //    HttpContext.Current.Session[WebConfigurationManager.AppSettings["SysUserSession"]] = JSON.ToJSON(model);
                //}
                trans.Commit();
                //SysUserCache.DelSysUserModel(model, param.OsClient);

                return new DosResult(count > 0 ? 1 : 0, model, count > 0 ? "" : DiyMessage.GetLang(param.OsClient,  "Line0", param._Lang));
            }
        }
        /// <summary>
        /// 删除菜单，必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> DelSysUser(SysUserParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            if (CantUpt.Contains(param.Id))
            {
                //return new DosResult(0, null, "系统内置默认帐号禁止删除！");
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            //var model = SysUserRepository.First(d => d.Id == param.Id);
            var model = dbSession.From<SysUser>()
                                .Select(new SysUser().GetFields())
                                .Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "NoExistData", param._Lang) + " Id：" + param.Id);
            }


            //var SysUser = HttpContext.Current.Session[WebConfigurationManager.AppSettings["SysUserSession"]] == null ? null : JSON.ToObject<SysUser>(HttpContext.Current.Session[WebConfigurationManager.AppSettings["SysUserSession"]].ToString());
            //if (SysUser.IsAdmin != true)
            //{
            //    return new DosResult(false, null, DiyMessage.GetLang(param.OsClient,  "NoAuth", param._Lang));

            //}


            if (model.Account.ToLower() == "admin")
            {
                return new DosResult(0, null, "The admin user banned removed!");
            }



            model.IsDeleted = 1;
            //var count = SysUserRepository.Update(model);
            var count = dbSession.Update(model);
            //SysUserCache.DelSysUserModel(model, param.OsClient);
            return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.GetLang(param.OsClient,  "Line0", param._Lang));
        }
        //public async Task<DosResult> RDelSysUser(SysUserParam param)
        //{
        //    if (param.Id.DosIsNullOrWhiteSpace())
        //    {
        //        return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
        //    }
        //    if (CantUpt.Contains(param.Id))
        //    {
        //        return new DosResult(0, null, "系统内置默认帐号禁止删除！");
        //    }
        //    var model = SysUserRepository.First(d => d.Id == param.Id);
        //    if (model == null)
        //    {
        //        return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "NoExistData", param._Lang));
        //    }
        //    if (model.Account.ToLower() == "admin")
        //    {
        //        return new DosResult(0, null, "The admin user banned removed!");
        //    }
        //    var count = SysUserRepository.Delete(param.Id);
        //    SysUserCache.DelSysUserModel(model);
        //    return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.GetLang(param.OsClient,  "Line0", param._Lang));
        //}
    }
}
