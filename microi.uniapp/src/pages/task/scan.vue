<template>
  <mci-page-shell class="scan-page" :style="mciTokenStyle" title="扫码做任务" subtitle="识别设备并进入最近任务" @back="goBack">
    <template #right>
      <view class="scan-action" hover-class="scan-action--pressed" @tap="scan">
        <image :src="xjyAssets.scan" mode="aspectFit" />
      </view>
    </template>
    <view class="device-code-band">
      <view class="code-input">
        <text>设备</text>
        <input v-model="deviceId" confirm-type="search" placeholder="扫描设备码或输入设备 Id" @input="scheduleSearch" @confirm="search" />
        <view hover-class="reset-action--pressed" @tap="resetSearch"><text>重置</text></view>
      </view>
    </view>
    <mci-skeleton v-if="loading" type="list" :rows="5" />
    <scroll-view v-else class="task-scroll" scroll-y>
      <view v-if="tasks.length" class="task-list">
        <view v-for="(item,index) in tasks" :key="item.AID || index" class="task-card mci-fade-up" :style="{animationDelay:`${Math.min(index,6)*40}ms`}">
          <view class="task-card__top">
            <view class="index-mark"><text>{{ index+1 }}</text></view>
            <view class="task-heading"><text>{{ item.KehuMC || item.ShebeiMC || '售后任务' }}</text><text>{{ item.ShouhouFWBH || '暂无任务编号' }}</text></view>
            <text class="status-pill" :class="taskStateClass(item.Zhuangtai)">{{ item.Zhuangtai }}</text>
          </view>
          <view class="device-info">
            <view><text>设备名称</text><text>{{ item.ShebeiMC || '-' }}</text></view>
            <view><text>设备编号</text><text>{{ item.ShebeiBH || '-' }}</text></view>
            <view><text>设备型号</text><text>{{ item.ShebeiXH || '-' }}</text></view>
            <view><text>安装位置</text><text>{{ item.AnzhuangWZ || '-' }}</text></view>
            <view><text>计划服务</text><text>{{ formatTime(item.YujiSHSJ) || '-' }}</text></view>
            <view><text>服务人员</text><text>{{ item.ShouhouRY || '待领取' }}</text></view>
          </view>
          <view class="task-card__bottom">
            <view class="type-tag"><text>{{ item.Leixing || '服务' }}</text></view>
            <view class="card-actions">
              <view v-if="item.ShouhouRYDH" class="card-action" hover-class="card-action--pressed" @tap="callPhone(item.ShouhouRYDH)">
                <image src="/static/xjy/UI-call.png" mode="aspectFit" /><text>联系人员</text>
              </view>
              <view
                class="card-action process-action"
                :class="{ 'is-disabled': !canProcessDevice(item) }"
                :hover-class="canProcessDevice(item) ? 'card-action--pressed' : 'none'"
                @tap="openDevice(item)"
              >
                <image v-if="canProcessDevice(item)" src="/static/xjy/business/sh.png" mode="aspectFit" />
                <view v-else class="lock-icon" aria-hidden="true"><view></view></view>
                <text>处理设备</text>
              </view>
              <view v-if="canSubmitTask(item)" class="card-action finish-action" hover-class="card-action--pressed" @tap="finishTask(item)">
                <image src="/static/xjy/repair/renwu.png" mode="aspectFit" /><text>提交任务</text>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view v-else class="empty-state">
        <image :src="xjyAssets.scan" mode="aspectFit" />
        <text>{{ deviceId ? '该设备近期没有售后任务' : '请扫描设备二维码' }}</text>
        <text>查询范围为本月以来最近 15 个任务</text>
        <view hover-class="empty-action--pressed" @tap="scan"><image :src="xjyAssets.scan" mode="aspectFit" /><text>开始扫码</text></view>
      </view>
      <view class="safe-space"></view>
    </scroll-view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser } from '@/utils/request.js'
import { callApiEngine, formatDateTime, parseDeviceId } from '@/platform/business-runtime.js'
import { taskStateClass } from '@/utils/xjy-task.js'
import { taskScanProcessAccess, taskScanSubmitAccess } from '@/tenants/xjy/task-scan-permission.mjs'

export default {
  mixins:[themeMixin],
  data(){return{deviceId:'',tasks:[],loading:false,submitting:false,currentUser:{},searchTimer:null,loadRequestId:0}},
  onLoad(options){this.currentUser=getUser()||{};this.deviceId=decodeURIComponent(options.deviceId||'')},
  // 设备处理页返回后重新读取服务状态和整单完成数，提交按钮不使用进入页面时的旧数据。
  onShow(){this.currentUser=getUser()||{};if(this.deviceId.trim())this.loadTasks()},
  onUnload(){clearTimeout(this.searchTimer)},
  methods:{
    taskStateClass,formatTime:formatDateTime,
    processAccess(item){return taskScanProcessAccess(item,this.currentUser)},
    canProcessDevice(item){return this.processAccess(item).allowed},
    submitAccess(item){return taskScanSubmitAccess(item,this.currentUser)},
    canSubmitTask(item){return this.submitAccess(item).allowed},
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
    async openDevice(item){if(this.submitting)return;const access=this.processAccess(item);if(!access.allowed){uni.showModal({title:'暂无处理权限',content:access.reason,showCancel:false,confirmText:'我知道了'});return}this.submitting=true;uni.showLoading({title:'正在进入',mask:true});try{if(item.Zhuangtai==='待接单'){const result=await callApiEngine('automatic-order\u200c',{Id:item.BID});if(!result||Number(result.Code)!==1)throw new Error((result&&result.Msg)||'自动接单失败')}uni.navigateTo({url:`/pages/task/device?id=${encodeURIComponent(item.AID)}&taskId=${encodeURIComponent(item.BID)}&taskType=${encodeURIComponent(item.Leixing||'')}`})}catch(error){uni.showToast({title:error.message||'无法进入设备任务',icon:'none'})}finally{uni.hideLoading();this.submitting=false}},
    async finishTask(item){if(this.submitting)return;const access=this.submitAccess(item);if(!access.allowed){uni.showModal({title:'暂不能提交任务',content:access.reason,showCancel:false});return}const confirmed=await new Promise((resolve)=>uni.showModal({title:'确认提交任务',content:'任务下所有设备均已完成，确认提交商家验收吗？',success:(r)=>resolve(!!r.confirm),fail:()=>resolve(false)}));if(!confirmed)return;this.submitting=true;uni.showLoading({title:'正在检查',mask:true});try{const result=await callApiEngine('scan-code-tasks',{ShouhouDDId:item.BID});if(!result||Number(result.Code)!==1)throw new Error((result&&result.Msg)||'任务提交失败');uni.showToast({title:'任务已提交',icon:'success'});await this.loadTasks()}catch(error){uni.showToast({title:error.message||'任务提交失败',icon:'none'})}finally{uni.hideLoading();this.submitting=false}},
    callPhone(phone){uni.makePhoneCall({phoneNumber:String(phone)})},goBack(){uni.navigateBack({fail:()=>uni.switchTab({url:'/pages/workspace/index'})})}
  }
}
</script>

<style scoped>
.scan-page{height:100vh;overflow:hidden}.scan-action{width:72rpx;height:72rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;transition:transform .16s ease,background-color .16s ease}.scan-action image{width:52rpx;height:52rpx;border-radius:8px}.scan-action--pressed{background:#edf6f8;transform:scale(.92)}.device-code-band{padding:20rpx 24rpx;border-bottom:1px solid #e3ebee;background:#fff}.code-input{height:80rpx;display:grid;grid-template-columns:74rpx minmax(0,1fr) 104rpx;align-items:center;padding-left:20rpx;border:1px solid #dce7eb;border-radius:14rpx;overflow:hidden;background:#f4f8f9;box-sizing:border-box}.code-input>text{color:#087da8;font-size:24rpx;font-weight:700}.code-input input{width:100%;color:#294b57;font-size:26rpx}.code-input>view{height:78rpx;color:#fff;background:#087da8;font-size:25rpx;font-weight:600;line-height:78rpx;text-align:center;transition:filter .14s ease}.reset-action--pressed{filter:brightness(.9)}.task-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx - 120rpx)}.task-list{padding:20rpx 24rpx}.task-card{margin-bottom:18rpx;border:1px solid #e1eaed;border-radius:16rpx;overflow:hidden;background:#fff;box-shadow:0 6rpx 18rpx rgba(22,63,79,.06)}.task-card__top{min-height:104rpx;display:grid;grid-template-columns:48rpx minmax(0,1fr) auto;gap:14rpx;align-items:center;padding:12rpx 22rpx;border-bottom:1px solid #edf2f4}.index-mark{width:44rpx;height:44rpx;border-radius:50%;color:#fff;background:#087da8;font-size:22rpx;line-height:44rpx;text-align:center}.task-heading{min-width:0}.task-heading text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.task-heading text:first-child{color:#294b57;font-size:29rpx;font-weight:700}.task-heading text:last-child{margin-top:5rpx;color:#899aa1;font-size:21rpx}.status-pill{max-width:170rpx;padding:8rpx 13rpx;overflow:hidden;border-radius:8rpx;color:#9a661d;background:#fff3dd;font-size:21rpx;text-overflow:ellipsis;white-space:nowrap}.status-pill.is-progress{color:#087092;background:#e9f7fb}.status-pill.is-review{color:#6e4c9c;background:#f2edfa}.status-pill.is-success{color:#147351;background:#e9f7f1}.device-info{padding:17rpx 24rpx}.device-info>view{min-height:52rpx;display:grid;grid-template-columns:138rpx minmax(0,1fr);gap:16rpx;align-items:start;line-height:36rpx}.device-info>view text:first-child{color:#7c9098;font-size:23rpx}.device-info>view text:last-child{color:#345762;font-size:24rpx;line-height:36rpx;text-align:right;word-break:break-all}.task-card__bottom{min-height:100rpx;display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding:13rpx 18rpx;border-top:1px solid #edf2f4;background:#fbfcfd;box-sizing:border-box}.type-tag{flex:0 0 auto;padding:7rpx 11rpx;border-radius:7rpx;color:#8a5c1d;background:#fff3df;font-size:20rpx}.card-actions{display:flex;flex:1;flex-wrap:wrap;justify-content:flex-end;gap:10rpx}.card-action{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8rpx;min-width:132rpx;height:58rpx;padding:0 16rpx;border:1px solid rgba(8,125,168,.08);border-radius:12rpx;color:#087da8;background:#eaf6f9;font-size:23rpx;font-weight:600;transition:transform .14s ease,filter .14s ease,background-color .14s ease}.card-action image{flex:0 0 auto;width:30rpx;height:30rpx}.card-action--pressed{filter:brightness(.94);transform:scale(.96)}.process-action:not(.is-disabled){border-color:#087da8;color:#fff;background:#087da8;box-shadow:0 6rpx 14rpx rgba(8,125,168,.18)}.process-action:not(.is-disabled) image{filter:brightness(0) invert(1)}.card-action.is-disabled{border-color:#dce5e8;color:#91a2a9;background:#f0f4f5}.card-actions>.finish-action{border-color:#e54625;color:#fff;background:#e54625}.finish-action image{filter:brightness(0) invert(1)}.lock-icon{position:relative;width:28rpx;height:25rpx;border:3rpx solid currentColor;border-radius:5rpx;box-sizing:border-box}.lock-icon>view{position:absolute;left:50%;bottom:17rpx;width:16rpx;height:14rpx;border:3rpx solid currentColor;border-bottom:0;border-radius:10rpx 10rpx 0 0;box-sizing:border-box;transform:translateX(-50%)}.empty-state{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40rpx}.empty-state>image{width:124rpx;height:124rpx;border-radius:18rpx;opacity:.42}.empty-state>text:nth-child(2){margin-top:22rpx;color:#345762;font-size:29rpx;font-weight:700}.empty-state>text:nth-child(3){margin-top:9rpx;color:#899ba2;font-size:23rpx}.empty-state>view{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:10rpx;min-width:210rpx;height:80rpx;margin-top:28rpx;padding:0 30rpx;border-radius:12rpx;color:#fff;background:#087da8;font-size:26rpx;font-weight:650;transition:transform .14s ease,filter .14s ease}.empty-state>view image{width:34rpx;height:34rpx;filter:brightness(0) invert(1)}.empty-action--pressed{filter:brightness(.92);transform:scale(.97)}.safe-space{height:calc(36rpx + var(--mci-safe-bottom))}@media(prefers-reduced-motion:reduce){.scan-action,.card-action,.empty-state>view{transition:none}}
</style>
