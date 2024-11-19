<template>
  <div>
    <el-button @click="show" type="primary">choose fontawesome</el-button>
    <el-button @click="show1" type="primary">choose fontawesome1</el-button>

    <Fontawesome ref="fontawesome" :model.sync="className" />
    <Fontawesome ref="fontawesome1" :model.sync="className1" />
  </div>
</template>

<script>
import Fontawesome from "./components/Fontawesome";
export default {
  data() {
    return {
      className: "",
      className1: ""
    };
  },
  components: {
    Fontawesome,Test
  },
  methods: {
    show() {
      this.$refs.fontawesome.show();
    },
    show1() {
      this.$refs.fontawesome1.show();
    }
  }
};
</script>

<style>
</style>