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
                return 4; // 默认每行4个，span=6
            }

            const cardsPerRow = self.SysMenuModel.TableCardCol;
            
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
                return true;
            }
            return self.SysMenuModel && self.SysMenuModel.TableCardCol === 5;
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
