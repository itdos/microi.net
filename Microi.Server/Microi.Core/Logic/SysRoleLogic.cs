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
using System.Threading.Tasks;
using System.Web;
using Dos.Common;
// 通过扩展方法使用Dos.ORM API
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class SysRoleLogic
    {
        private static readonly HashSet<string> AllowedDirectTablePermissions =
            new HashSet<string>(new[] { "Read", "Add", "Edit", "Del" }, StringComparer.OrdinalIgnoreCase);

        public static List<string> CantUpt = new List<string>()
        {
            "5DB47859-35A3-411A-A1F7-99482E057D24".ToLower()
        };

        private static DosResult ValidateRoleMutationAdministrator(
            DbSession dbSession,
            SysRoleParam param)
        {
            if (param != null
                && PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    dbSession,
                    param._CurrentUser))
            {
                return new DosResult(1);
            }

            return new DosResult(
                0,
                null,
                DiyMessage.GetLang(param?.OsClient, "NoAuth", param?._Lang));
        }

        private static void SyncUserLevelsForRole(DbSession dbSession, string roleId)
        {
            if (dbSession == null || roleId.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var allSysUser = dbSession.From<SysUser>()
                .Select(new SysUser().GetFields())
                .Where(d => d.RoleIds.Like(roleId) && d.IsDeleted != 1)
                .ToList();
            var allSysRole = dbSession.From<SysRole>()
                .Select(new SysRole().GetFields())
                .Where(d => d.IsDeleted != 1)
                .ToList();
            foreach (var sysUser in allSysUser)
            {
                var sysUserRoleIds = PlatformAdministratorSecurity.ParseRoleIds(sysUser.RoleIds);
                var maxLevel = allSysRole
                    .Where(role => sysUserRoleIds.Contains(
                        role.Id,
                        StringComparer.OrdinalIgnoreCase))
                    .Select(role => role.Level)
                    .DefaultIfEmpty(0)
                    .Max();
                if (sysUser.Level != maxLevel)
                {
                    sysUser.Level = maxLevel;
                    dbSession.Update(sysUser);
                }
            }
        }

        /// <summary>
        /// Direct table grants are an advanced escape hatch, so validate their full
        /// shape on the server. The UI is not an authority: callers may post arbitrary
        /// table ids, protected resources or invented permission names.
        /// </summary>
        private static DosResult NormalizeDirectTableRoleLimits(
            DbSession dbSession,
            IEnumerable<SysRoleLimits> requestedLimits,
            int targetRoleLevel,
            string osClient,
            string lang,
            out List<SysRoleLimits> normalizedLimits)
        {
            normalizedLimits = null;
            if (requestedLimits == null)
            {
                return new DosResult(1);
            }

            var rawRequested = requestedLimits.ToList();
            if (rawRequested.Any(d => d == null || d.Id.DosIsNullOrWhiteSpace()))
            {
                return new DosResult(0, null, "数据表直连权限缺少有效的数据表标识。");
            }

            var requested = rawRequested.ToList();
            if (requested.Count == 0)
            {
                normalizedLimits = new List<SysRoleLimits>();
                return new DosResult(1);
            }

            var duplicateTableId = requested
                .GroupBy(d => d.Id.Trim(), StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(d => d.Count() > 1);
            if (duplicateTableId != null)
            {
                return new DosResult(0, null, "同一数据表不能重复配置直连权限。");
            }

            var requestedIds = requested
                .Select(d => d.Id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var tableModels = dbSession.From<DiyTable>()
                .Where(d => d.Id.In(requestedIds) && d.IsDeleted != 1)
                .ToList();
            if (tableModels.Count != requestedIds.Count)
            {
                return new DosResult(
                    0,
                    null,
                    DiyMessage.GetLang(osClient, "NoExistData", lang));
            }

            var tableById = tableModels.ToDictionary(d => d.Id, StringComparer.OrdinalIgnoreCase);
            var result = new List<SysRoleLimits>();
            foreach (var requestedLimit in requested)
            {
                var tableId = requestedLimit.Id.Trim();
                if (!tableById.TryGetValue(tableId, out var tableModel))
                {
                    return new DosResult(
                        0,
                        null,
                        DiyMessage.GetLang(osClient, "NoExistData", lang));
                }

                JArray permissionArray;
                try
                {
                    permissionArray = requestedLimit.Permission.DosIsNullOrWhiteSpace()
                        ? new JArray()
                        : JArray.Parse(requestedLimit.Permission);
                }
                catch
                {
                    return new DosResult(0, null, "数据表直连权限格式不正确。");
                }

                var permissions = permissionArray
                    .Values<string>()
                    .Where(d => !d.DosIsNullOrWhiteSpace())
                    .Select(d => d.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (permissions.Any(d => !AllowedDirectTablePermissions.Contains(d)))
                {
                    return new DosResult(0, null, "数据表直连权限包含不支持的操作。");
                }

                var deniedPermissions = permissions
                    .Where(permission => !PlatformResourceSecurity.CanGrantDirectTablePermission(
                        tableModel.Name,
                        permission,
                        targetRoleLevel))
                    .ToList();
                if (deniedPermissions.Count > 0)
                {
                    if (PlatformResourceSecurity.IsProtectedTable(tableModel.Name))
                    {
                        return new DosResult(0, null, "平台核心保护表不能授予普通角色直连权限。");
                    }
                    if (PlatformResourceSecurity.IsReadOnlyTable(tableModel.Name))
                    {
                        return new DosResult(
                            0,
                            null,
                            "平台运行元数据表仅允许向普通角色授予查询权限。");
                    }
                    return new DosResult(0, null, "该数据表包含不可授予的直连操作。");
                }

                // An empty permission array grants nothing. Do not persist a misleading
                // sys_rolelimit row that may acquire broader meaning in future code.
                if (permissions.Count == 0)
                {
                    continue;
                }

                result.Add(new SysRoleLimits
                {
                    Id = tableId,
                    Permission = JArray.FromObject(permissions).ToString(Formatting.None)
                });
            }

            normalizedLimits = result;
            return new DosResult(1);
        }

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
            DbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;
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

            if (param._CurrentUser != null
                && param._CurrentUser["_IsAdmin"].Val<bool>() != true
                && !param._CurrentUser["TenantId"].Val<string>().DosIsNullOrWhiteSpace())
            {
                var tenantId = param._CurrentUser?["TenantId"].Val<string>();
                where.And(d => d.TenantId == tenantId);
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
            var allDepts = dbRead.From<SysDept>().Where(d => d.IsDeleted != 1).ToList();
            foreach (var item in list)
            {
                item.DeptNames = "";
                if (!item.DeptIds.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        var deptIdsList = JsonHelper.Deserialize<List<List<string>>>(item.DeptIds);
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
            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            var where = new Where<SysRole>();
            where.And(d => d.Id == param.Id && d.IsDeleted != 1);

            //var model = SysRoleRepository.First(where);
            var model = dbSession.From<SysRole>().Where(where).First();
            if (model == null)
            {
                return new DosResult<SysRole>(0, null, DiyMessage.GetLang(param.OsClient, "NoExistData", param._Lang) + " Id：" + param.Id);
            }
            if (model.SysRoleLimits == null || !model.SysRoleLimits.Any())
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
            if (model.TableRoleLimits == null || !model.TableRoleLimits.Any())
            {
                var tableLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                {
                    RoleId = model.Id,
                    Type = "Table",
                    OsClient = param.OsClient
                }, dbSession);
                model.TableRoleLimits = tableLimits
                    .Select(d => new SysRoleLimits { Id = d.FkId, Permission = d.Permission })
                    .ToList();
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
            #region  通用新增

            var model = MapperHelper.Map<object, SysRole>(param);
            model.Id = Ulid.NewUlid().ToString();

            #endregion end

            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;

            var administratorValidation = ValidateRoleMutationAdministrator(dbSession, param);
            if (administratorValidation.Code != 1)
            {
                return administratorValidation;
            }

            model.CreateTime = DateTime.Now;
            model.UpdateTime = DateTime.Now;
            //var count = SysRoleRepository.Insert(model);
            if (param._CurrentUser != null && !param._CurrentUser["TenantId"].Val<string>().DosIsNullOrWhiteSpace())
            {
                model.TenantId = param._CurrentUser?["TenantId"].Val<string>();
                model.TenantName = param._CurrentUser?["TenantName"].Val<string>();
                if (model.Level >= DiyCommon.MaxRoleLevel)
                {
                    model.Level = DiyCommon.MaxRoleLevel - 1;
                }
            }
            var directGrantValidation = NormalizeDirectTableRoleLimits(
                dbSession,
                param.TableRoleLimits,
                model.Level,
                param.OsClient,
                param._Lang,
                out var normalizedTableRoleLimits);
            if (directGrantValidation.Code != 1)
            {
                return directGrantValidation;
            }
            param.TableRoleLimits = normalizedTableRoleLimits;

            var count = dbSession.Insert(model);
            if (count > 0)
            {
                //如果传入了菜单权限
                if (param.SysRoleLimits != null && param.SysRoleLimits.Any())
                {
                    //SysRoleLimitRepository.Delete(d => d.RoleId == model.Id && d.Type == "Menu");
                    dbSession.Delete<SysRoleLimit>(d => d.RoleId == model.Id && d.Type == "Menu");
                    var sysRoleLimitList = new List<SysRoleLimit>();
                    foreach (var roleLimit in param.SysRoleLimits)
                    {
                        sysRoleLimitList.Add(new SysRoleLimit()
                        {
                            Id = Ulid.NewUlid().ToString(),
                            RoleId = model.Id,
                            FkId = roleLimit.Id,
                            Type = "Menu",
                            CreateTime = DateTime.Now,
                            Permission = roleLimit.Permission
                        });
                    }
                    //SysRoleLimitRepository.Insert(sysRoleLimitList);
                    var count2 = dbSession.Insert(sysRoleLimitList);
                }
                if (param.TableRoleLimits != null && param.TableRoleLimits.Any())
                {
                    dbSession.Delete<SysRoleLimit>(d => d.RoleId == model.Id && d.Type == "Table");
                    var tableRoleLimitList = param.TableRoleLimits.Select(roleLimit => new SysRoleLimit()
                    {
                        Id = Ulid.NewUlid().ToString(),
                        RoleId = model.Id,
                        FkId = roleLimit.Id,
                        Type = "Table",
                        CreateTime = DateTime.Now,
                        Permission = roleLimit.Permission
                    }).ToList();
                    dbSession.Insert(tableRoleLimitList);
                }
                await FormEngineAuthorizationCache.InvalidateAsync(param.OsClient);
            }
            return new DosResult(count > 0 ? 1 : 0, model, count > 0 ? "" : DiyMessage.GetLang(param.OsClient, "Line0", param._Lang));
        }

        /// <summary>
        /// 修改用户。必传：Id或Account
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptSysRole(SysRoleParam param)
        {
            #region Check

            if (param.Id.DosIsNullOrWhiteSpace() || param._CurrentUser == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            if (param._CurrentUser?["Account"].Val<string>().ToLower() != "admin"
                && param._CurrentUser?["Level"].Val<int>() < 9999
                && CantUpt.Contains(param.Id))
            {
                return new DosResult(0, null, "您没有权限修改此固定超级管理员角色的权限配置！");
            }

            #endregion

            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            var administratorValidation = ValidateRoleMutationAdministrator(dbSession, param);
            if (administratorValidation.Code != 1)
            {
                return administratorValidation;
            }
            //var model = SysRoleRepository.First(d => d.Id == param.Id);
            var model = dbSession.From<SysRole>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAccount", param._Lang));
            }
            var isNeedSyncSysUserLevel = false;
            if (model.Level != param.Level)
            {
                isNeedSyncSysUserLevel = true;
            }

            #region  通用修改

            ////var modelJson = JObject.Parse(JsonHelper.Serialize(model));
            ////var paramJson = JObject.Parse(JsonHelper.Serialize(param));

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
            //                l.Value = val.ToString(Formatting.None);// JsonHelper.Serialize(val);
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
            ////model = JsonHelper.Deserialize<SysRole>(JsonHelper.Serialize(modelJson));
            //model = modelJson.ToObject<SysRole>();

            model = MapperHelper.MapNotNull<object, SysRole>(param);

            #endregion end

            model.UpdateTime = DateTime.Now;

            //model.BaseLimit = JsonHelper.Serialize(param.BaseLimit, Formatting.None);
            //model.SysRoleLimits = JsonHelper.Serialize(param.SysRoleLimits, Formatting.None);
            //model.DeptIds = JsonHelper.Serialize(param.DeptIds, Formatting.None);

            //var count = SysRoleRepository.Update(model);

            if (param._CurrentUser != null 
                && !param._CurrentUser["TenantId"].Val<string>().DosIsNullOrWhiteSpace())
            {
                if (model.Level >= DiyCommon.MaxRoleLevel)
                {
                    model.Level = DiyCommon.MaxRoleLevel - 1;
                }
            }

            var directGrantValidation = NormalizeDirectTableRoleLimits(
                dbSession,
                param.TableRoleLimits,
                model.Level,
                param.OsClient,
                param._Lang,
                out var normalizedTableRoleLimits);
            if (directGrantValidation.Code != 1)
            {
                return directGrantValidation;
            }
            param.TableRoleLimits = normalizedTableRoleLimits;

            var count = dbSession.Update(model);

            //更新SysUser表的Level
            if (count > 0 && isNeedSyncSysUserLevel)
            {
                // Role mutation is a control-plane write. Complete the denormalized
                // user-level sync on the primary database before invalidating the
                // shared authorization epoch and returning. A background Task.Run
                // leaves a window where a demoted administrator can reuse stale Level.
                SyncUserLevelsForRole(dbSession, model.Id);
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
                        Id = Ulid.NewUlid().ToString(),
                        RoleId = model.Id,
                        FkId = roleLimit.Id,
                        Type = "Menu",
                        CreateTime = DateTime.Now,
                        Permission = roleLimit.Permission
                    });
                }
                //SysRoleLimitRepository.Insert(sysRoleLimitList);
                var count2 = dbSession.Insert(sysRoleLimitList);
            }
            if (param.TableRoleLimits != null)
            {
                dbSession.Delete<SysRoleLimit>(d => d.RoleId == model.Id && d.Type == "Table");
                var tableRoleLimitList = param.TableRoleLimits.Select(roleLimit => new SysRoleLimit()
                {
                    Id = Ulid.NewUlid().ToString(),
                    RoleId = model.Id,
                    FkId = roleLimit.Id,
                    Type = "Table",
                    CreateTime = DateTime.Now,
                    Permission = roleLimit.Permission
                }).ToList();
                if (tableRoleLimitList.Any())
                {
                    dbSession.Insert(tableRoleLimitList);
                }
            }

            await FormEngineAuthorizationCache.InvalidateAsync(param.OsClient);
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

            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;

            var administratorValidation = ValidateRoleMutationAdministrator(dbSession, param);
            if (administratorValidation.Code != 1)
            {
                return administratorValidation;
            }

            //var model = SysRoleRepository.First(d => d.Id == param.Id);
            var model = dbSession.From<SysRole>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoExistData", param._Lang) + " Id：" + param.Id);
            }
            model.IsDeleted = 1;
            //var count = SysRoleRepository.Delete(param.Id);
            //var count = dbSession.Delete<SysRole>(param.Id);
            var count = dbSession.Update(model);
            if (count > 0)
            {
                // Deleting a role must close the same stale-Level window as lowering
                // it. Recompute affected users before publishing the new auth epoch.
                SyncUserLevelsForRole(dbSession, model.Id);
                await FormEngineAuthorizationCache.InvalidateAsync(param.OsClient);
            }
            return new DosResult(1);
        }

        /// <summary>
        /// 。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<SysRole>> GetSysRoleStep(SysRoleParam param)
        {
            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            var allList = dbSession.From<SysRole>().Where(d => d.IsDeleted != 1).OrderBy(d => d.CreateTime).ToList();
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
                    SysRole._Child = allList.Where(d => d.ParentId == SysRole.Id && d.IsDeleted != 1).OrderBy(d => d.CreateTime).ToList();
                    //递归获取层级
                    GetAllPostChild(allList, SysRole._Child);
                }
            }
        }
    }
}
