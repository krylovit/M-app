// Game state and configuration
const GAME_CONFIG = {
    GRID_SIZE: 10,
    SHIPS: [
        { name: 'carrier', size: 5, count: 1 },
        { name: 'battleship', size: 4, count: 1 },
        { name: 'cruiser', size: 3, count: 1 },
        { name: 'submarine', size: 3, count: 1 },
        { name: 'destroyer', size: 2, count: 1 }
    ]
};

class BattleshipGame {
    constructor() {
        this.playerBoard = this.createEmptyBoard();
        this.computerBoard = this.createEmptyBoard();
        this.playerShips = [];
        this.computerShips = [];
        this.currentShip = null;
        this.shipOrientation = 'horizontal';
        this.gamePhase = 'setup'; // setup, playing, ended
        this.currentPlayer = 'player';
        this.shipsToPlace = [...GAME_CONFIG.SHIPS];
        this.playerShipsRemaining = 5;
        this.computerShipsRemaining = 5;
        
        this.initializeGame();
    }

    createEmptyBoard() {
        return Array(GAME_CONFIG.GRID_SIZE).fill(null).map(() => 
            Array(GAME_CONFIG.GRID_SIZE).fill(0)
        );
    }

    initializeGame() {
        console.log('Initializing game...');
        this.setupEventListeners();
        this.renderSetupGrid();
        this.selectFirstShip();
        
        // Initialize AI and place computer ships
        if (window.BattleshipAI) {
            console.log('AI found, placing computer ships...');
            this.ai = new BattleshipAI();
            this.computerShips = this.ai.placeShipsRandomly();
            this.updateComputerBoard();
        } else {
            console.log('AI not found!');
        }
    }

    setupEventListeners() {
        // Ship selection
        document.querySelectorAll('.ship-item').forEach(item => {
            item.addEventListener('click', (e) => this.selectShip(e));
            // Touch support
            item.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.selectShip(e);
            });
        });

        // Control buttons
        const rotateBtn = document.getElementById('rotate-btn');
        const randomBtn = document.getElementById('random-btn');
        const startBtn = document.getElementById('start-btn');
        const restartBtn = document.getElementById('restart-btn');

        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => this.rotateShip());
            rotateBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.rotateShip();
            });
        }
        
        if (randomBtn) {
            randomBtn.addEventListener('click', () => this.randomPlacement());
            randomBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.randomPlacement();
            });
        }
        
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
            startBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.startGame();
            });
        }
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
            restartBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.restartGame();
            });
        }

        // Mobile orientation change handler
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        // Prevent zoom on double tap
        document.addEventListener('touchend', (e) => {
            const now = new Date().getTime();
            const timeSince = now - this.lastTouchEnd;
            if (timeSince < 300 && timeSince > 0) {
                e.preventDefault();
            }
            this.lastTouchEnd = now;
        }, false);

        this.lastTouchEnd = 0;
    }

    selectShip(event) {
        console.log('Selecting ship...');
        const shipItem = event.currentTarget;
        if (shipItem.classList.contains('placed')) return;

        document.querySelectorAll('.ship-item').forEach(item => 
            item.classList.remove('active')
        );
        shipItem.classList.add('active');

        const shipType = shipItem.dataset.ship;
        const shipSize = parseInt(shipItem.dataset.size);
        this.currentShip = { type: shipType, size: shipSize };
        console.log('Selected ship:', this.currentShip);
    }

    selectFirstShip() {
        const firstShip = document.querySelector('.ship-item');
        if (firstShip) {
            firstShip.click();
        }
    }

    rotateShip() {
        this.shipOrientation = this.shipOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        this.updateTurnIndicator(`Ship orientation: ${this.shipOrientation}`);
    }

    renderSetupGrid() {
        console.log('Rendering setup grid...');
        const grid = document.getElementById('setup-grid');
        if (!grid) {
            console.error('Setup grid element not found!');
            return;
        }
        
        grid.innerHTML = '';

        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Mouse events
                cell.addEventListener('mouseenter', (e) => this.previewShipPlacement(e));
                cell.addEventListener('mouseleave', () => this.clearPreview());
                cell.addEventListener('click', (e) => this.placeShip(e));

                // Touch events for mobile
                cell.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.previewShipPlacement(e);
                });
                
                cell.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.placeShip(e);
                    this.clearPreview();
                });

                grid.appendChild(cell);
            }
        }
        console.log('Setup grid rendered with', grid.children.length, 'cells');
    }

    previewShipPlacement(event) {
        if (!this.currentShip) return;

        this.clearPreview();
        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);

        const positions = this.getShipPositions(row, col, this.currentShip.size, this.shipOrientation);
        const isValid = this.isValidPlacement(positions);

        positions.forEach(pos => {
            const cell = document.querySelector(`#setup-grid .cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
            if (cell) {
                cell.classList.add(isValid ? 'preview' : 'invalid-preview');
            }
        });
    }

    clearPreview() {
        document.querySelectorAll('#setup-grid .cell').forEach(cell => {
            cell.classList.remove('preview', 'invalid-preview');
        });
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

    isValidPlacement(positions) {
        return positions.every(pos => {
            // Check bounds
            if (pos.row < 0 || pos.row >= GAME_CONFIG.GRID_SIZE || 
                pos.col < 0 || pos.col >= GAME_CONFIG.GRID_SIZE) {
                return false;
            }
            
            // Check if cell is already occupied
            if (this.playerBoard[pos.row][pos.col] !== 0) {
                return false;
            }

            // Check adjacent cells for other ships
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = pos.row + dr;
                    const newCol = pos.col + dc;
                    if (newRow >= 0 && newRow < GAME_CONFIG.GRID_SIZE && 
                        newCol >= 0 && newCol < GAME_CONFIG.GRID_SIZE) {
                        if (this.playerBoard[newRow][newCol] !== 0) {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
    }

    placeShip(event) {
        if (!this.currentShip) return;

        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        const positions = this.getShipPositions(row, col, this.currentShip.size, this.shipOrientation);

        if (!this.isValidPlacement(positions)) return;

        // Place ship on board
        const shipId = this.playerShips.length + 1;
        positions.forEach(pos => {
            this.playerBoard[pos.row][pos.col] = shipId;
        });

        // Add ship to ships array
        this.playerShips.push({
            id: shipId,
            type: this.currentShip.type,
            positions: positions,
            hits: 0,
            sunk: false
        });

        // Update visual grid with ship parts
        this.updateShipVisuals(positions, this.currentShip.type, this.shipOrientation, '#setup-grid');

        // Mark ship as placed
        const shipItem = document.querySelector(`.ship-item[data-ship="${this.currentShip.type}"]`);
        if (shipItem) {
            shipItem.classList.add('placed');
            shipItem.classList.remove('active');
        }

        // Remove ship from ships to place
        this.shipsToPlace = this.shipsToPlace.filter(ship => ship.name !== this.currentShip.type);

        // Select next ship or enable start button
        if (this.shipsToPlace.length > 0) {
            const nextShipItem = document.querySelector(`.ship-item:not(.placed)`);
            if (nextShipItem) {
                nextShipItem.click();
            }
        } else {
            this.currentShip = null;
            document.getElementById('start-btn').disabled = false;
            this.updateTurnIndicator('All ships placed! Ready to start battle.');
        }

        this.clearPreview();
    }

    randomPlacement() {
        // Clear current ships
        this.playerBoard = this.createEmptyBoard();
        this.playerShips = [];
        this.shipsToPlace = [...GAME_CONFIG.SHIPS];

        // Reset ship items
        document.querySelectorAll('.ship-item').forEach(item => {
            item.classList.remove('placed', 'active');
        });

        // Place ships randomly
        GAME_CONFIG.SHIPS.forEach(shipConfig => {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 100) {
                const row = Math.floor(Math.random() * GAME_CONFIG.GRID_SIZE);
                const col = Math.floor(Math.random() * GAME_CONFIG.GRID_SIZE);
                const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                
                const positions = this.getShipPositions(row, col, shipConfig.size, orientation);
                
                if (this.isValidPlacement(positions)) {
                    const shipId = this.playerShips.length + 1;
                    positions.forEach(pos => {
                        this.playerBoard[pos.row][pos.col] = shipId;
                    });

                    this.playerShips.push({
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

        // Update visual grid with ship parts
        this.renderSetupGrid();
        this.playerShips.forEach(ship => {
            const orientation = this.getShipOrientation(ship.positions);
            this.updateShipVisuals(ship.positions, ship.type, orientation, '#setup-grid');
        });

        // Mark all ships as placed
        document.querySelectorAll('.ship-item').forEach(item => {
            item.classList.add('placed');
        });

        this.shipsToPlace = [];
        this.currentShip = null;
        document.getElementById('start-btn').disabled = false;
        this.updateTurnIndicator('Random placement complete! Ready to start battle.');
    }

    updateComputerBoard() {
        // Update computer board with ship positions (hidden from player)
        this.computerShips.forEach(ship => {
            ship.positions.forEach(pos => {
                this.computerBoard[pos.row][pos.col] = ship.id;
            });
        });
    }

    startGame() {
        this.gamePhase = 'playing';
        document.getElementById('setup-phase').style.display = 'none';
        document.getElementById('game-phase').style.display = 'block';
        
        this.renderGameGrids();
        this.updateTurnIndicator('Your turn - Click on enemy waters to attack!');
    }

    renderGameGrids() {
        this.renderPlayerGrid();
        this.renderComputerGrid();
    }

    renderPlayerGrid() {
        const grid = document.getElementById('player-grid');
        grid.innerHTML = '';

        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                if (this.playerBoard[row][col] > 0) {
                    const ship = this.playerShips.find(s => s.id === this.playerBoard[row][col]);
                    if (ship) {
                        cell.classList.add('ship', ship.type);
                        this.addShipPartClass(cell, ship, row, col);
                        
                        // Add hit/sunk states if applicable
                        if (ship.sunk) {
                            cell.classList.add('sunk');
                        } else if (this.isPositionHit(ship, row, col)) {
                            cell.classList.add('hit');
                        }
                    }
                }

                grid.appendChild(cell);
            }
        }
    }

    renderComputerGrid() {
        const grid = document.getElementById('computer-grid');
        grid.innerHTML = '';

        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Mouse events
                cell.addEventListener('click', (e) => this.playerAttack(e));
                
                // Touch events for mobile
                cell.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.playerAttack(e);
                });

                grid.appendChild(cell);
            }
        }
    }

    playerAttack(event) {
        if (this.currentPlayer !== 'player' || this.gamePhase !== 'playing') return;

        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        const cell = event.target;

        // Check if already attacked
        if (cell.classList.contains('hit') || cell.classList.contains('miss')) return;

        const isHit = this.computerBoard[row][col] > 0;
        
        if (isHit) {
            cell.classList.add('hit');
            const shipId = this.computerBoard[row][col];
            const ship = this.computerShips.find(s => s.id === shipId);
            
            if (ship) {
                // Don't reveal ship design - just mark as hit
                // Only add generic ship class for basic hit styling
                cell.classList.add('ship');
                
                ship.hits++;
                if (ship.hits === ship.positions.length) {
                    ship.sunk = true;
                    this.computerShipsRemaining--;
                    this.markShipAsSunk(ship, 'computer');
                    this.updateShipsCount();
                    
                    if (this.computerShipsRemaining === 0) {
                        this.endGame('player');
                        return;
                    }
                }
            }
            
            this.updateTurnIndicator('Hit! Take another shot!');
        } else {
            cell.classList.add('miss');
            this.currentPlayer = 'computer';
            this.updateTurnIndicator('Miss! Enemy turn...');
            
            setTimeout(() => {
                this.computerAttack();
            }, 1000);
        }
    }

    computerAttack() {
        if (this.currentPlayer !== 'computer' || this.gamePhase !== 'playing') return;

        const attack = this.ai.getNextAttack();
        const { row, col } = attack;
        
        const cell = document.querySelector(`#player-grid .cell[data-row="${row}"][data-col="${col}"]`);
        const isHit = this.playerBoard[row][col] > 0;

        if (isHit) {
            cell.classList.add('hit');
            const shipId = this.playerBoard[row][col];
            const ship = this.playerShips.find(s => s.id === shipId);
            
            if (ship) {
                // The ship part classes should already be there from renderPlayerGrid
                ship.hits++;
                this.ai.recordHit(row, col);
                
                if (ship.hits === ship.positions.length) {
                    ship.sunk = true;
                    this.playerShipsRemaining--;
                    this.markShipAsSunk(ship, 'player');
                    this.ai.recordSink(ship.positions);
                    this.updateShipsCount();
                    
                    if (this.playerShipsRemaining === 0) {
                        this.endGame('computer');
                        return;
                    }
                }
            }
            
            this.updateTurnIndicator('Enemy hit! They attack again...');
            setTimeout(() => {
                this.computerAttack();
            }, 1000);
        } else {
            cell.classList.add('miss');
            this.ai.recordMiss(row, col);
            this.currentPlayer = 'player';
            this.updateTurnIndicator('Enemy missed! Your turn!');
        }
    }

    markShipAsSunk(ship, board) {
        const gridId = board === 'player' ? 'player-grid' : 'computer-grid';
        ship.positions.forEach(pos => {
            const cell = document.querySelector(`#${gridId} .cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
            if (cell) {
                cell.classList.add('sunk');
                
                // Only reveal ship design when sunk (for computer ships)
                if (board === 'computer') {
                    cell.classList.add(ship.type);
                    this.addShipPartClass(cell, ship, pos.row, pos.col);
                }
            }
        });
    }

    updateShipsCount() {
        document.getElementById('player-ships-count').textContent = this.playerShipsRemaining;
        document.getElementById('computer-ships-count').textContent = this.computerShipsRemaining;
    }

    updateTurnIndicator(text) {
        document.getElementById('turn-text').textContent = text;
    }

    endGame(winner) {
        this.gamePhase = 'ended';
        const gameOverDiv = document.getElementById('game-over');
        const resultElement = document.getElementById('game-result');
        const messageElement = document.getElementById('game-message');

        if (winner === 'player') {
            resultElement.textContent = '🎉 VICTORY! 🎉';
            messageElement.textContent = 'Congratulations! You have defeated the enemy fleet!';
        } else {
            resultElement.textContent = '💥 DEFEAT 💥';
            messageElement.textContent = 'Your fleet has been destroyed. Better luck next time!';
        }

        gameOverDiv.style.display = 'flex';
    }

    restartGame() {
        // Reset all game state
        this.playerBoard = this.createEmptyBoard();
        this.computerBoard = this.createEmptyBoard();
        this.playerShips = [];
        this.computerShips = [];
        this.currentShip = null;
        this.shipOrientation = 'horizontal';
        this.gamePhase = 'setup';
        this.currentPlayer = 'player';
        this.shipsToPlace = [...GAME_CONFIG.SHIPS];
        this.playerShipsRemaining = 5;
        this.computerShipsRemaining = 5;

        // Reset UI
        document.getElementById('game-over').style.display = 'none';
        document.getElementById('setup-phase').style.display = 'flex';
        document.getElementById('game-phase').style.display = 'none';
        document.getElementById('start-btn').disabled = true;

        // Reset ship selection
        document.querySelectorAll('.ship-item').forEach(item => {
            item.classList.remove('placed', 'active');
        });

        this.updateShipsCount();
        this.updateTurnIndicator('Place your ships');
        
        // Reinitialize
        this.renderSetupGrid();
        this.selectFirstShip();
        
        // Reinitialize AI
        if (window.BattleshipAI) {
            this.ai = new BattleshipAI();
            this.computerShips = this.ai.placeShipsRandomly();
            this.updateComputerBoard();
        }
    }

    updateShipVisuals(positions, shipType, orientation, gridSelector) {
        positions.forEach((pos, index) => {
            const cell = document.querySelector(`${gridSelector} .cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
            if (cell) {
                cell.classList.add('ship', shipType);
                
                // Add ship part classes
                if (index === 0) {
                    cell.classList.add('bow', orientation);
                } else if (index === positions.length - 1) {
                    cell.classList.add('stern', orientation);
                } else {
                    cell.classList.add('hull', orientation);
                }
                
                // Add connection classes for merged appearance
                if (index > 0) {
                    if (orientation === 'horizontal') {
                        cell.classList.add('connected-left');
                    } else {
                        cell.classList.add('connected-top');
                    }
                }
                if (index < positions.length - 1) {
                    if (orientation === 'horizontal') {
                        cell.classList.add('connected-right');
                    } else {
                        cell.classList.add('connected-bottom');
                    }
                }
            }
        });
    }

    getShipOrientation(positions) {
        if (positions.length < 2) return 'horizontal';
        return positions[0].row === positions[1].row ? 'horizontal' : 'vertical';
    }

    addShipPartClass(cell, ship, row, col) {
        const shipOrientation = this.getShipOrientation(ship.positions);
        const positionIndex = ship.positions.findIndex(pos => pos.row === row && pos.col === col);
        
        if (positionIndex === 0) {
            cell.classList.add('bow', shipOrientation);
        } else if (positionIndex === ship.positions.length - 1) {
            cell.classList.add('stern', shipOrientation);
        } else {
            cell.classList.add('hull', shipOrientation);
        }
        
        // Add connection classes
        if (positionIndex > 0) {
            if (shipOrientation === 'horizontal') {
                cell.classList.add('connected-left');
            } else {
                cell.classList.add('connected-top');
            }
        }
        if (positionIndex < ship.positions.length - 1) {
            if (shipOrientation === 'horizontal') {
                cell.classList.add('connected-right');
            } else {
                cell.classList.add('connected-bottom');
            }
        }
    }

    isPositionHit(ship, row, col) {
        // This would need to be implemented based on your hit tracking system
        // For now, return false as hits are handled differently in the current implementation
        return false;
    }

    handleOrientationChange() {
        // Force a repaint to handle orientation changes
        const grids = document.querySelectorAll('.grid');
        grids.forEach(grid => {
            grid.style.display = 'none';
            grid.offsetHeight; // Trigger reflow
            grid.style.display = 'grid';
        });
    }

    // Mobile-specific helper methods
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating game...');
    window.game = new BattleshipGame();
    console.log('Game created:', window.game);
});
