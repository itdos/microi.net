using Dos.ORM;
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
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web;
using Dos.Common;
// 通过扩展方法使用Dos.ORM API
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class SysDeptLogic
    {
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<SysDept>> GetSysDept(SysDeptParam param)
        {
            var where = new Where<SysDept>();
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            if (param.State != null)
            {
                where.And(d => d.State == param.State);
            }

            if (param.IsDeleted == null)
            {
                where.And(d => d.IsDeleted == 0);
            }

            if (param.Ids != null && param.Ids.Any())
            {
                where.And(d => d.Id.In(param.Ids));
            }

            if (!param.Name.DosIsNullOrWhiteSpace())
            {
                where.And(d => d.Name.Like(param.Name));
            }

            if (!param._Keyword.DosIsNullOrWhiteSpace())
            {
                where.And(d => d.Name.Like(param._Keyword) || d.Remark.Like(param._Keyword));
            }


            if (param.UserIds != null && param.UserIds.Any())
            {
                var userListResult = await new SysUserLogic().GetSysUser(new SysUserParam()
                {
                    Ids = param.UserIds,
                    OsClient = param.OsClient
                });
                if (userListResult.Code != 1)
                {
                    return new DosResultList<SysDept>(0, null, userListResult.Msg);
                }
                var userList = userListResult.Data;
                if (userList == null)
                {
                    return new DosResultList<SysDept>(0, null, "未找到用户信息！");
                }
                var allDeptIds = new List<string>();
                foreach (var user in userList)
                {
                    if (!user.DeptId.DosIsNullOrWhiteSpace())
                    {
                        allDeptIds.Add(user.DeptId);
                    }
                    if (!user.DeptIds.DosIsNullOrWhiteSpace())
                    {
                        var deptIds = JsonConvert.DeserializeObject<List<List<string>>>(user.DeptIds);
                        foreach (var ids in deptIds)
                        {
                            //注意，deptids只取每个List<string>的最后一个才是所属部门，不能取前面的
                            var deptId = ids[ids.Count - 1];
                            if (!allDeptIds.Any(d => d == deptId))
                            {
                                allDeptIds.Add(deptId);
                            }
                            //foreach (var id in ids)
                            //{
                            //    if (!allDeptIds.Any(d => d == id))
                            //    {
                            //        allDeptIds.Add(id);
                            //    }
                            //}
                        }
                    }
                }
                if (allDeptIds.Any())
                {
                    where.And(d => d.Id.In(allDeptIds));
                }
                else
                {
                    return new DosResultList<SysDept>(0, null, "未找到用户任何部门信息！");
                }

            }

            var fs = dbSession.From<SysDept>().Where(where);
            var dataCount = fs.Count();
            if (param._PageSize != null && param._PageIndex != null)
            {
                fs.Page(param._PageSize.Value, param._PageIndex.Value);
            }
            //fs.OrderByDescending(d => new { d.CreateTime, d.Id });
            fs.OrderBy(d => new { d.Code, d.Id });
            //var list = SysDeptRepository.Query(where, d => d.CreateTime, "desc", null, param._PageSize, param._PageIndex);
            var list = fs.ToList();
            return new DosResultList<SysDept>(1, list, null, dataCount);
        }
        /// <summary>
        /// 传入Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<SysDept>> GetSysDeptModel(SysDeptParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult<SysDept>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<SysDept>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));

            }
            var where = new Where<SysDept>();
            where.And(d => d.Id == param.Id);
            if (param.IsDeleted != null)
            {
                where.And(d => d.IsDeleted == param.IsDeleted);
            }
            if (param.State != null)
            {
                where.And(d => d.State == param.State);
            }
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;

            var model = dbSession.From<SysDept>().Where(where).First();
            if (model == null)
            {
                return new DosResult<SysDept>(0, null, DiyMessage.GetLang(param.OsClient, "NoExistData", param._Lang) + " Id：" + param.Id);
            }
            return new DosResult<SysDept>(1, model);
        }
        /// <summary>
        /// 新增
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> AddSysDept(SysDeptParam param)
        {
            #region Check
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            #endregion

            #region  通用新增
            var model = MapperHelper.Map<object, SysDept>(param);
            model.Id = Ulid.NewUlid().ToString();
            #endregion end
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            IMicroiDbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;
            #region 自动生成部门Code
            var actionResult = new DosResult(1);
            if (param._UseDiyLock == false)
            {
                //-------执行单线程代码、数据库操作等
                var codeResult = CreateDeptCode(dbRead, model);
                if (codeResult.Code == 1)
                {
                    model.Code = codeResult.Data;
                }
                else
                {
                    actionResult.Code = codeResult.Code;
                    actionResult.Msg = codeResult.Msg;
                    return actionResult;
                }
                //-------END
            }
            else
            {
                //Key一般传入该方法操作的唯一值；value随意传；Expiry：锁的过期时间，也是获取锁的等待时间。
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam()
                {
                    Key = $"Microi:{param.OsClient}:CreateDeptCode",
                    OsClient = param.OsClient,
                    Expiry = TimeSpan.FromSeconds(10)
                }, async () =>
            {
                //-------执行单线程代码、数据库操作等
                var codeResult = CreateDeptCode(dbRead, model);
                if (codeResult.Code == 1)
                {
                    model.Code = codeResult.Data;
                }
                else
                {
                    actionResult.Code = codeResult.Code;
                    actionResult.Msg = codeResult.Msg;
                }
                //-------END
            });
                if (lockResult.Code != 1)
                    return lockResult;
                if (actionResult.Code != 1)
                    return actionResult;
            }


            #endregion
            model.State = param.State ?? 1;

            model.CreateTime = DateTime.Now;
            model.UpdateTime = DateTime.Now;

            if (param._CurrentUser != null && !param._CurrentUser?["TenantId"]?.Value<string>().DosIsNullOrWhiteSpace() == true)
            {
                model.TenantId = param._CurrentUser?["TenantId"]?.Value<string>();
                model.TenantName = param._CurrentUser?["TenantName"]?.Value<string>();
            }

            var count = dbSession.Insert(model);
            if (count > 0)
            {
                #region 如果是独立机构    --2023-03-22 by Anderson
                if (param.IsCompany != null)
                {
                    //为了兼容老版程序/数据库，这里使用DIY更新IsCompany此字段
                    try
                    {
                        var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync(new
                        {
                            FormEngineKey = "Sys_Dept",
                            Id = model.Id,
                            IsCompany = param.IsCompany.Value,
                            OsClient = param.OsClient
                        });
                    }
                    catch (Exception ex)
                    {

                    }
                }
                #endregion
            }
            return new DosResult(count > 0 ? 1 : 0, model, count > 0 ? "" : DiyMessage.GetLang(param.OsClient, "Line0", param._Lang));
        }
        private DosResult<string> CreateDeptCode(IMicroiDbSession dbRead, SysDept model)
        {
            var resultCode = "";
            //先查询上级部门Code
            var parentDeptModel = dbRead.From<SysDept>()
                                        .Where(d => d.Id == model.ParentId && d.IsDeleted == 0)
                                        .First();
            //如果上级部门为空，那么此部门就为顶级
            if (parentDeptModel == null)
            {
                var deptCount = dbRead.From<SysDept>()
                            .Where(d => (d.ParentId == Guid.Empty.ToString() || d.ParentId == DiyCommon.UlidEmpty) && d.IsDeleted == 0)// && d.Id != model.Id
                            .ToList();
                var maxDeptCode = 0;
                foreach (var item in deptCount)
                {
                    if (!item.Code.DosIsNullOrWhiteSpace())
                    {
                        var tempCode = 0;
                        if (int.TryParse(item.Code.Replace("-", ""), out tempCode))
                        {
                            if (tempCode > maxDeptCode)
                            {
                                maxDeptCode = tempCode;
                            }
                        }
                    }
                }
                resultCode = (maxDeptCode + 1) + "-";
            }
            //如果上级部门不为空，将上级部门的Code做为前缀，再生成本级部门code
            else
            {
                if (parentDeptModel.Code.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<string>(0, null, "上级部门Code为空！请先修改上级部门");
                }
                var deptCount = dbRead.From<SysDept>()
                            .Where(d => d.ParentId == parentDeptModel.Id && d.Id != model.Id && d.IsDeleted == 0)
                            .ToList();
                var maxDeptCode = 0;
                foreach (var item in deptCount)
                {
                    if (!item.Code.DosIsNullOrWhiteSpace())
                    {
                        var tempCode = 0;
                        Regex regex = new Regex(parentDeptModel.Code);
                        //去掉上级前缀，然后进行取最大值
                        if (int.TryParse(regex.Replace(item.Code, "", 1).Replace("-", ""), out tempCode))
                        {
                            if (tempCode > maxDeptCode)
                            {
                                maxDeptCode = tempCode;
                            }
                        }
                    }
                }
                resultCode = parentDeptModel.Code + (maxDeptCode + 1) + "-";
            }
            return new DosResult<string>(1, resultCode);
        }
        /// <summary>
        /// 修改。必传：Id或Account
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptSysDept(SysDeptParam param)
        {
            #region Check
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            #endregion
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            IMicroiDbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;
            var model = dbRead.From<SysDept>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAccount", param._Lang));
            }
            var isNeedCreateCode = false;
            if (model.ParentId != param.ParentId
                || model.Code.DosIsNullOrWhiteSpace()
                )
            {
                isNeedCreateCode = true;
            }

            //注意：如果修改了ParentId，那么所有子级需要递归进行重新生成Code
            var isAllChildCreateCode = false;
            if (model.ParentId != param.ParentId)
            {
                //这里需要判断ParentId不能修改到该组织机构的下面去
                var newParentIdModel = await GetSysDeptModel(new SysDeptParam()
                {
                    Id = param.ParentId
                });
                if (newParentIdModel.Code != 1)
                {
                    return new DosResult(0, null, newParentIdModel.Msg);
                }
                if (newParentIdModel.Data.Code.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "新上级组织机构Code为空，请先修改上级组织机构！");
                }
                if (!model.Code.DosIsNullOrWhiteSpace() && newParentIdModel.Data.Code.StartsWith(model.Code))
                {
                    return new DosResult(0, null, "不能将组织机构的父级调整到该组织机构及以下的组织机构！");
                }


                isAllChildCreateCode = true;
            }

            var isNeedUptDeptName = false;
            if (param.Name != null && model.Name != param.Name)
            {
                isNeedUptDeptName = true;
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
            //            if (val.Type == JTokenType.Object || val.Type == JTokenType.Array) { l.Value = JsonConvert.SerializeObject(val); } else { l.Value = val; }
            //        }
            //    }
            //}
            //model = JsonConvert.DeserializeObject<SysDept>(JsonConvert.SerializeObject(modelJson));
            model = MapperHelper.MapNotNull<object, SysDept>(param);
            #endregion end
            model.UpdateTime = DateTime.Now;

            #region 自动生成部门Code
            if (isNeedCreateCode)
            {
                var actionResult = new DosResult(1);
                if (param._UseDiyLock == false)
                {

                    //-------执行单线程代码、数据库操作等
                    var codeResult = CreateDeptCode(dbSession, model);
                    if (codeResult.Code == 1)
                    {
                        model.Code = codeResult.Data;
                    }
                    else
                    {
                        actionResult.Code = codeResult.Code;
                        actionResult.Msg = codeResult.Msg;
                        return actionResult;
                    }
                    //-------END
                }
                else
                {
                    //Key一般传入该方法操作的唯一值；value随意传；Expiry：锁的过期时间，也是获取锁的等待时间。
                    var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam()
                    {
                        Key = $"Microi:{param.OsClient}:CreateDeptCode",
                        OsClient = param.OsClient,
                        Expiry = TimeSpan.FromSeconds(10)
                    }, async () =>
                    {
                        //-------执行单线程代码、数据库操作等
                        var codeResult = CreateDeptCode(dbSession, model);
                        if (codeResult.Code == 1)
                        {
                            model.Code = codeResult.Data;
                        }
                        else
                        {
                            actionResult.Code = codeResult.Code;
                            actionResult.Msg = codeResult.Msg;
                        }
                        //-------END
                    });
                    if (lockResult.Code != 1)
                    {
                        return lockResult;
                    }
                    if (actionResult.Code != 1)
                    {
                        return actionResult;
                    }
                }

            }

            #endregion

            var count = dbSession.Update(model);

            #region 如果是独立机构    --2023-03-22 by Anderson
            if (param.IsCompany != null)
            {
                //为了兼容老版程序/数据库，这里使用DIY更新IsCompany此字段
                try
                {
                    var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync(new
                    {
                        FormEngineKey = "Sys_Dept",
                        Id = model.Id,
                        IsCompany = param.IsCompany.Value,
                        OsClient = param.OsClient
                    });
                }
                catch (Exception ex)
                {

                }

            }
            #endregion

            //同步SysUser的DeptCode
            if (isNeedCreateCode)
            {
                Task.Run(() =>
                {
                    //先修复RoleIds？暂时不修复，UptSysUser的时候修复
                    var allSysUser = dbRead.From<SysUser>()
                                            .Select(new SysUser().GetFields())
                                            .Where(d => d.DeptId == model.Id && d.IsDeleted == 0)
                                            .ToList();
                    foreach (var sysUser in allSysUser)
                    {
                        sysUser.DeptCode = model.Code;
                        //后期改成批量修改
                        dbSession.Update(sysUser);
                    }
                });
            }
            if (isNeedUptDeptName)
            {
                Task.Run(() =>
                {
                    //先修复RoleIds？暂时不修复，UptSysUser的时候修复
                    var allSysUser = dbRead.From<SysUser>()
                                                .Select(new SysUser().GetFields())
                                            .Where(d => d.DeptId == model.Id && d.IsDeleted == 0)
                                            .ToList();
                    foreach (var sysUser in allSysUser)
                    {
                        sysUser.DeptName = model.Name;
                        //后期改成批量修改
                        dbSession.Update(sysUser);
                    }
                });
            }

            if (isAllChildCreateCode)
            {
                //先查询所有Dept
                var allDeptList = dbSession.From<SysDept>().Where(d => d.IsDeleted == 0).OrderBy(d => d.Sort).ToList();
                ForCreateChildCode(allDeptList, model, dbSession);
            }

            return new DosResult(1);
        }
        private void ForCreateChildCode(List<SysDept> allDeptList, SysDept parentSysDept, IMicroiDbSession db)
        {
            //再查询所有子级Dept
            var allChildDeptList = allDeptList.Where(d => d.ParentId == parentSysDept.Id).OrderBy(d => d.Sort).ToList();
            var deptCode = 1;
            foreach (var deptModel in allChildDeptList)
            {
                //开始重新生成，重新生成应直接从1开始
                deptModel.Code = parentSysDept.Code + deptCode + "-";
                deptCode++;
                //修改了Code，就得同步SysUser表
                Task.Run(() =>
                {
                    //先修复RoleIds？暂时不修复，UptSysUser的时候修复
                    var allSysUser = db.From<SysUser>()
                                            .Select(new SysUser().GetFields())
                                            .Where(d => d.DeptId == deptModel.Id && d.IsDeleted == 0)
                                            .ToList();
                    foreach (var sysUser in allSysUser)
                    {
                        sysUser.DeptCode = deptModel.Code;
                        //后期改成批量修改
                        db.Update(sysUser);
                    }
                });
                db.Update(deptModel);
                //开始递归
                ForCreateChildCode(allDeptList, deptModel, db);
            }
        }
        /// <summary>
        /// 删除，必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> DelSysDept(SysDeptParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            IMicroiDbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;
            var model = dbRead.From<SysDept>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoExistData", param._Lang) + " Id：" + param.Id);
            }
            if (dbRead.From<SysDept>().Where(d => d.ParentId == model.Id && d.IsDeleted == 0).Count() > 0)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ExistChildData", param._Lang));
            }
            //if (model.ParentId == Guid.Empty)
            //{
            //    return new DosResult(0, null, "顶级节点暂不允许删除！");
            //}
            model.IsDeleted = 1;
            var count = dbSession.Update<SysDept>(model);
            return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.GetLang(param.OsClient, "Line0", param._Lang));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<dynamic>> GetSysDeptStep(SysDeptParam param)
        {
            IMicroiDbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;

            var where = new Where<SysDept>();
            var diyWhere = new List<DiyWhere>();

            if (param.IsDeleted != null)
            {
                where.And(d => d.IsDeleted == param.IsDeleted);
            }
            if (param.State != null)
            {
                where.And(d => d.State == param.State);
                diyWhere.Add(new DiyWhere()
                {
                    Name = "State",
                    Value = param.State.ToString(),
                    Type = "="
                });
            }
            if (param._CurrentUser != null
                && param._CurrentUser?["_IsAdmin"]?.Value<bool>() != true
                && !param._CurrentUser?["TenantId"]?.Value<string>().DosIsNullOrWhiteSpace() == true)
            {
                var tenantId = param._CurrentUser?["TenantId"]?.Value<string>();
                where.And(d => d.TenantId == tenantId);
                diyWhere.Add(new DiyWhere()
                {
                    Name = "TenantId",
                    Value = param._CurrentUser?["TenantId"]?.Value<string>(),
                    Type = "="
                });
            }

            //var allList = dbRead.From<SysDept>()
            //                    .Where(where)
            //                    .OrderBy(d => d.Sort)
            //                    .ToList<dynamic>();
            var allListResult = await MicroiEngine.FormEngine.GetTableDataAsync(new
            {
                FormEngineKey = "Sys_Dept",
                _Where = diyWhere,
                OsClient = param.OsClient
            });
            if (allListResult.Code != 1)
            {
                return new DosResultList<dynamic>(0, null, allListResult.Msg);
            }
            var allList = allListResult.Data;
            var firstList = new List<dynamic>();
            if (param._CurrentUser != null
                && param._CurrentUser?["_IsAdmin"]?.Value<bool>() != true
                && param._CurrentUser?["DeptId"]?.Value<string>() != null
                )
            {
                //2022-08-09暂时注释，只有通过dynamic判断是独立机构的时候，才需要加这个判断
                //firstList = allList.Where(d =>
                //                        //d.ParentId == param._CurrentSysUser.DeptId.Value
                //                        d.Id == param._CurrentSysUser.DeptId
                //                    ).ToList()

                #region 2023-03-22 恢复：查询当前帐号的组织机构、以及所有上级组织机构存在 IsCompany 独立机构，那么仅需要返回此独立机构下面的完整组织机构.
                try
                {
                    var deptModelResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
                    {
                        FormEngineKey = "Sys_Dept",
                        Id = param._CurrentUser?["DeptId"]?.Value<string>(),
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
                        var deptListResult = await MicroiEngine.FormEngine.GetTableDataAsync(new
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
                                    firstList = allList.Where(d =>
                                                            d.Id == (string)dept.Id
                                                        ).ToList();
                                    goto BuilderChild;
                                    //break;
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {

                }
                #endregion


                if (param._CurrentUser != null
                && param._CurrentUser?["_IsAdmin"]?.Value<bool>() != true
                && !param._CurrentUser?["TenantId"]?.Value<string>().DosIsNullOrWhiteSpace() == true)
                {
                    if (!allList.Any())
                    {
                        return new DosResultList<dynamic>(1, new List<dynamic>());
                    }
                    var tenantFisrt = new List<dynamic>();
                    tenantFisrt.Add(allList.OrderBy(d => d.Code).First());
                    firstList = tenantFisrt;
                }
                else
                {
                    firstList = allList.Where(d => d.ParentId == Guid.Empty.ToString() || d.ParentId == null || d.ParentId == "" || d.ParentId == DiyCommon.UlidEmpty).ToList();
                }
            }
            else
            {
                firstList = allList.Where(d => d.ParentId == Guid.Empty.ToString() || d.ParentId == null || d.ParentId == "" || d.ParentId == DiyCommon.UlidEmpty).ToList();
            }
        BuilderChild:
            //递归获取层级
            //GetAllPostChild(allList, firstList);
            GetAllPostChildDynamic(allList, firstList);
            return new DosResultList<dynamic>(1, firstList);
        }
        /// <summary>
        /// 递归获取层级
        /// </summary>
        private void GetAllPostChild(List<SysDept> allList, List<SysDept> list)
        {
            foreach (var SysDept in list)
            {
                if (allList.Any(d => d.ParentId == SysDept.Id))
                {
                    SysDept._Child = allList.Where(d => d.ParentId == SysDept.Id).OrderBy(d => d.Sort).ToList();
                    //递归获取层级
                    GetAllPostChild(allList, SysDept._Child);
                }
            }
        }
        private void GetAllPostChildDynamic(List<dynamic> allList, List<dynamic> list)
        {
            foreach (var SysDept in list)
            {
                if (allList.Any(d => d.ParentId == SysDept.Id))
                {
                    SysDept._Child = allList.Where(d => d.ParentId == SysDept.Id).OrderBy(d => d.Sort).ToList();
                    //递归获取层级
                    GetAllPostChildDynamic(allList, SysDept._Child);
                }
            }
        }
    }
}
