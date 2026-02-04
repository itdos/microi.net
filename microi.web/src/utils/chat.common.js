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
 */
export function initWebSocketEvents(websocket, callbacks) {
    if (!websocket) return;
    
    // 接收普通消息
    websocket.on("ReceiveSendToUser", (message) => {
        console.log("ReceiveSendToUser：", message);
        if (callbacks.onReceiveMessage) {
            callbacks.onReceiveMessage(message);
        }
    });
    
    // 接收AI流式数据块
    websocket.on("ReceiveAIChunk", (chunk, fromUserId, toUserId, isComplete) => {
        console.log('[AI流式]', { chunk: chunk?.substring(0, 50), fromUserId, toUserId, isComplete });
        if (callbacks.onReceiveAIChunk) {
            callbacks.onReceiveAIChunk(chunk, fromUserId, toUserId, isComplete);
        }
    });
    
    // 接收聊天记录
    websocket.on("ReceiveSendChatRecordToUser", (message) => {
        console.log(`[接收聊天记录] 收到${message?.length || 0}条消息`);
        if (callbacks.onReceiveChatRecord) {
            callbacks.onReceiveChatRecord(message);
        }
    });
    
    // 接收最近联系人列表
    websocket.on("ReceiveSendLastContacts", (message) => {
        console.log("获取最近联系人列表成功！");
        if (callbacks.onReceiveLastContacts) {
            callbacks.onReceiveLastContacts(message);
        }
    });
    
    // 接收未读消息数
    websocket.on("ReceiveSendUnreadCountToUser", (message) => {
        if (callbacks.onReceiveUnreadCount) {
            callbacks.onReceiveUnreadCount(message);
        }
    });
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
