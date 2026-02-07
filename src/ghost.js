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
        ghost.lastX = undefined; 
        ghost.lastZ = undefined;
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

// Simple hash for noise
function hash(x, y, z) {
    let n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return n - Math.floor(n);
}

// Scale factor: make dog visually larger than collision box
const DOG_SCALE = 1.3;

function addBoxToArrays(positions, colors, normals, texCoords, indices, vertexOffset, cx, cy, cz, sx, sy, sz, color, addNoise = true) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const faces = [
        { n: [0, 0, 1], verts: [[cx-hx, cy-hy, cz+hz], [cx+hx, cy-hy, cz+hz], [cx+hx, cy+hy, cz+hz], [cx-hx, cy+hy, cz+hz]] },
        { n: [0, 0, -1], verts: [[cx+hx, cy-hy, cz-hz], [cx-hx, cy-hy, cz-hz], [cx-hx, cy+hy, cz-hz], [cx+hx, cy+hy, cz-hz]] },
        { n: [-1, 0, 0], verts: [[cx-hx, cy-hy, cz-hz], [cx-hx, cy-hy, cz+hz], [cx-hx, cy+hy, cz+hz], [cx-hx, cy+hy, cz-hz]] },
        { n: [1, 0, 0], verts: [[cx+hx, cy-hy, cz+hz], [cx+hx, cy-hy, cz-hz], [cx+hx, cy+hy, cz-hz], [cx+hx, cy+hy, cz+hz]] },
        { n: [0, 1, 0], verts: [[cx-hx, cy+hy, cz+hz], [cx+hx, cy+hy, cz+hz], [cx+hx, cy+hy, cz-hz], [cx-hx, cy+hy, cz-hz]] },
        { n: [0, -1, 0], verts: [[cx-hx, cy-hy, cz-hz], [cx+hx, cy-hy, cz-hz], [cx+hx, cy-hy, cz+hz], [cx-hx, cy-hy, cz+hz]] }
    ];
    let offset = vertexOffset;
    for (const face of faces) {
        for (const v of face.verts) {
            positions.push(v[0], v[1], v[2]);
            normals.push(face.n[0], face.n[1], face.n[2]);
            let noise = addNoise ? (hash(v[0] * 10, v[1] * 10, v[2] * 10) - 0.5) * 0.3 : 0;
            colors.push(
                Math.max(0, Math.min(1, color[0] + noise)),
                Math.max(0, Math.min(1, color[1] + noise * 0.8)),
                Math.max(0, Math.min(1, color[2] + noise * 0.6)),
                color[3]
            );
            texCoords.push(0, 0);
        }
        indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        offset += 4;
    }
    return offset;
}

// Create a single leg geometry
function createLegGeometry(baseColor, offsetX, offsetZ) {
    const positions = [], colors = [], normals = [], texCoords = [], indices = [];
    const legWidth = 0.15 * DOG_SCALE;
    const legHeight = 0.5 * DOG_SCALE;
    // Leg is centered at origin, pivots from top
    addBoxToArrays(positions, colors, normals, texCoords, indices, 0,
        offsetX, -legHeight / 2, offsetZ, legWidth, legHeight, legWidth, baseColor);
    return {
        positions: new Float32Array(positions), colors: new Float32Array(colors),
        normals: new Float32Array(normals), texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices), indexCount: indices.length
    };
}

function createDogBodyGeometry(baseColor) {
    const positions = [], colors = [], normals = [], texCoords = [], indices = [];
    let vertexOffset = 0;
    
    function addBox(cx, cy, cz, sx, sy, sz, color, addNoise = true) {
        vertexOffset = addBoxToArrays(positions, colors, normals, texCoords, indices, vertexOffset,
            cx * DOG_SCALE, cy * DOG_SCALE, cz * DOG_SCALE, 
            sx * DOG_SCALE, sy * DOG_SCALE, sz * DOG_SCALE, color, addNoise);
    }
    
    // Dog dimensions
    const bodyHeight = 0.5;
    const bodyLength = 1.0;
    const bodyWidth = 0.5;
    const legHeight = 0.5;
    const headSize = 0.4;
    const earWidth = 0.1;
    const earHeight = 0.25;
    const earDepth = 0.08;
    const tailWidth = 0.1;
    const tailLength = 0.4;
    
    const groundY = 0;
    const bodyY = groundY + legHeight + bodyHeight / 2;
    
    // Body
    addBox(0, bodyY, 0, bodyWidth, bodyHeight, bodyLength, baseColor);
    
    // Head
    const headY = bodyY + bodyHeight / 2 - headSize / 4;
    const headZ = bodyLength / 2 + headSize / 2 - 0.05;
    addBox(0, headY, headZ, headSize, headSize, headSize, baseColor);
    
    // Snout
    const snoutWidth = 0.2;
    const snoutHeight = 0.15;
    const snoutDepth = 0.15;
    addBox(0, headY - 0.05, headZ + headSize / 2 + snoutDepth / 2 - 0.02, snoutWidth, snoutHeight, snoutDepth, baseColor);
    
    // Ears
    const earY = headY + headSize / 2 + earHeight / 2 - 0.05;
    const earOffsetX = headSize / 2 - earWidth / 2 - 0.02;
    addBox(-earOffsetX, earY, headZ, earWidth, earHeight, earDepth, baseColor);
    addBox(earOffsetX, earY, headZ, earWidth, earHeight, earDepth, baseColor);
    
    // Tail
    const tailY = bodyY + bodyHeight / 4;
    const tailZ = -bodyLength / 2 - tailLength / 2 + 0.1;
    addBox(0, tailY + 0.15, tailZ, tailWidth, tailWidth, tailLength, baseColor);
    
    // Eyes
    const eyeSize = 0.08;
    const eyeY = headY + 0.05;
    const eyeZ = headZ + headSize / 2 - 0.01;
    const eyeOffsetX = 0.1;
    const white = [1, 1, 1, 1];
    const black = [0.05, 0.05, 0.05, 1];
    
    addBox(-eyeOffsetX, eyeY, eyeZ, eyeSize, eyeSize, 0.02, white, false);
    addBox(eyeOffsetX, eyeY, eyeZ, eyeSize, eyeSize, 0.02, white, false);
    addBox(-eyeOffsetX, eyeY, eyeZ + 0.015, eyeSize * 0.5, eyeSize * 0.5, 0.02, black, false);
    addBox(eyeOffsetX, eyeY, eyeZ + 0.015, eyeSize * 0.5, eyeSize * 0.5, 0.02, black, false);
    
    // Nose
    const noseSize = 0.08;
    addBox(0, headY - 0.02, headZ + headSize / 2 + snoutDepth - 0.02, noseSize, noseSize * 0.7, noseSize * 0.5, black, false);
    
    return {
        positions: new Float32Array(positions), colors: new Float32Array(colors),
        normals: new Float32Array(normals), texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices), indexCount: indices.length
    };
}

// Leg positions (relative offsets for each leg)
const bodyWidth = 0.5, bodyLength = 1.0, legWidth = 0.15;
const legOffsetX = ((bodyWidth / 2) - (legWidth / 4)) * DOG_SCALE; // Center on edge
const legOffsetZ = (bodyLength / 2 - legWidth / 2 - 0.1) * DOG_SCALE;
const legPivotY = 0.5 * DOG_SCALE; // legHeight

export const LEG_POSITIONS = [
    { x: -legOffsetX, z: legOffsetZ, phase: 0 },      // Front-left
    { x: legOffsetX, z: legOffsetZ, phase: Math.PI },  // Front-right
    { x: -legOffsetX, z: -legOffsetZ, phase: Math.PI }, // Back-left
    { x: legOffsetX, z: -legOffsetZ, phase: 0 }        // Back-right
];
export const LEG_PIVOT_Y = legPivotY;
export const DOG_VISUAL_SCALE = DOG_SCALE;

// Ghost dog: bluish-gray color
export function createGhostGeometry() { return createDogBodyGeometry([0.5, 0.6, 0.75, 0.7]); }
export function createGhostLegGeometry() { return createLegGeometry([0.5, 0.6, 0.75, 0.7], 0, 0); }
// Player dog: golden/yellow color
export function createPlayerGeometry() { return createDogBodyGeometry([0.85, 0.65, 0.3, 1.0]); }
export function createPlayerLegGeometry() { return createLegGeometry([0.85, 0.65, 0.3, 1.0], 0, 0); }

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
