import { player } from './player.js';
import { isChannelActive } from './pressureplate.js';

// =============================================================================
// PISTON MECHANISM SYSTEM
// =============================================================================

// Store all pistons in the level
const pistons = [];

// Piston class
class Piston {
    constructor(gridRow, gridCol, channel) {
        this.gridRow = gridRow;
        this.gridCol = gridCol;
        this.channel = channel;
        this.isExtended = false;
        this.wasExtended = false;

        // Calculate world position from grid
        const GRID_SIZE = 9;
        const CELL_SIZE = 2;
        this.worldX = (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
        this.worldZ = (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
    }

    // Update piston state based on channel activation
    update() {
        this.wasExtended = this.isExtended;
        this.isExtended = isChannelActive(this.channel);
    }

    // Check if piston just extended this frame
    justExtended() {
        return this.isExtended && !this.wasExtended;
    }

    // Check if piston just retracted this frame
    justRetracted() {
        return !this.isExtended && this.wasExtended;
    }

    // Get piston height (for collision and rendering)
    getHeight() {
        return this.isExtended ? 2 : 0.5;
    }
}

// =============================================================================
// PISTON MANAGEMENT
// =============================================================================

// Create a piston and register it
export function createPiston(gridRow, gridCol, channel) {
    const piston = new Piston(gridRow, gridCol, channel);
    pistons.push(piston);
    return piston;
}

// Clear all pistons (for level reset)
export function clearPistons() {
    pistons.length = 0;
}

// Update all pistons
export function updatePistons() {
    for (const piston of pistons) {
        piston.update();

        // Debug logging for piston state changes
        if (piston.justExtended()) {
            console.log(`Piston at (${piston.gridRow}, ${piston.gridCol}) EXTENDED - channel ${piston.channel}`);
        }
        if (piston.justRetracted()) {
            console.log(`Piston at (${piston.gridRow}, ${piston.gridCol}) RETRACTED - channel ${piston.channel}`);
        }
    }
}

// Get all pistons
export function getPistons() {
    return pistons;
}

// Get piston at grid position
export function getPistonAt(gridRow, gridCol) {
    for (const piston of pistons) {
        if (piston.gridRow === gridRow && piston.gridCol === gridCol) {
            return piston;
        }
    }
    return null;
}

// =============================================================================
// PISTON COLLISION
// =============================================================================
export function handlePistonCollisions() {
    const CELL_SIZE = 2;
    const playerRadius = 0.7;
    let standingOnPiston = false;

    for (const piston of pistons) {
        if (!piston.isExtended) continue;

        const pistonHeight = piston.getHeight();
        const pistonHalf = CELL_SIZE / 2;

        const playerX = player.position[0];
        const playerY = player.position[1];
        const playerZ = player.position[2];

        // AABB bounds
        const minX = piston.worldX - pistonHalf - playerRadius;
        const maxX = piston.worldX + pistonHalf + playerRadius;
        const minZ = piston.worldZ - pistonHalf - playerRadius;
        const maxZ = piston.worldZ + pistonHalf + playerRadius;

        const inHorizontalBounds = playerX > minX && playerX < maxX &&
            playerZ > minZ && playerZ < maxZ;

        if (inHorizontalBounds) {
            // Check for landing on top
            if (playerY >= pistonHeight - 0.3 && playerY <= pistonHeight + 0.5 && player.velocityY <= 0) {
                const strictMinX = piston.worldX - pistonHalf - playerRadius * 0.8;
                const strictMaxX = piston.worldX + pistonHalf + playerRadius * 0.8;
                const strictMinZ = piston.worldZ - pistonHalf - playerRadius * 0.8;
                const strictMaxZ = piston.worldZ + pistonHalf + playerRadius * 0.8;

                if (playerX > strictMinX && playerX < strictMaxX &&
                    playerZ > strictMinZ && playerZ < strictMaxZ) {
                    player.position[1] = pistonHeight;
                    player.velocityY = 0;
                    player.isJumping = false;
                    standingOnPiston = true;
                    continue;
                }
            }

            // Horizontal collision (only if player is below the top)
            if (playerY < pistonHeight - 0.1) {
                const overlapLeft = maxX - playerX;
                const overlapRight = playerX - minX;
                const overlapBack = maxZ - playerZ;
                const overlapFront = playerZ - minZ;

                const minOverlap = Math.min(overlapLeft, overlapRight, overlapBack, overlapFront);

                if (minOverlap === overlapLeft) {
                    player.position[0] = maxX;
                } else if (minOverlap === overlapRight) {
                    player.position[0] = minX;
                } else if (minOverlap === overlapBack) {
                    player.position[2] = maxZ;
                } else if (minOverlap === overlapFront) {
                    player.position[2] = minZ;
                }
            }
        }
    }

    return standingOnPiston;
}
