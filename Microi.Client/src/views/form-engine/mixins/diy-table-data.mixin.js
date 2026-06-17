import _u from "underscore";
import { markRaw } from "vue";
import { debounce } from "lodash";

export default {
    methods: {
        mergeWhereList(baseWhere, appendWhere) {
            var result = Array.isArray(baseWhere) ? baseWhere.slice() : [];
            if (!Array.isArray(appendWhere) || appendWhere.length === 0) {
                return result;
            }
            appendWhere.forEach(function(item) {
                if (!item) return;
                if (Array.isArray(item)) {
                    result.push(item.slice());
                    return;
                }
                var index = result.findIndex(function(d) {
                    return d && !Array.isArray(d) && d.Name == item.Name;
                });
                if (index === -1) {
                    result.push(Object.assign({}, item));
                } else {
                    result[index] = Object.assign({}, result[index], item);
                }
            });
            return result;
        },
        DiyTableLoad(tree, treeNode, resolve) {
            var self = this;
            // 若未配置树形父级字段，默认使用 ParentId；避免发送 _Where: [["","=",id]] 这种非法请求，
            // 同时避免后端因识别不到 ParentId 过滤而错误地添加"根节点过滤"，返回的根节点数据被当作子节点
            // 造成树形循环引用 & Vue 渲染栈溢出（RangeError: Maximum call stack size exceeded）。
            if (!self.CurrentDiyTableModel || !self.CurrentDiyTableModel.IsTree) {
                if (typeof resolve === "function") resolve([]);
                return;
            }
            var treeParentField = self.CurrentDiyTableModel.TreeParentField;
            if (self.DiyCommon.IsNull(treeParentField)) {
                treeParentField = "ParentId";
            }
            var param = {
                ModuleEngineKey: self.SysMenuModel.ModuleEngineKey,
                // _Where: [{ Name: treeParentField, Value: tree.Id, Type: "=" }]
                _Where: [[treeParentField, "=", tree.Id]],
                // 懒加载展开子节点时显式声明：返回平铺子节点，不要走"根节点过滤+递归"逻辑
                _TreeLazy: 1
            };
            if (!param.ModuleEngineKey) {
                param.ModuleEngineKey = self.SysMenuId;
            }
            if (!param.ModuleEngineKey) {
                param.FormEngineKey = self.CurrentDiyTableModel.Name;
            }
            if (!param.ModuleEngineKey && !param.FormEngineKey) {
                param.FormEngineKey = self.TableId;
            }
            self.DiyCommon.Post(
                self.DiyApi.GetTableDataTree,
                param,
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开处理数据列表总耗时`);

                        // 【防御性修复】过滤掉返回数据中 ParentId 不等于当前展开节点 Id 的记录，
                        // 防止后端异常返回根节点/其它层级节点时被当作子节点追加，造成树形循环引用 & 渲染栈溢出。
                        if (treeParentField && result.Data && result.Data.length > 0) {
                            var expandId = tree && tree.Id;
                            var originalLen = result.Data.length;
                            result.Data = result.Data.filter(function (row) {
                                return row && row.Id !== expandId && String(row[treeParentField] || "") === String(expandId || "");
                            });
                            if (result.Data.length !== originalLen) {
                                console.warn("Microi：树形展开响应中包含非直属子节点，已自动过滤。", {
                                    expandId: expandId, 过滤前: originalLen, 过滤后: result.Data.length
                                });
                            }
                        }

                        var tempShowDiyFieldList = self.GetShowDiyFieldList();
                        var templateEngineFields = tempShowDiyFieldList.filter((field) => !self.DiyCommon.IsNull(field.V8TmpEngineTable));

                        if (templateEngineFields.length > 0) {
                            console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开模板引擎V8执行总耗时`);
                            for (let i = 0; i < result.Data.length; i++) {
                                let row = result.Data[i];
                                for (let j = 0; j < templateEngineFields.length; j++) {
                                    let field = templateEngineFields[j];
                                    var tmpResult = self.RunFieldTemplateEngine(field, row);
                                    row[field.Name + "_TmpEngineResult"] = tmpResult;
                                }
                            }
                            console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开模板引擎V8执行总耗时`);
                        }

                        console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开按钮V8条件执行总耗时`);
                        // 关键修复：为树形子节点设置IsVisible属性
                        for (let i = 0; i < result.Data.length; i++) {
                            let row = result.Data[i];
                            // 设置默认可见性
                            if (!self.DiyCommon.IsNull(self.SysMenuModel.DetailCodeShowV8)) {
                                row.IsVisibleDetail = self.LimitMoreBtn1Sync(self.SysMenuModel.DetailCodeShowV8, row, "DetailCodeShowV8");
                            } else {
                                row.IsVisibleDetail = true;
                            }

                            if (!self.DiyCommon.IsNull(self.SysMenuModel.EditCodeShowV8)) {
                                row.IsVisibleEdit = self.LimitMoreBtn1Sync(self.SysMenuModel.EditCodeShowV8, row, "EditCodeShowV8");
                            } else {
                                row.IsVisibleEdit = true;
                            }

                            if (!self.DiyCommon.IsNull(self.SysMenuModel.DelCodeShowV8)) {
                                row.IsVisibleDel = self.LimitMoreBtn1Sync(self.SysMenuModel.DelCodeShowV8, row, "DelCodeShowV8");
                            } else {
                                row.IsVisibleDel = true;
                            }
                        }
                        // 为树形子节点数据也调用DiguiDiyTableRowDataList来处理按钮显示
                        self.DiguiDiyTableRowDataList(result.Data, undefined);
                        console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开按钮V8条件执行总耗时`);

                        console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开处理数据列表总耗时`);
                        console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开渲染数据列表总耗时`);

                        // self.DiyTableRowList = result.Data
                        resolve(result.Data);

                        self.$nextTick(() => {
                            console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]树形展开渲染数据列表总耗时`);
                        });
                    } else {
                        resolve([]);
                    }
                },
                null,
                null,
                "json"
            );
        },
        GetAllData(param) {
            var self = this;
            var params = [
                {
                    Url: self.DiyApi.GetSysMenuModel,
                    Param: {
                        Id: self.SysMenuId
                    }
                },
                {
                    Url: self.DiyApi.GetDiyTableModel,
                    Param: {
                        Id: self.TableId
                    }
                },
                //这里注释是因为需要先获取到SysMenu中的JoinTables，再去获取 DiyFields
                // ,{
                //     Url : DiyApi.GetDiyField,
                //     Param: {
                //         TableId: self.TableId,
                //     }
                // }
                //后来还是在后端处理了
                {
                    Url: self.DiyApi.GetDiyFieldByDiyTables,
                    Param: {
                        TableIds: [self.TableId],
                        SysMenuId: self.SysMenuId
                    }
                }
            ];
            //同时获SysMenuModel、DiyTableModel、DiyFieldList（包含了SysMenu中配置的JoinTables）
            self.DiyCommon.PostAll(params, async function (results) {
                if (self.DiyCommon.Result(results[0]) && self.DiyCommon.Result(results[1])) {
                    // && self.DiyCommon.Result(results[2])
                    // console.log(6666666,results[0])
                    await self.GetSysMenuModelAfter(results[0]);
                    self.GetDiyTableModelAfter(results[1]);
                    //这里注释是因为需要先获取到SysMenu中的JoinTables，再去获取 DiyFields
                    // self.GetDiyField();
                    //后来还是由后端处理了，这里面要用到SysMenuModel，所以要先处理 GetSysMenuModelAfter。
                    //但是注意一点：GetSysMenuModelAfter 里面的GetDiyTableRow方法下面有句GetShowDiyFieldList这个代码，一定要在GetDiyFieldAfter处理好后执行。
                    self.GetDiyFieldAfter(results[2]);

                    // 补充加载SearchFieldIds引用但DiyFieldList中缺失的表字段
                    await self.EnsureSearchFieldsLoaded();

                    //2022-05-14 新增：全部After处理好了再获取数据
                    var isInit = param && param.IsInit ? true : false;
                    self.GetDiyTableRow({ _PageIndex: 1, IsInit: isInit });
                }
            });
            // self.GetSysMenuModel();
            // self.GetDiyTableModel()
            // self.GetDiyField()
        },
        GetDiyTableMaxHeight() {
            var self = this;
            if (self._IsTableChild || self.PropsIsJoinTable === true || self.PropsTableType == "OpenTable") {
                //如果子表返回 auto，同样也会固定表头，所以直接return。
                return;
            }
            if (!self.DiyCommon.IsNull(self.TableId)) {
                var offset = $("#diy-table-" + self.TableId).offset();
                if (offset) {
                    var top = offset.top;
                    // var height = $('#diy-table-' + self.TableId).height();
                    var result = `calc(100vh - ${top}px - 55px)`;
                    // $('#diy-table-' + self.TableId).height(result);
                    return result;
                }
            }
            return "auto";
        },
        SetDiyTableMaxHeight() {
            var self = this;
            if (!self._IsTableChild) {
                var height = self.GetDiyTableMaxHeight();
                if (height) {
                    $("#diy-table-" + self.TableId).height(height);
                }
            }
        },
        // 🔥 性能优化：每次表格数据刷新后调用，重置懒渲染窗口并绑定滚动监听
        ResetLazyRender() {
            // 已取消滚动懒渲染：不再分批追加渲染，仅在 DOM 更新后将滚动位置重置到顶部。
            var self = this;
            self.$nextTick(() => {
                if (self._isDestroyed) return;
                var root = document.getElementById('diy-table-' + self.TableId);
                if (!root) return;
                var wrapper = root.querySelector('.el-scrollbar__wrap')
                           || root.querySelector('.el-table__body-wrapper');
                if (wrapper) {
                    try { wrapper.scrollTop = 0; } catch (e) {}
                }
            });
        },
        // 🔥 已取消滚动懒渲染：保留空实现，避免其它地方调用报错
        BindLazyScroll() {
            return;
        },
        // 🔥 解绑滚动监听
        UnbindLazyScroll() {
            var self = this;
            if (self._lazyScrollWrapper && self._lazyScrollHandler) {
                try { self._lazyScrollWrapper.removeEventListener('scroll', self._lazyScrollHandler); } catch (e) {}
            }
            self._lazyScrollWrapper = null;
            self._lazyScrollHandler = null;
        },
        DiyTableRowSortChange(sortParam) {
            var self = this;
            if (self.DiyCommon.IsNull(sortParam.order)) {
                self.clearColSort(sortParam.prop);
            } else {
                var orderByType = sortParam.order == "ascending" ? "asc" : "desc";
                //-----修复Table组件排序不轮询的bug，永远返回的都是asc
                if (self.LastOrderBy == orderByType + "|" + sortParam.prop) {
                    var forType = ["asc", "desc", ""];
                    var currentType = self.LastOrderBy.split("|")[0];
                    var currentIndex = forType.indexOf(currentType);
                    if (currentIndex + 1 > 2) {
                        currentIndex = 0;
                    } else {
                        currentIndex++;
                    }
                    orderByType = forType[currentIndex];
                }
                //-----end
                var orderBys = Object.assign({}, self._OrderBys || {});
                if (self.DiyCommon.IsNull(orderByType)) {
                    delete orderBys[sortParam.prop];
                } else {
                    orderBys[sortParam.prop] = orderByType;
                }
                self._OrderBys = orderBys;
                self.syncLegacyOrderState();
            }
            self.GetDiyTableRow();
        },
        // SortShowHideFieldsList(tempArr) {
        //     var self = this;
        //     if (self.ShowHideFieldsList.length > 0) {
        //         for (let index = 1; index <= self.ShowHideFieldsList.length; index++) {
        //             //先查询到上一个字段所在位置
        //             var firstIndex = _u.findIndex(tempArr, {
        //                 Name: self.ShowHideFieldsList[index - 1]
        //             });
        //             if (firstIndex != -1) {
        //                 //如果下一个位置的值和现在这个不相等
        //                 if (tempArr[firstIndex + 1] && self.ShowHideFieldsList[index] != tempArr[firstIndex + 1].Name) {
        //                     //获取老位置
        //                     var currentIndex = _u.findIndex(tempArr, {
        //                         Name: self.ShowHideFieldsList[index]
        //                     });
        //                     if (currentIndex != -1) {
        //                         //缓存用于替换的值
        //                         var currentModel = { ...tempArr[currentIndex] };
        //                         //删除老位置
        //                         tempArr.splice(currentIndex, 1);
        //                         //重新获取老位置
        //                         firstIndex = _u.findIndex(tempArr, {
        //                             Name: self.ShowHideFieldsList[index - 1]
        //                         });
        //                         //插入新位置
        //                         tempArr.splice(firstIndex + 1, 0, currentModel);
        //                     }
        //                 }
        //             }
        //         }
        //         //
        //         //self.ShowHideFieldsList
        //         // console.log(self.ShowHideFieldsList);
        //         // console.log(tempArr[6].Name + ',' + tempArr[7].Name+ ',' + tempArr[8].Name+ ',' + tempArr[9].Name+ ',' + tempArr[10].Name+ ',' + tempArr[11].Name);
        //     }
        // },

        GetDiyTableRow(recParam,type) {
            let self = this;
            //zhy此处通过判断是pc或移动端的搜索条件，来决定如何合并搜索条件。type1,2为移动端下拉菜单搜索和更多搜索，3，4为PC端外部搜索和更多搜索
            // console.log(recParam,type,666666)
            if(recParam && recParam._Where && recParam._Where.length > 0 && (type == 1 || type == 2 || type == 3 || type == 4)){
              if(type == 1 && self.hbParam1.length == 0){
                self.hbParam1 = recParam._Where;
              }else if(type == 1 && self.hbParam1.length > 0){
                self.hbParam1 = [];
                self.hbParam1 = recParam._Where;
              }else if(type == 2 && self.hbParam2.length == 0){
                self.hbParam2 = recParam._Where;
              }else if(type == 2 && self.hbParam2.length > 0){
                self.hbParam2 = [];
                self.hbParam2 = recParam._Where;
              }else if(type == 3 && self.hbParam3.length == 0){
                self.hbParam3 = recParam._Where;
              }else if(type == 3 && self.hbParam3.length > 0){
                self.hbParam3 = [];
                self.hbParam3 = recParam._Where;
              }else if(type == 4 && self.hbParam4.length == 0){
                self.hbParam4 = recParam._Where;
              }else if(type == 4 && self.hbParam4.length > 0){
                self.hbParam4 = [];
                self.hbParam4 = recParam._Where;
              }
            }
            // 2026-04-26 Anderson 修复：typed 搜索（diy-search/diy-mobile-search）传入空 _Where 表示清空该来源的搜索条件
            // 否则该来源的旧 hbParam 会一直残留，导致后续调用拿到过期搜索条件
            if (recParam && recParam._Where && recParam._Where.length === 0 && (type == 1 || type == 2 || type == 3 || type == 4)) {
                if (type == 1) self.hbParam1 = [];
                else if (type == 2) self.hbParam2 = [];
                else if (type == 3) self.hbParam3 = [];
                else if (type == 4) self.hbParam4 = [];
            }
            let hbYdParams = [];
            let hbPcParams = [];
            hbYdParams=[...self.hbParam1,...self.hbParam2];
            hbPcParams=[...self.hbParam3,...self.hbParam4];
            // 2026-04-26 Anderson 修复：将 typed 搜索（diy-search 等）合并后的 _Where 持久化到 self.SearchWhere
            // 这样后续的"无 type 调用"（如搜索框 append 按钮、ExportDiyTableRow、V8按钮里调用 V8.GetDiyTableRow 等）
            // 才能通过下方 `else if (self.SearchWhere.length > 0)` 分支保留住搜索条件，避免搜索丢失
            if (type == 1 || type == 2 || type == 3 || type == 4) {
                let _typedCombinedWhere = [];
                if (type == 1 || type == 2) {
                    _typedCombinedWhere = hbYdParams;
                } else {
                    _typedCombinedWhere = hbPcParams;
                }
                self.SearchWhere = _typedCombinedWhere;
            }
            // ========== 关键：立即递增版本号取消所有旧操作 ==========
            self._paginationVersion++;
            const currentVersion = self._paginationVersion;

            // 检查是否是移动端追加模式
            var isAppendMode = recParam && recParam._append === true;

            // ========== 关键：取消正在进行的HTTP请求 ==========
            if (self._currentAbortController) {
                self._currentAbortController.abort();
            }
            self._currentAbortController = new AbortController();
            const abortSignal = self._currentAbortController.signal;

            // 🔥 移动端追加模式不显示加载状态，避免骨架屏闪烁
            if (!(isAppendMode && self.diyStore.IsPhoneView)) {
                self.tableLoading = true;
            }

            // ========== 内存优化：不再清空数据，避免二次渲染 ==========
            // 注意：移除了 self.DiyTableRowList = [] 因为这会触发一次无意义的DOM渲染
            self.OldDiyTableRowList = [];
            // ========== 内存优化 END ==========

            //2023-06-29：如果是表单设计模式，无需获取数据
            if (self.LoadMode == "Design") {
                //---------处理需要真实显示的字段
                //注意：执行此句的时候，一定要保证 GetDiyField 已经执行完毕，所以在GetDiyField的时候，也需要调用一下这个方法？
                var tempShowDiyFieldList = self.GetShowDiyFieldList();
                //--------
                self.tableLoading = false;
                return;
            }
            if (recParam) {
                if (recParam.SearchCheckbox) {
                    self.SearchCheckbox = recParam.SearchCheckbox;
                }
                if (recParam.SearchModel) {
                    self.SearchModel = recParam.SearchModel;
                }
                if (recParam.SearchNumber) {
                    self.SearchNumber = recParam.SearchNumber;
                }
                if (recParam.SearchDateTime) {
                    self.SearchDateTime = recParam.SearchDateTime;
                }
            }

            self.TempBtnIsVisible = [];

            if (typeof recParam == "boolean" && recParam === true) {
                self.DiyTableRowPageIndex = 1;
            } else if (!self.DiyCommon.IsNull(recParam)) {
                if (!self.DiyCommon.IsNull(recParam._PageIndex)) {
                    if (recParam._PageIndex == -1) {
                        //算出最后一页
                        if (self.DiyTableRowCount != 0) {
                            self.DiyTableRowPageIndex = Math.ceil(self.DiyTableRowCount / self.DiyTableRowPageSize);
                        }
                    } else {
                        self.DiyTableRowPageIndex = recParam._PageIndex;
                    }
                }
            }
            var param = {
                // TableId: self.TableId,
                // TableName : self.CurrentDiyTableModel.Name,
                // FormEngineKey : self.CurrentDiyTableModel.Name,
                // _Keyword: self.Keyword,
                // _PageIndex: self.DiyTableRowPageIndex,
                // _PageSize: self.DiyTableRowPageSize,
                // _SysMenuId: self.SysMenuId,
                ModuleEngineKey: self.SysMenuModel.ModuleEngineKey
            };
            self.applyTableOrderParams(param);
            //2023-06-39：子表可关闭分页
            if (!self.TableChildConfig || (self.TableChildConfig && !self.TableChildConfig.DisablePagination)) {
                param._PageIndex = self.DiyTableRowPageIndex;
                param._PageSize = self.DiyTableRowPageSize;
                // 🔥 手机端 + 卡片模式强制每页 15 条（PC端按用户配置）
                if (self.diyStore && self.diyStore.IsPhoneView
                    && self.TableDisplayMode === 'Card' && (!param._PageSize || param._PageSize > 15)) {
                    param._PageSize = 15;
                }
            }

            //zhy此处添加移动和PC合并搜索的参数传接
            if (recParam && recParam._Where && recParam._Where.length > 0 && (type == 1 || type == 2)){
                param._Where = hbYdParams;
            } else if (recParam && recParam._Where && recParam._Where.length > 0 && (type == 3 || type == 4)){
                param._Where = hbPcParams;
            } else if (recParam && recParam._Where && recParam._Where.length > 0) {
                param._Where = recParam._Where;
                self.SearchWhere = param._Where;
            } else if (recParam && recParam._Where && recParam._Where.length == 0) {
                self.SearchWhere = [];
                delete param._Where;
            } else if (self.SearchWhere.length > 0) {
                param._Where = self.SearchWhere;
            } else {
                self.SearchWhere = [];
                delete param._Where;
            }

            if (self.PropsWhere && self.PropsWhere.length > 0) {
                param._Where = self.mergeWhereList(param._Where, self.PropsWhere);
            }

            //2024-12-14新增
            if (self.Where.length > 0) {
                if (!param._Where) {
                    param._Where = [];
                }
                self.Where.forEach((item) => {
                    //2026-01-12 Anderson：支持新版_Where
                    if (Array.isArray(item)) {
                        param._Where.push(item);
                    } else {
                        const index = param._Where.findIndex((d) => d.Name == item.Name);
                        if (index === -1) {
                            param._Where.push(item);
                        } else {
                            param._Where[index] = { ...param._Where[index], ...item };
                        }
                    }
                });
            }

            if (self.Keyword) {
                param._Keyword = self.Keyword;
            }

            // if(!param.TableName){
            //先设置模块引擎Key
            if (!param.ModuleEngineKey) {
                param.ModuleEngineKey = self.SysMenuId;
            }
            //如果仍然不存在模块引擎Key，设置表单引擎Key
            if (!param.ModuleEngineKey) {
                param.FormEngineKey = self.CurrentDiyTableModel.Name;
            }
            if (!param.ModuleEngineKey && !param.FormEngineKey) {
                param.FormEngineKey = self.TableId;
            }

            //注意：这个是由主表传过来的主表行Id，需要在这里子表加入条件：where 外键Id=TableChildFkFieldName
            if (self.IsTrashMode) {
                param.IsDeleted = 1;
            }
            if (!self.DiyCommon.IsNull(self.TableChildFkFieldName)) {
                // param[self.TableChildFkFieldName] = self.TableChildFkValue;
                //2021-10-25 新增：如果是传过来的父级formModel，以这个为准
                if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    // if (!self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
                    // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    // // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel.Id;
                    //2022-02-14 关联表修改为等值条件
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data[self.PrimaryTableFieldName];
                    } else {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    }
                } else {
                    // self.SearchModel[self.TableChildFkFieldName] = self.TableChildTableRowId;
                    //2022-02-14 关联表修改为等值条件
                    self.SearchEqual[self.TableChildFkFieldName] = self.TableChildTableRowId;
                }
            }

            //判断外部传来的新增条件SearchAppend
            if (!self.DiyCommon.IsNull(self.SearchAppend)) {
                for (const key in self.SearchAppend) {
                    self.V8SearchModel[key] = self.SearchAppend[key];
                }
            }

            // //这里需要判断 V8SearchModel
            // if(!self.DiyCommon.IsNull(self.SearchSet)){
            //     self.V8SearchModel = self.SearchSet;
            // }

            //这里需要判断 V8SearchModel
            if (!self.DiyCommon.IsNull(self.V8SearchModel)) {
                for (const key in self.V8SearchModel) {
                    self.SearchModel[key] = self.V8SearchModel[key];
                }
            }

            //2022-07-26新增 url 参数 _SearchDateTime 搜索条件
            var _searchDateTime = self.$route.query._SearchDateTime;
            if (self.IsTableChild()) {
                _searchDateTime = "";
            }
            if (_searchDateTime) {
                var _searchDateTimeArr = _searchDateTime.split("|");
                if (_searchDateTimeArr.length == 3) {
                    self.SearchDateTime[_searchDateTimeArr[0]] = [_searchDateTimeArr[1], _searchDateTimeArr[2]];
                }
            }
            if (self.SearchModel && !_u.isEqual(self.SearchModel, {})) {
                param._Search = self.SearchModel;
            }
            if (self.SearchEqual && !_u.isEqual(self.SearchEqual, {})) {
                param._SearchEqual = self.SearchEqual;
            }
            if (self.SearchCheckbox && !_u.isEqual(self.SearchCheckbox, {})) {
                param._SearchCheckbox = self.SearchCheckbox;
            }
            if (self.SearchDateTime && !_u.isEqual(self.SearchDateTime, {})) {
                param._SearchDateTime = self.SearchDateTime;
            }
            if (self.SearchNumber) {
                for (let key in self.SearchNumber) {
                    if (self.SearchNumber[key].Min || self.SearchNumber[key].Max) {
                        param._SearchNumber = self.SearchNumber;
                        break;
                    }
                }
            }
            //判断模块引擎是否配置了查询接口替换
            var url = self.DiyApi.GetDiyTableRow;
            var paramType = "";
            if (self.CurrentDiyTableModel.IsTree) {
                url = self.DiyApi.GetTableDataTree;
            } else {
                url = "/api/FormEngine/GetTableData-" + (param.ModuleEngineKey || param.FormEngineKey).replace(/\_/g, "-").toLowerCase();
                paramType = "json";
            }
            // url = '/api/diytable/getDiyTableRowTree';
            if (self.SysMenuModel && self.SysMenuModel.SelectApi) {
                url = self.DiyCommon.RepalceUrlKey(self.SysMenuModel.SelectApi);
            }
            //2024-04-24：如果是报表引擎，通过数据源引擎获取数据
            if (self.CurrentDiyTableModel.ReportId && self.CurrentDiyTableModel.DataSourceId) {
                url = "/api/DataSourceEngine/Run";
                param.DataSourceKey = self.CurrentDiyTableModel.DataSourceId;
            }
            self.DiyCommon.Post(
                url,
                param,
                async function (result) {
                    // ========== 内存优化：检查组件是否已销毁或版本号不匹配 ==========
                    if (self._isDestroyed || self._paginationVersion !== currentVersion) {
                        return;
                    }

                    self.tableLoading = false;

                    if (self.DiyCommon.Result(result)) {
                        console.log('[数据加载调试] 返回数据条数:', result.Data?.length, '总数:', result.DataCount);
                        console.log('[数据加载调试] isAppendMode:', isAppendMode, 'IsPhoneView:', self.diyStore.IsPhoneView);
                        console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]处理数据列表总耗时`);

                        //统计列的值，后来应该改成单独接口
                        if (result.DataAppend && result.DataAppend.StatisticsFields) {
                            self.StatisticsFields = result.DataAppend.StatisticsFields;
                        } else {
                            self.StatisticsFields = null;
                        }

                        //---------处理需要真实显示的字段（必须同步执行，否则列不显示）
                        var tempShowDiyFieldList = self.GetShowDiyFieldList();

                        // 性能优化：找出需要模板引擎处理的字段
                        var templateEngineFields = tempShowDiyFieldList.filter((field) => !self.DiyCommon.IsNull(field.V8TmpEngineTable));
                        // 卡片模式下，CardTitleTagFields/CardBottomTagFields中的V8TmpEngineTable字段也需处理
                        if (self.TableDisplayMode === 'Card') {
                            var extraTagFields = [].concat(self.CardTitleTagFieldList || [], self.CardBottomTagFieldList || [], self.CardShowDiyFieldList || []);
                            extraTagFields.forEach(function(f) {
                                if (f && !self.DiyCommon.IsNull(f.V8TmpEngineTable) && !templateEngineFields.some(function(e) { return e.Id === f.Id; })) {
                                    templateEngineFields.push(f);
                                }
                            });
                        }

                        // 性能优化：先设置基础数据，让用户快速看到列表
                        for (var i = 0; i < result.Data.length; i++) {
                            // 默认都显示，后续异步更新
                            result.Data[i].IsVisibleDetail = true;
                            result.Data[i].IsVisibleEdit = true;
                            result.Data[i].IsVisibleDel = true;
                            result.Data[i]._RowMoreBtnsOut = [];
                            result.Data[i]._RowMoreBtnsIn = [];
                        }

                        // 先设置总数（但不设置数据，等V8处理完再一次性显示）
                        // 如果不是追加模式，更新总数
                        if (!isAppendMode) {
                            self.DiyTableRowCount = result.DataCount;
                        }


                        // ========== 同步处理V8按钮和模板引擎 ==========
                        // 版本检查，确保没有新的分页请求
                        if (!self._isDestroyed && self._paginationVersion === currentVersion) {
                            // 处理按钮显示条件
                            self.IsVisibleAdd = true;
                            var moreBtns = self.SysMenuModel.MoreBtns || [];
                            var moreBtnsOutTemplate = moreBtns.filter(item => item.ShowRow === true || item.ShowRow === 1) || [];
                            var moreBtnsInTemplate = moreBtns.filter(item => item.ShowRow === false || item.ShowRow === 0) || [];
                            self.MaxRowBtnsOut = 0;
                            self.HasVisibleMoreBtnsIn = false;

                            console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]按钮V8条件执行总耗时`);

                            // 初始化统计
                            self._btnPerfStats = {};

                            // 预先缓存权限查询结果
                            var cachedRoleLimit = self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);

                            // 初始化共享V8
                            var sharedV8 = self.DiyCommon.InitV8CodeSync({}, self.$router);
                            sharedV8.EventName = "V8BtnLimit";
                            sharedV8._cachedRoleLimit = cachedRoleLimit;
                            self.SetV8DefaultValue(sharedV8);

                            for (var i = 0; i < result.Data.length; i++) {
                                if (self._paginationVersion !== currentVersion) break;

                                var row = result.Data[i];
                                var rowBtnsOut = moreBtnsOutTemplate.map(btn => ({ ...btn }));
                                var rowBtnsIn = moreBtnsInTemplate.map(btn => ({ ...btn }));

                                // 为每行更新Form属性
                                var form = { ...row };
                                // sharedV8.Form = self.DeleteFormProperty(form);
                                sharedV8.Form = form;
                                sharedV8.FormSet = (fieldName, value) => self.FormSet(fieldName, value, row);
                                sharedV8.OpenForm = (r, type) => self.OpenDetail(r, type, true);
                                sharedV8.OpenFormWF = (r, type, wfParam) => self.OpenDetail(r, type, true, true, wfParam);

                                // 同步执行按钮处理
                                self.HandlerBtns(rowBtnsOut, row, sharedV8);
                                self.HandlerBtns(rowBtnsIn, row, sharedV8);

                                row._RowMoreBtnsOut = rowBtnsOut;
                                row._RowMoreBtnsIn = rowBtnsIn;

                                // 计算操作列宽度
                                var allOutBtn = row._RowMoreBtnsOut.filter(item => item.IsVisible === true || item.IsVisible === 1);
                                var allOutBtnLength = 0;
                                allOutBtn.forEach(el => { allOutBtnLength += el.Name.length; });
                                var newWidth = allOutBtnLength * 15 + allOutBtn.length * 45;
                                if (self.MaxRowBtnsOut < newWidth) self.MaxRowBtnsOut = newWidth;

                                // 追踪是否有可见的内部按钮（用于动态计算操作列宽度）
                                if (!self.HasVisibleMoreBtnsIn && rowBtnsIn.some(btn => btn.IsVisible)) {
                                    self.HasVisibleMoreBtnsIn = true;
                                }
                            }

                            console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]按钮V8条件执行总耗时`);

                            // 非懒加载树形模式：递归处理 _Child 子节点的按钮可见性
                            if (self.CurrentDiyTableModel.IsTree && !(self.CurrentDiyTableModel.TreeLazy === true || self.CurrentDiyTableModel.TreeLazy === 1)) {
                                self.DiguiDiyTableRowDataList(result.Data, currentVersion);
                            }

                            if (templateEngineFields.length > 0) {
                                console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]模板引擎V8执行总耗时`);

                                for (var i = 0; i < result.Data.length; i++) {
                                    if (self._paginationVersion !== currentVersion) break;

                                    var row = result.Data[i];
                                    for (var j = 0; j < templateEngineFields.length; j++) {
                                        var field = templateEngineFields[j];
                                        try {
                                            var tmpResult = self.RunFieldTemplateEngine(field, row);
                                            row[field.Name + '_TmpEngineResult'] = tmpResult;
                                        } catch (e) {
                                            console.warn('模板引擎处理错误:', field.Name, e);
                                        }
                                    }
                                }

                                console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]模板引擎V8执行总耗时`);
                            }

                            // 🔥 性能优化（关键）：用 markRaw 标记每一行，跳过 Vue 深响应代理。
                            // 大分页(200/500条)时这一步可以把渲染耗时和内存占用降低 50%+。
                            // 注意：标记后，行内属性的后续变更不会触发响应式更新——
                            // 但本组件刷新数据时是整个 DiyTableRowList = result.Data 一次性替换，
                            // 不会有"刷新后又异步改某行某字段"的场景，因此安全。
                            // 🔥 性能优化：用 markRaw 标记每一行跳过 Vue 深响应代理。
                            // ⚠️ 不要 Object.freeze 按钮数组——beforeUnmount 中需要 .length=0 清理，
                            //    否则会抛 "Cannot assign to read only property 'length'" 导致后续表单无法打开。
                            for (var rk = 0; rk < result.Data.length; rk++) {
                                var rawRow = result.Data[rk];
                                if (rawRow && typeof rawRow === 'object') {
                                    try { markRaw(rawRow); } catch (e) {}
                                }
                            }

                            // 所有V8处理完成后，直接赋值（不需要map，数据已在原数组修改）
                            // 移动端追加模式：将新数据追加到现有列表
                            if (isAppendMode && self.diyStore.IsPhoneView && recParam._bidirectional) {
                                // 🔥 双向无限滚动模式：维护30条窗口
                                const newList = self.DiyTableRowList.concat(result.Data);

                                // 更新已加载总数
                                self._mobileTotalLoaded += result.Data.length;

                                if (newList.length > self._mobileMaxRenderCount) {
                                    // 移除顶部旧数据，保持30条窗口
                                    const removeCount = newList.length - self._mobileMaxRenderCount;
                                    self.DiyTableRowList = newList.slice(removeCount);
                                    // 更新窗口起始位置
                                    self._mobileWindowStart += removeCount;
                                    console.log(`[双向滚动] 移除顶部 ${removeCount} 条，窗口起始: ${self._mobileWindowStart}, 渲染: ${self.DiyTableRowList.length} 条`);
                                } else {
                                    self.DiyTableRowList = newList;
                                }
                            } else if (isAppendMode && self.diyStore.IsPhoneView) {
                                // 普通追加模式（兼容旧逻辑）
                                self.DiyTableRowList = self.DiyTableRowList.concat(result.Data);
                            } else {
                                // 首次加载或PC端
                                self.DiyTableRowList = result.Data;
                                console.log('[数据加载调试] 首次加载，赋值数据条数:', result.Data.length);
                                if (self.diyStore.IsPhoneView) {
                                    // 初始化窗口位置
                                    self._mobileWindowStart = 0;
                                    self._mobileTotalLoaded = result.Data.length;
                                    console.log('[双向滚动] 初始化，加载:', result.Data.length, '条');
                                } else {
                                    // 🔥 PC端：重置懒渲染窗口（首屏只渲染前 _lazyRenderInitial 行，后续滚动追加）
                                    self.ResetLazyRender();
                                }
                            }
                            console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]处理数据列表总耗时`);
                            console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]渲染数据列表总耗时`);
                            self.$nextTick(() => {
                                console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]渲染数据列表总耗时`);
                                // 🔥 记录渲染完成时间，用于防止频繁触发加载
                                if (isAppendMode && self.diyStore.IsPhoneView) {
                                    self._lastLoadTime = Date.now();
                                    // 延迟重置加载状态，确保用户能看到"正在加载更多数据"提示
                                    setTimeout(() => {
                                        self.mobileLoadingMore = false;
                                    }, 300);
                                }
                            });
                        }

                        if (self.PropTableMultipleSelection) {
                            self.TableMultipleSelection = [];
                            self.$nextTick(() => {
                                if (self._paginationVersion === currentVersion) {
                                    self.toggleSelection(self.PropTableMultipleSelection, "Y");
                                }
                            });
                        }
                        // 内存优化：只保存ID
                        self.OldDiyTableRowList = result.Data.map((row) => ({ Id: row.Id }));

                        if (result.DataAppend && result.DataAppend.NotSaveField) {
                            self.NotSaveField = result.DataAppend.NotSaveField;
                        }

                        //2025-08-07 --anderson
                        var formDataId = self.$route.query.FormDataId;
                        if (self.IsTableChild()) {
                            formDataId = "";
                        }
                        if (formDataId && recParam && recParam.IsInit && !self.IsTableChild()) {
                            self.OpenDetail({ Id: formDataId }, "View", true);
                        }
                    }
                },
                null,
                null,
                paramType
            );
        },
        InputGetDiyTableRow(obj) {
            this.DebounceGetDiyTableRow(obj, this);
        },
        DebounceGetDiyTableRow: debounce((obj, self) => {
            self.GetDiyTableRow(obj);
        }, 500),
        DiguiDiyTableRowDataList(firsrtData, paginationVersion) {
            var self = this;

            // 内存优化：检查版本号，如果不匹配则中断处理
            if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                return;
            }

            // 内存优化：缓存按钮模板，避免每行都重新查询
            // 注意：每次分页都重新获取，确保模板是最新的
            var moreBtnsOutTemplate = (self.SysMenuModel.MoreBtns || []).filter(item => item.ShowRow === true || item.ShowRow === 1) || [];
            var moreBtnsInTemplate = (self.SysMenuModel.MoreBtns || []).filter(item => item.ShowRow === false || item.ShowRow === 0) || [];

            //注意：这个result.Data可能是树形，  --2022-07-02
            for (let index = 0; index < firsrtData.length; index++) {
                // 内存优化：每行处理前检查版本号
                if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                    return;
                }

                //result.Data
                let row = firsrtData[index]; //result.Data
                if (!row.Id && (row.id || row.ID)) {
                    row.Id = row.id || row.ID;
                }

                // 使用模板创建副本
                let _rowMoreBtnsOutCopy = moreBtnsOutTemplate.map(element => ({ ...element }));

                self.HandlerBtns(_rowMoreBtnsOutCopy, row);
                row._RowMoreBtnsOut = _rowMoreBtnsOutCopy;

                //取列表数据中可能存在的最多按钮数量
                // var maxLength = _rowMoreBtnsOutCopy.filter(item => item.IsVisible === true || item.IsVisible === 1).length;
                var allOutBtn = _rowMoreBtnsOutCopy.filter(item => item.IsVisible === true || item.IsVisible === 1);
                var allOutBtnLength = 0;
                allOutBtn.forEach((element) => {
                    allOutBtnLength += element.Name.length;
                });
                //之前是 MaxRowBtnsOut*115 按按钮数量来，现在按文字数量来 2022-07-24
                //定在一个字：15   一个按钮  30  还有2个按钮的空隙 15
                var newWidth = allOutBtnLength * 20 + allOutBtn.length * 50;
                // if (self.MaxRowBtnsOut < maxLength) {
                if (self.MaxRowBtnsOut < newWidth) {
                    // self.MaxRowBtnsOut = maxLength;
                    self.MaxRowBtnsOut = newWidth;
                }

                // 使用模板创建副本
                let _rowMoreBtnsInCopy = moreBtnsInTemplate.map(element => ({ ...element }));

                self.HandlerBtns(_rowMoreBtnsInCopy, row);
                row._RowMoreBtnsIn = _rowMoreBtnsInCopy;

                // 追踪是否有可见的内部按钮
                if (!self.HasVisibleMoreBtnsIn && _rowMoreBtnsInCopy.some(btn => btn.IsVisible)) {
                    self.HasVisibleMoreBtnsIn = true;
                }

                //刘诚2025-6-29新增，判断默认的显示和删除按钮是否显示
                // 注意：IsVisibleDetail/Edit/Del 已经在 GetDiyTableRow 的 for 循环中处理过了
                // 只有在树形结构的子节点中才需要处理（因为子节点不在 GetDiyTableRow 的 for 循环中）
                if (self.CurrentDiyTableModel.IsTree && row["_Child"] && row["_Child"].length > 0) {
                    // 内存优化：检查版本号
                    if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                        return;
                    }
                    // 递归处理子节点时，子节点需要设置 IsVisible 属性
                    for (let childIndex = 0; childIndex < row["_Child"].length; childIndex++) {
                        // 内存优化：每个子节点处理前检查版本号
                        if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                            return;
                        }
                        let childRow = row["_Child"][childIndex];
                        if (!self.DiyCommon.IsNull(self.SysMenuModel.DetailCodeShowV8)) {
                            let btn = self.SysMenuModel.DetailCodeShowV8;
                            childRow.IsVisibleDetail = self.LimitMoreBtn1Sync(btn, childRow, "DetailCodeShowV8");
                        } else {
                            childRow.IsVisibleDetail = true;
                        }
                        if (!self.DiyCommon.IsNull(self.SysMenuModel.EditCodeShowV8)) {
                            let btn = self.SysMenuModel.EditCodeShowV8;
                            childRow.IsVisibleEdit = self.LimitMoreBtn1Sync(btn, childRow, "EditCodeShowV8");
                        } else {
                            childRow.IsVisibleEdit = true;
                        }
                        if (!self.DiyCommon.IsNull(self.SysMenuModel.DelCodeShowV8)) {
                            let btn = self.SysMenuModel.DelCodeShowV8;
                            childRow.IsVisibleDel = self.LimitMoreBtn1Sync(btn, childRow, "DelCodeShowV8");
                        } else {
                            childRow.IsVisibleDel = true;
                        }
                    }
                    self.DiguiDiyTableRowDataList(row["_Child"], paginationVersion);
                }

                //2022-06-17 新增：值数据处理，如级联应该处理成json, DiyForm的DiyFieldStrToJson函数有处理，
                //暂时先放到了DiyDepartment、DiyCascader中处理
            }
        },
        //param: { _PageIndex : 1 }
        RefreshDiyTableRowList(param) {
            var self = this;
            //2021-09-26 同时也重新获取列

            self.GetDiyTableRow(param);
        },
    }
};
