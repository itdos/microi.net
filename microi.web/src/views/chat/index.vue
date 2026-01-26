<!--群聊模板-->
<template>
    <div class="vChat-wrapper flexbox flex-alignc" v-if="DiyChatShow">
        <div class="vChat-panel" style="background-image: url(src/assets/img/placeholder/vchat__panel-bg01.jpg)">
            <div class="vChat-inner flexbox">
                <!-- <win-bar></win-bar> -->
                <div class="vChat-winbtn">
                    <!-- <el-tooltip :content="maxmin ? '向下还原' : '最大化'" placement="bottom"> 
                    <a class="w-max" @click="handleMaxMin"><i class="iconfont" :class="maxmin ? 'icon-win_max' : 'icon-win_min'"></i></a>
                </el-tooltip> -->
                    <el-tooltip :content="'最小化'" placement="bottom">
                        <a class="w-max" @click="handleMaxMin">
                            <el-icon style="font-size: 20px; margin-top: 5px"><Close /></el-icon>
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
                                <span @click="ChatMiddlebarType = 'RecentContacts'" class="ico">
                                    <i class="iconfont icon-side__xiaoxi"></i>
                                    <!-- <em class="wc__badge">5</em> -->
                                </span>
                            </li>
                            <!-- to="/contact" -->
                            <li :class="{ on: ChatMiddlebarType === 'Contacts' }">
                                <span class="ico">
                                    <i
                                        @click="
                                            GetSysUserPublicInfo();
                                            ChatMiddlebarType = 'Contacts';
                                        "
                                        class="iconfont icon-side__tongxunlu"
                                    ></i
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
                <div class="flex1 flexbox">
                    <!-- <record-list></record-list> -->
                    <div v-if="FirstConnectWebsocket" style="z-index: 2; height: 30px; position: absolute; width: 250px; color: #000; font-size: 14px; top: calc(50% - 15px); left: calc(50% - 60px)">
                        <el-icon><Loading /></el-icon> 正在连接消息服务器...
                    </div>
                    <div v-if="FirstConnectWebsocket" style="z-index: 1; height: 100%; background-color: #ccc; position: absolute; width: calc(100% - 60px); opacity: 0.5"></div>
                    <div v-if="ChatMiddlebarType == 'RecentContacts'" class="vChat-middlebar flexbox flex__direction-column">
                        <div class="vc-searArea">
                            <div class="iptbox flexbox">
                                <el-input placeholder="搜索" prefix-:icon="Search" v-model="kw"></el-input>
                            </div>
                        </div>
                        <div class="vc-recordList flex1 flexbox flex__direction-column" style="overflow: auto">
                            <ul class="clearfix J__recordList">
                                <li v-for="contact in GetLastContacts" :key="contact.ContactId" class="flexbox flex-alignc wc__material-cell" @click="SelectCurrentLastContact(contact)">
                                    <div class="img">
                                        <em v-if="contact.UnRead > 0" class="wc__badge" style="z-index: 1">{{ contact.UnRead }}</em>
                                        <el-image :fit="'cover'" :src="DiyCommon.GetServerPath(contact.ContactUserAvatar)"></el-image>
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
                        </div>
                    </div>
                    <div v-else-if="ChatMiddlebarType == 'Contacts'" class="vChat-middlebar flexbox flex__direction-column">
                        <div class="vc-searArea">
                            <div class="iptbox flexbox">
                                <el-input placeholder="搜索" prefix-:icon="Search" v-model="kw"></el-input>
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
                                            $root.OpenDiyChat(user);
                                            ChatMiddlebarType = 'RecentContacts';
                                        "
                                        v-for="user in AllContactsList"
                                        :key="'contacts_' + user.Id"
                                    >
                                        <!-- <h2 class="initial wc__borT">A</h2> -->
                                        <router-link to="" class="row flexbox flex-alignc wc__material-cell">
                                            <img class="uimg" :src="DiyCommon.GetServerPath(user.Avatar)" />
                                            <span class="name flex1">{{ user.Name }}</span>
                                        </router-link>
                                    </div>
                                </li>
                            </ul>
                            <div class="vc_addrTotal">{{ AllContactsList.length }}位联系人</div>
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
                                            <img :src="DiyCommon.GetServerPath(chat.FromUserAvatar)" style="object-fit: cover" />
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
                                            <div v-else class="msg" v-html="chat.Content"></div>
                                        </div>
                                        <router-link v-if="chat.FromUserId == GetCurrentUser.Id" class="avatar" to="">
                                            <img :src="DiyCommon.GetServerPath(GetCurrentUser.Avatar)" style="object-fit: cover" />
                                        </router-link>
                                    </li>
                                </ul>
                                <div style="color: #666" v-if="ChatRecord.length == 0">暂无消息记录...</div>
                            </div>
                            <!-- </geminiScrollbar> -->
                        </div>

                        <div class="vChat__footTool">
                            <!-- 输入框模块 -->
                            <div
                                class="wc__editor-panel wc__borT flexbox flex__direction-column"
                                :style="{
                                    backgroundColor: DiyCommon.IsNull(GetCurrentLastContact.ContactUserId) ? 'rgba(245, 245, 245, .95)' : 'rgba(255,255,255,.9)'
                                }"
                            >
                                <div class="wrap-toolbar">
                                    <div class="flexbox">
                                        <div class="flex1">
                                            <i class="iconfont icon-face btn btn-face hand" title="选择表情"></i>
                                            <i class="iconfont icon-tupian btn btn-image hand" title="发送图片">
                                                <input type="file" accept="image/*" id="J__chooseImg" class="hand" />
                                            </i>
                                            <i class="iconfont icon-fujian btn btn-attachment hand" title="发送文件">
                                                <input type="file" accept="*" id="J__chooseFile" class="hand" />
                                            </i>
                                            <!-- <i class="iconfont icon-zhendong btn btn-shake hand" title="向好友发送抖动窗口"></i> -->
                                        </div>
                                        <el-popover title="Tips" placement="top" width="200" trigger="hover" content="截屏、截图可直接粘贴至文本框进行发送！">
                                            <template #reference><i class="iconfont icon-wenhao btn btn-help"></i></template>
                                        </el-popover>
                                    </div>
                                </div>
                                <div class="wrap-editor flex1">
                                    <div
                                        class="editor J__wcEditor"
                                        id="J__wcEditor"
                                        :placeholder="!DiyCommon.IsNull(GetCurrentLastContact.ContactUserId) ? '输入文字或Ctrl+V粘贴图片...' : '请选择一个聊天对象！'"
                                        :contenteditable="!DiyCommon.IsNull(GetCurrentLastContact.ContactUserId) ? true : false"
                                        style="user-select: text; -webkit-user-select: text"
                                    ></div>
                                </div>
                                <el-button
                                    type="primary"
                                    :icon="Position"
                                    :loading="BtnLoading"
                                    class="btn-submit J__wchatSubmit"
                                    :disabled="DiyCommon.IsNull(GetCurrentLastContact.ContactUserId)"
                                    :style="{
                                        backgroundColor: DiyCommon.IsNull(GetCurrentLastContact.ContactUserId) ? '#d5d5d5' : ''
                                    }"
                                    @click="SendMessage"
                                >
                                    发送
                                </el-button>
                            </div>
                            <div class="wc__choose-panel" style="display: none">
                                <!-- 表情区域 -->
                                <div class="wrap-emotion">
                                    <div class="emotion__cells flexbox flex__direction-column">
                                        <div class="emotion__cells-swiper flex1" id="J__swiperEmotion">
                                            <div class="swiper-container">
                                                <div class="swiper-wrapper"></div>
                                                <div class="pagination-emotion"></div>
                                            </div>
                                        </div>
                                        <div class="emotion__cells-footer" id="J__emotionFootTab">
                                            <ul class="clearfix">
                                                <li class="swiperTmpl cur" tmpl="swiper__tmpl-emotion01">
                                                    <img :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/face-lbl.png'" alt="" />
                                                </li>
                                                <li class="swiperTmpl" tmpl="swiper__tmpl-emotion02">
                                                    <img :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/face-lbl.gif'" alt="" />
                                                </li>
                                                <li class="swiperTmpl" tmpl="swiper__tmpl-emotion03">
                                                    <img :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/face-lbl.gif'" alt="" />
                                                </li>
                                                <li class="swiperTmpl" tmpl="swiper__tmpl-emotion04">
                                                    <img :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/face-lbl.gif'" alt="" />
                                                </li>
                                                <li class="swiperTmpl" tmpl="swiper__tmpl-emotion05">
                                                    <img :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/face-lbl.gif'" alt="" />
                                                </li>
                                                <li class="swiperTmpl" tmpl="swiper__tmpl-emotion06">
                                                    <img :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/face-lbl.gif'" alt="" />
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- //表情1 -->
                        <div class="swiper__tmpl-emotion01" style="display: none">
                            <div class="swiper-slide">
                                <div class="face-list face__sm-list">
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/0.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/1.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/2.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/3.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/4.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/5.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/6.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/7.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/8.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/9.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/10.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/11.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/12.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/13.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/14.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/15.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/16.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/17.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/18.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/19.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/20.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/21.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/22.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/23.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/24.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/25.png'" /></span>
                                    <span><img class="del" src="/static/diy-chat/img/icon__emotion-del.png" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__sm-list">
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/26.png'" /></span
                                    ><span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/27.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/28.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/29.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/30.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/31.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/32.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/33.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/34.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/35.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/36.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/37.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/38.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/39.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/40.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/41.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/42.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/43.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/44.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/45.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/46.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/47.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/48.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/49.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/50.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/51.png'" /></span
                                    ><span><img class="del" src="/static/diy-chat/img/icon__emotion-del.png" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__sm-list">
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/52.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/53.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/54.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/55.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/56.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/57.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/58.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/59.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/60.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/61.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/62.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/63.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/64.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/65.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/66.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/67.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/68.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/69.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/70.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/71.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/72.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/73.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/74.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/75.png'" /></span
                                    ><span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/76.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/77.png'" /></span>
                                    <span><img class="del" src="/static/diy-chat/img/icon__emotion-del.png" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__sm-list">
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/78.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/79.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/80.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/81.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/82.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/83.png'" /></span
                                    ><span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/84.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/85.png'" /></span
                                    ><span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/86.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/87.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/88.png'" /></span
                                    ><span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/89.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/90.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/91.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/92.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/93.png'" /></span
                                    ><span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/94.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/95.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/96.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/97.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/98.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/99.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/100.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/101.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/102.png'" /></span>
                                    <span><img class="face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face01/103.png'" /></span>
                                    <span><img class="del" src="/static/diy-chat/img/icon__emotion-del.png" /></span>
                                </div>
                            </div>
                        </div>
                        <!-- //动图2 -->
                        <div class="swiper__tmpl-emotion02" style="display: none">
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/0.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/1.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/2.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/3.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/4.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/5.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/6.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/7.gif'" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/8.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/9.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/10.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/11.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/12.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/13.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/14.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face02/15.gif'" /></span>
                                </div>
                            </div>
                        </div>
                        <!-- //动图3 -->
                        <div class="swiper__tmpl-emotion03" style="display: none">
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/0.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/1.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/2.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/3.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/4.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/5.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/6.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/7.gif'" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/8.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/9.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/10.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/11.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/12.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/13.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/14.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face03/15.gif'" /></span>
                                </div>
                            </div>
                        </div>
                        <!-- //动图4 -->
                        <div class="swiper__tmpl-emotion04" style="display: none">
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/0.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/1.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/2.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/3.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/4.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/5.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/6.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/7.gif'" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/8.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/9.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/10.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/11.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/12.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/13.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/14.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face04/15.gif'" /></span>
                                </div>
                            </div>
                        </div>
                        <!-- //动图5 -->
                        <div class="swiper__tmpl-emotion05" style="display: none">
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/0.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/1.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/2.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/3.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/4.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/5.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/6.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/7.gif'" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/8.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/9.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/10.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/11.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/12.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/13.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/14.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face05/15.gif'" /></span>
                                </div>
                            </div>
                        </div>
                        <!-- //动图6 -->
                        <div class="swiper__tmpl-emotion06" style="display: none">
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/0.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/1.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/2.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/3.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/4.gif'" /></span
                                    ><span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/5.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/6.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/7.gif'" /></span>
                                </div>
                            </div>
                            <div class="swiper-slide">
                                <div class="face-list face__lg-list">
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/8.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/9.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/10.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/11.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/12.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/13.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/14.gif'" /></span>
                                    <span><img class="lg-face" :src="DiyCommon.GetFileServer() + '/static/diy-chat/img/emotion/face06/15.gif'" /></span>
                                </div>
                            </div>
                        </div>
                        <!-- …… 表情模板.End -->
                    </div>
                </div>
            </div>
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
import { computed } from "vue";
import drag from "@/utils/dos.common";

export default {
    name: "diy-chat",
    components: {
        // HourseCard
    },
    setup() {
        const diyStore = useDiyStore();
        const DiyChatShow = computed(() => diyStore.DiyChat?.Show);
        const CurrentLastContact = computed(() => diyStore.DiyChat?.CurrentLastContact || {});
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        return { diyStore, DiyChatShow, CurrentLastContact, GetCurrentUser };
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
            AllContactsGroup: []
        };
    },
    watch: {
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
        GetLastContacts: {
            get() {
                var self = this;
                var result = [];
                var index = 0;
                return self.LastContacts;
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
            function surrounds() {
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
                surrounds();
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

        self.$nextTick(function () {
            self.InitSignalROnEvent();
        });

        setInterval(() => {
            self.InitReceiveEvent();
        }, 2000);

        if (self.DiyCommon.getToken()) {
            self.GetSysUserPublicInfo();
        }
    },
    methods: {
        GetSysUserPublicInfo() {
            var self = this;
            self.DiyCommon.Post(
                "/api/SysUser/getSysUserPublicInfo",
                {
                    State: 1
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        //进行首字母排序
                        self.AllContactsList = result.Data;
                    }
                }
            );
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
            //切换当前聊天人
            self.diyStore.setDiyChatCurrentLastContact(contact);
            //获取跟这个人的聊天记录
            var self = this;
            self.$websocket
                .invoke("SendChatRecordToUser", {
                    FromUserId: self.GetCurrentUser.Id,
                    ToUserId: contact.ContactUserId,
                    OsClient: self.DiyCommon.GetOsClient()
                })
                .then((res) => {
                    //在.on事件中log
                })
                .catch((err) => {
                    console.error(`获取与[${contact.ContactUserName}]的聊天记录失败：`, err);
                });
        },
        InitSignalROnEvent(timer) {
            var self = this;
            // console.log('准备初始化监听函数...', self.$websocket);
            if (!self.DiyCommon.IsNull(self.$websocket) && self.$websocket.connectionState == "Connected") {
                console.log("开始初始化消息服务器监听函数...");
                self.InitReceiveEvent();
                console.log("初始化消息服务器监听函数成功！");
                //这里请求一次最近聊天联系人列表
                self.SendLastContacts();
                //这里请求一次未读消息数量
                self.SendUnreadCountToUser();
                if (timer != undefined) {
                    clearInterval(timer);
                }
            }
        },
        InitReceiveEvent() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.$websocket)) {
                if (self.DiyCommon.IsNull(self.$websocket.methods["ReceiveMessage".toLowerCase()])) {
                    self.$websocket.on("ReceiveMessage", (message) => {
                        console.log("ReceiveMessage：", message);
                    });
                }
                if (self.DiyCommon.IsNull(self.$websocket.methods["ReceiveConnection".toLowerCase()])) {
                    self.$websocket.on("ReceiveConnection", (message) => {
                        console.log("ReceiveConnection：", message);
                    });
                }
                if (self.DiyCommon.IsNull(self.$websocket.methods["ReceiveDisConnection".toLowerCase()])) {
                    self.$websocket.on("ReceiveDisConnection", (message) => {
                        console.log("ReceiveDisConnection：", message);
                    });
                }
                if (self.DiyCommon.IsNull(self.$websocket.methods["ReceiveSendToUser".toLowerCase()])) {
                    self.$websocket.on("ReceiveSendToUser", (message) => {
                        console.log("ReceiveSendToUser：", message);
                        if (self.CurrentLastContact.ContactUserId == message.FromUserId) {
                            //接收到消息，显示到聊天框中
                            // self.ChatRecord.push(message);
                            //这里应该每次获取与这个人的所有聊天记录，以实现多端同时登录显示与该人的所有聊天记录
                            //获取跟这个人的聊天记录
                            self.$websocket.invoke("SendChatRecordToUser", {
                                FromUserId: self.GetCurrentUser.Id,
                                ToUserId: self.CurrentLastContact.ContactUserId,
                                OsClient: self.DiyCommon.GetOsClient()
                            });
                            self.$nextTick(function () {
                                self.wchat_ToBottom();
                            });
                        }
                    });
                }
                if (self.DiyCommon.IsNull(self.$websocket.methods["ReceiveSendChatRecordToUser".toLowerCase()])) {
                    self.$websocket.on("ReceiveSendChatRecordToUser", (message) => {
                        console.log(`获取与[${self.CurrentLastContact.ContactUserName}]的聊天记录成功！`);
                        self.ChatRecord = [];
                        self.ChatRecord = message;
                        self.$nextTick(function () {
                            self.wchat_ToBottom();
                        });
                    });
                }
                if (self.DiyCommon.IsNull(self.$websocket.methods["ReceiveSendLastContacts".toLowerCase()])) {
                    self.$websocket.on("ReceiveSendLastContacts", (message) => {
                        console.log("获取最近联系人列表成功！");
                        self.FirstConnectWebsocket = false;
                        self.LastContacts = message;
                        // if (self.DiyCommon.IsNull(self.CurrentLastContact.ContactUserId)
                        //     && self.LastContacts.length > 0) {
                        //     // self.CurrentLastContact = self.LastContacts[0];
                        //     self.$store.commit('DiyStore/SetDiyChatCurrentLastContact', self.LastContacts[0]);
                        //     //获取跟这个人的聊天记录
                        //     self.$websocket.invoke("SendChatRecordToUser", {
                        //         FromUserId : self.GetCurrentUser.Id,
                        //         ToUserId : self.LastContacts[0].ContactUserId,
                        //         OsClient : self.DiyCommon.GetOsClient()
                        //     })
                        //     .then((res) => {

                        //     })
                        //     .catch((err) => {
                        //         console.error('SendLastContacts：', err.toString())
                        //     });
                        // }
                        // var needPostIds = [];
                        // message.forEach(element => {
                        //     if(_.where(self.UserIdsInfo, {Id : element.contactUserId}).length == 0){
                        //         needPostIds.push(element.contactUserId);
                        //     }
                        // });
                        // if (needPostIds.length > 0) {
                        //     //这里要根据UserId获取到昵称、头像
                        //     self.DiyCommon.Post('/api/SysUser/getsysuserPublicInfo', {Ids : needPostIds}, function(result){
                        //         if (self.DiyCommon.Result(result)) {
                        //             result.Data.forEach(element => {
                        //                 if(_.where(self.UserIdsInfo, {Id : element.Id}).length == 0){
                        //                     self.UserIdsInfo.push(element);
                        //                 }else{
                        //                     self.UserIdsInfo.forEach(userInfo => {
                        //                         if (userInfo.Id == element.Id) {
                        //                             userInfo = element;
                        //                         }
                        //                     });
                        //                 }
                        //             });
                        //         }
                        //     });
                        // }
                    });
                }
                if (self.DiyCommon.IsNull(self.$websocket.methods["ReceiveSendUnreadCountToUser".toLowerCase()])) {
                    self.$websocket.on("ReceiveSendUnreadCountToUser", (message) => {
                        console.log("获取到未读消息条数：", message);
                        self.$root.UnreadCount = message;
                        if (message > 0) {
                            self.DiyCommon.Tips(`您有${message}条未读消息！`, true, null, {
                                position: "top-right"
                            });
                        }
                    });
                }
            }
        },
        SendLastContacts() {
            var self = this;

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
        SendMessage() {
            var self = this;
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
                var tempId = "随机生成";
                self.ChatRecord.push({
                    Content: _html, //msgTpl,
                    ToUserId: self.GetCurrentLastContact.ContactUserId,
                    FromUserId: self.GetCurrentUser.Id,
                    CreateTime: new Date().Format("HH:mm yyyy/MM/dd"),
                    LastMessage: _html,
                    tempId: tempId
                });
                self.$websocket
                    .invoke("SendToUser", {
                        Content: _html, //msgTpl,
                        OsClient: self.DiyCommon.GetOsClient(),
                        ToUserId: self.GetCurrentLastContact.ContactUserId,
                        ToUserName: self.GetCurrentLastContact.ContactUserName,
                        ToUserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentLastContact.ContactUserAvatar),
                        FromUserId: self.GetCurrentUser.Id,
                        FromUserName: self.GetCurrentUser.Name,
                        FromUserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar)
                    }) //, self.GetCurrentUser.Id
                    .then((res) => {
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
                        //根据tempId标记发送失败
                        self.BtnLoading = false;
                        console.error("SendToUser：", err.toString());
                    });
            } catch (error) {
                self.BtnLoading = false;
                console.log("SendMessage：", error);
            }
        }
    }
};
</script>

<style lang="scss">
@import "@/views/chat/css/fonts/iconfont.css";
@import "@/views/chat/css/reset.scss";
@import "@/views/chat/css/layout.scss";

</style>
