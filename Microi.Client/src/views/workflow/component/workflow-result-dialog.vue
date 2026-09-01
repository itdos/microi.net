<template>
    <el-dialog
        v-model="Visible"
        class="mci-workflow-result-dialog"
        :title="$t(TitleKey)"
        width="560px"
        append-to-body
        align-center
        draggable
        destroy-on-close
        :close-on-click-modal="false"
        @closed="ResolveOpen(true)"
    >
        <section class="mci-workflow-result" aria-live="polite">
            <div class="mci-workflow-result__hero">
                <span class="mci-workflow-result__icon" aria-hidden="true">✓</span>
                <div class="mci-workflow-result__heading">
                    <span>{{ $t("Msg.WorkflowResultEyebrow") }}</span>
                    <strong>{{ $t(TitleKey) }}</strong>
                </div>
            </div>

            <div v-if="Result.FlowEnd" class="mci-workflow-result__completed">
                {{ $t("Msg.WorkflowEnded") }}
            </div>
            <dl v-else class="mci-workflow-result__details">
                <div class="mci-workflow-result__row">
                    <dt>{{ $t("Msg.WorkflowNextNode") }}</dt>
                    <dd>{{ Result.NextNodeName || $t("Msg.WorkflowNoNextNode") }}</dd>
                </div>
                <div class="mci-workflow-result__row mci-workflow-result__row--receivers">
                    <dt>{{ $t("Msg.WorkflowNextApprovers") }}</dt>
                    <dd v-if="Result.ReceiverNames.length" class="mci-workflow-result__receivers">
                        <span v-for="name in Result.ReceiverNames" :key="name">{{ name }}</span>
                    </dd>
                    <dd v-else>{{ $t("Msg.WorkflowNoApprover") }}</dd>
                </div>
            </dl>
        </section>

        <template #footer>
            <el-button type="primary" @click="Close">
                {{ $t("Msg.WorkflowAcknowledge") }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script>
const EMPTY_RESULT = Object.freeze({
    Action: "Process",
    FlowEnd: false,
    NextNodeName: "",
    ReceiverNames: []
});

export default {
    name: "WorkflowResultDialog",
    data() {
        return {
            Visible: false,
            Result: Object.assign({}, EMPTY_RESULT),
            OpenResolve: null,
            OpenResolved: true
        };
    },
    computed: {
        TitleKey() {
            var titleKeys = {
                Start: "Msg.WorkflowStartSuccess",
                Process: "Msg.WorkflowProcessSuccess",
                Handover: "Msg.WorkflowHandoverSuccess",
                Recall: "Msg.WorkflowRecallSuccess",
                Cancel: "Msg.WorkflowCancelSuccess"
            };
            return titleKeys[this.Result.Action] || titleKeys.Process;
        }
    },
    beforeUnmount() {
        this.ResolveOpen(false);
    },
    methods: {
        Normalize(payload) {
            var source = payload || {};
            var receiverNames = Array.isArray(source.Receivers)
                ? source.Receivers.map(function (receiver) {
                    if (typeof receiver === "string") return receiver.trim();
                    if (!receiver || typeof receiver !== "object") return "";
                    return String(receiver.Name || receiver.Account || receiver.Id || "").trim();
                }).filter(Boolean)
                : [];
            return {
                Action: source.Action || "Process",
                FlowEnd: source.FlowEnd === true || source.FlowEnd === 1 || source.FlowEnd === "1" || source.FlowEnd === "true" || source.FlowEnd === "True",
                NextNodeName: String(source.NextNodeName || "").trim(),
                ReceiverNames: Array.from(new Set(receiverNames))
            };
        },
        open(payload) {
            if (this.OpenResolve) this.ResolveOpen(false);
            this.Result = this.Normalize(payload);
            this.OpenResolved = false;
            this.Visible = true;
            return new Promise((resolve) => {
                this.OpenResolve = resolve;
            });
        },
        Close() {
            this.Visible = false;
        },
        ResolveOpen(acknowledged) {
            if (this.OpenResolved) return;
            this.OpenResolved = true;
            var resolve = this.OpenResolve;
            this.OpenResolve = null;
            if (resolve) resolve(acknowledged === true);
        }
    }
};
</script>

<style lang="scss" scoped>
.mci-workflow-result {
    display: flex;
    flex-direction: column;
    gap: 18px;
    color: var(--el-text-color-primary);
}

.mci-workflow-result__hero {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px;
    border: 1px solid color-mix(in srgb, var(--el-color-success) 24%, var(--el-border-color-lighter));
    border-radius: var(--mci-radius-xl, 20px);
    background: color-mix(in srgb, var(--el-color-success) 8%, var(--el-bg-color));
}

.mci-workflow-result__icon {
    display: inline-flex;
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    background: var(--el-color-success);
    color: var(--el-color-white, #fff);
    font-size: 25px;
    font-weight: 800;
    box-shadow: 0 10px 24px color-mix(in srgb, var(--el-color-success) 24%, transparent);
}

.mci-workflow-result__heading {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 5px;

    span {
        color: var(--el-color-success);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .14em;
    }

    strong {
        font-size: 20px;
        line-height: 1.35;
    }
}

.mci-workflow-result__completed {
    padding: 18px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--mci-radius-lg, 16px);
    background: var(--el-fill-color-extra-light);
    color: var(--el-text-color-regular);
    font-size: 15px;
    line-height: 1.7;
    text-align: center;
}

.mci-workflow-result__details {
    display: flex;
    flex-direction: column;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--mci-radius-lg, 16px);
    background: var(--el-bg-color);
}

.mci-workflow-result__row {
    display: grid;
    grid-template-columns: minmax(112px, 148px) minmax(0, 1fr);
    gap: 16px;
    padding: 16px 18px;

    & + & {
        border-top: 1px solid var(--el-border-color-lighter);
    }

    dt {
        color: var(--el-text-color-secondary);
        font-size: 13px;
        font-weight: 700;
    }

    dd {
        min-width: 0;
        margin: 0;
        color: var(--el-text-color-primary);
        overflow-wrap: anywhere;
    }
}

.mci-workflow-result__receivers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    span {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 4px 11px;
        border: 1px solid color-mix(in srgb, var(--el-color-primary) 22%, var(--el-border-color-lighter));
        border-radius: var(--mci-radius-full, 9999px);
        background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
        color: var(--el-color-primary);
        font-size: 13px;
        font-weight: 650;
    }
}

@media (max-width: 560px) {
    .mci-workflow-result__hero {
        padding: 15px;
    }

    .mci-workflow-result__row {
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 14px 15px;
    }
}
</style>
