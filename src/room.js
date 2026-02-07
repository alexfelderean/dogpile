// =============================================================================
// ROOM & LEVEL SYSTEM - Dynamic Level Loading
// =============================================================================

// Entity byte encoding:
// 0 = empty
// 1-15 = spawn location
// 16-31 = pressure plate (channel = value & 0x0F)
// 128+ = mechanism (type = (value >> 4) & 0x07, channel = value & 0x0F)
//   type 0 = door
//   type 1 = piston

// Object type definitions (legacy, for rendering):
// 0 = empty
// 1 = red arrow (indicator)
// 2 = pressure plate
// 3 = green cube (exit/goal)
// 4 = piston

// Object colors by type
const OBJECT_COLORS = {
    1: [0.9, 0.2, 0.2, 1.0],  // Red (arrow)
    2: [0.6, 0.5, 0.2, 1.0],  // Gold/bronze (pressure plate)
    3: [0.2, 0.9, 0.5, 1.0],  // Green (exit)
    4: [0.5, 0.5, 0.6, 1.0],  // Gray (piston)
};

// =============================================================================
// LEVEL STATE (loaded from binary)
// =============================================================================
let currentLevel = null;
let levelNumber = 1;

// Level properties (set after loading)
let GRID_SIZE = 9;
let CELL_SIZE = 2;
let ROOM_HEIGHT = 18;
let levelGrid = [];
let levelHeight = [];     // Height map H[81]
let levelEntities = [];   // Entity map E[81]
let doorConfig = null;
let doorChannel = 0;      // Channel for door activation
let doorLocked = true;    // Door lock state

// Door colors
const DOOR_COLOR_LOCKED = [0.8, 0.2, 0.2, 1.0];   // Red when locked
const DOOR_COLOR_UNLOCKED = [0.2, 0.8, 0.6, 1.0]; // Green when unlocked

// Load a level from BINARY file (new 162-byte format)
async function loadLevel(levelPath) {
    try {
        const response = await fetch(levelPath);
        if (!response.ok) {
            throw new Error(`Failed to load level: ${response.status}`);
        }

        // Read as ArrayBuffer for binary data
        const buffer = await response.arrayBuffer();
        const view = new Uint8Array(buffer);

        // Initialize 9x9 grids
        levelGrid = [];
        levelHeight = [];
        levelEntities = [];
        for (let i = 0; i < 9; i++) {
            levelGrid[i] = new Array(9).fill(0);
            levelHeight[i] = new Array(9).fill(0);
            levelEntities[i] = new Array(9).fill(0);
        }

        // Set constants
        GRID_SIZE = 9;
        CELL_SIZE = 2;
        ROOM_HEIGHT = GRID_SIZE * CELL_SIZE;

        // Parse 162-byte format: H[81] + E[81]
        // Height map: bytes 0-80
        for (let i = 0; i < 81; i++) {
            const row = Math.floor(i / 9);
            const col = i % 9;
            levelHeight[row][col] = view[i] || 0;
        }

        // Entity map: bytes 81-161
        let spawnIndex = 40; // Default center spawn
        let doorWall = 'z-'; // Default door wall
        let doorRow = 0;
        let doorCol = 0;

        // Clear pistons before creating new ones
        if (typeof clearPistons === 'function') {
            clearPistons();
        }

        for (let i = 0; i < 81; i++) {
            const entityByte = view[81 + i] || 0;
            const row = Math.floor(i / 9);
            const col = i % 9;
            levelEntities[row][col] = entityByte;

            if (entityByte === 0) {
                // Empty cell
                levelGrid[row][col] = 0;
            } else if (entityByte >= 1 && entityByte <= 15) {
                // Spawn location (value = spawn variant, 1 = default)
                spawnIndex = i;
                levelGrid[row][col] = 0; // Spawn is walkable
                console.log(`  Spawn at index ${i} (row ${row}, col ${col})`);
            } else if (entityByte >= 16 && entityByte <= 31) {
                // Pressure plate (channel = low 4 bits)
                const channel = entityByte & 0x0F;
                levelGrid[row][col] = 2; // Legacy type for rendering
                console.log(`  Pressure plate at index ${i} (row ${row}, col ${col}) channel ${channel}`);
                // Note: pressure plate creation happens in createRoomGeometry
            } else if (entityByte >= 128) {
                // Mechanism (bit 7 = 1)
                const mechType = (entityByte >> 4) & 0x07;
                const channel = entityByte & 0x0F;

                if (mechType === 0) {
                    // Door mechanism
                    doorWall = (col > 4) ? 'x+' : 'z-';
                    doorRow = row;
                    doorCol = col;
                    doorChannel = channel;
                    levelGrid[row][col] = 0;
                    console.log(`  Door at index ${i} (row ${row}, col ${col}) channel ${channel}, wall ${doorWall}`);
                } else if (mechType === 1) {
                    // Piston mechanism - create logic object immediately
                    createPiston(row, col, channel);
                    levelGrid[row][col] = 4; // New type for piston
                    console.log(`  Piston at index ${i} (row ${row}, col ${col}) channel ${channel}`);
                }
            } else if (entityByte === 32) {
                // Arrow
                levelGrid[row][col] = 1; // 1 = Arrow type (visual only)
                console.log(`  Arrow at index ${i} (row ${row}, col ${col})`);
            }
        }

        // Calculate spawn position
        const spawnRow = Math.floor(spawnIndex / 9);
        const spawnCol = spawnIndex % 9;
        const roomHalf = (GRID_SIZE * CELL_SIZE) / 2;
        const spawnX = (spawnCol * CELL_SIZE) - roomHalf + (CELL_SIZE / 2);
        const spawnZ = (spawnRow * CELL_SIZE) - roomHalf + (CELL_SIZE / 2);
        const spawnY = levelHeight[spawnRow][spawnCol] * CELL_SIZE;

        doorConfig = {
            row: doorRow,
            col: doorCol,
            wall: doorWall,
            width: 2.5,
            height: 3.5,
            color: DOOR_COLOR_LOCKED
        };

        // Reset door lock state for new level
        doorLocked = true;

        // Set player spawn
        setPlayerSpawn(spawnX, spawnY, spawnZ);
        resetPlayer();

        // Store current level
        currentLevel = { grid: levelGrid, door: doorConfig, height: levelHeight, entities: levelEntities };

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

    // Door won't open while locked
    if (doorLocked) return false;

    const roomHalf = getLevelRoomHalf();
    const dw = doorConfig.width / 2;
    const playerHalf = 0.7;  // Player cube half-size
    // Player stops at (roomHalf - margin - playerHalf), so check based on that
    const playerMaxPos = 8.7 - playerHalf;  // 8.0

    // Check vertical alignment (player must be at door level)
    const doorBaseY = (levelHeight[doorConfig.row] && levelHeight[doorConfig.row][doorConfig.col])
        ? levelHeight[doorConfig.row][doorConfig.col] * CELL_SIZE
        : 0;
    const playerY = player.position[1];

    // Allow some tolerance for stairs/ramps (approx player height + step)
    if (Math.abs(playerY - doorBaseY) > 2.0) return false;

    if (doorConfig.wall === 'z-') {
        const nearWall = playerZ <= -playerMaxPos;
        // Calculate door X center based on its column
        const [doorX, _] = gridToWorldCollision(doorConfig.row, doorConfig.col);
        const inDoorX = playerX > doorX - dw && playerX < doorX + dw;
        return nearWall && inDoorX;
    } else if (doorConfig.wall === 'x+') {
        const nearWall = playerX >= playerMaxPos;
        // Calculate door Z center based on its row
        const [_, doorZ] = gridToWorldCollision(doorConfig.row, doorConfig.col);
        const inDoorZ = playerZ > doorZ - dw && playerZ < doorZ + dw;
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
            loadLevel("levels/l" + levelNumber + ".bin").then(() => {
                console.log('Level ' + levelNumber + ' loaded!');
                // Clear ghosts for the new level
                clearGhosts();
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
// DOOR LOCK STATE
// =============================================================================

// Update door lock based on channel activation
function updateDoorLockState() {
    const channelActive = isChannelActive(doorChannel);

    // Unlock door when its channel is activated
    if (channelActive && doorLocked) {
        doorLocked = false;
        // Update door color to unlocked
        if (doorConfig) {
            doorConfig.color = DOOR_COLOR_UNLOCKED;
        }
        console.log(`Door unlocked! Channel ${doorChannel} activated.`);
        // Rebuild room to update door visuals
        if (window.refreshRoomBuffers) {
            window.refreshRoomBuffers();
        }
    } else if (!channelActive && !doorLocked) {
        // Re-lock door if channel is deactivated
        doorLocked = true;
        if (doorConfig) {
            doorConfig.color = DOOR_COLOR_LOCKED;
        }
        console.log(`Door locked! Channel ${doorChannel} deactivated.`);
        // Rebuild room to update door visuals
        if (window.refreshRoomBuffers) {
            window.refreshRoomBuffers();
        }
    }
}

// Check if door is currently locked
function isDoorLocked() {
    return doorLocked;
}

// Get current door color based on lock state
function getCurrentDoorColor() {
    return doorLocked ? DOOR_COLOR_LOCKED : DOOR_COLOR_UNLOCKED;
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
            const height = levelHeight[row] ? levelHeight[row][col] : 0;

            // If empty and no height, skip
            if (objectType === 0 && height === 0) continue;

            // If it's just a non-colliding object (like arrow/spawn) on flat ground, skip
            // Objects < 3 are non-solid unless they have height
            if (objectType < 3 && height === 0) continue;

            const [tileX, tileZ] = gridToWorldCollision(row, col);
            const tileHalf = cubeSize / 2;

            // Calculate collision box height
            // Base terrain height
            let collisionHeight = height * CELL_SIZE;

            // Add object height if it's a solid block (type 3=cube, 4=piston)
            if (objectType === 3) {
                collisionHeight += cubeHeight; // Cube sits on top of terrain
            } else if (objectType === 4) {
                // For pistons, we might need special handling, but for now treat base as solid
                // Piston logic handles its own extension collision usually, but let's at least collide with base
                collisionHeight += 0.5; // Piston base
            }

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
                // Allow landing if player is falling and feet are near the top
                if (playerY >= collisionHeight - 0.3 && playerY <= collisionHeight + 0.5 && player.velocityY <= 0) {
                    // More strict check for being directly above the tile (center-to-center)
                    const strictMinX = tileX - tileHalf - playerRadius * 0.8;
                    const strictMaxX = tileX + tileHalf + playerRadius * 0.8;
                    const strictMinZ = tileZ - tileHalf - playerRadius * 0.8;
                    const strictMaxZ = tileZ + tileHalf + playerRadius * 0.8;

                    if (playerX > strictMinX && playerX < strictMaxX &&
                        playerZ > strictMinZ && playerZ < strictMaxZ) {
                        // Land on top
                        player.position[1] = collisionHeight;
                        player.velocityY = 0;
                        player.isJumping = false;
                        standingOnTile = true;
                        continue;
                    }
                }

                // Horizontal collision (only if player is below the top of the tile)
                if (playerY < collisionHeight - 0.1) {
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

        // Get door base height from its grid position
        const doorBaseY = (levelHeight[doorConfig.row] && levelHeight[doorConfig.row][doorConfig.col])
            ? levelHeight[doorConfig.row][doorConfig.col] * CELL_SIZE
            : 0;

        // Convert grid position to world position for door center
        const [doorX, doorZ] = gridToWorld(doorConfig.row, doorConfig.col);

        if (doorConfig.wall === 'z-') {
            const z = -roomHalf + offset;
            // Use doorX from grid position instead of 0 (center)
            addQuad([doorX - dw, doorBaseY, z], [doorX - dw, doorBaseY + dh, z], [doorX + dw, doorBaseY + dh, z], [doorX + dw, doorBaseY, z], doorColor);
        } else if (doorConfig.wall === 'x+') {
            const x = roomHalf - offset;
            // Use doorZ from grid position instead of 0 (center)
            addQuad([x, doorBaseY, doorZ - dw], [x, doorBaseY + dh, doorZ - dw], [x, doorBaseY + dh, doorZ + dw], [x, doorBaseY, doorZ + dw], doorColor);
        }
    }

    // --- GRID OBJECTS ---
    const cubeSize = CELL_SIZE;
    const cubeHeight = CELL_SIZE;

    // Clear pressure plates for new level
    clearPressurePlates();

    // Arrow helper
    function addArrow(cx, cz, color) {
        const size = 1.5 * CELL_SIZE;
        const floatHeight = 2.0;
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
            const entityByte = levelEntities[row] ? levelEntities[row][col] : 0;
            const height = levelHeight[row] ? levelHeight[row][col] : 0;

            if (objectType === 0 && height === 0) continue;

            const [worldX, worldZ] = gridToWorld(row, col);
            const floorY = height * CELL_SIZE;
            const color = OBJECT_COLORS[objectType] || [0.5, 0.5, 0.5, 1.0];

            // Render height-based terrain
            if (height > 0) {
                const terrainColor = [0.45, 0.47, 0.52, 1.0];
                addBox(worldX - cubeSize / 2, 0, worldZ - cubeSize / 2, cubeSize, floorY, cubeSize, terrainColor);
            }

            if (objectType === 2) { // pressure plate
                const channel = entityByte & 0x0F;
                createPressurePlate(row, col, channel);
                const plateSize = CELL_SIZE * 0.7;
                addBox(worldX - plateSize / 2, floorY + 0.01, worldZ - plateSize / 2, plateSize, 0.08, plateSize, color);
            } else if (objectType === 4) { // piston
                // Piston logic object is created in loadLevel, just render here
                const piston = getPistonAt(row, col);
                const isExtended = piston ? piston.isExtended : false;

                // Brighter piston colors
                // Base: lighter gray
                const baseColor = [0.6, 0.6, 0.7, 1.0];
                // Head: brighter color when extended
                const headColor = isExtended ? [0.7, 0.7, 0.8, 1.0] : baseColor;

                if (isExtended) {
                    // Extended: Base (0.5) + Shaft (1.0) + Head (0.5) = 2.0 total height
                    // Base
                    addBox(worldX - cubeSize / 2, floorY, worldZ - cubeSize / 2, cubeSize, 0.5, cubeSize, baseColor);
                    // Shaft (narrower)
                    const shaftSize = cubeSize * 0.6;
                    addBox(worldX - shaftSize / 2, floorY + 0.5, worldZ - shaftSize / 2, shaftSize, 1.0, shaftSize, [0.4, 0.4, 0.5, 1.0]);
                    // Head
                    addBox(worldX - cubeSize / 2, floorY + 1.5, worldZ - cubeSize / 2, cubeSize, 0.5, cubeSize, headColor);
                } else {
                    // Retracted: Just the base/head flush with floor (height 0.5)
                    addBox(worldX - cubeSize / 2, floorY, worldZ - cubeSize / 2, cubeSize, 0.5, cubeSize, baseColor);
                }
            } else if (objectType === 3) { // cube (exit)
                addBox(worldX - cubeSize / 2, floorY, worldZ - cubeSize / 2, cubeSize, cubeHeight, cubeSize, color);
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

// Create arrow geometry separately for animation
function createArrowGeometry() {
    const positions = [];
    const colors = [];
    const normals = [];
    const indices = [];
    let vertexOffset = 0;

    const size = 1.5 * CELL_SIZE;
    const floatHeight = 2.0;
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
    const [tx1, tz1] = rot(-tailWidth / 2, 0);
    const [tx2, tz2] = rot(tailWidth / 2, 0);

    const arrowColor = OBJECT_COLORS[1] || [0.9, 0.2, 0.2, 1.0];

    // Convert grid position to world position (centered at origin)
    function gridToWorld(row, col) {
        return [
            (col - GRID_SIZE / 2 + 0.5) * CELL_SIZE,
            (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE
        ];
    }

    // Iterate through grid to find arrows
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objectType = levelGrid[row] ? levelGrid[row][col] : 0;
            if (objectType !== 1) continue;

            const [cx, cz] = gridToWorld(row, col);

            // Arrow head (triangle)
            positions.push(cx, tipY, cz, cx + hx1, headBaseY, cz + hz1, cx + hx2, headBaseY, cz + hz2);
            for (let i = 0; i < 3; i++) colors.push(...arrowColor);
            normals.push(0.7071, 0, 0.7071, 0.7071, 0, 0.7071, 0.7071, 0, 0.7071);
            indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
            vertexOffset += 3;

            // Arrow tail (quad)
            positions.push(
                cx + tx1, headBaseY, cz + tz1,
                cx + tx2, headBaseY, cz + tz2,
                cx + tx2, tailTopY, cz + tz2,
                cx + tx1, tailTopY, cz + tz1
            );
            for (let i = 0; i < 4; i++) colors.push(...arrowColor);
            for (let i = 0; i < 4; i++) normals.push(0.7071, 0, 0.7071);
            indices.push(
                vertexOffset, vertexOffset + 1, vertexOffset + 2,
                vertexOffset, vertexOffset + 2, vertexOffset + 3
            );
            vertexOffset += 4;
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
