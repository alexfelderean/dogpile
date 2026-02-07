// =============================================================================
// PRESSURE PLATE SYSTEM
// =============================================================================

// Store all pressure plates in the level
const pressurePlates = [];

// Track active channels
const activeChannels = new Set();

// Pressure plate class
class PressurePlate {
    constructor(gridRow, gridCol, channel = 0) {
        this.gridRow = gridRow;
        this.gridCol = gridCol;
        this.channel = channel;
        this.isPressed = false;
        this.wasPressed = false;  // Track state change

        // Calculate world position from grid
        const GRID_SIZE = 9;
        const CELL_SIZE = 2;
        this.worldX = (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
        this.worldZ = (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
        this.radius = CELL_SIZE * 0.4;  // Detection radius
    }

    // Check if a position is on this plate
    isPositionOnPlate(x, z) {
        const dx = x - this.worldX;
        const dz = z - this.worldZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return dist < this.radius;
    }

    // Update pressure plate state based on player and ghosts
    update() {
        this.wasPressed = this.isPressed;
        this.isPressed = false;

        // Check player position
        if (this.isPositionOnPlate(player.position[0], player.position[2])) {
            this.isPressed = true;
        }

        // Check ghost positions
        const ghostList = getGhosts();
        for (const ghost of ghostList) {
            const frame = getGhostFrame(ghost);
            if (frame && this.isPositionOnPlate(frame.x, frame.z)) {
                this.isPressed = true;
                break;
            }
        }
    }

    // Check if plate was just activated this frame
    justPressed() {
        return this.isPressed && !this.wasPressed;
    }

    // Check if plate was just released this frame
    justReleased() {
        return !this.isPressed && this.wasPressed;
    }
}

// =============================================================================
// LEVEL STATE FLAGS
// =============================================================================
const levelFlags = {
    // Add flags here that can be triggered by pressure plates
    allPlatesPressed: false,
    plateCount: 0,
    pressedCount: 0
};

// =============================================================================
// PRESSURE PLATE MANAGEMENT
// =============================================================================

// Create a pressure plate and register it
function createPressurePlate(gridRow, gridCol, channel = 0) {
    const plate = new PressurePlate(gridRow, gridCol, channel);
    pressurePlates.push(plate);
    levelFlags.plateCount++;
    return plate;
}

// Clear all pressure plates (for level reset)
function clearPressurePlates() {
    pressurePlates.length = 0;
    activeChannels.clear();
    levelFlags.plateCount = 0;
    levelFlags.pressedCount = 0;
    levelFlags.allPlatesPressed = false;
}

// Update all pressure plates and level flags
function updatePressurePlates() {
    let pressedCount = 0;
    const previousChannels = new Set(activeChannels);
    activeChannels.clear();

    for (const plate of pressurePlates) {
        plate.update();
        if (plate.isPressed) {
            pressedCount++;
            activeChannels.add(plate.channel);
        }
    }

    // Debug logging for channel changes
    for (const ch of activeChannels) {
        if (!previousChannels.has(ch)) {
            console.log(`Channel ${ch} ACTIVATED`);
        }
    }
    for (const ch of previousChannels) {
        if (!activeChannels.has(ch)) {
            console.log(`Channel ${ch} DEACTIVATED`);
        }
    }

    levelFlags.pressedCount = pressedCount;
    levelFlags.allPlatesPressed = (pressedCount === pressurePlates.length && pressurePlates.length > 0);
}

// Get all pressure plates
function getPressurePlates() {
    return pressurePlates;
}

// Get level flags
function getLevelFlags() {
    return levelFlags;
}

// Check if a specific plate at grid position is pressed
function isPlatePressed(gridRow, gridCol) {
    for (const plate of pressurePlates) {
        if (plate.gridRow === gridRow && plate.gridCol === gridCol) {
            return plate.isPressed;
        }
    }
    return false;
}

// Check if a specific channel is active (at least one plate on channel is pressed)
function isChannelActive(channel) {
    return activeChannels.has(channel);
}

// Get all currently active channels
function getActiveChannels() {
    return Array.from(activeChannels);
}
