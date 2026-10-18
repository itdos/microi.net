<template>
    <section class="mcp-role-editor" aria-label="MCP AI 开发角色授权">
        <div class="mcp-role-heading"><div><h3>允许连接 MCP 进行 AI 开发的角色</h3><p>角色授权在这里与角色管理同步；未授权角色默认关闭。</p></div><el-tag effect="plain">角色权限</el-tag></div>
        <div class="mcp-role-toolbar"><el-input v-if="!roleId" v-model="keyword" placeholder="搜索角色名称" clearable @keyup.enter="search" @clear="search"/><el-button v-if="!roleId" @click="search">搜索</el-button><el-button :loading="loading" @click="reload">刷新</el-button></div>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon/>
        <el-table v-mci-loading:table="loading" :data="rows" row-key="Id" class="mcp-role-table" max-height="380" empty-text="没有匹配的角色">
            <el-table-column prop="Name" label="角色" min-width="150"><template #default="{row}"><strong>{{ row.Name }}</strong><div v-if="Number(row.Level)>=9999" class="mcp-admin-note">超级管理员始终拥有完整权限</div></template></el-table-column>
            <el-table-column label="允许 MCP 连接" width="140" align="center"><template #default="{row}"><el-switch :model-value="Number(row.Level)>=9999 || row.Policy.Enabled" :disabled="locked(row)" :aria-label="row.Name+'允许 MCP 连接'" @update:model-value="value=>change(row,'Enabled',value)"/></template></el-table-column>
            <el-table-column label="访问范围" min-width="240"><template #default="{row}"><el-select :model-value="Number(row.Level)>=9999?'Full':row.Policy.Scope" :disabled="locked(row)||!row.Policy.Enabled" :aria-label="row.Name+'MCP 访问范围'" @update:model-value="value=>change(row,'Scope',value)"><el-option label="仅角色模块及对应表单" value="Role"/><el-option label="完整 MCP 开发范围" value="Full"/></el-select></template></el-table-column>
            <el-table-column label="创建 / 修改" width="120" align="center"><template #default="{row}"><el-checkbox :model-value="Number(row.Level)>=9999 || row.Policy.CanWrite" :disabled="locked(row)||!row.Policy.Enabled" :aria-label="row.Name+'创建修改'" @update:model-value="value=>change(row,'CanWrite',value)"/></template></el-table-column>
            <el-table-column label="删除" width="80" align="center"><template #default="{row}"><el-checkbox :model-value="Number(row.Level)>=9999 || row.Policy.CanDelete" :disabled="locked(row)||!row.Policy.Enabled" :aria-label="row.Name+'删除'" @update:model-value="value=>change(row,'CanDelete',value)"/></template></el-table-column>
        </el-table>
        <p class="mcp-role-boundary">受限范围保留模块、表单、行与字段权限。完整范围及两个写入开关同时启用后可开发服务端脚本，具备高权限执行能力，只应授予可信开发者。角色授权入口仅限超级管理员。</p>
        <div class="mcp-role-footer"><el-pagination v-if="!roleId" layout="prev, pager, next, total" :total="total" :page-size="50" :current-page="page" :disabled="dirty||saving" @current-change="turnPage"/><span v-if="dirty">有 {{ changes.length }} 个角色待保存</span><el-button v-if="!deferred" type="primary" :loading="saving" :disabled="readonly||loading||!dirty||!!error" @click="save">保存角色授权</el-button></div>
    </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { DiyCommon } from '@/utils/diy.common';
import { changedMcpRoles, emptyMcpPolicy, normalizeMcpPolicy } from '@/utils/mcp-role-permissions';
const props=defineProps({roleId:{type:String,default:''},roleName:{type:String,default:'新角色'},roleLevel:{type:Number,default:0},readonly:Boolean,deferred:Boolean});
const emit=defineEmits(['change']);
const rows=ref([]), originals=ref({}), keyword=ref(''),page=ref(1),total=ref(0),loading=ref(false),saving=ref(false),error=ref('');
let generation=0,pending=Promise.resolve(true);
const changes=computed(()=>changedMcpRoles(rows.value,originals.value)),dirty=computed(()=>changes.value.length>0);
const locked=row=>props.readonly||loading.value||saving.value||Number(row.Level)>=9999;
// 角色数组与嵌套策略必须保留 JSON 类型；默认 form 会将 Roles 编码为字符串。
const action=async(Action,data={})=>{const result=await DiyCommon.Http.Post({Url:'/apiengine/platform-sys-role',PostParam:{Action,...data},ParamType:'json'});return typeof result==='string'?JSON.parse(result):result;};
function changed(notify=true){if(props.deferred&&rows.value[0])emit('change',{Policy:normalizeMcpPolicy(rows.value[0].Policy),Version:rows.value[0].Version},notify);}
function change(row,key,value){row.Policy=normalizeMcpPolicy({...row.Policy,[key]:value});changed();}
async function load(){
    const version=++generation;loading.value=true;error.value='';rows.value=[];originals.value={};
    try{
        const result=props.deferred&&!props.roleId?{Code:1,Data:[{Id:'',Name:props.roleName,Level:props.roleLevel,Policy:emptyMcpPolicy(),Version:'none'}],DataCount:1}:await action('GetMcpRolePermissions',{RoleId:props.roleId,Keyword:keyword.value,PageIndex:page.value,PageSize:50});
        if(version!==generation)return false;
        if(result?.Code!==1||!Array.isArray(result.Data))throw new Error(result?.Msg||'角色 MCP 授权加载失败');
        rows.value=result.Data.map(row=>({...row,Policy:normalizeMcpPolicy(row.Policy)}));total.value=result.DataCount||0;
        originals.value=Object.fromEntries(rows.value.map(row=>[row.Id,{...row.Policy}]));changed(false);return true;
    }catch(e){if(version===generation)error.value=e.message||'加载失败';return false;}
    finally{if(version===generation)loading.value=false;}
}
async function reload(){if(dirty.value){try{await ElMessageBox.confirm('刷新会丢弃尚未保存的角色授权变更，继续吗？','重新读取角色授权',{confirmButtonText:'丢弃并刷新',cancelButtonText:'保留变更',type:'warning'});}catch{return;}}pending=load();await pending;}
function search(){if(dirty.value){ElMessage.warning('请先保存当前变更，再搜索。');return;}page.value=1;reload();}
function turnPage(value){page.value=value;reload();}
async function save(){
    if(props.readonly||saving.value||!dirty.value)return;
    saving.value=true;
    try{const expected=structuredClone(changes.value.map(row=>({...row,Policy:{...row.Policy}})));const result=await action('SaveMcpRolePermissions',{Roles:expected});if(result?.Code!==1)throw new Error(result?.Msg||'保存失败');if(!await load())throw new Error('保存已执行，但回读失败，请刷新核对，勿重复提交。');if(expected.some(row=>JSON.stringify(row.Policy)!==JSON.stringify(rows.value.find(item=>item.Id===row.Id)?.Policy)))throw new Error('保存后授权已发生变化，请核对最新回读结果。');ElMessage.success('已保存并回读，角色管理同步生效。');}
    catch(e){error.value=e.message||'保存失败，请回读后重试';ElMessage.error(error.value);}
    finally{saving.value=false;}
}
watch(()=>props.roleId,()=>{pending=load();},{immediate:true});
watch(()=>[props.roleName,props.roleLevel],()=>{if(props.deferred&&rows.value[0]){rows.value[0].Name=props.roleName;rows.value[0].Level=props.roleLevel;}});
onBeforeUnmount(()=>{generation++;});
defineExpose({flushPendingSync:async()=>{await pending;return !error.value&&!loading.value;}});
</script>
<style scoped>
.mcp-role-editor{--mcp-space:calc(16px * var(--mci-ui-scale,1));color:var(--el-text-color-primary);min-width:0}
.mcp-role-heading,.mcp-role-toolbar,.mcp-role-footer{display:flex;align-items:center;gap:calc(10px * var(--mci-ui-scale,1));margin-bottom:var(--mcp-space)}
.mcp-role-heading{justify-content:space-between}.mcp-role-heading h3{font-size:calc(15px * var(--mci-ui-scale,1));margin:0 0 6px}.mcp-role-heading p,.mcp-role-boundary,.mcp-admin-note{color:var(--el-text-color-secondary);font-size:calc(12px * var(--mci-ui-scale,1));line-height:1.6;margin:0}.mcp-role-toolbar .el-input{max-width:320px}.mcp-role-boundary{margin:var(--mcp-space) 0}.mcp-role-footer{justify-content:flex-end;flex-wrap:wrap}.mcp-role-footer .el-pagination{margin-right:auto}.mcp-role-table{border:1px solid var(--el-border-color-light);border-radius:var(--el-border-radius-base)}
</style>
