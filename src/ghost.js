// =============================================================================
// GHOST ABILITY SYSTEM
// =============================================================================
const MAX_GHOSTS = 8;
const GHOST_RADIUS = 0.35;

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
function handleGhostCollisions(timestamp) {
    if (timestamp - timeLoop.collisionStartTime < timeLoop.collisionDelayTime * 1000) {
        return;
    }

    for (const ghost of ghosts) {
        const frame = getGhostFrame(ghost);
        if (!frame) continue;

        const dx = player.position[0] - frame.x;
        const dz = player.position[2] - frame.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const minDist = GHOST_RADIUS + PLAYER_RADIUS;

        if (dist < minDist && dist > 0.001) {
            const overlap = minDist - dist;
            player.position[0] += (dx / dist) * overlap;
            player.position[2] += (dz / dist) * overlap;
        } else if (dist <= 0.001) {
            player.position[0] += minDist;
        }
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
    const indices = [];
    let vertexOffset = 0;

    function addQuad(p1, p2, p3, p4, color) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    const w = 0.15, h = 0.8, d = 0.15;
    const ghostColor = [0.4, 0.6, 0.9, 0.7];

    addQuad([-w, 0, d], [w, 0, d], [w, h * 2, d], [-w, h * 2, d], ghostColor);
    addQuad([w, 0, -d], [-w, 0, -d], [-w, h * 2, -d], [w, h * 2, -d], ghostColor);
    addQuad([-w, 0, -d], [-w, 0, d], [-w, h * 2, d], [-w, h * 2, -d], ghostColor);
    addQuad([w, 0, d], [w, 0, -d], [w, h * 2, -d], [w, h * 2, d], ghostColor);
    addQuad([-w, h * 2, d], [w, h * 2, d], [w, h * 2, -d], [-w, h * 2, -d], ghostColor);

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}

function createPlayerGeometry() {
    const positions = [];
    const colors = [];
    const indices = [];
    let vertexOffset = 0;

    function addQuad(p1, p2, p3, p4, color) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    const w = 0.15, h = 0.8, d = 0.15;
    const playerColor = [0.9, 0.9, 0.2, 1.0]; // Yellow/gold for player

    addQuad([-w, 0, d], [w, 0, d], [w, h * 2, d], [-w, h * 2, d], playerColor);
    addQuad([w, 0, -d], [-w, 0, -d], [-w, h * 2, -d], [w, h * 2, -d], playerColor);
    addQuad([-w, 0, -d], [-w, 0, d], [-w, h * 2, d], [-w, h * 2, -d], playerColor);
    addQuad([w, 0, d], [w, 0, -d], [w, h * 2, -d], [w, h * 2, d], playerColor);
    addQuad([-w, h * 2, d], [w, h * 2, d], [w, h * 2, -d], [-w, h * 2, -d], playerColor);

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}

function getGhosts() {
    return ghosts;
}

function getGhostModelMatrixForFrame(frame) {
    getGhostModelMatrix(_ghostModelMatrix, frame.x, 0, frame.z, frame.yaw);
    return _ghostModelMatrix;
}
