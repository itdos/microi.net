<template>
  <div class="xjy-kehu-childtable-class">
    <div
      class="item"
      style="
        color: rgb(255, 163, 96);
        background: rgba(255, 163, 96, 0.2);
        border-top: 2px solid rgb(255, 163, 96);
      "
      @click="scrollIntoView('.field_LianxiRLine')"
    >
      <i class="el-icon-s-custom"></i>
      <div class="info">
        <p>
          <strong>{{ ReportData.LianxirenCount }}</strong>
        </p>
        <p>联系人</p>
      </div>
    </div>
    <div
      class="item"
      style="
        color: rgb(65, 181, 132);
        background: rgba(65, 181, 132, 0.2);
        border-top: 2px solid rgb(65, 181, 132);
      "
      @click="scrollIntoView('.field_GenjinJLLine')"
    >
      <i class="el-icon-refresh"></i>
      <div class="info">
        <p>
          <strong>{{ ReportData.GenjinCount }}</strong>
        </p>
        <p>跟进</p>
      </div>
    </div>
    <div
      class="item"
      style="
        color: rgb(113, 166, 255);
        background: rgba(113, 166, 255, 0.2);
        border-top: 2px solid rgb(113, 166, 255);
      "
      @click="scrollIntoView('.field_ShangjiLine')"
    >
      <i class="el-icon-data-line"></i>
      <div class="info">
        <p>
          <strong>{{ ReportData.ShangjiCount }}</strong>
        </p>
        <p>商机</p>
      </div>
    </div>
    <!-- <div
                class="item"
                style="
                    color: rgb(255, 113, 113);
                    background: rgba(255, 113, 113, 0.2);
                    border-top: 2px solid rgb(255, 113, 113);
                "
            >
                <i  class="el-icon-message-solid"></i>
                <div  class="info">
                    <p >
                        <strong >0</strong>
                    </p>
                    <p >提醒</p>
                </div>
            </div> -->
    <div
      class="item"
      style="
        color: rgb(255, 113, 113);
        background: rgba(255, 113, 113, 0.2);
        border-top: 2px solid rgb(255, 113, 113);
      "
      @click="scrollIntoView('.field_DingdanLB')"
    >
      <i class="el-icon-message-solid"></i>
      <div class="info">
        <p>
          <strong>{{ ReportData.DingdanCount }}</strong>
        </p>
        <p>订单</p>
      </div>
    </div>
    <div
      class="item"
      style="
        color: rgb(96, 130, 255);
        background: rgba(96, 130, 255, 0.2);
        border-top: 2px solid rgb(96, 130, 255);
      "
      @click="scrollIntoView('.field_Shebei')"
    >
      <i class="el-icon-s-help"></i>
      <div class="info">
        <p>
          <strong>{{ ReportData.ShebeiCount }}</strong>
        </p>
        <p>设备</p>
      </div>
    </div>
    <!-- <div
                class="item"
                style="
                    color: rgb(255, 163, 96);
                    background: rgba(255, 163, 96, 0.2);
                    border-top: 2px solid rgb(255, 163, 96);
                "
            >
                <i  class="icon-cooperation iconfonts"></i>
                <div  class="info">
                    <p >
                        <strong >0</strong>
                    </p>
                    <p >案例</p>
                </div>
            </div> -->
  </div>
</template>

<script>
export default {
  name: "loudong",
  props: {
    /**
     * 固定接收数据的对象，由V8代码传过来
     */
    DataAppend: {
      type: Object,
      default: () => {}
    }
  },
  watch: {
    //监听数据变化，切换小区时要重新获取楼栋，其它信息置空
    DataAppend: function (newVal, oldVal) {
      var self = this;
      self.KehuClassReport();
    }
  },
  data() {
    return {
      ReportData: {
        LianxirenCount: "...",
        GenjinCount: "...",
        ShangjiCount: "...",
        ShebeiCount: "...",
        DingdanCount: "..."
      }
    };
  },
  mounted() {
    var self = this;
    self.KehuClassReport();
  },
  methods: {
    KehuClassReport() {
      var self = this;
      if (
        self.DataAppend.KehuID &&
        self.Microi &&
        self.Microi.DataSourceEngine
      ) {
        self.Microi.DataSourceEngine.Run(
          "kehu_childtable_report",
          {
            Id: self.DataAppend.KehuID
          },
          function (result) {
            if (self.Microi.CheckResult(result)) {
              self.ReportData = result.Data;
            }
          }
        );
      }
    },
    scrollIntoView(traget) {
      const tragetElem = document.querySelector(traget);
      const tragetElemPostition = tragetElem.offsetTop;
      // 判断是否支持新特性
      if (
        typeof window.getComputedStyle(document.body).scrollBehavior ==
        "undefined"
      ) {
        // 当前滚动高度
        let scrollTop =
          document.documentElement.scrollTop || document.body.scrollTop;
        // 滚动step方法
        const step = function () {
          // 距离目标滚动距离
          let distance = tragetElemPostition - scrollTop;

          // 目标需要滚动的距离，也就是只走全部距离的五分之一
          scrollTop = scrollTop + distance / 5;
          if (Math.abs(distance) < 1) {
            window.scrollTo(0, tragetElemPostition);
          } else {
            window.scrollTo(0, scrollTop);
            setTimeout(step, 20);
          }
        };
        step();
      } else {
        tragetElem.scrollIntoView({
          behavior: "smooth",
          inline: "nearest"
        });
      }
    }
  }
};
</script>

<style lang="scss">
// scoped 也可以使用scoped，然后使用 /deep/
.xjy-kehu-childtable-class {
  padding-top: 10px;
  margin-left: -100px;

  .item {
    align-items: center;
    display: flex;
    justify-content: center;
    width: 160px;
    margin: 0 20px 0px 0;
    padding: 15px 10px;
    cursor: pointer;
    float: left;

    i {
      font-size: 40px;
    }

    .info {
      margin-left: 20px;

      strong {
        font-size: 22px;
        padding-bottom: 5px;
        display: block;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }
  }
}
</style>
