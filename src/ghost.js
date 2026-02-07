import { player, resetPlayer, getPlayerState, clampPlayerToRoom } from './player.js';

const MAX_GHOSTS = 8;
const ghosts = [];
let currentRecording = [];
const timeLoop = {
    duration: 10, startTime: 0, isRunning: false, waitingForInput: false,
    recordInterval: 1000 / 60, lastRecordTime: 0, collisionDelayTime: 1.0, collisionStartTime: 0
};
const _ghostModelMatrix = new Float32Array(16);

export function startTimeLoop(timestamp) {
    timeLoop.waitingForInput = false;
    timeLoop.startTime = timestamp;
    timeLoop.collisionStartTime = timestamp;
    timeLoop.lastRecordTime = 0;
}

export function resetTimeLoop() {
    if (currentRecording.length > 0) {
        ghosts.push({ frames: currentRecording, currentFrame: 0 });
        if (ghosts.length > MAX_GHOSTS) ghosts.shift();
        updateGhostCountUI();
    }
    currentRecording = [];
    resetPlayer();
    for (const ghost of ghosts) {
        ghost.currentFrame = 0;
        ghost.interpolatedFrame = ghost.frames.length > 0 ? ghost.frames[0] : null;
    }
    timeLoop.waitingForInput = true;
    timeLoop.startTime = 0;
    timeLoop.lastRecordTime = 0;
}

export function setTimeLoopRunning(running) {
    timeLoop.isRunning = running;
    if (running) { timeLoop.waitingForInput = true; updateGhostCountUI(); }
    else timeLoop.waitingForInput = false;
}

export function isWaitingForInput() { return timeLoop.waitingForInput; }
export function isTimeLoopRunning() { return timeLoop.isRunning; }

export function recordFrame(timestamp) {
    if (!timeLoop.isRunning) return;
    if (timestamp - timeLoop.lastRecordTime >= timeLoop.recordInterval) {
        const state = getPlayerState();
        state.time = (timestamp - timeLoop.startTime) / 1000;
        currentRecording.push(state);
        timeLoop.lastRecordTime = timestamp;
    }
}

function lerp(start, end, t) { return start * (1 - t) + end * t; }

function updateGhosts(elapsedTime) {
    for (const ghost of ghosts) {
        if (ghost.frames.length === 0) continue;
        let idx = ghost.currentFrame;
        if (idx >= ghost.frames.length - 1) idx = 0;
        while (idx < ghost.frames.length - 1 && ghost.frames[idx + 1].time <= elapsedTime) idx++;
        ghost.currentFrame = idx;
        const frameA = ghost.frames[idx];
        const frameB = ghost.frames[idx + 1];
        if (frameB) {
            const range = frameB.time - frameA.time;
            const t = range > 0.0001 ? (elapsedTime - frameA.time) / range : 0;
            const ct = Math.max(0, Math.min(1, t));
            ghost.interpolatedFrame = {
                x: lerp(frameA.x, frameB.x, ct), y: lerp(frameA.y, frameB.y, ct),
                z: lerp(frameA.z, frameB.z, ct), yaw: lerp(frameA.yaw, frameB.yaw, ct),
                pitch: lerp(frameA.pitch, frameB.pitch, ct), time: elapsedTime
            };
        } else ghost.interpolatedFrame = frameA;
    }
}

export function getGhostFrame(ghost) {
    return ghost.interpolatedFrame || (ghost.frames.length > 0 ? ghost.frames[0] : null);
}

const GHOST_SIZE = 1.4;
const PLAYER_SIZE = 1.4;

export function isPlayerOnGhost() {
    const ghostHalf = GHOST_SIZE / 2;
    const playerHalf = PLAYER_SIZE / 2;
    for (const ghost of ghosts) {
        const frame = getGhostFrame(ghost);
        if (!frame) continue;
        const px = player.position[0], py = player.position[1], pz = player.position[2];
        const gx = frame.x, gy = frame.y, gz = frame.z;
        const playerMinX = px - playerHalf, playerMaxX = px + playerHalf;
        const playerMinZ = pz - playerHalf, playerMaxZ = pz + playerHalf;
        const ghostMinX = gx - ghostHalf, ghostMaxX = gx + ghostHalf;
        const ghostMinZ = gz - ghostHalf, ghostMaxZ = gz + ghostHalf;
        const ghostTopY = gy + GHOST_SIZE;
        const overlapX = playerMaxX > ghostMinX && playerMinX < ghostMaxX;
        const overlapZ = playerMaxZ > ghostMinZ && playerMinZ < ghostMaxZ;
        if (overlapX && overlapZ && py >= ghostTopY - 0.3 && py <= ghostTopY + 0.5) {
            return true;
        }
    }
    return false;
}

export function handleGhostCollisions(timestamp) {
    if (timestamp - timeLoop.collisionStartTime < timeLoop.collisionDelayTime * 1000) return;
    let standingOnGhost = false;
    const ghostHalf = GHOST_SIZE / 2;
    const playerHalf = PLAYER_SIZE / 2;
    for (const ghost of ghosts) {
        const frame = getGhostFrame(ghost);
        if (!frame) continue;
        const px = player.position[0], py = player.position[1], pz = player.position[2];
        const gx = frame.x, gy = frame.y, gz = frame.z;
        const playerMinX = px - playerHalf, playerMaxX = px + playerHalf;
        const playerMinZ = pz - playerHalf, playerMaxZ = pz + playerHalf;
        const ghostMinX = gx - ghostHalf, ghostMaxX = gx + ghostHalf;
        const ghostMinZ = gz - ghostHalf, ghostMaxZ = gz + ghostHalf;
        const ghostTopY = gy + GHOST_SIZE;
        const overlapX = playerMaxX > ghostMinX && playerMinX < ghostMaxX;
        const overlapZ = playerMaxZ > ghostMinZ && playerMinZ < ghostMaxZ;
        if (overlapX && overlapZ) {
            if (py >= ghostTopY - 0.3 && py <= ghostTopY + 0.5 && player.velocityY <= 0) {
                player.position[1] = ghostTopY;
                player.velocityY = 0;
                player.isJumping = false;
                standingOnGhost = true;
                continue;
            }
            if (py < ghostTopY - 0.1) {
                const overlapLeft = playerMaxX - ghostMinX;
                const overlapRight = ghostMaxX - playerMinX;
                const overlapBack = playerMaxZ - ghostMinZ;
                const overlapFront = ghostMaxZ - playerMinZ;
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapBack, overlapFront);
                if (minOverlap === overlapLeft) player.position[0] = ghostMinX - playerHalf;
                else if (minOverlap === overlapRight) player.position[0] = ghostMaxX + playerHalf;
                else if (minOverlap === overlapBack) player.position[2] = ghostMinZ - playerHalf;
                else if (minOverlap === overlapFront) player.position[2] = ghostMaxZ + playerHalf;
            }
        }
    }
    if (!standingOnGhost && player.position[1] > 0 && !player.isJumping && player.velocityY === 0) {
        player.isJumping = true;
    }
    clampPlayerToRoom();
}

function updateTimerUI(elapsed) {
    const timerFill = document.getElementById('tf');
    if (timeLoop.waitingForInput) {
        timerFill.style.width = '100%';
        timerFill.classList.remove('w');
        timerFill.classList.add('wt');
        return;
    }
    timerFill.classList.remove('wt');
    const remaining = Math.max(0, 1 - elapsed / timeLoop.duration);
    timerFill.style.width = (remaining * 100) + '%';
    if (remaining < 0.25) timerFill.classList.add('w');
    else timerFill.classList.remove('w');
}

function updateGhostCountUI() {
    document.getElementById('gc').textContent = `Ghosts: ${ghosts.length}/${MAX_GHOSTS}`;
}

export function updateTimeLoop(timestamp) {
    if (!timeLoop.isRunning) return;
    if (timeLoop.waitingForInput) updateTimerUI(0);
    else {
        const elapsed = (timestamp - timeLoop.startTime) / 1000;
        updateTimerUI(elapsed);
        updateGhosts(elapsed);
        if (elapsed >= timeLoop.duration) resetTimeLoop();
    }
}

export function getGhostModelMatrix(out, x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    out[0] = c; out[1] = 0; out[2] = s; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = -s; out[9] = 0; out[10] = c; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
}

function createCubeGeometry(cubeColor) {
    const positions = [], colors = [], normals = [], texCoords = [], indices = [];
    let vertexOffset = 0;
    const uvTop = { v0: 0, v1: 1 / 3 };
    const uvFront = { v0: 1 / 3, v1: 2 / 3 };
    const uvOther = { v0: 2 / 3, v1: 1 };
    function addQuad(p1, p2, p3, p4, color, normal, uvRegion, flipV = false) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        for (let i = 0; i < 4; i++) normals.push(...normal);
        if (flipV) texCoords.push(0, uvRegion.v1, 1, uvRegion.v1, 1, uvRegion.v0, 0, uvRegion.v0);
        else texCoords.push(0, uvRegion.v0, 1, uvRegion.v0, 1, uvRegion.v1, 0, uvRegion.v1);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
        vertexOffset += 4;
    }
    const size = 1.4, half = size / 2;
    addQuad([-half, 0, half], [half, 0, half], [half, size, half], [-half, size, half], cubeColor, [0, 0, 1], uvFront, true);
    addQuad([half, 0, -half], [-half, 0, -half], [-half, size, -half], [half, size, -half], cubeColor, [0, 0, -1], uvOther);
    addQuad([-half, 0, -half], [-half, 0, half], [-half, size, half], [-half, size, -half], cubeColor, [-1, 0, 0], uvOther);
    addQuad([half, 0, half], [half, 0, -half], [half, size, -half], [half, size, half], cubeColor, [1, 0, 0], uvOther);
    addQuad([-half, size, half], [half, size, half], [half, size, -half], [-half, size, -half], cubeColor, [0, 1, 0], uvTop, true);
    addQuad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half], cubeColor, [0, -1, 0], uvOther);
    return {
        positions: new Float32Array(positions), colors: new Float32Array(colors),
        normals: new Float32Array(normals), texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices), indexCount: indices.length
    };
}

export function createGhostGeometry() { return createCubeGeometry([0.4, 0.6, 0.9, 0.7]); }
export function createPlayerGeometry() { return createCubeGeometry([0.9, 0.9, 0.2, 1.0]); }

export function createShadowGeometry() {
    const half = 0.7; // Match cube half-size (1.4 / 2)
    const y = 0.02;
    const shadowColor = [0.0, 0.0, 0.0, 0.4];
    const positions = new Float32Array([
        -half, y, -half,  half, y, -half,  half, y, half,  -half, y, half
    ]);
    const colors = new Float32Array([
        ...shadowColor, ...shadowColor, ...shadowColor, ...shadowColor
    ]);
    const normals = new Float32Array([
        0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0
    ]);
    const texCoords = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    return { positions, colors, normals, texCoords, indices, indexCount: 6 };
}
export function getGhosts() { return ghosts; }

export function clearGhosts() {
    ghosts.length = 0;
    currentRecording = [];
    timeLoop.waitingForInput = true;
    timeLoop.startTime = 0;
    timeLoop.lastRecordTime = 0;
    updateGhostCountUI();
}

export function getGhostModelMatrixForFrame(frame) {
    getGhostModelMatrix(_ghostModelMatrix, frame.x, frame.y, frame.z, frame.yaw);
    return _ghostModelMatrix;
}

export function getGhostOpacity(timestamp) {
    const MIN_OPACITY = 0.3;
    if (timeLoop.waitingForInput) return MIN_OPACITY;
    const elapsed = timestamp - timeLoop.collisionStartTime;
    const delayMs = timeLoop.collisionDelayTime * 1000;
    const t = Math.min(1, elapsed / delayMs);
    return MIN_OPACITY + (1 - MIN_OPACITY) * t;
}
