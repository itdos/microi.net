<template>
  <div>
    <WorkFlowDesigner></WorkFlowDesigner>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
import "./css/index.css";
import WorkFlowDesigner from "./component/designer";
export default {
  name: "diy-flow-design",
  components: {
    WorkFlowDesigner
  },
  computed: {
    ...mapState({
      OsClient: (state) => state.DiyStore.OsClient
    })
  },
  watch: {},
  data() {
    return {};
  },
  mounted() {
    var self = this;
  },
  methods: {
    Test() {}
  }
};
</script>

<style lang="scss" scoped></style>
