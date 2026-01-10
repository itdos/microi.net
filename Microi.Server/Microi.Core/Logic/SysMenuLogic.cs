using Dos.ORM;
#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) 道斯科技
* CLR 版本: 4.0.30319.17929
* 创 建 人：周浩
* 电子邮箱：zhouhao@itdos.com
* 创建日期：2016/3/1 10:00:11
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
// 通过扩展方法使用Dos.ORM API
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class SysMenuLogic
    {
        #region 禁止删除列表
        public static Dictionary<string, string> CantDeleteId = new Dictionary<string, string>()
        {
           {"GetPa", "83442E16-917D-43B1-9C79-7F173C74EDC0"},
        };
        #endregion

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        /// <exception cref="Exception"></exception>
        public async Task<DosResult<dynamic>> GetSysMenuHomePage(SysMenuParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            //SysMenu model = dbSession.From<SysMenu>()
            //                .Where(d => d.IsDeleted == 0 && d.Display == true)
            //                .OrderBy(d=>d.Sort)
            //                .First();
            var modelResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
            {
                TableName = "Sys_Menu",
                OsClient = param.OsClient,
                _SearchEqual = new
                {
                    Display = 1
                },
                _OrderBy = "Sort",
                _OrderByType = "ASC"
            });
            return modelResult;
        }
        /// <summary>
        /// 传入Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<SysMenu>> GetSysMenuModel(SysMenuParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult<SysMenu>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<SysMenu>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            SysMenu model = null;
            if (!param.Id.DosIsNullOrWhiteSpace())
            {
                //model = await SysMenuCache.GetSysMenuModel(param.Id, param.OsClient);
            }
            if (model == null)
            {
                IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
                if (!param.Id.DosIsNullOrWhiteSpace())
                {
                    model = dbSession.From<SysMenu>().Where(d => d.Id == param.Id).First();
                }
                if (model == null)
                {
                    return new DosResult<SysMenu>(2, null, "不存在的数据Id：" + param.Id);
                }
                //SysMenuCache.SetSysMenuModel(model, param.OsClient);
            }
            return new DosResult<SysMenu>(1, model);
        }

        /// <summary>
        /// 递归获取层级
        /// </summary>


        /// <summary>
        /// 获取基础数据。必传：ParentId
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<SysMenu>> GetSysMenu(SysMenuParam param)
        {
            if (param.ParentId.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<SysMenu>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<SysMenu>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            List<SysMenu> list = null;// await SysMenuCache.GetSysMenuList(param.ParentId, param.OsClient);
            if (list == null)
            {
                var where = new Where<SysMenu>();
                where.And(d => d.IsDeleted == 0);
                where.And(a => a.ParentId == param.ParentId);
                if (!param.Class.DosIsNullOrWhiteSpace())
                {
                    where.And(a => a.Class == param.Class || a.Class == "" || a.Class == null);
                }
                list = dbSession.From<SysMenu>().Where(where).OrderBy(d => d.Sort).ToList();
                //SysMenuCache.SetSysMenuList(list, param.ParentId, param.OsClient);
            }
            return new DosResultList<SysMenu>(1, list);
        }


        /// <summary>
        /// 获取菜单树形结构。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResultList<SysMenu>> GetSysMenuStep(SysMenuParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<SysMenu>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            var where = new Where<SysMenu>();
            where.And(d => d.IsDeleted == 0);
            if (param.Ids != null)
            {
                where.And(d => d.Id.In(param.Ids));
            }
            if (param.Display != null)
            {
                where.And(d => d.Display == param.Display);
            }
            if (param.AppDisplay != null)
            {
                where.And(d => d.AppDisplay == param.AppDisplay);
            }
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            //判断权限
            //注意：如果有模块配置的菜单权限，那里返回的菜单就应该是所有
            if (param._CurrentUser != null)
            {
                //如果是admin或权限999，并且是获取所有级别，就不需要执行下面的代码。
                if (!(param._All == true && (param._CurrentUser?["Account"]?.Value<string>().ToLower() == "admin" || param._CurrentUser?["Level"]?.Value<int>() >= 999)))
                {
                    //2022-10-25更改为直接从Sys_User表获取所有角色
                    var roleIds = new List<string>();
                    try
                    {
                        if (!param._CurrentUser?["RoleIds"]?.Value<string>().DosIsNullOrWhiteSpace() == true)
                        {
                            if (!param._CurrentUser?["RoleIds"]?.Value<string>().Contains("{") == true)
                            {
                                var roleIdsList = JsonConvert.DeserializeObject<List<string>>(param._CurrentUser?["RoleIds"]?.Value<string>()) ?? new List<string>();
                                roleIds = roleIdsList;
                            }
                            else
                            {
                                var rolesList = JsonConvert.DeserializeObject<List<SysRole>>(param._CurrentUser?["RoleIds"]?.Value<string>()) ?? new List<SysRole>();
                                roleIds = rolesList.Select(d => d.Id).ToList();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        var rolesList = JsonConvert.DeserializeObject<List<SysRole>>(param._CurrentUser?["RoleIds"]?.Value<string>()) ?? new List<SysRole>();
                        roleIds = rolesList.Select(d => d.Id).ToList();
                        ////取当前用户所有角色
                        //var roleIdsResult = await new SysUserFkLogic().GetSysUserFk(new SysUserFkParam()
                        //{
                        //    UserId = param._CurrentUser?["Id"]?.Value<string>(),
                        //    Type = "Role",
                        //    OsClient = param.OsClient
                        //});//, dbSession
                        //roleIds = roleIdsResult.Select(d => d.FkId).ToList();
                    }

                    //再取这些角色拥有的菜单
                    var menuIds = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                    {
                        RoleIds = roleIds,
                        Type = "Menu",
                        OsClient = param.OsClient
                    });//, dbSession
                    var ids = menuIds.Select(d => d.FkId).ToList();

                    if (param._CurrentUser?["Account"]?.Value<string>().ToLower() == "admin")
                    {
                        ids.AddRange(new List<string>() {
                        "cdc0844b-7249-4d64-a9c3-563a15c9cd20",//系统引擎
                        "19009ad3-f22a-4bb5-833b-71851cdfd9e4",//模块引擎
                        "dea581fd-a6ed-4f63-a320-6e21f46fce13",//数据源引擎
                        "f873af6b-7577-44e0-b9a7-67027b54ace6",//接口引擎
                        "e0931622-27c7-49cd-b222-49ee15db290f",//表单引擎
                        "37e8acc8-de51-4032-9304-d7b363e60af3",//流程引擎
                        "53f97f9d-15de-434a-8a06-5924417ae9d4",//微服务
                        "adc8487f-9a58-4354-acbd-e97ce182ec7b",//系统管理
                        "663bb061-d159-47ce-9cc8-0aa2b13e601b",//基础数据
                        "cb73dd2c-6b5a-4b1b-91eb-64c31fa9a8b3",//系统帐号
                        "03e8ad12-e43f-49d0-81f9-6a4ee118b555",//岗位角色
                        "03ef7890-35a8-4428-86ba-0622a0f1c0a3",//部门机构
                        "ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf",//系统设置diy
                        "fe06ab66-7a10-4f3c-bced-523605f4c65e",//系统日志
                    });
                    }
                    where.And(d => d.Id.In(ids));// || d.UserId == param._CurrentSysUser.Id
                }
            }
            var selectCol = new List<string>() {
                "Id", "Name", "Icon", "IconClass", "Display", "AppDisplay", "IsMicroiService",
                "OpenType", "ComponentName", "ComponentPath", "PageTemplate", "Url",
                "DiyTableId", "ParentId", "Sort"
            };
            var fields = new SysMenu().GetFields();
            var selectFields = new List<Field>();
            foreach (var item in selectCol)
            {
                if (fields.Any(d => d.Name == item))
                {
                    selectFields.Add(fields.First(d => d.Name == item));
                }
            }
            var allList = dbSession.From<SysMenu>()
                                        .Select(selectFields.ToArray())
                                        .Where(where)
                                        .OrderBy(d => d.Sort)
                                        .ToList();
            var firstList = new List<SysMenu>();
            if (!param._ChildSystemId.DosIsNullOrWhiteSpace())
            {
                firstList = allList.Where(d => d.ParentId == param._ChildSystemId)
                                    .ToList();
            }
            else
            {
                firstList = allList.Where(d => d.ParentId == Guid.Empty.ToString() || d.ParentId == null || d.ParentId == "" || d.ParentId == DiyCommon.UlidEmpty)
                                    .ToList();
            }

            var dataCount = firstList.Count;
            //是否分页
            if (param._PageSize != null && param._PageIndex != null)
            {
                firstList = firstList.Skip((param._PageIndex.Value - 1) * param._PageSize.Value).Take(param._PageSize.Value).ToList();
            }
            if (param._Top != null)
            {
                firstList = firstList.Take(param._Top.Value).ToList();
            }
            //递归获取层级
            GetAllBaseDataChild(allList, firstList);
            return new DosResultList<SysMenu>(1, firstList, "", dataCount);
        }
        /// <summary>
        /// 递归获取层级
        /// </summary>
        private void GetDiyAllBaseDataChild(List<dynamic> allList, List<dynamic> list)
        {
            foreach (var sysMenu in list)
            {
                if (allList.Any(d => d.ParentId == sysMenu.Id))
                {
                    sysMenu._Child = allList.Where(d => d.ParentId == sysMenu.Id).OrderBy(d => d.Sort).ToList();
                    //递归获取层级
                    GetDiyAllBaseDataChild(allList, sysMenu._Child);
                }
            }
        }
        /// <summary>
        /// 递归获取层级
        /// </summary>
        private void GetAllBaseDataChild(List<SysMenu> allList, List<SysMenu> list)
        {
            foreach (var sysMenu in list)
            {
                if (allList.Any(d => d.ParentId == sysMenu.Id))
                {
                    sysMenu._Child = allList.Where(d => d.ParentId == sysMenu.Id).OrderBy(d => d.Sort).ToList();
                    //递归获取层级
                    GetAllBaseDataChild(allList, sysMenu._Child);
                }
            }
        }

        /// <summary>
        /// 修改基础数据。必传：Id。可传：Value、Remark、Sort
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptSysMenu(SysMenuParam param)
        {
            #region Check

            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.Id == param.ParentId)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            #endregion
            var modelResult = await GetSysMenuModel(param);
            var model = modelResult.Data;

            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;


            #region  通用修改
            model = MapperHelper.MapNotNull<object, SysMenu>(param);
            #endregion end

            var count = dbSession.Update(model, d => d.Id == param.Id);
            if (model.ParentId != null)
            {
                //SysMenuCache.DelSysMenuList(model.ParentId, param.OsClient);
            }
            //SysMenuCache.DelSysMenuModel(model, param.OsClient);
            return new DosResult(1, model);
        }
        /// <summary>
        /// 新增菜单。必传Name、OpenType
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> AddSysMenu(SysMenuParam param)
        {
            if (param.Name.DosIsNullOrWhiteSpace()
                || param.OpenType.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            try
            {
                IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;

                if (dbSession != null)
                {
                    if (!param.Url.DosIsNullOrWhiteSpace()
                        && dbSession.From<SysMenu>().Where(d => d.Url == param.Url && d.IsDeleted == 0).First() != null)
                    {
                        return new DosResult(0, null, "已存在的Url！");
                    }
                    #region  通用新增
                    var model = MapperHelper.Map<object, SysMenu>(param);
                    model.Id = Ulid.NewUlid().ToString();
                    #endregion end

                    model.ParentId = param.ParentId.DosIsNullOrWhiteSpace() ? DiyCommon.UlidEmpty : param.ParentId;
                    model.Sort = param.Sort ?? 0;
                    model.CreateTime = DateTime.Now;
                    model.MultRun = param.MultRun ?? 1;
                    model.Display = param.Display ?? 1;
                    model.Code = "Code" + DateTime.Now.ToString("yyyyMMddHHmmss");
                    var count = dbSession.Insert(model);
                    if (model.ParentId != null)
                    {
                        //SysMenuCache.DelSysMenuList(model.ParentId, param.OsClient);
                    }
                    return new DosResult(count > 0 ? 1 : 0, model, count > 0 ? "" : DiyMessage.GetLang(param.OsClient, "Line0", param._Lang));
                }
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            catch (Exception ex)
            {


                return new DosResult(0, null, ex.Message);
            }
        }

        /// <summary>
        /// 删除基础数据，必传ID或Key
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> DelSysMenu(SysMenuParam param)
        {
            #region Check
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyTokenExtend.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (param.Id.DosIsNullOrWhiteSpace() && param.Ids == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (!param.Id.DosIsNullOrWhiteSpace() && CantDeleteId.ContainsValue(param.Id))
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "CantDelete", param._Lang));
            }
            #endregion
            IMicroiDbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            if (param.Ids != null)
            {
                var list = dbSession.From<SysMenu>().Where(d => d.Id.In(param.Ids)).ToList();
                foreach (var baseData in list)
                {
                    //SysMenuCache.DelSysMenuModel(baseData, param.OsClient);
                }
                if (list.Any())
                {
                    //SysMenuCache.DelSysMenuList(list.First().ParentId, param.OsClient);
                }
                foreach (var item in list)
                {
                    item.IsDeleted = 1;
                }
                //var count = SysMenuRepository.Update(list);
                var count = dbSession.Update(list);
                return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.GetLang(param.OsClient, "Line0", param._Lang));
            }
            else
            {
                var modelResult = await GetSysMenuModel(param);
                if (modelResult.Code != 1)
                {
                    return new DosResult(0, null, modelResult.Msg);
                }
                var model = modelResult.Data;
                if (dbSession.From<SysMenu>().Where(d => d.ParentId == model.Id && d.IsDeleted == 0).First() != null)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ExistChildData", param._Lang));
                }
                if (param._CurrentUser?["Account"]?.Value<string>().ToLower() != "admin" && model.UserId != param._CurrentUser?["Id"]?.Value<string>())
                {
                    return new DosResult(0, null, "您不能删除其它用户创建的菜单！");
                }
                model.IsDeleted = 1;
                var count = dbSession.Update(model);
                if (model.ParentId != null)
                {
                    //SysMenuCache.DelSysMenuList(model.ParentId, param.OsClient);
                }
                //SysMenuCache.DelSysMenuModel(model, param.OsClient);
                return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.GetLang(param.OsClient, "Line0", param._Lang));
            }
        }
    }
}
