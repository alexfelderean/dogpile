import { player } from './player.js';
import { isChannelActive } from './pressureplate.js';
import { aabbCollision } from './math.js';

const pistons = [];

export function createPiston(gridRow, gridCol, channel) {
    const GRID_SIZE = 9, CELL_SIZE = 2;
    const piston = {
        gridRow, gridCol, channel, isExtended: false, wasExtended: false,
        worldX: (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldZ: (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        update() { this.wasExtended = this.isExtended; this.isExtended = isChannelActive(this.channel); },
        getHeight() { return this.isExtended ? 2 : 0.5; }
    };
    pistons.push(piston);
    return piston;
}

export function clearPistons() { pistons.length = 0; }

export function updatePistons() {
    for (const piston of pistons) piston.update();
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
            playerRadius, piston.worldX, piston.worldZ, CELL_SIZE / 2, piston.getHeight(), player
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
