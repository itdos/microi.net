
export default {
    methods: {
                                                                /**
         * vuedraggable onAdd 回调：当从设计器拖入字段时触发
         * 注意：实际添加字段的逻辑在 diy-design.vue 的 onComponentAdd 中处理
         * @param {Object} evt - 拖拽事件对象
         */
                /**
         * vuedraggable onEnd 回调：拖拽结束时触发
         * @param {Object} evt - 拖拽事件对象
         */
                /**
         * vuedraggable @update 回调：数组更新时触发（使用 v-model 时）
         * 由于使用了 v-model 绑定，draggable 会自动更新数组顺序
         * 这里只需要同步更新 Sort 值和 DiyFieldList
         */
                        /**
         * 显示字段操作工具栏
         */
                /**
         * 隐藏字段操作工具栏
         */
                /**
         * 判断组件是否有独立配置
         * 支持配置的组件类型：JsonTable, Select等
         */
                /**
         * 打开组件配置弹窗
         * 通过ref调用子组件的openConfig方法
         */
                /**
         * 复制字段
         */
                /**
         * 删除字段
         */
                /**
         * 调整字段宽度
         */
                /**
         * 开始拖动调整宽度
         */
                /**
         * 拖动中调整宽度
         */
                /**
         * 停止拖动调整宽度
         */
                GetPropsSearch(field) {
            var self = this;
            if (field.Config.JoinTable.Where) {
                try {
                    return JSON.parse(field.Config.JoinTable.Where);
                } catch (error) {
                    return [];
                }
            }
            return [];
        },
        SetDiyTableRowModelFinish(value) {
            var self = this;
            self.GetDiyTableRowModelFinish = value;
        },
        GetDataAppend(field) {
            var self = this;
            if (self.DiyCommon.IsNull(field.DataAppend)) {
                return {};
            }
            if (typeof field.DataAppend == "string") {
                return JSON.parse(field.DataAppend);
            }
            return field.DataAppend;
            // DiyCommon.IsNull(field.DataAppend) ? {} : field.DataAppend
        },
        //获取需要保存的行数据，返回格式：{TableName:'', Rows:[]}
        GetNeedSaveRowList() {
            var self = this;
            //先获取所有子表字段
            var result = [];
            self.DiyFieldList.forEach((field) => {
                if (field.Component == "TableChild") {
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.GetNeedSaveRowList === 'function') {
                        var arr = refComponent.GetNeedSaveRowList();
                        //这里除了写主表关联值，其实还要写子表回写列的值  2021-11-02  todo
                        //2021-12-07注释：是因为DiyTable在新增的时候，已经将外键关联、回写值全部处理好了
                        // arr.forEach(formData => {
                        //     formData[field.Config.TableChildFkFieldName] = self.FormDiyTableModel.Id;
                        // });
                        result.push({
                            FieldName: field.Name,
                            TableId: field.Config.TableChildTableId,
                            Rows: arr
                        });

                        //2025-10-8liucheng读取所有子表格已编辑数据
                        var refComponent2 = self.getRefComponent(field.Name);
                        var refArray = Array.isArray(self.$refs["ref_" + field.Name]) ? self.$refs["ref_" + field.Name] : (refComponent2 ? [refComponent2] : []);
                        for (var item of refArray) {
                            var list = [];
                            if(item.DiyTableRowList){
                                item.DiyTableRowList.forEach((ite) => {
                                    if (ite._DataStatus == "Edit") {
                                        list.push(ite);
                                    }
                                });
                                result.push({
                                    FieldName: field.Name,
                                    TableId: field.Config.TableChildTableId,
                                    Rows: list
                                });
                            }
                        }
                    }
                }
            });
            return result;
        },
        ClearNeedSaveRowList() {
            var self = this;
            //先获取所有子表字段
            self.DiyFieldList.forEach((field) => {
                if (field.Component == "TableChild") {
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.ClearNeedSaveRowList === 'function') {
                        var arr = refComponent.ClearNeedSaveRowList();
                    }
                }
            });
        },
        GetNeedSaveJoinFormList() {
            var self = this;
            //先获取所有子表字段
            var result = [];
            self.DiyFieldList.forEach((field) => {
                if (field.Component == "JoinForm") {
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.GetFormData === 'function') {
                        var joinFormData = refComponent.GetFormData();
                        var formMode = self.FormMode;//field.Config.JoinForm.FormMode
                        if(formMode == "Add" || formMode == "Insert")
                        {
                            self.DiyCommon.FormEngine.AddFormData(field.Config.JoinForm.TableId
                                || field.Config.JoinForm.TableName, {
                                ...joinFormData
                            });
                        }
                        else if(formMode == "Edit"
                                || formMode == "Update"
                                || formMode == "Upt"
                            )
                        {
                            self.DiyCommon.FormEngine.UptFormData(field.Config.JoinForm.TableId
                                || field.Config.JoinForm.TableName, {
                                ...joinFormData
                            });
                        }

                        // 这里不再调用FormSubmit，因为它是异步
                        // refComponent.FormSubmit(
                        //     {
                        //         FormMode: field.Config.JoinForm.FormMode, //self.FormMode, 2022-07-14修复这个bug，不应该跟随主表的模式，切换关联表的时候，主表是编辑，但关联表是新增。
                        //         //这里获取关联表单的Id
                        //         TableRowId: field.Config.JoinForm.Id
                        //             || (field.Config.JoinForm.JoinFieldName
                        //                 && self.FormDiyTableModel[field.Config.JoinForm.JoinFieldName]),
                        //         // SaveLoading: self.SaveDiyTableLoding,
                        //         //这里获取当前表单是保存并关闭还是什么状态
                        //         SavedType: self.SavedType,
                        //         V8Callback: function (formData) {
                        //             // self.GetHourseDetail(self.GetOther);
                        //         }
                        //     },
                        //     function (success, formData) {
                        //         if (success == true) {
                        //             // self.GetDiyTableRow(true)
                        //             // self.ShowEditModel = false;
                        //             self.$nextTick(function () {
                        //                 // self.SaveDiyTableLoding = false;
                        //             });
                        //         } else {
                        //             // self.SaveDiyTableLoding = false;
                        //         }
                        //     }
                        // );
                    }
                }
            });
            return result;
        },
        Clear() {
            var self = this;
            //注意：这一句并不能将所有属性值全部清除掉，要使用$delete
            // self.FormDiyTableModel = {};

            // ========== 1. 清理子表组件引用 ==========
            // 遍历所有 refs，找到子表组件并调用其 Clear 方法
            if (self.$refs) {
                Object.keys(self.$refs).forEach((key) => {
                    try {
                        // 检查是否是字段组件的 ref (统一使用 ref_ 前缀)
                        if (key.startsWith('ref_')) {
                            var refComponent = self.$refs[key];
                            // Vue 3 中 ref 可能是数组
                            if (Array.isArray(refComponent)) {
                                refComponent.forEach(comp => {
                                    if (comp && typeof comp.Clear === 'function') {
                                        try { comp.Clear(); } catch(e) {}
                                    }
                                });
                            } else if (refComponent && typeof refComponent.Clear === 'function') {
                                try { refComponent.Clear(); } catch(e) {}
                            }
                        }
                    } catch (e) { /* ignore */ }
                });
            }

            // ========== 2. 清理表单数据 ==========
            Object.keys(self.FormDiyTableModel).forEach((item) => {
                delete self.FormDiyTableModel[item];
            });

            // ========== 3. 清理历史数据 ==========
            self.OldForm = {};
            self.OldFormData = {};

            // ========== 4. 清理修改字段列表 ==========
            self.ModifiedFields = [];

            // ========== 5. 重置加载状态 ==========
            self.GetDiyTableRowModelFinish = false;
            self.IsFirstLoadForm = true;
        },
        GetFormData() {
            var self = this;
            return { ...self.FormDiyTableModel };
        },
        GetOldFormData() {
            var self = this;
            return self.OldForm;
        },
        SetFormData(formData) {
            var self = this;
            for (const key in formData) {
                //2026-02-06 Anderon：注释这个判断 ，否则会导致重新赋空值不会成功
                // if (formData[key]) {
                    self.FormDiyTableModel[key] = formData[key];
                // }
            }
            return self.FormDiyTableModel;
        },
        GetFormDataAndCheck(callback) {
            var self = this;
            self.$refs.FormDiyTableModel[0].validate((valid, fieldsObj) => {
                if (!valid) {
                    var msg = "";
                    try {
                        if (fieldsObj && typeof fieldsObj == "object") {
                            for (const key in fieldsObj) {
                                if (fieldsObj[key] && Array.isArray(fieldsObj[key]) && fieldsObj[key].length > 0) {
                                    msg += fieldsObj[key][0].message + "！<br>";
                                }
                            }
                        }
                    } catch (error) {
                        msg = "";
                    }

                    if (self.DiyCommon.IsNull(msg)) {
                        msg = "请检查输入项！";
                    }
                    self.DiyCommon.Tips(msg, false);
                    callback();
                    // return null;
                } else {
                    var checkForm = true;
                    var checkFailField = {};

                    // 【调试】检查FileUpload和ImgUpload字段的存储格式
                    self.DiyFieldList.forEach((field) => {
                        if (field.Component === 'FileUpload' || field.Component === 'ImgUpload') {
                            const fieldValue = self.FormDiyTableModel[field.Name];
                            console.log(`【提交前检查】${field.Component} - ${field.Name}:`, fieldValue);
                            console.log(`【提交前检查】${field.Name} 类型:`, typeof fieldValue);
                            if (typeof fieldValue === 'string' && fieldValue.startsWith('{')) {
                                console.log(`✅ ${field.Name} 是JSON字符串，格式正确！`);
                            } else if (Array.isArray(fieldValue)) {
                                console.log(`✅ ${field.Name} 是数组（多文件）`);
                            } else {
                                console.warn(`⚠️ ${field.Name} 格式不正确！应该是JSON字符串或数组`);
                            }
                        }
                    });

                    self.DiyFieldList.forEach((field) => {
                        //再手动判断一下必填等验证
                        if (
                            !self.DiyCommon.IsNull(field.NotEmpty) &&
                            field.NotEmpty &&
                            self.FieldIsVisible(field) &&
                            (self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) ||
                                (typeof self.FormDiyTableModel[field.Name] == "object" &&
                                    (JSON.stringify(self.FormDiyTableModel[field.Name]) == "{}" || JSON.stringify(self.FormDiyTableModel[field.Name]) == "[]"))) &&
                            (self.ShowFields.length == 0 || (self.ShowFields.length > 0 && self.ShowFields.indexOf(field.Name) > -1)) && // _.where(self.ShowFields, { Id: field.Id}).length > 0
                            self.HideFields.indexOf(field.Name) == -1 &&
                            field.Component !== "DevComponent" &&
                            field.Component !== "TableChild" &&
                            field.Component !== "Button" &&
                            field.Component !== "Button" &&
                            field.Component !== "AutoNumber" &&
                            !self.GetFieldReadOnly(field)
                            // && !self.DiyCommon.IsNull(field.FieldType)
                        ) {
                            checkFailField = field;
                            checkForm = false;
                        }
                    });
                    if (!checkForm) {
                        self.DiyCommon.Tips("请检查必填项：[" + checkFailField.Label + "]！", false);
                        callback();
                    } else {
                        //2023-09-08：这里需返回引用类型，否则执行的FormSubmitAction函数里面的表单提交前V8事件中对self.FormDiyTableModel赋值并不会影响这里返回的formData
                        // callback({
                        //     ...self.FormDiyTableModel
                        // });
                        callback(self.FormDiyTableModel);
                    }

                    // return {...self.FormDiyTableModel};
                }
            });
        },
    }
};
