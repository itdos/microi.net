
export default {
    methods: {
        CloseThisDialog() {
            var self = this;
            self.$refs.refDiyCustomDialog.CloseDialog();
        },
        /**
         * 必传：ComponentName
         */
        OpenDialog(param) {
            var self = this;
            if (!param.ComponentName) {
                self.DiyCommon.Tips("ComponentName必传！", false);
                return;
            }
            self.DiyCustomDialogConfig = param;
            // self.DiyCustomDialogConfig.Visible = true;
            self.$refs.refDiyCustomDialog.Show();
        },
        OpenAnyForm(param, callback) {
            var self = this;
            console.warn('[OpenAnyForm] 被调用, param=', param);
            console.warn('[OpenAnyForm] _shouldRenderDiyFormDialog=', self._shouldRenderDiyFormDialog, ' | ref存在=', !!self.$refs.refDiyTable_DiyFormDialog);
            // 首次调用时才渲染 DiyFormDialog 组件，防止 Page 模式下无限嵌套
            if (!self._shouldRenderDiyFormDialog) {
                console.warn('[OpenAnyForm] 首次调用，设置 _shouldRenderDiyFormDialog = true');
                self._shouldRenderDiyFormDialog = true;
            }
            // 异步组件挂载需要时间，使用重试机制等待 ref 就绪
            if (self.$refs.refDiyTable_DiyFormDialog) {
                console.warn('[OpenAnyForm] ref 已就绪，直接调用 Init');
                self.$refs.refDiyTable_DiyFormDialog.Init(param, callback);
            } else {
                console.warn('[OpenAnyForm] ref 未就绪，进入重试轮询...');
                var retryCount = 0;
                var maxRetries = 40;
                var tryInit = function() {
                    console.warn('[OpenAnyForm] tryInit 第' + retryCount + '次, ref存在=', !!self.$refs.refDiyTable_DiyFormDialog, ' | _shouldRender=', self._shouldRenderDiyFormDialog);
                    if (self.$refs.refDiyTable_DiyFormDialog) {
                        console.warn('[OpenAnyForm] ref 就绪，调用 Init (第' + retryCount + '次重试后)');
                        self.$refs.refDiyTable_DiyFormDialog.Init(param, callback);
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryInit, 50);
                    } else {
                        console.error('[OpenAnyForm] 超时：refDiyTable_DiyFormDialog 始终未挂载，已重试' + maxRetries + '次');
                    }
                };
                self.$nextTick(tryInit);
            }
        },
        FormClose() {
            var self = this;
            self.$emit("CallbackFormClose");
            // 移除 DOM 清理调用，让 Element Plus 自然管理组件生命周期
            // 之前的 cleanupHiddenElements 会破坏 Vue 组件实例
        },
        HideFormBtn(btn) {
            var self = this;
            self.$emit("CallbackHideFormBtn", btn);
        },
        CallbackForm() {
            var self = this;
            self.$emit("CallbackForm", { ...self.FormDiyTableModel });
        },
        //系统设置加了判断，如果是在线访问文档，则打开界面引擎2025-5-4刘诚
        GoUrl(file) {
            var self = this;
            var url = typeof file === "object" && file !== null ? file.url || file.filePath || file.FilePath || file.Path : file;
            var fileName = typeof file === "object" && file !== null ? file.fileName || file.FileName || file.name || file.Name : "";
            var fileSize = typeof file === "object" && file !== null ? file.fileSize || file.FileSize || file.size || file.Size : "";
            var filePathName = typeof file === "object" && file !== null ? file.filePathName || file.FilePathName || file.sourceFilePath || file.SourceFilePath : "";
            var isPrivate = typeof file === "object" && file !== null ? file.isPrivate || file.IsPrivate || file.limit || file.Limit : "";
            var hdfs = typeof file === "object" && file !== null ? file.hdfs || file.HDFS : "";
            var formEngineKey = typeof file === "object" && file !== null ? file.formEngineKey || file.FormEngineKey : "";
            var formDataId = typeof file === "object" && file !== null ? file.formDataId || file.FormDataId : "";
            var fieldId = typeof file === "object" && file !== null ? file.fieldId || file.FieldId : "";
            var isPrivateFile = isPrivate === true || isPrivate === "true" || isPrivate === 1 || isPrivate === "1";
            var targetUrl = fileName || filePathName || url;
            if (!url && !filePathName) {
                return;
            }
            if (
                self.SysConfig &&
                (self.SysConfig.Is_online_office || self.SysConfig.OnlyOfficeApiBase) &&
                (targetUrl.indexOf(".doc") != -1 || targetUrl.indexOf(".docx") != -1 || targetUrl.indexOf(".xls") != -1 || targetUrl.indexOf(".xlsx") != -1 || targetUrl.indexOf(".ppt") != -1 || targetUrl.indexOf(".pptx") != -1)
            ) {
                var params = new URLSearchParams();
                if (!isPrivateFile || !filePathName) {
                    params.set("filePath", url);
                }
                if (fileName) {
                    params.set("fileName", fileName);
                }
                if (fileSize) {
                    params.set("fileSize", fileSize);
                }
                if (filePathName) {
                    params.set("filePathName", filePathName);
                }
                if (isPrivate !== "") {
                    params.set("isPrivate", isPrivateFile ? "1" : "0");
                }
                if (hdfs) {
                    params.set("hdfs", hdfs);
                }
                if (formEngineKey) {
                    params.set("formEngineKey", formEngineKey);
                }
                if (formDataId) {
                    params.set("formDataId", formDataId);
                }
                if (fieldId) {
                    params.set("fieldId", fieldId);
                }
                self.$router.push(`/online-office?${params.toString()}`);
                self.$emit("CallbackFormClose");
            } else {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        },
        //2025-02-12
        async handleQrCodeImageBase64(data) {
            this.qrCodeImageBase64 = data;
            await this.$nextTick(); // 确保 Vue 响应式数据更新
        },
    }
};
