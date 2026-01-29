/**
 * LocalStorage 管理工具
 * 统一使用 microi.net 作为主 key 存储所有数据
 */

const STORAGE_KEY = 'microi.net';

// 初始化存储结构
const initStorage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Microi：[LocalStorage] 初始化失败:', e);
    }
    return {};
};

// 获取整个存储对象
const getStorage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
};

// 保存整个存储对象
const saveStorage = (data) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Microi：[LocalStorage] 保存失败:', e);
    }
};

const LocalStorageManager = {
    // 配置
    config: {
        // 最大允许存储的表格配置数量
        maxTableConfigs: 50,
        // 表格配置的前缀
        tableConfigPrefix: "DiyTableRowPageSize_"
    },

    /**
     * 获取值
     */
    get(key) {
        const storage = getStorage();
        return storage[key];
    },

    /**
     * 设置值
     */
    set(key, value) {
        const storage = getStorage();
        storage[key] = value;
        saveStorage(storage);
    },

    /**
     * 删除值
     */
    remove(key) {
        const storage = getStorage();
        delete storage[key];
        saveStorage(storage);
    },

    /**
     * 批量设置
     */
    setMultiple(obj) {
        const storage = getStorage();
        Object.assign(storage, obj);
        saveStorage(storage);
    },

    /**
     * 获取所有数据
     */
    getAll() {
        return getStorage();
    },

    /**
     * 清理过期的表格配置
     * 保留最近使用的 N 个表格配置
     */
    cleanOldTableConfigs() {
        try {
            const storage = getStorage();
            const tableConfigs = [];

            // 收集所有表格配置
            for (let key in storage) {
                if (key.startsWith(this.config.tableConfigPrefix)) {
                    tableConfigs.push({ key });
                }
            }

            // 如果超过限制，删除旧的
            if (tableConfigs.length > this.config.maxTableConfigs) {
                const toRemove = tableConfigs.length - this.config.maxTableConfigs;
                console.log(`Microi：[LocalStorage] 清理 ${toRemove} 个旧的表格配置`);

                for (let i = 0; i < toRemove; i++) {
                    delete storage[tableConfigs[i].key];
                }
                saveStorage(storage);
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
        this.set(key, value);

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
        return this.get(key);
    },

    /**
     * 获取 LocalStorage 使用情况
     */
    getUsageInfo() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) || '{}';
            const size = stored.length + STORAGE_KEY.length;
            const data = JSON.parse(stored);
            const itemCount = Object.keys(data).length;

            return {
                totalSize: size,
                totalSizeKB: (size / 1024).toFixed(2),
                totalSizeMB: (size / 1024 / 1024).toFixed(2),
                itemCount: itemCount,
                keys: Object.keys(data)
            };
        } catch (e) {
            return null;
        }
    },

    /**
     * 迁移旧的 localStorage 数据到新的统一格式
     */
    migrateOldData() {
        // 旧 key 到新 key 的映射
        const keyMapping = {
            'Microi.Did': 'Did',
            'Microi.ApiBase': 'ApiBase',
            'Microi.OsClient': 'OsClient',
            'Microi.Token': 'Token',
            'Microi.CurrentUser': 'CurrentUser',
            'Microi.SysConfig': 'SysConfig',
            'Microi.DesktopBg': 'DesktopBg',
            'Microi.Token.Expires': 'TokenExpires',  // 注意这个映射
            'Microi.LastLoginAccount': 'LastLoginAccount',
            'Microi.DemoSelfLogout': 'DemoSelfLogout',
            'Microi.themeColor': 'themeColor',
            'Microi.SystemStyle': 'SystemStyle',
            'Microi.Lang': 'Lang'
        };
        
        const storage = getStorage();
        let migrated = false;
        
        // 按映射迁移旧 key
        for (const [oldKey, newKey] of Object.entries(keyMapping)) {
            const value = localStorage.getItem(oldKey);
            if (value !== null) {
                try {
                    // 尝试解析 JSON
                    storage[newKey] = JSON.parse(value);
                } catch {
                    storage[newKey] = value;
                }
                localStorage.removeItem(oldKey);
                migrated = true;
            }
        }
        
        // 迁移 microi-app 数据
        const microiApp = localStorage.getItem('microi-app');
        if (microiApp) {
            try {
                const appData = JSON.parse(microiApp);
                storage.app = appData;
                localStorage.removeItem('microi-app');
                migrated = true;
            } catch {}
        }

        // 迁移旧的 microi-diy 数据（如果存在）
        const microiDiy = localStorage.getItem('microi-diy');
        if (microiDiy) {
            try {
                const diyData = JSON.parse(microiDiy);
                // 合并到 storage
                Object.assign(storage, diyData);
                localStorage.removeItem('microi-diy');
                migrated = true;
            } catch {}
        }
        
        // 迁移表格配置等以 Microi. 开头的数据
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith('Microi.')) {
                const value = localStorage.getItem(key);
                const newKey = key.replace('Microi.', '');
                try {
                    storage[newKey] = JSON.parse(value);
                } catch {
                    storage[newKey] = value;
                }
                localStorage.removeItem(key);
                migrated = true;
            }
        }
        
        if (migrated) {
            saveStorage(storage);
            console.log('Microi：[LocalStorage] 数据迁移完成');
        }
    },

    /**
     * 启动时自动清理和迁移
     */
    init() {
        // 先迁移旧数据
        this.migrateOldData();
        
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
