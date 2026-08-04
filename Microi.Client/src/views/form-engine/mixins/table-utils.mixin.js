const ROW_ACTION_ASCII_LABEL_WIDTH = 7;
const ROW_ACTION_WIDE_LABEL_WIDTH = 12;
const ROW_ACTION_BUTTON_PADDING_AND_BORDER_WIDTH = 20;
const ROW_ACTION_CUSTOM_LEADING_ICON_WIDTH = 16;
const ROW_ACTION_ELEMENT_LEADING_ICON_WIDTH = 18;
const ROW_ACTION_TRAILING_ICON_WIDTH = 17;
const ROW_ACTION_BUTTON_GAP_WIDTH = 6;
const ROW_ACTION_CELL_RESERVE_WIDTH = 30;
const ROW_ACTION_MIN_COLUMN_WIDTH = 56;

function getRowActionLabelWidth(label) {
    return Array.from(String(label || "")).reduce(function (total, character) {
        return total + (/^[\u0000-\u00ff]$/.test(character)
            ? ROW_ACTION_ASCII_LABEL_WIDTH
            : ROW_ACTION_WIDE_LABEL_WIDTH);
    }, 0);
}

/**
 * 表格工具函数 Mixin
 * 包含 diy-table-rowlist.vue 专用的表格处理函数
 * 
 * 注意：通用函数已移动到 diy-common.mixin.js
 * 
 * 用于 diy-table-rowlist.vue
 */

export default {
    methods: {
        /**
         * 获取表格卡片列数
         * @returns {Number|String} span值或'five'
         */
        GetTableCardCol() {
            var self = this;
            if (!self.SysMenuModel || !self.SysMenuModel.TableCardCol) {
                return 6; // 默认每行4个，Element 栅格 span=6
            }

            const cardsPerRow = Number(self.SysMenuModel.TableCardCol);

            if (!Number.isFinite(cardsPerRow) || cardsPerRow <= 0) {
                return 6;
            }
            
            // 特殊处理一行5个的情况
            if (cardsPerRow === 5) {
                return 'five';
            }
            
            const span = Math.floor(24 / cardsPerRow);
            return Math.max(span, 1);
        },
        
        /**
         * 判断是否使用自定义5列布局
         * @returns {Boolean}
         */
        IsCardFiveCol() {
            var self = this;
            if (!self.SysMenuModel || !self.SysMenuModel.TableCardCol) {
                return false;
            }
            return Number(self.SysMenuModel.TableCardCol) === 5;
        },
        
        /**
         * 切换表格显示模式
         */
        ShiftTableDisplayMode() {
            var self = this;
            if (self.TableDisplayMode == "Table") {
                self.TableDisplayMode = "Card";
            } else {
                self.TableDisplayMode = "Table";
            }
            // 切换显示模式时清空卡片选择
            self.cardSelection = [];
            self.TableMultipleSelection = [];

            // 🔥 手机端 + 卡片模式强制每页 15 条（PC端不限制，按用户配置）
            if (self.diyStore && self.diyStore.IsPhoneView
                && self.TableDisplayMode === "Card" && self.DiyTableRowPageSize > 15) {
                self.DiyTableRowPageSize = 15;
                if (typeof self.GetDiyTableRow === "function") {
                    self.GetDiyTableRow({ _PageIndex: 1 });
                }
            }

            // el-table 从 v-if 的卡片模式重新挂载后，需要在 DOM 更新完成时
            // 主动重算固定列；否则固定操作列仍可能沿用切换前的偏移量。
            if (self.TableDisplayMode === "Table" && typeof self.$nextTick === "function") {
                self.$nextTick(function () {
                    var tableRef = self.$refs && self.$refs["diy-table-" + self.TableId];
                    if (Array.isArray(tableRef)) tableRef = tableRef[0];
                    if (tableRef && typeof tableRef.doLayout === "function") {
                        tableRef.doLayout();
                    }
                });
            }
        },

        GetRowActionButtonWidth(label, options) {
            options = options || {};
            var iconWidth = 0;
            if (options.customLeadingIcon) {
                iconWidth += ROW_ACTION_CUSTOM_LEADING_ICON_WIDTH;
            } else if (options.leadingIcon) {
                iconWidth += ROW_ACTION_ELEMENT_LEADING_ICON_WIDTH;
            }
            if (options.trailingIcon) {
                iconWidth += ROW_ACTION_TRAILING_ICON_WIDTH;
            }
            return getRowActionLabelWidth(label)
                + ROW_ACTION_BUTTON_PADDING_AND_BORDER_WIDTH
                + iconWidth;
        },

        GetRowActionWidthsTotal(widths) {
            var validWidths = (Array.isArray(widths) ? widths : [])
                .filter(function (width) { return Number(width) > 0; });
            if (validWidths.length === 0) return 0;
            return validWidths.reduce(function (total, width) {
                return total + Number(width);
            }, 0) + (validWidths.length - 1) * ROW_ACTION_BUTTON_GAP_WIDTH;
        },

        /**
         * 统一估算行外 V8 按钮占用宽度。只在相邻按钮之间计算 gap，
         * 避免把最后一个按钮后面不存在的间隔也算入操作列。
         */
        GetRowActionButtonsWidth(buttons) {
            var visibleButtons = (Array.isArray(buttons) ? buttons : [])
                .filter(function (button) { return button && (button.IsVisible === true || button.IsVisible === 1); });
            var self = this;
            return self.GetRowActionWidthsTotal(visibleButtons.map(function (button) {
                return self.GetRowActionButtonWidth(button.Name, { customLeadingIcon: true });
            }));
        },

        ShouldShowRowWorkflowAction(row) {
            return !!row && this.IsWorkFlowMenu() && row._IsInTableAdd !== true;
        },

        ShouldShowRowDetailAction(row) {
            return !!row
                && this.IsPermission("NoDetail")
                && row._IsInTableAdd !== true
                && row.IsVisibleDetail == true;
        },

        ShouldShowRowRestoreAction(row) {
            return !!row && this.IsTrashMode && row._IsInTableAdd !== true;
        },

        ShouldShowRowMoreAction(row) {
            if (!row || this.IsTrashMode) return false;
            var isWorkflow = this.IsWorkFlowMenu();
            var tableChildReadonly = !!(this.TableChildField && this.TableChildField.Readonly);
            var canEdit = !isWorkflow
                && this.TableChildFormMode != "View"
                && !tableChildReadonly
                && this._LimitEdit
                && row._IsInTableAdd !== true
                && row.IsVisibleEdit == true;
            var hasVisibleInnerButton = Array.isArray(row._RowMoreBtnsIn)
                && row._RowMoreBtnsIn.some(function (button) { return button && button.IsVisible; });
            var canDelete = this._LimitDel && row.IsVisibleDel == true;
            return canEdit || hasVisibleInnerButton || canDelete;
        },

        GetRowActionLabel(key, fallback) {
            if (typeof this.$t !== "function") return fallback;
            var translated = this.$t(key);
            return translated && translated !== key ? translated : fallback;
        },

        /**
         * 按每行真实渲染的按钮计算宽度，再由列宽取所有行的最大值。
         * 这样不会把“某行最宽的 V8 按钮”与“另一行才可见的内置按钮”重复叠加。
         */
        GetRowActionContentWidth(row) {
            if (!row) return 0;
            if (row.__TreeLazyLoadMore) {
                return this.GetRowActionButtonWidth(
                    row.__TreeLazyLoadMoreText || this.GetRowActionLabel("Msg.LoadMore", "加载更多")
                );
            }

            var widths = [];
            var tableChildReadonly = !!(this.TableChildField && this.TableChildField.Readonly);
            if (!this.IsTrashMode && !tableChildReadonly) {
                var outsideButtonsWidth = this.GetRowActionButtonsWidth(row._RowMoreBtnsOut || []);
                if (outsideButtonsWidth > 0) widths.push(outsideButtonsWidth);
            }
            if (this.ShouldShowRowWorkflowAction(row)) {
                widths.push(this.GetRowActionButtonWidth("去处理", { leadingIcon: true }));
            }
            if (this.ShouldShowRowDetailAction(row)) {
                widths.push(this.GetRowActionButtonWidth(
                    this.GetRowActionLabel("Msg.Detail", "详情"),
                    { leadingIcon: true }
                ));
            }
            if (this.ShouldShowRowRestoreAction(row)) {
                widths.push(this.GetRowActionButtonWidth("恢复", { leadingIcon: true }));
            }
            if (this.ShouldShowRowMoreAction(row)) {
                widths.push(this.GetRowActionButtonWidth(
                    this.GetRowActionLabel("Msg.More", "更多"),
                    { trailingIcon: true }
                ));
            }
            return this.GetRowActionWidthsTotal(widths);
        },

        GetActionCellReserveWidth() {
            return ROW_ACTION_CELL_RESERVE_WIDTH;
        },

        GetActionMinColumnWidth() {
            return ROW_ACTION_MIN_COLUMN_WIDTH;
        },

        IsBusinessTranslateField(field) {
            var self = this;
            if (!field || self.DiyCommon.IsNull(field.Name)) return false;
            var fieldName = field.AsName || field.Name;
            var systemFields = ["Id", "Key", "Code", "CreateTime", "UpdateTime", "CreateUser", "UpdateUser", "OsClient", "FormEngineKey"];
            if (systemFields.indexOf(fieldName) > -1 || systemFields.indexOf(field.Name) > -1) return false;
            if (/Id$/i.test(fieldName) || /Id$/i.test(field.Name)) return false;
            if (/(Key|Code|No|Url|URL|Address|Path)$/i.test(fieldName) || /(Key|Code|No|Url|URL|Address|Path)$/i.test(field.Name)) return false;

            var skipComponents = [
                "ImgUpload", "FileUpload", "Map", "CodeEditor", "TableChild", "Divider",
                "Html", "Button", "ColorPicker", "Qrcode", "JsonTable", "NumberText",
                "Rate", "Progress", "Switch", "DateTime"
            ];
            if (skipComponents.indexOf(field.Component) > -1) return false;
            return true;
        },

        NormalizeBusinessTranslateText(value) {
            if (value === undefined || value === null) return "";
            var text = typeof value === "string" ? value : String(value);
            text = text.replace(/\s+/g, " ").trim();
            if (!text || text.length > 500 || text.indexOf("<") >= 0) return "";
            if (/^https?:\/\//i.test(text) || /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(text)) return "";
            if (/^[+-]?\d+(\.\d+)?$/.test(text)) return "";
            if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}(\s+\d{1,2}:\d{1,2}(:\d{1,2})?)?$/.test(text)) return "";
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return "";
            if (/^01[0-9A-HJKMNP-TV-Z]{24}$/i.test(text)) return "";
            if (/^[\[\{].*[\]\}]$/.test(text)) return "";
            return text;
        },

        GetBusinessDisplayText(row, field) {
            var self = this;
            if (!row) return "";
            var translations = row._BusinessTranslations;
            var hadTranslations = Object.prototype.hasOwnProperty.call(row, "_BusinessTranslations");
            try {
                if (hadTranslations) {
                    row._BusinessTranslations = null;
                }
                var fieldName = field.AsName || field.Name;
                return self.GetColValue ? self.GetColValue({ row: row }, field) : row[fieldName];
            } finally {
                if (hadTranslations) {
                    row._BusinessTranslations = translations;
                }
            }
        },

        GetBusinessTranslateFields() {
            var self = this;
            return (self.GetShowDiyFieldList ? self.GetShowDiyFieldList() : [])
                .filter(function (field) { return self.IsBusinessTranslateField(field); });
        },

        ShouldAutoTranslateBusinessData() {
            var self = this;
            var lang = (self.DiyCommon.GetCurrentLang ? self.DiyCommon.GetCurrentLang() : "").trim();
            if (!lang || lang === "zh-CN" || lang === "cn" || lang === "zh" || lang === "zh-Hans") return false;
            var tableName = "";
            if (self.CurrentDiyTableModel) {
                tableName = self.CurrentDiyTableModel.Name || self.CurrentDiyTableModel.TableName || self.CurrentDiyTableModel.Table || "";
            }
            tableName = (tableName || self.TableName || "").toLowerCase();
            if (tableName === "sys_microistore") return true;
            return !!(self.SysMenuModel && (self.SysMenuModel.AutoTranslateBusinessData === true || self.SysMenuModel.AutoTranslateBusinessData === 1));
        },

        async AutoTranslateBusinessDataIfNeeded() {
            var self = this;
            if (!self.ShouldAutoTranslateBusinessData || !self.ShouldAutoTranslateBusinessData()) return;
            await self.TranslateBusinessData({ silent: true, auto: true });
        },

        async TranslateBusinessData(options) {
            var self = this;
            options = options || {};
            if (self.BusinessDataTranslateLoading) return;
            var lang = (self.DiyCommon.GetCurrentLang ? self.DiyCommon.GetCurrentLang() : "").trim();
            if (!lang || lang === "zh-CN" || lang === "cn" || lang === "zh" || lang === "zh-Hans") {
                if (!options.silent) {
                    self.DiyCommon.Tips(self.$t ? self.$t("Msg.SelectTargetLangFirst") : "Please switch language first.", false);
                }
                return;
            }
            var rows = self.DiyTableRowList || [];
            var fields = self.GetBusinessTranslateFields();
            var textMap = {};
            rows.forEach(function (row) {
                fields.forEach(function (field) {
                    var text = self.NormalizeBusinessTranslateText(self.GetBusinessDisplayText(row, field));
                    if (!text) return;
                    textMap[text] = true;
                });
            });
            var texts = Object.keys(textMap);
            if (texts.length === 0) {
                if (!options.silent) {
                    self.DiyCommon.Tips(self.$t ? self.$t("Msg.NoTranslatableBusinessData") : "No translatable data.", false);
                }
                return;
            }
            self.BusinessDataTranslateLoading = true;
            try {
                var result = await self.DiyCommon.ApiEngine.Run("translate-business-data", {
                    TargetLang: lang,
                    Texts: texts
                });
                if (!self.DiyCommon.Result(result)) {
                    return;
                }
                var translations = (result.Data && (result.Data.Translations || result.Data.translations)) || {};
                rows.forEach(function (row) {
                    var overlay = row._BusinessTranslations || {};
                    fields.forEach(function (field) {
                        var fieldName = field.AsName || field.Name;
                        var text = self.NormalizeBusinessTranslateText(self.GetBusinessDisplayText(row, field));
                        if (translations[text] && translations[text] !== text) {
                            overlay[fieldName] = translations[text];
                        }
                    });
                    row._BusinessTranslations = overlay;
                });
                self.DiyTableRowList = rows.slice();
                if (!options.silent) {
                    self.DiyCommon.Tips(self.$t ? self.$t("Msg.TranslateBusinessDataDone") : "Translated.", true);
                }
            } finally {
                self.BusinessDataTranslateLoading = false;
            }
        },
        
        /**
         * 表格索引方法
         * @param {Number} index - 当前行索引
         * @returns {Number} 实际行号
         */
        indexMethod(index) {
            var self = this;
            if (self.SysMenuModel && self.SysMenuModel.TableIndexAdditive) {
                return (self.DiyTableRowPageIndex - 1) * self.DiyTableRowPageSize + index + 1;
            }
            return index + 1;
        },
        
        /**
         * 预览图片（el-image 组件已内置预览功能，此方法保留以备扩展）
         * @param {String} imageUrl - 图片URL
         */
        previewImage(imageUrl) {
            // el-image 组件自带预览功能，无需额外处理
        }
    }
};
