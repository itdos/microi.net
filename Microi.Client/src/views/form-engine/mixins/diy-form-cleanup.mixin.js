export default {
beforeUnmount() {
        var self = this;
        // 标记组件已销毁
        self._isDestroyed = true;

        // ========== 0. 清理所有待执行的定时器 ==========
        if (self.DiyFieldList && self.DiyFieldList.length > 0) {
            self.DiyFieldList.forEach((field) => {
                try {
                    // 清理百度地图
                    if (field.BaiduMapConfig) {
                        if (field.BaiduMapConfig._map) {
                            field.BaiduMapConfig._map = null;
                        }
                        if (field.BaiduMapConfig._BMap) {
                            field.BaiduMapConfig._BMap = null;
                        }
                        field.BaiduMapConfig = null;
                    }
                    // 清理高德地图
                    if (field.AmapConfig) {
                        field.AmapConfig = null;
                    }
                    // 清理字段的其他大对象引用
                    if (field.Data && Array.isArray(field.Data)) {
                        field.Data.length = 0;
                        field.Data = null;
                    }
                    // 清理字段配置中的大对象
                    if (field.Config) {
                        // 清理子表配置
                        if (field.Config.TableChild) {
                            field.Config.TableChild.Data = null;
                            field.Config.TableChild = null;
                        }
                        // 清理关联表配置
                        if (field.Config.JoinTable) {
                            field.Config.JoinTable = null;
                        }
                        // 清理弹出表格配置
                        if (field.Config.OpenTable) {
                            field.Config.OpenTable.PropsWhere = null;
                            field.Config.OpenTable = null;
                        }
                        field.Config = null;
                    }
                    // 清理父级引用
                    field._ParentFormModel = null;
                } catch (e) {
                    /* ignore */
                }
            });
            // 清空数组
            self.DiyFieldList.length = 0;
        }

        // ========== 3. 清理表单数据 ==========
        // 清理 FormDiyTableModel 中的所有属性
        if (self.FormDiyTableModel) {
            Object.keys(self.FormDiyTableModel).forEach((key) => {
                try {
                    delete self.FormDiyTableModel[key];
                } catch (e) {
                    self.FormDiyTableModel[key] = null;
                }
            });
            self.FormDiyTableModel = {};
        }

        // ========== 4. 清理字段列表 ==========
        self.DiyFieldList = [];
        self.FormTabs = [];
        self.FormRules = {};
        self.ModifiedFields = [];
        self.CollapseGroupState = {};
        self.FieldTabsState = {};

        // ========== 5. 清理表模型 ==========
        if (self.DiyTableModel) {
            self.DiyTableModel.Tabs = [];
            self.DiyTableModel = { Tabs: [] };
        }

        // ========== 6. 清理历史数据 ==========
        self.OldForm = {};
        self.OldFormData = {};

        // ========== 7. 清理动态组件引用 ==========
        // 注意：全局注册的组件无法卸载，但清理本地引用可减少内存占用
        if (self.DevComponents) {
            Object.keys(self.DevComponents).forEach((key) => {
                try {
                    delete self.DevComponents[key];
                } catch (e) { /* ignore */ }
            });
        }
        self.DevComponents = {};

        // ========== 8. 清理上传相关 ==========
        self.DiyImgUploadRealPath = [];
        self.DiyFileUploadRealPath = [];

        // ========== 9. 清理自定义对话框配置 ==========
        self.DiyCustomDialogConfig = {};

        // ========== 10. 清理当前字段模型 ==========
        self.CurrentDiyFieldModel = {};

        // ========== 10.5 🔥 真正的内存泄漏修复：清理全局事件监听器 ==========
        // 清理全局点击事件（如果有绑定的话）
        if (self._globalClickHandler) {
            document.removeEventListener('click', self._globalClickHandler);
            self._globalClickHandler = null;
        }

        // ========== 10.6 清理 V8 基础实例（但不清理 V8 对象本身） ==========
        // 注意：_V8BaseInstance 是组件级别的缓存，需要清理
        // 但不清理用户代码中的 V8 对象（那些会自动GC）
        if (self._V8BaseInstance) {
            // 只清理闭包引用，不清理对象本身
            Object.keys(self._V8BaseInstance).forEach((key) => {
                try {
                    // 只清理函数引用（这些持有 self 的闭包）
                    if (typeof self._V8BaseInstance[key] === 'function') {
                        self._V8BaseInstance[key] = null;
                    }
                } catch (e) {
                    /* ignore */
                }
            });
            self._V8BaseInstance = null;
        }

        // ========== 11. 清理已渲染标签页记录 ==========
        if (self.renderedTabs) {
            self.renderedTabs.clear();
        }
        // 🔥 新增：清理渲染字段计数
        self.renderedFieldCounts = {};

        // ========== 12. 清理子组件引用 ==========
        // 清理通过 $refs 持有的子组件引用，并主动调用子组件的清理方法
        // 注意：Vue 3 中 $refs 是只读的，不能设置为 null
        if (self.$refs) {
            Object.keys(self.$refs).forEach((key) => {
                try {
                    // 检查是否是字段组件的 ref (统一使用 ref_ 前缀)
                    if (key.startsWith('ref_')) {
                        var refComponent = self.$refs[key];
                        // Vue 3 中 ref 可能是数组
                        if (Array.isArray(refComponent)) {
                            refComponent.forEach(comp => {
                                if (comp && typeof comp.Clear === 'function') {
                                    try { comp.Clear(); } catch(e) {}
                                }
                            });
                            // 清空数组内容（不是设置为 null）
                            refComponent.length = 0;
                        } else if (refComponent && typeof refComponent.Clear === 'function') {
                            try { refComponent.Clear(); } catch(e) {}
                        }
                        // Vue 3 中不能设置 $refs[key] = null，会报错
                    }
                } catch (e) { /* ignore */ }
            });
        }

        // ========== 12. Vue 3 不需要恢复 $set 方法 ==========
        // Vue 3 的响应式系统不再需要 $set
        console.log("Microi：[DiyForm] 组件已销毁，相关资源已清理");
    },

};
