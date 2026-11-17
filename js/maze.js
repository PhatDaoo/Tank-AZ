// Braid Maze Generator & Pathfinding Helper for AZ Tank

export class Maze {
    constructor(cols, rows, canvasWidth, canvasHeight) {
        this.cols = cols;
        this.rows = rows;

        const padX = 36;
        const padY = 30;
        const availW = canvasWidth - padX * 2;
        const availH = canvasHeight - padY * 2;

        this.cellSize = Math.floor(Math.min(availW / cols, availH / rows));
        this.width = this.cellSize * cols;
        this.height = this.cellSize * rows;
        this.offsetX = Math.floor((canvasWidth - this.width) / 2);
        this.offsetY = Math.floor((canvasHeight - this.height) / 2);
        this.wallThickness = 6;

        // Horizontal walls: (rows + 1) x cols
        this.hWalls = Array.from({ length: rows + 1 }, () => Array(cols).fill(true));
        // Vertical walls: rows x (cols + 1)
        this.vWalls = Array.from({ length: rows }, () => Array(cols + 1).fill(true));

        this.segments = [];
        this.generate();
        this.buildSegments();
    }

    generate() {
        const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
        const stack = [];

        const startR = Math.floor(Math.random() * this.rows);
        const startC = Math.floor(Math.random() * this.cols);
        visited[startR][startC] = true;
        stack.push([startR, startC]);

        const dirs = [
            [-1, 0, 'N'],
            [1, 0, 'S'],
            [0, -1, 'W'],
            [0, 1, 'E']
        ];

        while (stack.length > 0) {
            const [r, c] = stack[stack.length - 1];
            const neighbors = [];

            for (const [dr, dc, dir] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && !visited[nr][nc]) {
                    neighbors.push([nr, nc, dir]);
                }
            }

            if (neighbors.length > 0) {
                const [nr, nc, dir] = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.removeWallBetween(r, c, nr, nc, dir);
                visited[nr][nc] = true;
                stack.push([nr, nc]);
            } else {
                stack.pop();
            }
        }

        // Open ~18% of remaining internal walls to create tactical loops for 4 players
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (r > 0 && this.hWalls[r][c] && Math.random() < 0.18) {
                    this.hWalls[r][c] = false;
                }
                if (c > 0 && this.vWalls[r][c] && Math.random() < 0.18) {
                    this.vWalls[r][c] = false;
                }
            }
        }

        // Avoid completely isolated 4-wall pillars or overly open empty rooms:
        // Ensure at least some internal cover exists in every 2x2 block
        for (let r = 1; r < this.rows; r++) {
            for (let c = 1; c < this.cols; c++) {
                const hasWall =
                    this.hWalls[r][c - 1] ||
                    this.hWalls[r][c] ||
                    this.vWalls[r - 1][c] ||
                    this.vWalls[r][c];
                if (!hasWall) {
                    if (Math.random() < 0.5) this.hWalls[r][c] = true;
                    else this.vWalls[r][c] = true;
                }
            }
        }
    }

    removeWallBetween(r1, c1, r2, c2, dir) {
        if (dir === 'N') this.hWalls[r1][c1] = false;
        else if (dir === 'S') this.hWalls[r2][c2] = false;
        else if (dir === 'W') this.vWalls[r1][c1] = false;
        else if (dir === 'E') this.vWalls[r2][c2] = false;
    }

    buildSegments() {
        this.segments = [];
        const ox = this.offsetX;
        const oy = this.offsetY;
        const cs = this.cellSize;

        // Merge collinear horizontal walls so tanks/bullets don't hit internal vertex seams
        for (let r = 0; r <= this.rows; r++) {
            let startC = null;
            for (let c = 0; c <= this.cols; c++) {
                const active = c < this.cols ? this.hWalls[r][c] : false;
                if (active && startC === null) {
                    startC = c;
                } else if (!active && startC !== null) {
                    this.segments.push({
                        x1: ox + startC * cs,
                        y1: oy + r * cs,
                        x2: ox + c * cs,
                        y2: oy + r * cs,
                        orientation: 'H'
                    });
                    startC = null;
                }
            }
        }

        // Merge collinear vertical walls
        for (let c = 0; c <= this.cols; c++) {
            let startR = null;
            for (let r = 0; r <= this.rows; r++) {
                const active = r < this.rows ? this.vWalls[r][c] : false;
                if (active && startR === null) {
                    startR = r;
                } else if (!active && startR !== null) {
                    this.segments.push({
                        x1: ox + c * cs,
                        y1: oy + startR * cs,
                        x2: ox + c * cs,
                        y2: oy + r * cs,
                        orientation: 'V'
                    });
                    startR = null;
                }
            }
        }
    }

    cellCenter(col, row) {
        return {
            x: this.offsetX + (col + 0.5) * this.cellSize,
            y: this.offsetY + (row + 0.5) * this.cellSize
        };
    }

    worldToCell(x, y) {
        const col = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.offsetX) / this.cellSize)));
        const row = Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.offsetY) / this.cellSize)));
        return { col, row };
    }

    getAccessibleNeighbors(col, row) {
        const res = [];
        if (row > 0 && !this.hWalls[row][col]) res.push({ col, row: row - 1 });
        if (row < this.rows - 1 && !this.hWalls[row + 1][col]) res.push({ col, row: row + 1 });
        if (col > 0 && !this.vWalls[row][col]) res.push({ col: col - 1, row });
        if (col < this.cols - 1 && !this.vWalls[row][col + 1]) res.push({ col: col + 1, row });
        return res;
    }

    // BFS shortest path step from (fromCol, fromRow) toward (toCol, toRow)
    getNextStepTowards(fromCol, fromRow, toCol, toRow) {
        if (fromCol === toCol && fromRow === toRow) {
            return { col: toCol, row: toRow };
        }
        const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
        const queue = [];

        visited[fromRow][fromCol] = true;
        for (const n of this.getAccessibleNeighbors(fromCol, fromRow)) {
            visited[n.row][n.col] = true;
            queue.push({ col: n.col, row: n.row, firstStep: n });
        }

        while (queue.length > 0) {
            const cur = queue.shift();
            if (cur.col === toCol && cur.row === toRow) {
                return cur.firstStep;
            }
            for (const n of this.getAccessibleNeighbors(cur.col, cur.row)) {
                if (!visited[n.row][n.col]) {
                    visited[n.row][n.col] = true;
                    queue.push({ col: n.col, row: n.row, firstStep: cur.firstStep });
                }
            }
        }
        return { col: fromCol, row: fromRow };
    }

    // Pick up to 4 well-separated spawn locations
    pickSpawnCells(count) {
        const chosen = [];
        // Start with a random corner-ish cell
        const firstCol = Math.random() < 0.5 ? 0 : this.cols - 1;
        const firstRow = Math.random() < 0.5 ? 0 : this.rows - 1;
        chosen.push({ col: firstCol, row: firstRow });

        while (chosen.length < count) {
            let bestCell = null;
            let bestMinDist = -1;

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (chosen.some((p) => p.col === c && p.row === r)) continue;
                    let minDist = Infinity;
                    for (const p of chosen) {
                        const d = Math.hypot(c - p.col, r - p.row);
                        if (d < minDist) minDist = d;
                    }
                    // Add slight random jitter to break ties
                    const score = minDist + Math.random() * 0.25;
                    if (score > bestMinDist) {
                        bestMinDist = score;
                        bestCell = { col: c, row: r };
                    }
                }
            }
            if (bestCell) chosen.push(bestCell);
            else break;
        }

        return chosen.map((cell) => {
            const openNeighbors = this.getAccessibleNeighbors(cell.col, cell.row);
            let spawnAngle = Math.floor(Math.random() * 4) * (Math.PI / 2);
            if (openNeighbors.length > 0) {
                const chosenNeighbor = openNeighbors[Math.floor(Math.random() * openNeighbors.length)];
                spawnAngle = Math.atan2(chosenNeighbor.row - cell.row, chosenNeighbor.col - cell.col);
            }
            return {
                ...this.cellCenter(cell.col, cell.row),
                angle: spawnAngle
            };
        });
    }

    draw(ctx) {
        // Subtle floor grid inside maze
        ctx.save();
        ctx.fillStyle = '#eceef2';
        ctx.fillRect(this.offsetX, this.offsetY, this.width, this.height);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.045)';
        ctx.lineWidth = 1;
        for (let r = 1; r < this.rows; r++) {
            const y = this.offsetY + r * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(this.offsetX, y);
            ctx.lineTo(this.offsetX + this.width, y);
            ctx.stroke();
        }
        for (let c = 1; c < this.cols; c++) {
            const x = this.offsetX + c * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(x, this.offsetY);
            ctx.lineTo(x, this.offsetY + this.height);
            ctx.stroke();
        }

        // Wall drop shadow
        ctx.lineCap = 'square';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.lineWidth = this.wallThickness;
        ctx.beginPath();
        for (const seg of this.segments) {
            ctx.moveTo(seg.x1 + 3, seg.y1 + 4);
            ctx.lineTo(seg.x2 + 3, seg.y2 + 4);
        }
        ctx.stroke();

        // Main crisp dark wall segments
        ctx.strokeStyle = '#3b3f46';
        ctx.lineWidth = this.wallThickness;
        ctx.beginPath();
        for (const seg of this.segments) {
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
        }
        ctx.stroke();

        ctx.restore();
    }
}
