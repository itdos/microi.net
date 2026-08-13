<template>
    <div
        class="ai-engine-page"
        :class="{ 'is-app-workspace': activeWorkspace === 'apps', 'is-embedded': embedded, 'is-compact': compact }"
        data-testid="unified-ai-assistant"
    >
        <aside class="ai-engine-sidebar" data-testid="unified-ai-history">
            <div class="workspace-tabs" :class="{ 'single-tab': !isAiAdmin }">
                <button
                    type="button"
                    class="workspace-tab"
                    :class="{ active: activeWorkspace === 'chat' }"
                    @click="activeWorkspace = 'chat'"
                >
                    <el-icon><Cpu /></el-icon>
                    <span>AI对话</span>
                </button>
                <button
                    v-if="isAiAdmin"
                    type="button"
                    class="workspace-tab"
                    :class="{ active: activeWorkspace === 'video' }"
                    @click="openVideoWorkspace"
                >
                    <el-icon><VideoPlay /></el-icon>
                    <span>AI视频</span>
                </button>
                <button
                    v-if="isAiAdmin"
                    type="button"
                    class="workspace-tab"
                    @click="goAiApps"
                >
                    <el-icon><FolderOpened /></el-icon>
                    <span>AI应用</span>
                </button>
            </div>

            <template v-if="activeWorkspace === 'chat'">
                <div class="sidebar-actions">
                    <el-button
                        class="new-chat-btn"
                        :icon="EditPen"
                        data-testid="unified-ai-new-conversation"
                        @click="newConversation"
                    >新建AI对话</el-button>
                    <el-input
                        v-model="historyKeyword"
                        clearable
                        :prefix-icon="Search"
                        placeholder="搜索历史"
                        size="small"
                    />
                </div>

                <div class="history-tabs" aria-label="对话状态">
                    <button
                        type="button"
                        data-testid="unified-ai-history-active"
                        :class="{ active: historyView === 'active' }"
                        @click="historyView = 'active'"
                    >
                        AI对话
                        <small>{{ activeConversationCount }}</small>
                    </button>
                    <button
                        type="button"
                        data-testid="unified-ai-history-archived"
                        :class="{ active: historyView === 'archived' }"
                        @click="historyView = 'archived'"
                    >
                        已归档
                        <small>{{ archivedConversationCount }}</small>
                    </button>
                </div>
                <div class="conversation-list" v-loading="historyLoading">
                    <div
                        v-for="item in filteredConversations"
                        :key="item.key || `${item.source || SOURCE}:${item.id}`"
                        class="conversation-item"
                        :class="{ active: isCurrentConversation(item) }"
                    >
                        <button type="button" class="conversation-select" @click="selectConversation(item)">
                            <span class="conversation-title">
                                {{ item.title }}
                                <em v-if="item.source === SECURE_DATA_SOURCE">安全数据</em>
                            </span>
                            <small>{{ item.lastTime || "-" }}</small>
                        </button>
                        <el-tooltip content="修改标题" placement="top">
                            <button
                                type="button"
                                class="conversation-action"
                                :disabled="historyActionLoading === item.id"
                                aria-label="修改标题"
                                @click.stop="editConversationTitle(item)"
                            >
                                <el-icon><EditPen /></el-icon>
                            </button>
                        </el-tooltip>
                        <el-tooltip :content="item.archived ? '还原对话' : '归档任务'" placement="right">
                            <button
                                type="button"
                                class="conversation-action"
                                :class="{ loading: historyActionLoading === item.id }"
                                :disabled="historyActionLoading === item.id"
                                :aria-label="item.archived ? '还原对话' : '归档任务'"
                                @click.stop="setConversationArchived(item, !item.archived)"
                            >
                                <el-icon><component :is="item.archived ? RefreshLeft : Box" /></el-icon>
                            </button>
                        </el-tooltip>
                    </div>
                    <el-empty
                        v-if="!filteredConversations.length && !historyLoading"
                        :image-size="70"
                        :description="historyView === 'archived' ? '暂无已归档对话' : '暂无聊天'"
                    />
                </div>
            </template>

            <template v-else-if="activeWorkspace === 'video'">
                <div class="app-sidebar-intro">
                    <strong>MiniMax 视频中心</strong>
                    <p>创建记录、任务句柄、HDFS 持久地址和人工验片状态都保存在当前租户；临时下载地址不会被当成最终资产。</p>
                </div>
            </template>

            <template v-else>
                <div class="app-sidebar-intro">
                    <strong>AI应用工坊</strong>
                    <p>在这里管理 AI 生成的 Web / UniApp 应用，直接查看源码、预览运行，并继续对话迭代。</p>
                </div>
            </template>
        </aside>

        <main class="ai-engine-main" :class="{ 'is-apps': activeWorkspace === 'apps' }">
            <header class="ai-engine-header">
                <div class="header-left">
                    <div v-if="activeWorkspace === 'apps'" class="header-workspace-switch">
                        <button type="button" @click="activeWorkspace = 'chat'">AI对话</button>
                        <button type="button" class="active" @click="activeWorkspace = 'apps'">AI应用</button>
                    </div>
                    <h2>{{ workspaceTitle }}</h2>
                    <el-tag size="small" effect="plain">{{ osClient }}</el-tag>
                    <el-tooltip v-if="secureAssistantAvailable" :content="secureAssistantRoleText" placement="bottom">
                        <el-tag class="secure-scope-tag" size="small" type="success" effect="plain">
                            {{ secureAssistantScopeLabel }} · 数据权限已校验
                        </el-tag>
                    </el-tooltip>
                    <el-tooltip
                        v-else-if="secureAssistantFailure"
                        :content="secureAssistantFailure.description"
                        placement="bottom"
                    >
                        <el-tag class="secure-scope-tag" size="small" type="warning" effect="plain">
                            {{ secureAssistantFailure.header }}
                        </el-tag>
                    </el-tooltip>
                </div>
                <div class="header-tools">
                    <el-button class="store-link-btn" type="primary" plain :icon="ShoppingBag" @click="goMicroiStore">
                        应用商城
                    </el-button>
                    <el-button v-if="isAiAdmin" :icon="Grid" @click="openModelDrawer">AI引擎列表</el-button>
                </div>
            </header>

            <template v-if="activeWorkspace === 'chat'">
            <section ref="messageWrapRef" class="message-wrap">
                <div v-if="messages.length === 0" class="empty-state">
                    <div class="empty-hero">
                        <span class="hero-kicker">AI引擎</span>
                        <h1>让 AI 助手直接进入你的业务现场</h1>
                        <p>描述目标即可连续对话，我会结合 Skills、MCP 建模能力和当前租户上下文，辅助你分析数据、编写 V8、创建低代码模块。</p>
                        <p class="hero-local-tip">AI 深度融合 V8 引擎，强烈建议使用本地 VS Code Codex / Copilot / Claude / Cursor + MCP + Skills，进行真正意义的零代码 AI 编程。</p>
                    </div>
                    <div v-if="isAiAdmin" class="platform-stats" v-loading="statsLoading">
                        <div v-for="stat in statCards" :key="stat.key" class="platform-stat" :data-stat="stat.key">
                            <span>{{ stat.label }}</span>
                            <strong>{{ stat.value }}</strong>
                            <small>{{ stat.desc }}</small>
                        </div>
                    </div>
                    <div class="quick-prompts">
                        <button
                            v-for="prompt in quickPrompts"
                            :key="prompt.key || prompt.title"
                            type="button"
                            class="quick-prompt"
                            @click="useQuickPrompt(prompt)"
                        >
                            <el-icon><component :is="prompt.icon" /></el-icon>
                            <strong>{{ prompt.title }}</strong>
                            <span>{{ prompt.desc }}</span>
                        </button>
                    </div>
                </div>

                <div v-else class="message-list">
                    <article
                        v-for="message in messages"
                        :key="message.id"
                        class="message"
                        :class="'is-' + message.role"
                    >
                        <div class="message-avatar">
                            <img v-if="message.role === 'user' && currentUserAvatar" :src="currentUserAvatar" alt="" />
                            <el-icon v-else-if="message.role === 'user'"><User /></el-icon>
                            <el-icon v-else><Cpu /></el-icon>
                        </div>
                        <div class="message-body">
                            <div class="message-meta">
                                <strong>{{ message.role === "user" ? currentUserName : "AI助手" }}</strong>
                                <span>{{ message.time }}</span>
                                <el-tag v-if="message.modelId" size="small" effect="plain">{{ message.modelId }}</el-tag>
                                <el-tag v-if="message.mode" size="small" effect="plain">{{ modeName(message.mode) }}</el-tag>
                                <el-tag v-if="message.reasoningEffort && message.reasoningEffort !== 'auto'" size="small" effect="plain">
                                    {{ reasoningEffortName(message.reasoningEffort) }}
                                </el-tag>
                                <button
                                    v-if="message.content || message.code"
                                    type="button"
                                    class="message-copy-btn"
                                    @click="copyText([message.content, message.code].filter(Boolean).join('\n\n'))"
                                >
                                    <el-icon><CopyDocument /></el-icon>
                                    复制
                                </button>
                            </div>

                            <div v-if="message.thinking" class="message-thinking">
                                <button
                                    type="button"
                                    class="thinking-toggle"
                                    @click="message.thinkingCollapsed = !message.thinkingCollapsed"
                                >
                                    <el-icon><Cpu /></el-icon>
                                    <span>思考过程</span>
                                    <small>{{ thinkingParagraphCount(message.thinking) }} 段</small>
                                </button>
                                <pre v-show="!message.thinkingCollapsed" class="thinking-content">{{ message.thinking }}</pre>
                            </div>

                            <div v-if="message.role === 'assistant' && message.streaming && !message.content && !message.thinking" class="thinking-placeholder">
                                <span class="thinking-dot"></span>
                                <span class="thinking-dot"></span>
                                <span class="thinking-dot"></span>
                                <em>正在思考</em>
                            </div>

                            <pre v-if="message.content" class="message-text" :class="{ streaming: message.streaming }">{{ message.content }}</pre>

                            <div v-if="message.attachments && message.attachments.length" class="message-attachments">
                                <span
                                    v-for="file in message.attachments"
                                    :key="`${message.id}_${file.FileName}_${file.Size}`"
                                    class="attachment-chip readonly"
                                >
                                    <el-icon><Paperclip /></el-icon>
                                    {{ file.FileName }}
                                </span>
                            </div>

                            <div v-if="message.code" class="code-block">
                                <div class="code-toolbar">
                                    <span>V8 / JavaScript</span>
                                    <el-button text :icon="CopyDocument" @click="copyText(message.code)">复制代码</el-button>
                                </div>
                                <pre>{{ message.code }}</pre>
                            </div>

                            <div v-if="message.queryRows && message.queryRows.length" class="query-result">
                                <el-table
                                    :data="message.queryRows"
                                    size="small"
                                    :max-height="queryResultMaxHeight(message.queryRows)"
                                    border
                                >
                                    <el-table-column
                                        v-for="column in Object.keys(message.queryRows[0] || {})"
                                        :key="column"
                                        :prop="column"
                                        :label="column"
                                        min-width="130"
                                        show-overflow-tooltip
                                    />
                                </el-table>
                            </div>

                            <div v-if="message.actions && message.actions.length" class="mcp-actions">
                                <div class="mcp-actions-title">
                                    <el-icon><Operation /></el-icon>
                                    <span>MCP 建模动作</span>
                                </div>
                                <div class="mcp-action-list">
                                    <div
                                        v-for="(action, index) in message.actions"
                                        :key="`${message.id}_${index}`"
                                        class="mcp-action-item"
                                    >
                                        <div class="mcp-action-info">
                                            <strong>{{ action.Title || action.Action }}</strong>
                                            <small>{{ action.Action }}</small>
                                        </div>
                                        <el-button
                                            size="small"
                                            type="primary"
                                            plain
                                            :loading="action.__loading"
                                            @click="executeMcpAction(action)"
                                        >
                                            执行
                                        </el-button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </section>

            <footer class="composer">
                <div class="composer-box">
                    <el-input
                        v-model="inputText"
                        data-testid="unified-ai-input"
                        type="textarea"
                        resize="none"
                        :autosize="{ minRows: 2, maxRows: 8 }"
                        placeholder="描述你想做什么，或上传图片/文件让 AI 分析"
                        :disabled="sending"
                        @keydown.enter.exact="handleEnter"
                    />

                    <div v-if="selectedFiles.length" class="attachment-list">
                        <span
                            v-for="(file, index) in selectedFiles"
                            :key="`${file.name}_${file.size}_${index}`"
                            class="attachment-chip"
                        >
                            <el-icon><Paperclip /></el-icon>
                            {{ file.name }}
                            <button type="button" @click="removeAttachment(index)">
                                <el-icon><CircleClose /></el-icon>
                            </button>
                        </span>
                    </div>

                    <div class="composer-footer">
                        <div class="composer-left">
                            <input
                                ref="fileInputRef"
                                class="attachment-input"
                                type="file"
                                multiple
                                accept="image/*,.txt,.md,.json,.csv,.xml,.yaml,.yml,.js,.ts,.vue,.cs,.sql,.log"
                                @change="handleAttachmentChange"
                            />
                            <el-tooltip content="上传文件或图片" placement="top">
                                <el-button class="icon-action" text :icon="Paperclip" @click="triggerAttachmentPicker" />
                            </el-tooltip>
                            <span class="semantic-label">语义分析</span>
                            <el-select
                                v-model="semanticMode"
                                data-testid="unified-ai-mode"
                                size="small"
                                class="semantic-select"
                                :disabled="sending"
                            >
                                <el-option
                                    v-for="item in semanticModeOptions"
                                    :key="item.value"
                                    :label="item.label"
                                    :value="item.value"
                                    :disabled="item.disabled"
                                />
                            </el-select>
                            <el-tooltip
                                :content="reasoningEffortTooltip"
                                placement="top"
                            >
                                <span class="semantic-label reasoning-label">推理强度</span>
                            </el-tooltip>
                            <el-select
                                v-model="reasoningEffort"
                                size="small"
                                class="reasoning-select"
                                :disabled="sending || !selectedModelSupportsReasoning"
                            >
                                <el-option
                                    v-for="item in reasoningEffortOptions"
                                    :key="item.value"
                                    :label="item.label"
                                    :value="item.value"
                                />
                            </el-select>
                            <el-tooltip :content="schemaSearchModeTooltip" placement="top">
                                <el-tag class="schema-mode-tag" size="small" effect="plain">
                                    {{ schemaSearchModeLabel }}
                                </el-tag>
                            </el-tooltip>
                        </div>
                        <div class="composer-right">
                            <el-select
                                v-if="isRelayStationSelected"
                                v-model="selectedRelayModel"
                                filterable
                                :loading="relayModelsLoading"
                                placeholder="选择中转模型"
                                class="composer-model-select relay-model-select"
                            >
                                <el-option
                                    v-for="model in relayModelList"
                                    :key="model.id"
                                    :label="model.id"
                                    :value="model.id"
                                />
                            </el-select>
                            <el-select
                                v-model="selectedAiModel"
                                data-testid="unified-ai-model"
                                value-key="Id"
                                filterable
                                :loading="modelLoading"
                                placeholder="选择模型"
                                class="composer-model-select"
                            >
                                <el-option
                                    v-for="model in aiModelList"
                                    :key="model.Id"
                                    :label="formatModelName(model)"
                                    :value="model"
                                />
                            </el-select>
                            <el-button v-if="sending" class="stop-btn" :icon="CircleClose" @click="cancelRequest">停止</el-button>
                            <el-button
                                v-else
                                class="send-btn"
                                data-testid="unified-ai-send"
                                type="primary"
                                :icon="Top"
                                :disabled="sendDisabled"
                                @click="sendMessage"
                            />
                        </div>
                    </div>
                    <div class="ai-generation-disclaimer">
                        <span>内容由人工智能生成，请注意甄别</span>
                        <small v-if="secureAssistantAvailable">
                            安全业务数据模式仅使用 {{ secureAssistantScopeLabel }} 范围内的限量、脱敏数据
                        </small>
                        <small v-else-if="secureAssistantFailure" class="secure-assistant-unavailable">
                            安全业务数据：{{ secureAssistantFailure.description }}
                        </small>
                    </div>
                </div>
            </footer>
            </template>

            <template v-else-if="activeWorkspace === 'video'">
                <section class="video-workspace" data-testid="ai-video-workspace">
                    <div class="video-create-card">
                        <div class="video-section-heading">
                            <div>
                                <span class="hero-kicker">MiniMax Token Plan</span>
                                <h1>创建可追踪、可下载、可发布的 AI 视频</h1>
                                <p>画质优先使用 Hailuo 2.3 的 6 秒 / 1080P：连续 3 个分镜合成为一条约 18 秒的带对白、配乐 VideoMaster。MiniMax API 不提供 fps 参数，最终帧率必须以媒体探针实测为准；10 秒 / 768P 是时长优先的另一种取舍。</p>
                            </div>
                            <div class="video-policy-tags">
                                <el-tag type="success" effect="plain">画质优先 · 1080P / 6 秒</el-tag>
                                <el-tag type="warning" effect="plain">fps 以成片实测为准</el-tag>
                                <el-tag effect="plain">3 分镜合成 1 条母版</el-tag>
                                <el-tag effect="plain">分镜只合成，不单独发布</el-tag>
                            </div>
                            <el-alert
                                class="video-quota-alert"
                                :title="videoQuotaTitle"
                                :description="videoQuotaDescription"
                                :type="videoQuotaError ? 'error' : (videoQuota ? 'success' : 'info')"
                                :closable="false"
                                show-icon
                            />
                        </div>
                        <el-form label-position="top" class="video-create-form" @submit.prevent>
                            <el-form-item label="视频提示词">
                                <el-input
                                    v-model="videoForm.prompt"
                                    type="textarea"
                                    :rows="5"
                                    maxlength="2000"
                                    show-word-limit
                                    placeholder="描述人物、办公室场景、镜头运动、动作连续性和希望传达的信息；避免大段文字、夸张广告和不可验证承诺。"
                                />
                            </el-form-item>
                            <div class="video-form-grid">
                                <el-form-item label="模型">
                                    <el-input v-model="videoForm.model" disabled />
                                </el-form-item>
                                <el-form-item label="当前订阅规格">
                                    <el-select v-model="videoForm.preset" @change="applyVideoPreset">
                                        <el-option
                                            v-for="option in videoPresetOptions"
                                            :key="option.value"
                                            :label="option.label"
                                            :value="option.value"
                                        />
                                    </el-select>
                                </el-form-item>
                                <el-form-item label="实际规格">
                                    <el-input :model-value="`${videoForm.duration} 秒 / ${videoForm.resolution}`" disabled />
                                </el-form-item>
                            </div>
                            <div class="video-create-actions">
                                <el-button
                                    type="primary"
                                    :icon="VideoPlay"
                                    :loading="videoCreateLoading"
                                    data-testid="ai-video-create"
                                    @click="createMiniMaxVideo"
                                >创建 1 个分镜（不发布）</el-button>
                                <el-button :icon="Refresh" :loading="videoLoading" @click="loadVideoRecords">刷新记录</el-button>
                                <el-button :icon="Refresh" :loading="videoQuotaLoading" @click="refreshMiniMaxQuota(false)">刷新套餐余量</el-button>
                            </div>
                        </el-form>
                    </div>

                    <div class="video-record-card">
                        <div class="video-section-heading compact-heading">
                            <div>
                                <h2>视频与音轨记录</h2>
                                <p>分镜、唯一母版、男女对白和配乐的持久文件、审核结论与失败原因均从 mci_ai_content_asset 回读。</p>
                            </div>
                            <el-tag effect="plain">{{ videoRows.length }} 条</el-tag>
                        </div>
                        <el-table :data="videoRows" v-loading="videoLoading" row-key="Id" class="video-record-table">
                            <el-table-column type="expand">
                                <template #default="scope">
                                    <div class="video-record-detail">
                                        <audio
                                            v-if="scope.row.FileUrl && ['AudioDialogue','AudioMusic'].includes(String(scope.row.AssetType || ''))"
                                            :src="scope.row.FileUrl"
                                            controls
                                            preload="metadata"
                                        ></audio>
                                        <video v-else-if="scope.row.FileUrl" :src="scope.row.FileUrl" controls preload="metadata"></video>
                                        <div>
                                            <strong>完整提示词</strong>
                                            <p>{{ scope.row.Prompt || "-" }}</p>
                                            <small v-if="scope.row.QualityReview">{{ scope.row.QualityReview }}</small>
                                        </div>
                                    </div>
                                </template>
                            </el-table-column>
                            <el-table-column prop="Prompt" label="提示词" min-width="280" show-overflow-tooltip />
                            <el-table-column prop="AssetType" label="资产类型" width="125" />
                            <el-table-column prop="Model" label="模型" width="190" />
                            <el-table-column label="规格" width="110">
                                <template #default="scope">{{ scope.row.Resolution || "-" }} · {{ scope.row.Duration || 0 }}s</template>
                            </el-table-column>
                            <el-table-column label="状态" width="120">
                                <template #default="scope">
                                    <el-tag :type="videoStatusType(scope.row.Status)" effect="plain">{{ videoStatusLabel(scope.row.Status) }}</el-tag>
                                </template>
                            </el-table-column>
                            <el-table-column prop="UpdateTime" label="更新时间" width="170" />
                            <el-table-column label="操作" width="300" fixed="right">
                                <template #default="scope">
                                    <el-button
                                        v-if="['Preparing','Queueing','Processing'].includes(String(scope.row.Status || ''))"
                                        text
                                        type="primary"
                                        :loading="videoActionLoading === scope.row.Id"
                                        @click="refreshVideoRecord(scope.row)"
                                    >刷新状态</el-button>
                                    <el-button
                                        v-if="scope.row.FileUrl"
                                        text
                                        type="primary"
                                        :icon="Download"
                                        @click="downloadVideo(scope.row)"
                                    >下载</el-button>
                                    <el-button
                                        v-if="scope.row.FileUrl && scope.row.ReviewStatus !== 'Approved'"
                                        text
                                        type="success"
                                        :icon="CircleCheck"
                                        @click="approveVideoRecord(scope.row)"
                                    >审核通过</el-button>
                                </template>
                            </el-table-column>
                        </el-table>
                        <el-empty v-if="!videoRows.length && !videoLoading" description="暂无视频或音轨记录" />
                    </div>
                </section>
            </template>
        </main>

        <el-drawer
            v-model="modelDrawerVisible"
            title="AI引擎列表"
            size="86%"
            destroy-on-close
            append-to-body
        >
            <div class="ai-model-drawer-content">
                <DiyTable
                    v-if="aiModelTableId && aiModelSysMenuId"
                    :key="aiModelSysMenuId + '_' + aiModelTableId"
                    :PropsTableId="aiModelTableId"
                    :PropsSysMenuId="aiModelSysMenuId"
                    ContainerClass="ai-engine-table-drawer"
                />
                <el-empty v-else description="未找到 mic_ai 对应的模块引擎配置" />
            </div>
        </el-drawer>

    </div>
</template>

<script setup>
import { computed, defineAsyncComponent, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useDiyStore } from "@/pinia";
import {
    Box,
    CircleClose,
    CircleCheck,
    CopyDocument,
    Cpu,
    DataAnalysis,
    EditPen,
    Download,
    FolderOpened,
    Grid,
    MagicStick,
    Operation,
    Paperclip,
    RefreshLeft,
    Refresh,
    Search,
    ShoppingBag,
    Top,
    User,
    VideoPlay
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
    MOBILE_AI_BOOTSTRAP_FAILURES,
    classifyMobileAiBootstrapFailure,
    listMobileAiConversations,
    listMobileAiMessages,
    loadMobileAiBootstrap,
    makeMobileAiBootstrapFailure,
    makeMobileAiId,
    normalizeMobileAiMessages,
    renameMobileAiConversation,
    sendMobileAiQuestion,
    setMobileAiConversationArchived
} from "@/views/mobile/ai-assistant-api.js";

const DiyTable = defineAsyncComponent(() => import("@/views/form-engine/diy-table.vue"));
const props = defineProps({
    embedded: {
        type: Boolean,
        default: false
    },
    compact: {
        type: Boolean,
        default: false
    }
});
const embedded = computed(() => props.embedded);
const compact = computed(() => props.compact);
const { proxy } = getCurrentInstance();
const route = useRoute();
const DiyCommon = proxy.DiyCommon;
const diyStore = useDiyStore();

const SOURCE = "ai-engine-workbench";
const SECURE_DATA_SOURCE = "mci-ai-data-assistant";
const AI_DATA_PERMISSION = { id: "AiDataAnalysis", name: "AI数据分析" };
const AI_BUILDER_PERMISSION = { id: "AiLowCodeModeling", name: "低代码建模" };
const ACTION_ENDPOINTS = {
    GetDbSchema: "/api/V8Engine/GetDbSchema",
    CreateTable: "/api/V8Engine/CreateTable",
    AddField: "/api/V8Engine/AddField",
    CreateModule: "/api/V8Engine/CreateModule",
    CreateApiEngine: "/api/V8Engine/CreateApiEngine",
    UpdateApiEngineCode: "/api/V8Engine/UpdateApiEngineCode",
    SavePageEngine: "/api/V8Engine/SavePageEngine",
    ValidateLowCodeSystem: "/api/V8Engine/ValidateLowCodeSystem",
    RefreshSchemaCache: "/api/V8Engine/RefreshSchemaCache"
};

const osClient = computed(() => DiyCommon.GetOsClient());
const currentUser = computed(() => diyStore.GetCurrentUser || {});
const aiModelList = ref([]);
const selectedAiModel = ref(null);
const relayModelList = ref([]);
const selectedRelayModel = ref("");
const relayModelsLoading = ref(false);
const modelLoading = ref(false);
const historyLoading = ref(false);
const historyKeyword = ref("");
const historyView = ref("active");
const historyActionLoading = ref("");
const conversations = ref([]);
const messages = ref([]);
const currentConversationId = ref(makeId("chat"));
const currentConversationSource = ref(SOURCE);
const inputText = ref("");
const sending = ref(false);
const messageWrapRef = ref(null);
const fileInputRef = ref(null);
const selectedFiles = ref([]);
const semanticMode = ref("auto");
const reasoningEffort = ref(readSavedReasoningEffort());
const resolvedMode = ref("chat");
const aiSysMenuId = ref("");
const aiModelTableId = ref("");
const aiModelSysMenuId = ref("");
const modelDrawerVisible = ref(false);
const activeWorkspace = ref("chat");
const videoLoading = ref(false);
const videoCreateLoading = ref(false);
const videoActionLoading = ref("");
const videoRows = ref([]);
const videoPlan = ref(null);
const videoQuota = ref(null);
const videoQuotaCheckedAt = ref("");
const videoQuotaError = ref("");
const videoQuotaLoading = ref(false);
const videoPresetOptions = [
    { value: "quality-first", label: "画质优先 · 6 秒 / 1080P / fps 实测", duration: 6, resolution: "1080P" }
];
const videoForm = reactive({
    prompt: "",
    model: "MiniMax-Hailuo-2.3",
    preset: "quality-first",
    duration: 6,
    resolution: "1080P"
});
const videoQuotaTitle = computed(() => {
    if (videoQuotaLoading.value) return "正在从 MiniMax 官方接口读取 Token Plan 用量";
    if (videoQuotaError.value) return "Token Plan 实时用量不可用，已禁止创建新分镜";
    if (videoQuota.value) return "Token Plan 用量已实时回读";
    return "创建前必须先读取 Token Plan 实时用量";
});
const videoQuotaDescription = computed(() => {
    if (videoQuotaError.value) return videoQuotaError.value;
    if (!videoQuota.value) return "套餐采用 5 小时固定窗口与周窗口，不再按本地“每天 3 个”计数判断。";
    const raw = JSON.stringify(videoQuota.value);
    const safeUsage = raw.length > 800 ? `${raw.slice(0, 800)}…` : raw;
    return `${videoQuotaCheckedAt.value || "刚刚"} · ${safeUsage}`;
});
let videoPollTimer = null;
let videoPollBusy = false;
const statsLoading = ref(false);
const platformStats = reactive({
    DiyTableCount: 0,
    SysMenuCount: 0,
    ApiEngineCount: 0,
    UserCount: 0
});
const actionContext = reactive({
    lastTableId: "",
    lastTableName: ""
});
const secureAssistantAvailable = ref(false);
const secureAssistantScopeLabel = ref("当前角色");
const secureAssistantRoleText = ref("已授权用户");
const secureAssistantModels = ref([]);
const secureAssistantRelayModels = ref([]);
const secureAssistantPrompts = ref([]);
const secureAssistantError = ref("");
const secureAssistantFailure = ref(null);
let abortController = null;

const semanticModeOptions = computed(() => [
    { label: "自动识别", value: "auto" },
    { label: "AI对话", value: "chat" },
    {
        label: secureAssistantAvailable.value
            ? "安全业务数据"
            : (secureAssistantFailure.value?.optionLabel || "安全业务数据（未配置）"),
        value: "secure-data",
        disabled: !secureAssistantAvailable.value
    },
    { label: "高级数据查询", value: "data" },
    { label: "低代码建模", value: "builder" }
]);

const reasoningEffortOptions = [
    { label: "模型默认", value: "auto" },
    { label: "低", value: "low" },
    { label: "中", value: "medium" },
    { label: "高", value: "high" }
];

const quickPrompts = computed(() => {
    const securePromptCards = secureAssistantPrompts.value
        .map((text) => String(text || "").trim())
        .filter(Boolean)
        .map((text, index) => ({
            key: `secure-data:${index}:${text}`,
            title: text,
            desc: `查询范围：${secureAssistantScopeLabel.value}`,
            icon: DataAnalysis,
            text,
            mode: "secure-data"
        }));

    return [
        ...securePromptCards,
        {
            key: "builder",
            title: "创建业务模块",
            desc: "生成表、字段、菜单和按钮方案",
            icon: MagicStick,
            text: "帮我创建一个客户跟进管理模块，包含客户、联系人、跟进记录三张表，并生成后台菜单。"
        },
        {
            key: "v8-code",
            title: "编写 V8 代码",
            desc: "根据需求生成接口引擎或表单事件代码",
            icon: Cpu,
            text: "帮我写一个接口引擎，查询最近 30 天新增客户数量，并按天分组返回。"
        },
        {
            key: "data-analysis",
            title: "分析数据",
            desc: "用自然语言查询当前租户数据",
            icon: DataAnalysis,
            text: "帮我分析本月新增数据最多的业务表。"
        }
    ];
});

const filteredConversations = computed(() => {
    const keyword = historyKeyword.value.trim().toLowerCase();
    const archived = historyView.value === "archived";
    return conversations.value.filter((item) => {
        if (Boolean(item.archived) !== archived) return false;
        return !keyword || item.title.toLowerCase().includes(keyword);
    });
});
const activeConversationCount = computed(() => conversations.value.filter((item) => !item.archived).length);
const archivedConversationCount = computed(() => conversations.value.filter((item) => item.archived).length);

const sendDisabled = computed(() => sending.value || (!inputText.value.trim() && selectedFiles.value.length === 0));
const isRelayStationSelected = computed(() => /Microi(?:吾码)?\.?(?:AI)?中转站/i.test(
    `${selectedAiModel.value?.Name || ""} ${selectedAiModel.value?.AiModel || ""}`
));
const selectedRuntimeModelId = computed(() => (
    isRelayStationSelected.value
        ? String(selectedRelayModel.value || "").trim()
        : String(selectedAiModel.value?.AiModel || "").trim()
));
const selectedModelSupportsReasoning = computed(() => {
    const model = selectedAiModel.value || {};
    if (model.SupportReasoning === true || Number(model.SupportReasoning || 0) === 1) return true;
    const modelText = [model.Name, model.AiModel, model.ModelType, model.Provider]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return /(^|[^a-z0-9])(o1|o3|o4)([^a-z0-9]|$)|gpt[-_. ]?5|reason|thinking|deepseek[-_. ]?r1|qwen[-_. ]?3/.test(modelText);
});
const effectiveReasoningEffort = computed(() =>
    selectedModelSupportsReasoning.value && reasoningEffort.value !== "auto"
        ? reasoningEffort.value
        : "auto"
);
const reasoningEffortTooltip = computed(() =>
    selectedModelSupportsReasoning.value
        ? "推理模型可选择低、中、高；模型默认不会额外传递参数。强度越高通常越慢、消耗的推理 Token 越多。"
        : "当前模型未声明推理强度能力，将使用模型默认设置。"
);
const schemaSearchModeLabel = computed(() =>
    Number(selectedAiModel.value?.EnableVectorDatabase || 0) === 1
        ? "Schema 关键词 + 向量"
        : "Schema 关键词"
);
const schemaSearchModeTooltip = computed(() =>
    Number(selectedAiModel.value?.EnableVectorDatabase || 0) === 1
        ? "先由大模型扩展关键词，再检索当前用户有权访问的表和字段；Qdrant 向量召回只作为可选增强，连接失败会安全回退到关键词检索。"
        : "由大模型扩展关键词后，在当前用户有权访问的 Schema 中检索；不会连接或同步 Ollama、Embedding、Qdrant。"
);
const isAiAdmin = computed(() => {
    const user = currentUser.value || {};
    return user._IsAdmin === true || user.IsAdmin === true || Number(user.Level || 0) >= 9999;
});
const workspaceTitle = computed(() => ({
    chat: "AI助手",
    video: "AI视频",
    apps: "AI应用"
}[activeWorkspace.value] || "AI助手"));
const currentUserName = computed(() => {
    const user = currentUser.value || {};
    return user.Name || user.Account || "你";
});
const currentUserAvatar = ref("");
const loadCurrentUserAvatar = async () => {
    const user = currentUser.value || {};
    const avatar = user.Avatar || user.HeadIcon || user.HeadImg || "";
    if (!avatar) {
        currentUserAvatar.value = "";
        return;
    }
    currentUserAvatar.value = "./static/img/loading.gif";
    currentUserAvatar.value = await DiyCommon.GetUserAvatarUrl(avatar, user.Id) || "";
};
const statCards = computed(() => [
    { key: "table", label: "表单数量", value: platformStats.DiyTableCount || 0, desc: "Form Engine" },
    { key: "module", label: "模块数量", value: platformStats.SysMenuCount || 0, desc: "Module Engine" },
    { key: "api", label: "接口引擎", value: platformStats.ApiEngineCount || 0, desc: "API Engine" },
    { key: "user", label: "系统用户", value: platformStats.UserCount || 0, desc: "Users" }
]);

onMounted(async () => {
    if (await redirectLegacyAiAppWorkspace()) return;
    const tasks = [loadAiModels(), loadAiEngineMeta(), loadSecureAssistantBootstrap()];
    if (isAiAdmin.value) tasks.push(loadPlatformStats());
    await Promise.all(tasks);
    await loadHistory();
});

onBeforeUnmount(() => stopVideoPolling());

watch(reasoningEffort, (value) => {
    try {
        window.localStorage.setItem("microi-ai-reasoning-effort", value || "auto");
    } catch {}
});

watch(
    () => [currentUser.value?.Avatar, currentUser.value?.Id],
    () => loadCurrentUserAvatar(),
    { immediate: true }
);

watch(() => [route.query.workspace, route.query.appId], () => {
    redirectLegacyAiAppWorkspace();
});

watch(activeWorkspace, (workspace) => {
    if (workspace === "video") startVideoPolling();
    else stopVideoPolling();
});

watch(selectedAiModel, () => {
    if (!selectedModelSupportsReasoning.value) reasoningEffort.value = "auto";
    if (isRelayStationSelected.value) loadRelayModels();
});

watch(semanticMode, (mode) => {
    if (mode === "secure-data") selectAuthorizedSecureModel();
});

async function loadRelayModels() {
    relayModelsLoading.value = true;
    try {
        // 中转模型是吾码官方公开目录，不依赖当前租户是否已填写中转 ApiKey。
        const response = await fetch("https://api.itdos.com/apiengine/official_ai_relay_models?OsClient=iTdos");
        const json = await response.json();
        if (!response.ok || Number(json?.Code) !== 1) {
            throw new Error(json?.Msg || `HTTP ${response.status}`);
        }
        const rows = Array.isArray(json?.Data) ? json.Data : Array.isArray(json?.Data?.Data) ? json.Data.Data : [];
        relayModelList.value = rows
            .map((item) => ({
                ...item,
                id: String(item?.id || item?.ModelId || "").trim(),
                DisplayName: String(item?.DisplayName || item?.Name || item?.id || item?.ModelId || "").trim()
            }))
            .filter((item) => item.id);
        if (!relayModelList.value.some((item) => item.id === selectedRelayModel.value)) {
            selectedRelayModel.value = relayModelList.value[0]?.id || "";
        }
    } catch (error) {
        relayModelList.value = [];
        ElMessage.warning("中转模型列表加载失败：" + (error?.message || "未知错误"));
    } finally {
        relayModelsLoading.value = false;
    }
}

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowText() {
    const date = new Date();
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function toTimestamp(value) {
    if (!value) return 0;
    const text = String(value).trim();
    const timestamp = Date.parse(text.includes("T") ? text : text.replace(" ", "T"));
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatHistoryTime(value) {
    const timestamp = toTimestamp(value);
    if (!timestamp) return String(value || "");
    const date = new Date(timestamp);
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function modeName(mode) {
    if (mode === "project") return "AI应用";
    const map = {
        auto: "自动识别",
        chat: "AI对话",
        code: "V8 编程",
        "secure-data": "安全业务数据",
        data: "高级数据查询",
        builder: "低代码建模"
    };
    return map[mode] || mode;
}

function readSavedReasoningEffort() {
    try {
        const value = window.localStorage.getItem("microi-ai-reasoning-effort") || "auto";
        return ["auto", "low", "medium", "high"].includes(value) ? value : "auto";
    } catch {
        return "auto";
    }
}

function reasoningEffortName(value) {
    const item = reasoningEffortOptions.find((option) => option.value === value);
    return item ? `推理${item.label}` : "模型默认";
}

function formatModelName(model) {
    if (!model) return "";
    return `${model.Name || model.AiModel || "AI"}${model.AiModel ? ` (${model.AiModel})` : ""}`;
}

function isOk(result) {
    const current = unwrapDosResult(result);
    return current && Number(current.Code ?? current.code) === 1;
}

function getData(result) {
    const current = unwrapDosResult(result);
    return current?.Data || current?.data || [];
}

function unwrapDosResult(result) {
    let current = result || {};
    if (current?.Data && typeof current.Data === "object" && current.Data.Code !== undefined) {
        current = current.Data;
    }
    if (current?.data && typeof current.data === "object" && current.data.Code !== undefined) {
        current = current.data;
    }
    return current;
}

async function loadAiEngineMeta() {
    // 路由元数据由后端按当前用户菜单权限生成，优先使用真实菜单 Id。
    // 普通用户不需要读取受保护的 Sys_Menu/diy_table 元数据；这些查询只服务于
    // 管理员打开“AI 引擎列表”抽屉，避免在线 AI 页面产生无意义的 NoAuth 提示。
    aiSysMenuId.value = String(
        route.meta?.Id
        || route.meta?.id
        || route.meta?.SysMenuId
        || route.meta?.sysMenuId
        || route.query?.SysMenuId
        || route.query?.Id
        || ""
    );
    if (!isAiAdmin.value) return;

    if (!aiSysMenuId.value) {
        await loadAiMenuMeta();
    }
    await loadAiModelTableId();
    await loadAiModelMenuMeta();
}

async function loadAiMenuMeta() {
    try {
        const result = await DiyCommon.FormEngine.GetTableData("Sys_Menu", {
            _Where: [
                ["(", "Url", "=", "/mic-ai-engine"],
                ["OR", "Url", "=", "mic-ai-engine"],
                ["OR", "Name", "=", "AI引擎", ")"]
            ],
            _SelectFields: ["Id", "Name", "Url", "ComponentPath", "PageBtns"],
            _PageSize: 20
        });
        if (!isOk(result)) return;
        const list = getData(result);
        const menu = list.find((item) => String(item.Url || item.ComponentPath || "").includes("mic-ai-engine"))
            || list.find((item) => item.Name === "AI引擎")
            || list.find((item) => item.Name === "AI引擎")
            || list[0];
        aiSysMenuId.value = menu?.Id || "";
    } catch (error) {
        console.warn("[AiEngine] load ai menu meta failed", error);
    }
}

async function loadAiModelTableId() {
    try {
        const result = await DiyCommon.FormEngine.GetFormData("diy_table", {
            _Where: [["Name", "=", "mic_ai"]],
            _SelectFields: ["Id", "Name"]
        });
        if (isOk(result)) {
            aiModelTableId.value = getData(result)?.Id || "";
        }
    } catch (error) {
        console.warn("[AiEngine] load mic_ai table id failed", error);
    }
}

async function loadAiModelMenuMeta() {
    aiModelSysMenuId.value = "";
    if (!aiModelTableId.value) return;
    try {
        const result = await DiyCommon.FormEngine.GetFormData("Sys_Menu", {
            _Where: [["DiyTableId", "=", aiModelTableId.value]],
            _SelectFields: ["Id", "ModuleEngineKey", "DiyTableId"]
        });
        if (!isOk(result)) return;
        const menu = getData(result) || {};
        if (menu.Id && menu.ModuleEngineKey) {
            aiModelSysMenuId.value = menu.Id;
        }
    } catch (error) {
        console.warn("[AiEngine] load mic_ai module menu failed", error);
    }
}

async function loadAiModels() {
    modelLoading.value = true;
    try {
        const query = {
            _Where: [["IsEnable", "=", "1"]],
            // mic_ai 属于平台敏感配置表。在线 AI 只读取公开模型投影，
            // 严禁把 ApiKey、Endpoint、Embedding/Qdrant 凭据下载到浏览器。
            _SelectFields: [
                "Id", "Name", "AiModel", "IsEnable", "IsRelayModel",
                "ModelType", "Provider", "SupportReasoning",
                "EnableVectorDatabase", "CreateTime"
            ],
            _OrderBy: "CreateTime",
            _OrderByType: "DESC",
            _PageSize: 100
        };
        let result = await DiyCommon.FormEngine.GetTableData("mic_ai", query);
        // 极早期数据库可能尚未完成 EnableVectorDatabase 等可选字段升级。
        // 仅回退到更小的公开投影，不回退到“查询全部字段”。
        if (!isOk(result)) {
            result = await DiyCommon.FormEngine.GetTableData("mic_ai", {
                ...query,
                _SelectFields: ["Id", "Name", "AiModel", "IsEnable", "CreateTime"]
            });
        }
        if (isOk(result)) {
            aiModelList.value = getData(result) || [];
            mergeAuthorizedSecureModels();
            if (!selectedAiModel.value && aiModelList.value.length) {
                selectedAiModel.value = aiModelList.value[0];
            }
        } else {
            ElMessage.error(result?.Msg || "加载 AI 模型失败");
        }
    } finally {
        modelLoading.value = false;
    }
}

async function loadSecureAssistantBootstrap(force = false) {
    secureAssistantAvailable.value = false;
    secureAssistantError.value = "";
    secureAssistantFailure.value = null;
    secureAssistantModels.value = [];
    secureAssistantRelayModels.value = [];
    secureAssistantPrompts.value = [];
    if (!currentUser.value?.Id) return;
    try {
        const data = await loadMobileAiBootstrap(DiyCommon, currentUser.value.Id, force);
        secureAssistantModels.value = Array.isArray(data.Models) ? data.Models : [];
        secureAssistantRelayModels.value = Array.isArray(data.RelayModels) ? data.RelayModels : [];
        secureAssistantPrompts.value = (Array.isArray(data.Prompts) ? data.Prompts : [])
            .map((item) => typeof item === "string" ? item : item?.Text || item?.Question || item?.Title || "")
            .map((item) => String(item || "").trim())
            .filter(Boolean);
        secureAssistantScopeLabel.value = String(data.ScopeLabel || "当前角色");
        secureAssistantRoleText.value = String(data.RoleText || "已授权用户");
        const assistantEnabled = data.Enabled === true || Number(data.Enabled) === 1;
        secureAssistantAvailable.value = assistantEnabled && secureAssistantModels.value.length > 0;
        if (!assistantEnabled) {
            secureAssistantFailure.value = makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.unauthorized);
        } else if (!secureAssistantModels.value.length) {
            secureAssistantFailure.value = makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.modelMissing);
        }
        secureAssistantError.value = secureAssistantFailure.value?.description || "";
        mergeAuthorizedSecureModels();
        if (semanticMode.value === "secure-data") selectAuthorizedSecureModel();
    } catch (error) {
        secureAssistantFailure.value = classifyMobileAiBootstrapFailure(error);
        secureAssistantError.value = secureAssistantFailure.value.description;
        secureAssistantAvailable.value = false;
    }
}

function mergeAuthorizedSecureModels() {
    if (!secureAssistantModels.value.length) return;
    const merged = new Map(aiModelList.value.map((item) => [String(item?.Id || ""), item]));
    secureAssistantModels.value.forEach((item) => {
        const id = String(item?.Id || "");
        if (id && !merged.has(id)) merged.set(id, item);
    });
    aiModelList.value = Array.from(merged.values());
}

function selectAuthorizedSecureModel() {
    if (!secureAssistantModels.value.length) return null;
    const selectedId = String(selectedAiModel.value?.Id || "");
    const authorized = secureAssistantModels.value.find((item) => String(item?.Id || "") === selectedId)
        || secureAssistantModels.value[0];
    if (authorized && String(selectedAiModel.value?.Id || "") !== String(authorized.Id || "")) {
        selectedAiModel.value = authorized;
    }
    if (isSecureRelayStation(authorized)) {
        const allowedRelayIds = secureAssistantRelayModels.value
            .map((item) => String(item?.Id || item?.id || ""))
            .filter(Boolean);
        if (!allowedRelayIds.includes(selectedRelayModel.value)) {
            selectedRelayModel.value = allowedRelayIds[0] || "";
        }
    }
    return authorized;
}

function isSecureRelayStation(model) {
    return model?.IsRelayStation === true
        || Number(model?.IsRelayStation || 0) === 1
        || /Microi(?:吾码)?\.?(?:AI)?中转站/i.test(`${model?.Name || ""} ${model?.AiModel || ""}`);
}

async function loadPlatformStats() {
    statsLoading.value = true;
    try {
        const result = await DiyCommon.PostAsync("/api/systemmonitor/GetPlatformStats", {}, null, null, "json");
        if (!isOk(result)) return;
        const data = getData(result) || {};
        platformStats.DiyTableCount = data.DiyTableCount || 0;
        platformStats.SysMenuCount = data.SysMenuCount || 0;
        platformStats.ApiEngineCount = data.ApiEngineCount || 0;
        platformStats.UserCount = data.UserCount || 0;
    } catch (error) {
        console.warn("[AiEngine] load platform stats failed", error);
    } finally {
        statsLoading.value = false;
    }
}

async function loadHistory() {
    historyLoading.value = true;
    try {
        const unified = [];
        const grouped = new Map();
        try {
            const result = await DiyCommon.FormEngine.GetTableData("mic_ai_record", {
                _Where: currentUser.value?.Id ? [["UserId", "=", currentUser.value.Id]] : [],
                _OrderBy: "CreateTime",
                _OrderByType: "DESC",
                _PageSize: 500
            });
            if (isOk(result)) {
                (getData(result) || []).forEach((row) => {
                    const record = parseRecord(row.Content);
                    if (!record || record.Source !== SOURCE || !record.ConversationId) return;
                    record.__rowId = row.Id;
                    record.CreatedAt = record.CreatedAt || row.CreateTime || "";
                    record.Archived = record.Archived === true || Number(record.Archived || 0) === 1;
                    const recordTimestamp = toTimestamp(record.CreatedAt);
                    if (!grouped.has(record.ConversationId)) {
                        grouped.set(record.ConversationId, {
                            id: record.ConversationId,
                            key: `${SOURCE}:${record.ConversationId}`,
                            source: SOURCE,
                            title: record.Title || firstLine(record.Content) || "新对话",
                            lastTime: formatHistoryTime(record.CreatedAt) || record.Time || "",
                            lastTimestamp: recordTimestamp,
                            archived: false,
                            records: []
                        });
                    }
                    const group = grouped.get(record.ConversationId);
                    group.records.push(record);
                    group.archived = group.archived || record.Archived;
                    if (recordTimestamp > group.lastTimestamp) {
                        group.lastTimestamp = recordTimestamp;
                        group.lastTime = formatHistoryTime(record.CreatedAt) || record.Time || "";
                    }
                    if (record.Role === "user" && (!group.title || group.title === "新对话")) {
                        group.title = firstLine(record.Content);
                    }
                });
            }
        } catch (error) {
            console.warn("[AiAssistant] load workbench history failed", error);
        }
        unified.push(...Array.from(grouped.values())
            .map((item) => ({
                ...item,
                records: item.records.sort((a, b) => toTimestamp(a.CreatedAt) - toTimestamp(b.CreatedAt))
            })));

        if (secureAssistantAvailable.value) {
            try {
                const data = await listMobileAiConversations(DiyCommon);
                const secureItems = (Array.isArray(data.Conversations) ? data.Conversations : []).map((item) => ({
                    id: String(item.Id || ""),
                    key: `${SECURE_DATA_SOURCE}:${String(item.Id || "")}`,
                    source: SECURE_DATA_SOURCE,
                    title: item.Title || "安全数据分析",
                    lastTime: formatHistoryTime(item.LastTime || item.UpdateTime || item.CreateTime || ""),
                    lastTimestamp: toTimestamp(item.LastTime || item.UpdateTime || item.CreateTime || ""),
                    archived: item.Archived === true || Number(item.Archived || 0) === 1,
                    messageCount: Number(item.MessageCount || 0),
                    records: null
                })).filter((item) => item.id);
                unified.push(...secureItems);
            } catch (error) {
                console.warn("[AiAssistant] load secure data history failed", error);
            }
        }
        conversations.value = unified.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    } finally {
        historyLoading.value = false;
    }
}

function parseRecord(content) {
    if (!content) return null;
    try {
        return typeof content === "string" ? JSON.parse(content) : content;
    } catch {
        return null;
    }
}

function firstLine(text) {
    return String(text || "")
        .split(/\r?\n/)
        .find(Boolean)
        ?.slice(0, 36) || "新对话";
}

function newConversation() {
    cancelRequest();
    historyView.value = "active";
    const secureMode = semanticMode.value === "secure-data";
    currentConversationSource.value = secureMode ? SECURE_DATA_SOURCE : SOURCE;
    currentConversationId.value = secureMode ? "" : makeId("chat");
    messages.value = [];
    inputText.value = "";
    selectedFiles.value = [];
    actionContext.lastTableId = "";
    actionContext.lastTableName = "";
}

function isCurrentConversation(item) {
    return String(item?.id || "") === String(currentConversationId.value || "")
        && String(item?.source || SOURCE) === String(currentConversationSource.value || SOURCE);
}

async function setConversationArchived(item, archived) {
    if (!item?.id || historyActionLoading.value) return;
    if (item.source === SECURE_DATA_SOURCE) {
        historyActionLoading.value = item.id;
        try {
            await setMobileAiConversationArchived(DiyCommon, item.id, archived);
            if (archived && isCurrentConversation(item)) newConversation();
            await loadHistory();
            ElMessage.success(archived ? "对话已归档" : "对话已还原");
        } catch (error) {
            ElMessage.error(`${archived ? "归档" : "还原"}失败：${error?.message || "未知错误"}`);
        } finally {
            historyActionLoading.value = "";
        }
        return;
    }
    const records = (item.records || []).filter((record) => record.__rowId);
    if (!records.length) {
        ElMessage.warning("该对话暂无可归档记录");
        return;
    }
    historyActionLoading.value = item.id;
    try {
        const results = await Promise.all(records.map((record) => {
            const { __rowId, ...content } = record;
            return DiyCommon.FormEngine.UptFormData("mic_ai_record", {
                Id: __rowId,
                Content: JSON.stringify({ ...content, Archived: archived })
            });
        }));
        const failed = results.find((result) => !isOk(result));
        if (failed) throw new Error(unwrapDosResult(failed)?.Msg || "保存失败");
        await loadHistory();
        ElMessage.success(archived ? "对话已归档" : "对话已还原");
    } catch (error) {
        ElMessage.error(`${archived ? "归档" : "还原"}失败：${error?.message || "未知错误"}`);
    } finally {
        historyActionLoading.value = "";
    }
}

async function editConversationTitle(item) {
    if (!item?.id || historyActionLoading.value) return;

    try {
        const { value } = await ElMessageBox.prompt("请输入新的对话标题", "修改标题", {
            confirmButtonText: "保存",
            cancelButtonText: "取消",
            inputValue: item.title || "",
            inputPlaceholder: "请输入对话标题",
            inputValidator: (text) => {
                const title = String(text || "").trim();
                if (!title) return "标题不能为空";
                if (title.length > 60) return "标题不能超过 60 个字符";
                return true;
            }
        });
        const title = String(value || "").trim();
        if (!title || title === item.title) return;

        historyActionLoading.value = item.id;
        if (item.source === SECURE_DATA_SOURCE) {
            await renameMobileAiConversation(DiyCommon, item.id, title);
        } else {
            const result = await DiyCommon.PostAsync("/api/Ai/UpdateConversationTitle", {
                ConversationId: item.id,
                Title: title,
                Source: SOURCE
            }, null, null, "json");
            if (!isOk(result)) throw new Error(unwrapDosResult(result)?.Msg || "保存失败");
        }
        await loadHistory();
        ElMessage.success("标题已修改");
    } catch (error) {
        if (error === "cancel" || error === "close" || error?.action === "cancel" || error?.action === "close") return;
        ElMessage.error(`修改标题失败：${error?.message || "未知错误"}`);
    } finally {
        historyActionLoading.value = "";
    }
}

async function selectConversation(item) {
    cancelRequest();
    currentConversationId.value = item.id;
    currentConversationSource.value = item.source || SOURCE;
    selectedFiles.value = [];
    if (item.source === SECURE_DATA_SOURCE) {
        semanticMode.value = "secure-data";
        historyLoading.value = true;
        try {
            const data = await listMobileAiMessages(DiyCommon, item.id);
            messages.value = normalizeMobileAiMessages(data).map((record) => ({
                id: record.id,
                role: record.role,
                mode: "secure-data",
                content: record.text,
                rawContent: record.text,
                thinking: Array.isArray(record.thinking) ? record.thinking.join("\n\n") : "",
                thinkingCollapsed: true,
                streaming: false,
                error: "",
                code: "",
                actions: [],
                queryRows: [],
                attachments: [],
                modelId: "",
                reasoningEffort: "auto",
                time: record.time || ""
            }));
            scrollToBottom();
        } catch (error) {
            ElMessage.error(error?.message || "安全数据对话加载失败");
        } finally {
            historyLoading.value = false;
        }
        return;
    }
    if (semanticMode.value === "secure-data") semanticMode.value = "auto";
    messages.value = (item.records || []).map((record) => {
        const role = record.Role || "assistant";
        const content = normalizeLoadedMessageContent(record, role);
        return {
            id: record.Id || makeId("msg"),
            role,
            mode: record.Mode || "chat",
            content,
            rawContent: record.RawContent || record.Content || content || "",
            thinking: record.Thinking || "",
            thinkingCollapsed: true,
            streaming: false,
            error: record.Error || "",
            code: record.Code || "",
            actions: hydrateMcpActions(record.Actions || []),
            queryRows: record.QueryRows || [],
            attachments: record.Attachments || [],
            modelId: record.ModelId || record.AiModel || "",
            reasoningEffort: record.ReasoningEffort || "auto",
            time: record.Time || ""
        };
    });
    scrollToBottom();
}

function normalizeLoadedMessageContent(record, role) {
    const content = record?.Content || "";
    if (content) return content;
    if (role !== "assistant") return "";
    if (record?.Error) return `AI请求失败：${record.Error}`;
    if (record?.Msg) return `AI请求失败：${record.Msg}`;
    if (record?.Code || record?.Thinking || (record?.Actions || []).length || (record?.QueryRows || []).length) return "";
    return "该次 AI 响应异常结束，未返回可显示内容。";
}

function useQuickPrompt(prompt) {
    inputText.value = prompt.text;
    if (prompt.mode) semanticMode.value = prompt.mode;
}

function handleEnter(event) {
    if (event.shiftKey) return;
    event.preventDefault();
    sendMessage();
}

function cancelRequest() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    sending.value = false;
}

function triggerAttachmentPicker() {
    fileInputRef.value?.click();
}

function handleAttachmentChange(event) {
    const files = Array.from(event.target.files || []);
    const merged = [...selectedFiles.value, ...files].slice(0, 10);
    selectedFiles.value = merged;
    event.target.value = "";
}

function removeAttachment(index) {
    selectedFiles.value.splice(index, 1);
}

async function openModelDrawer() {
    if (!isAiAdmin.value) {
        ElMessage.warning("只有管理员可以查看 AI引擎列表");
        return;
    }
    if (!aiModelTableId.value) {
        await loadAiModelTableId();
    }
    if (!aiModelSysMenuId.value) {
        await loadAiModelMenuMeta();
    }
    if (!aiModelSysMenuId.value) {
        ElMessage.warning("mic_ai 尚未绑定包含 ModuleEngineKey 的模块引擎菜单");
    }
    modelDrawerVisible.value = true;
}

function goMicroiStore() {
    proxy.$router.push({ path: "/microi-store" });
}

function goAiApps() {
    proxy.$router.push({ path: "/mci-ai-app" });
}

async function openVideoWorkspace() {
    if (!isAiAdmin.value) {
        ElMessage.warning("只有管理员可以创建和管理 AI 视频");
        return;
    }
    activeWorkspace.value = "video";
    await Promise.all([loadVideoPlan(), loadVideoRecords(), refreshMiniMaxQuota(true)]);
}

async function refreshMiniMaxQuota(silent = false) {
    if (!isAiAdmin.value || videoQuotaLoading.value) return !!videoQuota.value;
    videoQuotaLoading.value = true;
    try {
        const result = await DiyCommon.GetAsync("/api/Ai/GetMiniMaxTokenPlanRemains", {});
        if (!isOk(result)) throw new Error(unwrapDosResult(result)?.Msg || "MiniMax Token Plan 用量查询失败");
        const data = getData(result) || {};
        videoQuota.value = data.Usage || data;
        videoQuotaCheckedAt.value = data.CheckedAtUtc
            ? new Date(data.CheckedAtUtc).toLocaleString()
            : new Date().toLocaleString();
        videoQuotaError.value = "";
        if (!silent) ElMessage.success("已从 MiniMax 官方接口实时回读套餐用量");
        return true;
    } catch (error) {
        videoQuota.value = null;
        videoQuotaCheckedAt.value = "";
        videoQuotaError.value = String(error?.message || "MiniMax Token Plan 用量查询失败");
        if (!silent) ElMessage.error(videoQuotaError.value);
        return false;
    } finally {
        videoQuotaLoading.value = false;
    }
}

async function loadVideoPlan() {
    if (videoPlan.value?.Id) return videoPlan.value;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("mci_ai_content_plan", {
            _Where: [["Enabled", "=", 1]],
            _OrderBy: "CreateTime",
            _OrderByType: "ASC",
            _PageSize: 1
        });
        if (isOk(result)) videoPlan.value = (getData(result) || [])[0] || null;
    } catch (error) {
        console.warn("[AiVideo] load content plan failed", error);
    }
    return videoPlan.value;
}

async function loadVideoRecords() {
    if (!isAiAdmin.value) return;
    videoLoading.value = true;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("mci_ai_content_asset", {
            _Where: [["AssetType", "In", ["VideoClip", "VideoMaster", "Video", "AudioDialogue", "AudioMusic"]]],
            _OrderBy: "CreateTime",
            _OrderByType: "DESC",
            _PageSize: 200
        });
        if (!isOk(result)) throw new Error(unwrapDosResult(result)?.Msg || "视频记录读取失败");
        videoRows.value = Array.isArray(getData(result)) ? getData(result) : [];
    } catch (error) {
        videoRows.value = [];
        ElMessage.warning("AI 视频记录不可用：请先安装或升级官方 AI 内容运营应用。" + (error?.message ? `（${error.message}）` : ""));
    } finally {
        videoLoading.value = false;
    }
}

function readCreatedId(result) {
    const data = getData(result);
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return String(data[0]?.Id || data[0]?.id || "");
    return String(data?.Id || data?.id || data?.Data?.Id || "");
}

async function readRowIdByField(tableName, fieldName, value) {
    const result = await DiyCommon.FormEngine.GetFormData(tableName, {
        _Where: [[fieldName, "=", value]],
        _SelectFields: ["Id"]
    });
    return isOk(result) ? String(getData(result)?.Id || "") : "";
}

function localDatePrefix() {
    const date = new Date();
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function applyVideoPreset(value) {
    const preset = videoPresetOptions.find((option) => option.value === value) || videoPresetOptions[0];
    videoForm.duration = preset.duration;
    videoForm.resolution = preset.resolution;
}

async function createMiniMaxVideo() {
    const prompt = String(videoForm.prompt || "").trim();
    if (prompt.length < 10) {
        ElMessage.warning("视频提示词至少需要 10 个字符");
        return;
    }
    const todayCount = videoRows.value.filter((row) => (
        ["VideoClip", "Video"].includes(String(row.AssetType || ""))
        && String(row.CreateTime || "").startsWith(localDatePrefix())
    )).length;
    videoCreateLoading.value = true;
    let assetId = "";
    try {
        if (!await refreshMiniMaxQuota(true)) {
            throw new Error("无法实时确认 MiniMax Token Plan 用量，已按失败关闭策略停止创建");
        }
        const plan = await loadVideoPlan();
        if (!plan?.Id) throw new Error("未找到启用的 AI 内容计划，请先安装或启用官方 AI 内容运营应用");

        const unique = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
        const slotKey = `manual-video:${unique}`;
        const assetKey = `manual-video-asset:${unique}`;
        const requestId = `manual-video:${unique}`;
        const contentResult = await DiyCommon.FormEngine.AddFormData("mci_ai_content_item", {
            SlotKey: slotKey,
            PlanId: plan.Id,
            Title: prompt.slice(0, 120),
            Angle: "MiniMax 画质优先档（6 秒 / 1080P，fps 以媒体探针实测）；分镜只能用于合成唯一带对白与配乐的 VideoMaster。",
            ContentType: "Video",
            Status: "Queued",
            AiModel: videoForm.model,
            Summary: prompt,
            QualityScore: 0,
            QualityStatus: "Pending"
        });
        if (!isOk(contentResult)) throw new Error(unwrapDosResult(contentResult)?.Msg || "视频内容记录创建失败");
        const contentId = readCreatedId(contentResult)
            || await readRowIdByField("mci_ai_content_item", "SlotKey", slotKey);
        if (!contentId) throw new Error("视频内容记录写入后回读失败");

        const assetResult = await DiyCommon.FormEngine.AddFormData("mci_ai_content_asset", {
            AssetKey: assetKey,
            ContentId: contentId,
            AssetType: "VideoClip",
            Platform: "AllVideoPlatforms",
            SequenceNo: todayCount + 1,
            Prompt: prompt,
            Model: videoForm.model,
            Duration: videoForm.duration,
            Resolution: videoForm.resolution,
            Status: "Draft",
            ReviewStatus: "Pending",
            QualityScore: 0
        });
        if (!isOk(assetResult)) throw new Error(unwrapDosResult(assetResult)?.Msg || "视频资产记录创建失败");
        assetId = readCreatedId(assetResult)
            || await readRowIdByField("mci_ai_content_asset", "AssetKey", assetKey);
        if (!assetId) throw new Error("视频资产写入后回读失败");

        const createResult = await DiyCommon.PostAsync("/api/Ai/CreateMiniMaxVideo", {
            RequestId: requestId,
            Prompt: prompt,
            Model: videoForm.model,
            Duration: videoForm.duration,
            Resolution: videoForm.resolution
        }, null, null, "json");
        if (!isOk(createResult)) throw new Error(unwrapDosResult(createResult)?.Msg || "MiniMax 视频任务创建失败");
        const created = getData(createResult) || {};
        const updateResult = await DiyCommon.FormEngine.UptFormData("mci_ai_content_asset", {
            Id: assetId,
            MiniMaxTaskHandle: created.TaskHandle || "",
            Model: created.Model || videoForm.model,
            Duration: created.Duration || videoForm.duration,
            Resolution: created.Resolution || videoForm.resolution,
            Status: created.Status || "Queueing",
            ReviewStatus: "Pending",
            QualityScore: 0,
            QualityReview: "VideoClip 分镜任务已提交。生成成功后转存当前租户 HDFS；分镜不得单独发布，必须合成唯一带声 VideoMaster 后再验片发布。"
        });
        if (!isOk(updateResult)) throw new Error(unwrapDosResult(updateResult)?.Msg || "视频任务已创建，但记录更新失败");
        videoForm.prompt = "";
        await loadVideoRecords();
        ElMessage.success(created.Replayed === true ? "已回放同一幂等视频任务" : "MiniMax 视频任务已创建");
        startVideoPolling();
    } catch (error) {
        if (assetId) {
            try {
                await DiyCommon.FormEngine.UptFormData("mci_ai_content_asset", {
                    Id: assetId,
                    Status: "Failed",
                    QualityReview: String(error?.message || "MiniMax 视频任务创建失败").slice(0, 1000)
                });
            } catch {}
        }
        await loadVideoRecords();
        ElMessage.error("创建视频失败：" + (error?.message || "未知错误"));
    } finally {
        videoCreateLoading.value = false;
    }
}

async function refreshVideoRecord(row, silent = false) {
    if (!row?.Id || !row.MiniMaxTaskHandle || videoActionLoading.value) return;
    videoActionLoading.value = row.Id;
    try {
        const taskResult = await DiyCommon.PostAsync("/api/Ai/GetMiniMaxVideoTask", {
            TaskHandle: row.MiniMaxTaskHandle
        }, null, null, "json");
        if (!isOk(taskResult)) throw new Error(unwrapDosResult(taskResult)?.Msg || "视频任务查询失败");
        const task = getData(taskResult) || {};
        const status = String(task.Status || "Unknown");
        if (status !== "Success") {
            const update = await DiyCommon.FormEngine.UptFormData("mci_ai_content_asset", {
                Id: row.Id,
                Status: status === "Fail" ? "Failed" : status,
                QualityReview: status === "Fail"
                    ? String(task.FailureReason || "MiniMax 视频生成失败")
                    : String(row.QualityReview || "视频仍在生成中。")
            });
            if (!isOk(update)) throw new Error(unwrapDosResult(update)?.Msg || "视频状态保存失败");
            if (!silent) ElMessage.info(status === "Fail" ? "视频生成失败" : `当前状态：${videoStatusLabel(status)}`);
            await loadVideoRecords();
            return;
        }
        if (!task.FileHandle) throw new Error("MiniMax 已成功但没有返回文件句柄");

        let fileUrl = "";
        let permanent = false;
        const persistResult = await DiyCommon.PostAsync("/api/Ai/PersistMiniMaxVideoFile", {
            FileHandle: task.FileHandle
        }, null, null, "json");
        if (isOk(persistResult)) {
            const persisted = getData(persistResult) || {};
            fileUrl = String(persisted.FileUrl || "");
            permanent = Boolean(persisted.Permanent);
        }
        if (!fileUrl) {
            const fileResult = await DiyCommon.PostAsync("/api/Ai/GetMiniMaxVideoFile", {
                FileHandle: task.FileHandle
            }, null, null, "json");
            if (!isOk(fileResult)) throw new Error(unwrapDosResult(fileResult)?.Msg || "视频下载地址读取失败");
            fileUrl = String((getData(fileResult) || {}).DownloadUrl || "");
        }
        if (!fileUrl) throw new Error("视频文件地址为空");

        const update = await DiyCommon.FormEngine.UptFormData("mci_ai_content_asset", {
            Id: row.Id,
            MiniMaxFileHandle: task.FileHandle,
            FileUrl: fileUrl,
            Status: "ReviewRequired",
            ReviewStatus: "Pending",
            QualityScore: 0,
            QualityReview: permanent
                ? "视频已转存 Microi HDFS。发布前请检查叙事、字幕/声音、墙面文字、人脸、手部、广告感和实际信息价值。"
                : "当前仅保存 MiniMax 临时地址，请尽快转存 HDFS；未验片不得发布。"
        });
        if (!isOk(update)) throw new Error(unwrapDosResult(update)?.Msg || "视频文件记录保存失败");
        await loadVideoRecords();
        if (!silent) ElMessage.success(permanent ? "视频已生成并转存 HDFS" : "视频已生成，请尽快转存 HDFS");
    } catch (error) {
        if (!silent) ElMessage.error("刷新视频失败：" + (error?.message || "未知错误"));
    } finally {
        videoActionLoading.value = "";
    }
}

async function approveVideoRecord(row) {
    if (!row?.Id || !row.FileUrl) return;
    const assetType = String(row.AssetType || "");
    const reviewText = assetType === "VideoMaster"
        ? "管理员已完成唯一母版的画面、对白、字幕、配乐与媒体探针审核；可进入支持视频的平台发布流程。"
        : assetType === "VideoClip" || assetType === "Video"
            ? "管理员已完成分镜验片；该文件只能作为唯一 VideoMaster 的输入，禁止单独发布。"
            : "管理员已完成音轨试听；该文件只能作为唯一 VideoMaster 的混音输入，禁止单独发布。";
    const result = await DiyCommon.FormEngine.UptFormData("mci_ai_content_asset", {
        Id: row.Id,
        Status: "Approved",
        ReviewStatus: "Approved",
        QualityScore: 100,
        QualityReview: reviewText
    });
    if (!isOk(result)) {
        ElMessage.error(unwrapDosResult(result)?.Msg || "验片状态保存失败");
        return;
    }
    await loadVideoRecords();
    ElMessage.success("已标记为验片通过");
}

function downloadVideo(row) {
    const url = String(row?.FileUrl || "");
    if (!/^https:\/\//i.test(url)) {
        ElMessage.warning("资产地址不是可下载的 HTTPS 地址");
        return;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function videoStatusLabel(status) {
    return ({
        Draft: "待生成",
        Preparing: "准备中",
        Queueing: "排队中",
        Processing: "生成中",
        ReviewRequired: "待验片",
        Approved: "已通过",
        Rejected: "已拒绝",
        Failed: "失败",
        Fail: "失败",
        Unknown: "未知"
    })[String(status || "")] || String(status || "未知");
}

function videoStatusType(status) {
    if (status === "Approved") return "success";
    if (["Failed", "Fail", "Rejected"].includes(String(status || ""))) return "danger";
    if (status === "ReviewRequired") return "warning";
    return "info";
}

function startVideoPolling() {
    stopVideoPolling();
    if (activeWorkspace.value !== "video") return;
    videoPollTimer = window.setInterval(async () => {
        if (videoPollBusy || activeWorkspace.value !== "video") return;
        const pending = videoRows.value.filter((row) => row.MiniMaxTaskHandle
            && ["Preparing", "Queueing", "Processing"].includes(String(row.Status || "")));
        if (!pending.length) return;
        videoPollBusy = true;
        try {
            for (const row of pending.slice(0, 3)) await refreshVideoRecord(row, true);
        } finally {
            videoPollBusy = false;
        }
    }, 15000);
}

function stopVideoPolling() {
    if (videoPollTimer) window.clearInterval(videoPollTimer);
    videoPollTimer = null;
}

async function redirectLegacyAiAppWorkspace() {
    const appId = String(route.query.appId || "").trim();
    if (appId) {
        await proxy.$router.replace({ name: "mic_ai_app_detail", params: { appId } });
        return true;
    }
    if (route.query.workspace === "apps") {
        await proxy.$router.replace({ path: "/mci-ai-app" });
        return true;
    }
    return false;
}

async function sendMessage() {
    const text = inputText.value.trim();
    if (sendDisabled.value) return;
    if (!selectedAiModel.value?.Id || !selectedRuntimeModelId.value) {
        ElMessage.warning("请先选择 AI 模型");
        return;
    }

    const files = selectedFiles.value.slice(0, 10);
    const attachmentMeta = files.map((file) => ({
        FileName: file.name,
        ContentType: file.type || "application/octet-stream",
        Size: file.size
    }));
    const visibleText = text || "请分析我上传的附件。";
    const provisionalMode = normalizeWorkMode(semanticMode.value) || "auto";

    const userMessage = reactive({
        id: makeId("user"),
        role: "user",
        mode: provisionalMode,
        content: visibleText,
        rawContent: visibleText,
        attachments: attachmentMeta,
        modelId: selectedRuntimeModelId.value,
        reasoningEffort: effectiveReasoningEffort.value,
        time: nowText()
    });
    messages.value.push(userMessage);
    inputText.value = "";
    selectedFiles.value = [];
    sending.value = true;
    scrollToBottom();

    const assistantMessage = reactive({
        id: makeId("ai"),
        role: "assistant",
        mode: provisionalMode,
        content: "",
        rawContent: "",
        thinking: "正在分析语义并准备回答...",
        thinkingCollapsed: false,
        streaming: true,
        code: "",
        actions: [],
        queryRows: [],
        attachments: [],
        modelId: selectedRuntimeModelId.value,
        reasoningEffort: effectiveReasoningEffort.value,
        time: nowText()
    });
    messages.value.push(assistantMessage);
    scrollToBottom();
    await nextTick();

    let userSaved = false;
    let persistedBySecureAssistant = false;
    try {
        const attachmentPayload = await readAttachments(files);
        const mode = await resolveSemanticMode(text, attachmentPayload);
        resolvedMode.value = mode;
        userMessage.mode = mode;
        assistantMessage.mode = mode;
        assistantMessage.thinking = "正在组织回答...";
        switchConversationSourceForMode(mode);
        if (mode === "secure-data") {
            persistedBySecureAssistant = true;
        } else {
            await saveMessage(userMessage);
            userSaved = true;
        }

        const deniedText = getModePermissionDeniedText(mode);
        if (deniedText) {
            assistantMessage.content = deniedText;
            assistantMessage.rawContent = deniedText;
            assistantMessage.thinking = "";
            assistantMessage.thinkingCollapsed = true;
            return;
        }

        if (mode === "secure-data") {
            await sendSecureDataQuestion(visibleText, assistantMessage);
        } else if (mode === "code") {
            await sendCodeQuestion(visibleText, assistantMessage);
        } else if (mode === "data") {
            await sendDataQuestion(visibleText, assistantMessage);
        } else if (mode === "project") {
            await sendProjectQuestion(visibleText, assistantMessage);
        } else if (mode === "builder") {
            await sendBuilderQuestion(visibleText, assistantMessage, attachmentPayload);
        } else {
            await sendChatQuestion(visibleText, assistantMessage, attachmentPayload);
        }
    } catch (error) {
        if (error?.name === "AbortError") {
            assistantMessage.content = assistantMessage.content || "已停止";
        } else {
            assistantMessage.content = error?.message || "AI 请求失败";
            assistantMessage.error = assistantMessage.content;
            ElMessage.error(assistantMessage.content);
        }
    } finally {
        if (assistantMessage && !assistantMessage.content && !assistantMessage.thinking && !assistantMessage.code) {
            assistantMessage.content = "AI 暂无可显示内容，请稍后重试或切换模型。";
        }
        assistantMessage.streaming = false;
        if (!persistedBySecureAssistant) {
            if (!userSaved) {
                await saveMessage(userMessage);
            }
            await saveMessage(assistantMessage);
            refreshCurrentConversationTitle(userMessage);
        } else {
            await loadHistory();
        }
        sending.value = false;
        abortController = null;
        scrollToBottom();
    }
}

function normalizeWorkMode(mode) {
    const value = String(mode || "").trim().toLowerCase();
    const map = {
        auto: "auto",
        自动识别: "auto",
        chat: "chat",
        ai对话: "chat",
        对话: "chat",
        data: "data",
        数据分析: "data",
        "secure-data": "secure-data",
        securedata: "secure-data",
        安全业务数据: "secure-data",
        安全数据分析: "secure-data",
        nl2sql: "data",
        高级数据查询: "data",
        builder: "builder",
        lowcode: "builder",
        低代码建模: "builder",
        code: "code",
        v8: "code",
        project: "project",
        ai应用: "project",
        app: "project"
    };
    return map[value] || "";
}

function buildIntentAttachmentSummary(attachments = []) {
    return (attachments || []).map((item) => ({
        FileName: item.FileName,
        ContentType: item.ContentType,
        Size: item.Size,
        Text: item.Text ? String(item.Text).slice(0, 1000) : ""
    }));
}

async function resolveSemanticMode(text, attachments = []) {
    const manualMode = normalizeWorkMode(semanticMode.value);
    if (manualMode && manualMode !== "auto") {
        return manualMode;
    }
    try {
        const result = await DiyCommon.PostAsync("/api/Ai/RecognizeIntent", {
            UserChatMsg: text || "请分析我上传的附件。",
            AiModel: selectedRuntimeModelId.value,
            AiModelId: selectedAiModel.value?.Id || "",
            RelayModel: isRelayStationSelected.value ? selectedRelayModel.value : "",
            OsClient: osClient.value,
            ConversationId: currentConversationId.value,
            Source: SOURCE,
            Attachments: buildIntentAttachmentSummary(attachments)
        }, null, null, "json");
        if (isOk(result)) {
            const data = getData(result) || {};
            const mode = normalizeWorkMode(data.Mode || data.mode);
            if (mode && mode !== "auto") {
                return mode === "data" && secureAssistantAvailable.value ? "secure-data" : mode;
            }
        }
        console.warn("[AiEngine] intent recognition returned invalid result", result);
    } catch (error) {
        console.warn("[AiEngine] intent recognition failed", error);
    }
    ElMessage.warning("语义分析暂时不可用，已按 AI对话处理。");
    return "chat";
}

function validateModePermission(mode) {
    if (mode === "data" && !hasAiPermission(AI_DATA_PERMISSION)) {
        ElMessage.warning("当前角色未配置 AI 数据分析权限");
        return false;
    }
    if ((mode === "builder" || mode === "project") && !hasAiPermission(AI_BUILDER_PERMISSION)) {
        ElMessage.warning("当前角色未配置低代码建模权限");
        return false;
    }
    return true;
}

function getModePermissionDeniedText(mode) {
    if (mode === "secure-data" && !secureAssistantAvailable.value) {
        return secureAssistantError.value || "当前角色尚未配置安全业务数据权限，请联系管理员配置 AI 数据策略。";
    }
    if (mode === "data" && !hasAiPermission(AI_DATA_PERMISSION)) {
        return "当前角色未配置 AI 数据分析权限，请联系管理员在角色权限中授权后再使用。";
    }
    if ((mode === "builder" || mode === "project") && !isAiAdmin.value) {
        return "当前账号没有低代码建模权限。为避免误操作创建或修改表、字段、菜单、接口引擎，只有管理员可以执行该能力。";
    }
    return "";
}

function switchConversationSourceForMode(mode) {
    const targetSource = mode === "secure-data" ? SECURE_DATA_SOURCE : SOURCE;
    if (currentConversationSource.value === targetSource) return;
    currentConversationSource.value = targetSource;
    currentConversationId.value = targetSource === SECURE_DATA_SOURCE ? "" : makeId("chat");
    // 一个会话只能由一个后端事实源负责持久化。切换安全边界时保留本次待发送消息，
    // 旧会话仍可从左侧历史继续打开，避免跨来源记录重复或串线。
    messages.value = messages.value.slice(-2);
}

function hasAiPermission(permission) {
    if (isAiAdmin.value || isSuperUser()) return true;
    if (!aiSysMenuId.value) return false;
    const limits = currentUser.value?._RoleLimits || [];
    return limits.some((limit) => {
        const menuId = limit.FkId || limit.SysMenuId || limit.MenuId;
        if (String(menuId || "") !== String(aiSysMenuId.value)) return false;
        const list = normalizePermission(limit.Permission);
        return list.includes(permission.id) || list.includes(permission.name);
    });
}

function isSuperUser() {
    const user = currentUser.value || {};
    const level = Number(user.Level || 0);
    return user.IsAdmin === true
        || user._IsAdmin === true
        || level >= 9999;
}

function normalizePermission(permission) {
    if (Array.isArray(permission)) return permission;
    if (typeof permission !== "string") return [];
    try {
        const parsed = JSON.parse(permission);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return permission.split(",").map((item) => item.trim()).filter(Boolean);
    }
}

async function readAttachments(files = selectedFiles.value.slice(0, 10)) {
    const payload = [];
    for (const file of files) {
        const contentType = file.type || "application/octet-stream";
        const item = {
            FileName: file.name,
            ContentType: contentType,
            Size: file.size
        };
        if (contentType.startsWith("image/")) {
            item.FileByteBase64 = await fileToDataUrl(file);
        } else if (isTextFile(file) && file.size <= 512 * 1024) {
            item.Text = await file.text();
        } else {
            item.Text = `附件：${file.name}，类型：${contentType}，大小：${formatFileSize(file.size)}。当前前端仅发送图片和 512KB 内文本文件的完整内容。`;
        }
        payload.push(item);
    }
    return payload;
}

function isTextFile(file) {
    const type = file.type || "";
    const name = file.name.toLowerCase();
    return type.startsWith("text/")
        || /\.(txt|md|json|csv|xml|yaml|yml|js|ts|vue|cs|sql|log)$/i.test(name);
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function formatFileSize(size) {
    if (!size) return "0B";
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function queryResultMaxHeight(rows) {
    const count = Array.isArray(rows) ? rows.length : 0;
    if (count <= 2) return undefined;
    return Math.min(420, 54 + count * 42);
}

function buildDataThinkingSummary(data, question) {
    const lines = [
        "已识别为数据分析请求。",
        "判断依据：用户询问当前系统内的数量、统计或数据概况，需要读取租户数据库中的业务/系统表。"
    ];
    if (question) lines.push(`用户问题：${question}`);
    if (data?.Source) lines.push(`数据源策略：${data.Source}`);
    if (data?.SchemaSearchMode) {
        lines.push(
            `Schema 检索：${
                data.SchemaSearchMode === "hybrid-vector"
                    ? "大模型关键词扩展 + 关键词/向量融合"
                    : "大模型关键词扩展 + 权限内关键词检索"
            }。`
        );
    }
    if (Number.isFinite(Number(data?.SchemaCandidateCount))) {
        lines.push(`候选范围：权限过滤后命中 ${Number(data.SchemaCandidateCount)} 张候选表。`);
    }
    if (data?.GeneratedSQL) lines.push(`执行方式：生成只读 SELECT 语句并在服务端受控执行。`);
    const count = Array.isArray(data?.QueryResult) ? data.QueryResult.length : 0;
    lines.push(`结果处理：返回 ${count} 条结果用于前端表格展示，同时生成自然语言回答。`);
    return lines.join("\n");
}

function buildSystemPrompt(mode) {
    const modelName = selectedAiModel.value?.Name || "";
    const modelKey = selectedRuntimeModelId.value;
    const lines = [
        "你是平台内置 AI 助手。",
        `当前租户：${osClient.value}。`,
        `运行态模型信息：Name=${modelName || modelKey}，Id=${modelKey}。`,
        "涉及当前会话、模型、租户等运行态信息时，以运行态上下文为准，不要编造成业务数据查询结果。",
        "普通聊天只能做常规问答、附件理解、安全的数据分析建议，不要把普通聊天伪装成 SQL 查询结果。"
    ];
    if (mode === "builder") {
        lines.push("低代码建模必须先输出可核对方案；涉及写入平台时只输出可人工确认的 MCP 动作，不要声称已经执行。");
    }
    if (mode === "code") {
        lines.push("V8 编程回答要遵守平台 V8 API、参数化查询、多语言和性能规范。");
    }
    return lines.join("\n");
}

async function sendChatQuestion(text, assistantMessage, attachments = []) {
    await sendChatStream({
        UserChatMsg: text,
        SystemChatMsg: buildSystemPrompt("chat"),
        AiModel: selectedRuntimeModelId.value,
        AiModelId: selectedAiModel.value.Id || "",
        OsClient: osClient.value,
        Attachments: attachments,
        ConversationId: currentConversationId.value,
        Source: SOURCE,
        Mode: "chat",
        ReasoningEffort: effectiveReasoningEffort.value
    }, assistantMessage);
}

async function sendProjectQuestion(text, assistantMessage) {
    const appType = inferProjectType(text);
    const appName = inferProjectName(text, appType);
    const result = await DiyCommon.ApiEngine.Run("ai_app_create", {
        OsClient: osClient.value,
        AppType: appType,
        Name: appName,
        Description: text,
        WithStarter: true
    });
    if (!isOk(result)) throw new Error(unwrapDosResult(result)?.Msg || "AI应用创建失败");
    const data = getData(result) || {};
    assistantMessage.content = [
        `已创建 ${appType} AI应用：${data.Name || appName}`,
        `应用Id：${data.Id || ""}`,
        `已生成源码文件：${Array.isArray(data.Files) ? data.Files.length : 0} 个`,
        "已自动切换到【AI应用】，你可以查看源码树、编辑文件并运行预览。"
    ].join("\n");
    activeWorkspace.value = "apps";
}

function inferProjectType(text) {
    return /(uniapp|uni-app|移动端|小程序|app|安卓|ios)/i.test(text || "") ? "UniApp" : "Web";
}

function inferProjectName(text, projectType) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    const match = value.match(/(?:创建|搭建|生成|开发|做)(?:一个|一套|全新的)?(.{2,28}?)(?:项目|网站|网页|移动端|小程序|app|功能|，|,|。|$)/i);
    if (match?.[1]) return match[1].replace(/^(Web|UniApp|H5)/i, "").trim() || `${projectType} AI应用`;
    return projectType === "UniApp" ? "AI移动端应用" : "AI Web应用";
}

async function sendBuilderQuestion(text, assistantMessage, attachments = []) {
    const prompt = buildMcpPrompt(text);
    await sendChatStream({
        UserChatMsg: prompt,
        SystemChatMsg: buildSystemPrompt("builder"),
        AiModel: selectedRuntimeModelId.value,
        AiModelId: selectedAiModel.value.Id || "",
        OsClient: osClient.value,
        Attachments: attachments,
        ConversationId: currentConversationId.value,
        Source: SOURCE,
        Mode: "builder",
        ReasoningEffort: effectiveReasoningEffort.value
    }, assistantMessage, { extractActions: true });
    assistantMessage.actions = extractMcpActions(assistantMessage.rawContent || assistantMessage.content);
    assistantMessage.content = stripActionJson(assistantMessage.content || "");
}

async function sendChatStream(payload, assistantMessage, options = {}) {
    abortController = new AbortController();
    payload.RelayModel = isRelayStationSelected.value ? selectedRelayModel.value : "";
    const response = await fetch(`${DiyCommon.GetApiBase()}/api/Ai/ChatStream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : "",
            lang: DiyCommon.GetCurrentLang ? DiyCommon.GetCurrentLang() : "zh-CN"
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    await readChatSse(response, assistantMessage, options);
}

async function sendSecureDataQuestion(text, assistantMessage) {
    const authorizedModel = selectAuthorizedSecureModel();
    if (!secureAssistantAvailable.value || !authorizedModel?.Id) {
        throw new Error(secureAssistantError.value || "当前角色没有可用的安全业务数据模型");
    }
    const relayIds = secureAssistantRelayModels.value
        .map((item) => String(item?.Id || item?.id || ""))
        .filter(Boolean);
    const relayModel = isSecureRelayStation(authorizedModel)
        ? (relayIds.includes(selectedRelayModel.value) ? selectedRelayModel.value : relayIds[0] || "")
        : "";
    const existing = conversations.value.find((item) => isCurrentConversation(item));
    const data = await sendMobileAiQuestion(DiyCommon, {
        Question: text,
        AiModelId: authorizedModel.Id,
        RelayModel: relayModel,
        ReasoningEffort: effectiveReasoningEffort.value,
        ConversationId: currentConversationId.value || "",
        RequestId: makeMobileAiId("request"),
        Title: existing?.title || firstLine(text)
    });
    currentConversationSource.value = SECURE_DATA_SOURCE;
    currentConversationId.value = String(data.ConversationId || currentConversationId.value || "");
    assistantMessage.modelId = String(authorizedModel.AiModel || relayModel || authorizedModel.Name || "");
    assistantMessage.thinking = Array.isArray(data.Thinking)
        ? data.Thinking.map(String).filter(Boolean).join("\n\n")
        : String(data.Thinking || "");
    assistantMessage.thinkingCollapsed = true;
    assistantMessage.content = String(data.Answer || "暂未获得分析结果");
    assistantMessage.rawContent = assistantMessage.content;
}

async function sendDataQuestion(text, assistantMessage) {
    const result = await DiyCommon.PostAsync("/api/Ai/NL2SQL", {
        Question: text,
        AiModel: selectedRuntimeModelId.value,
        AiModelId: selectedAiModel.value.Id || "",
        RelayModel: isRelayStationSelected.value ? selectedRelayModel.value : "",
        OsClient: osClient.value,
        ReasoningEffort: effectiveReasoningEffort.value
    }, null, null, "json");
    if (!isOk(result)) throw new Error(result?.Msg || "数据分析失败");
    const data = result.Data || {};
    assistantMessage.thinking = data.Thinking || buildDataThinkingSummary(data, text);
    assistantMessage.thinkingCollapsed = false;
    assistantMessage.content = [
        data.Answer || "查询完成",
        data.GeneratedSQL ? `SQL: ${data.GeneratedSQL}` : ""
    ].filter(Boolean).join("\n\n");
    assistantMessage.queryRows = Array.isArray(data.QueryResult) ? data.QueryResult.slice(0, 100) : [];
}

async function sendCodeQuestion(text, assistantMessage) {
    abortController = new AbortController();
    const response = await fetch(`${DiyCommon.GetApiBase()}/api/Ai/NL2V8Engine`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : "",
            lang: DiyCommon.GetCurrentLang ? DiyCommon.GetCurrentLang() : "zh-CN"
        },
        body: JSON.stringify({
            Question: text,
            AiModel: selectedRuntimeModelId.value,
            AiModelId: selectedAiModel.value.Id || "",
            RelayModel: isRelayStationSelected.value ? selectedRelayModel.value : "",
            OsClient: osClient.value,
            CurrentCode: "",
            ConversationId: currentConversationId.value,
            Source: SOURCE,
            Mode: "code",
            ReasoningEffort: effectiveReasoningEffort.value
        }),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    await readSse(response, assistantMessage);
}

async function readChatSse(response, assistantMessage, options = {}) {
    if (!response.body) {
        const text = await response.text();
        applyStreamText(assistantMessage, text);
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let eventName = "";
    let dataLines = [];
    let fullText = "";

    const dispatch = () => {
        if (!eventName && dataLines.length === 0) return;
        const data = dataLines.join("\n");
        dataLines = [];
        if (eventName === "message") {
            fullText += data;
            applyStreamText(assistantMessage, fullText);
        } else if (eventName === "result") {
            if (!fullText && data) {
                try {
                    const parsed = JSON.parse(data);
                    fullText = typeof parsed === "string" ? parsed : normalizeAiText(parsed);
                    applyStreamText(assistantMessage, fullText);
                } catch {
                    fullText = data;
                    applyStreamText(assistantMessage, fullText);
                }
            }
        } else if (eventName === "error") {
            throw new Error(data || "AI 对话失败");
        }
        eventName = "";
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (line === "") {
                dispatch();
            } else if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).replace(/^ /, ""));
            }
        }
    }
    if (buffer) dispatch();
    if (options.extractActions) {
        assistantMessage.actions = extractMcpActions(fullText);
    }
}

function applyStreamText(message, rawText) {
    const raw = String(rawText || "");
    const parsed = splitThinkingText(raw);
    message.rawContent = raw;
    message.thinking = parsed.thinking;
    message.content = parsed.content;
    if (message.thinking && !message.content) {
        message.content = "";
    }
    scrollToBottom();
}

function splitThinkingText(text) {
    const raw = String(text || "");
    let thinking = "";
    let content = raw;
    const closed = raw.match(/<think>([\s\S]*?)<\/think>/i);
    if (closed) {
        thinking = closed[1].trim();
        content = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trimStart();
    } else {
        const openIndex = raw.toLowerCase().indexOf("<think>");
        if (openIndex >= 0) {
            thinking = raw.slice(openIndex + 7).trim();
            content = raw.slice(0, openIndex).trimStart();
        }
    }
    content = content.replace(/<\/?think>/gi, "").trimStart();
    return { thinking, content };
}

function thinkingParagraphCount(text) {
    return String(text || "").split(/\n\s*\n/).filter((item) => item.trim()).length || 1;
}

async function readSse(response, assistantMessage) {
    if (!response.body) {
        applyStreamText(assistantMessage, await response.text());
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let eventName = "";
    let dataLines = [];
    let fullText = "";

    const dispatch = () => {
        if (!eventName && dataLines.length === 0) return;
        const data = dataLines.join("\n");
        dataLines = [];
        if (eventName === "message") {
            fullText += data;
            const streamParts = splitThinkingText(fullText);
            assistantMessage.rawContent = fullText;
            assistantMessage.thinking = streamParts.thinking;
            const parsed = parseCodeResponse(streamParts.content);
            assistantMessage.content = parsed.explanation || (parsed.code ? "代码生成中..." : streamParts.content);
            assistantMessage.code = parsed.code;
            scrollToBottom();
        } else if (eventName === "result") {
            try {
                const metadata = JSON.parse(data);
                if (metadata?.GeneratedCode && !assistantMessage.code) {
                    assistantMessage.code = metadata.GeneratedCode;
                }
            } catch {}
        } else if (eventName === "error") {
            throw new Error(data || "AI 生成失败");
        }
        eventName = "";
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (line === "") {
                dispatch();
            } else if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).replace(/^ /, ""));
            }
        }
    }
    if (buffer) dispatch();
    const streamParts = splitThinkingText(fullText);
    assistantMessage.rawContent = fullText;
    assistantMessage.thinking = streamParts.thinking;
    const parsed = parseCodeResponse(streamParts.content);
    assistantMessage.content = parsed.explanation || (parsed.code ? "代码生成完成" : streamParts.content || "生成完成");
    assistantMessage.code = parsed.code || assistantMessage.code;
}

function normalizeAiText(data) {
    if (data == null) return "";
    if (typeof data === "string") return data;
    return JSON.stringify(data, null, 2);
}

function parseCodeResponse(text) {
    const codeBlocks = [];
    const codeRegex = /```(?:javascript|js|csharp|sql|json)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = codeRegex.exec(text)) !== null) {
        codeBlocks.push(match[1].trim());
    }
    const code = codeBlocks.join("\n\n");
    const explanation = text.replace(/```(?:javascript|js|csharp|sql|json)?\s*[\s\S]*?```/gi, "").trim();
    return { explanation, code };
}

function buildMcpPrompt(text) {
    return [
        "线上AI已接入平台 Skills + MCP 受控工具桥：低代码建模动作必须输出 McpActions，由前端按钮调用 /api/V8Engine 对应工具执行。",
        "当前支持表、字段、菜单、接口引擎、界面引擎、校验和缓存刷新；复杂 AI 应用源码走 ai_app_* 接口引擎并存储到 HDFS。",
        "你是线上低代码建模助手。",
        `当前租户 OsClient=${osClient.value}。`,
        "你需要根据用户需求给出简洁方案，并在确实需要写入平台时，输出可人工确认执行的 MCP 动作。",
        "可用动作：CreateTable、AddField、CreateModule、CreateApiEngine、UpdateApiEngineCode、SavePageEngine、ValidateLowCodeSystem、RefreshSchemaCache。",
        "字段物理类型必须使用 varchar(N)、mediumtext、longtext、int、bigint、decimal(18,N)，日期时间用 varchar(25)，不要使用 datetime/date/timestamp/float/double/boolean。",
        `高风险能力权限：${AI_DATA_PERMISSION.name}、${AI_BUILDER_PERMISSION.name} 已由前端校验；后端执行动作时仍必须做权限与租户边界校验。`,
        "如果要输出动作，请在回答末尾单独给一个 JSON 代码块，格式为：",
        '{"McpActions":[{"Action":"CreateTable","Title":"创建客户表","Params":{"Name":"diy_customer","Description":"客户表"}}]}',
        "不要直接假装已经执行，动作需要用户点击执行。",
        "",
        "用户需求：",
        text
    ].join("\n");
}

function stripActionJson(content) {
    return content.replace(/```json\s*[\s\S]*?"McpActions"[\s\S]*?```/gi, "").trim() || content;
}

function extractMcpActions(content) {
    const actions = [];
    const regex = /```json\s*([\s\S]*?)```/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed.McpActions)) {
                actions.push(...parsed.McpActions);
            }
        } catch {}
    }
    return hydrateMcpActions(actions);
}

function hydrateMcpActions(actions = []) {
    return actions.map((item) => reactive({
        Action: item.Action,
        Title: item.Title,
        Params: item.Params || {},
        __result: item.__result || null,
        __loading: false
    })).filter((item) => item.Action && ACTION_ENDPOINTS[item.Action]);
}

async function executeMcpAction(action) {
    if (!isAiAdmin.value) {
        ElMessage.warning("只有管理员可以执行低代码建模动作");
        return;
    }
    const endpoint = ACTION_ENDPOINTS[action.Action];
    if (!endpoint) {
        ElMessage.warning("暂不支持该动作：" + action.Action);
        return;
    }
    action.__loading = true;
    try {
        const payload = prepareMcpActionPayload(action);
        if (shouldSkipAutoSystemField(action, payload)) {
            ElMessage.success(`${action.Title || action.Action} 已跳过：系统基础字段由创建表自动生成`);
            action.__result = { Skipped: true, Reason: "AutoSystemField" };
            return;
        }
        if (action.Action === "AddField" && !payload.TableId) {
            ElMessage.error("请先执行创建表，或在字段动作中提供 TableId");
            return;
        }
        const result = await DiyCommon.PostAsync(endpoint, payload, null, null, "json");
        if (isOk(result)) {
            action.__result = result.Data || result.data || {};
            rememberMcpActionResult(action, action.__result);
            ElMessage.success(`${action.Title || action.Action} 执行成功`);
            const msg = reactive({
                id: makeId("system"),
                role: "assistant",
                mode: "builder",
                content: `${action.Title || action.Action} 执行成功\n${JSON.stringify(result.Data || {}, null, 2)}`,
                time: nowText()
            });
            messages.value.push(msg);
            await saveMessage(msg);
            scrollToBottom();
        } else {
            ElMessage.error(result?.Msg || `${action.Action} 执行失败`);
        }
    } finally {
        action.__loading = false;
    }
}

function prepareMcpActionPayload(action) {
    const payload = {
        OsClient: osClient.value,
        ...(action.Params || {})
    };
    if (action.Action === "AddField") {
        payload.TableId = payload.TableId || payload.DiyTableId || payload.tableId || actionContext.lastTableId;
        payload.Name = payload.Name || payload.FieldName || payload.Key;
        payload.Label = payload.Label || payload.Title || payload.Name;
        payload.Type = payload.Type || "varchar(200)";
        payload.Component = payload.Component || "Text";
    }
    if (action.Action === "CreateModule") {
        payload.DiyTableId = payload.DiyTableId || payload.TableId || actionContext.lastTableId;
    }
    return payload;
}

function shouldSkipAutoSystemField(action, payload) {
    if (action.Action !== "AddField") return false;
    const name = String(payload.Name || "").toLowerCase();
    return ["id", "createtime", "updatetime", "createuser", "osclient"].includes(name);
}

function rememberMcpActionResult(action, data) {
    if (action.Action !== "CreateTable") return;
    const tableId = data?.TableId || data?.Id || data?.DiyTableId || "";
    const tableName = data?.Name || data?.TableName || action.Params?.Name || "";
    if (tableId) actionContext.lastTableId = tableId;
    if (tableName) actionContext.lastTableName = tableName;
}

function buildChatHistoryPayload() {
    const contentMessages = messages.value
        .filter((item) => item && item.content && !item.streaming)
        .slice(0, -1)
        .slice(-20);
    return contentMessages.map((item) => ({
        Role: item.role === "assistant" ? "assistant" : "user",
        Content: [item.content, item.code ? `\n\`\`\`javascript\n${item.code}\n\`\`\`` : ""].filter(Boolean).join("\n")
    }));
}

async function saveMessage(message) {
    try {
        await DiyCommon.FormEngine.AddFormData("mic_ai_record", {
            AiModelId: selectedAiModel.value?.Id || "",
            AiModel: selectedRuntimeModelId.value,
            Content: JSON.stringify({
                Source: SOURCE,
                ConversationId: currentConversationId.value,
                Archived: Boolean(conversations.value.find((item) => isCurrentConversation(item))?.archived),
                Title: firstLine(messages.value.find((item) => item.role === "user")?.content || message.content),
                Role: message.role,
                Mode: message.mode || resolvedMode.value,
                Content: message.content || "",
                RawContent: message.rawContent || message.content || "",
                ModelId: message.modelId || selectedRuntimeModelId.value,
                AiModel: selectedRuntimeModelId.value,
                Thinking: message.thinking || "",
                ReasoningEffort: message.reasoningEffort || effectiveReasoningEffort.value,
                Code: message.code || "",
                Error: message.error || "",
                Attachments: message.attachments || [],
                Actions: (message.actions || []).map((item) => ({
                    Action: item.Action,
                    Title: item.Title,
                    Params: item.Params,
                    __result: item.__result || null
                })),
                QueryRows: message.queryRows || [],
                Time: message.time || nowText(),
                CreatedAt: new Date().toISOString()
            })
        });
        await loadHistory();
    } catch (error) {
        console.warn("[AiEngine] save message failed", error);
    }
}

function refreshCurrentConversationTitle(userMessage) {
    const latestAt = new Date().toISOString();
    const existing = conversations.value.find((item) => isCurrentConversation(item));
    if (existing) {
        existing.title = firstLine(userMessage.content);
        existing.lastTimestamp = toTimestamp(latestAt);
        existing.lastTime = formatHistoryTime(latestAt);
    } else {
        conversations.value.unshift({
            id: currentConversationId.value,
            key: `${SOURCE}:${currentConversationId.value}`,
            source: SOURCE,
            title: firstLine(userMessage.content),
            lastTimestamp: toTimestamp(latestAt),
            lastTime: formatHistoryTime(latestAt),
            archived: false,
            records: []
        });
    }
}

function scrollToBottom() {
    nextTick(() => {
        if (messageWrapRef.value) {
            messageWrapRef.value.scrollTop = messageWrapRef.value.scrollHeight;
        }
    });
}

async function copyText(text) {
    if (!text) return;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand("copy");
            document.body.removeChild(textarea);
            if (!copied) throw new Error("copy command failed");
        }
        ElMessage.success("已复制");
    } catch {
        try {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand("copy");
            document.body.removeChild(textarea);
            if (!copied) throw new Error("copy command failed");
            ElMessage.success("已复制");
        } catch {
            ElMessage.warning("复制失败，请手动选择文本");
        }
    }
}
</script>

<style scoped>
.ai-engine-page {
    height: calc(100vh - 104px);
    min-height: 0;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
    box-sizing: border-box;
    margin: 8px 12px 12px;
    border: 1px solid #e6e9f2;
    border-radius: 18px;
    background: #f7f8fb;
    color: #20242c;
    box-shadow: 0 22px 56px rgba(20, 30, 55, .08);
}

.ai-engine-page.is-embedded {
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    margin: 0;
    border-radius: var(--mci-shape-panel, 12px);
}

.ai-engine-page.is-compact {
    grid-template-columns: minmax(0, 1fr);
}

.ai-engine-page.is-compact .ai-engine-sidebar {
    display: none;
}

.ai-engine-page.is-compact .ai-engine-main {
    grid-template-rows: 50px minmax(0, 1fr) auto;
}

.ai-engine-page.is-compact .ai-engine-header {
    padding: 0 14px;
}

.ai-engine-page.is-compact .message-wrap {
    padding: 10px 14px;
}

.ai-engine-page.is-compact .empty-state {
    justify-content: center;
    gap: 8px;
    padding: 8px;
}

.ai-engine-page.is-compact .empty-hero {
    gap: 5px;
}

.ai-engine-page.is-compact .hero-kicker {
    min-height: 20px;
    padding: 0 8px;
    font-size: 11px;
}

.ai-engine-page.is-compact .empty-state h1 {
    font-size: clamp(19px, 1.7vw, 25px);
}

.ai-engine-page.is-compact .empty-state p {
    max-width: 760px;
    font-size: 12px;
    line-height: 1.45;
}

.ai-engine-page.is-compact .empty-state .hero-local-tip {
    min-height: 28px;
    padding: 5px 9px;
    font-size: 11px;
    line-height: 1.35;
}

.ai-engine-page.is-compact .platform-stats {
    width: 100%;
    gap: 7px;
    margin-top: 2px;
}

.ai-engine-page.is-compact .platform-stat {
    min-height: 58px;
    padding: 7px 9px;
}

.ai-engine-page.is-compact .platform-stat::before {
    width: 72px;
    height: 72px;
}

.ai-engine-page.is-compact .platform-stat span,
.ai-engine-page.is-compact .platform-stat small {
    font-size: 10px;
}

.ai-engine-page.is-compact .platform-stat strong {
    margin: 1px 0;
    font-size: 19px;
}

.ai-engine-page.is-compact .quick-prompts {
    width: 100%;
    gap: 7px;
    margin-top: 2px;
}

.ai-engine-page.is-compact .quick-prompt {
    min-height: 58px;
    gap: 4px;
    padding: 8px 9px;
}

.ai-engine-page.is-compact .quick-prompt .el-icon {
    width: 25px;
    height: 25px;
    font-size: 15px;
}

.ai-engine-page.is-compact .quick-prompt strong {
    font-size: 12px;
}

.ai-engine-page.is-compact .quick-prompt span {
    font-size: 10px;
    line-height: 1.3;
}

.ai-engine-page.is-compact .composer {
    padding: 8px 12px 10px;
}

.ai-engine-page.is-embedded.is-compact .composer-footer {
    flex-wrap: wrap;
}

.ai-engine-page.is-embedded.is-compact .composer-left,
.ai-engine-page.is-embedded.is-compact .composer-right {
    max-width: 100%;
    flex-wrap: wrap;
}

.ai-engine-page.is-embedded.is-compact .composer-left {
    flex: 1 1 400px;
}

.ai-engine-page.is-embedded.is-compact .composer-right {
    flex: 1 1 396px;
    justify-content: flex-end;
    margin-left: auto;
}

.ai-engine-page.is-embedded.is-compact .semantic-select,
.ai-engine-page.is-embedded.is-compact .reasoning-select,
.ai-engine-page.is-embedded.is-compact .composer-model-select {
    max-width: 100%;
}

.ai-engine-page.is-embedded.is-compact .composer-model-select {
    width: min(260px, 100%);
    flex: 1 1 180px;
}

.ai-engine-page.is-embedded.is-compact .relay-model-select {
    width: min(190px, 100%);
    flex: 1 1 160px;
}

.ai-engine-page.is-app-workspace {
    grid-template-columns: minmax(0, 1fr);
}

.ai-engine-page.is-app-workspace .ai-engine-sidebar {
    display: none;
}

.ai-engine-sidebar {
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e3e6ee;
    background: linear-gradient(180deg, #eef7eb 0%, #f7f3df 100%);
}

.workspace-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 14px 14px 6px;
}

.workspace-tabs.single-tab {
    grid-template-columns: 1fr;
}

.workspace-tab {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 9px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: rgba(255, 255, 255, .38);
    color: #435044;
    cursor: pointer;
    padding: 0 12px;
    font-weight: 650;
    justify-content: center;
    text-align: center;
    transition: background .18s, border-color .18s, color .18s, box-shadow .18s;
}

.workspace-tab:hover,
.workspace-tab.active {
    border-color: rgba(255, 95, 46, .22);
    background: #fff;
    color: #ff5f2e;
    box-shadow: 0 10px 24px rgba(43, 55, 78, .07);
}

.sidebar-actions {
    display: grid;
    gap: 10px;
    padding: 10px 16px 16px;
}

.new-chat-btn {
    justify-content: center;
    border: 0;
    border-radius: 8px;
    background: linear-gradient(135deg, #ff6a3d 0%, #ff3f22 100%);
    color: #fff;
    font-weight: 650;
    box-shadow: 0 10px 24px rgba(255, 95, 46, .22);
}

.app-sidebar-intro {
    margin: 12px 16px;
    border: 1px solid rgba(255, 95, 46, .16);
    border-radius: 8px;
    background: rgba(255, 255, 255, .7);
    padding: 14px;
}

.app-sidebar-intro strong {
    display: block;
    color: #1f3329;
    font-size: 15px;
    margin-bottom: 8px;
}

.app-sidebar-intro p {
    margin: 0;
    color: #6f7a72;
    font-size: 13px;
    line-height: 1.7;
}

.history-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    margin: 0 16px 8px;
    padding: 4px;
    border: 1px solid var(--ai-border, rgba(145, 158, 171, .18));
    border-radius: 10px;
    background: var(--ai-surface, rgba(255, 255, 255, .46));
}

.history-tabs button {
    min-width: 0;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--ai-text-secondary, #707a72);
    cursor: pointer;
    font-size: 13px;
}

.history-tabs button.active {
    background: var(--ai-card, #fff);
    color: var(--ai-primary, #ff5f2e);
    box-shadow: 0 6px 16px rgba(15, 23, 42, .08);
}

.history-tabs small {
    min-width: 18px;
    padding: 1px 5px;
    border-radius: 999px;
    background: rgba(148, 163, 184, .14);
    font-size: 11px;
    line-height: 16px;
}

.conversation-list {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 4px 10px 18px;
}

.conversation-item {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #394139;
    padding: 3px 5px 3px 8px;
    text-align: left;
}

.conversation-select {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 6px 2px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
}

.conversation-action {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #8a918c;
    cursor: pointer;
    opacity: 0;
    transition: opacity .18s, background .18s, color .18s;
}

.conversation-item:hover .conversation-action,
.conversation-item.active .conversation-action,
.conversation-action:focus-visible {
    opacity: 1;
}

.conversation-action:hover {
    background: rgba(255, 95, 46, .1);
    color: #ff5f2e;
}

.conversation-action.loading {
    opacity: .55;
    cursor: wait;
}

.conversation-item:hover,
.conversation-item.active {
    background: rgba(255, 255, 255, 0.72);
}

.conversation-title {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
}

.conversation-title em {
    margin-left: 5px;
    padding: 1px 5px;
    border-radius: var(--mci-radius-xs, 4px);
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
    font-size: 9px;
    font-style: normal;
}

.conversation-item small {
    color: #90988f;
    font-size: 12px;
}

.ai-engine-main {
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 64px minmax(0, 1fr) auto;
    background: #fff;
}

.ai-engine-main.is-apps {
    grid-template-rows: 64px minmax(0, 1fr);
}

.ai-engine-header {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 22px;
    border-bottom: 1px solid #edf0f5;
}

.store-link-btn {
    border-color: rgba(255, 95, 46, .36);
    background: linear-gradient(135deg, #fff6f2 0%, #fff 100%);
    color: #ff5f2e;
    font-weight: 650;
}

.inline-project-workbench {
    min-height: 0;
    height: 100%;
    padding: 14px;
    background: #f7f8fb;
}

.video-workspace {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    display: grid;
    align-content: start;
    gap: 18px;
    padding: 22px;
    background:
        radial-gradient(circle at 8% 0%, rgba(255, 95, 46, .08), transparent 32%),
        #f7f8fb;
}

.video-create-card,
.video-record-card {
    border: 1px solid #e7eaf1;
    border-radius: 16px;
    background: #fff;
    padding: 22px;
    box-shadow: 0 16px 38px rgba(28, 40, 68, .06);
}

.video-section-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 20px;
}

.video-section-heading h1,
.video-section-heading h2 {
    margin: 7px 0 8px;
    color: #1f2937;
}

.video-section-heading h1 {
    font-size: clamp(23px, 3vw, 34px);
}

.video-section-heading h2 {
    font-size: 20px;
}

.video-section-heading p {
    max-width: 780px;
    margin: 0;
    color: #697386;
    line-height: 1.7;
}

.compact-heading {
    align-items: center;
    margin-bottom: 14px;
}

.video-policy-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
}

.video-quota-alert {
    flex: 1 0 100%;
    margin-top: 12px;
}

.video-create-form {
    max-width: 1040px;
}

.video-form-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 14px;
}

.video-create-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.video-record-table {
    width: 100%;
}

.video-record-detail {
    display: grid;
    grid-template-columns: minmax(260px, 42%) minmax(0, 1fr);
    gap: 22px;
    padding: 14px 36px 18px;
    background: #fafbfc;
}

.video-record-detail video {
    width: 100%;
    max-height: 360px;
    border-radius: 12px;
    background: #111827;
}

.video-record-detail audio {
    width: 100%;
    align-self: center;
}

.video-record-detail strong {
    color: #20242c;
}

.video-record-detail p {
    color: #596273;
    line-height: 1.75;
    white-space: pre-wrap;
}

.video-record-detail small {
    display: block;
    color: #8a5a1f;
    line-height: 1.65;
}

.header-left,
.header-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.header-workspace-switch {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--ai-border, #e9edf4);
    border-radius: 8px;
    background: var(--ai-surface, #f7f8fb);
}

.header-workspace-switch button {
    height: 30px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ai-text-secondary, #697386);
    cursor: pointer;
    font-weight: 650;
    padding: 0 12px;
}

.header-workspace-switch button.active,
.header-workspace-switch button:hover {
    background: var(--ai-card, #fff);
    color: var(--ai-primary, #ff5f2e);
    box-shadow: 0 6px 16px rgba(43, 55, 78, .08);
}

.header-left h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 750;
}

.secure-scope-tag {
    max-width: min(360px, 34vw);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.message-wrap {
    min-width: 0;
    min-height: 0;
    max-width: 100%;
    box-sizing: border-box;
    overflow: auto;
    padding: 18px 24px;
}

.empty-state {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 18px;
    padding: clamp(24px, 6vh, 58px) 18px;
}

.empty-hero {
    max-width: 780px;
    text-align: center;
    display: grid;
    justify-items: center;
    gap: 10px;
}

.hero-kicker {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    border: 1px solid rgba(255, 95, 46, .22);
    border-radius: 999px;
    background: #fff7f3;
    color: #ff5f2e;
    padding: 0 11px;
    font-size: 12px;
    font-weight: 700;
}

.empty-state h1 {
    margin: 0;
    color: #24272e;
    font-size: clamp(26px, 2.4vw, 38px);
    font-weight: 760;
    letter-spacing: 0;
    line-height: 1.18;
}

.empty-state p {
    max-width: 640px;
    margin: 0;
    color: #747b88;
    font-size: 14px;
    text-align: center;
    line-height: 1.85;
}

.empty-state .hero-local-tip {
    max-width: 760px;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 95, 46, .22);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(255, 95, 46, .12), rgba(126, 87, 255, .08));
    color: var(--mci-theme-color, #ff5f2e);
    box-shadow: 0 14px 34px rgba(255, 95, 46, .08);
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.55;
}

.platform-stats {
    width: min(860px, 100%);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 8px;
}

.platform-stat {
    min-height: 78px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: 1px solid #e7ebf2;
    border-radius: 8px;
    background: linear-gradient(180deg, #fff 0%, #fbfcff 100%);
    box-shadow: 0 12px 30px rgba(35, 44, 63, .05);
    padding: 13px 16px;
}

.platform-stat span {
    color: #7c8595;
    font-size: 12px;
}

.platform-stat strong {
    color: #20242c;
    font-size: 24px;
    line-height: 1.2;
    margin: 4px 0;
}

.platform-stat small {
    color: #a4acb9;
    font-size: 12px;
}

.quick-prompts {
    width: min(760px, 100%);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-top: 8px;
}

.quick-prompt {
    min-height: 104px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    border: 1px solid #e5e8ef;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    padding: 14px;
    text-align: left;
    transition: border-color .18s, box-shadow .18s, transform .18s;
}

.quick-prompt:hover {
    border-color: #b8c5d8;
    box-shadow: 0 12px 30px rgba(29, 36, 52, .08);
    transform: translateY(-1px);
}

.quick-prompt .el-icon {
    color: #ff5f2e;
    font-size: 20px;
}

.quick-prompt strong {
    color: #20242c;
    font-size: 15px;
    line-height: 1.45;
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.quick-prompt span {
    color: #7a8290;
    font-size: 13px;
    line-height: 1.45;
}

.message-list {
    max-width: 980px;
    display: grid;
    gap: 22px;
    margin: 0 auto;
}

.message {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 12px;
}

.message-avatar {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #f1f3f6;
    color: #626b78;
    overflow: hidden;
}

.message.is-assistant .message-avatar {
    background: #fff1ec;
    color: #ff5f2e;
}

.message-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.message-body {
    min-width: 0;
}

.message-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
    margin-bottom: 5px;
}

.message-meta strong {
    font-size: 14px;
}

.message-meta span {
    color: #9aa2af;
    font-size: 12px;
}

.message-copy-btn {
    height: 24px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #87909f;
    cursor: pointer;
    padding: 0 6px;
    margin-left: auto;
}

.message-copy-btn:hover {
    background: var(--ai-surface, #f2f5f9);
    color: var(--ai-primary, #ff5f2e);
}

.message-text {
    margin: 0;
    color: #252a32;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.75;
    white-space: pre-wrap;
    word-break: break-word;
}

.message-text.streaming::after {
    content: "";
    display: inline-block;
    width: 6px;
    height: 16px;
    margin-left: 3px;
    border-radius: 3px;
    background: #ff5f2e;
    vertical-align: -3px;
    animation: cursor-blink 1s steps(2, start) infinite;
}

.thinking-placeholder {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    color: #6b7280;
    font-size: 13px;
}

.thinking-placeholder em {
    font-style: normal;
}

.thinking-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff6a3d;
    opacity: .35;
    animation: thinking-dot 1s ease-in-out infinite;
}

.thinking-dot:nth-child(2) {
    animation-delay: .15s;
}

.thinking-dot:nth-child(3) {
    animation-delay: .3s;
}

.message-thinking {
    margin: 0 0 8px;
    border: 1px solid #e6eaf1;
    border-radius: 8px;
    background: #f8fafc;
    overflow: hidden;
}

.thinking-toggle {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 7px;
    border: 0;
    background: transparent;
    color: #5d6675;
    cursor: pointer;
    padding: 7px 10px;
    text-align: left;
}

.thinking-toggle small {
    margin-left: auto;
    color: #9aa3b2;
}

.thinking-content {
    max-height: 220px;
    overflow: auto;
    margin: 0;
    border-top: 1px solid var(--mci-divider-color, var(--ai-border, #e6eaf1));
    color: var(--ai-text-secondary, #6c7480);
    font-family: inherit;
    font-size: 13px;
    line-height: 1.65;
    padding: 10px 12px;
    white-space: pre-wrap;
    word-break: break-word;
}

@keyframes cursor-blink {
    0%, 45% { opacity: 1; }
    46%, 100% { opacity: 0; }
}

@keyframes thinking-dot {
    0%, 80%, 100% {
        opacity: .35;
        transform: translateY(0);
    }
    40% {
        opacity: 1;
        transform: translateY(-3px);
    }
}

.message-attachments,
.attachment-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.message-attachments {
    margin-top: 8px;
}

.attachment-list {
    padding: 0 12px 8px;
}

.attachment-chip {
    max-width: 260px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--ai-border, #e2e7f0);
    border-radius: 999px;
    background: var(--ai-surface, #f8fafc);
    color: var(--ai-text-secondary, #445064);
    padding: 4px 8px;
    font-size: 12px;
}

.attachment-chip.readonly {
    background: var(--ai-card, #fff);
}

.attachment-chip button {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: #8f97a5;
    cursor: pointer;
    padding: 0;
}

.code-block,
.query-result,
.mcp-actions {
    margin-top: 12px;
    border: 1px solid #e4e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
}

.code-toolbar {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px 0 14px;
    border-bottom: 1px solid #252b36;
    background: #161b22;
    color: #cbd5e1;
    font-size: 12px;
}

.code-block pre {
    max-height: 380px;
    overflow: auto;
    margin: 0;
    padding: 14px;
    background: #0d1117;
    color: #e6edf3;
    font-size: 13px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
}

.query-result {
    padding: 10px;
}

.mcp-actions {
    padding: 12px;
}

.mcp-actions-title {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #3d4655;
    font-weight: 650;
    margin-bottom: 10px;
}

.mcp-action-list {
    display: grid;
    gap: 8px;
}

.mcp-action-item {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid #edf0f5;
    border-radius: 7px;
    padding: 8px 10px;
}

.mcp-action-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.mcp-action-info strong,
.mcp-action-info small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mcp-action-info small {
    color: #8b94a3;
}

.composer {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    border-top: 1px solid var(--mci-divider-color, var(--ai-border, #edf0f5));
    padding: 14px 24px 18px;
    background: var(--ai-bg, #fff);
}

.composer-box {
    position: relative;
    isolation: isolate;
    max-width: 980px;
    margin: 0 auto;
    border: 1px solid var(--ai-border, #dfe3eb);
    border-radius: 14px;
    background: var(--ai-panel, #fff);
    box-shadow: 0 14px 38px rgba(25, 32, 44, .08);
    overflow: visible;
}

.composer-box > * {
    position: relative;
    z-index: 1;
}

.composer-box :deep(.el-textarea__inner) {
    border: 0;
    box-shadow: none;
    padding: 16px 18px 8px;
    font-size: 15px;
    border-radius: 13px 13px 0 0;
}

.composer-box :deep(.el-textarea) {
    border-radius: 13px 13px 0 0;
    overflow: hidden;
}

.composer-footer {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 10px 10px 12px;
    border-radius: 0;
}

.ai-generation-disclaimer {
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 14px 8px;
    border-radius: 0 0 13px 13px;
    color: var(--mci-text-tertiary, var(--el-text-color-secondary));
    font-size: 11px;
    line-height: 16px;
}

.ai-generation-disclaimer small {
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.composer-left,
.composer-right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.composer-left {
    flex: 1 1 auto;
}

.semantic-label {
    flex: 0 0 auto;
    color: #767e8a;
    font-size: 13px;
    line-height: 1;
    white-space: nowrap;
}

.semantic-select {
    flex: 0 0 132px;
    width: 132px;
}

.reasoning-select {
    flex: 0 0 102px;
    width: 102px;
}

.reasoning-label {
    margin-left: 2px;
    cursor: help;
}

.schema-mode-tag {
    flex: 0 0 auto;
    max-width: 150px;
    overflow: hidden;
    border-color: rgba(var(--el-color-primary-rgb, 79, 70, 229), .34);
    color: var(--ai-primary, #4f46e5);
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: help;
}

.semantic-select :deep(.el-input__wrapper) {
    min-height: 32px;
    border-radius: 999px;
    box-shadow: 0 0 0 1px var(--ai-border, #dfe3eb) inset;
}

.attachment-input {
    display: none;
}

.icon-action {
    width: 34px;
    height: 34px;
}

.composer-model-select {
    width: 260px;
}

.relay-model-select {
    width: 190px;
    flex: 0 0 190px;
}

.relay-model-select :deep(.el-select__selected-item),
.relay-model-select :deep(.el-select__placeholder) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.send-btn {
    width: 40px;
    height: 40px;
    min-width: 40px;
    padding: 0;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.stop-btn {
    height: 36px;
}

:deep(.ai-engine-table-drawer) {
    height: calc(100vh - 120px);
}

.ai-engine-page {
    --ai-primary: var(--mci-color-primary, var(--el-color-primary, #ff5f2e));
    --ai-primary-dark: var(--mci-color-primary-dark, var(--el-color-primary-dark-2, #e34f24));
    --ai-primary-soft: color-mix(in srgb, var(--ai-primary) 12%, transparent);
    --ai-bg: var(--mci-bg-base, var(--el-bg-color-page, #f7f8fb));
    --ai-panel: var(--mci-bg-elevated, var(--el-bg-color, #fff));
    --ai-surface: var(--mci-bg-surface, var(--el-fill-color-light, #f4f6fa));
    --ai-card: var(--mci-bg-card, var(--el-bg-color, #fff));
    --ai-card-hover: var(--mci-bg-card-hover, var(--el-fill-color-extra-light, #fff));
    --ai-border: var(--mci-border-color, var(--el-border-color-lighter, #e6e9f2));
    --ai-border-hover: var(--mci-border-color-hover, var(--el-border-color, #d7dce8));
    --ai-text: var(--mci-text-primary, var(--el-text-color-primary, #20242c));
    --ai-text-secondary: var(--mci-text-secondary, var(--el-text-color-regular, #606a7a));
    --ai-text-tertiary: var(--mci-text-tertiary, var(--el-text-color-placeholder, #98a2b3));
    --ai-on-primary: var(--mci-text-on-primary, #fff);
    --ai-shadow: var(--mci-shadow-card, 0 14px 36px rgba(20, 30, 55, .08));
    --ai-shadow-hover: var(--mci-shadow-card-hover, 0 20px 46px rgba(20, 30, 55, .12));
    border-color: var(--ai-border);
    background:
        radial-gradient(circle at 18% 8%, color-mix(in srgb, var(--ai-primary) 12%, transparent), transparent 34%),
        var(--ai-bg);
    color: var(--ai-text);
    box-shadow: var(--ai-shadow);
}

html.dark .ai-engine-page,
body.dark .ai-engine-page,
.dark .ai-engine-page,
[data-theme="dark"] .ai-engine-page {
    --ai-bg: var(--mci-bg-base, #0b1118);
    --ai-panel: var(--mci-bg-elevated, #101923);
    --ai-surface: var(--mci-bg-surface, #172332);
    --ai-card: var(--mci-bg-card, rgba(255, 255, 255, .055));
    --ai-card-hover: var(--mci-bg-card-hover, rgba(255, 255, 255, .085));
    --ai-border: var(--mci-border-color, rgba(255, 255, 255, .10));
    --ai-border-hover: var(--mci-border-color-hover, rgba(255, 255, 255, .18));
    --ai-text: var(--mci-text-primary, #f6f8fb);
    --ai-text-secondary: var(--mci-text-secondary, #b9c2d0);
    --ai-text-tertiary: var(--mci-text-tertiary, #7f8ba0);
    --ai-shadow: var(--mci-shadow-card, 0 18px 46px rgba(0, 0, 0, .34));
}

.ai-engine-sidebar {
    border-right-color: var(--ai-border);
    background:
        linear-gradient(180deg, color-mix(in srgb, var(--ai-primary) 12%, var(--ai-panel)), var(--ai-panel) 52%, var(--ai-bg));
}

.workspace-tab,
.conversation-item,
.app-sidebar-intro,
.header-workspace-switch,
.composer-box,
.message-text,
.message-thinking,
.code-block,
.query-result,
.mcp-actions,
.mcp-action-item,
.platform-stat,
.quick-prompt {
    border-color: var(--ai-border);
    background: var(--ai-card);
    color: var(--ai-text);
    box-shadow: var(--ai-shadow);
}

/* 对话内容靠表面层级分组，避免每一层都叠加描边与阴影。 */
.message-text,
.message-thinking,
.query-result,
.mcp-actions {
    border-color: transparent;
    box-shadow: none;
}

.message-thinking,
.query-result,
.mcp-actions {
    background: var(--ai-surface);
}

.conversation-item {
    box-shadow: none;
}

.workspace-tab:hover,
.workspace-tab.active,
.conversation-item:hover,
.conversation-item.active,
.quick-prompt:hover,
.mcp-action-item:hover {
    border-color: color-mix(in srgb, var(--ai-primary) 42%, var(--ai-border));
    background: var(--ai-card-hover);
    color: var(--ai-primary);
    box-shadow: var(--ai-shadow-hover);
}

.new-chat-btn,
.send-btn,
.store-link-btn {
    border-color: transparent;
    background: linear-gradient(135deg, var(--ai-primary), var(--ai-primary-dark));
    color: var(--ai-on-primary);
    box-shadow: 0 12px 28px color-mix(in srgb, var(--ai-primary) 28%, transparent);
}

.app-sidebar-intro strong,
.header-left h2,
.message-meta strong,
.platform-stat strong,
.quick-prompt strong {
    color: var(--ai-text);
}

.app-sidebar-intro p,
.sidebar-section-title,
.conversation-item small,
.empty-state p,
.platform-stat span,
.platform-stat small,
.quick-prompt span,
.message-meta span,
.message-thinking,
.semantic-label {
    color: var(--ai-text-secondary);
}

.ai-engine-main,
.inline-project-workbench {
    background: var(--ai-bg);
}

.ai-engine-header {
    border-bottom-color: var(--ai-border);
    background: color-mix(in srgb, var(--ai-panel) 94%, transparent);
}

.hero-kicker,
.message.is-assistant .message-avatar,
.message-copy-btn:hover {
    color: var(--ai-primary);
}

.empty-hero h1 {
    color: var(--ai-text);
    text-shadow: 0 8px 32px color-mix(in srgb, var(--ai-primary) 14%, transparent);
}

.hero-kicker {
    border-color: color-mix(in srgb, var(--ai-primary) 26%, var(--ai-border));
    background: color-mix(in srgb, var(--ai-primary) 10%, var(--ai-card));
    box-shadow: 0 10px 28px color-mix(in srgb, var(--ai-primary) 12%, transparent);
}

.message-avatar,
.message.is-assistant .message-avatar {
    background: color-mix(in srgb, var(--ai-primary) 11%, var(--ai-card));
    color: var(--ai-primary);
}

.message-copy-btn {
    border-color: var(--ai-border);
    background: var(--ai-card);
    color: var(--ai-text-secondary);
}

.thinking-toggle,
.attachment-chip {
    border-color: var(--ai-border);
    background: var(--ai-surface);
    color: var(--ai-text-secondary);
}

.thinking-content,
.code-block pre {
    color: var(--ai-text);
}

.composer {
    background: linear-gradient(180deg, transparent, var(--ai-bg) 28%);
}

.composer-box {
    border-color: var(--ai-border);
    background: var(--ai-panel);
}

.composer-box::before {
    content: "";
    position: absolute;
    inset: -5px;
    z-index: -1;
    border-radius: 18px;
    background: linear-gradient(
        115deg,
        color-mix(in srgb, var(--ai-primary) 72%, transparent),
        rgba(77, 171, 247, .64),
        color-mix(in srgb, var(--ai-primary) 62%, transparent)
    );
    filter: blur(10px);
    opacity: .46;
    transform: scale(.995);
    pointer-events: none;
    animation: ai-composer-glow 2.8s ease-in-out infinite;
}

.composer-box::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    border: 1px solid color-mix(in srgb, var(--ai-primary) 42%, var(--ai-border));
    border-radius: inherit;
    box-shadow: inset 0 0 18px color-mix(in srgb, var(--ai-primary) 9%, transparent);
    pointer-events: none;
}

@keyframes ai-composer-glow {
    0%, 100% {
        opacity: .4;
        transform: scale(.995);
    }
    50% {
        opacity: .78;
        transform: scale(1.008);
    }
}

.composer-box :deep(.el-textarea__inner),
.composer-model-select :deep(.el-input__wrapper) {
    background: var(--ai-surface);
    color: var(--ai-text);
    box-shadow: none;
}

.ai-engine-main:not(.is-apps) {
    position: relative;
    isolation: isolate;
    background:
        radial-gradient(circle at 50% 16%, color-mix(in srgb, var(--ai-primary) 18%, transparent), transparent 28%),
        linear-gradient(135deg, color-mix(in srgb, var(--ai-bg) 88%, var(--ai-primary)), var(--ai-bg) 58%);
}

.ai-engine-main:not(.is-apps)::before,
.ai-engine-main:not(.is-apps)::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
}

.ai-engine-main:not(.is-apps)::before {
    opacity: .45;
    background:
        linear-gradient(color-mix(in srgb, var(--ai-primary) 10%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--ai-primary) 10%, transparent) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(circle at 50% 18%, #000 0%, transparent 58%);
    animation: ai-grid-drift 18s linear infinite;
}

.ai-engine-main:not(.is-apps)::after {
    inset: 10% 12% auto;
    height: 260px;
    border-radius: 999px;
    opacity: .38;
    background:
        radial-gradient(circle at 25% 48%, color-mix(in srgb, var(--ai-primary) 34%, transparent), transparent 34%),
        radial-gradient(circle at 72% 52%, rgba(77, 171, 247, .28), transparent 34%);
    filter: blur(32px);
    transform: translateZ(0);
    animation: ai-aura-breathe 8s ease-in-out infinite;
}

.ai-engine-header,
.message-wrap,
.composer {
    position: relative;
    z-index: 1;
}

.ai-engine-sidebar {
    position: relative;
    overflow: hidden;
}

.ai-engine-sidebar::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(circle at 20% 8%, color-mix(in srgb, var(--ai-primary) 18%, transparent), transparent 32%),
        linear-gradient(180deg, transparent, color-mix(in srgb, var(--ai-primary) 7%, transparent));
    opacity: .65;
}

.ai-engine-sidebar > * {
    position: relative;
    z-index: 1;
}

.conversation-list {
    padding: 6px 12px 18px;
}

.conversation-item {
    position: relative;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--ai-border) 72%, transparent);
    background:
        linear-gradient(135deg, color-mix(in srgb, var(--ai-card) 88%, var(--ai-primary)), var(--ai-card));
    box-shadow: none;
    transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.conversation-item::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    border-radius: 8px 0 0 8px;
    background: linear-gradient(180deg, var(--ai-primary), color-mix(in srgb, var(--ai-primary) 45%, #4dabf7));
    opacity: 0;
    transition: opacity .18s ease;
}

.conversation-item:hover,
.conversation-item.active {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--ai-primary) 34%, var(--ai-border));
    box-shadow: 0 10px 26px color-mix(in srgb, var(--ai-primary) 10%, rgba(15, 23, 42, .08));
}

.conversation-item:hover::before,
.conversation-item.active::before {
    opacity: 1;
}

.platform-stats {
    gap: 14px;
}

.platform-stat {
    position: relative;
    overflow: hidden;
    min-height: 94px;
    border-color: color-mix(in srgb, var(--ai-primary) 18%, var(--ai-border));
    background:
        linear-gradient(145deg, color-mix(in srgb, var(--ai-primary) 16%, var(--ai-card)), color-mix(in srgb, var(--ai-card) 92%, var(--ai-panel))),
        var(--ai-card);
    box-shadow: 0 18px 40px color-mix(in srgb, var(--ai-primary) 12%, rgba(15, 23, 42, .08));
    transform: translateZ(0);
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.platform-stat::before {
    content: "";
    position: absolute;
    inset: -35% -24% auto auto;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--ai-primary) 28%, transparent);
    filter: blur(2px);
    opacity: .68;
}

.platform-stat::after {
    content: "";
    position: absolute;
    inset: auto 14px 12px auto;
    width: 36px;
    height: 3px;
    border-radius: 999px;
    background: var(--ai-primary);
    opacity: .55;
}

.platform-stat:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--ai-primary) 46%, var(--ai-border));
    box-shadow: 0 24px 52px color-mix(in srgb, var(--ai-primary) 18%, rgba(15, 23, 42, .11));
}

.platform-stat[data-stat="module"]::before {
    background: rgba(77, 171, 247, .24);
}

.platform-stat[data-stat="api"]::before {
    background: rgba(133, 91, 255, .22);
}

.platform-stat[data-stat="user"]::before {
    background: rgba(35, 213, 171, .24);
}

.platform-stat span,
.platform-stat strong,
.platform-stat small {
    position: relative;
    z-index: 1;
}

.platform-stat span {
    font-weight: 700;
}

.platform-stat strong {
    font-size: 28px;
}

.quick-prompts {
    gap: 16px;
}

.quick-prompt {
    position: relative;
    overflow: hidden;
    min-height: 118px;
    border-color: color-mix(in srgb, var(--ai-primary) 18%, var(--ai-border));
    background:
        linear-gradient(145deg, color-mix(in srgb, var(--ai-card) 84%, var(--ai-primary)), var(--ai-card));
    box-shadow: 0 18px 38px rgba(15, 23, 42, .07);
}

.quick-prompt::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0;
    background: linear-gradient(120deg, transparent, color-mix(in srgb, var(--ai-primary) 14%, transparent), transparent);
    transform: translateX(-65%);
    transition: opacity .18s ease;
}

.quick-prompt:hover::before {
    opacity: 1;
    animation: ai-card-sheen 1.1s ease;
}

.quick-prompt .el-icon {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--ai-primary) 12%, var(--ai-card));
    color: var(--ai-primary);
}

.quick-prompt strong,
.quick-prompt span,
.quick-prompt .el-icon {
    position: relative;
    z-index: 1;
}

@keyframes ai-grid-drift {
    from {
        background-position: 0 0, 0 0;
    }
    to {
        background-position: 44px 44px, 44px 44px;
    }
}

@keyframes ai-aura-breathe {
    0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
        opacity: .32;
    }
    50% {
        transform: translate3d(0, 8px, 0) scale(1.04);
        opacity: .48;
    }
}

@keyframes ai-card-sheen {
    from {
        transform: translateX(-65%);
    }
    to {
        transform: translateX(65%);
    }
}

@media (prefers-reduced-motion: reduce) {
    .ai-engine-main:not(.is-apps)::before,
    .ai-engine-main:not(.is-apps)::after,
    .composer-box::before,
    .quick-prompt:hover::before {
        animation: none;
    }

    .conversation-item,
    .platform-stat,
    .quick-prompt {
        transition: none;
    }
}

@container ai-engine-widget (max-width: 900px) {
    .ai-engine-page.is-embedded.is-compact .ai-engine-header {
        height: auto;
        min-height: 50px;
        flex-wrap: wrap;
        gap: 8px 12px;
        padding-top: 8px;
        padding-bottom: 8px;
    }

    .ai-engine-page.is-embedded.is-compact .header-left,
    .ai-engine-page.is-embedded.is-compact .header-tools {
        flex-wrap: wrap;
    }

    .ai-engine-page.is-embedded.is-compact .header-tools {
        margin-left: auto;
    }

    .ai-engine-page.is-embedded.is-compact .platform-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ai-engine-page.is-embedded.is-compact .quick-prompts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ai-engine-page.is-embedded.is-compact .quick-prompt:last-child {
        grid-column: 1 / -1;
    }

    .ai-engine-page.is-embedded.is-compact .composer-left,
    .ai-engine-page.is-embedded.is-compact .composer-right {
        flex-basis: 100%;
    }
}

@container ai-engine-widget (max-width: 560px) {
    .ai-engine-page.is-embedded.is-compact .ai-engine-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .ai-engine-page.is-embedded.is-compact .header-tools {
        width: 100%;
        margin-left: 0;
    }

    .ai-engine-page.is-embedded.is-compact .header-tools .el-button {
        flex: 1 1 auto;
        margin-left: 0;
    }

    .ai-engine-page.is-embedded.is-compact .composer-model-select,
    .ai-engine-page.is-embedded.is-compact .relay-model-select {
        flex-basis: min(180px, 100%);
    }
}

@media (max-width: 1080px) {
    .ai-engine-page {
        grid-template-columns: 220px minmax(0, 1fr);
    }

    .ai-engine-header {
        align-items: flex-start;
        flex-direction: column;
        height: auto;
        padding: 12px 18px;
    }

    .quick-prompts {
        grid-template-columns: 1fr;
    }

    .platform-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .video-form-grid {
        grid-template-columns: 1fr;
    }

    .video-record-detail {
        grid-template-columns: 1fr;
    }
}

@media (max-height: 760px) and (min-width: 761px) {
    .message-wrap {
        padding-top: 12px;
        padding-bottom: 12px;
    }

    .empty-state h1 {
        font-size: 24px;
    }

    .empty-state p {
        line-height: 1.55;
    }

    .quick-prompts {
        display: none;
    }

    .composer {
        padding-top: 10px;
        padding-bottom: 12px;
    }
}

@media (max-width: 760px) {
    .ai-engine-page {
        height: auto;
        min-height: 100vh;
        grid-template-columns: 1fr;
    }

    .ai-engine-sidebar {
        height: 230px;
        border-right: 0;
        border-bottom: 1px solid var(--mci-divider-color, var(--ai-border, #e3e6ee));
    }

    .ai-engine-main {
        min-height: 760px;
    }

    .ai-engine-header {
        padding: 12px 14px;
    }

    .workspace-tabs {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding-left: 8px;
        padding-right: 8px;
    }

    .workspace-tab {
        padding: 0 6px;
        font-size: 12px;
    }

    .video-workspace {
        padding: 12px;
    }

    .video-create-card,
    .video-record-card {
        padding: 16px;
    }

    .video-section-heading {
        flex-direction: column;
    }

    .video-policy-tags {
        justify-content: flex-start;
    }

    .message-wrap {
        padding: 22px 14px;
    }

    .empty-state h1 {
        font-size: 26px;
    }

    .platform-stats {
        grid-template-columns: 1fr;
    }

    .composer {
        padding: 10px 12px 14px;
    }

    .composer-footer {
        align-items: stretch;
        flex-direction: column;
    }

    .composer-left {
        width: 100%;
        flex-wrap: wrap;
    }

    .semantic-select {
        flex: 1 1 120px;
        width: auto;
    }

    .reasoning-select {
        flex: 1 1 86px;
        width: auto;
    }

    .composer-right {
        justify-content: flex-end;
        width: 100%;
    }

    .composer-model-select {
        flex: 1;
        width: auto;
    }

    .relay-model-select {
        flex: 1;
        width: auto;
    }

    .ai-engine-page.is-embedded.is-compact {
        height: auto;
        min-height: 0;
        overflow: visible;
    }

    .ai-engine-page.is-embedded.is-compact .ai-engine-main {
        height: auto;
        min-height: 0;
        overflow: visible;
        grid-template-rows: auto auto auto;
    }

    .ai-engine-page.is-embedded.is-compact .message-wrap {
        min-height: 0;
        overflow: visible;
        padding: 10px;
    }

    .ai-engine-page.is-embedded.is-compact .empty-state {
        min-height: 0;
        padding: 10px 4px;
    }

    .ai-engine-page.is-embedded.is-compact .empty-state h1 {
        font-size: 22px;
    }

    .ai-engine-page.is-embedded.is-compact .platform-stats,
    .ai-engine-page.is-embedded.is-compact .quick-prompts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ai-engine-page.is-embedded.is-compact .platform-stat {
        min-height: 66px;
    }

    .ai-engine-page.is-embedded.is-compact .quick-prompt:last-child {
        grid-column: 1 / -1;
    }

    .ai-engine-page.is-embedded.is-compact .header-tools {
        width: 100%;
        flex-wrap: wrap;
        gap: 6px;
    }

    .ai-engine-page.is-embedded.is-compact .header-tools .el-button {
        flex: 1 1 auto;
        margin-left: 0;
    }
}
</style>
