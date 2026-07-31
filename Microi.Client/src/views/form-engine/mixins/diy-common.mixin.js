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
            var urlPah = '';
            if (typeof(url) == 'object') {
                urlPah = url.Path;
            }else{
                urlPah = url.toString();
            }
            if (urlPah.startsWith(".")) {
                return urlPah;
            }
            //如果是json
            if (urlPah.startsWith('{')) {
                try {
                    var urlObj = JSON.parse(urlPah);
                    if (urlObj && urlObj.Path) {
                        urlPah = urlObj.Path;
                    }
                } catch (e) {
                    // 解析失败，继续使用原始字符串
                }
            }
            if (urlPah.startsWith('http')) {
                return urlPah;
            }
            
            if (urlPah.startsWith('{')) {
                var urlObj = JSON.parse(urlPah);
                return self.SysConfig.FileServer.TrimEnd('/') + urlObj.Path;
            }
            if (urlPah.startsWith('[')) {
                var urlArr = JSON.parse(urlPah);
                if (urlArr.length > 0) {
                    return self.SysConfig.FileServer.TrimEnd('/') + urlArr[0].Path;
                }
            }
            return self.SysConfig.FileServer.TrimEnd('/') + urlPah;
        },

        /**
         * 解析卡片图片字段。
         *
         * 历史 sys_menu.TableCardImgField 保存的是 diy_field.Id，新配置也可能保存 Name / AsName。
         * 卡片行数据只会以 Name / AsName 为属性，不能把字段 Id 直接当成对象 Key 使用。
         */
        ResolveCardImageField(fieldReference) {
            var self = this;
            var reference = fieldReference && typeof fieldReference === "object"
                ? (fieldReference.Id || fieldReference.AsName || fieldReference.Name)
                : fieldReference;
            if (self.DiyCommon.IsNull(reference)) return null;

            return Array.isArray(self.DiyFieldList)
                ? self.DiyFieldList.find(function (item) {
                    return item && (
                        item.Id === reference
                        || item.Name === reference
                        || item.AsName === reference
                    );
                }) || null
                : null;
        },

        GetCardImageFieldName(fieldReference) {
            var field = this.ResolveCardImageField(fieldReference);
            if (field) return field.AsName || field.Name;
            if (fieldReference && typeof fieldReference === "object") {
                return fieldReference.AsName || fieldReference.Name || fieldReference.Id || "";
            }
            return String(fieldReference || "");
        },

        GetCardImageValue(row, fieldReference) {
            if (!row) return null;
            var field = this.ResolveCardImageField(fieldReference);
            var candidates = field
                ? [field.AsName, field.Name, field.Id]
                : [this.GetCardImageFieldName(fieldReference), fieldReference];
            for (var index = 0; index < candidates.length; index++) {
                var key = candidates[index];
                if (!key || !Object.prototype.hasOwnProperty.call(row, key)) continue;
                var value = row[key];
                if (value !== undefined && value !== null && value !== "") return value;
            }
            return null;
        },

        GetCardImageFallbackText(row) {
            var fields = [
                this.CardPrimaryField,
                ...(this.CardShowDiyFieldList || []),
                ...(this.MobileShowFieldList || [])
            ].filter(Boolean);
            for (var index = 0; index < fields.length; index++) {
                var field = fields[index];
                var value = row && row[field.AsName || field.Name];
                if (value === undefined || value === null || String(value).trim() === "") continue;
                return Array.from(String(value).trim())[0].toUpperCase();
            }
            return "#";
        },

        GetCardContentLayoutClass() {
            var style = String((this.SysMenuModel && this.SysMenuModel.TableCardImgStyle) || "");
            var imageUsesFullWidth = /(?:^|;)\s*width\s*:\s*100%\s*(?:;|$)/i.test(style);
            return this.SysMenuModel
                && this.SysMenuModel.TableCardImgPosition === "Left"
                && !imageUsesFullWidth
                ? "card-content-horizontal"
                : "card-content-vertical";
        },

        /**
         * 卡片图片字段是否属于私有文件。
         * sys_user.Avatar 是系统安全约定，即使旧缓存暂未带回字段 Config 也必须按私有文件处理。
         */
        IsPrivateCardImageField(fieldReference) {
            var self = this;
            var field = self.ResolveCardImageField(fieldReference);
            var fieldName = field ? field.Name : self.GetCardImageFieldName(fieldReference);
            var tableName = String(
                (self.CurrentDiyTableModel && self.CurrentDiyTableModel.Name)
                || (self.SysMenuModel && self.SysMenuModel.DiyTableName)
                || self.TableName
                || ""
            ).toLowerCase();
            if (tableName === "sys_user" && String(fieldName || "").toLowerCase() === "avatar") {
                return true;
            }

            if (!field || !field.Config) return false;

            var config = field.Config;
            if (typeof config === "string") {
                try {
                    config = JSON.parse(config);
                } catch (error) {
                    return false;
                }
            }
            var uploadConfig = config && (config.ImgUpload || config.FileUpload || config.Upload);
            var limit = uploadConfig && uploadConfig.Limit;
            return limit === true || limit === 1 || String(limit).toLowerCase() === "true";
        },

        /**
         * 获取卡片图片地址。私有图片首次渲染先显示占位图，签名完成后由响应式缓存自动替换。
         */
        GetCardImageUrl(row, fieldReference) {
            var self = this;
            var field = self.ResolveCardImageField(fieldReference);
            var fieldName = field ? field.Name : self.GetCardImageFieldName(fieldReference);
            var rawValue = self.GetCardImageValue(row, fieldReference);
            if (!rawValue) return self.bodyBgSvg;
            if (!self.IsPrivateCardImageField(fieldReference)) return self.GetFileServerUrl(rawValue);

            var rawKey;
            try {
                rawKey = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);
            } catch (error) {
                rawKey = String(rawValue);
            }
            var tableName = String(
                (self.CurrentDiyTableModel && self.CurrentDiyTableModel.Name)
                || (self.SysMenuModel && self.SysMenuModel.DiyTableName)
                || self.TableName
                || ""
            ).toLowerCase();
            var currentUser = self.GetCurrentUser || (self.diyStore && self.diyStore.GetCurrentUser) || {};
            var cacheKey = [
                currentUser.Id || "",
                self.SysMenuId || "",
                tableName,
                row && row.Id,
                (field && field.Id) || fieldName || "",
                rawKey
            ].join("|");
            if (self._privateCardImageUrls[cacheKey]) return self._privateCardImageUrls[cacheKey];
            if (!self._privateCardImagePending[cacheKey]) {
                self._privateCardImagePending[cacheKey] = true;
                var resolver = tableName === "sys_user" && String(fieldName || "").toLowerCase() === "avatar"
                    ? self.DiyCommon.GetUserAvatarUrl(rawValue, row && row.Id, {
                        SysMenuId: self.SysMenuId
                    })
                    : self.DiyCommon.GetPrivateFileUrl(rawValue, {
                        FormEngineKey: tableName,
                        FormDataId: row && row.Id,
                        FieldId: (field && field.Id) || fieldName,
                        SysMenuId: self.SysMenuId
                    });
                Promise.resolve(resolver).then(function (url) {
                    self._privateCardImageUrls[cacheKey] = url || self.bodyBgSvg;
                }).catch(function () {
                    self._privateCardImageUrls[cacheKey] = self.bodyBgSvg;
                }).finally(function () {
                    delete self._privateCardImagePending[cacheKey];
                });
            }
            return self.bodyBgSvg;
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
                    || field.Component == "TableChild"
                    || field.Component == "CollapseGroup"
                    || field.Component == "Tabs"
                    || field.Component == "Alert"
                    || field.Component == "StaticText"
                    || field.Component == "Html"
                    || field.Component == "HTML"
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
                "MultipleSelect", "Select", "Checkbox", "Radio", "Switch", "Slider", "Transfer"
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
            if (field && field._collapseHidden === true) {
                return false;
            }
            if (field && field._fieldTabsHidden === true) {
                return false;
            }
            if (typeof self.CanShowHiddenFields === "function" && self.CanShowHiddenFields()) {
                return true;
            }
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
                            return false;
                        }
                    } else {
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
