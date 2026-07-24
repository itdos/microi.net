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
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            //SysMenu model = dbSession.From<SysMenu>()
            //                .Where(d => d.IsDeleted != 1 && d.Display == true)
            //                .OrderBy(d=>d.Sort)
            //                .First();
            var modelResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
            {
                TableName = "sys_menu",
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
                param.OsClient = DiyToken.GetCurrentOsClient();
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
                DbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
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
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<SysMenu>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            List<SysMenu> list = null;// await SysMenuCache.GetSysMenuList(param.ParentId, param.OsClient);
            if (list == null)
            {
                var where = new Where<SysMenu>();
                where.And(d => d.IsDeleted != 1);
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
        public async Task<DosResultList<dynamic>> GetSysMenuStep(SysMenuParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            var where = new List<List<object>>();
            where.Add(new List<object>(){ "IsDeleted", "<>", 1 });
            if (param.Ids != null)
            {
                where.Add(new List<object>(){ "Id", "In", param.Ids });
            }
            if (param.Display != null)
            {
                where.Add(new List<object>(){ "Display", "=", param.Display });
            }
            if (param.AppDisplay != null)
            {
                where.Add(new List<object>(){ "AppDisplay", "=", param.AppDisplay });
            }
            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
            //判断权限
            //注意：如果有模块配置的菜单权限，那里返回的菜单就应该是所有
            if (param._CurrentUser != null)
            {
                //如果是admin或权限999，并且是获取所有级别，就不需要执行下面的代码。
                if (!(param._All == true && (
                    param._CurrentUser?["Account"]?.ToString()?.ToLower() == "admin" ||
                    (param._CurrentUser?["Level"] as JValue)?.Value<int>() >= DiyCommon.MaxRoleLevel
                )))
                {
                    //2022-10-25更改为直接从sys_user表获取所有角色
                    var roleIds = new List<string>();
                    try
                    {
                        var roleIdsStr = param._CurrentUser?["RoleIds"]?.ToString();
                        if (!roleIdsStr.DosIsNullOrWhiteSpace())
                        {
                            if (roleIdsStr.Contains("{"))
                            {
                                // JSON 对象数组字符串：[{"Id":"xxx","Name":"xxx"}]
                                var rolesList = JsonHelper.Deserialize<List<SysRole>>(roleIdsStr) ?? new List<SysRole>();
                                roleIds = rolesList.Select(d => d.Id).ToList();
                            }
                            else
                            {
                                // JSON 字符串数组：["id1","id2"]
                                roleIds = JsonHelper.Deserialize<List<string>>(roleIdsStr) ?? new List<string>();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        // 异常时记录日志，返回空列表
                        Console.WriteLine($"解析用户角色失败: {ex.Message}");
                        roleIds = new List<string>();
                    }

                    //再取这些角色拥有的菜单
                    var menuIds = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                    {
                        RoleIds = roleIds,
                        Type = "Menu",
                        OsClient = param.OsClient
                    });//, dbSession
                    var ids = menuIds.Select(d => d.FkId).ToList();

                    if (param._CurrentUser?["Account"]?.ToString()?.ToLower() == "admin")
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
                    where.Add(new List<object>(){ "Id", "In", ids });// || d.UserId == param._CurrentSysUser.Id
                }
            }
            var selectFields = new List<string>() {
                // "Id", "Name", "Icon", "IconClass", "Display", "AppDisplay", "IsMicroiService",
                // "OpenType", "ComponentName", "ComponentPath", "PageTemplate", "Url",
                // "DiyTableId", "ParentId", "Sort",
            };
            if(param._SelectFields != null && param._SelectFields.Any())
            {
                selectFields = param._SelectFields;
            }
            var allResult = await MicroiEngine.FormEngine.GetTableDataAsync("sys_menu", new
            {
                _SelectFields = selectFields,
                _Where = where,
                _OrderBy = "Sort",
                _OrderByType = "ASC",
                OsClient = param.OsClient,
                _Lang = param._Lang,
                _CurrentUser = param._CurrentUser,
                // Menu discovery already applies sys_rolelimit filtering above. Mark this
                // internal materialization as Server so the generic FormEngine client
                // boundary can keep raw sys_menu access admin-only.
                _InvokeType = "Server",
            });
            var allData = allResult.Data as List<dynamic> ?? new List<dynamic>();

            // 兼容旧版 Vue2 定制页面菜单：微服务发布时可在 RouteMetaJson 中声明
            // LegacyMenuUrls / LegacyComponentPaths。这里仅对接口返回值做瞬时映射，
            // 不修改客户库 sys_menu，因而同一套新版服务可以直接承接多个老库。
            await ApplyLegacyMicroServiceAliases(param.OsClient, allData);

            // 按ParentId构建字典索引，将递归子节点查找从O(n²)优化为O(n)
            var childrenMap = new Dictionary<string, List<dynamic>>();
            foreach (var item in allData)
            {
                string parentId = item.ParentId?.ToString() ?? "";
                if (!childrenMap.ContainsKey(parentId))
                {
                    childrenMap[parentId] = new List<dynamic>();
                }
                childrenMap[parentId].Add(item);
            }

            // 获取第一级菜单
            var firstList = new List<dynamic>();
            if (!param._ChildSystemId.DosIsNullOrWhiteSpace())
            {
                if (childrenMap.TryGetValue(param._ChildSystemId, out var childItems))
                {
                    firstList.AddRange(childItems);
                }
            }
            else
            {
                var rootKeys = new HashSet<string> { Guid.Empty.ToString(), "", DiyCommon.UlidEmpty };
                foreach (var kvp in childrenMap)
                {
                    if (rootKeys.Contains(kvp.Key))
                    {
                        firstList.AddRange(kvp.Value);
                    }
                }
                // 根级菜单可能来自多个"空父级"bucket，合并后需重新按 Sort 排序
                if (firstList.Count > 0)
                {
                    firstList = firstList.OrderBy(d => (object)d.Sort).ToList();
                }
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
            //递归获取层级（使用字典索引优化）
            BuildChildrenFromMap(childrenMap, firstList);
            return new DosResultList<dynamic>(1, firstList, "", dataCount);
        }

        private async Task ApplyLegacyMicroServiceAliases(string osClient, List<dynamic> menus)
        {
            if (menus == null || menus.Count == 0) return;

            try
            {
                var serviceResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_microiservice", new
                {
                    OsClient = osClient,
                    _PageSize = 1000
                });
                var pageResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_microiservice_page", new
                {
                    OsClient = osClient,
                    _PageSize = 5000
                });
                if (serviceResult.Code != 1 || pageResult.Code != 1) return;

                var services = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
                foreach (var rawService in serviceResult.Data as List<dynamic> ?? new List<dynamic>())
                {
                    JObject service = ToJObject((object)rawService);
                    var serviceId = service?["Id"]?.ToString() ?? "";
                    if (service != null && IsEnabled(service["IsEnable"]) && !serviceId.DosIsNullOrWhiteSpace())
                    {
                        services[serviceId] = service;
                    }
                }
                if (services.Count == 0) return;

                var aliases = new Dictionary<string, LegacyMicroServicePage>(StringComparer.OrdinalIgnoreCase);
                foreach (var rawPage in pageResult.Data as List<dynamic> ?? new List<dynamic>())
                {
                    JObject page = ToJObject((object)rawPage);
                    if (page == null || !IsEnabled(page["IsEnable"])) continue;

                    var serviceId = page["MicroServiceId"]?.ToString() ?? "";
                    if (!services.TryGetValue(serviceId, out var service)) continue;

                    var meta = ParseRouteMeta(page["RouteMetaJson"]);
                    var target = new LegacyMicroServicePage
                    {
                        ServiceId = serviceId,
                        ServiceKey = FirstNotEmpty(page["MicroServiceKey"]?.ToString(), service["MsKey"]?.ToString()),
                        PageId = page["Id"]?.ToString() ?? "",
                        RoutePath = FirstNotEmpty(page["RoutePath"]?.ToString(), meta?["RoutePath"]?.ToString(), "/")
                    };
                    if (target.ServiceKey.DosIsNullOrWhiteSpace()) continue;

                    AddLegacyAliases(aliases, target, "url", meta?["LegacyMenuUrls"]);
                    AddLegacyAliases(aliases, target, "url", meta?["LegacyMenuUrl"]);
                    AddLegacyAliases(aliases, target, "component", meta?["LegacyComponentPaths"]);
                    AddLegacyAliases(aliases, target, "component", meta?["LegacyComponentPath"]);
                }
                if (aliases.Count == 0) return;

                for (var i = 0; i < menus.Count; i++)
                {
                    JObject menu = ToJObject((object)menus[i]);
                    if (menu == null || IsMicroServiceMenu(menu)) continue;

                    var urlKey = BuildLegacyAliasKey("url", menu["Url"]?.ToString());
                    var componentKey = BuildLegacyAliasKey("component", menu["ComponentPath"]?.ToString());
                    LegacyMicroServicePage target = null;
                    if (!urlKey.DosIsNullOrWhiteSpace()) aliases.TryGetValue(urlKey, out target);
                    if (target == null && !componentKey.DosIsNullOrWhiteSpace()) aliases.TryGetValue(componentKey, out target);
                    if (target == null) continue;

                    menu["LegacyMenuUrl"] = menu["Url"]?.ToString() ?? "";
                    menu["LegacyComponentPath"] = menu["ComponentPath"]?.ToString() ?? "";
                    menu["OpenType"] = "MicroService";
                    menu["IsMicroiService"] = 1;
                    menu["ComponentPath"] = "/micro-app/host";
                    menu["MicroServiceId"] = target.ServiceId;
                    menu["MicroServiceKey"] = target.ServiceKey;
                    menu["MsKey"] = target.ServiceKey;
                    menu["MicroServicePageId"] = target.PageId;
                    menu["MicroServiceRoutePath"] = NormalizeMicroServiceRoute(target.RoutePath);
                    menus[i] = menu;
                }
            }
            catch
            {
                // 尚未安装微服务相关表的老库仍按原菜单逻辑启动；安装应用后自动获得兼容能力。
            }
        }

        private static JObject ToJObject(object value)
        {
            if (value == null) return null;
            if (value is JObject jObject) return jObject;
            try { return JObject.FromObject(value); } catch { return null; }
        }

        private static JObject ParseRouteMeta(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return new JObject();
            if (value is JObject jObject) return jObject;
            try { return JObject.Parse(value.ToString()); } catch { return new JObject(); }
        }

        private static bool IsEnabled(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return true;
            var text = value.ToString().Trim();
            return text != "0" && !text.Equals("false", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsMicroServiceMenu(JObject menu)
        {
            var openType = menu["OpenType"]?.ToString() ?? "";
            var flag = menu["IsMicroiService"]?.ToString() ?? "";
            return openType.IndexOf("micro", StringComparison.OrdinalIgnoreCase) >= 0
                || flag == "1"
                || flag.Equals("true", StringComparison.OrdinalIgnoreCase)
                || (menu["ComponentPath"]?.ToString() ?? "").IndexOf("/micro-app/host", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string FirstNotEmpty(params string[] values)
        {
            return values?.FirstOrDefault(value => !value.DosIsNullOrWhiteSpace()) ?? "";
        }

        private static string NormalizeMicroServiceRoute(string value)
        {
            var route = (value ?? "/").Trim();
            if (route.DosIsNullOrWhiteSpace() || route == "/") return "/";
            return route.StartsWith("/") ? route : "/" + route;
        }

        private static void AddLegacyAliases(Dictionary<string, LegacyMicroServicePage> aliases, LegacyMicroServicePage target, string type, JToken values)
        {
            if (values == null || values.Type == JTokenType.Null) return;
            IEnumerable<JToken> list;
            if (values.Type == JTokenType.Array)
            {
                list = values.Children();
            }
            else
            {
                list = new JToken[] { values };
            }
            foreach (var value in list)
            {
                var key = BuildLegacyAliasKey(type, value?.ToString());
                if (!key.DosIsNullOrWhiteSpace()) aliases[key] = target;
            }
        }

        private static string BuildLegacyAliasKey(string type, string value)
        {
            if (value.DosIsNullOrWhiteSpace()) return "";
            var normalized = value.Trim().Replace('\\', '/');
            var queryIndex = normalized.IndexOfAny(new[] { '?', '#' });
            if (queryIndex >= 0) normalized = normalized.Substring(0, queryIndex);
            while (normalized.Contains("//")) normalized = normalized.Replace("//", "/");
            if (!normalized.StartsWith("/")) normalized = "/" + normalized;
            if (type == "component" && normalized.StartsWith("/views/", StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized.Substring("/views".Length);
            }
            if (normalized.EndsWith(".vue", StringComparison.OrdinalIgnoreCase)) normalized = normalized.Substring(0, normalized.Length - 4);
            if (normalized.Length > 1) normalized = normalized.TrimEnd('/');
            return type + ":" + normalized.ToLowerInvariant();
        }

        private sealed class LegacyMicroServicePage
        {
            public string ServiceId { get; set; }
            public string ServiceKey { get; set; }
            public string PageId { get; set; }
            public string RoutePath { get; set; }
        }
        /// <summary>
        /// 递归获取层级（基于字典索引，O(n)复杂度）
        /// </summary>
        private void BuildChildrenFromMap(Dictionary<string, List<dynamic>> childrenMap, List<dynamic> list)
        {
            foreach (var item in list)
            {
                string id = item.Id?.ToString();
                if (id != null && childrenMap.TryGetValue(id, out var children))
                {
                    BuildChildrenFromMap(childrenMap, children);
                    if (item is JObject jObject)
                    {
                        jObject["_Child"] = ToMenuChildArray(children);
                    }
                    else
                    {
                        item._Child = children;
                    }
                }
            }
        }

        private JArray ToMenuChildArray(List<dynamic> children)
        {
            var result = new JArray();
            foreach (var child in children)
            {
                if (child is JToken token)
                {
                    result.Add(token.DeepClone());
                }
                else
                {
                    result.Add(JToken.FromObject(child));
                }
            }
            return result;
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
            if (modelResult.Code != 1 || modelResult.Data == null)
            {
                return new DosResult(modelResult.Code, null, modelResult.Msg);
            }
            var model = modelResult.Data;
            var oldMenuCache = await MicroiEngine.FormEngine.GetSysMenu(
                param.Id,
                param.OsClient,
                param._Lang);
            var oldModuleEngineKey = oldMenuCache?.Code == 1 && oldMenuCache.Data != null
                ? JObject.FromObject(oldMenuCache.Data)["ModuleEngineKey"].Val<string>()
                : null;

            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;


            #region  通用修改
            // 必须合并到数据库旧实体。若重新 new SysMenu，未传的 int? 参数会落成实体 int 的默认值 0，
            // 只改排序/父级时也会把 AppDisplay、Display 等客户配置意外清零。
            model = MapperHelper.MapNotNull<object, SysMenu>(param, model);
            #endregion end

            var count = dbSession.Update(model, d => d.Id == param.Id);
            if (model.ParentId != null)
            {
                //SysMenuCache.DelSysMenuList(model.ParentId, param.OsClient);
            }
            //SysMenuCache.DelSysMenuModel(model, param.OsClient);
            if (count > 0)
            {
                await FormEngineAuthorizationCache.InvalidateMenuAsync(
                    param.OsClient,
                    model.Id,
                    oldModuleEngineKey,
                    param.ModuleEngineKey);
            }
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
                param.OsClient = DiyToken.GetCurrentOsClient();
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            try
            {
                DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;

                if (dbSession != null)
                {
                    if (!param.Url.DosIsNullOrWhiteSpace()
                        && dbSession.From<SysMenu>().Where(d => d.Url == param.Url && d.IsDeleted != 1).First() != null)
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
                    model.AppDisplay = param.AppDisplay ?? 1;
                    model.Code = "Code" + DateTime.Now.ToString("yyyyMMddHHmmss");
                    var count = dbSession.Insert(model);
                    if (model.ParentId != null)
                    {
                        //SysMenuCache.DelSysMenuList(model.ParentId, param.OsClient);
                    }
                    if (count > 0)
                    {
                        await FormEngineAuthorizationCache.InvalidateMenuAsync(
                            param.OsClient,
                            model.Id,
                            param.ModuleEngineKey);
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
                param.OsClient = DiyToken.GetCurrentOsClient();
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
            DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
            if (param.Ids != null)
            {
                var list = dbSession.From<SysMenu>().Where(d => d.Id.In(param.Ids)).ToList();
                var menuCacheKeys = new List<string>();
                foreach (var baseData in list)
                {
                    //SysMenuCache.DelSysMenuModel(baseData, param.OsClient);
                    menuCacheKeys.Add(baseData.Id);
                    var cachedMenu = await MicroiEngine.FormEngine.GetSysMenu(
                        baseData.Id,
                        param.OsClient,
                        param._Lang);
                    if (cachedMenu?.Code == 1 && cachedMenu.Data != null)
                    {
                        menuCacheKeys.Add(
                            JObject.FromObject(cachedMenu.Data)["ModuleEngineKey"].Val<string>());
                    }
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
                if (count > 0)
                {
                    await FormEngineAuthorizationCache.InvalidateMenuAsync(
                        param.OsClient,
                        menuCacheKeys.ToArray());
                }
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
                var cachedMenu = await MicroiEngine.FormEngine.GetSysMenu(
                    model.Id,
                    param.OsClient,
                    param._Lang);
                var moduleEngineKey = cachedMenu?.Code == 1 && cachedMenu.Data != null
                    ? JObject.FromObject(cachedMenu.Data)["ModuleEngineKey"].Val<string>()
                    : null;
                if (dbSession.From<SysMenu>().Where(d => d.ParentId == model.Id && d.IsDeleted != 1).First() != null)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ExistChildData", param._Lang));
                }
                if (param._CurrentUser?["Account"]?.ToString()?.ToLower() != "admin" && model.UserId != param._CurrentUser?["Id"]?.ToString())
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
                if (count > 0)
                {
                    await FormEngineAuthorizationCache.InvalidateMenuAsync(
                        param.OsClient,
                        model.Id,
                        moduleEngineKey);
                }
                return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.GetLang(param.OsClient, "Line0", param._Lang));
            }
        }
    }
}
