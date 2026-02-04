/**
 * 聊天系统通用工具函数
 * PC端和移动端共享使用
 */

/**
 * 格式化消息内容（处理换行）
 */
export function formatMessageContent(content) {
    if (!content) return '';
    return content.replace(/\n/g, '<br>');
}

/**
 * 格式化时间
 */
export function formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // 一分钟内
    if (diff < 60000) {
        return '刚刚';
    }
    
    // 一小时内
    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    }
    
    // 今天
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (date >= today) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 昨天
    const yesterday = new Date(today.getTime() - 86400000);
    if (date >= yesterday) {
        return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 今年
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + 
               date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 其他
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * 消息去重保护
 */
let _lastMessageTime = {};

export function isDuplicateMessage(message, timeout = 1000) {
    const messageKey = `${message.FromUserId}-${message.ToUserId}-${message.Content?.substring(0, 50)}`;
    const now = Date.now();
    
    if (_lastMessageTime[messageKey] && (now - _lastMessageTime[messageKey] < timeout)) {
        return true; // 是重复消息
    }
    
    _lastMessageTime[messageKey] = now;
    
    // 清理过期的缓存（保留最近100条）
    const keys = Object.keys(_lastMessageTime);
    if (keys.length > 100) {
        const sortedKeys = keys.sort((a, b) => _lastMessageTime[b] - _lastMessageTime[a]);
        sortedKeys.slice(50).forEach(key => delete _lastMessageTime[key]);
    }
    
    return false; // 不是重复消息
}

/**
 * 清理消息去重缓存
 */
export function clearMessageDuplicateCache() {
    _lastMessageTime = {};
}

/**
 * 渲染数据表格
 */
export function renderDataTable(content) {
    // console.log('[数据表格] 开始渲染:', typeof content, content);
    
    if (!content) return '<p style="color: #999;">数据为空</p>';
    
    try {
        // 尝试解析JSON
        let data = typeof content === 'string' ? JSON.parse(content) : content;
        
        // console.log('[数据表格] 解析后的数据:', data);
        // console.log('[数据表格] 是否为数组:', Array.isArray(data));
        // console.log('[数据表格] 数组长度:', Array.isArray(data) ? data.length : 'N/A');
        
        // 如果是数组，渲染为表格
        if (Array.isArray(data) && data.length > 0) {
            // 获取表头（从第一个对象的keys）
            const headers = Object.keys(data[0]);
            // console.log('[数据表格] 表头:', headers);
            
            if (headers.length === 0) {
                return '<p style="color: #999;">数据格式错误：对象为空</p>';
            }
            
            let tableHtml = '<table class="data-table">';
            
            // 表头
            tableHtml += '<thead><tr>';
            headers.forEach(header => {
                const headerText = escapeHtml(String(header));
                tableHtml += `<th title="${headerText}">${headerText}</th>`;
            });
            tableHtml += '</tr></thead>';
            
            // 表体
            tableHtml += '<tbody>';
            data.forEach((row, rowIndex) => {
                // console.log(`[数据表格] 第${rowIndex}行数据:`, row);
                tableHtml += '<tr>';
                headers.forEach(header => {
                    const value = row[header];
                    const displayValue = value !== null && value !== undefined ? value : '-';
                    const valueStr = String(displayValue);
                    const escapedValue = escapeHtml(valueStr);
                    // console.log(`[数据表格] ${header}:`, value, '->', escapedValue);
                    tableHtml += `<td title="${escapedValue}">${escapedValue}</td>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody>';
            
            tableHtml += '</table>';
            
            // 添加数据统计信息
            tableHtml += `<div class="data-table-footer">共 ${data.length} 条数据</div>`;
            
            // console.log('[数据表格] 生成的HTML长度:', tableHtml.length);
            return tableHtml;
        } else if (typeof data === 'object' && data !== null) {
            // 如果是单个对象，渲染为键值对表格
            let tableHtml = '<table class="data-table">';
            tableHtml += '<tbody>';
            
            Object.keys(data).forEach(key => {
                const value = data[key];
                const displayValue = value !== null && value !== undefined ? value : '-';
                const valueStr = String(displayValue);
                tableHtml += '<tr>';
                tableHtml += `<th title="${escapeHtml(key)}">${escapeHtml(key)}</th>`;
                tableHtml += `<td title="${escapeHtml(valueStr)}">${escapeHtml(valueStr)}</td>`;
                tableHtml += '</tr>';
            });
            
            tableHtml += '</tbody></table>';
            return tableHtml;
        } else {
            // 其他类型，显示原始内容
            return `<pre class="data-content">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        }
    } catch (error) {
        console.error('[数据表格] 解析错误:', error, '原始内容:', content);
        // 解析失败，显示原始内容
        return `<pre class="data-content">${escapeHtml(String(content))}</pre>`;
    }
}

/**
 * HTML转义，防止XSS
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 初始化WebSocket事件监听（PC和移动端共用）
 * @param {Object} websocket - WebSocket实例
 * @param {Object} callbacks - 回调函数对象
 * @param {Object} options - 配置选项
 */
export function initWebSocketEvents(websocket, callbacks, options = {}) {
    if (!websocket) {
        console.warn('[ChatCommon] WebSocket实例不存在');
        return false;
    }
    
    // 检查全局标志：防止重复注册
    if (window._chatEventsRegistered) {
        console.warn('[ChatCommon] ⚠️ 聊天事件已注册，阻止重复注册');
        return false;
    }
    
    const {
        enableDuplicateCheck = true,  // 启用消息去重
        logPrefix = '[ChatCommon]'     // 日志前缀
    } = options;
    
    console.log(`${logPrefix} 开始注册 WebSocket 事件监听器`);
    
    // 接收普通消息
    websocket.on("ReceiveSendToUser", (message) => {
        // 调试计数器
        if (!window._receiveSendToUserCount) window._receiveSendToUserCount = 0;
        window._receiveSendToUserCount++;
        
        if (window._receiveSendToUserCount % 10 === 0) {
            console.warn(`${logPrefix} ReceiveSendToUser 已被触发 ${window._receiveSendToUserCount} 次`);
        }
        
        console.log(`${logPrefix} ReceiveSendToUser:`, message);
        
        // 消息去重检查
        if (enableDuplicateCheck && isDuplicateMessage(message)) {
            console.log(`${logPrefix} [防死循环] 忽略重复消息`);
            return;
        }
        
        if (callbacks.onReceiveMessage) {
            callbacks.onReceiveMessage(message);
        }
    });
    
    // 接收AI流式数据块
    websocket.on("ReceiveAIChunk", (chunk, fromUserId, toUserId, isComplete) => {
        console.log(`${logPrefix} [AI流式]`, { chunk: chunk?.substring(0, 50), fromUserId, toUserId, isComplete });
        if (callbacks.onReceiveAIChunk) {
            callbacks.onReceiveAIChunk(chunk, fromUserId, toUserId, isComplete);
        }
    });
    
    // 接收聊天记录
    websocket.on("ReceiveSendChatRecordToUser", (message) => {
        console.log(`${logPrefix} [接收聊天记录] 收到${message?.length || 0}条消息`);
        if (callbacks.onReceiveChatRecord) {
            callbacks.onReceiveChatRecord(message);
        }
    });
    
    // 接收最近联系人列表
    websocket.on("ReceiveSendLastContacts", (message) => {
        console.log(`${logPrefix} 获取最近联系人列表成功！`);
        if (callbacks.onReceiveLastContacts) {
            callbacks.onReceiveLastContacts(message);
        }
    });
    
    // 接收未读消息数
    websocket.on("ReceiveSendUnreadCountToUser", (message) => {
        console.log(`${logPrefix} 获取到未读消息条数:`, message);
        if (callbacks.onReceiveUnreadCount) {
            callbacks.onReceiveUnreadCount(message);
        }
    });
    
    // 接收连接事件
    websocket.on("ReceiveConnection", (message) => {
        console.log(`${logPrefix} ReceiveConnection:`, message);
        if (callbacks.onConnection) {
            callbacks.onConnection(message);
        }
    });
    
    // 接收断开连接事件
    websocket.on("ReceiveDisConnection", (message) => {
        console.log(`${logPrefix} ReceiveDisConnection:`, message);
        if (callbacks.onDisconnection) {
            callbacks.onDisconnection(message);
        }
    });
    
    // 设置全局标志
    window._chatEventsRegistered = true;
    console.log(`${logPrefix} ✅ WebSocket 事件监听器注册完成（全局唯一）`);
    
    return true;
}

/**
 * 清理WebSocket事件监听
 */
export function cleanupWebSocketEvents(websocket, logPrefix = '[ChatCommon]') {
    if (!websocket) return;
    
    // 注意：SignalR的off()无法移除匿名函数，所以只清理全局标志
    console.log(`${logPrefix} 清理全局聊天事件标志`);
    
    if (window._chatEventsRegistered) {
        window._chatEventsRegistered = false;
    }
    
    // 清理消息去重缓存
    clearMessageDuplicateCache();
}

/**
 * 发送消息
 */
export function sendMessageToUser(websocket, messageData) {
    if (!websocket || !websocket.invoke) {
        console.error('[发送消息] WebSocket未初始化');
        return Promise.reject('WebSocket未初始化');
    }
    
    if (websocket.state !== 'Connected') {
        console.error('[发送消息] WebSocket未连接');
        return Promise.reject('WebSocket未连接');
    }
    
    return websocket.invoke("SendToUser", messageData);
}

/**
 * 获取聊天记录
 */
export function getChatRecord(websocket, fromUserId, toUserId, osClient) {
    if (!websocket || !websocket.invoke) {
        console.error('[获取聊天记录] WebSocket未初始化');
        return Promise.reject('WebSocket未初始化');
    }
    
    if (websocket.state !== 'Connected') {
        console.error('[获取聊天记录] WebSocket未连接');
        return Promise.reject('WebSocket未连接');
    }
    
    return websocket.invoke("SendChatRecordToUser", {
        FromUserId: fromUserId,
        ToUserId: toUserId,
        OsClient: osClient
    });
}

/**
 * 获取最近联系人
 */
export function getLastContacts(websocket, userId, osClient) {
    if (!websocket || !websocket.invoke) {
        console.error('[获取联系人] WebSocket未初始化');
        return Promise.reject('WebSocket未初始化');
    }
    
    if (websocket.state !== 'Connected') {
        console.error('[获取联系人] WebSocket未连接');
        return Promise.reject('WebSocket未连接');
    }
    
    return websocket.invoke("SendLastContacts", {
        UserId: userId,
        ContactUserId: "",
        OsClient: osClient
    });
}
