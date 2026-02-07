// =============================================================================
// GHOST ABILITY SYSTEM
// =============================================================================
const MAX_GHOSTS = 8;
const GHOST_RADIUS = 0.7;
const GHOST_PLAYER_RADIUS = 0.7;  // Player's collision radius for ghost collisions

// Ghost state
const ghosts = [];
let currentRecording = [];

// Time loop state
const timeLoop = {
    duration: 3,             // Loop duration in seconds
    startTime: 0,
    isRunning: false,
    waitingForInput: false,
    recordInterval: 1000 / 60,
    lastRecordTime: 0,
    collisionDelayTime: 1.0,
    collisionStartTime: 0
};

// Pre-allocated model matrix for ghost rendering
const _ghostModelMatrix = new Float32Array(16);

// --- Time Loop Control ---
function startTimeLoop(timestamp) {
    timeLoop.waitingForInput = false;
    timeLoop.startTime = timestamp;
    timeLoop.collisionStartTime = timestamp;
    timeLoop.lastRecordTime = 0;
}

function resetTimeLoop() {
    // Save current recording as a ghost
    if (currentRecording.length > 0) {
        ghosts.push({
            frames: currentRecording,
            currentFrame: 0
        });
        if (ghosts.length > MAX_GHOSTS) {
            ghosts.shift();
        }
        updateGhostCountUI();
    }

    currentRecording = [];
    resetPlayer();

    // Reset ghost playback
    for (const ghost of ghosts) {
        ghost.currentFrame = 0;
        // Reset interpolated position to first frame so ghost visually resets
        if (ghost.frames.length > 0) {
            ghost.interpolatedFrame = ghost.frames[0];
        } else {
            ghost.interpolatedFrame = null;
        }
    }

    timeLoop.waitingForInput = true;
    timeLoop.startTime = 0;
    timeLoop.lastRecordTime = 0;
}

function setTimeLoopRunning(running) {
    timeLoop.isRunning = running;
    if (running) {
        timeLoop.waitingForInput = true;
        updateGhostCountUI();
    } else {
        timeLoop.waitingForInput = false;
    }
}

function isWaitingForInput() {
    return timeLoop.waitingForInput;
}

function isTimeLoopRunning() {
    return timeLoop.isRunning;
}

// --- Recording ---
function recordFrame(timestamp) {
    if (!timeLoop.isRunning) return;

    if (timestamp - timeLoop.lastRecordTime >= timeLoop.recordInterval) {
        const state = getPlayerState();
        // Record precise time relative to loop start
        state.time = (timestamp - timeLoop.startTime) / 1000;
        currentRecording.push(state);
        timeLoop.lastRecordTime = timestamp;
    }
}

// --- Ghost Playback ---
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function updateGhosts(elapsedTime) {
    for (const ghost of ghosts) {
        if (ghost.frames.length === 0) continue;

        // Find the frame just before current time
        let idx = ghost.currentFrame;
        // Ensure index is valid and reset if needed
        if (idx >= ghost.frames.length - 1) idx = 0;

        // Search forward
        while (idx < ghost.frames.length - 1 && ghost.frames[idx + 1].time <= elapsedTime) {
            idx++;
        }
        ghost.currentFrame = idx;

        // Interpolate between current frame and next frame
        const frameA = ghost.frames[idx];
        const frameB = ghost.frames[idx + 1];

        if (frameB) {
            const range = frameB.time - frameA.time;
            const t = range > 0.0001 ? (elapsedTime - frameA.time) / range : 0;
            const ct = Math.max(0, Math.min(1, t));

            ghost.interpolatedFrame = {
                x: lerp(frameA.x, frameB.x, ct),
                y: lerp(frameA.y, frameB.y, ct),
                z: lerp(frameA.z, frameB.z, ct),
                yaw: lerp(frameA.yaw, frameB.yaw, ct),
                pitch: lerp(frameA.pitch, frameB.pitch, ct),
                time: elapsedTime
            };
        } else {
            ghost.interpolatedFrame = frameA;
        }
    }
}

function getGhostFrame(ghost) {
    return ghost.interpolatedFrame || (ghost.frames.length > 0 ? ghost.frames[0] : null);
}

// --- Ghost Collisions ---
const GHOST_SIZE = 1.4;   // Size of ghost cube
const PLAYER_SIZE = 1.4;  // Size of player cube

function handleGhostCollisions(timestamp) {
    if (timestamp - timeLoop.collisionStartTime < timeLoop.collisionDelayTime * 1000) {
        return;
    }

    let standingOnGhost = false;
    const ghostHalf = GHOST_SIZE / 2;
    const playerHalf = PLAYER_SIZE / 2;

    for (const ghost of ghosts) {
        const frame = getGhostFrame(ghost);
        if (!frame) continue;

        // Player position
        const px = player.position[0];
        const py = player.position[1];
        const pz = player.position[2];

        // Ghost position
        const gx = frame.x;
        const gy = frame.y;
        const gz = frame.z;

        // AABB collision bounds
        const playerMinX = px - playerHalf;
        const playerMaxX = px + playerHalf;
        const playerMinZ = pz - playerHalf;
        const playerMaxZ = pz + playerHalf;

        const ghostMinX = gx - ghostHalf;
        const ghostMaxX = gx + ghostHalf;
        const ghostMinZ = gz - ghostHalf;
        const ghostMaxZ = gz + ghostHalf;
        const ghostTopY = gy + GHOST_SIZE;

        // Check horizontal overlap
        const overlapX = playerMaxX > ghostMinX && playerMinX < ghostMaxX;
        const overlapZ = playerMaxZ > ghostMinZ && playerMinZ < ghostMaxZ;

        if (overlapX && overlapZ) {
            // Check for landing on top
            if (py >= ghostTopY - 0.3 && py <= ghostTopY + 0.5 && player.velocityY <= 0) {
                // Land on top of ghost
                player.position[1] = ghostTopY;
                player.velocityY = 0;
                player.isJumping = false;
                standingOnGhost = true;
                continue;  // Skip horizontal collision for this ghost
            }

            // Horizontal collision (only if player is below the top of the ghost)
            if (py < ghostTopY - 0.1) {
                // Calculate overlaps on each axis
                const overlapLeft = playerMaxX - ghostMinX;
                const overlapRight = ghostMaxX - playerMinX;
                const overlapBack = playerMaxZ - ghostMinZ;
                const overlapFront = ghostMaxZ - playerMinZ;

                // Find minimum overlap and push player out
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapBack, overlapFront);

                if (minOverlap === overlapLeft) {
                    player.position[0] = ghostMinX - playerHalf;
                } else if (minOverlap === overlapRight) {
                    player.position[0] = ghostMaxX + playerHalf;
                } else if (minOverlap === overlapBack) {
                    player.position[2] = ghostMinZ - playerHalf;
                } else if (minOverlap === overlapFront) {
                    player.position[2] = ghostMaxZ + playerHalf;
                }
            }
        }
    }

    // If player is in the air and not standing on any ghost, check if they are standing on terrain
    if (!standingOnGhost && player.position[1] > 0 && !player.isJumping && player.velocityY === 0) {
        // We need to check if we are standing on a tile (this function is in room.js)
        // Since we can't easily call room.js local function from here without exposing it,
        // we rely on the main loop calling handleLevelTileCollisions() AFTER this function.
        // However, handleLevelTileCollisions handles the falling logic if not on a tile.
        // So we just need to ensure we don't force a fall if we are on a tile.

        // Actually, handleLevelTileCollisions will set isJumping = true if not on a tile.
        // But if we set isJumping = true here, handleLevelTileCollisions might reset it if on a tile?
        // Let's look at order: updatePlayer -> handleGhostCollisions -> handleLevelTileCollisions

        // If we are here, we are NOT on a ghost.
        // If we leave isJumping false, frame recording might define we are floating.
        // But handleLevelTileCollisions will run next. 
        // If handleLevelTileCollisions sees we are NOT on a tile, it will set isJumping = true.
        // If it sees we ARE on a tile, it keeps isJumping = false (or sets it).

        // The issue is if handleGhostCollisions pushes us OFF a ghost, we want to fall.
        // But if we push off a ghost onto a raised platform, we shouldn't fall.

        // Let's just trust handleLevelTileCollisions to handle gravity enablement.
        // Removing the forced fall here allows room.js to decide.
        // But wait, if we were standing on a ghost, standingOnGhost is true.
        // If we slide off, standingOnGhost becomes false.
        // Then we enter this block. 
        // We SHOULD enable jumping (gravity) so we fall, UNLESS room.js says otherwise.

        // So:
        player.isJumping = true;
    }

    // However, if we simply set isJumping=true, and then handleLevelTileCollisions runs,
    // it will check if we are on a tile. If we are, it sets isJumping=false. 
    // This seems correct.

    clampPlayerToRoom();
}

// --- UI Updates ---
function updateTimerUI(elapsed) {
    const timerFill = document.getElementById('timer-fill');

    if (timeLoop.waitingForInput) {
        timerFill.style.width = '100%';
        timerFill.classList.remove('warning');
        timerFill.classList.add('waiting');
        return;
    }

    timerFill.classList.remove('waiting');
    const remaining = Math.max(0, 1 - elapsed / timeLoop.duration);
    timerFill.style.width = (remaining * 100) + '%';

    if (remaining < 0.25) {
        timerFill.classList.add('warning');
    } else {
        timerFill.classList.remove('warning');
    }
}

function updateGhostCountUI() {
    const ghostCountEl = document.getElementById('ghost-count');
    ghostCountEl.textContent = `Ghosts: ${ghosts.length}/${MAX_GHOSTS}`;
}

// --- Time Loop Update (call each frame) ---
function updateTimeLoop(timestamp) {
    if (!timeLoop.isRunning) return;

    if (timeLoop.waitingForInput) {
        updateTimerUI(0);
    } else {
        const elapsed = (timestamp - timeLoop.startTime) / 1000;
        updateTimerUI(elapsed);
        updateGhosts(elapsed);

        if (elapsed >= timeLoop.duration) {
            resetTimeLoop();
        }
    }
}

// --- Ghost Rendering ---
function getGhostModelMatrix(out, x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    out[0] = c; out[1] = 0; out[2] = s; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = -s; out[9] = 0; out[10] = c; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
}

function createGhostGeometry() {
    const positions = [];
    const colors = [];
    const normals = [];
    const texCoords = [];
    const indices = [];
    let vertexOffset = 0;

    // UV regions matching player geometry (30x90 = 3 stacked 30x30 regions)
    const uvTop = { v0: 0, v1: 1 / 3 };        // Cube top face
    const uvFront = { v0: 1 / 3, v1: 2 / 3 };    // Front face (Z+)
    const uvOther = { v0: 2 / 3, v1: 1 };      // All other faces

    function addQuad(p1, p2, p3, p4, color, normal, uvRegion, flipV = false) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        for (let i = 0; i < 4; i++) normals.push(...normal);
        // UV coords for standard quad - flipV swaps v0/v1 to correct upside-down textures
        if (flipV) {
            texCoords.push(0, uvRegion.v1, 1, uvRegion.v1, 1, uvRegion.v0, 0, uvRegion.v0);
        } else {
            texCoords.push(0, uvRegion.v0, 1, uvRegion.v0, 1, uvRegion.v1, 0, uvRegion.v1);
        }
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    // Cube dimensions matching pressure plates (1.4x1.4x1.4)
    const size = 1.4;
    const half = size / 2;
    const ghostColor = [0.4, 0.6, 0.9, 0.7]; // Fallback color (semi-transparent blue)

    // Front (Z+) - uses middle region (flipped to correct orientation)
    addQuad([-half, 0, half], [half, 0, half], [half, size, half], [-half, size, half], ghostColor, [0, 0, 1], uvFront, true);
    // Back (Z-) - uses bottom region
    addQuad([half, 0, -half], [-half, 0, -half], [-half, size, -half], [half, size, -half], ghostColor, [0, 0, -1], uvOther);
    // Left (X-) - uses bottom region
    addQuad([-half, 0, -half], [-half, 0, half], [-half, size, half], [-half, size, -half], ghostColor, [-1, 0, 0], uvOther);
    // Right (X+) - uses bottom region
    addQuad([half, 0, half], [half, 0, -half], [half, size, -half], [half, size, half], ghostColor, [1, 0, 0], uvOther);
    // Top (Y+) - uses top region (flipped to correct orientation)
    addQuad([-half, size, half], [half, size, half], [half, size, -half], [-half, size, -half], ghostColor, [0, 1, 0], uvTop, true);
    // Bottom (Y-) - uses bottom region
    addQuad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half], ghostColor, [0, -1, 0], uvOther);

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        normals: new Float32Array(normals),
        texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}

function createPlayerGeometry() {
    const positions = [];
    const colors = [];
    const normals = [];
    const texCoords = [];
    const indices = [];
    let vertexOffset = 0;

    // UV regions in scott.jpg (30x90 = 3 stacked 30x30 regions)
    // Top region (0-30): V = 0 to 0.333
    // Middle region (30-60): V = 0.333 to 0.667
    // Bottom region (60-90): V = 0.667 to 1.0
    const uvTop = { v0: 0, v1: 1 / 3 };        // Cube top face
    const uvFront = { v0: 1 / 3, v1: 2 / 3 };    // Front face (Z+)
    const uvOther = { v0: 2 / 3, v1: 1 };      // All other faces

    function addQuad(p1, p2, p3, p4, color, normal, uvRegion, flipV = false) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        for (let i = 0; i < 4; i++) normals.push(...normal);
        // UV coords for standard quad - flipV swaps v0/v1 to correct upside-down textures
        if (flipV) {
            texCoords.push(0, uvRegion.v1, 1, uvRegion.v1, 1, uvRegion.v0, 0, uvRegion.v0);
        } else {
            texCoords.push(0, uvRegion.v0, 1, uvRegion.v0, 1, uvRegion.v1, 0, uvRegion.v1);
        }
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    // Cube dimensions matching pressure plates (1.4x1.4x1.4)
    const size = 1.4;
    const half = size / 2;
    const playerColor = [0.9, 0.9, 0.2, 1.0]; // Yellow/gold for player (fallback)

    // Front (Z+) - uses middle region (flipped to correct orientation)
    addQuad([-half, 0, half], [half, 0, half], [half, size, half], [-half, size, half], playerColor, [0, 0, 1], uvFront, true);
    // Back (Z-) - uses bottom region
    addQuad([half, 0, -half], [-half, 0, -half], [-half, size, -half], [half, size, -half], playerColor, [0, 0, -1], uvOther);
    // Left (X-) - uses bottom region
    addQuad([-half, 0, -half], [-half, 0, half], [-half, size, half], [-half, size, -half], playerColor, [-1, 0, 0], uvOther);
    // Right (X+) - uses bottom region
    addQuad([half, 0, half], [half, 0, -half], [half, size, -half], [half, size, half], playerColor, [1, 0, 0], uvOther);
    // Top (Y+) - uses top region (flipped to correct orientation)
    addQuad([-half, size, half], [half, size, half], [half, size, -half], [-half, size, -half], playerColor, [0, 1, 0], uvTop, true);
    // Bottom (Y-) - uses bottom region
    addQuad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half], playerColor, [0, -1, 0], uvOther);

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        normals: new Float32Array(normals),
        texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}

function getGhosts() {
    return ghosts;
}

// Clear all ghosts and recording (for level transitions)
function clearGhosts() {
    ghosts.length = 0;
    currentRecording = [];
    timeLoop.waitingForInput = true;
    timeLoop.startTime = 0;
    timeLoop.lastRecordTime = 0;
    updateGhostCountUI();
}

function getGhostModelMatrixForFrame(frame) {
    getGhostModelMatrix(_ghostModelMatrix, frame.x, frame.y, frame.z, frame.yaw);
    return _ghostModelMatrix;
}
