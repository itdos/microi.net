<template>
  <div class="demo-plugin">
    <el-button type="primary" @click="showMessage">测试按钮</el-button>
  </div>
</template>

<script>
export default {
  name: "DemoPlugin",
  data() {
    return {
      inputValue: ""
    };
  },
  methods: {
    showMessage() {
      this.$message.success("演示插件功能正常！当前输入值：" + (this.inputValue || "空"));
    }
  }
};
</script>

<style scoped></style>
