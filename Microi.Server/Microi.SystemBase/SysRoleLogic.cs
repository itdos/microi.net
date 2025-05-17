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
using System.Threading.Tasks;
using System.Web;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Microi.net.Model;

namespace Microi.net
{


    public partial class SysRoleLogic
    {
        public static List<string> CantUpt = new List<string>()
        {
            "5DB47859-35A3-411A-A1F7-99482E057D24".ToLower()
        };
        public async Task<DosResultList<SysRole>> GetSysRole(SysRoleParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<SysRole>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            DbSession dbRead = OsClient.GetClient(param.OsClient).DbRead;
            var where = new Where<SysRole>();
            if (param.Ids != null && param.Ids.Any())
            {
                where.And(d => d.Id.In(param.Ids));

            }
            if (!string.IsNullOrWhiteSpace(param._Keyword))
            {
                where.And(d => d.Name.Like(param._Keyword)
                            || d.Remark.Like(param._Keyword)
                            );
            }
            if (param.IsDeleted != null)
            {
                where.And(d => d.IsDeleted == param.IsDeleted);

            }

            if (param._DeptId != null)
            {
                where.And(d => d.DeptIds.Like(param._DeptId.ToString()));
            }


            //if (!string.IsNullOrWhiteSpace(param.Class))
            //{
            //    where.And(d => d.Class == param.Class);
            //}


            //if (param._CurrentSysUser != null && param._CurrentSysUser._IsAdmin != true)
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


            if (param._CurrentSysUser != null
                && param._CurrentSysUser._IsAdmin != true
                && !param._CurrentSysUser.TenantId.DosIsNullOrWhiteSpace())
            {
                where.And(d => d.TenantId == param._CurrentSysUser.TenantId);
            }


            var fs = dbRead.From<SysRole>().Where(where);
            //var dataCount = SysRoleRepository.Count(where);
            var dataCount = fs.Count();

            if (param._PageIndex != null && param._PageSize != null)
            {
                fs.Page(param._PageSize.Value, param._PageIndex.Value);
            }
            fs.OrderByDescending(d => d.CreateTime);

            //var list = SysRoleRepository.Query(where, d => d.CreateTime, "desc", null, param._PageSize, param._PageIndex);
            var list = fs.ToList();

            //获取角色的部门名称
            var allDepts = dbRead.From<SysDept>().Where(d => d.IsDeleted == 0).ToList();
            foreach (var item in list)
            {
                item.DeptNames = "";
                if (!item.DeptIds.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        var deptIdsList = JsonConvert.DeserializeObject<List<List<string>>>(item.DeptIds);
                        if (deptIdsList != null)
                        {
                            var deptIds = new List<string>();
                            foreach (var item3 in deptIdsList)
                            {
                                if (item3.Any())
                                {
                                    deptIds.Add(item3.Last());
                                }
                            }
                            var resultDeptModels = allDepts.Where(d => deptIds.Contains(d.Id)).ToList();
                            foreach (var item4 in resultDeptModels)
                            {
                                item.DeptNames += item4.Name + ",";
                            }
                        }
                    }
                    catch (Exception)
                    {
                        continue;
                    }
                }
                
                item.DeptNames = item.DeptNames.TrimEnd(',');
            }

            return new DosResultList<SysRole>(1, list, "", dataCount);
        }
        /// <summary>
        /// 传入Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<SysRole>> GetSysRoleModel(SysRoleParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult<SysRole>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            var where = new Where<SysRole>();
            where.And(d => d.Id == param.Id && d.IsDeleted == 0);

            //var model = SysRoleRepository.First(where);
            var model = dbSession.From<SysRole>().Where(where).First();
            if (model == null)
            {
                return new DosResult<SysRole>(0, null, DiyMessage.GetLang(param.OsClient,  "NoExistData", param._Lang) + " Id：" + param.Id);
            }
            if (model.SysRoleLimits == null)
            {
                var ids = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                {
                    RoleId = model.Id,
                    Type = "Menu",
                    OsClient = param.OsClient
                },
                    dbSession);
                //model.SysRoleLimits = ids.Select(d => d.FkId).ToList();
                model.SysRoleLimits = ids.Select(d => new SysRoleLimits { Id = d.FkId, Permission = d.Permission }).ToList();
            }

            return new DosResult<SysRole>(1, model);
        }
        /// <summary>
        /// 新增
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> AddSysRole(SysRoleParam param)
        {
            #region Check

            #endregion

            #region  通用新增
            var model = MapperHelper.Map<object, SysRole>(param);
            model.Id = Guid.NewGuid().ToString();
            #endregion end

            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;

            model.CreateTime = DateTime.Now;
            model.UpdateTime = DateTime.Now;
            //var count = SysRoleRepository.Insert(model);
            if (param._CurrentSysUser != null && !param._CurrentSysUser.TenantId.DosIsNullOrWhiteSpace())
            {
                model.TenantId = param._CurrentSysUser.TenantId;
                model.TenantName = param._CurrentSysUser.TenantName;
                if (model.Level >= 999)
                {
                    model.Level = 998;
                }
            }
            var count = dbSession.Insert(model);
            if (count > 0)
            {
                //如果传入了菜单权限
                if (param.SysRoleLimits != null)
                {
                    //SysRoleLimitRepository.Delete(d => d.RoleId == model.Id && d.Type == "Menu");
                    dbSession.Delete<SysRoleLimit>(d => d.RoleId == model.Id && d.Type == "Menu");
                    var sysRoleLimitList = new List<SysRoleLimit>();
                    foreach (var roleLimit in param.SysRoleLimits)
                    {
                        sysRoleLimitList.Add(new SysRoleLimit()
                        {
                            Id = Guid.NewGuid().ToString(),
                            RoleId = model.Id,
                            FkId = roleLimit.Id,
                            Type = "Menu",
                            CreateTime = DateTime.Now,
                            Permission = roleLimit.Permission
                        });
                    }
                    //SysRoleLimitRepository.Insert(sysRoleLimitList);
                    dbSession.Insert(sysRoleLimitList);
                }
            }
            return new DosResult(count > 0 ? 1 : 0, model, count > 0 ? "" : DiyMessage.GetLang(param.OsClient,  "Line0", param._Lang));
        }
        /// <summary>
        /// 修改用户。必传：Id或Account
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptSysRole(SysRoleParam param)
        {
            #region Check
            if (param.Id.DosIsNullOrWhiteSpace() || param._CurrentSysUser == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            if (param._CurrentSysUser.Account.ToLower() != "admin" && CantUpt.Contains(param.Id))
            {
                return new DosResult(0, null, "系统内置默认角色禁止修改！");
            }


            #endregion
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            DbSession dbRead = OsClient.GetClient(param.OsClient).DbRead;
            //var model = SysRoleRepository.First(d => d.Id == param.Id);
            var model = dbSession.From<SysRole>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "NoAccount", param._Lang));
            }
            var isNeedSyncSysUserLevel = false;
            if (model.Level != param.Level)
            {
                isNeedSyncSysUserLevel = true;
            }

            #region  通用修改
            ////var modelJson = JObject.Parse(JsonConvert.SerializeObject(model));
            ////var paramJson = JObject.Parse(JsonConvert.SerializeObject(param));

            ////这里使用JObject.FromObject有个问题，model.SysRoleLimits 判断不了类型
            //var modelJson = JObject.FromObject(model);
            ////var modelJson = model.GetType().GetProperties();
            //var paramJson = JObject.FromObject(param);

            //var modelList = modelJson.Properties();
            //var paramList = paramJson.Properties();
            //foreach (var l in modelList)
            //{
            //    //l.PropertyType.Name
            //    if (paramList.Any(d => d.Name == l.Name))
            //    {
            //        var val = paramList.First(d => d.Name == l.Name).Value;
            //        if (val.Type == JTokenType.Object || val.Type == JTokenType.Array || (val.Type != JTokenType.Null && ((Newtonsoft.Json.Linq.JValue)(val)).Value != null))
            //        {
            //            if ((val.Type == JTokenType.Object || val.Type == JTokenType.Array) && l.Type != JTokenType.Object && l.Type != JTokenType.Array)
            //            {
            //                l.Value = val.ToString(Formatting.None);// JsonConvert.SerializeObject(val);
            //            }
            //            else
            //            {
            //                l.Value = val;
            //            }
            //        }

            //        //if (val.Type != JTokenType.Object && val.Type != JTokenType.Array&& (val.Type != JTokenType.Null && ((Newtonsoft.Json.Linq.JValue)(val)).Value != null))
            //        //{
            //        //    l.Value = val;
            //        //}
            //    }
            //}
            ////model = JsonConvert.DeserializeObject<SysRole>(JsonConvert.SerializeObject(modelJson));
            //model = modelJson.ToObject<SysRole>();

            model = MapperHelper.MapNotNull<object, SysRole>(param);

            #endregion end
            model.UpdateTime = DateTime.Now;

            //model.BaseLimit = JsonConvert.SerializeObject(param.BaseLimit, Formatting.None); 
            //model.SysRoleLimits = JsonConvert.SerializeObject(param.SysRoleLimits, Formatting.None);
            //model.DeptIds = JsonConvert.SerializeObject(param.DeptIds, Formatting.None);

            //var count = SysRoleRepository.Update(model);

            if (param._CurrentSysUser != null && !param._CurrentSysUser.TenantId.DosIsNullOrWhiteSpace())
            {
                if (model.Level >= 999)
                {
                    model.Level = 998;
                }
            }

            var count = dbSession.Update(model);

            //更新SysUser表的Level
            if (isNeedSyncSysUserLevel)
            {
                Task.Run(() =>
                {
                    //先修复RoleIds？暂时不修复，UptSysUser的时候修复
                    var allSysUser = dbRead.From<SysUser>()
                                            .Select(new SysUser().GetFields())
                                            .Where(d => d.RoleIds.Like(model.Id.ToString()) && d.IsDeleted == 0)
                                            .ToList();
                    var allSysRole = dbRead.From<SysRole>()
                                            .Select(new SysRole().GetFields())
                                            .Where(d => d.IsDeleted == 0)
                                            .ToList();
                    foreach (var sysUser in allSysUser)
                    {
                        try
                        {
                            var sysUserRoleIds = JsonConvert.DeserializeObject<List<string>>(sysUser.RoleIds);
                            //查询该用户所有角色
                            var userRoles = allSysRole.Where(d => sysUserRoleIds.Contains(d.Id)).ToList();
                            var maxLevel = 0;
                            foreach (var roleModel in userRoles)
                            {
                                if (maxLevel < roleModel.Level)
                                {
                                    maxLevel = roleModel.Level;
                                }
                            }
                            if (sysUser.Level != maxLevel)
                            {
                                sysUser.Level = maxLevel;
                                //后期改成批量修改
                                dbSession.Update(sysUser);
                            }
                        }
                        catch (Exception ex)
                        {
                            
                            var sysUserRoleIds = JsonConvert.DeserializeObject<List<SysRole>>(sysUser.RoleIds);
                            //查询该用户所有角色
                            var userRoles = allSysRole.Where(d => sysUserRoleIds.Any(o => o.Id == d.Id)).ToList();
                            var maxLevel = 0;
                            foreach (var roleModel in userRoles)
                            {
                                if (maxLevel < roleModel.Level)
                                {
                                    maxLevel = roleModel.Level;
                                }
                            }
                            if (sysUser.Level != maxLevel)
                            {
                                sysUser.Level = maxLevel;
                                //后期改成批量修改
                                dbSession.Update(sysUser);
                            }
                        }
                        
                    }
                });
            }

            //计算排序
            if (param.ParentId != null && param.Sort != null)
            {
                ////查询出该ParentId下所有子项
                ////var allChild = SysBaseDataRepository.Query(d => d.ParentId == param.ParentId && d.Id != model.Id, d => d.Sort, "asc");
                //var allChild = dbSession.From<SysBaseData>()
                //                    .Where(d => d.ParentId == param.ParentId && d.Id != model.Id)
                //                    .OrderBy(d => d.Sort)
                //                    .ToList();
                //var tIndex = 0;
                //foreach (var item in allChild)
                //{
                //    if (tIndex != param.Sort)
                //    {
                //        item.Sort = tIndex;
                //    }
                //    else
                //    {
                //        //如果到了本次循环的数据，则排序立即再次+1
                //        tIndex++;
                //        item.Sort = tIndex;
                //    }
                //    tIndex++;
                //}
                ////SysBaseDataRepository.Update(allChild);
                //dbSession.Update(allChild);
            }

            //如果传入了菜单权限
            if (param.SysRoleLimits != null)
            {
                //var menus = await new SysMenuLogic().GetSysMenu(new SysMenuParam() {
                //    Ids = param.SysMenuIds
                //});
                //SysRoleLimitRepository.Delete(d => d.RoleId == model.Id && d.Type == "Menu");
                dbSession.Delete<SysRoleLimit>(d => d.RoleId == model.Id && d.Type == "Menu");
                var sysRoleLimitList = new List<SysRoleLimit>();
                foreach (var roleLimit in param.SysRoleLimits)
                {
                    sysRoleLimitList.Add(new SysRoleLimit()
                    {
                        Id = Guid.NewGuid().ToString(),
                        RoleId = model.Id,
                        FkId = roleLimit.Id,
                        Type = "Menu",
                        CreateTime = DateTime.Now,
                        Permission = roleLimit.Permission
                    });
                }
                //SysRoleLimitRepository.Insert(sysRoleLimitList);
                dbSession.Insert(sysRoleLimitList);
            }


            return new DosResult(1);
        }
        /// <summary>
        /// 删除菜单，必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> DelSysRole(SysRoleParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())//|| param._CurrentSysUser == null
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (CantUpt.Contains(param.Id))// && param._CurrentSysUser.Account.ToLower() != "admin"
            {
                return new DosResult(0, null, "系统内置默认角色禁止删除！");
            }

            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;

            //var model = SysRoleRepository.First(d => d.Id == param.Id);
            var model = dbSession.From<SysRole>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "NoExistData", param._Lang) + " Id：" + param.Id);
            }
            model.IsDeleted = 1;
            //var count = SysRoleRepository.Delete(param.Id);
            //var count = dbSession.Delete<SysRole>(param.Id);
            var count = dbSession.Update(model);
            return new DosResult(1);
        }



        /// <summary>
        /// 。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<SysRole>> GetSysRoleStep(SysRoleParam param)
        {
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            var allList = dbSession.From<SysRole>().Where(d => d.IsDeleted == 0).OrderBy(d => d.CreateTime).ToList();
            var firstList = allList.ToList();
            //递归获取层级
            GetAllPostChild(allList, firstList);
            return new DosResultList<SysRole>(1, firstList);
        }
        /// <summary>
        /// 递归获取层级
        /// </summary>
        private void GetAllPostChild(List<SysRole> allList, List<SysRole> list)
        {
            foreach (var SysRole in list)
            {
                if (allList.Any(d => d.ParentId == SysRole.Id))
                {
                    SysRole._Child = allList.Where(d => d.ParentId == SysRole.Id && d.IsDeleted == 0).OrderBy(d => d.CreateTime).ToList();
                    //递归获取层级
                    GetAllPostChild(allList, SysRole._Child);
                }
            }
        }
    }
}
