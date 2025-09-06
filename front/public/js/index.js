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

// Cached DOM refs
const $status = $('#status');
const $pgn = $('#pgn');
const whiteTimerEl = document.getElementById('white-timer');
const blackTimerEl = document.getElementById('black-timer');

// Chat state
let chatMessages = [];

// Backend URL - always use Render backend for Socket.IO
let backendUrl = 'https://chessbackend-m68d.onrender.com';

// Socket connection
const socket = io(backendUrl, { transports: ['websocket', 'polling'] });

// --- Helper / UI Functions ---
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateTimerDisplays(turn) {
  if (typeof whiteTime === 'number') whiteTimerEl.textContent = formatTime(whiteTime);
  if (typeof blackTime === 'number') blackTimerEl.textContent = formatTime(blackTime);
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
    socket.emit('chatMessage', { msg: val, color: myColor });
    $('#chat-input').val('');
  }
}

$('#chat-send').on('click', sendChatMessage);
$('#chat-input').on('keypress', e => { if (e.which === 13) sendChatMessage(); });

// --- Socket Events ---
if (gameCode) {
  socket.emit('joinGame', { code: gameCode });
}

socket.on('connect', () => {
  if (gameCode) socket.emit('joinGame', { code: gameCode });
});

socket.on('startGame', data => {
  gameHasStarted = true;
  if (data) {
    if (typeof data.whiteTime === 'number') whiteTime = data.whiteTime;
    if (typeof data.blackTime === 'number') blackTime = data.blackTime;
    if (Array.isArray(data.chat)) { chatMessages = data.chat; renderChat(); }
  }
  updateTimerDisplays();
  updateStatus();
});

socket.on('chatUpdate', data => {
  if (data && Array.isArray(data.chat)) { chatMessages = data.chat; renderChat(); }
});

socket.on('gameOverDisconnect', () => {
  gameOver = true;
  updateStatus();
});

socket.on('newMove', data => {
  if (data && data.move) {
    game.move(data.move);
    board.position(game.fen());
  }
  if (typeof data.whiteTime === 'number') whiteTime = data.whiteTime;
  if (typeof data.blackTime === 'number') blackTime = data.blackTime;
  updateTimerDisplays();
  updateStatus();
});

// Optional: timer updates if backend emits (already handled in newMove + startGame)
socket.on('timerUpdate', data => {
  if (data) {
    if (typeof data.whiteTime === 'number') whiteTime = data.whiteTime;
    if (typeof data.blackTime === 'number') blackTime = data.blackTime;
    updateTimerDisplays(data.turn);
  }
});

// Optional: handle game over by timeout
socket.on('gameOver', data => {
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