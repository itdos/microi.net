<template>
    <div class="mobile-chat">
        <!-- 顶部标题栏 -->
        <div class="chat-header">
            <el-icon class="back-btn" @click="goBack"><ArrowLeft /></el-icon>
            <span class="chat-title">{{ chatName }}</span>
            <el-icon class="more-btn" @click="showChatMenu = true"><MoreFilled /></el-icon>
        </div>

        <!-- 聊天消息区域 -->
        <div class="chat-messages" ref="messagesContainer" @scroll="handleScroll">
            <div class="messages-inner">
                <!-- 加载更多提示 -->
                <div v-if="loading" class="loading-more">
                    <el-icon class="loading-icon"><Loading /></el-icon>
                    <span>加载中...</span>
                </div>
                
                <!-- 消息列表 -->
                <div 
                    v-for="(msg, index) in messages" 
                    :key="msg.id"
                    class="message-wrapper"
                >
                    <!-- 时间分隔 -->
                    <div v-if="shouldShowTime(msg, index)" class="time-divider">
                        {{ formatMessageTime(msg.time) }}
                    </div>
                    
                    <!-- 消息气泡 -->
                    <div 
                        class="message-bubble"
                        :class="{ 'is-self': msg.isSelf, 'is-other': !msg.isSelf }"
                    >
                        <el-avatar 
                            v-if="!msg.isSelf" 
                            :size="36" 
                            :src="msg.avatar"
                            class="msg-avatar"
                        >
                            {{ msg.senderName?.charAt(0) }}
                        </el-avatar>
                        
                        <div class="bubble-content">
                            <span v-if="!msg.isSelf && chatType === 'group'" class="sender-name">
                                {{ msg.senderName }}
                            </span>
                            
                            <!-- 文本消息 -->
                            <div v-if="msg.type === 'text'" class="bubble-text">
                                {{ msg.content }}
                            </div>
                            
                            <!-- 图片消息 -->
                            <div v-else-if="msg.type === 'image'" class="bubble-image">
                                <el-image 
                                    :src="msg.content" 
                                    fit="cover"
                                    :preview-src-list="[msg.content]"
                                />
                            </div>
                            
                            <!-- 文件消息 -->
                            <div v-else-if="msg.type === 'file'" class="bubble-file" @click="downloadFile(msg)">
                                <el-icon class="file-icon"><Document /></el-icon>
                                <div class="file-info">
                                    <span class="file-name">{{ msg.fileName }}</span>
                                    <span class="file-size">{{ msg.fileSize }}</span>
                                </div>
                            </div>
                            
                            <span class="bubble-time">{{ formatBubbleTime(msg.time) }}</span>
                        </div>
                        
                        <el-avatar 
                            v-if="msg.isSelf" 
                            :size="36" 
                            :src="currentUser.Avatar"
                            class="msg-avatar"
                        >
                            {{ currentUser.NickName?.charAt(0) }}
                        </el-avatar>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部输入区域 -->
        <div class="chat-input-area">
            <div class="input-toolbar">
                <el-icon class="toolbar-btn" @click="showEmoji = !showEmoji"><Microphone /></el-icon>
            </div>
            <div class="input-wrapper">
                <el-input
                    v-model="inputMessage"
                    type="textarea"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    placeholder="输入消息..."
                    @keyup.enter.exact="sendMessage"
                />
            </div>
            <div class="input-actions">
                <el-icon v-if="!inputMessage" class="action-btn" @click="showMorePanel = !showMorePanel">
                    <CirclePlusFilled />
                </el-icon>
                <el-button 
                    v-else 
                    type="primary" 
                    size="small" 
                    round 
                    class="send-btn"
                    @click="sendMessage"
                >
                    发送
                </el-button>
            </div>
        </div>

        <!-- 更多功能面板 -->
        <div v-if="showMorePanel" class="more-panel">
            <div class="panel-item" @click="handleAction('image')">
                <div class="panel-icon">
                    <el-icon><Picture /></el-icon>
                </div>
                <span>图片</span>
            </div>
            <div class="panel-item" @click="handleAction('camera')">
                <div class="panel-icon">
                    <el-icon><Camera /></el-icon>
                </div>
                <span>拍摄</span>
            </div>
            <div class="panel-item" @click="handleAction('file')">
                <div class="panel-icon">
                    <el-icon><Folder /></el-icon>
                </div>
                <span>文件</span>
            </div>
            <div class="panel-item" @click="handleAction('location')">
                <div class="panel-icon">
                    <el-icon><Location /></el-icon>
                </div>
                <span>位置</span>
            </div>
        </div>

        <!-- 聊天设置弹窗 -->
        <el-drawer
            v-model="showChatMenu"
            direction="rtl"
            size="280px"
            title="聊天信息"
        >
            <div class="chat-settings">
                <div class="setting-item">
                    <span>消息免打扰</span>
                    <el-switch v-model="chatMuted" />
                </div>
                <div class="setting-item">
                    <span>置顶聊天</span>
                    <el-switch v-model="chatPinned" />
                </div>
                <div class="setting-item danger" @click="clearHistory">
                    <span>清空聊天记录</span>
                    <el-icon><ArrowRight /></el-icon>
                </div>
            </div>
        </el-drawer>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDiyStore } from '@/pinia';
import { 
    ArrowLeft, MoreFilled, Microphone, CirclePlusFilled, 
    Picture, Camera, Folder, Location, Document, Loading, ArrowRight 
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const route = useRoute();
const diyStore = useDiyStore();

// 聊天信息
const chatId = computed(() => route.query.id);
const chatName = computed(() => route.query.name || '聊天');
const chatType = computed(() => route.query.type || 'private');

// 当前用户
const currentUser = computed(() => diyStore.GetCurrentUser);

// 状态
const inputMessage = ref('');
const showMorePanel = ref(false);
const showEmoji = ref(false);
const showChatMenu = ref(false);
const chatMuted = ref(false);
const chatPinned = ref(false);
const loading = ref(false);
const messagesContainer = ref(null);

// 模拟消息数据
const messages = ref([
    {
        id: '1',
        type: 'text',
        content: '你好，请问有什么可以帮助你的吗？',
        time: new Date(Date.now() - 1000 * 60 * 60),
        isSelf: false,
        senderName: chatName.value,
        avatar: ''
    },
    {
        id: '2',
        type: 'text',
        content: '我想咨询一下关于项目进度的问题',
        time: new Date(Date.now() - 1000 * 60 * 50),
        isSelf: true,
        senderName: '我',
        avatar: ''
    },
    {
        id: '3',
        type: 'text',
        content: '好的，请稍等，我帮你查一下',
        time: new Date(Date.now() - 1000 * 60 * 45),
        isSelf: false,
        senderName: chatName.value,
        avatar: ''
    },
    {
        id: '4',
        type: 'text',
        content: '项目目前进度正常，预计下周可以完成第一阶段',
        time: new Date(Date.now() - 1000 * 60 * 30),
        isSelf: false,
        senderName: chatName.value,
        avatar: ''
    },
    {
        id: '5',
        type: 'text',
        content: '好的，谢谢！',
        time: new Date(Date.now() - 1000 * 60 * 25),
        isSelf: true,
        senderName: '我',
        avatar: ''
    }
]);

// 返回上一页
const goBack = () => {
    router.back();
};

// 判断是否显示时间
const shouldShowTime = (msg, index) => {
    if (index === 0) return true;
    const prevMsg = messages.value[index - 1];
    const diff = new Date(msg.time) - new Date(prevMsg.time);
    return diff > 5 * 60 * 1000; // 5分钟
};

// 格式化消息时间
const formatMessageTime = (time) => {
    const date = new Date(time);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleString('zh-CN', { 
        month: 'numeric', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

// 格式化气泡时间
const formatBubbleTime = (time) => {
    return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

// 发送消息
const sendMessage = () => {
    if (!inputMessage.value.trim()) return;
    
    const newMsg = {
        id: Date.now().toString(),
        type: 'text',
        content: inputMessage.value.trim(),
        time: new Date(),
        isSelf: true,
        senderName: currentUser.value.NickName || '我',
        avatar: currentUser.value.Avatar
    };
    
    messages.value.push(newMsg);
    inputMessage.value = '';
    showMorePanel.value = false;
    
    // 滚动到底部
    nextTick(() => {
        scrollToBottom();
    });
    
    // 模拟回复
    setTimeout(() => {
        const reply = {
            id: (Date.now() + 1).toString(),
            type: 'text',
            content: '收到，我会尽快处理的。',
            time: new Date(),
            isSelf: false,
            senderName: chatName.value,
            avatar: ''
        };
        messages.value.push(reply);
        nextTick(() => {
            scrollToBottom();
        });
    }, 1500);
};

// 滚动到底部
const scrollToBottom = () => {
    if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
};

// 处理滚动
const handleScroll = () => {
    if (messagesContainer.value && messagesContainer.value.scrollTop === 0) {
        // 滚动到顶部，加载更多消息
        loadMoreMessages();
    }
};

// 加载更多消息
const loadMoreMessages = () => {
    if (loading.value) return;
    loading.value = true;
    
    // 模拟加载
    setTimeout(() => {
        loading.value = false;
    }, 1000);
};

// 处理更多操作
const handleAction = (action) => {
    showMorePanel.value = false;
    ElMessage.info(`${action} 功能开发中...`);
};

// 下载文件
const downloadFile = (msg) => {
    ElMessage.info('文件下载功能开发中...');
};

// 清空聊天记录
const clearHistory = () => {
    ElMessageBox.confirm('确定要清空聊天记录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(() => {
        messages.value = [];
        showChatMenu.value = false;
        ElMessage.success('聊天记录已清空');
    }).catch(() => {});
};

// 初始化
onMounted(() => {
    nextTick(() => {
        scrollToBottom();
    });
});
</script>

<style lang="scss" scoped>
.mobile-chat {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #ededed;
}

.chat-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 50px;
    padding: 0 12px;
    background: #fff;
    border-bottom: 1px solid #e5e5e5;
    
    .back-btn, .more-btn {
        font-size: 22px;
        color: #303133;
        cursor: pointer;
        padding: 8px;
        
        &:active {
            opacity: 0.6;
        }
    }
    
    .chat-title {
        font-size: 17px;
        font-weight: 600;
        color: #303133;
    }
}

.chat-messages {
    flex: 1;
    margin-top: 50px;
    padding: 12px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    
    .messages-inner {
        min-height: 100%;
    }
}

.loading-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    color: #909399;
    font-size: 13px;
    
    .loading-icon {
        margin-right: 6px;
        animation: spin 1s linear infinite;
    }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.time-divider {
    text-align: center;
    padding: 8px 0 16px;
    font-size: 12px;
    color: #909399;
}

.message-bubble {
    display: flex;
    align-items: flex-start;
    margin-bottom: 16px;
    
    &.is-self {
        flex-direction: row-reverse;
        
        .bubble-content {
            margin-right: 10px;
            margin-left: 50px;
            
            .bubble-text {
                background: var(--color-primary, #409eff);
                color: #fff;
                
                &::after {
                    right: -6px;
                    left: auto;
                    border-left-color: var(--color-primary, #409eff);
                    border-right-color: transparent;
                }
            }
        }
    }
    
    &.is-other {
        .bubble-content {
            margin-left: 10px;
            margin-right: 50px;
        }
    }
    
    .msg-avatar {
        flex-shrink: 0;
    }
    
    .bubble-content {
        max-width: calc(100% - 100px);
        
        .sender-name {
            display: block;
            font-size: 12px;
            color: #909399;
            margin-bottom: 4px;
        }
        
        .bubble-text {
            position: relative;
            display: inline-block;
            padding: 10px 14px;
            background: #fff;
            border-radius: 8px;
            font-size: 15px;
            line-height: 1.5;
            word-break: break-word;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .bubble-image {
            max-width: 200px;
            border-radius: 8px;
            overflow: hidden;
            
            :deep(.el-image) {
                display: block;
            }
        }
        
        .bubble-file {
            display: flex;
            align-items: center;
            padding: 12px;
            background: #fff;
            border-radius: 8px;
            cursor: pointer;
            
            .file-icon {
                font-size: 36px;
                color: var(--color-primary, #409eff);
                margin-right: 10px;
            }
            
            .file-info {
                .file-name {
                    display: block;
                    font-size: 14px;
                    color: #303133;
                    margin-bottom: 2px;
                }
                
                .file-size {
                    font-size: 12px;
                    color: #909399;
                }
            }
        }
        
        .bubble-time {
            display: block;
            font-size: 11px;
            color: #c0c4cc;
            margin-top: 4px;
            text-align: right;
        }
    }
}

.chat-input-area {
    display: flex;
    align-items: flex-end;
    padding: 8px 12px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
    background: #f5f5f5;
    border-top: 1px solid #e5e5e5;
    
    .input-toolbar {
        .toolbar-btn {
            font-size: 26px;
            color: #606266;
            cursor: pointer;
            padding: 6px;
            
            &:active {
                opacity: 0.6;
            }
        }
    }
    
    .input-wrapper {
        flex: 1;
        margin: 0 8px;
        
        :deep(.el-textarea__inner) {
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 15px;
            resize: none;
        }
    }
    
    .input-actions {
        .action-btn {
            font-size: 28px;
            color: #606266;
            cursor: pointer;
            
            &:active {
                opacity: 0.6;
            }
        }
        
        .send-btn {
            padding: 8px 16px;
        }
    }
}

.more-panel {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    padding: 20px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    background: #f5f5f5;
    
    .panel-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        
        &:active {
            opacity: 0.6;
        }
        
        .panel-icon {
            width: 56px;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            border-radius: 12px;
            margin-bottom: 8px;
            
            .el-icon {
                font-size: 28px;
                color: #606266;
            }
        }
        
        span {
            font-size: 12px;
            color: #606266;
        }
    }
}

.chat-settings {
    .setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border-bottom: 1px solid #f5f7fa;
        
        span {
            font-size: 15px;
            color: #303133;
        }
        
        &.danger span {
            color: #f56c6c;
        }
    }
}
</style>
