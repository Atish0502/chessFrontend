// Professional Chess Frontend - Inspired by Lichess.org Architecture
class ChessGameClient {
    constructor() {
        this.socket = io('https://chessbackend-m68d.onrender.com', {
            transports: ['websocket', 'polling']
        });
        
        this.gameState = {
            board: null,
            chess: new Chess(),
            myColor: null,
            gameId: null,
            isGameStarted: false,
            isMyTurn: false,
            whiteTime: 600,
            blackTime: 600,
            chatMessages: []
        };
        
        this.init();
    }
    
    init() {
        this.setupSocketEvents();
        this.setupBoard();
        this.setupUI();
        this.joinGame();
    }
    
    setupSocketEvents() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.updateStatus('Connected to server');
            if (this.gameState.gameId) {
                this.socket.emit('joinGame', { code: this.gameState.gameId });
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.updateStatus('Disconnected from server');
        });
        
        this.socket.on('connect_error', (error) => {
            console.log('❌ Connection error:', error);
            this.updateStatus('Connection error');
        });
        
        // Game events
        this.socket.on('gameJoined', (data) => {
            console.log('🎮 Joined game as:', data.color);
            this.gameState.myColor = data.color;
            
            if (data.waiting) {
                this.updateStatus('Waiting for opponent to join...');
            }
            
            if (this.gameState.myColor === 'black') {
                this.gameState.board.flip();
            }
            
            this.updateGameState(data.gameState);
        });
        
        this.socket.on('gameStarted', (data) => {
            console.log('🚀 Game started! You are:', data.color);
            this.gameState.myColor = data.color;
            this.gameState.isGameStarted = true;
            
            this.updateStatus(`Game started! You are ${data.color}`);
            this.updateGameState(data.gameState);
            this.updateTimers();
        });
        
        this.socket.on('moveMade', (data) => {
            console.log('♟️ Move made:', data);
            
            // Update chess.js instance with server state
            this.gameState.chess.load(data.fen);
            this.gameState.board.position(data.fen);
            
            // Update timers
            this.gameState.whiteTime = data.whiteTime;
            this.gameState.blackTime = data.blackTime;
            this.updateTimers();
            
            // Update game status
            this.updateStatus();
            this.updatePGN(data.pgn);
            
            // Play move sound
            this.playMoveSound();
        });
        
        this.socket.on('moveRejected', (data) => {
            console.log('❌ Move rejected:', data);
            this.updateStatus(`Invalid move: ${data.reason}`);
            // Revert board to legal position
            this.gameState.board.position(this.gameState.chess.fen());
        });
        
        this.socket.on('timerUpdate', (data) => {
            this.gameState.whiteTime = data.whiteTime;
            this.gameState.blackTime = data.blackTime;
            this.updateTimers();
        });
        
        this.socket.on('gameOver', (data) => {
            console.log('🏁 Game over:', data);
            this.gameState.isGameStarted = false;
            
            let message = '';
            if (data.winner === 'draw') {
                message = `Game Over - Draw (${data.reason})`;
            } else {
                message = `Game Over - ${data.winner} wins by ${data.reason}!`;
            }
            
            this.updateStatus(message);
            this.playGameOverSound();
        });
        
        this.socket.on('playerDisconnected', () => {
            console.log('👤 Player disconnected');
            this.gameState.isGameStarted = false;
            this.updateStatus('Game Over - Opponent disconnected');
        });
        
        this.socket.on('chatMessage', (data) => {
            this.addChatMessage(data);
        });
        
        this.socket.on('gameError', (data) => {
            console.log('❌ Game error:', data);
            this.updateStatus(data.message);
        });
    }
    
    setupBoard() {
        const config = {
            draggable: true,
            position: 'start',
            onDragStart: this.onDragStart.bind(this),
            onDrop: this.onDrop.bind(this),
            onSnapEnd: this.onSnapEnd.bind(this),
            pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
        };
        
        this.gameState.board = Chessboard('myBoard', config);
    }
    
    setupUI() {
        this.updateTimers();
        this.updateStatus();
        
        // Chat setup
        $('#chat-send').on('click', () => this.sendChatMessage());
        $('#chat-input').on('keypress', (e) => {
            if (e.which === 13) this.sendChatMessage();
        });
    }
    
    joinGame() {
        const urlParams = new URLSearchParams(window.location.search);
        this.gameState.gameId = urlParams.get('code');
        
        if (this.gameState.gameId) {
            console.log('🎮 Joining game:', this.gameState.gameId);
            this.socket.emit('joinGame', { code: this.gameState.gameId });
        } else {
            this.updateStatus('No game code provided');
        }
    }
    
    onDragStart(source, piece, position, orientation) {
        // Don't pick up pieces if game is over or not started
        if (!this.gameState.isGameStarted || this.gameState.chess.isGameOver()) {
            return false;
        }
        
        // Only pick up pieces for your color and when it's your turn
        const isMyTurn = (this.gameState.chess.turn() === 'w' && this.gameState.myColor === 'white') ||
                        (this.gameState.chess.turn() === 'b' && this.gameState.myColor === 'black');
        
        if (!isMyTurn) return false;
        
        // Only pick up your own pieces
        const isMyPiece = (this.gameState.myColor === 'white' && piece.search(/^w/) !== -1) ||
                         (this.gameState.myColor === 'black' && piece.search(/^b/) !== -1);
        
        return isMyPiece;
    }
    
    onDrop(source, target) {
        const move = {
            from: source,
            to: target,
            promotion: 'q' // Always promote to queen for now
        };
        
        // Optimistic update - try the move locally first
        const moveResult = this.gameState.chess.move(move);
        
        if (moveResult === null) {
            return 'snapback'; // Illegal move
        }
        
        // Move is legal locally, send to server
        this.socket.emit('move', move);
        
        // Update board optimistically
        this.gameState.board.position(this.gameState.chess.fen());
        this.updateStatus();
        
        return true;
    }
    
    onSnapEnd() {
        // Ensure board position matches chess.js
        this.gameState.board.position(this.gameState.chess.fen());
    }
    
    updateGameState(serverState) {
        if (serverState.fen) {
            this.gameState.chess.load(serverState.fen);
            this.gameState.board.position(serverState.fen);
        }
        
        if (serverState.whiteTime !== undefined) {
            this.gameState.whiteTime = serverState.whiteTime;
        }
        
        if (serverState.blackTime !== undefined) {
            this.gameState.blackTime = serverState.blackTime;
        }
        
        if (serverState.chat) {
            this.gameState.chatMessages = serverState.chat;
            this.renderChat();
        }
        
        this.updateTimers();
        this.updateStatus();
    }
    
    updateTimers() {
        const formatTime = (seconds) => {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        };
        
        $('#white-timer').text(formatTime(this.gameState.whiteTime));
        $('#black-timer').text(formatTime(this.gameState.blackTime));
        
        // Highlight active timer
        if (this.gameState.isGameStarted) {
            const activeColor = this.gameState.chess.turn();
            $('#white-timer').toggleClass('active', activeColor === 'w');
            $('#black-timer').toggleClass('active', activeColor === 'b');
        }
    }
    
    updateStatus(message) {
        if (message) {
            $('#status').text(message);
            return;
        }
        
        // Generate status from game state
        let status = '';
        
        if (!this.gameState.isGameStarted) {
            status = 'Waiting for game to start...';
        } else if (this.gameState.chess.isCheckmate()) {
            const winner = this.gameState.chess.turn() === 'w' ? 'Black' : 'White';
            status = `Checkmate! ${winner} wins.`;
        } else if (this.gameState.chess.isDraw()) {
            status = 'Game drawn';
        } else if (this.gameState.chess.isCheck()) {
            const player = this.gameState.chess.turn() === 'w' ? 'White' : 'Black';
            status = `${player} is in check`;
        } else {
            const player = this.gameState.chess.turn() === 'w' ? 'White' : 'Black';
            status = `${player} to move`;
        }
        
        $('#status').text(status);
    }
    
    updatePGN(pgn) {
        if (pgn) {
            $('#pgn').text(pgn);
        } else {
            $('#pgn').text(this.gameState.chess.pgn());
        }
    }
    
    sendChatMessage() {
        const input = $('#chat-input');
        const message = input.val().trim();
        
        if (message && this.gameState.myColor) {
            this.socket.emit('chatMessage', { msg: message });
            input.val('');
        }
    }
    
    addChatMessage(messageData) {
        this.gameState.chatMessages.push(messageData);
        this.renderChat();
    }
    
    renderChat() {
        const chatContainer = $('#chat-messages');
        let html = '';
        
        this.gameState.chatMessages.forEach(msg => {
            const isMyMessage = msg.color === this.gameState.myColor;
            const sender = isMyMessage ? 'You' : 'Opponent';
            const colorClass = isMyMessage ? 'my-message' : 'opponent-message';
            
            html += `<div class="chat-message ${colorClass}">
                        <strong>${sender}:</strong> ${msg.text}
                     </div>`;
        });
        
        chatContainer.html(html);
        chatContainer.scrollTop(chatContainer[0].scrollHeight);
    }
    
    playMoveSound() {
        // Add move sound effect if available
        try {
            const audio = new Audio('/sounds/move.mp3');
            audio.play().catch(() => {});
        } catch (e) {}
    }
    
    playGameOverSound() {
        // Add game over sound effect if available
        try {
            const audio = new Audio('/sounds/game-over.mp3');
            audio.play().catch(() => {});
        } catch (e) {}
    }
}

// Initialize the game when DOM is ready
$(document).ready(() => {
    window.chessGame = new ChessGameClient();
});

// Legacy compatibility
function updateTimerDisplays() { /* Legacy function - handled by class */ }
function updateStatus() { /* Legacy function - handled by class */ }
