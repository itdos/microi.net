<template>
    <div class="mobile-message">
        <!-- 顶部标题栏 -->
        <div class="message-header">
            <span class="header-title">消息</span>
            <el-icon class="header-action" @click="showNewChat = true"><Plus /></el-icon>
        </div>

        <!-- 搜索栏 -->
        <div class="search-bar">
            <el-input 
                v-model="searchKeyword" 
                placeholder="搜索" 
                :prefix-icon="Search"
                clearable
                class="search-input"
            />
        </div>

        <!-- 消息列表 -->
        <div class="message-list" v-if="filteredMessageList.length > 0">
            <div 
                v-for="msg in filteredMessageList" 
                :key="msg.id"
                class="message-item"
                @click="openChat(msg)"
            >
                <div class="avatar-wrapper">
                    <el-avatar :size="50" :src="msg.avatar">
                        {{ msg.name?.charAt(0) }}
                    </el-avatar>
                    <span v-if="msg.unread > 0" class="unread-badge">{{ msg.unread > 99 ? '99+' : msg.unread }}</span>
                </div>
                <div class="message-content">
                    <div class="message-top">
                        <span class="message-name">{{ msg.name }}</span>
                        <span class="message-time">{{ formatTime(msg.time) }}</span>
                    </div>
                    <div class="message-bottom">
                        <span class="message-preview" :class="{ 'has-unread': msg.unread > 0 }">
                            {{ msg.lastMessage }}
                        </span>
                        <el-icon v-if="msg.muted" class="mute-icon"><MuteNotification /></el-icon>
                    </div>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
            <el-icon class="empty-icon"><ChatDotRound /></el-icon>
            <p class="empty-text">暂无消息</p>
            <el-button type="primary" round @click="showNewChat = true">发起聊天</el-button>
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
                />
            </div>
            <div class="contact-list">
                <div 
                    v-for="contact in filteredContacts" 
                    :key="contact.id"
                    class="contact-item"
                    @click="startNewChat(contact)"
                >
                    <el-avatar :size="44" :src="contact.avatar">
                        {{ contact.name?.charAt(0) }}
                    </el-avatar>
                    <div class="contact-info">
                        <span class="contact-name">{{ contact.name }}</span>
                        <span class="contact-dept">{{ contact.department }}</span>
                    </div>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDiyStore } from '@/pinia';
import { Plus, Search, MuteNotification, ChatDotRound } from '@element-plus/icons-vue';

const router = useRouter();
const diyStore = useDiyStore();

// 搜索关键词
const searchKeyword = ref('');
const contactKeyword = ref('');
const showNewChat = ref(false);

// 模拟消息列表数据
const messageList = ref([
    {
        id: '1',
        name: '系统通知',
        avatar: '',
        lastMessage: '您有一条新的审批待处理',
        time: new Date(),
        unread: 3,
        muted: false,
        type: 'system'
    },
    {
        id: '2',
        name: '张三',
        avatar: '',
        lastMessage: '好的，收到',
        time: new Date(Date.now() - 1000 * 60 * 30),
        unread: 0,
        muted: false,
        type: 'private'
    },
    {
        id: '3',
        name: '项目讨论组',
        avatar: '',
        lastMessage: '[李四]: 明天的会议改到下午3点',
        time: new Date(Date.now() - 1000 * 60 * 60 * 2),
        unread: 12,
        muted: true,
        type: 'group'
    },
    {
        id: '4',
        name: '王五',
        avatar: '',
        lastMessage: '请问文档准备好了吗？',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24),
        unread: 1,
        muted: false,
        type: 'private'
    },
    {
        id: '5',
        name: '技术交流群',
        avatar: '',
        lastMessage: '[赵六]: 新版本已发布',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        unread: 0,
        muted: false,
        type: 'group'
    }
]);

// 模拟联系人列表
const contactList = ref([
    { id: 'u1', name: '张三', avatar: '', department: '研发部' },
    { id: 'u2', name: '李四', avatar: '', department: '产品部' },
    { id: 'u3', name: '王五', avatar: '', department: '运营部' },
    { id: 'u4', name: '赵六', avatar: '', department: '市场部' },
    { id: 'u5', name: '钱七', avatar: '', department: '人事部' },
    { id: 'u6', name: '孙八', avatar: '', department: '财务部' },
]);

// 过滤消息列表
const filteredMessageList = computed(() => {
    if (!searchKeyword.value) return messageList.value;
    return messageList.value.filter(msg => 
        msg.name.includes(searchKeyword.value) || 
        msg.lastMessage.includes(searchKeyword.value)
    );
});

// 过滤联系人列表
const filteredContacts = computed(() => {
    if (!contactKeyword.value) return contactList.value;
    return contactList.value.filter(contact => 
        contact.name.includes(contactKeyword.value) ||
        contact.department.includes(contactKeyword.value)
    );
});

// 格式化时间
const formatTime = (time) => {
    const now = new Date();
    const msgTime = new Date(time);
    const diff = now - msgTime;
    
    // 今天
    if (diff < 24 * 60 * 60 * 1000 && now.getDate() === msgTime.getDate()) {
        return msgTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (msgTime.getDate() === yesterday.getDate()) {
        return '昨天';
    }
    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return days[msgTime.getDay()];
    }
    // 更早
    return msgTime.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

// 打开聊天
const openChat = (msg) => {
    router.push({
        path: '/mobile/chat',
        query: {
            id: msg.id,
            name: msg.name,
            type: msg.type
        }
    });
};

// 发起新聊天
const startNewChat = (contact) => {
    showNewChat.value = false;
    router.push({
        path: '/mobile/chat',
        query: {
            id: contact.id,
            name: contact.name,
            type: 'private'
        }
    });
};
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
</style>
