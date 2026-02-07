// Pressure plate system
const pressurePlates = [];
const activeChannels = new Set();
const levelFlags = { allPlatesPressed: false, plateCount: 0, pressedCount: 0 };

function createPressurePlate(gridRow, gridCol, channel = 0) {
    const GRID_SIZE = 9, CELL_SIZE = 2;
    const plate = {
        gridRow, gridCol, channel, isPressed: false, wasPressed: false,
        worldX: (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldZ: (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        radius: CELL_SIZE * 0.4,
        isPositionOnPlate(x, z) { return Math.sqrt((x - this.worldX) ** 2 + (z - this.worldZ) ** 2) < this.radius; }
    };
    pressurePlates.push(plate);
    levelFlags.plateCount++;
    return plate;
}

function clearPressurePlates() {
    pressurePlates.length = 0;
    activeChannels.clear();
    levelFlags.plateCount = 0;
    levelFlags.pressedCount = 0;
    levelFlags.allPlatesPressed = false;
}

function updatePressurePlates() {
    let pressedCount = 0;
    activeChannels.clear();
    for (const p of pressurePlates) {
        p.wasPressed = p.isPressed;
        p.isPressed = p.isPositionOnPlate(player.position[0], player.position[2]);
        if (!p.isPressed) {
            for (const g of getGhosts()) {
                const f = getGhostFrame(g);
                if (f && p.isPositionOnPlate(f.x, f.z)) { p.isPressed = true; break; }
            }
        }
        if (p.isPressed) { pressedCount++; activeChannels.add(p.channel); }
    }
    levelFlags.pressedCount = pressedCount;
    levelFlags.allPlatesPressed = pressedCount === pressurePlates.length && pressurePlates.length > 0;
}

function getPressurePlates() { return pressurePlates; }
function getLevelFlags() { return levelFlags; }
function isPlatePressed(row, col) { for (const p of pressurePlates) if (p.gridRow === row && p.gridCol === col) return p.isPressed; return false; }
function isChannelActive(channel) { return activeChannels.has(channel); }
function getActiveChannels() { return Array.from(activeChannels); }

window.createPressurePlate = createPressurePlate;
window.clearPressurePlates = clearPressurePlates;
window.updatePressurePlates = updatePressurePlates;
window.getPressurePlates = getPressurePlates;
window.getLevelFlags = getLevelFlags;
window.isPlatePressed = isPlatePressed;
window.isChannelActive = isChannelActive;
window.getActiveChannels = getActiveChannels;
