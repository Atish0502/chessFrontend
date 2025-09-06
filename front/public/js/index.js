// --- Socket.IO connection for deployment ---
// Use deployed backend URL if not running locally
let backendUrl = '';
if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    backendUrl = 'https://chessbackend-m68d.onrender.com'; // <-- replace with your Render backend URL
}
// If using Vercel/Render, make sure CORS and WebSocket proxying are enabled on backend
const socket = io(backendUrl, {
    transports: ['websocket', 'polling'],
    upgrade: false
});
// ...existing code...
// ...existing code...

// Defensive: Clean up socket and timers on unload to avoid errors on refresh/back
window.addEventListener('beforeunload', function() {
    if (typeof socket !== 'undefined' && socket && socket.disconnect) {
        socket.disconnect();
    }
});

// Defensive: Always re-initialize game state on load
$(function() {
    if (typeof game !== 'undefined' && game.reset) {
        game.reset();
    }
    if (typeof board !== 'undefined' && board.position) {
        board.position('start');
    }
});
let gameHasStarted = false;
var board = null;
var game = new Chess();
var $status = $('#status');
var $pgn = $('#pgn');
let gameOver = false;

// --- Timer logic ---
let whiteTime = 600;
let blackTime = 600;
let myColor = (window.playerColor || (new URLSearchParams(window.location.search)).get('color') || 'white');
let gameCode = (window.gameCode || (new URLSearchParams(window.location.search)).get('code') || '');

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
        promotion: 'q' // NOTE: always promote to a queen for simplicity
    };
    // see if the move is legal
    var move = game.move(theMove);


    // illegal move
    if (move === null) return 'snapback'

    // Only send move data, not timers
    socket.emit('move', theMove);
    updateStatus();
}

function onSnapEnd () {
    board.position(game.fen());
}

function updateStatus () {
    var status = ''
    var moveColor = 'White'
    if (game.turn() === 'b') {
        moveColor = 'Black'
    }
    // checkmate?
    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.'
    }
    // draw?
    else if (game.in_draw()) {
        status = 'Game over, drawn position'
    }
    else if (gameOver) {
        status = 'Opponent disconnected, you win!'
    }
    else if (!gameHasStarted) {
        status = 'Waiting for black to join'
    }
    // game still on
    else {
        status = moveColor + ' to move'
        // check?
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check'
        }
    }
    updateTimerDisplays(game.turn());
    $status.html(status)
    $pgn.html(game.pgn())
}


var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
};

$(function() {
    board = Chessboard('myBoard', config);
    if (myColor === 'black') {
        board.flip();
    }
    updateStatus();
});

// Remove setColor logic and always join game with a valid code
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

    // --- Socket.IO connection for deployment ---
    // Use deployed backend URL if not running locally
    let backendUrl = '';
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        backendUrl = 'https://chessbackend-m68d.onrender.com'; // <-- replace with your Render backend URL
    }
    // If using Vercel/Render, make sure CORS and WebSocket proxying are enabled on backend
    const socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        upgrade: false
    });

    // Defensive: Clean up socket and timers on unload to avoid errors on refresh/back
    window.addEventListener('beforeunload', function() {
        if (typeof socket !== 'undefined' && socket && socket.disconnect) {
            socket.disconnect();
        }
    });

    // Defensive: Always re-initialize game state on load
    $(function() {
        if (typeof game !== 'undefined' && game.reset) {
            game.reset();
        }
        if (typeof board !== 'undefined' && board.position) {
            board.position('start');
        }
    });

    let gameHasStarted = false;
    var board = null;
    var game = new Chess();
    var $status = $('#status');
    var $pgn = $('#pgn');
    let gameOver = false;

    // --- Timer logic ---
    let whiteTime = 600;
    let blackTime = 600;
    let myColor = (window.playerColor || (new URLSearchParams(window.location.search)).get('color') || 'white');
    let gameCode = (window.gameCode || (new URLSearchParams(window.location.search)).get('code') || '');

    function updateTimerDisplays(turn) {
        const format = (secs) => {
            let m = Math.floor(secs / 60);
            let s = secs % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        };
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
        }
    });

    function onDragStart (source, piece) {
        if (game.game_over()) return false;
        if (!gameHasStarted) return false;
        if (gameOver) return false;

        if ((myColor === 'black' && piece.search(/^w/) !== -1) || (myColor === 'white' && piece.search(/^b/) !== -1)) {
            return false;
        }
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
    }

    function onDrop (source, target) {
        let theMove = { from: source, to: target, promotion: 'q' };
        var move = game.move(theMove);
        if (move === null) return 'snapback';
        socket.emit('move', theMove);
        updateStatus();
    }

    function onSnapEnd () {
        board.position(game.fen());
    }

    function updateStatus () {
        var status = '';
        var moveColor = (game.turn() === 'b') ? 'Black' : 'White';

        if (game.in_checkmate()) {
            status = 'Game over, ' + moveColor + ' is in checkmate.';
        } else if (game.in_draw()) {
            status = 'Game over, drawn position';
        } else if (gameOver) {
            status = 'Opponent disconnected, you win!';
        } else if (!gameHasStarted) {
            status = 'Waiting for black to join';
        } else {
            status = moveColor + ' to move';
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

    $(function() {
        board = Chessboard('myBoard', config);
        if (myColor === 'black') {
            board.flip();
        }
        updateStatus();
    });

    // Always join with gameCode if present
    if (gameCode) {
        socket.emit('joinGame', { code: gameCode });
    }

    socket.on('connect', function() {
        if (gameCode) {
            socket.emit('joinGame', { code: gameCode });
        }
    });

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
        updateTimerDisplays(game.turn());
        updateStatus();
    });

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
        game.move(data.move);
        board.position(game.fen());
        whiteTime = data.whiteTime;
        blackTime = data.blackTime;
        updateTimerDisplays(game.turn());
        updateStatus();
    });