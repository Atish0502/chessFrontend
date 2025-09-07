// CLEAN WORKING CHESS FRONTEND - FIXED FOR DEPLOYMENT
// Socket.IO connection - CONNECT TO RENDER BACKEND
const socket = io('https://chessbackend-m68d.onrender.com', {
    transports: ['websocket', 'polling']
});

let gameHasStarted = false;
var board = null;
var game = new Chess();
var $status = $('#status');
var $pgn = $('#pgn');
let gameOver = false;

// Debug socket connection
socket.on('connect', function() {
    console.log('✅ Connected to backend successfully!');
});

socket.on('disconnect', function() {
    console.log('❌ Disconnected from backend');
});

socket.on('connect_error', function(error) {
    console.log('❌ Connection error:', error);
});

// --- Timer logic ---
let whiteTime = 600;
let blackTime = 600;
let myColor = null;

function updateTimerDisplays(turn) {
    const format = (secs) => {
        let m = Math.floor(secs / 60);
        let s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };
    // Always show both timers, but highlight the active one
    $("#white-timer").text(format(whiteTime));
    $("#black-timer").text(format(blackTime));
    if (turn === 'w') {
        $("#white-timer").css({background:'#ffe082', color:'#333', boxShadow:'0 0 10px #ffe082,0 0 4px #fff8e1'});
        $("#black-timer").css({background:'#8d5524', color:'#fff', boxShadow:'0 0 10px #8d5524,0 0 4px #a47551'});
    } else {
        $("#white-timer").css({background:'#a47551', color:'#fff', boxShadow:'0 0 4px #fff8e1'});
        $("#black-timer").css({background:'#ffe082', color:'#333', boxShadow:'0 0 10px #ffe082,0 0 4px #fff8e1'});
    }
}

// Only update timers when receiving timerUpdate from server
socket.on('timerUpdate', function(data) {
    whiteTime = data.whiteTime;
    blackTime = data.blackTime;
    updateTimerDisplays(data.turn);
    if (whiteTime === 0 || blackTime === 0) {
        gameOver = true;
        updateStatus();
    }
});

function onDragStart (source, piece, position, orientation) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false;
    if (!gameHasStarted) return false;
    if (gameOver) return false;

    if ((myColor === 'black' && piece.search(/^w/) !== -1) || (myColor === 'white' && piece.search(/^b/) !== -1)) {
        return false;
    }

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop (source, target) {
    let theMove = {
        from: source,
        to: target,
        promotion: 'q'
    };
    // see if the move is legal
    var move = game.move(theMove);

    // illegal move
    if (move === null) return 'snapback';

    // Only send move data, not timers
    socket.emit('move', theMove);
    updateStatus();
}

function onSnapEnd () {
    board.position(game.fen());
}

function updateStatus () {
    var status = '';
    var moveColor = 'White';
    if (game.turn() === 'b') {
        moveColor = 'Black';
    }

    // checkmate?
    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.';
    }
    // draw?
    else if (game.in_draw()) {
        status = 'Game over, drawn position';
    }
    // game still on
    else {
        status = moveColor + ' to move';

        // check?
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check';
        }
    }

    updateTimerDisplays(game.turn());
    $status.html(status);
    $pgn.html(game.pgn());
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
};
board = Chessboard('myBoard', config);

myColor = playerColor;
if (myColor == 'black') {
    board.flip();
}

updateStatus();

// Remove setColor logic and always join game with a valid code
var urlParams = new URLSearchParams(window.location.search);
var gameCode = urlParams.get('code');

if (gameCode) {
    socket.emit('joinGame', { code: gameCode });
}

socket.on('connect', function() {
    if (gameCode) {
        socket.emit('joinGame', { code: gameCode });
    }
});

// On startGame, set color and request chat if needed
socket.on('startGame', function(data) {
    gameHasStarted = true;
    if (data && typeof data.whiteTime === 'number' && typeof data.blackTime === 'number') {
        whiteTime = data.whiteTime;
        blackTime = data.blackTime;
    }
    if (data && data.chat) {
        chatMessages = data.chat;
        renderChat();
    }
    updateTimerDisplays('w');
    updateStatus();
});

// On chatUpdate, always update chat
socket.on('chatUpdate', function(data) {
    if (data && data.chat) {
        chatMessages = data.chat;
        renderChat();
    }
});

socket.on('gameOverDisconnect', function() {
    gameOver = true;
    updateStatus();
});

$(function() {
    updateTimerDisplays('w');
});

// --- Chat logic ---
let chatMessages = [];

function renderChat() {
    let html = '';
    for (let i = 0; i < chatMessages.length; i++) {
        const m = chatMessages[i];
        if (m.color === myColor) {
            html += `<div style='color:#333;'><b>You:</b> ${m.msg}</div>`;
        } else {
            html += `<div style='color:#8d5524;'><b>Opponent:</b> ${m.msg}</div>`;
        }
    }
    $("#chat-messages").html(html);
    $("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);
}

function sendChatMessage() {
    const val = $('#chat-input').val().trim();
    if (val.length > 0 && myColor) {
        socket.emit('chatMessage', { msg: val, color: myColor });
        $('#chat-input').val('');
    }
}

$(function() {
    $('#chat-send').on('click', sendChatMessage);
    $('#chat-input').on('keypress', function(e) {
        if (e.which === 13) sendChatMessage();
    });
});

socket.on('newMove', function(data) {
    // Always update board and timers from server
    game.move(data.move);
    board.position(game.fen());
    whiteTime = data.whiteTime;
    blackTime = data.blackTime;
    updateTimerDisplays(data.turn);
    updateStatus();
});
