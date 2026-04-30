<template>
    <div class="form-right-panel" :class="{ 'is-mobile-drawer': isMobileDrawer }">
        <el-tabs v-model="innerActiveTab" class="form-right-tabs" @update:model-value="OnTabChange">
            <!-- 流程信息 -->
            <el-tab-pane v-if="openDiyFormWorkFlow" name="WorkFlow">
                <template #label>
                    <span class="tab-label">
                        <el-icon><Connection /></el-icon>
                        <span>{{ $t ? $t('Msg.WorkflowInfo') || '流程信息' : '流程信息' }}</span>
                    </span>
                </template>
                <div class="panel-card">
                    <WFHistory v-if="openDiyFormWorkFlowType.WorkType == 'ViewWork'" ref="refWFHistory"></WFHistory>
                    <WFWorkHandler
                        v-if="openDiyFormWorkFlowType.WorkType == 'StartWork' || openDiyFormWorkFlowType.WorkType == 'DoWork'"
                        ref="refWfWorkHandler"
                        :HideInlineSubmit="hideInlineSubmit"
                        @CallbackStartWork="OnCallbackStartWork"
                    ></WFWorkHandler>
                </div>
            </el-tab-pane>

            <!-- 数据日志 -->
            <el-tab-pane v-if="enableDataLog" name="DataLog">
                <template #label>
                    <span class="tab-label">
                        <el-icon><Document /></el-icon>
                        <span>{{ $t ? $t('Msg.DataLog') || '数据日志' : '数据日志' }}</span>
                    </span>
                </template>
                <div class="panel-card">
                    <div class="datalog-timeline">
                        <el-timeline v-if="dataLogList && dataLogList.length > 0">
                            <el-timeline-item
                                v-for="item in dataLogList"
                                :key="item.Id"
                                :type="'primary'"
                                :size="'large'"
                                :timestamp="item.CreateTime"
                            >
                                <template #dot>
                                    <el-avatar :size="28" :src="item.Avatar"></el-avatar>
                                </template>
                                <div class="log-card">
                                    <div class="log-title">{{ item.Title }}</div>
                                    <div
                                        v-for="log in item.Content"
                                        :key="'datalog_content_' + log.Name"
                                        class="log-row"
                                    >
                                        <span class="log-field">{{ log.Label }}</span>
                                        <span class="log-arrow">
                                            <span class="log-old">{{ log.OVal || ($t ? $t('Msg.EmptyValue') : '空') }}</span>
                                            <el-icon><ArrowRight /></el-icon>
                                            <span class="log-new">{{ log.NVal }}</span>
                                        </span>
                                    </div>
                                </div>
                            </el-timeline-item>
                        </el-timeline>
                        <div v-else class="panel-empty">
                            <el-icon><Document /></el-icon>
                            <span>{{ dataLogListLoading ? ($t ? $t('Msg.DataLoading') : '加载中...') : ($t ? $t('Msg.NoData') : '暂无数据') }}</span>
                        </div>
                    </div>
                </div>
            </el-tab-pane>

            <!-- 数据评论 -->
            <el-tab-pane v-if="enableDataComment" name="DataComment">
                <template #label>
                    <span class="tab-label">
                        <el-icon><ChatDotRound /></el-icon>
                        <span>{{ $t ? $t('Msg.DataComment') || '数据评论' : '数据评论' }}</span>
                    </span>
                </template>
                <div class="panel-card">
                    <div class="comment-input-wrapper">
                        <el-input
                            type="textarea"
                            :rows="3"
                            :placeholder="$t ? $t('Msg.EnterCommentContent') : '请输入评论内容'"
                            :model-value="commentContent"
                            @update:model-value="$emit('update:commentContent', $event)"
                        ></el-input>
                        <div class="comment-actions">
                            <el-button
                                type="primary"
                                size="small"
                                :loading="btnLoading"
                                :disabled="!commentContent || btnLoading"
                                @click="$emit('submit-comment')"
                            >
                                <el-icon v-if="!btnLoading"><Promotion /></el-icon>
                                {{ $t ? $t('Msg.Submit') : '提交' }}
                            </el-button>
                        </div>
                    </div>

                    <div class="datalog-timeline">
                        <el-timeline v-if="dataCommentList && dataCommentList.length > 0">
                            <el-timeline-item
                                v-for="item in dataCommentList"
                                :key="item.Id"
                                :type="'primary'"
                                :size="'large'"
                                :timestamp="item.CreateTime"
                            >
                                <template #dot>
                                    <el-avatar :size="28" :src="item.Avatar"></el-avatar>
                                </template>
                                <div class="log-card">
                                    <div class="log-title">{{ item.Title }}</div>
                                    <div class="log-comment-content" v-html="item.Content"></div>
                                </div>
                            </el-timeline-item>
                        </el-timeline>
                        <div v-else class="panel-empty">
                            <el-icon><ChatDotRound /></el-icon>
                            <span>{{ dataCommentListLoading ? ($t ? $t('Msg.DataLoading') : '加载中...') : ($t ? $t('Msg.NoData') : '暂无评论') }}</span>
                        </div>
                    </div>
                </div>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script>
export default {
    name: "form-right-panel",
    props: {
        modelValue: { type: String, default: "WorkFlow" },
        openDiyFormWorkFlow: { type: Boolean, default: false },
        openDiyFormWorkFlowType: { type: Object, default: () => ({}) },
        enableDataLog: { type: Boolean, default: false },
        enableDataComment: { type: Boolean, default: false },
        dataLogList: { type: Array, default: () => [] },
        dataLogListLoading: { type: Boolean, default: false },
        dataCommentList: { type: Array, default: () => [] },
        dataCommentListLoading: { type: Boolean, default: false },
        commentContent: { type: String, default: "" },
        btnLoading: { type: Boolean, default: false },
        isMobileDrawer: { type: Boolean, default: false },
        // 隐藏 wf-work-handler 内联的发起流程/处理工作提交按钮——由表单顶部的 CTA 接管
        hideInlineSubmit: { type: Boolean, default: false }
    },
    emits: ["update:modelValue", "update:commentContent", "submit-comment", "callback-start-work"],
    data() {
        return {
            innerActiveTab: this.modelValue || "WorkFlow"
        };
    },
    watch: {
        modelValue(v) {
            this.innerActiveTab = v;
        }
    },
    methods: {
        OnTabChange(v) {
            this.$emit("update:modelValue", v);
        },
        OnCallbackStartWork(payload) {
            this.$emit("callback-start-work", payload);
        }
    }
};
</script>

<style lang="scss" scoped>
.form-right-panel {
    padding: 8px 0;

    :deep(.form-right-tabs) {
        .el-tabs__header {
            margin: 0 0 12px 0;
        }
        .el-tabs__nav-wrap::after {
            background: var(--el-border-color-lighter, #e4e7ed);
            height: 1px;
        }
        .el-tabs__item {
            padding: 0 12px;
            font-size: 13px;
            font-weight: 500;

            .tab-label {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                .el-icon {
                    font-size: 14px;
                }
            }
        }
        .el-tabs__active-bar {
            height: 3px;
            border-radius: 2px;
        }
    }

    .panel-card {
        background: var(--el-bg-color, #fff);
        border-radius: 10px;
        padding: 12px;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
        border: 1px solid var(--el-border-color-lighter, #ebeef5);
    }

    .panel-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 0;
        gap: 6px;
        color: var(--el-text-color-placeholder, #a8abb2);
        font-size: 13px;
        .el-icon {
            font-size: 28px;
            opacity: 0.6;
        }
    }

    .comment-input-wrapper {
        margin-bottom: 16px;
        :deep(.el-textarea__inner) {
            border-radius: 8px;
            font-size: 13px;
        }
        .comment-actions {
            margin-top: 8px;
            text-align: right;
        }
    }

    .datalog-timeline {
        :deep(.el-timeline) {
            padding-left: 4px;
            padding-top: 4px;
        }
        :deep(.el-timeline-item) {
            padding-bottom: 16px;
        }
        :deep(.el-timeline-item__timestamp) {
            font-size: 12px;
            color: var(--el-text-color-secondary, #909399);
        }
    }

    .log-card {
        background: var(--el-fill-color-light, #f5f7fa);
        border-radius: 8px;
        padding: 8px 10px;
        margin-top: 4px;

        .log-title {
            font-weight: 600;
            font-size: 13px;
            color: var(--el-text-color-primary, #303133);
            margin-bottom: 6px;
        }

        .log-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            font-size: 12px;
            line-height: 1.6;
            padding: 2px 0;

            .log-field {
                color: var(--el-color-primary, #409eff);
                font-weight: 500;
                flex-shrink: 0;
            }
            .log-arrow {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: var(--el-text-color-regular, #606266);
                .log-old {
                    color: var(--el-text-color-placeholder, #a8abb2);
                    text-decoration: line-through;
                }
                .log-new {
                    color: var(--el-color-danger, #f56c6c);
                    font-weight: 500;
                }
                .el-icon {
                    color: var(--el-text-color-secondary, #909399);
                }
            }
        }

        .log-comment-content {
            font-size: 13px;
            line-height: 1.6;
            color: var(--el-text-color-regular, #606266);
            word-break: break-word;
        }
    }
}

.form-right-panel.is-mobile-drawer {
    padding: 0;
    .panel-card {
        border: none;
        box-shadow: none;
        background: transparent;
        padding: 0;
    }
}
</style>
