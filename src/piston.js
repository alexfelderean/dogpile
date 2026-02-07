import { player } from './player.js';
import { isChannelActive } from './pressureplate.js';

const pistons = [];

export function createPiston(gridRow, gridCol, channel) {
    const GRID_SIZE = 9, CELL_SIZE = 2;
    const piston = {
        gridRow, gridCol, channel, isExtended: false, wasExtended: false,
        worldX: (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldZ: (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        update() { this.wasExtended = this.isExtended; this.isExtended = isChannelActive(this.channel); },
        justExtended() { return this.isExtended && !this.wasExtended; },
        justRetracted() { return !this.isExtended && this.wasExtended; },
        getHeight() { return this.isExtended ? 2 : 0.5; }
    };
    pistons.push(piston);
    return piston;
}

export function clearPistons() { pistons.length = 0; }

export function updatePistons() {
    for (const piston of pistons) piston.update();
}

export function getPistons() { return pistons; }

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
        const pistonHeight = piston.getHeight();
        const pistonHalf = CELL_SIZE / 2;
        const px = player.position[0], py = player.position[1], pz = player.position[2];
        const minX = piston.worldX - pistonHalf - playerRadius;
        const maxX = piston.worldX + pistonHalf + playerRadius;
        const minZ = piston.worldZ - pistonHalf - playerRadius;
        const maxZ = piston.worldZ + pistonHalf + playerRadius;
        if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
            if (py >= pistonHeight - 0.3 && py <= pistonHeight + 0.5 && player.velocityY <= 0) {
                const strictMinX = piston.worldX - pistonHalf - playerRadius * 0.8;
                const strictMaxX = piston.worldX + pistonHalf + playerRadius * 0.8;
                const strictMinZ = piston.worldZ - pistonHalf - playerRadius * 0.8;
                const strictMaxZ = piston.worldZ + pistonHalf + playerRadius * 0.8;
                if (px > strictMinX && px < strictMaxX && pz > strictMinZ && pz < strictMaxZ) {
                    player.position[1] = pistonHeight;
                    player.velocityY = 0;
                    player.isJumping = false;
                    standingOnPiston = true;
                    continue;
                }
            }
            if (py < pistonHeight - 0.1) {
                const overlapLeft = maxX - px, overlapRight = px - minX;
                const overlapBack = maxZ - pz, overlapFront = pz - minZ;
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapBack, overlapFront);
                if (minOverlap === overlapLeft) player.position[0] = maxX;
                else if (minOverlap === overlapRight) player.position[0] = minX;
                else if (minOverlap === overlapBack) player.position[2] = maxZ;
                else if (minOverlap === overlapFront) player.position[2] = minZ;
            }
        }
    }
    return standingOnPiston;
}
