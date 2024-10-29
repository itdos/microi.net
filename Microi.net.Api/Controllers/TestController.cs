using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.Diagnostics;
using System.Text;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// DIY框架一些通用接口
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class TestController : Controller
    {
        private static FormEngine _formEngine = new FormEngine();
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task Test()
        {
            //测试sql语句
            //var osClientModel = OsClient.GetClient("zongxungz");
            //var sql = @"SELECT *,(DATE_ADD(STR_TO_DATE(GoumaiRQ,'%Y-%m-%d'),
            //            INTERVAL (YubaoFNX) YEAR)) YubaoFRQ
            //            FROM diy_zichangl
            //            WHERE IsDeleted=0
            //            and DATE_ADD(STR_TO_DATE(GoumaiRQ,'%Y-%m-%d'),INTERVAL (YubaoFNX-1) YEAR)<curdate() ;";
            //var result1 = osClientModel.Db.FromSql(sql).ToDataTable();
            //var result2 = osClientModel.Db.FromSql(sql).ToList<dynamic>();

            //测试分布式锁性能
            //var abc = 0;
            //var resultHtml = "";
            //Stopwatch timerOutSide = new Stopwatch();
            //timerOutSide.Start();
            //var result = Parallel.For(0, 10, i =>
            //{
            //    Stopwatch timer = new Stopwatch();
            //    timer.Start();
            //    var result = DiyLock.ActionLock("LockKey_DiySchool", "锁的值，随意传", TimeSpan.FromSeconds(5), () =>
            //    {
            //        //var db = OsClient.GetClient("iTdos").DbRead;
            //        //var list = db.FromSql("Select * from `Sys_User`").ToList<dynamic>();
            //        abc++;
            //    }).Result;
            //    timer.Stop();
            //    resultHtml += "<br>线程" + i + "执行时间：" + timer.ElapsedMilliseconds.ToString()
            //                + "ms。结果：Code-" + result.Code + "。msg：" + result.Msg;
            //});
            //resultHtml += "<br>线程成功次数:" + abc.ToString();
            //timerOutSide.Stop();
            //resultHtml += "<br>总耗时：" + timerOutSide.ElapsedMilliseconds.ToString() + "ms";

            //Response.ContentType = "text/html; charset=utf-8";
            //var data = Encoding.UTF8.GetBytes(resultHtml);
            //await Response.Body.WriteAsync(data, 0, data.Length);
        }
    }
}
