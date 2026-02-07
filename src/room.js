import { player, setPlayerSpawn, resetPlayer } from './player.js';
import { clearGhosts } from './ghost.js';
import { createPressurePlate, clearPressurePlates, isChannelActive } from './pressureplate.js';
import { createPiston, clearPistons, getPistonAt } from './piston.js';

const OBJECT_COLORS = {
    1: [0.9, 0.2, 0.2, 1.0], 2: [0.6, 0.5, 0.2, 1.0],
    3: [0.2, 0.9, 0.5, 1.0], 4: [0.5, 0.5, 0.6, 1.0],
};

let currentLevel = null, levelNumber = 1;
let GRID_SIZE = 9, CELL_SIZE = 2, ROOM_HEIGHT = 18;
let levelGrid = [], levelHeight = [], levelEntities = [];
let doorConfig = null, doorChannel = 0, doorLocked = true;
const DOOR_COLOR_LOCKED = [0.8, 0.2, 0.2, 1.0];
const DOOR_COLOR_UNLOCKED = [0.2, 0.8, 0.6, 1.0];

export async function loadLevel(levelPath) {
    const response = await fetch(levelPath);
    if (!response.ok) throw new Error(`Failed to load level: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const view = new Uint8Array(buffer);
    levelGrid = []; levelHeight = []; levelEntities = [];
    for (let i = 0; i < 9; i++) {
        levelGrid[i] = new Array(9).fill(0);
        levelHeight[i] = new Array(9).fill(0);
        levelEntities[i] = new Array(9).fill(0);
    }
    GRID_SIZE = 9; CELL_SIZE = 2; ROOM_HEIGHT = GRID_SIZE * CELL_SIZE;
    for (let i = 0; i < 81; i++) {
        const row = Math.floor(i / 9), col = i % 9;
        levelHeight[row][col] = view[i] || 0;
    }
    let spawnIndex = 40, doorWall = 'z-', doorRow = 0, doorCol = 0;
    clearPistons();
    for (let i = 0; i < 81; i++) {
        const entityByte = view[81 + i] || 0;
        const row = Math.floor(i / 9), col = i % 9;
        levelEntities[row][col] = entityByte;
        if (entityByte === 0) levelGrid[row][col] = 0;
        else if (entityByte >= 1 && entityByte <= 15) { spawnIndex = i; levelGrid[row][col] = 0; }
        else if (entityByte >= 16 && entityByte <= 31) { levelGrid[row][col] = 2; }
        else if (entityByte >= 128) {
            const mechType = (entityByte >> 4) & 0x07, channel = entityByte & 0x0F;
            if (mechType === 0) {
                doorWall = (col > 4) ? 'x+' : 'z-';
                doorRow = row; doorCol = col; doorChannel = channel;
                levelGrid[row][col] = 0;
            } else if (mechType === 1) {
                const height = levelHeight[row] ? levelHeight[row][col] : 0;
                createPiston(row, col, channel, height);
                levelGrid[row][col] = 4;
            }
        } else if (entityByte === 32) levelGrid[row][col] = 1;
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

export function getCurrentLevel() { return currentLevel; }
export function getLevelGridSize() { return GRID_SIZE; }
export function getLevelCellSize() { return CELL_SIZE; }
export function getLevelGrid() { return levelGrid; }
export function getLevelDoorConfig() { return doorConfig; }
export function getLevelRoomHalf() { return (GRID_SIZE * CELL_SIZE) / 2; }
export { GRID_SIZE, CELL_SIZE, ROOM_HEIGHT };

function gridToWorldCollision(row, col) {
    return [(col - GRID_SIZE / 2 + 0.5) * CELL_SIZE, (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE];
}

function checkDoorCollision(playerX, playerZ) {
    if (!doorConfig.wall || doorLocked) return false;
    const roomHalf = getLevelRoomHalf();
    const dw = doorConfig.width / 2, playerHalf = 0.7;
    const playerMaxPos = 8.7 - playerHalf;
    const doorBaseY = (levelHeight[doorConfig.row] && levelHeight[doorConfig.row][doorConfig.col])
        ? levelHeight[doorConfig.row][doorConfig.col] * CELL_SIZE : 0;
    if (Math.abs(player.position[1] - doorBaseY) > 2.0) return false;
    if (doorConfig.wall === 'z-') {
        const [doorX, _] = gridToWorldCollision(doorConfig.row, doorConfig.col);
        return playerZ <= -playerMaxPos && playerX > doorX - dw && playerX < doorX + dw;
    } else if (doorConfig.wall === 'x+') {
        const [_, doorZ] = gridToWorldCollision(doorConfig.row, doorConfig.col);
        return playerX >= playerMaxPos && playerZ > doorZ - dw && playerZ < doorZ + dw;
    }
    return false;
}

let isTransitioning = false;

export function updateDoorCollision() {
    if (isTransitioning) return false;
    const px = player.position[0], pz = player.position[2];
    const isColliding = checkDoorCollision(px, pz);
    if (isColliding) {
        isTransitioning = true;
        const loadNextLevel = () => {
            levelNumber++;
            loadLevel("levels/l" + levelNumber + ".bin").then(() => {
                clearGhosts();
                if (window.rebuildRoomGeometry) window.rebuildRoomGeometry();
                resetPlayer();
                isTransitioning = false;
            }).catch(() => { isTransitioning = false; });
        };
        if (window.transitionLevelOut) window.transitionLevelOut(loadNextLevel);
        else loadNextLevel();
    }
    return isColliding;
}

export function updateDoorLockState() {
    const channelActive = isChannelActive(doorChannel);
    if (channelActive && doorLocked) {
        doorLocked = false;
        if (doorConfig) doorConfig.color = DOOR_COLOR_UNLOCKED;
        if (window.refreshRoomBuffers) window.refreshRoomBuffers();
    } else if (!channelActive && !doorLocked) {
        doorLocked = true;
        if (doorConfig) doorConfig.color = DOOR_COLOR_LOCKED;
        if (window.refreshRoomBuffers) window.refreshRoomBuffers();
    }
}

export function isDoorLocked() { return doorLocked; }
export function getCurrentDoorColor() { return doorLocked ? DOOR_COLOR_LOCKED : DOOR_COLOR_UNLOCKED; }

export function handleLevelTileCollisions() {
    if (!levelGrid) return;
    const cubeSize = CELL_SIZE, cubeHeight = CELL_SIZE, playerRadius = 0.7;
    let standingOnTile = false;
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objectType = levelGrid[row] ? levelGrid[row][col] : 0;
            const height = levelHeight[row] ? levelHeight[row][col] : 0;
            if (objectType === 0 && height === 0) continue;
            if (objectType < 3 && height === 0) continue;
            const [tileX, tileZ] = gridToWorldCollision(row, col);
            const tileHalf = cubeSize / 2;
            let collisionHeight = height * CELL_SIZE;
            if (objectType === 3) collisionHeight += cubeHeight;
            else if (objectType === 4) collisionHeight += 0.5;
            const px = player.position[0], pz = player.position[2], py = player.position[1];
            const minX = tileX - tileHalf - playerRadius, maxX = tileX + tileHalf + playerRadius;
            const minZ = tileZ - tileHalf - playerRadius, maxZ = tileZ + tileHalf + playerRadius;
            if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
                if (py >= collisionHeight - 0.3 && py <= collisionHeight + 0.5 && player.velocityY <= 0) {
                    const strictMinX = tileX - tileHalf - playerRadius * 0.8;
                    const strictMaxX = tileX + tileHalf + playerRadius * 0.8;
                    const strictMinZ = tileZ - tileHalf - playerRadius * 0.8;
                    const strictMaxZ = tileZ + tileHalf + playerRadius * 0.8;
                    if (px > strictMinX && px < strictMaxX && pz > strictMinZ && pz < strictMaxZ) {
                        player.position[1] = collisionHeight;
                        player.velocityY = 0;
                        player.isJumping = false;
                        standingOnTile = true;
                        continue;
                    }
                }
                if (py < collisionHeight - 0.1) {
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
    }
    if (!standingOnTile && player.position[1] > 0 && player.position[1] <= cubeHeight + 0.1 &&
        !player.isJumping && player.velocityY === 0 && player.position[1] > 0.1) {
        player.isJumping = true;
    }
    return standingOnTile;
}

export function createRoomGeometry() {
    const roomHalf = getLevelRoomHalf();
    const positions = [], colors = [], normals = [], indices = [];
    let vertexOffset = 0;
    function calcNormal(p1, p2, p3) {
        const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
        const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) { nx /= len; ny /= len; nz /= len; }
        return [nx, ny, nz];
    }
    function addQuad(p1, p2, p3, p4, color) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        const normal = calcNormal(p1, p2, p3);
        for (let i = 0; i < 4; i++) normals.push(...normal);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
        vertexOffset += 4;
    }
    function addBox(x, y, z, w, h, d, color) {
        const x1 = x, x2 = x + w, y1 = y, y2 = y + h, z1 = z, z2 = z + d;
        addQuad([x1, y2, z2], [x2, y2, z2], [x2, y2, z1], [x1, y2, z1], color);
        addQuad([x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2], color);
        addQuad([x2, y1, z2], [x2, y2, z2], [x1, y2, z2], [x1, y1, z2], color);
        addQuad([x1, y1, z1], [x1, y2, z1], [x2, y2, z1], [x2, y1, z1], color);
        addQuad([x2, y1, z1], [x2, y2, z1], [x2, y2, z2], [x2, y1, z2], color);
        addQuad([x1, y1, z2], [x1, y2, z2], [x1, y2, z1], [x1, y1, z1], color);
    }
    function gridToWorld(row, col) {
        return [(col - GRID_SIZE / 2 + 0.5) * CELL_SIZE, (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE];
    }
    if (doorConfig && doorConfig.wall) {
        const dw = doorConfig.width / 2, dh = doorConfig.height, offset = 0.02;
        const doorColor = doorConfig.color || [0.2, 0.8, 0.6, 1.0];
        const doorBaseY = (levelHeight[doorConfig.row] && levelHeight[doorConfig.row][doorConfig.col])
            ? levelHeight[doorConfig.row][doorConfig.col] * CELL_SIZE : 0;
        const [doorX, doorZ] = gridToWorld(doorConfig.row, doorConfig.col);
        if (doorConfig.wall === 'z-') {
            const z = -roomHalf + offset;
            addQuad([doorX - dw, doorBaseY, z], [doorX - dw, doorBaseY + dh, z], [doorX + dw, doorBaseY + dh, z], [doorX + dw, doorBaseY, z], doorColor);
        } else if (doorConfig.wall === 'x+') {
            const x = roomHalf - offset;
            addQuad([x, doorBaseY, doorZ - dw], [x, doorBaseY + dh, doorZ - dw], [x, doorBaseY + dh, doorZ + dw], [x, doorBaseY, doorZ + dw], doorColor);
        }
    }
    const cubeSize = CELL_SIZE, cubeHeight = CELL_SIZE;
    // Add downward-extending walls on front faces
    const terrainColor = [0.55, 0.35, 0.2, 1.0];
    const bottomY = -cubeSize * 10;
    addQuad([-roomHalf, bottomY, roomHalf], [roomHalf, bottomY, roomHalf], [roomHalf, 0, roomHalf], [-roomHalf, 0, roomHalf], terrainColor);
    addQuad([-roomHalf, 0, -roomHalf], [-roomHalf, bottomY, -roomHalf], [-roomHalf, bottomY, roomHalf], [-roomHalf, 0, roomHalf], terrainColor);
    clearPressurePlates();
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objectType = levelGrid[row] ? levelGrid[row][col] : 0;
            const entityByte = levelEntities[row] ? levelEntities[row][col] : 0;
            const height = levelHeight[row] ? levelHeight[row][col] : 0;
            if (objectType === 0 && height === 0) continue;
            const [worldX, worldZ] = gridToWorld(row, col);
            const floorY = height * CELL_SIZE;
            const color = OBJECT_COLORS[objectType] || [0.5, 0.5, 0.5, 1.0];
            if (height > 0) {
                const terrainColor = [0.55, 0.35, 0.2, 1.0];
                const x = worldX - cubeSize / 2, z = worldZ - cubeSize / 2;
                const w = cubeSize, d = cubeSize, h = floorY;
                addQuad([x, 0, z + d], [x + w, 0, z + d], [x + w, h, z + d], [x, h, z + d], terrainColor);
                addQuad([x + w, 0, z], [x, 0, z], [x, h, z], [x + w, h, z], terrainColor);
                addQuad([x, 0, z], [x, 0, z + d], [x, h, z + d], [x, h, z], terrainColor);
                addQuad([x + w, 0, z + d], [x + w, 0, z], [x + w, h, z], [x + w, h, z + d], terrainColor);
            }
            if (objectType === 2) {
                const channel = entityByte & 0x0F;
                createPressurePlate(row, col, channel, height);
                const plateSize = CELL_SIZE * 0.7;
                addBox(worldX - plateSize / 2, floorY + 0.01, worldZ - plateSize / 2, plateSize, 0.08, plateSize, color);
            } else if (objectType === 4) {
                const piston = getPistonAt(row, col);
                const pistonHeight = piston ? piston.getHeight() : 0.5;
                const baseColor = [0.6, 0.6, 0.7, 1.0];
                const headColor = [0.7, 0.7, 0.8, 1.0];
                // Always draw base
                addBox(worldX - cubeSize / 2, floorY, worldZ - cubeSize / 2, cubeSize, 0.5, cubeSize, baseColor);
                // Draw shaft and head if extending (height > 0.5)
                if (pistonHeight > 0.5) {
                    const shaftSize = cubeSize * 0.6;
                    const shaftHeight = pistonHeight - 1.0; // 0 at height 0.5, 1.0 at height 2
                    if (shaftHeight > 0) {
                        addBox(worldX - shaftSize / 2, floorY + 0.5, worldZ - shaftSize / 2, shaftSize, shaftHeight, shaftSize, [0.4, 0.4, 0.5, 1.0]);
                    }
                    addBox(worldX - cubeSize / 2, floorY + pistonHeight - 0.5, worldZ - cubeSize / 2, cubeSize, 0.5, cubeSize, headColor);
                }
            } else if (objectType === 3) {
                addBox(worldX - cubeSize / 2, floorY, worldZ - cubeSize / 2, cubeSize, cubeHeight, cubeSize, color);
            }
        }
    }
    return {
        positions: new Float32Array(positions), colors: new Float32Array(colors),
        normals: new Float32Array(normals), indices: new Uint16Array(indices), indexCount: indices.length
    };
}

export function createArrowGeometry() {
    const positions = [], colors = [], normals = [], indices = [];
    let vertexOffset = 0;
    const size = 1.5 * CELL_SIZE, floatHeight = 2.0;
    const headLength = size * 0.4, headWidth = size * 0.5;
    const tailWidth = size * 0.15, tailLength = size * 0.5;
    const tipY = floatHeight - size / 2, headBaseY = tipY + headLength, tailTopY = headBaseY + tailLength;
    const cos45 = 0.7071, sin45 = 0.7071;
    function rot(dx, dz) { return [dx * cos45 - dz * sin45, dx * sin45 + dz * cos45]; }
    const [hx1, hz1] = rot(-headWidth / 2, 0), [hx2, hz2] = rot(headWidth / 2, 0);
    const [tx1, tz1] = rot(-tailWidth / 2, 0), [tx2, tz2] = rot(tailWidth / 2, 0);
    const arrowColor = OBJECT_COLORS[1] || [0.9, 0.2, 0.2, 1.0];
    function gridToWorld(row, col) {
        return [(col - GRID_SIZE / 2 + 0.5) * CELL_SIZE, (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE];
    }
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            if ((levelGrid[row] ? levelGrid[row][col] : 0) !== 1) continue;
            const [cx, cz] = gridToWorld(row, col);
            positions.push(cx, tipY, cz, cx + hx1, headBaseY, cz + hz1, cx + hx2, headBaseY, cz + hz2);
            for (let i = 0; i < 3; i++) colors.push(...arrowColor);
            normals.push(0.7071, 0, 0.7071, 0.7071, 0, 0.7071, 0.7071, 0, 0.7071);
            indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
            vertexOffset += 3;
            positions.push(cx + tx1, headBaseY, cz + tz1, cx + tx2, headBaseY, cz + tz2, cx + tx2, tailTopY, cz + tz2, cx + tx1, tailTopY, cz + tz1);
            for (let i = 0; i < 4; i++) colors.push(...arrowColor);
            for (let i = 0; i < 4; i++) normals.push(0.7071, 0, 0.7071);
            indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
            vertexOffset += 4;
        }
    }
    return {
        positions: new Float32Array(positions), colors: new Float32Array(colors),
        normals: new Float32Array(normals), indices: new Uint16Array(indices), indexCount: indices.length
    };
}

export function createWallGeometry() {
    const roomHalf = getLevelRoomHalf();
    const positions = [], normals = [], indices = [];
    let vertexOffset = 0;

    // Picket dimensions
    const picketWidth = 0.3;       // Width of each picket
    const picketDepth = 0.08;      // Depth/thickness of the picket
    const picketHeight = 2.0;      // Main body height
    const picketPointHeight = 0.4; // Pointed top height
    const picketSpacing = 0.15;    // Space between pickets
    const railHeight = 0.15;       // Height of horizontal rails
    const railDepth = 0.06;        // Depth of rails
    const railOffset1 = 0.4;       // First rail height from base
    const railOffset2 = 1.4;       // Second rail height from base

    // Add a quad with normal
    function addQuad(p1, p2, p3, p4, nx, ny, nz) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) normals.push(nx, ny, nz);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
        vertexOffset += 4;
    }

    // Add a triangle with normal
    function addTri(p1, p2, p3, nx, ny, nz) {
        positions.push(...p1, ...p2, ...p3);
        for (let i = 0; i < 3; i++) normals.push(nx, ny, nz);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
        vertexOffset += 3;
    }

    // Create a single picket at (x, baseY, z) facing direction (0 = -Z, 1 = +X)
    function addPicket(x, baseY, z, facing) {
        const hw = picketWidth / 2;
        const hd = picketDepth / 2;
        const h = picketHeight;
        const ph = picketPointHeight;
        const totalH = h + ph;

        if (facing === 0) {
            // Facing -Z direction
            // Front face (facing -Z)
            addQuad(
                [x - hw, baseY, z - hd], [x - hw, baseY + h, z - hd],
                [x + hw, baseY + h, z - hd], [x + hw, baseY, z - hd],
                0, 0, -1
            );
            // Front triangle (point)
            addTri(
                [x - hw, baseY + h, z - hd], [x, baseY + totalH, z - hd], [x + hw, baseY + h, z - hd],
                0, 0, -1
            );
            // Back face (facing +Z)
            addQuad(
                [x + hw, baseY, z + hd], [x + hw, baseY + h, z + hd],
                [x - hw, baseY + h, z + hd], [x - hw, baseY, z + hd],
                0, 0, 1
            );
            // Back triangle (point)
            addTri(
                [x + hw, baseY + h, z + hd], [x, baseY + totalH, z + hd], [x - hw, baseY + h, z + hd],
                0, 0, 1
            );
            // Left side
            addQuad(
                [x - hw, baseY, z + hd], [x - hw, baseY + h, z + hd],
                [x - hw, baseY + h, z - hd], [x - hw, baseY, z - hd],
                -1, 0, 0
            );
            // Left point side
            addTri(
                [x - hw, baseY + h, z + hd], [x, baseY + totalH, z + hd], [x, baseY + totalH, z - hd],
                -0.8, 0.6, 0
            );
            addTri(
                [x - hw, baseY + h, z + hd], [x, baseY + totalH, z - hd], [x - hw, baseY + h, z - hd],
                -0.8, 0.6, 0
            );
            // Right side
            addQuad(
                [x + hw, baseY, z - hd], [x + hw, baseY + h, z - hd],
                [x + hw, baseY + h, z + hd], [x + hw, baseY, z + hd],
                1, 0, 0
            );
            // Right point side
            addTri(
                [x + hw, baseY + h, z - hd], [x, baseY + totalH, z - hd], [x, baseY + totalH, z + hd],
                0.8, 0.6, 0
            );
            addTri(
                [x + hw, baseY + h, z - hd], [x, baseY + totalH, z + hd], [x + hw, baseY + h, z + hd],
                0.8, 0.6, 0
            );
        } else {
            // Facing +X direction
            // Front face (facing +X)
            addQuad(
                [x + hd, baseY, z + hw], [x + hd, baseY + h, z + hw],
                [x + hd, baseY + h, z - hw], [x + hd, baseY, z - hw],
                1, 0, 0
            );
            // Front triangle (point)
            addTri(
                [x + hd, baseY + h, z + hw], [x + hd, baseY + totalH, z], [x + hd, baseY + h, z - hw],
                1, 0, 0
            );
            // Back face (facing -X)
            addQuad(
                [x - hd, baseY, z - hw], [x - hd, baseY + h, z - hw],
                [x - hd, baseY + h, z + hw], [x - hd, baseY, z + hw],
                -1, 0, 0
            );
            // Back triangle (point)
            addTri(
                [x - hd, baseY + h, z - hw], [x - hd, baseY + totalH, z], [x - hd, baseY + h, z + hw],
                -1, 0, 0
            );
            // Left side (facing -Z)
            addQuad(
                [x - hd, baseY, z - hw], [x - hd, baseY + h, z - hw],
                [x + hd, baseY + h, z - hw], [x + hd, baseY, z - hw],
                0, 0, -1
            );
            // Left point side
            addTri(
                [x - hd, baseY + h, z - hw], [x - hd, baseY + totalH, z], [x + hd, baseY + totalH, z],
                0, 0.6, -0.8
            );
            addTri(
                [x - hd, baseY + h, z - hw], [x + hd, baseY + totalH, z], [x + hd, baseY + h, z - hw],
                0, 0.6, -0.8
            );
            // Right side (facing +Z)
            addQuad(
                [x + hd, baseY, z + hw], [x + hd, baseY + h, z + hw],
                [x - hd, baseY + h, z + hw], [x - hd, baseY, z + hw],
                0, 0, 1
            );
            // Right point side
            addTri(
                [x + hd, baseY + h, z + hw], [x + hd, baseY + totalH, z], [x - hd, baseY + totalH, z],
                0, 0.6, 0.8
            );
            addTri(
                [x + hd, baseY + h, z + hw], [x - hd, baseY + totalH, z], [x - hd, baseY + h, z + hw],
                0, 0.6, 0.8
            );
        }
    }

    // Add horizontal rail between two points
    function addRail(x1, y, z1, x2, z2, facing) {
        const h = railHeight / 2;
        const d = railDepth / 2;

        if (facing === 0) {
            // Rail along X axis, facing -Z
            addQuad([x1, y - h, z1 - d], [x1, y + h, z1 - d], [x2, y + h, z1 - d], [x2, y - h, z1 - d], 0, 0, -1);
            addQuad([x2, y - h, z1 + d], [x2, y + h, z1 + d], [x1, y + h, z1 + d], [x1, y - h, z1 + d], 0, 0, 1);
            addQuad([x1, y + h, z1 - d], [x1, y + h, z1 + d], [x2, y + h, z1 + d], [x2, y + h, z1 - d], 0, 1, 0);
            addQuad([x1, y - h, z1 + d], [x1, y - h, z1 - d], [x2, y - h, z1 - d], [x2, y - h, z1 + d], 0, -1, 0);
        } else {
            // Rail along Z axis, facing +X
            addQuad([x1 + d, y - h, z1], [x1 + d, y + h, z1], [x1 + d, y + h, z2], [x1 + d, y - h, z2], 1, 0, 0);
            addQuad([x1 - d, y - h, z2], [x1 - d, y + h, z2], [x1 - d, y + h, z1], [x1 - d, y - h, z1], -1, 0, 0);
            addQuad([x1 - d, y + h, z1], [x1 + d, y + h, z1], [x1 + d, y + h, z2], [x1 - d, y + h, z2], 0, 1, 0);
            addQuad([x1 - d, y - h, z2], [x1 + d, y - h, z2], [x1 + d, y - h, z1], [x1 - d, y - h, z1], 0, -1, 0);
        }
    }

    // Helper to get height at grid position
    function getHeightAt(row, col) {
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return 0;
        return (levelHeight[row] && levelHeight[row][col]) ? levelHeight[row][col] * CELL_SIZE : 0;
    }

    // Z- wall (back wall) - generate pickets and rails per cell
    const zWallZ = -roomHalf + 0.1;

    for (let col = 0; col < GRID_SIZE; col++) {
        const row = 0; // Back edge
        // Skip fence if door is at this cell
        if (doorConfig && doorConfig.wall === 'z-' && doorConfig.row === row && doorConfig.col === col) continue;
        const baseHeight = getHeightAt(row, col);
        const x = (col - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
        const cellLeft = x - CELL_SIZE / 2;
        const cellRight = x + CELL_SIZE / 2;

        // Add pickets for this cell
        const cellStart = cellLeft + picketWidth / 2 + picketSpacing / 2;
        const cellEnd = cellRight - picketWidth / 2;

        for (let px = cellStart; px <= cellEnd; px += picketWidth + picketSpacing) {
            addPicket(px, baseHeight, zWallZ, 0);
        }

        // Add rails for this cell only (stays within cell boundaries)
        addRail(cellLeft, baseHeight + railOffset1, zWallZ, cellRight, zWallZ, 0);
        addRail(cellLeft, baseHeight + railOffset2, zWallZ, cellRight, zWallZ, 0);
    }

    // X+ wall (right wall) - generate pickets and rails per cell
    const xWallX = roomHalf - 0.1;

    for (let row = 0; row < GRID_SIZE; row++) {
        const col = GRID_SIZE - 1; // Right edge
        // Skip fence if door is at this cell
        if (doorConfig && doorConfig.wall === 'x+' && doorConfig.row === row && doorConfig.col === col) continue;
        const baseHeight = getHeightAt(row, col);
        const z = (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
        const cellBack = z - CELL_SIZE / 2;
        const cellFront = z + CELL_SIZE / 2;

        // Add pickets for this cell
        const cellStart = cellBack + picketWidth / 2 + picketSpacing / 2;
        const cellEnd = cellFront - picketWidth / 2;

        for (let pz = cellStart; pz <= cellEnd; pz += picketWidth + picketSpacing) {
            addPicket(xWallX, baseHeight, pz, 1);
        }

        // Add rails for this cell only (stays within cell boundaries)
        addRail(xWallX, baseHeight + railOffset1, cellBack, xWallX, cellFront, 1);
        addRail(xWallX, baseHeight + railOffset2, cellBack, xWallX, cellFront, 1);
    }

    return {
        positions: new Float32Array(positions), normals: new Float32Array(normals),
        indices: new Uint16Array(indices), indexCount: indices.length
    };
}

