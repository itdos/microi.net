<template>
    <el-dialog
        v-model="visible"
        class="mci-unified-dialog mci-import-dialog"
        modal-class="mci-unified-overlay"
        :title="dialogTitle"
        :width="dialogWidth"
        :modal-append-to-body="true"
        :close-on-click-modal="false"
        :close-on-press-escape="!submitting"
        :modal="true"
        :destroy-on-close="false"
        append-to-body
        align-center
        draggable
        @closed="handleDialogClosed"
    >
        <div v-if="dialogDescription" class="mci-import-dialog__description">
            {{ dialogDescription }}
        </div>

        <el-upload
            v-if="isCustomImport"
            ref="customUpload"
            class="upload-drag-style mci-import-dialog__upload"
            :accept="customAccept"
            :auto-upload="false"
            :disabled="parsing || submitting || isTaskActive"
            :limit="1"
            :show-file-list="false"
            :on-change="handleCustomFileChange"
            drag
        >
            <el-icon class="mci-import-dialog__upload-icon"><Upload /></el-icon>
            <div class="el-upload__text">{{ $t("Msg.UploadDesc") }}</div>
            <template #tip>
                <div class="el-upload__tip">{{ $t("Msg.OnlyXlsFile") }}</div>
            </template>
        </el-upload>

        <el-upload
            v-else
            class="upload-drag-style mci-import-dialog__upload"
            :action="importApi"
            :accept="customAccept"
            :data="uploadData"
            :headers="{ authorization: authHeader }"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :before-upload="handleBeforeUpload"
            drag
        >
            <el-icon class="mci-import-dialog__upload-icon"><Upload /></el-icon>
            <div class="el-upload__text">{{ $t("Msg.UploadDesc") }}</div>
            <template #tip>
                <div class="el-upload__tip">{{ $t("Msg.OnlyXlsFile") }}</div>
            </template>
        </el-upload>

        <section v-if="isCustomImport" class="mci-import-dialog__status" aria-live="polite">
            <div class="mci-import-dialog__status-head">
                <div>
                    <div class="mci-import-dialog__status-label">{{ $t("Msg.ImportStatus") }}</div>
                    <strong>{{ customStatusTitle }}</strong>
                </div>
                <el-tag v-if="backgroundTask || customError" :type="customStatusType" round>
                    {{ customStatusText }}
                </el-tag>
            </div>

            <div v-if="selectedFile" class="mci-import-dialog__file-summary">
                <span>{{ selectedFile.name }}</span>
                <span v-if="parsedImport">{{ parsedImport.rows.length }} {{ $t("Msg.ImportRows") }}</span>
            </div>

            <el-progress
                v-if="backgroundTask"
                class="mci-import-dialog__progress"
                :percentage="customProgressPercentage"
                :indeterminate="customProgressIndeterminate"
                :status="customProgressStatus"
                :stroke-width="10"
            />

            <p v-if="customProgressMessage" class="mci-import-dialog__message">
                {{ customProgressMessage }}
            </p>
            <p v-if="customError" class="mci-import-dialog__error">{{ customError }}</p>

            <div v-if="customResultItems.length" class="mci-import-dialog__results">
                <div class="mci-import-dialog__results-title">{{ $t("Msg.ImportResult") }}</div>
                <div
                    v-for="(item, index) in customResultItems"
                    :key="'customResult_' + index"
                    class="mci-import-dialog__result-row"
                >
                    {{ item }}
                </div>
            </div>
        </section>

        <template v-else>
            <div class="mci-import-dialog__legacy-actions">
                <el-button :icon="RefreshRight" @click="getImportProgress">{{ $t("Msg.ViewProgress") }}</el-button>
                <el-tooltip v-if="isAdmin" effect="dark" :content="$t('Msg.Tips')" placement="top">
                    <el-button :icon="Warning" @click="delImportProgress">{{ $t("Msg.ClearImportCache") }}</el-button>
                </el-tooltip>
            </div>
            <div class="mci-import-dialog__legacy-progress" aria-live="polite">
                <div v-for="(message, index) in importStepList" :key="'importStep_' + index">
                    {{ message }}
                </div>
                <div v-if="importStepList.length === 0">{{ $t("Msg.NoProgress") }}</div>
            </div>
        </template>

        <template #footer>
            <el-button :icon="Close" @click="visible = false">{{ $t("Msg.Close") }}</el-button>
            <el-button
                v-if="isCustomImport && !isTaskSucceeded"
                type="primary"
                :icon="Upload"
                :loading="parsing || submitting"
                :disabled="!canStartCustomImport"
                @click="startCustomImport"
            >
                {{ submitting || isTaskActive ? $t("Msg.ImportRunning") : $t("Msg.StartImport") }}
            </el-button>
            <el-button
                v-if="isCustomImport && isTaskSucceeded"
                type="primary"
                :icon="CircleCheckFilled"
                @click="finishCustomImport"
            >
                {{ $t("Msg.ImportDone") }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script>
import { CircleCheckFilled, Close, RefreshRight, Upload, Warning } from "@element-plus/icons-vue";
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";

const ACTIVE_TASK_STATUSES = ["Pending", "Running", "Retrying"];
const TERMINAL_TASK_STATUSES = ["Succeeded", "Failed", "Canceled"];

export default {
    name: "DiyImportDialog",
    components: { Upload },
    props: {
        tableId: { type: String, required: true },
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
            _importStepTimer: null,
            _backgroundTaskTimer: null,
            RefreshRight,
            Warning,
            Close,
            Upload,
            CircleCheckFilled
        };
    },
    computed: {
        isCustomImport() {
            return Boolean(this.dialogOptions && this.dialogOptions.ApiEngineKey);
        },
        dialogTitle() {
            return (this.dialogOptions && this.dialogOptions.Title) || this.$t("Msg.Import");
        },
        dialogDescription() {
            return (this.dialogOptions && this.dialogOptions.Description) || "";
        },
        dialogWidth() {
            return (this.dialogOptions && this.dialogOptions.Width) || "min(760px, calc(100vw - 32px))";
        },
        customAccept() {
            return (this.dialogOptions && this.dialogOptions.Accept) || ".xls,.xlsx";
        },
        importApi() {
            if (this.sysMenuModel && this.sysMenuModel.ImportApi) {
                return this.DiyCommon.RepalceUrlKey(this.sysMenuModel.ImportApi);
            }
            return this.DiyCommon.GetApiBase() + "/api/FormEngine/ImportDiyTableRow";
        },
        importProgressApi() {
            if (this.sysMenuModel && this.sysMenuModel.ImportProgressApi) {
                return this.DiyCommon.RepalceUrlKey(this.sysMenuModel.ImportProgressApi);
            }
            return this.DiyApi.GetImportDiyTableRowStep;
        },
        authHeader() {
            return "Bearer " + this.DiyCommon.Authorization();
        },
        uploadData() {
            var result = {
                Limit: true,
                TableId: this.tableId,
                UserId: this.$store?.getters?.GetCurrentUser?.Id || ""
            };
            this.appendMenuContext(result);
            var fixedFormData = this.buildChildImportFixedData();
            if (Object.keys(fixedFormData).length > 0) result._FieldId = JSON.stringify(fixedFormData);
            if (this.tableChildFkFieldName) result.TableChildFkFieldName = this.tableChildFkFieldName;
            if (this.primaryTableFieldName) result.PrimaryTableFieldName = this.primaryTableFieldName;
            if (this.tableChildTableRowId) result.ParentTableRowId = this.tableChildTableRowId;
            if (this.tableChildImportContext && Object.keys(this.tableChildImportContext).length > 0) {
                result._ChildImportContext = JSON.stringify(this.tableChildImportContext);
            }
            return result;
        },
        isTaskActive() {
            return Boolean(this.backgroundTask && ACTIVE_TASK_STATUSES.includes(this.backgroundTask.Status));
        },
        isTaskSucceeded() {
            return Boolean(this.backgroundTask && this.backgroundTask.Status === "Succeeded");
        },
        canStartCustomImport() {
            return Boolean(
                this.parsedImport
                && this.parsedImport.rows.length
                && !this.parsing
                && !this.submitting
                && !this.isTaskActive
                && !this.backgroundTaskId
            );
        },
        customProgressPercentage() {
            if (!this.backgroundTask) return 0;
            if (this.backgroundTask.Status === "Succeeded") return 100;
            return Math.max(0, Math.min(100, Number(this.backgroundTask.Progress || 0)));
        },
        customProgressIndeterminate() {
            return this.isTaskActive && Number(this.backgroundTask?.Total || 0) <= 0;
        },
        customProgressStatus() {
            if (!this.backgroundTask) return undefined;
            if (this.backgroundTask.Status === "Succeeded") return "success";
            if (["Failed", "Canceled"].includes(this.backgroundTask.Status)) return "exception";
            return undefined;
        },
        customStatusTitle() {
            if (this.customError) return this.$t("Msg.ImportFailed");
            if (this.backgroundTask) return this.backgroundTask.Title || this.dialogTitle;
            if (this.parsing) return this.$t("Msg.ParsingWorkbook");
            if (this.parsedImport) return this.$t("Msg.ReadyToImport");
            return this.$t("Msg.SelectImportFile");
        },
        customStatusText() {
            if (this.customError) return this.$t("Msg.ImportFailed");
            var status = this.backgroundTask && this.backgroundTask.Status;
            var labels = {
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
            var status = this.backgroundTask && this.backgroundTask.Status;
            if (status === "Succeeded") return "success";
            if (["Failed", "Canceled"].includes(status) || this.customError) return "danger";
            if (status === "Pending") return "info";
            return "warning";
        },
        customProgressMessage() {
            if (!this.backgroundTask) return this.parsedImport ? this.$t("Msg.ImportReadyHint") : "";
            var task = this.backgroundTask;
            var unitText = Number(task.Total || 0) > 0
                ? ` ${Number(task.Current || 0)}/${Number(task.Total || 0)}`
                : "";
            return (task.Msg || task.Message || this.customStatusText) + unitText;
        },
        customResultItems() {
            if (!this.backgroundTask) return [];
            var result = this.backgroundTask.Result;
            if (typeof result === "string") {
                try {
                    result = JSON.parse(result);
                } catch (_) {
                    return result ? [result] : [];
                }
            }
            var data = result && result.Data !== undefined ? result.Data : result;
            if (!data) return [];
            var items = [];
            if (data.ProjectName) items.push(`${this.$t("Msg.ImportProject")}: ${data.ProjectName}`);
            if (data.ImportedCount !== undefined) items.push(`${this.$t("Msg.ImportedRows")}: ${data.ImportedCount}`);
            if (data.BatchNo) items.push(`${this.$t("Msg.ImportBatch")}: ${data.BatchNo}`);
            if (Array.isArray(data.Results)) {
                data.Results.slice(0, 30).forEach(function(row) {
                    var line = row.ExcelRow || row.LineNo || "-";
                    items.push(`${line}: ${row.SourceSpecification || ""} → ${row.Specification || row.Msg || ""}`);
                });
            }
            return items;
        }
    },
    methods: {
        appendMenuContext(target) {
            var menu = this.sysMenuModel || {};
            if (menu.Id) target._SysMenuId = menu.Id;
            if (menu.ModuleEngineKey) target.ModuleEngineKey = menu.ModuleEngineKey;
            return target;
        },
        mergeFixedImportValue(target, key, value) {
            if (key && value !== undefined && value !== null && value !== "") target[key] = value;
        },
        mergeFixedImportObject(target, source) {
            var self = this;
            if (!source) return;
            var sourceObj = source;
            if (typeof source === "string") {
                try {
                    sourceObj = JSON.parse(source);
                } catch (_) {
                    sourceObj = null;
                }
            }
            if (!sourceObj || typeof sourceObj !== "object") return;
            Object.keys(sourceObj).forEach(function(key) {
                self.mergeFixedImportValue(target, key, sourceObj[key]);
            });
        },
        buildChildImportFixedData() {
            var fixedFormData = {};
            var context = this.tableChildImportContext || {};
            this.mergeFixedImportObject(fixedFormData, context.FixedValues);
            this.mergeFixedImportObject(fixedFormData, context.FieldValues);
            this.mergeFixedImportObject(fixedFormData, context._FieldId);
            if (this.tableChildFkFieldName) {
                var fkValue = this.fatherFormModelData
                    ? (this.primaryTableFieldName
                        ? this.fatherFormModelData[this.primaryTableFieldName]
                        : this.fatherFormModelData.Id)
                    : this.tableChildTableRowId;
                this.mergeFixedImportValue(fixedFormData, this.tableChildFkFieldName, fkValue);
            }
            return fixedFormData;
        },
        resetCustomState() {
            this.stopBackgroundTaskPolling();
            this.selectedFile = null;
            this.parsedImport = null;
            this.parsing = false;
            this.submitting = false;
            this.customError = "";
            this.backgroundTaskId = "";
            this.backgroundTask = null;
            this.customSuccessEmitted = false;
            if (this.$refs.customUpload && this.$refs.customUpload.clearFiles) {
                this.$refs.customUpload.clearFiles();
            }
        },
        show(options) {
            this.dialogOptions = options && typeof options === "object" ? { ...options } : {};
            this.resetCustomState();
            this.visible = true;
        },
        hide() {
            this.visible = false;
        },
        validateExcelFile(file) {
            var name = String(file && file.name || "");
            var maxSizeMb = Number(this.dialogOptions.MaxFileSizeMB || 20);
            if (!/\.xlsx?$/i.test(name)) throw new Error(this.$t("Msg.OnlyXlsFile"));
            if (Number(file.size || 0) > maxSizeMb * 1024 * 1024) {
                throw new Error(this.$t("Msg.ImportFileTooLarge", { size: maxSizeMb }));
            }
        },
        async handleCustomFileChange(uploadFile) {
            var file = uploadFile && uploadFile.raw;
            if (!file) return;
            this.resetCustomState();
            this.selectedFile = file;
            this.parsing = true;
            try {
                this.validateExcelFile(file);
                this.parsedImport = await this.parseWorkbook(file, this.dialogOptions.Workbook || {});
                if (!this.parsedImport.rows.length) throw new Error(this.$t("Msg.ImportNoRows"));
            } catch (error) {
                this.customError = error && error.message ? error.message : String(error);
                this.parsedImport = null;
            } finally {
                this.parsing = false;
            }
        },
        normalizeCellValue(cell) {
            if (!cell || cell.v === undefined || cell.v === null) return null;
            if (cell.v instanceof Date) return cell.v.toISOString();
            return typeof cell.v === "string" ? cell.v.trim() : cell.v;
        },
        async parseWorkbook(file, config) {
            var module = await import("xlsx");
            var XLSX = module.default || module;
            var workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
            var sheetName = config.SheetName || workbook.SheetNames[Number(config.SheetIndex || 0)];
            var sheet = workbook.Sheets[sheetName];
            if (!sheet) throw new Error(this.$t("Msg.ImportSheetNotFound"));
            var range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
            var startRow = Math.max(1, Number(config.DataStartRow || 2));
            var endRow = Math.min(Number(config.DataEndRow || range.e.r + 1), range.e.r + 1);
            var columns = Array.isArray(config.Columns) ? config.Columns : [];
            if (!columns.length) throw new Error(this.$t("Msg.ImportMappingMissing"));
            var cells = {};
            Object.keys(config.Cells || {}).forEach((key) => {
                cells[key] = this.normalizeCellValue(sheet[String(config.Cells[key]).toUpperCase()]);
            });
            var rows = [];
            for (var rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
                var row = { _ExcelRow: rowNumber };
                columns.forEach((column) => {
                    var columnIndex = typeof column.Column === "number"
                        ? column.Column
                        : XLSX.utils.decode_col(String(column.Column || "A").toUpperCase());
                    var address = XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex });
                    row[column.Name] = this.normalizeCellValue(sheet[address]);
                });
                var keyValue = config.KeyField ? row[config.KeyField] : undefined;
                var hasValue = columns.some(
                    (column) => row[column.Name] !== null && row[column.Name] !== ""
                );
                if (!hasValue || (config.KeyField && (keyValue === null || keyValue === ""))) continue;
                rows.push(row);
            }
            var maxRows = Math.max(1, Number(this.dialogOptions.MaxRows || 5000));
            if (rows.length > maxRows) {
                throw new Error(this.$t("Msg.ImportTooManyRows", { count: maxRows }));
            }
            return { sheetName, rows, cells };
        },
        async startCustomImport() {
            if (!this.canStartCustomImport) return;
            this.submitting = true;
            this.customError = "";
            try {
                var options = this.dialogOptions || {};
                var operationId = this.DiyCommon.NewGuid();
                var params = Object.assign({}, options.Param || {}, {
                    _ImportRowsJson: JSON.stringify(this.parsedImport.rows),
                    _ImportMetaJson: JSON.stringify({
                        SheetName: this.parsedImport.sheetName,
                        Cells: this.parsedImport.cells,
                        RowCount: this.parsedImport.rows.length
                    }),
                    _ImportFileName: this.selectedFile.name,
                    _ImportFileSize: this.selectedFile.size
                });
                var backgroundOptions = Object.assign({
                    IdempotencyKey: `${options.ApiEngineKey}:${operationId}`,
                    ConcurrencyKey: options.ApiEngineKey,
                    MaxAttempts: 1
                }, options.BackgroundOptions || {});
                var result = await this.DiyCommon.ApiEngine.RunBackground(
                    options.ApiEngineKey,
                    params,
                    options.TaskTitle || this.dialogTitle,
                    backgroundOptions
                );
                if (!result || Number(result.Code) !== 1) {
                    throw new Error(
                        (result && (result.Msg || result.Message)) || this.$t("Msg.ImportSubmitFailed")
                    );
                }
                var taskData = result.Data || {};
                this.backgroundTaskId = taskData.Id || taskData.TaskId || taskData.BackgroundTaskId || "";
                this.backgroundTask = Object.assign({ Status: "Pending", Progress: 0 }, taskData);
                if (!this.backgroundTaskId) throw new Error(this.$t("Msg.ImportTaskIdMissing"));
                try {
                    window.dispatchEvent(
                        new CustomEvent("microi-background-task-started", { detail: result })
                    );
                } catch (_) { }
                await this.pollBackgroundTask();
            } catch (error) {
                this.customError = error && error.message ? error.message : String(error);
            } finally {
                this.submitting = false;
            }
        },
        async pollBackgroundTask() {
            if (!this.backgroundTaskId) return;
            try {
                var result = await this.DiyCommon.PostAsync(
                    "/api/BackgroundTask/List",
                    {},
                    null,
                    null,
                    "json"
                );
                if (result && Number(result.Code) === 1 && Array.isArray(result.Data)) {
                    var task = result.Data.find(
                        (item) => String(item.Id || item.TaskId) === String(this.backgroundTaskId)
                    );
                    if (task) this.backgroundTask = task;
                }
                if (
                    this.backgroundTask
                    && TERMINAL_TASK_STATUSES.includes(this.backgroundTask.Status)
                ) {
                    if (
                        this.backgroundTask.Status === "Succeeded"
                        && !this.customSuccessEmitted
                    ) {
                        this.customSuccessEmitted = true;
                        this.$emit("import-success", this.backgroundTask);
                    }
                    return;
                }
            } catch (error) {
                this.customError = error && error.message ? error.message : String(error);
            }
            this._backgroundTaskTimer = window.setTimeout(() => this.pollBackgroundTask(), 1500);
        },
        stopBackgroundTaskPolling() {
            if (this._backgroundTaskTimer) {
                window.clearTimeout(this._backgroundTaskTimer);
                this._backgroundTaskTimer = null;
            }
        },
        finishCustomImport() {
            if (!this.customSuccessEmitted) this.$emit("import-success", this.backgroundTask);
            this.visible = false;
        },
        handleDialogClosed() {
            this.stopBackgroundTaskPolling();
        },
        getImportProgress() {
            var self = this;
            var requestParam = self.appendMenuContext({ TableId: self.tableId });
            self.DiyCommon.Post(self.importProgressApi, requestParam, function(result) {
                if (
                    self.DiyCommon.Result(result)
                    && !self.DiyCommon.IsNull(result.Data)
                    && Array.isArray(result.Data)
                ) {
                    self.importStepList = result.Data;
                }
            });
        },
        delImportProgress() {
            var self = this;
            var requestParam = self.appendMenuContext({ TableId: self.tableId });
            self.DiyCommon.Post(
                "/api/FormEngine/DelImportDiyTableRowStep",
                requestParam,
                function(result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips("操作成功！");
                        self.getImportProgress();
                    }
                }
            );
        },
        handleUploadSuccess(result) {
            var self = this;
            self.getImportProgress();
            self._importStepTimer = setTimeout(function() {
                if (self && self.getImportProgress) self.getImportProgress();
            }, 800);
            if (result && Number(result.Code) === 1) self.$emit("import-success");
            else if (result) self.DiyCommon.Result(result);
        },
        handleBeforeUpload(file) {
            try {
                this.validateExcelFile(file);
            } catch (error) {
                this.DiyCommon.Tips(error.message, false);
                return false;
            }
            this.DiyCommon.Tips("正在导入！请点击查看进度按钮！");
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
