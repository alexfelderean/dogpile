// =============================================================================
// LEVEL LOADER
// =============================================================================

let currentLevel = null;

// Default level configuration (used if no level loaded)
const defaultLevel = {
    name: "Default",
    gridSize: 9,
    cellSize: 2,
    door: {
        wall: 'x+',
        width: 2.5,
        height: 3.5,
        color: [0.2, 0.8, 0.6, 1.0]
    },
    grid: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 2, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
};

// Load a level from JSON file
async function loadLevel(levelPath) {
    try {
        const response = await fetch(levelPath);
        if (!response.ok) {
            throw new Error(`Failed to load level: ${response.status}`);
        }
        currentLevel = await response.json();
        console.log(`Loaded level: ${currentLevel.name}`);
        return currentLevel;
    } catch (error) {
        console.error('Error loading level:', error);
        console.log('Using default level');
        currentLevel = defaultLevel;
        return currentLevel;
    }
}

// Get current level config
function getCurrentLevel() {
    return currentLevel || defaultLevel;
}

// Get level grid size
function getLevelGridSize() {
    const level = getCurrentLevel();
    return level.gridSize || 9;
}

// Get level cell size
function getLevelCellSize() {
    const level = getCurrentLevel();
    return level.cellSize || 2;
}

// Get level grid
function getLevelGrid() {
    const level = getCurrentLevel();
    return level.grid || defaultLevel.grid;
}

// Get door config
function getLevelDoorConfig() {
    const level = getCurrentLevel();
    return level.door || null;
}

// Get room half size (for collision bounds)
function getLevelRoomHalf() {
    return (getLevelGridSize() * getLevelCellSize()) / 2;
}

// Set level directly (for testing or editor)
function setLevel(levelData) {
    currentLevel = levelData;
}
