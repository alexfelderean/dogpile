import { player } from './player.js';
import { getGhosts, getGhostFrame } from './ghost.js';
import { playClick } from './audio.js';

const pressurePlates = [];
const activeChannels = new Set();
const levelFlags = { allPlatesPressed: false, plateCount: 0, pressedCount: 0 };

export function createPressurePlate(gridRow, gridCol, channel = 0, height = 0) {
    const GRID_SIZE = 9, CELL_SIZE = 2;
    const plate = {
        gridRow, gridCol, channel, isPressed: false, wasPressed: false,
        worldX: (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldZ: (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldY: height * CELL_SIZE, // Height of the plate
        radius: CELL_SIZE * 0.55,
        isPositionOnPlate(x, y, z) {
            // Check if Y position is near the plate (within 0.5 units above it)
            if (y < this.worldY - 0.1 || y > this.worldY + 0.5) return false;
            const dx = x - this.worldX, dz = z - this.worldZ;
            return Math.sqrt(dx * dx + dz * dz) < this.radius;
        },
        update() {
            this.wasPressed = this.isPressed;
            this.isPressed = false;
            if (this.isPositionOnPlate(player.position[0], player.position[1], player.position[2])) this.isPressed = true;
            const ghostList = getGhosts();
            for (const ghost of ghostList) {
                const frame = getGhostFrame(ghost);
                if (frame && this.isPositionOnPlate(frame.x, frame.y, frame.z)) { this.isPressed = true; break; }
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

export function resetPressurePlates() {
    activeChannels.clear();
    for (const plate of pressurePlates) {
        plate.isPressed = false;
        plate.wasPressed = false;
    }
    levelFlags.pressedCount = 0;
    levelFlags.allPlatesPressed = false;
}

export function updatePressurePlates() {
    let pressedCount = 0;
    activeChannels.clear();
    for (const plate of pressurePlates) {
        plate.update();
        if (plate.justPressed()) {
            console.log('Plate pressed! Playing click...');
            playClick();
        }
        if (plate.isPressed) { pressedCount++; activeChannels.add(plate.channel); }
    }
    levelFlags.pressedCount = pressedCount;
    levelFlags.allPlatesPressed = (pressedCount === pressurePlates.length && pressurePlates.length > 0);
}

export function isPlatePressed(gridRow, gridCol) {
    for (const plate of pressurePlates)
        if (plate.gridRow === gridRow && plate.gridCol === gridCol) return plate.isPressed;
    return false;
}

export function isChannelActive(channel) { return activeChannels.has(channel); }
