// AI for computer opponent
class BattleshipAI {
    constructor() {
        this.GRID_SIZE = 10;
        this.SHIPS = [
            { name: 'carrier', size: 5 },
            { name: 'battleship', size: 4 },
            { name: 'cruiser', size: 3 },
            { name: 'submarine', size: 3 },
            { name: 'destroyer', size: 2 }
        ];
        
        // AI state for attacking
        this.attackGrid = Array(this.GRID_SIZE).fill(null).map(() => 
            Array(this.GRID_SIZE).fill(0) // 0: unknown, 1: miss, 2: hit, 3: sunk
        );
        
        this.mode = 'hunt'; // 'hunt' or 'target'
        this.targetQueue = []; // Cells to target when in target mode
        this.lastHit = null;
        this.hitDirection = null;
        this.originalHit = null;
    }

    // Ship placement methods
    placeShipsRandomly() {
        const board = Array(this.GRID_SIZE).fill(null).map(() => 
            Array(this.GRID_SIZE).fill(0)
        );
        const ships = [];

        this.SHIPS.forEach((shipConfig, index) => {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 1000) {
                const row = Math.floor(Math.random() * this.GRID_SIZE);
                const col = Math.floor(Math.random() * this.GRID_SIZE);
                const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                
                const positions = this.getShipPositions(row, col, shipConfig.size, orientation);
                
                if (this.isValidShipPlacement(positions, board)) {
                    const shipId = ships.length + 1;
                    
                    // Place ship on board
                    positions.forEach(pos => {
                        board[pos.row][pos.col] = shipId;
                    });

                    // Add to ships array
                    ships.push({
                        id: shipId,
                        type: shipConfig.name,
                        positions: positions,
                        hits: 0,
                        sunk: false
                    });

                    placed = true;
                }
                attempts++;
            }
        });

        return ships;
    }

    getShipPositions(startRow, startCol, size, orientation) {
        const positions = [];
        for (let i = 0; i < size; i++) {
            if (orientation === 'horizontal') {
                positions.push({ row: startRow, col: startCol + i });
            } else {
                positions.push({ row: startRow + i, col: startCol });
            }
        }
        return positions;
    }

    isValidShipPlacement(positions, board) {
        return positions.every(pos => {
            // Check bounds
            if (pos.row < 0 || pos.row >= this.GRID_SIZE || 
                pos.col < 0 || pos.col >= this.GRID_SIZE) {
                return false;
            }
            
            // Check if cell is already occupied
            if (board[pos.row][pos.col] !== 0) {
                return false;
            }

            // Check adjacent cells for other ships (no touching ships rule)
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = pos.row + dr;
                    const newCol = pos.col + dc;
                    if (newRow >= 0 && newRow < this.GRID_SIZE && 
                        newCol >= 0 && newCol < this.GRID_SIZE) {
                        if (board[newRow][newCol] !== 0) {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
    }

    // Attack methods
    getNextAttack() {
        if (this.mode === 'target' && this.targetQueue.length > 0) {
            return this.getTargetModeAttack();
        } else {
            return this.getHuntModeAttack();
        }
    }

    getHuntModeAttack() {
        // Use probability density to find best hunting spots
        const probabilities = this.calculateProbabilities();
        let bestCells = [];
        let maxProbability = 0;

        for (let row = 0; row < this.GRID_SIZE; row++) {
            for (let col = 0; col < this.GRID_SIZE; col++) {
                if (this.attackGrid[row][col] === 0) { // Unknown cell
                    if (probabilities[row][col] > maxProbability) {
                        maxProbability = probabilities[row][col];
                        bestCells = [{ row, col }];
                    } else if (probabilities[row][col] === maxProbability) {
                        bestCells.push({ row, col });
                    }
                }
            }
        }

        // If no probability-based target, use checkerboard pattern
        if (bestCells.length === 0) {
            return this.getCheckerboardAttack();
        }

        // Return random cell from best cells
        return bestCells[Math.floor(Math.random() * bestCells.length)];
    }

    getCheckerboardAttack() {
        const availableCells = [];
        
        for (let row = 0; row < this.GRID_SIZE; row++) {
            for (let col = 0; col < this.GRID_SIZE; col++) {
                if (this.attackGrid[row][col] === 0 && (row + col) % 2 === 0) {
                    availableCells.push({ row, col });
                }
            }
        }

        if (availableCells.length === 0) {
            // Fall back to any available cell
            for (let row = 0; row < this.GRID_SIZE; row++) {
                for (let col = 0; col < this.GRID_SIZE; col++) {
                    if (this.attackGrid[row][col] === 0) {
                        availableCells.push({ row, col });
                    }
                }
            }
        }

        return availableCells[Math.floor(Math.random() * availableCells.length)];
    }

    getTargetModeAttack() {
        // Get next target from queue
        const target = this.targetQueue.shift();
        
        if (this.targetQueue.length === 0) {
            this.mode = 'hunt';
            this.hitDirection = null;
            this.originalHit = null;
        }
        
        return target;
    }

    calculateProbabilities() {
        const probabilities = Array(this.GRID_SIZE).fill(null).map(() => 
            Array(this.GRID_SIZE).fill(0)
        );

        // Get remaining ship sizes (simplified - assumes we don't know which ships are sunk)
        const remainingShips = [5, 4, 3, 3, 2]; // This could be improved by tracking sunk ships

        remainingShips.forEach(shipSize => {
            // Try placing ship at each position and orientation
            for (let row = 0; row < this.GRID_SIZE; row++) {
                for (let col = 0; col < this.GRID_SIZE; col++) {
                    // Horizontal placement
                    if (this.canPlaceShipForProbability(row, col, shipSize, 'horizontal')) {
                        for (let i = 0; i < shipSize; i++) {
                            probabilities[row][col + i]++;
                        }
                    }
                    
                    // Vertical placement
                    if (this.canPlaceShipForProbability(row, col, shipSize, 'vertical')) {
                        for (let i = 0; i < shipSize; i++) {
                            probabilities[row + i][col]++;
                        }
                    }
                }
            }
        });

        return probabilities;
    }

    canPlaceShipForProbability(startRow, startCol, size, orientation) {
        const positions = this.getShipPositions(startRow, startCol, size, orientation);
        
        return positions.every(pos => {
            // Check bounds
            if (pos.row < 0 || pos.row >= this.GRID_SIZE || 
                pos.col < 0 || pos.col >= this.GRID_SIZE) {
                return false;
            }
            
            // Can't place on known misses or sunk cells
            if (this.attackGrid[pos.row][pos.col] === 1 || this.attackGrid[pos.row][pos.col] === 3) {
                return false;
            }
            
            return true;
        });
    }

    recordHit(row, col) {
        this.attackGrid[row][col] = 2; // Mark as hit
        this.lastHit = { row, col };
        
        if (this.mode === 'hunt') {
            // Switch to target mode
            this.mode = 'target';
            this.originalHit = { row, col };
            this.addAdjacentTargets(row, col);
        } else if (this.mode === 'target') {
            // We're already targeting, continue in the same direction
            if (this.hitDirection) {
                this.continueInDirection(row, col);
            } else {
                // Determine direction from original hit
                this.determineDirection(row, col);
            }
        }
    }

    recordMiss(row, col) {
        this.attackGrid[row][col] = 1; // Mark as miss
        
        if (this.mode === 'target' && this.hitDirection) {
            // Try opposite direction from original hit
            this.reverseDirection();
        }
    }

    recordSink(shipPositions) {
        // Mark all ship positions as sunk
        shipPositions.forEach(pos => {
            this.attackGrid[pos.row][pos.col] = 3;
        });
        
        // Clear target queue and return to hunt mode
        this.targetQueue = [];
        this.mode = 'hunt';
        this.hitDirection = null;
        this.originalHit = null;
        this.lastHit = null;
    }

    addAdjacentTargets(row, col) {
        const directions = [
            { row: -1, col: 0 }, // Up
            { row: 1, col: 0 },  // Down
            { row: 0, col: -1 }, // Left
            { row: 0, col: 1 }   // Right
        ];

        directions.forEach(dir => {
            const newRow = row + dir.row;
            const newCol = col + dir.col;
            
            if (this.isValidTarget(newRow, newCol)) {
                this.targetQueue.push({ row: newRow, col: newCol });
            }
        });

        // Shuffle target queue for randomness
        this.shuffleArray(this.targetQueue);
    }

    determineDirection(row, col) {
        if (!this.originalHit) return;
        
        const rowDiff = row - this.originalHit.row;
        const colDiff = col - this.originalHit.col;
        
        if (rowDiff !== 0) {
            this.hitDirection = rowDiff > 0 ? 'down' : 'up';
        } else if (colDiff !== 0) {
            this.hitDirection = colDiff > 0 ? 'right' : 'left';
        }
        
        if (this.hitDirection) {
            this.continueInDirection(row, col);
        }
    }

    continueInDirection(row, col) {
        let nextRow = row;
        let nextCol = col;
        
        switch (this.hitDirection) {
            case 'up':
                nextRow = row - 1;
                break;
            case 'down':
                nextRow = row + 1;
                break;
            case 'left':
                nextCol = col - 1;
                break;
            case 'right':
                nextCol = col + 1;
                break;
        }
        
        if (this.isValidTarget(nextRow, nextCol)) {
            // Clear current queue and add next target in direction
            this.targetQueue = [{ row: nextRow, col: nextCol }];
        } else {
            // Can't continue in this direction, try opposite
            this.reverseDirection();
        }
    }

    reverseDirection() {
        if (!this.originalHit || !this.hitDirection) return;
        
        let nextRow = this.originalHit.row;
        let nextCol = this.originalHit.col;
        
        switch (this.hitDirection) {
            case 'up':
                nextRow = this.originalHit.row + 1;
                this.hitDirection = 'down';
                break;
            case 'down':
                nextRow = this.originalHit.row - 1;
                this.hitDirection = 'up';
                break;
            case 'left':
                nextCol = this.originalHit.col + 1;
                this.hitDirection = 'right';
                break;
            case 'right':
                nextCol = this.originalHit.col - 1;
                this.hitDirection = 'left';
                break;
        }
        
        if (this.isValidTarget(nextRow, nextCol)) {
            this.targetQueue = [{ row: nextRow, col: nextCol }];
        } else {
            // No valid targets, return to hunt mode
            this.mode = 'hunt';
            this.hitDirection = null;
            this.originalHit = null;
            this.targetQueue = [];
        }
    }

    isValidTarget(row, col) {
        return row >= 0 && row < this.GRID_SIZE && 
               col >= 0 && col < this.GRID_SIZE && 
               this.attackGrid[row][col] === 0; // Unknown cell
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Make AI available globally
window.BattleshipAI = BattleshipAI;
