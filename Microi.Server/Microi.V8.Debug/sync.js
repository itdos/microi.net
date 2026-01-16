#!/usr/bin/env node
/**
 * Microi V8引擎本地调试同步工具
 * 
 * 功能：
 * 1. 从数据库拉取接口引擎代码到本地
 * 2. 监听本地文件变化，自动同步到数据库
 * 3. 检测数据库变更，提示冲突
 * 
 * 使用方法：
 *   npm run pull    - 首次全量拉取
 *   npm run watch   - 启动监听模式（文件变化自动同步）
 *   npm run sync    - 交互式同步
 */

const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { program } = require('commander');

// 创建允许自签名证书的 HTTPS Agent（本地开发环境）
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// 配置 axios 默认使用该 Agent
const http = axios.create({
    httpsAgent: httpsAgent,
    timeout: 30000
});

// ============ 配置 ============
const CONFIG_FILE = '.sync-config.json';
const META_FILE = '.sync-meta.json';
const API_ENGINES_DIR = 'api-engines';

// 默认配置
const DEFAULT_CONFIG = {
    apiBaseUrl: 'https://localhost:7266',
    osClient: '',  // 从后端获取
    pollInterval: 5000  // 轮询间隔（毫秒）
};

// ============ 工具函数 ============

/**
 * 读取配置文件
 */
function loadConfig() {
    const configPath = path.join(__dirname, CONFIG_FILE);
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...config };
    }
    return DEFAULT_CONFIG;
}

/**
 * 保存配置文件
 */
function saveConfig(config) {
    const configPath = path.join(__dirname, CONFIG_FILE);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 读取元数据文件
 */
function loadMeta() {
    const metaPath = path.join(__dirname, META_FILE);
    if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
    return {
        lastSyncTime: null,
        osClient: null,
        engines: {}
    };
}

/**
 * 保存元数据文件
 */
function saveMeta(meta) {
    const metaPath = path.join(__dirname, META_FILE);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * 安全的文件名（移除特殊字符）
 */
function safeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_');
}

/**
 * 获取文件的相对路径信息
 * 新目录结构：api-engines/{OsClient}/{OsClientType}/{OsClientNetwork}/{Category}/{ApiEngineKey}.js
 */
function parseFilePath(filePath) {
    const relativePath = path.relative(path.join(__dirname, API_ENGINES_DIR), filePath);
    const parts = relativePath.split(path.sep);
    
    // 新结构需要5层: OsClient/OsClientType/OsClientNetwork/Category/file.js
    if (parts.length >= 5) {
        const osClient = parts[0];
        const osClientType = parts[1];
        const osClientNetwork = parts[2];
        const category = parts[3];
        const fileName = parts[4];
        const apiEngineKey = fileName.replace('.js', '');
        return { osClient, osClientType, osClientNetwork, category, apiEngineKey, fileName };
    }
    return null;
}

// ============ API 调用 ============

/**
 * 检查调试模式状态
 */
async function checkStatus(config) {
    try {
        const response = await http.get(`${config.apiBaseUrl}/api/V8Debug/GetStatus`);
        return response.data;
    } catch (error) {
        console.error(chalk.red('❌ 无法连接到后端服务：'), error.message);
        console.log(chalk.yellow('请确保后端服务已启动，地址：'), config.apiBaseUrl);
        return null;
    }
}

/**
 * 获取所有接口引擎列表
 */
async function getApiEngineList(config, osClient) {
    try {
        const response = await http.get(`${config.apiBaseUrl}/api/V8Debug/GetApiEngineList`, {
            params: { osClient }
        });
        return response.data;
    } catch (error) {
        console.error(chalk.red('❌ 获取接口引擎列表失败：'), error.message);
        return null;
    }
}

/**
 * 获取增量更新
 */
async function getUpdatedApiEngines(config, osClient, lastSyncTime) {
    try {
        const response = await http.get(`${config.apiBaseUrl}/api/V8Debug/GetUpdatedApiEngines`, {
            params: { osClient, lastSyncTime }
        });
        return response.data;
    } catch (error) {
        console.error(chalk.red('❌ 获取增量更新失败：'), error.message);
        return null;
    }
}

/**
 * 更新接口引擎代码
 */
async function updateApiEngineCode(config, osClient, apiEngineKey, code) {
    try {
        const response = await http.post(`${config.apiBaseUrl}/api/V8Debug/UpdateApiEngineCode`, {
            OsClient: osClient,
            ApiEngineKey: apiEngineKey,
            ApiV8Code: code
        });
        return response.data;
    } catch (error) {
        console.error(chalk.red('❌ 更新接口引擎代码失败：'), error.message);
        return null;
    }
}

/**
 * 检查版本冲突
 */
async function checkVersions(config, osClient, items) {
    try {
        const response = await http.post(`${config.apiBaseUrl}/api/V8Debug/CheckVersions`, {
            OsClient: osClient,
            Items: items
        });
        return response.data;
    } catch (error) {
        console.error(chalk.red('❌ 检查版本失败：'), error.message);
        return null;
    }
}

// ============ 核心功能 ============

/**
 * 首次全量拉取
 */
async function pullAll(config) {
    console.log(chalk.blue('\n🔄 开始全量拉取接口引擎代码...\n'));
    
    // 检查状态
    const statusResult = await checkStatus(config);
    if (!statusResult || statusResult.Code !== 1) {
        console.error(chalk.red('❌ 后端服务状态异常'));
        return;
    }
    
    if (!statusResult.Data.IsDebugMode) {
        console.error(chalk.red('❌ 后端未处于调试模式，请检查 ASPNETCORE_ENVIRONMENT 或使用调试器启动'));
        return;
    }
    
    // 获取 OsClient
    let osClient = config.osClient;
    if (!osClient) {
        const answers = await inquirer.prompt([{
            type: 'input',
            name: 'osClient',
            message: '请输入 OsClient（留空使用默认）：',
            default: ''
        }]);
        osClient = answers.osClient;
    }
    
    // 获取接口列表
    const result = await getApiEngineList(config, osClient);
    if (!result || result.Code !== 1) {
        console.error(chalk.red('❌ 获取接口引擎列表失败：'), result?.Msg);
        return;
    }
    
    const { OsClient: actualOsClient, OsClientType: osClientType, OsClientNetwork: osClientNetwork, List: engines, Total } = result.Data;
    console.log(chalk.green(`✅ 获取到 ${Total} 个接口引擎`));
    console.log(chalk.green(`   OsClient: ${actualOsClient}, Type: ${osClientType}, Network: ${osClientNetwork}\n`));
    
    // 创建目录并写入文件
    const meta = loadMeta();
    meta.osClient = actualOsClient;
    meta.osClientType = osClientType;
    meta.osClientNetwork = osClientNetwork;
    meta.engines = {};
    
    let successCount = 0;
    let skipCount = 0;
    
    for (const engine of engines) {
        const category = safeFileName(engine.Category || '未分类');
        const apiEngineKey = engine.ApiEngineKey;
        
        // 创建目录结构：api-engines/{OsClient}/{OsClientType}/{OsClientNetwork}/{Category}/
        const dirPath = path.join(__dirname, API_ENGINES_DIR, actualOsClient, osClientType, osClientNetwork, category);
        ensureDir(dirPath);
        
        // 写入文件
        const filePath = path.join(dirPath, `${apiEngineKey}.js`);
        const fileHeader = `/**
 * 接口名称：${engine.ApiName || ''}
 * ApiEngineKey：${engine.ApiEngineKey}
 * ApiAddress：${engine.ApiAddress || ''}
 * 分类：${engine.Category || '未分类'}
 * 备注：${engine.ApiRemark || ''}
 * 
 * 最后更新：${engine.UpdateTime}
 * 
 * ⚠️ 此文件由 Microi.V8.Debug 自动生成
 * ⚠️ 修改后保存将自动同步到数据库
 */

`;
        const content = fileHeader + (engine.ApiV8Code || '');
        
        fs.writeFileSync(filePath, content, 'utf-8');
        successCount++;
        
        // 更新元数据
        meta.engines[apiEngineKey] = {
            id: engine.Id,
            apiName: engine.ApiName,
            category: category,
            apiAddress: engine.ApiAddress,
            updateTime: engine.UpdateTime,
            filePath: path.relative(__dirname, filePath)
        };
        
        console.log(chalk.gray(`  📄 ${actualOsClient}/${osClientType}/${osClientNetwork}/${category}/${apiEngineKey}.js`));
    }
    
    // 保存元数据
    meta.lastSyncTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    saveMeta(meta);
    
    // 保存配置
    config.osClient = actualOsClient;
    saveConfig(config);
    
    console.log(chalk.green(`\n✅ 拉取完成！成功: ${successCount}, 跳过: ${skipCount}`));
    console.log(chalk.blue(`📁 文件保存在: ${path.join(__dirname, API_ENGINES_DIR, actualOsClient, osClientType, osClientNetwork)}`));
}

/**
 * 增量同步（从数据库到本地）
 */
async function pullUpdates(config) {
    const meta = loadMeta();
    if (!meta.lastSyncTime || !meta.osClient) {
        console.log(chalk.yellow('⚠️ 尚未进行过全量同步，请先执行 npm run pull'));
        return;
    }
    
    const result = await getUpdatedApiEngines(config, meta.osClient, meta.lastSyncTime);
    if (!result || result.Code !== 1) {
        return;
    }
    
    const { List: engines, Total, ServerTime } = result.Data;
    if (Total === 0) {
        return; // 无更新
    }
    
    console.log(chalk.blue(`\n🔄 发现 ${Total} 个更新...\n`));
    
    for (const engine of engines) {
        const apiEngineKey = engine.ApiEngineKey;
        const localMeta = meta.engines[apiEngineKey];
        
        if (engine.IsDeleted) {
            // 删除本地文件
            if (localMeta && localMeta.filePath) {
                const filePath = path.join(__dirname, localMeta.filePath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(chalk.red(`  🗑️ 删除: ${apiEngineKey}.js`));
                }
            }
            delete meta.engines[apiEngineKey];
            continue;
        }
        
        // 检查本地是否有未保存的修改（简单判断：本地文件修改时间比记录的更新时间新）
        if (localMeta && localMeta.filePath) {
            const filePath = path.join(__dirname, localMeta.filePath);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const localModTime = stats.mtime;
                const recordedTime = new Date(localMeta.updateTime);
                
                if (localModTime > recordedTime) {
                    // 本地有修改，提示冲突
                    console.log(chalk.yellow(`\n⚠️ 冲突: ${apiEngineKey}`));
                    console.log(chalk.gray(`   本地修改时间: ${localModTime.toISOString()}`));
                    console.log(chalk.gray(`   数据库更新时间: ${engine.UpdateTime}`));
                    
                    const answer = await inquirer.prompt([{
                        type: 'list',
                        name: 'action',
                        message: `如何处理 ${apiEngineKey} 的冲突？`,
                        choices: [
                            { name: '保留本地版本（稍后手动上传）', value: 'keep-local' },
                            { name: '使用数据库版本（覆盖本地）', value: 'use-remote' },
                            { name: '跳过此文件', value: 'skip' }
                        ]
                    }]);
                    
                    if (answer.action === 'keep-local') {
                        continue;
                    } else if (answer.action === 'skip') {
                        continue;
                    }
                    // use-remote: 继续执行下面的更新逻辑
                }
            }
        }
        
        // 更新本地文件
        const category = safeFileName(engine.Category || '未分类');
        const dirPath = path.join(__dirname, API_ENGINES_DIR, meta.osClient, category);
        ensureDir(dirPath);
        
        const filePath = path.join(dirPath, `${apiEngineKey}.js`);
        const fileHeader = `/**
 * 接口名称：${engine.ApiName || ''}
 * ApiEngineKey：${engine.ApiEngineKey}
 * ApiAddress：${engine.ApiAddress || ''}
 * 分类：${engine.Category || '未分类'}
 * 备注：${engine.ApiRemark || ''}
 * 
 * 最后更新：${engine.UpdateTime}
 * 
 * ⚠️ 此文件由 Microi.V8Engine.Debug 自动生成
 * ⚠️ 修改后保存将自动同步到数据库
 */

`;
        const content = fileHeader + (engine.ApiV8Code || '');
        fs.writeFileSync(filePath, content, 'utf-8');
        
        // 更新元数据
        meta.engines[apiEngineKey] = {
            id: engine.Id,
            apiName: engine.ApiName,
            category: category,
            apiAddress: engine.ApiAddress,
            updateTime: engine.UpdateTime,
            filePath: path.relative(__dirname, filePath)
        };
        
        console.log(chalk.green(`  📥 更新: ${apiEngineKey}.js`));
    }
    
    meta.lastSyncTime = ServerTime;
    saveMeta(meta);
}

/**
 * 上传本地文件到数据库
 */
async function pushFile(config, filePath) {
    const meta = loadMeta();
    const info = parseFilePath(filePath);
    
    if (!info) {
        console.log(chalk.yellow(`⚠️ 无法解析文件路径: ${filePath}`));
        return;
    }
    
    const { osClient, category, apiEngineKey } = info;
    
    // 读取文件内容（去掉头部注释）
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 移除自动生成的头部注释
    const headerEndMarker = '⚠️ 修改后保存将自动同步到数据库\n */\n\n';
    const headerEndIndex = content.indexOf(headerEndMarker);
    if (headerEndIndex !== -1) {
        content = content.substring(headerEndIndex + headerEndMarker.length);
    }
    
    console.log(chalk.blue(`\n📤 正在上传: ${apiEngineKey}...`));
    
    const result = await updateApiEngineCode(config, osClient, apiEngineKey, content);
    
    if (result && result.Code === 1) {
        console.log(chalk.green(`✅ 同步成功: ${apiEngineKey}`));
        
        // 更新元数据中的时间
        if (meta.engines[apiEngineKey]) {
            meta.engines[apiEngineKey].updateTime = result.Data.UpdateTime;
            saveMeta(meta);
        }
    } else {
        console.log(chalk.red(`❌ 同步失败: ${result?.Msg || '未知错误'}`));
    }
}

/**
 * 启动文件监听
 */
async function startWatch(config) {
    console.log(chalk.blue('\n👀 启动文件监听模式...\n'));
    
    // 检查状态
    const statusResult = await checkStatus(config);
    if (!statusResult || statusResult.Code !== 1 || !statusResult.Data.IsDebugMode) {
        console.error(chalk.red('❌ 后端未处于调试模式'));
        return;
    }
    
    const meta = loadMeta();
    if (!meta.osClient) {
        console.log(chalk.yellow('⚠️ 尚未进行过全量同步，请先执行 npm run pull'));
        return;
    }
    
    const watchPath = path.join(__dirname, API_ENGINES_DIR, '**', '*.js');
    console.log(chalk.gray(`监听路径: ${watchPath}`));
    console.log(chalk.gray(`OsClient: ${meta.osClient}`));
    console.log(chalk.yellow('\n按 Ctrl+C 停止监听\n'));
    
    // 防抖定时器
    const debounceTimers = {};
    
    // 监听文件变化
    const watcher = chokidar.watch(watchPath, {
        ignored: /(^|[\/\\])\../,  // 忽略隐藏文件
        persistent: true,
        ignoreInitial: true
    });
    
    watcher.on('change', (filePath) => {
        // 防抖处理（500ms）
        if (debounceTimers[filePath]) {
            clearTimeout(debounceTimers[filePath]);
        }
        
        debounceTimers[filePath] = setTimeout(async () => {
            delete debounceTimers[filePath];
            await pushFile(config, filePath);
        }, 500);
    });
    
    watcher.on('add', (filePath) => {
        console.log(chalk.gray(`📄 新文件: ${path.basename(filePath)}`));
    });
    
    watcher.on('unlink', (filePath) => {
        console.log(chalk.gray(`🗑️ 文件删除: ${path.basename(filePath)}`));
    });
    
    // 定期检查数据库更新
    console.log(chalk.gray(`每 ${config.pollInterval / 1000} 秒检查数据库更新...\n`));
    
    setInterval(async () => {
        await pullUpdates(config);
    }, config.pollInterval);
    
    console.log(chalk.green('✅ 监听模式已启动！'));
    console.log(chalk.blue('📝 修改 api-engines 目录下的 .js 文件将自动同步到数据库'));
}

// ============ 命令行入口 ============

program
    .name('microi-v8-debug')
    .description('Microi V8引擎本地调试同步工具')
    .version('1.0.0');

program
    .option('-p, --pull', '全量拉取接口引擎代码')
    .option('-w, --watch', '启动监听模式')
    .option('-u, --url <url>', '后端API地址', 'https://localhost:7266')
    .option('-o, --osclient <osClient>', 'OsClient')
    .action(async (options) => {
        const config = loadConfig();
        
        if (options.url) {
            config.apiBaseUrl = options.url;
        }
        if (options.osclient) {
            config.osClient = options.osclient;
        }
        
        if (options.pull) {
            await pullAll(config);
        } else if (options.watch) {
            await startWatch(config);
        } else {
            // 交互式菜单
            const answers = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: '请选择操作：',
                choices: [
                    { name: '📥 全量拉取（首次使用或重新同步）', value: 'pull' },
                    { name: '👀 启动监听模式（自动同步）', value: 'watch' },
                    { name: '⚙️ 配置设置', value: 'config' },
                    { name: '❌ 退出', value: 'exit' }
                ]
            }]);
            
            switch (answers.action) {
                case 'pull':
                    await pullAll(config);
                    break;
                case 'watch':
                    await startWatch(config);
                    break;
                case 'config':
                    const configAnswers = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'apiBaseUrl',
                            message: '后端API地址：',
                            default: config.apiBaseUrl
                        },
                        {
                            type: 'input',
                            name: 'osClient',
                            message: 'OsClient（留空自动获取）：',
                            default: config.osClient || ''
                        },
                        {
                            type: 'number',
                            name: 'pollInterval',
                            message: '轮询间隔（毫秒）：',
                            default: config.pollInterval
                        }
                    ]);
                    saveConfig({ ...config, ...configAnswers });
                    console.log(chalk.green('✅ 配置已保存'));
                    break;
                case 'exit':
                    process.exit(0);
            }
        }
    });

program.parse();
