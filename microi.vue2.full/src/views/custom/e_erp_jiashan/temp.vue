<template>
<div>
    这里是主框架定制页面，当前OsClient值为：{{ OsClient }}
</div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
export default {
    name: 'temp',
	components: {
    },
    computed: {
        GetCurrentUser: function(){ return this.$store.getters['DiyStore/GetCurrentUser'];},
		...mapState({
            OsClient: (state) => state.DiyStore.OsClient,
        }),
    },
    props:{
        
    },
	watch: {
	},
    data() {
        return {
        }
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
