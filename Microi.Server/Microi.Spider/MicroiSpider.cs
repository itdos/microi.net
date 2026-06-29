using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Sockets;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PuppeteerSharp;
using SkiaSharp;


namespace Microi.net
{

    public class MicroiSpider : IMicroiSpider
    {
        private static IBrowser _browser = null;
        private static IPage _page = null;
        private static readonly ConcurrentDictionary<string, SpiderSession> _sessions = new ConcurrentDictionary<string, SpiderSession>(StringComparer.OrdinalIgnoreCase);
        private static readonly HttpClient DevToolsHttpClient = new HttpClient { Timeout = TimeSpan.FromMilliseconds(1000) };
        private const int DefaultTimeoutMs = 30000;
        private const int DefaultCaptureBodyMaxLength = 200000;

        private sealed class SpiderSession
        {
            public string SessionId { get; set; }
            public string ProfileKey { get; set; }
            public string UserDataDir { get; set; }
            public Process BrowserProcess { get; set; }
            public IBrowser Browser { get; set; }
            public IPage Page { get; set; }
            public JObject Variables { get; set; }
            public JArray CapturedResponses { get; set; }
            public List<string> CaptureStarts { get; set; }
            public int CaptureBodyMaxLength { get; set; }
            public DateTime CreatedAt { get; set; }
            public DateTime LastActiveAt { get; set; }
            public string Status { get; set; }
            public string Msg { get; set; }
            public bool ResponseAttached { get; set; }
            public object SyncRoot { get; private set; }

            public SpiderSession()
            {
                Variables = new JObject();
                CapturedResponses = new JArray();
                CaptureStarts = new List<string>();
                CaptureBodyMaxLength = DefaultCaptureBodyMaxLength;
                CreatedAt = DateTime.Now;
                LastActiveAt = DateTime.Now;
                Status = "Ready";
                SyncRoot = new object();
            }
        }
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
                        await page.GoToAsync(url, BuildNavigationOptions(WaitUntilNavigation.Networkidle2)); //会提示验证码
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

        public async Task<DosResult> OpenSession(MicroiSpiderSessionParam param)
        {
            try
            {
                param = param ?? new MicroiSpiderSessionParam();
                var session = await OpenOrCreateSessionAsync(param);
                if (!string.IsNullOrWhiteSpace(param.Url))
                {
                    await NavigateAsync(session.Page, ReplaceVariables(param.Url, session.Variables), param.WaitUntil, param.TimeoutMs);
                }
                session.Status = "Ready";
                session.Msg = "";
                Touch(session);
                return new DosResult(1, BuildSessionData(session, null, null), "success");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        public Task<DosResult> GetSession(MicroiSpiderSessionParam param)
        {
            try
            {
                param = param ?? new MicroiSpiderSessionParam();
                var sessionKey = ResolveSessionId(param);
                if (string.IsNullOrWhiteSpace(sessionKey) || !_sessions.TryGetValue(sessionKey, out var session))
                {
                    return Task.FromResult(new DosResult(2, null, "session not found."));
                }
                Touch(session);
                return Task.FromResult(new DosResult(1, BuildSessionData(session, null, null), "success"));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult(0, null, ex.Message));
            }
        }

        public async Task<DosResult> CloseSession(MicroiSpiderSessionParam param)
        {
            try
            {
                param = param ?? new MicroiSpiderSessionParam();
                var sessionKey = ResolveSessionId(param);
                if (string.IsNullOrWhiteSpace(sessionKey) || !_sessions.TryRemove(sessionKey, out var session))
                {
                    return new DosResult(2, null, "session not found.");
                }
                await CloseSessionAsync(session);
                return new DosResult(1, BuildSessionData(session, null, null), "success");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        public async Task<DosResult> RunRecipe(MicroiSpiderRecipeParam param)
        {
            if (param == null || param.Steps == null || !param.Steps.Any())
            {
                return new DosResult(0, null, "recipe steps is empty.");
            }

            try
            {
                TraceSpider("RunRecipe: opening session.");
                var session = await OpenOrCreateSessionAsync(param);
                TraceSpider("RunRecipe: session opened. url=" + (session.Page == null ? "" : session.Page.Url));
                MergeVariables(session.Variables, param.Variables);
                MergeCaptureStarts(session, param.CaptureResponseUrlStarts, param.CaptureResponseBodyMaxLength);

                var startIndex = Math.Max(0, param.StartStepIndex ?? 0);
                for (var i = startIndex; i < param.Steps.Count; i++)
                {
                    var step = param.Steps[i];
                    if (step == null)
                    {
                        continue;
                    }

                    var stepType = (step.Type ?? "").Trim().ToLowerInvariant();
                    TraceSpider("RunRecipe: step " + i + " " + stepType + " " + (step.Name ?? ""));
                    MergeCaptureStarts(session, step.ResponseUrlStarts, step.CaptureResponseBodyMaxLength);
                    Touch(session);

                    if (stepType == "open")
                    {
                        if (string.IsNullOrWhiteSpace(step.Url))
                        {
                            return new DosResult(0, BuildSessionData(session, i, i), "open step url is empty.");
                        }
                        await NavigateAsync(session.Page, ReplaceVariables(step.Url, session.Variables), step.WaitUntil ?? param.WaitUntil, step.TimeoutMs ?? param.TimeoutMs);
                        TraceSpider("RunRecipe: open completed. url=" + session.Page.Url);
                    }
                    else if (stepType == "waitforselector")
                    {
                        await WaitForSelectorAsync(session.Page, ReplaceVariables(step.Selector, session.Variables), step.TimeoutMs ?? param.TimeoutMs);
                    }
                    else if (stepType == "manual")
                    {
                        session.Status = "WaitingManual";
                        session.Msg = step.Text ?? step.Name ?? "waiting manual operation.";
                        TraceSpider("RunRecipe: waiting manual. next=" + (i + 1));
                        return new DosResult(1, BuildSessionData(session, i, i + 1), "waiting manual operation.");
                    }
                    else if (stepType == "extract")
                    {
                        var value = await ExtractAsync(session.Page, step, session.Variables);
                        if (!string.IsNullOrWhiteSpace(step.Name))
                        {
                            session.Variables[step.Name] = value ?? "";
                        }
                    }
                    else if (stepType == "fill")
                    {
                        await FillAsync(session.Page, step, session.Variables);
                    }
                    else if (stepType == "click")
                    {
                        await ClickAsync(session.Page, step, session.Variables, param.TimeoutMs);
                    }
                    else if (stepType == "wait")
                    {
                        await Task.Delay(step.TimeoutMs ?? 1000);
                    }
                    else if (stepType == "assert")
                    {
                        var assertResult = AssertVariables(session, step, i);
                        if (assertResult != null)
                        {
                            return assertResult;
                        }
                    }
                    else if (stepType == "snapshot")
                    {
                        await SnapshotAsync(session.Page, step, session.Variables);
                    }
                    else
                    {
                        return new DosResult(0, BuildSessionData(session, i, i), "unsupported recipe step type: " + step.Type);
                    }
                }

                session.Status = "Completed";
                session.Msg = "";
                var resultData = BuildSessionData(session, param.Steps.Count - 1, param.Steps.Count);
                if (param.CloseWhenDone == true)
                {
                    _sessions.TryRemove(session.SessionId, out _);
                    await CloseSessionAsync(session);
                }
                return new DosResult(1, resultData, "success");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        private async Task<SpiderSession> OpenOrCreateSessionAsync(MicroiSpiderSessionParam param)
        {
            param = param ?? new MicroiSpiderSessionParam();
            var sessionId = ResolveSessionId(param);
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                sessionId = Guid.NewGuid().ToString("N");
            }

            if (_sessions.TryGetValue(sessionId, out var existingSession) && existingSession.Browser != null && existingSession.Page != null)
            {
                MergeCaptureStarts(existingSession, param.CaptureResponseUrlStarts, param.CaptureResponseBodyMaxLength);
                Touch(existingSession);
                return existingSession;
            }

            var userDataDir = GetUserDataDir(param, sessionId);
            Directory.CreateDirectory(userDataDir);

            IBrowser browser;
            Process browserProcess = null;
            if (!string.IsNullOrWhiteSpace(param.ExecutablePath))
            {
                var debugPort = GetFreeTcpPort();
                TraceSpider("OpenSession: starting browser on debug port " + debugPort + ".");
                browserProcess = StartBrowserProcess(param.ExecutablePath, userDataDir, debugPort, param.Headless ?? false);
                var browserWSEndpoint = await WaitForDevToolsAsync(debugPort, param.TimeoutMs ?? DefaultTimeoutMs);
                TraceSpider("OpenSession: DevTools ready.");
                browser = await Puppeteer.ConnectAsync(new ConnectOptions
                {
                    BrowserWSEndpoint = browserWSEndpoint,
                    DefaultViewport = null,
                    ProtocolTimeout = param.TimeoutMs ?? DefaultTimeoutMs
                });
                TraceSpider("OpenSession: connected to browser.");
            }
            else
            {
                await new BrowserFetcher().DownloadAsync();
                browser = await Puppeteer.LaunchAsync(new LaunchOptions
                {
                    Headless = param.Headless ?? false,
                    UserDataDir = userDataDir,
                    Timeout = param.TimeoutMs ?? DefaultTimeoutMs,
                    Args = new[] { "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage" }
                });
            }

            var pages = await browser.PagesAsync();
            TraceSpider("OpenSession: pages loaded. count=" + pages.Length);
            var page = pages.FirstOrDefault() ?? await browser.NewPageAsync();
            if (param.VirtualWindows == true)
            {
                await ApplyVirtualWindowsAsync(page);
            }

            var session = new SpiderSession
            {
                SessionId = sessionId,
                ProfileKey = string.IsNullOrWhiteSpace(param.ProfileKey) ? sessionId : param.ProfileKey,
                UserDataDir = userDataDir,
                BrowserProcess = browserProcess,
                Browser = browser,
                Page = page
            };
            MergeCaptureStarts(session, param.CaptureResponseUrlStarts, param.CaptureResponseBodyMaxLength);
            AttachResponseCapture(session);
            _sessions[sessionId] = session;
            return session;
        }

        private static int GetFreeTcpPort()
        {
            var listener = new TcpListener(System.Net.IPAddress.Loopback, 0);
            listener.Start();
            try
            {
                return ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;
            }
            finally
            {
                listener.Stop();
            }
        }

        private static Process StartBrowserProcess(string executablePath, string userDataDir, int debugPort, bool headless)
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = executablePath,
                UseShellExecute = false,
                CreateNoWindow = false
            };
            startInfo.ArgumentList.Add("--remote-debugging-port=" + debugPort);
            startInfo.ArgumentList.Add("--user-data-dir=" + userDataDir);
            startInfo.ArgumentList.Add("--no-first-run");
            startInfo.ArgumentList.Add("--no-default-browser-check");
            startInfo.ArgumentList.Add("--disable-dev-shm-usage");
            startInfo.ArgumentList.Add("--disable-popup-blocking");
            if (headless)
            {
                startInfo.ArgumentList.Add("--headless=new");
            }
            startInfo.ArgumentList.Add("about:blank");

            var process = Process.Start(startInfo);
            if (process == null)
            {
                throw new Exception("failed to start browser process.");
            }
            return process;
        }

        private static async Task<string> WaitForDevToolsAsync(int debugPort, int timeoutMs)
        {
            var deadline = DateTime.Now.AddMilliseconds(Math.Max(timeoutMs, 1000));
            var url = "http://127.0.0.1:" + debugPort + "/json/version";
            Exception lastException = null;
            while (DateTime.Now < deadline)
            {
                try
                {
                    using (var response = await DevToolsHttpClient.GetAsync(url))
                    {
                        if (response.IsSuccessStatusCode)
                        {
                            var content = await response.Content.ReadAsStringAsync();
                            var json = JObject.Parse(content);
                            var ws = json.Value<string>("webSocketDebuggerUrl");
                            if (!string.IsNullOrWhiteSpace(ws))
                            {
                                return ws;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    lastException = ex;
                }
                await Task.Delay(200);
            }
            throw new TimeoutException("browser DevTools endpoint timeout: " + url + ". " + (lastException == null ? "" : lastException.Message));
        }

        private static string ResolveSessionId(MicroiSpiderSessionParam param)
        {
            if (param == null)
            {
                return "";
            }
            if (!string.IsNullOrWhiteSpace(param.SessionId))
            {
                return SafeProfileName(param.SessionId);
            }
            if (!string.IsNullOrWhiteSpace(param.ProfileKey))
            {
                return SafeProfileName(param.ProfileKey);
            }
            return "";
        }

        private static string GetUserDataDir(MicroiSpiderSessionParam param, string sessionId)
        {
            if (param != null && !string.IsNullOrWhiteSpace(param.UserDataDir))
            {
                return param.UserDataDir;
            }
            var profileKey = param != null && !string.IsNullOrWhiteSpace(param.ProfileKey) ? param.ProfileKey : sessionId;
            return Path.Combine(Path.GetTempPath(), "Microi.Spider", "profiles", SafeProfileName(profileKey));
        }

        private static string SafeProfileName(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return "default";
            }
            return Regex.Replace(key.Trim(), @"[^a-zA-Z0-9_\-.]", "_");
        }

        private static async Task ApplyVirtualWindowsAsync(IPage page)
        {
            await page.SetUserAgentAsync("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            await page.SetViewportAsync(new ViewPortOptions { Width = 1366, Height = 768 });
        }

        private static async Task NavigateAsync(IPage page, string url, string waitUntil, int? timeoutMs)
        {
            if (page == null || string.IsNullOrWhiteSpace(url))
            {
                return;
            }
            TraceSpider("Navigate: " + url);
            var navigateTask = page.Client.SendAsync("Page.navigate", new
            {
                url,
                referrerPolicy = "strictOriginWhenCrossOrigin"
            });
            var completed = await Task.WhenAny(navigateTask, Task.Delay(1500));
            if (completed == navigateTask)
            {
                await navigateTask;
            }
            await Task.Delay(Math.Min(timeoutMs ?? 2000, 5000));
            TraceSpider("Navigate: delay completed.");
        }

        private static NavigationOptions BuildNavigationOptions(WaitUntilNavigation waitUntil)
        {
            return new NavigationOptions
            {
                WaitUntil = new[] { waitUntil },
                Timeout = DefaultTimeoutMs,
                ReferrerPolicy = "strictOriginWhenCrossOrigin"
            };
        }

        private static WaitUntilNavigation ToWaitUntil(string waitUntil)
        {
            var value = (waitUntil ?? "").Trim().ToLowerInvariant();
            if (value == "domcontentloaded")
            {
                return WaitUntilNavigation.DOMContentLoaded;
            }
            if (value == "networkidle0")
            {
                return WaitUntilNavigation.Networkidle0;
            }
            if (value == "load")
            {
                return WaitUntilNavigation.Load;
            }
            return WaitUntilNavigation.Networkidle2;
        }

        private static async Task WaitForDocumentReadyAsync(IPage page, string waitUntil, int timeoutMs)
        {
            var deadline = DateTime.Now.AddMilliseconds(Math.Max(timeoutMs, 1000));
            var value = (waitUntil ?? "").Trim().ToLowerInvariant();
            var requireComplete = value == "load" || value == "networkidle0" || value == "networkidle2";
            while (DateTime.Now < deadline)
            {
                try
                {
                    var state = await page.EvaluateExpressionAsync<string>("document.readyState");
                    if (state == "complete" || (!requireComplete && state == "interactive"))
                    {
                        return;
                    }
                }
                catch
                {
                    // Navigation can temporarily destroy the execution context.
                }
                await Task.Delay(200);
            }
        }

        private static async Task WaitForSelectorAsync(IPage page, string selector, int? timeoutMs)
        {
            if (string.IsNullOrWhiteSpace(selector))
            {
                return;
            }
            await page.WaitForSelectorAsync(selector, new WaitForSelectorOptions { Timeout = timeoutMs ?? DefaultTimeoutMs });
        }

        private static async Task<string> ExtractAsync(IPage page, MicroiSpiderRecipeStepParam step, JObject variables)
        {
            var selector = ReplaceVariables(step.Selector, variables);
            if (!string.IsNullOrWhiteSpace(selector))
            {
                await WaitForSelectorAsync(page, selector, step.TimeoutMs);
                var element = await page.QuerySelectorAsync(selector);
                if (element == null)
                {
                    return "";
                }
                if (!string.IsNullOrWhiteSpace(step.Script))
                {
                    return await element.EvaluateFunctionAsync<string>(step.Script);
                }
                return await element.EvaluateFunctionAsync<string>("element => element.innerText || element.textContent || element.value || ''");
            }

            if (!string.IsNullOrWhiteSpace(step.Script))
            {
                return await page.EvaluateFunctionAsync<string>(step.Script);
            }
            return "";
        }

        private static async Task FillAsync(IPage page, MicroiSpiderRecipeStepParam step, JObject variables)
        {
            if (step.Fields == null && !string.IsNullOrWhiteSpace(step.Selector))
            {
                await FillSelectorAsync(page, ReplaceVariables(step.Selector, variables), ReplaceVariables(step.Value, variables), step.TimeoutMs);
                return;
            }
            if (step.Fields == null)
            {
                return;
            }
            foreach (var property in step.Fields.Properties())
            {
                var selector = ReplaceVariables(property.Name, variables);
                var value = ReplaceVariables(property.Value == null ? "" : property.Value.ToString(), variables);
                await FillSelectorAsync(page, selector, value, step.TimeoutMs);
            }
        }

        private static async Task FillSelectorAsync(IPage page, string selector, string value, int? timeoutMs)
        {
            await WaitForSelectorAsync(page, selector, timeoutMs);
            await page.EvaluateFunctionAsync<bool>(@"(selector, value) => {
                    const el = document.querySelector(selector);
                    if (!el) return false;
                    el.focus();
                    el.value = value;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }", selector, value);
        }

        private static async Task ClickAsync(IPage page, MicroiSpiderRecipeStepParam step, JObject variables, int? timeoutMs)
        {
            var selector = ReplaceVariables(step.Selector, variables);
            await WaitForSelectorAsync(page, selector, step.TimeoutMs ?? timeoutMs);
            await page.ClickAsync(selector);
        }

        private static DosResult AssertVariables(SpiderSession session, MicroiSpiderRecipeStepParam step, int stepIndex)
        {
            if (step.RequiredFields == null || !step.RequiredFields.Any())
            {
                return null;
            }
            foreach (var field in step.RequiredFields)
            {
                var token = session.Variables.SelectToken(field);
                if (token == null || string.IsNullOrWhiteSpace(token.ToString()))
                {
                    session.Status = "AssertFailed";
                    session.Msg = "required field is empty: " + field;
                    return new DosResult(0, BuildSessionData(session, stepIndex, stepIndex), session.Msg);
                }
            }
            return null;
        }

        private static async Task SnapshotAsync(IPage page, MicroiSpiderRecipeStepParam step, JObject variables)
        {
            var name = string.IsNullOrWhiteSpace(step.Name) ? "snapshot" : step.Name;
            variables[name + "Url"] = page.Url;
            if (step.SaveHtml == true)
            {
                variables[name + "Html"] = await page.GetContentAsync();
            }
            if (step.SaveScreenshot == true)
            {
                var bytes = await page.ScreenshotDataAsync();
                variables[name + "ScreenshotBase64"] = Convert.ToBase64String(bytes);
            }
        }

        private static void MergeVariables(JObject target, JObject source)
        {
            if (target == null || source == null)
            {
                return;
            }
            foreach (var property in source.Properties())
            {
                target[property.Name] = property.Value.DeepClone();
            }
        }

        private static void MergeCaptureStarts(SpiderSession session, List<string> starts, int? bodyMaxLength)
        {
            if (session == null)
            {
                return;
            }
            if (bodyMaxLength.HasValue && bodyMaxLength.Value > 0)
            {
                session.CaptureBodyMaxLength = bodyMaxLength.Value;
            }
            if (starts == null)
            {
                return;
            }
            lock (session.SyncRoot)
            {
                foreach (var item in starts)
                {
                    if (!string.IsNullOrWhiteSpace(item) && !session.CaptureStarts.Any(t => string.Equals(t, item, StringComparison.OrdinalIgnoreCase)))
                    {
                        session.CaptureStarts.Add(item);
                    }
                }
            }
        }

        private static void AttachResponseCapture(SpiderSession session)
        {
            if (session == null || session.Page == null || session.ResponseAttached)
            {
                return;
            }
            session.ResponseAttached = true;
            session.Page.Response += async (sender, e) =>
            {
                try
                {
                    var response = e.Response;
                    List<string> starts;
                    lock (session.SyncRoot)
                    {
                        starts = session.CaptureStarts.ToList();
                    }
                    if (response == null || starts == null || !starts.Any(t => response.Url.StartsWith(t, StringComparison.OrdinalIgnoreCase)))
                    {
                        return;
                    }
                    var body = await response.TextAsync();
                    if (body != null && body.Length > session.CaptureBodyMaxLength)
                    {
                        body = body.Substring(0, session.CaptureBodyMaxLength);
                    }
                    var item = new JObject
                    {
                        ["Url"] = response.Url,
                        ["Body"] = TryParseJson(body),
                        ["CaptureTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    };
                    lock (session.SyncRoot)
                    {
                        session.CapturedResponses.Add(item);
                    }
                }
                catch
                {
                    // 响应体可能是二进制或被浏览器拒绝读取，采集主流程不应因此中断。
                }
            };
        }

        private static JToken TryParseJson(string body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return "";
            }
            try
            {
                return JToken.Parse(body);
            }
            catch
            {
                return body;
            }
        }

        private static string ReplaceVariables(string text, JObject variables)
        {
            if (string.IsNullOrWhiteSpace(text) || variables == null)
            {
                return text;
            }
            return Regex.Replace(text, @"\{\{\s*([\w\.\-]+)\s*\}\}", match =>
            {
                var token = variables.SelectToken(match.Groups[1].Value);
                if (token == null)
                {
                    return "";
                }
                if (token.Type == JTokenType.String)
                {
                    return token.Value<string>();
                }
                return token.ToString(Formatting.None);
            });
        }

        private static JObject BuildSessionData(SpiderSession session, int? currentStepIndex, int? nextStepIndex)
        {
            if (session == null)
            {
                return new JObject();
            }

            JArray capturedResponses;
            lock (session.SyncRoot)
            {
                capturedResponses = new JArray(session.CapturedResponses.Select(t => t.DeepClone()));
            }

            var data = new JObject
            {
                ["SessionId"] = session.SessionId,
                ["ProfileKey"] = session.ProfileKey,
                ["UserDataDir"] = session.UserDataDir,
                ["Status"] = session.Status,
                ["Msg"] = session.Msg ?? "",
                ["PageUrl"] = session.Page == null ? "" : session.Page.Url,
                ["CreatedAt"] = session.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                ["LastActiveAt"] = session.LastActiveAt.ToString("yyyy-MM-dd HH:mm:ss"),
                ["Variables"] = session.Variables.DeepClone(),
                ["CapturedResponseCount"] = capturedResponses.Count,
                ["CapturedResponses"] = capturedResponses
            };
            if (currentStepIndex.HasValue)
            {
                data["CurrentStepIndex"] = currentStepIndex.Value;
            }
            if (nextStepIndex.HasValue)
            {
                data["NextStepIndex"] = nextStepIndex.Value;
            }
            return data;
        }

        private static void Touch(SpiderSession session)
        {
            if (session != null)
            {
                session.LastActiveAt = DateTime.Now;
            }
        }

        private static void TraceSpider(string message)
        {
            if (Environment.GetEnvironmentVariable("MICROI_SPIDER_TRACE") == "1")
            {
                Console.WriteLine("[MicroiSpider] " + DateTime.Now.ToString("HH:mm:ss") + " " + message);
            }
        }

        private static async Task CloseSessionAsync(SpiderSession session)
        {
            if (session == null)
            {
                return;
            }
            session.Status = "Closed";
            try
            {
                if (session.Page != null)
                {
                    await session.Page.CloseAsync();
                }
            }
            catch { }
            try
            {
                if (session.Browser != null)
                {
                    await session.Browser.CloseAsync();
                    session.Browser.Dispose();
                }
            }
            catch { }
            try
            {
                if (session.BrowserProcess != null && !session.BrowserProcess.HasExited)
                {
                    session.BrowserProcess.Kill();
                    session.BrowserProcess.Dispose();
                }
            }
            catch { }
        }

    }
}
