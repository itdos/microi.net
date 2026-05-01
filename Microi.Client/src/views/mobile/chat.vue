?<template>
    <div class="mci-mobile-page page-chat">
        <!-- 顶部 -->
        <header class="chat-header">
            <div class="chat-header__safe-top"></div>
            <div class="chat-header__row">
                <span class="chat-header__btn" @click="goBack">
                    <el-icon><ArrowLeft /></el-icon>
                </span>
                <div class="chat-header__title">
                    <span class="title-name">{{ chatName }}</span>
                    <span class="title-status" v-if="!wsConnected">连接中...</span>
                </div>
                <span class="chat-header__btn" @click="showChatMenu = true">
                    <el-icon><MoreFilled /></el-icon>
                </span>
            </div>
        </header>

        <!-- 消息区 -->
        <div class="chat-messages" ref="messagesContainer" @scroll="handleScroll">
            <div v-if="!wsConnected" class="connection-status">
                <el-icon class="rot"><Loading /></el-icon>
                <span>正在重新连接...</span>
            </div>

            <div class="messages-inner">
                <div v-if="loading" class="loading-more">
                    <el-icon class="rot"><Loading /></el-icon>
                    <span>加载中...</span>
                </div>

                <div
                    v-for="(msg, index) in messages"
                    :key="msg.id"
                    class="message-wrapper"
                >
                    <div v-if="shouldShowTime(msg, index)" class="time-divider">
                        <span>{{ formatMessageTime(msg.SendTime) }}</span>
                    </div>

                    <div
                        class="message-row"
                        :class="{ 'is-self': msg.isSelf, 'is-other': !msg.isSelf }"
                    >
                        <el-avatar
                            v-if="!msg.isSelf"
                            :size="36"
                            :src="msg.avatar"
                            class="msg-avatar mci-avatar"
                        >
                            {{ msg.senderName?.charAt(0) }}
                        </el-avatar>

                        <div class="bubble-wrap">
                            <span v-if="!msg.isSelf && chatType === 'group'" class="sender-name">
                                {{ msg.senderName }}
                            </span>

                            <div v-if="msg.Type === 'data'" class="bubble bubble-data">
                                <div v-safe-html="renderDataTable(msg.Content)"></div>
                            </div>

                            <div
                                v-else
                                class="bubble"
                                :class="{ 'streaming-message': msg.isStreaming }"
                            >
                                <span v-if="msg.isThinking" class="thinking-indicator">
                                    <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
                                    正在思考
                                </span>
                                <span v-safe-html="formatMessageContent(msg.Content || msg.content)"></span>
                                <span v-if="msg.isStreaming && !msg.isThinking" class="typing-cursor">▋</span>
                            </div>

                            <span class="bubble-time">{{ formatBubbleTime(msg.SendTime || msg.time) }}</span>
                        </div>

                        <el-avatar
                            v-if="msg.isSelf"
                            :size="36"
                            :src="currentUser.Avatar"
                            class="msg-avatar mci-avatar"
                        >
                            {{ currentUser.NickName?.charAt(0) }}
                        </el-avatar>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部输入区 -->
        <div class="chat-input-area">
            <div v-if="isAIChat" class="ai-model-bar">
                <span class="ai-model-label">AI模型</span>
                <el-select
                    v-model="selectedAiModel"
                    value-key="Id"
                    size="small"
                    placeholder="选择AI模型"
                    :loading="aiModelLoading"
                    style="flex: 1;"
                >
                    <el-option
                        v-for="model in aiModelList"
                        :key="model.Id"
                        :label="`${model.Name}（${model.AiModel}）`"
                        :value="model"
                    />
                </el-select>
            </div>

            <div class="input-row">
                <span class="input-tool" @click="showEmoji = !showEmoji">
                    <el-icon><Microphone /></el-icon>
                </span>
                <div class="input-wrapper">
                    <el-input
                        v-model="inputMessage"
                        type="textarea"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        placeholder="输入消息..."
                        @keydown="handleInputKeydown"
                        @compositionstart="isComposing = true"
                        @compositionend="isComposing = false"
                    />
                </div>
                <span v-if="!inputMessage" class="input-tool" @click="showMorePanel = !showMorePanel">
                    <el-icon><CirclePlusFilled /></el-icon>
                </span>
                <button v-else class="mci-btn mci-btn--primary send-btn" @click="sendMessage">
                    发送
                </button>
            </div>

            <div v-if="showMorePanel" class="more-panel">
                <div class="panel-item" @click="handleAction('image')">
                    <div class="panel-item__icon"><el-icon><Picture /></el-icon></div>
                    <span>图片</span>
                </div>
                <div class="panel-item" @click="handleAction('camera')">
                    <div class="panel-item__icon"><el-icon><Camera /></el-icon></div>
                    <span>拍摄</span>
                </div>
                <div class="panel-item" @click="handleAction('file')">
                    <div class="panel-item__icon"><el-icon><Folder /></el-icon></div>
                    <span>文件</span>
                </div>
                <div class="panel-item" @click="handleAction('location')">
                    <div class="panel-item__icon"><el-icon><Location /></el-icon></div>
                    <span>位置</span>
                </div>
            </div>

            <div class="safe-bottom"></div>
        </div>

        <!-- 聊天设置 -->
        <el-drawer v-model="showChatMenu" direction="rtl" size="280px" title="聊天信息" class="mci-drawer">
            <div class="chat-settings">
                <div class="mci-cell">
                    <span class="mci-cell__title">消息免打扰</span>
                    <el-switch v-model="chatMuted" />
                </div>
                <div class="mci-cell">
                    <span class="mci-cell__title">置顶聊天</span>
                    <el-switch v-model="chatPinned" />
                </div>
                <div class="mci-cell danger" @click="clearHistory">
                    <span class="mci-cell__title" style="color: var(--mci-color-danger);">清空聊天记录</span>
                    <el-icon><ArrowRight /></el-icon>
                </div>
            </div>
        </el-drawer>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDiyStore } from '@/pinia';
import {
    ArrowLeft, MoreFilled, Microphone, CirclePlusFilled,
    Picture, Camera, Folder, Location, Loading, ArrowRight
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
    formatMessageContent, renderDataTable, getChatRecord, sendMessageToUser,
    isDuplicateMessage, clearMessageDuplicateCache, loadAiModelList,
    buildAiOtherInfo
} from '@/utils/chat.common';
import { DiyCommon } from '@/utils/diy.common';

defineOptions({ name: 'mobile_chat' });

const router = useRouter();
const route = useRoute();
const diyStore = useDiyStore();

const chatId = computed(() => route.query.id);
const chatName = computed(() => route.query.name || '聊天');
const chatType = computed(() => route.query.type || 'private');
const currentUser = computed(() => diyStore.GetCurrentUser);

const inputMessage = ref('');
const showMorePanel = ref(false);
const showEmoji = ref(false);
const showChatMenu = ref(false);
const chatMuted = ref(false);
const chatPinned = ref(false);
const loading = ref(false);
const messagesContainer = ref(null);
const isComposing = ref(false);
const wsConnected = ref(false);

const messages = ref([]);
const currentStreamMessage = ref(null);

const aiModelList = ref([]);
const selectedAiModel = ref(null);
const aiModelLoading = ref(false);
const isAIChat = computed(() => chatId.value === 'AI');

let _onReceiveSendToUser = null;
let _onReceiveAIChunk = null;
let _onReceiveSendChatRecordToUser = null;
let _onReceiveSendLastContacts = null;
let _wsCheckTimer = null;

const getWebSocket = () => window.__VUE_APP__?.config?.globalProperties?.$websocket;

const goBack = () => router.back();

const handleInputKeydown = (e) => {
    if (e.key === 'Enter') {
        if (isComposing.value) return;
        if (e.shiftKey) return;
        e.preventDefault();
        sendMessage();
    }
};

const shouldShowTime = (msg, index) => {
    if (index === 0) return true;
    const prevMsg = messages.value[index - 1];
    const msgTime = msg.SendTime || msg.time || msg.CreateTime;
    const prevTime = prevMsg.SendTime || prevMsg.time || prevMsg.CreateTime;
    if (!msgTime || !prevTime) return false;
    const diff = new Date(msgTime) - new Date(prevTime);
    return diff > 5 * 60 * 1000;
};

const formatMessageTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatBubbleTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const sendMessage = async () => {
    if (!inputMessage.value.trim()) return;
    const ws = getWebSocket();
    if (!ws || ws.state !== 'Connected') {
        ElMessage.error('连接已断开，请稍后重试');
        return;
    }
    const content = inputMessage.value.trim();
    const newMsg = {
        id: Date.now().toString(),
        Type: 'text', Content: content,
        SendTime: new Date().toISOString(),
        FromUserId: currentUser.value.Id, ToUserId: chatId.value,
        isSelf: true,
        senderName: currentUser.value.NickName || currentUser.value.Name || '我',
        avatar: currentUser.value.Avatar
    };
    messages.value.push(newMsg);
    inputMessage.value = '';
    showMorePanel.value = false;
    nextTick(() => scrollToBottom());

    try {
        await sendMessageToUser(ws, {
            Content: content,
            OsClient: DiyCommon.GetOsClient(),
            ToUserId: chatId.value, ToUserName: chatName.value, ToUserAvatar: '',
            FromUserId: currentUser.value.Id,
            FromUserName: currentUser.value.NickName || currentUser.value.Name,
            FromUserAvatar: currentUser.value.Avatar || '',
            OtherInfo: buildAiOtherInfo(chatId.value, selectedAiModel.value)
        });
    } catch (error) {
        console.error('[移动端聊天] 发送失败', error);
        ElMessage.error('发送失败');
    }
};

const scrollToBottom = () => {
    if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
};

const handleScroll = () => {
    if (messagesContainer.value && messagesContainer.value.scrollTop === 0) {
        loadMoreMessages();
    }
};

const loadMoreMessages = () => { /* reserved */ };

const loadChatRecord = async () => {
    const ws = getWebSocket();
    if (!ws || ws.state !== 'Connected') {
        let retryCount = 0;
        const waitForWs = () => {
            retryCount++;
            const wsRetry = getWebSocket();
            if (wsRetry && wsRetry.state === 'Connected') {
                wsConnected.value = true;
                doLoadChatRecord();
            } else if (retryCount >= 20) {
                wsConnected.value = false;
            } else {
                setTimeout(waitForWs, 500);
            }
        };
        setTimeout(waitForWs, 500);
        return;
    }
    wsConnected.value = true;
    doLoadChatRecord();
};

const doLoadChatRecord = async () => {
    try {
        const ws = getWebSocket();
        if (!ws || ws.state !== 'Connected') return;
        await getChatRecord(ws, currentUser.value.Id, chatId.value, DiyCommon.GetOsClient());
    } catch (error) {
        console.error('[移动端聊天] 加载聊天记录失败:', error);
    }
};

const handleReceiveSendToUser = (message) => {
    if (!message) return;
    if (message.FromUserId !== chatId.value && message.ToUserId !== chatId.value) return;
    if (message.FromUserId === currentUser.value.Id) return;
    if (isDuplicateMessage(message)) return;

    const newMsg = {
        id: message.Id || Date.now().toString(),
        Type: message.Type || 'text',
        Content: message.Content,
        SendTime: message.CreateTime || message.SendTime || new Date().toISOString(),
        FromUserId: message.FromUserId, ToUserId: message.ToUserId,
        isSelf: false,
        senderName: message.FromUserName || chatName.value,
        avatar: message.FromUserAvatar || '',
        isStreaming: false
    };
    messages.value.push(newMsg);
    nextTick(() => scrollToBottom());
};

const handleReceiveAIChunk = (chunk, fromUserId, toUserId, isComplete) => {
    if (toUserId !== currentUser.value.Id || fromUserId !== chatId.value) return;
    const complete = isComplete === true || isComplete === 'true';

    if (chunk === '[THINKING]') {
        if (!currentStreamMessage.value) {
            currentStreamMessage.value = {
                id: 'ai-stream-' + Date.now(),
                Type: 'text', Content: '',
                SendTime: new Date().toISOString(),
                FromUserId: fromUserId, ToUserId: toUserId,
                isSelf: false, senderName: chatName.value, avatar: '',
                isStreaming: true, isThinking: true
            };
            messages.value.push(currentStreamMessage.value);
            nextTick(() => scrollToBottom());
        }
        return;
    }

    if (!currentStreamMessage.value) {
        currentStreamMessage.value = {
            id: 'ai-stream-' + Date.now(),
            Type: 'text', Content: chunk || '',
            SendTime: new Date().toISOString(),
            FromUserId: fromUserId, ToUserId: toUserId,
            isSelf: false, senderName: chatName.value, avatar: '',
            isStreaming: true, isThinking: false
        };
        messages.value.push(currentStreamMessage.value);
    } else {
        if (currentStreamMessage.value.isThinking) currentStreamMessage.value.isThinking = false;
        currentStreamMessage.value.Content += chunk || '';
    }

    if (complete) {
        if (currentStreamMessage.value) currentStreamMessage.value.isStreaming = false;
        currentStreamMessage.value = null;
    }
    nextTick(() => scrollToBottom());
};

const handleReceiveSendChatRecordToUser = (records) => {
    if (records && Array.isArray(records) && records.length > 0) {
        messages.value = records.map(r => ({
            id: r.Id || (Date.now().toString() + Math.random()),
            Type: r.Type || 'text',
            Content: r.Content,
            SendTime: r.CreateTime || r.SendTime,
            FromUserId: r.FromUserId, ToUserId: r.ToUserId,
            isSelf: r.FromUserId === currentUser.value.Id,
            senderName: r.FromUserId === currentUser.value.Id ? '我' : (r.FromUserName || chatName.value),
            avatar: r.FromUserAvatar || '',
            isStreaming: false
        }));
        nextTick(() => scrollToBottom());
    } else if (records && Array.isArray(records) && records.length === 0) {
        messages.value = [];
    }
};

const handleReceiveSendLastContacts = (contactList) => { /* sync only */ };

const registerWebSocketEvents = () => {
    const ws = getWebSocket();
    if (!ws) return;
    unregisterWebSocketEvents();

    _onReceiveSendToUser = handleReceiveSendToUser;
    _onReceiveAIChunk = handleReceiveAIChunk;
    _onReceiveSendChatRecordToUser = handleReceiveSendChatRecordToUser;
    _onReceiveSendLastContacts = handleReceiveSendLastContacts;

    ws.on('ReceiveSendToUser', _onReceiveSendToUser);
    ws.on('ReceiveAIChunk', _onReceiveAIChunk);
    ws.on('ReceiveSendChatRecordToUser', _onReceiveSendChatRecordToUser);
    ws.on('ReceiveSendLastContacts', _onReceiveSendLastContacts);

    wsConnected.value = ws.state === 'Connected';
};

const unregisterWebSocketEvents = () => {
    const ws = getWebSocket();
    if (ws) {
        if (_onReceiveSendToUser) ws.off('ReceiveSendToUser', _onReceiveSendToUser);
        if (_onReceiveAIChunk) ws.off('ReceiveAIChunk', _onReceiveAIChunk);
        if (_onReceiveSendChatRecordToUser) ws.off('ReceiveSendChatRecordToUser', _onReceiveSendChatRecordToUser);
        if (_onReceiveSendLastContacts) ws.off('ReceiveSendLastContacts', _onReceiveSendLastContacts);
    }
    _onReceiveSendToUser = null;
    _onReceiveAIChunk = null;
    _onReceiveSendChatRecordToUser = null;
    _onReceiveSendLastContacts = null;
};

const setupReconnectHandler = () => {
    _wsCheckTimer = setInterval(() => {
        const ws = getWebSocket();
        const connected = ws && ws.state === 'Connected';
        if (connected && !wsConnected.value) {
            wsConnected.value = true;
            registerWebSocketEvents();
            doLoadChatRecord();
        } else if (!connected && wsConnected.value) {
            wsConnected.value = false;
        }
    }, 3000);
};

const handleAction = (action) => {
    showMorePanel.value = false;
    ElMessage.info(`${action} 功能开发中...`);
};

const clearHistory = () => {
    ElMessageBox.confirm('确定要清空聊天记录吗？', '提示', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    }).then(() => {
        messages.value = [];
        showChatMenu.value = false;
        ElMessage.success('聊天记录已清空');
    }).catch(() => {});
};

onMounted(() => {
    registerWebSocketEvents();
    setupReconnectHandler();
    loadChatRecord();
    if (isAIChat.value) {
        aiModelLoading.value = true;
        loadAiModelList(DiyCommon, (models) => {
            aiModelLoading.value = false;
            aiModelList.value = models;
            if (models.length > 0 && !selectedAiModel.value) {
                selectedAiModel.value = models[0];
            }
        });
    }
});

onBeforeUnmount(() => {
    unregisterWebSocketEvents();
    currentStreamMessage.value = null;
    clearMessageDuplicateCache();
    if (_wsCheckTimer) {
        clearInterval(_wsCheckTimer);
        _wsCheckTimer = null;
    }
});
</script>

<style lang="scss">
@import "@/styles/chat-common.scss";

.page-chat {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* === Header === */
.chat-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--mci-gradient-primary);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

    &__safe-top { height: var(--mci-safe-top); }

    &__row {
        display: flex; align-items: center;
        height: 50px;
        padding: 0 var(--mci-space-2);
    }

    &__btn {
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        color: #fff;
        font-size: 20px;
        border-radius: var(--mci-radius-full);
        cursor: pointer;
        transition: background var(--mci-duration-fast);

        &:active { background: rgba(255, 255, 255, 0.2); }
    }

    &__title {
        flex: 1;
        text-align: center;
        display: flex; flex-direction: column; align-items: center;

        .title-name {
            font-size: var(--mci-text-base);
            font-weight: var(--mci-font-semibold);
            color: #fff;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }
        .title-status {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.75);
            margin-top: 2px;
        }
    }
}

/* === 消息区 === */
.chat-messages {
    flex: 1;
    padding: var(--mci-space-3);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--mci-bg-base);
}

.connection-status {
    display: flex; align-items: center; justify-content: center;
    gap: 6px;
    padding: 6px var(--mci-space-3);
    margin-bottom: var(--mci-space-2);
    background: var(--mci-bg-card);
    border: 1px solid var(--mci-color-warning);
    border-radius: var(--mci-radius-full);
    color: var(--mci-color-warning);
    font-size: var(--mci-text-xs);

    .rot { animation: spin 1s linear infinite; }
}

.loading-more {
    display: flex; align-items: center; justify-content: center;
    gap: 6px;
    padding: var(--mci-space-3);
    color: var(--mci-text-tertiary);
    font-size: var(--mci-text-xs);

    .rot { animation: spin 1s linear infinite; }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.time-divider {
    text-align: center;
    padding: var(--mci-space-3) 0 var(--mci-space-2);

    span {
        display: inline-block;
        padding: 3px 10px;
        font-size: 11px;
        color: var(--mci-text-tertiary);
        background: var(--mci-bg-card);
        border-radius: var(--mci-radius-full);
    }
}

/* === 消息气泡 === */
.message-wrapper {
    margin-bottom: var(--mci-space-3);
    animation: mciFadeUp var(--mci-duration-base) var(--mci-ease-out);
}

.message-row {
    display: flex;
    align-items: flex-end;
    gap: var(--mci-space-2);

    &.is-self {
        flex-direction: row-reverse;
    }

    .msg-avatar {
        flex-shrink: 0;
        background: var(--mci-gradient-primary) !important;
        color: #fff !important;
        font-weight: var(--mci-font-semibold) !important;
        box-shadow: 0 2px 6px var(--mci-color-primary-glow);
    }
}

.bubble-wrap {
    max-width: 72%;
    display: flex;
    flex-direction: column;
}

.message-row.is-self .bubble-wrap {
    align-items: flex-end;
}

.sender-name {
    font-size: 11px;
    color: var(--mci-text-tertiary);
    margin-bottom: 4px;
    margin-left: 4px;
}

.bubble {
    position: relative;
    padding: var(--mci-space-2) var(--mci-space-3);
    border-radius: var(--mci-radius-lg);
    font-size: var(--mci-text-sm);
    line-height: 1.5;
    word-wrap: break-word;
    word-break: break-word;
    background: var(--mci-bg-elevated);
    color: var(--mci-text-primary);
    border: 1px solid var(--mci-border-color);
    box-shadow: var(--mci-shadow-sm);
    transition: transform var(--mci-duration-fast);

    &:active { transform: scale(0.98); }

    &.bubble-data {
        padding: var(--mci-space-2);
        max-width: 100%;
        overflow-x: auto;
    }
}

.message-row.is-self .bubble {
    background: var(--mci-gradient-primary);
    color: var(--mci-text-on-primary);
    border-color: transparent;
    box-shadow: 0 2px 12px var(--mci-color-primary-glow);

    /* 流式打字光标 */
    .typing-cursor { color: rgba(255, 255, 255, 0.85); }
}

.message-row.is-other .bubble {
    background: var(--mci-bg-elevated);
}

.bubble-time {
    font-size: 10px;
    color: var(--mci-text-tertiary);
    margin-top: 4px;
    padding: 0 4px;
}

/* === Streaming === */
.streaming-message {
    border-left: 2px solid var(--mci-color-primary);
}

.thinking-indicator {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--mci-text-tertiary);
    font-size: var(--mci-text-xs);
}

.thinking-dots {
    display: inline-flex; gap: 2px;

    span {
        animation: thinkBlink 1.4s infinite;
        opacity: 0.3;

        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.4s; }
    }
}

@keyframes thinkBlink {
    0%, 80%, 100% { opacity: 0.3; }
    40% { opacity: 1; }
}

.typing-cursor {
    display: inline-block;
    margin-left: 2px;
    color: var(--mci-color-primary);
    animation: cursorBlink 0.8s infinite;
}

@keyframes cursorBlink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
}

@keyframes mciFadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

/* === 输入区 === */
.chat-input-area {
    flex-shrink: 0;
    background: var(--mci-bg-elevated);
    border-top: 1px solid var(--mci-border-color);
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
    padding: var(--mci-space-2) var(--mci-space-3);
}

.ai-model-bar {
    display: flex; align-items: center;
    gap: var(--mci-space-2);
    padding-bottom: var(--mci-space-2);
    border-bottom: 1px dashed var(--mci-border-color);
    margin-bottom: var(--mci-space-2);

    .ai-model-label {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-secondary);
        white-space: nowrap;
    }
}

.input-row {
    display: flex; align-items: flex-end;
    gap: var(--mci-space-2);
}

.input-tool {
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    color: var(--mci-text-secondary);
    font-size: 20px;
    border-radius: var(--mci-radius-full);
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--mci-duration-fast);

    &:active { background: var(--mci-bg-card-hover); }
}

.input-wrapper {
    flex: 1;

    :deep(.el-textarea__inner) {
        background: var(--mci-bg-card);
        border: 1px solid var(--mci-border-color);
        border-radius: var(--mci-radius-md);
        color: var(--mci-text-primary);
        padding: var(--mci-space-2) var(--mci-space-3);
        font-size: var(--mci-text-sm);
        line-height: 1.5;
        box-shadow: none;
        resize: none;
        transition: border-color var(--mci-duration-fast);

        &:focus { border-color: var(--mci-color-primary); }
    }
}

.send-btn {
    flex-shrink: 0;
    height: 36px;
    padding: 0 var(--mci-space-4);
    border-radius: var(--mci-radius-full);
}

.more-panel {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--mci-space-3);
    padding: var(--mci-space-3) 0 var(--mci-space-2);
    margin-top: var(--mci-space-2);
    border-top: 1px solid var(--mci-border-color);
    animation: mciFadeUp var(--mci-duration-base) var(--mci-ease-out);
}

.panel-item {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: transform var(--mci-duration-fast);

    &:active { transform: scale(0.94); }

    &__icon {
        width: 48px; height: 48px;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg,
            rgba(114, 43, 255, 0.12),
            rgba(41, 184, 255, 0.12));
        border: 1px solid var(--mci-border-color);
        border-radius: var(--mci-radius-md);
        color: var(--mci-color-primary-light);
        font-size: 22px;
    }

    span {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-secondary);
    }
}

.safe-bottom { height: var(--mci-safe-bottom); }

/* === 设置抽屉 === */
:deep(.mci-drawer) {
    background: var(--mci-bg-elevated);

    .el-drawer__header {
        padding: var(--mci-space-4);
        margin-bottom: 0;
        border-bottom: 1px solid var(--mci-border-color);
    }
    .el-drawer__title {
        font-size: var(--mci-text-base);
        font-weight: var(--mci-font-semibold);
        color: var(--mci-text-primary);
    }
    .el-drawer__body { padding: 0; }
}

.chat-settings {
    display: flex; flex-direction: column;

    .mci-cell {
        justify-content: space-between;
    }
}
</style>
