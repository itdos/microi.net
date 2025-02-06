<template>
  <el-popover
    v-model="ShowThemes"
    placement="bottom"
    width="340"
    trigger="click"
  >
    <div class="site-settings">
      <div class="site-settings-content">
        <div class="block block-transparent nm">
          <div class="header">
            <h2>{{ $t('Msg.Themes') }}</h2>
          </div>
          <div class="content controls">
            <div class="form-row">
              <div class="col-md-12">
                <a :class="'ss_theme theme-orange ' + (ThemeClass == 'theme-orange' ? 'active' : '')" data-value="theme-orange" @click="themeClassChange('theme-orange', 'bg-img-white')" />
                <a :class="'ss_theme theme-default ' + (ThemeClass == 'theme-default' ? 'active' : '')" data-value="default" @click="themeClassChange('theme-default', 'bg-img-white')" />
                <a :class="'ss_theme theme-blue ' + (ThemeClass == 'theme-blue' ? 'active' : '')" data-value="default" @click="themeClassChange('theme-blue', 'bg-img-num1')" />
                <a :class="'ss_theme theme-black ' + (ThemeClass == 'theme-black' ? 'active' : '')" data-value="theme-black" @click="themeClassChange('theme-black', 'wall-num6')" />
                <a :class="'ss_theme theme-white ' + (ThemeClass == 'theme-white' ? 'active' : '')" data-value="theme-white" @click="themeClassChange('theme-white', 'wall-num1')" />
                <a :class="'ss_theme theme-dark ' + (ThemeClass == 'theme-dark' ? 'active' : '')" data-value="theme-dark" @click="themeClassChange('theme-dark', 'bg-img-num9')" />
                <a :class="'ss_theme theme-green ' + (ThemeClass == 'theme-green' ? 'active' : '')" data-value="theme-green" @click="themeClassChange('theme-green', 'bg-img-num17')" />
                <a @click="themeClassChange('theme-iplan-light', 'bg-img-white')" :class="'ss_theme theme-iplan-light ' + (ThemeClass == 'theme-iplan-light' ? 'active' : '')" data-value="theme-iplan-light"></a>
              </div>
            </div>
          </div>
          <div class="header">
            <h2>{{ $t('Msg.BackgroundColor') }}</h2>
          </div>
          <div class="content controls">
            <div class="form-row">
              <div
                id="ss_backgrounds"
                class="col-md-12"
              >
                <a
                  v-for="(className, i) in BackgroundsArr"
                  :key="i"
                  :class="'ss_background ' + className
                    + (ThemeBodyClass == className ? ' active' : '')"
                  :data-value="className"
                  @click="themeBodyClassChange(className)"
                />
              </div>
            </div>
          </div>
          <div class="header">
            <h2>{{ $t('Msg.Wallpaper') }}</h2>
          </div>
          <div class="content controls">
            <div class="form-row">
              <div class="col-md-12">
                <a v-for="(className, i) in WallpapersArr" :key="i" :class="'ss_background ' + className + (ThemeBodyClass == className ? ' active' : '')" :data-value="className" @click="themeBodyClassChange(className)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      slot="reference"
      class="right-menu-item hand"
    >
      <svg-icon
        icon-class="theme"
        style="font-size:18px;"
      />
    </div>
  </el-popover>
</template>

<script>
//import { DiyStore } from 'itdos.diy'
import {
  mapGetters, mapState
} from 'vuex'
export default {
  name: 'App',
  data() {
    return {
      BackgroundsArr: [],
      WallpapersArr: [],
      ShowThemes: false
    }
  },
  computed: {
    ...mapGetters(['sidebar', 'avatar', 'device']),
    ...mapState({
      ThemeClass: state => state.DiyStore.ThemeClass,
      ThemeBodyClass: state => state.DiyStore.ThemeBodyClass,
      Lang: state => state.DiyStore.Lang,
      WebTitle: state => state.DiyStore.WebTitle
    })
  },
  mounted() {
    var self = this
    for (let index = 1; index <= 20; index++) {
      self.BackgroundsArr.push('bg-img-num' + index)
    }
    for (let index = 1; index <= 16; index++) {
      self.WallpapersArr.push('wall-num' + index)
    }
  },
  methods: {
    themeChange(val) {
      this.$store.dispatch('settings/changeSetting', {
        key: 'theme',
        value: val
      })
    },
    themeBodyClassChange(val) {
      this.$store.commit('DiyStore/SetState', {
        key: 'ThemeBodyClass',
        value: val
      })
    },
    themeClassChange(themeClass, bodyClass) {
      if (themeClass == 'theme-iplan-light') {
        this.$store.dispatch('settings/changeSetting', {
          key: 'fixedHeader',
          value: false
        })
      } else {
        this.$store.dispatch('settings/changeSetting', {
          key: 'fixedHeader',
          value: true
        })
      }
      this.$store.commit('DiyStore/SetState', {
        key: 'ThemeClass',
        value: themeClass
      })
      this.$store.commit('DiyStore/SetState', {
        key: 'ThemeBodyClass',
        value: bodyClass
      })
    }
  }
}
</script>

<style lang="scss" scoped>

/* site settings */
.site-settings {
    //   position: fixed;
    //   right: 0px;
    //   top: 60px;
    z-index: 10;
}

.site-settings .site-settings-content {
    //   position: relative;
    //   width: 285px;
    //   display: none;
}

.site-settings .site-settings-content .form-row {
    line-height: 30px;
}

.site-settings .site-settings-content .block>div {
    padding-bottom: 0px;
}

.site-settings .site-settings-content .block>div:last-child {
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
    color: #fff;
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
    border: 2px solid #777;
    margin-right: 10px;
    margin-right: 10px;
    float: left;
    margin-bottom: 10px;
    display: block;
}

.site-settings .ss_background.active,
.site-settings .ss_theme.active {
    border: 2px solid #fff;
}

.microi.Classic.theme-orange .site-settings .ss_theme.active {
    border: 2px solid #ff6c04;
}
/* site settings end */

.navbar {
    height: 50px;
    overflow: hidden;
    position: relative;
    //   background: #fff;  //by itdos.com注释
    //   box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);

    .right-menu {
        float: right;
        height: 100%;
        line-height: 50px;

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
</style>
