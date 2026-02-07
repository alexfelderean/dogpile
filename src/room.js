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
let levelLoaded = false;
let levelNumber = 1;

// Level properties (set after loading)
let GRID_SIZE = 9;
let CELL_SIZE = 2;
let ROOM_HEIGHT = 18;
let levelGrid = [];
let doorConfig = null;

// Load a level from JSON file
async function loadLevel(levelPath) {
    try {
        const response = await fetch(levelPath);
        if (!response.ok) {
            throw new Error(`Failed to load level: ${response.status}`);
        }
        currentLevel = await response.json();

        // Set level properties from loaded data
        GRID_SIZE = currentLevel.gridSize || 9;
        CELL_SIZE = currentLevel.cellSize || 2;
        ROOM_HEIGHT = GRID_SIZE * CELL_SIZE;
        levelGrid = currentLevel.grid || [];
        doorConfig = currentLevel.door || null;

        levelLoaded = true;
        console.log(`Loaded level from ${levelPath}`);
        return currentLevel;
    } catch (error) {
        console.error('Error loading level:', error);
        throw error;
    }
}

// Check if level is loaded
function isLevelLoaded() {
    return levelLoaded && currentLevel !== null;
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
    const collisionDist = 0.5;

    if (doorConfig.wall === 'z-') {
        const nearWall = playerZ < -roomHalf + collisionDist;
        const inDoorX = playerX > -dw && playerX < dw;
        return nearWall && inDoorX;
    } else if (doorConfig.wall === 'x+') {
        const nearWall = playerX > roomHalf - collisionDist;
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
            loadLevel("levels/level" + levelNumber + ".json").then(() => {
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
// GEOMETRY CREATION
// =============================================================================
function createRoomGeometry() {
    if (!levelLoaded) {
        throw new Error('Cannot create room geometry - no level loaded!');
    }

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
