// Simple Chess AI using chess.js for move generation and evaluation
// Difficulty: 'easy', 'intermediate', 'difficult'

class ChessAI {
    constructor(difficulty = 'easy') {
        this.difficulty = difficulty;
    }

    getBestMove(game) {
        if (this.difficulty === 'easy') {
            return this.getRandomMove(game);
        } else if (this.difficulty === 'intermediate') {
            return this.getMinimaxMove(game, 2);
        } else {
            // Difficult: limit to 10 seconds max
            return this.getTimedMinimaxMove(game, 4, 10000);
        }
    }

    getTimedMinimaxMove(game, depth, maxTimeMs) {
        let bestMove = null;
        let bestValue = -Infinity;
        const moves = game.moves();
        const start = Date.now();
        for (let move of moves) {
            if (Date.now() - start > maxTimeMs) break;
            game.move(move);
            let value = -this.timedMinimax(game, depth - 1, -Infinity, Infinity, false, start, maxTimeMs);
            game.undo();
            if (value > bestValue) {
                bestValue = value;
                bestMove = move;
            }
        }
        // If time runs out and no move found, just play random
        return bestMove || this.getRandomMove(game);
    }

    timedMinimax(game, depth, alpha, beta, isMaximizing, start, maxTimeMs) {
        if (depth === 0 || game.game_over() || (Date.now() - start > maxTimeMs)) {
            return this.evaluateBoard(game);
        }
        let moves = game.moves();
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of moves) {
                if (Date.now() - start > maxTimeMs) break;
                game.move(move);
                let score = -this.timedMinimax(game, depth - 1, -beta, -alpha, false, start, maxTimeMs);
                game.undo();
                maxEval = Math.max(maxEval, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of moves) {
                if (Date.now() - start > maxTimeMs) break;
                game.move(move);
                let score = -this.timedMinimax(game, depth - 1, -beta, -alpha, true, start, maxTimeMs);
                game.undo();
                minEval = Math.min(minEval, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getRandomMove(game) {
        const moves = game.moves();
        const move = moves[Math.floor(Math.random() * moves.length)];
        return move;
    }

    getMinimaxMove(game, depth) {
        let bestMove = null;
        let bestValue = -Infinity;
        const moves = game.moves();
        for (let move of moves) {
            game.move(move);
            let value = -this.minimax(game, depth - 1, -Infinity, Infinity, false);
            game.undo();
            if (value > bestValue) {
                bestValue = value;
                bestMove = move;
            }
        }
        return bestMove;
    }

    minimax(game, depth, alpha, beta, isMaximizing) {
        if (depth === 0 || game.game_over()) {
            return this.evaluateBoard(game);
        }
        let moves = game.moves();
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of moves) {
                game.move(move);
                let score = -this.minimax(game, depth - 1, -beta, -alpha, false);
                game.undo();
                maxEval = Math.max(maxEval, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of moves) {
                game.move(move);
                let score = -this.minimax(game, depth - 1, -beta, -alpha, true);
                game.undo();
                minEval = Math.min(minEval, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    evaluateBoard(game) {
        // Simple material evaluation
        const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let score = 0;
        const board = game.board();
        for (let row of board) {
            for (let piece of row) {
                if (piece) {
                    let value = values[piece.type];
                    score += piece.color === 'w' ? value : -value;
                }
            }
        }
    return score;
    }
}

if (typeof module !== 'undefined') module.exports = ChessAI;
