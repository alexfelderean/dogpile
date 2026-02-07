// =============================================================================
// MATH UTILITIES
// =============================================================================
// Pre-allocated matrices to avoid per-frame allocations
export const _viewMatrix = new Float32Array(16);
export const _projMatrix = new Float32Array(16);
export const _tempVec3 = new Float32Array(3);

export function mat4Perspective(out, fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
}

export function mat4Orthographic(out, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
    out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1;
}

// Isometric view matrix - fixed camera looking at origin
export function mat4IsometricView(out) {
    // Isometric angles: 45° Y rotation, ~35.264° X tilt (arctan(1/sqrt(2)))
    const yaw = Math.PI / 4;      // 45 degrees
    const pitch = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees

    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);

    // Combined rotation matrix (pitch * yaw) then translate back
    const dist = 80; // Camera distance from origin (increased to avoid clipping)

    out[0] = cy; out[1] = sy * sp; out[2] = -sy * cp; out[3] = 0;
    out[4] = 0; out[5] = cp; out[6] = sp; out[7] = 0;
    out[8] = sy; out[9] = -cy * sp; out[10] = cy * cp; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = -dist; out[15] = 1;
}

export function mat4Identity(out) {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
}

export function mat4Translate(out, v) {
    out[12] += out[0] * v[0] + out[4] * v[1] + out[8] * v[2];
    out[13] += out[1] * v[0] + out[5] * v[1] + out[9] * v[2];
    out[14] += out[2] * v[0] + out[6] * v[1] + out[10] * v[2];
    out[15] += out[3] * v[0] + out[7] * v[1] + out[11] * v[2];
}

export function mat4RotateX(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const a10 = out[4], a11 = out[5], a12 = out[6], a13 = out[7];
    const a20 = out[8], a21 = out[9], a22 = out[10], a23 = out[11];
    out[4] = a10 * c + a20 * s; out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s; out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s; out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s; out[11] = a23 * c - a13 * s;
}

export function mat4RotateY(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const a00 = out[0], a01 = out[1], a02 = out[2], a03 = out[3];
    const a20 = out[8], a21 = out[9], a22 = out[10], a23 = out[11];
    out[0] = a00 * c - a20 * s; out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s; out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c; out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c; out[11] = a03 * s + a23 * c;
}

// Calculate orthographic bounds to fit the room in isometric view
// Returns the optimal viewSize to fit the room with the given margin
export function calculateIsometricFitBounds(roomSize, roomHeight, marginPercent = 0.15) {
    // Room bounds in world space (centered at origin)
    const halfSize = roomSize / 2;

    // 8 corners of the room box
    const corners = [
        [-halfSize, 0, -halfSize],
        [halfSize, 0, -halfSize],
        [halfSize, 0, halfSize],
        [-halfSize, 0, halfSize],
        [-halfSize, roomHeight, -halfSize],
        [halfSize, roomHeight, -halfSize],
        [halfSize, roomHeight, halfSize],
        [-halfSize, roomHeight, halfSize]
    ];

    // Transform each corner through the isometric view
    const yaw = Math.PI / 4;
    const pitch = Math.atan(1 / Math.sqrt(2));
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const [x, y, z] of corners) {
        // Apply rotation (same as in mat4IsometricView)
        const tx = cy * x + sy * z;
        const ty = sy * sp * x + cp * y - cy * sp * z;

        minX = Math.min(minX, tx);
        maxX = Math.max(maxX, tx);
        minY = Math.min(minY, ty);
        maxY = Math.max(maxY, ty);
    }

    // Calculate the span needed
    const spanX = maxX - minX;
    const spanY = maxY - minY;

    // Add margin
    const margin = 1 + marginPercent;

    return {
        spanX: spanX * margin,
        spanY: spanY * margin,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
}
