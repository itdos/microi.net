<template>
  <div class="container">
    <div class="welcome">
      <!-- <div class="avatar">
        <img src="../../assets/logo.png" alt="" />
      </div> -->
      <h1>欢迎登录{{ $baseTitle }}系统</h1>
    </div>
    <ul class="total-list">
      <li v-for="(item, index) in totalList" :key="index" @click="handleRoute(index, 'totalList', item.dateType)">
        <span class="icon"><i :class="`icon-${item.icon} iconfonts`" /></span>
        <div class="info">
          <h3>{{ item.value }}</h3>
          <p>{{ item.label }}</p>
        </div>
      </li>
    </ul>
    <ul class="moudle-list">
      <li :style="{ background: item.background }" v-for="(item, index) in moudleList" :key="index">
        <h4>{{ item.name }}</h4>
        <div class="info-items">
          <dl>
            <dt>当前</dt>
            <dd @click="handleRoute(index, 'moudleList')">{{ item.all }}</dd>
          </dl>
          <dl>
            <dt>本月新增</dt>
            <dd @click="handleRoute(index, 'moudleList', 'month')">
              {{ item.toMonth }}
            </dd>
          </dl>
          <dl>
            <dt>本日新增</dt>
            <dd @click="handleRoute(index, 'moudleList', 'day')">
              {{ item.toDay }}
            </dd>
          </dl>
        </div>
        <i :class="`icon-${item.icon} iconfonts`" />
      </li>
    </ul>
  </div>
</template>

<script>
import dayjs from "dayjs";
export default {
  data() {
    return {
      totalList: [
        {
          label: "全部待收款",
          type: "allNot",
          icon: "receivePayment",
          routeName: "orderList"
        },
        {
          label: "本年待收款",
          type: "toYearNot",
          icon: "receivePayment",
          routeName: "orderList",
          dateType: "year"
        },
        {
          label: "本月待收款",
          type: "toMonthNot",
          icon: "month",
          routeName: "orderList",
          dateType: "month"
        },
        {
          label: "今日待收款",
          type: "toDayAllNot",
          icon: "today",
          routeName: "orderList",
          dateType: "day"
        }
      ],
      moudleList: [
        {
          name: "客户",
          background: "#1bc98e",
          type: "customerInfo",
          icon: "customer",
          routeName: "customerManage"
        },
        {
          name: "商品",
          background: "#e64758",
          type: "commodityInfo",
          icon: "commodity",
          routeName: "commodityInfo"
        },
        {
          name: "意向单",
          background: "#388df2",
          type: "orderIntention",
          icon: "letterIntent",
          routeName: "orderIntention"
        },
        {
          name: "订单",
          background: "#7538c7",
          type: "orderInfo",
          icon: "order",
          routeName: "orderList"
        },
        {
          name: "售后",
          background: "#f60",
          type: "orderService",
          icon: "orderService",
          routeName: "orderService"
        },
        {
          name: "线索",
          background: "#00c4ff",
          type: "customerClue",
          icon: "clue",
          routeName: "clueManage"
        }
      ]
    };
  },

  computed: {
    getModuleType() {
      return (type) => {
        const itemType = type.replace(/( |^)[a-z]/g, (L) => L.toUpperCase());
        let result = `sys${itemType}SysHomeHomeItem`;
        return result;
      };
    },

    getTotalType() {
      return (type) => {
        let result = `${type}AlreadyAmount`;
        return result;
      };
    }
  },

  methods: {
    // 获取信息
    async handleHome() {
      const res = await this.$api.sysHomeShopHome();
      for (let key in res.data) {
        let index = this.moudleList.findIndex((item) => this.getModuleType(item.type) == key);
        let index2 = this.totalList.findIndex((item) => this.getTotalType(item.type) == key);

        this.moudleList[index] = {
          ...this.moudleList[index],
          ...res.data[key]
        };

        this.totalList[index2] = {
          ...this.totalList[index2],
          value: res.data[key]
        };
        this.$forceUpdate();
      }
    },

    handleDate(method, type) {
      return dayjs()[`${method}Of`](type).format("YYYY-MM-DD HH:mm:ss");
    },

    // 跳转路由
    handleRoute(index, list, type) {
      let startExpectTime = null;
      let endExpectTime = null;
      if (type) {
        startExpectTime = this.handleDate("start", type);
        endExpectTime = this.handleDate("end", type);
      }
      this.$router.push({
        name: this[list][index].routeName,
        params: {
          endExpectTime,
          startExpectTime
        }
      });
    }
  },
  mounted() {
    this.handleHome();
  }
};
</script>
<style lang="scss" scoped>
$base-color-white: #fff;
$base-color-default: #1077fa;
.welcome {
  display: flex;
  align-items: center;
  margin: 10px 0 0;
  .avatar {
    background: #cb371d;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    margin-right: 20px;
    padding: 10px;
    text-align: center;
    img {
      height: 100%;
    }
  }
}

.total-list {
  background: rgba($base-color-default, 0.1);
  border: 1px solid $base-color-default;
  color: $base-color-default;
  border-radius: 6px;
  display: flex;
  // justify-content: center;
  padding: 20px 0;
  li {
    display: flex;
    padding: 0 50px;
    position: relative;
    cursor: pointer;
    &:after {
      content: "";
      position: absolute;
      right: 0;
      top: 50%;
      height: 40px;
      transform: translateY(-50%);
      border-right: 1px solid $base-color-default;
    }
    &:last-child::after {
      display: none;
    }
    .icon {
      background: rgba($base-color-default, 0.2);
      border-radius: 6px;
      width: 60px;
      height: 60px;
      display: flex;
      justify-content: center;
      align-items: center;
      i {
        font-size: 30px;
      }
    }
    .info {
      margin-left: 20px;
      h3 {
        font-size: 30px;
        margin: 0 0 5px;
      }
      p {
        margin: 0;
        font-size: 16px;
      }
    }
  }
}

.moudle-list {
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  width: calc(100% + 20px);
  margin-left: -10px;
  li {
    max-width: calc(33.33% - 20px);
    width: calc(33.33% - 20px);
    margin: 10px;
    padding: 30px 20px;
    background: #06c;
    color: #fff;
    border-radius: 4px;
    position: relative;

    .iconfonts {
      opacity: 0.2;
      position: absolute;
      top: 40px;
      left: 40px;
      color: #fff;
      font-size: 100px;
    }
    h4 {
      margin: 0 0 40px;
    }
    .info-items {
      display: flex;
      position: relative;
      z-index: 2;
      dl {
        flex: 1;
        text-align: center;
        margin: 0;
        border-right: 1px solid rgba($base-color-white, 0.3);
        &:last-child {
          border-right: none;
        }
        dt {
          margin-bottom: 10px;
          font-size: 12px;
        }
        dd {
          margin: 0;
          font-size: 25px;
          font-weight: bold;
          cursor: pointer;
        }
      }
    }
  }
}
</style>
