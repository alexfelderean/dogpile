// =============================================================================
// ROOM GEOMETRY
// =============================================================================
function createRoomGeometry() {
    const size = 5;      // Half-size of room
    const height = 3;    // Room height

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

    // Floor (dark gray)
    addQuad(
        [-size, 0, -size],
        [size, 0, -size],
        [size, 0, size],
        [-size, 0, size],
        [0.2, 0.2, 0.22, 1.0]
    );

    // Ceiling (dark blue-gray)
    addQuad(
        [-size, height, size],
        [size, height, size],
        [size, height, -size],
        [-size, height, -size],
        [0.15, 0.15, 0.2, 1.0]
    );

    // Back wall (blue-gray) - Z negative
    addQuad(
        [-size, 0, -size],
        [-size, height, -size],
        [size, height, -size],
        [size, 0, -size],
        [0.3, 0.35, 0.4, 1.0]
    );

    // Front wall (gray) - Z positive
    addQuad(
        [size, 0, size],
        [size, height, size],
        [-size, height, size],
        [-size, 0, size],
        [0.35, 0.35, 0.38, 1.0]
    );

    // Left wall (slate) - X negative
    addQuad(
        [-size, 0, size],
        [-size, height, size],
        [-size, height, -size],
        [-size, 0, -size],
        [0.28, 0.3, 0.35, 1.0]
    );

    // Right wall with door cutout
    addQuad(
        [size, 2.2, -1],
        [size, height, -1],
        [size, height, 1],
        [size, 2.2, 1],
        [0.32, 0.34, 0.38, 1.0]
    );

    addQuad(
        [size, 0, size],
        [size, height, size],
        [size, height, 1],
        [size, 0, 1],
        [0.32, 0.34, 0.38, 1.0]
    );

    addQuad(
        [size, 0, -1],
        [size, height, -1],
        [size, height, -size],
        [size, 0, -size],
        [0.32, 0.34, 0.38, 1.0]
    );

    // Exit door (vibrant green-cyan)
    const doorInset = 0.02;
    addQuad(
        [size - doorInset, 0, -1],
        [size - doorInset, 2.2, -1],
        [size - doorInset, 2.2, 1],
        [size - doorInset, 0, 1],
        [0.2, 0.8, 0.6, 1.0]
    );

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}
