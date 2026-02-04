/**
 * 表单工具函数 Mixin
 * 包含 diy-form.vue 专用的表单处理函数
 * 
 * 用于 diy-form.vue
 */

export default {
    methods: {
        /**
         * 获取表单项 Label
         * @param {Object} field - 字段配置
         * @returns {String} 标签文本
         */
        GetFormItemLabel(field) {
            var self = this;
            if (field.Component == "Button") {
                return "";
            } else {
                if (field.Label) {
                    return field.Label;
                } else if (self.LoadMode == "Design") {
                    return field.Name;
                }
                return "";
            }
        },
        
        /**
         * 判断是否应该显示 Label
         * @param {Object} field - 字段配置
         * @returns {Boolean}
         */
        shouldShowLabel(field) {
            var self = this;
            // 不显示 label 的组件类型
            var noLabelComponents = ['Divider', 'DevComponent'];
            // 如果是子表，并且 Label 为空，也不显示
            if (field.Component === 'TableChild' && self.DiyCommon.IsNull(field.Label)) {
                return false;
            }
            return !noLabelComponents.includes(field.Component) && 
                   self.DiyCommon.IsNull(field.Config?.DevComponentName);
        },
        
        /**
         * 获取字段 Label 样式
         * @param {Object} field - 字段配置
         * @returns {Object} 样式对象
         */
        getFieldLabelStyle(field) {
            var self = this;
            let color = "#000"; // 默认颜色
            let display = "visible";
            
            if (self.diyStore && self.diyStore.IsPhoneView && field.Component === "TableChild") {
                display = "none";
            }
            
            // 根据 field.Visible 设置颜色
            if (!field.Visible) {
                color = "#ccc";
            }
            
            // 必填字段颜色
            if (field.NotEmpty) {
                color = self.SysConfig?.BitianYS == null ? "#000" : self.SysConfig?.BitianYS;
            }
            
            return {
                color,
                display
            };
        },
        
        /**
         * 获取表单字段宽度（span）
         * @param {Object} field - 字段配置
         * @returns {Number} span 值 (1-24)
         */
        GetDiyTableColumnSpan(field) {
            var self = this;
            if (!self.DiyCommon.IsNull(self.ColSpan) && self.ColSpan != 0) {
                return self.ColSpan;
            }
            if (!self.DiyCommon.IsNull(field.FormWidth) && field.FormWidth != 0) {
                return field.FormWidth;
            } else if (self.DiyTableModel.Column == 1) {
                return 24;
            } else if (self.DiyTableModel.Column == 2) {
                return 12;
            } else if (self.DiyTableModel.Column == 3) {
                return 8;
            } else if (self.DiyTableModel.Column == 4) {
                return 6;
            } else if (self.DiyTableModel.Column == 6) {
                return 4;
            } else {
                return 24;
            }
        },
        
        /**
         * 智能选择字段组件
         * @param {Object} field - 字段配置
         * @returns {String|null} 组件名称
         */
        GetFieldComponent(field) {
            var self = this;
            // 字段有效性检查
            if (!field || typeof field !== 'object') {
                console.error('[form-utils] GetFieldComponent: 字段数据无效', field);
                return null;
            }
            if (!field.Component) {
                console.error('[form-utils] GetFieldComponent: 字段缺少Component属性', field);
                return null;
            }
            if (!field.Config || typeof field.Config !== 'object') {
                console.warn('[form-utils] GetFieldComponent: 字段缺少Config，使用默认配置', field);
                field.Config = {};
            }
            
            // V8模板引擎组件（只在查看模式下）
            if (!self.DiyCommon.IsNull(field.V8TmpEngineForm) && self.FormMode == 'View') {
                return 'DiyV8TmpEngine';
            }
            // 定制开发组件
            if (!self.DiyCommon.IsNull(field.Config.DevComponentName)) {
                return 'DiyDevComponent';
            }
            // 默认使用 field.Component
            return 'Diy' + field.Component;
        },
        
        /**
         * 获取 Tabs 位置
         * @returns {String} 'top' | 'left' | 'right' | 'bottom'
         */
        GetTabsPosition() {
            var self = this;
            if (self.diyStore && self.diyStore.IsPhoneView) {
                return "top";
            }
            if (self.DiyTableModel && self.DiyTableModel.TabsPosition) {
                return self.DiyTableModel.TabsPosition;
            }
            return "top";
        },
        
        /**
         * 获取 Checkbox 配置的显示字段
         * @param {Object} field - 字段配置
         * @returns {String}
         */
        GetCheckboxDisplay(field) {
            var self = this;
            if (field.Config && field.Config.Checkbox && field.Config.Checkbox.Display) {
                return field.Config.Checkbox.Display;
            }
            return 'Name';
        },
        
        /**
         * 获取 Radio 配置的显示字段
         * @param {Object} field - 字段配置
         * @returns {String}
         */
        GetRadioDisplay(field) {
            var self = this;
            if (field.Config && field.Config.Radio && field.Config.Radio.Display) {
                return field.Config.Radio.Display;
            }
            return 'Name';
        },
        
        /**
         * 获取字段 Label 显示文本
         * @param {Object} field - 字段配置
         * @returns {String}
         */
        GetFieldLabel(field) {
            var self = this;
            if (field.Component == "DevComponent") {
                return "";
            }
            return field.Label;
        },
        
        /**
         * 获取按钮配置的类型
         * @param {Object} field - 字段配置
         * @returns {String}
         */
        GetFieldConfigButtonType(field) {
            var self = this;
            if (field.Config && field.Config.Button && field.Config.Button.Type) {
                return field.Config.Button.Type;
            }
            return "";
        },
        
        /**
         * 获取 Department 组件的 Props
         * @param {Object} field - 字段配置
         * @returns {Object}
         */
        GetDepartmentProps(field) {
            var self = this;
            var result = {
                value: "Id",
                label: "Name",
                children: "_Child",
                checkStrictly: true
            };
            if (field.Config && field.Config.Department && field.Config.Department.Multiple === true) {
                result.multiple = true;
            }
            return result;
        },
        
        /**
         * 获取 JoinTable 的搜索配置
         * @param {Object} field - 字段配置
         * @returns {Array}
         */
        GetPropsSearch(field) {
            var self = this;
            if (field.Config && field.Config.JoinTable && field.Config.JoinTable.Where) {
                try {
                    return JSON.parse(field.Config.JoinTable.Where);
                } catch (error) {
                    return [];
                }
            }
            return [];
        },
        
        /**
         * 更新已修改字段列表
         * @param {String} fieldName - 字段名
         */
        UpdateModifiedFields(fieldName) {
            var self = this;
            if (self.ModifiedFields && !(self.ModifiedFields.indexOf(fieldName) > -1)) {
                self.ModifiedFields.push(fieldName);
            }
        },
        
        /**
         * 修复单文件字段被误置为数组或对象的情况
         * @param {Object} field - 字段配置
         */
        sanitizeSingleFileField(field) {
            var self = this;
            try {
                if (!field) return;
                var name = field.Name;
                // 仅在非多文件场景下进行修复
                var componentType = field.Component === "FileUpload" ? "FileUpload" : "ImgUpload";
                if (self.getMultipleFlag(field, componentType)) return;
                
                var val = self.FormDiyTableModel[name];
                if (Array.isArray(val)) {
                    if (val.length === 0) {
                        self.FormDiyTableModel[name] = "";
                        return;
                    }
                    // 如果数组里第一个元素有 Path，则取出
                    var first = val[0];
                    var path = null;
                    if (first) {
                        path = first.Path || first.path || first.Url || first.url || first.PathName || null;
                    }
                    if (path) {
                        self.FormDiyTableModel[name] = path;
                        return;
                    }
                    self.FormDiyTableModel[name] = "";
                    return;
                }
                if (typeof val === "object" && val !== null) {
                    var p = val.Path || val.path || val.Url || val.url || val.PathName;
                    if (p && typeof p === "string") {
                        self.FormDiyTableModel[name] = p;
                    } else {
                        self.FormDiyTableModel[name] = "";
                    }
                }
            } catch (e) {
                // ignore
            }
        }
    }
};
