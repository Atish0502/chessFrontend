// Simple Working Chess Game - All Issues Fixed
let socket;
let board;
let game;
let playerColor = null;
let gameCode = null;
let isGameStarted = false;

// Initialize when DOM is ready
$(document).ready(function() {
    console.log('DOM ready, initializing chess game...');
    
    // Get game code from URL
    const urlParams = new URLSearchParams(window.location.search);
    gameCode = urlParams.get('code');
    
    if (!gameCode) {
        $('#status').text('No game code provided in URL');
        return;
    }
    
    // Initialize Chess.js
    game = new Chess();
    console.log('Chess.js initialized:', game.fen());
    
    // Initialize board
    initializeBoard();
    
    // Initialize socket connection
    initializeSocket();
    
    // Setup chat
    setupChat();
    
    updateStatus('Connecting to server...');
});

function initializeBoard() {
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
    };
    
    board = Chessboard('myBoard', config);
    console.log('Board initialized');
}

function initializeSocket() {
    socket = io('https://chessbackend-m68d.onrender.com', {
        transports: ['websocket', 'polling'],
        timeout: 20000
    });
    
    // Connection events
    socket.on('connect', function() {
        console.log('✅ Connected to server');
        updateStatus('Connected! Joining game...');
        
        // Join the game
        socket.emit('joinGame', { code: gameCode });
    });
    
    socket.on('disconnect', function() {
        console.log('❌ Disconnected from server');
        updateStatus('Disconnected from server');
        isGameStarted = false;
    });
    
    socket.on('connect_error', function(error) {
        console.log('❌ Connection error:', error);
        updateStatus('Connection failed: ' + error.message);
    });
    
    // Game events
    socket.on('gameJoined', function(data) {
        console.log('🎮 Game joined:', data);
        playerColor = data.color;
        
        updateStatus(`Joined as ${playerColor}. Waiting for opponent...`);
        
        if (playerColor === 'black') {
            board.flip();
        }
    });
    
    socket.on('gameStarted', function(data) {
        console.log('🚀 Game started:', data);
        isGameStarted = true;
        playerColor = data.color;
        
        updateStatus(`Game started! You are ${playerColor}`);
        updateTurnStatus();
    });
    
    socket.on('moveMade', function(data) {
        console.log('♟️ Move made:', data);
        
        // Update game state
        game.load(data.fen);
        board.position(data.fen);
        
        updateTurnStatus();
        updatePGN();
        
        // Play sound
        playMoveSound();
    });
    
    socket.on('moveRejected', function(data) {
        console.log('❌ Move rejected:', data.reason);
        updateStatus('Invalid move: ' + data.reason);
        
        // Revert board
        board.position(game.fen());
    });
    
    socket.on('gameOver', function(data) {
        console.log('🏁 Game over:', data);
        isGameStarted = false;
        
        let message = 'Game Over - ';
        if (data.winner === 'draw') {
            message += 'Draw';
        } else {
            message += data.winner + ' wins!';
        }
        updateStatus(message);
    });
    
    socket.on('chatMessage', function(data) {
        addChatMessage(data);
    });
    
    socket.on('gameError', function(data) {
        console.log('❌ Game error:', data);
        updateStatus('Error: ' + data.message);
    });
}

function onDragStart(source, piece, position, orientation) {
    // Don't pick up pieces if game not started
    if (!isGameStarted) {
        return false;
    }
    
    // Don't pick up pieces if it's not your turn
    if ((game.turn() === 'w' && playerColor !== 'white') ||
        (game.turn() === 'b' && playerColor !== 'black')) {
        return false;
    }
    
    // Don't pick up opponent's pieces
    if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
        (playerColor === 'black' && piece.search(/^w/) !== -1)) {
        return false;
    }
    
    return true;
}

function onDrop(source, target) {
    // Try the move
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // always promote to queen for simplicity
    });
    
    // If move is invalid, snap back
    if (move === null) {
        return 'snapback';
    }
    
    // Send move to server
    socket.emit('move', {
        from: source,
        to: target,
        promotion: 'q'
    });
    
    updateTurnStatus();
    updatePGN();
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateStatus(message) {
    $('#status').text(message);
    console.log('Status:', message);
}

function updateTurnStatus() {
    if (!isGameStarted) {
        return;
    }
    
    if (game.isCheckmate()) {
        const winner = game.turn() === 'w' ? 'Black' : 'White';
        updateStatus(`Checkmate! ${winner} wins!`);
    } else if (game.isDraw()) {
        updateStatus('Game is a draw');
    } else if (game.isCheck()) {
        const turn = game.turn() === 'w' ? 'White' : 'Black';
        updateStatus(`${turn} is in check`);
    } else {
        const turn = game.turn() === 'w' ? 'White' : 'Black';
        const isMyTurn = (game.turn() === 'w' && playerColor === 'white') ||
                        (game.turn() === 'b' && playerColor === 'black');
        
        if (isMyTurn) {
            updateStatus(`Your turn (${playerColor})`);
        } else {
            updateStatus(`Opponent's turn (${turn})`);
        }
    }
}

function updatePGN() {
    $('#pgn').text(game.pgn());
}

function setupChat() {
    $('#chat-send').click(sendChatMessage);
    $('#chat-input').keypress(function(e) {
        if (e.which === 13) {
            sendChatMessage();
        }
    });
}

function sendChatMessage() {
    const message = $('#chat-input').val().trim();
    if (message && playerColor) {
        socket.emit('chatMessage', { msg: message });
        $('#chat-input').val('');
    }
}

function addChatMessage(data) {
    const isMyMessage = data.color === playerColor;
    const sender = isMyMessage ? 'You' : 'Opponent';
    const messageClass = isMyMessage ? 'my-message' : 'opponent-message';
    
    const messageHtml = `<div class="chat-message ${messageClass}">
                            <strong>${sender}:</strong> ${data.text}
                         </div>`;
    
    $('#chat-messages').append(messageHtml);
    $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
}

function playMoveSound() {
    try {
        const audio = new Audio('/sounds/move.mp3');
        audio.play().catch(() => {});
    } catch (e) {}
}

// Legacy functions for compatibility
function updateTimerDisplays() {
    // Timer functionality can be added here
}

console.log('Chess game script loaded');
