#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 此类暂不使用。
    /// </summary>
    public class DiyTableCache
    {
        //private static MicroiCache _microiCache = new MicroiCache("", "", "", "" , 5);
        //public static async Task<DataTable> GetDiyTableRow(string tableName, string osClient)
        //{
        //    var result = await _microiCache.GetAsync<DataTable>("GetDiyTableRow:" + osClient + ":" + tableName);
        //    return result;
        //}
        //public static async Task<DataTable> GetDiyTableRow(string tableName, string cacheParentKey, string osClient)
        //{
        //    var result = await _microiCache.GetAsync<DataTable>("GetDiyTableRow:" + osClient + ":" + tableName + ":" + cacheParentKey);
        //    return result;
        //}

        //public static async Task<bool> SetDiyTableRow(string tableName, DataTable list, string osClient)
        //{
        //    var result = await _microiCache.SetAsync<DataTable>("GetDiyTableRow:" + osClient + ":" + tableName, list);
        //    return result;
        //}
        //public static async Task<bool> SetDiyTableRow(string tableName, string cacheParentKey, DataTable list, string osClient)
        //{
        //    var result = await _microiCache.SetAsync<DataTable>("GetDiyTableRow:" + osClient + ":" + tableName + ":" + cacheParentKey, list);
        //    return result;
        //}

        //public static async Task<bool> DelDiyTableRow(string tableName, string osClient)
        //{
        //    _microiCache.DeleteParentAsync("GetDiyTableRow:" + osClient + ":" + tableName + ":*");
        //    var result = await _microiCache.DeleteParentAsync("GetDiyTableRow:" + osClient + ":" + tableName);
        //    return true;
        //}
        //public static async Task<bool> DelDiyTableRow(string tableName, string cacheParentKey, string osClient)
        //{
        //    return await _microiCache.DeleteAsync("GetDiyTableRow:" + osClient + ":" + tableName + ":" + cacheParentKey);
        //}



        //public static async Task<DiyTable> GetDiyTableModel(Guid id, string osClient)
        //{
        //    return await _microiCache.GetAsync<DiyTable>("DiyTableModel:" + osClient + ":" + id.ToString());
        //}
        //public static async Task<DiyTable> GetDiyTableModel(string name, string osClient)
        //{
        //    return await _microiCache.GetAsync<DiyTable>("DiyTableModel:" + osClient + ":" + name);
        //}

        //public static async Task<bool> SetDiyTableModel(DiyTable model, string osClient)
        //{
        //    _microiCache.SetAsync("DiyTableModel:" + osClient + ":" + model.Id.ToString(), model);//, TimeSpan.FromHours(double.Parse(OsClient.GetClient(osClient).RedisTimeout))
        //    return await _microiCache.SetAsync("DiyTableModel:" + osClient + ":" + model.Name, model);//, TimeSpan.FromHours(double.Parse(OsClient.GetClient(osClient).RedisTimeout))
        //}
        //public static async Task<bool> DelDiyTableModel(DiyTable model, string osClient)
        //{
        //    _microiCache.DeleteAsync("DiyTableModel:" + osClient + ":" + model.Id.ToString());
        //    return await _microiCache.DeleteAsync("DiyTableModel:" + osClient + ":" + model.Name);
        //}
    }
}
