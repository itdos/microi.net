<template>
    <div class="mobile-message">
        <!-- 顶部标题栏 -->
        <div class="message-header">
            <span class="header-title">消息</span>
            <el-icon class="header-action" @click="showNewChat = true"><Plus /></el-icon>
        </div>

        <!-- Tab切换 -->
        <el-tabs v-model="activeTab" class="message-tabs">
            <el-tab-pane label="消息" name="messages"></el-tab-pane>
            <el-tab-pane label="通讯录" name="contacts"></el-tab-pane>
        </el-tabs>

        <!-- 搜索栏 -->
        <div class="search-bar">
            <el-input 
                v-model="searchKeyword" 
                :placeholder="activeTab === 'messages' ? '搜索消息' : '搜索联系人'" 
                :prefix-icon="Search"
                clearable
                class="search-input"
            />
        </div>

        <!-- 消息列表 -->
        <div class="message-list" v-if="activeTab === 'messages' && filteredMessageList.length > 0">
            <div 
                v-for="msg in filteredMessageList" 
                :key="msg.id"
                class="message-item"
                @click="openChat(msg)"
            >
                <div class="avatar-wrapper">
                    <el-avatar :size="50" :src="DiyCommon.GetServerPath(msg.ContactUserAvatar)">
                        {{ msg.ContactUserName?.charAt(0) }}
                    </el-avatar>
                    <span v-if="msg.UnRead > 0" class="unread-badge">{{ msg.UnRead > 99 ? '99+' : msg.UnRead }}</span>
                </div>
                <div class="message-content">
                    <div class="message-top">
                        <span class="message-name">{{ msg.ContactUserName }}</span>
                        <span class="message-time">{{ formatTime(msg.UpdateTime) }}</span>
                    </div>
                    <div class="message-bottom">
                        <span class="message-preview" :class="{ 'has-unread': msg.UnRead > 0 }">
                            {{ msg.LastMessage ? msg.LastMessage.replace(/<[^>]+>/g, '') : '' }}
                        </span>
                        <el-icon v-if="msg.muted" class="mute-icon"><MuteNotification /></el-icon>
                    </div>
                </div>
            </div>
        </div>

        <!-- 通讯录列表 -->
        <div class="contact-list" v-if="activeTab === 'contacts'">
            <div 
                v-for="contact in filteredContacts" 
                :key="contact.Id"
                class="contact-item"
                @click="startNewChat(contact)"
            >
                <el-avatar :size="44" :src="contact.UserImg">
                    {{ contact.Name?.charAt(0) }}
                </el-avatar>
                <div class="contact-info">
                    <span class="contact-name">{{ contact.Name }}</span>
                    <span class="contact-dept">{{ contact.DepartmentName || '' }}</span>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-if="(activeTab === 'messages' && filteredMessageList.length === 0) || (activeTab === 'contacts' && filteredContacts.length === 0)" class="empty-state">
            <el-icon class="empty-icon"><ChatDotRound /></el-icon>
            <p class="empty-text">{{ activeTab === 'messages' ? '暂无消息' : '暂无联系人' }}</p>
            <el-button v-if="activeTab === 'messages'" type="primary" round @click="showNewChat = true">发起聊天</el-button>
        </div>

        <!-- 新建聊天弹窗 -->
        <el-dialog
            v-model="showNewChat"
            title="选择联系人"
            width="90%"
            class="contact-dialog"
        >
            <div class="contact-search">
                <el-input 
                    v-model="contactKeyword" 
                    placeholder="搜索联系人" 
                    :prefix-icon="Search"
                    clearable
                    @input="searchContacts"
                />
            </div>
            <div class="contact-list">
                <div 
                    v-for="contact in dialogContactList" 
                    :key="contact.Id"
                    class="contact-item"
                    @click="startDialogChat(contact)"
                >
                    <el-avatar :size="44" :src="contact.UserImg">
                        {{ contact.Name?.charAt(0) }}
                    </el-avatar>
                    <div class="contact-info">
                        <span class="contact-name">{{ contact.Name }}</span>
                        <span class="contact-dept">{{ contact.DepartmentName || '' }}</span>
                    </div>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useDiyStore } from '@/pinia';
import { Plus, Search, MuteNotification, ChatDotRound } from '@element-plus/icons-vue';
import { 
    getLastContacts, 
    formatTime as chatFormatTime,
    initWebSocketEvents,
    cleanupWebSocketEvents
} from '@/utils/chat.common';
import { DiyCommon } from '@/utils/diy.common';

// 定义组件名称，用于 keep-alive 缲存
defineOptions({
    name: 'mobile_message'
});

const router = useRouter();
const diyStore = useDiyStore();

// 当前用户
const currentUser = computed(() => diyStore.GetCurrentUser);

// Tab切换
const activeTab = ref('messages');

// 搜索关键词
const searchKeyword = ref('');
const contactKeyword = ref('');
const showNewChat = ref(false);

// 消息列表
const messageList = ref([]);

// 联系人列表
const contactList = ref([]);

// 弹窗联系人列表
const dialogContactList = ref([]);

// 获取WebSocket实例
let websocket = null;
let wsEventsRegistered = false;

// 过滤消息列表
const filteredMessageList = computed(() => {
    if (!searchKeyword.value) return messageList.value;
    return messageList.value.filter(msg => 
        msg.ContactUserName?.includes(searchKeyword.value) || 
        msg.LastMessage?.includes(searchKeyword.value)
    );
});

// 过滤联系人列表
const filteredContacts = computed(() => {
    if (!searchKeyword.value) return contactList.value;
    return contactList.value.filter(contact => 
        contact.Name.includes(searchKeyword.value) ||
        (contact.DepartmentName && contact.DepartmentName.includes(searchKeyword.value))
    );
});

// 搜索联系人
const searchContacts = () => {
    if (!contactKeyword.value) {
        // 如果搜索为空，加载全部联系人
        loadContacts();
        return;
    }
    
    DiyCommon.Post(
        '/api/SysUser/GetSysUserPublicInfo',
        {
            State: 1,
            _PageIndex: 1,
            _PageSize: 15,
            _Keyword: contactKeyword.value
        },
        function(result) {
            if (DiyCommon.Result(result)) {
                dialogContactList.value = result.Data || [];
                console.log('[移动端消息] 搜索联系人成功:', dialogContactList.value.length);
            } else {
                console.error('[移动端消息] 搜索联系人失败:', result.Message);
            }
        },
        function(error) {
            console.error('[移动端消息] 搜索联系人请求失败:', error);
        }
    );
};

// 格式化时间（使用公共模块的formatTime函数）
const formatTime = (time) => {
    return chatFormatTime(time);
};

// 打开聊天
const openChat = (msg) => {
    router.push({
        path: '/mobile/chat',
        query: {
            id: msg.ContactUserId,
            name: msg.ContactUserName
        }
    });
};

// 发起新聊天
const startNewChat = (contact) => {
    router.push({
        path: '/mobile/chat',
        query: {
            id: contact.Id,
            name: contact.Name
        }
    });
};

// 从弹窗发起聊天
const startDialogChat = (contact) => {
    showNewChat.value = false;
    router.push({
        path: '/mobile/chat',
        query: {
            id: contact.Id,
            name: contact.Name
        }
    });
};

// 加载最近联系人
const loadLastContacts = async () => {
    websocket = window.__VUE_APP__?.config?.globalProperties?.$websocket;
    if (!websocket || websocket.state !== 'Connected') {
        console.log('[移动端消息] WebSocket未连接，无法加载联系人');
        return;
    }
    
    try {
        const contacts = await getLastContacts(websocket, currentUser.value.Id, DiyCommon.GetOsClient());
        if (contacts && contacts.length > 0) {
            // 直接使用原始数据，不进行映射
            messageList.value = contacts;
            
            // 确保AI助手在第一位
            const aiIndex = messageList.value.findIndex(m => m.ContactUserId === 'AI');
            if (aiIndex === -1) {
                messageList.value.unshift({
                    ContactUserId: 'AI',
                    ContactUserName: 'AI助手',
                    ContactUserAvatar: '',
                    LastMessage: '我是您的AI助手，有什么可以帮您？',
                    UpdateTime: new Date().toISOString(),
                    UnRead: 0,
                    muted: false
                });
            } else if (aiIndex > 0) {
                const ai = messageList.value.splice(aiIndex, 1)[0];
                messageList.value.unshift(ai);
            }
        }
    } catch (error) {
        console.error('[移动端消息] 加载联系人失败:', error);
    }
};

// 加载通讯录
const loadContacts = () => {
    DiyCommon.Post(
        '/api/SysUser/GetSysUserPublicInfo',
        {
            State: 1,
            _PageIndex: 1,
            _PageSize: 50
        },
        function(result) {
            if (DiyCommon.Result(result)) {
                console.log('[移动端消息] 加载通讯录成功:', result.Data?.length);
                
                // AI助手放第一位
                contactList.value = [
                    {
                        Id: 'AI',
                        Name: 'AI助手',
                        UserImg: '',
                        DepartmentName: '系统'
                    },
                    ...(result.Data || [])
                ];
                dialogContactList.value = result.Data || [];
            } else {
                console.error('[移动端消息] 加载通讯录失败:', result.Message);
            }
        },
        function(error) {
            console.error('[移动端消息] 加载通讯录请求失败:', error);
        }
    );
};

// 注册WebSocket事件（使用公共模块）
const registerWebSocketEvents = () => {
    // 检查设备类型：只有移动端才注册
    if (!diyStore.IsPhoneView) {
        console.log('[移动端消息] 当前为PC端模式，不注册移动端聊天事件');
        return;
    }
    
    websocket = window.__VUE_APP__?.config?.globalProperties?.$websocket;
    if (!websocket) {
        console.log('[移动端消息] WebSocket未初始化');
        return;
    }
    
    // 使用公共模块初始化WebSocket事件
    const success = initWebSocketEvents(websocket, {
        // 接收普通消息
        onReceiveMessage: (message) => {
            console.log('[移动端消息] 收到新消息:', message);
            // 更新消息列表
            const existingMsg = messageList.value.find(m => m.ContactUserId === message.FromUserId);
            if (existingMsg) {
                existingMsg.LastMessage = message.Content;
                existingMsg.UpdateTime = new Date().toISOString();
                existingMsg.UnRead = (existingMsg.UnRead || 0) + 1;
            } else {
                messageList.value.unshift({
                    ContactUserId: message.FromUserId,
                    ContactUserName: message.FromUserName || '未知',
                    ContactUserAvatar: message.FromUserAvatar || '',
                    LastMessage: message.Content,
                    UpdateTime: new Date().toISOString(),
                    UnRead: 1,
                    muted: false
                });
            }
        },
        
        // 接收最近联系人列表
        onReceiveLastContacts: (contacts) => {
            console.log('[移动端消息] 收到最近联系人:', contacts);
            if (contacts && contacts.length > 0) {
                // 直接使用原始数据
                messageList.value = contacts;
                
                // 确保AI助手在第一位
                const aiIndex = messageList.value.findIndex(m => m.ContactUserId === 'AI');
                if (aiIndex === -1) {
                    messageList.value.unshift({
                        ContactUserId: 'AI',
                        ContactUserName: 'AI助手',
                        ContactUserAvatar: '',
                        LastMessage: '我是您的AI助手，有什么可以帮您？',
                        UpdateTime: new Date().toISOString(),
                        UnRead: 0,
                        muted: false
                    });
                } else if (aiIndex > 0) {
                    const ai = messageList.value.splice(aiIndex, 1)[0];
                    messageList.value.unshift(ai);
                }
            }
        }
    }, {
        enableDuplicateCheck: true,
        logPrefix: '[移动端消息]'
    });
    
    if (success) {
        wsEventsRegistered = true;
    }
};

// 注销WebSocket事件（使用公共模块）
const unregisterWebSocketEvents = () => {
    if (wsEventsRegistered) {
        cleanupWebSocketEvents(websocket, '[移动端消息]');
        wsEventsRegistered = false;
    }
};

onMounted(() => {
    console.log('[移动端消息] 组件已挂载');
    registerWebSocketEvents();
    loadLastContacts();
    loadContacts();
});

onBeforeUnmount(() => {
    console.log('[移动端消息] 组件即将卸载');
    unregisterWebSocketEvents();
});
</script>

<style lang="scss" scoped>
.mobile-message {
    min-height: 100vh;
    background: #fff;
    padding-bottom: 70px;
}

.message-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50px;
    background: #fff;
    border-bottom: 1px solid #ebeef5;
    
    .header-title {
        font-size: 17px;
        font-weight: 600;
        color: #303133;
    }
    
    .header-action {
        position: absolute;
        right: 16px;
        font-size: 22px;
        color: #303133;
        cursor: pointer;
        
        &:active {
            opacity: 0.6;
        }
    }
}

.message-tabs {
    :deep(.el-tabs__header) {
        margin: 0;
        padding: 0 16px;
        background: #fff;
        border-bottom: 1px solid #ebeef5;
    }
    
    :deep(.el-tabs__nav-wrap::after) {
        display: none;
    }
    
    :deep(.el-tabs__item) {
        font-size: 15px;
        padding: 0 20px;
        height: 44px;
        line-height: 44px;
    }
}

.search-bar {
    padding: 8px 12px;
    background: #f5f7fa;
    
    .search-input {
        :deep(.el-input__wrapper) {
            border-radius: 8px;
            background: #fff;
        }
    }
}

.message-list {
    .message-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
        
        &:active {
            background: #f5f7fa;
        }
        
        .avatar-wrapper {
            position: relative;
            margin-right: 12px;
            
            .unread-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                min-width: 18px;
                height: 18px;
                padding: 0 5px;
                font-size: 11px;
                font-weight: 500;
                color: #fff;
                background: #f56c6c;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        }
        
        .message-content {
            flex: 1;
            min-width: 0;
            border-bottom: 1px solid #f5f7fa;
            padding-bottom: 12px;
            
            .message-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                
                .message-name {
                    font-size: 16px;
                    font-weight: 500;
                    color: #303133;
                }
                
                .message-time {
                    font-size: 12px;
                    color: #909399;
                }
            }
            
            .message-bottom {
                display: flex;
                align-items: center;
                
                .message-preview {
                    flex: 1;
                    font-size: 14px;
                    color: #909399;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    
                    &.has-unread {
                        color: #606266;
                        font-weight: 500;
                    }
                }
                
                .mute-icon {
                    font-size: 14px;
                    color: #c0c4cc;
                    margin-left: 8px;
                }
            }
        }
        
        &:last-child .message-content {
            border-bottom: none;
        }
    }
}

.contact-list {
    .contact-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
        
        &:active {
            background: #f5f7fa;
        }
        
        .contact-info {
            margin-left: 12px;
            
            .contact-name {
                display: block;
                font-size: 15px;
                font-weight: 500;
                color: #303133;
                margin-bottom: 2px;
            }
            
            .contact-dept {
                font-size: 12px;
                color: #909399;
            }
        }
    }
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    
    .empty-icon {
        font-size: 64px;
        color: #dcdfe6;
        margin-bottom: 16px;
    }
    
    .empty-text {
        font-size: 14px;
        color: #909399;
        margin-bottom: 24px;
    }
}

// 联系人弹窗
:deep(.contact-dialog) {
    .el-dialog__body {
        padding: 0;
        max-height: 60vh;
        overflow-y: auto;
    }
}

.contact-search {
    padding: 12px 16px;
    border-bottom: 1px solid #ebeef5;
}
</style>
