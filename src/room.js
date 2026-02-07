// =============================================================================
// ROOM & LEVEL SYSTEM - Dynamic Level Loading
// =============================================================================

// Object type definitions:
// 0 = empty
// 1 = red arrow (indicator)
// 2 = pressure plate
// 3 = green cube (exit/goal)

// Object colors by type
const OBJECT_COLORS = {
    1: [0.9, 0.2, 0.2, 1.0],  // Red (arrow)
    2: [0.6, 0.5, 0.2, 1.0],  // Gold/bronze (pressure plate)
    3: [0.2, 0.9, 0.5, 1.0],  // Green (exit)
};

// =============================================================================
// LEVEL STATE (loaded from JSON)
// =============================================================================
let currentLevel = null;
let levelNumber = 1;

// Level properties (set after loading)
let GRID_SIZE = 9;
let CELL_SIZE = 2;
let ROOM_HEIGHT = 18;
let levelGrid = [];
let doorConfig = null;

// Load a level from BINARY file
async function loadLevel(levelPath) {
    try {
        const response = await fetch(levelPath);
        if (!response.ok) {
            throw new Error(`Failed to load level: ${response.status}`);
        }

        // Read as ArrayBuffer for binary data
        const buffer = await response.arrayBuffer();
        const view = new Uint8Array(buffer);

        // Initialize 9x9 grid with all zeros (dense array)
        levelGrid = [];
        for (let i = 0; i < 9; i++) {
            levelGrid[i] = new Array(9).fill(0);
        }

        // Set constants
        GRID_SIZE = 9;
        CELL_SIZE = 2;
        ROOM_HEIGHT = GRID_SIZE * CELL_SIZE;

        // Parse Header
        // Byte 0: Door Wall (0=z-, 1=x+)
        const doorWallByte = view[0];
        const doorWall = (doorWallByte === 1) ? 'x+' : 'z-';

        // Byte 1: Spawn Index
        const spawnIndex = view[1];
        const spawnRow = Math.floor(spawnIndex / 9);
        const spawnCol = spawnIndex % 9;

        // Convert spawn grid to world positions
        const roomHalf = (GRID_SIZE * CELL_SIZE) / 2;
        const spawnX = (spawnCol * CELL_SIZE) - roomHalf + (CELL_SIZE / 2);
        const spawnZ = (spawnRow * CELL_SIZE) - roomHalf + (CELL_SIZE / 2);

        // Parse sparse binary data: [Index, Type, Index, Type, ...]
        // Start at index 2 (skip header)
        for (let i = 2; i < view.length; i += 2) {
            // Safety check for incomplete pair
            if (i + 1 >= view.length) break;

            const index = view[i];
            const typeHex = view[i + 1];

            // Map hex types to internal types
            let internalType = 0;
            if (typeHex === 0x0A) internalType = 1;      // Arrow
            else if (typeHex === 0x0B) internalType = 2; // Pressure Plate
            else if (typeHex === 0x0C) internalType = 3; // Exit

            // Convert linear index (0-80) to row/col
            if (index >= 0 && index < 81) {
                const row = Math.floor(index / 9);
                const col = index % 9;
                levelGrid[row][col] = internalType;
            }
        }

        doorConfig = {
            wall: doorWall,
            width: 2.5,
            height: 3.5,
            color: [0.2, 0.8, 0.6, 1.0]
        };

        // Set player spawn (using global function from player.js)
        if (typeof setPlayerSpawn === 'function') {
            setPlayerSpawn(spawnX, 0, spawnZ);
        }

        // Store raw buffer as currentLevel (or wrapper)
        currentLevel = { grid: levelGrid, door: doorConfig };

        console.log(`Loaded binary level from ${levelPath}. Bytes: ${view.length}`);
        return currentLevel;
    } catch (error) {
        console.error('Error loading level:', error);
        throw error;
    }
}

// Get current level config
function getCurrentLevel() {
    return currentLevel;
}

// Get level grid size
function getLevelGridSize() {
    return GRID_SIZE;
}

// Get level cell size
function getLevelCellSize() {
    return CELL_SIZE;
}

// Get level grid
function getLevelGrid() {
    return levelGrid;
}

// Get door config
function getLevelDoorConfig() {
    return doorConfig;
}

// Get room half size (for collision bounds)
function getLevelRoomHalf() {
    return (GRID_SIZE * CELL_SIZE) / 2;
}

// =============================================================================
// DOOR COLLISION
// =============================================================================
function checkDoorCollision(playerX, playerZ) {

    if (!doorConfig.wall) return false;

    const roomHalf = getLevelRoomHalf();
    const dw = doorConfig.width / 2;
    const playerHalf = 0.7;  // Player cube half-size
    // Player stops at (roomHalf - margin - playerHalf), so check based on that
    const playerMaxPos = 8.7 - playerHalf;  // 8.0

    if (doorConfig.wall === 'z-') {
        const nearWall = playerZ <= -playerMaxPos;
        const inDoorX = playerX > -dw && playerX < dw;
        return nearWall && inDoorX;
    } else if (doorConfig.wall === 'x+') {
        const nearWall = playerX >= playerMaxPos;
        const inDoorZ = playerZ > -dw && playerZ < dw;
        return nearWall && inDoorZ;
    }

    return false;
}

let isTransitioning = false;

function updateDoorCollision() {
    if (isTransitioning) return false;

    const px = player.position[0];
    const pz = player.position[2];
    const isColliding = checkDoorCollision(px, pz);

    // Debug: log every few frames to avoid spam
    if (!updateDoorCollision.frameCount) updateDoorCollision.frameCount = 0;
    updateDoorCollision.frameCount++;

    if (updateDoorCollision.frameCount % 60 === 0) {
        const roomHalf = getLevelRoomHalf();
        const dw = doorConfig ? doorConfig.width / 2 : 0;
        console.log(`Door Debug: player(${px.toFixed(2)}, ${pz.toFixed(2)}) | roomHalf=${roomHalf} | doorWidth=${dw} | wall=${doorConfig?.wall} | colliding=${isColliding}`);
    }

    if (isColliding) {
        console.log('DOOR COLLISION! Starting transition...');
        isTransitioning = true;

        const loadNextLevel = () => {
            levelNumber++;
            loadLevel("levels/l" + levelNumber).then(() => {
                console.log('Level ' + levelNumber + ' loaded!');
                // Rebuild room geometry with new level data (will reset transition to -40)
                if (window.rebuildRoomGeometry) {
                    window.rebuildRoomGeometry();
                }
                // Reset player position for new level
                resetPlayer();
                isTransitioning = false;
            }).catch((err) => {
                console.error('Failed to load level:', err);
                isTransitioning = false;
            });
        };

        if (window.transitionLevelOut) {
            window.transitionLevelOut(loadNextLevel);
        } else {
            loadNextLevel();
        }
    }

    return isColliding;
}

// =============================================================================
// LEVEL TILE COLLISION
// =============================================================================
// Convert grid position to world position (for collision)
function gridToWorldCollision(row, col) {
    return [
        (col - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
        (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE
    ];
}

// Handle player collision with level tiles (cubes)
function handleLevelTileCollisions() {
    if (!levelGrid) return;

    const cubeSize = CELL_SIZE;  // 2 units
    const cubeHeight = CELL_SIZE;  // 2 units
    const playerRadius = 0.7;  // Match player size

    let standingOnTile = false;

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objectType = levelGrid[row] ? levelGrid[row][col] : 0;
            // Only collide with cube tiles (type 3 and above, not empty/arrow/pressure plate)
            if (objectType < 3) continue;

            const [tileX, tileZ] = gridToWorldCollision(row, col);
            const tileHalf = cubeSize / 2;

            // Check if player is within the tile's horizontal bounds
            const playerX = player.position[0];
            const playerZ = player.position[2];
            const playerY = player.position[1];

            // AABB collision check (axis-aligned bounding box)
            const minX = tileX - tileHalf - playerRadius;
            const maxX = tileX + tileHalf + playerRadius;
            const minZ = tileZ - tileHalf - playerRadius;
            const maxZ = tileZ + tileHalf + playerRadius;

            // Check if player is within horizontal bounds of tile
            const inHorizontalBounds = playerX > minX && playerX < maxX &&
                playerZ > minZ && playerZ < maxZ;

            if (inHorizontalBounds) {
                // Check for landing on top
                if (playerY >= cubeHeight - 0.3 && playerY <= cubeHeight + 0.5 && player.velocityY <= 0) {
                    // More strict check for being above the tile
                    const strictMinX = tileX - tileHalf - playerRadius * 0.8;
                    const strictMaxX = tileX + tileHalf + playerRadius * 0.8;
                    const strictMinZ = tileZ - tileHalf - playerRadius * 0.8;
                    const strictMaxZ = tileZ + tileHalf + playerRadius * 0.8;

                    if (playerX > strictMinX && playerX < strictMaxX &&
                        playerZ > strictMinZ && playerZ < strictMaxZ) {
                        // Land on top of tile
                        player.position[1] = cubeHeight;
                        player.velocityY = 0;
                        player.isJumping = false;
                        standingOnTile = true;
                        continue;
                    }
                }

                // Horizontal collision (only if player is below the top of the tile)
                if (playerY < cubeHeight - 0.1) {
                    // Find the closest edge and push player out
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
    }

    // If player was standing on a tile and now isn't, enable falling
    if (!standingOnTile && player.position[1] > 0 && player.position[1] <= cubeHeight + 0.1 &&
        !player.isJumping && player.velocityY === 0) {
        // Check if we're at cube height (not ground level)
        if (player.position[1] > 0.1) {
            player.isJumping = true;  // Re-enable gravity
        }
    }

    return standingOnTile;
}

// =============================================================================
// GEOMETRY CREATION
// =============================================================================
function createRoomGeometry() {

    const roomHalf = getLevelRoomHalf();

    const positions = [];
    const colors = [];
    const normals = [];
    const indices = [];
    let vertexOffset = 0;

    // Helper to calculate normal from quad vertices (counter-clockwise)
    function calcNormal(p1, p2, p3) {
        const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
        const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
        // Cross product
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        // Normalize
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) { nx /= len; ny /= len; nz /= len; }
        return [nx, ny, nz];
    }

    // Helper to add a quad with automatic normal calculation
    function addQuad(p1, p2, p3, p4, color) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
        const normal = calcNormal(p1, p2, p3);
        for (let i = 0; i < 4; i++) normals.push(...normal);
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    // Helper to add a box (6 faces)
    function addBox(x, y, z, w, h, d, color) {
        const x1 = x, x2 = x + w;
        const y1 = y, y2 = y + h;
        const z1 = z, z2 = z + d;

        addQuad([x1, y2, z2], [x2, y2, z2], [x2, y2, z1], [x1, y2, z1], color);
        addQuad([x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2], color);
        addQuad([x2, y1, z2], [x2, y2, z2], [x1, y2, z2], [x1, y1, z2], color);
        addQuad([x1, y1, z1], [x1, y2, z1], [x2, y2, z1], [x2, y1, z1], color);
        addQuad([x2, y1, z1], [x2, y2, z1], [x2, y2, z2], [x2, y1, z2], color);
        addQuad([x1, y1, z2], [x1, y2, z2], [x1, y2, z1], [x1, y1, z1], color);
    }

    // Convert grid position to world position (centered at origin)
    function gridToWorld(row, col) {
        return [
            (col - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
            (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE
        ];
    }

    // --- FLOOR ---
    addQuad(
        [-roomHalf, 0, -roomHalf],
        [roomHalf, 0, -roomHalf],
        [roomHalf, 0, roomHalf],
        [-roomHalf, 0, roomHalf],
        [0.5, 0.5, 0.54, 1.0]
    );

    // --- WALLS ---
    const wallColor = [0.55, 0.57, 0.62, 1.0];

    // Back wall (Z-)
    addQuad(
        [-roomHalf, 0, -roomHalf],
        [-roomHalf, ROOM_HEIGHT, -roomHalf],
        [roomHalf, ROOM_HEIGHT, -roomHalf],
        [roomHalf, 0, -roomHalf],
        wallColor
    );
    // Right wall (X+)
    addQuad(
        [roomHalf, 0, -roomHalf],
        [roomHalf, ROOM_HEIGHT, -roomHalf],
        [roomHalf, ROOM_HEIGHT, roomHalf],
        [roomHalf, 0, roomHalf],
        wallColor
    );

    // --- DOOR (rendered on top of wall) ---
    if (doorConfig && doorConfig.wall) {
        const dw = doorConfig.width / 2;
        const dh = doorConfig.height;
        const offset = 0.02;
        const doorColor = doorConfig.color || [0.2, 0.8, 0.6, 1.0];

        if (doorConfig.wall === 'z-') {
            const z = -roomHalf + offset;
            addQuad([-dw, 0, z], [-dw, dh, z], [dw, dh, z], [dw, 0, z], doorColor);
        } else if (doorConfig.wall === 'x+') {
            const x = roomHalf - offset;
            addQuad([x, 0, -dw], [x, dh, -dw], [x, dh, dw], [x, 0, dw], doorColor);
        }
    }

    // --- GRID OBJECTS ---
    const cubeSize = CELL_SIZE;
    const cubeHeight = CELL_SIZE;

    // Clear pressure plates for new level
    clearPressurePlates();

    // Arrow helper
    function addArrow(cx, cz, color) {
        const size = CELL_SIZE * 0.6;
        const floatHeight = 1.5;
        const headLength = size * 0.4;
        const headWidth = size * 0.5;
        const tailWidth = size * 0.15;
        const tailLength = size * 0.5;

        const tipY = floatHeight - size / 2;
        const headBaseY = tipY + headLength;
        const tailTopY = headBaseY + tailLength;

        const cos45 = 0.7071, sin45 = 0.7071;
        function rot(dx, dz) {
            return [dx * cos45 - dz * sin45, dx * sin45 + dz * cos45];
        }

        const [hx1, hz1] = rot(-headWidth / 2, 0);
        const [hx2, hz2] = rot(headWidth / 2, 0);

        positions.push(cx, tipY, cz, cx + hx1, headBaseY, cz + hz1, cx + hx2, headBaseY, cz + hz2);
        for (let i = 0; i < 3; i++) colors.push(...color);
        // Normal pointing out of diagonal plane (toward camera in isometric)
        normals.push(0.7071, 0, 0.7071, 0.7071, 0, 0.7071, 0.7071, 0, 0.7071);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
        vertexOffset += 3;

        const [tx1, tz1] = rot(-tailWidth / 2, 0);
        const [tx2, tz2] = rot(tailWidth / 2, 0);

        positions.push(
            cx + tx1, headBaseY, cz + tz1,
            cx + tx2, headBaseY, cz + tz2,
            cx + tx2, tailTopY, cz + tz2,
            cx + tx1, tailTopY, cz + tz1
        );
        for (let i = 0; i < 4; i++) colors.push(...color);
        // indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
        // Same normal for tail quad
        for (let i = 0; i < 4; i++) normals.push(0.7071, 0, 0.7071);
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        vertexOffset += 4;
    }

    // Process grid
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objectType = levelGrid[row] ? levelGrid[row][col] : 0;
            if (objectType === 0) continue;

            const [worldX, worldZ] = gridToWorld(row, col);
            const color = OBJECT_COLORS[objectType] || [0.5, 0.5, 0.5, 1.0];

            if (objectType === 1) { // arrow
                addArrow(worldX, worldZ, color);
            } else if (objectType === 2) { // pressure plate
                createPressurePlate(row, col);
                const plateSize = CELL_SIZE * 0.7;
                addBox(worldX - plateSize / 2, 0.01, worldZ - plateSize / 2, plateSize, 0.08, plateSize, color);
            } else { // cube
                addBox(worldX - cubeSize / 2, 0, worldZ - cubeSize / 2, cubeSize, cubeHeight, cubeSize, color);
            }
        }
    }

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}
