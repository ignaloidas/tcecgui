// chess.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2020-09-22
// - fast javascript implementation, 30000x faster
// - FRC support
/*
globals
Abs, Assign, DefaultInt, exports, Floor, From, global, Lower, LS, Max, Min, require, SetDefault, Undefined
*/
'use strict';

// <<
if (typeof global != 'undefined') {
    let req = require,
        {Abs, Assign, DefaultInt, Floor, From, Lower, LS, Max, Min, SetDefault, Undefined} = req('./common');
    Assign(global, {
        Abs: Abs,
        Assign: Assign,
        DefaultInt: DefaultInt,
        Floor: Floor,
        From: From,
        Lower: Lower,
        LS: LS,
        Max: Max,
        Min: Min,
        SetDefault: SetDefault,
        Undefined: Undefined,
    });
}
// >>

// specific
let F32 = array => new Float32Array(array),
    I8 = array => new Int8Array(array),
    I32 = array => new Int32Array(array),
    U8 = array => new Uint8Array(array),
    U32 = array => new Uint32Array(array);

// defines
let BISHOP = 3,
    BITS_CASTLE = 1,
    BITS_EN_PASSANT = 2,
    BLACK = 1,
    COLOR = piece => piece >> 3,
    COLOR_TEXT = 'wb',
    COLORIZE = (color, type) => (type + (color << 3)),
    DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    EMPTY = 255,
    FILE = square => square & 15,
    KING = 6,
    KNIGHT = 2,
    PAWN = 1,
    PIECE_LOWER = ' pnbrqk  pnbrqk',
    PIECE_NAMES = ' PNBRQK  pnbrqk',
    PIECE_UPPER = ' PNBRQK  PNBRQK',
    QUEEN = 5,
    RANK = square => square >> 4,
    RELATIVE_RANK = (color, square) => (color? 7 - (square >> 4): (square >> 4)),
    ROOK = 4,
    SQUARE_A8 = 0,
    SQUARE_H1 = 119,
    TT_SIZE = 4096,
    TYPE = piece => piece & 7,
    // UNICODES = '⭘♟♞♝♜♛♚⭘♙♘♗♖♕♔',
    WHITE = 0;

// tables
let MOBILITY_LIMITS = I8([
        0,
        8,          // P
        32,         // N
        24,         // B
        24,         // R
        24,         // Q
        1,          // K
        0,
        0,
        8,          // p
        32,         // n
        24,         // b
        24,         // r
        24,         // q
        1,          // k
        0,
    ]),
    MOBILITY_SCORES = I8([
        0,
        2,          // P
        4,          // N
        3,          // B
        3,          // R
        2,          // Q
        1,          // K
        0,
        0,
        2,          // p
        4,          // n
        3,          // b
        3,          // r
        2,          // q
        1,          // k
        0,
    ]),
    PAWN_OFFSETS = [
        I8([-17, -16, -15]),
        I8([17, 16, 15]),
    ],
    // attacks + defenses
    // those values could be optimized automatically
    PIECE_ATTACKS = [
        //  .   P   N   B   R   Q   K   .   .   p   n   b   r   q   k   .
        [],
        I8([0,  7, 15, 10,  2,  1,  0,  0,  0,  1,  1,  1,  1,  1,  5,  0]),    // P
        I8([0,  5,  9,  9,  8,  8,  0,  0,  0,  5,  2,  9,  5,  5,  5,  0]),    // N
        I8([0,  5,  9,  9,  8,  8,  0,  0,  0,  5,  9,  2,  5,  5,  5,  0]),    // B
        I8([0, 10,  4,  4, 18, 14,  0,  0,  0,  5,  5,  5,  2,  5,  5,  0]),    // R
        I8([0,  5,  5,  5, 14,  1,  0,  0,  0,  5,  5,  5,  5,  2,  5,  0]),    // Q
        I8([0,  5,  9,  9,  9,  9,  0,  0,  0, 10,  5,  5,  5,  0,  0,  0]),    // K
        [],
        [],
        I8([0,  1,  1,  1,  1,  1,  5,  0,  0,  7, 15, 10,  2,  1,  0,  0]),    // p
        I8([0,  5,  2,  9,  5,  5,  5,  0,  0,  5,  9,  9,  8,  8,  0,  0]),    // n
        I8([0,  5,  9,  2,  5,  5,  5,  0,  0,  5,  9,  9,  8,  8,  0,  0]),    // b
        I8([0,  5,  5,  5,  2,  5,  5,  0,  0,  5, 10,  4, 18, 14,  0,  0]),    // r
        I8([0,  5,  5,  5,  5,  2,  5,  0,  0,  5,  5,  5, 14,  1,  0,  0]),    // q
        I8([0, 10,  5,  5,  5,  0,  0,  0,  0,  5,  9,  9,  9,  9,  9,  0]),    // k
        [],
    ],
    // move ordering
    PIECE_CAPTURES = I32([
        0,
        20100,      // P
        20300,      // N
        20300,      // B
        20500,      // R
        20900,      // Q
        32800,      // K
        0,
        0,
        20100,      // p
        20300,      // n
        20300,      // b
        20500,      // r
        20900,      // q
        32800,      // k
        0,
    ]),
    // for move generation
    PIECE_DIRS = [
        [],
        [],
        [],
        I8([1, 4, 1, 4]),
        I8([2, 8, 2, 8]),
        I8([1, 2, 4, 8, 1, 2, 4, 8]),
        I8([1, 2, 4, 8, 1, 2, 4, 8]),
    ],
    PIECE_OFFSETS = [
        [],
        [],
        I8([-18, -33, -31, -14, 18, 33, 31, 14]),
        I8([-17, -15,  17,  15]),
        I8([-16,   1,  16,  -1]),
        I8([-17, -16, -15,   1, 17, 16, 15, -1]),
        I8([-17, -16, -15,   1, 17, 16, 15, -1]),
    ],
    // move ordering
    PIECE_ORDERS = I8([
        0,
        4,          // P
        1,          // N
        1,          // B
        2,          // R
        3,          // Q
        5,          // K
        0,
        0,
        4,          // p
        1,          // n
        1,          // b
        2,          // r
        3,          // q
        5,          // k
        0,
    ]),
    // material eval
    PIECE_SCORES = I32([
        0,
        150,        // P
        780,        // N
        820,        // B
        1300,       // R
        2600,       // Q
        12800,      // K
        0,
        0,
        150,        // p
        780,        // n
        820,        // b
        1300,       // r
        2600,       // q
        12800,      // k
        0,
    ]),
    PIECE_VALUES = [
        I32([
            0,
            125,        // P
            780,        // N
            820,        // B
            1250,       // R
            2500,       // Q
            12800,      // K
            0,
            0,
            125,        // p
            780,        // n
            820,        // b
            1250,       // r
            2500,       // q
            12800,      // k
            0,
        ]),
        I32([
            0,
            200,        // P
            850,        // N
            900,        // B
            1350,       // R
            2700,       // Q
            12800,      // K
            0,
            0,
            200,        // p
            850,        // n
            900,        // b
            1350,       // r
            2700,       // q
            12800,      // k
            0,
        ]),
    ],
    PROMOTE_SCORES = I32([
        0,
        0,          // P
        200,        // N
        200,        // B
        400,        // R
        800,        // Q
        11800,      // K
        0,
        0,
        0,          // p
        200,        // n
        200,        // b
        400,        // r
        800,        // q
        11800,      // k
        0,
    ]);

// extras
let EVAL_MODES = {
        att: 1 + 2 + 4,
        hce: 1 + 2,
        mat: 1,
        mob: 2,
        nn: 1 + 2 + 32,
        null: 0,
    },
    // piece names for print
    PIECES = {
        P: 1,
        N: 2,
        B: 3,
        R: 4,
        Q: 5,
        K: 6,
        p: 9,
        n: 10,
        b: 11,
        r: 12,
        q: 13,
        k: 14,
    },
    SEARCH_MODES = {
        'ab': 2,
        'mm': 1,
        'rnd': 0,
    },
    SQUARES = {
        a8:   0, b8:   1, c8:   2, d8:   3, e8:   4, f8:   5, g8:   6, h8:   7,
        a7:  16, b7:  17, c7:  18, d7:  19, e7:  20, f7:  21, g7:  22, h7:  23,
        a6:  32, b6:  33, c6:  34, d6:  35, e6:  36, f6:  37, g6:  38, h6:  39,
        a5:  48, b5:  49, c5:  50, d5:  51, e5:  52, f5:  53, g5:  54, h5:  55,
        a4:  64, b4:  65, c4:  66, d4:  67, e4:  68, f4:  69, g4:  70, h4:  71,
        a3:  80, b3:  81, c3:  82, d3:  83, e3:  84, f3:  85, g3:  86, h3:  87,
        a2:  96, b2:  97, c2:  98, d2:  99, e2: 100, f2: 101, g2: 102, h2: 103,
        a1: 112, b1: 113, c1: 114, d1: 115, e1: 116, f1: 117, g1: 118, h1: 119
    };

let NULL_MOVE = {
    capture: 0,
    flags: 0,
    from: 0,
    m: '',
    piece: 0,
    promote: 0,
    to: 0,
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * 32bit pseudo random generator
 * https://en.wikipedia.org/wiki/Xorshift
 * @param {number=} state
 */
function xorshift32(state) {
    let x = state || xorshift32.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    xorshift32.state = x;
    return x;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// chess class
var Chess = function(fen_) {
    // PRIVATE
    //////////

    let attacks = U8(16),
        avg_depth = 0,
        bishops = U8(8).fill(EMPTY),
        board = U8(128),
        board_hash = 0,
        castling = U8(4).fill(EMPTY),
        defenses = U8(16),
        ep_square = EMPTY,
        eval_mode = 1,                      // 0:null, &1:mat, &2:hc2, &4:qui, &8:nn
        fen = '',
        fen_ply = -1,
        frc = false,
        half_moves = 0,
        interpose = U8(128),                // check path, can interpose a piece there
        kings = U8(2).fill(EMPTY),
        knights = U8(8).fill(EMPTY),
        materials = I32(2),
        max_depth = 4,
        max_extend = 20,
        max_nodes = 1e9,
        max_quiesce = 0,
        max_time = 60,
        mobilities = U8(16),
        move_number = 1,
        nodes = 0,
        pawns = U8(8).fill(EMPTY),
        pins = U8(128),
        ply = 0,
        ply_states = Array(128).fill(0).map(_ => [0, 0, 0, 0]),
        rooks = U8(8).fill(EMPTY),
        queens = U8(8).fill(EMPTY),
        search_mode = 0,                    // 1:minimax, 2:alpha-beta
        sel_depth = 0,
        transitions = Array(TT_SIZE).fill(0).map(_ => [0, 0, 0]),
        turn = WHITE,
        zobrist = Array(15).fill(0).map(_ => U32(128)),
        zobrist_ready = false;

    /**
     * Add a single move
     */
    function addMove(moves, piece, from, to, flags, promote, value) {
        let capture = 0;
        if (!(flags & BITS_CASTLE)) {
            if (value)
                capture = TYPE(value);
            else if (flags & BITS_EN_PASSANT)
                capture = PAWN;
        }
        moves.push({
            capture: capture,
            flags: flags,
            from: from,
            m: '',
            piece: piece,
            promote: promote,
            to: to,
        });

        if (!promote) {
            // TODO:
            // empty => give bonus for controlling the square, especially if near the other king (or in the center)
            mobilities[piece] ++;
        }
    }

    /**
     * Add a pawn move + promote moves
     */
    function addPawnMove(moves, piece, from, to, flags, value) {
        let rank = RANK(to);
        if ((rank % 7) == 0) {
            for (let promote = QUEEN; promote >= KNIGHT; promote --)
                addMove(moves, piece, from, to, flags, promote, value);
            mobilities[piece] ++;
        }
        else
            addMove(moves, piece, from, to, flags, 0, value);
    }

    /**
     * Add a ply state
     * @param {Object} move
     */
    function addState(move) {
        let state = ply_states[ply & 127];
        state[0] = castling.slice();
        state[1] = ep_square;
        state[2] = half_moves;
        state[3] = move;
    }

    /**
     * Alpha beta tree search
     * r1bk1bnr/3npppp/p1p3q1/1N6/8/1P2P3/1B1QBPPP/R3K2R w HA - 2 16
     * 2q1kr1r/R2bppb1/NQ3n2/3p1p1p/2pP3P/4P1P1/K5RN/5B2 w - - 7 52
     * n1QBq1k1/5p1p/5KP1/p7/8/8/8/8 w - 0 1
     * 8/2b1k3/8/5B2/8/5K2/1R6/8 b - - 0 108
     * @param {number} alpha
     * @param {number} beta
     * @param {number} depth
     * @param {number} max_depth
     * @returns {number}
     */
    function alphaBeta(alpha, beta, depth, max_depth) {
        // extend depth if in check
        if ((max_nodes & 1) && max_depth < max_extend && kingAttacked(turn))
            max_depth ++;

        if (depth >= max_depth) {
            if (!max_quiesce) {
                nodes ++;
                return evaluate();
            }
            return quiesce(alpha, beta, max_quiesce);
        }

        // statistics
        nodes ++;
        if (ply >= avg_depth)
            avg_depth = ply + 1;

        // check all moves
        let best = -99999,
            moves = createMoves(false),
            num_valid = 0;

        for (let move of moves) {
            if (!makeMove(move))
                continue;
            num_valid ++;
            let score = -alphaBeta(-beta, -alpha, depth + 1, max_depth);
            undoMove();

            if (score >= beta)
                return beta;
            if (score > best) {
                best = score;
                if (score > alpha)
                    alpha = score;
            }

            // checkmate found
            if (ply > 3 && score > 20000)
                break;
        }

        // mate + stalemate
        if (!num_valid) {
            if (kingAttacked(turn))
                best = Min(-51000 + ply * 1000, -21000);
            else
                best = 0;
        }
        return best;
    }

    /**
     * Move ordering for alpha-beta
     * - captures
     * - castle
     * - nb/r/q/r/p
     */
    function compareMoves(a, b) {
        if (a.capture || b.capture)
            return (PIECE_CAPTURES[b.capture] - PIECE_CAPTURES[a.capture]) * 10 + PIECE_SCORES[a.piece] - PIECE_SCORES[b.piece];
        let castle = !!(b.flags & BITS_CASTLE) - !!(a.flags & BITS_CASTLE);
        if (castle)
            return castle;
        if (a.promote || b.promote)
            return b.promote - a.promote;
        let aorder = PIECE_ORDERS[a.piece],
            border = PIECE_ORDERS[b.piece];
        if (aorder == border) {
            // more advanced pawn => higher priority
            if (aorder == 4)
                return COLOR(a.piece)? (RANK(b.to) - RANK(a.to)): (RANK(a.to) - RANK(b.to));
            return 0;
        }
        return aorder - border;
    }

    /**
     * Uniquely identify ambiguous moves
     * https://github.com/jhlywa/chess.js
     * @param {Object} move
     * @param {Object[]} moves
     * @returns {string}
     */
    function disambiguate(move, moves) {
        let ambiguities = 0,
            from = move.from,
            same_file = 0,
            same_rank = 0,
            to = move.to,
            type = TYPE(move.piece);

        for (let move2 of moves) {
            let ambig_from = move2.from,
                ambig_to = move2.to;

            // if a move of the same piece type ends on the same to square,
            // we'll need to add a disambiguator to the algebraic notation
            if (type == TYPE(move2.piece) && from != ambig_from && to == ambig_to) {
                ambiguities ++;

                if (RANK(from) == RANK(ambig_from))
                    same_rank ++;
                if (FILE(from) == FILE(ambig_from))
                    same_file ++;
            }
        }

        if (!ambiguities)
            return "";

        let an = squareToAn(from, false);
        if (same_rank > 0 && same_file > 0)
            return an;
        else
            return an[(same_file > 0)? 1: 0];
    }

    /**
     * Mini max tree search
     * @param {number} depth
     * @param {number} max_depth
     * @returns {number}
     */
    function miniMax(depth, max_depth) {
        if (depth >= max_depth) {
            nodes ++;
            return evaluate();
        }

        // statistics
        nodes ++;
        if (ply >= avg_depth)
            avg_depth = ply + 1;

        // check all moves
        let best = -99999,
            moves = createMoves(false),
            num_valid = 0;

        for (let move of moves) {
            if (!makeMove(move))
                continue;
            num_valid ++;
            let score = -miniMax(depth + 1, max_depth);
            undoMove();

            if (score > best)
                best = score;

            // checkmate found
            if (ply > 3 && score > 20000)
                break;
        }

        // mate + stalemate
        if (!num_valid) {
            if (kingAttacked(turn))
                best = -51000 + ply * 1000;
            else
                best = 0;
        }
        return best;
    }

    /**
     * Get the move list
     * @returns {string}
     */
    function moveList() {
        let lines = [];
        for (let i = 0; i <= ply; i ++) {
            let state = ply_states[i & 127];
            lines.push(state? ucify(state[3]): '???');
        }
        return lines.join(' ');
    }

    /**
     * Null search, used by perft
     * @param {number} depth
     */
    function nullSearch(depth) {
        if (depth <= 0) {
            nodes ++;
            return;
        }

        let moves = createMoves(false);
        for (let move of moves) {
            if (!makeMove(move))
                continue;
            nullSearch(depth - 1);
            undoMove();
        }
    }

    /**
     * Quiescence search
     * https://www.chessprogramming.org/Quiescence_Search
     * @param {number} alpha
     * @param {number} beta
     * @param {number} depth_left
     */
    function quiesce(alpha, beta, depth_left) {
        let delta = PIECE_SCORES[QUEEN];

        nodes ++;
        let score = evaluate();
        if (depth_left <= 0)
            return score;
        if (score >= beta)
            return beta;
        if (score + delta < alpha)
            return alpha;
        if (score > alpha)
            alpha = score;

        let best = score,
            futility = best + PIECE_SCORES[PAWN];

        if (ply >= sel_depth)
            sel_depth = ply + 1;

        let moves = createMoves(true);
        for (let move of moves) {
            if (futility + PIECE_SCORES[move.capture] <= alpha
                    && (TYPE(move.piece) != PAWN || RELATIVE_RANK(turn, move.to) <= 5))
                continue;

            if (!makeMove(move))
                continue;
            let score = -quiesce(-beta, -alpha, depth_left - 1);
            undoMove();

            if (score > best) {
                best = score;
                if (score > alpha) {
                    alpha = score;
                    if (score >= beta)
                        break;
                }
            }
        }

        return best;
    }

    // PUBLIC
    /////////

    /**
     * Convert AN to square
     * - 'a' = 97
     * - '8' = 56
     * @param {string} an c2
     * @returns {number} 98
     */
    function anToSquare(an) {
        if (an.length < 2)
            return EMPTY;
        let file = an[0].charCodeAt(0) - 97,
            rank = 56 - an[1].charCodeAt(0);
        return file + (rank << 4);
    }

    /**
     * Check if a square is attacked by a color
     * @param {number} color attacking color
     * @param {number} square
     * @returns {boolean} true if the square is attacked
     */
    function attacked(color, square) {
        // knight
        let target = COLORIZE(color, KNIGHT);
        for (let offset of PIECE_OFFSETS[KNIGHT]) {
            let pos = square + offset;
            if (pos & 0x88)
                continue;
            if (board[pos] == target)
                return true;
        }

        // bishop + pawn + rook + queen
        let offsets = PIECE_OFFSETS[QUEEN];
        for (let j = 0; j < 8; j ++) {
            let offset = offsets[j],
                pos = square,
                target = BISHOP + (j & 1);

            for (let k = 0; ; k ++) {
                pos += offset;
                if (pos & 0x88)
                    break;

                let value = board[pos];
                if (!value)
                    continue;
                if (COLOR(value) != color)
                    break;

                let piece_type = TYPE(value);
                if (piece_type == QUEEN || piece_type == target)
                    return true;
                if (k == 0) {
                    if (piece_type == KING)
                        return true;
                    if (target == BISHOP && piece_type == PAWN) {
                        if (color == ((j < 4)? BLACK: WHITE))
                            return true;
                    }
                }
                break;
            }
        }

        return false;
    }

    /**
     * Remove decorators from the SAN
     * @param {string} san Bxe6+!!
     * @returns {string} clean san Bxe6
     */
    function cleanSan(san) {
        return san.replace(/=/, '').replace(/[+#]?[?!]*$/, '');
    }

    /**
     * Clear the board
     */
    function clear() {
        attacks.fill(0);
        avg_depth = 0;
        bishops.fill(EMPTY);
        board.fill(0);
        board_hash = 0;
        castling.fill(EMPTY);
        defenses.fill(0);
        ep_square = EMPTY;
        fen = "";
        fen_ply = -1;
        half_moves = 0;
        kings.fill(EMPTY);
        knights.fill(EMPTY);
        materials.fill(0);
        mobilities.fill(0);
        move_number = 1;
        nodes = 0;
        pawns.fill(EMPTY);
        ply = 0;
        ply_states[0].fill(0);
        rooks.fill(EMPTY);
        queens.fill(EMPTY);
        sel_depth = 0;
        turn = WHITE;
    }

    /**
     * Configure parameters
     * @param {boolean} frc_
     * @param {string} options
     * @param {number} depth this overrides max_depth if > 0
     */
    function configure(frc_, options, depth) {
        eval_mode = 1;
        frc = frc_;
        max_depth = 4;
        max_extend = 20;
        max_nodes = 1e9;
        max_quiesce = 0;
        max_time = 0;
        search_mode = 0;

        // parse the line
        for (let option of options.split(' ')) {
            if (option.length < 3 || option[1] != '=')
                continue;
            let left = option[0],
                right = option.slice(2),
                value = right * 1;
            switch (left) {
            case 'd':
                max_depth = value;
                break;
            case 'e': {
                    let eit = EVAL_MODES[right];
                    if (eit != undefined)
                        eval_mode = eit;
                }
                break;
            case 'n':
                max_nodes = value;
                break;
            case 'q':
                max_quiesce = value;
                break;
            case 's': {
                    let sit = SEARCH_MODES[right];
                    if (sit != undefined)
                        search_mode = sit;
                }
                break;
            case 't':
                max_time = value;
                break;
            case 'x':
                max_extend = value;
                break;
            }
        }

        if (depth > 0)
            max_depth = depth;
        max_extend = Max(max_extend, max_depth);
    }

    /**
     * Create the FEN
     * @returns {string} fen
     */
    function createFen() {
        let empty = 0;
        fen = "";

        for (let i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            let piece = board[i];
            if (!piece)
                empty ++;
            else {
                if (empty > 0) {
                    fen += empty;
                    empty = 0;
                }
                fen += PIECE_NAMES[piece];
            }

            // off board
            if ((i + 1) & 0x88) {
                if (empty > 0)
                    fen += empty;
                if (i != SQUARE_H1)
                    fen += '/';

                empty = 0;
                i += 8;
            }
        }

        let castle = '';
        if (frc) {
            for (let square of castling)
                if (square != EMPTY) {
                    let file = FILE(square),
                        rank = RANK(square);
                    if (rank > 0)
                        castle += 'ABCDEFGHIJ'[file];
                    else
                        castle += 'abcdefghij'[file];
                }
        }
        else {
            if (castling[0] != EMPTY) castle += 'K';
            if (castling[1] != EMPTY) castle += 'Q';
            if (castling[2] != EMPTY) castle += 'k';
            if (castling[3] != EMPTY) castle += 'q';
        }

        // empty castling flag?
        castle = castle || '-';
        let epflags = (ep_square == EMPTY)? '-': squareToAn(ep_square, false);

        return [fen, COLOR_TEXT[turn], castle, epflags, half_moves, move_number].join(' ');
    }

    /**
     * Create a Fischer Random 960 FEN
     * http://www.russellcottrell.com/Chess/Chess960.htm
     * @param {number} index between 0 and 959
     * @returns {string}
     */
    function createFen960(index) {
        if (index < 0 || index >= 960)
            return '';

        let i, n1, n2, q,
            line = new Array(8).fill(' ');

        line[(index & 3) * 2 + 1] = 'B';
        index = Floor(index / 4);
        line[(index & 3) * 2] = 'B';
        index = Floor(index / 4);
        q = index % 6;
        index = Floor(index / 6);

        for (n1 = 0; n1 < 4; n1 ++) {
            n2 = index + Floor(((3 - n1) * (4 - n1)) / 2) - 5;
            if (n1 < n2 && n2 > 0 && n2 < 5)
                break;
        }

        // queen
        for (i = 0; i < 8; i ++)
            if (line[i] == ' ') {
                if (!q) {
                    line[i] = 'Q';
                    break;
                }
                q --;
            }

        // knights
        for (i = 0; i < 8; i ++)
            if (line[i] == ' ') {
                if (!n1 || !n2)
                    line[i] = 'N';
                n1 --;
                n2 --;
            }

        // rook - king - rook
        let castle = '';
        i = 7;
        for (let type of "RKR")
            for (; i >= 0; i --) {
                if (line[i] == ' ') {
                    line[i] = type;
                    if (type == 'R')
                        castle += 'ABCDEFGHIJ'[i];
                    break;
                }
            }

        line = line.join('');
        return `${Lower(line)}/pppppppp/8/8/8/8/PPPPPPPP/${line} w ${castle}${Lower(castle)} - 0 1`;
    }

    /**
     * Create the moves
     * @param {boolean} only_capture
     * @returns {Object[]} moves
     */
    function createMoves(only_capture) {
        let moves = [],
            second_rank = 6 - turn * 5,
            us = turn,
            us8 = us << 3,
            them = us ^ 1;

        for (let i = us8; i < us8 + 8; i ++) {
            attacks[i] = 0;
            defenses[i] = 0;
            mobilities[i] = 0;
        }

        // 1) collect all moves
        for (let i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            // off board
            if (i & 0x88) {
                i += 7;
                continue;
            }

            let piece = board[i];
            if (!piece || COLOR(piece) != us)
                continue;

            let piece_type = TYPE(piece);
            // pawn
            if (piece_type == PAWN) {
                let offsets = PAWN_OFFSETS[us],
                    piece_attacks = PIECE_ATTACKS[piece];

                // single square, non-capturing
                if (!only_capture) {
                    let square = i + offsets[1];
                    if (!board[square]) {
                        addPawnMove(moves, piece, i, square, 0, 0);

                        // double square
                        square += offsets[1];
                        if (second_rank == RANK(i) && !board[square])
                            addMove(moves, piece, i, square, 0, 0, 0);
                    }
                }

                // pawn captures
                for (let j of [0, 2]) {
                    let square = i + offsets[j];
                    if (square & 0x88)
                        continue;
                    let value = board[square];

                    if (value) {
                        if (COLOR(value) == them) {
                            addPawnMove(moves, piece, i, square, 0, value);
                            attacks[piece] += piece_attacks[value];
                        }
                        else
                            defenses[piece] += piece_attacks[value];
                    }
                    // en passant can be tricky:
                    else if (square == ep_square)
                        addPawnMove(moves, piece, i, square, BITS_EN_PASSANT, value);
                }
            }
            // other pieces
            // TODO: separate by piece_type?
            else {
                let offsets = PIECE_OFFSETS[piece_type],
                    piece_attacks = PIECE_ATTACKS[piece];
                for (let j = 0; j < 8; j ++) {
                    let offset = offsets[j],
                        square = i;
                    if (!offset)
                        break;

                    while (true) {
                        square += offset;
                        if (square & 0x88)
                            break;
                        let value = board[square];

                        if (!value) {
                            if (!only_capture)
                                addMove(moves, piece, i, square, 0, 0, 0);
                        }
                        else {
                            if (COLOR(value) == us)
                                defenses[piece] += piece_attacks[value];
                            else {
                                addMove(moves, piece, i, square, 0, 0, value);
                                attacks[piece] += piece_attacks[value];
                            }
                            break;
                        }

                        // break if knight or king
                        if (piece_type == KING || piece_type == KNIGHT)
                            break;
                    }
                }
            }
        }

        // 2) castling
        if (!only_capture) {
            let king = kings[us],
                pos0 = RANK(king) << 4;

            // q=0: king side, q=1: queen side
            for (let q = 0; q < 2; q ++) {
                let rook = castling[(us << 1) + q];
                if (rook == EMPTY)
                    continue;

                let error = false,
                    king_to = pos0 + 6 - (q << 2),
                    rook_to = king_to - 1 + (q << 1),
                    max_king = Max(king, king_to),
                    min_king = Min(king, king_to),
                    max_path = Max(max_king, rook, rook_to),
                    min_path = Min(min_king, rook, rook_to);

                // check that all squares are empty along the path
                for (let j = min_path; j <= max_path; j ++)
                    if (j != king && j != rook && board[j]) {
                        error = true;
                        break;
                    }
                if (error)
                    continue;

                // check that the king is not attacked
                for (let j = min_king; j <= max_king; j ++)
                    if (attacked(them, j)) {
                        error = true;
                        break;
                    }

                // add castle, always in FRC format
                if (!error)
                    addMove(moves, COLORIZE(us, KING), king, rook, BITS_CASTLE, 0, 0);
            }
        }

        // move ordering for alpha-beta
        if (search_mode == 2)
            orderMoves(moves);
        return moves;
    }

    /**
     * Decorate the SAN with + or #
     * @param {Move} move
     * @returns {string}
     */
    function decorateMove(move) {
        let text = move.m,
            last = text.slice(-1);
        if (!'+#'.includes(last) && kingAttacked(turn)) {
            let moves = legalMoves();
            text += moves.length? '+': '#';
            move.m = text;
        }
        return text;
    }

    /**
     * Evaluate the current position
     * - eval_mode: 0:null, 1:mat, 2:hc2, &4:qui, 8:nn
     * - 8/5q2/8/3K4/8/8/8/7k w - - 0 1 KQ vs K
     * - 8/5r2/8/3K4/8/8/8/7k w - - 0 1 KR vs K
     * - 8/5n2/8/3K4/8/8/b7/7k w - - 0 1  KNB vs K
     * @returns {number}
     */
    function evaluate() {
        if (half_moves >= 100)
            return 0;
        let score = 0;

        if (eval_mode & 1)
            score += materials[WHITE] - materials[BLACK];

        // mobility
        if (eval_mode & 2) {
            if (!materials[WHITE]) {
                let king = kings[WHITE],
                    king2 = kings[BLACK];
                score -= (Abs(FILE(king) * 2 - 7) + Abs(RANK(king) * 2 - 7)) * 15;
                score += (Abs(FILE(king) - FILE(king2)) + Abs(RANK(king) - RANK(king2))) * 10;
                score += mobilities[6] * 15;
            }
            else
                for (let i = 1; i < 7; i ++)
                    score += Min(mobilities[i] * MOBILITY_SCORES[i], MOBILITY_LIMITS[i]);

            if (!materials[BLACK]) {
                let king = kings[BLACK],
                    king2 = kings[WHITE];
                score -= (Abs(FILE(king) * 2 - 7) + Abs(RANK(king) * 2 - 7)) * 15;
                score += (Abs(FILE(king) - FILE(king2)) + Abs(RANK(king) - RANK(king2))) * 10;
                score += mobilities[6] * 15;
            }
            else
                for (let i = 9; i < 15; i ++)
                    score -= Min(mobilities[i] * MOBILITY_SCORES[i], MOBILITY_LIMITS[i]);
        }

        // attacks + defenses
        if (eval_mode & 4) {
            for (let i = 1; i < 7; i ++)
                score += attacks[i] + defenses[i];
            for (let i = 9; i < 15; i ++)
                score -= attacks[i] + defenses[i];
        }

        return score * (1 - (turn << 1));
    }

    /**
     * Hash the current board
     */
    function hashBoard() {
        if (!zobrist_ready)
            init_zobrist();

        board_hash = 0;
        for (let square = SQUARE_A8; square <= SQUARE_H1; square ++) {
            if (square & 0x88) {
                square += 7;
                continue;
            }
            let piece = board[square];
            if (piece)
                board_hash ^= zobrist[piece][square];
        }
    }

    /**
     * Modify the board hash
     * https://en.wikipedia.org/wiki/Zobrist_hashing
     * @param {number} square
     * @param {number} piece
     */
    function hashSquare(square, piece) {
        board_hash ^= zobrist[piece][square];
    }

    /**
     * Initialise the zobrist table
     */
    function init_zobrist() {
        let collision = 1,
            seed = 1070372;

        while (collision) {
            collision = 0;
            xorshift32(seed);
            let seens = new Set();

            for (let i = SQUARE_A8; i <= SQUARE_H1; i ++) {
                if (i & 0x88) {
                    i += 7;
                    continue;
                }
                for (let j = 1; j <= 14; j ++) {
                    if (!PIECE_ORDERS[j])
                        continue;
                    let x = xorshift32();
                    if (seens.has(x)) {
                        collision ++;
                        LS(`collision: ${seed} : ${i}/${j} : ${x}`);
                        break;
                    }
                    zobrist[j][i] = x;
                    seens.add(x);
                }
            }
        }

        zobrist_ready = true;
    }

    /**
     * Check if the king is attacked
     * @param {number} color 0, 1 + special cases: 2=same turn, 3=other turn
     * @return {boolean} true if king is attacked
     */
    function kingAttacked(color) {
        if (color > 1)
            color = (color == 2)? turn: turn ^ 1;
        return attacked(color ^ 1, kings[color]);
    }

    /**
     * Get a list of all legal moves
     */
    function legalMoves() {
        let moves = createMoves(false);
        return moves.filter(move => {
            if (!makeMove(move))
                return false;
            undoMove();
            return true;
        });
    }

    /**
     * Load a FEN
     * @param {string} fen valid or invalid FEN
     * @param {boolean} hash hash the board?
     * @returns {string} empty on error, and the FEN may be corrected
     */
    function load(fen_, hash) {
        if (!fen_)
            return "";

        clear();
        fen = fen_;

        let tokens = fen_.split(/\s+/),
            position = tokens[0],
            square = 0;

        for (let value of position) {
            if (value == '/')
                square += 8;
            else if ('123456789'.includes(value))
                square += parseInt(value, 10);
            else {
                put(PIECES[value], square);
                square ++;
            }
        }

        turn = (tokens[1] == 'w')? 0: 1;
        ep_square = anToSquare(tokens[3]);
        half_moves = DefaultInt(tokens[4], 0);
        move_number = DefaultInt(tokens[5], 1);
        fen_ply = (move_number << 1) - 3 + turn;
        ply = 0;

        let start = (!turn && move_number == 1);
        if (start)
            frc = false;

        // can detect FRC if castle is not empty
        if (tokens[2] != "-") {
            let error;
            for (let letter of tokens[2]) {
                let lower = Lower(letter),
                    final = (lower == 'k')? 'h': (lower == 'q')? 'a': lower,
                    color = (letter == lower)? 1: 0,
                    square = 'abcdefghij'.indexOf(final) + ((color? 0: 7) << 4),
                    index = (color << 1) + ((square < kings[color])? 1: 0);

                castling[index] = square;
                if (start && TYPE(board[square]) != ROOK)
                    error = true;
                if (final == lower)
                    frc = true;
            }

            // fix corrupted FEN (only for the initial board)
            if (error) {
                let castle = "";
                for (let color = 0; color < 2; color ++) {
                    let file_letters = color? 'abcdefghij': 'ABCDEFGHIJ',
                        king = kings[color];

                    for (let i = king + 1; FILE(i) <= 7; i ++)
                        if (TYPE(board[i]) == ROOK) {
                            castling[color << 1] = i;
                            castle += file_letters[FILE(i)];
                            break;
                        }

                    for (let i = king - 1; FILE(i) >= 0; i --)
                        if (TYPE(board[i]) == ROOK) {
                            castling[(color << 1) + 1] = i;
                            castle += file_letters[FILE(i)];
                            break;
                        }
                }
                tokens[2] = castle;
                fen = tokens.join(' ');
                frc = true;
            }
        }

        if (hash)
            hashBoard();
        else
            board_hash = 0;
        return fen;
    }

    /**
     * Make a raw move, no verification is being performed
     * @param {Object} move
     * @returns {boolean} false if the move is not legal
     */
    function makeMove(move) {
        let us = turn,
            them = us ^ 1;

        let flags = move.flags,
            is_castle = (flags & BITS_CASTLE),
            move_from = move.from,
            move_to = move.to,
            move_type = TYPE(move.piece);

        // 1) check if move is legal
        // castle is always legal because the checks were made in makeMove
        if (!is_castle) {

        }

        // 2) move is legal => do all other stuff
        // not smart to do it for every move
        addState(move);

        half_moves ++;
        ep_square = EMPTY;

        // moved king?
        if (move_type == KING) {
            if (is_castle) {
                let q = (move.to < move.from)? 1: 0,
                    king = kings[us],
                    king_piece = COLORIZE(us, KING),
                    king_to = (RANK(king) << 4) + 6 - (q << 2),
                    rook = castling[(us << 1) + q],
                    rook_piece = COLORIZE(us, ROOK),
                    rook_to = king_to - 1 + (q << 1);

                hashSquare(king, king_piece);
                hashSquare(rook, rook_piece);
                hashSquare(king_to, king_piece);
                hashSquare(rook_to, rook_piece);
                board[king] = 0;
                board[rook] = 0;
                board[king_to] = king_piece;
                board[rook_to] = rook_piece;
                move_to = king_to;
            }

            kings[us] = move_to;
            castling[us << 1] = EMPTY;
            castling[(us << 1) + 1] = EMPTY;
        }

        if (!is_castle) {
            let capture = move.capture,
                piece = board[move_from];
            if (move_from != move_to) {
                hashSquare(move_from, piece);
                hashSquare(move_to, board[move_to]);
                hashSquare(move_to, piece);
                board[move_from] = 0;
                board[move_to] = piece;
            }

            // remove castling if we capture a rook
            if (capture) {
                materials[them] -= PIECE_SCORES[capture];
                if (capture == ROOK) {
                    if (move_to == castling[them << 1])
                        castling[them << 1] = EMPTY;
                    else if (move_to == castling[(them << 1) + 1])
                        castling[(them << 1) + 1] = EMPTY;
                }
                half_moves = 0;
            }

            // remove castling if we move a rook
            if (move_type == ROOK) {
                if (move_from == castling[us << 1])
                    castling[us << 1] = EMPTY;
                else if (move_from == castling[(us << 1) + 1])
                    castling[(us << 1) + 1] = EMPTY;
            }
            // pawn + update 50MR
            else if (move_type == PAWN) {
                if (flags & BITS_EN_PASSANT) {
                    let target = move_to + 16 - (turn << 5);
                    hashSquare(target, board[target]);
                    board[target] = 0;
                }
                else if (move.promote) {
                    let promote = COLORIZE(us, move.promote);
                    hashSquare(move_to, piece);
                    hashSquare(move_to, promote);
                    board[move_to] = promote;
                    materials[us] += PROMOTE_SCORES[promote];
                }
                // pawn moves 2 squares
                else if (Abs(RANK(move.to) - RANK(move.from)) == 2)
                    ep_square = move_to + 16 - (turn << 5);
                half_moves = 0;
            }
        }

        ply ++;
        if (turn == BLACK)
            move_number ++;
        turn ^= 1;

        // not legal?
        if (kingAttacked(us)) {
            // LS(`illegal move: ${ucify(move)} : ${createFen()}`);
            undoMove();
            return false;
        }
        return true;
    }

    /**
     * Try an object move
     * @param {Object} move {from: 23, to: 7, promote: 5}
     * @param {boolean} decorate add + # decorators
     * @returns {Object}
     */
    function moveObject(move, decorate) {
        let flags = 0,
            move_obj = {},
            moves = legalMoves();

        // castle
        if (move.from == kings[turn]) {
            let piece = board[move.to];

            // regular notation => change .to to rook position
            if (!piece) {
                if (Abs(FILE(move.from) - FILE(move.to)) == 2) {
                    if (move.to > move.from)
                        move.to ++;
                    else
                        move.to -= 2;
                }
            }
            // frc notation
            else if (piece == COLORIZE(turn, ROOK))
                flags = BITS_CASTLE;
        }

        // find an existing match + add the SAN
        if (flags) {
            for (let move2 of moves)
                if (move2.flags & flags) {
                    move2.m = moveToSan(move2, moves);
                    move_obj = move2;
                    break;
                }
        }
        else
            for (let move2 of moves) {
                if (move.from == move2.from && move.to == move2.to
                        && (!move2.promote || TYPE(move.promote) == move2.promote)) {
                    move2.m = moveToSan(move2, moves);
                    move_obj = move2;
                    break;
                }
            }

        // no suitable move?
        if (move_obj.piece) {
            makeMove(move_obj);
            if (decorate)
                decorateMove(move_obj);
        }
        return move_obj;
    }

    /**
     * Try a SAN move
     * @param {string} text Nxb7, a8=Q
     * @param {boolean} decorate add + # decorators
     * @param {boolean} sloppy allow sloppy parser
     * @returns {Object}
     */
    function moveSan(text, decorate, sloppy) {
        let moves = legalMoves(),
            move = sanToMove(text, moves, sloppy);
        if (move.piece) {
            makeMove(move);
            if (decorate)
                decorateMove(move);
        }
        return move;
    }

    /**
     * Convert a move to SAN
     * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
     * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
     * 4. ... Ne7 is technically the valid SAN
     * @param {Move} move
     * @param {Move[]} moves
     * @returns {string}
     */
    function moveToSan(move, moves) {
        if (move.flags & BITS_CASTLE)
            return (move.to > move.from)? "O-O": "O-O-O";

        let disambiguator = disambiguate(move, moves),
            move_type = TYPE(move.piece),
            output = '';

        if (move_type != PAWN)
            output += PIECE_UPPER[move_type] + disambiguator;

        if (move.capture || (move.flags & BITS_EN_PASSANT)) {
            if (move_type == PAWN)
                output += squareToAn(move.from, false)[0];
            output += 'x';
        }

        output += squareToAn(move.to, false);

        if (move.promote) {
            output += '=';
            output += PIECE_UPPER[move.promote];
        }
        return output;
    }

    /**
     * Try an UCI move
     * @param {string} text c2c4, a7a8a
     * @param {boolean} decorate add + # decorators
     * @returns {Object}
     */
    function moveUci(text, decorate) {
        let move = {
            from: anToSquare(text.substr(0, 2)),
            promote: PIECES[text[4]] || 0,
            to: anToSquare(text.substr(2, 2)),
        };
        return moveObject(move, decorate);
    }

    /**
     * Parse a list of SAN moves + create FEN for each move
     * @param {string} text c2c4 a7a8a ...
     * @param {boolean} sloppy allow sloppy parser
     * @returns {Object[]}
     */
    function multiSan(multi, sloppy) {
        let result = [],
            texts = multi.split(' ');
        for (let text of texts) {
            if ('0123456789'.includes(text[0]))
                continue;

            let moves = legalMoves(),
                move = sanToMove(text, moves, sloppy);
            if (!move.piece)
                break;
            makeMove(move);
            move.fen = createFen();
            move.ply = fen_ply + ply;
            move.score = 0;
            result.push(move);
        }
        return result;
    }

    /**
     * Parse a list of UCI moves + create SAN + FEN for each move
     * @param {string} text c2c4 a7a8a ...
     * @returns {Object[]}
     */
    function multiUci(multi) {
        let result = [],
            texts = multi.split(' ');
        for (let text of texts) {
            if ('0123456789'.includes(text[0]))
                continue;

            let move = moveUci(text, true);
            if (move.piece) {
                move.fen = createFen();
                move.ply = fen_ply + ply;
                move.score = 0;
                result.push(move);
            }
        }
        return result;
    }

    /**
     * Move ordering for alpha-beta
     * - captures
     * - castle
     * - nb/r/q/r/p
     * @param {Move[]} moves
     */
    function orderMoves(moves) {
        moves.sort(compareMoves);
    }

    /**
     * Get params
     */
    function params() {
        let result = [
            max_depth,          // 0
            eval_mode,          // 1
            max_nodes,          // 2
            search_mode,        // 3
            max_time,           // 4
            max_quiesce,        // 5
        ];
        return result;
    }

    /**
     * Perform perft and divide
     * @param {string} fen
     * @param {number} depth
     * @returns {string}
     */
    function perft(fen, depth) {
        if (fen)
            load(fen);
        let moves = legalMoves(),
            lines = [`1=${moves.length}`];

        for (let move of moves) {
            makeMove(move);
            let prev = nodes;
            nullSearch(depth - 1);
            let delta = nodes - prev;
            lines.push(`${ucify(move)}:${delta}`);
            prev = nodes;
            undoMove();
        }

        if (depth > 1)
            lines.push(`${depth}=${nodes}`);
        return lines.sort().join(' ');
    }

    /**
     * Print the board
     * @param {boolean} console
     * @returns {string}
     */
    function print(console) {
        let text = '';
        for (let i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            // off board
            if (i & 0x88) {
                i += 7;
                text += '\n';
                continue;
            }
            text += PIECE_NAMES[board[i]];
        }
        if (console)
            LS(text);
        return text;
    }

    /**
     * Put a piece on a square
     * @param {number} piece
     * @param {number} square
     */
    function put(piece, square) {
        board[square] = piece;
        if (TYPE(piece) == KING)
            kings[COLOR(piece)] = square;
        else
            materials[COLOR(piece)] += PIECE_SCORES[piece];
    }

    /**
     * Reset the board to the default position
     */
    function reset() {
        frc = false;
        load(DEFAULT_POSITION);
    }

    /**
     * Convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
     * https://github.com/jhlywa/chess.js
     * @param {string} san Nf3, Nf3+?!
     * @param {Object[]} moves list of moves to match the san against
     * @param {boolean} sloppy allow sloppy parser
     * @returns {Object}
     */
    function sanToMove(san, moves, sloppy) {
        // 1) try exact matching
        let clean = cleanSan(san);
        for (let move of moves)
            if (clean == cleanSan(moveToSan(move, moves))) {
                move.m = san;
                return move;
            }

        // 2) try sloppy matching
        if (!sloppy)
            return NULL_MOVE;

        let from_file = EMPTY,
            from_rank = EMPTY,
            i = clean.length - 1,
            to = EMPTY,
            promote = 0,
            type = 0;

        if (i < 2)
            return NULL_MOVE;

        // analyse backwards
        if ('bnrqBNRQ'.includes(clean[i])) {
            promote = TYPE(PIECES[clean[i]]);
            i --;
        }
        // to
        if (!'12345678'.includes(clean[i]))
            return NULL_MOVE;
        i --;
        if (!'abcdefghij'.includes(clean[i]))
            return NULL_MOVE;
        to = 'abcdefghij'.indexOf(clean[i]) + ('87654321'.indexOf(clean[i + 1]) << 4);
        i --;
        //
        if (i >= 0 && clean[i] == 'x')
            i --;
        // from
        if (i >= 0 && '12345678'.includes(clean[i])) {
            from_rank = '87654321'.indexOf(clean[i]);
            i --;
        }
        if (i >= 0 && 'abcdefghij'.includes(clean[i])) {
            from_file = 'abcdefghij'.indexOf(clean[i]);
            i --;
        }
        // type
        type = TYPE(PIECES[clean[i]]);

        for (let move of moves) {
            if (to == move.to
                    && (!type || type == TYPE(move.piece))
                    && (from_file == EMPTY || from_file == FILE(move.from))
                    && (from_rank == EMPTY || from_rank == RANK(move.from))
                    && (!promote || promote == move.promote)) {
                move.m = moveToSan(move, moves);
                return move;
            }
        }
        return NULL_MOVE;
    }

    /**
     * Basic tree search with mask
     * https://www.chessprogramming.org/Principal_Variation_Search
     * @param {Move[]} moves
     * @param {string} mask moves to search, ex: 'b8c6 b8a6 g8h6'
     * @returns {Move[]} updated moves
     */
    function search(moves, mask) {
        hashBoard();
        nodes = 0;
        sel_depth = 0;

        let average = 0,
            count = 0,
            empty = !mask,
            masked = [];

        for (let move of moves) {
            let uci = ucify(move);
            if (!empty && !mask.includes(uci))
                continue;

            let score = 0;
            avg_depth = 1;

            if (max_depth > 0) {
                if (!makeMove(move))
                    continue;
                if (search_mode == 1)
                    score = -miniMax(1, max_depth);
                else
                    score = -alphaBeta(-99999, 99999, 1, max_depth);
                undoMove();
            }

            move.score = score;
            masked.push(move);

            average += avg_depth;
            count ++;
        }

        avg_depth = count? average / count: 0;
        return masked;
    }

    /**
     * Convert a square number to an algebraic notation
     * - 'a' = 97
     * - '8' = 56
     * @param {number} square 112
     * @param {boolean=} check check the boundaries
     * @returns {string} a1
     */
    function squareToAn(square, check) {
        let file = FILE(square),
            rank = RANK(square);
        if (check && (file < 0 || file > 7 || rank < 0 || rank > 7))
            return "";
        let text = '';
        text += String.fromCharCode(97 + file);
        text += String.fromCharCode(56 - rank);
        return text;
    }

    /**
     * Add UCI to a move
     * @param {Move} move
     * @returns {string}
     */
    function ucify(move) {
        if (!move)
            return '???';
        move.m = squareToAn(move.from, false) + squareToAn(move.to, false);
        if (move.promote)
            move.m += PIECE_LOWER[move.promote];
        return move.m;
    }

    /**
     * Undo a move
     */
    function undoMove() {
        if (ply <= 0)
            return;
        ply --;

        let move,
            state = ply_states[ply & 127];
        [
            castling,
            ep_square,
            half_moves,
            move,
        ] = state;

        turn ^= 1;
        if (turn == BLACK)
            move_number --;

        let us = turn,
            them = turn ^ 1;

        // undo castle
        if (move.flags & BITS_CASTLE) {
            let q = (move.to < move.from)? 1: 0,
                king = move.from,
                king_piece = COLORIZE(us, KING),
                king_to = (RANK(king) << 4) + 6 - (q << 2),
                rook_piece = COLORIZE(us, ROOK),
                rook_to = king_to - 1 + (q << 1);

            hashSquare(king_to, king_piece);
            hashSquare(rook_to, rook_piece);
            hashSquare(king, king_piece);
            hashSquare(move.to, rook_piece);
            board[king_to] = 0;
            board[rook_to] = 0;
            board[king] = king_piece;
            board[move.to] = rook_piece;
            kings[us] = king;
        }
        else {
            if (move.from != move.to) {
                hashSquare(move.to, board[move.to]);
                hashSquare(move.from, move.piece);
                board[move.to] = 0;
                board[move.from] = move.piece;
                if (TYPE(move.piece) == KING)
                    kings[us] = move.from;
            }

            if (move.flags & BITS_EN_PASSANT) {
                let capture = COLORIZE(them, PAWN),
                    target = move.to + 16 - (us << 5);
                hashSquare(target, capture);
                board[target] = capture;
                materials[them] += PIECE_SCORES[PAWN];
            }
            else {
                if (move.capture) {
                    let capture = COLORIZE(them, move.capture);
                    hashSquare(move.to, capture);
                    board[move.to] = capture;
                    materials[them] += PIECE_SCORES[move.capture];
                }
                if (move.promote)
                    materials[us] -= PROMOTE_SCORES[move.promote];
            }
        }
    }

    // if the user passes in a fen string, load it, else default to starting position
    load(fen_ || DEFAULT_POSITION);

    // BINDING CODE
    ///////////////

    // CHESS BINDINGS
    return {
        //
        anToSquare: anToSquare,
        attacked: attacked,
        attacks: () => attacks,
        avgDepth: () => avg_depth,
        board: () => board,
        boardHash: () => board_hash,
        castling: () => castling,
        checked: color => kingAttacked(color),
        cleanSan: cleanSan,
        clear: clear,
        configure: configure,
        currentFen: () => fen,
        decorate: decorateMove,
        defenses: () => defenses,
        evaluate: evaluate,
        fen: createFen,
        fen960: createFen960,
        frc: () => frc,
        hashBoard: hashBoard,
        load: load,
        makeMove: makeMove,
        material: color => materials[color],
        mobilities: () => mobilities,
        moveObject: moveObject,
        moves: legalMoves,
        moveSan: moveSan,
        moveToSan: moveToSan,
        moveUci: moveUci,
        multiSan: multiSan,
        multiUci: multiUci,
        nodes: () => nodes,
        order: orderMoves,
        params: params,
        perft: perft,
        piece: text => PIECES[text] || 0,
        print: print,
        put: put,
        reset: reset,
        sanToMove: sanToMove,
        search: search,
        selDepth: () => Max(avg_depth, sel_depth),
        squareToAn: squareToAn,
        turn: () => turn,
        ucify: ucify,
        undo: undoMove,
        version: () => '20200918',
        zobrist: () => zobrist,
    };
};


// <<
if (typeof exports != 'undefined')
    Assign(exports, {
        Chess: Chess,
    });
// >>
