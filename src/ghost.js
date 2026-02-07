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

    // If player is in the air and not standing on any ghost, make sure they fall
    if (!standingOnGhost && player.position[1] > 0 && !player.isJumping && player.velocityY === 0) {
        player.isJumping = true;  // Re-enable gravity
    }

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
    const indices = [];
    let vertexOffset = 0;

    function addQuad(p1, p2, p3, p4, color, normal) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        for (let i = 0; i < 4; i++) normals.push(...normal);
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    // Cube dimensions matching pressure plates (1.4x1.4x1.4)
    const size = 1.4;
    const half = size / 2;
    const ghostColor = [0.4, 0.6, 0.9, 0.7];

    // Front (Z+)
    addQuad([-half, 0, half], [half, 0, half], [half, size, half], [-half, size, half], ghostColor, [0, 0, 1]);
    // Back (Z-)
    addQuad([half, 0, -half], [-half, 0, -half], [-half, size, -half], [half, size, -half], ghostColor, [0, 0, -1]);
    // Left (X-)
    addQuad([-half, 0, -half], [-half, 0, half], [-half, size, half], [-half, size, -half], ghostColor, [-1, 0, 0]);
    // Right (X+)
    addQuad([half, 0, half], [half, 0, -half], [half, size, -half], [half, size, half], ghostColor, [1, 0, 0]);
    // Top (Y+)
    addQuad([-half, size, half], [half, size, half], [half, size, -half], [-half, size, -half], ghostColor, [0, 1, 0]);
    // Bottom (Y-)
    addQuad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half], ghostColor, [0, -1, 0]);

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}

function createPlayerGeometry() {
    const positions = [];
    const colors = [];
    const normals = [];
    const indices = [];
    let vertexOffset = 0;

    function addQuad(p1, p2, p3, p4, color, normal) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        for (let i = 0; i < 4; i++) normals.push(...normal);
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    // Cube dimensions matching pressure plates (1.4x1.4x1.4)
    const size = 1.4;
    const half = size / 2;
    const playerColor = [0.9, 0.9, 0.2, 1.0]; // Yellow/gold for player

    // Front (Z+)
    addQuad([-half, 0, half], [half, 0, half], [half, size, half], [-half, size, half], playerColor, [0, 0, 1]);
    // Back (Z-)
    addQuad([half, 0, -half], [-half, 0, -half], [-half, size, -half], [half, size, -half], playerColor, [0, 0, -1]);
    // Left (X-)
    addQuad([-half, 0, -half], [-half, 0, half], [-half, size, half], [-half, size, -half], playerColor, [-1, 0, 0]);
    // Right (X+)
    addQuad([half, 0, half], [half, 0, -half], [half, size, -half], [half, size, half], playerColor, [1, 0, 0]);
    // Top (Y+)
    addQuad([-half, size, half], [half, size, half], [half, size, -half], [-half, size, -half], playerColor, [0, 1, 0]);
    // Bottom (Y-)
    addQuad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half], playerColor, [0, -1, 0]);

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        normals: new Float32Array(normals),
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
