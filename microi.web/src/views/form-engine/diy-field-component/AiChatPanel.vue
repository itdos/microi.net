<template>
    <div class="ai-chat-panel">
        <div class="ai-chat-header">
            <div class="ai-chat-title">
                <svg class="ai-icon-spark" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
                </svg>
                <span>AI 编程助手</span>
            </div>
            <el-icon class="ai-chat-close" @click="$emit('close')"><Close /></el-icon>
        </div>
        <!-- AI 模型选择 -->
        <div class="ai-model-selector">
            <span class="ai-model-label">模型：</span>
            <el-select
                :model-value="selectedAiModel"
                @update:model-value="$emit('update:selectedAiModel', $event)"
                size="small"
                placeholder="选择AI模型"
                :loading="aiModelLoading"
                class="ai-model-select"
            >
                <el-option
                    v-for="model in aiModelList"
                    :key="model.Id"
                    :label="model.Name"
                    :value="model"
                />
            </el-select>
        </div>

        <div class="ai-chat-messages" ref="chatMessagesRef">
            <!-- 欢迎消息 -->
            <div v-if="chatMessages.length === 0" class="ai-welcome">
                <div class="ai-welcome-icon">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
                    </svg>
                </div>
                <h3>你好！我是 AI 编程助手</h3>
                <p>描述你的业务需求，我将为你生成 V8 引擎代码</p>
                <div class="ai-welcome-examples">
                    <div class="ai-example-item" @click="$emit('use-example', '帮我获取最新的一条生产订单数据')">
                        <el-icon><Promotion /></el-icon>
                        <span>获取最新的一条生产订单数据</span>
                    </div>
                    <div class="ai-example-item" @click="$emit('use-example', '批量更新所有已完成的订单状态为已归档')">
                        <el-icon><Promotion /></el-icon>
                        <span>批量更新已完成的订单状态</span>
                    </div>
                    <div class="ai-example-item" @click="$emit('use-example', '计算本月销售额TOP10的业务员')">
                        <el-icon><Promotion /></el-icon>
                        <span>计算本月销售额TOP10业务员</span>
                    </div>
                </div>
            </div>

            <!-- 聊天记录 -->
            <template v-for="(msg, idx) in chatMessages" :key="idx">
                <!-- 用户消息 -->
                <div v-if="msg.role === 'user'" class="ai-msg ai-msg-user">
                    <div class="ai-msg-avatar user-avatar">
                        <el-icon><User /></el-icon>
                    </div>
                    <div class="ai-msg-content">
                        <div class="ai-msg-text">{{ msg.content }}</div>
                        <div class="ai-msg-time">{{ msg.time }}</div>
                    </div>
                </div>
                <!-- AI消息 -->
                <div v-else class="ai-msg ai-msg-ai">
                    <div class="ai-msg-avatar ai-avatar">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
                        </svg>
                    </div>
                    <div class="ai-msg-content">
                        <div class="ai-msg-text">
                            <span v-if="msg.status === 'generating'" class="ai-generating-text">
                                {{ msg.content }}<span class="ai-cursor-blink">|</span>
                            </span>
                            <span v-else-if="msg.status === 'error'" class="ai-error-text">
                                <el-icon><WarningFilled /></el-icon> {{ msg.content }}
                            </span>
                            <span v-else>{{ msg.content }}</span>
                        </div>
                        <!-- 元数据标签 -->
                        <div v-if="msg.metadata && msg.metadata.RelevantDocs && msg.metadata.RelevantDocs.length" class="ai-msg-meta">
                            <div class="ai-meta-label">参考文档：</div>
                            <el-tag v-for="doc in msg.metadata.RelevantDocs" :key="doc" size="small" type="success" class="ai-meta-tag">{{ doc }}</el-tag>
                        </div>
                        <div v-if="msg.metadata && msg.metadata.RelevantTables && msg.metadata.RelevantTables.length" class="ai-msg-meta">
                            <div class="ai-meta-label">相关表：</div>
                            <el-tag v-for="table in msg.metadata.RelevantTables" :key="table" size="small" type="warning" class="ai-meta-tag">{{ table }}</el-tag>
                        </div>
                        <div class="ai-msg-time">{{ msg.time }}</div>
                        <!-- 操作按钮 -->
                        <div v-if="msg.status === 'done' && msg.code" class="ai-msg-actions">
                            <el-button size="small" text type="primary" @click="$emit('apply-code', msg.code)">
                                <el-icon><DocumentChecked /></el-icon> 应用到编辑器
                            </el-button>
                            <el-button size="small" text @click="copyCode(msg.code)">
                                <el-icon><CopyDocument /></el-icon> 复制代码
                            </el-button>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- 输入区域 -->
        <div class="ai-chat-input">
            <div class="ai-input-wrapper">
                <el-input
                    :model-value="aiQuestion"
                    @update:model-value="$emit('update:aiQuestion', $event)"
                    type="textarea"
                    :rows="2"
                    :autosize="{ minRows: 2, maxRows: 5 }"
                    placeholder="描述你的业务需求，如：帮我获取最新的一条生产订单数据"
                    :disabled="aiGenerating"
                    @keydown.enter.exact="handleAiSend"
                    resize="none"
                />
            </div>
            <div class="ai-input-actions">
                <span class="ai-input-hint">Enter 发送 / Shift+Enter 换行</span>
                <div class="ai-input-btns">
                    <el-button v-if="aiGenerating" size="small" type="danger" plain @click="$emit('cancel')">
                        <el-icon><VideoPause /></el-icon> 停止
                    </el-button>
                    <el-button 
                        v-else 
                        size="small" 
                        type="primary"
                        :disabled="!aiQuestion || !aiQuestion.trim()" 
                        @click="$emit('send')"
                    >
                        <el-icon><Promotion /></el-icon> 发送
                    </el-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick, getCurrentInstance } from 'vue';
import {
    Close,
    Promotion,
    User,
    WarningFilled,
    DocumentChecked,
    CopyDocument,
    VideoPause
} from '@element-plus/icons-vue';

defineProps({
    chatMessages: { type: Array, default: () => [] },
    aiQuestion: { type: String, default: '' },
    aiGenerating: { type: Boolean, default: false },
    selectedAiModel: { type: Object, default: null },
    aiModelList: { type: Array, default: () => [] },
    aiModelLoading: { type: Boolean, default: false }
});

const emits = defineEmits([
    'close',
    'update:aiQuestion',
    'update:selectedAiModel',
    'send',
    'cancel',
    'apply-code',
    'use-example'
]);

const chatMessagesRef = ref(null);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

const scrollToBottom = () => {
    nextTick(() => {
        if (chatMessagesRef.value) {
            chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
        }
    });
};

const handleAiSend = (e) => {
    if (e.shiftKey) return;
    e.preventDefault();
    emits('send');
};

const copyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
        DiyCommon.Tips('代码已复制到剪贴板', true);
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        DiyCommon.Tips('代码已复制到剪贴板', true);
    });
};

defineExpose({ scrollToBottom });
</script>
