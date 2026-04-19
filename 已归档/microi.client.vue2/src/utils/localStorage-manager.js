/**
 * LocalStorage 管理工具
 * 用于优化 LocalStorage 的使用，防止无限增长
 */

const LocalStorageManager = {
    // 配置
    config: {
        // 最大允许存储的表格配置数量
        maxTableConfigs: 50,
        // 表格配置的前缀
        tableConfigPrefix: "Microi.DiyTableRowPageSize_",
        // 其他可清理的临时数据前缀
        tempDataPrefixes: ["Microi.DataViewType_", "DiyTableRowPageSize_"]
    },

    /**
     * 清理过期的表格配置
     * 保留最近使用的 N 个表格配置
     */
    cleanOldTableConfigs() {
        try {
            const tableConfigs = [];

            // 收集所有表格配置
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    if (key.startsWith(this.config.tableConfigPrefix) || key.startsWith("DiyTableRowPageSize_")) {
                        tableConfigs.push({
                            key: key
                            // 使用当前时间作为访问时间（实际应该记录真实访问时间）
                            // 这里简化处理：按字母顺序，保留最后的
                        });
                    }
                }
            }

            // 如果超过限制，删除旧的
            if (tableConfigs.length > this.config.maxTableConfigs) {
                const toRemove = tableConfigs.length - this.config.maxTableConfigs;
                console.log(`Microi：[LocalStorage] 清理 ${toRemove} 个旧的表格配置`);

                for (let i = 0; i < toRemove; i++) {
                    localStorage.removeItem(tableConfigs[i].key);
                }
            }
        } catch (e) {
            console.error("Microi：[LocalStorage] 清理失败:", e);
        }
    },

    /**
     * 设置表格配置（带自动清理）
     */
    setTableConfig(tableId, value) {
        const key = `${this.config.tableConfigPrefix}${tableId}`;
        localStorage.setItem(key, value);

        // 定期清理（每设置 10 次检查一次）
        if (!this._setCount) this._setCount = 0;
        this._setCount++;

        if (this._setCount >= 10) {
            this._setCount = 0;
            this.cleanOldTableConfigs();
        }
    },

    /**
     * 获取表格配置
     */
    getTableConfig(tableId) {
        const key = `${this.config.tableConfigPrefix}${tableId}`;
        return localStorage.getItem(key);
    },

    /**
     * 获取 LocalStorage 使用情况
     */
    getUsageInfo() {
        try {
            let totalSize = 0;
            let itemCount = 0;
            const items = [];

            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const size = localStorage[key].length + key.length;
                    totalSize += size;
                    itemCount++;

                    items.push({
                        key: key,
                        size: size,
                        sizeKB: (size / 1024).toFixed(2)
                    });
                }
            }

            return {
                totalSize: totalSize,
                totalSizeKB: (totalSize / 1024).toFixed(2),
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                itemCount: itemCount,
                items: items.sort((a, b) => b.size - a.size)
            };
        } catch (e) {
            return null;
        }
    },

    /**
     * 启动时自动清理
     */
    init() {
        // 检查 LocalStorage 大小
        const usage = this.getUsageInfo();
        if (usage && usage.totalSize > 1024 * 1024) {
            // 超过 1MB
            console.warn(`Microi：[LocalStorage] 当前使用 ${usage.totalSizeKB}KB，开始清理...`);
            this.cleanOldTableConfigs();

            // 再次检查
            const newUsage = this.getUsageInfo();
            console.log(`Microi：[LocalStorage] 清理后: ${newUsage.totalSizeKB}KB`);
        }
    }
};

export default LocalStorageManager;
