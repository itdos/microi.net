<template>
  <mci-page-shell class="detail-page" :style="mciTokenStyle" :title="isPublic ? '处理公示' : '投诉详情'" :subtitle="isPublic ? '内容已脱敏并通过审核' : '处理进度与反馈时限'" @back="goBack">
    <mci-skeleton v-if="loading" type="detail" :rows="7" />
    <view v-else-if="error" class="state-panel"><image src="/static/xjy/business/tixing.png" mode="aspectFit" /><text>{{ error }}</text><view @tap="loadDetail"><text>重新加载</text></view></view>
    <scroll-view v-else class="detail-scroll" scroll-y>
      <view class="hero-card" :class="{ 'hero-card--public': isPublic }">
        <view class="hero-top"><text>{{ complaint.ComplaintNo || complaint.ComplaintNoMasked }}</text><text :class="statusTone(complaint.Status)">{{ statusLabel(complaint.Status) }}</text></view>
        <text class="hero-title">{{ complaint.Title }}</text>
        <view class="hero-tags"><text>{{ typeLabel(complaint.ComplaintType) }}</text><text>{{ severityLabel(complaint.Severity) }}</text><text v-if="!isPublic">{{ complaint.Confidentiality === 'Confidential' ? '保密举报' : '普通投诉' }}</text></view>
      </view>

      <view v-if="!isPublic && complaint.NextDeadlineAt" class="deadline-card" :class="{ overdue: Number(complaint.OverdueCount || 0) > 0 }">
        <view><text>{{ deadlineLabel(complaint.NextDeadlineType) }}</text><text>{{ Number(complaint.OverdueCount || 0) > 0 ? `已记录 ${complaint.OverdueCount} 次逾期` : '服务端持续计时' }}</text></view>
        <text>{{ complaint.NextDeadlineAt }}</text>
      </view>

      <view v-if="isPublic" class="metric-card">
        <view><text>{{ hoursText(complaint.ResponseHours) }}</text><text>响应耗时</text></view>
        <view><text>{{ hoursText(complaint.ResolveHours) }}</text><text>办结耗时</text></view>
        <view><text>{{ Number(complaint.IsOverdue) === 1 ? '有逾期' : '时限内' }}</text><text>时限结果</text></view>
      </view>

      <view class="section-card">
        <view class="section-head"><text>{{ isPublic ? '公示事项摘要' : '事实与诉求' }}</text><text>{{ complaint.CreateTime || complaint.SubmittedAt }}</text></view>
        <text class="content-text">{{ isPublic ? complaint.PublicSummary : complaint.Content }}</text>
        <view v-if="!isPublic && complaint.ExpectedResult" class="sub-content"><text>期望处理结果</text><text>{{ complaint.ExpectedResult }}</text></view>
        <view v-if="!isPublic && complaint.RelatedNo" class="info-row"><text>关联单号</text><text>{{ complaint.RelatedNo }}</text></view>
      </view>

      <view v-if="isPublic || complaint.ResolutionSummary" class="section-card">
        <view class="section-head"><text>处理结果</text><text>{{ complaint.ResolvedAt }}</text></view>
        <text class="content-text">{{ isPublic ? complaint.HandleSummary : complaint.ResolutionSummary }}</text>
      </view>

      <view v-if="!isPublic && (evidenceImages.length || evidenceFiles.length)" class="section-card">
        <view class="section-head"><text>私有证据材料</text><text>仅你与授权处理人可见</text></view>
        <view v-if="evidenceImages.length" class="evidence-block"><text>图片证据</text><mci-media-uploader :model-value="evidenceImages" media-type="image" readonly :file-context="detailFileContext" /></view>
        <view v-if="evidenceFiles.length" class="evidence-block"><text>附件</text><mci-media-uploader :model-value="evidenceFiles" media-type="file" readonly :file-context="detailFileContext" /></view>
      </view>

      <view v-if="!isPublic" class="section-card timeline-card">
        <view class="section-head"><text>处理轨迹</text><text>{{ actions.length }} 条</text></view>
        <view v-for="(item,index) in actions" :key="item.Id || index" class="timeline-item">
          <view class="timeline-rail"><view></view><view v-if="index < actions.length - 1"></view></view>
          <view class="timeline-copy"><view><text>{{ item.ActionName }}</text><text>{{ item.CreateTime }}</text></view><text>{{ item.Content }}</text><text v-if="item.NextFeedbackDeadline">下次反馈截止：{{ item.NextFeedbackDeadline }}</text></view>
        </view>
        <text v-if="!actions.length" class="empty-text">暂无处理轨迹</text>
      </view>

      <view v-if="!isPublic && actionMode" class="section-card action-editor">
        <view class="section-head"><text>{{ actionTitle }}</text><text @tap="cancelAction">取消</text></view>
        <textarea v-if="actionNeedsContent" v-model="actionContent" maxlength="2000" :placeholder="actionPlaceholder" />
        <view v-if="actionMode === 'Append'" class="evidence-block"><text>补充附件（最多9个）</text><mci-media-uploader v-model="actionAttachments" :max-count="9" media-type="file" upload-path="xjy/complaint/evidence/append" :file-context="uncommittedFileContext" @upload-state="uploadState = $event" /></view>
        <view class="editor-submit" :class="{ disabled: actionSubmitting || uploadPending }" @tap="submitAction"><text>{{ actionSubmitting ? '提交中' : uploadPending ? '附件上传中' : '确认提交' }}</text></view>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>

    <template #fixed>
      <scroll-view v-if="!isPublic && !loading && !error && availableActions.length && !actionMode" class="action-bar" scroll-x>
        <view class="action-bar-inner"><view v-for="item in availableActions" :key="item.key" :class="['action-button', `action-button--${item.tone}`]" hover-class="action-button--pressed" @tap="beginAction(item.key)"><text>{{ item.label }}</text></view></view>
      </scroll-view>
    </template>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getMyComplaintDetail, getPublicComplaintDetail, runComplaintAction } from '@/tenants/xjy/complaint.js'

const STATUS_LABELS={PendingAcceptance:'待受理',Accepted:'已受理',Processing:'处理中',PendingSupplement:'待补充',ResolvedPendingConfirm:'待确认',Closed:'已办结',Rejected:'不予受理',Withdrawn:'已撤回',Appealing:'申诉中',Reopened:'重办中'}
const TYPE_LABELS={Service:'服务态度',Order:'订单履约',Merchant:'商家问题',Product:'商品质量',Privacy:'隐私与安全',Fraud:'违规或欺诈举报',Other:'其他事项'}
const SEVERITY_LABELS={General:'一般',Major:'重大',Urgent:'紧急'}
const UNCOMMITTED_PRIVATE_FILE_CONTEXT=Object.freeze({private:true,failClosed:true})

export default{
  mixins:[themeMixin],
  data(){return{id:'',isPublic:false,loading:true,error:'',complaint:{},actions:[],actionMode:'',actionContent:'',actionAttachments:'[]',actionSubmitting:false,uploadState:{},uncommittedFileContext:UNCOMMITTED_PRIVATE_FILE_CONTEXT}},
  computed:{
    evidenceImages(){return Array.isArray(this.complaint.EvidenceImages)?this.complaint.EvidenceImages:[]},
    evidenceFiles(){return Array.isArray(this.complaint.EvidenceFiles)?this.complaint.EvidenceFiles:[]},
    detailFileContext(){return{private:true,failClosed:true,formEngineKey:'diy_complaint',formDataId:this.complaint.Id||''}},
    availableActions(){const status=this.complaint.Status;const items=[];if(!['Closed','Rejected','Withdrawn'].includes(status))items.push({key:'Append',label:'补充材料',tone:'secondary'});if(['PendingAcceptance','Accepted'].includes(status))items.push({key:'Withdraw',label:'撤回投诉',tone:'muted'});if(['ResolvedPendingConfirm','Closed','Rejected'].includes(status))items.push({key:'Appeal',label:'发起申诉',tone:'warning'});if(status==='ResolvedPendingConfirm'){items.push({key:'RejectResolution',label:'退回重办',tone:'warning'});items.push({key:'Confirm',label:'确认办结',tone:'primary'})}return items},
    actionTitle(){return{Append:'补充材料',Withdraw:'撤回投诉',Appeal:'发起申诉',Confirm:'确认办结',RejectResolution:'退回重办'}[this.actionMode]||''},
    actionNeedsContent(){return['Append','Appeal','RejectResolution'].includes(this.actionMode)},
    actionPlaceholder(){return this.actionMode==='Append'?'补充事实、说明或材料用途':this.actionMode==='Appeal'?'请说明申诉理由，至少5个字':'请说明需要重办的原因，至少5个字'},
    uploadPending(){return Number(this.uploadState.pendingCount||0)>0||Number(this.uploadState.failedCount||0)>0}
  },
  onLoad(options){this.id=decodeURIComponent(options.id||'');this.isPublic=String(options.public||'')==='1';this.loadDetail()},
  methods:{
    async loadDetail(){if(!this.id){this.error='缺少记录编号';this.loading=false;return}this.loading=true;this.error='';try{const result=this.isPublic?await getPublicComplaintDetail(this.id):await getMyComplaintDetail(this.id);if(this.isPublic){this.complaint=result.Data||{};this.actions=[]}else{this.complaint=result.Data&&result.Data.Complaint||{};this.actions=result.Data&&result.Data.Actions||[]}}catch(error){this.error=error.message||'详情加载失败'}finally{this.loading=false}},
    beginAction(key){this.actionMode=key;this.actionContent='';this.actionAttachments='[]';if(['Withdraw','Confirm'].includes(key))this.confirmSimpleAction()},
    confirmSimpleAction(){const label=this.actionTitle;uni.showModal({title:label,content:`确认${label}？`,success:(res)=>{if(res.confirm)this.submitAction();else this.cancelAction()}})},
    cancelAction(){this.actionMode='';this.actionContent='';this.actionAttachments='[]';this.uploadState={}},
    async submitAction(){if(this.actionSubmitting||this.uploadPending)return;const content=this.actionContent.trim();if(['Appeal','RejectResolution'].includes(this.actionMode)&&content.length<5){uni.showToast({title:'原因至少填写5个字',icon:'none'});return}if(this.actionMode==='Append'&&!content&&(!this.actionAttachments||this.actionAttachments==='[]')){uni.showToast({title:'请填写说明或上传附件',icon:'none'});return}this.actionSubmitting=true;uni.showLoading({title:'正在提交',mask:true});try{await runComplaintAction(this.actionMode,this.complaint.Id,{Content:content,Attachments:this.actionAttachments});uni.showToast({title:'操作成功',icon:'success'});this.cancelAction();await this.loadDetail()}catch(error){uni.showToast({title:error.message||'操作失败',icon:'none'})}finally{uni.hideLoading();this.actionSubmitting=false}},
    statusLabel(value){return STATUS_LABELS[value]||value||'未知'},statusTone(value){return value==='Closed'?'tone-success':['Rejected','Withdrawn'].includes(value)?'tone-muted':['PendingAcceptance','PendingSupplement'].includes(value)?'tone-warning':'tone-primary'},typeLabel(value){return TYPE_LABELS[value]||value||'其他'},severityLabel(value){return SEVERITY_LABELS[value]||value||'一般'},deadlineLabel(value){return{Accept:'受理截止',FirstReply:'首次反馈截止',Feedback:'阶段反馈截止',Resolve:'办结截止'}[value]||'处理截止'},hoursText(value){return`${Number(value||0).toFixed(1)}小时`},
    goBack(){uni.navigateBack({fail:()=>uni.redirectTo({url:'/pages/complaint/index?tab=public'})})}
  }
}
</script>

<style scoped>
.detail-page{height:100vh;overflow:hidden}.detail-scroll{height:calc(100vh - var(--mci-safe-top) - 44px)}.hero-card{margin:18rpx 20rpx;padding:24rpx;border-radius:11px;color:#fff;background:linear-gradient(135deg,#063b5c,#087da8);box-shadow:0 12rpx 30rpx rgba(6,59,92,.17)}.hero-card--public{background:linear-gradient(135deg,#18566c,#18a6b8)}.hero-top{display:flex;align-items:center;justify-content:space-between}.hero-top>text:first-child{color:rgba(255,255,255,.72);font-size:19rpx}.hero-top>text:last-child{padding:6rpx 11rpx;border-radius:5px;font-size:18rpx}.hero-card .tone-primary,.hero-card .tone-success,.hero-card .tone-warning,.hero-card .tone-muted{color:#fff;background:rgba(255,255,255,.17)}.hero-title{display:block;margin-top:18rpx;font-size:30rpx;font-weight:800;line-height:43rpx}.hero-tags{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:18rpx}.hero-tags text{padding:6rpx 10rpx;border-radius:5px;color:rgba(255,255,255,.86);background:rgba(255,255,255,.12);font-size:18rpx}.deadline-card{display:flex;align-items:center;justify-content:space-between;margin:16rpx 20rpx;padding:20rpx 22rpx;border-left:6rpx solid #18a6b8;border-radius:8px;background:#fff}.deadline-card.overdue{border-left-color:#e54625;background:#fff7f4}.deadline-card>view text{display:block}.deadline-card>view text:first-child{color:#345761;font-size:23rpx;font-weight:750}.deadline-card>view text:last-child{margin-top:5rpx;color:#8b9ba1;font-size:18rpx}.deadline-card>text{color:#087da8;font-size:21rpx;font-weight:750}.deadline-card.overdue>text{color:#d4472d}.metric-card{display:grid;grid-template-columns:repeat(3,1fr);margin:16rpx 20rpx;padding:20rpx;border-radius:9px;background:#fff}.metric-card view{text-align:center}.metric-card view+view{border-left:1px solid #edf1f3}.metric-card text{display:block}.metric-card text:first-child{color:#087da8;font-size:25rpx;font-weight:800}.metric-card text:last-child{margin-top:7rpx;color:#84979e;font-size:18rpx}.section-card{margin:16rpx 20rpx;padding:0 22rpx 22rpx;border-radius:10px;background:#fff;box-shadow:0 7rpx 22rpx rgba(38,75,89,.045)}.section-head{display:flex;align-items:center;justify-content:space-between;min-height:80rpx;border-bottom:1px solid #edf2f4}.section-head text:first-child{color:#2d515d;font-size:25rpx;font-weight:750}.section-head text:last-child{color:#93a2a7;font-size:18rpx}.content-text{display:block;padding-top:20rpx;color:#506c76;font-size:23rpx;line-height:38rpx;white-space:pre-wrap}.sub-content{margin-top:20rpx;padding:16rpx;border-radius:7px;background:#f5f8f9}.sub-content text{display:block}.sub-content text:first-child{color:#7b9098;font-size:19rpx}.sub-content text:last-child{margin-top:8rpx;color:#496771;font-size:22rpx;line-height:34rpx}.info-row{display:flex;align-items:center;justify-content:space-between;margin-top:18rpx;padding-top:16rpx;border-top:1px solid #edf2f4;font-size:21rpx}.info-row text:first-child{color:#82959c}.info-row text:last-child{color:#395b67}.evidence-block{padding-top:20rpx}.evidence-block>text{display:block;margin-bottom:13rpx;color:#6f858d;font-size:21rpx}.timeline-item{display:grid;grid-template-columns:26rpx minmax(0,1fr);gap:13rpx;padding-top:20rpx}.timeline-rail{display:flex;flex-direction:column;align-items:center}.timeline-rail view:first-child{width:18rpx;height:18rpx;margin-top:5rpx;border:5rpx solid #d9f0f5;border-radius:50%;background:#087da8}.timeline-rail view:last-child{width:2rpx;min-height:88rpx;flex:1;background:#dfe9ec}.timeline-copy{padding-bottom:20rpx}.timeline-copy>view{display:flex;align-items:center;justify-content:space-between}.timeline-copy>view text:first-child{color:#315661;font-size:23rpx;font-weight:750}.timeline-copy>view text:last-child{color:#98a6ab;font-size:17rpx}.timeline-copy>text{display:block;margin-top:8rpx;color:#6f858d;font-size:21rpx;line-height:33rpx}.timeline-copy>text:last-child{color:#b06a16;font-size:18rpx}.empty-text{display:block;padding:30rpx;color:#9aa8ad;font-size:20rpx;text-align:center}.action-editor textarea{box-sizing:border-box;width:100%;height:190rpx;margin-top:20rpx;padding:16rpx;border:1px solid #dce7eb;border-radius:7px;background:#f8fafb;font-size:22rpx;line-height:34rpx}.editor-submit{display:flex;align-items:center;justify-content:center;height:72rpx;margin-top:20rpx;border-radius:8px;color:#fff;background:#e54625;font-size:23rpx;font-weight:750}.editor-submit.disabled{opacity:.55}.action-bar{position:fixed;right:0;bottom:0;left:0;z-index:18;box-sizing:border-box;white-space:nowrap;border-top:1px solid #e3ebee;background:rgba(255,255,255,.97)}.action-bar-inner{display:inline-flex;gap:12rpx;align-items:center;min-height:94rpx;padding:12rpx max(20rpx,var(--mci-safe-right)) calc(12rpx + var(--mci-safe-bottom)) max(20rpx,var(--mci-safe-left))}.action-button{display:flex;align-items:center;justify-content:center;min-width:150rpx;height:66rpx;padding:0 20rpx;border-radius:8px;font-size:22rpx;transition:transform .14s ease}.action-button--primary{color:#fff;background:#e54625}.action-button--secondary{color:#087da8;background:#eaf7fa}.action-button--warning{color:#a86413;background:#fff2d8}.action-button--muted{color:#657a82;background:#eef3f4}.action-button--pressed{transform:scale(.96)}.state-panel{min-height:62vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40rpx;color:#71868e;font-size:23rpx}.state-panel image{width:100rpx;height:100rpx;opacity:.45}.state-panel>text{margin-top:17rpx;text-align:center}.state-panel>view{margin-top:20rpx;padding:13rpx 26rpx;border-radius:7px;color:#fff;background:#087da8}.bottom-space{height:140rpx}@media(prefers-reduced-motion:reduce){.action-button{transition:none}}
</style>
