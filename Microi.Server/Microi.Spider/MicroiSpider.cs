using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;
using PuppeteerSharp;
using SkiaSharp;


namespace Microi.net
{

    public class MicroiSpider : IMicroiSpider
    {
        private static IBrowser _browser = null;
        private static IPage _page = null;
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult> GetRenderHtml(MicroiSpiderParam param)
        {
            if (param.Url.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "param error.");
            }
            try
            {
                JObject dataAppend = new JObject();

                //var revisionInfo = new BrowserFetcherOptions
                //{
                //    //Path = chromiumPath,
                //    Platform = Platform.Win64, // 指定平台为 Windows 64 位
                //    Browser = 
                //    Revision = "119.0.6045.105" // 指定要下载的 Chromium 版本号
                //};

                await new BrowserFetcher().DownloadAsync();

                var launchOptions = new LaunchOptions
                {
                    Headless = param.Headless ?? true, // 设置为 true 以在无头模式下运行浏览器
                    //ExecutablePath = "/app/Chrome/Linux-119.0.6045.105/chrome-linux64/chrome"
                    Args = new[] { "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage" }
                };
                if (!param.ExecutablePath.DosIsNullOrWhiteSpace())
                {
                    launchOptions.ExecutablePath = param.ExecutablePath;
                }

                IBrowser browser = null;
                if (param.IsCloseBrowser == false)
                {
                    if (_browser == null)
                    {
                        _browser = await Puppeteer.LaunchAsync(launchOptions);
                    }
                    browser = _browser;
                }
                else
                {
                    browser = await Puppeteer.LaunchAsync(launchOptions);
                }

                IPage page = null;
                if (param.IsClosePage == false)
                {
                    if (_page == null)
                    {
                        _page = await browser.NewPageAsync();
                    }
                    page = _page;
                }
                else
                {
                    page = await browser.NewPageAsync();
                }

                // 创建新的浏览器上下文
                //var context = await browser.CreateIncognitoBrowserContextAsync();
                try
                {
                    // 使用新的浏览器上下文打开新的页面
                    //using (var page = await context.NewPageAsync())
                    {
                        if (param.VirtualWindows == true)
                        {
                            await page.SetUserAgentAsync("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36");
                            await page.SetViewportAsync(new ViewPortOptions { Width = 1366, Height = 768 });
                        }

                        var responseUrlResult = new JObject();

                        #region 方式3：这种方式在本地会出现 请求卡住在 【 await page.GoToAsync(url】 这一步，ResponseHandler内部也会执行，执行完后就卡住了。
                        ////即使使用 async void ResponseHandler 本地也会导致卡住
                        ////创建一个 TaskCompletionSource，用于等待委托完成
                        //var responseCompletionSource = new TaskCompletionSource<JObject>();
                        ////定义 Response 事件处理程序
                        //async void ResponseHandler(object sender, ResponseCreatedEventArgs e)
                        //{
                        //    var response = e.Response;

                        //    // 判断响应的 URL 是否是目标接口
                        //    if (!param.ResponseUrlStart.DosIsNullOrWhiteSpace() && response.Url.StartsWith(param.ResponseUrlStart))
                        //    {
                        //        // 获取响应的内容
                        //        //var content = response.TextAsync().GetAwaiter().GetResult();//.Result; 
                        //        var content = await response.TextAsync();
                        //        responseUrlResult = JObject.Parse(content);
                        //        responseCompletionSource.SetResult(responseUrlResult);
                        //    }
                        //    if (param.ResponseUrlsStart != null && param.ResponseUrlsStart.Any())
                        //    {
                        //        foreach (var responseUrlStart in param.ResponseUrlsStart)
                        //        {
                        //            if (response.Url.StartsWith(responseUrlStart))
                        //            {
                        //                // 获取响应的内容
                        //                //var content = response.TextAsync().GetAwaiter().GetResult();//.Result;
                        //                var content = await response.TextAsync();
                        //                responseUrlResult.Add(responseUrlStart, JObject.Parse(content));
                        //            }
                        //        }
                        //        responseCompletionSource.SetResult(responseUrlResult);
                        //    }
                        //}
                        #endregion

                        #region 方式2：这种方式本地不会卡住，但服务器端会卡住。但有个问题是它并不是同步的？
                        //page.Response += async (sender, e) => //async 
                        //{
                        //    var response = e.Response;

                        //    // 判断响应的 URL 是否是目标接口
                        //    if (!param.ResponseUrlStart.DosIsNullOrWhiteSpace() && response.Url.StartsWith(param.ResponseUrlStart))
                        //    {
                        //        // 获取响应的内容
                        //        var content = await response.TextAsync();//await   这里使用.Result了会导致本地卡住
                        //        responseUrlResult = JObject.Parse(content);
                        //    }
                        //    if (param.ResponseUrlsStart != null && param.ResponseUrlsStart.Any())
                        //    {
                        //        foreach (var responseUrlStart in param.ResponseUrlsStart)
                        //        {
                        //            if (response.Url.StartsWith(responseUrlStart))
                        //            {
                        //                // 获取响应的内容
                        //                var content = await response.TextAsync();//  这里使用.Result了会导致本地卡住
                        //                responseUrlResult.Add(responseUrlStart, JObject.Parse(content));
                        //            }
                        //        }
                        //    }
                        //};
                        #endregion

                        #region 方式3：方式3才用到的代码
                        // 注册 Response 事件处理程序
                        //page.Response += ResponseHandler;
                        #endregion

                        string url = param.Url;

                        // 等待页面加载完成
                        //如果你需要确保页面的所有资源都加载完成，Networkidle0 可能是更好的选择。
                        //但是，如果页面有一些长时间运行的网络请求或者周期性的网络请求（例如长轮询或心跳），
                        //Networkidle0 可能会导致页面永远无法加载完成。
                        //在这种情况下，Networkidle2 可能是更好的选择。

                        //await page.GoToAsync(url, WaitUntilNavigation.Networkidle0); //会提示验证码
                        await page.GoToAsync(url, WaitUntilNavigation.Networkidle2); //会提示验证码
                        //await page.GoToAsync(url); // 会报错：Execution context was destroyed, most likely because of a navigation.
                        //await page.GoToAsync(url, WaitUntilNavigation.DOMContentLoaded);// 会报错：Execution context was destroyed, most likely because of a navigation.

                        #region 方式3：方式3才用到的代码
                        //await page.WaitForNavigationAsync();//这步如果用在方式2上，也会导致本地卡住
                        //// 等待委托完成并获取结果
                        //responseUrlResult = await responseCompletionSource.Task;
                        //// 取消注册 Response 事件处理程序
                        //page.Response -= ResponseHandler;
                        #endregion


                        dataAppend.Add("page", page.Url);

                        #region 方式1
                        if (!param.Selector.DosIsNullOrWhiteSpace() && !param.Script.DosIsNullOrWhiteSpace())
                        {
                            // 获取页面中的图像元素
                            var imageElements = await page.QuerySelectorAllAsync(param.Selector);
                            var tempResult = new List<string>();
                            foreach (var imageElement in imageElements)
                            {
                                // 获取图像的 src 属性
                                var imageUrl = await imageElement.EvaluateFunctionAsync<string>(param.Script);
                                tempResult.Add(imageUrl);
                            }
                            // 关闭页面和浏览器上下文
                            //await context.CloseAsync();
                            if (param.IsCloseBrowser != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                browser.CloseAsync();
                                browser.Dispose();
                                _browser = null;
                                _page = null;
                            }
                            else if (param.IsClosePage != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                _page = null;
                            }
                            return new DosResult(1, tempResult, "", tempResult.Count, dataAppend);
                        }
                        #endregion

                        #region 方式1 list
                        if (param.Selectors != null && param.Selectors.Any())
                        {
                            var tempResultObj = new JObject();
                            foreach (var item in param.Selectors)
                            {
                                var selector = item.Selector;
                                var script = item.Script;
                                // 获取页面中的图像元素
                                var imageElements = await page.QuerySelectorAllAsync(selector);
                                var tempResult = new JArray();
                                foreach (var imageElement in imageElements)
                                {
                                    // 获取图像的 src 属性
                                    var imageUrl = await imageElement.EvaluateFunctionAsync<string>(script);
                                    tempResult.Add(imageUrl);
                                }
                                tempResultObj.Add(item.Key, tempResult);
                            }
                            // 关闭页面和浏览器上下文
                            //await context.CloseAsync();
                            if (param.IsCloseBrowser != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                browser.CloseAsync();
                                browser.Dispose();
                                _browser = null;
                                _page = null;
                            }
                            else if (param.IsClosePage != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                _page = null;
                            }
                            return new DosResult(1, tempResultObj, "", -1, dataAppend);

                        }
                        #endregion

                        if (!param.ResponseUrlStart.DosIsNullOrWhiteSpace())
                        {
                            // 关闭页面和浏览器上下文
                            //await context.CloseAsync();
                            if (param.IsCloseBrowser != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                browser.CloseAsync();
                                browser.Dispose();
                                _browser = null;
                                _page = null;
                            }
                            else if (param.IsClosePage != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                _page = null;
                            }
                            return new DosResult(1, responseUrlResult, "", -1, dataAppend);//方式2 + 3
                        }
                        if (param.ResponseUrlsStart != null && param.ResponseUrlsStart.Any())
                        {
                            // 关闭页面和浏览器上下文
                            //await context.CloseAsync();
                            if (param.IsCloseBrowser != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                browser.CloseAsync();
                                browser.Dispose();
                                _browser = null;
                                _page = null;
                            }
                            else if (param.IsClosePage != false)
                            {
                                page.CloseAsync();
                                page.DisposeAsync();
                                _page = null;
                            }
                            return new DosResult(1, responseUrlResult, "", -1, dataAppend);//方式2 + 3
                        }
                        if (param.IsCloseBrowser != false)
                        {
                            page.CloseAsync();
                            page.DisposeAsync();
                            browser.CloseAsync();
                            browser.Dispose();
                            _browser = null;
                            _page = null;
                        }
                        else if (param.IsClosePage != false)
                        {
                            page.CloseAsync();
                            page.DisposeAsync();
                            _page = null;
                        }
                        return new DosResult(0, null, "参数错误 ！");
                    }
                }
                catch (Exception ex)
                {
                    if (param.IsCloseBrowser != false)
                    {
                        page.CloseAsync();
                        page.DisposeAsync();
                        browser.CloseAsync();
                        browser.Dispose();
                        _browser = null;
                        _page = null;
                    }
                    else if (param.IsClosePage != false)
                    {
                        page.CloseAsync();
                        page.DisposeAsync();
                        _page = null;
                    }
                    return new DosResult(0, null, ex.Message);
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }

        }

    }
}