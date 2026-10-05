<template>
  <section class="mci-business-notifications">
    <div class="mci-business__toolbar">
      <label class="mci-business__search"><MciMessageIcon name="search"/><input v-model.trim="keyword" type="search" :placeholder="isLogs ? '搜索通知标题' : '搜索消息名称或 Key'" :aria-label="isLogs ? '搜索通知标题' : '搜索业务通知'" @keyup.enter="load(1)"></label>
      <select v-if="isLogs" v-model="channelFilter" aria-label="筛选通知通道" @change="load(1)"><option value="">全部通道</option><option v-for="channel in channels" :key="channel">{{ channel }}</option></select>
      <button :disabled="loading" @click="load(1)">查询</button>
      <button v-if="!isLogs" class="is-primary" :disabled="busy" @click="startNew"><MciMessageIcon name="plus"/>新增业务通知</button>
    </div>
    <div v-if="loading" class="mci-business__skeleton" aria-label="加载通知配置"><i v-for="n in 5" :key="n"></i></div>
    <div v-else-if="error" class="mci-business__empty" role="alert"><MciMessageIcon name="warning"/><h2>暂时无法加载</h2><p>{{ error }}</p><button @click="load(1)">重新加载</button></div>
    <template v-else-if="isLogs">
      <p class="mci-business__hint">查看业务通知各通道的处理结果。系统公告的发布与撤回记录可在公告详情中查看。</p>
      <div v-if="rows.length" class="mci-business__table-wrap"><table><thead><tr><th>通知 / 事件</th><th>接收帐号</th><th>通道</th><th>处理结果</th><th>读取状态</th><th>时间</th></tr></thead><tbody><tr v-for="row in rows" :key="row.Id"><td><strong>{{ row.Title }}</strong><small>{{ row.EventId }}</small></td><td><strong>{{ row.ReceiverUserName || row.ReceiverAccount || row.ReceiverUserId || "未记录接收帐号" }}</strong><small v-if="row.ReceiverAccount && row.ReceiverAccount!==row.ReceiverUserName">{{ row.ReceiverAccount }}</small></td><td><span class="mci-business__channel-tag">{{ row.ChannelType }}</span></td><td><span class="mci-business__status" :class="enabled(row.IsSuccess)?'is-success':'is-warning'">{{ enabled(row.IsSuccess)?'已处理':'未完成' }}</span></td><td>{{ row.ChannelType === '平台内部' ? enabled(row.IsRead) ? '已读' : '未读' : '—' }}</td><td>{{ formatDate(row.CreateTime) }}</td></tr></tbody></table></div>
      <div v-else class="mci-business__empty"><MciMessageIcon name="history"/><h2>暂无投递记录</h2><p>业务触发消息后，可在这里核对各通道结果。</p></div>
    </template>
    <div v-else class="mci-business__workspace">
      <aside class="mci-business__list" aria-label="业务通知规则">
        <div v-if="!rows.length" class="mci-business__empty"><MciMessageIcon name="mail"/><p>还没有配置业务通知</p></div>
        <button v-for="row in rows" :key="row.Id" class="mci-business__row" :class="{'is-selected':draft.Id===row.Id}" :disabled="busy" @click="openRule(row)">
          <span class="mci-business__row-top"><strong>{{ row.Title }}</strong><i :class="enabled(row.IsEnable)?'is-on':''">{{ enabled(row.IsEnable)?'启用':'停用' }}</i></span>
          <small>{{ row.Key }}</small><span class="mci-business__row-channels">{{ types(row.Type).join(' · ') }}</span>
        </button>
      </aside>
      <form v-if="editorOpen" class="mci-business__editor" @submit.prevent="save">
        <header><div><h2>{{ draft.Id ? draft.Title : '新增业务通知' }}</h2><p>配置业务发生时，通知哪些人、通过哪些通道送达。</p></div><label class="mci-business__check"><input v-model="draft.IsEnable" type="checkbox" :disabled="busy">启用</label></header>
        <fieldset :disabled="busy">
          <div class="mci-business__grid">
            <label><span>消息名称 <b>*</b></span><input v-model.trim="draft.Title" required maxlength="50" placeholder="如：订单审核结果"></label>
            <label><span>消息 Key <b>*</b></span><input v-model.trim="draft.Key" :readonly="!!draft.Id" required maxlength="50" pattern="[A-Za-z0-9][A-Za-z0-9_.:\-]*" placeholder="order_approved"><small>业务触发消息时使用的唯一标识。</small></label>
          </div>
          <h3><MciMessageIcon name="mail"/>通知通道</h3>
          <div class="mci-business__channels"><label v-for="channel in channels" :key="channel" :class="{'is-selected':draft.Type.includes(channel)}"><input v-model="draft.Type" type="checkbox" :value="channel"><MciMessageIcon :name="channelIcon(channel)"/><span>{{ channel }}</span></label></div>
          <div class="mci-business__grid">
            <label v-for="channel in adapterChannels" :key="channel"><span>{{ channel }}适配器 Key</span><input v-model.trim="draft.ChannelApiEngineMap[channel]" maxlength="100" :required="draft.IsEnable" :placeholder="channel === '邮件' ? '如：send_business_email' : '如：send_business_sms'"><small>选择本租户已有的发送接口；帐号密钥保留在原安全配置中。</small></label>
            <label v-if="draft.Type.includes('微信公众号模板消息')" class="is-wide"><span>微信消息模板</span><select v-model="draft.WxTplMsgId" :required="draft.IsEnable"><option value="">请选择消息模板</option><option v-for="item in templates" :key="item.Id" :value="item.Id">{{ item.Title }}{{ item.WxMpName ? ` · ${item.WxMpName}` : '' }}</option></select><small v-if="!templates.length">暂无模板，请先在微信模板配置中添加。</small></label>
          </div>
          <h3><MciMessageIcon name="users"/>接收对象</h3><p class="mci-business__hint">固定接收人和角色会合并去重；也可以留空，由业务触发时传入接收帐号。</p>
          <div class="mci-business__recipient-tabs"><button type="button" :class="{'is-selected':recipientKind==='Users'}" @click="selectKind('Users')">帐号 · {{ draft.Receivers.length }}</button><button type="button" :class="{'is-selected':recipientKind==='Roles'}" @click="selectKind('Roles')">角色 · {{ draft.ReceiversRoles.length }}</button></div>
          <div class="mci-business__recipients"><div class="mci-business__toolbar"><input v-model.trim="recipientKeyword" type="search" aria-label="搜索本租户接收对象" placeholder="搜索本租户接收对象" @keyup.enter.prevent="loadRecipients"><button type="button" :disabled="recipientLoading" @click="loadRecipients">查询</button></div>
            <div v-if="recipientLoading" class="mci-business__skeleton"><i></i></div>
            <div v-else class="mci-business__options"><label v-for="item in recipients" :key="item.Key" class="mci-business__check"><input v-model="draft[recipientField]" type="checkbox" :value="item.Key"><span>{{ item.Name }}</span></label><p v-if="!recipients.length">没有匹配的接收对象。</p></div>
            <div v-if="missingRecipients.length" class="mci-business__selected"><span v-for="key in missingRecipients" :key="key">{{ key }}<button type="button" :aria-label="`移除 ${key}`" @click="removeRecipient(key)">×</button></span></div>
          </div>
        </fieldset>
        <footer><small>{{ dirty ? '有未保存的修改' : draft.Id ? '配置已保存' : '新建配置' }}</small><button type="button" :disabled="busy" @click="validate">检查配置</button><button class="is-primary" type="submit" :disabled="busy">{{ busy?'处理中…':'保存配置' }}</button></footer>
      </form>
      <div v-else class="mci-business__empty"><MciMessageIcon name="mail"/><h2>让业务通知井然有序</h2><p>选择一条配置，或新增业务通知。</p></div>
    </div>
    <div v-if="total>50" class="mci-business__pagination"><button :disabled="page===1||loading" @click="load(page-1)">上一页</button><span>第 {{ page }} 页 · 共 {{ total }} 条</span><button :disabled="page*50>=total||loading" @click="load(page+1)">下一页</button></div>
  </section>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { configureV8 } from './microi'
import { createNotificationConfigClient } from './notification-config-api'
import MciMessageIcon from './MciMessageIcon.vue'
const props=defineProps({view:{type:String,default:'Business'},scopeKey:{type:String,default:''}})
const emit=defineEmits(['notify','dirty','busy'])
const run=createNotificationConfigClient(configureV8)
const channels=['平台内部','邮件','短信','微信公众号模板消息']
const rows=ref([]),total=ref(0),page=ref(1),keyword=ref(''),channelFilter=ref(''),loading=ref(false),busy=ref(false),error=ref('')
const draft=ref({}),saved=ref(''),editorOpen=ref(false),templates=ref([])
const recipientKind=ref('Users'),recipientKeyword=ref(''),recipients=ref([]),recipientLoading=ref(false)
let generation=0,recipientGeneration=0,disposed=false
const isLogs=computed(()=>props.view==='Logs')
const recipientField=computed(()=>recipientKind.value==='Roles'?'ReceiversRoles':'Receivers')
const adapterChannels=computed(()=>['邮件','短信'].filter(x=>draft.value.Type?.includes(x)))
const dirty=computed(()=>editorOpen.value&&JSON.stringify(draft.value)!==saved.value)
const missingRecipients=computed(()=>(draft.value[recipientField.value]||[]).filter(key=>!recipients.value.some(x=>x.Key===key)))
const enabled=value=>value===true||Number(value)===1
const types=value=>{try{return typeof value==='string'?JSON.parse(value):value||[]}catch{return String(value).split(',')}}
const channelIcon=channel=>({'平台内部':'chat','邮件':'mail','短信':'phone','微信公众号模板消息':'bell'}[channel])
const formatDate=value=>value?String(value).replace('T',' ').slice(0,19):'—'
const notify=message=>emit('notify',String(message))
watch(dirty,value=>emit('dirty',value))
watch(busy,value=>emit('busy',value),{flush:'sync'})
function canLeave(){if(busy.value)return false;if(!dirty.value)return true;notify('当前配置有未保存的修改，请先保存，或点击“放弃修改”后切换。');return false}
function blank(){return {Key:'',Title:'',Type:['平台内部'],IsEnable:true,Receivers:[],ReceiversRoles:[],WxTplMsgId:'',ChannelApiEngineMap:{}}}
function startNew(){if(!canLeave())return;draft.value=blank();saved.value=JSON.stringify(draft.value);editorOpen.value=true;recipientKind.value='Users';recipientKeyword.value='';void loadRecipients()}
async function openRule(row){if(!canLeave())return;busy.value=true;try{const result=await run('Get',{Id:row.Id});if(disposed)return;draft.value=result.Data;saved.value=JSON.stringify(draft.value);editorOpen.value=true;void loadRecipients()}catch(e){notify(e.message)}finally{busy.value=false}}
async function load(index=1){const current=++generation;loading.value=true;error.value='';try{const result=await run(isLogs.value?'Logs':'List',{Keyword:keyword.value,ChannelType:channelFilter.value,PageIndex:index,PageSize:50});if(disposed||current!==generation)return;rows.value=result.Data||[];total.value=result.DataCount||0;page.value=index;if(!isLogs.value&&!editorOpen.value)startNew()}catch(e){if(!disposed&&current===generation)error.value=e.message}finally{if(!disposed&&current===generation)loading.value=false}}
async function loadRecipients(){const current=++recipientGeneration,kind=recipientKind.value;recipientLoading.value=true;try{const result=await run('Recipients',{Kind:kind,Keyword:recipientKeyword.value,PageSize:100});if(!disposed&&current===recipientGeneration)recipients.value=result.Data||[]}catch(e){notify(e.message)}finally{if(current===recipientGeneration)recipientLoading.value=false}}
function selectKind(kind){recipientKind.value=kind;recipientKeyword.value='';void loadRecipients()}
function removeRecipient(key){draft.value[recipientField.value]=draft.value[recipientField.value].filter(x=>x!==key)}
async function validate(){busy.value=true;try{const result=await run('Validate',{Rule:draft.value});notify((result.Data?.Warnings||[]).join(' ')||'配置检查通过，没有发送消息。')}catch(e){notify(e.message)}finally{busy.value=false}}
async function save(){if(busy.value)return;busy.value=true;try{const result=await run('Save',{Id:draft.value.Id,ExpectedRevision:draft.value.ConfigRevision,Rule:draft.value});if(disposed)return;draft.value=result.Data.Rule;saved.value=JSON.stringify(draft.value);notify(['配置已保存。',...(result.Data.Warnings||[])].join(' '));await load(page.value)}catch(e){notify(e.message)}finally{busy.value=false}}
function discard(){if(draft.value.Id){draft.value=JSON.parse(saved.value)}else{draft.value=blank();saved.value=JSON.stringify(draft.value)}}
defineExpose({dirty,discard,refresh:()=>load(page.value)})
watch(()=>`${props.scopeKey}|${props.view}`,async()=>{editorOpen.value=false;saved.value='';draft.value={};rows.value=[];emit('dirty',false);await load(1);if(!isLogs.value)try{templates.value=(await run('Templates',{PageSize:100})).Data||[]}catch(e){notify(e.message)}},{immediate:true})
onBeforeUnmount(()=>{disposed=true;generation++;recipientGeneration++;emit('busy',false)})
</script>

<style scoped>
.mci-business-notifications{color:var(--mci-text);font-size:13px}.mci-business-notifications *{box-sizing:border-box}.mci-business-notifications svg{width:18px;height:18px;flex:none}
.mci-business-notifications :is(button,input,select){font:inherit;border:1px solid var(--mci-border);border-radius:8px;background:var(--mci-card);color:var(--mci-text);min-width:0}.mci-business-notifications button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:7px 12px;cursor:pointer;line-height:1.3;transition:background .15s}.mci-business-notifications input:not([type=checkbox]),.mci-business-notifications select{width:100%;padding:8px 10px;min-height:36px}.mci-business-notifications input[type=checkbox]{width:16px;height:16px;accent-color:var(--mci-primary);flex:none}.mci-business-notifications button:hover{background:var(--mci-soft);border-color:var(--mci-primary)}.mci-business-notifications button:active{transform:translateY(1px)}.mci-business-notifications :focus-visible{outline:2px solid var(--mci-primary);outline-offset:2px}.mci-business-notifications button:disabled{opacity:.5;cursor:not-allowed}.mci-business-notifications .is-primary{background:var(--mci-primary);border-color:var(--mci-primary);color:var(--mci-on-primary)}.mci-business-notifications .is-selected{background:color-mix(in srgb,var(--mci-primary) 8%,var(--mci-card));border-color:var(--mci-primary);color:var(--mci-primary-text)}
.mci-business__toolbar{display:flex;align-items:center;gap:8px;margin:0 0 14px;flex-wrap:wrap}.mci-business__toolbar>select{width:180px}.mci-business__search{display:flex;align-items:center;gap:8px;flex:1;max-width:480px;padding:0 10px;background:var(--mci-card);border:1px solid var(--mci-border);border-radius:8px;color:var(--mci-muted)}.mci-business__search input{border:0!important;background:transparent!important}.mci-business__workspace{display:grid;grid-template-columns:280px minmax(0,1fr);gap:14px;align-items:start}.mci-business__list{display:grid;gap:7px;max-height:72vh;overflow:auto}.mci-business-notifications .mci-business__row{display:grid;text-align:left;justify-content:stretch;gap:7px;padding:12px;min-height:86px}.mci-business__row-top{display:flex;align-items:center;gap:6px;justify-content:space-between}.mci-business__row strong{overflow-wrap:anywhere;font-size:13px}.mci-business__row i{font-style:normal;font-size:10px;color:var(--mci-muted);white-space:nowrap;background:var(--mci-soft);padding:2px 5px;border-radius:4px}.mci-business__row .is-on{color:var(--mci-success,#087753);background:color-mix(in srgb,var(--mci-success,#087753) 10%,var(--mci-card))}.mci-business-notifications small,.mci-business__row-channels{font-size:11px;color:var(--mci-muted);line-height:1.6;overflow-wrap:anywhere}
.mci-business__editor{background:var(--mci-card);border:1px solid var(--mci-border);border-radius:12px;min-width:0;overflow:hidden}.mci-business__editor>header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 18px;border-bottom:1px solid var(--mci-border)}.mci-business__editor h2{font-size:16px;line-height:1.5;margin:0 0 4px}.mci-business__editor>header p{font-size:12px;color:var(--mci-muted);line-height:1.6;margin:0}.mci-business__editor fieldset{margin:0;padding:18px;border:0;min-width:0}.mci-business__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mci-business__grid>label{display:flex;flex-direction:column;gap:6px}.mci-business__grid .is-wide{grid-column:1/-1}.mci-business__grid>label>span{font-weight:600;font-size:12px}.mci-business__grid b{color:var(--mci-primary-text)}.mci-business__editor h3{display:flex;align-items:center;gap:7px;font-size:13px;margin:20px 0 10px}.mci-business__editor h3 svg{color:var(--mci-primary-text)}
.mci-business__channels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px}.mci-business__channels label{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid var(--mci-border);border-radius:8px;cursor:pointer}.mci-business__channels svg{color:var(--mci-primary-text)}.mci-business__hint{font-size:12px;line-height:1.7;color:var(--mci-muted);margin:0 0 12px}.mci-business__check{display:flex;align-items:center;gap:7px;min-height:32px}.mci-business__recipient-tabs{display:flex;gap:6px;margin-bottom:10px}.mci-business__recipients{padding:12px;background:var(--mci-bg);border:1px solid var(--mci-border);border-radius:8px}.mci-business__recipients .mci-business__toolbar input{width:auto;flex:1}.mci-business__options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 12px;max-height:180px;overflow:auto}.mci-business__options span{overflow-wrap:anywhere}.mci-business__selected{display:flex;flex-wrap:wrap;gap:6px}.mci-business__selected>span{font-size:11px;padding:3px 6px;background:var(--mci-card);border-radius:5px}.mci-business__selected button{min-height:24px;padding:2px 5px;margin-left:5px}.mci-business__editor footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:13px 18px;border-top:1px solid var(--mci-border)}.mci-business__editor footer>small{margin-right:auto}
.mci-business__empty{display:grid;align-content:center;justify-items:center;gap:8px;padding:30px;min-height:240px;text-align:center;color:var(--mci-muted);line-height:1.8}.mci-business__empty svg{width:34px;height:34px;color:var(--mci-primary-text)}.mci-business__empty h2{font-size:16px;color:var(--mci-text);margin:6px 0}.mci-business__empty p{font-size:12px;margin:0}.mci-business__skeleton{display:grid;gap:10px}.mci-business__skeleton i{height:70px;border-radius:8px;background:linear-gradient(100deg,var(--mci-soft),var(--mci-card),var(--mci-soft));background-size:250% 100%;animation:mciBusinessLoading 1.5s infinite}.mci-business__table-wrap{overflow:auto;background:var(--mci-card);border:1px solid var(--mci-border);border-radius:10px}.mci-business__table-wrap table{width:100%;border-collapse:collapse;white-space:nowrap}.mci-business__table-wrap th{font-weight:500;font-size:11px;color:var(--mci-muted);background:var(--mci-soft);text-align:left;padding:12px}.mci-business__table-wrap td{padding:13px 12px;border-top:1px solid var(--mci-border);font-size:12px}.mci-business__table-wrap td strong{display:block;max-width:320px;overflow:hidden;text-overflow:ellipsis}.mci-business__table-wrap td small{display:block;font-size:10px}.mci-business__channel-tag,.mci-business__status{display:inline-flex;padding:3px 7px;border-radius:5px;background:var(--mci-soft);font-size:11px}.mci-business__status.is-success{color:var(--mci-success,#087753)}.mci-business__status.is-warning{color:var(--mci-warning,#966000)}.mci-business__pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:16px;color:var(--mci-muted);font-size:12px}
@keyframes mciBusinessLoading{to{background-position:-200% 0}}@media(max-width:950px){.mci-business__workspace{grid-template-columns:230px minmax(0,1fr)}.mci-business__options{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.mci-business__workspace,.mci-business__grid{grid-template-columns:1fr}.mci-business__list{max-height:220px}.mci-business__channels{grid-template-columns:1fr}.mci-business__options{grid-template-columns:1fr}.mci-business-notifications button{min-height:44px}.mci-business__editor fieldset{padding:14px}.mci-business__editor footer{flex-wrap:wrap}.mci-business__editor footer>small{width:100%}.mci-business__search{max-width:none;min-width:180px}}@media(prefers-reduced-motion:reduce){.mci-business__skeleton i{animation:none}.mci-business-notifications button{transition:none}}
</style>
