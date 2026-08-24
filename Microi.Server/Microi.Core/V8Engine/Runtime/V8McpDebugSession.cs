#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpDebugSession.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-03-21
* 文件描述：V8引擎 WebSocket 调试会话 核心逻辑
*           包含：调试会话管理、代码插桩、变量收集、表达式求值
*           此文件位于开源项目 Microi.Core 中
*******************************************************/
#endregion
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Jint;
using Jint.Native;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Microsoft.AspNetCore.Http;

namespace Microi.net
{
    /// <summary>
    /// V8 MCP 调试 WebSocket 会话核心逻辑
    /// 处理 WebSocket 通信 + Jint 引擎调试
    /// </summary>
    public class V8McpDebugSession
    {
        private readonly WebSocket _ws;
        private readonly dynamic _token;
        private readonly HttpContext _httpContext;
        private readonly CancellationTokenSource _cts = new CancellationTokenSource();

        // 调试状态
        private readonly ManualResetEventSlim _resumeSignal = new ManualResetEventSlim(false);
        private readonly HashSet<int> _breakpoints = new HashSet<int>();
        private volatile DebugStepMode _stepMode = DebugStepMode.Continue;
        private volatile int _lastStoppedLine = -1;
        private volatile bool _isStepping = false;

        // Jint 引擎引用
        private Engine _engine;
        private V8EngineParam _v8Param;

        // console.log 捕获
        private readonly List<string> _consoleOutput = new List<string>();

        private enum DebugStepMode
        {
            Continue,
            StepOver,
            StepIn,
            StepOut
        }

        public V8McpDebugSession(WebSocket ws, dynamic token, HttpContext context)
        {
            _ws = ws;
            _token = token;
            _httpContext = context;
        }

        /// <summary>
        /// 会话主循环：接收 WebSocket 消息
        /// </summary>
        public async Task RunAsync()
        {
            var buffer = new byte[64 * 1024];
            var messageBuilder = new StringBuilder();

            try
            {
                while (_ws.State == WebSocketState.Open && !_cts.IsCancellationRequested)
                {
                    var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), _cts.Token);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                        break;
                    }

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        messageBuilder.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));

                        if (result.EndOfMessage)
                        {
                            var text = messageBuilder.ToString();
                            messageBuilder.Clear();

                            try
                            {
                                var msg = JObject.Parse(text);
                                await HandleClientMessage(msg);
                            }
                            catch (JsonException ex)
                            {
                                Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[V8Debug] JSON 解析失败: {ex.Message}, 内容: {text?.Substring(0, Math.Min(200, text?.Length ?? 0))}");
                                await SendMessage("error", new { message = "无法解析消息" });
                            }
                        }
                    }
                }
            }
            catch (OperationCanceledException) { }
            catch (WebSocketException) { }
            finally
            {
                _cts.Cancel();
                _resumeSignal.Set();

                if (_ws.State == WebSocketState.Open || _ws.State == WebSocketState.CloseReceived)
                {
                    try { await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None); }
                    catch { }
                }

                // 释放托管资源，避免内存泄漏
                try { _cts.Dispose(); } catch { }
                try { _resumeSignal.Dispose(); } catch { }
            }
        }

        /// <summary>
        /// 处理来自 VS Code 的消息
        /// </summary>
        private async Task HandleClientMessage(JObject msg)
        {
            var type = msg["type"]?.ToString();
            switch (type)
            {
                case "launch":
                    await HandleLaunch(msg);
                    break;

                case "setBreakpoints":
                    HandleSetBreakpoints(msg);
                    break;

                case "continue":
                    _isStepping = false;
                    _stepMode = DebugStepMode.Continue;
                    _resumeSignal.Set();
                    break;

                case "next":
                    _isStepping = true;
                    _stepMode = DebugStepMode.StepOver;
                    _resumeSignal.Set();
                    break;

                case "stepIn":
                    _isStepping = true;
                    _stepMode = DebugStepMode.StepIn;
                    _resumeSignal.Set();
                    break;

                case "stepOut":
                    _isStepping = true;
                    _stepMode = DebugStepMode.StepOut;
                    _resumeSignal.Set();
                    break;

                case "evaluate":
                    await HandleEvaluate(msg);
                    break;

                case "disconnect":
                    _cts.Cancel();
                    _resumeSignal.Set();
                    break;
            }
        }

        /// <summary>
        /// 处理 launch 请求
        /// </summary>
        private async Task HandleLaunch(JObject msg)
        {
            var osClient = msg["osClient"]?.ToString();
            var apiEngineKey = msg["apiEngineKey"]?.ToString();
            var code = msg["code"]?.ToString();
            var paramData = msg["params"] as JObject ?? new JObject();
            var stopOnEntry = msg["stopOnEntry"]?.Value<bool>() ?? true;

            if (string.IsNullOrWhiteSpace(code))
            {
                await SendMessage("error", new { message = "代码不能为空" });
                await SendMessage("terminated", new { });
                return;
            }

            if (string.IsNullOrWhiteSpace(osClient))
            {
                osClient = _token.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }
            else if (!string.Equals(osClient, _token.OsClient, StringComparison.OrdinalIgnoreCase))
            {
                await SendMessage("error", new { message = "调试会话不能切换到登录租户之外的 OsClient。" });
                await SendMessage("terminated", new { });
                return;
            }

            Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[V8Debug] Launch: osClient={osClient}, key={apiEngineKey}, stopOnEntry={stopOnEntry}, codeLen={code?.Length}");

            _isStepping = stopOnEntry;

            await SendMessage("initialized", new { });

            _ = Task.Run(async () =>
            {
                try
                {
                    await ExecuteWithDebug(osClient, apiEngineKey, code, paramData);
                }
                catch (OperationCanceledException)
                {
                    Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[V8Debug] 调试会话被取消");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[V8Debug] 执行异常: {ex.Message}\n{ex.StackTrace}");
                    await SendMessage("error", new { message = $"执行异常: {ex.Message}" });
                    await SendMessage("terminated", new { });
                }
            });
        }

        /// <summary>
        /// 使用调试钩子执行 JS 代码
        /// </summary>
        private async Task ExecuteWithDebug(string osClient, string apiEngineKey, string code, JObject paramData)
        {
            Engine engine = null;
            JintHostEnvironment hostEnvironment = null;
            IDisposable tenantScope = null;
            try
            {
                tenantScope = V8TenantContext.Enter(osClient, apiEngineKey ?? "DebugSession", "DebugSession");
                Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[V8Debug] 创建 Jint 引擎...");
                var v8Param = new V8EngineParam
                {
                    OsClient = osClient,
                    ApiEngineKey = apiEngineKey ?? "DebugSession",
                    EventName = apiEngineKey ?? "DebugSession",
                    InvokeType = "Server",
                    Param = paramData,
                    CurrentUser = _token.CurrentUser,
                    CurrentSysUser = _token.CurrentUser,
                    V8Code = code,
                    Action = new Dictionary<string, object>(),
                    HttpContext = _httpContext,
                };

                InitV8Param(v8Param);
                engine = MicroiEngine.V8Engine.CreateEngine(CreateV8EngineParam.FromSysConfig(v8Param.SysConfig));
                v8Param.Engine = engine;
                _engine = engine;
                _v8Param = v8Param;

                engine.SetValue("V8", v8Param);
                MicroiEngine.GetService<IV8ExtensionInjector>().InjectAll(engine);
                hostEnvironment = new JintHostEnvironment();
                hostEnvironment.InjectTo(engine, v8Param);
                InjectDebugConsole(engine);

                engine.SetValue("__dbg", new Func<int, bool>(lineNumber =>
                {
                    return DebugCheckpoint(lineNumber);
                }));

                var instrumentedCode = V8McpService.InstrumentCode(code);
                Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[V8Debug] 代码插桩完成，原始行数={code.Split('\n').Length}，插桩后行数={instrumentedCode.Split('\n').Length}");

                var preparedScript = V8Engine.PrepareExecutableScript(instrumentedCode);
                var evalResult = await engine.EvaluateAsync(preparedScript, _cts.Token).ConfigureAwait(false);
                if (!evalResult.IsNull() && !evalResult.IsUndefined())
                {
                    v8Param.Result = evalResult.ToObject();
                }
                await hostEnvironment.DrainTimersAsync(engine, _cts.Token).ConfigureAwait(false);

                await SendMessage("terminated", new { result = v8Param.Result });
            }
            catch (OperationCanceledException)
            {
                await SendMessage("terminated", new { });
            }
            catch (Jint.Runtime.JavaScriptException jsEx)
            {
                var line = jsEx.Location.Start.Line;
                await SendMessage("output", new
                {
                    category = "stderr",
                    output = $"JavaScript 错误 [行:{line}]: {jsEx.Message}"
                });
                await SendMessage("terminated", new { });
            }
            catch (Exception ex)
            {
                await SendMessage("error", new { message = ex.Message });
                await SendMessage("terminated", new { });
            }
            finally
            {
                hostEnvironment?.Dispose();
                if (engine != null)
                {
                    try { MicroiEngine.V8Engine.ReturnEngine(engine); } catch { }
                }
                tenantScope?.Dispose();
                _engine = null;
                _v8Param = null;
            }
        }

        /// <summary>
        /// 注入调试版 console
        /// </summary>
        private void InjectDebugConsole(Engine engine)
        {
            var debugConsole = new
            {
                log = new Action<object>(msg =>
                {
                    var text = msg?.ToString() ?? "undefined";
                    _consoleOutput.Add(text);
                    _ = SendMessage("output", new { category = "console", output = text });
                }),
                error = new Action<object>(msg =>
                {
                    var text = msg?.ToString() ?? "undefined";
                    _ = SendMessage("output", new { category = "stderr", output = text });
                }),
                warn = new Action<object>(msg =>
                {
                    var text = msg?.ToString() ?? "undefined";
                    _ = SendMessage("output", new { category = "console", output = $"⚠️ {text}" });
                }),
                info = new Action<object>(msg =>
                {
                    var text = msg?.ToString() ?? "undefined";
                    _ = SendMessage("output", new { category = "console", output = text });
                })
            };
            engine.SetValue("console", debugConsole);
        }

        /// <summary>
        /// 调试检查点
        /// </summary>
        private bool DebugCheckpoint(int lineNumber)
        {
            if (_cts.IsCancellationRequested)
            {
                throw new OperationCanceledException();
            }

            bool shouldStop = false;

            if (_isStepping || _stepMode != DebugStepMode.Continue)
            {
                shouldStop = true;
            }
            else if (_breakpoints.Contains(lineNumber))
            {
                shouldStop = true;
            }

            if (!shouldStop) return true;

            _lastStoppedLine = lineNumber;

            var variables = CollectVariables();

            var reason = _breakpoints.Contains(lineNumber) ? "breakpoint" : "step";
            _ = SendMessage("stopped", new
            {
                reason,
                line = lineNumber,
                column = 0,
                variables
            });

            _resumeSignal.Reset();
            try
            {
                _resumeSignal.Wait(_cts.Token);
            }
            catch (OperationCanceledException)
            {
                throw;
            }

            return true;
        }

        /// <summary>
        /// 处理断点设置
        /// </summary>
        private void HandleSetBreakpoints(JObject msg)
        {
            _breakpoints.Clear();
            var bps = msg["breakpoints"] as JArray;
            var validatedBreakpoints = new List<object>();

            if (bps != null)
            {
                foreach (var bp in bps)
                {
                    var line = bp["line"]?.Value<int>() ?? 0;
                    if (line > 0)
                    {
                        _breakpoints.Add(line);
                        validatedBreakpoints.Add(new
                        {
                            id = bp["id"]?.Value<int>() ?? 0,
                            line,
                            verified = true
                        });
                    }
                }
            }

            _ = SendMessage("breakpointValidated", new { breakpoints = validatedBreakpoints });
        }

        /// <summary>
        /// 处理表达式求值
        /// </summary>
        private async Task HandleEvaluate(JObject msg)
        {
            var expression = msg["expression"]?.ToString();
            if (string.IsNullOrWhiteSpace(expression) || _engine == null)
            {
                await SendMessage("evaluateResult", new { result = "<无法求值>" });
                return;
            }

            try
            {
                using var tenantScope = V8TenantContext.Enter(
                    _v8Param.OsClient,
                    _v8Param.ApiEngineKey ?? "DebugSession",
                    "DebugEvaluate");
                var result = _engine.Evaluate(expression);
                var objResult = result?.ToObject();
                var text = V8McpService.SafeSerialize(objResult);
                await SendMessage("evaluateResult", new { result = text });
            }
            catch (Exception ex)
            {
                await SendMessage("evaluateResult", new { result = $"错误: {ex.Message}" });
            }
        }

        /// <summary>
        /// 初始化 V8EngineParam 的通用字段（数据库连接、缓存、引擎等）
        /// </summary>
        private void InitV8Param(V8EngineParam param)
        {
            var clientModel = OsClientExtend.GetClient(param.OsClient);
            var safeClientModel = TenantConfigurationSecurity.CreateV8Projection(clientModel?.OsClientModel);
            param.OsClientModel = safeClientModel;
            param.ClientModel = safeClientModel.DeepClone();

            if (clientModel != null)
            {
                param.Db = clientModel.Db;
                param.DbRead = clientModel.DbRead;
                param.Dbs = MicroiEngine.GetService<IOsClientRuntime>()
                    .GetAllClientDataBase(clientModel);
            }

            try
            {
                var sysConfigResult = MicroiEngine.FormEngine.GetSysConfig(param.OsClient).GetAwaiter().GetResult();
                param.SysConfig = TenantConfigurationSecurity.CreateV8SysConfigProjection(
                    sysConfigResult?.Data,
                    param.OsClient);
            }
            catch { }

            param.ApiEngine = MicroiEngine.ApiEngine;
            param.FormEngine = MicroiEngine.FormEngine;
            param.DataSourceEngine = MicroiEngine.DataSource;
            param.ModuleEngine = MicroiEngine.ModuleEngine;
            param.EncryptHelper = new EncryptHelper();
            param.IPHelper = new IPHelper();
            param.Http = MicroiEngine.Http;
            param.Method = MicroiEngine.V8Method;
            param.Notification = new V8Notification(param.OsClient);
            param.Cache = new V8TenantCache(param.OsClient, MicroiEngine.CacheTenant.Cache(param.OsClient));
            param.Spider = MicroiEngine.Spider;
            param.OCR = new V8TenantOcr(param.OsClient);
            param.Office = MicroiEngine.Office;
            param.MongoDb = MicroiEngine.MongoDB;
            param.MQ = MicroiEngine.MQ;
            param.HDFS = new V8TenantHDFS(param.OsClient);
            param.WFEngine = MicroiEngine.WFEngine;
        }

        /// <summary>
        /// 收集当前作用域变量信息
        /// </summary>
        private List<object> CollectVariables()
        {
            var variables = new List<object>();
            try
            {
                if (_v8Param != null)
                {
                    variables.Add(new { name = "V8.Result", value = V8McpService.SafeSerialize(_v8Param.Result), type = _v8Param.Result?.GetType()?.Name ?? "null" });
                    variables.Add(new { name = "V8.Param", value = V8McpService.SafeSerialize(_v8Param.Param), type = "JObject" });
                    if (_v8Param.Form != null) variables.Add(new { name = "V8.Form", value = V8McpService.SafeSerialize(_v8Param.Form), type = _v8Param.Form?.GetType()?.Name ?? "null" });
                    if (_v8Param.OldForm != null) variables.Add(new { name = "V8.OldForm", value = V8McpService.SafeSerialize(_v8Param.OldForm), type = _v8Param.OldForm?.GetType()?.Name ?? "null" });
                    if (_v8Param.CurrentUser != null) variables.Add(new { name = "V8.CurrentUser", value = V8McpService.SafeSerialize(_v8Param.CurrentUser), type = "CurrentUser" });
                    variables.Add(new { name = "V8.OsClient", value = _v8Param.OsClient ?? "", type = "string" });
                }

                if (_engine != null)
                {
                    var globalNames = new[] { "result", "data", "list", "item", "i", "j", "count", "total", "response", "res", "rows", "row", "obj", "temp", "flag", "status", "msg", "err", "config", "options", "params" };
                    foreach (var name in globalNames)
                    {
                        try
                        {
                            var val = _engine.GetValue(name);
                            if (val != null && val.Type != Jint.Runtime.Types.Undefined)
                            {
                                var objVal = val.ToObject();
                                variables.Add(new { name, value = V8McpService.SafeSerialize(objVal), type = objVal?.GetType()?.Name ?? val.Type.ToString() });
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
            return variables;
        }

        /// <summary>
        /// 发送消息到 VS Code
        /// </summary>
        private async Task SendMessage(string type, object body)
        {
            if (_ws.State != WebSocketState.Open) return;

            try
            {
                var msg = new JObject
                {
                    ["type"] = type
                };

                if (body != null)
                {
                    var bodyObj = JObject.FromObject(body, new JsonSerializer
                    {
                        ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                        NullValueHandling = NullValueHandling.Include
                    });
                    foreach (var prop in bodyObj.Properties())
                    {
                        msg[prop.Name] = prop.Value;
                    }
                }

                var json = msg.ToString(Formatting.None);
                var bytes = Encoding.UTF8.GetBytes(json);
                await _ws.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    _cts.Token
                );
            }
            catch (Exception)
            {
                // 发送失败，忽略
            }
        }
    }
}
