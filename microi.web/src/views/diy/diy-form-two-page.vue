<template>
  <div class="forklift-management">
    <el-row :gutter="20" class="main-container">
      <!-- 左侧分类树（3/7分） -->
      <el-col :span="6">
        <el-card class="box-card" style="height: 87vh">
          <div slot="header" class="clearfix">
            <span style="font-size: 14px"><i class="fas fa-sitemap mr-2"></i> 分类</span>
            <div style="float: right">
              <!-- 顶级分类添加按钮 -->
              <el-button
                size="mini"
                type="primary"
                @click="OpenAnyForm({},'')"
              >添加分类
              </el-button
              >
              <el-button
                size="mini"
                style="margin-left: 5px"
                @click="refreshTree"
              >刷新
              </el-button
              >
            </div>
          </div>
          <!--抽屉或弹窗打开完整的Form-->
          <DiyFormDialog ref="refDiyTable_DiyFormDialog" @CallbackGetDiyTableRow="handleFormClosed"></DiyFormDialog>
          <!-- 分类树组件 -->
          <div class="tree-container">
            <el-input
              placeholder="输入关键字进行过滤"
              v-model="filterText">
            </el-input>
            <div class="custom-tree">
              <el-tree
                :data="categories"
                :props="defaultProps"
                node-key="Id"
                :highlight-current="true"
                :filter-node-method="filterNode"
                :default-expanded-keys="ExpandedKeys"
                :default-checked-keys="CheckedKeys"
                :expand-on-click-node="true"
                @node-click="handleCategoryClick"
                ref="categoryTree"
              >
                <!-- 自定义树节点 -->
                <span class="custom-tree-node" slot-scope="{ node, data }">
                <span>{{ node.label }}</span>
                <span class="tree-actions">
                  <!-- 添加子分类按钮 -->
                  <el-button
                    type="text"
                    size="mini"
                    icon="el-icon-plus"
                    @click.stop="OpenAnyForm(data,'Add','Child')"
                    title="添加子分类"
                  ></el-button>
                  <!-- 编辑分类按钮 -->
                  <el-button
                    type="text"
                    size="mini"
                    icon="el-icon-edit"
                    @click.stop="OpenAnyForm(data,'Edit','Child')"
                    title="编辑分类"
                  ></el-button>
                  <!-- 删除分类按钮（仅无子分类时显示） -->
                  <el-button
                    type="text"
                    size="mini"
                    icon="el-icon-delete"
                    @click.stop="deleteCategory(data)"
                    v-if="!data._Child || data._Child.length === 0"
                    title="删除分类"
                  ></el-button>
                </span>
              </span>
              </el-tree>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧产品列表（3/7分） -->
      <el-col :span="18">
        <el-card class="products-card">
          <DiyTableRowlist :PropsWhere="whereList" :ParentV8="clickData"></DiyTableRowlist>
        </el-card>
      </el-col>
    </el-row>
    <!-- 添加/编辑分类对话框 -->
    <el-dialog
      :title="categoryDialog.title"
      :visible.sync="categoryDialog.visible"
      width="30%"
    >
      <el-form
        :model="categoryDialog.form"
        label-width="80px"
        ref="categoryForm"
      >
        <el-form-item
          label="分类名称"
          prop="label"
          :rules="[
            { required: true, message: '请输入分类名称', trigger: 'blur' },
          ]"
        >
          <el-input v-model="categoryDialog.form.label"></el-input>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="categoryDialog.visible = false">取 消</el-button>
        <el-button type="primary" @click="saveCategory">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import DiyTableRowlist from "@/views/diy/diy-table-rowlist.vue";
import DiyFormDialog from "@/views/diy/diy-form-dialog";

export default {
  components: {
    DiyTableRowlist,
    DiyFormDialog
  },
  data() {
    return {
      // 当前选中的分类
      currentCategory: null,
      // 分类数据（仅包含分类信息，不含产品）
      categories: [],
      // 树组件配置
      TreeMenuId: this.$route.query.TreeMenuId,
      TreeTableName: this.$route.query.TreeTableName,
      ParentField: this.$route.query.ParentField,
      defaultProps: {
        children: "_Child",
        label: this.$route.query.DisplayField
      },
      filterText: "",
      // 默认展开的节点
      ExpandedKeys: [],
      // 默认选中的节点
      CheckedKeys: [],
      // 分类对话框数据
      categoryDialog: {
        visible: false,
        title: "添加分类",
        form: {
          id: null,
          label: "",
          parentId: null
        },
        mode: "add" // 'add' 或 'edit'
      },
      whereList: [{
        Name: this.$route.query.ChildFiledld,
        Value: "XXXXXXX",
        Type: "="
      }],
      // 分类点击事件传给表格数据
      clickData: {
        Origin: "BomProject"
      }
    };
  },
  created() {
    this.treeData(this.TreeMenuId);
  },
  watch: {
    filterText(val) {
      this.$refs.categoryTree.filter(val);
    }
  },
  computed: {},
  methods: {
    filterNode(value, data) {
      if (!value) return true;
      return data[this.defaultProps.label].indexOf(value) !== -1;
    },
    async treeData(TreeMenuId) {
      var self = this;
      self.DiyCommon.Post(
        self.DiyCommon.GetApiBase() + "/api/diytable/getDiyTableRowTree",
        {
          ModuleEngineKey: TreeMenuId
        },
        function(res) {
          self.categories = res.Data;
        }
      );
    },
    OpenAnyForm(ParentData,FormMode, origin) {
      var self = this;
      var param = {
        TableName: this.TreeTableName, //必传。打开哪张表。
        FormMode: FormMode, //必传。打开的模式：Add、Edit、View
        Id: ParentData.Id, //当FormMode为Edit、View时，必传Id。
        DialogType: "Dialog", //可选。打开的方式，不传则默认为表单属性设置的打开方式。
        Width: "765px" //可选。弹出层的宽度。不传则默认为表单属性设置的弹出宽度。
      };
      if (origin === "Child" && FormMode === 'Add') {

        Object.assign(param, {
            DataAppend: {
              //传入自定义附加数据，DataAppend为固定参数名称。可在指定的打开表单V8事件中使用V8.DataAppend访问。
              ParentField: this.ParentField,
              ParentData: ParentData
            }
          },
          {
            EventReplace: {
              //这3个参数一定会接收到，必须执行callback(DosResult)
              Submit: async function(v8, data, callback) {
                //调用指派接口
                // data._FormData[v8.DataAppend.ParentField] = ParentData.Id;
                var result = await v8.FormEngine.AddFormData(data.FormEngineKey, {
                  ...data._FormData
                });
                callback(result);
              }
            }
          });
      }
      self.$refs.refDiyTable_DiyFormDialog.Init(param);
    },
    // 表单提交刷新事件
    async handleFormClosed(data) {
      try {
        // 保存当前滚动位置等状态
        const tree = this.$refs.categoryTree;
        const oldScrollTop = tree?.$el?.querySelector('.el-tree__body-wrapper')?.scrollTop || 0;

        // 刷新树数据
        await this.treeData(this.TreeMenuId);

        // 确保DOM更新
        await this.$nextTick();

        // 恢复状态
        if (tree) {
          const wrapper = tree.$el.querySelector('.el-tree__body-wrapper');
          if (wrapper) wrapper.scrollTop = oldScrollTop;
        }

        // 触发节点选中
        await this.triggerTreeNodeClick(data.TableRowId);

      } catch (error) {
        console.error("处理表单关闭时出错:", error);
      }
    },
    /**
     * 处理分类节点点击事件
     * @param {Object} data 点击的分类数据
     */
    handleCategoryClick(data) {
      this.whereList = [{
        Name: this.$route.query.ChildFiledld,
        Value: data.Id,
        Type: "="
      }];
      this.clickData = {
        Origin: "BomProject",
        ...data
      };
    },
    /**
     * 根据ID触发树节点的点击事件，并展开所有父节点确保节点可见
     * @param {String|Number} id 要触发的节点ID
     * @param {Number} retryCount 重试次数（内部使用）
     */
    triggerTreeNodeClick(id, retryCount = 0) {
      const tree = this.$refs.categoryTree;

      if (!tree) {
        if (retryCount < 3) {
          setTimeout(() => {
            this.triggerTreeNodeClick(id, retryCount + 1);
          }, 500);
        }
        return;
      }

      const node = tree.getNode(id);

      if (node) {
        // 先设置当前节点
        tree.setCurrentKey(id);

        // 然后获取路径并展开
        const pathIds = this.getNodePathIds(node);
        this.ExpandedKeys = [...new Set([...this.ExpandedKeys, ...pathIds])]; // 合并而不是替换

        // 最后触发点击事件
        this.$nextTick(() => {
          this.handleCategoryClick(node.data);
        });
      } else {
        if (retryCount < 3) {
          setTimeout(() => {
            this.triggerTreeNodeClick(id, retryCount + 1);
          }, 500);
        }
      }
    },

    /**
     * 获取从根节点到当前节点的路径ID数组
     * @param {Object} node 树节点对象
     * @returns {Array} 路径ID数组
     */
    getNodePathIds(node) {
      const ids = [];
      let current = node;

      while (current) {
        ids.unshift(current.data.Id); // 使用你的实际ID字段名
        current = current.parent;
      }

      // 移除根节点ID（如果需要）
      return ids.slice(1);
    },
    /**
     * 递归获取分类及其所有子分类的ID
     * @param {Object} category 分类数据
     * @returns {Array} 包含所有相关分类ID的数组
     */
    getAllCategoryIds(category) {
      let ids = [category.id];
      if (category.children && category.children.length > 0) {
        category.children.forEach(child => {
          ids = [...ids, ...this.getAllCategoryIds(child)];
        });
      }
      return ids;
    },

    /**
     * 保存分类（添加或编辑）
     */
    saveCategory() {
      this.$refs.categoryForm.validate(valid => {
        if (valid) {
          if (this.categoryDialog.mode === "add") {
            // 添加新分类
            const newId = Date.now();
            const newCategory = {
              id: newId,
              label: this.categoryDialog.form.label,
              children: []
            };

            if (this.categoryDialog.form.parentId) {
              // 添加到子分类
              const parent = this.findCategory(this.categories, this.categoryDialog.form.parentId);
              if (parent) {
                parent.children.push(newCategory);
                // 更新树组件
                this.$refs.categoryTree.updateKeyChildren(parent.id, parent.children);
              }
            } else {
              // 添加到顶级分类
              this.categories.push(newCategory);
            }
          } else {
            // 编辑分类
            const category = this.findCategory(this.categories, this.categoryDialog.form.id);
            if (category) {
              category.label = this.categoryDialog.form.label;
            }
          }

          this.categoryDialog.visible = false;
          this.$message({
            message: "分类保存成功",
            type: "success"
          });
        }
      });
    },

    /**
     * 删除分类 - 修复：只删除当前选中的分类，不影响同级分类
     * @param {Object} data 要删除的分类数据
     */
    deleteCategory(data) {
      this.$confirm(`确定要删除分类【${data[this.defaultProps.label]}】吗?`, "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }).then(() => {
        this.DiyCommon.FormEngine.DelFormData(this.TreeTableName,{Id:data.Id});
        this.refreshTree()
        this.$message({
          message: `【${data[this.defaultProps.label]}】分类删除成功`,
          type: "success"
        });
        // // 查找父分类
        // const parent = this.findCategoryParent(this.categories, data.id);
        //
        // if (parent) {
        //   // 只删除当前选中的分类，不影响同级分类
        //   parent.children = parent.children.filter(item => item.id !== data.id);
        //   // 更新树组件，只更新父分类的子节点
        //   this.$refs.categoryTree.updateKeyChildren(parent.id, parent.children);
        // } else {
        //   // 顶级分类，直接从categories中删除
        //   this.categories = this.categories.filter(item => item.id !== data.id);
        // }
        //
        // this.$message({
        //   type: "success",
        //   message: "分类删除成功!"
        // });
        //
        // // 如果删除的是当前选中的分类，清空选择
        // if (this.currentCategory && this.currentCategory.id === data.id) {
        //   this.currentCategory = null;
        // }
      }).catch(() => {
        // 用户取消删除
      });
    },

    /**
     * 在分类树中查找指定ID的分类
     * @param {Array} categories 分类数组
     * @param {Number} id 要查找的分类ID
     * @returns {Object|null} 找到的分类或null
     */
    findCategory(categories, id) {
      for (const category of categories) {
        if (category.id === id) {
          return category;
        }
        if (category.children && category.children.length > 0) {
          const found = this.findCategory(category.children, id);
          if (found) return found;
        }
      }
      return null;
    },

    /**
     * 查找分类的父分类
     * @param {Array} categories 分类数组
     * @param {Number} id 要查找父分类的分类ID
     * @param {Object|null} parent 父分类（递归使用）
     * @returns {Object|null} 找到的父分类或null
     */
    findCategoryParent(categories, id, parent = null) {
      for (const category of categories) {
        if (category.id === id) {
          return parent;
        }
        if (category.children && category.children.length > 0) {
          const found = this.findCategoryParent(category.children, id, category);
          if (found) return found;
        }
      }
      return null;
    },

    /**
     * 刷新分类树
     */
    refreshTree() {
      this.treeData(this.TreeMenuId);
      this.whereList = [{
        Name: this.$route.query.ChildFiledld,
        Value: "XXXXXXX",
        Type: "="
      }];
      // 分类点击事件传给表格数据
      this.clickData = {
        Origin: "BomProject"
      };
      this.$message({
        message: "分类树已刷新",
        type: "success"
      });
    },

    /**
     * 显示添加产品对话框
     */
    showAddProductDialog() {
      if (!this.currentCategory) {
        this.$message.warning("请先选择一个分类");
        return;
      }
      this.addProductDialog = {
        visible: true,
        form: {
          name: "",
          model: "",
          loadCapacity: null,
          liftHeight: null,
          description: ""
        }
      };
    },

    /**
     * 保存新产品
     */
    saveNewProduct() {
      this.$refs.addProductForm.validate(valid => {
        if (valid) {
          const newProduct = {
            id: Date.now(),
            categoryId: this.currentCategory.id,
            name: this.addProductDialog.form.name,
            model: this.addProductDialog.form.model,
            loadCapacity: this.addProductDialog.form.loadCapacity,
            liftHeight: this.addProductDialog.form.liftHeight,
            description: this.addProductDialog.form.description,
            images: [],
            accessories: [],
            techParams: []
          };

          // 添加到产品列表
          this.products.push(newProduct);

          this.addProductDialog.visible = false;
          this.$message({
            message: "产品添加成功",
            type: "success"
          });
        }
      });
    }
  }
};
</script>

<style scoped>
.forklift-management {
  padding: 5px;
}

.main-container {
  height: calc(100vh - 40px);
}

/* 左侧分类卡片 */
.box-card {
  height: 87vh;
  display: flex;
  flex-direction: column;
}

/* 卡片内容区域 - 关键修改 */
.box-card >>> .el-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 10px;
}

/* 树形容器 - 关键修改 */
.tree-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 搜索框 */
.el-input {
  margin-bottom: 10px;
}

/* 树形组件 - 关键修改 */
.custom-tree {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 5px;
}

.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}

.tree-actions {
  display: inline-block;
}

.tree-actions .el-button {
  padding: 0 2px;
}

/* 右侧产品卡片 */
.products-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 其他样式保持不变 */
.el-table {
  flex: 1;
  overflow-y: auto;
}

.table-pagination {
  margin-top: 15px;
  text-align: right;
}

.product-detail {
  padding: 20px 0;
}

.product-image {
  width: 100%;
  height: 300px;
  object-fit: contain;
}

.empty-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
}

.empty-image i {
  font-size: 60px;
  margin-bottom: 20px;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-actions {
  display: flex;
  align-items: center;
}

.detail-content {
  padding: 20px;
}

.section-header {
  font-size: 18px;
  font-weight: bold;
  margin: 10px 0 15px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #EBEEF5;
}

.table-operation-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
</style>
