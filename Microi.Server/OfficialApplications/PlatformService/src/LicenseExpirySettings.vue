<template>
  <section class="license-settings" aria-label="授权到期提醒">
    <h2>授权到期提醒</h2>
    <p>按授权到期时间自动提醒超级管理员。每次登录重新提醒，点击“我知道了”后本次登录不再弹出。</p>
    <nav v-if="capabilities.IsOfficialPlatform" aria-label="授权提醒来源">
      <button v-for="item in scopes" :key="item.key" :disabled="busy || dirty || loading" :class="{'is-primary':scope===item.key}" @click="scope=item.key;refresh()">{{ item.name }}</button>
    </nav>
    <p class="license-settings__notice">{{ scope==='Editions'?'官方策略适用于其它吾码服务器的主授权，未配置时提前 7 天提醒。':'主租户策略适用于已单独设置授权的子租户，未配置时提前 7 天提醒。官方提醒和子租户提醒分别检查，互不替代。' }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="loading">正在读取配置…</p>
    <form v-else @submit.prevent="save">
      <fieldset :disabled="busy || !loaded">
        <div class="license-settings__editions">
          <section v-for="edition in editions" :key="edition.key">
            <h3>{{ edition.name }}</h3>
            <label>提前提醒天数<input v-model.number="policy[edition.key].AdvanceDays" type="number" min="1" max="3650" required></label>
            <label>自定义提醒内容<textarea v-model="policy[edition.key].Content" rows="6" maxlength="8000" placeholder="留空使用系统默认提醒"></textarea></label>
            <small>可用占位符：{版本}、{到期时间}、{倒计时}。倒计时精确到分钟；未写占位符时会自动附加。</small>
          </section>
        </div>
        <footer><button type="submit" class="is-primary" :disabled="!dirty">{{ busy?'正在保存…':'保存并生效' }}</button><button type="button" :disabled="!dirty" @click="discard">放弃修改</button></footer>
      </fieldset>
    </form>
  </section>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { configureV8 } from './microi'
import { createPlatformReminderClient } from './platform-reminder-api'
const props=defineProps({capabilities:{type:Object,required:true}}),emit=defineEmits(['notify','dirty','busy'])
const defaults=()=>({Personal:{AdvanceDays:7,Content:''},Enterprise:{AdvanceDays:7,Content:''}})
const policy=ref(defaults()),saved=ref(JSON.stringify(defaults())),revision=ref(0),loading=ref(false),loaded=ref(false),busy=ref(false),error=ref('')
const scope=ref(props.capabilities.IsOfficialPlatform?'Editions':'Tenants')
const scopes=[{key:'Editions',name:'吾码官方授权提醒'},{key:'Tenants',name:'子租户授权提醒'}],editions=[{key:'Personal',name:'个人版'},{key:'Enterprise',name:'企业版'}]
const run=createPlatformReminderClient(configureV8),dirty=computed(()=>JSON.stringify(policy.value)!==saved.value)
watch(dirty,value=>emit('dirty',value));watch(busy,value=>emit('busy',value))
async function refresh(){loading.value=true;loaded.value=false;error.value='';try{const r=await run('LicensePolicyGet',{ScopeType:scope.value});policy.value=r.Data.Policy;revision.value=r.Data.Revision;saved.value=JSON.stringify(policy.value);loaded.value=true}catch(e){error.value=e.message}finally{loading.value=false}}
function discard(){policy.value=JSON.parse(saved.value)}
async function save(){busy.value=true;error.value='';try{await run('LicensePolicyValidate',{ScopeType:scope.value,Policy:policy.value});const result=await run('LicensePolicySave',{ScopeType:scope.value,Policy:policy.value,ExpectedRevision:revision.value});revision.value=result.Data.Revision;saved.value=JSON.stringify(result.Data.Policy);emit('notify','授权提醒已保存并生效。');await refresh()}catch(e){error.value=e.message}finally{busy.value=false}}
defineExpose({refresh,discard});onMounted(refresh)
</script>
<style scoped>
.license-settings{padding:20px;border:1px solid var(--mci-border);border-radius:12px;background:var(--mci-card)}
.license-settings h2{margin:0 0 8px}.license-settings p{line-height:1.8;color:var(--mci-muted)}
.license-settings nav,.license-settings footer{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.license-settings button{min-height:36px;padding:8px 16px;border:1px solid var(--mci-border,#dbe4f0);border-radius:8px;background:var(--mci-card,#fff);color:var(--mci-text,#243b53);font:inherit;cursor:pointer}
.license-settings button.is-primary{background:var(--mci-primary,#3775fa);border-color:var(--mci-primary,#3775fa);color:#fff}
.license-settings button:disabled{opacity:.55;cursor:default}
.license-settings input,.license-settings textarea{box-sizing:border-box;width:100%;min-height:38px;border:1px solid var(--mci-border,#dbe4f0);border-radius:8px;background:var(--mci-card,#fff);color:var(--mci-text,#243b53);padding:10px 12px;font:inherit;line-height:1.6}
.license-settings input:focus,.license-settings textarea:focus{outline:2px solid var(--mci-primary,#3775fa);outline-offset:1px}.license-settings textarea{resize:vertical}
.license-settings [role=alert]{color:#c62828}
.license-settings fieldset{border:0;padding:0;min-width:0}.license-settings__editions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.license-settings__editions section{background:var(--mci-soft);border-radius:10px;padding:18px}
.license-settings label{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}.license-settings small{line-height:1.8;color:var(--mci-muted)}
.license-settings__notice{padding:12px;border-left:3px solid var(--mci-primary);background:var(--mci-soft)}
@media(max-width:700px){.license-settings__editions{grid-template-columns:1fr}}
</style>
