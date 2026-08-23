<template>
    <el-dialog
        v-model="visible"
        class="mci-unified-dialog mci-import-dialog"
        modal-class="mci-unified-overlay"
        :title="dialogTitle"
        :width="dialogWidth"
        :modal-append-to-body="true"
        :close-on-click-modal="false"
        :close-on-press-escape="!submitting && !isTaskActive"
        :modal="true"
        :destroy-on-close="false"
        append-to-body
        align-center
        draggable
        @closed="handleDialogClosed"
    >
        <div class="mci-import-dialog__intro">
            <div class="mci-import-dialog__description">
                {{ dialogDescription || $t("Msg.ImportSmartHint") }}
            </div>
            <el-tag type="info" effect="plain" round>{{ $t("Msg.ImportServerValidation") }}</el-tag>
        </div>

        <el-upload
            ref="workbookUpload"
            class="upload-drag-style mci-import-dialog__upload"
            :class="{ 'is-compact': Boolean(selectedFile) }"
            :action="importApi"
            :accept="customAccept"
            :auto-upload="false"
            :data="uploadData"
            :headers="{ authorization: authHeader }"
            :disabled="parsing || submitting || isTaskActive"
            :limit="1"
            :show-file-list="false"
            :on-change="handleFileChange"
            :on-exceed="handleFileExceed"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            :before-upload="handleBeforeUpload"
            drag
        >
            <el-icon class="mci-import-dialog__upload-icon"><Upload /></el-icon>
            <div class="el-upload__text">
                {{ selectedFile ? $t("Msg.ImportChangeFile") : $t("Msg.UploadDesc") }}
            </div>
            <template #tip>
                <div class="el-upload__tip">{{ $t("Msg.OnlyXlsFile") }}</div>
            </template>
        </el-upload>

        <section v-if="selectedFile" class="mci-import-dialog__workspace" aria-live="polite">
            <div class="mci-import-dialog__file-summary">
                <div>
                    <strong>{{ selectedFile.name }}</strong>
                    <span>{{ formatFileSize(selectedFile.size) }}</span>
                </div>
                <div v-if="parsedImport" class="mci-import-dialog__summary-tags">
                    <el-tag :type="confidenceTagType" effect="light" round>
                        {{ $t("Msg.ImportConfidence") }}：{{ confidenceText }}
                    </el-tag>
                    <el-tag type="success" effect="plain" round>
                        {{ parsedImport.rows.length || parsedImport.sourceRowCount }} {{ $t("Msg.ImportRows") }}
                    </el-tag>
                    <el-tag type="info" effect="plain" round>
                        {{ parsedImport.mappedColumnCount }} {{ $t("Msg.ImportMappedColumns") }}
                    </el-tag>
                </div>
            </div>

            <el-skeleton v-if="parsing" :rows="6" animated />

            <template v-else-if="parsedImport">
                <el-alert
                    v-if="needsManualReview"
                    class="mci-import-dialog__review-alert"
                    type="warning"
                    :closable="false"
                    show-icon
                    :title="$t('Msg.ImportManualReviewHint')"
                />

                <div class="mci-import-dialog__settings">
                    <div class="mci-import-dialog__settings-title">
                        <span>{{ $t("Msg.ImportWorkbookSettings") }}</span>
                        <div>
                            <el-button :icon="MagicStick" @click="autoDetectWorkbook">
                                {{ $t("Msg.ImportAutoDetect") }}
                            </el-button>
                            <el-button type="primary" plain :icon="RefreshRight" @click="applyManualSettings">
                                {{ $t("Msg.ImportApplySettings") }}
                            </el-button>
                        </div>
                    </div>
                    <div class="mci-import-dialog__settings-grid">
                        <label>
                            <span>{{ $t("Msg.ImportSheet") }}</span>
                            <el-select v-model="analysisSettings.sheetIndex" @change="handleSheetChange">
                                <el-option
                                    v-for="(sheetName, index) in parsedImport.sheetNames"
                                    :key="sheetName"
                                    :label="sheetName"
                                    :value="index"
                                />
                            </el-select>
                        </label>
                        <label>
                            <span>{{ $t("Msg.ImportHeaderStartRow") }}</span>
                            <el-input-number v-model="analysisSettings.headerStartRow" :min="1" controls-position="right" />
                        </label>
                        <label>
                            <span>{{ $t("Msg.ImportHeaderEndRow") }}</span>
                            <el-input-number v-model="analysisSettings.headerEndRow" :min="1" controls-position="right" />
                        </label>
                        <label>
                            <span>{{ $t("Msg.ImportDataStartRow") }}</span>
                            <el-input-number v-model="analysisSettings.dataStartRow" :min="1" controls-position="right" />
                        </label>
                        <label>
                            <span>{{ $t("Msg.ImportDataEndRow") }}</span>
                            <el-input-number v-model="analysisSettings.dataEndRow" :min="1" controls-position="right" />
                        </label>
                    </div>
                </div>

                <el-tabs v-model="activeTab" class="mci-import-dialog__tabs">
                    <el-tab-pane :label="$t('Msg.ImportPreview')" name="preview">
                        <div class="mci-import-dialog__table-wrap">
                            <el-table
                                :data="previewRows"
                                border
                                stripe
                                height="330"
                                table-layout="fixed"
                                empty-text="-"
                            >
                                <el-table-column
                                    prop="_ExcelRow"
                                    :label="$t('Msg.ImportExcelRow')"
                                    width="82"
                                    fixed="left"
                                    align="center"
                                />
                                <el-table-column
                                    v-for="column in previewColumns"
                                    :key="'preview_' + column.columnIndex + '_' + column.targetName"
                                    :prop="column.targetName"
                                    :label="column.targetLabel || column.header || column.columnLetter"
                                    min-width="150"
                                    show-overflow-tooltip
                                >
                                    <template #header>
                                        <div class="mci-import-dialog__preview-head">
                                            <span>{{ column.targetLabel || column.header || column.columnLetter }}</span>
                                            <small>{{ column.columnLetter }} · {{ column.header || "-" }}</small>
                                        </div>
                                    </template>
                                    <template #default="scope">
                                        {{ formatPreviewValue(scope.row[column.targetName]) }}
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                        <el-pagination
                            v-if="parsedImport.rows.length > previewPageSize"
                            v-model:current-page="previewPage"
                            class="mci-import-dialog__pagination"
                            background
                            layout="total, prev, pager, next"
                            :page-size="previewPageSize"
                            :total="parsedImport.rows.length"
                        />
                    </el-tab-pane>

                    <el-tab-pane :label="$t('Msg.ImportColumnMapping')" name="mapping">
                        <el-table :data="parsedImport.columns" border stripe height="360" table-layout="fixed">
                            <el-table-column :label="$t('Msg.ImportExcelColumn')" width="105" align="center">
                                <template #default="scope"><strong>{{ scope.row.columnLetter }}</strong></template>
                            </el-table-column>
                            <el-table-column prop="header" :label="$t('Msg.ImportDetectedHeader')" min-width="210" show-overflow-tooltip />
                            <el-table-column :label="$t('Msg.ImportTargetField')" min-width="230">
                                <template #default="scope">
                                    <el-select
                                        :model-value="scope.row.targetName"
                                        clearable
                                        filterable
                                        :placeholder="$t('Msg.ImportIgnoreColumn')"
                                        @change="updateColumnMapping(scope.row.columnIndex, $event)"
                                    >
                                        <el-option
                                            v-for="target in availableTargets(scope.row)"
                                            :key="target.name"
                                            :label="target.label + ' (' + target.name + ')'"
                                            :value="target.name"
                                        />
                                    </el-select>
                                </template>
                            </el-table-column>
                            <el-table-column :label="$t('Msg.ImportSampleValue')" min-width="240" show-overflow-tooltip>
                                <template #default="scope">
                                    {{ scope.row.samples.map(formatPreviewValue).join(" / ") || "-" }}
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-tab-pane>
                </el-tabs>
            </template>

            <p v-if="customError" class="mci-import-dialog__error">{{ customError }}</p>
        </section>

        <section v-if="backgroundTask || uploadSucceeded" class="mci-import-dialog__status" aria-live="polite">
            <div class="mci-import-dialog__status-head">
                <div>
                    <div class="mci-import-dialog__status-label">{{ $t("Msg.ImportStatus") }}</div>
                    <strong>{{ customStatusTitle }}</strong>
                </div>
                <el-tag :type="customStatusType" round>{{ customStatusText }}</el-tag>
            </div>
            <el-progress
                v-if="backgroundTask"
                class="mci-import-dialog__progress"
                :percentage="customProgressPercentage"
                :indeterminate="customProgressIndeterminate"
                :status="customProgressStatus"
                :stroke-width="10"
            />
            <p v-if="customProgressMessage" class="mci-import-dialog__message">{{ customProgressMessage }}</p>
            <div v-if="customResultItems.length" class="mci-import-dialog__results">
                <div class="mci-import-dialog__results-title">{{ $t("Msg.ImportResult") }}</div>
                <div v-for="(item, index) in customResultItems" :key="'customResult_' + index" class="mci-import-dialog__result-row">
                    {{ item }}
                </div>
            </div>
        </section>

        <div v-if="!isCustomImport" class="mci-import-dialog__legacy-tools">
            <div class="mci-import-dialog__legacy-actions">
                <el-button :icon="RefreshRight" @click="getImportProgress">{{ $t("Msg.ViewProgress") }}</el-button>
                <el-tooltip v-if="isAdmin" effect="dark" :content="$t('Msg.Tips')" placement="top">
                    <el-button :icon="Warning" @click="delImportProgress">{{ $t("Msg.ClearImportCache") }}</el-button>
                </el-tooltip>
            </div>
            <div v-if="importStepList.length" class="mci-import-dialog__legacy-progress" aria-live="polite">
                <div v-for="(message, index) in importStepList" :key="'importStep_' + index">{{ message }}</div>
            </div>
        </div>

        <template #footer>
            <div class="mci-import-dialog__footer-hint">
                {{ parsedImport && !uploadSucceeded && !isTaskSucceeded ? $t("Msg.ImportConfirmHint") : "" }}
            </div>
            <el-button :icon="Close" :disabled="submitting || isTaskActive" @click="visible = false">
                {{ $t("Msg.Close") }}
            </el-button>
            <el-button
                v-if="!isImportSucceeded"
                type="primary"
                :icon="Upload"
                :loading="parsing || submitting || isTaskActive"
                :disabled="!canStartImport"
                @click="startImport"
            >
                {{ submitting || isTaskActive ? $t("Msg.ImportRunning") : $t("Msg.StartImport") }}
            </el-button>
            <el-button v-else type="primary" :icon="CircleCheckFilled" @click="finishImport">
                {{ $t("Msg.ImportDone") }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script>
import { markRaw } from "vue";
import { CircleCheckFilled, Close, MagicStick, RefreshRight, Upload, Warning } from "@element-plus/icons-vue";
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";
import {
    analyzeExcelWorkbook,
    buildImportMetadata,
    buildImportTargets,
    IMPORT_PREVIEW_PAGE_SIZE
} from "@/views/form-engine/utils/excel-import-analyzer";

const ACTIVE_TASK_STATUSES = ["Pending", "Running", "Retrying"];
const TERMINAL_TASK_STATUSES = ["Succeeded", "Failed", "Canceled"];

export default {
    name: "DiyImportDialog",
    components: { Upload },
    props: {
        tableId: { type: String, required: true },
        diyFieldList: { type: Array, default: () => [] },
        sysMenuModel: { type: Object, default: () => ({}) },
        isAdmin: { type: Boolean, default: false },
        tableChildFkFieldName: { type: String, default: "" },
        fatherFormModelData: { type: Object, default: null },
        primaryTableFieldName: { type: String, default: "" },
        tableChildTableRowId: { type: String, default: "" },
        tableChildImportContext: { type: Object, default: () => ({}) }
    },
    emits: ["import-success"],
    data() {
        return {
            DiyCommon,
            DiyApi,
            visible: false,
            dialogOptions: {},
            importStepList: [],
            selectedFile: null,
            parsedImport: null,
            parsing: false,
            submitting: false,
            customError: "",
            backgroundTaskId: "",
            backgroundTask: null,
            customSuccessEmitted: false,
            uploadSucceeded: false,
            uploadResult: null,
            activeTab: "preview",
            previewPage: 1,
            previewPageSize: IMPORT_PREVIEW_PAGE_SIZE,
            analysisSettings: { sheetIndex: 0, headerStartRow: 1, headerEndRow: 1, dataStartRow: 2, dataEndRow: 2 },
            manualMappings: {},
            _xlsx: null,
            _workbook: null,
            _importStepTimer: null,
            _backgroundTaskTimer: null,
            RefreshRight,
            Warning,
            Close,
            Upload,
            MagicStick,
            CircleCheckFilled
        };
    },
    computed: {
        isCustomImport() {
            return Boolean(this.dialogOptions && this.dialogOptions.ApiEngineKey);
        },
        isImportSucceeded() {
            return this.isTaskSucceeded || this.uploadSucceeded;
        },
        dialogTitle() {
            return (this.dialogOptions && this.dialogOptions.Title) || this.$t("Msg.Import");
        },
        dialogDescription() {
            return (this.dialogOptions && this.dialogOptions.Description) || "";
        },
        dialogWidth() {
            return (this.dialogOptions && this.dialogOptions.Width) || "80%";
        },
        customAccept() {
            return (this.dialogOptions && this.dialogOptions.Accept) || ".xls,.xlsx";
        },
        importApi() {
            if (this.sysMenuModel && this.sysMenuModel.ImportApi) return this.DiyCommon.RepalceUrlKey(this.sysMenuModel.ImportApi);
            return this.DiyCommon.GetApiBase() + "/api/FormEngine/ImportDiyTableRow";
        },
        importProgressApi() {
            if (this.sysMenuModel && this.sysMenuModel.ImportProgressApi) return this.DiyCommon.RepalceUrlKey(this.sysMenuModel.ImportProgressApi);
            return this.DiyApi.GetImportDiyTableRowStep;
        },
        authHeader() {
            return "Bearer " + this.DiyCommon.Authorization();
        },
        importMetadata() {
            return buildImportMetadata(this.parsedImport);
        },
        uploadData() {
            const result = {
                Limit: true,
                TableId: this.tableId,
                UserId: this.$store?.getters?.GetCurrentUser?.Id || ""
            };
            this.appendMenuContext(result);
            const fixedFormData = this.buildChildImportFixedData();
            if (Object.keys(fixedFormData).length > 0) result._FieldId = JSON.stringify(fixedFormData);
            if (this.tableChildFkFieldName) result.TableChildFkFieldName = this.tableChildFkFieldName;
            if (this.primaryTableFieldName) result.PrimaryTableFieldName = this.primaryTableFieldName;
            if (this.tableChildTableRowId) result.ParentTableRowId = this.tableChildTableRowId;
            if (this.tableChildImportContext && Object.keys(this.tableChildImportContext).length > 0) {
                result._ChildImportContext = JSON.stringify(this.tableChildImportContext);
            }
            if (this.importMetadata) {
                result._ImportSheetIndex = this.importMetadata.SheetIndex;
                result._ImportHeaderStartRow = this.importMetadata.HeaderStartRow;
                result._ImportHeaderEndRow = this.importMetadata.HeaderEndRow;
                result._ImportDataStartRow = this.importMetadata.DataStartRow;
                result._ImportDataEndRow = this.importMetadata.DataEndRow;
                result._ImportColumnsJson = JSON.stringify(this.importMetadata.Columns);
                result._ImportMetaJson = JSON.stringify(this.importMetadata);
            }
            return result;
        },
        previewColumns() {
            return this.parsedImport ? this.parsedImport.columns.filter((column) => column.targetName) : [];
        },
        previewRows() {
            if (!this.parsedImport) return [];
            const start = (this.previewPage - 1) * this.previewPageSize;
            return this.parsedImport.rows.slice(start, start + this.previewPageSize);
        },
        needsManualReview() {
            return Boolean(this.parsedImport && (this.parsedImport.confidence === "low" || !this.parsedImport.mappedColumnCount));
        },
        confidenceText() {
            if (!this.parsedImport) return "";
            const labels = {
                high: this.$t("Msg.ImportConfidenceHigh"),
                medium: this.$t("Msg.ImportConfidenceMedium"),
                low: this.$t("Msg.ImportConfidenceLow"),
                manual: this.$t("Msg.ImportConfidenceManual")
            };
            return labels[this.parsedImport.confidence] || labels.low;
        },
        confidenceTagType() {
            if (!this.parsedImport) return "info";
            if (this.parsedImport.confidence === "high") return "success";
            if (this.parsedImport.confidence === "low") return "warning";
            return "info";
        },
        isTaskActive() {
            return Boolean(this.backgroundTask && ACTIVE_TASK_STATUSES.includes(this.backgroundTask.Status));
        },
        isTaskSucceeded() {
            return Boolean(this.backgroundTask && this.backgroundTask.Status === "Succeeded");
        },
        canStartImport() {
            return Boolean(
                this.parsedImport
                && this.parsedImport.rows.length
                && this.parsedImport.mappedColumnCount
                && !this.parsing
                && !this.submitting
                && !this.isTaskActive
                && !this.backgroundTaskId
                && !this.uploadSucceeded
            );
        },
        customProgressPercentage() {
            if (!this.backgroundTask) return this.uploadSucceeded ? 100 : 0;
            if (this.backgroundTask.Status === "Succeeded") return 100;
            return Math.max(0, Math.min(100, Number(this.backgroundTask.Progress || 0)));
        },
        customProgressIndeterminate() {
            return this.isTaskActive && Number(this.backgroundTask?.Total || 0) <= 0;
        },
        customProgressStatus() {
            if (this.uploadSucceeded || this.backgroundTask?.Status === "Succeeded") return "success";
            if (["Failed", "Canceled"].includes(this.backgroundTask?.Status)) return "exception";
            return undefined;
        },
        customStatusTitle() {
            if (this.customError) return this.$t("Msg.ImportFailed");
            if (this.uploadSucceeded) return this.$t("Msg.ImportSucceeded");
            if (this.backgroundTask) return this.backgroundTask.Title || this.dialogTitle;
            if (this.parsing) return this.$t("Msg.ParsingWorkbook");
            if (this.parsedImport) return this.$t("Msg.ReadyToImport");
            return this.$t("Msg.SelectImportFile");
        },
        customStatusText() {
            if (this.customError) return this.$t("Msg.ImportFailed");
            if (this.uploadSucceeded) return this.$t("Msg.ImportSucceeded");
            const status = this.backgroundTask && this.backgroundTask.Status;
            const labels = {
                Pending: this.$t("Msg.ImportPending"),
                Running: this.$t("Msg.ImportRunning"),
                Retrying: this.$t("Msg.ImportRetrying"),
                Succeeded: this.$t("Msg.ImportSucceeded"),
                Failed: this.$t("Msg.ImportFailed"),
                Canceled: this.$t("Msg.ImportCanceled")
            };
            return labels[status] || "";
        },
        customStatusType() {
            const status = this.backgroundTask && this.backgroundTask.Status;
            if (this.uploadSucceeded || status === "Succeeded") return "success";
            if (["Failed", "Canceled"].includes(status) || this.customError) return "danger";
            if (status === "Pending") return "info";
            return "warning";
        },
        customProgressMessage() {
            if (this.uploadSucceeded) return (this.uploadResult && this.uploadResult.Msg) || this.$t("Msg.ImportSucceeded");
            if (!this.backgroundTask) return "";
            const task = this.backgroundTask;
            const unitText = Number(task.Total || 0) > 0 ? ` ${Number(task.Current || 0)}/${Number(task.Total || 0)}` : "";
            return (task.Msg || task.Message || this.customStatusText) + unitText;
        },
        customResultItems() {
            if (!this.backgroundTask) return [];
            let result = this.backgroundTask.Result;
            if (typeof result === "string") {
                try {
                    result = JSON.parse(result);
                } catch (_) {
                    return result ? [result] : [];
                }
            }
            const data = result && result.Data !== undefined ? result.Data : result;
            if (!data) return [];
            const items = [];
            if (data.ProjectName) items.push(`${this.$t("Msg.ImportProject")}: ${data.ProjectName}`);
            if (data.ImportedCount !== undefined) items.push(`${this.$t("Msg.ImportedRows")}: ${data.ImportedCount}`);
            if (data.BatchNo) items.push(`${this.$t("Msg.ImportBatch")}: ${data.BatchNo}`);
            if (Array.isArray(data.Results)) {
                data.Results.slice(0, 30).forEach((row) => {
                    const line = row.ExcelRow || row.LineNo || "-";
                    items.push(`${line}: ${row.SourceSpecification || ""} → ${row.Specification || row.Msg || ""}`);
                });
            }
            return items;
        }
    },
    methods: {
        appendMenuContext(target) {
            const menu = this.sysMenuModel || {};
            if (menu.Id) target._SysMenuId = menu.Id;
            if (menu.ModuleEngineKey) target.ModuleEngineKey = menu.ModuleEngineKey;
            return target;
        },
        mergeFixedImportValue(target, key, value) {
            if (key && value !== undefined && value !== null && value !== "") target[key] = value;
        },
        mergeFixedImportObject(target, source) {
            if (!source) return;
            let sourceObj = source;
            if (typeof source === "string") {
                try {
                    sourceObj = JSON.parse(source);
                } catch (_) {
                    sourceObj = null;
                }
            }
            if (!sourceObj || typeof sourceObj !== "object") return;
            Object.keys(sourceObj).forEach((key) => this.mergeFixedImportValue(target, key, sourceObj[key]));
        },
        buildChildImportFixedData() {
            const fixedFormData = {};
            const context = this.tableChildImportContext || {};
            this.mergeFixedImportObject(fixedFormData, context.FixedValues);
            this.mergeFixedImportObject(fixedFormData, context.FieldValues);
            this.mergeFixedImportObject(fixedFormData, context._FieldId);
            if (this.tableChildFkFieldName) {
                const fkValue = this.fatherFormModelData
                    ? (this.primaryTableFieldName ? this.fatherFormModelData[this.primaryTableFieldName] : this.fatherFormModelData.Id)
                    : this.tableChildTableRowId;
                this.mergeFixedImportValue(fixedFormData, this.tableChildFkFieldName, fkValue);
            }
            return fixedFormData;
        },
        clearImportState(clearSelectedFile = true) {
            this.stopBackgroundTaskPolling();
            if (clearSelectedFile) this.selectedFile = null;
            this.parsedImport = null;
            this.parsing = false;
            this.submitting = false;
            this.customError = "";
            this.backgroundTaskId = "";
            this.backgroundTask = null;
            this.customSuccessEmitted = false;
            this.uploadSucceeded = false;
            this.uploadResult = null;
            this.activeTab = "preview";
            this.previewPage = 1;
            this.manualMappings = {};
            this._xlsx = null;
            this._workbook = null;
            if (clearSelectedFile && this.$refs.workbookUpload?.clearFiles) this.$refs.workbookUpload.clearFiles();
        },
        show(options) {
            this.dialogOptions = options && typeof options === "object" ? { ...options } : {};
            this.clearImportState(true);
            this.visible = true;
        },
        hide() {
            this.visible = false;
        },
        validateExcelFile(file) {
            const name = String(file && file.name || "");
            const maxSizeMb = Number(this.dialogOptions.MaxFileSizeMB || 20);
            if (!/\.xlsx?$/i.test(name)) throw new Error(this.$t("Msg.OnlyXlsFile"));
            if (Number(file.size || 0) > maxSizeMb * 1024 * 1024) throw new Error(this.$t("Msg.ImportFileTooLarge", { size: maxSizeMb }));
        },
        async handleFileChange(uploadFile) {
            const file = uploadFile && uploadFile.raw;
            if (!file) return;
            this.clearImportState(false);
            this.selectedFile = file;
            this.parsing = true;
            try {
                this.validateExcelFile(file);
                const module = await import("xlsx");
                this._xlsx = module.default || module;
                this._workbook = markRaw(this._xlsx.read(await file.arrayBuffer(), { type: "array", cellDates: true }));
                this.runWorkbookAnalysis("initial");
                if (!this.parsedImport.sourceRowCount) throw new Error(this.$t("Msg.ImportNoRows"));
            } catch (error) {
                this.customError = this.formatAnalysisError(error);
                this.parsedImport = null;
            } finally {
                this.parsing = false;
            }
        },
        handleFileExceed(files) {
            const file = Array.isArray(files) ? files[0] : null;
            const uploader = this.$refs.workbookUpload;
            if (!file || !uploader) return;
            if (typeof uploader.clearFiles === "function") uploader.clearFiles();
            file.uid = file.uid || Date.now();
            if (typeof uploader.handleStart === "function") uploader.handleStart(file);
        },
        analysisOptions(mode) {
            const workbookConfig = this.dialogOptions.Workbook || {};
            const configuredColumns = Array.isArray(workbookConfig.Columns) ? workbookConfig.Columns : [];
            const initial = mode === "initial";
            const manual = mode === "manual";
            const configuredSheetIndex = workbookConfig.SheetIndex;
            const hasConfiguredSheet = Boolean(String(workbookConfig.SheetName || "").trim())
                || (configuredSheetIndex !== undefined && configuredSheetIndex !== null && configuredSheetIndex !== "");
            return {
                sheetName: initial ? workbookConfig.SheetName : undefined,
                sheetIndex: initial
                    ? (hasConfiguredSheet ? Number(configuredSheetIndex || 0) : undefined)
                    : Number(this.analysisSettings.sheetIndex || 0),
                autoDetectSheet: initial && !hasConfiguredSheet,
                headerStartRow: initial ? workbookConfig.HeaderStartRow : (manual ? this.analysisSettings.headerStartRow : null),
                headerEndRow: initial ? workbookConfig.HeaderEndRow : (manual ? this.analysisSettings.headerEndRow : null),
                dataStartRow: initial ? workbookConfig.DataStartRow : (manual ? this.analysisSettings.dataStartRow : null),
                dataEndRow: initial ? workbookConfig.DataEndRow : (manual ? this.analysisSettings.dataEndRow : null),
                maxHeaderRows: workbookConfig.MaxHeaderRows || 4,
                maxRows: this.dialogOptions.MaxRows || (this.isCustomImport ? 5000 : 50000),
                maxColumns: this.dialogOptions.MaxColumns || 256,
                manualMappings: manual ? this.manualMappings : {},
                cells: workbookConfig.Cells || {},
                keyField: workbookConfig.KeyField || "",
                targets: buildImportTargets(this.diyFieldList, configuredColumns)
            };
        },
        runWorkbookAnalysis(mode) {
            if (!this._xlsx || !this._workbook) return;
            const analysis = analyzeExcelWorkbook(this._xlsx, this._workbook, this.analysisOptions(mode));
            this.parsedImport = analysis;
            this.analysisSettings = {
                sheetIndex: analysis.sheetIndex,
                headerStartRow: analysis.headerStartRow,
                headerEndRow: analysis.headerEndRow,
                dataStartRow: analysis.dataStartRow,
                dataEndRow: analysis.dataEndRow
            };
            this.previewPage = 1;
            this.customError = "";
        },
        autoDetectWorkbook() {
            this.manualMappings = {};
            try {
                this.runWorkbookAnalysis("auto");
            } catch (error) {
                this.customError = this.formatAnalysisError(error);
            }
        },
        handleSheetChange() {
            this.manualMappings = {};
            this.autoDetectWorkbook();
        },
        applyManualSettings() {
            if (Number(this.analysisSettings.headerStartRow) > Number(this.analysisSettings.headerEndRow)) {
                this.customError = this.$t("Msg.ImportHeaderRangeInvalid");
                return;
            }
            if (
                Number(this.analysisSettings.dataStartRow) <= Number(this.analysisSettings.headerEndRow)
                || Number(this.analysisSettings.dataStartRow) > Number(this.analysisSettings.dataEndRow)
            ) {
                this.customError = this.$t("Msg.ImportDataRangeInvalid");
                return;
            }
            try {
                this.runWorkbookAnalysis("manual");
            } catch (error) {
                this.customError = this.formatAnalysisError(error);
            }
        },
        updateColumnMapping(columnIndex, targetName) {
            const mappings = {};
            (this.parsedImport?.columns || []).forEach((column) => {
                mappings[column.columnIndex] = column.targetName || "";
            });
            mappings[columnIndex] = targetName || "";
            this.manualMappings = mappings;
            this.applyManualSettings();
        },
        availableTargets(currentColumn) {
            const used = new Set(
                (this.parsedImport?.columns || [])
                    .filter((column) => column.columnIndex !== currentColumn.columnIndex && column.targetName)
                    .map((column) => column.targetName)
            );
            return (this.parsedImport?.targets || []).filter((target) => target.name === currentColumn.targetName || !used.has(target.name));
        },
        formatAnalysisError(error) {
            if (error && error.code === "IMPORT_TOO_MANY_ROWS") return this.$t("Msg.ImportTooManyRows", { count: error.limit });
            return error && error.message ? error.message : String(error);
        },
        formatPreviewValue(value) {
            if (value === null || value === undefined || value === "") return "-";
            if (value instanceof Date) return value.toISOString();
            if (typeof value === "object") return JSON.stringify(value);
            return String(value);
        },
        formatFileSize(value) {
            const bytes = Number(value || 0);
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        },
        async startImport() {
            if (!this.canStartImport) return;
            if (this.isCustomImport) {
                await this.startCustomImport();
                return;
            }
            this.customError = "";
            this.submitting = true;
            const uploader = this.$refs.workbookUpload;
            if (!uploader || typeof uploader.submit !== "function") {
                this.submitting = false;
                this.customError = this.$t("Msg.ImportSubmitFailed");
                return;
            }
            uploader.submit();
        },
        async startCustomImport() {
            this.submitting = true;
            this.customError = "";
            try {
                const options = this.dialogOptions || {};
                const operationId = this.DiyCommon.NewGuid();
                const params = Object.assign({}, options.Param || {}, {
                    _ImportRowsJson: JSON.stringify(this.parsedImport.rows),
                    _ImportMetaJson: JSON.stringify(this.importMetadata),
                    _ImportFileName: this.selectedFile.name,
                    _ImportFileSize: this.selectedFile.size
                });
                const backgroundOptions = Object.assign({
                    IdempotencyKey: `${options.ApiEngineKey}:${operationId}`,
                    ConcurrencyKey: options.ApiEngineKey,
                    MaxAttempts: 1
                }, options.BackgroundOptions || {});
                const result = await this.DiyCommon.ApiEngine.RunBackground(
                    options.ApiEngineKey,
                    params,
                    options.TaskTitle || this.dialogTitle,
                    backgroundOptions
                );
                if (!result || Number(result.Code) !== 1) {
                    throw new Error((result && (result.Msg || result.Message)) || this.$t("Msg.ImportSubmitFailed"));
                }
                const taskData = result.Data || {};
                this.backgroundTaskId = taskData.Id || taskData.TaskId || taskData.BackgroundTaskId || "";
                this.backgroundTask = Object.assign({ Status: "Pending", Progress: 0 }, taskData);
                if (!this.backgroundTaskId) throw new Error(this.$t("Msg.ImportTaskIdMissing"));
                try {
                    window.dispatchEvent(new CustomEvent("microi-background-task-started", { detail: result }));
                } catch (_) { }
                await this.pollBackgroundTask();
            } catch (error) {
                this.customError = this.formatAnalysisError(error);
            } finally {
                this.submitting = false;
            }
        },
        async pollBackgroundTask() {
            if (!this.backgroundTaskId) return;
            try {
                const result = await this.DiyCommon.PostAsync("/api/BackgroundTask/List", {}, null, null, "json");
                if (result && Number(result.Code) === 1 && Array.isArray(result.Data)) {
                    const task = result.Data.find((item) => String(item.Id || item.TaskId) === String(this.backgroundTaskId));
                    if (task) this.backgroundTask = task;
                }
                if (this.backgroundTask && TERMINAL_TASK_STATUSES.includes(this.backgroundTask.Status)) {
                    if (this.backgroundTask.Status === "Succeeded" && !this.customSuccessEmitted) {
                        this.customSuccessEmitted = true;
                        this.$emit("import-success", this.backgroundTask);
                    }
                    return;
                }
            } catch (error) {
                this.customError = this.formatAnalysisError(error);
            }
            this._backgroundTaskTimer = window.setTimeout(() => this.pollBackgroundTask(), 1500);
        },
        stopBackgroundTaskPolling() {
            if (this._backgroundTaskTimer) {
                window.clearTimeout(this._backgroundTaskTimer);
                this._backgroundTaskTimer = null;
            }
        },
        finishImport() {
            if (this.isTaskSucceeded && !this.customSuccessEmitted) this.$emit("import-success", this.backgroundTask);
            this.visible = false;
        },
        handleDialogClosed() {
            this.stopBackgroundTaskPolling();
        },
        getImportProgress() {
            const requestParam = this.appendMenuContext({ TableId: this.tableId });
            this.DiyCommon.Post(this.importProgressApi, requestParam, (result) => {
                if (this.DiyCommon.Result(result) && !this.DiyCommon.IsNull(result.Data) && Array.isArray(result.Data)) {
                    this.importStepList = result.Data;
                }
            });
        },
        delImportProgress() {
            const requestParam = this.appendMenuContext({ TableId: this.tableId });
            this.DiyCommon.Post("/api/FormEngine/DelImportDiyTableRowStep", requestParam, (result) => {
                if (this.DiyCommon.Result(result)) {
                    this.DiyCommon.Tips(this.$t("Msg.Success"));
                    this.getImportProgress();
                }
            });
        },
        handleUploadSuccess(result) {
            this.submitting = false;
            this.uploadResult = result;
            this.getImportProgress();
            if (this._importStepTimer) clearTimeout(this._importStepTimer);
            this._importStepTimer = setTimeout(() => this.getImportProgress(), 800);
            if (result && Number(result.Code) === 1) {
                this.uploadSucceeded = true;
                this.$emit("import-success", result);
            } else if (result) {
                this.customError = result.Msg || result.Message || this.$t("Msg.ImportFailed");
                this.DiyCommon.Result(result);
            }
        },
        handleUploadError(error) {
            this.submitting = false;
            this.customError = (error && (error.message || error.msg)) || this.$t("Msg.ImportUploadFailed");
        },
        handleBeforeUpload(file) {
            try {
                this.validateExcelFile(file);
            } catch (error) {
                this.submitting = false;
                this.DiyCommon.Tips(error.message, false);
                return false;
            }
            if (this._importStepTimer) clearTimeout(this._importStepTimer);
            this._importStepTimer = setTimeout(() => this.getImportProgress(), 1000);
            return true;
        }
    },
    beforeUnmount() {
        if (this._importStepTimer) clearTimeout(this._importStepTimer);
        this.stopBackgroundTaskPolling();
    }
};
</script>
