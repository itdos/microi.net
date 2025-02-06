import store from '@/store'
import { Base64 } from 'js-base64';
// import Cookies from 'js-cookie'
//import { DiyStore } from '../store/diy.store'//2021-04-20注释
// import Router from 'vue-router'
import qs from 'qs'
import axios from 'axios'
import { DosCommon } from './dos.common.js'
import i18n from '@/lang'
import enableInlineVideo from 'iphone-inline-video'
import { Notification, MessageBox, Message, Loading } from 'element-ui'
import { getToken, getTokenExpires, removeToken, setToken, setTokenExpires } from '@/utils/auth.js'
import { DiyApi } from '../api/api.itdos'
import $ from 'jquery'
import _ from 'underscore'
// import { for } from 'core-js/fn/symbol'
import QRCode from 'qrcodejs2'

// Vue.prototype.$notify = Notification;
const pathBase = './'
const isClientApp = false;
var DiyCommon = {
    MicroiNetVersion: 'v1.9.7.2',
    PageSizes: [10, 15, 20, 30, 40, 50, 100],//, 200, 300, 500, 1000
    TokenKey: 'authorization',
    TokenExpiresKey: 'authorization-expires',
    OsClient: '',
    SysDefaultField: [
        {
            Id: 'CreateTime',
            Label: '创建时间',
            Name: 'CreateTime',
            Type: 'varchar(50)',
            Component: 'DateTime'
        },
        {
            Id: 'UserName',
            Label: '创建人',
            Name: 'UserName',
            Type: 'varchar(50)',
            Component: 'Text'
        },
        {
            Id: 'UpdateTime',
            Label: '修改时间',
            Name: 'UpdateTime',
            Type: 'varchar(50)',
            Component: 'DateTime',
        },
    ],
    RemoveHtml: function (html) {
        if (DiyCommon.IsNull(html)) {
            return '';
        }
        var regx = /<[^>]*>|<\/[^>]*>/gm;
        var result = html.replace(regx, "");
        return result;
    },
    testUserModel: {
        Code: 1,
        Data: {
            _Child: null,
            ParentId: '00000000-0000-0000-0000-000000000000',
            GroupName: null,
            _IsAdmin: false,
            _Roles: [
                {
                    ParentId: '00000000-0000-0000-0000-000000000000',
                    _Child: null,
                    SysMenuIds: null,
                    Id: 'a1433fb6-6752-49d4-a8c9-f7de0ae03d94',
                    Name: 'demo',
                    CreateTime: '2019/07/30 15:14:09',
                    UpdateTime: '2019/08/01 10:23:43',
                    Sort: null,
                    Class: '',
                    BaseLimit: '["查询"]'
                }
            ],
            Authorization: null,
            Id: '315b60bb-878a-4f89-b6fe-b0dee81a316c',
            No: 'Hr2019#0001',
            Account: 'demo',
            Pwd: '',
            Name: '',
            RealName: 'demo',
            Phone: '',
            CreateTime: '2019/07/29 15:30:07',
            State: 1,
            Remark: '',
            Avatar: '',
            InitCalendar: false,
            Sex: null,
            IsDelete: false
        },
        Msg: null,
    },
    showGotoWebOS: false,
    isClientApp: false,
    GetPageBodyClientWH() {
        var result = {
            Width: document.body.clientWidth,
            Height: document.body.clientHeight
        };
        return result;
    },
    GetFileServer: function () {
        try {
            if (FileServer) {
                return FileServer;
            }
        } catch (error) {

        }
        var result = store.state.DiyStore.FileServer;
        if (!DiyCommon.IsNull(result)) {
            return result;
        }
        return 'https://static-ali-img.itdos.com'
    },
    GetMediaServer: function () {
        var result = store.state.DiyStore.MediaServer;
        if (!DiyCommon.IsNull(result)) {
            return result;
        }
        var osClient = DiyCommon.GetOsClient()
        if (osClient == 'Aijuhome') {
            return 'https://static-media.aijuhome.com'
        } else if (osClient == 'KaiTong') {
            return 'https://static-img.cargoee.com';
        } else if (osClient == 'ThinkHome') {
            return 'https://static-diy.thinkhome.com.cn';
        }
        return 'https://static-ali-media.itdos.com'
    },
    //如果是"."开头，会直接返回
    GetServerPath: function (path, returnNoImg) {
        var self = this
        if (DiyCommon.IsNull(path)) {
            if (returnNoImg === false) {
                return '';
            }
            return './static/img/no-img.jpg';
        }
        if (path.length >= 4 && path.substr(0, 4).toLowerCase() == 'http') {
            return path
        }
        if (path.length >= 1) {
            if (path.substr(0, 1) == '.') {
                return path
                path = path.substr(1, path.length - 1)
            }
            if (path.substr(0, 1) != '/' && path.substr(0, 1) != '\\') {
                path = '/' + path
            }
        }
        // 取文件格式，如果是视频、音频文件，则使用mediaServer
        var format = path.substring(path.lastIndexOf('.'), path.length).toLowerCase()
        if (format === '.mp4' ||
            format === '.avi' ||
            format === '.rmvb' ||
            format === '.wmv' ||
            format === '.mov' ||
            format === '.flv' ||
            format === '.3gp' ||

            format === '.mp3' ||
            format === '.ogg' ||
            format === '.wma' ||
            format === '.flac' ||
            format === '.ape'
        ) {
            return DiyCommon.GetMediaServer() + path
        }
        return DiyCommon.GetFileServer() + path
    },
    pathBase: './',
    SetApiBase(apiBase) {
        localStorage.setItem('DiyApiBase', apiBase);
        store.commit('DiyStore/SetState', {
            key: 'ApiBase',
            value: apiBase
        })
    },
    GetApiBase: function () {
        //如果index.html指定了ApiBase，这个权力最大
        if (!DiyCommon.IsNull(ApiBase)) {
            return ApiBase;
        }
        var result = store.state.DiyStore.ApiBase;
        if (!DiyCommon.IsNull(result)) {
            return result;
        }
        if (!DiyCommon.IsNull(localStorage.getItem('DiyApiBase'))) {
            return localStorage.getItem('DiyApiBase');
        }
        return 'https://api-china.itdos.com'
    },
    IsNull: function (str) {
        // try {
        if (str == null || str == undefined || str === '' || str === 'undefined' || str === 'null') {
            return true
        }
        return false
        // } catch (error) {
        //     return true
        // }
    },
    GetFileSize($bytesize) {
        let $i = 0
        // 当$bytesize 大于是1024字节时，开始循环，当循环到第4次时跳出；
        while (Math.abs($bytesize) >= 1024) {
            $bytesize = $bytesize / 1024
            $i++
            if ($i === 4) break
        }
        // 将Bytes,KB,MB,GB,TB定义成一维数组；
        const $units = ['B', 'KB', 'MB', 'GB', 'TB']
        const $newsize = Math.round($bytesize, 2)
        return $newsize + ' ' + $units[$i]
    },
    DateTimeFormat: function (time, format) {
        if (DiyCommon.IsNull(format)) {
            return time
        }
        var o = {
            'M+': time.getMonth() + 1, // month
            'd+': time.getDate(), // day
            'h+': time.getHours(), // hour
            'H+': time.getHours(), // hour
            'm+': time.getMinutes(), // minute
            's+': time.getSeconds(), // second
            'q+': Math.floor((time.getMonth() + 3) / 3), // quarter
            'S': time.getMilliseconds() // millisecond
        }
        if (/(y+)/.test(format)) {
            format = format.replace(RegExp.$1,
                (time.getFullYear() + '').substr(4 - RegExp.$1.length))
        }
        for (var k in o) {
            if (new RegExp('(' + k + ')').test(format)) {
                format = format.replace(RegExp.$1,
                    RegExp.$1.length == 1 ? o[k]
                        : ('00' + o[k]).substr(('' + o[k]).length))
            }
        }
        return format
    },
    // apiBase : apiBase,
    Months: [
        i18n.messages[i18n.locale].Msg.Jan,
        i18n.messages[i18n.locale].Msg.Feb,
        i18n.messages[i18n.locale].Msg.Mar,
        i18n.messages[i18n.locale].Msg.Apr,
        i18n.messages[i18n.locale].Msg.May,
        i18n.messages[i18n.locale].Msg.Jun,
        i18n.messages[i18n.locale].Msg.Jul,
        i18n.messages[i18n.locale].Msg.Aug,
        i18n.messages[i18n.locale].Msg.Sept,
        i18n.messages[i18n.locale].Msg.Oct,
        i18n.messages[i18n.locale].Msg.Nov,
        i18n.messages[i18n.locale].Msg.Dec
    ],
    Weeks: [i18n.messages[i18n.locale].Msg.Sun, i18n.messages[i18n.locale].Msg.Mon, i18n.messages[i18n.locale].Msg.Tues, i18n.messages[i18n.locale].Msg.Wed, i18n.messages[i18n.locale].Msg.Thurs, i18n.messages[i18n.locale].Msg.Fri, i18n.messages[i18n.locale].Msg.Sat],
    FirstOpenLogin: true,
    videoLoginObj: null,
    videoDesktopObj: null,
    IsFullScreen: false,
    Did: '',
    Authorization: function () {
        return DiyCommon.getToken();
    },
    zTreeSet: {
        edit: {
            enable: true,
            showRemoveBtn: true,
            showRenameBtn: true
        },
        data: {
            key: {
                id: 'Id',
                children: '_Child',
                name: 'Name',
                parentId: 'ParentId'
            }
        },
        // viewAddHoverDom:function(){},
        view: {
            dblClickExpand: true,
            showLine: true,
            selectedMulti: false,
            removeHoverDom: function (treeId, treeNode) {
                $('#addBtn_' + treeNode.tId)
                    .unbind()
                    .remove()
            }
            // addHoverDom:function(treeId, treeNode) {
            // },
        },
        callback: {
            // beforeDrop: function(treeId, treeNodes, targetNode, moveType) {
            // 	if (targetNode == null) {
            // 		return false;
            // 	}
            // },
            onDrop: function () { },
            onRemove: function (e, treeId, treeNode) { },
            beforeClick: function (treeId, treeNode) { }
        }
    },
    zTreeSetCheck: {
        check: {
            enable: true,
            chkboxType: { 'Y': 's', 'N': 's' }
        },
        data: {
            key: {
                id: 'Id',
                children: '_Child',
                name: 'Name',
                parentId: 'ParentId'
            }
        },
        view: {
            dblClickExpand: true,
            showLine: true,
            selectedMulti: true
        },
        callback: {

        }
    },
    dialogSet: {
        skin: 'itdos',
        storeStatus: false,
        cloneElementContent: false,
        borderRadius: '0px',
        // border:'1px solid #3baced',
        dragInTopToMax: false,
        // statusBar: true,
        buttonKey: false,
        icon: '<img src="' + pathBase + 'static/image/favicon.ico" style="height:15px;display:block;" />',
        event: {
            onfocus: {},
            onload: {},
            ondestroy: {},
            onmin: {},
            onrestore: {},
            onmax: {}
        }

    },
    layxSetEventOnmax: {
        before: function (layxOs, winform) {
        },
        after: function (layxOs, winform) {
            $(layxOs).height('calc(100vh - 40px)')
        }
    },
    layxSetConfirm: {
        skin: 'itdos-confirm',
        // cloneElementContent: false,
        // statusBar: true,
        storeStatus: false,
        borderRadius: '0px',
        // border:'1px solid #3baced',
        dragInTopToMax: false,
        icon: '<img src="' + pathBase + 'static/image/favicon.ico" style="height:15px;display:block;" />',
        width: 300,
        height: 150,
        dialogIcon: 'help'
    },
    ModalLoadingHtml:
        '<div class="itdos-plugin-load-container modal-loading" style="background-color:var(--theme-color);width:100%;height:100%;opacity: 0.9;transition: 0.3s;">' +
        '<div class="microi-desktop-load">' +
        '<div class="microi-desktop-loading">' +
        '<div class="microi-desktop-dot"></div>' +
        '<div class="microi-desktop-dot"></div>' +
        '<div class="microi-desktop-dot"></div>' +
        '<div class="microi-desktop-dot"></div>' +
        '<div class="microi-desktop-dot"></div>' +
        '</div>' +
        '</div>' +
        '</div>',
    GuidEmpty: '00000000-0000-0000-0000-000000000000',
    CompressMaxSize: 210,
    CompressMaxSize_Min: 70,
    CompressMaxWidth: 780,
    CompressMaxWidth_Min: 460,
    UploadImgMaxSize: 10, // M
    UploadPdfMaxSize: 100, // M
    CommonFormWidth: 768,
    SysMenuNeedConvertField: [
        "JoinTables",
        "SelectFields",
        "TableDiyFieldIds",
        "NotShowFields",
        "SearchFieldIds",
        "SortFieldIds",
        "DiyConfig",
        "StatisticsFields",
        'MoreBtns',
        'ExportMoreBtns',
        'BatchSelectMoreBtns',
        'PageBtns',
        'FormBtns',
        'PageTabs',
        'InTableEditFields',
        'TableHeaders',
    ],
    ShowVideo: function () {
        var self = this
        // 背景视频播放，不支持安卓360浏览器、安卓自带浏览器，安卓360浏览器、自带浏览器会让视频直接置顶播放，无法解决。
        // 不支持安卓微信公众号
        // 支持苹果微信公众号、支持苹果所有浏览器、支持安卓谷歌浏览器。
        // 这里的判断会导致安卓在chrome72版本浏览器上也不显示视频，但没办法，因为安卓360浏览器是chrome73版本都没法显示视频，我没法区分安卓360和安卓chrome
        return !DiyCommon.IsNull(store.state.DiyStore.DesktopBg.LockVideoUrl) &&
            DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id) &&
            // 如果 是app 或者 不是app但并且不是安卓浏览器，也要显示视频
            (DiyCommon.isClientApp || (!DiyCommon.isClientApp && !DosCommon.isAndroid))
    },


    GetLanDate: function (date) {
        // var self = this
        // try {
        //     console.log('store.state.DiyStore.Lang:', store.state.DiyStore.Lang)
        // } catch (error) {
        //     console.log(error.message)
        // }
        // return;
        if (store.state.DiyStore.Lang == 'zh-CN') {
            return date + '日'
        }
        if (date <= 3) {
            if (date == 1) {
                return date + 'st'
            } else if (date == 2) {
                return date + 'nd'
            } else if (date == 3) {
                return date + 'rd'
            } else {
                return date + 'th'
            }
        } else {
            return date + 'th'
        }
    },

    ShowDesktopVideo: function () {
        var self = this
        return !DiyCommon.IsNull(store.state.DiyStore.DesktopBg.VideoUrl) && !DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id) &&
            (DiyCommon.isClientApp || (!DiyCommon.isClientApp && !DiyCommon.DosCommon.isAndroid))
    },
    // GetLangName(name){
    // 	var self = this;
    // 	if (DiyCommon.Lang == 'cn') {
    // 		return name;
    // 	}
    // 	return 'En' + name;
    // },
    GetLangValue: function (obj, name) {
        var self = this
        try {
            if (store.state.DiyStore.Lang == 'zh-CN') {
                return obj[name]
            }
            var enName = obj['En' + name]
            if (DiyCommon.IsNull(enName)) {
                return obj[name]
            }
            return enName
        } catch (error) {
            try {
                return obj[name]
            } catch (error) {
                return ''
            }
        }
    },
    // 语言切换
    ChangeLang: function (lang, notTips) {
        var self = this
        // console.log(e)
        localStorage.setItem('lang', lang)
        i18n.locale = lang
        store.dispatch('DiyStore/SetLang', lang)
        DiyCommon.InitLangData()
        if (notTips !== true) {
            DiyCommon.Tips(i18n.messages[i18n.locale].Msg.Success)
        }
    },
    InitLangData: function () {
        var self = this
        DiyCommon.Weeks = [i18n.messages[i18n.locale].Msg.Sun, i18n.messages[i18n.locale].Msg.Mon, i18n.messages[i18n.locale].Msg.Tues, i18n.messages[i18n.locale].Msg.Wed, i18n.messages[i18n.locale].Msg.Thurs, i18n.messages[i18n.locale].Msg.Fri, i18n.messages[i18n.locale].Msg.Sat]
        DiyCommon.Months = [i18n.messages[i18n.locale].Msg.Jan,
        i18n.messages[i18n.locale].Msg.Feb,
        i18n.messages[i18n.locale].Msg.Mar,
        i18n.messages[i18n.locale].Msg.Apr,
        i18n.messages[i18n.locale].Msg.May,
        i18n.messages[i18n.locale].Msg.Jun,
        i18n.messages[i18n.locale].Msg.Jul,
        i18n.messages[i18n.locale].Msg.Aug,
        i18n.messages[i18n.locale].Msg.Sept,
        i18n.messages[i18n.locale].Msg.Oct,
        i18n.messages[i18n.locale].Msg.Nov,
        i18n.messages[i18n.locale].Msg.Dec
        ]
    },
    SetWebTitle(val) {
        store.commit('DiyStore/SetState', {
            key: 'WebTitle',
            value: val
        })
        document.title = val
    },
    SetShortTitle(val) {
        store.commit('DiyStore/SetState', {
            key: 'ShortTitle',
            value: val
        })
    },
    SetSystemSubTitle(val) {
        store.commit('DiyStore/SetState', {
            key: 'SystemSubTitle',
            value: val
        })
        document.title = val
    },
    SetClientCompany(company, url) {
        store.commit('DiyStore/SetState', {
            key: 'ClientCompany',
            value: company
        })
        if (!DiyCommon.IsNull(url)) {
            store.commit('DiyStore/SetState', {
                key: 'ClientCompanyUrl',
                value: url
            })
        }
    },
    SetOsClient(osClient) {
        localStorage.setItem('OsClient', osClient);
        store.commit('DiyStore/SetState', {
            key: 'OsClient',
            value: osClient
        })
    },
    GetOsClient() {
        var self = this;
        if (!DiyCommon.IsNull(OsClient)) {
            return OsClient;
        }
        var result = store.state.DiyStore.OsClient;
        if (!DiyCommon.IsNull(result)) {
            return result;
        }
        var href = window.location.href.toLowerCase()
        var reg190317 = new RegExp('(^|&)' + 'OsClient' + '=([^&]*)(&|$)')
        var r190317 = window.location.search.substr(1).match(reg190317)
        var osClient = r190317 != null ? r190317[2] : '';
        if (!DiyCommon.IsNull(localStorage.getItem('OsClient'))) {
            osClient = localStorage.getItem('OsClient');
            return osClient;
        }
        else if (!DiyCommon.IsNull(osClient)) {
            return osClient
        }
        else {
            return 'iTdos'
        }
    },
    GetApiClientUrl() {
        var self = this
        var customerApi = ''
        var osClient = DiyCommon.GetOsClient() // store.state.DiyStore.OsClient;

        if (osClient == 'Auth' ||
            osClient == 'Api' ||
            osClient == 'iTdos'
        ) {
            customerApi = ''
        } else {
            customerApi = osClient
        }

        return (customerApi == '' ? '' : customerApi + '/')
    },
    // video格式：[{src:'',type:'video/mp4'}]
    LoadVideoLogin: function (poster, video, isOpenAudio) {
        var self = this
        // 现在是调用新的插件
        // DiyCommon.$nextTick(function () {//2020-04-22临时注释
        if (DiyCommon.ShowVideo()) {
            var video = document.querySelector('#videoLogin')
            enableInlineVideo(video)
        }
        // });

        // 如果不用video.js，就直接return。
        return
        if (!DiyCommon.IsNull(store.state.DiyStore.DesktopBg.LockVideoUrl)) {
            if (DiyCommon.videoLoginObj == null) {
                DiyCommon.videoLoginObj = videojs('videoLogin', {
                    autoplay: true,
                    controls: false,
                    loop: true,
                    preload: 'none',
                    muted: !store.state.DiyStore.DesktopBg.LockVideoVoice,
                    poster: store.state.DiyStore.DesktopBg.LockImgUrl,
                    sources: [{
                        src: store.state.DiyStore.DesktopBg.LockVideoUrl,
                        type: 'video/mp4'
                    }],
                    bigPlayButton: false,
                    textTrackDisplay: false,
                    posterImage: true,
                    errorDisplay: false,
                    controlBar: false
                }, function () {
                    if (DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id)) {
                        DiyCommon.videoLoginObj.play()
                    }
                })
            } else {
                if (!DiyCommon.IsNull(poster)) {
                    DiyCommon.videoLoginObj.poster(poster)
                }
                if (!DiyCommon.IsNull(video)) {
                    DiyCommon.videoLoginObj.src(video)
                }
                if (!DiyCommon.IsNull(isOpenAudio)) {
                    DiyCommon.videoLoginObj.muted(!isOpenAudio)
                }
                if (DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id)) {
                    if (!DiyCommon.IsNull(poster) || !DiyCommon.IsNull(video)) {
                        DiyCommon.videoLoginObj.load()
                    } else {
                        DiyCommon.videoLoginObj.play()
                    }
                }
            }
        }
    },

    LoadVideoDesktop: function (poster, video, isOpenAudio) {
        var self = this
        // 现在是调用新的插件
        // DiyCommon.$nextTick(function () {//2020-04-22临时注释
        if (!DiyCommon.IsNull(store.state.DiyStore.DesktopBg.VideoUrl) && !DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id)) {
            var video = document.querySelector('#videoDesktop')
            enableInlineVideo(video)
        }
        // });

        // 如果不用video.js，就直接return。
        return
        if (!DiyCommon.IsNull(store.state.DiyStore.DesktopBg.VideoUrl)) {
            if (DiyCommon.videoDesktopObj == null) {
                DiyCommon.videoDesktopObj = videojs('videoDesktop', {
                    autoplay: true,
                    controls: false,
                    loop: true,
                    preload: 'auto',
                    muted: !store.state.DiyStore.DesktopBg.VideoVoice,
                    poster: store.state.DiyStore.DesktopBg.ImgUrl,
                    sources: [{
                        src: store.state.DiyStore.DesktopBg.VideoUrl,
                        type: 'video/mp4'
                    }],
                    bigPlayButton: false,
                    textTrackDisplay: false,
                    posterImage: true,
                    errorDisplay: false,
                    controlBar: false
                }, function () {
                    if (!DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id)) {
                        DiyCommon.videoDesktopObj.play()
                    }
                })
            } else {
                if (!DiyCommon.IsNull(poster)) {
                    DiyCommon.videoDesktopObj.poster(poster)
                }
                if (!DiyCommon.IsNull(video)) {
                    DiyCommon.videoDesktopObj.src(video)
                }
                if (!DiyCommon.IsNull(isOpenAudio)) {
                    DiyCommon.videoDesktopObj.muted(!isOpenAudio)
                }
                if (!DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id)) {
                    if (!DiyCommon.IsNull(poster) || !DiyCommon.IsNull(video)) {
                        DiyCommon.videoDesktopObj.load()
                    } else {
                        DiyCommon.videoDesktopObj.play()
                    }
                }
            }
        }
    },
    DisposeVideoLogin: function () {
        // 如果不用video.js，就直接return。
        return
        var self = this
        if (DiyCommon.videoLoginObj) {
            DiyCommon.videoLoginObj.pause()
        }
    },
    DisposeVideoDesktop: function () {
        // 如果不用video.js，就直接return。
        return
        var self = this
        if (DiyCommon.videoDesktopObj) {
            DiyCommon.videoDesktopObj.pause()
        }
    },
    SetDosUiWinTabLeftAndRightWidth: function (id) {
        var self = this
        $('#' + id + ' .microi-desktop-tab-left').css('max-width', '200px')
        var leftWidth = $('#' + id + ' .microi-desktop-tab-left').width()
        if (leftWidth >= 200) {
            $('#' + id + ' .microi-desktop-tab-right').width('calc(100% - 200px)')
        } else if (leftWidth >= 1) {
            $('#' + id + ' .microi-desktop-tab-right').width('83.33333%')
        } else {
            $('#' + id + ' .microi-desktop-tab-right').width('100%')
        }
        $('#' + id + ' .microi-desktop-tab-right').css('left', leftWidth + 'px')
        $('#' + id + ' .microi-desktop-tab-left').resize(function () {
            var leftWidth = $('#' + id + ' .microi-desktop-tab-left').width()
            if (leftWidth >= 200) {
                $('#' + id + ' .microi-desktop-tab-right').width('calc(100% - 200px)')
            } else if (leftWidth >= 1) {
                $('#' + id + ' .microi-desktop-tab-right').width('83.33333%')
            } else {
                $('#' + id + ' .microi-desktop-tab-right').width('100%')
            }
            $('#' + id + ' .microi-desktop-tab-right').css('left', leftWidth + 'px')
        })
        // return $('#' + id +' .microi-desktop-tab-left').width();
    },
    IsArray: function (val) {
        return Array.isArray(val)
    },
    StrToJson: function (str) {
        var self = this
        if (DiyCommon.IsNull(str)) {
            return []
        }
        return JSON.parse(str)
    },
    Page: function (pageNo, pageSize, array) {
        var offset = (pageNo - 1) * pageSize
        return (offset + pageSize >= array.length) ? array.slice(offset, array.length) : array.slice(offset, offset + pageSize)
    },
    GetDid: function () {
        var self = this
        try {
            DiyCommon.Did = plus.device.uuid.split(',')[0]
            if (DiyCommon.IsNull(DiyCommon.Did)) {
                // 如果获取did失败，随机生成一个did（生成前查询是否已生成过）
                var tDid = localStorage.getItem('did')
                if (DiyCommon.IsNull(tDid)) {
                    tDid = DiyCommon.NewGuid()
                    localStorage.setItem('did', tDid)
                }
                DiyCommon.Did = tDid
            } else {
                localStorage.setItem('did', DiyCommon.Did)
            }
        } catch (error) {
            // 如果获取did失败，随机生成一个did（生成前查询是否已生成过）
            var tDid = localStorage.getItem('did')
            if (DiyCommon.IsNull(tDid)) {
                tDid = DiyCommon.NewGuid()
                localStorage.setItem('did', tDid)
            }
            DiyCommon.Did = tDid
        }
        return DiyCommon.Did
    },
    NewGuid: function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0
            var v = c == 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    },
    GuidRemoveSing: function (guid) {
        return guid.replace(/-/g, '')
    },

    plusReady: function (auto) {
        var self = this
        // 获取本地应用资源版本号
        plus.runtime.getProperty(plus.runtime.appid, function (inf) {
            var wgtVer = Number(inf.version)
            // 检测更新
            DiyCommon.checkUpdate(wgtVer, auto)
        })
    },
    // 检测更新
    checkUpdate: function (wgtVer, auto) {
        var self = this
        // 如果不是自动更新，是手动更新，则出现提示
        if (auto === false) {
            plus.nativeUI.showWaiting('检测更新...')
        }
        var xhr = new XMLHttpRequest()
        xhr.onreadystatechange = function () {
            switch (xhr.readyState) {
                case 4:
                    if (auto === false) {
                        plus.nativeUI.closeWaiting()
                    }
                    if (xhr.status == 200) {
                        // console.log("检测更新成功：" + xhr.responseText);
                        var newVer = Number(xhr.responseText)
                        if (wgtVer && newVer && (wgtVer < newVer)) {
                            // 用户确认是否更新
                            var dialogSet = JSON.parse(JSON.stringify(DiyCommon.layxSetConfirm))
                            dialogSet.skin = 'itdos-confirm-upt'
                            DiyCommon.OsConfirm(i18n.messages[i18n.locale].Msg.FindNewVersion +
                                '<br>' + i18n.messages[i18n.locale].Msg.CurrentVersion + wgtVer +
                                '<br>' + i18n.messages[i18n.locale].Msg.NewVersion + newVer, function () {
                                    DiyCommon.downWgt() // 下载升级包
                                })
                            // layx.confirm('提示', '检测到新版本，是否更新？'
                            // 	+ '<br>您当前版本：' + wgtVer
                            // 	+ '<br>最新版本：' + newVer, function (id) {
                            // 		DiyCommon.downWgt(); // 下载升级包
                            // 		layx.destroy(id);
                            // 	}, dialogSet);
                        } else {
                            if (auto === false) {
                                plus.nativeUI.alert(i18n.messages[i18n.locale].Msg.NoNewVersion)
                            }
                        }
                    } else {
                        if (auto === false) {
                            // console.log("检测更新失败！");
                            plus.nativeUI.alert(i18n.messages[i18n.locale].Msg.CheckVersionError)
                        }
                    }
                    break
                default:
                    break
            }
        }
        xhr.open('GET', 'https://api.itdos.com/api/os/GetAppVersion?OsClient=' + DiyCommon.GetOsClient())
        xhr.send()
    },
    // 下载wgt文件
    downWgt: function () {
        var self = this
        plus.nativeUI.showWaiting('正在下载更新文件...')
        plus.downloader.createDownload('https://api.itdos.com/api/os/DownloadWgt?OsClient=' + DiyCommon.GetOsClient(), {
            filename: '_doc/update/'
        }, function (d, status) {
            if (status == 200) {
                plus.nativeUI.closeWaiting()
                // console.log("下载wgt成功：" + d.filename);
                DiyCommon.installWgt(d.filename) // 安装wgt包
            } else {
                plus.nativeUI.closeWaiting()
                // console.log("下载wgt失败！");
                plus.nativeUI.alert('下载wgt失败！')
            }
        }).start()
    },
    // 更新应用资源
    installWgt: function (path) {
        var self = this
        plus.nativeUI.showWaiting(i18n.messages[i18n.locale].Msg.InstallingUpdate)
        plus.runtime.install(path, {}, function () {
            plus.nativeUI.closeWaiting()
            // console.log("安装wgt文件成功！");
            plus.nativeUI.alert(i18n.messages[i18n.locale].Msg.UpdateSuccess, function () {
                plus.runtime.restart()
            })
        }, function (e) {
            plus.nativeUI.closeWaiting()
            // console.log("安装wgt文件失败[" + e.code + "]：" + e.message);
            plus.nativeUI.alert('安装更新文件失败[' + e.code + ']：' + e.message)
        })
    },

    SetThemeColor: function (color) {
        if ($('body').attr('class')) {
            $('body').attr('class', $('body').attr('class').replace(/\bmicroi-desktop-color.*?\b/g, '').replace(/(^\s*)|(\s*$)/g, ''))
        }
        document.body.classList.add('microi-desktop-color' + color)
    },
    SetWin10Loading: function (b) {
        // this.SetOsLoading(b)
        store.commit('DiyStore/SetOsLoading', b)
    },
    GetBizUserAllName: function (m) {
        var self = this
        if (DiyCommon.IsNull(m)) {
            return ''
        }
        var result = ''
        if (!DiyCommon.IsNull(m.Name)) {
            result += m.Name
        }
        if (!DiyCommon.IsNull(m.NickName) && result != m.NickName) {
            result += (DiyCommon.IsNull(result) ? '' : '/') + m.NickName
        }
        return result
    },
    // t:时间，单位s
    TopTips: function (c, b, t) {
        this.Tips(c, b, t, true)
    },
    // icon: success，error，info和warning
    // option
    OsPrompt: function (content, okCallback, cancelCallback, option) {
        var self = this
        if (DiyCommon.IsNull(option)) {
            option = {
                Title: i18n.messages[i18n.locale].Msg.Tips,
                Icon: 'warning',
                OkText: i18n.messages[i18n.locale].Msg.Ok,
                CancelText: i18n.messages[i18n.locale].Msg.Cancel
            }
        }
        if (DiyCommon.IsNull(option.Title)) {
            option.Title = i18n.messages[i18n.locale].Msg.Tips
        }
        if (DiyCommon.IsNull(option.Icon)) {
            option.Icon = 'warning'
        }
        if (DiyCommon.IsNull(option.OkText)) {
            option.OkText = i18n.messages[i18n.locale].Msg.Ok
        }
        if (DiyCommon.IsNull(option.CancelText)) {
            option.CancelText = i18n.messages[i18n.locale].Msg.Cancel
        }
        this.$prompt(content, option.Title, {
            dangerouslyUseHTMLString: true,
            confirmButtonText: option.OkText,
            cancelButtonText: option.CancelText
            // inputPattern: /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/,
            // inputErrorMessage: '邮箱格式不正确'
        }).then(({ value }) => {
            okCallback(value)
        }).catch(() => {
            if (!DiyCommon.IsNull(cancelCallback)) {
                cancelCallback()
            }
        })
    },
    OsConfirm: function (content, okCallback, cancelCallback, option) {
        var self = this
        if (DiyCommon.IsNull(option)) {
            option = {}
        }
        if (DiyCommon.IsNull(option.Title)) {
            option.Title = i18n.messages[i18n.locale].Msg.Tips
        }
        if (DiyCommon.IsNull(option.Icon)) {
            option.Icon = 'warning'
        }
        if (DiyCommon.IsNull(option.OkText)) {
            option.OkText = i18n.messages[i18n.locale].Msg.Ok
        }
        if (DiyCommon.IsNull(option.CancelText)) {
            option.CancelText = i18n.messages[i18n.locale].Msg.Cancel
        }
        if (DiyCommon.IsNull(option.ShowClose)) {
            option.ShowClose = true;
        }
        if (DiyCommon.IsNull(option.ShowCancelButton)) {
            option.ShowCancelButton = true;
        }
        MessageBox.confirm(content, option.Title, {
            confirmButtonText: option.OkText,
            cancelButtonText: option.CancelText,
            type: option.Icon,
            roundButton: false,
            dangerouslyUseHTMLString: true,
            cancelButtonClass: 'dialog-cancel',
            closeOnClickModal: false,
            closeOnPressEscape: false,
            closeOnHashChange: false,

            showClose: option.ShowClose,
            showCancelButton: option.ShowCancelButton,
        }).then(() => {
            okCallback()
        }).catch(() => {
            if (!DiyCommon.IsNull(cancelCallback)) {
                cancelCallback()
            }
        })
    },
    // success, warning, info, error
    OsAlert: function (content, option) {
        var self = this
        if (DiyCommon.IsNull(option)) {
            option = {
                Title: i18n.messages[i18n.locale].Msg.Tips,
                Icon: 'warning'
            }
        } else if (option === false) {
            option = {
                Title: i18n.messages[i18n.locale].Msg.Tips,
                Icon: 'error'
            }
        }
        if (DiyCommon.IsNull(option.Title)) {
            option.Title = i18n.messages[i18n.locale].Msg.Tips
        }
        if (DiyCommon.IsNull(option.Icon)) {
            option.Icon = 'warning'
        }

        Notification({
            title: option.Title,
            message: content,
            type: option.Icon,
            position: 'bottom-right',
            offset: 40,
            dangerouslyUseHTMLString: true
        })

        if (option.Icon === 'error') {
            try {
                var obj = $('#audioError')[0]
                obj.currentTime = 0
                obj.play()
            } catch (error) {

            }

        }
    },
    Tips: function (c, b, t, option) {
        var self = this
        if (c == '登录身份已过期！') {

        }
        if (DiyCommon.IsNull(b)) {
            b = true
        }

        if (DiyCommon.IsNull(t)) {
            if (b) {
                t = 1000
            } else {
                t = 5000
            }
        } else {
            if (b) {
                t = t * 1000
            } else {
                t = t * 5000
            }
        }

        // layx提示
        // (isTop === true || top.layx ? top.layx : layx).msg(c, {
        // 	//id: 'tips',
        // 	dialogIcon: b === true ? 'success' : 'error',
        // 	storeStatus: false,
        // 	autodestroy: t,
        // 	position: 'rb',
        // 	skin: 'itdos-tips',
        // 	borderRadius: '0px',
        // 	//width:360,
        // 	//height:63,
        // 	event: {
        // 		before: function (layxOs, winform) {
        // 		},
        // 		after: function (layxOs, winform) {
        // 			//$(layxOs).css('z-index','30000000');
        // 		}
        // 	}
        // });

        // element-ui提示   success, warning, info, error
        var position = 'bottom-right';
        if(option && option.position){
            position = option.position;
        }
        var nParam = {
            title: i18n.messages[i18n.locale].Msg.Tips,
            message: c,
            type: b === false ? 'error' : 'success',
            position: position,
            // duration: t ,
            offset: 40,
            dangerouslyUseHTMLString: true
        }
        if (!DiyCommon.IsNull(t)) {
            nParam.duration = t
        }
        Notification(nParam)

        if (b === false) {
            try {
                var obj = $('#audioError')[0]
                obj.currentTime = 0
                obj.play()
            } catch (error) {

            }

        }

        // layer提示
        // layer.msg(c, {
        // 	offset: 'rb',
        // 	anim: b === true ? 0 : 6,
        // 	time: t,
        // 	skin: 'dos-ui-os-tips',
        // });
    },
    Result: function (result) {
        var self = this;
        if (result == undefined) {
            return false;
        }
        if (result.Success || result.IsSuccess || result.Code == 1) {
            return true
        } else {
            if (result.Code == 1001 || result.Code == 1002) {
                // if (DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id) && (window.location.href.indexOf('www.itdos.com') > -1 || process.env.NODE_ENV === 'development')) {
                // 	var demoData = {"_Child":null,"ParentId":"00000000-0000-0000-0000-000000000000","GroupName":null,"IsAdmin":false,"Authorization":null,"Id":"95b3bc3f-caeb-4feb-9f7e-cc7e922e6032","No":"Hr2018#0003","Account":"demo","Pwd":"O+OC8oCmsBk=","RealName":null,"MobilePhone":null,"CreateTime":"2018-07-07 06:23","State":1,"Avatar":null,"Remark":null,"InitCalendar":false,"Sex":null,"IDNo":null,"Tel":null,"Address":null,"Notes":null,"Email":null,"WrokAge":0.0,"Territory":null,"Emergency":null,"EmergencyTel":null,"JoinTime":null,"LeaveTime":null,"IsDelete":false,"Class":null};
                // 	DiyCommon.SetCurrentUser({ Data: demoData});
                // 	DiyCommon.Post('/api/SysUser/TestLogin', {}, function (result) {
                // 		DiyCommon.SetCurrentUser({ Data: result.Data });
                // 		//location.reload();
                // 	});
                // 	return true;
                // }
                // console.log('iTdos ---------------result.Code == 1001 || result.Code == 1002------------------')
                // console.log(result)
                //2020-12-05注释，使用DiyCommon
                // store.dispatch('user/resetToken').then(() => {
                //     //location.reload()
                // })
                DiyCommon.setToken('');
                removeToken()

                DiyCommon.OpenLogin()
            } else if (result.Code == 1002) {
                // if (top.window.frames.length > 0) {
                // 	DiyCommon.OpenLogin();
                // 	top.window.location.reload();
                // } else {
                // 	DiyCommon.OpenLogin();
                // }
                console.log('iTdos -----------result.Code == 1002--------------')
                console.log(result)
                //2020-12-05注释，使用DiyCommon
                // store.dispatch('user/resetToken').then(() => {
                //     // location.reload()
                // })
                DiyCommon.setToken('');
                removeToken()

                DiyCommon.OpenLogin()
            }
            if (!(result.Code == 1001 && DiyCommon.IsNull(store.getters['DiyStore/GetCurrentUser'].Id))) {
                var msg = (DiyCommon.IsNull(result.Message) ? '' : result.Message) +
                    (DiyCommon.IsNull(result.Msg) ? '' : result.Msg);
                DiyCommon.Tips(msg, false)

            }
        }
    },
    OpenLogin: function () {
        var self = this
        // $('#divLogin').animate({'top':'0%'},700);
        // isNeedLogin = true
        // if (firstLoginCover == false) {
        //     $('#divLogin').css({
        //         'top': '0%'// 盖下来
        //     })
        // }
        // setTimeout(function(){
        // 	layx.html('divTips','技术架构',$('#divTips')[0],{
        // 		floatTarget:$('.bottomTipsITdos')[0],
        // 		width:$('.divLoginCenter').width(),
        // 		height:180,
        //    });
        // },1000);
        store.commit('DiyStore/SetCurrentUser', {})
        //注意这里不能跳转，否则会一直无限跳转。跳转前要先判断当前是不是已经登录了，已经登录的状态才需要跳转
        // store.push(`/login?redirect=`)//${store.route.fullPath}
        // location.reload();
        //如果不是登录界面，需要跳转到登录？ 2022-04-10改成不在这里跳转
        if (!(location.href.indexOf('login') > -1)) {
            // location.reload();
            // new Router().push(`/login`);
            // self.$router.push(`/login`);

            //2022-04-10注释
            // if (window.location.href.indexOf('OsClient') > -1) {
            //     // window.location.href = `/?OsClient=${DiyCommon.GetOsClient()}#/login`;
            //     window.location.href = window.location.origin + window.location.pathname + `?OsClient=${DiyCommon.GetOsClient()}#/login`;
            // }else{
            //     window.location.href = window.location.origin + window.location.pathname + "#/login";
            // }
        }
    },
    Post: function (url, param, callback, errorCallback, other, paramType) {
        var self = this;
        var realUrl = '';
        var header = {};
        if (typeof (url) == 'object') {
            realUrl = url.url;
            param = url.data;
            callback = url.success;
            errorCallback = url.error || url.fail;
            other = url.other;
            paramType = url.dataType;
            header = url.header;
        } else {
            realUrl = url;
        }

        if (DiyCommon.IsNull(realUrl)) {
            DiyCommon.Tips('url不能为空！', false);
            return;
        }

        if (realUrl.indexOf('http://') <= -1 && realUrl.indexOf('https://') <= -1) {
            realUrl = DiyCommon.GetApiBase() + realUrl
        }
        // 均可
        // DiyCommon.UseJqueryPost(url, param, callback, errorCallback);
        var axiosOption = {
            url: realUrl,
            param: param,
            callback: callback,
            errorCallback: errorCallback,
            method: 'post',
            other: other,
            paramType: paramType,
            header: header,
        };

        DiyCommon.UseAxios(axiosOption)
    },
    //同PostSync
    PostSync: async function (url, param, callback, errorCallback, paramType) {
        var self = this
        var realUrl = '';
        var header = {};
        if (typeof (url) == 'object') {
            realUrl = url.url;
            param = url.data;
            callback = url.success;
            errorCallback = url.fail;
            other = url.other;
            paramType = url.dataType;
            header = url.header;
        } else {
            realUrl = url;
        }
        if (DiyCommon.IsNull(realUrl)) {
            DiyCommon.Tips('url不能为空！', false);
            return;
        }
        if (realUrl.indexOf('http://') <= -1 && realUrl.indexOf('https://') <= -1) {
            realUrl = DiyCommon.GetApiBase() + realUrl
        }
        // 均可
        // DiyCommon.UseJqueryPost(url, param, callback, errorCallback);
        return await new Promise((resolve, reject) => {
            DiyCommon.UseAxios({
                url: realUrl,
                param: param,
                callback: callback,
                errorCallback: errorCallback,
                method: 'post',
                sync: true,
                other: null,
                resolve: resolve,
                paramType: paramType,
                header: header,
            })
        });
    },
    PostAsync: async function (url, param, callback, errorCallback, paramType) {
        var self = this
        var realUrl = '';
        var header = {};
        var other = '';
        if (typeof (url) == 'object') {
            realUrl = url.url;
            param = url.data;
            callback = url.success;
            errorCallback = url.fail;
            other = url.other;
            paramType = url.dataType;
            header = url.header;
        } else {
            realUrl = url;
        }
        if (DiyCommon.IsNull(realUrl)) {
            DiyCommon.Tips('url不能为空！', false);
            return;
        }

        if (realUrl.indexOf('http://') <= -1 && realUrl.indexOf('https://') <= -1) {
            realUrl = DiyCommon.GetApiBase() + realUrl
        }
        // 均可
        // DiyCommon.UseJqueryPost(url, param, callback, errorCallback);
        return await new Promise((resolve, reject) => {
            DiyCommon.UseAxios({
                url: realUrl,
                param: param,
                callback: callback,
                errorCallback: errorCallback,
                method: 'post',
                sync: true,
                other: null,
                resolve: resolve,
                paramType: paramType,
                header: header,
            })
        });
    },
    Get: function (url, param, callback, errorCallback) {
        var self = this
        if (url.indexOf('http://') <= -1 && url.indexOf('https://') <= -1) {
            url = DiyCommon.GetApiBase() + url
        }
        // 均可
        // DiyCommon.UseJqueryPost(url, param, callback, errorCallback);
        DiyCommon.UseAxios({
            url: url, param: param, callback: callback, errorCallback: errorCallback, method: 'get'
        })
    },
    GetSync: async function (url, param, callback, errorCallback) {
        var self = this
        if (url.indexOf('http://') <= -1 && url.indexOf('https://') <= -1) {
            url = DiyCommon.GetApiBase() + url
        }
        // 均可
        // DiyCommon.UseJqueryPost(url, param, callback, errorCallback);
        return await new Promise((resolve, reject) => {
            DiyCommon.UseAxios({
                url: url, param: param, callback: callback, errorCallback: errorCallback, method: 'get', sync: true, other: null, resolve: resolve
            })
        });
    },
    GetAsync: async function (url, param, callback, errorCallback) {
        var self = this
        if (url.indexOf('http://') <= -1 && url.indexOf('https://') <= -1) {
            url = DiyCommon.GetApiBase() + url
        }
        // 均可
        // DiyCommon.UseJqueryPost(url, param, callback, errorCallback);
        return await new Promise((resolve, reject) => {
            DiyCommon.UseAxios({
                url: url, param: param, callback: callback, errorCallback: errorCallback, method: 'get', sync: true, other: null, resolve: resolve
            })
        });
    },
    // allParams:[{Url:'', Param:{}}, {Url:'', Param:{}}]
    PostAll: function (allParams, callback, errorCallback) {
        var self = this
        allParams.forEach(param => {
            if (param.Url.indexOf('http://') <= -1 && param.Url.indexOf('https://') <= -1) {
                param.Url = DiyCommon.GetApiBase() + param.Url
            }
        })

        DiyCommon.UseAxiosAll({
            allParams: allParams, callback: callback, errorCallback: errorCallback,
            method: 'post',
        })
    },
    PostAllAsync: async function (allParams, callback, errorCallback) {
        var self = this
        allParams.forEach(param => {
            if (param.Url.indexOf('http://') <= -1 && param.Url.indexOf('https://') <= -1) {
                param.Url = DiyCommon.GetApiBase() + param.Url
            }
        })
        return await new Promise((resolve, reject) => {
            DiyCommon.UseAxiosAll({
                allParams: allParams, callback: callback, errorCallback: errorCallback,
                method: 'post',
                resolve: resolve
            })
        });
    },
    GetAll: function (allParams, callback, errorCallback) {
        var self = this
        allParams.forEach(param => {
            if (param.Url.indexOf('http://') <= -1 && param.Url.indexOf('https://') <= -1) {
                param.Url = DiyCommon.GetApiBase() + param.Url
            }
        })

        DiyCommon.UseAxiosAll({
            allParams: allParams, callback: callback, errorCallback: errorCallback,
            method: 'get',
        })
    },
    UseJqueryPost: function (url, param, callback, errorCallback) {
        var self = this
        $.ajax({
            type: 'post',
            url: url,
            data: param,
            success: function (result, textStatus, req) {
                // 拿到token，存起来
                var authorization = req.getResponseHeader('authorization')
                if (!DiyCommon.IsNull(authorization)) {
                    // store.commit('user/SET_TOKEN', authorization)
                    DiyCommon.setToken(authorization);
                    setToken(authorization);

                    DiyCommon.setTokenExpires(new Date().AddTime('m', 15).Format('yyyy-MM-dd HH:mm:ss'));
                    // sessionStorage.setItem('authorization', authorization);
                    localStorage.setItem('authorization', authorization);
                }

                callback(result)
            },
            // dataType: 'json',
            crossDomain: true,
            xhrFields: {
                // 从.net core2.1更新至2.2后，这里不能设置，否则反而不能跨域。但按理说应该要设置。
                // withCredentials: true
            },
            beforeSend: function (request) {
                request.setRequestHeader('did', DiyCommon.GetDid())
                // if (store.getters.token) {
                if (!DiyCommon.IsNull(DiyCommon.getToken())) {
                    request.setRequestHeader('authorization', 'Bearer ' + DiyCommon.getToken())
                }
                request.setRequestHeader('lang', localStorage.getItem('lang'));
                // }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                if (!DiyCommon.IsNull(errorCallback)) {
                    errorCallback()
                }
                if (XMLHttpRequest.status == 401) {
                    // 弹出登录
                    DiyCommon.OpenLogin()
                    DiyCommon.Tips(textStatus + ' ' + errorThrown, false)
                } else {
                    DiyCommon.Tips(textStatus + ' ' + errorThrown, false)
                }
            }
        })
    },
    UseAxios: function (params) {
        var self = this
        var { url, param, callback, errorCallback, method, sync, other, resolve, paramType, header } = params;
        if (!header) {
            header = {};
        }
        header.did = DiyCommon.GetDid();

        // if (store.getters.token) {
        if (!DiyCommon.IsNull(DiyCommon.getToken())) {
            header.authorization = 'Bearer ' + DiyCommon.getToken();
        }
        header.mac = localStorage.getItem('mac');
        header.lang = localStorage.getItem('lang');
        // }
        // if (DiyCommon.IsNull(sync)) {
        //     sync = false;
        // }
        var axiosOption = {
            url: url,
            // async: DiyCommon.IsNull(sync) || sync == false ? true : false,
            method: method,//'post',
            responseType: 'json',
            changeOrigin: true,
            // 从.net core2.1更新至2.2后，这里不能设置，否则反而不能跨域。但按理说应该要设置。
            // withCredentials:true,
            // data: qs.stringify(param),
            // headers:{'Content-Type':'application/x-www-form-urlencoded'}
            headers: header
        };
        if (method == 'post') {
            if (paramType && paramType.toLowerCase() == "json") {
                axiosOption.data = param;
            } else if (
                url.indexOf('/api/ApiEngine/') > -1
                || url.indexOf('/api/DataSourceEngine/') > -1
                || url.indexOf('/api/FormEngine/') > -1
                || url.indexOf('/api/ModuleEngine/') > -1
                || url.indexOf('/apiengine') > -1
            ) {
                axiosOption.data = param;
            }
            else {
                axiosOption.data = qs.stringify(param);
            }
        } else if (method == 'get') {
            axiosOption.params = param;
        } else {
            DiyCommon.Tips('Error method:' + method, false)
            return;
        }
        axios(axiosOption).then(function (req, b, c) {
            // 拿到token，存起来
            var authorization = req.headers.authorization
            if (!DiyCommon.IsNull(authorization)) {

                store.commit('user/SET_TOKEN', authorization)
                DiyCommon.setToken(authorization)
                setToken(authorization);

                DiyCommon.setTokenExpires(new Date().AddTime('m', 15).Format('yyyy-MM-dd HH:mm:ss'));
                // sessionStorage.setItem('authorization', authorization);
                localStorage.setItem('authorization', authorization);
            }
            if (!DiyCommon.IsNull(callback)) {
                try {
                    // req.data.__header = req.headers;
                } catch (error) {

                }
                callback(req.data, req.headers)
            }
            if (!DiyCommon.IsNull(resolve)) {
                try {
                    // req.data.__header = req.headers;
                } catch (error) {

                }
                resolve(req.data, req.headers);
            }
            var result = req.data;
            var msg = (DiyCommon.IsNull(result.Message) ? '' : result.Message) +
                (DiyCommon.IsNull(result.Msg) ? '' : result.Msg);
            if (
                (DiyCommon.IsNull(other) || other.NoLog !== true)
                && !DiyCommon.IsNull(result)
                && (result.Success === false || result.Success === false
                    || (!DiyCommon.IsNull(result.Code) && result.Code !== 1 && result.Code !== 1001))
                && localStorage.getItem('authorization')
            ) {
                try {
                    // DiyCommon.Post('/api/syslog/addsyslog', {
                    //     Type :'前端异常',
                    //     Title:'前端异常',
                    //     Content: msg + '。url:' + url + '。param：' + JSON.stringify(param)
                    // },function(resultLog){

                    // }, null, {
                    //     NoLog : true
                    // });
                } catch (error) {

                }
            }
        }).catch(function (error) {
            if (!DiyCommon.IsNull(errorCallback)) {
                errorCallback(error)
            }
            if (error.response) {
                if (error.response.status == 401) {
                    console.log('iTdos -------------error.response.status == 401----------------')
                    console.log(error)

                    //2020-12-05注释，使用DiyCommon
                    // store.dispatch('user/resetToken').then(() => {
                    //     // location.reload()
                    // })
                    DiyCommon.setToken('')
                    removeToken()

                    // 弹出登录
                    DiyCommon.OpenLogin()
                }
                DiyCommon.Tips(error.response.status + ' ' + error.message, false)
            } else {
                // DiyCommon.Tips(error.message, false)
                console.log(error);
            }
            throw error;
        })
    },
    UseAxiosAll: function (params) {
        var self = this
        const { allParams, callback, errorCallback, method, resolve, paramType } = params;
        var headers = {}
        headers.did = DiyCommon.GetDid();
        if (!DiyCommon.IsNull(DiyCommon.getToken())) {
            headers.authorization = 'Bearer ' + DiyCommon.getToken()
        }
        headers.mac = localStorage.getItem('mac');
        headers.lang = localStorage.getItem('lang');

        var requests = []
        allParams.forEach(param => {
            var url = param.Url;
            var axiosOption = {
                url: param.Url,
                method: method,
                responseType: 'json',
                changeOrigin: true,
                // 从.net core2.1更新至2.2后，这里不能设置，否则反而不能跨域。但按理说应该要设置。
                // withCredentials:true,
                // data: qs.stringify(param.Param),
                // headers:{'Content-Type':'application/x-www-form-urlencoded'}
                headers: headers
            };
            if (method == 'post') {
                if (paramType && paramType.toLowerCase() == "json") {
                    axiosOption.data = param.Param;
                } else if (
                    url.indexOf('/api/ApiEngine/') > -1
                    || url.indexOf('/api/DataSourceEngine/') > -1
                    || url.indexOf('/api/FormEngine/') > -1
                    || url.indexOf('/api/ModuleEngine/') > -1
                ) {
                    axiosOption.data = param.Param;
                }
                else {
                    axiosOption.data = qs.stringify(param.Param);
                }
            } else if (method == 'get') {
                axiosOption.params = param.Param;
            } else {
                DiyCommon.Tips('Error method:' + method, false)
                return;
            }
            requests.push(axios(axiosOption))
        })

        axios.all(requests)
            .then(results => {
                var returnData = []
                if (results.length > 0) {
                    // 拿到token，存起来
                    var result = results[0]
                    var token = result.headers.token
                    if (!DiyCommon.IsNull(token)) {
                        localStorage.setItem('token', token)
                        // sessionStorage.setItem('token', token)
                    }
                    var authorization = result.headers.authorization
                    if (!DiyCommon.IsNull(authorization)) {
                        // store.commit('user/SET_TOKEN', authorization)
                        DiyCommon.setToken(authorization)
                        setToken(authorization);
                        DiyCommon.setTokenExpires(new Date().AddTime('m', 15).Format('yyyy-MM-dd HH:mm:ss'));
                        // sessionStorage.setItem('authorization', authorization);
                        localStorage.setItem('authorization', authorization);
                    }
                }
                results.forEach(result => {
                    returnData.push(result.data)
                })
                callback(returnData)
                if (!DiyCommon.IsNull(resolve)) {
                    resolve(returnData);
                }
            }).catch(function (error) {
                if (!DiyCommon.IsNull(errorCallback)) {
                    errorCallback()
                }
                if (error.response) {
                    if (error.response.status == 401) {
                        console.log('iTdos -------------error.response.status == 401----------------')
                        console.log(error)

                        //2020-12-05注释，使用DiyCommon
                        // store.dispatch('user/resetToken').then(() => {
                        //     // location.reload()
                        // })
                        DiyCommon.setToken('')
                        removeToken()

                        // 弹出登录
                        DiyCommon.OpenLogin()
                        DiyCommon.Tips(error.response.status + ' ' + error.message, false)
                    } else {
                        DiyCommon.Tips(error.response.status + ' ' + error.message, false)
                    }
                } else {
                    DiyCommon.Tips(error.message, false)
                }
                throw error;
            })
    },
    GetSysBaseData: function (parantId, callback) {
        var self = this
        DiyCommon.Post(DiyApi.GetSysBaseData(), { ParentId: parantId }, function (result) {
            if (DiyCommon.Result(result)) {
                callback(result.Data)
            }
        }, function () { })
    },
    GetSysBaseDataStep: function (parantKey, callback) {
        var self = this
        DiyCommon.Post(DiyApi.GetSysBaseDataStep(), { ParentKey: parantKey }, function (result) {
            if (DiyCommon.Result(result)) {
                callback(result.Data)
            }
        }, function () { })
        //
    },
    UploadPdfBefore: function (file) {
        var self = this
        const isJPG =
            file.type === 'application/pdf' ||
            file.type === 'application/pdfx'
        const isLtMax = file.size / 1024 / 1024 < DiyCommon.UploadPdfMaxSize
        if (!isJPG) {
            DiyCommon.Tips(i18n.messages[i18n.locale].Msg.FormatError + file.type, false)
            return false
        }
        if (!isLtMax) {
            DiyCommon.Tips(i18n.messages[i18n.locale].Msg.MaxSize + DiyCommon.UploadPdfMaxSize + 'MB!', false)
            return false
        }
        DiyCommon.Tips(i18n.messages[i18n.locale].Msg.Uploading)
        return isJPG && isLtMax
    },
    UploadImgBefore: function (file) {
        var self = this
        const isJPG =
            file.type === 'image/jpeg' ||
            file.type === 'image/png' ||
            file.type === 'image/bmp' ||
            file.type === 'image/svg' ||
            file.type.toLowerCase().indexOf('icon') > -1 ||
            file.type.toLowerCase().indexOf('ico') > -1 ||
            file.type === 'image/gif'

        const isLtMax = file.size / 1024 / 1024 < DiyCommon.UploadImgMaxSize
        if (!isJPG) {
            DiyCommon.Tips(i18n.messages[i18n.locale].Msg.FormatError + file.type, false)
            return false
        }
        if (!isLtMax) {
            DiyCommon.Tips(i18n.messages[i18n.locale].Msg.MaxSize + DiyCommon.UploadImgMaxSize + 'MB!', false)
            return false
        }
        DiyCommon.Tips(i18n.messages[i18n.locale].Msg.Uploading)
        return isJPG && isLtMax
    },
    ChangePageTabName(routerName, tabName) {
        var self = this;
        // var item = store.state.tagsView.visitedViews.filter(item => item.name == routerName)
        // if (item.length > 0) {
        //     item[0].title = tabName
        // }
    },
    Add0(value, length) {
        var self = this
        if (DiyCommon.IsNull(value) || DiyCommon.IsNull(length)) {
            return value
        }
        var count0 = length - value.toString().length
        for (let index = 0; index < count0; index++) {
            value = '0' + value
        }
        return value
    },
    DiyFieldConfigStrToJson(field) {
        var self = this;

        // 配置表单可选项
        if (DiyCommon.IsNull(field.Data)) {
            field.Data = []
        } else if (!Array.isArray(field.Data)) {
            try {
                field.Data = JSON.parse(field.Data)
            } catch (error) {
                field.Data = [];
            }
        }

        if (DiyCommon.IsNull(field.BindRole)) {
            field.BindRole = []
        } else if (!Array.isArray(field.BindRole)) {
            try {
                field.BindRole = JSON.parse(field.BindRole)
            } catch (error) {
                field.BindRole = [];
            }
        }

        var defaultConfig = {
            ParamData: {},
            KeysAddVisible: false,
            KeysAddVModel: '',
            Sql: '',
            EnableSearch: false,
            NumberTextStep: 1,
            NumberTextPrecision: 0,
            NumberText: 0,
            NumberTextMath: '',
            NumberTextBtn: true,
            NumberTextBtnPosition: 'right',
            Textarea: {
                DefaultRows: 5
            },
            V8Code: '',
            V8CodeBlur: '',
            DividerPosition: 'left',
            //分割线
            Divider: {
                Icon: '',
            },
            DataSource: '',
            DataSourceSqlRemote: false,
            DataSourceSqlRemoteLoading: false,
            DataSourceId: '',
            TextShowPassword: false,
            TextIcon: '',
            TextIconPosition: '',
            TextApend: '',
            TextApendPosition: '',
            SelectLabel: '',
            SelectSaveField: '',//存储对应字段
            SelectSaveFormat: 'Text',//以前默认是Json，但这种设计有缺陷，不建议默认
            DateTimeType: 'date',
            TextAutocomplete: false, // 是否启用搜索建议
            AutoNumberFixed: '', // 自动编号固定前缀
            AutoNumberLength: 1, // 自动编号位数
            AutoNumberFields: [],//关联列，['id','id','id']
            AutoNumber: {
                DataRule: '',
                CreateRule: ''
            },//关联列，['id','id','id']

            ImgUpload: {
                Limit: false, //限制匿名访问
                Multiple: false, //多文件/多图上传
                Tips: '',
                MaxCount: 10,
                ShowFileList: false,
                Preview: true,
                MaxSize: 10,//单位M
            },
            // ImgUploadLimit: false, // 文件/图片 上传   限制匿名访问
            // ImgUploadMultiple: false, // 多文件上传
            // ImgUploadTips: '只能上传图片文件', // 文件/图片 上传   限制匿名访问

            // UploadMaxCount: 10, // 上传最大数量限制

            FileUpload: {
                Limit: true,
                Multiple: true,
                Tips: '',
                MaxCount: 10,
                ShowFileList: false,
                MaxSize: 10,//单位M
            },

            Upload: {
                BeforeUploadV8: '',
                GetPrivateFileBeforeServerV8: '',
                GetPrivateFileAfterServerV8: '',
            },

            // FileUploadLimit: true, // 文件/图片 上传   限制匿名访问
            // FileUploadMultiple: true, // 多文件上传
            // FileUploadTips: '附件最大500M', // 文件/图片 上传   限制匿名访问
            DevComponentName: '',
            DevComponentPath: '',
            TableChildTableId: '',
            TableChildSysMenuId: '',
            TableChildSysMenuName: '',
            TableChildFkFieldName: '',
            TableChildCallbackField: '',
            TableChildRowClickV8: '',
            TableChild: {
                Data: [],
                SearchAppend: {},
                //子表的上级关联模块
                LastTableId: '',
                LastSysMenuId: '',
                LastSysMenuName: '',
                LastSysMenuName: '',
                PrimaryTableFieldName: 'Id',
                DisablePagination: false,
                NoneDefaultHeight: false,
            },
            JoinTable: {
                TableId: '',
                ModuleName: '',
                ModuleId: '',
                Where: ''
            },
            //JoinForm不在设计的时候指定TableId、Id、FormMode的值，是为了方便代码去动态控制
            JoinForm: {
                TableId: '',//TableId和TableName两个参数2选1传1个
                TableName: '',
                Id: '',//数据Id，也可以传入SearchEqual条件，2选1
                FormMode: '',
                _SearchEqual: {},
            },


            MapCompany: 'Baidu',

            Button: {
                Type: 'primary',
                Loading: false,
                Icon: '',
                Size: 'mini',
                PreviewCanClick: true,
            },
            Autocomplete: {

            },
            Unique: {
                Type: 'Alone',
            },
            OpenTable: {
                BtnName: '',
                ShowDialog: false,
                MultipleSelect: false,
                SubmitV8: '',
                BeforeOpenV8: '',
                SearchAppend: {},
                PropsWhere:[]
            },
            Department: {
                Multiple: false,
                Filterable: false,
                EmitPath: true,
            },

            Cascader: {
                Lazy: false,//动态加载
                Filterable: false, //可搜索
                Value: '',
                Label: '',
                Children: '',
                ParentField: '',
                ParentFields: '',
                Multiple: false,
                Disabled: '',
                Leaf: '',
                EmitPath: true,
            },
            SelectTree: {
                Lazy: false,//动态加载
                Filterable: false, //可搜索
                Value: '',
                Label: '',
                Children: '',
                ParentField: '',
                ParentFields: '',
                Multiple: false,
                Disabled: '',
                Leaf: '',
            },
            CodeEditor: {
                Height: '',
            },
            RichText:{
                EditorProduct : '',
            }
        }
        if (DiyCommon.IsNull(field.Config)) {
            field.Config = defaultConfig
        } else if (typeof (field.Config) === 'string') {
            var tempConfigObj = {};
            try {
                tempConfigObj = JSON.parse(field.Config)
            } catch (error) {
                try {
                    field.Config = field.Config.replace(/\\\\/g, "\\");
                    tempConfigObj = JSON.parse(field.Config)
                } catch (error) {
                    console.log('field.Config（' + field.Name + '）: ', field.Config);
                    DiyCommon.Tips("注意：字段【" + field.Name + '】出现了Config字段序列化报错，一般是由V8Code格式错误导致，请至数据库将V8Code置空，备份到别的地方，然后清除缓存，重新配置该字段的V8代码。', false)
                    // field.Config = field.Config.replace(/↵/g, '');
                    // field.Config = field.Config.replace(/\n/g, '');
                    tempConfigObj = JSON.parse(field.Config)
                }
            }
            for (const config in defaultConfig) {
                if (!tempConfigObj.hasOwnProperty(config)) {
                    tempConfigObj[config] = defaultConfig[config]
                }
                if (config == 'Department' || config == 'Cascader') {
                    if (!tempConfigObj[config].hasOwnProperty('EmitPath')) {
                        tempConfigObj[config].EmitPath = true;
                    }
                }
            }
            //loading默认都为false
            tempConfigObj.DataSourceSqlRemoteLoading = false;
            tempConfigObj.Button.Loading = false;
            tempConfigObj.ImgUpload.ShowFileList = false;
            tempConfigObj.FileUpload.ShowFileList = false;
            // if(field.Name == 'DeptId'){
            // debugger;
            // }
            field.Config = tempConfigObj
        }
    },
    FieldDataCache: {},
    /**
     * 
     */
    SetFieldData(field, isPostSql, apiReplace, formData) {
        var self = this;
        if (field.Component == 'Checkbox'
            || field.Component == 'MultipleSelect'
            || field.Component == 'Select'
            || field.Component == 'Radio'
            || field.Component == 'Autocomplete'
            || field.Component == 'Cascader'
            || field.Component == 'SelectTree'
        ) {
            // field.Data = [];
            if (
                (field.Config.DataSource == 'Sql' && !DiyCommon.IsNull(field.Config.Sql))
                || (field.Config.DataSource == 'Api' && !DiyCommon.IsNull(field.Config.Api))
            ) {//!DiyCommon.IsNull(field.Config.Sql)
                if (isPostSql !== false) {
                    var apiGetDiyFieldSqlData = DiyApi.GetDiyFieldSqlData;
                    if (!DiyCommon.IsNull(apiReplace)
                        && !DiyCommon.IsNull(apiReplace.GetDiyFieldSqlData)) {
                        apiGetDiyFieldSqlData = apiReplace.GetDiyFieldSqlData;
                    }
                    var param = {
                        _FieldId: field.Id,
                        //OsClient: DiyCommon.GetOsClient(),
                        _SqlParamValue: JSON.stringify({}),
                        _FormData: formData
                    };
                    if (field.Config.DataSource == 'Api') {
                        apiGetDiyFieldSqlData = field.Config.Api;
                    }
                    // 查询数据库
                    DiyCommon.Post(apiGetDiyFieldSqlData, param, function (result) {
                        if (DiyCommon.Result(result)) {
                            try {
                                if (DiyCommon.IsNull(result.Data)) {
                                    result.Data = [];
                                }
                                //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值
                                //注意这里的逻辑和DiyForm的SelectRemoteMethod逻辑类似 ，如果这里修改，那边需要同步
                                //2020-12-30发现问题： field.Data.length == 1只考虑到了单选，没有考虑到多选。
                                if (!DiyCommon.IsNull(field.Data)
                                    && field.Data.length > 0) {//&& field.Data.length == 1
                                    // var tempData = field.Data[0];
                                    var fieldDataKey = !DiyCommon.IsNull(field.Config.SelectSaveField)
                                        ? field.Config.SelectSaveField
                                        : field.Config.SelectLabel;
                                    // var fieldDataKeyValue = tempData[fieldDataKey];
                                    field.Data.forEach(element => {
                                        var isHave = false;
                                        //2022-05-20：如果这个下拉控件配置了不同的显示字段和保存字段，这下面在push的时候，其实也要考虑到这2者，后来在GetFormDataJsonValue这里处理
                                        var fieldDataKeyValue = element[fieldDataKey];
                                        if (!DiyCommon.IsNull(fieldDataKey) && !DiyCommon.IsNull(fieldDataKeyValue)) {
                                            //先看下取的第一页数据是否已经包含了默认值，如果已经包含了就不需要再push了
                                            result.Data.forEach(resultDataRow => {
                                                if (resultDataRow[fieldDataKey] == fieldDataKeyValue) {
                                                    isHave = true;
                                                }
                                            });
                                        }
                                        //2020-12-30新增 && !DiyCommon.IsNull(fieldDataKeyValue) 不能将空值插入进去
                                        if (!isHave && !DiyCommon.IsNull(fieldDataKeyValue)) {
                                            // result.Data.push(field.Data[0]);
                                            result.Data.push(element);
                                        }
                                    });

                                }
                            } catch (error) {

                            }
                            field.Data = result.Data
                        }
                    })
                }
            }
        } else if (field.Component == 'Department') {
            // if(!DiyCommon.IsNull(DiyCommon.FieldDataCache.GetSysDeptStep)){
            //     field.Data = DiyCommon.FieldDataCache.GetSysDeptStep;
            // }else{
            DiyCommon.Post(
                DiyApi.GetSysDeptStep,
                // '/api/FormEngine/getTableDatatree', 
                {
                    FormEngineKey: 'Sys_Dept'
                },
                function (result) {
                    if (DiyCommon.Result(result)) {
                        result.Data.forEach(element => {
                            element.disabled = false;
                        });
                        DiyCommon.FieldDataCache.GetSysDeptStep = result.Data;
                        field.Data = result.Data
                    }
                }
            );
            // }
        }
    },
    SetFieldsData(fields, formData) {
        var self = this;

        //提前定义查询数据库的方法
        function GetFieldsData() {
            // 查询数据库
            DiyCommon.Post(apiGetFieldsData, param, function (results) {
                if (results.Code == 1) {
                    fieldList.forEach(field => {
                        var resultModel = _.find(results.Data, function (item) { return item.FieldId == field.Id });
                        if (!resultModel) {
                            return;//相当于continue.
                        }
                        var result = resultModel.Result;
                        if (DiyCommon.IsNull(result.Data)) {
                            result.Data = [];
                        }
                        try {
                            //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值
                            //注意这里的逻辑和DiyForm的SelectRemoteMethod逻辑类似 ，如果这里修改，那边需要同步
                            //2020-12-30发现问题： field.Data.length == 1只考虑到了单选，没有考虑到多选。
                            if (!DiyCommon.IsNull(field.Data)
                                && field.Data.length > 0) {
                                var fieldDataKey = !DiyCommon.IsNull(field.Config.SelectSaveField)
                                    ? field.Config.SelectSaveField
                                    : field.Config.SelectLabel;
                                field.Data.forEach(element => {
                                    var isHave = false;
                                    //2022-05-20：如果这个下拉控件配置了不同的显示字段和保存字段，这下面在push的时候，其实也要考虑到这2者，后来在GetFormDataJsonValue这里处理
                                    var fieldDataKeyValue = element[fieldDataKey];
                                    if (!DiyCommon.IsNull(fieldDataKey) && !DiyCommon.IsNull(fieldDataKeyValue)) {
                                        //先看下取的第一页数据是否已经包含了默认值，如果已经包含了就不需要再push了
                                        result.Data.forEach(resultDataRow => {
                                            if (resultDataRow[fieldDataKey] == fieldDataKeyValue) {
                                                isHave = true;
                                            }
                                        });
                                    }
                                    //2020-12-30新增 && !DiyCommon.IsNull(fieldDataKeyValue) 不能将空值插入进去
                                    if (!isHave && !DiyCommon.IsNull(fieldDataKeyValue)) {
                                        result.Data.push(element);
                                    }
                                });

                            }
                        } catch (error) {

                        }
                        field.Data = result.Data
                    });

                } else {
                    var fieldsMsg = '';
                    try {
                        fieldsMsg = JSON.stringify(param.FieldNames);
                    } catch (error) {

                    }
                    DiyCommon.Tips(results.Msg + '<br>相关字段：' + fieldsMsg, false);
                }
            })
        }

        //先组装一次性查询数据库需要的参数
        var fieldList = [];
        fields.forEach(field => {
            if (field.Component == 'Checkbox'
                || field.Component == 'MultipleSelect'
                || field.Component == 'Select'
                || field.Component == 'Radio'
                || field.Component == 'Autocomplete'
                || field.Component == 'Cascader'
                || field.Component == 'SelectTree'
            ) {
                if (
                    (field.Config.DataSource == 'Sql' && !DiyCommon.IsNull(field.Config.Sql))
                    || (field.Config.DataSource == 'Api' && !DiyCommon.IsNull(field.Config.Api))
                ) {
                    if (field.Config.DataSource == 'Api') {
                        var apiGetFieldsData = field.Config.Api;
                        // 查询数据库
                        GetFieldsData();
                        // DiyCommon.Post(apiGetFieldsData, param, function (result) {
                        //     if (DiyCommon.Result(result)) {
                        //         try {
                        //             if (DiyCommon.IsNull(result.Data)) {
                        //                 result.Data = [];
                        //             }
                        //             //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值
                        //             //注意这里的逻辑和DiyForm的SelectRemoteMethod逻辑类似 ，如果这里修改，那边需要同步
                        //             //2020-12-30发现问题： field.Data.length == 1只考虑到了单选，没有考虑到多选。
                        //             if(!DiyCommon.IsNull(field.Data) 
                        //                 && field.Data.length > 0){
                        //                 var fieldDataKey = !DiyCommon.IsNull(field.Config.SelectSaveField) 
                        //                                     ? field.Config.SelectSaveField
                        //                                     :  field.Config.SelectLabel;
                        //                 field.Data.forEach(element => {
                        //                     var isHave = false;
                        //                     //2022-05-20：如果这个下拉控件配置了不同的显示字段和保存字段，这下面在push的时候，其实也要考虑到这2者，后来在GetFormDataJsonValue这里处理
                        //                     var fieldDataKeyValue = element[fieldDataKey];
                        //                     if(!DiyCommon.IsNull(fieldDataKey) && !DiyCommon.IsNull(fieldDataKeyValue)){
                        //                         //先看下取的第一页数据是否已经包含了默认值，如果已经包含了就不需要再push了
                        //                         result.Data.forEach(resultDataRow => {
                        //                             if(resultDataRow[fieldDataKey] == fieldDataKeyValue){
                        //                                 isHave = true;
                        //                             }
                        //                         });
                        //                     }
                        //                     //2020-12-30新增 && !DiyCommon.IsNull(fieldDataKeyValue) 不能将空值插入进去
                        //                     if(!isHave && !DiyCommon.IsNull(fieldDataKeyValue)){
                        //                         result.Data.push(element);
                        //                     }
                        //                 });

                        //             }
                        //         } catch (error) {

                        //         }
                        //         field.Data = result.Data
                        //     }
                        // })
                    } else {
                        //先组装一次性查询数据库需要的参数
                        fieldList.push(field);
                    }
                }
            } else if (field.Component == 'Department') {
                DiyCommon.Post(
                    DiyApi.GetSysDeptStep,
                    // '/api/FormEngine/getTableDatatree', 
                    {
                        FormEngineKey: 'Sys_Dept'
                    },
                    function (result) {
                        if (DiyCommon.Result(result)) {
                            result.Data.forEach(element => {
                                element.disabled = false;
                            });
                            DiyCommon.FieldDataCache.GetSysDeptStep = result.Data;
                            field.Data = result.Data
                        }
                    }
                );
            }
        });
        if (fieldList.length > 0) {
            var apiGetFieldsData = DiyApi.GetFieldsData;
            var param = {
                FieldIds: _.pluck(fieldList, 'Id'),
                FieldNames: _.pluck(fieldList, 'Name'),
                _SqlParamValue: JSON.stringify({}),
                _FormData: formData
            };
            GetFieldsData();
        }
    },
    FindRecursion(arr, childName, idValue) {
        // _.where(self.SysMenuList, { Id : model.ParentId});
        var result = undefined;
        // _.find(arr, function(item){
        //     if (item.Id == idValue) {
        //         result = item;
        //         debugger;
        //         return true;
        //     }
        //     else if (!DiyCommon.IsNull(item[childName]) && item[childName].length > 0) {
        //         return DiyCommon.FindRecursion(item[childName], childName, idValue) != undefined;
        //     }
        // });
        for (let index = 0; index < arr.length; index++) {
            const item = arr[index];
            if (item.Id == idValue) {
                result = item;
                break;
            }
            else if (!DiyCommon.IsNull(item[childName]) && item[childName].length > 0) {
                //递归
                var tempResult = DiyCommon.FindRecursion(item[childName], childName, idValue);
                if (tempResult != undefined) {
                    result = tempResult;
                    break;
                }
            }
        }
        return result;
    },
    //传入数组、子数据名称、要搜索的主建名称、要搜索的主键值
    //用法：self.DiyCommon.ArrayDeepSearch(arr, '_Child', 'Id', 'Id值')
    ArrayDeepSearch(arr, childName, idKey, idValue) {
        var result = undefined;
        for (let index = 0; index < arr.length; index++) {
            const item = arr[index];
            if (item[idKey] == idValue) {
                result = item;
                break;
            }
            else if (!DiyCommon.IsNull(item[childName]) && item[childName].length > 0) {
                //递归
                var tempResult = DiyCommon.ArrayDeepSearch(item[childName], childName, idKey, idValue);
                if (tempResult != undefined) {
                    result = tempResult;
                    break;
                }
            }
        }
        return result;
    },
    //向数据库存数据前，会调用此方法
    ForRowModelHandler(formDiyTableModel, diyFieldList) {
        for (const formField in formDiyTableModel) {
            // console.log(key + '---' + obj[key])
            try {
                // 这里要注意，Map字段是否搜索的到？其实搜索的到
                var fieldModelSearch = _.where(diyFieldList, {
                    Name: formField
                })
                if (!DiyCommon.IsNull(fieldModelSearch) && fieldModelSearch.length > 0) {
                    var fieldModel = fieldModelSearch[0]
                    //如果是下拉单选，有可能是存Json、也可能是存字段
                    if (
                        fieldModel.Component == 'Select'
                        || fieldModel.Component == 'SelectTree' //2022-07-01新增下拉树同样的处理
                    ) {
                        //如果设置了显示对应字段或存储对应字段，那就应该需要配置是存Json还是字段，没设置显示对应字段，就直接存值，什么都不做
                        if (!DiyCommon.IsNull(fieldModel.Config.SelectLabel)
                            || !DiyCommon.IsNull(fieldModel.Config.SelectSaveField)) {
                            //如果是存字段，则直接string的值
                            if (fieldModel.Config.SelectSaveFormat !== 'Json') {//fieldModel.Config.SelectSaveFormat == 'Text'
                                //如果配置了存储对应字段
                                if (!DiyCommon.IsNull(fieldModel.Config.SelectSaveField)) {
                                    //2022-09-02：下拉框可能已經清除了值，不能獲取一個undefined，否則不會傳入到後端
                                    if (formDiyTableModel[formField]) {
                                        formDiyTableModel[formField] = formDiyTableModel[formField][fieldModel.Config.SelectSaveField];
                                    }
                                }
                                //没配置存储对应字段，就存显示对应字段
                                else {
                                    if (formDiyTableModel[formField]) {
                                        formDiyTableModel[formField] = formDiyTableModel[formField][fieldModel.Config.SelectLabel];
                                    }
                                }
                            }
                            //如果是存Json，什么都不用做，因为formDiyTableModel[formField]就已经是对象{}了
                            else if (fieldModel.Config.SelectSaveFormat == 'Json') {
                                // --- 2020-10-30  不再判断   直接存储所有查询出来的字段
                                //这里需要判断是单选还是多选 
                                // if (fieldModel.Component == 'MultipleSelect') {

                                // }else{
                                //     var tempObj = {
                                //         Id: formDiyTableModel[formField].Id
                                //     }
                                //     if (!DiyCommon.IsNull(formDiyTableModel[formField].Key)) {
                                //         tempObj.Key = formDiyTableModel[formField].Key
                                //     }
                                //     tempObj[fieldModel.Config.SelectLabel] = formDiyTableModel[formField][fieldModel.Config.SelectLabel]
                                //     formDiyTableModel[formField] = tempObj
                                // }

                                // --- 2020-10-30 直接存储所有查询出来的字段
                                //注意：下拉多选、多选框，不能存储所有字段，只能存储SelectSaveField，否则查询数据时无法选中
                                //后来发现，formDiyTableModel[formField]就是这样存储的
                                // if(fieldModel.Component == 'Checkbox' || fieldModel.Component == 'MultipleSelect'){
                                //     if(!DiyCommon.IsNull(fieldModel.Config.SelectSaveField)){
                                //         var tempValues = [];
                                //         formDiyTableModel[formField].forEach(element => {
                                //             tempValues.push(formDiyTableModel[formField][fieldModel.Config.SelectSaveField]);
                                //         });
                                //         formDiyTableModel[formField] = tempValues;
                                //     }
                                // }

                                // else if(fieldModel.Component == 'Radio' || fieldModel.Component == 'Select'){
                                //     if(!DiyCommon.IsNull(fieldModel.Config.SelectSaveField)){
                                //         var tempValues = [];
                                //         formDiyTableModel[formField].forEach(element => {
                                //             tempValues.push(formDiyTableModel[formField][fieldModel.Config.SelectSaveField]);
                                //         });
                                //         formDiyTableModel[formField] = tempValues;
                                //     }
                                // }
                            }
                        }
                    }
                    // 这里要判断是否是Map类型，需要写2个字段值?
                    else if (fieldModel.Component == 'Map') {
                        // formDiyTableModel[formField] = tempObj;
                    }
                }
            } catch (error) {
                console.log(error)
            }
        }
    },
    ForConvertSysMenu(data) {

        // data.Display = data.Display ? true : false;
        // data.InTableEdit = data.InTableEdit ? true : false;
        // data.IsMicroiService = data.IsMicroiService ? true : false;

        DiyCommon.SysMenuNeedConvertField.forEach((convertField) => {
            if (DiyCommon.IsNull(data[convertField])) {
                if (convertField == 'DiyConfig') {
                    data[convertField] = {};
                } else {
                    data[convertField] = [];
                }
            } else if (typeof (data[convertField]) == 'string') {
                if (convertField == "StatisticsFields") {
                    var tempResult = [];
                    var tempArr = JSON.parse(data[convertField]);
                    tempArr.forEach((calcIdType) => {
                        tempResult.push(calcIdType.Id);
                    });
                    data[convertField] = tempResult;
                }
                else if (convertField == 'SearchFieldIds') {
                    //转换之前，先改造下 SearchFieldIds,从List<Guid>变为  List<{Id:'',TableId:'',TableName:'',DisplayType:'显示模式',DisplaySelect:'是否显示为下拉框',}>
                    if (!DiyCommon.IsNull(data[convertField])) {
                        try {
                            data[convertField] = JSON.parse(data[convertField]);
                        } catch (error) {
                            data[convertField] = []
                        }
                        if (data[convertField].length > 0 && typeof (data[convertField][0]) == 'string') {
                            var index = 0;
                            data[convertField].forEach(fieldId => {
                                // var fieldModel = _.where(self.DiyFieldList, { Id : fieldId })[0];
                                // if (fieldModel) {
                                var newFieldModel = {
                                    Id: fieldId,
                                    Name: '',//fieldModel.Name,
                                    Label: '',//fieldModel.Label,
                                    AsName: '',
                                    TableId: '',//fieldModel.TableId,
                                    TableName: '',//fieldModel.TableName,
                                    TableDescription: '',//fieldModel.TableDescription,
                                    DisplayType: 'In',//Out
                                    DisplaySelect: false,
                                    Hide: false,
                                    Equal : false,
                                };
                                data[convertField][index] = newFieldModel;
                                // }
                                index++;
                            });
                        }
                    }
                }
                else if (convertField == "DiyConfig" && data[convertField] == '[]') {
                    data[convertField] = {};
                }
                else {
                    try {
                        data[convertField] = JSON.parse(data[convertField]);
                    } catch (error) {
                        try {
                            data[convertField] = data[convertField].replace(/\\\\/g, "\\");
                            data[convertField] = JSON.parse(data[convertField]);
                        } catch (error) {
                            data[convertField] = [];
                            console.log('数据转换出现错误，请联系系统管理员：' + convertField + '-' + data.Name, data[convertField]);
                            // DiyCommon.Tips('数据转换出现错误，请联系系统管理员！', false);
                        }
                    }
                }
                //修复V8CodeShow、ShowRow
                if (convertField == 'MoreBtns' && !DiyCommon.IsNull(data[convertField])) {
                    data[convertField].forEach(btn => {
                        if (DiyCommon.IsNull(btn.V8CodeShow)) {
                            btn.V8CodeShow = '';
                        }
                        if (DiyCommon.IsNull(btn.ShowRow)) {
                            btn.ShowRow = false;
                        }
                    });
                }
                //修复按钮的IsVisible
                if (!DiyCommon.IsNull(data[convertField])) {
                    if (Array.isArray(data[convertField])) {
                        data[convertField].forEach(btn => {
                            if (typeof (btn) == 'object') {
                                if (btn && DiyCommon.IsNull(btn.IsVisible)) {
                                    btn['IsVisible'] = true;//2021-09-07修改为true
                                }
                            }
                        });
                    }
                }
            }

            if (!DiyCommon.IsNull(data._Child) && data._Child.length > 0) {
                data._Child.forEach(childData => {
                    DiyCommon.ForConvertSysMenu(childData);
                });
            }
        });
    },
    FormExportFileV2(url, param, callback, fileName) {
        param.authorization = 'Bearer ' + DiyCommon.getToken();
        axios({
            url: url, // 替换为你的文件下载链接
            method: 'POST',
            // params: param,
            data : qs.stringify(param),
            responseType: 'blob' // 告诉Axios返回的数据类型是二进制数据
        })
            .then(response => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `导出${(fileName || '')}-${new Date().Format('yyyyMMddHHmmss')}.xls`); // 替换为你想要的文件名和扩展名
                document.body.appendChild(link);
                link.click();
                if (callback) {
                    callback();
                }
            })
            .catch(error => {
                console.error(error);
                if (callback) {
                    callback();
                }
            });
    },
    FormExportFile(url, param, callback) {
        var form = $("<form>");
        form.attr('style', 'display:none');
        //下面这句不能注释 ，注释后，打包后的程序导出会白屏
        // form.attr('target', '_blank');
        form.attr('method', 'post');
        form.attr('action', url);
        $('body').append(form);

        for (const key in param) {
            if (Array.isArray(param[key])) {
                param[key].forEach(element => {

                });
            }
            // //如果是数组 -- 2024-01-23 by Anderson
            // else if (Array.isArray(param[key])) {
            //     var childIndex = 0;
            //     param[key].forEach((childChild, ccIndex) => {
            //         var input1 = $('<input>');
            //         input1.attr('type', 'hidden');
            //         input1.attr('name', key + '[' + keyChild + '][' + ccIndex + ']');
            //         input1.attr('value', param[key][keyChild][ccIndex]);
            //         form.append(input1);
            //         childIndex++;
            //     });
            // }
            //如果是对象
            else if (typeof (param[key]) == 'object') {
                var childIndex = 0;
                for (const keyChild in param[key]) {
                    //这里还要判断child值是不是数组
                    if (Array.isArray(param[key][keyChild])) {
                        param[key][keyChild].forEach((childChild, ccIndex) => {
                            var input1 = $('<input>');
                            input1.attr('type', 'hidden');
                            input1.attr('name', key + '[' + keyChild + '][' + ccIndex + ']');
                            input1.attr('value', param[key][keyChild][ccIndex]);
                            form.append(input1);
                            childIndex++;
                        });
                    } else {
                        var input1 = $('<input>');
                        input1.attr('type', 'hidden');
                        input1.attr('name', key + '[' + keyChild + ']');
                        input1.attr('value', param[key][keyChild]);
                        form.append(input1);
                        childIndex++;
                    }

                }
            }
            else {
                var input1 = $('<input>');
                input1.attr('type', 'hidden');
                input1.attr('name', key);
                input1.attr('value', param[key]);
                form.append(input1);
            }
        }
        //新增token  2022-05-13
        var inputToken = $('<input>');
        inputToken.attr('type', 'hidden');
        inputToken.attr('name', 'authorization');
        inputToken.attr('value', 'Bearer ' + DiyCommon.getToken());
        form.append(inputToken);

        form.submit();
        form.remove();
        if (callback) {
            callback();
        }
    },
    /* 
        chinese : 中文
        fullPyLen: 2(默认)，前几个字全拼音
        type : 1 驼峰（默认），2全大写，3全小写

    */
    ChineseToPinyin(chinese, fullPyLen, type) {
        try {
            if (DiyCommon.IsNull(chinese)) {
                return '';
            }
            if (DiyCommon.IsNull(fullPyLen)) {
                fullPyLen = 2;
            }
            if (DiyCommon.IsNull(type)) {
                type = 1;
            }
            var pyStr = ''
            var pinyin = require('pinyin')
            if (chinese.length > fullPyLen) {
                // 先把前2个的全拼音取出来
                var label1 = chinese.substring(0, fullPyLen)
                var pyArr = pinyin(label1, {
                    style: pinyin.STYLE_NORMAL
                })
                pyArr.forEach(element => {
                    // var tName = element[0];
                    // pyStr += tName[0].toUpperCase() + tName.substring(1, tName.length);
                    pyStr += element[0]
                })
                if (type == 1) {
                    pyStr = pyStr[0].toUpperCase() + pyStr.substring(1, pyStr.length)
                }
                else if (type == 2) {
                    pyStr = pyStr.toUpperCase();
                } else if (type == 3) {
                    pyStr = pyStr.toLowerCase();
                }

                // pyStr += '_';

                // 再把剩下的取首字母出来。如果前面的length=2，后面的就不要大写
                var lengthIs2 = pyStr.length == fullPyLen
                var label2 = chinese.substring(fullPyLen, chinese.length)
                pyArr = pinyin(label2, {
                    style: pinyin.STYLE_FIRST_LETTER
                })
                pyArr.forEach(element => {
                    if (type == 1) {
                        pyStr += lengthIs2 ? element[0] : element[0].toUpperCase()
                    }
                    else if (type == 2) {
                        pyStr += element[0].toUpperCase();
                    } else if (type == 3) {
                        pyStr += element[0].toLowerCase();
                    }
                })
            } else {
                var pyArr = pinyin(chinese, {
                    style: pinyin.STYLE_NORMAL
                })
                pyArr.forEach(element => {
                    pyStr += element[0]
                })
                if (pyStr.length > 0) {
                    if (type == 1) {
                        pyStr = pyStr[0].toUpperCase() + pyStr.substring(1, pyStr.length)
                    }
                    else if (type == 2) {
                        pyStr = pyStr.toUpperCase();
                    } else if (type == 3) {
                        pyStr = pyStr.toLowerCase();
                    }
                }
            }

            return pyStr;
        } catch (error) {
            return '';
        }
    },
    async NewServerGuid() {
        return (await DiyCommon.PostAsync('/api/diytable/NewGuid')).Data;
    },
    /**
     * 必传：DataSourceKey
     */
    DataSourceEngine: {
        /**
         * 已弃用
         * @param {*} param 
         * @returns 
         */
        async GetData(param) {
            var result = await DiyCommon.PostAsync('/api/DataSourceEngine/Run', param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        /**
         * 
         * @param {*} param 可以是 'DataSourceKey'，也可以是  { DataSourceKey : '', Id:'' }
         * @param {*} param2 可以是回调，也可以是 { DataSourceKey : '', Id:'' }
         * @param {*} param3 可以是回调
         * @returns 
         */
        async Run(param, param2, param3) {
            if (typeof (param) == 'string') {
                //如果是这种模式：.Run('DataSourceKey', {}, function(){})
                var dataSourceKey = param.toString();
                param = {};
                param.DataSourceKey = dataSourceKey;
                for (let key in param2) {
                    param[key] = param2[key];
                }
                var result = await DiyCommon.PostAsync('/api/DataSourceEngine/Run', param, null, null, 'json');
                if (param3) {
                    param3(result);
                }
                return result;
            } else {
                //如果是这种模式：.Run({}, function(){})
                var result = await DiyCommon.PostAsync('/api/DataSourceEngine/Run', param, null, null, 'json');
                if (param2) {
                    param2(result);
                }
                return result;
            }
        },
    },
    /**
     * ApiEngineKey
     */
    ApiEngine: {
        async Run(param, param2, param3) {
            if (typeof (param) == 'string') {
                //如果是这种模式：.Run('ApiEngineKey', {}, function(){})
                var apiKey = param.toString();
                param = {};
                param.ApiEngineKey = apiKey;
                for (let key in param2) {
                    param[key] = param2[key];
                }
                var result = await DiyCommon.PostAsync('/api/ApiEngine/Run', param, null, null, 'json');
                if (param3) {
                    param3(result);
                }
                return result;
            } else {
                //如果是这种模式：.Run({}, function(){})
                var result = await DiyCommon.PostAsync('/api/ApiEngine/Run', param, null, null, 'json');
                if (param2) {
                    param2(result);
                }
                return result;
            }
        }
    },
    ModuleEngine: {
        async GetTableData(param, callback) {
            var result = await DiyCommon.PostAsync('/api/ModuleEngine/GetTableData', param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async GetTableTree(param, callback) {
            var result = await DiyCommon.PostAsync('/api/ModuleEngine/GetTableTree', param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        }
    },
    FormEngine: {
        async GetFormData(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.GetFormData, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async GetFormDataAnonymous(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.GetFormDataAnonymous, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async GetTableData(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.GetTableData, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async GetTableTree(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.GetTableTree, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async AddFormData(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.AddFormData, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async AddFormDataBatch(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.AddFormDataBatch, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async UptFormData(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.UptFormData, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async UptFormDataBatch(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.UptFormDataBatch, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async UptFormDataByWhere(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.UptFormDataByWhere, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async DelFormDataByWhere(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.DelFormDataByWhere, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async DelFormDataBatch(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.DelFormDataBatch, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
        async DelFormData(param, callback) {
            var result = await DiyCommon.PostAsync(DiyApi.FormEngine.DelFormData, param, null, null, 'json');
            if (callback) {
                callback(result);
            }
            return result;
        },
    },
    CreatQRCode(content) {
        var qrcode = new QRCode(this.$refs.qrCodeUrl, {
            text: content, // 需要转换为二维码的内容
            width: 512,
            height: 512,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        })
        return qrcode;
    },
    async InitV8Code(V8, router) {
        V8.DiyCommon = DiyCommon;
        V8.CreatQRCode = DiyCommon.CreatQRCode;
        V8.FormEngine = DiyCommon.FormEngine;
        V8.DataSourceEngine = DiyCommon.DataSourceEngine;
        V8.ApiEngine = DiyCommon.ApiEngine;
        V8.Extend = {};
        V8.NewGuid = DiyCommon.NewGuid;
        V8.NewServerGuid = (await DiyCommon.NewServerGuid);
        V8.ChineseToPinyin = DiyCommon.ChineseToPinyin;
        //V8.Router.Push('/');
        V8.Router = {
            Push: function (url) {
                router.push(url);
            }
        };
        V8.Window = {
            Open: function (url) {
                window.open(url);
            }
        };
        V8.Post = DiyCommon.Post;
        V8.PostSync = DiyCommon.PostSync;
        V8.PostAsync = DiyCommon.PostAsync;
        V8.Get = DiyCommon.Get;
        V8.GetSync = DiyCommon.GetSync;
        V8.GetAsync = DiyCommon.GetAsync;
        V8.Tips = DiyCommon.Tips;
        V8.ConfirmTips = DiyCommon.OsConfirm;
        if (DiyCommon.IsNull(V8.CurrentUser)) {
            V8.CurrentUser = store.getters['DiyStore/GetCurrentUser'];
        }
        V8.FromSql = DiyCommon.RunSql;
        V8.RunSql = DiyCommon.RunSql;
        // V8.RunSqlGetList = DiyCommon.RunSqlGetList;
        V8.RunSqlGetList = (sql, callback) => { return DiyCommon.RunSqlGetList(sql, callback, V8); }
        V8.RunSqlGetModel = DiyCommon.RunSqlGetModel;
        V8.RunSqlGetModelAsync = DiyCommon.RunSqlGetModel;
        V8.IsNull = DiyCommon.IsNull;

        V8.AddDiyTableRow = DiyCommon.AddDiyTableRow;
        V8.AddDiyTableRowBatch = DiyCommon.AddDiyTableRowBatch;
        V8.UptDiyTableRow = DiyCommon.UptDiyTableRow;
        V8.UptDiyTableRowBatch = DiyCommon.UptDiyTableRowBatch;
        V8.DelDiyTableRow = DiyCommon.DelDiyTableRow;
        V8.DelDiyTableRowBatch = DiyCommon.DelDiyTableRowBatch;
        V8.GetDiyTableRow = DiyCommon.GetDiyTableRow;
        V8.GetDiyTableRowOld = DiyCommon.GetDiyTableRowOld;
        V8.GetDiyTableRowModel = DiyCommon.GetDiyTableRowModel;
        V8.GetDiyTableRowModelAsync = DiyCommon.GetDiyTableRowModelAsync;
        V8.UptDiyDataListByWhere = DiyCommon.UptDiyDataListByWhere;
        V8.DelDiyDataListByWhere = DiyCommon.DelDiyDataListByWhere;
        V8._ = _;
        V8.AddSysLog = DiyCommon.AddSysLog;
        if (DiyCommon.IsNull(V8.WF)) {
            V8.WF = {};
        }
        V8.WF['StartWork'] = DiyCommon.StartWork;
        V8.WorkFlow = V8.WF;
        V8.CurrentToken = DiyCommon.getToken();
        V8.SendSystemMessage = DiyCommon.SendSystemMessage;
        V8.Base64 = Base64;
        V8.SysConfig = store.state.DiyStore.SysConfig;
        try {
            if (store.state.DiyStore.SysConfig && store.state.DiyStore.SysConfig.GlobalV8Code) {
                try {
                    await eval("(async () => {\n " + store.state.DiyStore.SysConfig.GlobalV8Code + " \n})()")
                } catch (error) {
                    DiyCommon.Tips('执行全局V8引擎代码出现错误：' + error.message, false);
                    console.log('执行全局V8引擎代码出现错误：', error)
                }
            }
        } catch (error) {

        }
    },
    InitV8CodeSync(V8, router) {
        V8.CreatQRCode = DiyCommon.CreatQRCode;
        V8.FormEngine = DiyCommon.FormEngine;
        V8.DataSourceEngine = DiyCommon.DataSourceEngine;
        V8.ApiEngine = DiyCommon.ApiEngine;
        V8.Extend = {};
        V8.NewGuid = DiyCommon.NewGuid;
        // V8.NewServerGuid = (await DiyCommon.NewServerGuid);
        V8.ChineseToPinyin = DiyCommon.ChineseToPinyin;
        //V8.Router.Push('/');
        V8.Router = {
            Push: function (url) {
                router.push(url);
            }
        };
        V8.Window = {
            Open: function (url) {
                window.open(url);
            }
        };
        V8.Post = DiyCommon.Post;
        V8.PostSync = DiyCommon.PostSync;
        V8.PostAsync = DiyCommon.PostAsync;
        V8.Get = DiyCommon.Get;
        V8.GetSync = DiyCommon.GetSync;
        V8.GetAsync = DiyCommon.GetAsync;
        V8.Tips = DiyCommon.Tips;
        V8.ConfirmTips = DiyCommon.OsConfirm;
        if (DiyCommon.IsNull(V8.CurrentUser)) {
            V8.CurrentUser = store.getters['DiyStore/GetCurrentUser'];
        }
        V8.FromSql = DiyCommon.RunSql;
        V8.RunSql = DiyCommon.RunSql;
        // V8.RunSqlGetList = DiyCommon.RunSqlGetList;
        V8.RunSqlGetList = (sql, callback) => { return DiyCommon.RunSqlGetList(sql, callback, V8); }
        V8.RunSqlGetModel = DiyCommon.RunSqlGetModel;
        V8.RunSqlGetModelAsync = DiyCommon.RunSqlGetModel;
        V8.IsNull = DiyCommon.IsNull;

        V8.AddDiyTableRow = DiyCommon.AddDiyTableRow;
        V8.AddDiyTableRowBatch = DiyCommon.AddDiyTableRowBatch;
        V8.UptDiyTableRow = DiyCommon.UptDiyTableRow;
        V8.UptDiyTableRowBatch = DiyCommon.UptDiyTableRowBatch;
        V8.DelDiyTableRow = DiyCommon.DelDiyTableRow;
        V8.DelDiyTableRowBatch = DiyCommon.DelDiyTableRowBatch;
        V8.GetDiyTableRow = DiyCommon.GetDiyTableRow;
        V8.GetDiyTableRowOld = DiyCommon.GetDiyTableRowOld;
        V8.GetDiyTableRowModel = DiyCommon.GetDiyTableRowModel;
        V8.GetDiyTableRowModelAsync = DiyCommon.GetDiyTableRowModelAsync;
        V8.UptDiyDataListByWhere = DiyCommon.UptDiyDataListByWhere;
        V8.DelDiyDataListByWhere = DiyCommon.DelDiyDataListByWhere;
        V8._ = _;
        V8.AddSysLog = DiyCommon.AddSysLog;
        if (DiyCommon.IsNull(V8.WF)) {
            V8.WF = {};
        }
        V8.WF['StartWork'] = DiyCommon.StartWork;
        V8.WorkFlow = V8.WF;
        V8.CurrentToken = DiyCommon.getToken();
        V8.SendSystemMessage = DiyCommon.SendSystemMessage;
        V8.Base64 = Base64;
        V8.SysConfig = store.state.DiyStore.SysConfig;
        try {
            if (store.state.DiyStore.SysConfig && store.state.DiyStore.SysConfig.GlobalV8Code) {
                try {
                    eval(store.state.DiyStore.SysConfig.GlobalV8Code)
                    // await eval("(async () => {\n " + store.state.DiyStore.SysConfig.GlobalV8Code + " \n})()")
                } catch (error) {
                    // DiyCommon.Tips('执行全局V8引擎代码出现错误：' + error.message, false);
                    console.log('执行全局V8引擎代码出现错误：', error)
                }
            }
        } catch (error) {

        }

    },
    //传入Content、ToUserId
    SendSystemMessage(param, callback) {
        var self = this;
        DiyCommon.Post('/api/DiyChat/SendSystemMessage', param, function (result) {
            callback(result);
        });
    },
    //传入：{FlowDesignId（流程图Id，必传）、LineValue（只有一条线时可不传）、FormData（可选，object类型）、TableRowId（关联的数据Id，必传）、
    //NoticeFields（通知数据，可选，格式：[{Id:'字段Id',Name:'字段名',Label:'字段名称',Value:'值'}]）}, Callback（可选，回调函数）
    StartWork(param, callback) {
        //发起工作
        // param.FormData = param.FormData ? JSON.stringify(param.FormData) : '{}';
        // {
        //     FlowDesignId: param.FlowDesignId,
        //     LineValue: param.LineValue,
        //     FormData: param.FormData ? JSON.stringify(param.FormData) : '{}',
        //     TableRowId: param.TableRowId,
        //     NoticeFields: param.NoticeFields,
        // }
        if (param.FormData && typeof (param.FormData) == "object") {
            param.FormData = JSON.stringify(param.FormData);
        }
        if (param.NoticeFields && typeof (param.NoticeFields) == "object") {
            param.NoticeFields = JSON.stringify(param.NoticeFields);
        }
        DiyCommon.Post('/api/WorkFlow/startWork', param, function (result) {
            if (DiyCommon.Result(result)) {
                var receivers = '';
                result.Data.Receivers.forEach(user => {
                    receivers += user.Name + ',';
                });
                try {
                    receivers = receivers.TrimEnd(',');
                } catch (error) {

                }
                DiyCommon.Tips('流程发起成功！<br>已发送至待办人：' + receivers + '。<br>已发送至节点：' + (result.Data.ToNodeName ? result.Data.ToNodeName : '无') + '。', true, 10);

                // self.ShowStartFlowForm = false;
                // self.$nextTick(function(){
                //     // self.BtnLoading = false;
                // });
            } else {
                // self.BtnLoading = false;
            }
            callback(result);
        });
    },
    RunSql(sql, callback, getType) {
        if (DiyCommon.IsNull(getType)) {
            DiyCommon.RunSqlGetList(sql, callback)
        } else if (getType == 'model') {
            DiyCommon.RunSqlGetModel(sql, callback)
        } else {
            DiyCommon.RunSqlGetList(sql, callback)
        }
    },
    RunSqlGetList(sql, callback, V8) {
        // 查询数据库
        if (Base64 && Base64.isValid) {
            sql = Base64.encode(sql);
        }
        var apiRunSqlGetList = DiyApi.RunSqlGetList;
        if (!DiyCommon.IsNull(V8)
            && !DiyCommon.IsNull(V8.ApiReplace)
            && !DiyCommon.IsNull(V8.ApiReplace.RunSqlGetList)
        ) {
            apiRunSqlGetList = V8.ApiReplace.RunSqlGetList;
        }
        DiyCommon.Post(apiRunSqlGetList, {
            // _Sql: sql,
            _Query: sql,
            // OsClient: self.OsClient
        }, function (result) {
            if (DiyCommon.Result(result)) {
                callback(result.Data)
            } else {
                callback([])
                console.log(result)
            }
        })
    },
    Base64EncodeDiyTable(diyTableModel) {
        var self = this;
        if (Base64 && Base64.isValid) {
            if (diyTableModel.InFormV8 && !Base64.isValid(diyTableModel.InFormV8)) {
                try {
                    diyTableModel.InFormV8 = Base64.encode(diyTableModel.InFormV8);
                } catch (error) {

                }
            }
            if (diyTableModel.SubmitFormV8 && !Base64.isValid(diyTableModel.SubmitFormV8)) {
                try {
                    diyTableModel.SubmitFormV8 = Base64.encode(diyTableModel.SubmitFormV8);
                } catch (error) {

                }
            }
            if (diyTableModel.OutFormV8 && !Base64.isValid(diyTableModel.OutFormV8)) {
                try {
                    diyTableModel.OutFormV8 = Base64.encode(diyTableModel.OutFormV8);
                } catch (error) {

                }
            }
            if (diyTableModel.ServerDataV8 && !Base64.isValid(diyTableModel.ServerDataV8)) {
                try {
                    diyTableModel.ServerDataV8 = Base64.encode(diyTableModel.ServerDataV8);
                } catch (error) {

                }
            }
        }
    },
    Base64DecodeDiyTable(diyTableModel) {
        var self = this;
        if (Base64 && Base64.isValid) {
            if (diyTableModel.InFormV8 && Base64.isValid(diyTableModel.InFormV8)) {
                try {
                    diyTableModel.InFormV8 = Base64.decode(diyTableModel.InFormV8);
                } catch (error) {

                }
            }
            if (diyTableModel.SubmitFormV8 && Base64.isValid(diyTableModel.SubmitFormV8)) {
                try {
                    diyTableModel.SubmitFormV8 = Base64.decode(diyTableModel.SubmitFormV8);
                } catch (error) {

                }
            }
            if (diyTableModel.OutFormV8 && Base64.isValid(diyTableModel.OutFormV8)) {
                try {
                    diyTableModel.OutFormV8 = Base64.decode(diyTableModel.OutFormV8);
                } catch (error) {

                }
            }
            if (diyTableModel.ServerDataV8 && Base64.isValid(diyTableModel.ServerDataV8)) {
                try {
                    diyTableModel.ServerDataV8 = Base64.decode(diyTableModel.ServerDataV8);
                } catch (error) {

                }
            }
        }

    },
    Base64EncodeDiyField(diyFieldModel) {
        var self = this;
        if (Base64 && Base64.isValid) {
            if (diyFieldModel.KeyupV8Code && !Base64.isValid(diyFieldModel.KeyupV8Code)) {
                try {
                    diyFieldModel.KeyupV8Code = Base64.encode(diyFieldModel.KeyupV8Code);
                } catch (error) {

                }
            }
            if (diyFieldModel.V8TmpEngineForm && !Base64.isValid(diyFieldModel.V8TmpEngineForm)) {
                try {
                    diyFieldModel.V8TmpEngineForm = Base64.encode(diyFieldModel.V8TmpEngineForm);
                } catch (error) {

                }
            }
            if (diyFieldModel.V8TmpEngineTable && !Base64.isValid(diyFieldModel.V8TmpEngineTable)) {
                try {
                    diyFieldModel.V8TmpEngineTable = Base64.encode(diyFieldModel.V8TmpEngineTable);
                } catch (error) {

                }
            }
            if (diyFieldModel.Config) {
                if (diyFieldModel.Config.Sql && !Base64.isValid(diyFieldModel.Config.Sql)) {
                    try {
                        diyFieldModel.Config.Sql = Base64.encode(diyFieldModel.Config.Sql);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.V8Code && !Base64.isValid(diyFieldModel.Config.V8Code)) {
                    try {
                        diyFieldModel.Config.V8Code = Base64.encode(diyFieldModel.Config.V8Code);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.V8CodeBlur && !Base64.isValid(diyFieldModel.Config.V8CodeBlur)) {
                    try {
                        diyFieldModel.Config.V8CodeBlur = Base64.encode(diyFieldModel.Config.V8CodeBlur);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.TableChildRowClickV8 && !Base64.isValid(diyFieldModel.Config.TableChildRowClickV8)) {
                    try {
                        diyFieldModel.Config.TableChildRowClickV8 = Base64.encode(diyFieldModel.Config.TableChildRowClickV8);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.OpenTable) {
                    if (diyFieldModel.Config.OpenTable.SubmitV8 && !Base64.isValid(diyFieldModel.Config.OpenTable.SubmitV8)) {
                        try {
                            diyFieldModel.Config.OpenTable.SubmitV8 = Base64.encode(diyFieldModel.Config.OpenTable.SubmitV8);
                        } catch (error) {

                        }
                    }
                    if (diyFieldModel.Config.OpenTable.BeforeOpenV8 && !Base64.isValid(diyFieldModel.Config.OpenTable.BeforeOpenV8)) {
                        try {
                            diyFieldModel.Config.OpenTable.BeforeOpenV8 = Base64.encode(diyFieldModel.Config.OpenTable.BeforeOpenV8);
                        } catch (error) {

                        }
                    }
                }
            }
        }

    },
    Base64DecodeDiyField(diyFieldModel) {
        var self = this;
        if (Base64 && Base64.isValid) {
            if (diyFieldModel.KeyupV8Code && Base64.isValid(diyFieldModel.KeyupV8Code)) {
                try {
                    diyFieldModel.KeyupV8Code = Base64.decode(diyFieldModel.KeyupV8Code);
                } catch (error) {

                }
            }
            if (diyFieldModel.V8TmpEngineForm && Base64.isValid(diyFieldModel.V8TmpEngineForm)) {
                try {
                    diyFieldModel.V8TmpEngineForm = Base64.decode(diyFieldModel.V8TmpEngineForm);
                } catch (error) {

                }
            }
            if (diyFieldModel.V8TmpEngineTable && Base64.isValid(diyFieldModel.V8TmpEngineTable)) {
                try {
                    diyFieldModel.V8TmpEngineTable = Base64.decode(diyFieldModel.V8TmpEngineTable);
                } catch (error) {

                }
            }
            if (diyFieldModel.Config) {
                if (diyFieldModel.Config.Sql && Base64.isValid(diyFieldModel.Config.Sql)) {
                    try {
                        diyFieldModel.Config.Sql = Base64.decode(diyFieldModel.Config.Sql);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.V8Code && Base64.isValid(diyFieldModel.Config.V8Code)) {
                    try {
                        diyFieldModel.Config.V8Code = Base64.decode(diyFieldModel.Config.V8Code);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.V8CodeBlur && Base64.isValid(diyFieldModel.Config.V8CodeBlur)) {
                    try {
                        diyFieldModel.Config.V8CodeBlur = Base64.decode(diyFieldModel.Config.V8CodeBlur);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.TableChildRowClickV8 && Base64.isValid(diyFieldModel.Config.TableChildRowClickV8)) {
                    try {
                        diyFieldModel.Config.TableChildRowClickV8 = Base64.decode(diyFieldModel.Config.TableChildRowClickV8);
                    } catch (error) {

                    }
                }
                if (diyFieldModel.Config.OpenTable) {
                    if (diyFieldModel.Config.OpenTable.SubmitV8 && Base64.isValid(diyFieldModel.Config.OpenTable.SubmitV8)) {
                        try {
                            diyFieldModel.Config.OpenTable.SubmitV8 = Base64.decode(diyFieldModel.Config.OpenTable.SubmitV8);
                        } catch (error) {

                        }
                    }
                    if (diyFieldModel.Config.OpenTable.BeforeOpenV8 && Base64.isValid(diyFieldModel.Config.OpenTable.BeforeOpenV8)) {
                        try {
                            diyFieldModel.Config.OpenTable.BeforeOpenV8 = Base64.decode(diyFieldModel.Config.OpenTable.BeforeOpenV8);
                        } catch (error) {

                        }
                    }
                }
            }
        }

    },
    RunSqlGetModel(sql, callback) {
        var self = this
        if (Base64 && Base64.isValid) {
            sql = Base64.encode(sql);
        }
        // 查询数据库
        DiyCommon.Post(DiyApi.RunSqlGetModel, {
            // _Sql: sql,
            _Query: sql,
            // OsClient: self.OsClient
        }, function (result) {
            if (DiyCommon.Result(result)) {
                callback(result.Data)
            } else {
                callback({})
                console.log(result)
            }
        })
    },
    DateDiff(startTime, endTime, interval) {
        if (DiyCommon.IsNull(startTime) || DiyCommon.IsNull(endTime) || DiyCommon.IsNull(interval)) {
            return 0;
        }
        var _startTime = startTime;
        var _endTime = endTime;
        if (typeof (startTime) == 'string') {
            _startTime = new Date(startTime);
        }
        if (typeof (endTime) == 'string') {
            _endTime = new Date(endTime);
        }
        var d = _startTime;
        var i = {}
        var t = d.getTime()
        var t2 = _endTime.getTime()
        i['y'] = _endTime.getFullYear() - d.getFullYear()
        i['q'] = i['y'] * 4 + Math.floor(_endTime.getMonth() / 4) - Math.floor(d.getMonth() / 4)
        i['m'] = i['y'] * 12 + _endTime.getMonth() - d.getMonth()
        i['ms'] = _endTime.getTime() - d.getTime()
        i['w'] = Math.floor((t2 + 345600000) / (604800000)) - Math.floor((t + 345600000) / (604800000))
        i['d'] = Math.floor(t2 / 86400000) - Math.floor(t / 86400000)
        i['h'] = Math.floor(t2 / 3600000) - Math.floor(t / 3600000)
        i['n'] = Math.floor(t2 / 60000) - Math.floor(t / 60000)
        i['s'] = Math.floor(t2 / 1000) - Math.floor(t / 1000)
        return i[interval]
    },
    //传入TableId，TableRowId，
    GetDiyTableRowModel(param, callback) {
        DiyCommon.Post(DiyApi.GetDiyTableRowModel, param, function (result) {
            callback(result);
            // if (DiyCommon.Result(result)) {
            //     // callback(result.Data)
            // }
            // callback(result.Data)
        })
    },
    async GetDiyTableRowModelAsync(param, callback) {
        var result = await DiyCommon.PostAsync(DiyApi.GetDiyTableRowModel, param);
        callback(result);
        // if (DiyCommon.Result(result)) {
        //     // callback(result.Data)
        // }
        // callback(result.Data)
    },
    //传入TableId
    //_Search:{FieldName:''}
    //_Top:1
    //_OrderBy:'FiedlName',
    //_OrderByType:'desc'
    GetDiyTableRowOld(param, callback) {
        DiyCommon.Post(DiyApi.GetDiyTableRow, param, function (result) {
            if (DiyCommon.Result(result)) {
                callback(result.Data)
            } else {
                callback([])
                // console.log(result)
            }
        })
    },
    GetDiyTableRow(param, callback) {
        DiyCommon.Post(DiyApi.GetDiyTableRow, param, function (result) {
            callback(result);
            // if (DiyCommon.Result(result)) {
            //     callback(result.Data)
            // }else {
            //     callback([])
            //     // console.log(result)
            // }
        })
    },
    //传入TableId
    //_TableRowId
    //_FormData
    UptDiyTableRow(param, callback) {
        DiyCommon.Post(DiyApi.UptDiyTableRow, param, function (result) {
            callback(result)
        })
    },
    UptDiyTableRowBatch(param, callback) {
        DiyCommon.Post(DiyApi.UptDiyTableRowBatch, param, function (result) {
            callback(result)
        })
    },
    DelDiyDataListByWhere(param, callback) {
        DiyCommon.Post(DiyApi.DelDiyDataListByWhere, param, function (result) {
            callback(result)
        })
    },
    UptDiyDataListByWhere(param, callback) {
        DiyCommon.Post(DiyApi.UptDiyDataListByWhere, param, function (result) {
            callback(result)
        })
    },
    DelDiyTableRow(param, callback) {
        DiyCommon.Post(DiyApi.DelDiyTableRow, param, function (result) {
            callback(result)
        })
    },
    DelDiyTableRowBatch(param, callback) {
        DiyCommon.Post(DiyApi.DelDiyTableRowBatch, param, function (result) {
            callback(result)
        })
    },
    AddDiyTableRow(param, callback) {
        DiyCommon.Post(DiyApi.AddDiyTableRow, param, function (result) {
            callback(result);
            // if (DiyCommon.Result(result)) {
            //     callback(result.Data)
            // }
        })
    },
    AddDiyTableRowBatch(param, callback) {
        DiyCommon.Post(DiyApi.AddDiyTableRowBatch, param, function (result) {
            callback(result);
            // if (DiyCommon.Result(result)) {
            //     callback(result.Data)
            // }
        })
    },
    AddSysLog(param, callback) {
        DiyCommon.Post('.api/SysLog/AddSysLog', param, function (result) {
            if (DiyCommon.Result(result)) {
                callback(result.Data)
            }
        })
    },
    ConvertRowModel(rowModel) {
        var newRowModel = {};
        for (const key in rowModel) {
            //2022-07-12发现：typeof(null)也是object，不能直接序列化，否则会赋值一个null字符串
            if (!DiyCommon.IsNull(rowModel[key]) && typeof (rowModel[key]) == 'object') {
                newRowModel[key] = JSON.stringify(rowModel[key]);
            } else {
                newRowModel[key] = rowModel[key];
            }
        }
        return newRowModel;
    },
    getToken() {
        return localStorage.getItem(DiyCommon.TokenKey)
        // return sessionStorage.getItem(TokenKey)
        // return Cookies.get(TokenKey)
    },
    setToken(token) {
        setToken(token)
        return localStorage.setItem(DiyCommon.TokenKey, token)
        // return sessionStorage.setItem(TokenKey, token)
        // return Cookies.set(TokenKey, token)
    },
    removeToken() {
        return localStorage.removeItem(DiyCommon.TokenKey)
        // return sessionStorage.removeItem(TokenKey)
        // return Cookies.remove(TokenKey)
    },
    getTokenExpires() {
        return localStorage.getItem(DiyCommon.TokenExpiresKey)
        // return sessionStorage.getItem(TokenExpiresKey)
        // return Cookies.get(TokenExpiresKey)
    },
    //time：'2020-01-01 13:25:22'
    setTokenExpires(time) {
        return localStorage.setItem(DiyCommon.TokenExpiresKey, time)
        // return sessionStorage.setItem(TokenExpiresKey, time)
        // return Cookies.set(TokenExpiresKey, time)
    },
    DiyTableStrToJson(data) {
        var self = this
        if (DiyCommon.IsNull(data.Rules)) {
            data.Rules = {};
        } else {
            data.Rules = JSON.parse(data.Rules)
        }

        if (DiyCommon.IsNull(data.ApiReplace)) {
            data.ApiReplace = {
                Insert: '',
                Update: '',
                Delete: '',
                Select: '',
            };
        } else {
            try {
                data.ApiReplace = JSON.parse(data.ApiReplace)
                if (DiyCommon.IsNull(data.ApiReplace.Select)) {
                    data.ApiReplace.Select = '';
                }
            } catch (error) {
                data.ApiReplace = {
                    Insert: '',
                    Update: '',
                    Delete: '',
                    Select: '',
                };
            }
        }

        if (DiyCommon.IsNull(data.RowAction)) {
            data.RowAction = []
        } else {
            data.RowAction = JSON.parse(data.RowAction)
        }

        if (DiyCommon.IsNull(data.Tabs)) {
            data.Tabs = [{
                Name: 'none',
                EnName: 'none',
                Display: true,
                Sort: 1
            }]
        } else {
            var tabs = JSON.parse(data.Tabs)
            if (tabs.length == 0) {
                tabs.push({
                    Name: 'none',
                    EnName: 'none',
                    Sort: 1
                })
            }
            // 排序
            tabs = _.sortBy(tabs, function (item) {
                return item.Sort
            })
            tabs.forEach(tab => {
                if (DiyCommon.IsNull(tab.Display)) {
                    tab.Display = true;
                }
            });
            data.Tabs = tabs
        }

        if (DiyCommon.IsNull(data.BindRole)) {
            data.BindRole = []
        } else {
            data.BindRole = JSON.parse(data.BindRole)
        }

        if (DiyCommon.IsNull(data.TableTabs)) {
            data.TableTabs = []
        } else {
            var tabs = JSON.parse(data.TableTabs)
            data.TableTabs = tabs
        }

        if (DiyCommon.IsNull(data.FormOpenType)) {
            data.FormOpenType = 'Drawer'
        }
    },
}
// DiyCommon.OsClientInit();
export {
    DiyCommon
}
