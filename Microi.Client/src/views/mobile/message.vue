<template>
    <div class="mci-mobile-page page-message">
        <header class="msg-hero">
            <div class="msg-hero__decor">
                <span class="decor-orb decor-orb--1"></span>
                <span class="decor-orb decor-orb--2"></span>
            </div>
            <div class="msg-hero__safe-top"></div>
            <div class="msg-tabs">
                <div class="msg-tab" :class="{ active: activeTab === 'messages' }" @click="activeTab = 'messages'">
                    <span>消息</span>
                    <div class="tab-line" v-if="activeTab === 'messages'"></div>
                </div>
                <div class="msg-tab" :class="{ active: activeTab === 'contacts' }" @click="switchToContacts">
                    <span>通讯录</span>
                    <div class="tab-line" v-if="activeTab === 'contacts'"></div>
                </div>
            </div>
        </header>

        <div class="search-section">
            <div class="search-wrap mci-input">
                <el-icon class="search-icon"><Search /></el-icon>
                <input
                    class="search-input"
                    :placeholder="activeTab === 'messages' ? '搜索消息' : '搜索联系人'"
                    v-model="searchKeyword"
                    @input="activeTab === 'contacts' ? onContactSearchInput() : null"
                />
                <span v-if="searchKeyword" class="search-clear" @click="clearSearch">?</span>
            </div>
            <span class="search-add-btn" @click="showNewChat = true">
                <el-icon><Plus /></el-icon>
            </span>
        </div>

        <div class="msg-scroll" v-if="activeTab === 'messages'">
            <div v-if="loading && filteredMessageList.length === 0" class="skeleton-list">
                <div class="sk-item mci-card" v-for="i in 5" :key="i">
                    <div class="sk-avatar"></div>
                    <div class="sk-content">
                        <div class="sk-line sk-name"></div>
                        <div class="sk-line sk-msg"></div>
                    </div>
                </div>
            </div>

            <div class="mci-cell-group">
                <div
                    v-for="(msg, idx) in filteredMessageList"
                    :key="msg.ContactUserId"
                    class="mci-cell msg-item mci-stagger-item"
                    :style="{ '--mci-index': idx }"
                    @click="openChat(msg)"
                >
                    <div class="msg-avatar-wrap">
                        <el-avatar
                            :size="46"
                            :src="DiyCommon.GetServerPath(msg.ContactUserAvatar)"
                            class="mci-avatar"
                        >
                            {{ (msg.ContactUserName || '?').charAt(0) }}
                        </el-avatar>
                        <span v-if="msg.UnRead > 0" class="mci-badge unread-badge">
                            {{ msg.UnRead > 99 ? '99+' : msg.UnRead }}
                        </span>
                    </div>
                    <div class="msg-body">
                        <div class="msg-top">
                            <span class="msg-name">{{ msg.ContactUserName }}</span>
                            <span class="msg-time">{{ formatTime(msg.UpdateTime) }}</span>
                        </div>
                        <div class="msg-bottom">
                            <span class="msg-preview" :class="{ 'has-unread': msg.UnRead > 0 }">
                                {{ msg.LastMessage ? msg.LastMessage.replace(/<[^>]+>/g, '') : '' }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="!loading && filteredMessageList.length === 0" class="empty-state mci-card">
                <span class="empty-state__icon">📭</span>
                <span class="empty-state__title">暂无消息</span>
                <button class="mci-btn mci-btn--primary" @click="showNewChat = true">发起聊天</button>
            </div>
        </div>

        <div class="msg-scroll" v-if="activeTab === 'contacts'" @scroll="onContactScroll">
            <div v-if="contactLoading && contactList.length === 0" class="skeleton-list">
                <div class="sk-item mci-card" v-for="i in 8" :key="i">
                    <div class="sk-avatar sk-avatar--sm"></div>
                    <div class="sk-content">
                        <div class="sk-line sk-name"></div>
                        <div class="sk-line sk-dept"></div>
                    </div>
                </div>
            </div>

            <div class="mci-cell-group">
                <div
                    v-for="(contact, idx) in contactList"
                    :key="contact.Id"
                    class="mci-cell contact-item mci-stagger-item"
                    :style="{ '--mci-index': Math.min(idx, 12) }"
                    @click="startNewChat(contact)"
                >
                    <el-avatar :size="40" :src="contact.UserImg" class="mci-avatar">
                        {{ (contact.Name || '?').charAt(0) }}
                    </el-avatar>
                    <div class="contact-info">
                        <span class="contact-name">{{ contact.Name }}</span>
                        <span class="contact-dept" v-if="contact.DepartmentName">{{ contact.DepartmentName }}</span>
                    </div>
                </div>
            </div>

            <div v-if="contactLoadingMore" class="loading-more-hint">加载中...</div>
            <div v-else-if="!contactHasMore && contactList.length > 0" class="loading-more-hint">已加载全部联系人</div>

            <div v-if="!contactLoading && contactList.length === 0" class="empty-state mci-card">
                <span class="empty-state__icon">👥</span>
                <span class="empty-state__title">暂无联系人</span>
            </div>
        </div>

        <el-dialog v-model="showNewChat" title="选择联系人" width="92%" class="mci-submenu-dialog" align-center>
            <div class="contact-search">
                <el-input v-model="contactKeyword" placeholder="搜索联系人" :prefix-icon="Search" clearable @input="searchContacts" />
            </div>
            <div class="dialog-contact-list">
                <div v-for="contact in dialogContactList" :key="contact.Id" class="mci-cell" @click="startDialogChat(contact)">
                    <el-avatar :size="36" :src="contact.UserImg" class="mci-avatar">
                        {{ (contact.Name || '?').charAt(0) }}
                    </el-avatar>
                    <div class="contact-info">
                        <span class="contact-name">{{ contact.Name }}</span>
                        <span class="contact-dept" v-if="contact.DepartmentName">{{ contact.DepartmentName }}</span>
                    </div>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useDiyStore } from '@/pinia';
import { Search, Plus } from '@element-plus/icons-vue';
import { getLastContacts, formatTime as chatFormatTime, initWebSocketEvents, cleanupWebSocketEvents } from '@/utils/chat.common';
import { DiyCommon } from '@/utils/diy.common';

defineOptions({ name: 'mobile_message' });

const router = useRouter();
const diyStore = useDiyStore();
const currentUser = computed(() => diyStore.GetCurrentUser);

const activeTab = ref('messages');
const searchKeyword = ref('');
const contactKeyword = ref('');
const showNewChat = ref(false);
const loading = ref(true);
const contactLoading = ref(false);
const messageList = ref([]);
const contactList = ref([]);
const contactPageIndex = ref(1);
const contactPageSize = ref(20);
const contactHasMore = ref(true);
const contactLoadingMore = ref(false);
const dialogContactList = ref([]);

let websocket = null;
let wsEventsRegistered = false;

const filteredMessageList = computed(() => {
    if (!searchKeyword.value) return messageList.value;
    return messageList.value.filter(msg =>
        msg.ContactUserName?.includes(searchKeyword.value) ||
        msg.LastMessage?.includes(searchKeyword.value)
    );
});

let contactSearchTimer = null;
const onContactSearchInput = () => {
    clearTimeout(contactSearchTimer);
    contactSearchTimer = setTimeout(() => {
        contactPageIndex.value = 1;
        contactHasMore.value = true;
        loadContacts(false);
    }, 300);
};

const searchContacts = () => {
    if (!contactKeyword.value) { loadContacts(); return; }
    DiyCommon.Post('/api/SysUser/GetSysUserPublicInfo', {
        State: 1, _PageIndex: 1, _PageSize: 15, _Keyword: contactKeyword.value
    }, function(result) {
        if (DiyCommon.Result(result)) dialogContactList.value = result.Data || [];
    });
};

const formatTime = (time) => chatFormatTime(time);

const switchToContacts = () => {
    activeTab.value = 'contacts';
    if (contactList.value.length === 0) {
        contactLoading.value = true;
        contactPageIndex.value = 1;
        contactHasMore.value = true;
        loadContacts(false);
    }
};

const openChat = (msg) => router.push({ path: '/mobile/chat', query: { id: msg.ContactUserId, name: msg.ContactUserName } });
const startNewChat = (contact) => router.push({ path: '/mobile/chat', query: { id: contact.Id, name: contact.Name } });
const startDialogChat = (contact) => {
    showNewChat.value = false;
    router.push({ path: '/mobile/chat', query: { id: contact.Id, name: contact.Name } });
};

const loadLastContacts = async () => {
    websocket = window.__VUE_APP__?.config?.globalProperties?.$websocket;
    if (!websocket || websocket.state !== 'Connected') {
        let retryCount = 0;
        const maxRetries = 20;
        const waitForConnection = () => {
            retryCount++;
            websocket = window.__VUE_APP__?.config?.globalProperties?.$websocket;
            if (websocket && websocket.state === 'Connected') doLoadLastContacts();
            else if (retryCount >= maxRetries) loading.value = false;
            else setTimeout(waitForConnection, 500);
        };
        setTimeout(waitForConnection, 500);
        return;
    }
    doLoadLastContacts();
};

const doLoadLastContacts = async () => {
    try {
        await getLastContacts(websocket, currentUser.value.Id, DiyCommon.GetOsClient());
        setTimeout(() => { if (loading.value) loading.value = false; }, 8000);
    } catch (error) {
        console.error('[移动端消息] 加载联系人失败:', error);
        loading.value = false;
    }
};

const loadContacts = (isLoadMore = false) => {
    if (isLoadMore) contactLoadingMore.value = true;
    else contactLoading.value = true;

    DiyCommon.Post('/api/SysUser/GetSysUserPublicInfo', {
        State: 1, _PageIndex: contactPageIndex.value, _PageSize: contactPageSize.value, _Keyword: searchKeyword.value || ''
    }, function(result) {
        if (DiyCommon.Result(result)) {
            const data = result.Data || [];
            if (isLoadMore) contactList.value = contactList.value.concat(data);
            else {
                if (!searchKeyword.value) {
                    contactList.value = [{ Id: 'AI', Name: 'AI助手', UserImg: '', DepartmentName: '系统' }, ...data];
                } else {
                    contactList.value = data;
                }
                dialogContactList.value = data;
            }
            const aiOffset = (!searchKeyword.value && contactPageIndex.value === 1) ? 1 : 0;
            const loadedCount = contactList.value.length - aiOffset;
            contactHasMore.value = loadedCount < (result.Total || 0);
        }
        contactLoading.value = false;
        contactLoadingMore.value = false;
    }, function() {
        contactLoading.value = false;
        contactLoadingMore.value = false;
    });
};

const onContactScroll = (e) => {
    const target = e.target;
    if (!target) return;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    if (isNearBottom && contactHasMore.value && !contactLoadingMore.value && !contactLoading.value) {
        contactPageIndex.value++;
        loadContacts(true);
    }
};

const clearSearch = () => {
    searchKeyword.value = '';
    if (activeTab.value === 'contacts') {
        contactPageIndex.value = 1;
        contactHasMore.value = true;
        loadContacts(false);
    }
};

const registerWebSocketEvents = () => {
    if (!diyStore.IsPhoneView) return;
    websocket = window.__VUE_APP__?.config?.globalProperties?.$websocket;
    if (!websocket) return;

    const success = initWebSocketEvents(websocket, {
        onReceiveMessage: (message) => {
            const existingMsg = messageList.value.find(m => m.ContactUserId === message.FromUserId);
            if (existingMsg) {
                existingMsg.LastMessage = message.Content;
                existingMsg.UpdateTime = new Date().toISOString();
                existingMsg.UnRead = (existingMsg.UnRead || 0) + 1;
            } else {
                messageList.value.unshift({
                    ContactUserId: message.FromUserId,
                    ContactUserName: message.FromUserName || '未知',
                    ContactUserAvatar: message.FromUserAvatar || '',
                    LastMessage: message.Content,
                    UpdateTime: new Date().toISOString(),
                    UnRead: 1, muted: false
                });
            }
        },
        onReceiveLastContacts: (contacts) => {
            if (contacts && contacts.length > 0) {
                messageList.value = contacts;
                const aiIndex = messageList.value.findIndex(m => m.ContactUserId === 'AI');
                if (aiIndex === -1) {
                    messageList.value.unshift({
                        ContactUserId: 'AI', ContactUserName: 'AI助手', ContactUserAvatar: '',
                        LastMessage: '点击与AI对话，有什么可以帮您？',
                        UpdateTime: new Date().toISOString(), UnRead: 0, muted: false
                    });
                } else if (aiIndex > 0) {
                    const ai = messageList.value.splice(aiIndex, 1)[0];
                    messageList.value.unshift(ai);
                }
            }
            loading.value = false;
        }
    }, { enableDuplicateCheck: true, logPrefix: '[移动端消息]', scope: 'mobile-message' });

    if (success) wsEventsRegistered = true;
};

const unregisterWebSocketEvents = () => {
    if (wsEventsRegistered) {
        cleanupWebSocketEvents(websocket, '[移动端消息]', 'mobile-message');
        wsEventsRegistered = false;
    }
};

onMounted(() => { registerWebSocketEvents(); loadLastContacts(); });
onBeforeUnmount(() => { unregisterWebSocketEvents(); });
</script>

<style lang="scss" scoped>
.page-message {
    display: flex;
    flex-direction: column;
    padding-bottom: calc(var(--mci-tabbar-height) + var(--mci-safe-bottom));
    overflow: hidden;
    height: 100vh;
}

.msg-hero {
    position: relative;
    overflow: hidden;
    background: var(--mci-gradient-primary);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    flex-shrink: 0;

    &__safe-top { height: var(--mci-safe-top); }
    &__decor { position: absolute; inset: 0; pointer-events: none; }

    &__top {
        position: relative; z-index: 1;
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--mci-space-3) var(--mci-space-4) 0;
    }

    &__title {
        font-size: var(--mci-text-lg);
        font-weight: var(--mci-font-bold);
        color: #fff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    &__action {
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
        border-radius: var(--mci-radius-full);
        cursor: pointer;
        transition: transform var(--mci-duration-fast);

        &:active { transform: scale(0.92); }
    }
}

.decor-orb {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);

    &--1 { width: 160px; height: 160px; top: -50px; right: -40px; }
    &--2 { width: 100px; height: 100px; bottom: -30px; left: 10px; }
}

.msg-tabs {
    position: relative; z-index: 1;
    display: flex;
    padding: 0 var(--mci-space-12);
}

.msg-tab {
    flex: 1; text-align: center;
    padding: var(--mci-space-2) 0 var(--mci-space-3);
    position: relative; cursor: pointer;

    span {
        font-size: var(--mci-text-base);
        color: rgba(255, 255, 255, 0.7);
        transition: color var(--mci-duration-fast);
    }
    &.active span {
        color: #fff;
        font-weight: var(--mci-font-semibold);
    }
}

.tab-line {
    position: absolute; bottom: 0; left: 50%;
    transform: translateX(-50%);
    width: 24px; height: 3px;
    border-radius: 2px;
    background: #fff;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
}

.search-section {
    padding: var(--mci-space-3) var(--mci-space-4);
    flex-shrink: 0;
    background: var(--mci-bg-base);
    display: flex;
    align-items: center;
    gap: var(--mci-space-2);
}

.search-add-btn {
    flex-shrink: 0;
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    background: var(--mci-color-primary);
    color: #fff;
    border-radius: var(--mci-radius-md);
    cursor: pointer;
    font-size: 18px;
    transition: transform var(--mci-duration-fast);

    &:active { transform: scale(0.92); }
}

.search-wrap {
    display: flex; align-items: center;
    height: 36px;
    padding: 0 var(--mci-space-3);
}

.search-icon {
    color: var(--mci-text-tertiary);
    font-size: 13px;
    margin-right: var(--mci-space-2);
}

.search-input {
    flex: 1;
    font-size: var(--mci-text-sm);
    color: var(--mci-text-primary);
    height: 100%;
    border: none; outline: none; background: transparent;

    &::placeholder { color: var(--mci-text-placeholder); }
}

.search-clear {
    font-size: var(--mci-text-xs);
    color: var(--mci-text-tertiary);
    padding: 4px;
    cursor: pointer;
}

.msg-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--mci-space-3) var(--mci-space-3);
}

.msg-item { align-items: center; gap: var(--mci-space-3); }

.msg-avatar-wrap { position: relative; flex-shrink: 0; }

:deep(.mci-avatar.el-avatar) {
    background: var(--mci-gradient-primary);
    color: #fff;
    font-weight: var(--mci-font-semibold);
    box-shadow: 0 2px 8px var(--mci-color-primary-glow);
}

.unread-badge {
    position: absolute; top: -2px; right: -2px;
    min-width: 18px; height: 18px;
    border-radius: 9px;
    background: var(--mci-color-danger);
    box-shadow: 0 2px 6px rgba(255, 64, 87, 0.5);
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px;
    font-size: 10px; color: #fff;
    font-weight: var(--mci-font-medium);
}

.msg-body { flex: 1; min-width: 0; }

.msg-top {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 4px;
}

.msg-name {
    font-size: var(--mci-text-base);
    font-weight: var(--mci-font-medium);
    color: var(--mci-text-primary);
}

.msg-time {
    font-size: var(--mci-text-xs);
    color: var(--mci-text-tertiary);
    flex-shrink: 0;
}

.msg-bottom { display: flex; align-items: center; }

.msg-preview {
    font-size: var(--mci-text-sm);
    color: var(--mci-text-tertiary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    flex: 1;

    &.has-unread {
        color: var(--mci-text-secondary);
        font-weight: var(--mci-font-medium);
    }
}

.contact-item { align-items: center; gap: var(--mci-space-3); }

.contact-info {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 2px;
}

.contact-name {
    font-size: var(--mci-text-sm);
    font-weight: var(--mci-font-medium);
    color: var(--mci-text-primary);
}

.contact-dept {
    font-size: var(--mci-text-xs);
    color: var(--mci-text-tertiary);
}

.empty-state {
    display: flex; flex-direction: column;
    align-items: center;
    gap: var(--mci-space-3);
    padding: var(--mci-space-12) var(--mci-space-6);

    &__icon {
        font-size: 48px;
        filter: drop-shadow(0 4px 12px var(--mci-color-primary-glow));
    }
    &__title {
        font-size: var(--mci-text-base);
        color: var(--mci-text-secondary);
    }
}

.loading-more-hint {
    text-align: center;
    padding: var(--mci-space-3) 0;
    color: var(--mci-text-tertiary);
    font-size: var(--mci-text-xs);
}

.skeleton-list {
    display: flex; flex-direction: column;
    gap: var(--mci-space-2);
    padding-top: var(--mci-space-2);
}

.sk-item {
    display: flex; align-items: center;
    gap: var(--mci-space-3);
    padding: var(--mci-space-3);
}

.sk-avatar {
    width: 46px; height: 46px;
    border-radius: 50%;
    background: linear-gradient(90deg,
        var(--mci-bg-card) 25%,
        var(--mci-bg-card-hover) 50%,
        var(--mci-bg-card) 75%);
    background-size: 400% 100%;
    animation: mciShimmer 1.5s infinite;
    flex-shrink: 0;

    &--sm { width: 40px; height: 40px; }
}

.sk-content { flex: 1; display: flex; flex-direction: column; gap: 8px; }

.sk-line {
    height: 12px;
    border-radius: var(--mci-radius-full);
    background: linear-gradient(90deg,
        var(--mci-bg-card) 25%,
        var(--mci-bg-card-hover) 50%,
        var(--mci-bg-card) 75%);
    background-size: 400% 100%;
    animation: mciShimmer 1.5s infinite;
}

.sk-name { width: 30%; }
.sk-msg { width: 70%; }
.sk-dept { width: 50%; }

@keyframes mciShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.contact-search { padding: 0 0 var(--mci-space-3); }

.dialog-contact-list {
    max-height: 50vh;
    overflow-y: auto;
}
</style>
