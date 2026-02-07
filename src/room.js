// =============================================================================
// ROOM GEOMETRY - Grid-based Level System
// =============================================================================

// 9x9 Grid Level Definition
// 0 = empty
// 1 = red cube
// 2 = blue cube
// 3 = green cube (exit/goal)
// Add more object types as needed

const GRID_SIZE = 9;
const CELL_SIZE = 2;  // Each cell is 1x1 unit
const ROOM_HEIGHT = GRID_SIZE * CELL_SIZE;  // Room height matches room width/length

// Initialize 9x9 grid with all zeros
const levelGrid = [];
for (let i = 0; i < GRID_SIZE; i++) {
    levelGrid[i] = [];
    for (let j = 0; j < GRID_SIZE; j++) {
        levelGrid[i][j] = 0;
    }
}

// Define level by setting specific grid positions
// Format: levelGrid[row][col] = objectType
levelGrid[1][2] = 1;  // Red cube at position (1, 2)
levelGrid[4][3] = 2;  // Blue cube at position (4, 3)
levelGrid[7][7] = 3;  // Green cube (exit) at position (7, 7)
levelGrid[2][5] = 1;  // Another red cube
levelGrid[5][6] = 2;  // Another blue cube

// Object colors by type
const OBJECT_COLORS = {
    1: [0.9, 0.2, 0.2, 1.0],  // Red
    2: [0.2, 0.4, 0.9, 1.0],  // Blue
    3: [0.2, 0.9, 0.5, 1.0],  // Green (exit)
};

// =============================================================================
// GEOMETRY CREATION
// =============================================================================
function createRoomGeometry() {
    const roomHalf = (GRID_SIZE * CELL_SIZE) / 2;

    const positions = [];
    const colors = [];
    const indices = [];
    let vertexOffset = 0;

    // Helper to add a quad
    function addQuad(p1, p2, p3, p4, color) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) colors.push(...color);
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

        // Top
        addQuad([x1, y2, z2], [x2, y2, z2], [x2, y2, z1], [x1, y2, z1], color);
        // Bottom
        addQuad([x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2], color);
        // Front (Z+)
        addQuad([x2, y1, z2], [x2, y2, z2], [x1, y2, z2], [x1, y1, z2], color);
        // Back (Z-)
        addQuad([x1, y1, z1], [x1, y2, z1], [x2, y2, z1], [x2, y1, z1], color);
        // Right (X+)
        addQuad([x2, y1, z1], [x2, y2, z1], [x2, y2, z2], [x2, y1, z2], color);
        // Left (X-)
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
        [0.2, 0.2, 0.22, 1.0]
    );

    // --- CEILING ---
    addQuad(
        [-roomHalf, ROOM_HEIGHT, roomHalf],
        [roomHalf, ROOM_HEIGHT, roomHalf],
        [roomHalf, ROOM_HEIGHT, -roomHalf],
        [-roomHalf, ROOM_HEIGHT, -roomHalf],
        [0.15, 0.15, 0.2, 1.0]
    );

    // --- WALLS ---
    const wallColor = [0.3, 0.32, 0.36, 1.0];

    // Back wall (Z-)
    addQuad(
        [-roomHalf, 0, -roomHalf],
        [-roomHalf, ROOM_HEIGHT, -roomHalf],
        [roomHalf, ROOM_HEIGHT, -roomHalf],
        [roomHalf, 0, -roomHalf],
        wallColor
    );
    // Front wall (Z+)
    addQuad(
        [roomHalf, 0, roomHalf],
        [roomHalf, ROOM_HEIGHT, roomHalf],
        [-roomHalf, ROOM_HEIGHT, roomHalf],
        [-roomHalf, 0, roomHalf],
        wallColor
    );
    // Left wall (X-)
    addQuad(
        [-roomHalf, 0, roomHalf],
        [-roomHalf, ROOM_HEIGHT, roomHalf],
        [-roomHalf, ROOM_HEIGHT, -roomHalf],
        [-roomHalf, 0, -roomHalf],
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

    // --- GRID OBJECTS ---
    // Cubes fill the entire grid cell
    const cubeSize = CELL_SIZE;
    const cubeHeight = CELL_SIZE;

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const objectType = levelGrid[row][col];
            if (objectType === 0) continue;

            const [worldX, worldZ] = gridToWorld(row, col);
            const color = OBJECT_COLORS[objectType] || [0.5, 0.5, 0.5, 1.0];

            // Add a cube at this grid position
            addBox(
                worldX - cubeSize / 2,
                0,
                worldZ - cubeSize / 2,
                cubeSize,
                cubeHeight,
                cubeSize,
                color
            );
        }
    }

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}
