// Ghost ability system
const MAX_GHOSTS = 8;
const ghosts = [];
let currentRecording = [];

const timeLoop = {
    duration: 3,
    startTime: 0,
    isRunning: false,
    waitingForInput: false,
    recordInterval: 1000 / 60,
    lastRecordTime: 0,
    collisionDelayTime: 1.0,
    collisionStartTime: 0
};

const _ghostModelMatrix = new Float32Array(16);

function startTimeLoop(timestamp) {
    timeLoop.waitingForInput = false;
    timeLoop.startTime = timestamp;
    timeLoop.collisionStartTime = timestamp;
    timeLoop.lastRecordTime = 0;
}

function resetTimeLoop() {
    if (currentRecording.length > 0) {
        ghosts.push({ frames: currentRecording, currentFrame: 0 });
        if (ghosts.length > MAX_GHOSTS) ghosts.shift();
        updateGhostCountUI();
    }
    currentRecording = [];
    resetPlayer();
    for (const g of ghosts) {
        g.currentFrame = 0;
        g.interpolatedFrame = g.frames.length > 0 ? g.frames[0] : null;
    }
    timeLoop.waitingForInput = true;
    timeLoop.startTime = 0;
    timeLoop.lastRecordTime = 0;
}

function setTimeLoopRunning(running) {
    timeLoop.isRunning = running;
    timeLoop.waitingForInput = running;
    if (running) updateGhostCountUI();
}

function isWaitingForInput() { return timeLoop.waitingForInput; }
function isTimeLoopRunning() { return timeLoop.isRunning; }

function recordFrame(timestamp) {
    if (!timeLoop.isRunning) return;
    if (timestamp - timeLoop.lastRecordTime >= timeLoop.recordInterval) {
        const state = getPlayerState();
        state.time = (timestamp - timeLoop.startTime) / 1000;
        currentRecording.push(state);
        timeLoop.lastRecordTime = timestamp;
    }
}

function lerp(a, b, t) { return a * (1 - t) + b * t; }

function updateGhosts(elapsed) {
    for (const g of ghosts) {
        if (g.frames.length === 0) continue;
        let idx = g.currentFrame;
        if (idx >= g.frames.length - 1) idx = 0;
        while (idx < g.frames.length - 1 && g.frames[idx + 1].time <= elapsed) idx++;
        g.currentFrame = idx;
        const a = g.frames[idx], b = g.frames[idx + 1];
        if (b) {
            const range = b.time - a.time;
            const t = range > 0.0001 ? Math.max(0, Math.min(1, (elapsed - a.time) / range)) : 0;
            g.interpolatedFrame = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t), yaw: lerp(a.yaw, b.yaw, t), pitch: lerp(a.pitch, b.pitch, t), time: elapsed };
        } else {
            g.interpolatedFrame = a;
        }
    }
}

function getGhostFrame(g) { return g.interpolatedFrame || (g.frames.length > 0 ? g.frames[0] : null); }

const GHOST_SIZE = 1.4, PLAYER_SIZE = 1.4;

function handleGhostCollisions(timestamp) {
    if (timestamp - timeLoop.collisionStartTime < timeLoop.collisionDelayTime * 1000) return;
    let standingOnGhost = false;
    const gH = GHOST_SIZE / 2, pH = PLAYER_SIZE / 2;
    for (const g of ghosts) {
        const f = getGhostFrame(g);
        if (!f) continue;
        const px = player.position[0], py = player.position[1], pz = player.position[2];
        const gx = f.x, gy = f.y, gz = f.z;
        const pMinX = px - pH, pMaxX = px + pH, pMinZ = pz - pH, pMaxZ = pz + pH;
        const gMinX = gx - gH, gMaxX = gx + gH, gMinZ = gz - gH, gMaxZ = gz + gH, gTopY = gy + GHOST_SIZE;
        const overlapX = pMaxX > gMinX && pMinX < gMaxX, overlapZ = pMaxZ > gMinZ && pMinZ < gMaxZ;
        if (overlapX && overlapZ) {
            if (py >= gTopY - 0.3 && py <= gTopY + 0.5 && player.velocityY <= 0) {
                player.position[1] = gTopY; player.velocityY = 0; player.isJumping = false; standingOnGhost = true; continue;
            }
            if (py < gTopY - 0.1) {
                const ol = pMaxX - gMinX, or = gMaxX - pMinX, ob = pMaxZ - gMinZ, of = gMaxZ - pMinZ;
                const m = Math.min(ol, or, ob, of);
                if (m === ol) player.position[0] = gMinX - pH;
                else if (m === or) player.position[0] = gMaxX + pH;
                else if (m === ob) player.position[2] = gMinZ - pH;
                else if (m === of) player.position[2] = gMaxZ + pH;
            }
        }
    }
    if (!standingOnGhost && player.position[1] > 0 && !player.isJumping && player.velocityY === 0) player.isJumping = true;
    clampPlayerToRoom();
}

function updateTimerUI(elapsed) {
    const fill = document.getElementById('timer-fill');
    if (timeLoop.waitingForInput) { fill.style.width = '100%'; fill.classList.remove('warning'); fill.classList.add('waiting'); return; }
    fill.classList.remove('waiting');
    const r = Math.max(0, 1 - elapsed / timeLoop.duration);
    fill.style.width = (r * 100) + '%';
    r < 0.25 ? fill.classList.add('warning') : fill.classList.remove('warning');
}

function updateGhostCountUI() { document.getElementById('ghost-count').textContent = `Ghosts: ${ghosts.length}/${MAX_GHOSTS}`; }

function updateTimeLoop(timestamp) {
    if (!timeLoop.isRunning) return;
    if (timeLoop.waitingForInput) { updateTimerUI(0); }
    else {
        const elapsed = (timestamp - timeLoop.startTime) / 1000;
        updateTimerUI(elapsed);
        updateGhosts(elapsed);
        if (elapsed >= timeLoop.duration) resetTimeLoop();
    }
}

function getGhostModelMatrix(out, x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    out[0] = c; out[1] = 0; out[2] = s; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = -s; out[9] = 0; out[10] = c; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
}

function createCubeGeometry(color) {
    const pos = [], cols = [], norms = [], idx = [];
    let vo = 0;
    function addQuad(p1, p2, p3, p4, c, n) {
        pos.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) cols.push(...c);
        for (let i = 0; i < 4; i++) norms.push(...n);
        idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
        vo += 4;
    }
    const s = 1.4, h = s / 2;
    addQuad([-h, 0, h], [h, 0, h], [h, s, h], [-h, s, h], color, [0, 0, 1]);
    addQuad([h, 0, -h], [-h, 0, -h], [-h, s, -h], [h, s, -h], color, [0, 0, -1]);
    addQuad([-h, 0, -h], [-h, 0, h], [-h, s, h], [-h, s, -h], color, [-1, 0, 0]);
    addQuad([h, 0, h], [h, 0, -h], [h, s, -h], [h, s, h], color, [1, 0, 0]);
    addQuad([-h, s, h], [h, s, h], [h, s, -h], [-h, s, -h], color, [0, 1, 0]);
    addQuad([-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h], color, [0, -1, 0]);
    return { positions: new Float32Array(pos), colors: new Float32Array(cols), normals: new Float32Array(norms), indices: new Uint16Array(idx), indexCount: idx.length };
}

function createGhostGeometry() { return createCubeGeometry([0.4, 0.6, 0.9, 0.7]); }
function createPlayerGeometry() { return createCubeGeometry([0.9, 0.9, 0.2, 1.0]); }
function getGhosts() { return ghosts; }
function clearGhosts() { ghosts.length = 0; currentRecording = []; timeLoop.waitingForInput = true; timeLoop.startTime = 0; timeLoop.lastRecordTime = 0; updateGhostCountUI(); }
function getGhostModelMatrixForFrame(f) { getGhostModelMatrix(_ghostModelMatrix, f.x, f.y, f.z, f.yaw); return _ghostModelMatrix; }

window.startTimeLoop = startTimeLoop;
window.resetTimeLoop = resetTimeLoop;
window.setTimeLoopRunning = setTimeLoopRunning;
window.isWaitingForInput = isWaitingForInput;
window.isTimeLoopRunning = isTimeLoopRunning;
window.recordFrame = recordFrame;
window.updateGhosts = updateGhosts;
window.getGhostFrame = getGhostFrame;
window.handleGhostCollisions = handleGhostCollisions;
window.updateTimeLoop = updateTimeLoop;
window.getGhostModelMatrix = getGhostModelMatrix;
window.createGhostGeometry = createGhostGeometry;
window.createPlayerGeometry = createPlayerGeometry;
window.getGhosts = getGhosts;
window.clearGhosts = clearGhosts;
window.getGhostModelMatrixForFrame = getGhostModelMatrixForFrame;
