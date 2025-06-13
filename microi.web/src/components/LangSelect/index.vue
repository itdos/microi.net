<template>
  <el-dropdown trigger="click" class="international" @command="handleSetLanguage">
    <div>
      <svg-icon class-name="international-icon" icon-class="language" />
      <span style="font-size: 12px; margin-left: 6px">{{ currentLang }}</span>
    </div>
    <el-dropdown-menu style="max-height: 500px; overflow: auto" slot="dropdown">
      <!-- <el-dropdown-item :disabled="language === 'zh-CN'" command="zh-CN"> 中文 </el-dropdown-item>
      <el-dropdown-item :disabled="language === 'en'" command="en"> English </el-dropdown-item> -->
      <!-- <el-dropdown-item :disabled="language==='es'" command="es">
        Español
      </el-dropdown-item>
      <el-dropdown-item :disabled="language==='ja'" command="ja">
        日本語
      </el-dropdown-item> -->

      <el-dropdown-item v-for="item in langOptions" :key="item.value" class="ignore" command="chinese_simplified">{{ item.label }}</el-dropdown-item>
    </el-dropdown-menu>
  </el-dropdown>
</template>

<script>
import { getLangs } from "@/utils/langs";
export default {
  computed: {
    language() {
      return this.$store.getters.language;
    }
  },
  data() {
    return {
      currentLang: "",
      langOptions: []
    };
  },
  mounted() {
    let self = this;
    if (typeof window.translate !== "undefined") {
      self.langOptions = getLangs();
      setTimeout(function () {
        let lang = translate.language.getCurrent();
        self.currentLang = self.langOptions.find((item) => item.value === lang).label;
      }, 3000);
    }
  },
  methods: {
    handleSetLanguage(lang) {
      this.$message({
        message: "请前往系统配置默认语言",
        type: "warning"
      });
      // translate.changeLanguage(lang);
      console.log("当前语言", lang);
      // this.DiyCommon.ChangeLang(lang);
      // this.$i18n.locale = lang;
      // this.$store.dispatch("app/setLanguage", lang);
    }
  }
};
</script>
