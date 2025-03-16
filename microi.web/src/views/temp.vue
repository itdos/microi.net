<template>
  <div>temp</div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
export default {
  name: "temp",
  components: {},
  computed: {
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapState({
      OsClient: (state) => state.DiyStore.OsClient,
    }),
  },
  props: {
    test1: {
      type: String,
      default: "",
    },
    test2: {
      type: Object,
      default() {
        return {};
      },
    },
  },
  watch: {},
  data() {
    return {};
  },
  mounted() {
    var self = this;
  },
  methods: {},
};
</script>

<style lang="scss" scoped></style>
