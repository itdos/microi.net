<template>
  <div class="test-form">
    <el-card>
      <div slot="header">
        <span>表单测试</span>
        <el-button style="float: right; padding: 3px 0" type="text" @click="goHome"> 返回首页 </el-button>
      </div>

      <el-form ref="form" :model="formData" :rules="rules" label-width="100px" class="test-form-content">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="formData.name" placeholder="请输入姓名" @input="updateFormData('name', $event)" />
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="formData.email" placeholder="请输入邮箱" @input="updateFormData('email', $event)" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="消息" prop="message">
          <el-input v-model="formData.message" type="textarea" :rows="4" placeholder="请输入消息内容" @input="updateFormData('message', $event)" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmitForm" :loading="submitting" icon="el-icon-check"> 提交表单 </el-button>
          <el-button @click="resetForm" icon="el-icon-refresh"> 重置表单 </el-button>
          <el-button type="info" @click="previewForm" icon="el-icon-view"> 预览数据 </el-button>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">表单数据预览</el-divider>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-card shadow="hover">
            <div slot="header">
              <span>当前表单数据</span>
            </div>
            <pre class="form-data-preview">{{ JSON.stringify(formData, null, 2) }}</pre>
          </el-card>
        </el-col>

        <el-col :span="12">
          <el-card shadow="hover">
            <div slot="header">
              <span>表单验证状态</span>
            </div>
            <div class="validation-status">
              <el-tag v-for="field in validationFields" :key="field.name" :type="field.valid ? 'success' : 'danger'" style="margin: 5px">
                {{ field.name }}: {{ field.valid ? "有效" : "无效" }}
              </el-tag>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-divider content-position="left">提交历史</el-divider>

      <el-table :data="submitHistory" style="width: 100%">
        <el-table-column prop="timestamp" label="提交时间" width="180" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="email" label="邮箱" width="200" />
        <el-table-column prop="message" label="消息" />
        <el-table-column prop="status" label="状态" width="100">
          <template slot-scope="scope">
            <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'">
              {{ scope.row.status === "success" ? "成功" : "失败" }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapMutations } from "vuex";

export default {
  name: "TestForm",
  data() {
    return {
      submitting: false,
      submitHistory: [],
      rules: {
        name: [
          { required: true, message: "请输入姓名", trigger: "blur" },
          { min: 2, max: 20, message: "长度在 2 到 20 个字符", trigger: "blur" }
        ],
        email: [
          { required: true, message: "请输入邮箱地址", trigger: "blur" },
          { type: "email", message: "请输入正确的邮箱地址", trigger: "blur" }
        ],
        message: [
          { required: true, message: "请输入消息内容", trigger: "blur" },
          { min: 10, max: 500, message: "长度在 10 到 500 个字符", trigger: "blur" }
        ]
      }
    };
  },

  computed: {
    ...mapGetters("test-plugin", ["formData"]),

    validationFields() {
      return [
        { name: "姓名", valid: this.formData.name.length >= 2 },
        { name: "邮箱", valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email) },
        { name: "消息", valid: this.formData.message.length >= 10 }
      ];
    }
  },

  methods: {
    ...mapActions("test-plugin", ["submitForm"]),
    ...mapMutations("test-plugin", ["UPDATE_FORM_DATA", "RESET_FORM_DATA"]),

    goHome() {
      this.$router.push("/plugin/test-plugin/home");
    },

    updateFormData(field, value) {
      this.UPDATE_FORM_DATA({ field, value });
    },

    async handleSubmitForm() {
      this.submitting = true;
      try {
        const result = await this.submitForm();

        // 添加到提交历史
        this.submitHistory.unshift({
          timestamp: new Date().toLocaleString(),
          name: this.formData.name,
          email: this.formData.email,
          message: this.formData.message,
          status: result.success ? "success" : "error"
        });

        // 只保留最近10条记录
        if (this.submitHistory.length > 10) {
          this.submitHistory = this.submitHistory.slice(0, 10);
        }

        this.$message.success(result.message);
      } catch (error) {
        this.$message.error("提交失败");
      } finally {
        this.submitting = false;
      }
    },

    resetForm() {
      this.$refs.form.resetFields();
      this.RESET_FORM_DATA();
      this.$message.info("表单已重置");
    },

    previewForm() {
      this.$alert(`<pre>${JSON.stringify(this.formData, null, 2)}</pre>`, "表单数据预览", {
        dangerouslyUseHTMLString: true,
        confirmButtonText: "确定"
      });
    }
  }
};
</script>

<style scoped>
.test-form {
  padding: 20px;
}

.test-form-content {
  max-width: 800px;
  margin: 0 auto;
}

.form-data-preview {
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-family: "Courier New", monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.validation-status {
  text-align: center;
}
</style>
