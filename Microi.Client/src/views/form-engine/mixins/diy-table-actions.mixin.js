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

            // 如果没有配置任何角色权限限制（roleLimitModel为空），与LimitEdit等保持一致
            return false;
        },
        async RunMoreBtn(btn, row, v8) {
          // console.log("RunMoreBtn",btn, row, v8);
            var self = this;
            self.BtnV8Loading = true;
            var V8 = v8 ? v8 : await self.DiyCommon.InitV8Code({}, self.$router);;
            try {
                if (!self.DiyCommon.IsNull(btn.V8Code)) {
                    if (self.SysConfig.EnableUserClickLog) {
                        self.DiyCommon.AddSysLog({
                            Type: `点击V8按钮`,
                            Title: `用户[${self.GetCurrentUser.Name}]点击了[${self.SysMenuModel.Name}]的V8按钮[${btn.Name}]`,
                            Content: ""
                        });
                    }
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
