<template>
  <mci-page-shell class="stats-page" :style="mciTokenStyle" title="经营统计" :subtitle="`${periodLabel}经营概览`" @back="goBack">
    <template #right><view class="refresh-action" hover-class="refresh-action--pressed" @tap="loadStats(true)"><text>↻</text></view></template>
    <scroll-view class="stats-scroll" scroll-y>
      <scroll-view class="period-scroll" scroll-x :show-scrollbar="false"><view class="period-row"><view v-for="item in periods" :key="item.value" class="period-chip" :class="{active:period===item.value}" @tap="changePeriod(item.value)">{{ item.label }}</view></view></scroll-view>
      <view v-if="period==='custom'" class="custom-range"><picker mode="date" :value="customStart" @change="customStart=$event.detail.value"><view>{{ customStart||'开始日期' }}</view></picker><text>至</text><picker mode="date" :value="customEnd" @change="customEnd=$event.detail.value"><view>{{ customEnd||'结束日期' }}</view></picker><view @tap="applyCustom"><text>统计</text></view></view>
      <mci-skeleton v-if="loading" type="detail" :rows="9" />
      <template v-else>
        <view class="headline-band"><image :src="xjyAssets.waterHero" mode="aspectFill" /><view class="headline-band__shade"></view><view class="headline-band__content"><text>{{ periodLabel }}订单金额</text><text>{{ money(metrics.orderAmount) }}</text><view><text>合同 {{ metrics.orders }} 份</text><text>客户 {{ metrics.customers }} 个</text><text>跟进 {{ metrics.visits }} 条</text></view></view></view>

        <view class="metric-grid">
          <view v-for="(item,index) in metricCards" :key="item.key" class="metric-item mci-fade-up" :style="{animationDelay:`${index*40}ms`}"><view class="metric-item__icon" :class="`tone-${item.tone}`"><image :src="item.icon" mode="aspectFit" /></view><view><text class="metric-item__value">{{ item.value }}</text><text class="metric-item__label">{{ periodLabel }}{{ item.label }}</text></view></view>
        </view>

        <view class="chart-band">
          <view class="chart-heading"><view><text>业务活跃度</text><text>{{ periodLabel }}新增与发生量对比</text></view><text>数量</text></view>
          <view class="bar-chart"><view v-for="item in activityBars" :key="item.label" class="bar-row"><text>{{ item.label }}</text><view class="bar-track"><view :style="{width:`${item.percent}%`,background:item.color}"></view></view><text>{{ item.value }}</text></view></view>
        </view>

        <view class="chart-band">
          <view class="chart-heading"><view><text>售后类型分布</text><text>{{ periodLabel }}任务共 {{ metrics.tasks }} 个</text></view><text>任务</text></view>
          <view v-if="taskTypeRows.length" class="distribution"><view class="donut" :style="donutStyle"><view><text>{{ metrics.tasks }}</text><text>总任务</text></view></view><view class="legend"><view v-for="(item,index) in taskTypeRows" :key="item.name"><view :style="{background:chartColors[index%chartColors.length]}"></view><text>{{ item.name }}</text><text>{{ item.value }}</text><text>{{ item.percent }}%</text></view></view></view>
          <view v-else class="chart-empty"><text>当前时间范围内暂无售后任务</text></view>
        </view>

        <view class="chart-band">
          <view class="chart-heading"><view><text>管理关注</text><text>需要持续跟进的关键业务</text></view><text>实时</text></view>
          <view class="attention-list"><view v-for="item in attentionRows" :key="item.label" @tap="openMetric(item)"><view class="attention-mark" :class="`tone-${item.tone}`"><text>{{ item.value }}</text></view><view><text>{{ item.label }}</text><text>{{ item.desc }}</text></view><text>›</text></view></view>
        </view>
        <view class="safe-space"></view>
      </template>
    </scroll-view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getBusinessModule } from '@/platform/business.js'
import { formatMoney, loadModuleRows } from '@/platform/business-runtime.js'
import { TASK_PERIODS, loadTaskCounts, loadTaskStateCounts, loadTasks } from '@/utils/xjy-task.js'

export default {
  mixins:[themeMixin],
  data(){return{period:'month',customStart:'',customEnd:'',loading:true,metrics:{customers:0,orders:0,orderAmount:0,visits:0,tasks:0,devices:0,opportunities:0},taskTypes:{},taskStates:{},periods:TASK_PERIODS,chartColors:['#087DA8','#18A6B8','#E54625','#1C8B65','#7556C8','#D99B1F','#4D6F7C']}},
  computed:{
    periodLabel(){return(this.periods.find((item)=>item.value===this.period)||{}).label||'本月'},
    customRange(){return this.customStart&&this.customEnd?[`${this.customStart} 00:00:00`,`${this.customEnd} 23:59:59`]:null},
    metricCards(){return[
      {key:'customers',label:'新增客户',value:this.metrics.customers,icon:'/static/xjy/business/kehu.png',tone:'blue'},
      {key:'orders',label:'合同订单',value:this.metrics.orders,icon:'/static/xjy/business/dingdan.png',tone:'orange'},
      {key:'visits',label:'跟进记录',value:this.metrics.visits,icon:'/static/xjy/business/baifang.png',tone:'green'},
      {key:'tasks',label:'售后任务',value:this.metrics.tasks,icon:'/static/xjy/repair/renwu.png',tone:'violet'},
      {key:'opportunities',label:'新增商机',value:this.metrics.opportunities,icon:'/static/xjy/business/shouyi.png',tone:'gold'},
      {key:'devices',label:'新增设备',value:this.metrics.devices,icon:'/static/xjy/business/shebei.png',tone:'cyan'}]},
    activityBars(){const rows=[['客户',this.metrics.customers,'#087DA8'],['订单',this.metrics.orders,'#E54625'],['跟进',this.metrics.visits,'#1C8B65'],['售后',this.metrics.tasks,'#7556C8'],['商机',this.metrics.opportunities,'#D99B1F']];const max=Math.max(1,...rows.map((item)=>item[1]));return rows.map((item)=>({label:item[0],value:item[1],color:item[2],percent:Math.max(item[1]?6:0,Math.round(item[1]/max*100))}))},
    taskTypeRows(){const entries=Object.keys(this.taskTypes).map((name)=>({name,value:Number(this.taskTypes[name]||0)})).filter((item)=>item.value>0).sort((a,b)=>b.value-a.value).slice(0,7);const total=Math.max(1,entries.reduce((sum,item)=>sum+item.value,0));return entries.map((item)=>({...item,percent:Math.round(item.value/total*100)}))},
    donutStyle(){if(!this.taskTypeRows.length)return{};let start=0;const parts=this.taskTypeRows.map((item,index)=>{const end=start+item.percent;const part=`${this.chartColors[index%this.chartColors.length]} ${start}% ${end}%`;start=end;return part});if(start<100)parts.push(`#e7eef1 ${start}% 100%`);return{background:`conic-gradient(${parts.join(',')})`}},
    attentionRows(){return[
      {label:'待接单任务',desc:'及时领取，避免客户等待',value:Number(this.taskStates.pending||0),tone:'orange',route:'tasks',state:'待接单'},
      {label:'待服务任务',desc:'关注计划时间与上门进度',value:Number(this.taskStates.TodoCount||0),tone:'blue',route:'tasks',state:'待服务'},
      {label:'待商家验收',desc:'核对照片、设备与服务结果',value:Number(this.taskStates.acceptance||0),tone:'violet',route:'tasks',state:'待商家验收'},
      {label:'待客户验收',desc:'主动提醒客户确认服务',value:Number(this.taskStates.cacceptance||0),tone:'green',route:'tasks',state:'待客户验收'}]},
  },
  onLoad(){this.loadStats()},
  methods:{
    money:formatMoney,
    async loadStats(refresh=false){this.loading=true;const common={pageIndex:1,pageSize:1,period:this.period,customRange:this.customRange,refresh};try{const modules=['customers','orders','visits','devices','opportunities'];const promises=modules.map((key)=>loadModuleRows(getBusinessModule(key),common));const taskFilters={...common,dateField:'YujiSHSJ',mineOnly:false};const [rows,taskResult,types,states]=await Promise.all([Promise.all(promises),loadTasks(taskFilters),loadTaskCounts(taskFilters),loadTaskStateCounts(taskFilters)]);modules.forEach((key,index)=>{this.metrics[key]=rows[index].count});this.metrics.tasks=taskResult.count;const orderStats=rows[1].append&&rows[1].append.StatisticsFields;this.metrics.orderAmount=Number(orderStats&&(orderStats.DingdanJE??orderStats.dingdanje)||0);this.taskTypes=types;this.taskStates=states}catch(error){uni.showToast({title:error.message||'统计加载失败',icon:'none'})}finally{this.loading=false}},
    changePeriod(value){this.period=value;if(value!=='custom')this.loadStats(true)},
    applyCustom(){if(!this.customRange)return uni.showToast({title:'请选择完整时间范围',icon:'none'});if(this.customStart>this.customEnd)return uni.showToast({title:'开始日期不能晚于结束日期',icon:'none'});this.loadStats(true)},
    openMetric(item){if(item.route==='tasks')uni.navigateTo({url:`/pages/task/list?state=${encodeURIComponent(item.state||'')}`})},
    goBack(){uni.navigateBack({fail:()=>uni.switchTab({url:'/pages/workspace/index'})})}
  }
}
</script>

<style scoped>
.stats-page{height:100vh;overflow:hidden}.refresh-action{width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#087da8;font-size:37rpx;transition:transform .18s ease}.refresh-action--pressed{transform:rotate(90deg)}.stats-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx)}.period-scroll{width:100%;border-bottom:1px solid #e3ebee;background:#fff;white-space:nowrap}.period-row{display:inline-flex;gap:10rpx;padding:14rpx 22rpx}.period-chip{height:54rpx;padding:0 20rpx;border-radius:6px;color:#617a84;background:#f0f5f7;font-size:21rpx;line-height:54rpx}.period-chip.active{color:#fff;background:#087da8}.custom-range{display:grid;grid-template-columns:1fr 34rpx 1fr 88rpx;gap:8rpx;align-items:center;padding:14rpx 22rpx;border-bottom:1px solid #e3ebee;background:#fff}.custom-range picker>view{height:66rpx;border:1px solid #dce7eb;border-radius:7px;color:#45636e;background:#f6f9fa;font-size:21rpx;line-height:66rpx;text-align:center}.custom-range>text{color:#87989f;font-size:20rpx;text-align:center}.custom-range>view{height:66rpx;border-radius:7px;color:#fff;background:#e54625;font-size:21rpx;line-height:66rpx;text-align:center}.headline-band{position:relative;min-height:232rpx;overflow:hidden;padding:29rpx 27rpx;color:#fff;background:#063b5c;box-sizing:border-box}.headline-band>image,.headline-band__shade{position:absolute;inset:0;width:100%;height:100%}.headline-band>image{opacity:.52}.headline-band__shade{background:linear-gradient(100deg,rgba(4,48,70,.96),rgba(4,94,120,.64))}.headline-band__content{position:relative;z-index:1}.headline-band__content>text{display:block}.headline-band__content>text:first-child{color:rgba(255,255,255,.72);font-size:22rpx}.headline-band__content>text:nth-child(2){margin-top:8rpx;font-size:48rpx;font-weight:780}.headline-band__content>view{display:flex;gap:26rpx;margin-top:21rpx;color:rgba(255,255,255,.74);font-size:20rpx}.metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;margin-top:14rpx;background:#e6edef}.metric-item{min-height:126rpx;display:grid;grid-template-columns:58rpx minmax(0,1fr);gap:14rpx;align-items:center;padding:17rpx 21rpx;background:#fff;box-sizing:border-box}.metric-item__icon{width:54rpx;height:54rpx;padding:9rpx;border-radius:8px;background:#eaf6f9;box-sizing:border-box}.metric-item__icon image{width:100%;height:100%}.metric-item__icon.tone-orange{background:#fff0e9}.metric-item__icon.tone-green{background:#eaf7f1}.metric-item__icon.tone-violet{background:#f2edfa}.metric-item__icon.tone-gold{background:#fff5df}.metric-item__icon.tone-cyan{background:#e9f8f8}.metric-item__value,.metric-item__label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.metric-item__value{color:#244954;font-size:31rpx;font-weight:770}.metric-item__label{margin-top:4rpx;color:#82959d;font-size:19rpx}.chart-band{margin-top:14rpx;padding:0 24rpx 24rpx;background:#fff}.chart-heading{min-height:88rpx;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf2f4}.chart-heading>view text{display:block}.chart-heading>view text:first-child{color:#244954;font-size:27rpx;font-weight:720}.chart-heading>view text:last-child{margin-top:4rpx;color:#8a9ba2;font-size:19rpx}.chart-heading>text{padding:6rpx 10rpx;border-radius:5px;color:#087da8;background:#eaf6f9;font-size:18rpx}.bar-chart{padding-top:20rpx}.bar-row{height:55rpx;display:grid;grid-template-columns:70rpx minmax(0,1fr) 60rpx;gap:13rpx;align-items:center}.bar-row>text{color:#607a84;font-size:20rpx}.bar-row>text:last-child{color:#294b57;font-weight:650;text-align:right}.bar-track{height:20rpx;border-radius:4rpx;overflow:hidden;background:#edf2f4}.bar-track>view{height:100%;border-radius:4rpx;transition:width .35s ease}.distribution{display:grid;grid-template-columns:210rpx minmax(0,1fr);gap:24rpx;align-items:center;padding-top:24rpx}.donut{width:190rpx;height:190rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e7eef1}.donut>view{width:112rpx;height:112rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:#fff}.donut text{display:block}.donut text:first-child{color:#294b57;font-size:29rpx;font-weight:750}.donut text:last-child{margin-top:3rpx;color:#899ba2;font-size:18rpx}.legend>view{min-height:37rpx;display:grid;grid-template-columns:15rpx minmax(0,1fr) 44rpx 58rpx;gap:8rpx;align-items:center}.legend>view>view{width:13rpx;height:13rpx;border-radius:3rpx}.legend text{color:#617a84;font-size:18rpx;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.legend text:nth-child(3){color:#294b57;font-weight:650;text-align:right}.legend text:last-child{color:#8a9ba2;text-align:right}.chart-empty{height:150rpx;color:#899ba2;font-size:21rpx;line-height:150rpx;text-align:center}.attention-list>view{min-height:92rpx;display:grid;grid-template-columns:58rpx minmax(0,1fr) 25rpx;gap:14rpx;align-items:center;border-bottom:1px solid #edf2f4}.attention-list>view:last-child{border-bottom:none}.attention-mark{width:52rpx;height:52rpx;border-radius:8px;color:#b46816;background:#fff1df;font-size:23rpx;font-weight:750;line-height:52rpx;text-align:center}.attention-mark.tone-blue{color:#087da8;background:#eaf6f9}.attention-mark.tone-violet{color:#6d4ba5;background:#f2edfa}.attention-mark.tone-green{color:#147351;background:#e9f7f1}.attention-list>view>view:nth-child(2) text{display:block}.attention-list>view>view:nth-child(2) text:first-child{color:#294b57;font-size:23rpx;font-weight:650}.attention-list>view>view:nth-child(2) text:last-child{margin-top:4rpx;color:#899ba2;font-size:19rpx}.attention-list>view>text{color:#9babb1;font-size:30rpx}.safe-space{height:35rpx}@media(prefers-reduced-motion:reduce){.bar-track>view,.refresh-action{transition:none}}
</style>
