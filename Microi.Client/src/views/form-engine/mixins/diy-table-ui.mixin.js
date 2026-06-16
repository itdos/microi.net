import _u from "underscore";

export default {
    methods: {
LoadFabPosition() {
        try {
          var raw = localStorage.getItem('microi_fab_position_table');
          if (raw) {
            var pos = JSON.parse(raw);
            if (pos && typeof pos.right == 'number' && typeof pos.bottom == 'number') {
              this.fabPosition = this.ClampFabPosition(pos.right, pos.bottom);
            }
          }
        } catch (e) { /* ignore */ }
      },
      SaveFabPosition() {
        try {
          if (this.fabPosition) {
            localStorage.setItem('microi_fab_position_table', JSON.stringify(this.fabPosition));
          }
        } catch (e) { /* ignore */ }
      },
      GetFabContainerStyle() {
        if (this.fabPosition) {
          return { right: this.fabPosition.right + 'px', bottom: this.fabPosition.bottom + 'px' };
        }
        return {};
      },
      ClampFabPosition(right, bottom, btnSize) {
        var size = btnSize || 54;
        var minMargin = 8;
        // 列表页底部一般有 tabbar，预留 90px
        var tabBarEl = document.querySelector('.mobile-tab-bar, .van-tabbar, .el-tabbar, .tabbar, .mobile-bottom-nav');
        var bottomReserved = tabBarEl && tabBarEl.offsetHeight ? (tabBarEl.offsetHeight + 8) : 90;
        var topReserved = 60;
        var maxRight = Math.max(minMargin, window.innerWidth - size - minMargin);
        var maxBottom = Math.max(bottomReserved, window.innerHeight - size - topReserved);
        return {
          right: Math.max(minMargin, Math.min(maxRight, right)),
          bottom: Math.max(bottomReserved, Math.min(maxBottom, bottom))
        };
      },
      OnFabPointerDown(e) {
        var self = this;
        var isTouch = e.type === 'touchstart';
        if (!isTouch && e.button !== 0) return;
        var pt = isTouch ? e.touches[0] : e;
        var startX = pt.clientX, startY = pt.clientY;
        var btnEl = e.currentTarget;
        var containerEl = btnEl.closest('.mobile-fab-container');
        if (!containerEl) return;
        var rect = btnEl.getBoundingClientRect();
        var btnW = rect.width, btnH = rect.height;
        var startRight = window.innerWidth - rect.right;
        var startBottom = window.innerHeight - rect.bottom;
        var moved = false;
        var threshold = 5;
        var minMargin = 8;
        var tabBarEl = document.querySelector('.mobile-tab-bar, .van-tabbar, .el-tabbar, .tabbar, .mobile-bottom-nav');
        var bottomReserved = tabBarEl && tabBarEl.offsetHeight ? (tabBarEl.offsetHeight + 8) : 90;
        var topReserved = 60;
        var maxRight = window.innerWidth - btnW - minMargin;
        var maxBottom = window.innerHeight - btnH - topReserved;
        var lastRight = startRight, lastBottom = startBottom;
        var rafId = null;

        var applyDom = function() {
          rafId = null;
          containerEl.style.right = lastRight + 'px';
          containerEl.style.bottom = lastBottom + 'px';
        };
        var moveHandler = function(ev) {
          var p = isTouch ? (ev.touches[0] || ev.changedTouches[0]) : ev;
          if (!p) return;
          var dx = p.clientX - startX;
          var dy = p.clientY - startY;
          if (!moved && Math.hypot(dx, dy) > threshold) moved = true;
          if (moved) {
            lastRight = Math.max(minMargin, Math.min(maxRight, startRight - dx));
            lastBottom = Math.max(bottomReserved, Math.min(maxBottom, startBottom - dy));
            if (rafId == null) rafId = requestAnimationFrame(applyDom);
            if (ev.cancelable) ev.preventDefault();
          }
        };
        var upHandler = function() {
          if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
          if (isTouch) {
            document.removeEventListener('touchmove', moveHandler, { passive: false });
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('touchcancel', upHandler);
          } else {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
          }
          if (moved) {
            self._fabDragJustMoved = true;
            self.fabPosition = { right: lastRight, bottom: lastBottom };
            self.SaveFabPosition();
            setTimeout(function() { self._fabDragJustMoved = false; }, 50);
          }
        };
        if (isTouch) {
          document.addEventListener('touchmove', moveHandler, { passive: false });
          document.addEventListener('touchend', upHandler);
          document.addEventListener('touchcancel', upHandler);
        } else {
          document.addEventListener('mousemove', moveHandler);
          document.addEventListener('mouseup', upHandler);
        }
      },
      OnFabClick() {
        if (this._fabDragJustMoved) return;
        this.showMobileFabMenu = !this.showMobileFabMenu;
      },

      // 移动端清楚复选框数据
      childClearSearch(e){
        this.InitSearch()
        this.GetDiyTableRow({_PageIndex: 1 })
      },
        /**
         * 判断某个字段Id是否在 InTableEditFields 中
         * InTableEditFields 可能是：
         *   - 字符串（逗号分隔或单个Id）：'aaa,bbb'
         *   - 纯Id数组：['aaa', 'bbb']
         *   - 对象数组：[{ Id: 'aaa' }, { Id: 'bbb' }]
         */
        IsInTableEditField(fieldId) {
            const fields = this.SysMenuModel?.InTableEditFields;
            if (!fields) return false;
            if (typeof fields === 'string') {
                return fields.split(',').map(s => s.trim()).indexOf(fieldId) > -1;
            }
            if (Array.isArray(fields)) {
                if (fields.length === 0) return false;
                if (typeof fields[0] === 'object' && fields[0] !== null) {
                    return fields.some(f => f.Id === fieldId);
                }
                return fields.indexOf(fieldId) > -1;
            }
            return false;
        },
        /**
         * ========== 表内编辑【SaveType】中央保存入口 ==========
         * 来自字段子组件 (textarea/select/switch/select-tree) 的 @CallbackInTableEditSave 事件。
         * payload = { row, field, oldValue, newValue, handled }
         * - 设置 payload.handled = true 表示由本方法接管，子组件不再走默认单字段保存逻辑。
         * - 行为：
         *   1) SysMenuModel.SaveType === 'Submit' 仅记录到待提交队列，不调接口。
         *   2) 其它（默认 Auto）取整行数据组装 _FormData，立即调 UptFormData。
         */
        OnInTableEditSave(payload) {
            var self = this;
            if (!payload || !payload.row || !payload.field) return;
            var saveType = self.SysMenuModel && self.SysMenuModel.SaveType;
            payload.handled = true;
            if (saveType === 'Submit') {
                self._RecordPendingChange(payload);
                return;
            }
            self._SaveRowAuto(payload);
        },
        /** 提取整行可提交的 _FormData（剔除框架内部字段、模板渲染缓存等）。 */
        _BuildFullRowFormData(row) {
            var self = this;
            if (!row) return {};
            var formData = {};
            var skipSuffix = '_TmpEngineResult';
            for (var k in row) {
                if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
                if (!k) continue;
                if (k.charAt(0) === '_') continue; // _XXX 前端内部字段
                if (k.length > skipSuffix.length && k.lastIndexOf(skipSuffix) === k.length - skipSuffix.length) continue;
                if (k === 'IsVisibleDetail' || k === 'IsVisibleEdit' || k === 'IsVisibleDel') continue;
                var v = row[k];
                if (typeof v === 'function') continue;
                formData[k] = v;
            }
            if (!self.DiyCommon.IsNull(row.Id)) formData.Id = row.Id;
            try {
                self.DiyCommon.ForRowModelHandler(formData, self.DiyFieldList);
                formData = self.DiyCommon.ConvertRowModel(formData);
            } catch (e) { /* ignore */ }
            return formData;
        },
        _BuildDataLog(payload) {
            return [{
                Name: payload.field.Name,
                Label: payload.field.Label || payload.field.Name,
                Component: payload.field.Component,
                OVal: payload.oldValue == null ? '' : payload.oldValue,
                NVal: payload.newValue == null ? '' : payload.newValue
            }];
        },
        /** Auto 模式：立即保存整行。 */
        _SaveRowAuto(payload) {
            var self = this;
            var row = payload.row;
            var formData = self._BuildFullRowFormData(row);
            var formEngineKey = self.CurrentDiyTableModel && self.CurrentDiyTableModel.Name ? self.CurrentDiyTableModel.Name : self.TableName;
            var param = {
                FormEngineKey: formEngineKey,
                TableId: self.TableId,
                Id: row.Id,
                _FormData: formData,
                _DataLog: JSON.stringify(self._BuildDataLog(payload))
            };
            var apiUrl = self.DiyApi.UptDiyTableRow;
            if (self.CurrentDiyTableModel && self.CurrentDiyTableModel.ApiReplace && self.CurrentDiyTableModel.ApiReplace.Update) {
                apiUrl = self.DiyCommon.RepalceUrlKey(self.CurrentDiyTableModel.ApiReplace.Update);
            }
            self.DiyCommon.Post(apiUrl, param, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self._ApplySavedRowToTable(row, formData);
                    var pendingRefreshParam = self._PendingFieldValueChangeRefreshParam;
                    self._PendingFieldValueChangeRefreshParam = null;
                    if (pendingRefreshParam && typeof self.GetDiyTableRow === 'function') {
                        self.GetDiyTableRow(pendingRefreshParam);
                        setTimeout(function () {
                            self._ApplySavedRowToTable(row, formData);
                        }, 1000);
                        setTimeout(function () {
                            self._ApplySavedRowToTable(row, formData);
                        }, 2500);
                    }
                    self.DiyCommon.Tips(self.$t('Msg.Success'));
                }
            });
        },
        _ApplySavedRowToTable(row, formData) {
            var self = this;
            if (!row || !Array.isArray(self.DiyTableRowList)) return;
            var rowIndex = typeof self.FindDiyTableRowIndexByRow === 'function' ? self.FindDiyTableRowIndexByRow(row) : -1;
            if (rowIndex < 0) return;
            var renderRow = Object.assign({}, self.DiyTableRowList[rowIndex] || row, formData || {}, row);
            if (typeof self.RefreshRowTemplateEngineResult === 'function') {
                self.RefreshRowTemplateEngineResult(renderRow);
            }
            self.DiyTableRowList.splice(rowIndex, 1, renderRow);
        },
        /** Submit 模式：登记待提交。 */
        _RecordPendingChange(payload) {
            var self = this;
            var row = payload.row;
            if (!row) return;
            if (row._IsInTableAdd === true) {
                if (!self._PendingSaveChanges.adds.some(r => r === row || (r && row.Id && r.Id === row.Id))) {
                    self._PendingSaveChanges.adds.push(row);
                }
                row._DataStatus = 'Add';
                return;
            }
            if (!row.Id) return;
            var entry = self._PendingSaveChanges.updates[row.Id];
            if (!entry) {
                entry = { __row: row, __dataLog: [] };
                self._PendingSaveChanges.updates[row.Id] = entry;
            } else {
                entry.__row = row;
            }
            entry.__dataLog.push(self._BuildDataLog(payload)[0]);
            row._DataStatus = 'Edit';
        },
        IsBatchSubmitMode() {
            return this.SysMenuModel && this.SysMenuModel.SaveType === 'Submit';
        },
        HasPendingBatchChanges() {
            var s = this._PendingSaveChanges;
            if (!s) return false;
            var addCount = (s.adds && s.adds.length) || 0;
            var uptCount = s.updates ? Object.keys(s.updates).length : 0;
            return (addCount + uptCount) > 0;
        },
        GetPendingBatchSummary() {
            var s = this._PendingSaveChanges;
            var addCount = (s && s.adds && s.adds.length) || 0;
            var uptCount = (s && s.updates) ? Object.keys(s.updates).length : 0;
            return { addCount: addCount, uptCount: uptCount, total: addCount + uptCount };
        },
        /** 一次性把待提交 adds + updates 同事务保存。 */
        SubmitBatchSave() {
            var self = this;
            if (self._BatchSaveLoading) return;
            if (!self.HasPendingBatchChanges()) {
                self.DiyCommon.Tips('没有待提交的变更', false);
                return;
            }
            var formEngineKey = self.CurrentDiyTableModel && self.CurrentDiyTableModel.Name ? self.CurrentDiyTableModel.Name : self.TableName;
            var addList = [];
            var uptList = [];
            if (self._PendingSaveChanges.adds && self._PendingSaveChanges.adds.length > 0) {
                self._PendingSaveChanges.adds.forEach(function (row) {
                    addList.push({
                        FormEngineKey: formEngineKey,
                        Id: row.Id,
                        _FormData: self._BuildFullRowFormData(row)
                    });
                });
            }
            if (self._PendingSaveChanges.updates) {
                Object.keys(self._PendingSaveChanges.updates).forEach(function (rowId) {
                    var entry = self._PendingSaveChanges.updates[rowId];
                    if (!entry || !entry.__row) return;
                    uptList.push({
                        FormEngineKey: formEngineKey,
                        Id: rowId,
                        _FormData: self._BuildFullRowFormData(entry.__row),
                        _DataLog: JSON.stringify(entry.__dataLog || [])
                    });
                });
            }
            self._BatchSaveLoading = true;
            self.DiyCommon.Post(self.DiyApi.SaveBatch, {
                FormEngineKey: formEngineKey,
                AddList: addList,
                UptList: uptList
            }, function (result) {
                self._BatchSaveLoading = false;
                if (self.DiyCommon.Result(result)) {
                    self.DiyCommon.Tips(self.$t('Msg.Success'));
                    self._PendingSaveChanges = { adds: [], updates: {} };
                    self.GetDiyTableRow();
                }
            });
        },
        CancelBatchSave() {
            var self = this;
            if (!self.HasPendingBatchChanges()) return;
            self.DiyCommon.OsConfirm('确认丢弃所有未保存的变更并重新加载？', function () {
                self._PendingSaveChanges = { adds: [], updates: {} };
                self.GetDiyTableRow();
            });
        },
        /**
         * 初始化移动端滚动监听
         */
        initMobileScroll() {
            var self = this;

            // 移除旧的监听器
            if (self.mobileScrollHandler) {
                window.removeEventListener('scroll', self.mobileScrollHandler);
            }

            // 创建新的监听器（使用 underscore 的 debounce）
            self.mobileScrollHandler = _u.debounce(function() {
                if (self.mobileLoadingMore || self._isDestroyed) return;

                // 🔥 防止频繁触发：距离上次加载完成不足2秒时不触发新加载
                // 这可以避免移除顶部数据后页面高度变短导致的连续触发
                const now = Date.now();
                if (now - self._lastLoadTime < 1000) {
                    console.log('[防抖] 距离上次加载不足1秒，跳过本次触发');
                    return;
                }

                // 获取滚动位置
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;

                // 到达底部前 300px 开始加载（从200增加到300，更早触发）
                if (scrollTop + windowHeight >= documentHeight - 300) {
                    // 🔥 检查是否还有更多数据（使用双向滚动的_mobileTotalLoaded）
                    const totalLoadedCount = self._mobileTotalLoaded || (self.DiyTableRowList.length + self._mobileWindowStart);
                    if (totalLoadedCount < self.DiyTableRowCount) {
                        console.log('[滚动加载] 触发加载更多，已加载:', totalLoadedCount, '/ 总数:', self.DiyTableRowCount);
                        self.loadMoreMobileData();
                    } else {
                        console.log('[滚动加载] 已加载全部数据，已加载:', totalLoadedCount, '/ 总数:', self.DiyTableRowCount);
                    }
                }
            }, 300);

            window.addEventListener('scroll', self.mobileScrollHandler);
        },

        /**
         * 移动端向上加载前面的数据（双向滚动）
         */
        async loadPrevMobileData() {
            var self = this;

            if (self.mobileLoadingPrev) return;

            self.mobileLoadingPrev = true;
            console.log('[向上加载] 开始，当前窗口起始位置:', self._mobileWindowStart);

            try {
                // 🔥 记录当前第一个元素的ID，用于恢复滚动位置
                const firstItemId = self.DiyTableRowList.length > 0 ? self.DiyTableRowList[0].Id : null;
                const oldScrollHeight = document.documentElement.scrollHeight;

                // 计算要加载多少条：一次加载15条
                const loadCount = Math.min(15, self._mobileWindowStart);

                // 计算新的窗口起始位置
                const newWindowStart = self._mobileWindowStart - loadCount;

                // 🔥 模拟加载前面的数据（实际应该从缓存或重新计算）
                // 这里简化处理：向前移动窗口
                self._mobileWindowStart = newWindowStart;

                // 如果当前窗口+新数据超过30条，移除底部数据
                if (self.DiyTableRowList.length + loadCount > self._mobileMaxRenderCount) {
                    const removeCount = self.DiyTableRowList.length + loadCount - self._mobileMaxRenderCount;
                    self.DiyTableRowList = self.DiyTableRowList.slice(0, -removeCount);
                    console.log(`[向上加载] 移除底部 ${removeCount} 条数据`);
                }

                // 🔥 这里需要重新加载数据，使用新的窗口位置
                // 由于数据已经从服务器加载过，这里应该从全局缓存获取
                // 简化实现：重新请求服务器（实际应该优化为本地缓存）
                const startIndex = newWindowStart;
                const pageSize = self._mobileMaxRenderCount;

                // 重新加载当前窗口的数据
                await self.GetDiyTableRow({
                    _PageIndex: Math.floor(startIndex / self.DiyTableRowPageSize) + 1,
                    _customWindowLoad: true
                });

                // 🔥 恢复滚动位置：找到之前的第一个元素
                self.$nextTick(() => {
                    if (firstItemId) {
                        const element = document.querySelector(`[data-row-id="${firstItemId}"]`);
                        if (element) {
                            // 计算新的滚动位置
                            const newScrollHeight = document.documentElement.scrollHeight;
                            const heightDiff = newScrollHeight - oldScrollHeight;
                            window.scrollTo(0, window.pageYOffset + heightDiff);
                        }
                    }
                    self._lastLoadTime = Date.now();
                });

            } catch (error) {
                console.error('[向上加载] 失败:', error);
            } finally {
                self.mobileLoadingPrev = false;
            }
        },

        /**
         * 移动端向下加载更多数据（双向滚动）
         */
        async loadMoreMobileData() {
            var self = this;

            if (self.mobileLoadingMore) return;

            console.log('[向下加载] 开始');
            self.mobileLoadingMore = true;

            try {
                // 计算下一页
                self.DiyTableRowPageIndex += 1;

                // 获取新数据
                await self.GetDiyTableRow({ _append: true, _bidirectional: true });
                // 注意：mobileLoadingMore 会在 GetDiyTableRow 的 nextTick 中延迟重置

            } catch (error) {
                console.error('[向下加载] 失败:', error);
                // 恢复 pageIndex
                self.DiyTableRowPageIndex -= 1;
                // 出错时立即重置加载状态
                self.mobileLoadingMore = false;
            }
        },

        /**
         * 重置移动端窗口到顶部
         */
        resetMobileWindow() {
            var self = this;
            self._mobileWindowStart = 0;
            self.DiyTableRowPageIndex = 1;
            self.GetDiyTableRow(true);
            // 滚动到顶部
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // ========== Clear 方法：供父组件调用清理数据 ==========
        Clear() {
            var self = this;
            console.log('[DiyTableRowlist] Clear 被调用');

            // 清理表格数据及其内部引用
            if (self.DiyTableRowList && self.DiyTableRowList.length > 0) {
                self.DiyTableRowList.forEach(row => {
                    if (row) {
                        if (row._RowMoreBtnsOut) {
                            row._RowMoreBtnsOut.length = 0;
                            row._RowMoreBtnsOut = null;
                        }
                        if (row._RowMoreBtnsIn) {
                            row._RowMoreBtnsIn.length = 0;
                            row._RowMoreBtnsIn = null;
                        }
                    }
                });
                self.DiyTableRowList.length = 0;
            }
            self.DiyTableRowList = [];

            // 清理选择状态
            if (self.TableMultipleSelection) {
                self.TableMultipleSelection.length = 0;
            }
            self.TableMultipleSelection = [];
            self.TableSelectedRow = {};

            // 清理搜索状态
            self.SearchModel = {};
            self.SearchEqual = {};
            self.V8SearchModel = {};

            // 清理全局菜单状态
            self._moreMenuVisible = false;
            self._moreMenuRow = null;

            // 重置分页
            self.PageIndex = 1;
            self.Total = 0;
        },

        // ========== 性能优化V3：全局共享菜单方法（基于 ref 的稳定处理） ==========
        showMoreMenu(event, row) {
            var self = this;
            event.stopPropagation();

            // 计算菜单位置
            const rect = event.target.getBoundingClientRect();
            self._moreMenuPosition = {
                top: rect.bottom + 5,
                left: rect.right - 150 // 菜单宽度约150px，右对齐
            };

            // 设置当前行数据并显示菜单
            self._moreMenuRow = row;
            self._moreMenuVisible = true;
              // 添加全局点击事件监听，点击其他地方关闭菜单
            // setTimeout(() => {
            //     document.addEventListener('click', self.hideMoreMenu, { once: true });
            // }, 0);


            // zhy处理打开抽屉内表格更多按钮弹框无法关闭的问题
            // zhy移除已有的老监听器（防止重复绑定）
            if (self._moreMenuDocClick) {
                try { document.removeEventListener('click', self._moreMenuDocClick, true); } catch (e) {}
                self._moreMenuDocClick = null;
            }

            // zhy创建一个稳定的处理器引用，使用 capture 阶段以确保能收到事件（即使内部 stopPropagation）去掉之前的onec:true
            self._moreMenuDocClick = function (e) {
                try {
                    var menuEl = self.$refs && self.$refs.globalMoreMenu ? self.$refs.globalMoreMenu : null;
                    // 如果找不到菜单元素，直接关闭并清理
                    if (!menuEl || (menuEl && !menuEl.contains)) {
                        self.hideMoreMenu();
                        return;
                    }
                    // 当点击的目标不在菜单内时才关闭菜单
                    if (!menuEl.contains(e.target)) {
                        self.hideMoreMenu();
                    }
                } catch (err) {
                    // 出错情况下也尝试关闭并清理
                    self.hideMoreMenu();
                }
            };

            // 延迟绑定，确保 teleport 渲染完成后能拿到 ref
            setTimeout(() => {
                document.addEventListener('click', self._moreMenuDocClick, true);
            }, 0);
        },

        hideMoreMenu() {
            var self = this;
            self._moreMenuVisible = false;
            self._moreMenuRow = null;
             // 确保移除事件监听器（虽然使用了once选项，但手动移除更保险）
          // document.removeEventListener('click', self.hideMoreMenu);

            // zhy使用之前保存的引用移除监听器（若存在）
            if (self._moreMenuDocClick) {
                try { document.removeEventListener('click', self._moreMenuDocClick, true); } catch (e) {}
                self._moreMenuDocClick = null;
            }
        },
        handleMoreMenuAction(action, btn) {
            var self = this;
            const row = self._moreMenuRow;
            self.hideMoreMenu();

            if (!row) return;

            switch (action) {
                case 'edit':
                    self.OpenDetail(row, 'Edit');
                    break;
                case 'delete':
                    self.DelDiyTableRow(row);
                    break;
                case 'custom':
                    if (btn) {
                        self.RunMoreBtn(btn, row);
                    }
                    break;
            }
        },
        // ========== 性能优化V3 END ==========

        // ========== 列头菜单方法 ==========
        showColHeaderMenu(field, event) {
            var self = this;
            event.stopPropagation();
            // 先关闭行更多菜单
            self.hideMoreMenu();

            var rect = event.currentTarget.getBoundingClientRect();
            var menuWidth = Math.min(420, window.innerWidth - 20);
            var menuLeft = rect.left;
            // 如果超出右边界，向左调整
            if (menuLeft + menuWidth > window.innerWidth) {
                menuLeft = window.innerWidth - menuWidth - 10;
            }
            var menuTop = rect.bottom + 4;
            self._colMenuPosition = {
                top: menuTop,
                left: menuLeft,
                maxHeight: Math.max(240, window.innerHeight - menuTop - 12)
            };

            self._colMenuField = field;
            // 初始化筛选值
            var fieldName = self.getColFieldName(field);
            if (self._colFilters[fieldName]) {
                self._colFilterOperator = self._colFilters[fieldName].operator;
                self._colFilterValue = self.normalizeColFilterValue(field, self._colFilters[fieldName].value, self._colFilterOperator);
            } else {
                // 根据字段类型设置默认操作符
                self._colFilterOperator = self._getDefaultOperator(field);
                self._colFilterValue = self.isColFilterOptionField(field) ? [] : '';
            }
            self._colPageFilterKeyword = '';
            if (self._colPageFilters[fieldName]) {
                self._colPageFilterSelectedValues = (self._colPageFilters[fieldName].values || []).map(function(value) {
                    return self.getColPageFilterValueKey(value);
                });
            } else {
                self._colPageFilterSelectedValues = [];
            }
            self._colMenuVisible = true;

            setTimeout(() => {
                document.removeEventListener('click', self.hideColHeaderMenu, true);
                document.addEventListener('click', self.hideColHeaderMenu, true);
            }, 0);
        },
        hideColHeaderMenu(event) {
            var self = this;
            if (event && event.target) {
                var menu = self.$refs.globalColMenu;
                if (menu && menu.contains && menu.contains(event.target)) return;
                var closest = event.target.closest ? event.target.closest('.el-popper, .el-picker__popper, .el-select__popper') : null;
                if (closest) return;
            }
            self._colMenuVisible = false;
            document.removeEventListener('click', self.hideColHeaderMenu, true);
        },
        _getDefaultOperator(field) {
            if (!field) return 'Like';
            var comp = field.Component;
            if (this.isColFilterOptionField(field)) return 'In';
            if (comp === 'DateTime') return '>=';
            if (field.Type && (field.Type.toLowerCase().indexOf('int') > -1 || field.Type.toLowerCase().indexOf('decimal') > -1)) return '=';
            return 'Like';
        },
        getColFieldName(field) {
            if (!field) return '';
            return this.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName;
        },
        getActiveOrderBys() {
            var self = this;
            var result = {};
            var orderBys = self._OrderBys || {};
            Object.keys(orderBys).forEach(function(key) {
                var direction = String(orderBys[key] || '').toLowerCase();
                if (key && (direction === 'asc' || direction === 'desc')) {
                    result[key] = direction;
                }
            });
            return result;
        },
        syncLegacyOrderState() {
            var self = this;
            var orderBys = self.getActiveOrderBys();
            var keys = Object.keys(orderBys);
            self._OrderBys = orderBys;
            if (keys.length > 0) {
                var lastField = keys[keys.length - 1];
                self._OrderBy = lastField;
                self._OrderByType = orderBys[lastField];
                self.LastOrderBy = orderBys[lastField] + '|' + lastField;
            } else {
                self._OrderBy = '';
                self._OrderByType = '';
                self.LastOrderBy = '';
            }
        },
        applyTableOrderParams(param) {
            var self = this;
            var orderBys = self.getActiveOrderBys();
            if (Object.keys(orderBys).length > 0) {
                param._OrderBys = orderBys;
                delete param._OrderBy;
                delete param._OrderByType;
                return;
            }
            if (!self.DiyCommon.IsNull(self._OrderBy) && !self.DiyCommon.IsNull(self._OrderByType)) {
                param._OrderBy = self._OrderBy;
                param._OrderByType = self._OrderByType;
            }
        },
        clearColSort(fieldName) {
            var self = this;
            var orderBys = Object.assign({}, self._OrderBys || {});
            if (fieldName) {
                delete orderBys[fieldName];
            } else {
                orderBys = {};
            }
            self._OrderBys = orderBys;
            if (self._OrderBy === fieldName || !fieldName) {
                self._OrderBy = '';
                self._OrderByType = '';
                self.LastOrderBy = '';
            }
            self.syncLegacyOrderState();
        },
        getColSortState(field) {
            var self = this;
            var fieldName = self.getColFieldName(field);
            if (self._OrderBys && self._OrderBys[fieldName]) return String(self._OrderBys[fieldName]).toLowerCase();
            if (self._OrderBy === fieldName && self._OrderByType) return self._OrderByType.toLowerCase();
            return '';
        },
        colMenuSort(direction) {
            var self = this;
            if (!self._colMenuField) return;
            var fieldName = self.getColFieldName(self._colMenuField);
            var orderBys = Object.assign({}, self._OrderBys || {});
            var currentDirection = orderBys[fieldName] ? String(orderBys[fieldName]).toLowerCase() : '';
            if (!currentDirection && self._OrderBy === fieldName && self._OrderByType) {
                currentDirection = self._OrderByType.toLowerCase();
            }
            // 如果已经是当前排序，再次点击取消该列
            if (currentDirection === direction) {
                delete orderBys[fieldName];
            } else {
                orderBys[fieldName] = direction;
            }
            self._OrderBys = orderBys;
            self.syncLegacyOrderState();
            self.hideColHeaderMenu();
            self.GetDiyTableRow();
        },
        colMenuToggleFixed() {
            var self = this;
            if (!self._colMenuField) return;
            var idx = self.FixedFields.indexOf(self._colMenuField.Id);
            if (idx > -1) {
                self.FixedFields.splice(idx, 1);
            } else {
                self.FixedFields.push(self._colMenuField.Id);
            }
            self.hideColHeaderMenu();
        },
        colMenuHideColumn() {
            var self = this;
            if (!self._colMenuField) return;
            self._runtimeHiddenFields.push(self._colMenuField.Id);
            // 从 ShowDiyFieldList 中移除
            if (self.ShowDiyFieldList) {
                var idx = self.ShowDiyFieldList.findIndex(f => f.Id === self._colMenuField.Id);
                if (idx > -1) {
                    self.ShowDiyFieldList.splice(idx, 1);
                }
            }
            self.hideColHeaderMenu();
        },
        colMenuRestoreColumns() {
            var self = this;
            // 恢复所有运行时隐藏的列
            self._runtimeHiddenFields = [];
            // 重新生成显示列
            self.GetShowDiyFieldList();
            self.hideColHeaderMenu();
        },
        colMenuSaveWidth() {
            var self = this;
            if (!self._colMenuField) return;
            var fieldName = self.DiyCommon.IsNull(self._colMenuField.AsName) ? self._colMenuField.Name : self._colMenuField.AsName;
            // 从 el-table 获取列的实际渲染宽度
            var tableRef = self.$refs['diy-table-' + self.TableId];
            var newWidth = 0;
            if (tableRef) {
                var columns = tableRef.columns || [];
                var col = columns.find(function(c) { return c.property === fieldName; });
                if (col) {
                    newWidth = Math.round(col.realWidth || col.width || 0);
                }
            }
            if (!newWidth) {
                newWidth = self._colMenuField.TableWidth || 150;
            }
            self.DiyCommon.Post(self.DiyApi.FormEngine.UptFormData, {
                FormEngineKey: 'Diy_Field',
                Id: self._colMenuField.Id,
                TableWidth: newWidth
            }, function(result) {
                if (self.DiyCommon.Result(result)) {
                    self._colMenuField.TableWidth = newWidth;
                    self.DiyCommon.Tips('列宽 ' + newWidth + 'px 保存成功');
                }
            });
            self.hideColHeaderMenu();
        },
        getColFilterOperators() {
            var self = this;
            var field = self._colMenuField;
            if (!field) return [];
            var comp = field.Component;
            var isNum = field.Type && (field.Type.toLowerCase().indexOf('int') > -1 || field.Type.toLowerCase().indexOf('decimal') > -1);
            var isDate = comp === 'DateTime';

            if (isDate || isNum) {
                return [
                    { label: '等于 (=)', value: '=' },
                    { label: '不等于 (≠)', value: '<>' },
                    { label: '大于 (>)', value: '>' },
                    { label: '大于等于 (≥)', value: '>=' },
                    { label: '小于 (<)', value: '<' },
                    { label: '小于等于 (≤)', value: '<=' }
                ];
            }
            if (self.isColFilterOptionField(field)) {
                return [
                    { label: '包含任一 (In)', value: 'In' },
                    { label: '不包含任一 (NotIn)', value: 'NotIn' }
                ];
            }
            return [
                { label: '包含', value: 'Like' },
                { label: '等于 (=)', value: '=' },
                { label: '不等于 (≠)', value: '<>' },
                { label: '开头是', value: 'StartLike' },
                { label: '结尾是', value: 'EndLike' },
                { label: '不包含', value: 'NotLike' }
            ];
        },
        getColFilterDateType() {
            var self = this;
            if (!self._colMenuField || !self._colMenuField.Config || !self._colMenuField.Config.DateTimeType) return 'date';
            var mapping = { datetime: 'datetime', date: 'date', month: 'month', year: 'year' };
            return mapping[self._colMenuField.Config.DateTimeType] || 'date';
        },
        getColFilterDateFormat() {
            var self = this;
            if (!self._colMenuField || !self._colMenuField.Config || !self._colMenuField.Config.DateTimeType) return 'YYYY-MM-DD';
            var mapping = { datetime: 'YYYY-MM-DD HH:mm:ss', date: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' };
            return mapping[self._colMenuField.Config.DateTimeType] || 'YYYY-MM-DD';
        },
        isColFilterTextInput() {
            var self = this;
            if (self.isColFilterOptionField()) return false;
            return ['Like', 'NotLike', 'StartLike', 'EndLike'].indexOf(self._colFilterOperator) > -1;
        },
        isColFilterOptionField(field) {
            field = field || this._colMenuField;
            if (!field) return false;
            if (field.Component === 'Switch') return true;
            return ['Select', 'MultipleSelect', 'Radio', 'Checkbox'].indexOf(field.Component) > -1 && Array.isArray(field.Data) && field.Data.length > 0;
        },
        getColFilterOptions() {
            var field = this._colMenuField;
            if (!field) return [];
            if (field.Component === 'Switch') {
                return [
                    { label: '打开', value: '1' },
                    { label: '关闭', value: '0' }
                ];
            }
            var config = field.Config || {};
            var labelKey = config.SelectLabel || 'Name';
            var valueKey = config.SelectSaveField || config.SelectLabel || 'Id';
            var data = Array.isArray(field.Data) ? field.Data : [];
            return data.map(function(opt) {
                if (typeof opt === 'string') return { label: opt, value: opt };
                return {
                    label: opt[labelKey] || opt.Value || opt.Name || opt.Label || opt.Id || '',
                    value: opt[valueKey] || opt.Key || opt.Id || opt.Value || opt.Name || ''
                };
            }).filter(function(opt) { return opt.value !== '' && opt.value !== null && opt.value !== undefined; });
        },
        normalizeColFilterValue(field, value, operator) {
            if (this.isColFilterOptionField(field) || operator === 'In' || operator === 'NotIn') {
                if (Array.isArray(value)) return value;
                if (value === '' || value === null || value === undefined) return [];
                return [value];
            }
            return value;
        },
        getColPageFilterValueKey(value) {
            if (value === null) return '__COL_PAGE_FILTER_NULL__';
            if (value === undefined) return '__COL_PAGE_FILTER_UNDEFINED__';
            if (value === '') return '__COL_PAGE_FILTER_EMPTY__';
            if (typeof value === 'object') {
                try {
                    return 'object:' + JSON.stringify(value);
                } catch (e) {
                    return 'object:' + String(value);
                }
            }
            return typeof value + ':' + String(value);
        },
        formatColPageFilterLabel(value) {
            if (value === null || value === undefined || value === '') return '(空)';
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                } catch (e) {
                    return String(value);
                }
            }
            return String(value);
        },
        buildColPageFilterOptions(ignoreKeyword) {
            var self = this;
            var field = self._colMenuField;
            if (!field) return [];
            var fieldName = self.getColFieldName(field);
            var rows = self.RenderedTableRowList || [];
            var map = {};
            var result = [];
            rows.forEach(function(row) {
                var value = row ? row[fieldName] : null;
                var key = self.getColPageFilterValueKey(value);
                if (!map[key]) {
                    map[key] = {
                        key: key,
                        value: value,
                        label: self.formatColPageFilterLabel(value),
                        count: 0
                    };
                    result.push(map[key]);
                }
                map[key].count++;
            });
            if (ignoreKeyword === true) return result;
            var keyword = String(self._colPageFilterKeyword || '').trim().toLowerCase();
            if (!keyword) return result;
            return result.filter(function(item) {
                return String(item.label || '').toLowerCase().indexOf(keyword) > -1;
            });
        },
        getColPageFilterOptions() {
            return this.buildColPageFilterOptions(false);
        },
        isColPageFilterAllChecked() {
            var self = this;
            var options = self.getColPageFilterOptions();
            if (options.length === 0) return false;
            var selected = self._colPageFilterSelectedValues || [];
            return options.every(function(opt) {
                return selected.indexOf(opt.key) > -1;
            });
        },
        isColPageFilterIndeterminate() {
            var self = this;
            var options = self.getColPageFilterOptions();
            if (options.length === 0) return false;
            var selected = self._colPageFilterSelectedValues || [];
            var selectedCount = options.filter(function(opt) {
                return selected.indexOf(opt.key) > -1;
            }).length;
            return selectedCount > 0 && selectedCount < options.length;
        },
        colPageFilterToggleAll(checked) {
            var self = this;
            var options = self.getColPageFilterOptions();
            var selected = (self._colPageFilterSelectedValues || []).slice();
            var visibleKeys = options.map(function(opt) { return opt.key; });
            if (checked) {
                visibleKeys.forEach(function(key) {
                    if (selected.indexOf(key) === -1) selected.push(key);
                });
            } else {
                selected = selected.filter(function(key) {
                    return visibleKeys.indexOf(key) === -1;
                });
            }
            self._colPageFilterSelectedValues = selected;
        },
        syncColPageFilterModel() {
            var self = this;
            if (!self._colMenuField) return false;
            var fieldName = self.getColFieldName(self._colMenuField);
            var allOptions = self.buildColPageFilterOptions(true);
            var optionMap = {};
            allOptions.forEach(function(opt) {
                optionMap[opt.key] = opt;
            });
            var values = [];
            (self._colPageFilterSelectedValues || []).forEach(function(key) {
                if (optionMap[key] && values.findIndex(function(oldValue) {
                    return self.getColPageFilterValueKey(oldValue) === key;
                }) === -1) {
                    values.push(optionMap[key].value);
                }
            });
            if (values.length === 0) {
                delete self._colPageFilters[fieldName];
            } else {
                self._colPageFilters[fieldName] = { values: values };
            }
            return true;
        },
        colMenuApplyPageFilter() {
            var self = this;
            if (!self.syncColPageFilterModel()) return;
            self.refreshColMenuFilterResult();
        },
        colMenuApplyAllFilters() {
            var self = this;
            if (!self._colMenuField) return;
            self.syncColFilterModel();
            self.syncColPageFilterModel();
            self.refreshColMenuFilterResult();
        },
        refreshColMenuFilterResult() {
            var self = this;
            self._rebuildColFilterWhere();
            self.hideColHeaderMenu();
            self.GetDiyTableRow({ _PageIndex: 1 });
        },
        buildColPageFilterWhere(fieldName, values) {
            var result = [];
            if (!fieldName || !Array.isArray(values) || values.length === 0) return result;
            values.forEach(function(value, index) {
                var condition = [];
                if (values.length > 1 && index === 0) {
                    condition.push('(');
                }
                if (values.length > 1 && index > 0) {
                    condition.push('OR');
                }
                condition.push(fieldName);
                condition.push('=');
                condition.push(value === undefined ? null : value);
                if (values.length > 1 && index === values.length - 1) {
                    condition.push(')');
                }
                condition._isColPageFilter = true;
                result.push(condition);
            });
            return result;
        },
        syncColFilterModel() {
            var self = this;
            if (!self._colMenuField) return false;
            var fieldName = self.getColFieldName(self._colMenuField);
            var operator = self._colFilterOperator;
            var value = self._colFilterValue;
            if (self.isColFilterOptionField()) {
                value = self.normalizeColFilterValue(self._colMenuField, value, operator).filter(function(item) {
                    return item !== '' && item !== null && item !== undefined;
                });
                operator = operator === 'NotIn' ? 'NotIn' : 'In';
            }

            if (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
                // 清除该列筛选
                delete self._colFilters[fieldName];
            } else {
                self._colFilters[fieldName] = {
                    operator: operator,
                    value: value
                };
            }
            return true;
        },
        colMenuApplyFilter() {
            var self = this;
            if (!self.syncColFilterModel()) return;
            self.refreshColMenuFilterResult();
        },
        colMenuClearFilter() {
            var self = this;
            if (!self._colMenuField) return;
            var fieldName = self.getColFieldName(self._colMenuField);
            delete self._colFilters[fieldName];
            delete self._colPageFilters[fieldName];
            self._colFilterValue = self.isColFilterOptionField() ? [] : '';
            self._colPageFilterSelectedValues = [];
            self.clearColSort(fieldName);
            self._rebuildColFilterWhere();
            self.hideColHeaderMenu();
            self.GetDiyTableRow({ _PageIndex: 1 });
        },
        _rebuildColFilterWhere() {
            var self = this;
            // 从 Where 中移除所有列头筛选相关条件
            self.Where = self.Where.filter(item => !item._isColFilter && !item._isColPageFilter);
            // 重建
            for (var fieldName in self._colFilters) {
                var filter = self._colFilters[fieldName];
                var condition = [fieldName, filter.operator, filter.value];
                condition._isColFilter = true;
                self.Where.push(condition);
            }
            for (var pageFieldName in self._colPageFilters) {
                var pageFilter = self._colPageFilters[pageFieldName];
                var conditions = self.buildColPageFilterWhere(pageFieldName, pageFilter.values);
                conditions.forEach(function(condition) {
                    self.Where.push(condition);
                });
            }
        },
        // ========== 列头菜单方法 END ==========

        // ========== 卡片模式辅助方法 ==========
        getCardIndex(index) {
            var self = this;
            // 考虑分页和移动端滚动加载的序号
            if (self.diyStore.IsPhoneView) {
                return (self._mobileWindowStart || 0) + index + 1;
            }
            return (self.DiyTableRowPageIndex - 1) * self.DiyTableRowPageSize + index + 1;
        },
        formatCardTime(timeStr) {
            if (!timeStr) return '';
            // 支持常见的时间格式，截取前16位显示 YYYY-MM-DD HH:mm
            var str = String(timeStr);
            if (str.length >= 16) return str.substring(0, 16);
            if (str.length >= 10) return str.substring(0, 10);
            return str;
        },
        // 卡片点击：先执行原有行点击逻辑，再打开详情
        CardItemClick(item) {
            var self = this;
            if (self.PropsTableType === 'OpenTable') {
                if (self.IsOpenTableSingleSelect()) {
                    self.selectOpenTableSingleRow(item);
                } else if (self.CanUseTableSelection()) {
                    self.toggleCardSelection(item);
                }
                return;
            }
            self.DiyTableRowClick(item);
            if (self.IsPermission('NoDetail')) {
                self.OpenDetail(item, 'View');
            }
        },
        FormatTableReportValue(value) {
            if (value === null || value === undefined || value === '') return '';
            if (typeof value === 'string') {
                var trimmed = value.trim();
                if (trimmed === '') return '';
                var numericString = trimmed.replace(/,/g, '');
                if (!/^[-+]?\d+(\.\d+)?$/.test(numericString)) {
                    return value;
                }
                value = Number(numericString);
            }
            if (typeof value !== 'number' || isNaN(value)) return value;
            var absValue = Math.abs(value);
            var formatNumber = function (num, maximumFractionDigits) {
                return Number(num.toFixed(maximumFractionDigits)).toLocaleString('zh-CN', {
                    maximumFractionDigits: maximumFractionDigits
                });
            };
            if (absValue >= 100000000) {
                return formatNumber(value / 100000000, 2) + '亿';
            }
            if (absValue >= 10000) {
                return formatNumber(value / 10000, 2) + '万';
            }
            return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
        },
        // ========== 卡片模式辅助方法 END ==========

        GetColWidth(field, fieldIndex) {
            var self = this;
            if (fieldIndex == self.ShowDiyFieldList.length - 1) {
                return "";
            }
            if (!field.TableWidth) {
                return 150;
            }
            return field.TableWidth;
        },
        isMuban(field, scope) {
            // 把 !DiyCommon.IsNull(field.V8TmpEngineTable) && scope.row[field.Name + '_TmpEngineResult'] !== undefined 做成计算属性
            return !this.DiyCommon.IsNull(field.V8TmpEngineTable) && scope.row[field.Name + "_TmpEngineResult"] !== undefined;
        },
    }
};
