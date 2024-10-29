<template>
  <div>
      当前登陆：{{GetCurrentUser.Name}} - test
  </div>
</template>
<script>
import { mapState, mapMutations, mapGetters } from "vuex";
export default {
    name: 'anderson_test',
    data() {
        return {

        }
    },
    computed: {
        GetCurrentUser: function(){ return this.$store.getters['DiyStore/GetCurrentUser'];},
        ...mapState({
            OsClient: (state) => state.DiyStore.OsClient,
            Lang: (state) => state.DiyStore.Lang,
        }),
    },
    mounted() {
        var self = this
        
    },
    methods: {

    }
}
</script>

<style lang="scss" scoped>

</style>
