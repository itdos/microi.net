<template>
  <mci-page-shell class="scan-page" :style="mciTokenStyle" title="扫码做任务" subtitle="识别设备并进入最近任务" @back="goBack">
    <template #right><view class="scan-action" hover-class="scan-action--pressed" @tap="scan"><image :src="xjyAssets.scan" mode="aspectFit" /></view></template>
    <view class="device-code-band"><view class="code-input"><text>设备</text><input v-model="deviceId" confirm-type="search" placeholder="扫描设备码或输入设备 Id" @input="scheduleSearch" @confirm="search" /><view @tap="resetSearch"><text>重置</text></view></view></view>
    <mci-skeleton v-if="loading" type="list" :rows="5" />
    <scroll-view v-else class="task-scroll" scroll-y>
      <view v-if="tasks.length" class="task-list">
        <view v-for="(item,index) in tasks" :key="item.AID || index" class="task-card mci-fade-up" :style="{animationDelay:`${Math.min(index,6)*40}ms`}">
          <view class="task-card__top"><view class="index-mark"><text>{{ index+1 }}</text></view><view class="task-heading"><text>{{ item.KehuMC || item.ShebeiMC || '售后任务' }}</text><text>{{ item.ShouhouFWBH || '暂无任务编号' }}</text></view><text class="status-pill" :class="taskStateClass(item.Zhuangtai)">{{ item.Zhuangtai }}</text></view>
          <view class="device-info"><view><text>设备名称</text><text>{{ item.ShebeiMC || '-' }}</text></view><view><text>设备编号</text><text>{{ item.ShebeiBH || '-' }}</text></view><view><text>设备型号</text><text>{{ item.ShebeiXH || '-' }}</text></view><view><text>安装位置</text><text>{{ item.AnzhuangWZ || '-' }}</text></view><view><text>计划服务</text><text>{{ formatTime(item.YujiSHSJ) || '-' }}</text></view><view><text>服务人员</text><text>{{ item.ShouhouRY || '待领取' }}</text></view></view>
          <view class="task-card__bottom"><view class="type-tag"><text>{{ item.Leixing || '服务' }}</text></view><view class="card-actions"><view v-if="item.ShouhouRYDH" @tap="callPhone(item.ShouhouRYDH)"><text>联系人员</text></view><view @tap="openDevice(item)"><text>处理设备</text></view><view v-if="item.Zhuangtai === '待服务'" class="finish-action" @tap="finishTask(item)"><text>提交任务</text></view></view></view>
        </view>
      </view>
      <view v-else class="empty-state"><image :src="xjyAssets.scan" mode="aspectFit" /><text>{{ deviceId ? '该设备近期没有售后任务' : '请扫描设备二维码' }}</text><text>查询范围为本月以来最近 15 个任务</text><view @tap="scan"><text>开始扫码</text></view></view>
      <view class="safe-space"></view>
    </scroll-view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser } from '@/utils/request.js'
import { callApiEngine, formatDateTime, parseDeviceId } from '@/platform/business-runtime.js'
import { taskStateClass } from '@/utils/xjy-task.js'

export default {
  mixins:[themeMixin],
  data(){return{deviceId:'',tasks:[],loading:false,submitting:false,currentUser:{},searchTimer:null,loadRequestId:0}},
  onLoad(options){this.currentUser=getUser()||{};this.deviceId=decodeURIComponent(options.deviceId||'');if(this.deviceId)this.loadTasks()},
  onUnload(){clearTimeout(this.searchTimer)},
  methods:{
    taskStateClass,formatTime:formatDateTime,
    search(){clearTimeout(this.searchTimer);this.loadTasks()},
    // zhy：设备编号输入后自动防抖查询，右侧按钮重置编号和结果。
    scheduleSearch(){
      clearTimeout(this.searchTimer)
      if(!this.deviceId.trim()){this.tasks=[];this.loading=false;this.loadRequestId+=1;return}
      this.searchTimer=setTimeout(()=>this.loadTasks(),350)
    },
    resetSearch(){clearTimeout(this.searchTimer);this.deviceId='';this.tasks=[];this.loading=false;this.loadRequestId+=1},
    scan(){uni.scanCode({onlyFromCamera:false,success:(result)=>{const id=parseDeviceId(result.result)||String(result.result||'').trim();if(!id)return uni.showToast({title:'未识别有效设备编号',icon:'none'});this.deviceId=id;this.loadTasks()},fail:(error)=>{if(!(error&&error.errMsg&&error.errMsg.includes('cancel')))uni.showToast({title:'扫码失败，请重试',icon:'none'})}})},
    async loadTasks(){if(!this.deviceId.trim())return;const requestId=++this.loadRequestId;this.loading=true;try{const result=await callApiEngine('getrenwu-by-shebeiid',{Id:this.deviceId.trim()});if(result&&Number(result.Code)===0)throw new Error(result.Msg||'任务查询失败');const rows=Array.isArray(result)?result:(result&&Array.isArray(result.Data)?result.Data:[]);if(requestId===this.loadRequestId)this.tasks=rows}catch(error){if(requestId===this.loadRequestId){this.tasks=[];uni.showToast({title:error.message||'任务查询失败',icon:'none'})}}finally{if(requestId===this.loadRequestId)this.loading=false}},
    async openDevice(item){if(this.submitting)return;this.submitting=true;uni.showLoading({title:'正在进入',mask:true});try{if(item.Zhuangtai==='待接单'){const result=await callApiEngine('automatic-order\u200c',{Id:item.BID});if(!result||Number(result.Code)!==1)throw new Error((result&&result.Msg)||'自动接单失败')}uni.navigateTo({url:`/pages/task/device?id=${encodeURIComponent(item.AID)}&taskId=${encodeURIComponent(item.BID)}&taskType=${encodeURIComponent(item.Leixing||'')}`})}catch(error){uni.showToast({title:error.message||'无法进入设备任务',icon:'none'})}finally{uni.hideLoading();this.submitting=false}},
    async finishTask(item){if(this.submitting)return;if(String(this.currentUser.Id||'')!==String(item.ShouhouRYID||'')){uni.showToast({title:'仅当前服务人员可提交任务',icon:'none'});return}const confirmed=await new Promise((resolve)=>uni.showModal({title:'确认提交任务',content:'系统会检查此任务下所有设备是否已完成。',success:(r)=>resolve(!!r.confirm),fail:()=>resolve(false)}));if(!confirmed)return;this.submitting=true;uni.showLoading({title:'正在检查',mask:true});try{const result=await callApiEngine('scan-code-tasks',{shouhouspId:item.AID,ShouhouDDId:item.BID});if(!result||Number(result.Code)!==1)throw new Error((result&&result.Msg)||'任务提交失败');uni.showToast({title:'任务已提交',icon:'success'});await this.loadTasks()}catch(error){uni.showToast({title:error.message||'任务提交失败',icon:'none'})}finally{uni.hideLoading();this.submitting=false}},
    callPhone(phone){uni.makePhoneCall({phoneNumber:String(phone)})},goBack(){uni.navigateBack({fail:()=>uni.switchTab({url:'/pages/workspace/index'})})}
  }
}
</script>

<style scoped>
.scan-page{height:100vh;overflow:hidden}.scan-action{width:66rpx;height:66rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;transition:transform .16s ease}.scan-action image{width:48rpx;height:48rpx;border-radius:7px}.scan-action--pressed{transform:scale(.92)}.device-code-band{padding:17rpx 22rpx;border-bottom:1px solid #e3ebee;background:#fff}.code-input{height:74rpx;display:grid;grid-template-columns:66rpx minmax(0,1fr) 92rpx;align-items:center;padding-left:18rpx;border:1px solid #dce7eb;border-radius:8px;background:#f4f8f9;box-sizing:border-box}.code-input>text{color:#087da8;font-size:21rpx;font-weight:700}.code-input input{width:100%;font-size:23rpx}.code-input>view{height:72rpx;color:#fff;background:#087da8;font-size:22rpx;line-height:72rpx;text-align:center}.task-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx - 108rpx)}.task-list{padding:17rpx 20rpx}.task-card{margin-bottom:15rpx;border:1px solid #e1eaed;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 5rpx 15rpx rgba(22,63,79,.05)}.task-card__top{min-height:90rpx;display:grid;grid-template-columns:46rpx minmax(0,1fr) auto;gap:13rpx;align-items:center;padding:10rpx 19rpx;border-bottom:1px solid #edf2f4}.index-mark{width:40rpx;height:40rpx;border-radius:50%;color:#fff;background:#087da8;font-size:20rpx;line-height:40rpx;text-align:center}.task-heading{min-width:0}.task-heading text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.task-heading text:first-child{color:#294b57;font-size:25rpx;font-weight:700}.task-heading text:last-child{margin-top:4rpx;color:#899aa1;font-size:19rpx}.status-pill{padding:7rpx 11rpx;border-radius:6px;color:#9a661d;background:#fff3dd;font-size:19rpx}.status-pill.is-progress{color:#087092;background:#e9f7fb}.status-pill.is-review{color:#6e4c9c;background:#f2edfa}.status-pill.is-success{color:#147351;background:#e9f7f1}.device-info{padding:13rpx 20rpx}.device-info>view{min-height:47rpx;display:grid;grid-template-columns:130rpx minmax(0,1fr);align-items:start}.device-info>view text:first-child{color:#7c9098;font-size:20rpx}.device-info>view text:last-child{color:#345762;font-size:22rpx;line-height:1.5;text-align:right;word-break:break-all}.task-card__bottom{min-height:72rpx;display:flex;align-items:center;justify-content:space-between;padding:0 17rpx;border-top:1px solid #edf2f4;background:#fbfcfd}.type-tag{padding:6rpx 10rpx;border-radius:5px;color:#8a5c1d;background:#fff3df;font-size:19rpx}.card-actions{display:flex;gap:8rpx}.card-actions>view{padding:12rpx 13rpx;border-radius:5px;color:#087da8;background:#eaf6f9;font-size:20rpx}.card-actions>.finish-action{color:#fff;background:#e54625}.empty-state{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40rpx}.empty-state image{width:118rpx;height:118rpx;border-radius:18rpx;opacity:.42}.empty-state>text:nth-child(2){margin-top:20rpx;color:#345762;font-size:27rpx;font-weight:700}.empty-state>text:nth-child(3){margin-top:7rpx;color:#899ba2;font-size:21rpx}.empty-state>view{margin-top:26rpx;padding:15rpx 31rpx;border-radius:6px;color:#fff;background:#087da8;font-size:23rpx}.safe-space{height:35rpx}@media(prefers-reduced-motion:reduce){.scan-action{transition:none}}
</style>
