// Room & Level System
const OBJECT_COLORS = { 1: [0.9, 0.2, 0.2, 1.0], 2: [0.6, 0.5, 0.2, 1.0], 3: [0.2, 0.9, 0.5, 1.0], 4: [0.5, 0.5, 0.6, 1.0] };
const DOOR_COLOR_LOCKED = [0.8, 0.2, 0.2, 1.0], DOOR_COLOR_UNLOCKED = [0.2, 0.8, 0.6, 1.0];

let currentLevel = null, levelNumber = 1;
let GRID_SIZE = 9, CELL_SIZE = 2, ROOM_HEIGHT = 18;
let levelGrid = [], levelHeight = [], levelEntities = [];
let doorConfig = null, doorChannel = 0, doorLocked = true;

async function loadLevel(levelPath) {
    const response = await fetch(levelPath);
    if (!response.ok) throw new Error(`Failed to load level: ${response.status}`);
    const view = new Uint8Array(await response.arrayBuffer());

    levelGrid = []; levelHeight = []; levelEntities = [];
    for (let i = 0; i < 9; i++) { levelGrid[i] = new Array(9).fill(0); levelHeight[i] = new Array(9).fill(0); levelEntities[i] = new Array(9).fill(0); }
    GRID_SIZE = 9; CELL_SIZE = 2; ROOM_HEIGHT = GRID_SIZE * CELL_SIZE;

    for (let i = 0; i < 81; i++) { const row = Math.floor(i / 9), col = i % 9; levelHeight[row][col] = view[i] || 0; }

    let spawnIndex = 40, doorWall = 'z-', doorRow = 0, doorCol = 0;
    if (typeof clearPistons === 'function') clearPistons();

    for (let i = 0; i < 81; i++) {
        const eb = view[81 + i] || 0, row = Math.floor(i / 9), col = i % 9;
        levelEntities[row][col] = eb;
        if (eb === 0) levelGrid[row][col] = 0;
        else if (eb >= 1 && eb <= 15) { spawnIndex = i; levelGrid[row][col] = 0; }
        else if (eb >= 16 && eb <= 31) levelGrid[row][col] = 2;
        else if (eb >= 128) {
            const mechType = (eb >> 4) & 0x07, channel = eb & 0x0F;
            if (mechType === 0) { doorWall = col > 4 ? 'x+' : 'z-'; doorRow = row; doorCol = col; doorChannel = channel; levelGrid[row][col] = 0; }
            else if (mechType === 1) { createPiston(row, col, channel); levelGrid[row][col] = 4; }
        } else if (eb === 32) levelGrid[row][col] = 1;
    }

    const spawnRow = Math.floor(spawnIndex / 9), spawnCol = spawnIndex % 9;
    const roomHalf = (GRID_SIZE * CELL_SIZE) / 2;
    const spawnX = (spawnCol * CELL_SIZE) - roomHalf + (CELL_SIZE / 2);
    const spawnZ = (spawnRow * CELL_SIZE) - roomHalf + (CELL_SIZE / 2);
    const spawnY = levelHeight[spawnRow][spawnCol] * CELL_SIZE;

    doorConfig = { row: doorRow, col: doorCol, wall: doorWall, width: 2.5, height: 3.5, color: DOOR_COLOR_LOCKED };
    doorLocked = true;
    setPlayerSpawn(spawnX, spawnY, spawnZ);
    resetPlayer();
    currentLevel = { grid: levelGrid, door: doorConfig, height: levelHeight, entities: levelEntities };
    return currentLevel;
}

function getCurrentLevel() { return currentLevel; }
function getLevelGridSize() { return GRID_SIZE; }
function getLevelCellSize() { return CELL_SIZE; }
function getLevelGrid() { return levelGrid; }
function getLevelDoorConfig() { return doorConfig; }
function getLevelRoomHalf() { return (GRID_SIZE * CELL_SIZE) / 2; }

function gridToWorldCollision(row, col) { return [(col - GRID_SIZE / 2 + 0.5) * CELL_SIZE, (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE]; }

function checkDoorCollision(px, pz) {
    if (!doorConfig.wall || doorLocked) return false;
    const roomHalf = getLevelRoomHalf(), dw = doorConfig.width / 2, maxPos = 8.7 - 0.7;
    const doorBaseY = (levelHeight[doorConfig.row] && levelHeight[doorConfig.row][doorConfig.col]) ? levelHeight[doorConfig.row][doorConfig.col] * CELL_SIZE : 0;
    if (Math.abs(player.position[1] - doorBaseY) > 2.0) return false;
    if (doorConfig.wall === 'z-') {
        const [doorX] = gridToWorldCollision(doorConfig.row, doorConfig.col);
        return pz <= -maxPos && px > doorX - dw && px < doorX + dw;
    } else if (doorConfig.wall === 'x+') {
        const [_, doorZ] = gridToWorldCollision(doorConfig.row, doorConfig.col);
        return px >= maxPos && pz > doorZ - dw && pz < doorZ + dw;
    }
    return false;
}

let isTransitioning = false;

function updateDoorCollision() {
    if (isTransitioning) return false;
    if (checkDoorCollision(player.position[0], player.position[2])) {
        isTransitioning = true;
        const loadNext = () => {
            levelNumber++;
            loadLevel("levels/l" + levelNumber + ".bin").then(() => {
                clearGhosts();
                if (window.rebuildRoomGeometry) window.rebuildRoomGeometry();
                resetPlayer();
                isTransitioning = false;
            }).catch(() => { isTransitioning = false; });
        };
        window.transitionLevelOut ? window.transitionLevelOut(loadNext) : loadNext();
    }
    return false;
}

function updateDoorLockState() {
    const active = isChannelActive(doorChannel);
    if (active && doorLocked) { doorLocked = false; if (doorConfig) doorConfig.color = DOOR_COLOR_UNLOCKED; if (window.refreshRoomBuffers) window.refreshRoomBuffers(); }
    else if (!active && !doorLocked) { doorLocked = true; if (doorConfig) doorConfig.color = DOOR_COLOR_LOCKED; if (window.refreshRoomBuffers) window.refreshRoomBuffers(); }
}

function isDoorLocked() { return doorLocked; }
function getCurrentDoorColor() { return doorLocked ? DOOR_COLOR_LOCKED : DOOR_COLOR_UNLOCKED; }

function handleLevelTileCollisions() {
    if (!levelGrid) return;
    const cubeSize = CELL_SIZE, cubeHeight = CELL_SIZE, playerRadius = 0.7;
    let standingOnTile = false;
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objType = levelGrid[row] ? levelGrid[row][col] : 0;
            const h = levelHeight[row] ? levelHeight[row][col] : 0;
            if (objType === 0 && h === 0) continue;
            if (objType < 3 && h === 0) continue;
            const [tileX, tileZ] = gridToWorldCollision(row, col);
            const tileHalf = cubeSize / 2;
            let collisionH = h * CELL_SIZE;
            if (objType === 3) collisionH += cubeHeight;
            else if (objType === 4) collisionH += 0.5;
            const px = player.position[0], py = player.position[1], pz = player.position[2];
            const minX = tileX - tileHalf - playerRadius, maxX = tileX + tileHalf + playerRadius;
            const minZ = tileZ - tileHalf - playerRadius, maxZ = tileZ + tileHalf + playerRadius;
            if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
                if (py >= collisionH - 0.3 && py <= collisionH + 0.5 && player.velocityY <= 0) {
                    const sMinX = tileX - tileHalf - playerRadius * 0.8, sMaxX = tileX + tileHalf + playerRadius * 0.8;
                    const sMinZ = tileZ - tileHalf - playerRadius * 0.8, sMaxZ = tileZ + tileHalf + playerRadius * 0.8;
                    if (px > sMinX && px < sMaxX && pz > sMinZ && pz < sMaxZ) {
                        player.position[1] = collisionH; player.velocityY = 0; player.isJumping = false; standingOnTile = true; continue;
                    }
                }
                if (py < collisionH - 0.1) {
                    const ol = maxX - px, or = px - minX, ob = maxZ - pz, of = pz - minZ;
                    const m = Math.min(ol, or, ob, of);
                    if (m === ol) player.position[0] = maxX;
                    else if (m === or) player.position[0] = minX;
                    else if (m === ob) player.position[2] = maxZ;
                    else if (m === of) player.position[2] = minZ;
                }
            }
        }
    }
    if (!standingOnTile && player.position[1] > 0 && player.position[1] <= cubeHeight + 0.1 && !player.isJumping && player.velocityY === 0 && player.position[1] > 0.1) {
        player.isJumping = true;
    }
    return standingOnTile;
}

function createRoomGeometry() {
    const roomHalf = getLevelRoomHalf();
    const pos = [], cols = [], norms = [], idx = [];
    let vo = 0;

    function calcNormal(p1, p2, p3) {
        const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
        const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) { nx /= len; ny /= len; nz /= len; }
        return [nx, ny, nz];
    }

    function addQuad(p1, p2, p3, p4, c) {
        pos.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) cols.push(...c);
        const n = calcNormal(p1, p2, p3);
        for (let i = 0; i < 4; i++) norms.push(...n);
        idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
        vo += 4;
    }

    function addBox(x, y, z, w, h, d, c) {
        const x1 = x, x2 = x + w, y1 = y, y2 = y + h, z1 = z, z2 = z + d;
        addQuad([x1, y2, z2], [x2, y2, z2], [x2, y2, z1], [x1, y2, z1], c);
        addQuad([x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2], c);
        addQuad([x2, y1, z2], [x2, y2, z2], [x1, y2, z2], [x1, y1, z2], c);
        addQuad([x1, y1, z1], [x1, y2, z1], [x2, y2, z1], [x2, y1, z1], c);
        addQuad([x2, y1, z1], [x2, y2, z1], [x2, y2, z2], [x2, y1, z2], c);
        addQuad([x1, y1, z2], [x1, y2, z2], [x1, y2, z1], [x1, y1, z1], c);
    }

    function gridToWorld(row, col) { return [(col - GRID_SIZE / 2 + 0.5) * CELL_SIZE, (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE]; }

    // Floor
    addQuad([-roomHalf, 0, -roomHalf], [roomHalf, 0, -roomHalf], [roomHalf, 0, roomHalf], [-roomHalf, 0, roomHalf], [0.5, 0.5, 0.54, 1.0]);
    // Walls
    const wc = [0.55, 0.57, 0.62, 1.0];
    addQuad([-roomHalf, 0, -roomHalf], [-roomHalf, ROOM_HEIGHT, -roomHalf], [roomHalf, ROOM_HEIGHT, -roomHalf], [roomHalf, 0, -roomHalf], wc);
    addQuad([roomHalf, 0, -roomHalf], [roomHalf, ROOM_HEIGHT, -roomHalf], [roomHalf, ROOM_HEIGHT, roomHalf], [roomHalf, 0, roomHalf], wc);

    // Door
    if (doorConfig && doorConfig.wall) {
        const dw = doorConfig.width / 2, dh = doorConfig.height, off = 0.02, dc = doorConfig.color || [0.2, 0.8, 0.6, 1.0];
        const doorBaseY = (levelHeight[doorConfig.row] && levelHeight[doorConfig.row][doorConfig.col]) ? levelHeight[doorConfig.row][doorConfig.col] * CELL_SIZE : 0;
        const [doorX, doorZ] = gridToWorld(doorConfig.row, doorConfig.col);
        if (doorConfig.wall === 'z-') { const z = -roomHalf + off; addQuad([doorX - dw, doorBaseY, z], [doorX - dw, doorBaseY + dh, z], [doorX + dw, doorBaseY + dh, z], [doorX + dw, doorBaseY, z], dc); }
        else if (doorConfig.wall === 'x+') { const x = roomHalf - off; addQuad([x, doorBaseY, doorZ - dw], [x, doorBaseY + dh, doorZ - dw], [x, doorBaseY + dh, doorZ + dw], [x, doorBaseY, doorZ + dw], dc); }
    }

    clearPressurePlates();
    const cs = CELL_SIZE, ch = CELL_SIZE;

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objType = levelGrid[row] ? levelGrid[row][col] : 0;
            const eb = levelEntities[row] ? levelEntities[row][col] : 0;
            const h = levelHeight[row] ? levelHeight[row][col] : 0;
            if (objType === 0 && h === 0) continue;
            const [wx, wz] = gridToWorld(row, col);
            const floorY = h * CELL_SIZE;
            const c = OBJECT_COLORS[objType] || [0.5, 0.5, 0.5, 1.0];
            if (h > 0) addBox(wx - cs / 2, 0, wz - cs / 2, cs, floorY, cs, [0.45, 0.47, 0.52, 1.0]);
            if (objType === 2) { createPressurePlate(row, col, eb & 0x0F); addBox(wx - cs * 0.35, floorY + 0.01, wz - cs * 0.35, cs * 0.7, 0.08, cs * 0.7, c); }
            else if (objType === 4) {
                const p = getPistonAt(row, col), ext = p ? p.isExtended : false;
                const bc = [0.6, 0.6, 0.7, 1.0], hc = ext ? [0.7, 0.7, 0.8, 1.0] : bc;
                if (ext) { addBox(wx - cs / 2, floorY, wz - cs / 2, cs, 0.5, cs, bc); addBox(wx - cs * 0.3, floorY + 0.5, wz - cs * 0.3, cs * 0.6, 1.0, cs * 0.6, [0.4, 0.4, 0.5, 1.0]); addBox(wx - cs / 2, floorY + 1.5, wz - cs / 2, cs, 0.5, cs, hc); }
                else addBox(wx - cs / 2, floorY, wz - cs / 2, cs, 0.5, cs, bc);
            } else if (objType === 3) addBox(wx - cs / 2, floorY, wz - cs / 2, cs, ch, cs, c);
        }
    }
    return { positions: new Float32Array(pos), colors: new Float32Array(cols), normals: new Float32Array(norms), indices: new Uint16Array(idx), indexCount: idx.length };
}

function createArrowGeometry() {
    const pos = [], cols = [], norms = [], idx = [];
    let vo = 0;
    const s = 1.5 * CELL_SIZE, fh = 2.0, hl = s * 0.4, hw = s * 0.5, tw = s * 0.15, tl = s * 0.5;
    const tipY = fh - s / 2, hbY = tipY + hl, ttY = hbY + tl;
    const c45 = 0.7071, s45 = 0.7071;
    const rot = (dx, dz) => [dx * c45 - dz * s45, dx * s45 + dz * c45];
    const [hx1, hz1] = rot(-hw / 2, 0), [hx2, hz2] = rot(hw / 2, 0);
    const [tx1, tz1] = rot(-tw / 2, 0), [tx2, tz2] = rot(tw / 2, 0);
    const ac = OBJECT_COLORS[1] || [0.9, 0.2, 0.2, 1.0];
    const gridToWorld = (row, col) => [(col - GRID_SIZE / 2 + 0.5) * CELL_SIZE, (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE];
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            if ((levelGrid[row] ? levelGrid[row][col] : 0) !== 1) continue;
            const [cx, cz] = gridToWorld(row, col);
            pos.push(cx, tipY, cz, cx + hx1, hbY, cz + hz1, cx + hx2, hbY, cz + hz2);
            for (let i = 0; i < 3; i++) cols.push(...ac);
            norms.push(0.7071, 0, 0.7071, 0.7071, 0, 0.7071, 0.7071, 0, 0.7071);
            idx.push(vo, vo + 1, vo + 2); vo += 3;
            pos.push(cx + tx1, hbY, cz + tz1, cx + tx2, hbY, cz + tz2, cx + tx2, ttY, cz + tz2, cx + tx1, ttY, cz + tz1);
            for (let i = 0; i < 4; i++) cols.push(...ac);
            for (let i = 0; i < 4; i++) norms.push(0.7071, 0, 0.7071);
            idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3); vo += 4;
        }
    }
    return { positions: new Float32Array(pos), colors: new Float32Array(cols), normals: new Float32Array(norms), indices: new Uint16Array(idx), indexCount: idx.length };
}

window.loadLevel = loadLevel;
window.getCurrentLevel = getCurrentLevel;
window.getLevelGridSize = getLevelGridSize;
window.getLevelCellSize = getLevelCellSize;
window.getLevelGrid = getLevelGrid;
window.getLevelDoorConfig = getLevelDoorConfig;
window.getLevelRoomHalf = getLevelRoomHalf;
window.gridToWorldCollision = gridToWorldCollision;
window.handleLevelTileCollisions = handleLevelTileCollisions;
window.createRoomGeometry = createRoomGeometry;
window.createArrowGeometry = createArrowGeometry;
window.updateDoorCollision = updateDoorCollision;
window.updateDoorLockState = updateDoorLockState;
window.isDoorLocked = isDoorLocked;
window.getCurrentDoorColor = getCurrentDoorColor;
window.GRID_SIZE = GRID_SIZE;
window.CELL_SIZE = CELL_SIZE;
window.ROOM_HEIGHT = ROOM_HEIGHT;
