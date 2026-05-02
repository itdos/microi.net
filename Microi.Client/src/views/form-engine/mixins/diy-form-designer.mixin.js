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

            // 获取当前 tab 标识
            var currentTab = self.FieldActiveTab;

            // 从 DiyFieldListGrouped 获取当前 tab 的字段列表（这是 computed 属性的副本）
            var tabFieldsFromGrouped = self.DiyFieldListGrouped[currentTab] || [];
            if (tabFieldsFromGrouped.length === 0) return;

            // 由于 :list 绑定，draggable 已经修改了 tabFieldsFromGrouped 的顺序
            // 我们需要按新顺序更新每个字段的 Sort 值
            tabFieldsFromGrouped.forEach((field, index) => {
                // 找到原始 DiyFieldList 中的对应字段并更新 Sort
                var originalField = self.DiyFieldList.find(f => f.Id === field.Id);
                if (originalField) {
                    originalField.Sort = (index + 1) * 100;
                }
            });

            // 强制触发 Vue 响应式更新
            // 通过创建新数组引用来触发 computed 重新计算
            self.DiyFieldList = [...self.DiyFieldList];

            console.log('字段顺序已改变:', { oldIndex: evt.oldIndex, newIndex: evt.newIndex });

            // 通知父组件字段顺序已改变
            self.$emit('CallbackFieldOrderChanged', {
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex
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

            // 获取当前 tab 标识
            var currentTab = self.FieldActiveTab;

            // 获取 v-model 绑定的数组（已经被 draggable 更新了顺序）
            var tabFields = self.DiyFieldListGrouped[currentTab] || [];

            if (tabFields.length === 0) return;

            // 重新计算该 tab 下所有字段的 Sort 值
            tabFields.forEach((field, index) => {
                field.Sort = (index + 1) * 100;
            });

            // 强制触发 Vue 响应式更新
            self.DiyFieldList = [...self.DiyFieldList];

            // 通知父组件字段顺序已改变
            self.$emit('CallbackFieldOrderChanged', {
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex
            });

            // 通知父组件更新字段列表
            self.$emit('CallbackGetDiyField', self.DiyFieldList);
        },
updateFieldOrder(oldIndex, newIndex) {
            var self = this;
            // 获取当前 tab 的字段列表
            var currentTab = self.FieldActiveTab;
            var tabFields = self.DiyFieldListGrouped[currentTab] || [];

            if (tabFields.length === 0) return;

            // 在 DiyFieldList 中找到这些字段并更新顺序
            var movedField = tabFields[oldIndex];
            if (!movedField) return;

            // 移除原位置的字段
            var fieldIndex = self.DiyFieldList.findIndex(f => f.Id === movedField.Id);
            if (fieldIndex === -1) return;

            self.DiyFieldList.splice(fieldIndex, 1);

            // 计算新位置
            var targetField = tabFields[newIndex];
            var targetIndex = targetField ? self.DiyFieldList.findIndex(f => f.Id === targetField.Id) : self.DiyFieldList.length;

            // 插入到新位置
            if (oldIndex < newIndex) {
                // 向后移动，插入到目标位置之后
                self.DiyFieldList.splice(targetIndex, 0, movedField);
            } else {
                // 向前移动，插入到目标位置
                self.DiyFieldList.splice(targetIndex, 0, movedField);
            }

            // 重新分配 Sort 值（100递增）
            self.DiyFieldList.forEach((field, index) => {
                field.Sort = (index + 1) * 100;
            });

            // 通知父组件更新字段列表
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
            console.log('[diy-form] ========== AddDiyFieldArr 开始 ==========');
            console.log('[diy-form] 字段数据:', field);
            console.log('[diy-form] insertIndex:', insertIndex);
            console.log('[diy-form] 当前DiyFieldList长度:', self.DiyFieldList.length);
            console.log('[diy-form] 添加前的DiyFieldList:', JSON.parse(JSON.stringify(self.DiyFieldList)));
            console.log('[diy-form] 当前活动Tab:', self.FieldActiveTab);
            console.log('[diy-form] 新字段的Tab:', field.Tab);

            // 如果有指定位置，就插入到该位置；否则添加到末尾
            if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= self.DiyFieldList.length) {
                console.log('[diy-form] 插入到位置:', insertIndex);
                self.DiyFieldList.splice(insertIndex, 0, field);
            } else {
                console.log('[diy-form] 添加到末尾');
                self.DiyFieldList.push(field);
            }

            console.log('[diy-form] 添加后的DiyFieldList长度:', self.DiyFieldList.length);
            console.log('[diy-form] 添加后的DiyFieldList:', JSON.parse(JSON.stringify(self.DiyFieldList)));

            // 🔥 强制触发computed重新计算：修改renderedFieldCounts
            console.log('[diy-form] 触发computed重新计算...');
            self.$nextTick(() => {
                // 修改renderedFieldCounts以触发DiyFieldListGrouped重新计算
                if (!self.renderedFieldCounts) {
                    self.renderedFieldCounts = {};
                }
                var currentTab = field.Tab || '';
                self.renderedFieldCounts[currentTab] = (self.renderedFieldCounts[currentTab] || 0) + 1;
                console.log('[diy-form] 更新renderedFieldCounts:', JSON.parse(JSON.stringify(self.renderedFieldCounts)));
                console.log('[diy-form] DiyFieldListGrouped已重新计算');
            });

            console.log('[diy-form] ========== AddDiyFieldArr 结束 ==========');
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
        },
    }
};
