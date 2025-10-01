<script>
import { mapState } from "vuex";
export default {
  name: "MenuItem",
  functional: true,
  props: {
    icon: {
      type: String,
      default: ""
    },
    title: {
      type: String,
      default: ""
    },
    wordcolor: {
      type: Object,
      default: function () {
        return {
          marginLeft: "5px"
        };
      }
    }
  },
  computed: {
    ...mapState({
      SysConfig: (state) => state.DiyStore.SysConfig
    })
  },
  methods: {
    GetMenuWordColor() {
      var self = this;
      if (self.SysConfig.MenuBg == "Custom" && !self.DiyCommon.IsNull(self.SysConfig.MenuWordColor)) {
        return { color: self.SysConfig.MenuWordColor };
      }
      return { color: "#909399" }; //#909399 图标
    }
  },
  render(h, context) {
    var self = this;
    const { icon, title, wordcolor } = context.props;
    const vnodes = [];
    if (icon) {
      if (icon.includes("el-icon")) {
        vnodes.push(<i style={wordcolor} class={[icon, "sub-el-icon svg-icon"]} />); // by itdos
      } else {
        // vnodes.push(<svg-icon icon-class={icon}/>)
        vnodes.push(<i style={wordcolor} class={icon + " svg-icon"}></i>); // by itdos
      }
    } else {
      vnodes.push(<i style={wordcolor} class={"fas fa-tasks" + " svg-icon"}></i>); // by itdos
    }

    if (title) {
      vnodes.push(
        <span style={wordcolor} slot="title">
          {title}
        </span>
      );
    }
    return vnodes;
  }
};
</script>

<style scoped>
.sub-el-icon {
  color: currentColor;
  width: 1em;
  height: 1em;
}
</style>