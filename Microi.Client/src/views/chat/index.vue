<!--群聊模板-->
<template>
    <div class="vChat-wrapper flexbox flex-alignc" v-if="DiyChatShow">
        <div class="vChat-panel" ref="chatPanel" :style="panelStyle">
            <div class="vChat-inner flexbox">
                <!-- 拖动条 -->
                <div class="vChat-dragbar" @mousedown="startDrag">
                    <span class="drag-title">聊天系统</span>
                </div>
                <!-- <win-bar></win-bar> -->
                <div class="vChat-winbtn">
                    <!-- <el-tooltip :content="maxmin ? '向下还原' : '最大化'" placement="bottom"> 
                    <a class="w-max" @click="handleMaxMin"><i class="iconfont" :class="maxmin ? 'icon-win_max' : 'icon-win_min'"></i></a>
                </el-tooltip> -->
                    <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
                        <a class="w-max" @click="toggleFullscreen" style="margin-right: 5px;">
                            <el-icon><FullScreen /></el-icon>
                        </a>
                    </el-tooltip>
                    <el-tooltip :content="'最小化'" placement="bottom">
                        <a class="w-max" @click="handleMaxMin">
                            <el-icon><Close /></el-icon>
                        </a>
                    </el-tooltip>
                </div>
                <div class="vChat-sidebar flexbox flex__direction-column">
                    <div class="avator">
                        <img class="J__avator" :src="DiyCommon.GetServerPath(GetCurrentUser.Avatar)" />
                        <!-- <i class="status J__onlineStatus" 
                        :class="onlineStatus.status" 
                        :title="onlineStatus.text">
                    </i> -->
                    </div>
                    <div class="list flex1">
                        <ul class="clearfix">
                            <!-- to="/chat" -->
                            <li :class="{ on: ChatMiddlebarType === 'RecentContacts' }">
                                <span @click="SendLastContacts(); ChatMiddlebarType = 'RecentContacts'" class="ico">
                                    <el-icon><ChatDotRound /></el-icon>
                                    <!-- <em class="wc__badge">5</em> -->
                                </span>
                            </li>
                            <!-- to="/contact" -->
                            <li :class="{ on: ChatMiddlebarType === 'Contacts' }">
                                <span class="ico">
                                    <el-icon
                                        @click="
                                            GetSysUserPublicInfo();
                                            ChatMiddlebarType = 'Contacts';
                                        "
                                    ><User /></el-icon
                                ></span>
                            </li>
                            <!-- to="/qzone" -->
                            <!-- <router-link active-class="on" tag="li" to=""><span class="ico">
                                <i class="iconfont icon-side__pyq"></i></span>
                        </router-link> -->
                        </ul>
                    </div>
                    <div class="list">
                        <ul class="clearfix">
                            <!-- to="/my" -->
                            <!-- <router-link active-class="on" tag="li" to="">
                            <span class="ico"><i class="iconfont icon-shezhi"></i></span>
                        </router-link> -->
                        </ul>
                    </div>
                </div>
                <div class="flex1 flexbox" v-mci-loading:page="FirstConnectWebsocket">
                    <!-- <record-list></record-list> -->
                    <div v-if="ChatMiddlebarType == 'RecentContacts'" class="vChat-middlebar flexbox flex__direction-column">
                        <div class="vc-searArea">
                            <div class="iptbox flexbox">
                                <el-input placeholder="搜索" prefix-:icon="Search" v-model="kw"></el-input>
                            </div>
                        </div>
                        <div class="vc-recordList flex1 flexbox flex__direction-column">
                            <ul class="clearfix J__recordList">
                                <li v-for="contact in GetLastContacts" :key="contact.ContactId" class="flexbox flex-alignc wc__material-cell" @click="SelectCurrentLastContact(contact)">
                                    <div class="img">
                                        <em v-if="contact.UnRead > 0" class="wc__badge" style="z-index: 1">{{ formatBadgeCount(contact.UnRead) }}</em>
                                        <el-image :fit="'cover'" :src="getContactAvatar(contact)"></el-image>
                                    </div>
                                    <div class="info flex1">
                                        <h2 class="title clamp1">{{ contact.ContactUserName }}</h2>
                                        <p class="desc clamp1">
                                            {{ DiyCommon.IsNull(contact.LastMessage) ? "" : contact.LastMessage.replace(/<[^>]+>/g, "") }}
                                        </p>
                                    </div>
                                    <label class="time flex-selft">
                                        {{ DiyCommon.DateTimeFormat(new Date(contact.UpdateTime), "HH:mm") }}
                                    </label>
                                </li>
                            </ul>
                            <div v-if="GetLastContacts.length === 0" class="chat-list-empty">
                                <div>没有匹配的聊天对象</div>
                                <el-button link type="primary" @click="kw = ''">清除搜索</el-button>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="ChatMiddlebarType == 'Contacts'" class="vChat-middlebar flexbox flex__direction-column">
                        <div class="vc-searArea">
                            <div class="iptbox flexbox">
                                <el-input 
                                    placeholder="搜索" 
                                    prefix-:icon="Search" 
                                    v-model="kw"
                                    @input="searchContacts"
                                    clearable></el-input>
                            </div>
                        </div>
                        <div class="vc-addrFriendList flex1 flexbox flex__direction-column" style="overflow: auto">
                            <ul class="clearfix J__addrFriendList">
                                <!-- <li> 
                                <h2 class="initial wc__borT">新的朋友</h2>
                                <router-link to="/contact/new-friends" class="row flexbox flex-alignc wc__material-cell unCTX on">   <img class="uimg" src="/static/diy-chat/img/icon__newfriend.jpg" /><span class="name flex1">新的朋友</span>
                                </router-link>
                            </li> -->
                                <li id="A">
                                    <div
                                        @click="
                                            SelectCurrentLastContact({
                                                ContactUserId: user.Id,
                                                ContactUserName: user.Name,
                                                ContactUserAccount: user.Account,
                                                ContactUserAvatar: user.Avatar
                                            });
                                        "
                                        v-for="user in AllContactsList"
                                        :key="'contacts_' + user.Id"
                                         :class="user.Id == GetCurrentLastContact.ContactUserId ? 'active' : ''"
                                    >
                                        <!-- <h2 class="initial wc__borT">A</h2> -->
                                        <router-link to="" class="row flexbox flex-alignc wc__material-cell">
                                            <img class="uimg" :src="getContactAvatar(user)" />
                                            <span class="name flex1">{{ user.Name }}</span>
                                        </router-link>
                                    </div>
                                </li>
                            </ul>
                            <div class="vc_addrTotal">{{ AllContactsList.length }}位联系人</div>
                            <!-- 加载更多按钮 -->
                            <div v-if="contactsHasMore" v-mci-loading:compact="contactsLoading" style="padding: 10px; text-align: center;">
                                <el-button
                                    v-if="!contactsLoading"
                                    @click="loadMoreContacts"
                                    size="small"
                                    style="width: 90%;">
                                    加载更多
                                </el-button>
                            </div>
                            <div v-else-if="AllContactsList.length > 0" style="padding: 10px; text-align: center; color: #999; font-size: 12px;">
                                已加载全部联系人
                            </div>
                        </div>
                    </div>
                    <div class="vChat-container flex1 flexbox flex__direction-column">
                        <div class="vChat__header">
                            <div class="inner flexbox">
                                <h2 class="barTit flex1">
                                    {{ DiyCommon.IsNull(GetCurrentLastContact.ContactUserName) ? "" : GetCurrentLastContact.ContactUserName }}
                                </h2>
                                <!-- @click="dialogVisible_notice = true" -->
                                <!-- <el-tooltip content="群公告" placement="bottom"><a class="lk"><i class="iconfont icon-gonggao"></i></a></el-tooltip> -->
                                <!-- @click="dialogVisible_shield = true" -->
                                <!-- <el-tooltip content="屏蔽消息" placement="bottom"><a class="lk"><i class="iconfont icon-pingbi"></i></a></el-tooltip> -->
                                <!-- @click="dialogVisible_groupSet = true" -->
                                <!-- <el-tooltip content="群设置" placement="bottom"><a class="lk"><i class="iconfont icon-dots"></i></a></el-tooltip> -->
                            </div>
                            <el-dialog v-model="dialogVisible_notice" width="400px">
                                <template #header>
                                    <p class="fs-18 ff-st">群公告</p>
                                </template>
                                <p class="ff-st" style="margin: -20px 0 -10px">
                                    <!-- 进群的小伙伴注意啦，修改群名，格式统一为部门加英文名（技术部-Jackson），部门有英文简称的用英名，无则用中文拼音首字母，如JS-Henory……注意大小写！ -->
                                </p>
                                <template #footer>
                                    <el-button type="primary" @click="dialogVisible_notice = false">关闭</el-button>
                                </template>
                            </el-dialog>

                            <el-dialog v-model="dialogVisible_shield" width="300px">
                                <template #header>
                                    <p class="fs-18 ff-st">提示</p>
                                </template>
                                <p class="ff-st c-999" style="margin: -20px 0 -10px">确定要屏蔽该群聊消息嚒，屏蔽后您将收不到群聊发来的消息提醒哟！</p>
                                <template #footer>
                                    <el-button @click="dialogVisible_shield = false">取消</el-button>
                                    <el-button type="primary" @click="handleShield">确定</el-button>
                                </template>
                            </el-dialog>
                        </div>
                        <div v-if="RealtimeState !== 'Connected'" class="realtime-status-banner" :data-state="RealtimeState">
                            <span class="realtime-status-dot"></span>
                            <span class="flex1">{{ RealtimeStatusText }}</span>
                            <el-button
                                v-if="RealtimeState !== 'Unavailable'"
                                link
                                type="primary"
                                @click="retryRealtimeConnection"
                            >立即重试</el-button>
                        </div>
                        <!-- <div class="vChat__notice J__vChatNotice">18条新消息</div> -->
                        <div class="fixGeminiscrollHeight" v-show="fixGeminiscrollHeight" style="font-size: 0; height: 1px"></div>
                        <div class="vChat__main flex1 flexbox flex__direction-column" style="overflow: auto">
                            <!-- <geminiScrollbar autoshow class="geminiScrollbar flex1" id="J__geminiScrollbar"> -->
                            <!-- <div class="vChat__loading J__vChatLoading">
                            <img src="../../assets/img/deng.gif" /> 数据载入中...
                        </div> -->
                            <div class="vChatMsg-cnt">
                                <ul class="clearfix" id="J__chatMsgList">
                                    <!-- <li class="time"><span>2019年04月01日 晚上19:15</span></li>
                                <li class="notice"><span>当前群聊人数较多，已显示群成员昵称，同时为了信息安全，请注意聊天隐私</span></li> -->
                                    <!-- <li class="time"><span>2019年04月01日 晚上22:30</span></li> -->
                                    <li v-for="(chat, index) in ChatRecord" :key="chat.FromUserId + index" :class="chat.FromUserId == GetCurrentUser.Id ? 'me' : 'others'">
                                        <router-link v-if="chat.FromUserId != GetCurrentUser.Id" class="avatar" to="">
                                            <img :src="getChatAvatar(chat)" style="object-fit: cover" />
                                        </router-link>
                                        <div class="content">
                                            <p class="author">
                                                <template v-if="chat.FromUserId == GetCurrentUser.Id">
                                                    <span style="color: #666">
                                                        {{ new Date(chat.CreateTime).Format("HH:mm yyyy/MM/dd") }}
                                                    </span>
                                                    {{ GetCurrentUser.Name }}
                                                </template>
                                                <template v-else>
                                                    {{ chat.FromUserName }}
                                                    <span style="color: #333">
                                                        {{ new Date(chat.CreateTime).Format("HH:mm yyyy/MM/dd") }}
                                                    </span>
                                                </template>
                                            </p>
                                            <div v-if="chat.Type == 'AJ_HourseDetail'" class="msg">
                                                <!-- <HourseCard :house-detail="chat.Content"/>  -->
                                            </div>
                                            <!-- 数据表格消息 -->
                                            <div v-else-if="chat.Type == 'data'" class="msg msg-data-table">
                                                <div v-safe-html="renderDataTable(chat.Content)"></div>
                                            </div>
                                            <!-- 普通消息 -->
                                            <div v-else class="msg" :class="{ 'streaming-message': chat.isStreaming, 'message-error': chat.isError }">
                                                <span v-if="chat.isThinking" class="thinking-indicator">
                                                    <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span> 正在思考
                                                </span>
                                                <span v-else v-safe-html="formatMessageContent(chat.Content)"></span>
                                                <span v-if="chat.isStreaming && !chat.isThinking" class="typing-cursor">▌</span>
                                                <el-button
                                                    v-if="chat.IsPlatformNotification && chat.LinkUrl"
                                                    class="platform-message-link"
                                                    link
                                                    type="primary"
                                                    @click="openPlatformMessageLink(chat.LinkUrl)"
                                                >查看详情</el-button>
                                            </div>
                                        </div>
                                        <router-link v-if="chat.FromUserId == GetCurrentUser.Id" class="avatar" to="">
                                            <img :src="DiyCommon.GetServerPath(GetCurrentUser.Avatar)" style="object-fit: cover" />
                                        </router-link>
                                    </li>
                                </ul>
                                <div v-if="!HasCurrentContact" class="chat-conversation-empty">
                                    <div class="empty-title">开始一段对话</div>
                                    <div class="empty-desc">左侧已为你固定 AI助手 和 admin 平台消息，选择一个即可开始。</div>
                                </div>
                                <div v-else-if="ChatRecord.length == 0" class="chat-conversation-empty">
                                    <div class="empty-title">还没有消息</div>
                                    <div class="empty-desc">
                                        {{ IsPlatformSystemContact ? '通知中心的平台消息会同步显示在这里。' : '发送第一条消息，或稍后重试加载历史记录。' }}
                                    </div>
                                </div>
                            </div>
                            <!-- </geminiScrollbar> -->
                        </div>

                        <div class="vChat__footTool">
                            <!-- 输入框模块 -->
                            <div
                                class="wc__editor-panel wc__borT flexbox flex__direction-column"
                                :style="{
                                    backgroundColor: CanSendCurrentMessage ? 'var(--el-bg-color, #fff)' : 'var(--el-fill-color-light, #f5f7fa)'
                                }"
                            >
                                <div class="wrap-toolbar">
                                    <div class="chat-toolbar-row flexbox flex-alignc">
                                        <div class="chat-toolbar-main flex1 flexbox flex-alignc">
                                            <div class="chat-toolbar-actions flexbox flex-alignc" aria-label="聊天附件工具">
                                                <button type="button" class="btn chat-toolbar-button btn-face" title="选择表情" aria-label="选择表情" @click="toggleEmojiPanel">
                                                    <span class="chat-emoji-glyph" aria-hidden="true">☺</span>
                                                </button>
                                                <label class="btn chat-toolbar-button btn-image" title="发送图片" aria-label="发送图片">
                                                    <el-icon><Picture /></el-icon>
                                                    <input type="file" accept="image/*" id="J__chooseImg" class="chat-file-input" />
                                                </label>
                                                <label class="btn chat-toolbar-button btn-attachment" title="发送文件" aria-label="发送文件">
                                                    <el-icon><Folder /></el-icon>
                                                    <input type="file" accept="*" id="J__chooseFile" class="chat-file-input" />
                                                </label>
                                            </div>
                                            <!-- AI聊天时显示模型选择器 -->
                                            <div v-if="GetCurrentLastContact.ContactUserId === 'AI'" class="chat-ai-model flex1 flexbox flex-alignc">
                                                <span class="chat-ai-model__label">AI模型：</span>
                                                <el-select
                                                    v-model="selectedAiModel"
                                                    value-key="Id"
                                                    size="small"
                                                    placeholder="选择AI模型"
                                                    :loading="aiModelLoading"
                                                    class="chat-ai-model__select"
                                                >
                                                    <el-option
                                                        v-for="model in aiModelList"
                                                        :key="model.Id"
                                                        :label="`${model.Name}（${model.AiModel}）`"
                                                        :value="model"
                                                    />
                                                </el-select>
                                            </div>
                                        </div>
                                        <el-popover title="Tips" placement="top" width="200" trigger="hover" content="截屏、截图可直接粘贴至文本框进行发送！">
                                            <template #reference>
                                                <button type="button" class="btn chat-toolbar-button btn-help" aria-label="输入帮助">
                                                    <el-icon><QuestionFilled /></el-icon>
                                                </button>
                                            </template>
                                        </el-popover>
                                    </div>
                                </div>
                                <div class="wrap-editor flex1">
                                    <div
                                        class="editor J__wcEditor"
                                        id="J__wcEditor"
                                        :placeholder="EditorPlaceholder"
                                        :contenteditable="CanSendCurrentMessage"
                                        style="user-select: text; -webkit-user-select: text"
                                        @keydown="handleEditorKeydown"
                                    ></div>
                                </div>
                                <el-button
                                    type="primary"
                                    :icon="Position"
                                    :loading="BtnLoading"
                                    class="btn-submit J__wchatSubmit"
                                    :disabled="!CanSendCurrentMessage"
                                    :style="{
                                        backgroundColor: CanSendCurrentMessage ? '' : '#d5d5d5'
                                    }"
                                    @click="SendMessage"
                                >
                                    发送
                                </el-button>
                            </div>
                            <!-- Emoji表情选择面板 -->
                            <div class="wc__choose-panel emoji-panel" v-show="showEmojiPanel">
                                <div class="wrap-emotion">
                                    <div class="emoji-container">
                                        <div class="emoji-categories">
                                            <div v-for="(category, index) in emojiData.categories" :key="category.id"
                                                :class="['emoji-category', { active: currentEmojiCategory === index }]"
                                                @click="currentEmojiCategory = index">
                                                {{ category.name }}
                                            </div>
                                        </div>
                                        <div class="emoji-grid">
                                            <span v-for="(emoji, index) in currentEmojis" :key="index"
                                                class="emoji-item"
                                                @click="insertEmoji(emoji)">
                                                {{ emoji }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 右下角拖动调整大小手柄 -->
            <div class="resize-handle" @mousedown="startResize" v-if="!isFullscreen"></div>
        </div>
    </div>
</template>

<script>
// import HourseCard from '@/views/aijuhome/components/card'
var _count = 0;
// Vue 3: 不再需要导入 Vue 和使用 Vue.use()
// 引入公共Js// 引入公共Js
import "./common.js";

// 引入全局组件
// Vue 3: 全局组件应该在 main.js 中通过 app.use() 注册
// import _g_component from "./components.js";
// Vue.use(_g_component);
//---end

import Swiper from "swiper";
//  import 'swiper/dist/css/swiper.css'

//import { DiyStore } from 'itdos.diy'
import _ from "underscore";
import { useDiyStore } from "@/pinia";
import drag from "@/utils/dos.common";
import { 
    formatMessageContent, 
    renderDataTable, 
    escapeHtml,
    splitTypewriterUnits,
    resolveChatDisplayName,
    normalizeChatContact,
    normalizeChatDirectoryUser,
    initWebSocketEvents,
    cleanupWebSocketEvents
} from "@/utils/chat.common";
import {
    REALTIME_STATE_EVENT,
    getRealtimeStatusText,
    normalizeRealtimeState
} from "@/utils/realtime-connection";
import {
    PLATFORM_NOTIFICATION_EVENT,
    PLATFORM_NOTIFICATION_SNAPSHOT_EVENT,
    PLATFORM_SYSTEM_CONTACT_ID,
    createPlatformSystemContact,
    mergePlatformNotification,
    normalizeNotificationLink,
    normalizePlatformNotificationResult,
    toPlatformChatRecord
} from "@/utils/platform-notification";

const AI_ASSISTANT_AVATAR = "/static/mci/ai/assistant-robot.png";
const AI_TYPEWRITER_INTERVAL = 18;

export default {
    name: "diy-chat",
    components: {
        // HourseCard
    },
    setup() {
        const diyStore = useDiyStore();
        return { diyStore };
    },
    data() {
        return {
            ChatMiddlebarType: "RecentContacts", //Contacts、RecentContacts
            BtnLoading: false,
            kw: "",
            isLoading: false, //加载控制标识
            tmpList: [],
            fixGeminiscrollHeight: true, //解决含有图片资源（高度没及时更新）
            dialogVisible_unlocker: false, //显示解除提示
            dialogVisible_notice: false, //显示公告对话框
            dialogVisible_shield: false, //消息屏蔽对话框
            dialogVisible_groupSet: false, //群设置对话框
            dialogVisible_groupSetAlert: false,
            LastContacts: [],
            UserIdsInfo: [],
            ChatRecord: [],
            // CurrentLastContact:{},
            FirstConnectWebsocket: true,
            AllContactsList: [],
            AllContactsGroup: [],
            // 流式消息相关
            currentStreamMessage: null,  // 当前正在接收的流式消息
            aiTypewriterQueue: [],
            aiTypewriterTimer: null,
            aiTypewriterCompletePending: false,
            lastAITypewriterCompletedContent: "",
            lastAITypewriterCompletedAt: 0,
            RealtimeState: normalizeRealtimeState(window.__MICROI_REALTIME_STATE__?.state),
            RealtimeRetryCount: Number(window.__MICROI_REALTIME_STATE__?.retryCount || 0),
            RealtimeRetryDelay: window.__MICROI_REALTIME_STATE__?.retryDelay ?? null,
            platformNotifications: [],
            platformUnreadCount: 0,
            boundWebsocket: null,
            // 联系人分页
            contactsPageIndex: 1,
            contactsPageSize: 15,
            contactsHasMore: true,
            contactsLoading: false,
            // 拖动相关
            isDragging: false,
            dragStartX: 0,
            dragStartY: 0,
            diyChatElement: null,
            panelLeft: null,
            panelTop: null,
            diyChatElement: null,
            // Emoji表情数据
            emojiData: {
                categories: [
                    {
                        id: 'people',
                        name: '表情',
                        emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
                                 '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
                                 '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
                                 '😎', '🤓', '🧐', '🤔', '🤨', '😐', '😑', '😶',
                                 '🙄', '😯', '🥱', '😦', '😧', '😮', '😲', '🥺',
                                 '😱', '😨', '😰', '😥', '😢', '😭', '😓', '😔']
                    },
                    {
                        id: 'gestures',
                        name: '手势',
                        emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️',
                                 '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕',
                                 '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜',
                                 '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅']
                    },
                    {
                        id: 'symbols',
                        name: '符号',
                        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
                                 '✅', '☑️', '✔️', '✖️', '❌', '❎', '➕', '➖',
                                 '➰', '➿', '〰️', '✳️', '✴️', '❇️', '‼️', '⁉️',
                                 '❓', '❔', '❕', '❗', '©️', '®️', '™️', '🔝']
                    }
                ]
            },
            currentEmojiCategory: 0,
            showEmojiPanel: false,
            // WebSocket事件是否已注册
            websocketEventsRegistered: false,
            // 全屏状态
            isFullscreen: false,
            // 拖动调整大小相关
            isResizing: false,
            resizeStartX: 0,
            resizeStartY: 0,
            resizeStartWidth: 800,
            resizeStartHeight: 500,
            // AI模型选择
            aiModelList: [],
            selectedAiModel: null,
            aiModelLoading: false
        };
    },
    watch: {
        DiyChatShow: function (show) {
            if (show) {
                this.activateChat();
            }
        },
        CurrentLastContact: function (newVal, oldVal) {
            var self = this;
            if (!self.DiyCommon.IsNull(newVal) && newVal != oldVal && self.CurrentLastContact.ContactUserId != newVal.ContactUserId) {
                self.SelectCurrentLastContact({
                    Id: newVal.ContactUserId
                });
            }
        }
    },
    computed: {
        // 从 Pinia store 获取状态
        DiyChatShow() {
            return this.diyStore.DiyChat?.Show;
        },
        CurrentLastContact() {
            return this.diyStore.DiyChat?.CurrentLastContact || {};
        },
        GetCurrentUser() {
            return this.diyStore.GetCurrentUser;
        },
        HasCurrentContact() {
            return !this.DiyCommon.IsNull(this.GetCurrentLastContact?.ContactUserId);
        },
        IsPlatformSystemContact() {
            return this.GetCurrentLastContact?.ContactUserId === PLATFORM_SYSTEM_CONTACT_ID;
        },
        CanSendCurrentMessage() {
            return this.HasCurrentContact
                && !this.IsPlatformSystemContact
                && this.RealtimeState === "Connected";
        },
        EditorPlaceholder() {
            if (!this.HasCurrentContact) return "请选择一个聊天对象！";
            if (this.IsPlatformSystemContact) return "平台消息由 admin 发送，此会话只读";
            if (this.RealtimeState !== "Connected") return "实时通信未连接，请先重试";
            return "输入文字或Ctrl+V粘贴图片...";
        },
        RealtimeStatusText() {
            return getRealtimeStatusText(
                this.RealtimeState,
                this.RealtimeRetryCount,
                this.RealtimeRetryDelay
            );
        },
        // 面板位置样式（拖动时移动wrapper）
        panelStyle() {
            var self = this;
            let style = {
                backgroundImage: 'url(src/assets/img/placeholder/vchat__panel-bg01.jpg)'
            };
            
            // 全屏模式样式
            if (self.isFullscreen) {
                style.position = 'fixed';
                style.top = '0';
                style.left = '0';
                style.right = '0';
                style.bottom = '0';
                style.width = '100vw';
                style.height = '100vh';
                style.maxWidth = '100vw';
                style.maxHeight = '100vh';
                style.zIndex = '999999';
                style.borderRadius = '0';
            }
            
            return style;
        },
        // 当前分类的emoji列表
        currentEmojis() {
            var self = this;
            if (self.emojiData && self.emojiData.categories && self.emojiData.categories[self.currentEmojiCategory]) {
                return self.emojiData.categories[self.currentEmojiCategory].emojis;
            }
            return [];
        },
        GetLastContacts: {
            get() {
                var self = this;
                const directoryByUserId = new Map(
                    (Array.isArray(self.AllContactsList) ? self.AllContactsList : [])
                        .map(item => [String(item?.Id || ""), item])
                );
                const recent = (Array.isArray(self.LastContacts) ? self.LastContacts : [])
                    .map(item => normalizeChatContact(
                        item,
                        directoryByUserId.get(String(item?.ContactUserId || item?.Id || "")),
                        "未命名用户"
                    ));
                const byUserId = new Map(
                    recent.map(item => [String(item?.ContactUserId || item?.Id || ""), item])
                );
                const aiContact = {
                    ContactId: "AI",
                    ContactUserId: "AI",
                    ContactUserName: "AI助手",
                    ContactUserAvatar: AI_ASSISTANT_AVATAR,
                    LastMessage: "点击开始与AI助手聊天",
                    UpdateTime: "",
                    UnRead: 0,
                    ...(byUserId.get("AI") || {}),
                    ContactUserName: "AI助手",
                    ContactUserAvatar: AI_ASSISTANT_AVATAR
                };
                const platformContact = createPlatformSystemContact(
                    self.platformNotifications,
                    self.platformUnreadCount
                );
                const pinnedIds = new Set(["AI", PLATFORM_SYSTEM_CONTACT_ID]);
                const merged = [
                    aiContact,
                    platformContact,
                    ...recent.filter(item => !pinnedIds.has(String(item?.ContactUserId || item?.Id || "")))
                ];
                const keyword = String(self.kw || "").trim().toLowerCase();
                if (!keyword) return merged;
                return merged.filter(item => `${item?.ContactUserName || ""} ${item?.ContactUserAccount || ""} ${item?.LastMessage || ""}`
                    .toLowerCase()
                    .includes(keyword));
                // self.LastContacts.forEach(element => {
                //     var search = _.where(self.UserIdsInfo, {Id : element.contactUserId});
                //     if(search.length > 0){
                //         search[0]['UpdateTime'] = element.updateTime;
                //         search[0]['LastMessage'] = element.lastMessage;
                //         search[0]['UnRead'] = element.unRead;
                //         search[0]['Id'] = element.contactUserId;
                //         result.push(search[0]);
                //     }else{
                //         element['UpdateTime'] = element.updateTime;
                //         element['LastMessage'] = element.lastMessage;
                //         element['UnRead'] = element.unRead;
                //         element['Name'] = element.userName;
                //         element['UserId'] = element.userId;
                //         element['ContactUserId'] = element.contactUserId;
                //         element['Avatar'] = '';
                //         // element['Id'] = index;
                //         //2021-05-08修改
                //         element['Id'] = element.contactUserId;
                //         result.push(element);
                //     }
                //     index++;
                // });
                // return result;
            }
        },
        GetCurrentLastContact: {
            get() {
                var self = this;
                return self.CurrentLastContact;
                // var search = _.where(self.UserIdsInfo, {Id : self.CurrentLastContact.contactUserId});
                // if(search.length > 0){
                //     return search[0];
                // }else{
                //     //2021-05-08修改，为了支持外部用户发送消息到os
                //     return self.CurrentLastContact;
                // }
                // return {};
            }
        },
        GetUserInfo: function () {
            return function (userId) {
                var self = this;
                var search = _.where(self.UserIdsInfo, { Id: userId });
                if (search.length > 0) {
                    return search[0];
                }
                return {};
            };
        }
    },
    mounted() {
        var self = this;
        $(function () {
            function wchat_ToBottom() {
                $(".vChat__main").animate(
                    {
                        scrollTop: $("#J__chatMsgList").height()
                    },
                    0
                );
            }
            $("body").on("click", ".wc__editor-panel .btn-face", function () {
                $(".wc__choose-panel").show();
                // 初始化swiper表情
                !emotionSwiper && $("#J__emotionFootTab ul li.cur").trigger("click");
                wchat_ToBottom();
            });

            var emotionSwiper;

            function setEmotionSwiper(tmpl) {
                var _tmpl = tmpl ? tmpl : $("#J__emotionFootTab ul li.cur").attr("tmpl");
                $("#J__swiperEmotion .swiper-container").attr("id", _tmpl);
                $("#J__swiperEmotion .swiper-wrapper").html($("." + _tmpl).html());
                emotionSwiper = new Swiper("#" + _tmpl, {
                    pagination: {
                        el: ".pagination-emotion",
                        clickable: true
                    }
                });
            }
            $("body").on("click", "#J__emotionFootTab ul li.swiperTmpl", function () {
                // 先销毁swiper
                emotionSwiper && emotionSwiper.destroy(true, true);
                var _tmpl = $(this).attr("tmpl");
                $(this).addClass("cur").siblings().removeClass("cur");
                setEmotionSwiper(_tmpl);
            });

            $("body").on("click", "#J__chatMsgList li .video", function () {
                var _src = $(this).find("img").attr("videoUrl"),
                    _video;
                var videoIdx = wcPop({
                    id: "wc__previewVideo",
                    skin: "fullscreen",
                    content: '<video id="J__videoPreview" width="100%" height="100%" controls="controls" preload="auto"></video>',
                    shade: false,
                    xclose: true,
                    style: "background: #000;padding-top:48px;",
                    anim: "scaleIn",
                    show: function () {
                        _video = document.getElementById("J__videoPreview");
                        _video.src = _src;
                        if (_video.paused) {
                            _video.play();
                        } else {
                            _video.pause();
                        }
                        _video.addEventListener("ended", function () {
                            _video.currentTime = 0;
                        });
                        _video.addEventListener("x5videoexitfullscreen", function () {
                            wcPop.close(videoIdx);
                        });
                    }
                });
            });

            // ...处理编辑器信息
            // 标记IME输入状态，防止中文输入法打字时自动换行
            var _isComposing = false;
            $("body").on("compositionstart", ".J__wcEditor", function () {
                _isComposing = true;
            });
            $("body").on("compositionend", ".J__wcEditor", function () {
                _isComposing = false;
            });

            function surrounds() {
                if (_isComposing) return; // IME输入过程中不处理，防止中文打字时自动换行
                setTimeout(function () {
                    //chrome
                    var sel = window.getSelection();
                    var anchorNode = sel.anchorNode;
                    if (!anchorNode) return;
                    if (sel.anchorNode === $(".J__wcEditor")[0] || (sel.anchorNode.nodeType === 3 && sel.anchorNode.parentNode === $(".J__wcEditor")[0])) {
                        var range = sel.getRangeAt(0);
                        var p = document.createElement("p");
                        range.surroundContents(p);
                        range.selectNodeContents(p);
                        range.insertNode(document.createElement("br")); //chrome
                        sel.collapse(p, 0);
                        (function clearBr() {
                            var elems = [].slice.call($(".J__wcEditor")[0].children);
                            for (var i = 0, len = elems.length; i < len; i++) {
                                var el = elems[i];
                                if (el.tagName.toLowerCase() == "br") {
                                    $(".J__wcEditor")[0].removeChild(el);
                                }
                            }
                            elems.length = 0;
                        })();
                    }
                }, 10);
            }
            // 定义最后光标位置
            var _lastRange = null,
                _sel = window.getSelection && window.getSelection();
            var _rng = {
                getRange: function () {
                    if (_sel && _sel.rangeCount > 0) {
                        return _sel.getRangeAt(0);
                    }
                },
                addRange: function () {
                    if (_lastRange) {
                        _sel.removeAllRanges();
                        _sel.addRange(_lastRange);
                    }
                }
            };

            $("body").on("click", ".J__wcEditor", function () {
                $(".wc__choose-panel").hide();
                _lastRange = _rng.getRange();
            });
            $("body").on("focus", ".J__wcEditor", function () {
                surrounds();
                _lastRange = _rng.getRange();
            });
            $("body").on("input", ".J__wcEditor", function () {
                if (!_isComposing) {
                    surrounds();
                }
                _lastRange = _rng.getRange();
            });

            $("body").on("click", "#J__swiperEmotion .face-list span img", function () {
                var that = $(this),
                    range;
                if (that.hasClass("face") || that.hasClass("lg-face")) {
                    //小表情
                    var img = that[0].cloneNode(true);
                    if (!$(".J__wcEditor")[0].childNodes.length) {
                        $(".J__wcEditor")[0].focus();
                    }
                    $(".J__wcEditor")[0].blur(); //输入表情时禁止输入法
                    setTimeout(function () {
                        if (document.selection && document.selection.createRange) {
                            document.selection.createRange().pasteHTML(img);
                        } else if (window.getSelection && window.getSelection().getRangeAt) {
                            _rng.addRange();
                            range = _rng.getRange();
                            range.insertNode(img);
                            range.collapse(false);
                        }
                    }, 10);
                } else if (that.hasClass("del")) {
                    $(".J__wcEditor")[0].blur(); //输入表情时禁止输入法
                    setTimeout(function () {
                        _rng.addRange();
                        range = _rng.getRange();
                        range.collapse(false);
                        document.execCommand("delete");
                    }, 10);
                } else if (that.hasClass("lg-face")) {
                    //
                    // var _img = that.parent().html();
                    // var _tpl = ['<li class="me">\
                    //             <div class="content">\
                    //              <p class="author">王梅（Fine）</p>\
                    //            <div class="msg lgface">' + _img + '</div>\
                    //         </div>\
                    //          <a class="avatar" href="/contact/uinfo"><img src="/static/diy-chat/img/uimg/u__chat-img11.jpg" /></a>\
                    //      </li>'].join("");
                    // $("#J__chatMsgList").append(_tpl);
                    // wchat_ToBottom();
                }
            });

            function isEmpty() {
                var html = $(".J__wcEditor").html();
                html = html.replace(/<br[\s\/]{0,2}>/gi, "\r\n");
                html = html.replace(/<[^img].*?>/gi, "");
                html = html.replace(/&nbsp;/gi, "");
                return html.replace(/\r\n|\n|\r/, "").replace(/(?:^[ \t\n\r]+)|(?:[ \t\n\r]+$)/g, "") == "";
            }
            // $("body").on("click", ".J__wchatSubmit", function () {
            //     if (isEmpty()) return;
            //     var _html = $(".J__wcEditor").html();
            //     var reg = /(http:\/\/|https:\/\/)((\w|=|\?|\.|\/|&|-)+)/g;
            //     _html = _html.replace(reg, "<a href='$1$2' target='_blank'>$1$2</a>");
            //     var msgTpl = ['<li class="me">\
            //                 <div class="content"> <p class="author">王梅（Fine）</p>\
            //                     <div class="msg">' + _html + '</div>\
            //                 </div>\
            //                 <a class="avatar" href="/contact/uinfo"><img src="/static/diy-chat/img/uimg/u__chat-img11.jpg" /></a>\
            //             </li>'].join("");
            //     $("#J__chatMsgList").append(msgTpl);
            //     $(".wc__choose-panel").hide();
            //     if (!$(".wcim__choose-panel").is(":hidden")) {
            //         $(".J__wcEditor").html("");
            //     } else {
            //         $(".J__wcEditor").html("").focus().trigger("click");
            //     }
            //     wchat_ToBottom();
            // });

            $("body").on("change", "#J__chooseImg", function () {
                $(".wcim__choose-panel").hide();
                var file = this.files[0];
                var reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = function (e) {
                    var _img = this.result;
                    var range = _rng.getRange();
                    range.insertNode(_img);
                    range.collapse(false);
                    // var _tpl = [
                    //     '<li class="me">\
                    //             <div class="content">\
                    //                 <p class="author">王梅（Fine）</p>\
                    //                 <div class="msg picture"><img class="img__pic" src="' + _img + '" preview="1" /></div>\
                    //             </div>\
                    //             <a class="avatar" href="/contact/uinfo"><img src="/static/diy-chat/img/uimg/u__chat-img11.jpg" /></a>\
                    //         </li>'
                    // ].join("");
                    // $("#J__chatMsgList").append(_tpl);
                    // setTimeout(function () {
                    //     wchat_ToBottom();
                    // }, 17);
                };
            });
            $("body").on("change", "#J__chooseFile", function () {
                // $(".wc__choose-panel").hide();
                // var file = this.files[0],
                //     fileSuffix = /\.[^\.]+/.exec(file.name).toString(),
                //     fileExt = fileSuffix.substr(fileSuffix.indexOf('.') + 1, fileSuffix.length).toLowerCase();
                // var fileTypeArr = ['jpg', 'jpeg', 'png', 'gif', 'txt', 'rar', 'zip', 'pdf', 'docx', 'xls'];
                // if ($.inArray(fileExt, fileTypeArr) < 0) {
                //     wcPop({
                //         content: '附件只支持jpg、jpeg、png、gif、txt、rar、zip、pdf、docx、xls格式的文件',
                //         time: 2
                //     });
                //     return;
                // }
                // var reader = new FileReader();
                // reader.readAsDataURL(file);
                // reader.onload = function (e) {
                //     var _file = this.result;
                //     var _tpl = [
                //         '<li class="me">\
                //                 <div class="content">\
                //                   <p class="author">王梅（Fine）</p>\
                //                   <div class="msg attachment">\
                //                      <div class="card flexbox flex-alignc">\
                //                         <i class="ico-bg"></i>\
                //                           <div class="file-info flex1" title="' + file.name + '">\
                //                                <p class="name">' + file.name + '</p><p class="size">' + formateSize(file.size) + '</p>\
                //                           </div>\
                //                          <a class="btn-down" href="' + _file + '" target="_blank" download="' + file.name + '"></a>\
                //                      </div>\
                //                 </div>\
                //              </div>\
                //              <a class="avatar" href="/contact/uinfo"><img src="/static/diy-chat/img/uimg/u__chat-img11.jpg" /></a>\
                //             </li>'
                //     ].join("");
                //     $("#J__chatMsgList").append(_tpl);
                //     wchat_ToBottom();
                // }
                // function formateSize(value) {
                //     if (null == value || value == '') {
                //         return "0 Bytes";
                //     }
                //     var unitArr = new Array("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB");
                //     var index = 0;
                //     var srcsize = parseFloat(value);
                //     index = Math.floor(Math.log(srcsize) / Math.log(1024));
                //     var size = srcsize / Math.pow(1024, index);
                //     size = size.toFixed(2); //保留的小数位数
                //     return size + unitArr[index];
                // }
            });
        });
        setTimeout(() => {
            this.fixGeminiscrollHeight = false;
        }, 300);
        //by iTdos anderson 2022-09-16 新增判断
        if (document.getElementById("J__wcEditor")) {
            document.getElementById("J__wcEditor").addEventListener("paste", function (e) {
                var cbd = e.clipboardData;
                var ua = window.navigator.userAgent;
                // 没有数据
                if (!(e.clipboardData && e.clipboardData.items)) {
                    return;
                }
                // Mac平台下Chrome49版本以下 复制Finder中的文件的Bug Hack掉
                if (
                    cbd.items &&
                    cbd.items.length === 2 &&
                    cbd.items[0].kind === "string" &&
                    cbd.items[1].kind === "file" &&
                    cbd.types &&
                    cbd.types.length === 2 &&
                    cbd.types[0] === "text/plain" &&
                    cbd.types[1] === "Files" &&
                    ua.match(/Macintosh/i) &&
                    Number(ua.match(/Chrome\/(\d{2})/i)[1]) < 49
                ) {
                    return;
                }
                for (var i = 0; i < cbd.items.length; i++) {
                    var item = cbd.items[i];
                    if (item.kind == "file") {
                        var blob = item.getAsFile();
                        if (blob.size === 0) {
                            return;
                        }
                        // 插入图片记录
                        var reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onload = function () {
                            // var _img = this.result;
                            // var _tpl = [
                            //     '<li class="me">\
                            //          <div class="content">\
                            //              <p class="author">王梅（Fine）</p>\
                            //          <div class="msg picture"><img class="img__pic" src="' + _img + '" preview="1" /></div>\
                            //          </div>\
                            //      <a class="avatar" href="/contact/uinfo"><img src="/static/diy-chat/img/uimg/u__chat-img11.jpg" /></a>\
                            //         </li>'
                            // ].join("");
                            // $("#J__chatMsgList").append(_tpl);
                            // setTimeout(() => {
                            //     $(".vChat__main").animate({
                            //         scrollTop: $("#J__chatMsgList").height()
                            //     }, 0);
                            // }, 17);
                        };
                    }
                }
            });
        }

        // Enter键监听已迁移到模板 @keydown="handleEditorKeydown"

        self._onRealtimeState = self.handleRealtimeState.bind(self);
        self._onPlatformNotification = self.handlePlatformNotification.bind(self);
        self._onPlatformSnapshot = self.handlePlatformNotificationSnapshot.bind(self);
        window.addEventListener(REALTIME_STATE_EVENT, self._onRealtimeState);
        window.addEventListener(PLATFORM_NOTIFICATION_EVENT, self._onPlatformNotification);
        window.addEventListener(PLATFORM_NOTIFICATION_SNAPSHOT_EVENT, self._onPlatformSnapshot);

        self.$nextTick(function () {
            // 检查设备类型：只有PC端才初始化聊天
            if (self.diyStore.IsPhoneView) {
                console.log('[聊天组件] 当前为移动端模式，不初始化PC端聊天');
                self.FirstConnectWebsocket = false;
                return;
            }
            
            console.log('[聊天组件] PC端模式，开始初始化聊天');

            // 连接状态由 main.js 统一广播，不再用 200ms 定时器反复探测。
            self.FirstConnectWebsocket = false;
            self.handleRealtimeState({
                detail: window.__MICROI_REALTIME_STATE__ || {
                    state: window.__VUE_APP__?.config?.globalProperties?.$websocket?.state
                }
            });
            self.loadPlatformNotifications();
        });

        // 添加鼠标移动和松开事件监听
        document.addEventListener('mousemove', self.onDrag);
        document.addEventListener('mouseup', self.stopDrag);

        if (self.DiyCommon.getToken()) {
            self.GetSysUserPublicInfo();
        }
    },
    beforeUnmount() {
        var self = this;
        self.cancelAITypewriter();
        // 移除事件监听
        document.removeEventListener('mousemove', self.onDrag);
        document.removeEventListener('mouseup', self.stopDrag);
        window.removeEventListener(REALTIME_STATE_EVENT, self._onRealtimeState);
        window.removeEventListener(PLATFORM_NOTIFICATION_EVENT, self._onPlatformNotification);
        window.removeEventListener(PLATFORM_NOTIFICATION_SNAPSHOT_EVENT, self._onPlatformSnapshot);
        
        // 使用公共模块清理WebSocket事件
        if (self.websocketEventsRegistered) {
            cleanupWebSocketEvents(self.boundWebsocket || self.$websocket, '[PC聊天]', 'pc-chat');
            self.websocketEventsRegistered = false;
            self.boundWebsocket = null;
        }
    },
    methods: {
        formatBadgeCount(value) {
            const count = Number(value) || 0;
            return count > 99 ? "99+" : count;
        },
        getChatAvatar(chat) {
            if (String(chat?.FromUserId || "") === "AI") return AI_ASSISTANT_AVATAR;
            return this.DiyCommon.GetServerPath(chat?.FromUserAvatar || "./static/img/icon/personal.png");
        },
        getContactAvatar(contact) {
            if (String(contact?.ContactUserId || contact?.Id || "") === "AI") return AI_ASSISTANT_AVATAR;
            return this.DiyCommon.GetServerPath(contact?.ContactUserAvatar || contact?.Avatar || "./static/img/icon/personal.png");
        },
        prefersReducedMotion() {
            return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
        },
        cancelAITypewriter(options = {}) {
            const activeMessage = this.currentStreamMessage;
            if (this.aiTypewriterTimer) {
                window.clearTimeout(this.aiTypewriterTimer);
            }
            this.aiTypewriterTimer = null;
            this.aiTypewriterQueue = [];
            this.aiTypewriterCompletePending = false;
            if (activeMessage && options.preserveMessage !== false) {
                activeMessage.isThinking = false;
                activeMessage.isStreaming = false;
            }
            this.currentStreamMessage = null;
            return activeMessage;
        },
        queueAITypewriterChunk(chunk) {
            if (!this.currentStreamMessage || !chunk) return;
            this.currentStreamMessage.isThinking = false;
            this.aiTypewriterQueue.push(...splitTypewriterUnits(chunk));
            this.scheduleAITypewriter();
        },
        scheduleAITypewriter() {
            if (this.aiTypewriterTimer || !this.currentStreamMessage) return;
            const reducedMotion = this.prefersReducedMotion();
            this.aiTypewriterTimer = window.setTimeout(() => {
                this.aiTypewriterTimer = null;
                if (!this.currentStreamMessage) return;

                const remaining = this.aiTypewriterQueue.length;
                const batchSize = reducedMotion
                    ? Math.max(remaining, 1)
                    : remaining > 600
                        ? 12
                        : remaining > 240
                            ? 6
                            : remaining > 100
                                ? 3
                                : 1;
                const nextText = this.aiTypewriterQueue.splice(0, batchSize).join("");
                if (nextText) this.currentStreamMessage.Content += nextText;
                this.$nextTick(() => this.wchat_ToBottom());

                if (this.aiTypewriterQueue.length > 0) {
                    this.scheduleAITypewriter();
                } else if (this.aiTypewriterCompletePending) {
                    this.finishAITypewriter();
                }
            }, reducedMotion ? 0 : AI_TYPEWRITER_INTERVAL);
        },
        completeAITypewriter() {
            this.aiTypewriterCompletePending = true;
            if (this.aiTypewriterQueue.length > 0 || this.aiTypewriterTimer) {
                this.scheduleAITypewriter();
                return;
            }
            this.finishAITypewriter();
        },
        finishAITypewriter() {
            const completedMessage = this.currentStreamMessage;
            if (completedMessage) {
                completedMessage.isThinking = false;
                completedMessage.isStreaming = false;
                this.lastAITypewriterCompletedContent = String(completedMessage.Content || "");
                this.lastAITypewriterCompletedAt = Date.now();
            }
            this.currentStreamMessage = null;
            this.aiTypewriterCompletePending = false;
            this.BtnLoading = false;
            this.$nextTick(() => this.wchat_ToBottom());
        },
        startAITypewriterMessage(message) {
            const completeContent = String(message?.Content || "");
            if (
                !this.currentStreamMessage
                && completeContent
                && completeContent === this.lastAITypewriterCompletedContent
                && Date.now() - this.lastAITypewriterCompletedAt < 5000
            ) {
                return;
            }

            const activeMessage = this.cancelAITypewriter({ preserveMessage: false });
            const typewriterMessage = activeMessage || {};
            Object.assign(typewriterMessage, message, {
                FromUserId: message?.FromUserId || "AI",
                FromUserName: message?.FromUserName || "AI助手",
                FromUserAvatar: AI_ASSISTANT_AVATAR,
                Content: "",
                CreateTime: message?.CreateTime || new Date().toISOString(),
                Type: message?.Type || "text",
                isThinking: false,
                isStreaming: true,
                isLocalRealtime: true
            });
            this.currentStreamMessage = typewriterMessage;
            if (!activeMessage) this.ChatRecord.push(typewriterMessage);
            this.queueAITypewriterChunk(completeContent);
            this.completeAITypewriter();
        },
        activateChat() {
            this.handleRealtimeState({
                detail: window.__MICROI_REALTIME_STATE__ || {
                    state: window.__VUE_APP__?.config?.globalProperties?.$websocket?.state
                }
            });
            this.loadPlatformNotifications();
            if (this.RealtimeState !== "Connected") {
                window.tryConnectWebSocket?.(false);
            }
        },
        retryRealtimeConnection() {
            window.tryConnectWebSocket?.(true);
        },
        handleRealtimeState(event) {
            const detail = event?.detail || event || {};
            this.RealtimeState = normalizeRealtimeState(detail.state);
            this.RealtimeRetryCount = Number(detail.retryCount || 0);
            this.RealtimeRetryDelay = detail.retryDelay ?? null;
            this.FirstConnectWebsocket = false;

            if (this.RealtimeState !== "Connected") return;
            const websocket = window.__VUE_APP__?.config?.globalProperties?.$websocket;
            if (!websocket || websocket.state !== "Connected") return;

            if (this.boundWebsocket && this.boundWebsocket !== websocket) {
                cleanupWebSocketEvents(this.boundWebsocket, '[PC聊天]', 'pc-chat');
                this.websocketEventsRegistered = false;
            }
            this.$websocket = websocket;
            this.boundWebsocket = websocket;
            this.InitSignalROnEvent();
            if (this.IsPlatformSystemContact) {
                this.loadPlatformNotifications();
            }
        },
        async loadPlatformNotifications() {
            if (!this.DiyCommon.Notification?.List) return;
            try {
                const result = await this.DiyCommon.Notification.List({
                    _PageIndex: 1,
                    _PageSize: 100
                });
                const normalized = normalizePlatformNotificationResult(result);
                this.platformNotifications = normalized.rows;
                this.platformUnreadCount = normalized.unreadCount;
                this.syncPlatformChatRecords();
            } catch (error) {
                console.warn('[PC聊天] 平台消息读取失败', error);
            }
        },
        handlePlatformNotification(event) {
            const notification = event?.detail || event || {};
            const identity = String(notification?.Id || notification?.EventId || "");
            const existed = this.platformNotifications.some(item =>
                String(item?.Id || item?.EventId || "") === identity
            );
            this.platformNotifications = mergePlatformNotification(
                this.platformNotifications,
                notification,
                100
            );
            if (!existed && Number(notification?.IsRead || 0) !== 1) {
                this.platformUnreadCount++;
            }
            this.syncPlatformChatRecords();
        },
        handlePlatformNotificationSnapshot(event) {
            const detail = event?.detail || event || {};
            this.platformNotifications = Array.isArray(detail.rows) ? detail.rows : [];
            this.platformUnreadCount = Math.max(0, Number(detail.unreadCount || 0));
            this.syncPlatformChatRecords();
        },
        syncPlatformChatRecords() {
            if (!this.IsPlatformSystemContact) return;
            const records = this.platformNotifications.map(item =>
                toPlatformChatRecord(item, this.GetCurrentUser)
            );
            this.ChatRecord.splice(0, this.ChatRecord.length, ...records.reverse());
            this.$nextTick(() => this.wchat_ToBottom());
        },
        openPlatformMessageLink(value) {
            const link = normalizeNotificationLink(value, window.location.origin);
            if (!link) return;
            if (link.startsWith('#')) {
                window.location.hash = link.slice(1);
                return;
            }
            if (link.startsWith('/') && !link.startsWith('//')) {
                this.$router.push(link);
                return;
            }
            window.open(link, '_blank', 'noopener,noreferrer');
        },
        // 加载AI模型列表
        loadAiModelList() {
            var self = this;
            if (self.aiModelList.length > 0) return; // 已加载过
            self.aiModelLoading = true;
            self.DiyCommon.FormEngine.GetTableData('mic_ai', {
                _Where: [['IsEnable', '=', '1']],
                _OrderBy: 'CreateTime',
                _OrderByType: 'DESC',
                _PageSize: 100
            }, function(result) {
                self.aiModelLoading = false;
                if (result && result.Code === 1 && result.Data && result.Data.length > 0) {
                    self.aiModelList = result.Data;
                    if (!self.selectedAiModel) {
                        self.selectedAiModel = result.Data[0];
                    }
                }
            });
        },
        GetSysUserPublicInfo(isLoadMore = false) {
            var self = this;
            if (self.contactsLoading) return;
            
            self.contactsLoading = true;
            console.log('[获取联系人] 开始获取', { pageIndex: self.contactsPageIndex, keyword: self.kw });
            
            self.DiyCommon.Post(
                "/api/SysUser/GetSysUserPublicInfo",
                {
                    State: 1,
                    _PageIndex: self.contactsPageIndex,
                    _PageSize: self.contactsPageSize,
                    _Keyword: self.kw || ''
                },
                function (result) {
                    self.contactsLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        console.log('[获取联系人] 成功', { count: result.Data?.length, total: result.Total });
                        
                        let contactsList = [];
                        if (isLoadMore) {
                            // 加载更多：追加数据（AI助手已在第一页添加，不需要重复）
                            contactsList = self.AllContactsList.concat(
                                (result.Data || []).map(item => normalizeChatDirectoryUser(item, "未命名用户"))
                            );
                        } else {
                            // 首次加载或搜索：替换数据
                            contactsList = (result.Data || [])
                                .map(item => normalizeChatDirectoryUser(item, "未命名用户"));
                            
                            // 在第一页且无搜索关键字时，添加AI助手到列表开头
                            if (self.contactsPageIndex === 1 && !self.kw) {
                                const aiAssistant = {
                                    Id: 'AI',
                                    Name: 'AI助手',
                                    Avatar: AI_ASSISTANT_AVATAR,
                                    State: 1
                                };
                                contactsList.unshift(aiAssistant);
                            }
                        }
                        
                        self.AllContactsList = contactsList;
                        
                        // 判断是否还有更多数据（AI助手不计入总数）
                        const realContactsCount = self.AllContactsList.length - (self.contactsPageIndex === 1 && !self.kw ? 1 : 0);
                        self.contactsHasMore = realContactsCount < (result.Total || 0);
                    } else {
                        console.error('[获取联系人] 失败:', result.Message);
                    }
                },
                function(error) {
                    self.contactsLoading = false;
                    console.error('[获取联系人] 请求失败:', error);
                }
            );
        },
        // 加载更多联系人
        loadMoreContacts() {
            var self = this;
            if (!self.contactsHasMore || self.contactsLoading) return;
            
            self.contactsPageIndex++;
            self.GetSysUserPublicInfo(true);
        },
        // 搜索联系人
        searchContacts() {
            var self = this;
            self.contactsPageIndex = 1;
            self.GetSysUserPublicInfo(false);
        },
        loadMore() {
            this.isLoading = true;
            for (var i = 0, j = 5; i < j; i++) {
                this.tmpList.push({
                    name: "插入行==：" + _count++
                });
            }
            setTimeout(() => {
                this.isLoading = false;
            }, 1000);
        },
        SelectCurrentLastContact(contact) {
            var self = this;
            const contactUserId = contact?.ContactUserId || contact?.Id;
            const knownContact = self.GetLastContacts.find(item =>
                String(item?.ContactUserId || item?.Id || "") === String(contactUserId || "")
            );
            const selectedContact = {
                ...(knownContact || {}),
                ...(contact || {}),
                ContactUserId: contactUserId,
                ContactUserName: resolveChatDisplayName(contact, knownContact, "未命名用户"),
                ContactUserAccount: contact?.ContactUserAccount || contact?.Account || knownContact?.ContactUserAccount || knownContact?.Account || "",
                ContactUserAvatar: contact?.ContactUserAvatar || contact?.Avatar || knownContact?.ContactUserAvatar || ""
            };

            console.log('[选择联系人]', selectedContact);
            
            // 重置流式消息状态（切换联系人时）
            self.cancelAITypewriter();
            
            // 如果选择的是AI助手，加载AI模型列表
            if (contactUserId === 'AI') {
                self.loadAiModelList();
            }
            
            //切换当前聊天人
            self.diyStore.setDiyChatCurrentLastContact(selectedContact);
            self.ChatRecord.splice(0, self.ChatRecord.length);

            // 平台消息以数据库为权威历史源，SignalR 只负责新消息即时到达。
            if (contactUserId === PLATFORM_SYSTEM_CONTACT_ID) {
                self.loadPlatformNotifications();
                return;
            }
            
            // 直接使用this.$websocket（已在checkConnection中同步）
            // 如果this.$websocket为null，尝试从全局获取
            const ws = self.$websocket || window.__VUE_APP__?.config?.globalProperties?.$websocket;
            
            console.log('[WebSocket检查]', {
                存在: !!ws,
                状态: ws?.state,
                有invoke: !!ws?.invoke
            });
            
            // 同步引用
            if (ws && !self.$websocket) {
                self.$websocket = ws;
            }
            
            // 检查websocket连接状态
            if (!ws || !ws.invoke) {
                console.error('[聊天] WebSocket 未初始化，无法获取聊天记录');
                window.tryConnectWebSocket?.(false);
                return;
            }
            
            // 检查连接状态是否为Connected
            if (ws.state !== 'Connected') {
                console.error('[聊天] WebSocket 未连接，当前状态:', ws.state);
                window.tryConnectWebSocket?.(false);
                return;
            }
            
            //获取跟这个人的聊天记录
            console.log('[获取聊天记录] 开始请求', selectedContact.ContactUserName);
            ws.invoke("SendChatRecordToUser", {
                    FromUserId: self.GetCurrentUser.Id,
                    ToUserId: selectedContact.ContactUserId,
                    OsClient: self.DiyCommon.GetOsClient()
                })
                .then((res) => {
                    console.log('[获取聊天记录] 请求成功，等待ReceiveSendChatRecordToUser事件');
                })
                .catch((err) => {
                    console.error(`获取与[${selectedContact.ContactUserName}]的聊天记录失败：`, err);
                });
        },
        InitSignalROnEvent() {
            var self = this;
            const websocket = window.__VUE_APP__?.config?.globalProperties?.$websocket || self.$websocket;
            
            if (!websocket) {
                console.warn('[聊天] WebSocket尚未初始化，请稍后...');
                // 不显示错误提示，因为可能正在初始化中
                return;
            }
            
            if (websocket.state !== "Connected") {
                console.warn('[聊天] WebSocket连接状态:', websocket.state);
                return;
            }

            self.$websocket = websocket;
            self.boundWebsocket = websocket;
            
            console.log("开始初始化消息服务器监听函数...");
            
            // 防止重复初始化：如果已经注册过且连接状态正常，直接返回
            if (self.websocketEventsRegistered) {
                console.log('[InitSignalROnEvent] 事件监听器已注册，跳过重复初始化');
                // 只执行必要的请求
                self.SendLastContacts();
                self.SendUnreadCountToUser();
                return;
            }
            
            self.InitReceiveEvent();
            console.log("初始化消息服务器监听函数成功！");
            
            // WebSocket连接成功，关闭loading
            self.FirstConnectWebsocket = false;
            
            //这里请求一次最近聊天联系人列表
            self.SendLastContacts();
            //这里请求一次未读消息数量
            self.SendUnreadCountToUser();
        },
        InitReceiveEvent() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.$websocket)) {
                // 设备检测：只在PC端注册
                if (self.diyStore.IsPhoneView) {
                    console.log('[PC聊天] 当前为移动端模式，不注册PC端聊天事件');
                    return;
                }
                
                // 使用公共模块初始化WebSocket事件
                const success = initWebSocketEvents(self.$websocket, {
                    // 接收普通消息
                    onReceiveMessage: (message) => {
                        console.log('[PC聊天] 收到消息:', message);
                        
                        // 判断消息是否与当前聊天对象相关
                        const isCurrentContact = 
                            (self.CurrentLastContact.ContactUserId == message.FromUserId) || 
                            (self.CurrentLastContact.Id == message.FromUserId) ||
                            (self.CurrentLastContact.ContactUserId == message.ToUserId) ||
                            (self.CurrentLastContact.Id == message.ToUserId);
                        
                        if (isCurrentContact) {
                            // 如果是AI助手的消息，直接添加到聊天记录
                            if (message.FromUserId === 'AI') {
                                console.log('[AI消息] 收到AI回复');
                                self.startAITypewriterMessage(message);
                            } else {
                                // 防止频繁请求聊天记录
                                if (self._loadingChatRecord) {
                                    console.log('[防死循环] 正在加载聊天记录，跳过');
                                    return;
                                }
                                
                                self._loadingChatRecord = true;
                                // 普通用户消息：重新获取聊天记录
                                self.$websocket.invoke("SendChatRecordToUser", {
                                    FromUserId: self.GetCurrentUser.Id,
                                    ToUserId: self.CurrentLastContact.ContactUserId,
                                    OsClient: self.DiyCommon.GetOsClient()
                                }).finally(() => {
                                    setTimeout(() => {
                                        self._loadingChatRecord = false;
                                    }, 500);
                                });
                                self.$nextTick(() => {
                                    self.wchat_ToBottom();
                                });
                            }
                        } else {
                            console.log('[调试] 消息不属于当前联系人');
                        }
                    },
                    
                    // 接收AI流式数据块
                    onReceiveAIChunk: (chunk, fromUserId, toUserId, isComplete) => {
                        const complete = isComplete === true || isComplete === 'true';
                        // 检查是否是当前聊天对象
                        const isCurrentContact = 
                            self.CurrentLastContact.ContactUserId === fromUserId ||
                            self.CurrentLastContact.Id === fromUserId;
                        
                        if (!isCurrentContact) {
                            console.log('[AI流式] 不是当前联系人，忽略');
                            return;
                        }

                        // 失败通知会先关闭占位消息，随后服务端仍会发送一次完成信号。
                        // 此处不要再为纯完成信号创建空白气泡。
                        if (complete && !chunk && !self.currentStreamMessage) {
                            self.BtnLoading = false;
                            return;
                        }
                        
                        // 处理"思考中"信号 — 立即创建消息气泡显示思考状态
                        if (chunk === '[THINKING]') {
                            if (!self.currentStreamMessage) {
                                console.log('[AI流式] 收到思考信号，创建思考中消息');
                                self.currentStreamMessage = {
                                    FromUserId: fromUserId,
                                    FromUserName: 'AI助手',
                                    FromUserAvatar: AI_ASSISTANT_AVATAR,
                                    ToUserId: toUserId,
                                    ToUserName: self.GetCurrentUser.Name,
                                    ToUserAvatar: self.GetCurrentUser.Avatar,
                                    Content: '',
                                    CreateTime: new Date().toISOString(),
                                    Type: 'text',
                                    IsRead: false,
                                    isStreaming: true,
                                    isLocalRealtime: true,
                                    isThinking: true  // 思考中状态
                                };
                                self.ChatRecord.push(self.currentStreamMessage);
                                self.$nextTick(() => { self.wchat_ToBottom(); });
                            }
                            return;
                        }
                        
                        if (!self.currentStreamMessage) {
                            // 第一个数据块 - 创建新消息
                            console.log('[AI流式] 创建新消息');
                            self.currentStreamMessage = {
                                FromUserId: fromUserId,
                                FromUserName: 'AI助手',
                                FromUserAvatar: AI_ASSISTANT_AVATAR,
                                ToUserId: toUserId,
                                ToUserName: self.GetCurrentUser.Name,
                                ToUserAvatar: self.GetCurrentUser.Avatar,
                                Content: '',
                                CreateTime: new Date().toISOString(),
                                Type: 'text',
                                IsRead: false,
                                isStreaming: true,
                                isLocalRealtime: true
                            };
                            
                            // 添加到聊天记录
                            self.ChatRecord.push(self.currentStreamMessage);
                        }

                        // 思考过程和正式答复都进入同一个逐字队列，完成信号要等队列清空。
                        self.queueAITypewriterChunk(chunk || '');
                        
                        // 滚动到底部
                        self.$nextTick(() => {
                            self.wchat_ToBottom();
                        });
                        
                        if (complete) {
                            console.log('[AI流式] 完成');
                            self.completeAITypewriter();
                        }
                    },

                    onReceiveAIError: (message, fromUserId, toUserId) => {
                        const isCurrentContact =
                            self.CurrentLastContact.ContactUserId === fromUserId
                            || self.CurrentLastContact.Id === fromUserId;
                        if (!isCurrentContact) return;

                        let failedMessage = self.cancelAITypewriter({ preserveMessage: false });
                        if (!failedMessage) {
                            failedMessage = {
                                FromUserId: fromUserId || 'AI',
                                FromUserName: 'AI助手',
                                FromUserAvatar: AI_ASSISTANT_AVATAR,
                                ToUserId: toUserId || self.GetCurrentUser.Id,
                                ToUserName: self.GetCurrentUser.Name,
                                ToUserAvatar: self.GetCurrentUser.Avatar,
                                CreateTime: new Date().toISOString(),
                                Type: 'text',
                                IsRead: false
                            };
                            self.ChatRecord.push(failedMessage);
                        }
                        failedMessage.Content = `AI回复失败：${message || '服务暂不可用，请稍后重试。'}`;
                        failedMessage.isThinking = false;
                        failedMessage.isStreaming = false;
                        failedMessage.isError = true;
                        self.BtnLoading = false;
                        self.$nextTick(() => self.wchat_ToBottom());
                    },
                    
                    // 接收聊天记录
                    onReceiveChatRecord: (message) => {
                        console.log(`[接收聊天记录] 收到${message?.length || 0}条消息`, self.CurrentLastContact.ContactUserName);
                        
                        // 重置加载标志
                        self._loadingChatRecord = false;
                        
                        // 首次历史请求可能比刚发出的消息/AI流式回复更晚返回。
                        // 直接替换会把用户刚看到的成功回复清空；保留本地待发送、
                        // 实时流和失败气泡，并按发送人/接收人/内容与持久记录去重。
                        const incoming = Array.isArray(message) ? message : [];
                        const localPending = self.ChatRecord.filter(item => item && (
                            item.tempId
                            || item.isLocalRealtime
                            || item.isStreaming
                            || item.isError
                            || item.SendFailed
                        ));
                        const signature = item => [
                            String(item?.FromUserId || ''),
                            String(item?.ToUserId || ''),
                            String(item?.Type || 'text'),
                            String(item?.Content || '')
                        ].join('\u001f');
                        const known = new Set(incoming.map(signature));
                        const merged = incoming.slice();
                        localPending.forEach(item => {
                            const key = signature(item);
                            if (!known.has(key)) {
                                known.add(key);
                                merged.push(item);
                            }
                        });
                        self.ChatRecord.splice(0, self.ChatRecord.length, ...merged);
                        self.$nextTick(() => {
                            self.wchat_ToBottom();
                        });
                    },
                    
                    // 接收最近联系人列表
                    onReceiveLastContacts: (message) => {
                        self.FirstConnectWebsocket = false;
                        self.LastContacts = (Array.isArray(message) ? message : [])
                            .map(item => normalizeChatContact(item, null, "未命名用户"));
                    },
                    
                    // 接收未读消息数
                    onReceiveUnreadCount: (message) => {
                        self.$root.UnreadCount = message;
                        if (message > 0) {
                            self.DiyCommon.Tips(`您有${message}条未读消息！`, true, null, {
                                position: "top-right"
                            });
                        }
                    },
                    
                    // 接收连接事件
                    onConnection: (message) => {
                        console.log('[PC聊天] 用户上线:', message);
                    },
                    
                    // 接收断开连接事件
                    onDisconnection: (message) => {
                        console.log('[PC聊天] 用户下线:', message);
                    }
                }, {
                    enableDuplicateCheck: true,
                    logPrefix: '[PC聊天]',
                    scope: 'pc-chat'
                });
                
                if (success) {
                    // 标记事件已注册（组件级别，用于清理）
                    self.websocketEventsRegistered = true;
                } else {
                    console.warn('[PC聊天] WebSocket 事件初始化失败');
                }
            } else {
                // 只在 WebSocket 不存在时才输出警告
                if (self.DiyCommon.IsNull(self.$websocket)) {
                    console.warn('[PC聊天] ⚠️ WebSocket 未初始化');
                }
            }
        },
        SendLastContacts() {
            var self = this;
            
            if (!self.$websocket || !self.$websocket.invoke) {
                console.warn('[SendLastContacts] WebSocket 未连接，无法获取最近联系人列表');
                return;
            }
            
            // 防止死循环：添加节流保护（2秒内只允许调用一次）
            const now = Date.now();
            if (self._lastContactsRequestTime && (now - self._lastContactsRequestTime < 2000)) {
                console.log('[防死循环] SendLastContacts 请求过于频繁，跳过');
                return;
            }
            self._lastContactsRequestTime = now;

            self.$websocket
                .invoke("SendLastContacts", {
                    UserId: self.GetCurrentUser.Id,
                    ContactUserId: "",
                    OsClient: self.DiyCommon.GetOsClient()
                })
                .then((res) => {
                    //成功后会在.on事件中打印日志
                })
                .catch((err) => {
                    console.error("获取最近联系人列表失败：", err);
                });
        },
        SendUnreadCountToUser() {
            var self = this;
            
            if (!self.$websocket || !self.$websocket.invoke) {
                console.warn('[SendUnreadCountToUser] WebSocket 未连接，无法获取未读消息数');
                return;
            }

            self.$websocket
                .invoke("SendUnreadCountToUser", {
                    ToUserId: self.GetCurrentUser.Id,
                    OsClient: self.DiyCommon.GetOsClient()
                })
                .then((res) => {
                    //成功后会在.on事件中打印日志
                })
                .catch((err) => {
                    console.error("获取未读消息条数失败：", err);
                });
        },
        handleShield() {
            this.dialogVisible_shield = false;
            this.$message({
                type: "success",
                center: true,
                message: "群消息屏蔽成功!"
            });
        },
        handleGroupLogout() {
            this.dialogVisible_groupSet = false;
            this.dialogVisible_groupSetAlert = false;
            this.$message({
                type: "success",
                center: true,
                message: "您已经退出群聊!"
            });
        },
        isEmpty() {
            var html = $(".J__wcEditor").html();
            html = html.replace(/<br[\s\/]{0,2}>/gi, "\r\n");
            html = html.replace(/<[^img].*?>/gi, "");
            html = html.replace(/&nbsp;/gi, "");
            return html.replace(/\r\n|\n|\r/, "").replace(/(?:^[ \t\n\r]+)|(?:[ \t\n\r]+$)/g, "") == "";
        },
        wchat_ToBottom() {
            $(".vChat__main").animate(
                {
                    scrollTop: $("#J__chatMsgList").height()
                },
                0
            );
        },
        handleMaxMin() {
            var self = this;
            self.diyStore.setDiyChatShow(false);
        },
        toggleFullscreen() {
            var self = this;
            self.isFullscreen = !self.isFullscreen;
            console.log('[全屏切换]', self.isFullscreen ? '进入全屏' : '退出全屏');
        },
        formatMessageContent,
        renderDataTable,
        escapeHtml,
        handleEditorKeydown(e) {
            // IME输入法正在组合中（如中文拼音选字），不处理
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.SendMessage();
            }
        },
        SendMessage() {
            var self = this;

            if (self.IsPlatformSystemContact) return;
            
            if (!self.$websocket || !self.$websocket.invoke || self.$websocket.state !== 'Connected') {
                console.error('[SendMessage] WebSocket 未连接，无法发送消息');
                window.tryConnectWebSocket?.(false);
                return;
            }
            
            self.BtnLoading = true;
            try {
                // const target = document.getElementById('text')
                if (self.isEmpty()) {
                    self.BtnLoading = false;
                    return;
                }
                var _html = $(".J__wcEditor").html();
                // var reg = /(http:\/\/|https:\/\/)((\w|=|\?|\.|\/|&|-)+)/g;
                // _html = _html.replace(reg, "<a href='$1$2' target='_blank'>$1$2</a>");
                var msgTpl = [
                    `<li class="me">\
                            <div class="content"> <p class="author">${self.GetCurrentUser.Name}</p>\
                                <div class="msg">${_html}</div>\
                            </div>\
                            <a class="avatar" href="javascript:;"><img src="${self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar)}" /></a>\
                        </li>`
                ].join("");
                //发送到websocket
                // self.$websocket.invoke("SendMessage", self.GetCurrentUser.Id, user.groupName, target.value)
                // self.$websocket.invoke("SendMessage", self.GetCurrentUser.Id, 'iTdosGroup', msgTpl)
                var tempId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                const optimisticMessage = {
                    Content: _html, //msgTpl,
                    ToUserId: self.GetCurrentLastContact.ContactUserId,
                    FromUserId: self.GetCurrentUser.Id,
                    CreateTime: new Date().toISOString(),
                    LastMessage: _html,
                    tempId: tempId
                };
                self.ChatRecord.push(optimisticMessage);
                self.$websocket
                    .invoke("SendToUser", {
                        Content: _html, //msgTpl,
                        OsClient: self.DiyCommon.GetOsClient(),
                        ToUserId: self.GetCurrentLastContact.ContactUserId,
                        ToUserName: self.GetCurrentLastContact.ContactUserName,
                        ToUserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentLastContact.ContactUserAvatar),
                        FromUserId: self.GetCurrentUser.Id,
                        FromUserName: self.GetCurrentUser.Name,
                        FromUserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar),
                        OtherInfo: self.GetCurrentLastContact.ContactUserId === 'AI' && self.selectedAiModel
                            ? JSON.stringify({
                                AiModel: self.selectedAiModel.AiModel,
                                AiModelId: self.selectedAiModel.Id || ''
                            })
                            : ''
                    }) //, self.GetCurrentUser.Id
                    .then((res) => {
                        console.log('[发送消息] ✅ 发送成功', { 
                            to: self.GetCurrentLastContact.ContactUserName,
                            toUserId: self.GetCurrentLastContact.ContactUserId,
                            content: _html.substring(0, 50) + ((_html.length > 50) ? '...' : ''),
                            response: res,
                            timestamp: new Date().toLocaleString()
                        });
                        // target.value = '';
                        // $("#J__chatMsgList").append(msgTpl);
                        // self.ChatRecord.push({
                        //     Content: _html, //msgTpl,
                        //     ToUserId: self.GetCurrentLastContact.ContactUserId,
                        //     FromUserId:self.GetCurrentUser.Id,
                        //     CreateTime : new Date().Format('HH:mm yyyy/MM/dd'),
                        //     LastMessage : _html,
                        //     tempId : tempId
                        // });
                        $(".wc__choose-panel").hide();
                        if (!$(".wcim__choose-panel").is(":hidden")) {
                            $(".J__wcEditor").html("");
                        } else {
                            $(".J__wcEditor").html("").focus().trigger("click");
                        }
                        self.$nextTick(function () {
                            self.wchat_ToBottom();
                        });
                        self.BtnLoading = false;
                    })
                    .catch((err) => {
                        console.error('[发送消息] ❌ 发送失败', {
                            to: self.GetCurrentLastContact.ContactUserName,
                            toUserId: self.GetCurrentLastContact.ContactUserId,
                            error: err.toString(),
                            errorDetails: err,
                            timestamp: new Date().toLocaleString()
                        });
                        self.$message?.error('消息发送失败: ' + err.toString());
                        //根据tempId标记发送失败
                        optimisticMessage.SendFailed = true;
                        self.BtnLoading = false;
                    });
            } catch (error) {
                console.error('[发送消息] ❌ 异常错误', {
                    error: error,
                    timestamp: new Date().toLocaleString()
                });
                self.BtnLoading = false;
            }
        },
        // 拖动相关方法
        startDrag(e) {
            var self = this;
            self.isDragging = true;
            // 查找.diy-chat父容器
            let element = e.currentTarget;
            while (element && !element.classList.contains('diy-chat')) {
                element = element.parentElement;
            }
            if (element) {
                const rect = element.getBoundingClientRect();
                self.dragStartX = e.clientX - rect.left;
                self.dragStartY = e.clientY - rect.top;
                self.diyChatElement = element;
            }
            e.preventDefault();
        },
        onDrag(e) {
            var self = this;
            if (!self.isDragging || !self.diyChatElement) return;
            
            let newLeft = e.clientX - self.dragStartX;
            let newTop = e.clientY - self.dragStartY;
            
            // 边界检查 - 确保聊天框至少有50px可见
            const wrapperWidth = self.diyChatElement.offsetWidth || 1120;
            const wrapperHeight = self.diyChatElement.offsetHeight || 720;
            const minVisibleSize = 50;
            
            const maxLeft = window.innerWidth - minVisibleSize;
            const maxTop = window.innerHeight - minVisibleSize;
            const minLeft = -(wrapperWidth - minVisibleSize);
            const minTop = 0;
            
            newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
            newTop = Math.max(minTop, Math.min(newTop, maxTop));
            
            // 直接修改.diy-chat容器的样式
            self.diyChatElement.style.left = newLeft + 'px';
            self.diyChatElement.style.top = newTop + 'px';
            self.diyChatElement.style.right = 'auto';
            self.diyChatElement.style.bottom = 'auto';
        },
        stopDrag() {
            var self = this;
            self.isDragging = false;
        },
        // 开始拖动调整大小
        startResize(e) {
            var self = this;
            self.isResizing = true;
            self.resizeStartX = e.clientX;
            self.resizeStartY = e.clientY;
            
            // 获取当前.diy-chat容器的尺寸
            const diyChatEl = document.querySelector('.diy-chat');
            if (diyChatEl) {
                const rect = diyChatEl.getBoundingClientRect();
                self.resizeStartWidth = rect.width;
                self.resizeStartHeight = rect.height;
            }
            
            document.addEventListener('mousemove', self.onResize);
            document.addEventListener('mouseup', self.stopResize);
            e.preventDefault();
        },
        // 拖动调整大小
        onResize(e) {
            var self = this;
            if (!self.isResizing) return;
            
            const deltaX = e.clientX - self.resizeStartX;
            const deltaY = e.clientY - self.resizeStartY;
            
            const newWidth = Math.max(600, self.resizeStartWidth + deltaX);  // 最小600px
            const newHeight = Math.max(400, self.resizeStartHeight + deltaY); // 最小400px
            
            const diyChatEl = document.querySelector('.diy-chat');
            if (diyChatEl) {
                diyChatEl.style.width = newWidth + 'px';
                diyChatEl.style.height = newHeight + 'px';
            }
        },
        // 停止拖动调整大小
        stopResize() {
            var self = this;
            self.isResizing = false;
            document.removeEventListener('mousemove', self.onResize);
            document.removeEventListener('mouseup', self.stopResize);
        },
        // 切换emoji面板显示/隐藏
        toggleEmojiPanel() {
            var self = this;
            self.showEmojiPanel = !self.showEmojiPanel;
        },
        // 插入emoji表情
        insertEmoji(emoji) {
            var self = this;
            const editor = document.querySelector('.J__wcEditor');
            if (editor) {
                editor.focus();
                document.execCommand('insertText', false, emoji);
            }
            // 插入后关闭面板
            self.showEmojiPanel = false;
        }
    }
};
</script>

<style lang="scss">
@import "@/views/chat/css/fonts/iconfont.css";
@import "@/views/chat/css/reset.scss";
@import "@/views/chat/css/layout.scss";

.realtime-status-banner {
    min-height: 34px;
    padding: 4px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #8a6200;
    background: #fff8e6;
    border-bottom: 1px solid #f3dfab;
}

.realtime-status-banner[data-state="Exhausted"],
.realtime-status-banner[data-state="Disconnected"] {
    color: #b33a3a;
    background: #fff1f0;
    border-bottom-color: #ffd1ce;
}

.realtime-status-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: currentColor;
}

.chat-list-empty,
.chat-conversation-empty {
    color: #8a8f99;
    text-align: center;
    font-size: 13px;
}

.chat-list-empty {
    padding: 32px 12px;
}

.chat-conversation-empty {
    padding: 70px 24px 24px;
}

.chat-conversation-empty .empty-title {
    margin-bottom: 8px;
    color: #4f5969;
    font-size: 16px;
    font-weight: 600;
}

.chat-conversation-empty .empty-desc {
    line-height: 1.7;
}

.platform-message-link {
    display: block;
    margin-top: 6px;
    padding: 0;
}

.message-error {
    color: #b42318 !important;
    background: #fff1f0 !important;
    border: 1px solid #ffd1ce;
}

.chat-toolbar-row,
.chat-toolbar-main,
.chat-toolbar-actions,
.chat-ai-model {
    display: flex;
    min-width: 0;
    align-items: center;
}

.chat-toolbar-row {
    gap: 8px;
}

.chat-toolbar-main {
    gap: 10px;
}

.chat-toolbar-actions {
    flex: 0 0 auto;
    gap: 3px;
}

.wc__editor-panel .wrap-toolbar .chat-toolbar-button {
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--el-text-color-secondary, #606266);
    cursor: pointer;
    transition: background-color 0.16s ease, color 0.16s ease;
}

.wc__editor-panel .wrap-toolbar .chat-toolbar-button:hover,
.wc__editor-panel .wrap-toolbar .chat-toolbar-button:focus-visible {
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-color-primary, #409eff);
    outline: none;
}

.chat-toolbar-button .el-icon {
    font-size: 20px;
}

.chat-emoji-glyph {
    font: 22px/1 "Segoe UI Symbol", "Microsoft YaHei", sans-serif;
}

.chat-file-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    opacity: 0;
}

.chat-ai-model {
    flex: 1 1 auto;
    gap: 6px;
}

.chat-ai-model__label {
    flex: 0 0 auto;
    color: var(--el-text-color-secondary, #909399);
    font-size: 12px;
    line-height: 30px;
}

.chat-ai-model__select.el-select {
    width: clamp(180px, 32vw, 300px);
    max-width: 100%;
}

.chat-ai-model__select .el-select__wrapper {
    min-height: 30px;
}

.btn-help {
    flex: 0 0 30px;
}

/* 聊天框包装器 - 填充父容器.diy-chat */
.vChat-wrapper {
    position: relative;
    z-index: 99999 !important;
    width: 100%;
    height: 100%;
    position: relative;
    
    .vChat-panel {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
}

/* 拖动条样式 */
.vChat-dragbar {
    position: absolute;
    top: 0;
    left: 60px;
    right: 0;
    height: 40px;
    background: var(--color-primary, #409eff);
    cursor: move;
    display: flex;
    align-items: center;
    padding-left: 15px;
    z-index: 10;
    user-select: none;
    
    .drag-title {
        color: var(--color-primary-text, #fff);
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 1px;
    }
}

/* 调整内部布局，为拖动条留出空间 */
.vChat-panel {
    position: relative;
    
    .vChat-inner {
        padding-top: 0;
    }
    
    .vChat-winbtn {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
}

/* 右下角拖动调整大小手柄 */
.resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    z-index: 100;
    background: linear-gradient(135deg, transparent 0%, transparent 50%, var(--color-primary, #409eff) 50%, var(--color-primary, #409eff) 100%);
    opacity: 0.6;
    transition: opacity 0.2s;
}

.resize-handle:hover {
    opacity: 1;
}

.resize-handle::before {
    content: '';
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 8px;
    height: 8px;
    border-right: 2px solid rgba(255, 255, 255, 0.8);
    border-bottom: 2px solid rgba(255, 255, 255, 0.8);
}

.vChat-winbtn {
        z-index: 11;
    }
}

/* Emoji 表情面板样式 */
.emoji-panel {
    .emoji-container {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
    
    .emoji-categories {
        display: flex;
        gap: 10px;
        padding: 10px;
        border-bottom: 1px solid #e0e0e0;
        background: #f5f5f5;
    }
    
    .emoji-category {
        padding: 5px 15px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.3s;
        
        &:hover {
            background: #e0e0e0;
        }
        
        &.active {
            background: #409eff;
            color: #fff;
        }
    }
    
    .emoji-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
        gap: 5px;
        padding: 10px;
        overflow-y: auto;
        max-height: 200px;
    }
    
    .emoji-item {
        font-size: 24px;
        cursor: pointer;
        text-align: center;
        padding: 5px;
        border-radius: 4px;
        transition: all 0.2s;
        
        &:hover {
            background: #f0f0f0;
            transform: scale(1.2);
        }
    }
}

/* 表情面板样式优化 */
.wc__choose-panel.emoji-panel {
    position: absolute !important;
    bottom: calc(100% + 5px) !important;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
}

/* 数据表格消息样式 */
.msg-data-table {
    background: #f9f9f9;
    padding: 10px;
    border-radius: 8px;
    overflow-x: auto;
    max-width: 600px; /* 限制最大宽度，防止撑开聊天框 */
}

.data-table {
    width: 100%;
    min-width: 400px; /* 最小宽度确保表格可读 */
    border-collapse: collapse;
    background: white;
    font-size: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border-radius: 6px;
    overflow: hidden;
    table-layout: fixed; /* 固定表格布局，列宽平均分配 */
}

.data-table thead {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.data-table th {
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    height: 32px;
    line-height: 16px;
    width: 150px;
}

.data-table tbody tr {
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s;
    height: 32px;
}

.data-table tbody tr:last-child {
    border-bottom: none;
}

.data-table tbody tr:hover {
    background-color: #f8f9ff;
}

.data-table tbody tr:nth-child(even) {
    background-color: #fafafa;
}

.data-table tbody tr:nth-child(even):hover {
    background-color: #f8f9ff;
}

.data-table td {
    padding: 6px 12px;
    text-align: left;
    color: #333;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    height: 32px;
    line-height: 20px;
}

.data-table tbody th {
    background-color: #f5f5f5;
    font-weight: 600;
    color: #555;
    padding: 6px 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    height: 32px;
    line-height: 20px;
}

.data-table-footer {
    margin-top: 8px;
    padding: 8px 10px;
    background: white;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
    text-align: right;
    border: 1px solid #e8e8e8;
}

.data-content {
    background: white;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    font-size: 12px;
    color: #333;
    overflow-x: auto;
    max-width: 100%;
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
}

/* AI流式消息样式 */
.streaming-message {
    opacity: 0.95;
    position: relative;
}

.typing-cursor {
    display: inline-block;
    margin-left: 2px;
    animation: blink 1s infinite;
    font-weight: bold;
    color: #4CAF50;
    font-size: 18px;
    vertical-align: text-bottom;
}

@media (max-width: 820px) {
    .vChat-middlebar {
        flex-basis: 220px;
        width: 220px;
    }

    .chat-ai-model__label {
        display: none;
    }

    .chat-ai-model__select.el-select {
        width: min(220px, 100%);
    }
}

@media (prefers-reduced-motion: reduce) {
    .typing-cursor,
    .thinking-dots span {
        animation: none !important;
    }
}

.thinking-indicator {
    display: inline-flex;
    align-items: center;
    color: #999;
    font-size: 13px;
}

.thinking-dots {
    display: inline-flex;
    margin-right: 4px;
}

.thinking-dots span {
    animation: thinkingBounce 1.4s infinite ease-in-out both;
    font-size: 20px;
    line-height: 1;
    color: #4CAF50;
}

.thinking-dots span:nth-child(1) { animation-delay: 0s; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinkingBounce {
    0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-4px); }
}

@keyframes blink {
    0%, 50% { 
        opacity: 1; 
    }
    51%, 100% { 
        opacity: 0; 
    }
}

/* AI思考过程样式 */
.msg .ai-thinking-block {
    margin: 6px 0;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    overflow: hidden;
    background: #fafafa;
}

.msg .ai-thinking-block summary {
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    color: #888;
    user-select: none;
    background: #f5f5f5;
}

.msg .ai-thinking-block summary:hover {
    color: #666;
    background: #eee;
}

.msg .ai-thinking-content {
    padding: 8px 10px;
    font-size: 12px;
    color: #666;
    line-height: 1.5;
    max-height: 200px;
    overflow-y: auto;
}

/* 代码块样式 */
.msg .code-block {
    margin: 6px 0;
    border-radius: 6px;
    overflow: hidden;
    background: #1e1e1e;
    position: relative;
}

.msg .code-block .code-lang {
    position: absolute;
    top: 4px;
    right: 8px;
    font-size: 11px;
    color: #858585;
}

.msg .code-block pre {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
}

.msg .code-block code {
    font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
    font-size: 13px;
    color: #d4d4d4;
    line-height: 1.5;
    white-space: pre;
}

.msg .inline-code {
    background: rgba(0,0,0,0.06);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
    font-size: 0.9em;
    color: #c7254e;
}
</style>
