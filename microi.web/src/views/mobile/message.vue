<template>
    <div class="mobile-message">
        <!-- 顶部导航栏（渐变背景） -->
        <div class="msg-header">
            <div class="header-inner">
                <span class="header-title">消息</span>
                <div class="header-action" @click="showNewChat = true">
                    <span class="action-icon">✚</span>
                </div>
            </div>
            <!-- Tab 切换 -->
            <div class="msg-tabs">
                <div class="msg-tab" :class="{ active: activeTab === 'messages' }" @click="activeTab = 'messages'">
                    <span>消息</span>
                    <div class="tab-line" v-if="activeTab === 'messages'"></div>
                </div>
                <div class="msg-tab" :class="{ active: activeTab === 'contacts' }" @click="switchToContacts">
                    <span>通讯录</span>
                    <div class="tab-line" v-if="activeTab === 'contacts'"></div>
                </div>
            </div>
        </div>

        <!-- 搜索栏 -->
        <div class="search-section">
            <div class="search-wrap">
                <span class="search-icon">🔍</span>
                <input 
                    class="search-input"
                    :placeholder="activeTab === 'messages' ? '搜索消息' : '搜索联系人'" 
                    v-model="searchKeyword"
                />
                <span v-if="searchKeyword" class="search-clear" @click="searchKeyword = ''">✕</span>
            </div>
        </div>

        <!-- 消息列表 -->
        <div class="msg-scroll" v-if="activeTab === 'messages'">
            <!-- 骨架屏 -->
            <div v-if="loading && filteredMessageList.length === 0" class="skeleton-list">
                <div class="sk-item" v-for="i in 5" :key="i">
                    <div class="sk-avatar"></div>
                    <div class="sk-content">
                        <div class="sk-line sk-name"></div>
                        <div class="sk-line sk-msg"></div>
                    </div>
                </div>
            </div>

            <!-- 消息条目 -->
            <div 
                v-for="msg in filteredMessageList" 
                :key="msg.ContactUserId"
                class="msg-item"
                @click="openChat(msg)"
            >
                <div class="msg-avatar-wrap">
                    <div class="msg-avatar">
                        <el-avatar :size="48" :src="DiyCommon.GetServerPath(msg.ContactUserAvatar)">
                            {{ (msg.ContactUserName || '?').charAt(0) }}
                        </el-avatar>
                    </div>
                    <span v-if="msg.UnRead > 0" class="unread-badge">{{ msg.UnRead > 99 ? '99+' : msg.UnRead }}</span>
                </div>
                <div class="msg-body">
                    <div class="msg-top">
                        <span class="msg-name">{{ msg.ContactUserName }}</span>
                        <span class="msg-time">{{ formatTime(msg.UpdateTime) }}</span>
                    </div>
                    <div class="msg-bottom">
                        <span class="msg-preview" :class="{ 'has-unread': msg.UnRead > 0 }">
                            {{ msg.LastMessage ? msg.LastMessage.replace(/<[^>]+>/g, '') : '' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- 空状态 -->
            <div v-if="!loading && filteredMessageList.length === 0" class="empty-state">
                <span class="empty-icon">💬</span>
                <span class="empty-text">暂无消息</span>
                <div class="empty-btn" @click="showNewChat = true">
                    <span>发起聊天</span>
                </div>
            </div>
        </div>

        <!-- 通讯录列表 -->
        <div class="msg-scroll" v-if="activeTab === 'contacts'">
            <!-- 骨架屏 -->
            <div v-if="contactLoading && filteredContacts.length === 0" class="skeleton-list">
                <div class="sk-item" v-for="i in 8" :key="i">
                    <div class="sk-avatar sk-avatar-sm"></div>
                    <div class="sk-content">
                        <div class="sk-line sk-name"></div>
                        <div class="sk-line sk-dept"></div>
                    </div>
                </div>
            </div>

            <div 
                v-for="contact in filteredContacts" 
                :key="contact.Id"
                class="contact-item"
                @click="startNewChat(contact)"
            >
                <div class="contact-avatar">
                    <el-avatar :size="40" :src="contact.UserImg">
                        {{ (contact.Name || '?').charAt(0) }}
                    </el-avatar>
                </div>
                <div class="contact-info">
                    <span class="contact-name">{{ contact.Name }}</span>
                    <span class="contact-dept" v-if="contact.DepartmentName">{{ contact.DepartmentName }}</span>
                </div>
            </div>

            <!-- 空状态 -->
            <div v-if="!contactLoading && filteredContacts.length === 0" class="empty-state">
                <span class="empty-icon">📇</span>
                <span class="empty-text">暂无联系人</span>
            </div>
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
            <div class="dialog-contact-list">
                <div 
                    v-for="contact in dialogContactList" 
                    :key="contact.Id"
                    class="dialog-contact-item"
                    @click="startDialogChat(contact)"
                >
                    <div class="dialog-contact-avatar">
                        <el-avatar :size="36" :src="contact.UserImg">
                            {{ (contact.Name || '?').charAt(0) }}
                        </el-avatar>
                    </div>
                    <div class="dialog-contact-info">
                        <span class="dialog-contact-name">{{ contact.Name }}</span>
                        <span class="dialog-contact-dept" v-if="contact.DepartmentName">{{ contact.DepartmentName }}</span>
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
import { Search } from '@element-plus/icons-vue';
import { 
    getLastContacts, 
    formatTime as chatFormatTime,
    initWebSocketEvents,
    cleanupWebSocketEvents
} from '@/utils/chat.common';
import { DiyCommon } from '@/utils/diy.common';

// 定义组件名称，用于 keep-alive 缓存
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

// 加载状态
const loading = ref(true);
const contactLoading = ref(false);

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

// 切换到通讯录 Tab
const switchToContacts = () => {
    activeTab.value = 'contacts';
    if (contactList.value.length === 0) {
        contactLoading.value = true;
        loadContacts();
    }
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
        loading.value = false;
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
    } finally {
        loading.value = false;
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
            contactLoading.value = false;
        },
        function(error) {
            console.error('[移动端消息] 加载通讯录请求失败:', error);
            contactLoading.value = false;
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
            loading.value = false;
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
    background: #f5f7fa;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 56px;
}

/* 顶部导航（渐变背景） */
.msg-header {
    background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #6ba3ff));
    padding-top: var(--status-bar-height, 0px);
    flex-shrink: 0;
}

.header-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    position: relative;
}

.header-title {
    font-size: 17px;
    font-weight: 600;
    color: #fff;
}

.header-action {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;

    &:active {
        opacity: 0.7;
    }
}

.action-icon {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.9);
}

/* Tab 切换 */
.msg-tabs {
    display: flex;
    padding: 0 48px;
}

.msg-tab {
    flex: 1;
    text-align: center;
    padding: 8px 0 10px;
    position: relative;
    cursor: pointer;

    span {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.65);
    }

    &.active span {
        color: #fff;
        font-weight: 600;
    }
}

.tab-line {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 3px;
    border-radius: 1.5px;
    background: #fff;
}

/* 搜索栏 */
.search-section {
    background: #f5f7fa;
    padding: 8px 12px;
    flex-shrink: 0;
}

.search-wrap {
    display: flex;
    align-items: center;
    background: #fff;
    border-radius: 18px;
    padding: 0 12px;
    height: 34px;
}

.search-icon {
    font-size: 12px;
    margin-right: 6px;
}

.search-input {
    flex: 1;
    font-size: 13px;
    color: #333;
    height: 34px;
    border: none;
    outline: none;
    background: transparent;

    &::placeholder {
        color: #bbb;
        font-size: 13px;
    }
}

.search-clear {
    font-size: 12px;
    color: #999;
    padding: 4px;
    cursor: pointer;
}

/* 滚动区 */
.msg-scroll {
    flex: 1;
    overflow-y: auto;
}

/* 消息条目 */
.msg-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #f5f5f5;
    cursor: pointer;
    transition: background 0.2s;

    &:active {
        background: #f9f9f9;
    }
}

.msg-avatar-wrap {
    position: relative;
    margin-right: 12px;
    flex-shrink: 0;
}

.msg-avatar {
    :deep(.el-avatar) {
        background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #6ba3ff));
        font-size: 18px;
        font-weight: 600;
    }
}

.unread-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: #ff4d4f;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    font-size: 10px;
    color: #fff;
    font-weight: 500;
}

.msg-body {
    flex: 1;
    min-width: 0;
}

.msg-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.msg-name {
    font-size: 15px;
    font-weight: 500;
    color: #333;
}

.msg-time {
    font-size: 11px;
    color: #bbb;
    flex-shrink: 0;
}

.msg-bottom {
    display: flex;
    align-items: center;
}

.msg-preview {
    font-size: 13px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;

    &.has-unread {
        color: #606266;
        font-weight: 500;
    }
}

/* 通讯录 */
.contact-item {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: #fff;
    border-bottom: 1px solid #f5f5f5;
    cursor: pointer;
    transition: background 0.2s;

    &:active {
        background: #f9f9f9;
    }
}

.contact-avatar {
    margin-right: 10px;
    flex-shrink: 0;

    :deep(.el-avatar) {
        background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #6ba3ff));
        font-size: 16px;
        font-weight: 600;
    }
}

.contact-info {
    flex: 1;
    min-width: 0;
}

.contact-name {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    display: block;
}

.contact-dept {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
    display: block;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80px 0;

    .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
    }

    .empty-text {
        font-size: 14px;
        color: #999;
        margin-bottom: 16px;
    }
}

.empty-btn {
    background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #6ba3ff));
    padding: 8px 24px;
    border-radius: 20px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(var(--color-primary-rgb, 64,158,255), 0.3);

    &:active {
        transform: scale(0.97);
    }

    span {
        color: #fff;
        font-size: 14px;
    }
}

/* 骨架屏 */
.skeleton-list {
    padding: 0;
}

.sk-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #f5f5f5;
}

.sk-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 400% 100%;
    animation: shimmer 1.5s infinite;
    margin-right: 12px;
    flex-shrink: 0;

    &.sk-avatar-sm {
        width: 40px;
        height: 40px;
    }
}

.sk-content {
    flex: 1;
}

.sk-line {
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 400% 100%;
    animation: shimmer 1.5s infinite;
    margin-bottom: 8px;
}

.sk-name { width: 40%; }
.sk-msg { width: 70%; }
.sk-dept { width: 50%; height: 10px; }

/* 新建聊天弹窗 */
:deep(.contact-dialog) {
    .el-dialog__header {
        padding: 14px 16px;
        border-bottom: 1px solid #f0f0f0;
        margin-right: 0;

        .el-dialog__title {
            font-size: 16px;
            font-weight: 600;
        }
    }

    .el-dialog__body {
        padding: 0;
        max-height: 60vh;
        overflow-y: auto;
    }
}

.contact-search {
    padding: 10px 14px;
    border-bottom: 1px solid #f5f5f5;
}

.dialog-contact-list {
    max-height: 50vh;
    overflow-y: auto;
}

.dialog-contact-item {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid #f8f8f8;
    cursor: pointer;

    &:active {
        background: #f9f9f9;
    }
}

.dialog-contact-avatar {
    margin-right: 10px;

    :deep(.el-avatar) {
        background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #6ba3ff));
        font-size: 14px;
        font-weight: 600;
    }
}

.dialog-contact-info {
    flex: 1;
}

.dialog-contact-name {
    font-size: 14px;
    color: #333;
    display: block;
}

.dialog-contact-dept {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
    display: block;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
</style>
