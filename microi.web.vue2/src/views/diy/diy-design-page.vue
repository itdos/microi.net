<template>
    <div>
        <DiyDesign @CallbackSetDiyTableModel="CallbackSetDiyTableModel"></DiyDesign>
    </div>
</template>

<script>
import DiyDesign from "@/views/diy/diy-design";
// import {DiyDesign} from 'itdos.diy'
export default {
    name: "DiyFieldTemp",
    components: {
        DiyDesign
    },
    data() {
        return {};
    },
    mounted() {
        var self = this;
    },
    methods: {
        CallbackSetDiyTableModel(model) {
            var self = this;
            // self.DiyCommon.ChangePageTabName('diy_field', self.$t('Msg.Design') + ' ' + model.Name.replace('Diy_', ''));
            // var item = self.$store.state.tagsView.visitedViews.filter(item => item.name == 'diy_field')
            var item = self.$store.state.tagsView.visitedViews.filter((item) => item.path.indexOf(model.Id) > -1);
            if (item.length > 0) {
                item[0].title =
                    self.$t("Msg.Design") +
                    " [" +
                    (!self.DiyCommon.IsNull(model.Description) ? model.Description : model.Name) + //.replace('Diy_', '')
                    "]";
            }
        }
    }
};
</script>

<style lang="scss" scoped></style>
