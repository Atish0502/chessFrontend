// CLEAN WORKING CHESS FRONTEND - FIXED VERSION
let game = new Chess();
let board = null;
let socket = null;
let myColor = 'white';
let gameCode = '';
let gameStarted = false;

// Timer state
let whiteTime = 600;
let blackTime = 600;
let chatMessages = [];

// Backend URL
const BACKEND_URL = 'https://chessbackend-m68d.onrender.com';

// DOM elements
let whiteTimerEl, blackTimerEl;

function initializeGame() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    gameCode = urlParams.get('code') || '';
    myColor = urlParams.get('color') || 'white';
    
    console.log('Initializing game:', { gameCode, myColor });
    
    // Get timer elements
    whiteTimerEl = document.getElementById('white-timer');
    blackTimerEl = document.getElementById('black-timer');
    
    // Initialize Socket.IO
    socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling']
    });
    
    setupSocketEvents();
    setupBoard();
    updateDisplay();
}

function setupSocketEvents() {
    socket.on('connect', () => {
        console.log('✅ Connected to server');
        updateStatus('Connected to server');
        if (gameCode) {
            socket.emit('joinGame', { code: gameCode });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        updateStatus('Disconnected from server');
    });
    
    socket.on('startGame', (data) => {
        console.log('🎮 Game started:', data);
        gameStarted = true;
        if (data) {
            whiteTime = data.whiteTime || 600;
            blackTime = data.blackTime || 600;
            chatMessages = data.chat || [];
        }
        updateDisplay();
        renderChat();
    });
    
    socket.on('newMove', (data) => {
        console.log('♟️ Move received:', data);
        if (data && data.move) {
            game.move(data.move);
            board.position(game.fen());
        }
        if (data.whiteTime !== undefined) whiteTime = data.whiteTime;
        if (data.blackTime !== undefined) blackTime = data.blackTime;
        updateDisplay();
    });
    
    socket.on('timerUpdate', (data) => {
        console.log('⏰ Timer update:', data);
        if (data) {
            if (data.whiteTime !== undefined) whiteTime = data.whiteTime;
            if (data.blackTime !== undefined) blackTime = data.blackTime;
            updateDisplay();
        }
    });
    
    socket.on('chatUpdate', (data) => {
        console.log('💬 Chat update:', data);
        if (data && data.chat) {
            chatMessages = data.chat;
            renderChat();
        }
    });
    
    socket.on('gameOver', (data) => {
        console.log('🏁 Game over:', data);
        updateStatus('Game Over: ' + (data.reason || 'Unknown reason'));
    });
    
    socket.on('gameOverDisconnect', () => {
        console.log('👋 Opponent disconnected');
        updateStatus('Opponent disconnected - You win!');
    });
}

function setupBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
    };
    
    board = Chessboard('myBoard', config);
    if (myColor === 'black') {
        board.flip();
    }
}

function onDragStart(source, piece, position, orientation) {
    // Don't pick up pieces if game is over or not started
    if (game.game_over() || !gameStarted) return false;
    
    // Only pick up pieces for the side to move
    if ((game.turn() === 'w' && myColor !== 'white') ||
        (game.turn() === 'b' && myColor !== 'black')) {
        return false;
    }
    
    // Only pick up your own pieces
    if ((myColor === 'white' && piece.search(/^b/) !== -1) ||
        (myColor === 'black' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    // Try to make the move
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    
    // Illegal move
    if (move === null) return 'snapback';
    
    // Send move to server
    socket.emit('move', {
        from: source,
        to: target,
        promotion: 'q'
    });
    
    updateDisplay();
}

function onSnapEnd() {
    board.position(game.fen());
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes + ':' + (secs < 10 ? '0' : '') + secs;
}

function updateDisplay() {
    // Update status
    let status = '';
    const moveColor = (game.turn() === 'b') ? 'Black' : 'White';
    
    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.';
    } else if (game.in_draw()) {
        status = 'Game over, drawn position';
    } else if (!gameStarted) {
        status = 'Waiting for opponent to join...';
    } else {
        status = moveColor + ' to move';
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check';
        }
    }
    
    updateStatus(status);
    
    // Update timers
    if (whiteTimerEl) {
        whiteTimerEl.textContent = formatTime(whiteTime);
        whiteTimerEl.style.backgroundColor = (game.turn() === 'w' && gameStarted) ? '#ffeb3b' : '#f5f5f5';
    }
    if (blackTimerEl) {
        blackTimerEl.textContent = formatTime(blackTime);
        blackTimerEl.style.backgroundColor = (game.turn() === 'b' && gameStarted) ? '#ffeb3b' : '#f5f5f5';
    }
    
    // Update PGN
    const pgnEl = document.getElementById('pgn');
    if (pgnEl) {
        pgnEl.textContent = game.pgn();
    }
}

function updateStatus(text) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = text;
    }
    console.log('Status:', text);
}

function renderChat() {
    const chatEl = document.getElementById('chat-messages');
    if (!chatEl) return;
    
    let html = '';
    chatMessages.forEach(msg => {
        const isMyMessage = msg.color === myColor;
        const name = isMyMessage ? 'You' : 'Opponent';
        const style = isMyMessage ? 'color: #333;' : 'color: #8d5524;';
        html += `<div style="${style}"><b>${name}:</b> ${msg.msg}</div>`;
    });
    
    chatEl.innerHTML = html;
    chatEl.scrollTop = chatEl.scrollHeight;
}

function sendChatMessage() {
    const inputEl = document.getElementById('chat-input');
    if (!inputEl) return;
    
    const message = inputEl.value.trim();
    if (message && socket && myColor) {
        console.log('Sending chat:', message);
        socket.emit('chatMessage', {
            msg: message,
            color: myColor
        });
        inputEl.value = '';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing game...');
    initializeGame();
    
    // Setup chat
    const chatSendBtn = document.getElementById('chat-send');
    const chatInput = document.getElementById('chat-input');
    
    if (chatSendBtn) {
        chatSendBtn.onclick = sendChatMessage;
    }
    
    if (chatInput) {
        chatInput.onkeypress = function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        };
    }
});

// Legacy jQuery initialization (if jQuery loads after this)
$(function() {
    if (!board) {
        console.log('jQuery loaded, re-initializing if needed...');
        initializeGame();
    }
});