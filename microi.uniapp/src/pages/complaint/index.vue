<template>
  <mci-page-shell class="complaint-page" :style="mciTokenStyle" title="投诉举报中心" subtitle="有入口、有进度、有时限" @back="goBack">
    <view class="tab-strip">
      <view v-for="item in tabs" :key="item.key" class="tab-item" :class="{ active: activeTab === item.key }" @tap="changeTab(item.key)"><text>{{ item.label }}</text></view>
    </view>

    <mci-skeleton v-if="loading" type="list" :rows="6" />
    <view v-else-if="error" class="state-panel">
      <image src="/static/xjy/business/tixing.png" mode="aspectFit" />
      <text>{{ error }}</text>
      <view class="state-action" @tap="loadCurrent"><text>重新加载</text></view>
    </view>

    <view v-else-if="activeTab !== 'public' && !isLoggedIn" class="state-panel">
      <image src="/static/xjy/user/users.png" mode="aspectFit" />
      <text>登录后可提交投诉、上传证据并跟踪处理时限</text>
      <view class="state-action" @tap="goLogin"><text>登录 / 注册</text></view>
    </view>

    <scroll-view v-else-if="activeTab === 'submit'" class="page-scroll" scroll-y>
      <view class="notice-card">
        <view class="notice-icon"><image src="/static/xjy/business/tixing.png" mode="aspectFit" /></view>
        <view><text>处理时限由服务端计算</text><text>{{ bootstrap.Notice || '提交后可查看受理、首次反馈和办结时限。' }}</text></view>
      </view>

      <view class="form-card">
        <view class="section-head"><text>事项信息</text><text>带 * 为必填</text></view>
        <picker :range="complaintTypes" range-key="Value" @change="pickType">
          <view class="form-row"><text>* 投诉类型</text><text :class="{ placeholder: !form.ComplaintType }">{{ optionLabel(complaintTypes, form.ComplaintType) || '请选择' }}</text><text>›</text></view>
        </picker>
        <picker :range="severities" range-key="Value" @change="pickSeverity">
          <view class="form-row"><text>* 紧急程度</text><text>{{ optionLabel(severities, form.Severity) }}</text><text>›</text></view>
        </picker>
        <picker :range="confidentialities" range-key="Value" @change="pickConfidentiality">
          <view class="form-row"><text>* 提交方式</text><text>{{ optionLabel(confidentialities, form.Confidentiality) }}</text><text>›</text></view>
        </picker>
        <view class="field-block"><text>* 投诉标题</text><input v-model="form.Title" maxlength="100" placeholder="简要说明问题，至少4个字" /></view>
        <view class="field-block"><text>* 事实与诉求</text><textarea v-model="form.Content" maxlength="4000" placeholder="请说明发生时间、对象、事实经过和影响，至少10个字" /></view>
        <view class="field-block"><text>期望处理结果</text><textarea v-model="form.ExpectedResult" class="textarea-short" maxlength="1000" placeholder="希望平台如何处理" /></view>
        <view class="field-block"><text>关联单号</text><input v-model="form.RelatedNo" maxlength="100" placeholder="订单号、任务号或商家名称（选填）" /></view>
        <view class="field-block"><text>联系电话</text><input v-model="form.SubmitterPhone" type="number" maxlength="11" placeholder="便于核实情况（选填）" /></view>
      </view>

      <view v-if="selectedRule" class="sla-card">
        <view class="section-head"><text>预计反馈时限</text><text>{{ selectedRule.RuleName }}</text></view>
        <view class="sla-grid">
          <view><text>{{ durationText(selectedRule.AcceptMinutes) }}</text><text>受理</text></view>
          <view><text>{{ durationText(selectedRule.FirstReplyMinutes) }}</text><text>首次反馈</text></view>
          <view><text>{{ durationText(selectedRule.FeedbackMinutes) }}</text><text>阶段反馈</text></view>
          <view><text>{{ durationText(selectedRule.ResolveMinutes) }}</text><text>计划办结</text></view>
        </view>
        <text class="sla-note">以上为当前平台服务承诺，最终截止时间以提交后服务端返回为准；请求补充材料期间可暂停计时。</text>
      </view>

      <view class="form-card">
        <view class="section-head"><text>证据材料</text><text>默认私有保存</text></view>
        <view class="upload-block"><text>图片证据（最多9张）</text><mci-media-uploader v-model="form.EvidenceImages" :max-count="9" media-type="image" upload-path="xjy/complaint/evidence/images" :file-context="privateFileContext" @upload-state="imagesUploadState = $event" /></view>
        <view class="upload-block"><text>视频或附件（最多5个）</text><mci-media-uploader v-model="form.EvidenceFiles" :max-count="5" media-type="file" upload-path="xjy/complaint/evidence/files" :file-context="privateFileContext" @upload-state="filesUploadState = $event" /></view>
      </view>

      <view v-if="form.Confidentiality !== 'Confidential'" class="consent-row" @tap="form.PublicConsent = !form.PublicConsent">
        <view class="checkbox" :class="{ checked: form.PublicConsent }"><text>{{ form.PublicConsent ? '✓' : '' }}</text></view>
        <view><text>同意在办结并人工审核后进行脱敏公示</text><text>不会公示姓名、电话、地址、订单明细、原始证据和内部意见</text></view>
      </view>
      <view v-else class="confidential-note"><text>保密举报不会进入处理公示，仅客服主管及授权管理员可查看。</text></view>
      <view class="bottom-space"></view>
    </scroll-view>

    <scroll-view v-else class="page-scroll" scroll-y @scrolltolower="loadMore">
      <view v-if="activeTab === 'public'" class="search-row"><input v-model="keyword" maxlength="50" confirm-type="search" placeholder="搜索公示编号或事项标题" @confirm="reloadList" /><view @tap="reloadList"><text>查询</text></view></view>
      <view v-if="list.length" class="case-list">
        <view v-for="item in list" :key="item.Id" class="case-card" hover-class="case-card--pressed" @tap="openDetail(item)">
          <view class="case-head"><text>{{ activeTab === 'public' ? item.ComplaintNoMasked : item.ComplaintNo }}</text><text :class="statusTone(item.Status)">{{ statusLabel(item.Status) }}</text></view>
          <text class="case-title">{{ item.Title }}</text>
          <text v-if="activeTab === 'public'" class="case-summary">{{ item.PublicSummary }}</text>
          <view class="case-meta"><text>{{ typeLabel(item.ComplaintType) }}</text><text>{{ severityLabel(item.Severity) }}</text><text>{{ item.CreateTime || item.PublishedAt }}</text></view>
          <view v-if="activeTab === 'mine' && item.NextDeadlineAt" class="deadline-row"><text>{{ deadlineLabel(item.NextDeadlineType) }}</text><text>{{ item.NextDeadlineAt }}</text><text v-if="Number(item.OverdueCount || 0) > 0">已逾期 {{ item.OverdueCount }} 次</text></view>
          <view v-if="activeTab === 'public'" class="public-metrics"><text>响应 {{ hoursText(item.ResponseHours) }}</text><text>办结 {{ hoursText(item.ResolveHours) }}</text><text>{{ Number(item.IsOverdue) === 1 ? '存在逾期' : '时限内处理' }}</text></view>
        </view>
        <text class="list-footer">{{ noMore ? '没有更多了' : listLoading ? '加载中…' : '继续上拉加载' }}</text>
      </view>
      <view v-else class="state-panel state-panel--inline"><image :src="activeTab === 'public' ? '/static/xjy/user/fws.png' : '/static/xjy/business/tixing.png'" mode="aspectFit" /><text>{{ activeTab === 'public' ? '暂时没有已发布的处理公示' : '你还没有提交投诉举报' }}</text><view v-if="activeTab === 'mine'" class="state-action" @tap="changeTab('submit')"><text>我要投诉</text></view></view>
      <view class="bottom-space"></view>
    </scroll-view>

    <template #fixed>
      <view v-if="activeTab === 'submit' && isLoggedIn && !loading && !error" class="submit-bar">
        <text>提交即生成可追踪编号与服务端截止时间</text>
        <view class="submit-button" :class="{ disabled: submitting || uploadPending }" hover-class="submit-button--pressed" @tap="submit"><text>{{ submitting ? '提交中' : uploadPending ? '材料上传中' : '提交投诉' }}</text></view>
      </view>
    </template>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getToken, getUser } from '@/utils/request.js'
import { getProfileRoute } from '@/platform/profile/index.js'
import { getComplaintBootstrap, submitComplaint, getMyComplaints, getPublicComplaints } from '@/tenants/xjy/complaint.js'

const PRIVATE_FILE_CONTEXT = Object.freeze({ private: true, failClosed: true })
const STATUS_LABELS = { PendingAcceptance:'待受理',Accepted:'已受理',Processing:'处理中',PendingSupplement:'待补充',ResolvedPendingConfirm:'待确认',Closed:'已办结',Rejected:'不予受理',Withdrawn:'已撤回',Appealing:'申诉中',Reopened:'重办中' }
const TYPE_LABELS = { Service:'服务态度',Order:'订单履约',Merchant:'商家问题',Product:'商品质量',Privacy:'隐私与安全',Fraud:'违规或欺诈举报',Other:'其他事项' }
const SEVERITY_LABELS = { General:'一般',Major:'重大',Urgent:'紧急' }

function newIdempotencyKey() {
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      tabs:[{key:'submit',label:'我要投诉'},{key:'mine',label:'我的记录'},{key:'public',label:'处理公示'}],
      activeTab:'submit',loading:true,error:'',submitting:false,isLoggedIn:false,bootstrap:{},list:[],pageIndex:1,pageSize:10,noMore:false,listLoading:false,keyword:'',
      privateFileContext:PRIVATE_FILE_CONTEXT,imagesUploadState:{},filesUploadState:{},
      form:{ComplaintType:'',Severity:'General',Confidentiality:'Normal',Title:'',Content:'',ExpectedResult:'',RelatedNo:'',SubmitterPhone:'',EvidenceImages:'[]',EvidenceFiles:'[]',PublicConsent:false,IdempotencyKey:''}
    }
  },
  computed: {
    complaintTypes(){return this.bootstrap.ComplaintTypes||[]},
    severities(){return this.bootstrap.Severities||[]},
    confidentialities(){return this.bootstrap.Confidentialities||[]},
    selectedRule(){return (this.bootstrap.Rules||[]).find((rule)=>(rule.Severity==='*'||rule.Severity===this.form.Severity)&&(rule.Confidentiality==='*'||rule.Confidentiality===this.form.Confidentiality))||null},
    uploadPending(){return Number(this.imagesUploadState.pendingCount||0)>0||Number(this.filesUploadState.pendingCount||0)>0||Number(this.imagesUploadState.failedCount||0)>0||Number(this.filesUploadState.failedCount||0)>0}
  },
  onLoad(options){this.activeTab=['submit','mine','public'].includes(options.tab)?options.tab:'submit';this.refreshLogin();this.restoreDraftKey();this.loadCurrent()},
  onShow(){this.refreshLogin();if(this.activeTab==='mine'&&this.isLoggedIn&&!this.loading)this.reloadList()},
  methods:{
    refreshLogin(){const user=getUser()||{};this.isLoggedIn=!!getToken()&&!!user.Id},
    restoreDraftKey(){const key=uni.getStorageSync('xjy_complaint_draft_key');this.form.IdempotencyKey=key||newIdempotencyKey();if(!key)uni.setStorageSync('xjy_complaint_draft_key',this.form.IdempotencyKey)},
    async loadCurrent(){this.error='';this.loading=true;try{const auth=this.activeTab!=='public'&&this.isLoggedIn;const result=await getComplaintBootstrap(auth);this.bootstrap=result.Data||{};if(!this.form.SubmitterPhone&&this.bootstrap.User)this.form.SubmitterPhone=this.bootstrap.User.Phone||'';if(this.activeTab!=='submit'&&(this.activeTab==='public'||this.isLoggedIn))await this.reloadList()}catch(error){this.error=error.message||'页面加载失败'}finally{this.loading=false}},
    changeTab(key){this.activeTab=key;this.error='';if(key==='submit'){if(!Object.keys(this.bootstrap).length)this.loadCurrent();return}this.reloadList()},
    async reloadList(){if(this.activeTab!=='public'&&!this.isLoggedIn)return;this.pageIndex=1;this.noMore=false;this.list=[];await this.fetchList()},
    async fetchList(){if(this.listLoading||this.noMore)return;this.listLoading=true;try{const result=this.activeTab==='public'?await getPublicComplaints({PageIndex:this.pageIndex,PageSize:this.pageSize,Keyword:this.keyword.trim()}):await getMyComplaints({PageIndex:this.pageIndex,PageSize:this.pageSize});const rows=result.Data||[];this.list=this.pageIndex===1?rows:this.list.concat(rows);this.noMore=rows.length<this.pageSize;this.pageIndex+=1}catch(error){uni.showToast({title:error.message||'列表加载失败',icon:'none'})}finally{this.listLoading=false}},
    loadMore(){this.fetchList()},
    pickType(event){this.form.ComplaintType=(this.complaintTypes[Number(event.detail.value)]||{}).Key||''},
    pickSeverity(event){this.form.Severity=(this.severities[Number(event.detail.value)]||{}).Key||'General'},
    pickConfidentiality(event){this.form.Confidentiality=(this.confidentialities[Number(event.detail.value)]||{}).Key||'Normal';if(this.form.Confidentiality==='Confidential')this.form.PublicConsent=false},
    optionLabel(options,key){const item=(options||[]).find((row)=>row.Key===key);return item&&item.Value||''},
    durationText(minutes){const value=Number(minutes||0);if(value%1440===0)return `${value/1440}天`;if(value%60===0)return `${value/60}小时`;return `${value}分钟`},
    validate(){if(!this.form.ComplaintType)return'请选择投诉类型';if(this.form.Title.trim().length<4)return'投诉标题至少填写4个字';if(this.form.Content.trim().length<10)return'事实与诉求至少填写10个字';if(this.form.SubmitterPhone&&!/^1\d{10}$/.test(this.form.SubmitterPhone.trim()))return'请输入正确的手机号码';if(this.uploadPending)return'请等待材料上传完成或删除失败文件';return''},
    async submit(){if(this.submitting)return;if(!this.isLoggedIn){this.goLogin();return}const message=this.validate();if(message){uni.showToast({title:message,icon:'none'});return}this.submitting=true;uni.showLoading({title:'正在提交',mask:true});try{const result=await submitComplaint({...this.form,Title:this.form.Title.trim(),Content:this.form.Content.trim(),ExpectedResult:this.form.ExpectedResult.trim(),RelatedNo:this.form.RelatedNo.trim(),SubmitterPhone:this.form.SubmitterPhone.trim(),PublicConsent:this.form.PublicConsent?1:0});const data=result.Data||{};uni.removeStorageSync('xjy_complaint_draft_key');uni.showToast({title:'投诉已提交',icon:'success'});setTimeout(()=>uni.redirectTo({url:`/pages/complaint/detail?id=${encodeURIComponent(data.Id||'')}`}),650)}catch(error){uni.showToast({title:error.message||'提交失败',icon:'none'})}finally{uni.hideLoading();this.submitting=false}},
    openDetail(item){const isPublic=this.activeTab==='public';uni.navigateTo({url:`/pages/complaint/detail?id=${encodeURIComponent(item.Id||item.ComplaintId||'')}${isPublic?'&public=1':''}`})},
    statusLabel(value){return STATUS_LABELS[value]||value||'未知'},statusTone(value){return ['Closed'].includes(value)?'tone-success':['Rejected','Withdrawn'].includes(value)?'tone-muted':['PendingAcceptance','PendingSupplement'].includes(value)?'tone-warning':'tone-primary'},
    typeLabel(value){return TYPE_LABELS[value]||value||'其他'},severityLabel(value){return SEVERITY_LABELS[value]||value||'一般'},deadlineLabel(value){return{Accept:'受理截止',FirstReply:'首响截止',Feedback:'反馈截止',Resolve:'办结截止'}[value]||'处理截止'},hoursText(value){return `${Number(value||0).toFixed(1)}小时`},
    goLogin(){const redirect=encodeURIComponent(`/pages/complaint/index?tab=${this.activeTab}`);uni.navigateTo({url:`${getProfileRoute('login','/pages/login/index')}?redirect=${redirect}`})},
    goBack(){uni.navigateBack({fail:()=>uni.switchTab({url:'/pages/profile/index'})})}
  }
}
</script>

<style scoped>
.complaint-page{height:100vh;overflow:hidden}.tab-strip{display:grid;grid-template-columns:repeat(3,1fr);height:82rpx;padding:0 24rpx;border-bottom:1px solid #e3ecef;background:#fff}.tab-item{position:relative;display:flex;align-items:center;justify-content:center;color:#718890;font-size:24rpx}.tab-item.active{color:#087da8;font-weight:750}.tab-item.active:after{position:absolute;right:28rpx;bottom:0;left:28rpx;height:5rpx;border-radius:5rpx;background:#e54625;content:''}.page-scroll{height:calc(100vh - var(--mci-safe-top) - 44px - 82rpx)}.notice-card{display:grid;grid-template-columns:64rpx minmax(0,1fr);gap:16rpx;margin:18rpx 20rpx;padding:22rpx;border:1px solid #dcecf1;border-radius:10px;background:linear-gradient(135deg,#edf8fb,#fff)}.notice-icon{display:flex;align-items:center;justify-content:center;width:64rpx;height:64rpx;border-radius:8px;background:#fff}.notice-icon image{width:38rpx;height:38rpx}.notice-card>view:last-child text{display:block}.notice-card>view:last-child text:first-child{color:#24515f;font-size:25rpx;font-weight:750}.notice-card>view:last-child text:last-child{margin-top:8rpx;color:#728a93;font-size:21rpx;line-height:32rpx}.form-card,.sla-card{margin:16rpx 20rpx;padding:0 22rpx 24rpx;border-radius:10px;background:#fff;box-shadow:0 8rpx 26rpx rgba(36,75,90,.05)}.section-head{display:flex;align-items:center;justify-content:space-between;min-height:82rpx;border-bottom:1px solid #edf2f4}.section-head text:first-child{color:#294e5b;font-size:26rpx;font-weight:750}.section-head text:last-child{color:#91a2a8;font-size:20rpx}.form-row{display:grid;grid-template-columns:180rpx minmax(0,1fr) 22rpx;align-items:center;min-height:82rpx;border-bottom:1px solid #edf2f4;font-size:23rpx}.form-row>text:first-child{color:#607982}.form-row>text:nth-child(2){overflow:hidden;color:#294e5b;text-align:right;text-overflow:ellipsis;white-space:nowrap}.form-row>text:last-child{color:#a1b0b6;font-size:30rpx;text-align:right}.placeholder{color:#a1afb5!important}.field-block{padding:20rpx 0;border-bottom:1px solid #edf2f4}.field-block>text,.upload-block>text{display:block;margin-bottom:13rpx;color:#607982;font-size:22rpx}.field-block input{box-sizing:border-box;height:72rpx;padding:0 17rpx;border:1px solid #dce7eb;border-radius:7px;color:#294e5b;background:#f8fafb;font-size:23rpx}.field-block textarea{box-sizing:border-box;width:100%;height:220rpx;padding:17rpx;border:1px solid #dce7eb;border-radius:7px;color:#294e5b;background:#f8fafb;font-size:23rpx;line-height:36rpx}.field-block .textarea-short{height:150rpx}.sla-grid{display:grid;grid-template-columns:repeat(4,1fr);padding:22rpx 0}.sla-grid view{text-align:center}.sla-grid text{display:block}.sla-grid text:first-child{color:#087da8;font-size:25rpx;font-weight:800}.sla-grid text:last-child{margin-top:7rpx;color:#81939a;font-size:18rpx}.sla-note{display:block;padding:16rpx;border-radius:7px;color:#768b93;background:#f5f8f9;font-size:20rpx;line-height:31rpx}.upload-block{padding-top:22rpx}.consent-row{display:grid;grid-template-columns:38rpx minmax(0,1fr);gap:14rpx;margin:16rpx 20rpx;padding:22rpx;border-radius:9px;background:#fff}.checkbox{display:flex;align-items:center;justify-content:center;width:34rpx;height:34rpx;border:1px solid #bdcdd3;border-radius:5px;color:#fff;font-size:22rpx}.checkbox.checked{border-color:#087da8;background:#087da8}.consent-row>view:last-child text{display:block}.consent-row>view:last-child text:first-child{color:#345963;font-size:22rpx}.consent-row>view:last-child text:last-child{margin-top:8rpx;color:#87999f;font-size:19rpx;line-height:29rpx}.confidential-note{margin:16rpx 20rpx;padding:20rpx;border-left:6rpx solid #e54625;border-radius:7px;color:#765147;background:#fff4f0;font-size:21rpx;line-height:32rpx}.search-row{display:grid;grid-template-columns:minmax(0,1fr) 100rpx;gap:12rpx;margin:18rpx 20rpx}.search-row input{height:70rpx;padding:0 20rpx;border-radius:8px;background:#fff;font-size:22rpx}.search-row view{display:flex;align-items:center;justify-content:center;border-radius:8px;color:#fff;background:#087da8;font-size:22rpx}.case-list{padding:18rpx 20rpx}.case-card{margin-bottom:15rpx;padding:22rpx;border-radius:10px;background:#fff;box-shadow:0 7rpx 22rpx rgba(32,69,83,.05);transition:transform .14s ease}.case-card--pressed{transform:scale(.985)}.case-head{display:flex;align-items:center;justify-content:space-between}.case-head>text:first-child{color:#789099;font-size:19rpx}.case-head>text:last-child{padding:6rpx 11rpx;border-radius:5px;font-size:18rpx}.tone-primary{color:#087da8;background:#e8f6fa}.tone-success{color:#1d825c;background:#e9f7f0}.tone-warning{color:#ad6b14;background:#fff5df}.tone-muted{color:#75878e;background:#edf1f2}.case-title{display:block;margin-top:14rpx;color:#294e5b;font-size:26rpx;font-weight:750}.case-summary{display:-webkit-box;overflow:hidden;margin-top:10rpx;color:#6f858d;font-size:21rpx;line-height:32rpx;-webkit-box-orient:vertical;-webkit-line-clamp:2}.case-meta{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:15rpx;color:#87999f;font-size:19rpx}.case-meta text:not(:last-child){padding:5rpx 9rpx;border-radius:5px;background:#f2f6f7}.deadline-row,.public-metrics{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:15rpx;padding-top:14rpx;border-top:1px solid #eef2f4;color:#6c828a;font-size:19rpx}.deadline-row text:last-child{color:#d24c31}.public-metrics text{padding:5rpx 9rpx;border-radius:5px;background:#f3f7f8}.list-footer{display:block;padding:20rpx;color:#9aa8ad;font-size:19rpx;text-align:center}.state-panel{min-height:58vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40rpx;color:#748991;font-size:23rpx;text-align:center}.state-panel--inline{min-height:48vh}.state-panel image{width:100rpx;height:100rpx;opacity:.46}.state-panel>text{max-width:520rpx;margin-top:18rpx;line-height:36rpx}.state-action{margin-top:22rpx;padding:14rpx 28rpx;border-radius:7px;color:#fff;background:#087da8}.submit-bar{position:fixed;right:0;bottom:0;left:0;z-index:18;display:grid;grid-template-columns:minmax(0,1fr) 220rpx;gap:16rpx;align-items:center;box-sizing:border-box;min-height:112rpx;padding:14rpx max(22rpx,var(--mci-safe-right)) calc(14rpx + var(--mci-safe-bottom)) max(22rpx,var(--mci-safe-left));border-top:1px solid #e3ebee;background:rgba(255,255,255,.97)}.submit-bar>text{color:#7e9198;font-size:19rpx;line-height:29rpx}.submit-button{display:flex;align-items:center;justify-content:center;height:74rpx;border-radius:8px;color:#fff;background:#e54625;font-size:24rpx;font-weight:750;transition:transform .14s ease}.submit-button--pressed{transform:scale(.97)}.submit-button.disabled{opacity:.56}.bottom-space{height:150rpx}@media(prefers-reduced-motion:reduce){.case-card,.submit-button{transition:none}}
</style>
