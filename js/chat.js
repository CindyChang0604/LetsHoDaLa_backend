/*chat.js*/
$(function(){
    var socket = io('ws://localhost:8080');
    var myName = null;

    $('.login-btn').on( "click", function(){
        myName = $('#loginName').val().trim();
        if(myName){
            socket.emit('login', {username: myName})
        }else{
            alert('Please enter a name:)')
        }
    })

    /*登入成功*/
    socket.on('loginSuccess', function(data){
        if(data.username === myName){
            checkIn(data)
        }else{
            alert('Wrong username:( Please try again!')
        }
    })

    /*登入失敗*/
    socket.on('loginFail', function(){
        alert('Duplicate name already exists:0')
    })

    /*加入聊天室提示*/
    socket.on('add', function(data){
        var html = `<p>${data.username} 加入聊天室</p>`
        $('.chat-con').append(html);
        document.getElementById('chat-title').innerHTML = `在線人數: ${data.userCount}`
    })

    /*隱藏登入頁，顯示聊天頁*/
    function checkIn(data){
        $('.login-wrap').hide('slow');
        $('.chat-wrap').show('slow');
    }
})
$('.leaveBtn').on( "click", function(){
    let leave = confirm('Are you sure you want to leave?')
    if(leave){
        /*觸發 logout 事件*/
        socket.emit('logout', {username: myName});
    }
})

//離開成功
socket.on('leaveSuccess', function(){
    checkOut()
})

function checkOut(){
    $(".login-wrap").show('slow');
    $(".chat-wrap").hide("slow");
}

//退出提示
socket.on('leave', function(data){
    if(data.username != null){
        let html = `<p>${data.username} 退出聊天室</p>`;
        $('.chat-con').append(html);
        document.getElementById('chat-title').innerHTML = `在線人數: ${data.userCount}`;
    }
})


/*按下send按鈕*/
$('.sendBtn').on( "click", function(){
    sendMessage()
});

/*按下Enter*/
$(document).on( "keydown", function(evt){
    if(evt.key == "Enter"){
        sendMessage()
    }
})

function sendMessage(){
    let txt = $('#sendtxt').val();
    $('#sendtxt').val('');
    if(txt){
        /*觸發 sendMessage 事件*/
        socket.emit('sendMessage', {username: myName, message: txt});
    }
}

/*監聽 receiveMessage事件*/
socket.on('receiveMessage', function(data){
    showMessage(data)
})

/*顯示訊息*/
function showMessage(data){
    var html;
    if(data.username === myName){
        html = `<div class="chat-item item-right clearfix">
                    <span class="abs uname">me</span>
                    <span class="message fr">${data.message}</span>
                </div>`
    }else{
        html = `<div class="chat-item item-left clearfix rela">
                    <span class="abs uname">${data.username}</span>
                    <span class="fl message">${data.message}</span>
                </div>`
    }
    $('.chat-con').append(html);
}
