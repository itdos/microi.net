/**
 * V8 接口引擎本地断点调试运行器
 * 
 * 使用方法：
 * 1. 在 VS Code 中打开要调试的 .js 文件
 * 2. 在代码中设置断点
 * 3. 按 F5 选择 "调试当前 API 引擎" 或 "选择 API 引擎调试"
 * 
 * 注意：此文件模拟了 Microi V8 引擎的 API，用于本地调试
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// ============================================
// 模拟配置 - 可根据需要修改
// ============================================

const MockConfig = {
    OsClient: 'iTdos',
    OsClientModel: {
        AlidnsKeyId: 'your-aliyun-key-id',
        AlidnsKeySecret: 'your-aliyun-key-secret',
        TencentSecretId: 'your-tencent-secret-id',
        TencentSecretKey: 'your-tencent-secret-key'
    }
};

// ============================================
// 模拟 System 命名空间（.NET 兼容）
// ============================================

const System = {
    Text: {
        Encoding: {
            UTF8: {
                GetBytes: (str) => Buffer.from(str, 'utf-8')
            }
        }
    },
    BitConverter: {
        ToString: (bytes) => Buffer.from(bytes).toString('hex').toUpperCase().match(/.{2}/g).join('-')
    }
};

// ============================================
// 模拟 V8 全局对象（核心 API）
// ============================================

const V8 = {
    // 请求参数
    Param: {},
    
    // 客户端标识
    OsClient: MockConfig.OsClient,
    
    // 客户端配置模型
    OsClientModel: MockConfig.OsClientModel,

    // ========== 数据库操作 ==========
    Db: {
        /**
         * 执行原生 SQL
         */
        FromSql: function(sql) {
            console.log('[模拟] V8.Db.FromSql:', sql.substring(0, 100) + '...');
            return {
                ToList: () => {
                    console.log('[模拟] ToList 返回空数组');
                    return [];
                },
                ToModel: () => {
                    console.log('[模拟] ToModel 返回 null');
                    return null;
                },
                ExecuteNonQuery: () => {
                    console.log('[模拟] ExecuteNonQuery 返回 1');
                    return 1;
                },
                ExecuteScalar: () => {
                    console.log('[模拟] ExecuteScalar 返回 null');
                    return null;
                }
            };
        },

        /**
         * 查询列表
         */
        GetList: function(sql, params) {
            console.log('[模拟] V8.Db.GetList:', sql);
            return [];
        },

        /**
         * 查询单个
         */
        GetModel: function(sql, params) {
            console.log('[模拟] V8.Db.GetModel:', sql);
            return null;
        },

        /**
         * 执行 SQL
         */
        Execute: function(sql, params) {
            console.log('[模拟] V8.Db.Execute:', sql);
            return 1;
        }
    },

    // ========== HTTP 请求 ==========
    Http: {
        /**
         * GET 请求
         */
        Get: function(options) {
            if (typeof options === 'string') {
                options = { Url: options };
            }
            console.log('[模拟] V8.Http.Get:', options.Url);
            return '{"Code": 1, "Data": "mock"}';
        },

        /**
         * POST 请求
         */
        Post: function(options) {
            if (typeof options === 'string') {
                options = { Url: options };
            }
            console.log('[模拟] V8.Http.Post:', options.Url);
            if (options.PostParam) {
                console.log('[模拟] PostParam:', JSON.stringify(options.PostParam));
            }
            if (options.PostParamString) {
                console.log('[模拟] PostParamString:', options.PostParamString.substring(0, 100));
            }
            // 模拟 get-client-ip 接口
            if (options.Url && options.Url.includes('get-client-ip')) {
                return JSON.stringify({ Code: 1, Data: '127.0.0.1' });
            }
            return '{"Code": 1, "Msg": "模拟响应", "Response": {}}';
        },

        /**
         * POST JSON 请求
         */
        PostJson: function(url, data, headers) {
            console.log('[模拟] V8.Http.PostJson:', url);
            return '{"Code": 1, "Msg": "模拟响应"}';
        }
    },

    // ========== 缓存操作 ==========
    Cache: {
        _store: new Map(),

        Get: function(key) {
            console.log('[模拟] V8.Cache.Get:', key);
            return this._store.get(key) || null;
        },
        Set: function(key, value, expireSeconds) {
            console.log('[模拟] V8.Cache.Set:', key, '=', value);
            this._store.set(key, value);
            return true;
        },
        Remove: function(key) {
            console.log('[模拟] V8.Cache.Remove:', key);
            this._store.delete(key);
            return true;
        },
        Exists: function(key) {
            return this._store.has(key);
        }
    },

    // ========== 加密助手 ==========
    EncryptHelper: {
        /**
         * SHA256 Hex
         */
        Sha256Hex: function(str) {
            return crypto.createHash('sha256').update(str).digest('hex');
        },

        /**
         * HMAC-SHA256
         */
        HmacSha256: function(key, data) {
            const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key);
            const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            return crypto.createHmac('sha256', keyBuffer).update(dataBuffer).digest();
        },

        /**
         * MD5
         */
        MD5: function(str) {
            return crypto.createHash('md5').update(str).digest('hex');
        },

        /**
         * Base64 编码
         */
        Base64Encode: function(str) {
            return Buffer.from(str).toString('base64');
        },

        /**
         * Base64 解码
         */
        Base64Decode: function(str) {
            return Buffer.from(str, 'base64').toString('utf-8');
        }
    },

    // ========== 阿里云 DNS ==========
    Alidns: {
        UptESADomainRecord: function(options) {
            console.log('[模拟] V8.Alidns.UptESADomainRecord:', options.RecordId, '->', options.Value);
            return { Code: 1, Msg: '模拟成功' };
        },
        UptDomainRecord: function(options) {
            console.log('[模拟] V8.Alidns.UptDomainRecord:', options.RecordId, options.RR, '->', options.Value);
            return { Code: 1, Msg: '模拟成功' };
        },
        GetDomainRecords: function(options) {
            console.log('[模拟] V8.Alidns.GetDomainRecords');
            return { Code: 1, Data: [] };
        }
    },

    // ========== 通用方法 ==========
    Method: {
        GetClientIP: function() {
            console.log('[模拟] V8.Method.GetClientIP');
            return { Code: 1, Data: '127.0.0.1' };
        },
        NewGuid: function() {
            return crypto.randomUUID();
        }
    },

    // ========== 日志 ==========
    Log: {
        Info: (msg) => console.log('[INFO]', msg),
        Warn: (msg) => console.warn('[WARN]', msg),
        Error: (msg) => console.error('[ERROR]', msg),
        Debug: (msg) => console.log('[DEBUG]', msg)
    },

    // ========== 工具类 ==========
    Util: {
        NewGuid: () => crypto.randomUUID(),
        Now: () => new Date().toISOString(),
        Today: () => new Date().toISOString().split('T')[0]
    }
};

// ============================================
// 全局辅助函数（Microi V8 引擎内置）
// ============================================

/**
 * 日期格式化函数
 */
function DateNow(format = 'yyyy-MM-dd HH:mm:ss') {
    const now = new Date();
    const map = {
        'yyyy': now.getFullYear(),
        'MM': String(now.getMonth() + 1).padStart(2, '0'),
        'dd': String(now.getDate()).padStart(2, '0'),
        'HH': String(now.getHours()).padStart(2, '0'),
        'mm': String(now.getMinutes()).padStart(2, '0'),
        'ss': String(now.getSeconds()).padStart(2, '0')
    };
    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, match => map[match]);
}

// ============================================
// 调试运行器核心
// ============================================

/**
 * 运行 API 引擎代码
 */
function runApiEngine(filePath, params = {}) {
    // 设置请求参数
    V8.Param = params;

    console.log('\n' + '='.repeat(60));
    console.log('🚀 V8 接口引擎断点调试');
    console.log('='.repeat(60));
    console.log('📄 文件:', path.basename(filePath));
    console.log('📂 路径:', filePath);
    console.log('📦 参数:', JSON.stringify(params, null, 2));
    console.log('='.repeat(60) + '\n');

    try {
        // 读取代码
        const code = fs.readFileSync(filePath, 'utf-8');
        
        // 创建执行函数，注入所有全局变量
        // 使用 Function 构造器，可以让你在原文件中设置断点
        const wrappedCode = `
            // 注入全局变量
            const V8 = this.V8;
            const System = this.System;
            const DateNow = this.DateNow;
            const console = this.console;
            
            // 用于返回结果的变量
            let __result__ = undefined;
            
            // 执行用户代码
            __result__ = (function() {
                ${code}
            })();
            
            return __result__;
        `;

        const fn = new Function(wrappedCode);
        const context = {
            V8,
            System,
            DateNow,
            console
        };
        
        const result = fn.call(context);

        console.log('\n' + '='.repeat(60));
        console.log('✅ 执行完成');
        console.log('='.repeat(60));
        console.log('📤 返回结果:');
        console.log(JSON.stringify(result, null, 2));
        console.log('='.repeat(60) + '\n');

        return result;
    } catch (err) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ 执行错误');
        console.error('='.repeat(60));
        console.error('错误信息:', err.message);
        console.error('错误堆栈:', err.stack);
        console.error('='.repeat(60) + '\n');
        throw err;
    }
}

/**
 * 扫描所有 API 引擎文件
 */
function listApiEngines() {
    const apiEnginesDir = path.join(__dirname, 'api-engines');
    const files = [];

    function scanDir(dir, prefix = '') {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = prefix ? `${prefix}/${item}` : item;
            if (fs.statSync(fullPath).isDirectory()) {
                scanDir(fullPath, relativePath);
            } else if (item.endsWith('.js')) {
                files.push({ path: fullPath, name: relativePath });
            }
        }
    }

    scanDir(apiEnginesDir);
    return files;
}

/**
 * 交互式选择文件
 */
async function selectFile() {
    const files = listApiEngines();
    
    if (files.length === 0) {
        console.log('❌ 没有找到 API 引擎文件');
        console.log('💡 请先运行: npm run pull');
        process.exit(1);
    }

    console.log('\n📋 可调试的 API 引擎文件:\n');
    files.forEach((f, i) => {
        console.log(`  ${String(i + 1).padStart(3)}. ${f.name}`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('\n请输入文件编号或名称: ', (answer) => {
            rl.close();
            
            const num = parseInt(answer);
            if (!isNaN(num) && num >= 1 && num <= files.length) {
                resolve(files[num - 1].path);
            } else {
                const found = files.find(f => 
                    f.name.toLowerCase().includes(answer.toLowerCase())
                );
                if (found) {
                    resolve(found.path);
                } else {
                    console.log('❌ 未找到匹配的文件');
                    process.exit(1);
                }
            }
        });
    });
}

/**
 * 解析文件路径
 */
function resolveFilePath(input) {
    // 绝对路径
    if (path.isAbsolute(input) && fs.existsSync(input)) {
        return input;
    }
    
    // 相对于 api-engines 目录
    const inApiEngines = path.join(__dirname, 'api-engines', input);
    if (fs.existsSync(inApiEngines)) {
        return inApiEngines;
    }
    
    // 相对于当前目录
    if (fs.existsSync(input)) {
        return path.resolve(input);
    }
    
    // 模糊搜索
    const files = listApiEngines();
    const found = files.find(f => 
        f.name.toLowerCase().includes(input.toLowerCase()) ||
        path.basename(f.path).toLowerCase().includes(input.toLowerCase())
    );
    
    if (found) {
        return found.path;
    }
    
    return null;
}

// ============================================
// 主程序
// ============================================

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        // 指定文件模式
        const filePath = resolveFilePath(args[0]);
        if (!filePath) {
            console.error('❌ 文件不存在:', args[0]);
            process.exit(1);
        }
        
        // 解析参数
        let params = {};
        if (args.length > 1) {
            try {
                params = JSON.parse(args[1]);
            } catch (e) {
                console.warn('⚠️ 参数解析失败，使用空参数');
            }
        }
        
        runApiEngine(filePath, params);
    } else {
        // 交互式选择模式
        const filePath = await selectFile();
        runApiEngine(filePath, {});
    }
}

// 导出
module.exports = {
    runApiEngine,
    listApiEngines,
    resolveFilePath,
    V8,
    System,
    DateNow
};

// 直接运行
if (require.main === module) {
    main().catch(err => {
        console.error('运行失败:', err);
        process.exit(1);
    });
}
