// Piston mechanism system
const pistons = [];

function createPiston(gridRow, gridCol, channel) {
    const GRID_SIZE = 9, CELL_SIZE = 2;
    const piston = {
        gridRow, gridCol, channel, isExtended: false, wasExtended: false,
        worldX: (gridCol - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        worldZ: (gridRow - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        getHeight() { return this.isExtended ? 2 : 0.5; }
    };
    pistons.push(piston);
    return piston;
}

function clearPistons() { pistons.length = 0; }

function updatePistons() {
    for (const p of pistons) {
        p.wasExtended = p.isExtended;
        p.isExtended = isChannelActive(p.channel);
    }
}

function getPistons() { return pistons; }

function getPistonAt(row, col) {
    for (const p of pistons) if (p.gridRow === row && p.gridCol === col) return p;
    return null;
}

function handlePistonCollisions() {
    const CELL_SIZE = 2, playerRadius = 0.7;
    let standingOnPiston = false;
    for (const p of pistons) {
        if (!p.isExtended) continue;
        const h = p.getHeight(), half = CELL_SIZE / 2;
        const px = player.position[0], py = player.position[1], pz = player.position[2];
        const minX = p.worldX - half - playerRadius, maxX = p.worldX + half + playerRadius;
        const minZ = p.worldZ - half - playerRadius, maxZ = p.worldZ + half + playerRadius;
        if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
            if (py >= h - 0.3 && py <= h + 0.5 && player.velocityY <= 0) {
                const sMinX = p.worldX - half - playerRadius * 0.8, sMaxX = p.worldX + half + playerRadius * 0.8;
                const sMinZ = p.worldZ - half - playerRadius * 0.8, sMaxZ = p.worldZ + half + playerRadius * 0.8;
                if (px > sMinX && px < sMaxX && pz > sMinZ && pz < sMaxZ) {
                    player.position[1] = h; player.velocityY = 0; player.isJumping = false; standingOnPiston = true; continue;
                }
            }
            if (py < h - 0.1) {
                const ol = maxX - px, or = px - minX, ob = maxZ - pz, of = pz - minZ;
                const m = Math.min(ol, or, ob, of);
                if (m === ol) player.position[0] = maxX;
                else if (m === or) player.position[0] = minX;
                else if (m === ob) player.position[2] = maxZ;
                else if (m === of) player.position[2] = minZ;
            }
        }
    }
    return standingOnPiston;
}

window.createPiston = createPiston;
window.clearPistons = clearPistons;
window.updatePistons = updatePistons;
window.getPistons = getPistons;
window.getPistonAt = getPistonAt;
window.handlePistonCollisions = handlePistonCollisions;
