export default {
    methods: {
        // 统一判断 Multiple 配置的真值（支持 true, "true", 1, "1"）
        getMultipleFlag(field, compName) {
            try {
                if (!field || !field.Config) return false;
                var cfg = field.Config[compName];
                if (!cfg) return false;
                var m = cfg.Multiple;
                return m === true || m === "true" || m === 1 || m === "1";
            } catch (e) {
                return false;
            }
        },

        // 判断单图上传的值是否有效（处理字符串、对象和数组情况）
        isValidSingleImgValue(value) {
            // 保持与原实现一致的日志与行为
            try {
                // removed debug log
            } catch (e) {}

            if (!value) {
                return false;
            }

            if (Array.isArray(value)) {
                if (value.length === 0) {
                    return false;
                }
                var firstItem = value[0];
                if (firstItem && (firstItem.Path || firstItem.path || firstItem.Url || firstItem.url)) {
                    return true;
                }
                return false;
            }

            if (typeof value === "string") {
                var trimmed = value.trim();
                if (trimmed === "" || trimmed === "[]" || trimmed === "[ ]" || trimmed === "null" || trimmed === "undefined") {
                    return false;
                }
                return true;
            }

            if (typeof value === "object" && value !== null) {
                var pathValue = value.Path || value.path || value.Url || value.url;
                if (pathValue && typeof pathValue === "string" && pathValue.trim() !== "") {
                    return true;
                }
                return false;
            }

            return false;
        },

        // 修复单文件字段被误置为数组或对象的情况：尝试恢复为字符串路径或空字符串
        sanitizeSingleFileField(field) {
            var self = this;
            try {
                if (!field) return;
                var name = field.Name;
                // 仅在非多文件场景下进行修复
                if (self.getMultipleFlag(field, field.Component === "FileUpload" ? "FileUpload" : "ImgUpload")) return;
                var val = self.FormDiyTableModel[name];
                if (Array.isArray(val)) {
                    if (val.length === 0) {
                        self.FormDiyTableModel[name] = "";
                        return;
                    }
                    var first = val[0];
                    var path = null;
                    if (first) {
                        path = first.Path || first.path || first.Url || first.url || first.PathName || null;
                    }
                    if (path) {
                        self.FormDiyTableModel[name] = path;
                        return;
                    }
                    self.FormDiyTableModel[name] = "";
                    return;
                }
                if (typeof val === "object" && val !== null) {
                    var p = val.Path || val.path || val.Url || val.url || val.PathName;
                    if (p && typeof p === "string") {
                        self.FormDiyTableModel[name] = p;
                    } else {
                        self.FormDiyTableModel[name] = "";
                    }
                }
            } catch (e) {
                console.log("sanitizeSingleFileField error:", e);
            }
        },

        // 获取图片显示路径（替代隐藏span的方式）
        getImageDisplayPath(field) {
            var self = this;
            if (!field) {
                return "";
            }
            var realPathKey = field.Name + "_" + field.Name + "_RealPath";
            var uploadValKey = field.Name + "_UploadValue";

            var fieldValue = self.FormDiyTableModel[field.Name];
            if (!fieldValue) return "";

            // 支持数组 / 对象 / 字符串三种存储形式
            var actualPath = "";
            if (Array.isArray(fieldValue)) {
                if (fieldValue.length > 0) {
                    var first = fieldValue[0];
                    if (first) actualPath = first.Path || first.path || first.Url || first.url || first.PathName || "";
                }
            } else if (typeof fieldValue === "string") {
                actualPath = fieldValue;
            } else if (typeof fieldValue === "object" && fieldValue !== null) {
                actualPath = fieldValue.Path || fieldValue.path || fieldValue.Url || fieldValue.url || fieldValue.PathName || "";
            }
            if (!actualPath) return "";

            // 优先使用上传期望值（如果存在）
            var uploadVal = self.FormDiyTableModel[uploadValKey];
            if (uploadVal && typeof uploadVal === "string" && uploadVal.trim() !== "") {
                actualPath = uploadVal;
            }

            // 判断是否为私有文件（需要临时 URL）
            var limit = (field.Config && field.Config[field.Component] && field.Config[field.Component].Limit) || false;

            // 公共文件：直接返回服务器完整路径（不使用 _RealPath）
            if (!limit) {
                try {
                    return self.DiyCommon.GetServerPath(actualPath) || "";
                } catch (e) {
                    return "";
                }
            }

            // 私有文件：如果已有临时URL则返回，否则异步获取并写入 _RealPath（仅用于私有场景）
            var existing = self.FormDiyTableModel[realPathKey];
            if (existing && existing !== "./static/img/loading.gif") {
                return existing;
            }

            if (existing === "./static/img/loading.gif") {
                return existing;
            }

            try {
                self.FormDiyTableModel[realPathKey] = "./static/img/loading.gif";
                self.DiyCommon.Post(
                    "/api/HDFS/GetPrivateFileUrl",
                    {
                        FilePathName: actualPath,
                        HDFS: self.SysConfig.HDFS || "Aliyun",
                        FormEngineKey: self.DiyTableModel.Name || self.TableId,
                        FormDataId: self.TableRowId,
                        FieldId: field.Id
                    },
                    function (privateResult) {
                        var finalPath;
                        if (self.DiyCommon.Result(privateResult)) {
                            finalPath = privateResult.Data;
                        } else {
                            finalPath = "./static/img/img-load-fail.jpg";
                        }
                        self.FormDiyTableModel[realPathKey] = finalPath;
                    },
                    function (error) {
                        self.FormDiyTableModel[realPathKey] = "./static/img/img-load-fail.jpg";
                    }
                );
            } catch (e) {
                try {
                    self.FormDiyTableModel[realPathKey] = "./static/img/img-load-fail.jpg";
                } catch (e) {}
            }
            return self.FormDiyTableModel[realPathKey] || "";
        }
    }
};
