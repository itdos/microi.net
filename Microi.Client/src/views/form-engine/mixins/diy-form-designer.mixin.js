export default {
    methods: {
FieldIsVisible(field) {
            var self = this;
            if (!field) return false;
            if (self.diyStore.IsPhoneView){
                return field.AppVisible ? true : false;
            }
            return field.Visible ? true : false;
        },
getRefComponent(fieldName) {
            var self = this;
            var refKey = 'ref_' + fieldName;
            var refValue = self.$refs[refKey];

            if (!refValue) {
                return null;
            }

            // Vue 3 中可能是数组或直接是组件实例
            if (Array.isArray(refValue)) {
                return refValue.length > 0 ? refValue[0] : null;
            }

            return refValue;
        },
safeTimeout(fn, delay) {
            var self = this;
            var timerId = setTimeout(function() {
                if (self._isDestroyed) return;
                fn();
            }, delay);
            if (self._pendingTimers) {
                self._pendingTimers.push(timerId);
            }
            return timerId;
        },
handleFieldClick(event) {
            var self = this;
            // 只在设计模式下处理字段选择
            if (self.LoadMode !== 'Design') return;

            // 向上查找带有 data-field-id 属性的元素
            var target = event.target;
            var fieldId = null;
            while (target && target !== event.currentTarget) {
                if (target.dataset && target.dataset.fieldId) {
                    fieldId = target.dataset.fieldId;
                    break;
                }
                target = target.parentElement;
            }

            if (fieldId) {
                // 根据 fieldId 查找字段并选中
                var field = self.DiyFieldList.find(f => f && f.Id === fieldId);
                if (field) {
                    self.SelectField(field);
                }
            }
        },
handleCreated(editor) {
            // removed debug log
            // this.editorRef = editor; // 记录 editor 实例，重要！
            this.editorRef = Object.seal(editor); // 一定要用 Object.seal() ，否则会报错
        },
handleChange(editor) {
            // removed debug log
        },
handleDestroyed(editor) {
            // removed debug log
        },
handleFocus(editor) {
            // removed debug log
        },
handleBlur(editor) {
            // removed debug log
        },
customAlert(info, type) {
            // alert(`【自定义提示】${type} - ${info}`);
        },
customPaste(editor, event, callback) {
            // removed debug log
            // 自定义插入内容
            // editor.insertText('xxx');
            // 返回值（注意，vue 事件的返回值，不能用 return）
            // callback(false); // 返回 false ，阻止默认粘贴行为
            callback(true); // 返回 true ，继续默认的粘贴行为
        },
getActiveTabFieldsForSort() {
            var self = this;
            var currentTab = self.FieldActiveTab || '';
            var tabs = self.FormTabs || [];
            var activeTabIndex = tabs.findIndex((tab) => tab && (tab.Id === currentTab || tab.Name === currentTab));
            var activeTab = activeTabIndex > -1 ? tabs[activeTabIndex] : null;
            return (self.DiyFieldList || [])
                .filter((field) => {
                    if (!field) return false;
                    var shouldShow = self.ShowHideField === true ||
                        ((self.ShowFields.length === 0 || self.ShowFields.indexOf(field.Name) > -1) &&
                         self.HideFields.indexOf(field.Name) === -1);
                    if (!shouldShow) return false;
                    var fieldTab = field.Tab || '';
                    if (activeTab) {
                        if (fieldTab === (activeTab.Id || '') || fieldTab === (activeTab.Name || '')) {
                            return true;
                        }
                        if (activeTabIndex === 0) {
                            var assignedToAnyTab = tabs.some((tab) => tab && (fieldTab === (tab.Id || '') || fieldTab === (tab.Name || '')));
                            return !assignedToAnyTab;
                        }
                        return false;
                    }
                    return fieldTab === currentTab || (!currentTab && !fieldTab);
                })
                .sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
        },
applyTabFieldSort(tabFields) {
            var self = this;
            tabFields.forEach((field, index) => {
                var originalField = self.DiyFieldList.find((item) => item && field && item.Id === field.Id);
                if (originalField) {
                    originalField.Sort = (index + 1) * 100;
                }
            });
            self.DiyFieldList = [...self.DiyFieldList].sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
            if (typeof self.RefreshDiyFieldRuntimeState === 'function') {
                self.RefreshDiyFieldRuntimeState();
            }
        },
onFieldAdd(evt) {
            var self = this;
            // 从设计器拖入时，由 diy-design.vue 处理添加逻辑
            // 这里只是一个占位符，确保事件能正确触发
            self.$emit('CallbackFieldAdd', evt);
        },
onFieldDragEnd(evt) {
            var self = this;
            // 只处理同列表内的排序（不处理跨列表的添加）
            if (evt.from !== evt.to) return;
            // 位置没变化不处理
            if (evt.oldIndex === evt.newIndex) return;
            // 非设计模式不处理
            if (self.LoadMode !== 'Design') return;

            var tabFields = self.getActiveTabFieldsForSort();
            var movedField = tabFields.splice(evt.oldIndex, 1)[0];
            if (!movedField) return;
            tabFields.splice(evt.newIndex, 0, movedField);
            self.applyTabFieldSort(tabFields);

            // 通知父组件字段顺序已改变
            self.$emit('CallbackFieldOrderChanged', {
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex,
                fieldIds: tabFields.map((field) => field.Id)
            });

            // 通知父组件更新字段列表
            self.$emit('CallbackGetDiyField', self.DiyFieldList);
        },
onFieldDragUpdate(evt) {
            var self = this;
            // 非设计模式不处理
            if (self.LoadMode !== 'Design') return;
            // 位置没变化不处理
            if (evt.oldIndex === evt.newIndex) return;
            self.onFieldDragEnd(evt);
        },
updateFieldOrder(oldIndex, newIndex) {
            var self = this;
            var tabFields = self.getActiveTabFieldsForSort();
            var movedField = tabFields.splice(oldIndex, 1)[0];
            if (!movedField) return;
            tabFields.splice(newIndex, 0, movedField);
            self.applyTabFieldSort(tabFields);
            self.$emit('CallbackGetDiyField', self.DiyFieldList);
        },
showFieldToolbar(field, event) {
            var self = this;
            if (self.LoadMode !== 'Design') return;

            self.selectedFieldForToolbar = field;
        },
hideFieldToolbar() {
            var self = this;
            // 延迟隐藏，以便点击工具栏按钮
            setTimeout(() => {
                if (!self.isResizingWidth) {
                    self.fieldToolbarVisible = false;
                }
            }, 200);
        },
hasComponentConfig(field) {
            var self = this;
            return true;
            // 定义支持独立配置的组件类型
            var configComponents = ['JsonTable', 'Select'];
            return configComponents.includes(field.Component);
        },
openComponentConfig(field) {
            var self = this;
            var refComponent = self.getRefComponent(field.Name);
            if (refComponent && typeof refComponent.openConfig === 'function') {
                refComponent.openConfig();
            } else {
                self.DiyCommon.Tips('该组件不支持配置', false);
            }
        },
duplicateField(field) {
            var self = this;
            self.$emit('CallbackDuplicateField', field);
        },
deleteField(field) {
            var self = this;
            self.$emit('CallbackDeleteField', field);
        },
adjustFieldWidth(field, delta) {
            var self = this;
            var newWidth = field.FormWidth || field._span;
            newWidth = Math.max(1, Math.min(24, newWidth + delta));

            // 更新字段宽度
            field.FormWidth = newWidth;
            field._span = newWidth;
            if (typeof self.RefreshDiyFieldRuntimeState === 'function') {
                self.RefreshDiyFieldRuntimeState();
            }

            // 通知父组件字段已更新
            self.$emit('CallbackFieldWidthChanged', {
                field: field,
                width: newWidth
            });
        },
startResizeWidth(field, event) {
            var self = this;
            if (self.LoadMode !== 'Design') return;

            self.resizingField = field;
            self.resizeStartX = event.clientX;
            self.resizeStartWidth = field.FormWidth || field._span;
            self.isResizingWidth = true;

            // 添加全局事件监听
            document.addEventListener('mousemove', self.onResizeWidthMove);
            document.addEventListener('mouseup', self.stopResizeWidth);

            // 阻止默认行为
            event.preventDefault();
            event.stopPropagation();
        },
onResizeWidthMove(event) {
            var self = this;
            if (!self.resizingField) return;

            // 计算鼠标移动距离（像素）
            var deltaX = event.clientX - self.resizeStartX;

            // 每50像素增加1个栅格
            var deltaSpan = Math.round(deltaX / 50);

            // 计算新宽度
            var newWidth = Math.max(1, Math.min(24, self.resizeStartWidth + deltaSpan));

            // 更新字段宽度
            self.resizingField.FormWidth = newWidth;
            self.resizingField._span = newWidth;
        },
stopResizeWidth(event) {
            var self = this;
            if (!self.resizingField) return;

            // 通知父组件字段已更新
            self.$emit('CallbackFieldWidthChanged', {
                field: self.resizingField,
                width: self.resizingField.FormWidth || self.resizingField._span
            });

            // 移除全局事件监听
            document.removeEventListener('mousemove', self.onResizeWidthMove);
            document.removeEventListener('mouseup', self.stopResizeWidth);

            // 重置状态
            self.resizingField = null;
            self.isResizingWidth = false;
        },
SelectField(field) {
            var self = this;
            self.CurrentDiyFieldModel = field;
            // if (field.Component == 'Checkbox'
            //     || field.Component == 'MultipleSelect'
            //     ) {
            //     self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = [];//self.CurrentDiyFieldModel.Data
            // }else{
            //     self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = '';
            // }
            // self.AsideRightActiveTab = 'Field';
            self.$emit("CallbackSelectField", field);
        },
AddDiyFieldArr(field, insertIndex) {
            var self = this;
            self.DiyFieldList.push(field);
            self.DiyFieldList.sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
            self.DiyFieldList = [...self.DiyFieldList];
            if (typeof self.RefreshDiyFieldRuntimeState === 'function') {
                self.RefreshDiyFieldRuntimeState();
            }
        },
UptDiyFieldArr(field) {
            var self = this;
            self.DiyFieldList.forEach((element) => {
                if (element.Id == field.Id) {
                    element = field;
                }
            });
        },
UptDiyFieldDataSource(fieldName, dataSource) {
            var self = this;
            self.DiyFieldList.forEach((element) => {
                if (element.Name == fieldName) {
                    element.Data = dataSource;
                }
            });
        },
DelDiyFieldArr(field) {
            var self = this;
            var index = 0;
            self.DiyFieldList.forEach((element) => {
                if (element.Id == field.Id) {
                    self.DiyFieldList.splice(index, 1);
                }
                index++;
            });
            if (typeof self.RefreshDiyFieldRuntimeState === 'function') {
                self.RefreshDiyFieldRuntimeState();
            }
        },
    }
};
