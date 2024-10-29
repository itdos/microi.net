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


    public partial class SysRoleLimitLogic
    {
        public async Task<List<SysRoleLimit>> GetSysRoleLimit(SysRoleLimitParam param, DbSession dbSessionParam = null)
        {
            var msg = "";
            var where = new Where<SysRoleLimit>();
            var whereSql = " where 1=1 ";
            if (param.RoleId != null)
            {
                where.And(d => d.RoleId == param.RoleId);
                whereSql += $" and A.RoleId = '{param.RoleId}' ";
            }
            if (param.RoleIds != null)
            {
                var inSql = "";
                if (param.RoleIds.Any())
                {
                    foreach (var item in param.RoleIds)
                    {
                        inSql += $"'{item}',";
                    }
                    inSql = inSql.DosTrimEnd(',');
                }
                where.And(d => d.RoleId.In(param.RoleIds));
                whereSql += " and A.RoleId in (" + (inSql.DosIsNullOrWhiteSpace() ? "''" : inSql) + ") ";
            }
            if (!param.Type.DosIsNullOrWhiteSpace())
            {
                where.And(d => d.Type == param.Type);
                whereSql += $" and A.Type = '{param.Type}' ";
            }
            var clientModel = OsClient.GetClient(param.OsClient);
            DbSession dbSession = clientModel.DbRead;
            var dbInfo = DiyCommon.GetDbInfo(clientModel.DbType);

            var tDbSession = dbSessionParam == null ? dbSession : dbSessionParam;


            var fs = tDbSession.From<SysRoleLimit>()
                        //.Select<SysGroup, SysRole, SysDept, SysPost>((a, b, c, d, e) => new
                        //{
                        //    a.All,
                        //    GroupName = b.Name,
                        //    RoleName = c.Name,
                        //    DeptName = d.Name,
                        //    PostName = e.Name
                        //})
                        //.LeftJoin<SysGroup>((a,b)=>a.FkId == b.Id)
                        //.LeftJoin<SysRole>((a,b)=>a.FkId == b.Id)
                        //.LeftJoin<SysDept>((a,b)=>a.FkId == b.Id)
                        //.LeftJoin<SysPost>((a,b)=>a.FkId == b.Id)

                        //2023-03-10，返回菜单名称
                        .Select<SysMenu>((a,b)=> new {
                            a.All,
                            FkName = b.Name,
                        })
                        .LeftJoin<SysMenu>((a,b) => a.FkId == b.Id)
                        .Where(where);
            //dataCount = SysRoleLimitRepository.Count(where);
            //var dataCount = fs.Count();
            //var list = SysRoleLimitRepository.Query(where, d => d.CreateTime, "desc", null, param._PageSize, param._PageIndex);
            //var list = fs.ToList();

            var sysRoleLimitTableName = dbInfo.DbService.GetTableName("Sys_RoleLimit", clientModel.DbOracleTableSpace);
            var sysMenuTableName = dbInfo.DbService.GetTableName("Sys_Menu", clientModel.DbOracleTableSpace);

            var sql = "select A.Id AS \"Id\","
                                            + "A.RoleId AS \"RoleId\","
                                            + "A.FkId AS \"FkId\","
                                            + "A.Type AS \"Type\","
                                            + "A.CreateTime AS \"CreateTime\","
                                            + "A.Customer AS \"Customer\","
                                            + "A.Permission AS \"Permission\","
                                            + "B.Name AS \"FkName\""
                                            + $" from {sysRoleLimitTableName} A left join {sysMenuTableName} B on A.FkId = B.Id "
                                            + whereSql;
            var list = tDbSession.FromSql(sql)
                                .ToList<SysRoleLimit>();
            return list;
        }
        /// <summary>
        /// 传入Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public SysRoleLimit GetSysRoleLimitModel(SysRoleLimitParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                var msg2 = DiyMessage.Msg["ParamError"][param._Lang]; 
                return null;
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).DbRead;
            var msg = "";
            var where = new Where<SysRoleLimit>();
            where.And(d => d.Id == param.Id);

            //var model = SysRoleLimitRepository.First(where);
            var model = dbSession.From<SysRoleLimit>().Where(where).First();
            if (model == null)
            {
                msg = DiyMessage.Msg["NoAccount"][param._Lang];
                return null;
            }
            return model;
        }
        /// <summary>
        /// 新增
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> AddSysRoleLimit(SysRoleLimitParam param)
        {
            #region Check

            #endregion

            #region  通用新增
            var model = MapperHelper.Map<object, SysRoleLimit>(param);
            model.Id = Guid.NewGuid().ToString();
            #endregion end
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;


            model.CreateTime = DateTime.Now;
            //var count = SysRoleLimitRepository.Insert(model);
            var count = dbSession.Insert(model);
            return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.Msg["Line0"][param._Lang]);
        }
        /// <summary>
        /// 修改用户。必传：Id或Account
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptSysRoleLimit(SysRoleLimitParam param)
        {
            #region Check
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.Msg["ParamError"][param._Lang]);
            }
            #endregion
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            //var model = SysRoleLimitRepository.First(d => d.Id == param.Id);
            var model = dbSession.From<SysRoleLimit>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.Msg["NoAccount"][param._Lang]);
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
            //model = JsonConvert.DeserializeObject<SysRoleLimit>(JsonConvert.SerializeObject(modelJson));
            model = MapperHelper.MapNotNull<object, SysRoleLimit>(param);
            #endregion end

            //var count = SysRoleLimitRepository.Update(model);
            var count = dbSession.Update(model);
            return new DosResult(1);
        }
        /// <summary>
        /// 删除菜单，必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> DelSysRoleLimit(SysRoleLimitParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.Msg["ParamError"][param._Lang]);
            }
            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            //var model = SysRoleLimitRepository.First(d => d.Id == param.Id);
            var model = dbSession.From<SysRoleLimit>().Where(d => d.Id == param.Id).First();
            if (model == null)
            {
                return new DosResult(0, null, DiyMessage.Msg["NoExistData"][param._Lang] + " Id:" + param.Id);
            }
            //var count = SysRoleLimitRepository.Delete(param.Id);
            var count = dbSession.Delete<SysRole>(param.Id);
            return new DosResult(count > 0 ? 1 : 0, count, count > 0 ? "" : DiyMessage.Msg["Line0"][param._Lang]);
        }



        /// <summary>
        /// 必传RoleId，Type，FkIds
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> UptSysUserAllFk(SysRoleLimitParam param)
        {
            #region Check
            if (param.RoleId == null || param.Type.DosIsNullOrWhiteSpace() || param.FkIds == null || !param.FkIds.Any())
            {
                return new DosResult(0, null, DiyMessage.Msg["ParamError"][param._Lang]);
            }
            #endregion

            DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            using (var trans = dbSession.BeginTransaction())
            {
                //var delList = SysRoleLimitRepository.Query(d => d.RoleId == param.RoleId && d.Type == param.Type);
                var delList = dbSession.From<SysRoleLimit>()
                                        .Where(d => d.RoleId == param.RoleId && d.Type == param.Type)
                                        .ToList();
                trans.Delete(delList);
                var addList = new List<SysRoleLimit>();
                foreach (var guid in param.FkIds)
                {
                    addList.Add(new SysRoleLimit()
                    {
                        Id = Guid.NewGuid().ToString(),
                        RoleId = param.RoleId,
                        FkId = guid,
                        CreateTime = DateTime.Now,
                        Type = param.Type
                    });
                }
                trans.Insert(addList);
                trans.Commit();
            }
            return new DosResult(1);
        }
    }
}
