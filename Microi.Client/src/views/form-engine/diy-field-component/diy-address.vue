<template>
    <!--注意：如果表内编辑开启了此控件类型的字段，会导致列表DOM渲染非常卡！！！-->
    <el-cascader
        v-if="field.Component == 'Address' && !diyStore.IsPhoneView"
        v-model="ModelValue"
        :clearable="true"
        :disabled="GetFieldReadOnly(field)"
        :options="regionData"
        @change="CommonV8CodeChange"
        :collapse-tags="LoadType == 'Table' ? true : false"
        :props="props"
    >
    </el-cascader>
    <!-- zhy此处只针对地移动端地区选择 -->
    <el-tree-select
        v-if="field.Component == 'Address' && diyStore.IsPhoneView"
        v-model="appRegionValue"
        :data="appRegionData"
        :props="defineProps"
        placeholder="请选择"
        clearable
        :disabled="GetFieldReadOnly(field)"
        @change="treeNodeClick()"

    />
</template>

<script>
import { regionDataPlus } from "element-china-area-data";
import _ from "underscore";
import { useDiyStore } from "@/pinia";
export default {
    name: "diy-autocomplete",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'CallbackInTableEditSave', 'update:modelValue'],
    setup(props) {
        const diyStore = useDiyStore();
        return {
            diyStore,
        };
    },
    data() {
        return {
            ModelValue: [],
            appRegionValue: [],//移动端地区选择绑定值，主要是通过ModelValue值转换来
            LastModelValue: [],
            regionData: regionDataPlus,
            appRegionData: [],
            props: {
                value: "label"
            },
            defineProps: {
                    value: 'fullPath',
                    label: 'fullPath', // 显示完整路径
                    children: 'children'
                  },
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
        modelValue: {},
        ModelProps: {},
        field: {
            type: Object,
            default() {
                return {};
            }
        },
        LoadType: {
            type: String,
            default: "" //Form、Table
        },
        FormDiyTableModel: {
            type: Object,
            default() {
                return {};
            }
        },
        //表单模式Add、Edit、View
        FormMode: {
            type: String,
            default: "" //View
        },
        // ['FieldName1','FieldName2']
        ReadonlyFields: {
            type: Array,
            default: () => []
        },
        FieldReadonly: {
            type: Boolean,
            default: null
        },
        TableInEdit: {
            type: Boolean,
            default: false
        },
        TableId: {
            type: String,
            default: "" //View
        }
    },

    watch: {
        modelValue: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = newVal;
                // zhy同步更新手机端树形选择器的值
                if (newVal && Array.isArray(newVal)) {
                    self.appRegionValue = newVal.join('/');
                } else if (typeof newVal === 'string' && newVal) {
                    self.appRegionValue = newVal;
                }
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = self.ModelProps;
            }
        }
    },

    components: {},

    computed: {},

    mounted() {
        var self = this;
        self.Init();
        var a = self.regionData;
        // console.log('地区数据',self.ModelValue)
        //修改地区数据
        self.appRegionData = self.addFullPath(regionDataPlus);
    },

    methods: {
        // zhy递归处理树形数据，修改树形节点名称为完整路径，添加fullPath属性，并处理"全部"选项改为上级value值拼接一个0，防止选中全部时错乱
        addFullPath(nodes, parentPath = '', parentCode = '') {
              if (!nodes || !nodes.length) return [];

                return nodes.map(node => {
                  const currentPath = parentPath ? `${parentPath} / ${node.label}` : node.label;

                  // 处理"全部"选项
                  let value = node.value;
                  if (node.label === '全部' && !value) {
                    value = parentCode ? `${parentCode}0` : '0';
                  }

                  const newNode = { ...node, value, fullPath: currentPath };

                  // 递归处理子节点
                  if (node.children?.length) {
                    newNode.children = this.addFullPath(node.children, currentPath, value);
                  }

                  return newNode;
                });
            },
        Init() {
            var self = this;
            var modelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            if (typeof modelValue == "string" && !self.DiyCommon.IsNull(modelValue)) {
                modelValue = JSON.parse(modelValue);
            }
            self.ModelValue = modelValue;
            // console.log(modelValue, self.ModelValue, 8888);
            //zhy新增树形默认值
            if (modelValue) {
                self.appRegionValue = modelValue.join('/');
            }
            // console.log(modelValue,self.appRegionValue,'手机端城市')
            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        },
        GetFieldValue(field, form) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.AsName)) {
                return form[field.AsName];
            }
            return form[field.Name];
        },
        ModelChangeMethods(item) {
            var self = this;
            self.ModelValue = item;
            self.$emit("ModelChange", self.ModelValue);
            self.$emit("update:modelValue", self.ModelValue);
        },
        // zhy传送给接口的数据是数组所以选中值后将字符串转换，并直接调用之前的选择方法，不额外修改该组件原有数据
        treeNodeClick() {
         var self = this;
         var treeVule = self.appRegionValue.split('/');
         self.CommonV8CodeChange(treeVule);
        },
        CommonV8CodeChange(item) {
            //, field
            var self = this;
            // console.log(item,6666)
            //2022-09-28发现bug：此控件外部赋值后，并不会触发watch --> ModelProps，所以在这里额外处理下
            self.ModelValue = item;
            //zhy外部调用后也能给树形赋值
            if (Array.isArray(item)) {
              self.appRegionValue = item.join('/');
            }
            self.ModelChangeMethods(item);
            if (self.field.V8Code || self.field.Config.V8Code) {
                self.$emit("CallbackRunV8Code", { field: self.field, thisValue: item });
            }
            self.$emit("CallbackFormValueChange", self.field, item);
            if (self.TableInEdit && self.FormDiyTableModel._IsInTableAdd !== true) {
                var __interceptPayload = { row: self.FormDiyTableModel, field: self.field, oldValue: self.LastModelValue, newValue: self.ModelValue, handled: false };
                self.$emit("CallbackInTableEditSave", __interceptPayload);
                if (__interceptPayload.handled === true) { self.LastModelValue = self.ModelValue; return; }
            }
            let dataLog = [
                {
                    Name: self.field.Name,
                    Label: self.field.Label || key,
                    Component: self.field.Component,
                    OVal: self.LastModelValue || "", //老值
                    NVal: self.ModelValue || "" //新值
                }
            ];
            // param._DataLog = JSON.stringify(dataLog);
        },
        GetFieldReadOnly(field) {
            var self = this;
            if (self.FieldReadonly == true) {
                return true;
            }
            if (self.FormMode == "View") {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true;
            }
            return field.Readonly ? true : false;
        },
        SelectField(field) {
            var self = this;
            self.$emit("CallbackSelectField", field);
        }
    }
};
</script>

<style lang="scss" scoped></style>
