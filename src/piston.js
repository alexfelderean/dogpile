import { player } from './player.js';
import { isChannelActive } from './pressureplate.js';
import { aabbCollision } from './math.js';
import { getLevelCellSize } from './room.js';

const pistons = [];
const PISTON_MIN_HEIGHT = 0.5;
const PISTON_MAX_HEIGHT = 2;
const PISTON_EXTEND_SPEED = 0.15; // Height units per frame

export function createPiston(gridRow, gridCol, channel, baseHeight = 0) {
    const GRID_SIZE = 9, CELL_SIZE = 2;
    const piston = {
        gridRow, gridCol, channel, isExtended: false, wasExtended: false,
        currentHeight: PISTON_MIN_HEIGHT,
        baseY: baseHeight * CELL_SIZE, // Store base Y position for elevated pistons
        worldX: (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldZ: (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        update() {
            this.wasExtended = this.isExtended;
            this.isExtended = isChannelActive(this.channel);
            // Animate height toward target
            const targetHeight = this.isExtended ? PISTON_MAX_HEIGHT : PISTON_MIN_HEIGHT;
            if (this.currentHeight < targetHeight) {
                this.currentHeight = Math.min(this.currentHeight + PISTON_EXTEND_SPEED, targetHeight);
            } else if (this.currentHeight > targetHeight) {
                this.currentHeight = Math.max(this.currentHeight - PISTON_EXTEND_SPEED, targetHeight);
            }
        },
        getHeight() { return this.currentHeight; }
    };
    pistons.push(piston);
    return piston;
}

export function clearPistons() { pistons.length = 0; }

export function resetPistons() {
    for (const piston of pistons) {
        piston.isExtended = false;
        piston.wasExtended = false;
        piston.currentHeight = PISTON_MIN_HEIGHT;
    }
}

export function updatePistons() {
    for (const piston of pistons) piston.update();
}

export function isPistonAnimating() {
    for (const piston of pistons) {
        const targetHeight = piston.isExtended ? PISTON_MAX_HEIGHT : PISTON_MIN_HEIGHT;
        if (Math.abs(piston.currentHeight - targetHeight) > 0.01) {
            console.log('Piston animating:', piston.currentHeight, 'target:', targetHeight);
            return true;
        }
    }
    return false;
}

export function getPistonAt(gridRow, gridCol) {
    for (const piston of pistons)
        if (piston.gridRow === gridRow && piston.gridCol === gridCol) return piston;
    return null;
}

export function handlePistonCollisions() {
    const CELL_SIZE = 2, playerRadius = 0.7;
    let standingOnPiston = false;
    for (const piston of pistons) {
        if (!piston.isExtended) continue;
        const result = aabbCollision(
            player.position[0], player.position[1], player.position[2],
            playerRadius, piston.worldX, piston.worldZ, CELL_SIZE / 2, piston.getHeight(), player, piston.baseY
        );
        if (result) {
            if (result.type === 'top') {
                player.position[1] = result.height;
                player.velocityY = 0;
                player.isJumping = false;
                standingOnPiston = true;
            } else if (result.type === 'side') {
                player.position[result.axis === 'x' ? 0 : 2] = result.value;
            }
        }
    }
    return standingOnPiston;
}
