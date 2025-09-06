// Clean rewritten frontend game logic
// Ensures functions are not inside the io() config object

// --- Global/Game State ---
const game = new Chess();
let board = null;
let myColor = (window.playerColor === 'black' || window.playerColor === 'white') ? window.playerColor : 'white';
let gameCode = window.gameCode || '';
let gameHasStarted = false;
let gameOver = false;

// Timers (seconds)
let whiteTime = 600; // default 10:00
let blackTime = 600;

// Cached DOM refs - with null checks
const $status = $('#status');
const $pgn = $('#pgn');
let whiteTimerEl = null;
let blackTimerEl = null;

// Initialize timer elements when DOM is ready
$(function() {
  whiteTimerEl = document.getElementById('white-timer');
  blackTimerEl = document.getElementById('black-timer');
  console.log('Timer elements found:', whiteTimerEl, blackTimerEl);
});

// Chat state
let chatMessages = [];

// Backend URL - always use Render backend for Socket.IO
let backendUrl = 'https://chessbackend-m68d.onrender.com';

// Socket connection with better error handling
const socket = io(backendUrl, { 
  transports: ['websocket', 'polling'],
  timeout: 5000
});

// Add connection status logging
socket.on('connect', () => {
  console.log('✅ Connected to backend!');
  if (gameCode) {
    console.log('Joining game with code:', gameCode);
    socket.emit('joinGame', { code: gameCode });
  }
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from backend');
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error);
});

// --- Helper / UI Functions ---
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateTimerDisplays(turn) {
  if (whiteTimerEl && typeof whiteTime === 'number') {
    whiteTimerEl.textContent = formatTime(whiteTime);
  }
  if (blackTimerEl && typeof blackTime === 'number') {
    blackTimerEl.textContent = formatTime(blackTime);
  }
  
  // Add visual indication of whose turn it is
  if (whiteTimerEl && blackTimerEl && gameHasStarted) {
    if (turn === 'w' || game.turn() === 'w') {
      whiteTimerEl.style.backgroundColor = '#ffeb3b';
      blackTimerEl.style.backgroundColor = '#f5f5f5';
    } else {
      whiteTimerEl.style.backgroundColor = '#f5f5f5';
      blackTimerEl.style.backgroundColor = '#ffeb3b';
    }
  }
  
  console.log('Timer update - White:', formatTime(whiteTime), 'Black:', formatTime(blackTime), 'Turn:', turn || game.turn());
}

function updateStatus() {
  let status = '';
  const moveColor = (game.turn() === 'b') ? 'Black' : 'White';

  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  } else if (game.in_draw()) {
    status = 'Game over, drawn position';
  } else if (gameOver) {
    status = 'Opponent disconnected, you win!';
  } else if (!gameHasStarted) {
    status = 'Waiting for opponent to join';
  } else {
    status = moveColor + ' to move';
    if (game.in_check()) status += ', ' + moveColor + ' is in check';
  }
  updateTimerDisplays(game.turn());
  $status.html(status);
  $pgn.html(game.pgn());
}

// --- Board Event Handlers ---
function onDragStart(source, piece, position, orientation) {
  if (gameOver) return false;
  if (!gameHasStarted) return false;
  // Only allow moving your own color pieces
  if (myColor === 'white' && piece.search(/^b/) !== -1) return false;
  if (myColor === 'black' && piece.search(/^w/) !== -1) return false;
  // Only move if it's your turn
  if ((game.turn() === 'w' && myColor !== 'white') || (game.turn() === 'b' && myColor !== 'black')) {
    return false;
  }
}

function onDrop(source, target) {
  const moveObj = { from: source, to: target, promotion: 'q' };
  const move = game.move(moveObj);
  if (move === null) return 'snapback';
  socket.emit('move', moveObj);
  updateStatus();
}

function onSnapEnd() {
  board.position(game.fen());
}

// --- Chat ---
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
  $('#chat-messages').html(html);
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}

function sendChatMessage() {
  const val = $('#chat-input').val().trim();
  if (val.length > 0 && myColor) {
    console.log('Sending chat message:', val, 'Color:', myColor);
    socket.emit('chatMessage', { msg: val, color: myColor });
    $('#chat-input').val('');
  } else {
    console.log('Cannot send message - Value:', val, 'Color:', myColor);
  }
}

$('#chat-send').on('click', sendChatMessage);
$('#chat-input').on('keypress', e => { if (e.which === 13) sendChatMessage(); });

// --- Socket Events ---
socket.on('startGame', data => {
  console.log('Game starting with data:', data);
  gameHasStarted = true;
  if (data) {
    if (typeof data.whiteTime === 'number') whiteTime = data.whiteTime;
    if (typeof data.blackTime === 'number') blackTime = data.blackTime;
    if (Array.isArray(data.chat)) { chatMessages = data.chat; renderChat(); }
  }
  updateTimerDisplays();
  updateStatus();
  console.log('Game started, gameHasStarted:', gameHasStarted);
});

socket.on('chatUpdate', data => {
  console.log('Chat update received:', data);
  if (data && Array.isArray(data.chat)) { 
    chatMessages = data.chat; 
    renderChat(); 
  }
});

socket.on('gameOverDisconnect', () => {
  console.log('Game over - opponent disconnected');
  gameOver = true;
  updateStatus();
});

socket.on('newMove', data => {
  console.log('New move received:', data);
  if (data && data.move) {
    game.move(data.move);
    board.position(game.fen());
  }
  if (typeof data.whiteTime === 'number') whiteTime = data.whiteTime;
  if (typeof data.blackTime === 'number') blackTime = data.blackTime;
  updateTimerDisplays(data.turn);
  updateStatus();
});

// Timer updates from backend
socket.on('timerUpdate', data => {
  console.log('Timer update received:', data);
  if (data) {
    if (typeof data.whiteTime === 'number') whiteTime = data.whiteTime;
    if (typeof data.blackTime === 'number') blackTime = data.blackTime;
    updateTimerDisplays(data.turn);
  }
});

// Handle game over by timeout
socket.on('gameOver', data => {
  console.log('Game over received:', data);
  if (data && data.reason === 'timeout') {
    gameOver = true;
    updateStatus();
  }
});

// --- Board Init ---
const config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
};

$(function() {
  board = Chessboard('myBoard', config);
  if (myColor === 'black') board.flip();
  updateStatus();
  updateTimerDisplays('w');
});