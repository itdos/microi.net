import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync(new URL('../src/PersonalSettings.vue', import.meta.url), 'utf8')
const loadSource = source.slice(source.indexOf('async function load()'), source.indexOf('async function saveProfile()'))
const tabSource = source.slice(source.indexOf('async function selectTab('), source.indexOf('function askConfirmation('))
function fixture(overrides = {}) {
  const calls = [], box = {
    loading: {value:true}, user: {value:{}}, profile: {}, preference: {},
    context: {osClient:'tenant'}, passwordOnly:false, activeTab:{value:'profile'},
    sectionsLoaded: {}, sectionLoading:{value:false}, sectionError:{value:''}, sectionRequests:new Map(),
    capabilities:{value:{}}, authenticators:{value:[]}, totpAuthenticators:{value:[]},
    externalBindings:{value:[]}, externalProviders:{value:[]}, terminals:{value:[]}, availableMenus:{value:[]},
    client: {post:async(url,args)=>{calls.push({url,args});return {Code:1,Data:{Id:'me',Name:'姓名'}}},extractUploadPath:x=>x||''},
    refreshAvatarUrls:()=>new Promise(()=>{}), asEnabled:Boolean, parseMenuIds:()=>[],
    showNotice:()=>{}, loadCapabilities:async()=>{calls.push({url:'capabilities'});return {HasPasskey:true}},
    ...overrides
  }
  vm.createContext(box);vm.runInContext(loadSource + tabSource, box)
  return {box,calls}
}
test('个人资料首屏只请求精简本人投影，不等待头像与其它分类',async()=>{
  const {box,calls}=fixture();await box.load()
  assert.equal(box.loading.value,false);assert.equal(box.profile.Name,'姓名')
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/apiengine/platform-current-user')
  assert.equal(calls[0].args.View,'PersonalSettings')
})
test('分类读取合并、成功缓存，失败保持错误且下次可重试',async()=>{
  let attempts=0, release
  const {box}=fixture({loadCapabilities:()=>{attempts++;return new Promise(resolve=>{release=resolve})}})
  const first=box.selectTab('security'), second=box.selectTab('security')
  assert.equal(attempts,1);release({HasPasskey:true});await Promise.all([first,second])
  await box.selectTab('security');assert.equal(attempts,1)
  delete box.sectionsLoaded.security
  box.loadCapabilities=async()=>{throw Error('网络失败')}
  await box.selectTab('security');assert.equal(box.sectionError.value,'网络失败');assert.equal(box.sectionsLoaded.security,undefined)
  box.loadCapabilities=async()=>({HasPasskey:true});await box.selectTab('security');assert.equal(box.sectionError.value,'')
})
test('已离开的分类失败不会覆盖当前资料页',async()=>{
  let reject
  const {box}=fixture({loadCapabilities:()=>new Promise((_,fail)=>{reject=fail})})
  const pending=box.selectTab('security');await box.selectTab('profile');reject(Error('晚到失败'));await pending
  assert.equal(box.activeTab.value,'profile');assert.equal(box.sectionError.value,'');assert.equal(box.sectionLoading.value,false)
})
