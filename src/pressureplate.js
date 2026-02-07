import { player } from './player.js';
import { getGhosts, getGhostFrame } from './ghost.js';

const pressurePlates = [];
const activeChannels = new Set();
const levelFlags = { allPlatesPressed: false, plateCount: 0, pressedCount: 0 };

export function createPressurePlate(gridRow, gridCol, channel = 0) {
    const GRID_SIZE = 9, CELL_SIZE = 2;
    const plate = {
        gridRow, gridCol, channel, isPressed: false, wasPressed: false,
        worldX: (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldZ: (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        radius: CELL_SIZE * 0.4,
        isPositionOnPlate(x, z) {
            const dx = x - this.worldX, dz = z - this.worldZ;
            return Math.sqrt(dx * dx + dz * dz) < this.radius;
        },
        update() {
            this.wasPressed = this.isPressed;
            this.isPressed = false;
            if (this.isPositionOnPlate(player.position[0], player.position[2])) this.isPressed = true;
            const ghostList = getGhosts();
            for (const ghost of ghostList) {
                const frame = getGhostFrame(ghost);
                if (frame && this.isPositionOnPlate(frame.x, frame.z)) { this.isPressed = true; break; }
            }
        },
        justPressed() { return this.isPressed && !this.wasPressed; },
        justReleased() { return !this.isPressed && this.wasPressed; }
    };
    pressurePlates.push(plate);
    levelFlags.plateCount++;
    return plate;
}

export function clearPressurePlates() {
    pressurePlates.length = 0;
    activeChannels.clear();
    levelFlags.plateCount = 0;
    levelFlags.pressedCount = 0;
    levelFlags.allPlatesPressed = false;
}

export function updatePressurePlates() {
    let pressedCount = 0;
    activeChannels.clear();
    for (const plate of pressurePlates) {
        plate.update();
        if (plate.isPressed) { pressedCount++; activeChannels.add(plate.channel); }
    }
    levelFlags.pressedCount = pressedCount;
    levelFlags.allPlatesPressed = (pressedCount === pressurePlates.length && pressurePlates.length > 0);
}

export function getPressurePlates() { return pressurePlates; }
export function getLevelFlags() { return levelFlags; }

export function isPlatePressed(gridRow, gridCol) {
    for (const plate of pressurePlates)
        if (plate.gridRow === gridRow && plate.gridCol === gridCol) return plate.isPressed;
    return false;
}

export function isChannelActive(channel) { return activeChannels.has(channel); }
export function getActiveChannels() { return Array.from(activeChannels); }
