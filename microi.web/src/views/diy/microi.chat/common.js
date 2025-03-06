import $ from 'jquery'

export function contextMenu(x, y, tpl){
    var _ctxTpl;_ctxTpl = $("<div class='wc__contextmenu anim-fadeIn'></div>");
    if(!$(".wc__contextmenu").length){$("body").append(_ctxTpl.html(tpl));
    }else{$(".wc__contextmenu").hide().html(tpl).fadeIn(250);
    }
    $(".wc__contextmenu").css({ position: "absolute", left: x, top: y });
}

$(function(){
    $(document).on("click", function(e){
        var _ctxMenu = $(".wc__contextmenu");
        if($(e.target).hasClass("J__onlineStatus")) return;
        if($(e.target).hasClass("J__avator")) return;
        if(_ctxMenu.length && e.target != _ctxMenu && !$.contains(_ctxMenu[0], e.target)){
            _ctxMenu.hide();$(".vChat__main").find("li .msg").removeClass("taped");
        }
        // 隐藏表情框
        var _chooseBox = $(".wc__choose-panel");
        if($(e.target).hasClass("btn-face")) return;
        if(_chooseBox.length && e.target != _chooseBox && !$.contains(_chooseBox[0], e.target)){
            _chooseBox.hide();
        }
    });

    // 右键（用户信息弹窗）
    $("body").on("click", ".J__avator", function(e){
        // var eX = e.pageX, eY = e.pageY, _tpl;
        // _tpl = `
        //  <div class='wc__contextmenuUserInfo menu'>
        // <ul class="clearfix">
        //  <li><div class="item flexbox flex-alignc"><span class="lbl flex1"><em>赵小帅</em><em class="iconfont icon-male ml-10" style="color:#46b6ef;"></em><i>手机：+86 13416372001</i><i>昵称：帅哒哒</i></span><img class="uimg" src="/static/diy-chat/img/uimg/u__chat-img13.jpg" />
        //      </div>
        //  </li>
        //  <li><div class="item flexbox flex-alignc"><label class="lbl flex1">设置备注和标签</label></div></li>
        //   <li><div class="item flexbox flex-alignc"><label class="lbl">地 区</label><div class="cnt flex1 c-999">广东 广州</div></div></li>
        //       <li><div class="item align-r"><i class="iconfont icon-side__xiaoxi" title="发消息"></i></div></li>
        // </ul>
        // </div>
        // `;
        // contextMenu(eX, eY, _tpl);
    });

    // 右键（设置在线状态）
    $("body").on("click", ".J__onlineStatus", function(e){
        var eX = e.pageX, eY = e.pageY, _tpl;
        _tpl = `<div class='wc__contextmenuSetChat menu'><a class='status online' href='#'>在线</a>
         <a class='status offline' href='#'>离开</a>
        <a class='status busy' href='#'>忙碌</a>
        <a class='status invisible' href='#'>隐身</a>
         <a class='deliver'></a>
          <a href='#'>关闭桌面通知</a>
     <a href='#'>关闭提醒声音</a>
         <a href='#'>退出</a>
     </div>
        `;
        contextMenu(eX, eY, _tpl);
    });

    $("body").on("contextmenu", ".J__recordList li", function(e){
        e.preventDefault();
        var eX = e.pageX, eY = e.pageY, _tpl;
        _tpl = `<div class='wc__contextmenuRecordChat menu'>
            <a href='#'>置顶</a>
            <a href='#'>消息免打扰</a>
            <a href='#'>在独立窗口中打开</a>
            <a class='deliver'></a>
            <a href='#'>删除聊天</a>
            </div>
        `;
        contextMenu(eX, eY, _tpl);
    });

    $("body").on("contextmenu", ".J__addrFriendList .row:not(.unCTX)", function(e){
        e.preventDefault();
        var eX = e.pageX, eY = e.pageY, _tpl;
        _tpl = `<div class='wc__contextmenuRecordChat menu'>
         <a href='#'>发消息</a>
         <a href='#'>标为星标朋友</a>
         <a class='deliver'></a>
         <a href='#'>删除好友</a>
         </div>
        `;
        contextMenu(eX, eY, _tpl);
    });

    $("body").on("contextmenu", "#J__chatMsgList li .avatar", function(e){
        e.preventDefault();
        var eX = e.pageX, eY = e.pageY, _tpl;
        _tpl = `<div class='wc__contextmenuRecordChat menu'>
         <a href='#'>@他/她</a>
         <a href='#'>禁言</a>
         <a class='deliver'></a>
         <a href='#'>移除群聊</a></div>
        `;
        contextMenu(eX, eY, _tpl);
    });

    // 右键（聊天消息区）
    $("body").on("contextmenu", "#J__chatMsgList li .msg", function(e){
        e.preventDefault();
        var eX = e.pageX, eY = e.pageY, _tpl;
        var that = $(this);
        that.addClass("taped");
        that.parents("li").siblings().find(".msg").removeClass("taped");
        var isRevoke = that.parents("li").hasClass("me");
        var _revoke = isRevoke ? "<a href='#'>撤回</a>" : "";
        if (that.hasClass("picture")) {
            _tpl = `<div class='wc__contextmenuMsgChat menu'>
                 <a href='#'>发送给朋友</a>
                <a href='#'>复制</a>
                    <a href='#'>转发</a>
                 <a href='#'>收藏</a>
                    <a href='#'>另存为</a>
                    `+ _revoke +`
                 <a href='#'>删除</a></div>
            `;
        } else if (that.hasClass("video")) {
            _tpl = `<div class='wc__contextmenuMsgChat menu'>
                  <a href='#'>发送给朋友</a>
             <a href='#'>转发</a>
             <a href='#'>另存为</a>
                    `+ _revoke +`
                    <a href='#'>删除</a>
        </div>
            `;
        } else {
            _tpl = `<div class='wc__contextmenuMsgChat menu'>
            <a href='#'>发送给朋友</a>
             <a href='#'>复制</a>
             <a href='#'>收藏</a>
                    `+ _revoke +`
            <a href='#'>删除</a>
         </div>
            `;
        }
        contextMenu(eX, eY, _tpl);
    });
});
