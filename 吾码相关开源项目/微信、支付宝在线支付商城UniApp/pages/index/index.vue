<template>
  <view class="index" style="background-color: #16171D00;">

    <!-- 方格背景-->
    <view class="animation-wrapper">
    </view>
    
    <!-- 小星星 -->
    <view class="particle particle-1"></view>
    <view class="particle particle-2"></view>
    <view class="particle particle-3"></view>
    <view class="particle particle-4"></view>

    <!-- 整体移动背景 -->
    <!-- <view class="bg-contaniner">
		  
		</view> -->
    <!-- 二级页面 -->
    <view v-if="tabberPageLoadFlag[0]" :style="{display: currentTabbarIndex === 0 ? '' : 'none'}">
      <scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
        <page-a ref="pageA"></page-a>
      </scroll-view>
    </view>
    <view v-if="tabberPageLoadFlag[1]" :style="{display: currentTabbarIndex === 1 ? '' : 'none'}">
      <scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
        <page-b ref="pageB"></page-b>
      </scroll-view>
    </view>
    <view v-if="tabberPageLoadFlag[2]" :style="{display: currentTabbarIndex === 2 ? '' : 'none'}">
      <scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
        <page-c ref="pageC"></page-c>
      </scroll-view>
    </view>
    <view v-if="tabberPageLoadFlag[3]" :style="{display: currentTabbarIndex === 3 ? '' : 'none'}">
      <scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
        <page-d ref="pageD"></page-d>
      </scroll-view>
    </view>
    <!-- <view class="bg-tabbar-shadow"></view> -->
    <!-- 底部导航栏 -->
    <view class="tabbar">
      <view class="tabbar__bg" :style="[wrapStyle]"></view>
      <view class="tabbar__list">
        <block v-for="(item, index) in tabbar" :key="index">
          <view :id="`tabbar_item_${index}`" class="tabbar__item"
            :class="[{'tabbar__item--active': index === currentTabbarIndex}]" @click="changeTabbar(index)">
            <!-- 可以用字体图标的方式 -->
            <view class="tabbar__item__icon" :class="[item.icon]"></view>

            <!-- 或者放自己喜欢的设计图 -->
            <!-- <image class="tabbar__item__image" :src="item.image"></image> -->
            <view class="tabbar__item__text">{{ item.name }}</view>
          </view>
        </block>
      </view>
      <!-- <view class="tabbar__select-active-bg" :class="[showActiceBg ? 'tabbar__select-active-bg--show' : 'tabbar__select-active-bg--hide']" :style="[activeBgStyle]"></view> -->
      <view class="tabbar__select-active-bg" :animation="activeBgAnimation"></view>
    </view>
  </view>
</template>

<script>
  import PageA from './component/PageA.vue'
  import PageB from './component/PageB.vue'
  import PageC from './component/PageC.vue'
  import PageD from './component/PageD.vue'

  export default {
    components: {
      PageA,
      PageB,
      PageC,
      PageD
    },
    data() {
      return {
        wrapMaskPositionLeft: 0,
        activeBgPositionLeft: 0,
        prevTabbarIndex: 0,
        currentTabbarIndex: 0,
        tabbarRectInfo: [],
        activeBgAnimation: {},
        tabbar: [{
            name: '首页',
            icon: 'tn-icon-reload-planet-fill',
            image: '/static/tabbar/tn-tabbar0.png'
          },
          {
            name: '模型',
            icon: 'tn-icon-meteor-fill',
            image: '/static/tabbar/tn-tabbar1.png'
          },
          {
            name: '探索',
            icon: 'tn-icon-rocket-fill',
            image: '/static/tabbar/tn-tabbar2.png'
          },
          {
            name: '我的',
            icon: 'tn-icon-moon-fill',
            image: '/static/tabbar/tn-tabbar3.png'
          }
        ],

        // 自定义底栏对应页面的加载情况
        tabberPageLoadFlag: []
      }
    },
    computed: {
      wrapStyle() {
        return {
          '-webkit-mask-position': `${this.wrapMaskPositionLeft}px -1px, 100%`
        }
      },
    },
    onLoad(options) {
      const index = Number(options.index || 0)
      // 根据底部tabbar菜单列表设置对应页面的加载情况
      this.tabberPageLoadFlag = this.tabbar.map((item, tabbar_index) => {
        return index === tabbar_index
      })
      this.changeTabbar(index)
    },
    onReady() {
      this.$nextTick(() => {
        this.getTabbarItemInfo()
      })
    },
    methods: {
      // 导航页面滚动到底部
      tabbarPageScrollLower(e) {
        if (this.currentTabbarIndex === 1) {
          this.$refs.pageB.getRandomData && this.$refs.pageB.getRandomData()
        }
      },

      // 切换导航页面
      _switchTabbarPage(index) {
        const selectPageFlag = this.tabberPageLoadFlag[index]
        if (selectPageFlag === undefined) {
          return
        }
        if (selectPageFlag === false) {
          this.tabberPageLoadFlag[index] = true
        }
      },


      // 获取底部元素的位置
      getTabbarItemInfo() {
        const view = uni.createSelectorQuery().in(this)
        for (let i = 0; i < this.tabbar.length; i++) {
          view.select('#tabbar_item_' + i).boundingClientRect()
        }
        view.exec(res => {
          if (!res.length) {
            setTimeout(() => {
              this.getTabbarItemInfo()
            }, 10)
            return
          }

          // 将信息存入数组中
          res.map((item) => {
            this.tabbarRectInfo.push({
              left: item.left,
              width: item.width
            })
          })
          this.updateHollowsPosition()
          this.updateActiveBgPosition(true)
          // console.log(this.tabbarRectInfo)
        })
      },
      // 更新凹陷位置
      updateHollowsPosition() {
        const {
          width,
          left
        } = this.tabbarRectInfo[this.currentTabbarIndex]
        // 计算掩模图片的宽高比
        // const imageRatio = 200 / 92
        // 计算定高的宽比
        const imageFixedHeightWidthRatioValue = 300 * (uni.upx2px(64) / 92)
        this.wrapMaskPositionLeft = left - ((imageFixedHeightWidthRatioValue - width) / 2)
      },
      // 更新激活时背景的位置
      updateActiveBgPosition(init = false) {
        const {
          width,
          left
        } = this.tabbarRectInfo[this.currentTabbarIndex]
        const oldActiveBgPositionLeft = this.activeBgPositionLeft
        this.activeBgPositionLeft = left + ((width - uni.upx2px(100)) / 2)
        if (!init) {
          const animation = uni.createAnimation({
            duration: 200,
            timingFunction: "ease-out"
          })
          animation.top(uni.upx2px(50)).left(oldActiveBgPositionLeft + ((this.activeBgPositionLeft -
            oldActiveBgPositionLeft) / 2)).scale(0.5).step()
          animation.left(this.activeBgPositionLeft).top(uni.upx2px(-54)).scale(1).step()
          this.activeBgAnimation = animation.export()
        } else {
          const animation = uni.createAnimation({
            duration: 100,
            timingFunction: "ease-out"
          })
          animation.left(this.activeBgPositionLeft).top(uni.upx2px(-54)).step()
          this.activeBgAnimation = animation.export()
        }

      },
      // 修改当前选中的tabbar
      changeTabbar(index) {
        if (this.currentTabbarIndex === index) return
        this._switchTabbarPage(index)
        this.prevTabbarIndex = this.currentTabbarIndex
        this.currentTabbarIndex = index
        this.$nextTick(() => {
          this.updateHollowsPosition()
          this.updateActiveBgPosition()
		  if(index == 2){
			// require('@/utils/bootstrapmb.com.js')
		  }
        })
      },


    }
  }
</script>

<style lang="scss" scoped>
  /* 小点点背景*/
  .animation-wrapper {
    position: fixed;
    bottom: 0;
    height: 100vh;
    width: 100vw;
    // background: #16171D;
    // background: linear-gradient(90deg, #171717, #16171D, #171717);
    // background-blend-mode: screen;
    // background-size: cover;
    // -webkit-filter: grayscale(100%);
    //         filter: grayscale(100%);
    z-index: 0;


  }

  .animation-wrapper:before {
    content: "";
    position: absolute;
    top: -100vh;
    left: -94.5vw;
    bottom: 0;
    right: 0;
    z-index: -1;
    height: 300vh;
    width: 300vw;
    /* mask-image: linear-gradient(to bottom, transparent, black);
    background: linear-gradient(90deg, #16171D, #16171D);	 */
    --lc1: rgba(255, 255, 255, .1);
    --lc2: rgba(255, 255, 255, .1);
    --tc: rgba(0, 50, 100, 0);
    --bc: rgb(22, 23, 29);
    --bd: rgb(23, 23, 23);
    --gap: 120rpx;
    background-color: var(--bc);
    background-image: radial-gradient(var(--tc), var(--bd)), repeating-linear-gradient(0deg, var(--tc), var(--tc) var(--gap), var(--lc1) calc(var(--gap) + 1px), var(--tc) calc(var(--gap) + 1px), var(--tc) calc(var(--gap) * 2 + 1px), var(--lc1) calc(var(--gap) * 2 + 2px), var(--tc) calc(var(--gap) * 2 + 2px), var(--tc) calc(var(--gap) * 3 + 2px), var(--lc2) calc(var(--gap) * 3 + 3px)), repeating-linear-gradient(90deg, var(--tc), var(--tc) var(--gap), var(--lc1) calc(var(--gap) + 1px), var(--tc) calc(var(--gap) + 1px), var(--tc) calc(var(--gap) * 2 + 1px), var(--lc1) calc(var(--gap) * 2 + 2px), var(--tc) calc(var(--gap) * 2 + 2px), var(--tc) calc(var(--gap) * 3 + 2px), var(--lc2) calc(var(--gap) * 3 + 3px));
    transform: rotateX(15deg) rotateY(0) rotateZ(45deg);

  }

  .particle,
  .particle:after {
    background: #16171D;
  }

  .particle:after {
    position: absolute;
    bottom: 0;
    content: "";
  }

  .particle-1 {
    -webkit-animation: animParticle 60s linear infinite;
    animation: animParticle 60s linear infinite;
    box-shadow: 1307px 1889px #fff, 771px 642px #fff, 1811px 1116px #fff, 796px 418px #fff, 1607px 997px #fff, 1431px 192px #fff, 1081px 382px #fff, 116px 388px #fff, 188px 1588px #fff, 33px 1314px #fff, 1828px 1004px #fff, 1830px 635px #fff, 740px 376px #fff, 1251px 679px #fff, 1639px 1559px #fff, 1650px 92px #fff, 1655px 1787px #fff, 248px 378px #fff, 1258px 410px #fff, 1737px 1531px #fff, 61px 1636px #fff, 830px 1611px #fff, 1202px 966px #fff, 859px 594px #fff, 377px 1508px #fff, 1882px 55px #fff, 920px 342px #fff, 725px 1832px #fff, 580px 1082px #fff, 642px 28px #fff, 318px 949px #fff, 1398px 285px #fff, 410px 965px #fff, 302px 1779px #fff, 717px 133px #fff, 1441px 1329px #fff, 112px 1851px #fff, 278px 1399px #fff, 794px 1563px #fff, 380px 1281px #fff, 1606px 1580px #fff, 1234px 1203px #fff, 1792px 156px #fff, 557px 285px #fff, 460px 510px #fff, 1103px 693px #fff, 615px 549px #fff, 1824px 1498px #fff, 1652px 427px #fff, 799px 1546px #fff, 814px 964px #fff, 13px 357px #fff, 794px 1047px #fff, 472px 346px #fff, 1496px 896px #fff, 670px 1359px #fff, 1872px 665px #fff, 145px 634px #fff, 875px 7px #fff, 1042px 180px #fff, 136px 1847px #fff, 878px 846px #fff, 31px 1036px #fff, 413px 1017px #fff, 1479px 705px #fff, 873px 873px #fff, 1509px 474px #fff, 654px 821px #fff, 1243px 343px #fff, 1122px 1488px #fff, 1898px 1849px #fff, 1227px 997px #fff, 680px 823px #fff, 1687px 723px #fff, 1113px 366px #fff, 1648px 495px #fff, 1585px 1223px #fff, 448px 552px #fff, 763px 769px #fff, 1689px 1231px #fff, 1666px 1439px #fff, 271px 888px #fff, 440px 1536px #fff, 874px 1196px #fff, 1579px 345px #fff, 896px 644px #fff, 1164px 463px #fff, 364px 713px #fff, 1508px 1413px #fff, 121px 501px #fff, 1097px 424px #fff, 909px 700px #fff, 914px 1379px #fff, 618px 1064px #fff, 475px 1730px #fff, 1461px 1352px #fff, 1513px 1724px #fff, 1151px 322px #fff, 1635px 1611px #fff, 618px 766px #fff, 961px 686px #fff, 382px 112px #fff, 187px 1275px #fff, 940px 1081px #fff, 439px 690px #fff, 1439px 693px #fff, 1313px 121px #fff, 1246px 510px #fff, 227px 965px #fff, 1345px 1013px #fff, 1472px 371px #fff, 454px 863px #fff, 28px 1503px #fff, 1341px 359px #fff, 465px 505px #fff, 1671px 1134px #fff, 27px 664px #fff, 1871px 1278px #fff, 1385px 100px #fff, 156px 478px #fff, 13px 1793px #fff, 1703px 582px #fff, 1492px 375px #fff, 1384px 1625px #fff, 484px 14px #fff, 1452px 885px #fff, 1172px 1160px #fff, 901px 1557px #fff, 1088px 212px #fff, 1606px 476px #fff, 904px 1287px #fff, 1021px 1841px #fff, 1101px 1451px #fff, 1618px 553px #fff, 336px 217px #fff, 1739px 306px #fff, 1743px 238px #fff, 964px 641px #fff, 1px 933px #fff, 1298px 21px #fff, 785px 948px #fff, 1745px 1445px #fff, 346px 719px #fff, 126px 624px #fff, 1634px 456px #fff, 152px 288px #fff, 253px 845px #fff, 1644px 947px #fff, 752px 359px #fff, 1444px 320px #fff, 1868px 1276px #fff, 264px 118px #fff, 445px 1727px #fff, 1390px 1048px #fff, 89px 1432px #fff, 1704px 1436px #fff, 1341px 1834px #fff, 1635px 586px #fff, 303px 1787px #fff, 1582px 1682px #fff, 542px 1419px #fff, 373px 1783px #fff, 1671px 1181px #fff, 1289px 1074px #fff, 458px 848px #fff, 1578px 539px #fff, 1894px 161px #fff, 445px 987px #fff, 1390px 128px #fff, 739px 1346px #fff, 1836px 1066px #fff, 1385px 303px #fff, 1867px 436px #fff, 1801px 1153px #fff, 583px 426px #fff, 338px 220px #fff, 1437px 410px #fff, 1874px 1595px #fff, 1910px 1177px #fff, 1764px 350px #fff, 1319px 432px #fff, 739px 366px #fff, 100px 704px #fff, 156px 1198px #fff, 813px 251px #fff, 983px 870px #fff, 776px 1918px #fff, 171px 1188px #fff, 707px 1368px #fff, 609px 547px #fff, 481px 209px #fff, 1438px 564px #fff, 174px 513px #fff, 83px 262px #fff, 1553px 316px #fff, 98px 185px #fff, 168px 1139px #fff, 1444px 583px #fff, 628px 639px #fff, 203px 39px #fff, 1551px 1284px #fff, 656px 1101px #fff, 967px 799px #fff, 605px 1119px #fff, 297px 210px #fff, 1475px 1322px #fff, 367px 1427px #fff, 26px 911px #fff, 1370px 1860px #fff, 1673px 1246px #fff, 236px 1796px #fff, 1533px 1468px #fff, 718px 467px #fff, 1862px 855px #fff, 1618px 1502px #fff, 563px 1178px #fff, 1110px 802px #fff, 966px 736px #fff, 1192px 119px #fff, 390px 353px #fff, 25px 1233px #fff, 613px 1210px #fff, 256px 632px #fff, 1548px 613px #fff, 847px 1847px #fff, 783px 163px #fff, 1563px 1067px #fff, 799px 1090px #fff, 830px 1917px #fff, 1111px 1740px #fff, 247px 1594px #fff, 649px 1253px #fff, 53px 1534px #fff, 1088px 92px #fff, 1497px 1126px #fff, 525px 1869px #fff, 1263px 1224px #fff, 319px 378px #fff, 87px 712px #fff, 1781px 1496px #fff, 1767px 868px #fff, 302px 1648px #fff, 381px 913px #fff, 459px 551px #fff, 1043px 1349px #fff, 1331px 390px #fff, 135px 1427px #fff, 196px 379px #fff, 1808px 1911px #fff, 1076px 879px #fff, 1759px 1633px #fff, 1442px 1431px #fff, 1436px 1443px #fff, 1266px 1869px #fff, 363px 1715px #fff, 927px 1777px #fff, 1285px 1697px #fff, 1605px 143px #fff, 954px 1307px #fff, 904px 1102px #fff, 989px 749px #fff, 1465px 759px #fff, 1250px 1312px #fff, 1278px 848px #fff, 348px 1770px #fff, 1894px 333px #fff, 1113px 49px #fff, 1834px 1133px #fff, 865px 1736px #fff, 448px 810px #fff, 1132px 1228px #fff, 1362px 1371px #fff, 91px 1299px #fff, 1891px 1852px #fff, 180px 959px #fff, 807px 576px #fff, 1851px 454px #fff, 1531px 462px #fff, 125px 552px #fff, 661px 749px #fff, 1615px 1086px #fff, 997px 1371px #fff, 1484px 655px #fff, 746px 1699px #fff, 245px 1669px #fff, 788px 1373px #fff, 527px 948px #fff, 112px 1672px #fff, 463px 343px #fff, 124px 1317px #fff, 1447px 1018px #fff, 822px 768px #fff, 483px 1381px #fff, 401px 1345px #fff, 1793px 1210px #fff, 110px 611px #fff, 1509px 13px #fff, 106px 1534px #fff, 1568px 1482px #fff, 1069px 1872px #fff, 642px 500px #fff, 826px 1581px #fff, 1140px 472px #fff, 527px 651px #fff, 1219px 150px #fff, 574px 1062px #fff, 1168px 978px #fff, 232px 1072px #fff, 846px 164px #fff, 1103px 1236px #fff, 1253px 1362px #fff, 1243px 351px #fff, 874px 1246px #fff, 641px 1279px #fff, 1042px 965px #fff, 368px 685px #fff, 717px 1327px #fff, 65px 1066px #fff, 855px 413px #fff, 1406px 585px #fff, 490px 1803px #fff, 1623px 351px #fff, 577px 1663px #fff, 1375px 1332px #fff, 1902px 1896px #fff, 1377px 1821px #fff, 86px 1078px #fff, 934px 56px #fff, 460px 1453px #fff, 545px 72px #fff, 763px 537px #fff, 819px 381px #fff, 422px 367px #fff, 1429px 691px #fff, 1658px 1468px #fff, 174px 1182px #fff, 908px 118px #fff, 1554px 1477px #fff, 348px 163px #fff, 232px 1614px #fff, 1707px 1607px #fff, 1557px 501px #fff, 777px 728px #fff, 1652px 1163px #fff, 1591px 273px #fff, 905px 1832px #fff, 336px 483px #fff, 1434px 248px #fff, 1127px 1607px #fff, 119px 1876px #fff, 1238px 1870px #fff, 626px 1457px #fff, 897px 1551px #fff, 377px 1194px #fff, 881px 1643px #fff, 727px 1616px #fff, 881px 1656px #fff, 1913px 1152px #fff, 449px 1765px #fff, 407px 1150px #fff, 911px 249px #fff, 1211px 1649px #fff, 323px 810px #fff, 203px 1886px #fff, 567px 879px #fff, 474px 875px #fff, 1830px 1739px #fff, 525px 1809px #fff, 1197px 638px #fff, 1345px 13px #fff, 758px 1526px #fff, 1215px 34px #fff, 1352px 722px #fff, 880px 1174px #fff, 808px 1430px #fff, 1536px 26px #fff, 1550px 1263px #fff, 450px 731px #fff, 39px 1303px #fff, 962px 247px #fff, 1347px 874px #fff, 363px 1727px #fff, 271px 1429px #fff, 73px 174px #fff, 54px 721px #fff, 1574px 1284px #fff, 1852px 868px #fff, 518px 1408px #fff, 1829px 1792px #fff, 1795px 1793px #fff, 1444px 620px #fff, 43px 381px #fff, 1522px 151px #fff, 1423px 1870px #fff, 258px 910px #fff, 1596px 193px #fff, 1516px 747px #fff, 996px 958px #fff, 571px 785px #fff, 213px 1435px #fff, 1040px 121px #fff, 925px 1476px #fff, 41px 816px #fff, 171px 1777px #fff, 652px 1219px #fff, 1289px 207px #fff, 682px 1795px #fff, 662px 171px #fff, 1421px 296px #fff, 365px 803px #fff, 447px 1763px #fff, 662px 1315px #fff, 326px 58px #fff, 54px 499px #fff, 1067px 1354px #fff, 302px 357px #fff, 130px 1484px #fff, 278px 118px #fff, 1773px 1820px #fff, 105px 1112px #fff, 1693px 740px #fff, 207px 1243px #fff, 278px 607px #fff, 1078px 424px #fff, 1184px 758px #fff, 564px 349px #fff, 449px 1869px #fff, 1555px 612px #fff, 1700px 1012px #fff, 1704px 1740px #fff, 1081px 1014px #fff, 1712px 1675px #fff, 1482px 190px #fff, 996px 629px #fff, 487px 964px #fff, 124px 1556px #fff, 37px 1784px #fff, 480px 399px #fff, 1507px 118px #fff, 755px 1034px #fff, 835px 1759px #fff, 1776px 172px #fff, 1402px 1251px #fff, 1441px 738px #fff, 85px 648px #fff, 1046px 1761px #fff, 1869px 482px #fff, 1790px 1343px #fff, 1586px 1395px #fff, 1165px 47px #fff, 1232px 110px #fff, 460px 1541px #fff, 1782px 627px #fff, 1433px 548px #fff, 1524px 1521px #fff, 1767px 1893px #fff, 1028px 8px #fff, 1307px 628px #fff, 1024px 1762px #fff, 366px 986px #fff, 1020px 920px #fff, 1212px 1338px #fff, 86px 436px #fff, 563px 1903px #fff, 1371px 382px #fff, 1915px 1155px #fff, 219px 1244px #fff, 1796px 317px #fff, 153px 238px #fff, 14px 266px #fff, 220px 1494px #fff, 799px 509px #fff, 526px 1472px #fff, 248px 622px #fff, 259px 1738px #fff, 1202px 942px #fff, 1129px 1351px #fff, 568px 1325px #fff, 1232px 84px #fff, 671px 1333px #fff, 637px 548px #fff, 247px 34px #fff, 751px 1251px #fff, 278px 850px #fff, 1208px 1203px #fff, 1866px 225px #fff, 1840px 1411px #fff, 1748px 912px #fff, 685px 1771px #fff, 677px 1221px #fff, 796px 191px #fff, 511px 312px #fff, 422px 1350px #fff, 1054px 766px #fff, 903px 187px #fff, 1471px 347px #fff, 1344px 1403px #fff, 1784px 458px #fff, 376px 1754px #fff, 102px 1777px #fff, 1446px 737px #fff, 408px 597px #fff, 1102px 455px #fff, 1646px 1516px #fff, 636px 1269px #fff, 1708px 1666px #fff, 887px 1340px #fff, 83px 231px #fff, 1657px 555px #fff, 916px 453px #fff, 359px 784px #fff, 1033px 968px #fff, 1789px 1133px #fff, 195px 1132px #fff, 1735px 551px #fff, 49px 1427px #fff, 1888px 929px #fff, 1378px 578px #fff, 670px 955px #fff, 964px 1390px #fff, 1042px 1676px #fff, 461px 255px #fff, 207px 708px #fff, 836px 1719px #fff, 1870px 237px #fff, 1049px 1006px #fff, 196px 16px #fff, 70px 855px #fff, 462px 466px #fff, 1696px 65px #fff, 1519px 1152px #fff, 982px 1296px #fff, 866px 1277px #fff, 1160px 1535px #fff, 662px 328px #fff, 880px 1738px #fff, 99px 302px #fff, 117px 208px #fff, 1658px 1417px #fff, 1107px 614px #fff, 796px 393px #fff, 1380px 7px #fff, 1124px 319px #fff, 1241px 850px #fff, 1264px 1894px #fff, 819px 714px #fff, 787px 90px #fff, 718px 1597px #fff, 1812px 538px #fff, 842px 755px #fff, 148px 1593px #fff, 940px 618px #fff, 1249px 723px #fff, 833px 401px #fff, 1712px 156px #fff, 756px 969px #fff, 805px 512px #fff, 419px 25px #fff, 1378px 1585px #fff, 264px 927px #fff, 1482px 1145px #fff, 493px 321px #fff, 1323px 265px #fff, 1329px 176px #fff, 1291px 222px #fff, 698px 872px #fff, 235px 1248px #fff, 557px 201px #fff, 1444px 319px #fff, 1169px 136px #fff, 330px 1679px #fff, 184px 179px #fff, 1468px 1022px #fff, 1446px 813px #fff, 928px 1488px #fff, 1799px 302px #fff, 125px 489px #fff, 1718px 1686px #fff, 728px 613px #fff, 1183px 50px #fff, 818px 1742px #fff, 1690px 1253px #fff, 375px 827px #fff, 27px 1809px #fff, 467px 1647px #fff, 414px 106px #fff, 1309px 1897px #fff, 1349px 1221px #fff, 973px 1756px #fff, 1406px 1663px #fff, 1778px 1696px #fff, 852px 228px #fff, 1397px 418px #fff, 45px 1311px #fff, 1631px 1540px #fff, 1368px 809px #fff, 235px 535px #fff, 1677px 105px #fff, 1407px 675px #fff, 1048px 839px #fff;
    height: 1px;
    width: 1px;
  }

  .particle-1:after {
    box-shadow: 1307px 1889px #fff, 771px 642px #fff, 1811px 1116px #fff, 796px 418px #fff, 1607px 997px #fff, 1431px 192px #fff, 1081px 382px #fff, 116px 388px #fff, 188px 1588px #fff, 33px 1314px #fff, 1828px 1004px #fff, 1830px 635px #fff, 740px 376px #fff, 1251px 679px #fff, 1639px 1559px #fff, 1650px 92px #fff, 1655px 1787px #fff, 248px 378px #fff, 1258px 410px #fff, 1737px 1531px #fff, 61px 1636px #fff, 830px 1611px #fff, 1202px 966px #fff, 859px 594px #fff, 377px 1508px #fff, 1882px 55px #fff, 920px 342px #fff, 725px 1832px #fff, 580px 1082px #fff, 642px 28px #fff, 318px 949px #fff, 1398px 285px #fff, 410px 965px #fff, 302px 1779px #fff, 717px 133px #fff, 1441px 1329px #fff, 112px 1851px #fff, 278px 1399px #fff, 794px 1563px #fff, 380px 1281px #fff, 1606px 1580px #fff, 1234px 1203px #fff, 1792px 156px #fff, 557px 285px #fff, 460px 510px #fff, 1103px 693px #fff, 615px 549px #fff, 1824px 1498px #fff, 1652px 427px #fff, 799px 1546px #fff, 814px 964px #fff, 13px 357px #fff, 794px 1047px #fff, 472px 346px #fff, 1496px 896px #fff, 670px 1359px #fff, 1872px 665px #fff, 145px 634px #fff, 875px 7px #fff, 1042px 180px #fff, 136px 1847px #fff, 878px 846px #fff, 31px 1036px #fff, 413px 1017px #fff, 1479px 705px #fff, 873px 873px #fff, 1509px 474px #fff, 654px 821px #fff, 1243px 343px #fff, 1122px 1488px #fff, 1898px 1849px #fff, 1227px 997px #fff, 680px 823px #fff, 1687px 723px #fff, 1113px 366px #fff, 1648px 495px #fff, 1585px 1223px #fff, 448px 552px #fff, 763px 769px #fff, 1689px 1231px #fff, 1666px 1439px #fff, 271px 888px #fff, 440px 1536px #fff, 874px 1196px #fff, 1579px 345px #fff, 896px 644px #fff, 1164px 463px #fff, 364px 713px #fff, 1508px 1413px #fff, 121px 501px #fff, 1097px 424px #fff, 909px 700px #fff, 914px 1379px #fff, 618px 1064px #fff, 475px 1730px #fff, 1461px 1352px #fff, 1513px 1724px #fff, 1151px 322px #fff, 1635px 1611px #fff, 618px 766px #fff, 961px 686px #fff, 382px 112px #fff, 187px 1275px #fff, 940px 1081px #fff, 439px 690px #fff, 1439px 693px #fff, 1313px 121px #fff, 1246px 510px #fff, 227px 965px #fff, 1345px 1013px #fff, 1472px 371px #fff, 454px 863px #fff, 28px 1503px #fff, 1341px 359px #fff, 465px 505px #fff, 1671px 1134px #fff, 27px 664px #fff, 1871px 1278px #fff, 1385px 100px #fff, 156px 478px #fff, 13px 1793px #fff, 1703px 582px #fff, 1492px 375px #fff, 1384px 1625px #fff, 484px 14px #fff, 1452px 885px #fff, 1172px 1160px #fff, 901px 1557px #fff, 1088px 212px #fff, 1606px 476px #fff, 904px 1287px #fff, 1021px 1841px #fff, 1101px 1451px #fff, 1618px 553px #fff, 336px 217px #fff, 1739px 306px #fff, 1743px 238px #fff, 964px 641px #fff, 1px 933px #fff, 1298px 21px #fff, 785px 948px #fff, 1745px 1445px #fff, 346px 719px #fff, 126px 624px #fff, 1634px 456px #fff, 152px 288px #fff, 253px 845px #fff, 1644px 947px #fff, 752px 359px #fff, 1444px 320px #fff, 1868px 1276px #fff, 264px 118px #fff, 445px 1727px #fff, 1390px 1048px #fff, 89px 1432px #fff, 1704px 1436px #fff, 1341px 1834px #fff, 1635px 586px #fff, 303px 1787px #fff, 1582px 1682px #fff, 542px 1419px #fff, 373px 1783px #fff, 1671px 1181px #fff, 1289px 1074px #fff, 458px 848px #fff, 1578px 539px #fff, 1894px 161px #fff, 445px 987px #fff, 1390px 128px #fff, 739px 1346px #fff, 1836px 1066px #fff, 1385px 303px #fff, 1867px 436px #fff, 1801px 1153px #fff, 583px 426px #fff, 338px 220px #fff, 1437px 410px #fff, 1874px 1595px #fff, 1910px 1177px #fff, 1764px 350px #fff, 1319px 432px #fff, 739px 366px #fff, 100px 704px #fff, 156px 1198px #fff, 813px 251px #fff, 983px 870px #fff, 776px 1918px #fff, 171px 1188px #fff, 707px 1368px #fff, 609px 547px #fff, 481px 209px #fff, 1438px 564px #fff, 174px 513px #fff, 83px 262px #fff, 1553px 316px #fff, 98px 185px #fff, 168px 1139px #fff, 1444px 583px #fff, 628px 639px #fff, 203px 39px #fff, 1551px 1284px #fff, 656px 1101px #fff, 967px 799px #fff, 605px 1119px #fff, 297px 210px #fff, 1475px 1322px #fff, 367px 1427px #fff, 26px 911px #fff, 1370px 1860px #fff, 1673px 1246px #fff, 236px 1796px #fff, 1533px 1468px #fff, 718px 467px #fff, 1862px 855px #fff, 1618px 1502px #fff, 563px 1178px #fff, 1110px 802px #fff, 966px 736px #fff, 1192px 119px #fff, 390px 353px #fff, 25px 1233px #fff, 613px 1210px #fff, 256px 632px #fff, 1548px 613px #fff, 847px 1847px #fff, 783px 163px #fff, 1563px 1067px #fff, 799px 1090px #fff, 830px 1917px #fff, 1111px 1740px #fff, 247px 1594px #fff, 649px 1253px #fff, 53px 1534px #fff, 1088px 92px #fff, 1497px 1126px #fff, 525px 1869px #fff, 1263px 1224px #fff, 319px 378px #fff, 87px 712px #fff, 1781px 1496px #fff, 1767px 868px #fff, 302px 1648px #fff, 381px 913px #fff, 459px 551px #fff, 1043px 1349px #fff, 1331px 390px #fff, 135px 1427px #fff, 196px 379px #fff, 1808px 1911px #fff, 1076px 879px #fff, 1759px 1633px #fff, 1442px 1431px #fff, 1436px 1443px #fff, 1266px 1869px #fff, 363px 1715px #fff, 927px 1777px #fff, 1285px 1697px #fff, 1605px 143px #fff, 954px 1307px #fff, 904px 1102px #fff, 989px 749px #fff, 1465px 759px #fff, 1250px 1312px #fff, 1278px 848px #fff, 348px 1770px #fff, 1894px 333px #fff, 1113px 49px #fff, 1834px 1133px #fff, 865px 1736px #fff, 448px 810px #fff, 1132px 1228px #fff, 1362px 1371px #fff, 91px 1299px #fff, 1891px 1852px #fff, 180px 959px #fff, 807px 576px #fff, 1851px 454px #fff, 1531px 462px #fff, 125px 552px #fff, 661px 749px #fff, 1615px 1086px #fff, 997px 1371px #fff, 1484px 655px #fff, 746px 1699px #fff, 245px 1669px #fff, 788px 1373px #fff, 527px 948px #fff, 112px 1672px #fff, 463px 343px #fff, 124px 1317px #fff, 1447px 1018px #fff, 822px 768px #fff, 483px 1381px #fff, 401px 1345px #fff, 1793px 1210px #fff, 110px 611px #fff, 1509px 13px #fff, 106px 1534px #fff, 1568px 1482px #fff, 1069px 1872px #fff, 642px 500px #fff, 826px 1581px #fff, 1140px 472px #fff, 527px 651px #fff, 1219px 150px #fff, 574px 1062px #fff, 1168px 978px #fff, 232px 1072px #fff, 846px 164px #fff, 1103px 1236px #fff, 1253px 1362px #fff, 1243px 351px #fff, 874px 1246px #fff, 641px 1279px #fff, 1042px 965px #fff, 368px 685px #fff, 717px 1327px #fff, 65px 1066px #fff, 855px 413px #fff, 1406px 585px #fff, 490px 1803px #fff, 1623px 351px #fff, 577px 1663px #fff, 1375px 1332px #fff, 1902px 1896px #fff, 1377px 1821px #fff, 86px 1078px #fff, 934px 56px #fff, 460px 1453px #fff, 545px 72px #fff, 763px 537px #fff, 819px 381px #fff, 422px 367px #fff, 1429px 691px #fff, 1658px 1468px #fff, 174px 1182px #fff, 908px 118px #fff, 1554px 1477px #fff, 348px 163px #fff, 232px 1614px #fff, 1707px 1607px #fff, 1557px 501px #fff, 777px 728px #fff, 1652px 1163px #fff, 1591px 273px #fff, 905px 1832px #fff, 336px 483px #fff, 1434px 248px #fff, 1127px 1607px #fff, 119px 1876px #fff, 1238px 1870px #fff, 626px 1457px #fff, 897px 1551px #fff, 377px 1194px #fff, 881px 1643px #fff, 727px 1616px #fff, 881px 1656px #fff, 1913px 1152px #fff, 449px 1765px #fff, 407px 1150px #fff, 911px 249px #fff, 1211px 1649px #fff, 323px 810px #fff, 203px 1886px #fff, 567px 879px #fff, 474px 875px #fff, 1830px 1739px #fff, 525px 1809px #fff, 1197px 638px #fff, 1345px 13px #fff, 758px 1526px #fff, 1215px 34px #fff, 1352px 722px #fff, 880px 1174px #fff, 808px 1430px #fff, 1536px 26px #fff, 1550px 1263px #fff, 450px 731px #fff, 39px 1303px #fff, 962px 247px #fff, 1347px 874px #fff, 363px 1727px #fff, 271px 1429px #fff, 73px 174px #fff, 54px 721px #fff, 1574px 1284px #fff, 1852px 868px #fff, 518px 1408px #fff, 1829px 1792px #fff, 1795px 1793px #fff, 1444px 620px #fff, 43px 381px #fff, 1522px 151px #fff, 1423px 1870px #fff, 258px 910px #fff, 1596px 193px #fff, 1516px 747px #fff, 996px 958px #fff, 571px 785px #fff, 213px 1435px #fff, 1040px 121px #fff, 925px 1476px #fff, 41px 816px #fff, 171px 1777px #fff, 652px 1219px #fff, 1289px 207px #fff, 682px 1795px #fff, 662px 171px #fff, 1421px 296px #fff, 365px 803px #fff, 447px 1763px #fff, 662px 1315px #fff, 326px 58px #fff, 54px 499px #fff, 1067px 1354px #fff, 302px 357px #fff, 130px 1484px #fff, 278px 118px #fff, 1773px 1820px #fff, 105px 1112px #fff, 1693px 740px #fff, 207px 1243px #fff, 278px 607px #fff, 1078px 424px #fff, 1184px 758px #fff, 564px 349px #fff, 449px 1869px #fff, 1555px 612px #fff, 1700px 1012px #fff, 1704px 1740px #fff, 1081px 1014px #fff, 1712px 1675px #fff, 1482px 190px #fff, 996px 629px #fff, 487px 964px #fff, 124px 1556px #fff, 37px 1784px #fff, 480px 399px #fff, 1507px 118px #fff, 755px 1034px #fff, 835px 1759px #fff, 1776px 172px #fff, 1402px 1251px #fff, 1441px 738px #fff, 85px 648px #fff, 1046px 1761px #fff, 1869px 482px #fff, 1790px 1343px #fff, 1586px 1395px #fff, 1165px 47px #fff, 1232px 110px #fff, 460px 1541px #fff, 1782px 627px #fff, 1433px 548px #fff, 1524px 1521px #fff, 1767px 1893px #fff, 1028px 8px #fff, 1307px 628px #fff, 1024px 1762px #fff, 366px 986px #fff, 1020px 920px #fff, 1212px 1338px #fff, 86px 436px #fff, 563px 1903px #fff, 1371px 382px #fff, 1915px 1155px #fff, 219px 1244px #fff, 1796px 317px #fff, 153px 238px #fff, 14px 266px #fff, 220px 1494px #fff, 799px 509px #fff, 526px 1472px #fff, 248px 622px #fff, 259px 1738px #fff, 1202px 942px #fff, 1129px 1351px #fff, 568px 1325px #fff, 1232px 84px #fff, 671px 1333px #fff, 637px 548px #fff, 247px 34px #fff, 751px 1251px #fff, 278px 850px #fff, 1208px 1203px #fff, 1866px 225px #fff, 1840px 1411px #fff, 1748px 912px #fff, 685px 1771px #fff, 677px 1221px #fff, 796px 191px #fff, 511px 312px #fff, 422px 1350px #fff, 1054px 766px #fff, 903px 187px #fff, 1471px 347px #fff, 1344px 1403px #fff, 1784px 458px #fff, 376px 1754px #fff, 102px 1777px #fff, 1446px 737px #fff, 408px 597px #fff, 1102px 455px #fff, 1646px 1516px #fff, 636px 1269px #fff, 1708px 1666px #fff, 887px 1340px #fff, 83px 231px #fff, 1657px 555px #fff, 916px 453px #fff, 359px 784px #fff, 1033px 968px #fff, 1789px 1133px #fff, 195px 1132px #fff, 1735px 551px #fff, 49px 1427px #fff, 1888px 929px #fff, 1378px 578px #fff, 670px 955px #fff, 964px 1390px #fff, 1042px 1676px #fff, 461px 255px #fff, 207px 708px #fff, 836px 1719px #fff, 1870px 237px #fff, 1049px 1006px #fff, 196px 16px #fff, 70px 855px #fff, 462px 466px #fff, 1696px 65px #fff, 1519px 1152px #fff, 982px 1296px #fff, 866px 1277px #fff, 1160px 1535px #fff, 662px 328px #fff, 880px 1738px #fff, 99px 302px #fff, 117px 208px #fff, 1658px 1417px #fff, 1107px 614px #fff, 796px 393px #fff, 1380px 7px #fff, 1124px 319px #fff, 1241px 850px #fff, 1264px 1894px #fff, 819px 714px #fff, 787px 90px #fff, 718px 1597px #fff, 1812px 538px #fff, 842px 755px #fff, 148px 1593px #fff, 940px 618px #fff, 1249px 723px #fff, 833px 401px #fff, 1712px 156px #fff, 756px 969px #fff, 805px 512px #fff, 419px 25px #fff, 1378px 1585px #fff, 264px 927px #fff, 1482px 1145px #fff, 493px 321px #fff, 1323px 265px #fff, 1329px 176px #fff, 1291px 222px #fff, 698px 872px #fff, 235px 1248px #fff, 557px 201px #fff, 1444px 319px #fff, 1169px 136px #fff, 330px 1679px #fff, 184px 179px #fff, 1468px 1022px #fff, 1446px 813px #fff, 928px 1488px #fff, 1799px 302px #fff, 125px 489px #fff, 1718px 1686px #fff, 728px 613px #fff, 1183px 50px #fff, 818px 1742px #fff, 1690px 1253px #fff, 375px 827px #fff, 27px 1809px #fff, 467px 1647px #fff, 414px 106px #fff, 1309px 1897px #fff, 1349px 1221px #fff, 973px 1756px #fff, 1406px 1663px #fff, 1778px 1696px #fff, 852px 228px #fff, 1397px 418px #fff, 45px 1311px #fff, 1631px 1540px #fff, 1368px 809px #fff, 235px 535px #fff, 1677px 105px #fff, 1407px 675px #fff, 1048px 839px #fff;
    height: 1px;
    width: 1px;
  }

  .particle-2 {
    -webkit-animation: animParticle 120s linear infinite;
    animation: animParticle 120s linear infinite;
    box-shadow: 186px 967px #fff, 358px 826px #fff, 1637px 1890px #fff, 1599px 1491px #fff, 912px 1632px #fff, 1546px 1204px #fff, 38px 611px #fff, 1083px 1383px #fff, 809px 564px #fff, 1194px 834px #fff, 813px 170px #fff, 384px 1294px #fff, 688px 272px #fff, 1755px 297px #fff, 1019px 556px #fff, 1457px 1243px #fff, 1417px 379px #fff, 204px 1433px #fff, 90px 1109px #fff, 1593px 23px #fff, 65px 1168px #fff, 1818px 276px #fff, 1396px 178px #fff, 1717px 1143px #fff, 1826px 71px #fff, 1214px 1865px #fff, 551px 1734px #fff, 431px 1406px #fff, 472px 481px #fff, 1128px 31px #fff, 452px 886px #fff, 152px 3px #fff, 1660px 657px #fff, 1613px 1626px #fff, 784px 396px #fff, 1726px 784px #fff, 52px 1114px #fff, 484px 697px #fff, 757px 1353px #fff, 1745px 1064px #fff, 1190px 1349px #fff, 152px 75px #fff, 892px 126px #fff, 1915px 1254px #fff, 1115px 1542px #fff, 702px 1069px #fff, 1790px 303px #fff, 998px 1250px #fff, 1489px 109px #fff, 1134px 855px #fff, 1518px 1316px #fff, 826px 1262px #fff, 104px 434px #fff, 1874px 1251px #fff, 1200px 90px #fff, 1915px 1305px #fff, 116px 558px #fff, 1766px 757px #fff, 1800px 1468px #fff, 713px 31px #fff, 1567px 364px #fff, 318px 1570px #fff, 216px 671px #fff, 263px 775px #fff, 1823px 680px #fff, 743px 1545px #fff, 1051px 411px #fff, 407px 383px #fff, 1097px 1569px #fff, 852px 773px #fff, 1786px 1338px #fff, 365px 205px #fff, 1873px 1142px #fff, 1069px 1511px #fff, 53px 1902px #fff, 1198px 452px #fff, 1373px 699px #fff, 1717px 779px #fff, 202px 753px #fff, 207px 1827px #fff, 1774px 1330px #fff, 1536px 452px #fff, 17px 117px #fff, 1035px 1559px #fff, 1085px 191px #fff, 1851px 833px #fff, 727px 319px #fff, 1236px 110px #fff, 995px 689px #fff, 1626px 1429px #fff, 322px 1425px #fff, 1719px 1574px #fff, 1419px 19px #fff, 1328px 856px #fff, 1570px 1307px #fff, 1500px 1031px #fff, 119px 137px #fff, 466px 468px #fff, 1304px 1626px #fff, 1236px 383px #fff, 158px 230px #fff, 251px 1628px #fff, 1695px 716px #fff, 1119px 1801px #fff, 834px 1850px #fff, 663px 745px #fff, 1148px 800px #fff, 313px 1297px #fff, 742px 1001px #fff, 1384px 775px #fff, 558px 525px #fff, 540px 446px #fff, 1014px 135px #fff, 701px 121px #fff, 996px 579px #fff, 1864px 1754px #fff, 1907px 1658px #fff, 588px 545px #fff, 1689px 503px #fff, 658px 1803px #fff, 984px 1653px #fff, 208px 193px #fff, 747px 876px #fff, 85px 769px #fff, 50px 262px #fff, 477px 1178px #fff, 868px 885px #fff, 787px 1002px #fff, 225px 1151px #fff, 1340px 736px #fff, 1574px 229px #fff, 304px 20px #fff, 1035px 1884px #fff, 1742px 1577px #fff, 1574px 1572px #fff, 413px 57px #fff, 138px 1041px #fff, 759px 708px #fff, 1490px 1462px #fff, 986px 1130px #fff, 145px 634px #fff, 1791px 1881px #fff, 621px 1577px #fff, 1890px 886px #fff, 65px 142px #fff, 740px 463px #fff, 1151px 353px #fff, 1380px 1165px #fff, 177px 748px #fff, 1910px 1140px #fff, 307px 1304px #fff, 674px 991px #fff, 1755px 1887px #fff, 1559px 21px #fff, 1421px 227px #fff, 973px 1357px #fff, 862px 1219px #fff, 1123px 1001px #fff, 808px 696px #fff, 394px 628px #fff, 1537px 104px #fff, 1907px 1446px #fff, 742px 508px #fff, 1168px 1190px #fff, 1464px 1652px #fff, 492px 1178px #fff, 58px 1256px #fff, 1544px 196px #fff, 769px 423px #fff, 1808px 1448px #fff, 864px 685px #fff, 1299px 62px #fff, 1770px 695px #fff, 364px 945px #fff, 1890px 477px #fff, 1423px 1879px #fff, 1763px 302px #fff, 692px 929px #fff, 1559px 290px #fff, 927px 1172px #fff, 1799px 1855px #fff, 678px 1308px #fff, 913px 943px #fff, 291px 1494px #fff, 563px 826px #fff, 1748px 1674px #fff, 1596px 1387px #fff, 296px 801px #fff, 1844px 656px #fff, 1629px 482px #fff, 1249px 784px #fff, 731px 1428px #fff, 985px 352px #fff, 1244px 1775px #fff, 1690px 1877px #fff, 1919px 572px #fff, 1403px 715px #fff, 674px 1518px #fff, 528px 418px #fff, 1714px 464px #fff;
    height: 2px;
    width: 2px;
  }

  .particle-2:after {
    box-shadow: 186px 967px #fff, 358px 826px #fff, 1637px 1890px #fff, 1599px 1491px #fff, 912px 1632px #fff, 1546px 1204px #fff, 38px 611px #fff, 1083px 1383px #fff, 809px 564px #fff, 1194px 834px #fff, 813px 170px #fff, 384px 1294px #fff, 688px 272px #fff, 1755px 297px #fff, 1019px 556px #fff, 1457px 1243px #fff, 1417px 379px #fff, 204px 1433px #fff, 90px 1109px #fff, 1593px 23px #fff, 65px 1168px #fff, 1818px 276px #fff, 1396px 178px #fff, 1717px 1143px #fff, 1826px 71px #fff, 1214px 1865px #fff, 551px 1734px #fff, 431px 1406px #fff, 472px 481px #fff, 1128px 31px #fff, 452px 886px #fff, 152px 3px #fff, 1660px 657px #fff, 1613px 1626px #fff, 784px 396px #fff, 1726px 784px #fff, 52px 1114px #fff, 484px 697px #fff, 757px 1353px #fff, 1745px 1064px #fff, 1190px 1349px #fff, 152px 75px #fff, 892px 126px #fff, 1915px 1254px #fff, 1115px 1542px #fff, 702px 1069px #fff, 1790px 303px #fff, 998px 1250px #fff, 1489px 109px #fff, 1134px 855px #fff, 1518px 1316px #fff, 826px 1262px #fff, 104px 434px #fff, 1874px 1251px #fff, 1200px 90px #fff, 1915px 1305px #fff, 116px 558px #fff, 1766px 757px #fff, 1800px 1468px #fff, 713px 31px #fff, 1567px 364px #fff, 318px 1570px #fff, 216px 671px #fff, 263px 775px #fff, 1823px 680px #fff, 743px 1545px #fff, 1051px 411px #fff, 407px 383px #fff, 1097px 1569px #fff, 852px 773px #fff, 1786px 1338px #fff, 365px 205px #fff, 1873px 1142px #fff, 1069px 1511px #fff, 53px 1902px #fff, 1198px 452px #fff, 1373px 699px #fff, 1717px 779px #fff, 202px 753px #fff, 207px 1827px #fff, 1774px 1330px #fff, 1536px 452px #fff, 17px 117px #fff, 1035px 1559px #fff, 1085px 191px #fff, 1851px 833px #fff, 727px 319px #fff, 1236px 110px #fff, 995px 689px #fff, 1626px 1429px #fff, 322px 1425px #fff, 1719px 1574px #fff, 1419px 19px #fff, 1328px 856px #fff, 1570px 1307px #fff, 1500px 1031px #fff, 119px 137px #fff, 466px 468px #fff, 1304px 1626px #fff, 1236px 383px #fff, 158px 230px #fff, 251px 1628px #fff, 1695px 716px #fff, 1119px 1801px #fff, 834px 1850px #fff, 663px 745px #fff, 1148px 800px #fff, 313px 1297px #fff, 742px 1001px #fff, 1384px 775px #fff, 558px 525px #fff, 540px 446px #fff, 1014px 135px #fff, 701px 121px #fff, 996px 579px #fff, 1864px 1754px #fff, 1907px 1658px #fff, 588px 545px #fff, 1689px 503px #fff, 658px 1803px #fff, 984px 1653px #fff, 208px 193px #fff, 747px 876px #fff, 85px 769px #fff, 50px 262px #fff, 477px 1178px #fff, 868px 885px #fff, 787px 1002px #fff, 225px 1151px #fff, 1340px 736px #fff, 1574px 229px #fff, 304px 20px #fff, 1035px 1884px #fff, 1742px 1577px #fff, 1574px 1572px #fff, 413px 57px #fff, 138px 1041px #fff, 759px 708px #fff, 1490px 1462px #fff, 986px 1130px #fff, 145px 634px #fff, 1791px 1881px #fff, 621px 1577px #fff, 1890px 886px #fff, 65px 142px #fff, 740px 463px #fff, 1151px 353px #fff, 1380px 1165px #fff, 177px 748px #fff, 1910px 1140px #fff, 307px 1304px #fff, 674px 991px #fff, 1755px 1887px #fff, 1559px 21px #fff, 1421px 227px #fff, 973px 1357px #fff, 862px 1219px #fff, 1123px 1001px #fff, 808px 696px #fff, 394px 628px #fff, 1537px 104px #fff, 1907px 1446px #fff, 742px 508px #fff, 1168px 1190px #fff, 1464px 1652px #fff, 492px 1178px #fff, 58px 1256px #fff, 1544px 196px #fff, 769px 423px #fff, 1808px 1448px #fff, 864px 685px #fff, 1299px 62px #fff, 1770px 695px #fff, 364px 945px #fff, 1890px 477px #fff, 1423px 1879px #fff, 1763px 302px #fff, 692px 929px #fff, 1559px 290px #fff, 927px 1172px #fff, 1799px 1855px #fff, 678px 1308px #fff, 913px 943px #fff, 291px 1494px #fff, 563px 826px #fff, 1748px 1674px #fff, 1596px 1387px #fff, 296px 801px #fff, 1844px 656px #fff, 1629px 482px #fff, 1249px 784px #fff, 731px 1428px #fff, 985px 352px #fff, 1244px 1775px #fff, 1690px 1877px #fff, 1919px 572px #fff, 1403px 715px #fff, 674px 1518px #fff, 528px 418px #fff, 1714px 464px #fff;
    height: 2px;
    width: 2px;
  }

  .particle-3 {
    -webkit-animation: animParticle 180s linear infinite;
    animation: animParticle 180s linear infinite;
    box-shadow: 823px 578px #fff, 848px 1475px #fff, 1260px 1888px #fff, 1819px 755px #fff, 48px 484px #fff, 281px 1041px #fff, 1278px 451px #fff, 131px 1515px #fff, 1787px 623px #fff, 752px 1109px #fff, 1593px 139px #fff, 1335px 1901px #fff, 1516px 1514px #fff, 484px 613px #fff, 1113px 1152px #fff, 1270px 1561px #fff, 1182px 404px #fff, 1727px 304px #fff, 599px 813px #fff, 818px 1462px #fff, 873px 1084px #fff, 1289px 360px #fff, 1862px 757px #fff, 1790px 1055px #fff, 1137px 1899px #fff, 1155px 1309px #fff, 50px 1116px #fff, 1389px 1269px #fff, 265px 297px #fff, 1910px 1461px #fff, 673px 1380px #fff, 562px 1756px #fff, 242px 549px #fff, 1004px 665px #fff, 1155px 51px #fff, 964px 796px #fff, 352px 510px #fff, 370px 750px #fff, 199px 1878px #fff, 1569px 748px #fff, 193px 274px #fff, 154px 1354px #fff, 1020px 247px #fff, 1251px 678px #fff, 712px 1841px #fff, 1435px 1419px #fff, 245px 1293px #fff, 1001px 251px #fff, 1457px 189px #fff, 66px 671px #fff, 1391px 622px #fff, 102px 937px #fff, 697px 64px #fff, 1782px 1134px #fff, 1796px 234px #fff, 358px 1263px #fff, 668px 1467px #fff, 1356px 1229px #fff, 82px 644px #fff, 44px 880px #fff, 1456px 258px #fff, 701px 568px #fff, 724px 655px #fff, 863px 1498px #fff, 1595px 777px #fff, 1820px 99px #fff, 1372px 1891px #fff, 441px 598px #fff, 741px 442px #fff, 1646px 1227px #fff, 351px 1503px #fff, 578px 292px #fff, 481px 1182px #fff, 1210px 1837px #fff, 855px 1511px #fff, 911px 545px #fff, 131px 888px #fff, 257px 1274px #fff, 242px 1704px #fff, 225px 721px #fff, 1158px 384px #fff, 1847px 644px #fff, 414px 686px #fff, 1153px 1621px #fff, 600px 627px #fff, 634px 1435px #fff, 1823px 1155px #fff, 1140px 1324px #fff, 1265px 1912px #fff, 419px 887px #fff, 21px 446px #fff, 676px 104px #fff, 126px 949px #fff, 1689px 1232px #fff, 1597px 1891px #fff, 1901px 811px #fff, 542px 277px #fff, 703px 1573px #fff, 481px 421px #fff, 913px 295px #fff;
    height: 3px;
    width: 3px;
  }

  .particle-3:after {
    box-shadow: 823px 578px #fff, 848px 1475px #fff, 1260px 1888px #fff, 1819px 755px #fff, 48px 484px #fff, 281px 1041px #fff, 1278px 451px #fff, 131px 1515px #fff, 1787px 623px #fff, 752px 1109px #fff, 1593px 139px #fff, 1335px 1901px #fff, 1516px 1514px #fff, 484px 613px #fff, 1113px 1152px #fff, 1270px 1561px #fff, 1182px 404px #fff, 1727px 304px #fff, 599px 813px #fff, 818px 1462px #fff, 873px 1084px #fff, 1289px 360px #fff, 1862px 757px #fff, 1790px 1055px #fff, 1137px 1899px #fff, 1155px 1309px #fff, 50px 1116px #fff, 1389px 1269px #fff, 265px 297px #fff, 1910px 1461px #fff, 673px 1380px #fff, 562px 1756px #fff, 242px 549px #fff, 1004px 665px #fff, 1155px 51px #fff, 964px 796px #fff, 352px 510px #fff, 370px 750px #fff, 199px 1878px #fff, 1569px 748px #fff, 193px 274px #fff, 154px 1354px #fff, 1020px 247px #fff, 1251px 678px #fff, 712px 1841px #fff, 1435px 1419px #fff, 245px 1293px #fff, 1001px 251px #fff, 1457px 189px #fff, 66px 671px #fff, 1391px 622px #fff, 102px 937px #fff, 697px 64px #fff, 1782px 1134px #fff, 1796px 234px #fff, 358px 1263px #fff, 668px 1467px #fff, 1356px 1229px #fff, 82px 644px #fff, 44px 880px #fff, 1456px 258px #fff, 701px 568px #fff, 724px 655px #fff, 863px 1498px #fff, 1595px 777px #fff, 1820px 99px #fff, 1372px 1891px #fff, 441px 598px #fff, 741px 442px #fff, 1646px 1227px #fff, 351px 1503px #fff, 578px 292px #fff, 481px 1182px #fff, 1210px 1837px #fff, 855px 1511px #fff, 911px 545px #fff, 131px 888px #fff, 257px 1274px #fff, 242px 1704px #fff, 225px 721px #fff, 1158px 384px #fff, 1847px 644px #fff, 414px 686px #fff, 1153px 1621px #fff, 600px 627px #fff, 634px 1435px #fff, 1823px 1155px #fff, 1140px 1324px #fff, 1265px 1912px #fff, 419px 887px #fff, 21px 446px #fff, 676px 104px #fff, 126px 949px #fff, 1689px 1232px #fff, 1597px 1891px #fff, 1901px 811px #fff, 542px 277px #fff, 703px 1573px #fff, 481px 421px #fff, 913px 295px #fff;
    height: 3px;
    width: 3px;
  }

  .particle-4 {
    -webkit-animation: animParticle 600s linear infinite;
    animation: animParticle 600s linear infinite;
    box-shadow: 272px 1252px #fff, 1091px 98px #fff, 1014px 936px #fff, 1521px 1289px #fff, 1748px 870px #fff, 427px 1825px #fff, 1203px 1400px #fff, 1727px 888px #fff, 1481px 1417px #fff, 120px 836px #fff, 102px 1023px #fff, 1336px 67px #fff, 1082px 398px #fff, 1015px 1850px #fff, 328px 801px #fff, 1790px 661px #fff, 533px 689px #fff, 987px 1838px #fff, 1541px 270px #fff, 1675px 1531px #fff, 79px 1323px #fff, 621px 733px #fff, 1449px 1652px #fff, 405px 94px #fff, 835px 935px #fff, 1334px 728px #fff, 1702px 1379px #fff, 592px 1882px #fff, 717px 1873px #fff, 209px 345px #fff, 147px 916px #fff, 445px 1723px #fff, 852px 936px #fff, 1493px 1607px #fff, 1427px 1345px #fff, 178px 927px #fff, 101px 1796px #fff, 552px 1430px #fff, 326px 956px #fff, 1517px 769px #fff, 637px 1185px #fff, 1641px 1552px #fff, 1186px 609px #fff, 410px 1256px #fff, 748px 77px #fff, 1547px 1749px #fff, 1029px 1550px #fff, 880px 793px #fff, 721px 1121px #fff, 1772px 1369px #fff, 1435px 36px #fff, 148px 498px #fff, 1636px 1264px #fff, 1399px 1693px #fff, 526px 215px #fff, 1184px 1919px #fff, 638px 925px #fff, 1084px 396px #fff, 1266px 1874px #fff, 1638px 1160px #fff, 1339px 1281px #fff, 328px 1240px #fff, 756px 1153px #fff, 396px 1325px #fff, 1442px 1372px #fff, 1554px 1196px #fff, 1495px 1661px #fff, 881px 761px #fff, 1561px 1610px #fff, 1619px 455px #fff, 791px 93px #fff, 263px 1570px #fff, 1157px 703px #fff, 1234px 656px #fff, 403px 1590px #fff, 1719px 698px #fff, 1832px 1356px #fff, 1065px 993px #fff, 680px 141px #fff, 831px 880px #fff, 503px 703px #fff, 610px 1286px #fff, 1800px 176px #fff, 1826px 189px #fff, 295px 795px #fff, 1833px 1025px #fff, 1841px 463px #fff, 1231px 1760px #fff, 1234px 932px #fff, 693px 173px #fff, 1752px 176px #fff, 708px 972px #fff, 424px 1722px #fff, 664px 1337px #fff, 1856px 1810px #fff, 1536px 1659px #fff, 847px 824px #fff, 1533px 539px #fff, 170px 1447px #fff, 495px 442px #fff, 1436px 688px #fff, 1423px 346px #fff, 442px 249px #fff, 1627px 1370px #fff, 192px 1739px #fff, 984px 1664px #fff, 341px 129px #fff, 1140px 1156px #fff, 44px 725px #fff, 1520px 1408px #fff, 999px 1390px #fff, 1259px 1132px #fff, 678px 748px #fff, 1880px 1360px #fff, 423px 1681px #fff, 1752px 722px #fff, 444px 375px #fff, 1016px 1322px #fff, 1531px 1870px #fff, 367px 874px #fff, 555px 481px #fff, 1836px 1611px #fff, 1773px 664px #fff, 847px 877px #fff, 575px 50px #fff, 1050px 105px #fff, 387px 1850px #fff, 738px 1307px #fff, 173px 265px #fff, 1568px 730px #fff, 235px 1638px #fff, 713px 1464px #fff, 458px 652px #fff, 536px 212px #fff, 556px 691px #fff, 315px 393px #fff, 1602px 1181px #fff, 190px 1803px #fff, 1656px 1133px #fff, 635px 325px #fff, 727px 1053px #fff, 1912px 852px #fff, 244px 1411px #fff, 1776px 18px #fff, 1694px 1617px #fff, 274px 942px #fff, 1148px 589px #fff, 632px 1487px #fff, 1215px 811px #fff, 109px 772px #fff, 640px 287px #fff, 1247px 484px #fff, 385px 1088px #fff, 994px 980px #fff, 558px 1754px #fff, 675px 322px #fff, 1168px 286px #fff, 747px 1259px #fff, 717px 1768px #fff, 192px 1222px #fff, 1149px 1552px #fff, 1252px 1800px #fff, 31px 1489px #fff, 1164px 1147px #fff, 1395px 1654px #fff, 229px 1832px #fff, 1117px 1708px #fff, 502px 35px #fff, 377px 1575px #fff, 27px 1256px #fff, 1187px 1185px #fff, 940px 659px #fff, 455px 745px #fff, 1238px 1154px #fff, 512px 1895px #fff, 932px 1559px #fff, 856px 1837px #fff, 667px 767px #fff, 1772px 861px #fff, 283px 1862px #fff, 934px 1234px #fff, 1722px 1193px #fff, 1414px 904px #fff, 41px 1512px #fff, 30px 329px #fff, 978px 1597px #fff, 1513px 1781px #fff, 1847px 718px #fff, 1381px 30px #fff, 1912px 78px #fff, 183px 391px #fff, 479px 632px #fff, 1770px 246px #fff, 1704px 1575px #fff, 1284px 1139px #fff, 1898px 349px #fff, 1623px 1802px #fff, 554px 483px #fff, 1128px 231px #fff, 1663px 1498px #fff, 1429px 1612px #fff, 793px 741px #fff, 1628px 600px #fff, 1798px 1100px #fff, 1641px 222px #fff, 1688px 1185px #fff, 528px 730px #fff, 1129px 1726px #fff, 738px 1404px #fff, 426px 701px #fff, 1021px 1675px #fff, 908px 414px #fff, 474px 1703px #fff, 446px 1279px #fff, 448px 1560px #fff, 1165px 1287px #fff, 1378px 1384px #fff, 1891px 1163px #fff, 1202px 1530px #fff, 292px 1440px #fff, 1051px 634px #fff, 362px 782px #fff, 1263px 145px #fff, 1718px 21px #fff, 1752px 1253px #fff, 318px 1525px #fff, 458px 1263px #fff, 703px 1572px #fff, 173px 1470px #fff, 613px 1728px #fff, 1188px 1298px #fff, 548px 1456px #fff, 274px 1148px #fff, 1636px 832px #fff, 1120px 1016px #fff, 410px 888px #fff, 956px 1512px #fff, 536px 1664px #fff, 214px 1643px #fff, 194px 912px #fff, 831px 1699px #fff, 668px 1531px #fff, 1053px 1104px #fff, 302px 302px #fff, 359px 605px #fff, 194px 1773px #fff, 994px 1387px #fff, 638px 1546px #fff, 187px 1828px #fff, 1708px 1901px #fff, 1359px 796px #fff, 1802px 888px #fff, 1417px 1603px #fff, 116px 977px #fff, 1656px 1205px #fff, 185px 126px #fff, 270px 1232px #fff, 1328px 1050px #fff, 1591px 1363px #fff, 423px 1726px #fff, 341px 1171px #fff, 1062px 1085px #fff, 277px 642px #fff, 1653px 1632px #fff, 845px 469px #fff, 1227px 412px #fff, 1601px 1139px #fff, 1506px 220px #fff, 1696px 1120px #fff, 663px 624px #fff, 241px 1289px #fff, 312px 1875px #fff, 653px 952px #fff, 835px 1103px #fff, 1024px 411px #fff, 1196px 502px #fff, 1879px 1560px #fff, 1150px 701px #fff, 172px 614px #fff, 1263px 1818px #fff, 437px 654px #fff, 300px 555px #fff, 1803px 650px #fff, 752px 1507px #fff, 1346px 1139px #fff, 492px 1576px #fff, 363px 1299px #fff, 1414px 1074px #fff, 724px 1334px #fff, 1618px 400px #fff, 144px 1593px #fff, 546px 289px #fff, 91px 1289px #fff, 82px 3px #fff, 1130px 1352px #fff, 511px 558px #fff, 443px 1648px #fff, 556px 1815px #fff, 16px 921px #fff, 1248px 863px #fff, 1517px 1022px #fff, 849px 1602px #fff, 844px 740px #fff, 1694px 775px #fff, 1155px 180px #fff, 411px 1376px #fff, 547px 1293px #fff, 772px 1274px #fff, 746px 887px #fff, 1217px 1660px #fff, 294px 1486px #fff, 1697px 1279px #fff, 401px 1743px #fff, 443px 1254px #fff, 1674px 465px #fff, 1150px 1505px #fff, 366px 1186px #fff, 1881px 471px #fff, 1514px 702px #fff, 135px 533px #fff, 603px 1602px #fff, 1568px 1395px #fff, 229px 1749px #fff, 1516px 1639px #fff, 1145px 455px #fff, 128px 1548px #fff, 1519px 1681px #fff, 554px 457px #fff, 422px 190px #fff, 1539px 1224px #fff, 854px 452px #fff, 97px 155px #fff, 944px 555px #fff, 1638px 169px #fff, 873px 1118px #fff, 480px 1856px #fff, 1370px 1376px #fff, 1163px 1483px #fff, 475px 236px #fff, 413px 123px #fff, 614px 248px #fff, 1092px 236px #fff, 850px 1827px #fff, 57px 1823px #fff, 1824px 1234px #fff, 1914px 808px #fff, 1523px 313px #fff, 322px 1550px #fff, 1474px 1565px #fff, 1583px 1718px #fff, 859px 1198px #fff, 214px 1467px #fff, 1694px 728px #fff, 28px 1770px #fff, 543px 954px #fff, 1726px 182px #fff, 1196px 1873px #fff, 432px 1454px #fff, 619px 1173px #fff, 501px 1340px #fff, 1454px 460px #fff, 1572px 1698px #fff, 1793px 1642px #fff, 1791px 1747px #fff, 1704px 1530px #fff, 135px 1295px #fff, 657px 1115px #fff, 756px 1271px #fff, 865px 702px #fff, 1900px 1602px #fff, 962px 70px #fff, 1344px 1128px #fff, 866px 140px #fff, 1570px 616px #fff, 1779px 669px #fff, 473px 1566px #fff, 1208px 1791px #fff, 845px 338px #fff, 685px 1528px #fff, 722px 372px #fff, 369px 1080px #fff, 1174px 20px #fff, 1700px 1892px #fff, 881px 860px #fff, 1290px 141px #fff, 1603px 1884px #fff, 913px 1827px #fff, 669px 551px #fff, 1440px 1163px #fff, 22px 1269px #fff, 1692px 824px #fff, 1301px 755px #fff, 1466px 1130px #fff, 1910px 1741px #fff, 1779px 1321px #fff, 1211px 217px #fff, 1568px 70px #fff, 31px 558px #fff, 1631px 1659px #fff, 545px 496px #fff;
    height: 1px;
    width: 1px;
  }

  .particle-4:after {
    box-shadow: 272px 1252px #fff, 1091px 98px #fff, 1014px 936px #fff, 1521px 1289px #fff, 1748px 870px #fff, 427px 1825px #fff, 1203px 1400px #fff, 1727px 888px #fff, 1481px 1417px #fff, 120px 836px #fff, 102px 1023px #fff, 1336px 67px #fff, 1082px 398px #fff, 1015px 1850px #fff, 328px 801px #fff, 1790px 661px #fff, 533px 689px #fff, 987px 1838px #fff, 1541px 270px #fff, 1675px 1531px #fff, 79px 1323px #fff, 621px 733px #fff, 1449px 1652px #fff, 405px 94px #fff, 835px 935px #fff, 1334px 728px #fff, 1702px 1379px #fff, 592px 1882px #fff, 717px 1873px #fff, 209px 345px #fff, 147px 916px #fff, 445px 1723px #fff, 852px 936px #fff, 1493px 1607px #fff, 1427px 1345px #fff, 178px 927px #fff, 101px 1796px #fff, 552px 1430px #fff, 326px 956px #fff, 1517px 769px #fff, 637px 1185px #fff, 1641px 1552px #fff, 1186px 609px #fff, 410px 1256px #fff, 748px 77px #fff, 1547px 1749px #fff, 1029px 1550px #fff, 880px 793px #fff, 721px 1121px #fff, 1772px 1369px #fff, 1435px 36px #fff, 148px 498px #fff, 1636px 1264px #fff, 1399px 1693px #fff, 526px 215px #fff, 1184px 1919px #fff, 638px 925px #fff, 1084px 396px #fff, 1266px 1874px #fff, 1638px 1160px #fff, 1339px 1281px #fff, 328px 1240px #fff, 756px 1153px #fff, 396px 1325px #fff, 1442px 1372px #fff, 1554px 1196px #fff, 1495px 1661px #fff, 881px 761px #fff, 1561px 1610px #fff, 1619px 455px #fff, 791px 93px #fff, 263px 1570px #fff, 1157px 703px #fff, 1234px 656px #fff, 403px 1590px #fff, 1719px 698px #fff, 1832px 1356px #fff, 1065px 993px #fff, 680px 141px #fff, 831px 880px #fff, 503px 703px #fff, 610px 1286px #fff, 1800px 176px #fff, 1826px 189px #fff, 295px 795px #fff, 1833px 1025px #fff, 1841px 463px #fff, 1231px 1760px #fff, 1234px 932px #fff, 693px 173px #fff, 1752px 176px #fff, 708px 972px #fff, 424px 1722px #fff, 664px 1337px #fff, 1856px 1810px #fff, 1536px 1659px #fff, 847px 824px #fff, 1533px 539px #fff, 170px 1447px #fff, 495px 442px #fff, 1436px 688px #fff, 1423px 346px #fff, 442px 249px #fff, 1627px 1370px #fff, 192px 1739px #fff, 984px 1664px #fff, 341px 129px #fff, 1140px 1156px #fff, 44px 725px #fff, 1520px 1408px #fff, 999px 1390px #fff, 1259px 1132px #fff, 678px 748px #fff, 1880px 1360px #fff, 423px 1681px #fff, 1752px 722px #fff, 444px 375px #fff, 1016px 1322px #fff, 1531px 1870px #fff, 367px 874px #fff, 555px 481px #fff, 1836px 1611px #fff, 1773px 664px #fff, 847px 877px #fff, 575px 50px #fff, 1050px 105px #fff, 387px 1850px #fff, 738px 1307px #fff, 173px 265px #fff, 1568px 730px #fff, 235px 1638px #fff, 713px 1464px #fff, 458px 652px #fff, 536px 212px #fff, 556px 691px #fff, 315px 393px #fff, 1602px 1181px #fff, 190px 1803px #fff, 1656px 1133px #fff, 635px 325px #fff, 727px 1053px #fff, 1912px 852px #fff, 244px 1411px #fff, 1776px 18px #fff, 1694px 1617px #fff, 274px 942px #fff, 1148px 589px #fff, 632px 1487px #fff, 1215px 811px #fff, 109px 772px #fff, 640px 287px #fff, 1247px 484px #fff, 385px 1088px #fff, 994px 980px #fff, 558px 1754px #fff, 675px 322px #fff, 1168px 286px #fff, 747px 1259px #fff, 717px 1768px #fff, 192px 1222px #fff, 1149px 1552px #fff, 1252px 1800px #fff, 31px 1489px #fff, 1164px 1147px #fff, 1395px 1654px #fff, 229px 1832px #fff, 1117px 1708px #fff, 502px 35px #fff, 377px 1575px #fff, 27px 1256px #fff, 1187px 1185px #fff, 940px 659px #fff, 455px 745px #fff, 1238px 1154px #fff, 512px 1895px #fff, 932px 1559px #fff, 856px 1837px #fff, 667px 767px #fff, 1772px 861px #fff, 283px 1862px #fff, 934px 1234px #fff, 1722px 1193px #fff, 1414px 904px #fff, 41px 1512px #fff, 30px 329px #fff, 978px 1597px #fff, 1513px 1781px #fff, 1847px 718px #fff, 1381px 30px #fff, 1912px 78px #fff, 183px 391px #fff, 479px 632px #fff, 1770px 246px #fff, 1704px 1575px #fff, 1284px 1139px #fff, 1898px 349px #fff, 1623px 1802px #fff, 554px 483px #fff, 1128px 231px #fff, 1663px 1498px #fff, 1429px 1612px #fff, 793px 741px #fff, 1628px 600px #fff, 1798px 1100px #fff, 1641px 222px #fff, 1688px 1185px #fff, 528px 730px #fff, 1129px 1726px #fff, 738px 1404px #fff, 426px 701px #fff, 1021px 1675px #fff, 908px 414px #fff, 474px 1703px #fff, 446px 1279px #fff, 448px 1560px #fff, 1165px 1287px #fff, 1378px 1384px #fff, 1891px 1163px #fff, 1202px 1530px #fff, 292px 1440px #fff, 1051px 634px #fff, 362px 782px #fff, 1263px 145px #fff, 1718px 21px #fff, 1752px 1253px #fff, 318px 1525px #fff, 458px 1263px #fff, 703px 1572px #fff, 173px 1470px #fff, 613px 1728px #fff, 1188px 1298px #fff, 548px 1456px #fff, 274px 1148px #fff, 1636px 832px #fff, 1120px 1016px #fff, 410px 888px #fff, 956px 1512px #fff, 536px 1664px #fff, 214px 1643px #fff, 194px 912px #fff, 831px 1699px #fff, 668px 1531px #fff, 1053px 1104px #fff, 302px 302px #fff, 359px 605px #fff, 194px 1773px #fff, 994px 1387px #fff, 638px 1546px #fff, 187px 1828px #fff, 1708px 1901px #fff, 1359px 796px #fff, 1802px 888px #fff, 1417px 1603px #fff, 116px 977px #fff, 1656px 1205px #fff, 185px 126px #fff, 270px 1232px #fff, 1328px 1050px #fff, 1591px 1363px #fff, 423px 1726px #fff, 341px 1171px #fff, 1062px 1085px #fff, 277px 642px #fff, 1653px 1632px #fff, 845px 469px #fff, 1227px 412px #fff, 1601px 1139px #fff, 1506px 220px #fff, 1696px 1120px #fff, 663px 624px #fff, 241px 1289px #fff, 312px 1875px #fff, 653px 952px #fff, 835px 1103px #fff, 1024px 411px #fff, 1196px 502px #fff, 1879px 1560px #fff, 1150px 701px #fff, 172px 614px #fff, 1263px 1818px #fff, 437px 654px #fff, 300px 555px #fff, 1803px 650px #fff, 752px 1507px #fff, 1346px 1139px #fff, 492px 1576px #fff, 363px 1299px #fff, 1414px 1074px #fff, 724px 1334px #fff, 1618px 400px #fff, 144px 1593px #fff, 546px 289px #fff, 91px 1289px #fff, 82px 3px #fff, 1130px 1352px #fff, 511px 558px #fff, 443px 1648px #fff, 556px 1815px #fff, 16px 921px #fff, 1248px 863px #fff, 1517px 1022px #fff, 849px 1602px #fff, 844px 740px #fff, 1694px 775px #fff, 1155px 180px #fff, 411px 1376px #fff, 547px 1293px #fff, 772px 1274px #fff, 746px 887px #fff, 1217px 1660px #fff, 294px 1486px #fff, 1697px 1279px #fff, 401px 1743px #fff, 443px 1254px #fff, 1674px 465px #fff, 1150px 1505px #fff, 366px 1186px #fff, 1881px 471px #fff, 1514px 702px #fff, 135px 533px #fff, 603px 1602px #fff, 1568px 1395px #fff, 229px 1749px #fff, 1516px 1639px #fff, 1145px 455px #fff, 128px 1548px #fff, 1519px 1681px #fff, 554px 457px #fff, 422px 190px #fff, 1539px 1224px #fff, 854px 452px #fff, 97px 155px #fff, 944px 555px #fff, 1638px 169px #fff, 873px 1118px #fff, 480px 1856px #fff, 1370px 1376px #fff, 1163px 1483px #fff, 475px 236px #fff, 413px 123px #fff, 614px 248px #fff, 1092px 236px #fff, 850px 1827px #fff, 57px 1823px #fff, 1824px 1234px #fff, 1914px 808px #fff, 1523px 313px #fff, 322px 1550px #fff, 1474px 1565px #fff, 1583px 1718px #fff, 859px 1198px #fff, 214px 1467px #fff, 1694px 728px #fff, 28px 1770px #fff, 543px 954px #fff, 1726px 182px #fff, 1196px 1873px #fff, 432px 1454px #fff, 619px 1173px #fff, 501px 1340px #fff, 1454px 460px #fff, 1572px 1698px #fff, 1793px 1642px #fff, 1791px 1747px #fff, 1704px 1530px #fff, 135px 1295px #fff, 657px 1115px #fff, 756px 1271px #fff, 865px 702px #fff, 1900px 1602px #fff, 962px 70px #fff, 1344px 1128px #fff, 866px 140px #fff, 1570px 616px #fff, 1779px 669px #fff, 473px 1566px #fff, 1208px 1791px #fff, 845px 338px #fff, 685px 1528px #fff, 722px 372px #fff, 369px 1080px #fff, 1174px 20px #fff, 1700px 1892px #fff, 881px 860px #fff, 1290px 141px #fff, 1603px 1884px #fff, 913px 1827px #fff, 669px 551px #fff, 1440px 1163px #fff, 22px 1269px #fff, 1692px 824px #fff, 1301px 755px #fff, 1466px 1130px #fff, 1910px 1741px #fff, 1779px 1321px #fff, 1211px 217px #fff, 1568px 70px #fff, 31px 558px #fff, 1631px 1659px #fff, 545px 496px #fff;
    height: 1px;
    width: 1px;
  }

  @-webkit-keyframes animParticle {
    from {
      -webkit-transform: translateY(0px);
      transform: translateY(0px);
    }

    to {
      -webkit-transform: translateY(-1920px);
      transform: translateY(-1920px);
    }
  }

  @keyframes animParticle {
    from {
      -webkit-transform: translateY(0px);
      transform: translateY(0px);
    }

    to {
      -webkit-transform: translateY(-1920px);
      transform: translateY(-1920px);
    }
  }




  /*整体样式 */
  .index {
    width: 100%;
    height: 100vh;
    position: relative;

    .custom-tabbar-page {
      // width: 100%;
      height: calc(100vh - 10rpx);
      box-sizing: border-box;
      padding-bottom: 30rpx;
      padding-bottom: calc(30rpx + constant(safe-area-inset-bottom));
      padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
    }


    /* 底部导航 statr */
    .tabbar {
      width: 100%;
      height: 110rpx;
      height: calc(110rpx + constant(safe-area-inset-bottom));
      height: calc(110rpx + env(safe-area-inset-bottom));
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: transparent;
      z-index: 998;

      &__bg {
        position: absolute;
        width: 100%;
        height: 100%;
        bottom: 0;
        left: 0;
        background-color: #302F36;
        -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 61.5'%3E%3Cpath d='M100 0H0c32.9 0 49.3 61.5 100 61.5S167.1 0 200 0H100z'/%3E%3C/svg%3E"), linear-gradient(#000, #000);
        -webkit-mask-size: auto 64rpx, cover;
        -webkit-mask-repeat: no-repeat;
        -webkit-mask-composite: xor;
        /*只显示不重合的地方， chorem 、safari 支持*/
        z-index: -1;
        transition: 0.5s;
      }

      &__list {
        position: absolute;
        z-index: 999;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      &__item {
        height: 100%;
        width: 100%;
        flex: 1;
        text-align: center;
        font-size: 28rpx;
        position: relative;

        &--active {
          .tabbar__item__icon {
            top: -33rpx;
            color: #16151C;
          }

          .tabbar__item__image {
            top: -33rpx;
          }

          .tabbar__item__text {
            opacity: 1;
            color: #FFFFFFE6;
          }
        }

        &__icon {
          font-size: 56rpx;
          position: absolute;
          left: 0;
          right: 0;
          top: 20rpx;
          transition: 0.5s;
          color: #989ba3;
        }

        &__image {
          width: 58rpx;
          height: 58rpx;
          position: absolute;
          left: 0;
          right: 0;
          top: 20rpx;
          transition: 0.5s;
          margin: 0 auto;
        }

        &__text {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 10rpx;
          bottom: calc(10rpx + constant(safe-area-inset-bottom));
          bottom: calc(10rpx + env(safe-area-inset-bottom));
          transition: 0.5s;
          opacity: 0;
        }
      }

      &__select-active-bg {
        position: absolute;
        width: 100rpx;
        height: 100rpx;
        border-radius: 50%;
        background-color: #FFFFFFF2;
        // transition: 0.5s;
        z-index: -1;
        // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.05);
        // box-shadow: inset 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.05);
        box-shadow: 0rpx 10rpx 30rpx rgba(70,23,129, 0.07),
          0rpx -8rpx 40rpx rgba(255, 255, 255, 0.07),
          inset 0rpx -10rpx 10rpx rgba(70,23,129, 0.07),
          inset 0rpx 10rpx 20rpx rgba(255, 255, 255, 1);
        transition: box-shadow .2s ease-out;

        &--hide {
          top: calc(110rpx + 50rpx);
        }

        &--show {
          top: -54rpx;
        }
      }
    }

    /* 底部导航 end */


    /* 移动背景部分 start*/
    .bg-contaniner {
      position: fixed;
      top: -0rpx;
      left: -300rpx;
      --text-color: hsl(0 95% 60%);
      --bg-color: #16171D;
      --bg-size: 200px;
      height: 100%;
      display: grid;
      place-items: center;
      place-content: center;
      overflow: hidden;
      background-color: var(--bg-color);
      z-index: -1;
    }

    .bg-contaniner::before {
      --size: 150vmax;
      content: "";
      inline-size: var(--size);
      block-size: var(--size);
      background-image: url("https://cdn.nlark.com/yuque/0/2022/png/280373/1663568736856-assets/web-upload/97cab67d-6f17-4c6e-a3f9-ac81961d571a.png");
      background-size: var(--bg-size);
      background-repeat: repeat;
      transform: rotate(45deg);
      opacity: 0.1;
      animation: bg 6s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .bg-contaniner::before {
        animation-duration: 0s;
      }
    }

    @keyframes bg {
      to {
        background-position: 0 calc(var(--bg-size) * -1);
      }
    }

    /* 移动背景部分 end*/
  }
</style>