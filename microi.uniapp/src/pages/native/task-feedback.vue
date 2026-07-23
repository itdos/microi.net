<template>
  <mci-page-shell class="feedback-page" :style="mciTokenStyle" title="完成服务" :subtitle="taskNo" @back="goBack">
    <template #right><view class="draft-action" hover-class="draft-action--pressed" @tap="saveDraft"><text>存草稿</text></view></template>
    <mci-skeleton v-if="loading" type="form" :rows="7" />
    <scroll-view v-else class="feedback-scroll" scroll-y>
      <view v-if="draftRestored" class="draft-tip"><view><text>已恢复未提交草稿</text><text>{{ draftTime }}</text></view><view @tap="discardDraft"><text>放弃</text></view></view>
      <view class="summary-band"><image src="/static/xjy/repair/renwu.png" mode="aspectFit" /><view><text>{{ customer || '客户现场服务' }}</text><text>{{ taskNo || '售后任务' }}</text></view><text>{{ taskType || '服务' }}</text></view>

      <view class="section-band">
        <view class="section-heading"><view></view><text>设备任务</text><text class="section-heading__hint">{{ completedDeviceCount }}/{{ devices.length }} 已完成</text></view>
        <view v-if="devices.length" class="device-list"><view v-for="device in devices" :key="device.Id" class="device-row" hover-class="device-row--pressed" @tap="openDevice(device)"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><view><text>{{ device.name }}</text><text>{{ [device.model,device.code,device.position].filter(Boolean).join(' · ') }}</text></view><text :class="{complete:device.status==='已完成'}">{{ device.status }}</text><text>›</text></view></view>
        <view v-else class="device-empty"><text>当前任务没有逐台设备子任务，可直接填写服务汇总。</text></view>
      </view>

      <view class="section-band">
        <view class="section-heading"><view></view><text>服务汇总</text><text class="section-heading__required">必填</text></view>
        <view class="amount-row"><text>服务费用</text><view><text>¥</text><input v-model="form.amount" type="digit" placeholder="0.00" /></view></view>
        <textarea v-model="form.result" class="result-textarea" maxlength="1500" placeholder="请填写现场处理过程、结果及后续建议" /><view class="word-count"><text>{{ form.result.length }}/1500</text></view>
      </view>

      <view class="section-band">
        <view class="section-heading"><view></view><text>服务结果照片</text><text class="section-heading__hint">最多 9 张</text></view>
        <view class="upload-block"><mci-media-uploader v-model="form.photos" :max-count="9" :upload-path="`xjy/task-result/${taskId}/photos`" /></view>
        <view class="watermark-command" hover-class="watermark-command--pressed" @tap="openWatermarkCamera"><image src="/static/xjy/watermarkCamera/camera.png" mode="aspectFit" /><text>使用现场水印相机拍摄</text><text>›</text></view>
      </view>

      <view class="section-band">
        <view class="section-heading"><view></view><text>服务视频</text><text class="section-heading__hint">最多 3 个</text></view>
        <view class="upload-block"><mci-media-uploader v-model="form.videos" media-type="video" :max-count="3" :upload-path="`xjy/task-result/${taskId}/videos`" /></view>
      </view>

      <view v-if="/回访/.test(taskType)" class="section-band">
        <view class="section-heading"><view></view><text>回访信息</text></view>
        <view class="form-row"><text>跟进方式</text><input v-model="form.followType" placeholder="如电话、微信、现场拜访" /></view>
      </view>

      <view class="quality-note"><view></view><text>提交前系统会再次检查所有设备任务。提交成功后进入商家验收，失败时当前内容会自动保留为草稿。</text></view>
      <view class="safe-space"></view>
    </scroll-view>
    <view class="bottom-bar"><view class="bottom-button bottom-button--plain" hover-class="bottom-button--pressed" @tap="openFullForm"><text>完整信息</text></view><view class="bottom-button bottom-button--primary" :class="{disabled:submitting}" hover-class="bottom-button--pressed" @tap="submit"><text>{{ submitting?'正在提交':'完成并提交' }}</text></view></view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
import { openForm } from '@/platform/business-runtime.js'
import { loadTask, loadTaskDevices, readTaskDraft, removeTaskDraft, runTaskAction, writeTaskDraft } from '@/utils/xjy-task.js'

export default {
  mixins:[themeMixin],
  data(){return{taskId:'',taskNo:'',customer:'',taskType:'',task:{},devices:[],form:{amount:'',result:'',photos:'[]',videos:'[]',followType:''},loading:true,submitting:false,draftRestored:false,draftSavedAt:0}},
  computed:{completedDeviceCount(){return this.devices.filter((item)=>item.status==='已完成').length},devicesCompleted(){return this.devices.length===0||this.completedDeviceCount===this.devices.length},draftTime(){return this.draftSavedAt?new Date(this.draftSavedAt).toLocaleString():''}},
  onLoad(options){this.taskId=decodeURIComponent(options.taskId||'');this.taskNo=decodeURIComponent(options.taskNo||'');this.customer=decodeURIComponent(options.customer||'');this.taskType=decodeURIComponent(options.taskType||'');this.loadData()},
  onShow(){if(!this.loading&&this.taskId)this.loadDevices(true)},
  methods:{
    async loadData(){if(!this.taskId){uni.showToast({title:'缺少任务编号',icon:'none'});this.loading=false;return}this.loading=true;try{const [taskResult]=await Promise.all([loadTask(this.taskId,true),this.loadDevices(true)]);this.task=taskResult.task;this.taskNo=this.taskNo||this.task.no;this.customer=this.customer||this.task.customer;this.taskType=this.taskType||this.task.type;this.form.amount=this.task.ShouhouFY||'';this.form.result=this.task.result||'';this.form.photos=this.task.JieguoTP||'[]';this.form.videos=this.task.ShipinSC||'[]';const draft=readTaskDraft(`finish:${this.taskId}`);if(draft&&draft.savedAt){this.form={...this.form,...(draft.form||{})};this.draftRestored=true;this.draftSavedAt=draft.savedAt}}catch(error){uni.showToast({title:error.message||'任务加载失败',icon:'none'})}finally{this.loading=false}},
    async loadDevices(refresh=false){try{this.devices=await loadTaskDevices(this.taskId,refresh)}catch(error){this.devices=[]}},
    openDevice(device){uni.navigateTo({url:`/pages/task/device?id=${encodeURIComponent(device.Id)}&taskId=${encodeURIComponent(this.taskId)}&taskType=${encodeURIComponent(this.taskType)}`})},
    openFullForm(){openForm({table:'Diy_ShouhouDD',rowId:this.taskId,mode:'Edit',title:'完整售后任务',menuAliases:['售后任务','售后订单']})},
    parseUpload(value){if(!value)return[];if(Array.isArray(value))return value;try{const rows=JSON.parse(value);return Array.isArray(rows)?rows:[rows]}catch(error){return[]}},
    openWatermarkCamera(){const query=`customer=${encodeURIComponent(this.customer)}&address=${encodeURIComponent(this.task.address||'服务现场')}`;uni.navigateTo({url:`/pages/native/watermark-camera?${query}`,success:(result)=>{if(!result.eventChannel)return;result.eventChannel.on('watermarkCaptured',async(data)=>{if(!data||!data.path)return;try{const upload=await V8.uploadFile(data.path,{path:`xjy/task-result/${this.taskId}/watermark`,preview:true});const rows=this.parseUpload(this.form.photos);rows.push(upload.Data);this.form.photos=JSON.stringify(rows)}catch(error){uni.showToast({title:error.message||'水印照片上传失败',icon:'none'})}})}})},
    saveDraft(showToast=true){writeTaskDraft(`finish:${this.taskId}`,{form:{...this.form}});this.draftRestored=true;this.draftSavedAt=Date.now();if(showToast)uni.showToast({title:'草稿已保存',icon:'success'})},
    discardDraft(){removeTaskDraft(`finish:${this.taskId}`);this.draftRestored=false;this.draftSavedAt=0;this.loadData()},
    async submit(){if(this.submitting)return;if(!this.form.result.trim()){uni.showToast({title:'请填写处理结果',icon:'none'});return}await this.loadDevices(true);if(!this.devicesCompleted){uni.showModal({title:'设备任务未完成',content:`还有 ${this.devices.length-this.completedDeviceCount} 台设备未完成，请先逐台处理。`,showCancel:false});return}this.submitting=true;uni.showLoading({title:'正在提交',mask:true});try{await runTaskAction('finish',this.task,{ShouhouFY:Number(this.form.amount||0),Jieguo:this.form.result.trim(),JieguoTP:this.form.photos||'[]',ShipinSC:this.form.videos||'[]',GenjinFS:this.form.followType||'',GenjinFSZ:'',Neirong:this.taskType.includes('回访')?this.task.content:undefined});removeTaskDraft(`finish:${this.taskId}`);const channel=this.getOpenerEventChannel&&this.getOpenerEventChannel();if(channel&&channel.emit)channel.emit('taskFinished',{taskId:this.taskId});uni.showToast({title:'服务已提交验收',icon:'success'});setTimeout(()=>this.goBack(),700)}catch(error){this.saveDraft(false);uni.showToast({title:error.message||error.Msg||'提交失败，草稿已保留',icon:'none'})}finally{uni.hideLoading();this.submitting=false}},
    goBack(){uni.navigateBack()}
  }
}
</script>

<style scoped>
.feedback-page{height:100vh;overflow:hidden}.draft-action{min-width:74rpx;height:58rpx;display:flex;align-items:center;justify-content:center;border-radius:6px;color:#087da8;font-size:21rpx;font-weight:650;transition:background .16s ease}.draft-action--pressed{background:#edf7fa}.feedback-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx - 112rpx - var(--mci-safe-bottom))}.draft-tip{min-height:72rpx;display:flex;align-items:center;justify-content:space-between;padding:9rpx 23rpx;color:#76591d;background:#fff8e7;box-sizing:border-box}.draft-tip>view:first-child text{display:block}.draft-tip>view:first-child text:first-child{font-size:22rpx;font-weight:650}.draft-tip>view:first-child text:last-child{margin-top:3rpx;font-size:18rpx;opacity:.72}.draft-tip>view:last-child{padding:12rpx;color:#a25920;font-size:20rpx}.summary-band{display:grid;grid-template-columns:68rpx minmax(0,1fr) auto;gap:15rpx;align-items:center;padding:25rpx 24rpx;color:#fff;background:#063b5c}.summary-band image{width:58rpx;height:58rpx;padding:7rpx;border-radius:8px;background:#fff;box-sizing:border-box}.summary-band>view{min-width:0}.summary-band>view text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.summary-band>view text:first-child{font-size:29rpx;font-weight:750}.summary-band>view text:last-child{margin-top:5rpx;color:rgba(255,255,255,.66);font-size:20rpx}.summary-band>text{padding:7rpx 11rpx;border-radius:6px;background:rgba(255,255,255,.15);font-size:20rpx}.section-band{margin-top:14rpx;padding:0 24rpx;background:#fff}.section-heading{min-height:82rpx;display:flex;align-items:center;border-bottom:1px solid #edf2f4;color:#244954;font-size:27rpx;font-weight:700}.section-heading>view{width:7rpx;height:28rpx;margin-right:13rpx;border-radius:3rpx;background:#e54625}.section-heading__hint{flex:1;color:#86989f;font-size:19rpx;font-weight:400;text-align:right}.section-heading__required{margin-left:8rpx;color:#d2463f;font-size:19rpx;font-weight:500}.device-row{min-height:96rpx;display:grid;grid-template-columns:48rpx minmax(0,1fr) auto 24rpx;gap:12rpx;align-items:center;border-bottom:1px solid #edf2f4;transition:background .16s ease}.device-row--pressed{background:#f0f7f9}.device-row image{width:42rpx;height:42rpx}.device-row>view{min-width:0}.device-row>view text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.device-row>view text:first-child{color:#294b57;font-size:23rpx;font-weight:650}.device-row>view text:last-child{margin-top:5rpx;color:#899ba2;font-size:19rpx}.device-row>text:nth-child(3){padding:6rpx 9rpx;border-radius:5px;color:#b16a18;background:#fff1df;font-size:18rpx}.device-row>text:nth-child(3).complete{color:#147351;background:#e9f7f1}.device-row>text:last-child{color:#9babb1;font-size:30rpx}.device-empty{padding:25rpx 0;color:#81949c;font-size:22rpx;line-height:1.55}.amount-row{min-height:82rpx;display:grid;grid-template-columns:150rpx minmax(0,1fr);align-items:center;border-bottom:1px solid #edf2f4}.amount-row>text{color:#607983;font-size:23rpx}.amount-row>view{display:flex;align-items:center;justify-content:flex-end}.amount-row>view>text{color:#e54625;font-size:25rpx}.amount-row input{width:230rpx;height:70rpx;font-size:25rpx;text-align:right}.result-textarea{width:100%;height:220rpx;padding:19rpx 2rpx 4rpx;box-sizing:border-box;color:#294b57;font-size:24rpx;line-height:1.65}.word-count{padding-bottom:15rpx;color:#9aa9af;font-size:19rpx;text-align:right}.upload-block{padding:20rpx 0}.watermark-command{min-height:75rpx;display:grid;grid-template-columns:42rpx minmax(0,1fr) 24rpx;gap:12rpx;align-items:center;border-top:1px solid #edf2f4;color:#466570;font-size:22rpx;transition:background .16s ease}.watermark-command image{width:37rpx;height:37rpx}.watermark-command>text:last-child{color:#9babb1;font-size:30rpx}.watermark-command--pressed{background:#f1f7f9}.form-row{min-height:82rpx;display:grid;grid-template-columns:160rpx minmax(0,1fr);align-items:center}.form-row>text{color:#607983;font-size:23rpx}.form-row input{height:70rpx;color:#294b57;font-size:23rpx;text-align:right}.quality-note{display:flex;gap:12rpx;margin:18rpx 24rpx 0;padding:18rpx;color:#59747e;background:#eaf5f8;font-size:21rpx;line-height:1.6}.quality-note>view{flex:none;width:6rpx;border-radius:3rpx;background:#087da8}.safe-space{height:34rpx}.bottom-bar{position:fixed;right:0;bottom:0;left:0;z-index:30;display:grid;grid-template-columns:.8fr 1.2fr;gap:13rpx;padding:15rpx 21rpx calc(15rpx + var(--mci-safe-bottom));border-top:1px solid #e3ebee;background:rgba(255,255,255,.97)}.bottom-button{height:82rpx;border-radius:7px;font-size:25rpx;font-weight:700;line-height:82rpx;text-align:center;transition:transform .16s ease}.bottom-button--plain{color:#496671;background:#edf3f5}.bottom-button--primary{color:#fff;background:#e54625}.bottom-button.disabled{opacity:.58}.bottom-button--pressed{transform:scale(.98)}@media(prefers-reduced-motion:reduce){.device-row,.bottom-button,.watermark-command{transition:none}}
</style>
