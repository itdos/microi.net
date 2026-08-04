import _u from "underscore";
import { resolveV8ButtonVisibility, runV8ButtonVisibilityCode } from "@/utils/v8-button-visibility";

export default {
    methods: {
IsPermission(type) {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (roleLimitModel.length > 0) {
                var result = true;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf(type) > -1) {
                        result = false;
                    }
                });
                return result;
            }
            return true;
        },
        LimitAdd() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);
            if (roleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Add") > -1 || element.Permission.indexOf("Insert") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        LimitImport() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);
            if (roleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Import") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        LimitExport() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);
            if (
                // self.TableChildFormMode != 'View' && //2024-10-25注释，预览模式也要显示导出
                roleLimitModel.length > 0
            ) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Export") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        LimitEdit() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);
            if (roleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Edit") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        LimitDel() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);
            if (roleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Del") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        //这里之所以需要一个HandlerBtns，是因为v-if不支持async LimitMoreBtn，需要提前将结果计算出来放到属性中去
        HandlerBtns(btns, row, v8) {
            var self = this;
            if (btns) {
                if (self.DiyCommon.IsNull(row)) {
                    row = {};
                }

                // 性能优化：为同一行的所有按钮复用同一个V8对象，减少InitV8CodeSync调用
                var sharedV8 = v8 || self.DiyCommon.InitV8CodeSync({}, self.$router);
                var isInternalV8 = !v8; // 标记是否是内部创建的V8

                // 性能优化：只为外部传入的V8设置一次基础属性
                if (!v8) {
                    // 设置共享的V8属性（只设置一次）
                    if (row) {
                        var form = { ...row };
                        // sharedV8.Form = self.DeleteFormProperty(form);
                        sharedV8.Form = form;
                    }
                    sharedV8.FormSet = (fieldName, value) => self.FormSet(fieldName, value, row);
                    sharedV8.OpenForm = (r, type) => self.OpenDetail(r, type, true);
                    sharedV8.OpenFormWF = (r, type, wfParam) => self.OpenDetail(r, type, true, true, wfParam);
                    sharedV8.EventName = "V8BtnLimit";
                    self.SetV8DefaultValue(sharedV8);
                }

                // 初始化按钮统计（如果不存在）
                if (!self._btnPerfStats) {
                    self._btnPerfStats = {};
                }

                for (let index = 0; index < btns.length; index++) {
                    var btn = btns[index];
                    var isVisible = self.LimitMoreBtn(btn, row, sharedV8);
                    btn.IsVisible = isVisible;
                }
            }
        },
        DeleteFormProperty(form) {
            Reflect.deleteProperty(form, "_RowMoreBtnsOut");
            Reflect.deleteProperty(form, "_RowMoreBtnsIn");
            return form;
        },
        //LimitMoreBtn：执行按钮显示条件V8代码（同步版本）
        LimitMoreBtn(btn, row, v8) {
            var self = this;

            // 性能优化：直接使用传入的V8对象
            var V8 = v8;
            V8.Result = null;

            var hasV8Code = !self.DiyCommon.IsNull(btn.V8CodeShow);
            var btnStartTime = performance.now();
            var v8CodeShowResult;

            try {
                if (hasV8Code) {
                    v8CodeShowResult = runV8ButtonVisibilityCode(btn.V8CodeShow, { V8, row, btn, self, v8, _: _u });
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误[" + (btn.Name ? btn.Name : "") + "(显示条件)]：" + error.message, false);
            }

            // 性能监控：记录每个按钮的执行时间
            if (hasV8Code) {
                var btnDuration = performance.now() - btnStartTime;

                // 初始化统计对象
                if (!self._btnPerfStats) {
                    self._btnPerfStats = {};
                }
                if (!self._btnPerfStats[btn.Name]) {
                    self._btnPerfStats[btn.Name] = {
                        count: 0,
                        totalTime: 0
                    };
                }

                // 更新统计数据
                var stats = self._btnPerfStats[btn.Name];
                stats.count++;
                stats.totalTime += btnDuration;

                // 如果单次执行时间超过50ms，警告
                if (btnDuration > 50) {
                    console.warn(`【性能警告】按钮[${btn.Name}]执行耗时: ${btnDuration.toFixed(2)}ms (超过50ms阈值)`);
                }
            }

            var v8Visible = resolveV8ButtonVisibility(V8, v8CodeShowResult);
            if (v8Visible !== null) {
                return v8Visible;
            }

            if (self.GetCurrentUser._IsAdmin === true) {
                return true;
            }

            // 性能优化：优先使用缓存的权限数据
            var roleLimitModel = V8._cachedRoleLimit;
            if (!roleLimitModel) {
                roleLimitModel = self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);
            }

            if (roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    // 兼容 Permission 为字符串或数组的情况
                    var permission = element.Permission;
                    if (typeof permission === 'string') {
                        try { permission = JSON.parse(permission); } catch(e) { /* 保持原字符串 */ }
                    }
                    if (Array.isArray(permission)) {
                        if (permission.includes(btn.Id)) {
                            result = true;
                        }
                    } else if (typeof permission === 'string') {
                        if (permission.indexOf(btn.Id) > -1) {
                            result = true;
                        }
                    }
                });
                return result;
            }

            // 没有配置角色按钮权限时，显示条件未明确返回 false 则默认显示。
            return true;
        },
        IsMicroiStoreInstallButton(btn, row) {
            var self = this;
            var tableName = String(self.CurrentDiyTableModel?.Name || self.TableName || "").toLowerCase();
            var menuUrl = String(self.SysMenuModel?.Url || self.$route?.path || "").toLowerCase();
            var btnName = String(btn?.Name || row?.StoreInstallActionName || "").trim();
            var v8Code = String(btn?.V8Code || "");
            var isStoreMenu = tableName === "sys_microistore" || menuUrl === "/microi-store" || menuUrl.indexOf("microi-store") > -1;
            if (btnName === "安装离线包" || btn?.ShowRow === false) return false;
            var isInstallAction = ["安装", "更新", "重新安装", "异常"].indexOf(btnName) > -1
                || v8Code.indexOf("import-microi-store-package") > -1
                || v8Code.indexOf("get-microi-store-model") > -1
                || btn?.ApiEngineKey === "import-microi-store-package";
            return isStoreMenu && isInstallAction;
        },
        IsMicroiStoreOfflineInstallButton(btn) {
            var self = this;
            var tableName = String(self.CurrentDiyTableModel?.Name || self.TableName || "").toLowerCase();
            var menuUrl = String(self.SysMenuModel?.Url || self.$route?.path || "").toLowerCase();
            var isStoreMenu = tableName === "sys_microistore" || menuUrl === "/microi-store" || menuUrl.indexOf("microi-store") > -1;
            return isStoreMenu && String(btn?.Name || "").trim() === "安装离线包";
        },
        SelectMicroiStoreOfflinePackageFile() {
            var self = this;
            return new Promise(function (resolve, reject) {
                var suffix = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
                var inputId = "microi_offline_package_" + suffix;
                var detailId = inputId + "_detail";
                var errorId = inputId + "_error";
                var state = { Selected: null, Reading: false };
                var cleaned = false;
                var cleanup = function () {
                    if (cleaned) return;
                    cleaned = true;
                    var input = document.getElementById(inputId);
                    if (input && input.__MicroiChangeHandler) {
                        input.removeEventListener("change", input.__MicroiChangeHandler);
                    }
                };
                var setText = function (selector, value) {
                    var element = document.querySelector(selector);
                    if (element) element.textContent = value || "-";
                };
                var formatSize = function (value) {
                    var bytes = Number(value || 0);
                    if (bytes < 1024) return bytes + " B";
                    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
                    return (bytes / 1024 / 1024).toFixed(2) + " MB";
                };
                var updateError = function (message) {
                    var errorElement = document.getElementById(errorId);
                    if (!errorElement) return;
                    errorElement.textContent = message || "";
                    errorElement.style.display = message ? "block" : "none";
                };
                var readFile = function (file) {
                    state.Selected = null;
                    updateError("");
                    if (!file) return;
                    state.Reading = true;
                    var reader = new FileReader();
                    reader.onerror = function () {
                        state.Reading = false;
                        updateError("读取离线包文件失败，请重新选择。");
                    };
                    reader.onload = function (event) {
                        state.Reading = false;
                        try {
                            var packageModel = JSON.parse(String(event?.target?.result || "{}"));
                            if (!packageModel || !packageModel.PackageInfo) {
                                throw new Error("缺少 PackageInfo");
                            }
                            var packageInfo = packageModel.PackageInfo || {};
                            var bundles = [];
                            if (packageModel.ApplicationBundle) bundles.push(packageModel.ApplicationBundle);
                            if (Array.isArray(packageModel.ApplicationBundles)) bundles = bundles.concat(packageModel.ApplicationBundles);
                            var types = bundles.map(function (item) {
                                return item?.ApplicationType || item?.Application?.AppType || "";
                            }).filter(Boolean);
                            var uniqueTypes = Array.from(new Set(types));
                            var typeText = bundles.length
                                ? "AI 应用" + (uniqueTypes.length ? "（" + uniqueTypes.join(" / ") + "）" : "")
                                : "普通应用";
                            state.Selected = { File: file, Package: packageModel };
                            var detail = document.getElementById(detailId);
                            if (detail) detail.style.display = "grid";
                            setText("#" + detailId + " [data-field='file']", file.name);
                            setText("#" + detailId + " [data-field='size']", formatSize(file.size));
                            setText("#" + detailId + " [data-field='name']", packageInfo.Name || packageInfo.PackageName || file.name);
                            setText("#" + detailId + " [data-field='version']", packageInfo.Version || packageInfo.AppVersion || "-");
                            setText("#" + detailId + " [data-field='type']", typeText);
                        } catch (error) {
                            var detail = document.getElementById(detailId);
                            if (detail) detail.style.display = "none";
                            updateError("离线包格式不正确：" + error.message);
                        }
                    };
                    reader.readAsText(file, "utf-8");
                };
                var html = "<div style='text-align:left;color:#303a4b;'>"
                    + "<div style='padding:12px 14px;margin-bottom:14px;border:1px solid #d7e8ff;border-radius:9px;background:#f0f7ff;line-height:1.7;'>"
                    + "<b style='display:block;margin-bottom:3px;'>上传应用离线包</b>"
                    + "<span style='color:#617086;font-size:13px;'>支持普通应用，以及 Web、UniApp、前端微服务等 AI 应用。确认后仍由后台任务安装。</span></div>"
                    + "<label for='" + inputId + "' style='display:block;padding:22px 14px;border:1px dashed #aab8ca;border-radius:9px;background:#fafcff;text-align:center;cursor:pointer;'>"
                    + "<b>点击选择离线包 JSON</b><span style='display:block;margin-top:6px;color:#8a95a5;font-size:12px;'>选择后会先校验格式并显示应用信息</span></label>"
                    + "<input id='" + inputId + "' type='file' accept='.json,application/json' style='display:none;'>"
                    + "<div id='" + detailId + "' style='display:none;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;font-size:12px;'>"
                    + "<div><span style='color:#8a95a5;'>文件：</span><b data-field='file'></b></div>"
                    + "<div><span style='color:#8a95a5;'>大小：</span><b data-field='size'></b></div>"
                    + "<div><span style='color:#8a95a5;'>应用：</span><b data-field='name'></b></div>"
                    + "<div><span style='color:#8a95a5;'>版本：</span><b data-field='version'></b></div>"
                    + "<div style='grid-column:1 / -1;'><span style='color:#8a95a5;'>类型：</span><b data-field='type'></b></div></div>"
                    + "<div id='" + errorId + "' style='display:none;margin-top:10px;padding:9px 10px;border-radius:7px;color:#c9363e;background:#fff1f1;font-size:12px;'></div>"
                    + "<div style='margin-top:12px;padding:9px 10px;border-radius:7px;color:#6b5b20;background:#fff9e8;font-size:12px;line-height:1.6;'>正式环境安装前，请先确认数据库与文件存储已经备份。</div></div>";

                self.DiyCommon.OsConfirm(html, function () {
                    var selected = state.Selected;
                    cleanup();
                    resolve(selected);
                }, function () {
                    cleanup();
                    reject(new Error("__MICROI_USER_CANCEL__"));
                }, {
                    Title: "安装离线包",
                    OkText: "开始后台安装",
                    Icon: "info",
                    CustomClass: "microi-offline-install-messagebox",
                    BeforeClose: function (action, instance, done) {
                        if (action === "confirm" && state.Reading) {
                            self.DiyCommon.Tips("离线包仍在读取，请稍候。", false);
                            return;
                        }
                        if (action === "confirm" && !state.Selected) {
                            self.DiyCommon.Tips("请先选择并通过校验的离线包 JSON。", false);
                            return;
                        }
                        done();
                    }
                });
                setTimeout(function () {
                    var input = document.getElementById(inputId);
                    if (!input) return;
                    input.__MicroiChangeHandler = function () { readFile(input.files && input.files[0]); };
                    input.addEventListener("change", input.__MicroiChangeHandler);
                }, 0);
            });
        },
        async CanUseMicroiStoreOfflineInstallerApp() {
            var self = this;
            if (typeof self.OpenAppDialog !== "function") return false;
            try {
                // 老版本数据库的 GetFormData 可能受历史字段元数据影响而查询失败，
                // GetTableData 对新旧库都稳定；这里只取第一条已发布的同 Key 微服务。
                var result = await self.DiyCommon.FormEngine.GetTableData("sys_microiservice", {
                    _Where: [["MsKey", "=", "microi-platform-service"]],
                    _PageIndex: 1,
                    _PageSize: 1
                });
                // 兼容新旧前端封装：有的版本返回 DosResult，有的版本直接返回数组，
                // 还有旧网关会把 DosResult 再包一层 Data。
                var rows = Array.isArray(result)
                    ? result
                    : (result && Array.isArray(result.Data)
                        ? result.Data
                        : (result && result.Data && Array.isArray(result.Data.Data) ? result.Data.Data : []));
                var resultCode = result && (result.Code ?? result.code);
                var service = rows[0] || null;
                if ((resultCode !== undefined && resultCode !== null && Number(resultCode) !== 1)
                    || !service || Number(service.IsEnable) === 0) return false;
                var parts = String(service.BuildVersion || "").replace(/^v/i, "").split(".").map(function (item) { return parseInt(item || 0, 10) || 0; });
                return ((parts[0] || 0) * 1000000 + (parts[1] || 0) * 1000 + (parts[2] || 0)) >= 1000008;
            } catch (_) {
                return false;
            }
        },
        async RunMicroiStoreOfflineInstallButton(V8) {
            var self = this;
            if (await self.CanUseMicroiStoreOfflineInstallerApp()) {
                self.OpenAppDialog({
                    AppKey: "microi-platform-service",
                    RoutePath: "/offline-package-installer",
                    Title: "安装离线包",
                    Width: "min(760px, calc(100vw - 32px))",
                    Data: { Source: "MicroiStore" },
                    OnSuccess: async function (result) {
                        self.DiyCommon.Tips(result?.message || "离线包安装任务已提交，请在右上角通知中心查看进度。");
                        self.NotifyBackgroundTaskStarted(result);
                        if (typeof self.DiyCommon.RefreshAppStores === "function") await self.DiyCommon.RefreshAppStores();
                        if (typeof self.GetDiyTableRow === "function") self.GetDiyTableRow({ _PageIndex: self.DiyTableRowPageIndex || 1 });
                    },
                    OnError: function (error) {
                        self.DiyCommon.Tips(error?.message || "离线包安装页面执行失败。", false);
                    }
                });
                self.BtnV8Loading = false;
                return;
            }
            var selected = await self.SelectMicroiStoreOfflinePackageFile();
            var packageInfo = selected.Package.PackageInfo || {};
            var packageName = packageInfo.Name || packageInfo.PackageName || selected.File.name;
            var offlineOperationId = self.DiyCommon.NewGuid();
            var importParam = {
                Package: selected.Package,
                PackageFileName: selected.File.name,
                InstallAction: "Install",
                InstallOperationId: offlineOperationId
            };

            // 后台任务基础包必须先以前台方式完成安装，不能依赖它尚未补齐的任务表来自举。
            if (self.IsBackgroundTaskBootstrapPackage(packageInfo)) {
                var foregroundResult = await V8.ApiEngine.Run("import-microi-store-package", importParam);
                self.BtnV8Loading = false;
                if (!foregroundResult || Number(foregroundResult.Code) !== 1) {
                    throw new Error((foregroundResult && (foregroundResult.Msg || foregroundResult.Message)) || "后台任务基础能力安装失败");
                }
                self.DiyCommon.Tips("后台任务基础能力安装成功，后续大型应用将使用后台任务安装。", true);
                if (typeof self.DiyCommon.RefreshAppStores === "function") await self.DiyCommon.RefreshAppStores();
                if (typeof self.GetDiyTableRow === "function") self.GetDiyTableRow({ _PageIndex: self.DiyTableRowPageIndex || 1 });
                return;
            }

            var result = await V8.ApiEngine.RunBackground(
                "import-microi-store-package",
                importParam,
                "安装离线包应用：" + packageName,
                {
                    IdempotencyKey: "microi-store-offline:" + offlineOperationId,
                    ConcurrencyKey: "import-microi-store-package",
                    MaxAttempts: 3,
                    RetryOnFailure: true
                },
                function () { self.BtnV8Loading = false; }
            );
            if (!result || Number(result.Code) !== 1) {
                throw new Error((result && (result.Msg || result.Message)) || "离线包安装任务创建失败");
            }
            self.DiyCommon.Tips("离线包安装任务已提交，请在右上角通知中心查看进度。");
            self.NotifyBackgroundTaskStarted(result);
            if (typeof self.DiyCommon.RefreshAppStores === "function") {
                await self.DiyCommon.RefreshAppStores();
            }
            if (typeof self.GetDiyTableRow === "function") {
                self.GetDiyTableRow({ _PageIndex: self.DiyTableRowPageIndex || 1 });
            }
        },
        BuildMicroiStoreInstallParam(btn, row) {
            var self = this;
            row = row && typeof row === "object" ? row : {};
            var actionName = String((btn && btn.Name) || row.StoreInstallActionName || "安装");
            var installAction = actionName.indexOf("重新") > -1
                ? "Reinstall"
                : (actionName.indexOf("更新") > -1 ? "Update" : "Install");
            var installOperationId = self.DiyCommon.NewGuid();
            var storeApiBase = row.StoreApiBase || row.AppStoreApiBase || self.DiyCommon.GetAppStoreSourceApiBase(row);
            var storeOsClient = row.StoreOsClient || row.AppStoreOsClient || row.SourceOsClient
                || self.DiyCommon.GetAppStoreSourceOsClient(row);

            // STORE_INSTALL_IDENTIFIER_ONLY_V1：后台任务只持久化商城定位信息。
            // 禁止复制整行/Form/Row/Btn，更不能把 AppPakcet 的 Base64 资源在
            // 浏览器、HTTP、任务表和 Jint 之间重复序列化；导入器按 StoreId
            // 从受信任商城源读取一次包体，并通过 checkpoint 分片续跑。
            return {
                Id: row.Id,
                StoreId: row.StoreId || row.Id,
                AppId: row.AppId || row.AppKey || row.Id,
                AppKey: row.AppKey || row.AppId,
                AppName: row.AppName || row.Name || row.Title,
                AppVersion: row.AppVersion || row.Version,
                AppAuthor: row.AppAuthor || row.Author,
                StoreApiBase: storeApiBase,
                AppStoreApiBase: storeApiBase,
                StoreOsClient: storeOsClient,
                AppStoreOsClient: storeOsClient,
                InstallParentSysMenuId: row.InstallParentSysMenuId,
                ResumeInstall: true,
                InstallAction: installAction,
                InstallOperationId: installOperationId
            };
        },
        IsBackgroundTaskBootstrapPackage(value) {
            var packageInfo = value && value.PackageInfo && typeof value.PackageInfo === "object"
                ? value.PackageInfo
                : value;
            var appId = packageInfo && (
                packageInfo.AppId || packageInfo.AppKey || packageInfo.SourceAppId
                || packageInfo.SourceAppKey || packageInfo.appId || packageInfo.appKey
            );
            var packageName = packageInfo && (
                packageInfo.Name || packageInfo.PackageName || packageInfo.AppName || packageInfo.Title
                || packageInfo.name || packageInfo.packageName || packageInfo.appName || packageInfo.title
            );
            return String(appId || "").trim().toLowerCase() === "app.microi.background-task"
                // 很老的应用商城记录可能没有回填稳定 AppId，只能保留历史中文包名。
                // 使用精确名称兜底，避免把其它应用误判为启动基础包。
                || String(packageName || "").trim() === "后台任务基础能力";
        },
        BuildBackgroundTaskOptions(btn, row, apiEngineKey) {
            var source = btn && (btn.BackgroundTaskOptions || btn.backgroundTaskOptions);
            if (typeof source === "string") {
                try { source = JSON.parse(source); } catch (_) { source = {}; }
            }
            var options = source && typeof source === "object" ? { ...source } : {};
            var fields = options.IdempotencyKeyFields || options.idempotencyKeyFields;
            if (!options.IdempotencyKey && Array.isArray(fields) && fields.length > 0) {
                var parts = fields.map(function (field) {
                    return row && row[field] !== undefined && row[field] !== null ? String(row[field]) : "";
                });
                options.IdempotencyKey = [apiEngineKey].concat(parts).join(":");
            }
            if (typeof options.IdempotencyKey === "string") {
                options.IdempotencyKey = options.IdempotencyKey.replace(/\$?\{([^}]+)\}/g, function (_, field) {
                    return row && row[field] !== undefined && row[field] !== null ? String(row[field]) : "";
                });
            }
            if (options.BusinessTable && !options.BusinessId && row && row.Id) {
                options.BusinessId = row.Id;
            }
            delete options.IdempotencyKeyFields;
            delete options.idempotencyKeyFields;
            return options;
        },
        async MarkBackgroundTaskSubmitted(V8, options, result) {
            var safeName = function (value) {
                return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(value);
            };
            var table = options && options.BusinessTable;
            var businessId = options && options.BusinessId;
            var statusField = options && options.BusinessStatusField;
            var taskIdField = options && options.BusinessTaskIdField;
            var progressField = options && options.BusinessProgressField;
            var etaField = options && options.BusinessEtaField;
            var taskData = result && result.Data;
            var taskId = taskData && (taskData.Id || taskData.TaskId);
            if (!safeName(table) || !businessId || !safeName(statusField) || !safeName(taskIdField) || !taskId) {
                return { Code: 1, Skipped: true };
            }
            var patch = { Id: businessId };
            patch[statusField] = "后台处理中";
            patch[taskIdField] = taskId;
            if (safeName(progressField)) patch[progressField] = 0;
            if (safeName(etaField)) patch[etaField] = null;
            return await V8.FormEngine.UptFormData(table, patch);
        },
        NotifyBackgroundTaskStarted(result) {
            var self = this;
            try {
                window.dispatchEvent(new CustomEvent("microi-background-task-started", {
                    detail: result || {}
                }));
            } catch (_) { }
            if (self.$websocket && self.$websocket.state === "Connected" && typeof self.$websocket.invoke === "function") {
                self.$websocket.invoke("SendBackgroundTaskList").catch(function () { });
            }
        },
        async RunMicroiStoreInstallButton(btn, row, V8) {
            var self = this;
            var actionName = String(btn?.Name || row?.StoreInstallActionName || "安装");
            var appName = row?.AppName || row?.Name || row?.Title || "应用";
            var confirmText = "确认" + actionName + "【" + appName + "】？安装前建议确认数据库已备份。";
            await new Promise(function (resolve, reject) {
                self.DiyCommon.OsConfirm(confirmText, resolve, reject);
            }).catch(function () {
                self.BtnV8Loading = false;
                return Promise.reject(new Error("__MICROI_USER_CANCEL__"));
            });

            var backgroundParam = self.BuildMicroiStoreInstallParam(btn, row);
            var backgroundTitle = actionName + "应用：" + appName;

            // 该包自身负责创建/修复后台任务表，若先提交后台任务会形成循环依赖。
            if (self.IsBackgroundTaskBootstrapPackage(row)) {
                var foregroundResult = await V8.ApiEngine.Run("import-microi-store-package", backgroundParam);
                self.BtnV8Loading = false;
                if (!foregroundResult || Number(foregroundResult.Code) !== 1) {
                    self.DiyCommon.Tips((foregroundResult && (foregroundResult.Msg || foregroundResult.Message)) || (actionName + "失败"), false);
                    return;
                }
                self.DiyCommon.Tips(actionName + "成功，后台任务基础能力已就绪。", true);
                if (typeof self.DiyCommon.RefreshAppStores === "function") await self.DiyCommon.RefreshAppStores();
                if (typeof self.GetDiyTableRow === "function") self.GetDiyTableRow({ _PageIndex: self.DiyTableRowPageIndex || 1 });
                return;
            }

            var result = await V8.ApiEngine.RunBackground(
                "import-microi-store-package",
                backgroundParam,
                backgroundTitle,
                {
                    IdempotencyKey: "microi-store:" + backgroundParam.InstallOperationId,
                    ConcurrencyKey: "import-microi-store-package",
                    MaxAttempts: 3,
                    RetryOnFailure: true
                },
                function () { self.BtnV8Loading = false; }
            );
            if (!result || result.Code !== 1) {
                self.DiyCommon.Tips((result && (result.Msg || result.Message)) || (actionName + "任务创建失败"), false);
                self.BtnV8Loading = false;
                return;
            }
            self.DiyCommon.Tips(actionName + "任务已提交，请在右上角通知中心查看进度。");
            self.NotifyBackgroundTaskStarted(result);
            if (typeof self.DiyCommon.RefreshAppStores === "function") {
                await self.DiyCommon.RefreshAppStores();
            }
            if (typeof self.GetDiyTableRow === "function") {
                self.GetDiyTableRow({ _PageIndex: self.DiyTableRowPageIndex || 1 });
            }
        },
        async RunMoreBtn(btn, row, v8) {
          // console.log("RunMoreBtn",btn, row, v8);
            var self = this;
            self.BtnV8Loading = true;
            var V8 = v8 ? v8 : await self.DiyCommon.InitV8Code({}, self.$router);;
            try {
                var hasBackgroundApiEngine = (btn.RunBackground === true || btn.BackgroundTask === true || btn.IsBackgroundTask === true)
                    && !self.DiyCommon.IsNull(btn.ApiEngineKey || btn.BackgroundApiEngineKey);
                var hasBuiltInAppStoreInstall = self.IsMicroiStoreInstallButton(btn, row);
                var hasBuiltInOfflineInstall = self.IsMicroiStoreOfflineInstallButton(btn);
                if (!self.DiyCommon.IsNull(btn.V8Code) || hasBackgroundApiEngine || hasBuiltInAppStoreInstall || hasBuiltInOfflineInstall) {
                    self.DiyCommon.UserBehaviorSignal({
                        Action: "V8ButtonClick",
                        Name: btn.Name,
                        TargetId: btn.Id || btn.ApiEngineKey || "",
                        Table: self.DiyTableModel?.Name || self.TableName || "",
                        RowId: row?.Id || "",
                        MenuId: self.SysMenuModel?.Id || ""
                    });
                    // V8.Form = self.DeleteFormProperty(row); // 当前Form表单所有字段值
                    V8.Form = row; // 当前Form表单所有字段值
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    }; // 给Form表单其它字段赋值
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.OpenFormWF = (row, type, wfParam) => {
                        return self.OpenDetail(row, type, true, true, wfParam);
                    };
                    // V8.BtnV8Loading = self.BtnV8Loading;
                    V8.V8Callback = () => {
                        self.BtnV8Loading = false;
                    };
                    V8.EventName = "V8BtnRun";
                    self.SetV8DefaultValue(V8);

                    if (hasBuiltInAppStoreInstall) {
                        await self.RunMicroiStoreInstallButton(btn, row, V8);
                        return;
                    }
                    if (hasBuiltInOfflineInstall) {
                        await self.RunMicroiStoreOfflineInstallButton(V8);
                        return;
                    }

                    if ((btn.RunBackground === true || btn.BackgroundTask === true || btn.IsBackgroundTask === true)
                        && !self.DiyCommon.IsNull(btn.ApiEngineKey || btn.BackgroundApiEngineKey)) {
                        var backgroundApiEngineKey = btn.ApiEngineKey || btn.BackgroundApiEngineKey;
                        var backgroundParam = {};
                        if (row && typeof row === "object") {
                            Object.keys(row).forEach(function (key) {
                                backgroundParam[key] = row[key];
                            });
                        }
                        backgroundParam.Form = row;
                        backgroundParam.Id = row && row.Id;
                        backgroundParam.StoreId = row && (row.StoreId || row.Id);
                        backgroundParam.AppId = row && (row.AppId || row.AppKey || row.Id);
                        backgroundParam.AppName = row && (row.AppName || row.Name || row.Title);
                        backgroundParam.AppVersion = row && (row.AppVersion || row.Version);
                        backgroundParam.StoreApiBase = row && (row.StoreApiBase || row.AppStoreApiBase);
                        backgroundParam.AppStoreApiBase = row && (row.AppStoreApiBase || row.StoreApiBase);
                        backgroundParam.StoreOsClient = row && (row.StoreOsClient || row.AppStoreOsClient);
                        backgroundParam.AppStoreOsClient = row && (row.AppStoreOsClient || row.StoreOsClient);
                        backgroundParam.Btn = btn;

                        var backgroundTitle = btn.Name || backgroundApiEngineKey;
                        if (backgroundParam.AppName) {
                            backgroundTitle += "应用：" + backgroundParam.AppName;
                        }
                        var backgroundOptions = self.BuildBackgroundTaskOptions(btn, row, backgroundApiEngineKey);
                        var backgroundResult = await V8.ApiEngine.RunBackground(backgroundApiEngineKey, backgroundParam, backgroundTitle, backgroundOptions, function () {
                            self.BtnV8Loading = false;
                        });
                        if (!backgroundResult || backgroundResult.Code !== 1) {
                            self.DiyCommon.Tips((backgroundResult && (backgroundResult.Msg || backgroundResult.Message)) || "后台任务创建失败", false);
                            return;
                        }
                        var markResult = await self.MarkBackgroundTaskSubmitted(V8, backgroundOptions, backgroundResult);
                        if (markResult && markResult.Code !== 1) {
                            self.DiyCommon.Tips("后台任务已创建，但业务记录未能标记任务状态：" + (markResult.Msg || "请检查表单编辑权限"), false);
                        }
                        self.DiyCommon.Tips("后台任务已提交，请在右上角通知中心查看进度。");
                        self.NotifyBackgroundTaskStarted(backgroundResult);
                        return;
                    }

                    // eval(btn.V8Code)
                    await eval("(async () => {\n " + btn.V8Code + " \n})()");
                    // if(!(btn.V8Code.indexOf('V8.BtnV8Loading') > -1)){
                    if (!(btn.V8Code.indexOf("V8.V8Callback") > -1)) {
                        self.BtnV8Loading = false;
                    }
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                    self.BtnV8Loading = false;
                }
            } catch (error) {
                if (error && error.message === "__MICROI_USER_CANCEL__") {
                    self.BtnV8Loading = false;
                    return;
                }
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
                self.BtnV8Loading = false;
            } finally {
                // 只在内部创建V8时清理，外部传入的v8由调用方负责清理
                if (!v8) {

                }
            }
        },
    }
};
