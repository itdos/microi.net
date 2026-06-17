<template>
    <div class="form-right-panel" :class="{ 'is-mobile-drawer': isMobileDrawer }">
        <el-tabs v-model="innerActiveTab" class="form-right-tabs" @update:model-value="OnTabChange">
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
                        :form-data="formData"
                        :HideInlineSubmit="hideInlineSubmit"
                        @CallbackStartWork="OnCallbackStartWork"
                        @CallbackSendWork="OnCallbackSendWork"
                        @CallbackGetFormData="OnCallbackGetFormData"
                        @CallbackFieldSet="OnCallbackFieldSet"
                    ></WFWorkHandler>
                </div>
            </el-tab-pane>

            <el-tab-pane v-if="enableDataLog" name="DataLog">
                <template #label>
                    <span class="tab-label">
                        <el-icon><Document /></el-icon>
                        <span>{{ $t ? $t('Msg.DataLog') || '数据日志' : '数据日志' }}</span>
                    </span>
                </template>
                <div class="panel-card">
                    <div class="panel-toolbar">
                        <div class="panel-toolbar-title">
                            <el-icon><Document /></el-icon>
                            <span>{{ $t ? $t('Msg.DataLog') || '数据日志' : '数据日志' }}</span>
                        </div>
                        <el-tooltip :content="$t ? $t('Msg.Refresh') || '刷新' : '刷新'" placement="top">
                            <el-button
                                circle
                                size="small"
                                :loading="dataLogListLoading"
                                @click="OnRefreshDataLog"
                            >
                                <el-icon v-if="!dataLogListLoading"><Refresh /></el-icon>
                            </el-button>
                        </el-tooltip>
                    </div>
                    <div class="datalog-timeline" v-loading="dataLogListLoading">
                        <el-timeline v-if="dataLogList && dataLogList.length > 0">
                            <el-timeline-item
                                v-for="item in dataLogList"
                                :key="item.Id"
                                type="primary"
                                size="large"
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
                                        :class="{ 'is-large': IsLargeLogValue(log) }"
                                    >
                                        <template v-if="IsLargeLogValue(log)">
                                            <div class="log-large-main">
                                                <span class="log-field">{{ log.Label }}</span>
                                                <div class="log-large-summary">
                                                    <span class="log-old">{{ GetLogSummary(log.OVal) }}</span>
                                                    <el-icon><ArrowRight /></el-icon>
                                                    <span class="log-new">{{ GetLogSummary(log.NVal) }}</span>
                                                </div>
                                            </div>
                                            <el-button size="small" text type="primary" @click="OpenLogDiff(log, item)">
                                                查看差异
                                            </el-button>
                                        </template>
                                        <template v-else>
                                            <span class="log-field">{{ log.Label }}</span>
                                            <span class="log-arrow">
                                                <span class="log-old">{{ GetDisplayValue(log.OVal) }}</span>
                                                <el-icon><ArrowRight /></el-icon>
                                                <span class="log-new">{{ GetDisplayValue(log.NVal) }}</span>
                                            </span>
                                        </template>
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

            <el-tab-pane v-if="enableDataComment" name="DataComment">
                <template #label>
                    <span class="tab-label">
                        <el-icon><ChatDotRound /></el-icon>
                        <span>{{ $t ? $t('Msg.DataComment') || '数据评论' : '数据评论' }}</span>
                    </span>
                </template>
                <div class="panel-card">
                    <div class="panel-toolbar">
                        <div class="panel-toolbar-title">
                            <el-icon><ChatDotRound /></el-icon>
                            <span>{{ $t ? $t('Msg.DataComment') || '数据评论' : '数据评论' }}</span>
                        </div>
                        <el-tooltip :content="$t ? $t('Msg.Refresh') || '刷新' : '刷新'" placement="top">
                            <el-button
                                circle
                                size="small"
                                :loading="dataCommentListLoading"
                                @click="OnRefreshDataComment"
                            >
                                <el-icon v-if="!dataCommentListLoading"><Refresh /></el-icon>
                            </el-button>
                        </el-tooltip>
                    </div>
                    <div class="comment-input-wrapper">
                        <div v-if="replyComment" class="comment-reply-target">
                            <div class="comment-reply-head">
                                <span>正在回复</span>
                                <strong>{{ GetCommentAuthor(replyComment) }}</strong>
                                <el-button size="small" text type="primary" @click="$emit('cancel-reply-comment')">取消</el-button>
                            </div>
                            <div class="comment-reply-preview">
                                {{ IsCommentQuoteExpanded(replyComment) ? GetCommentPlainText(replyComment.Content) : GetCommentBrief(replyComment.Content, 96) }}
                            </div>
                            <el-button
                                v-if="IsLongCommentText(replyComment.Content, 96)"
                                class="comment-quote-toggle"
                                size="small"
                                text
                                type="primary"
                                @click="ToggleCommentQuote(replyComment)"
                            >
                                {{ IsCommentQuoteExpanded(replyComment) ? '收起原文' : '展开原文' }}
                            </el-button>
                        </div>
                        <el-input
                            type="textarea"
                            :rows="3"
                            :placeholder="replyComment ? '请输入回复内容' : ($t ? $t('Msg.EnterCommentContent') : '请输入评论内容')"
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

                    <div class="datalog-timeline" v-loading="dataCommentListLoading">
                        <el-timeline v-if="dataCommentList && dataCommentList.length > 0">
                            <el-timeline-item
                                v-for="item in dataCommentList"
                                :key="item.Id"
                                type="primary"
                                size="large"
                                :timestamp="item.CreateTime"
                            >
                                <template #dot>
                                    <el-avatar :size="28" :src="item.Avatar"></el-avatar>
                                </template>
                                <div class="log-card">
                                    <div class="log-title">{{ GetCommentAuthor(item) }}</div>
                                    <div v-if="HasCommentQuote(item)" class="comment-quote">
                                        <div class="comment-quote-title">回复 {{ item.ReplyToUserName || '上一条评论' }}</div>
                                        <div class="comment-quote-content">
                                            {{ IsCommentQuoteExpanded(item) ? GetCommentPlainText(item.ReplyToContent) : GetCommentBrief(item.ReplyToContent, 90) }}
                                        </div>
                                        <el-button
                                            v-if="IsLongCommentText(item.ReplyToContent, 90)"
                                            class="comment-quote-toggle"
                                            size="small"
                                            text
                                            type="primary"
                                            @click="ToggleCommentQuote(item)"
                                        >
                                            {{ IsCommentQuoteExpanded(item) ? '收起原文' : '展开原文' }}
                                        </el-button>
                                    </div>
                                    <div class="log-comment-content" v-safe-html="item.Content"></div>
                                    <div class="comment-item-actions">
                                        <el-button size="small" text type="primary" @click="$emit('reply-comment', item)">
                                            <el-icon><ChatDotRound /></el-icon>
                                            回复
                                        </el-button>
                                    </div>
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

            <el-tab-pane v-if="enableDataVersion" name="DataVersion">
                <template #label>
                    <span class="tab-label">
                        <el-icon><Clock /></el-icon>
                        <span>数据版本</span>
                    </span>
                </template>
                <div class="panel-card">
                    <div class="panel-toolbar">
                        <div class="panel-toolbar-title">
                            <el-icon><Clock /></el-icon>
                            <span>数据版本</span>
                        </div>
                        <el-tooltip :content="$t ? $t('Msg.Refresh') || '刷新' : '刷新'" placement="top">
                            <el-button
                                circle
                                size="small"
                                :loading="dataVersionListLoading"
                                @click="OnRefreshDataVersion"
                            >
                                <el-icon v-if="!dataVersionListLoading"><Refresh /></el-icon>
                            </el-button>
                        </el-tooltip>
                    </div>
                    <div class="version-list" v-loading="dataVersionListLoading">
                        <div v-if="dataVersionList && dataVersionList.length > 0">
                            <div v-for="item in dataVersionList" :key="item.Id" class="version-card">
                                <div class="version-card-main">
                                    <div class="version-title">
                                        <el-tag size="small" type="primary" effect="dark">{{ item.Version || '1.0.0' }}</el-tag>
                                        <el-tag size="small" :type="GetVersionActionType(item.Action)" effect="plain">{{ GetVersionActionText(item.Action) }}</el-tag>
                                    </div>
                                    <div class="version-meta">
                                        <span>{{ item.CreateTime }}</span>
                                        <span>{{ item.UserName || item.CreateUser || item.UserId }}</span>
                                    </div>
                                </div>
                                <div class="version-actions">
                                    <el-button size="small" type="primary" plain @click="$emit('preview-data-version', item)">
                                        <el-icon><View /></el-icon>
                                        预览
                                    </el-button>
                                    <el-button size="small" type="warning" plain @click="$emit('load-data-version', item)">
                                        <el-icon><RefreshLeft /></el-icon>
                                        加载
                                    </el-button>
                                </div>
                            </div>
                        </div>
                        <div v-else class="panel-empty">
                            <el-icon><Clock /></el-icon>
                            <span>{{ dataVersionListLoading ? ($t ? $t('Msg.DataLoading') : '加载中...') : ($t ? $t('Msg.NoData') : '暂无版本') }}</span>
                        </div>
                    </div>
                </div>
            </el-tab-pane>
        </el-tabs>
        <el-dialog
            v-model="showLogDiffDialog"
            class="log-diff-dialog"
            :title="GetLogDiffTitle()"
            width="min(1180px, 92vw)"
            top="4vh"
            append-to-body
            destroy-on-close
            :close-on-click-modal="false"
        >
            <div class="log-diff-grid">
                <div class="log-diff-pane">
                    <div class="log-diff-pane-title is-old">修改前</div>
                    <pre>{{ GetLogDiffValue('OVal') }}</pre>
                </div>
                <div class="log-diff-pane">
                    <div class="log-diff-pane-title is-new">修改后</div>
                    <pre>{{ GetLogDiffValue('NVal') }}</pre>
                </div>
            </div>
        </el-dialog>
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
        enableDataVersion: { type: Boolean, default: false },
        dataLogList: { type: Array, default: () => [] },
        dataLogListLoading: { type: Boolean, default: false },
        dataCommentList: { type: Array, default: () => [] },
        dataCommentListLoading: { type: Boolean, default: false },
        dataVersionList: { type: Array, default: () => [] },
        dataVersionListLoading: { type: Boolean, default: false },
        diyFieldList: { type: Array, default: () => [] },
        commentContent: { type: String, default: "" },
        replyComment: { type: Object, default: null },
        btnLoading: { type: Boolean, default: false },
        isMobileDrawer: { type: Boolean, default: false },
        formData: { type: Object, default: () => ({}) },
        formMode: { type: String, default: "" },
        hideInlineSubmit: { type: Boolean, default: false }
    },
    emits: [
        "update:modelValue",
        "update:commentContent",
        "submit-comment",
        "callback-start-work",
        "callback-send-work",
        "callback-get-form-data",
        "callback-field-set",
        "refresh-data-log",
        "refresh-data-comment",
        "refresh-data-version",
        "preview-data-version",
        "load-data-version",
        "reply-comment",
        "cancel-reply-comment"
    ],
    data() {
        return {
            innerActiveTab: this.modelValue || "WorkFlow",
            showLogDiffDialog: false,
            currentLogDiff: null,
            expandedCommentQuotes: {}
        };
    },
    computed: {
        availableTabs() {
            var tabs = [];
            if (this.openDiyFormWorkFlow) tabs.push("WorkFlow");
            if (this.enableDataLog) tabs.push("DataLog");
            if (this.enableDataComment) tabs.push("DataComment");
            if (this.enableDataVersion) tabs.push("DataVersion");
            return tabs;
        },
        diyFieldMap() {
            var result = {};
            (this.diyFieldList || []).forEach(function (field) {
                if (field && field.Name) {
                    result[field.Name] = field;
                }
            });
            return result;
        }
    },
    watch: {
        modelValue(tabName) {
            this.SetActiveTab(tabName, true);
        },
        openDiyFormWorkFlow() {
            this.EnsureActiveTab();
        },
        enableDataLog() {
            this.EnsureActiveTab();
        },
        enableDataComment() {
            this.EnsureActiveTab();
        },
        enableDataVersion() {
            this.EnsureActiveTab();
        }
    },
    mounted() {
        this.EnsureActiveTab();
    },
    methods: {
        GetFirstAvailableTab() {
            return this.availableTabs.length > 0 ? this.availableTabs[0] : "";
        },
        GetAvailableTab(tabName) {
            if (tabName && this.availableTabs.indexOf(tabName) > -1) return tabName;
            return this.GetFirstAvailableTab();
        },
        EnsureActiveTab() {
            this.SetActiveTab(this.innerActiveTab || this.modelValue, true);
        },
        SetActiveTab(tabName, shouldEmit) {
            var nextTab = this.GetAvailableTab(tabName);
            if (this.innerActiveTab !== nextTab) {
                this.innerActiveTab = nextTab;
            }
            if (shouldEmit !== false && this.modelValue !== nextTab) {
                this.$emit("update:modelValue", nextTab);
            }
            this.RefreshActiveTabData(nextTab);
        },
        RefreshActiveTabData(tabName) {
            if (tabName === "DataLog" && !this.dataLogListLoading && (!this.dataLogList || this.dataLogList.length === 0)) {
                this.$emit("refresh-data-log");
            } else if (tabName === "DataComment" && !this.dataCommentListLoading && (!this.dataCommentList || this.dataCommentList.length === 0)) {
                this.$emit("refresh-data-comment");
            } else if (tabName === "DataVersion" && !this.dataVersionListLoading && (!this.dataVersionList || this.dataVersionList.length === 0)) {
                this.$emit("refresh-data-version");
            }
        },
        GetVersionActionType(action) {
            var map = {
                Add: "success",
                Update: "primary",
                Delete: "danger",
                Restore: "warning",
                Rollback: "info"
            };
            return map[action] || "info";
        },
        GetVersionActionText(action) {
            var map = {
                Add: "新增",
                Update: "修改",
                Delete: "删除",
                Restore: "恢复",
                Rollback: "回滚"
            };
            return map[action] || action || "版本";
        },
        GetEmptyText() {
            return this.$t ? (this.$t("Msg.EmptyValue") || "空") : "空";
        },
        NormalizeLogValue(value) {
            if (value === null || value === undefined || value === "") {
                return "";
            }
            if (typeof value === "object") {
                try {
                    return JSON.stringify(value, null, 2);
                } catch (error) {
                    return String(value);
                }
            }
            return String(value);
        },
        StripHtml(value) {
            var text = this.NormalizeLogValue(value);
            if (!text) return "";
            return text
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]*>/g, " ")
                .replace(/&nbsp;/g, " ")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, "\"")
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, " ")
                .trim();
        },
        GetDisplayValue(value) {
            return this.StripHtml(value) || this.GetEmptyText();
        },
        GetLogField(log) {
            if (!log || !log.Name) return {};
            return this.diyFieldMap[log.Name] || {};
        },
        IsLargeLogValue(log) {
            var field = this.GetLogField(log);
            var component = (log && log.Component) || field.Component || "";
            var largeComponents = ["RichText", "CodeEditor", "Textarea", "FileUpload", "ImgUpload", "TableChild", "Map", "JsonEditor"];
            var oldValue = this.NormalizeLogValue(log && log.OVal);
            var newValue = this.NormalizeLogValue(log && log.NVal);
            return largeComponents.indexOf(component) > -1
                || oldValue.length > 120
                || newValue.length > 120
                || oldValue.indexOf("\n") > -1
                || newValue.indexOf("\n") > -1
                || /<[^>]+>/.test(oldValue)
                || /<[^>]+>/.test(newValue);
        },
        GetLogSummary(value) {
            var text = this.GetDisplayValue(value);
            return text.length > 54 ? text.substr(0, 54) + "..." : text;
        },
        OpenLogDiff(log, item) {
            this.currentLogDiff = {
                log: log || {},
                item: item || {}
            };
            this.showLogDiffDialog = true;
        },
        GetLogDiffTitle() {
            var log = this.currentLogDiff && this.currentLogDiff.log;
            return "修改差异" + (log && log.Label ? " - " + log.Label : "");
        },
        GetLogDiffValue(key) {
            var log = this.currentLogDiff && this.currentLogDiff.log;
            return this.NormalizeLogValue(log && log[key]) || this.GetEmptyText();
        },
        GetCommentAuthor(comment) {
            if (!comment) return "用户";
            return comment.Title || comment.UserName || comment.CreateUserName || comment.CreateUser || comment.UserId || "用户";
        },
        GetCommentPlainText(content) {
            return this.StripHtml(content);
        },
        GetCommentBrief(content, maxLength) {
            var text = this.GetCommentPlainText(content);
            if (!text) return "原文为空";
            var max = maxLength || 90;
            return text.length > max ? text.substr(0, max) + "..." : text;
        },
        IsLongCommentText(content, maxLength) {
            return this.GetCommentPlainText(content).length > (maxLength || 90);
        },
        HasCommentQuote(item) {
            return !!(item && (item.ParentCommentId || item.ReplyToContent || item.ReplyToUserName));
        },
        GetCommentQuoteKey(item) {
            return (item && item.Id) || "__reply_target";
        },
        IsCommentQuoteExpanded(item) {
            return !!this.expandedCommentQuotes[this.GetCommentQuoteKey(item)];
        },
        ToggleCommentQuote(item) {
            var key = this.GetCommentQuoteKey(item);
            var next = Object.assign({}, this.expandedCommentQuotes);
            next[key] = !next[key];
            this.expandedCommentQuotes = next;
        },
        OnTabChange(tabName) {
            this.SetActiveTab(tabName, true);
        },
        OnRefreshDataLog() {
            this.$emit("refresh-data-log");
        },
        OnRefreshDataComment() {
            this.$emit("refresh-data-comment");
        },
        OnRefreshDataVersion() {
            this.$emit("refresh-data-version");
        },
        OnCallbackStartWork(payload, callback) {
            this.$emit("callback-start-work", payload, callback);
        },
        OnCallbackSendWork(payload, callback) {
            this.$emit("callback-send-work", payload, callback);
        },
        OnCallbackGetFormData(payload) {
            this.$emit("callback-get-form-data", payload);
        },
        OnCallbackFieldSet(fieldName, attrName, value) {
            this.$emit("callback-field-set", fieldName, attrName, value);
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
        border: 1px solid var(--el-border-color-lighter, #ebeef5);
        border-radius: 8px;
        padding: 12px;
    }

    .panel-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        min-height: 28px;

        .panel-toolbar-title {
            min-width: 0;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--el-text-color-primary, #303133);
            font-size: 13px;
            font-weight: 600;

            .el-icon {
                color: var(--el-color-primary, #409eff);
            }
        }

        :deep(.el-button.is-circle) {
            width: 28px;
            height: 28px;
            flex: 0 0 28px;
        }
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
        .comment-reply-target {
            position: relative;
            margin-bottom: 10px;
            padding: 10px 12px;
            border: 1px solid var(--el-color-primary-light-7, #a0cfff);
            border-radius: 8px;
            background: var(--el-color-primary-light-9, #ecf5ff);

            .comment-reply-head {
                display: flex;
                align-items: center;
                gap: 6px;
                color: var(--el-text-color-secondary, #909399);
                font-size: 12px;

                strong {
                    color: var(--el-text-color-primary, #303133);
                    font-weight: 600;
                }

                :deep(.el-button) {
                    margin-left: auto;
                    padding: 0 2px;
                }
            }

            .comment-reply-preview {
                margin-top: 6px;
                color: var(--el-text-color-regular, #606266);
                font-size: 12px;
                line-height: 1.6;
                word-break: break-word;
            }
        }
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

    .log-card,
    .version-card {
        background: var(--el-fill-color-light, #f5f7fa);
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 8px 10px;
    }

    .log-card {
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
            flex-wrap: nowrap;
            gap: 6px;
            font-size: 12px;
            line-height: 1.6;
            padding: 2px 0;
            min-width: 0;

            .log-field {
                color: var(--el-color-primary, #409eff);
                font-weight: 500;
                flex-shrink: 0;
                max-width: 108px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .log-arrow {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                min-width: 0;
                flex: 1;
                color: var(--el-text-color-regular, #606266);
                .log-old {
                    color: var(--el-text-color-placeholder, #a8abb2);
                    text-decoration: line-through;
                }
                .log-new {
                    color: var(--el-color-danger, #f56c6c);
                    font-weight: 500;
                }
                .log-old,
                .log-new {
                    min-width: 0;
                    max-width: 45%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .el-icon {
                    flex: 0 0 auto;
                    color: var(--el-text-color-secondary, #909399);
                }
            }

            &.is-large {
                align-items: flex-start;
                justify-content: space-between;
                gap: 8px;
                padding: 7px 0;
                border-top: 1px dashed var(--el-border-color-lighter, #ebeef5);

                &:first-of-type {
                    border-top: none;
                }

                .log-large-main {
                    min-width: 0;
                    flex: 1;
                }

                .log-large-summary {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    min-width: 0;
                    margin-top: 4px;
                    color: var(--el-text-color-secondary, #909399);

                    .log-old,
                    .log-new {
                        min-width: 0;
                        max-width: 42%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .log-old {
                        color: var(--el-text-color-placeholder, #a8abb2);
                        text-decoration: line-through;
                    }

                    .log-new {
                        color: var(--el-color-danger, #f56c6c);
                        font-weight: 500;
                    }

                    .el-icon {
                        flex: 0 0 auto;
                    }
                }

                :deep(.el-button) {
                    flex: 0 0 auto;
                    padding: 2px 4px;
                }
            }
        }

        .log-comment-content {
            font-size: 13px;
            line-height: 1.6;
            color: var(--el-text-color-regular, #606266);
            word-break: break-word;
        }

        .comment-quote {
            margin-bottom: 8px;
            padding: 8px 10px;
            border-left: 3px solid var(--el-color-primary-light-5, #79bbff);
            border-radius: 6px;
            background: var(--el-fill-color-blank, #fff);

            .comment-quote-title {
                margin-bottom: 4px;
                color: var(--el-text-color-secondary, #909399);
                font-size: 12px;
                font-weight: 600;
            }

            .comment-quote-content {
                color: var(--el-text-color-regular, #606266);
                font-size: 12px;
                line-height: 1.55;
                word-break: break-word;
            }
        }

        .comment-quote-toggle {
            margin-top: 3px;
            padding: 0;
            height: 20px;
        }

        .comment-item-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 6px;

            :deep(.el-button) {
                padding: 2px 4px;
            }
        }
    }

    .version-list {
        min-height: 90px;
    }

    .version-card {
        margin-bottom: 10px;
        transition: border-color 0.16s ease, background-color 0.16s ease;

        &:hover {
            border-color: var(--el-border-color, #dcdfe6);
            background: var(--el-fill-color-blank, #fff);
        }

        .version-card-main {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .version-title,
        .version-meta,
        .version-actions {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
        }

        .version-meta {
            color: var(--el-text-color-secondary, #909399);
            font-size: 12px;
            line-height: 1.4;
        }

        .version-actions {
            justify-content: flex-end;
            margin-top: 8px;

            :deep(.el-button) {
                margin-left: 0;
                min-width: 62px;
                padding: 5px 8px;
                border-radius: 6px;
            }
        }
    }
}

.form-right-panel.is-mobile-drawer {
    padding: 0;
    .panel-card {
        border: none;
        background: transparent;
        padding: 0;
    }
}

:global(.el-dialog.log-diff-dialog) {
    max-width: calc(100vw - 48px);
    margin-left: auto !important;
    margin-right: auto !important;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 18px 52px rgba(15, 23, 42, 0.2);
}

:global(.el-dialog.log-diff-dialog .el-dialog__header) {
    margin: 0;
    padding: 13px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}

:global(.el-dialog.log-diff-dialog .el-dialog__title) {
    font-size: 14px;
    font-weight: 600;
}

:global(.el-dialog.log-diff-dialog .el-dialog__body) {
    padding: 12px;
    max-height: 78vh;
    overflow: hidden;
    background: var(--el-fill-color-extra-light, #fafafa);
}

:global(.log-diff-dialog .log-diff-grid) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    height: min(680px, 72vh);
    min-height: 360px;
}

:global(.log-diff-dialog .log-diff-pane) {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    border-radius: 8px;
    overflow: hidden;
    background: var(--el-bg-color, #fff);
}

:global(.log-diff-dialog .log-diff-pane-title) {
    flex: 0 0 auto;
    padding: 9px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
    background: var(--el-fill-color-blank, #fff);
    font-size: 13px;
    font-weight: 600;
}

:global(.log-diff-dialog .log-diff-pane-title.is-old) {
    color: var(--el-text-color-secondary, #909399);
}

:global(.log-diff-dialog .log-diff-pane-title.is-new) {
    color: var(--el-color-danger, #f56c6c);
}

:global(.log-diff-dialog pre) {
    flex: 1;
    min-height: 0;
    margin: 0;
    overflow: auto;
    padding: 12px;
    color: var(--el-text-color-primary, #303133);
    font-family: Consolas, Monaco, "Courier New", monospace;
    font-size: 12px;
    line-height: 1.65;
    white-space: pre;
    tab-size: 4;
}

@media (max-width: 760px) {
    :global(.el-dialog.log-diff-dialog) {
        width: 92vw !important;
        max-width: 92vw;
    }

    :global(.log-diff-dialog .log-diff-grid) {
        grid-template-columns: 1fr;
        height: 76vh;
        min-height: 0;
    }
}
</style>
