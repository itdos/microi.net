/**
 * DIY 通用工具函数 Mixin
 * 包含 diy-form.vue 和 diy-table-rowlist.vue 都可以使用的通用函数
 * 
 * 用于 diy-form.vue, diy-table-rowlist.vue
 */

export default {
    methods: {
        /**
         * 获取文件服务器完整URL
         * @param {String|Object} url - 文件路径或文件对象
         * @returns {String} 完整的文件URL
         */
        GetFileServerUrl(url) {
            var self = this;
            if (!url) {
                return url;
            }
            if (url.startsWith('http')) {
                return url;
            }
            if (typeof(url) == 'object') {
                return self.SysConfig.FileServer + url.Path;
            }
            if (url.startsWith('{')) {
                var urlObj = JSON.parse(url);
                return self.SysConfig.FileServer + urlObj.Path;
            }
            if (url.startsWith('[')) {
                var urlArr = JSON.parse(url);
                if (urlArr.length > 0) {
                    return self.SysConfig.FileServer + urlArr[0].Path;
                }
            }
            return self.SysConfig.FileServer + url;
        },
        
        /**
         * 获取第一张图片URL
         * @param {String|Array} imageData - 图片字段值
         * @returns {String} 图片URL
         */
        getFirstImageUrl(imageData) {
            var self = this;
            if (self.DiyCommon.IsNull(imageData)) {
                return "";
            }

            try {
                const imageList = JSON.parse(imageData);
                if (Array.isArray(imageList) && imageList.length > 0) {
                    return self.DiyCommon.GetServerPath(imageList[0].Path);
                }
            } catch (e) {
                return self.DiyCommon.GetServerPath(imageData);
            }

            return self.DiyCommon.GetServerPath(imageData);
        },
        
        /**
         * 获取图片预览列表
         * @param {String|Array} imageData - 图片字段值
         * @returns {Array} 图片URL列表
         */
        getImagePreviewList(imageData) {
            var self = this;
            if (self.DiyCommon.IsNull(imageData)) {
                return [];
            }

            try {
                const imageList = JSON.parse(imageData);
                if (Array.isArray(imageList) && imageList.length > 0) {
                    return imageList.map((item) => self.DiyCommon.GetServerPath(item.Path));
                }
            } catch (e) {
                return [self.DiyCommon.GetServerPath(imageData)];
            }

            return [self.DiyCommon.GetServerPath(imageData)];
        },
        
        /**
         * 处理图片加载错误
         * @param {Event} event - 错误事件
         */
        handleImageError(event) {
            event.target.style.display = "none";
        },
        
        /**
         * 获取认证token（用于文件上传等）
         * @returns {String} token
         */
        authorization() {
            var self = this;
            return "Bearer " + self.DiyCommon.Authorization();
        },
        
        /**
         * 安全的 setTimeout 包装器，组件销毁时自动清理
         * @param {Function} fn - 要执行的函数
         * @param {number} delay - 延迟时间（毫秒）
         * @returns {number} - 定时器ID
         */
        safeTimeout(fn, delay) {
            var self = this;
            var timerId = setTimeout(function() {
                if (self._isDestroyed) return;
                fn();
            }, delay);
            if (self._pendingTimers) {
                self._pendingTimers.push(timerId);
            }
            return timerId;
        },
        
        /**
         * 清理所有待执行的定时器
         */
        clearAllTimers() {
            var self = this;
            if (self._pendingTimers && self._pendingTimers.length > 0) {
                self._pendingTimers.forEach(function(timerId) {
                    clearTimeout(timerId);
                });
                self._pendingTimers = [];
            }
        },
        
        /**
         * 判断文件/图片上传是否多选
         * @param {Object} field - 字段配置
         * @param {String} componentType - 组件类型 'FileUpload' | 'ImgUpload'
         * @returns {Boolean}
         */
        getMultipleFlag(field, componentType) {
            var self = this;
            if (!field || !field.Config || !field.Config[componentType]) {
                return false;
            }
            var multiple = field.Config[componentType].Multiple;
            return multiple === true || multiple === 'true' || multiple === 1 || multiple === '1';
        },
        
        /**
         * 获取 label 位置
         * @param {Object} field - 字段配置（可选）
         * @returns {String} 'left' | 'right' | 'top'
         */
        GetLabelPosition(field) {
            var self = this;
            if (self.diyStore && self.diyStore.IsPhoneView) {
                return "top";
            }
            if (field) {
                if (field.Component == "CodeEditor"
                    || field.Component == "JsonTable"
                    || field.Component == "RichText"
                    || field.Component == "JoinTable"
                    || field.Component == "JoinForm"
                ) {
                    return "top";
                }
            }
            if (self.LabelPosition && !self.DiyCommon.IsNull(self.LabelPosition)) {
                return self.LabelPosition;
            }
            return self.DiyCommon.IsNull(self.DiyTableModel.FormLabelPosition) ? "right" : self.DiyTableModel.FormLabelPosition;
        },
        
        /**
         * 获取请输入/选择提示文本
         * @param {Object} field - 字段配置
         * @returns {String} 提示文本
         */
        GetPleaseInputText(field) {
            var self = this;
            var selectComponents = [
                "SelectTree", "FontAwesome", "Department", "Cascader", 
                "MapArea", "Map", "ColorPicker", "Rate", "DateTime", 
                "MultipleSelect", "Select", "Checkbox", "Radio", "Switch"
            ];
            var uploadComponents = ["FileUpload", "ImgUpload"];
            
            if (selectComponents.includes(field.Component)) {
                return self.$t("Msg.PleaseSelect");
            }
            if (uploadComponents.includes(field.Component)) {
                return self.$t("Msg.PleaseUpload");
            }
            return self.$t("Msg.PleaseInput");
        },
        
        /**
         * 获取字段是否应该显示
         * 根据权限、可见性等判断
         * @param {Object} field - 字段配置
         * @returns {Boolean}
         */
        GetFieldIsShow(field) {
            var self = this;
            // 默认不显示审计字段，需手动在表单属性中开启
            if (self.DiyCommon.DefaultFieldNames.indexOf(field.Name) > -1 && !self.DiyTableModel.DisplayDefaultField) {
                return false;
            }
            
            if (self.LoadMode == "Design") {
                return true;
            }
            
            // 判断权限 GetCurrentUser
            if (!self.DiyCommon.IsNull(field.BindRole) && field.BindRole.length > 0) {
                // 如果不是超级管理员才判断
                if (self.GetCurrentUser._IsAdmin != true) {
                    var haveLimit = false;
                    if (!self.DiyCommon.IsNull(self.GetCurrentUser._Roles)) {
                        field.BindRole.forEach((bindRole) => {
                            self.GetCurrentUser._Roles.forEach((role) => {
                                if (role.Id.toLowerCase() == bindRole.toLowerCase()) {
                                    haveLimit = true;
                                }
                            });
                        });
                        if (!haveLimit) {
                            field.Visible = false;
                            return false;
                        }
                    } else {
                        field.Visible = false;
                        return false;
                    }
                }
            }
            return self.DiyCommon.IsNull(field.Visible) ? true : field.Visible;
        },
        
        /**
         * 获取字段只读状态
         * @param {Object} field - 字段配置
         * @returns {Boolean}
         */
        GetFieldReadOnly(field) {
            var self = this;
            // 如果按钮设置了预览可点击
            if (field.Component == "Button" && 
                field.Config.Button && 
                field.Config.Button.PreviewCanClick === true && 
                !field.Readonly && 
                !(self.ReadonlyFields && self.ReadonlyFields.indexOf(field.Name) > -1)) {
                return false;
            }

            if (self.FormMode == "View") {
                return true;
            }
            if (self.ReadonlyFields && self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true;
            }
            if (self.NotSaveField) {
                for (let index = 0; index < self.NotSaveField.length; index++) {
                    const element = self.NotSaveField[index];
                    if (element.toLowerCase() == field.Name.toLowerCase()) {
                        return true;
                    }
                }
            }
            return field.Readonly ? true : false;
        }
    }
};
