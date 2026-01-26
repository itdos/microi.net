<template>
    <el-popover v-model="ShowThemes" placement="bottom" width="300" trigger="click">
        <div class="site-settings">
            <div class="site-settings-content">
                <div class="block block-transparent nm">
                    <div class="header">
                        <h2>推荐主题色</h2>
                    </div>
                    <div class="content controls">
                        <div class="form-row">
                            <div class="col-md-12">
                                <a :class="'ss_theme theme-blue ' + (ThemeClass == 'theme-blue' ? 'active' : '')" data-value="theme-blue" @click="themeClassChange('theme-blue', '#409eff')" />

                                <a :class="'ss_theme theme-orange ' + (ThemeClass == 'theme-orange' ? 'active' : '')" data-value="theme-orange" @click="themeClassChange('theme-orange', '#DAA96E')" />

                                <a :class="'ss_theme theme-black ' + (ThemeClass == 'theme-black' ? 'active' : '')" data-value="theme-black" @click="themeClassChange('theme-black', '#303133')" />

                                <a :class="'ss_theme theme-green ' + (ThemeClass == 'theme-green' ? 'active' : '')" data-value="theme-green" @click="themeClassChange('theme-green', '#27AE60')" />
                                <a :class="'ss_theme theme-cyan ' + (ThemeClass == 'theme-cyan' ? 'active' : '')" data-value="theme-cyan" @click="themeClassChange('theme-cyan', '#0C819F')" />

                                <a :class="'ss_theme theme-red ' + (ThemeClass == 'theme-red' ? 'active' : '')" data-value="theme-red" @click="themeClassChange('theme-red', '#E74C3C')" />

                                <a :class="'ss_theme theme-yellow ' + (ThemeClass == 'theme-yellow' ? 'active' : '')" data-value="theme-yellow" @click="themeClassChange('theme-yellow', '#F39C12')" />

                                <a :class="'ss_theme theme-pink ' + (ThemeClass == 'theme-pink' ? 'active' : '')" data-value="theme-pink" @click="themeClassChange('theme-pink', '#FF5C93')" />

                                <a :class="'ss_theme theme-purple ' + (ThemeClass == 'theme-purple' ? 'active' : '')" data-value="theme-purple" @click="themeClassChange('theme-purple', '#9B59B6')" />
                            </div>
                        </div>
                    </div>

                    <div class="header">
                        <!-- <h2>{{ $t("Msg.Themes") }}</h2> -->
                        <h2>更多主题颜色</h2>
                    </div>
                    <div class="content controls">
                        <el-color-picker size="default" v-model="themeColor" @change="changeTheme"></el-color-picker>

                        <!-- <div class="form-row">
              <div class="col-md-12">
                <a
                  :class="
                    'ss_theme theme-orange ' +
                    (ThemeClass == 'theme-orange' ? 'active' : '')
                  "
                  data-value="theme-orange"
                  @click="themeClassChange('theme-orange', 'bg-img-white')"
                />
                <a
                  :class="
                    'ss_theme theme-default ' +
                    (ThemeClass == 'theme-default' ? 'active' : '')
                  "
                  data-value="default"
                  @click="themeClassChange('theme-default', 'bg-img-white')"
                />
                <a
                  :class="
                    'ss_theme theme-blue ' +
                    (ThemeClass == 'theme-blue' ? 'active' : '')
                  "
                  data-value="default"
                  @click="themeClassChange('theme-blue', 'bg-img-num1')"
                />
                <a
                  :class="
                    'ss_theme theme-black ' +
                    (ThemeClass == 'theme-black' ? 'active' : '')
                  "
                  data-value="theme-black"
                  @click="themeClassChange('theme-black', 'wall-num6')"
                />
                <a
                  :class="
                    'ss_theme theme-white ' +
                    (ThemeClass == 'theme-white' ? 'active' : '')
                  "
                  data-value="theme-white"
                  @click="themeClassChange('theme-white', 'wall-num1')"
                />
                <a
                  :class="
                    'ss_theme theme-dark ' +
                    (ThemeClass == 'theme-dark' ? 'active' : '')
                  "
                  data-value="theme-dark"
                  @click="themeClassChange('theme-dark', 'bg-img-num9')"
                />
                <a
                  :class="
                    'ss_theme theme-green ' +
                    (ThemeClass == 'theme-green' ? 'active' : '')
                  "
                  data-value="theme-green"
                  @click="themeClassChange('theme-green', 'bg-img-num17')"
                />
                <a
                  @click="themeClassChange('theme-iplan-light', 'bg-img-white')"
                  :class="
                    'ss_theme theme-iplan-light ' +
                    (ThemeClass == 'theme-iplan-light' ? 'active' : '')
                  "
                  data-value="theme-iplan-light"
                ></a>
              </div>
            </div> -->
                    </div>
                    <!-- <div class="header">
            <h2>{{ $t("Msg.BackgroundColor") }}</h2>
          </div>
          <div class="content controls">
            <div class="form-row">
              <div id="ss_backgrounds" class="col-md-12">
                <a
                  v-for="(className, i) in BackgroundsArr"
                  :key="i"
                  :class="
                    'ss_background ' +
                    className +
                    (ThemeBodyClass == className ? ' active' : '')
                  "
                  :data-value="className"
                  @click="themeBodyClassChange(className)"
                />
              </div>
            </div>
          </div>
          <div class="header">
            <h2>{{ $t("Msg.Wallpaper") }}</h2>
          </div>
          <div class="content controls">
            <div class="form-row">
              <div class="col-md-12">
                <a
                  v-for="(className, i) in WallpapersArr"
                  :key="i"
                  :class="
                    'ss_background ' +
                    className +
                    (ThemeBodyClass == className ? ' active' : '')
                  "
                  :data-value="className"
                  @click="themeBodyClassChange(className)"
                />
              </div>
            </div>
          </div> -->
                </div>
            </div>
        </div>

        <template #reference>
            <div class="theme-select-trigger">
                <el-icon class="theme-icon"><Brush /></el-icon>
            </div>
        </template>
    </el-popover>
</template>

<script>
import { Brush } from "@element-plus/icons-vue";
import { computed } from "vue";
import { useDiyStore, useAppStore, useSettingsStore } from "@/pinia";
export default {
    name: "App",
    components: {
        Brush
    },
    setup() {
        const diyStore = useDiyStore();
        const appStore = useAppStore();
        const settingsStore = useSettingsStore();
        const sidebar = computed(() => appStore.sidebar);
        const avatar = computed(() => appStore.avatar);
        const device = computed(() => appStore.device);
        const ThemeClass = computed(() => diyStore.ThemeClass);
        const themeColor = computed(() => diyStore.themeColor);
        const ThemeBodyClass = computed(() => diyStore.ThemeBodyClass);
        const Lang = computed(() => diyStore.Lang);
        const WebTitle = computed(() => diyStore.WebTitle);
        const SysConfig = computed(() => diyStore.SysConfig);
        return {
            diyStore,
            appStore,
            settingsStore,
            sidebar,
            avatar,
            device,
            ThemeClass,
            themeColor,
            ThemeBodyClass,
            Lang,
            WebTitle,
            SysConfig
        };
    },
    data() {
        return {
            BackgroundsArr: [],
            WallpapersArr: [],
            ShowThemes: false
        };
    },

    mounted() {
        var self = this;
        for (let index = 1; index <= 20; index++) {
            self.BackgroundsArr.push("bg-img-num" + index);
        }
        for (let index = 1; index <= 16; index++) {
            self.WallpapersArr.push("wall-num" + index);
        }

        if (!self.themeColor) {
            if (!self.SysConfig.ThemeColor) self.themeClassChange("", "#409eff");
            else self.themeClassChange("", self.SysConfig.ThemeColor);
        }
    },
    methods: {
        themeChange(val) {
            // 使用 settingsStore 如果需要
            // this.settingsStore.changeSetting({ key: "theme", value: val });
        },
        themeBodyClassChange(val) {
            this.diyStore.setState("ThemeBodyClass", val);
        },

        changeTheme(color) {
            if (!color && this.SysConfig.ThemeColor) color = this.SysConfig.ThemeColor;

            console.log("修改主题颜色：", color);
            // 动态修改 CSS 变量
            document.documentElement.style.setProperty("--color-primary", color);
            this.diyStore.setThemeColor(color);
        },
        themeClassChange(themeClass, bodyClass) {
            // 动态修改 CSS 变量
            document.documentElement.style.setProperty("--color-primary", bodyClass);

            this.diyStore.setThemeColor(bodyClass);
            // if (themeClass == "theme-iplan-light") {
            //   this.$store.dispatch("settings/changeSetting", {
            //     key: "fixedHeader",
            //     value: false,
            //   });
            // } else {
            //   this.$store.dispatch("settings/changeSetting", {
            //     key: "fixedHeader",
            //     value: true,
            //   });
            // }
            // this.$store.commit("DiyStore/SetState", {
            //   key: "ThemeClass",
            //   value: themeClass,
            // });
            // this.$store.commit("DiyStore/SetState", {
            //   key: "ThemeBodyClass",
            //   value: bodyClass,
            // });
        }
    }
};
</script>

<style lang="scss" scoped>
/* site settings */
.site-settings {
    //   position: fixed;
    //   right: 0px;
    //   top: 60px;
    z-index: 10;
}

.site-settings .site-settings-content .form-row {
    line-height: 30px;
}

.site-settings .site-settings-content .block > div {
    padding-bottom: 0px;
}

.site-settings .site-settings-content .block > div:last-child {
    padding-bottom: 10px;
}

.site-settings .site-settings-content .block .header {
    height: 22px;
    line-height: 22px;
    clear: both;
    margin-bottom: 10px;
}

.site-settings .site-settings-content .block .header h2 {
    line-height: 22px;
    font-size: 14px;
    color: #000;
    margin-top: 0px;
    font-weight: bold;
}
.site-settings .ss_background,
.site-settings .ss_theme {
    width: 30px;
    height: 30px;
    //   display: inline-block;
    cursor: pointer;
    border-radius: 50%;
    border: 2px solid #fff;
    margin-right: 10px;
    margin-right: 10px;
    float: left;
    margin-bottom: 10px;
    display: block;
}

.site-settings .ss_background.active,
.site-settings .ss_theme.active {
    border: 1px solid #fff;
}

.microi.Classic.theme-orange .site-settings .ss_theme.active {
    border: 5px solid #ff6c04;
}
/* site settings end */

.navbar {
    height: 30px;
    overflow: hidden;
    position: relative;
    //   background: #fff;  //by itdos.com注释
    //   box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);

    .right-menu {
        float: right;
        height: 100%;
        line-height: 30px;

        &:focus {
            outline: none;
        }

        .right-menu-item {
            display: inline-block;
            padding: 0 8px;
            height: 100%;
            font-size: 18px;
            color: #5a5e66;
            vertical-align: text-bottom;

            &.hover-effect {
                cursor: pointer;
                transition: background 0.3s;

                &:hover {
                    background: rgba(0, 0, 0, 0.025);
                }
            }
        }
    }
}

.theme-blue {
    background-color: #409eff;
}

.theme-orange {
    background-color: #daa96e;
}

.theme-purple {
    background-color: #9b59b6;
}

.theme-red {
    background-color: #e74c3c;
}

.theme-yellow {
    background-color: #f39c12;
}

.theme-pink {
    background-color: #ff5c93;
}

.theme-cyan {
    background-color: #0c819f;
}

.theme-black {
    background-color: #303133;
}
.theme-green {
    background-color: #27ae60;
}

.theme-select-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    .theme-icon {
        font-size: 20px;
    }
    width: 40px;
}
</style>
