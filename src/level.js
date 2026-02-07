// =============================================================================
// LEVEL LOADER
// =============================================================================

let currentLevel = null;
let levelLoaded = false;

// Load a level from JSON file
async function loadLevel(levelPath) {
    try {
        const response = await fetch(levelPath);
        if (!response.ok) {
            throw new Error(`Failed to load level: ${response.status}`);
        }
        currentLevel = await response.json();
        levelLoaded = true;
        console.log(`Loaded level from ${levelPath}`);
        return currentLevel;
    } catch (error) {
        console.error('Error loading level:', error);
        throw error;  // Re-throw to prevent game from starting without level
    }
}

// Check if level is loaded
function isLevelLoaded() {
    return levelLoaded && currentLevel !== null;
}

// Get current level config
function getCurrentLevel() {
    if (!currentLevel) {
        throw new Error('No level loaded! Call loadLevel() first.');
    }
    return currentLevel;
}

// Get level grid size
function getLevelGridSize() {
    const level = getCurrentLevel();
    return level.gridSize;
}

// Get level cell size
function getLevelCellSize() {
    const level = getCurrentLevel();
    return level.cellSize;
}

// Get level grid
function getLevelGrid() {
    const level = getCurrentLevel();
    return level.grid;
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
    levelLoaded = true;
}
