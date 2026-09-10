const levels = {
    beginner: { rows: 8, cols: 8, mines: 10, label: 'Fácil' },
    intermediate: { rows: 12, cols: 12, mines: 28, label: 'Medio' },
    expert: { rows: 16, cols: 16, mines: 44, label: 'Difícil' }
};

const board = document.getElementById('mineBoard');
const mineCount = document.getElementById('mineCount');
const selectedLevel = document.getElementById('selectedLevel');
const levelButtons = document.querySelectorAll('[data-level]');
const restartBtn = document.getElementById('restartBtn');
const timer = document.getElementById('timer');
const gameStatus = document.getElementById('gameStatus');
let currentLevel = 'beginner';
let grid = [];
let firstMove = true;
let firstMoveCell = null;
let seconds = 0;
let timerInterval = null;
let minesPlaced = false;
let gameFinished = false;

function initBoard(levelKey = currentLevel) {
    const config = levels[levelKey];
    selectedLevel.textContent = config.label;
    mineCount.textContent = config.mines;
    board.style.gridTemplateColumns = `repeat(${config.cols}, 34px)`;
    board.style.gridTemplateRows = `repeat(${config.rows}, 34px)`;
    board.innerHTML = '';

    grid = [];
    for (let r = 0; r < config.rows; r++) {
        const row = [];
        for (let c = 0; c < config.cols; c++) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cell hidden';
            cell.setAttribute('data-row', r);
            cell.setAttribute('data-col', c);
            cell.textContent = '';
            cell.addEventListener('click', () => revealCell(r, c));
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                toggleFlag(r, c);
            });
            board.appendChild(cell);
            row.push({ row: r, col: c, isMine: false, isRevealed: false, isFlagged: false, adjacent: 0 });
        }
        grid.push(row);
    }

    gameStatus.textContent = 'Listo';
    firstMove = true;
    firstMoveCell = null;
    seconds = 0;
    minesPlaced = false;
    gameFinished = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timer.textContent = '000';
}

function randomizeMines(levelKey = currentLevel, firstRow = -1, firstCol = -1) {
    const config = levels[levelKey];
    const allCells = [];
    const protectedCells = new Set();

    if (firstRow >= 0 && firstCol >= 0) {
        for (let r = firstRow - 1; r <= firstRow + 1; r++) {
            for (let c = firstCol - 1; c <= firstCol + 1; c++) {
                if (r >= 0 && r < config.rows && c >= 0 && c < config.cols) {
                    protectedCells.add(`${r}-${c}`);
                }
            }
        }
    }

    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            const key = `${r}-${c}`;
            if (!protectedCells.has(key)) {
                allCells.push({ r, c });
            }
        }
    }

    const shuffled = allCells.sort(() => Math.random() - 0.5);
    const mines = shuffled.slice(0, config.mines);

    for (const mine of mines) {
        grid[mine.r][mine.c].isMine = true;
    }

    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (!grid[r][c].isMine) {
                grid[r][c].adjacent = countAdjacentMines(r, c);
            }
        }
    }

    minesPlaced = true;
}

function countAdjacentMines(r, c) {
    const config = levels[currentLevel];
    let count = 0;
    for (let rr = r - 1; rr <= r + 1; rr++) {
        for (let cc = c - 1; cc <= c + 1; cc++) {
            if (rr === r && cc === c) continue;
            if (rr >= 0 && rr < config.rows && cc >= 0 && cc < config.cols && grid[rr][cc].isMine) {
                count++;
            }
        }
    }
    return count;
}

function revealCell(r, c) {
    if (firstMove) {
        firstMoveCell = { r, c };
        randomizeMines(currentLevel, r, c);
        firstMove = false;
        startTimer();
    }

    const cellData = grid[r][c];
    if (cellData.isRevealed || cellData.isFlagged) return;

    if (cellData.isMine) {
        revealAllMines();
        gameStatus.textContent = 'Boom!';
        clearInterval(timerInterval);
        showCell(r, c, '✹', 'mine');
        return;
    }

    floodReveal(r, c, firstMoveCell ? (firstMoveCell.r === r && firstMoveCell.c === c) : false);

    if (checkWin()) {
        gameStatus.textContent = 'Ganaste!';
        clearInterval(timerInterval);
        revealAllMines();
        if (!gameFinished) {
            gameFinished = true;
            saveScore(seconds);
        }
    }
}

function floodReveal(r, c, isFirstCell = false) {
    const config = levels[currentLevel];
    const stack = [{ r, c }];

    while (stack.length) {
        const cellPoint = stack.pop();
        const rr = cellPoint.r;
        const cc = cellPoint.c;

        if (rr < 0 || rr >= config.rows || cc < 0 || cc >= config.cols) continue;
        const cellData = grid[rr][cc];
        if (cellData.isRevealed || cellData.isFlagged || cellData.isMine) continue;

        cellData.isRevealed = true;
        const cellElement = getCellElement(rr, cc);
        if (cellData.adjacent === 0) {
            cellElement.className = 'cell revealed';
            cellElement.dataset.value = '';
            cellElement.textContent = '';
            for (let nr = rr - 1; nr <= rr + 1; nr++) {
                for (let nc = cc - 1; nc <= cc + 1; nc++) {
                    if (nr === rr && nc === cc) continue;
                    if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols && !grid[nr][nc].isMine && !grid[nr][nc].isRevealed) {
                        stack.push({ r: nr, c: nc });
                    }
                }
            }
        } else {
            cellElement.className = 'cell revealed';
            cellElement.dataset.value = String(cellData.adjacent);
            cellElement.textContent = String(cellData.adjacent);
        }
    }
}

function toggleFlag(r, c) {
    const cellData = grid[r][c];
    const cellElement = getCellElement(r, c);

    if (cellData.isRevealed) return;

    cellData.isFlagged = !cellData.isFlagged;
    cellElement.className = cellData.isFlagged ? 'cell flagged' : 'cell hidden';
    cellElement.textContent = cellData.isFlagged ? '⚑' : '';
}

function revealAllMines() {
    const config = levels[currentLevel];
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            const cellData = grid[r][c];
            const cellElement = getCellElement(r, c);
            if (cellData.isMine) {
                cellElement.className = 'cell mine revealed';
                cellElement.textContent = '✹';
            }
        }
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        timer.textContent = String(seconds).padStart(3, '0');
    }, 1000);
}

function checkWin() {
    const config = levels[currentLevel];
    let revealed = 0;
    let totalSafe = config.rows * config.cols - config.mines;

    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (grid[r][c].isRevealed) revealed++;
        }
    }

    return revealed >= totalSafe;
}

function saveScore(secondsSpent) {
    fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            level: currentLevel,
            seconds: secondsSpent
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.ok) {
            gameStatus.textContent = `Ganaste! Puntaje ${data.score}`;
        }
    })
    .catch(() => {
        gameStatus.textContent = 'Ganaste!';
    });
}

function showCell(r, c, symbol, type) {
    const element = getCellElement(r, c);
    element.className = `cell ${type}`;
    element.textContent = symbol;
}

function getCellElement(r, c) {
    return board.querySelector(`[data-row="${r}"][data-col="${c}"]`);
}

levelButtons.forEach(button => {
    button.addEventListener('click', () => {
        currentLevel = button.dataset.level;
        levelButtons.forEach(btn => btn.classList.toggle('active', btn === button));
        document.querySelectorAll('.level-modes').forEach(item => item.classList.toggle('active', item.dataset.level === currentLevel));
        initBoard(currentLevel);
    });
});

restartBtn.addEventListener('click', () => {
    initBoard(currentLevel);
});

initBoard();
