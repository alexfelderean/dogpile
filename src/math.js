// Math utilities - pre-allocated matrices
export const _viewMatrix = new Float32Array(16);
export const _projMatrix = new Float32Array(16);

export function mat4Orthographic(out, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
    out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1;
}

export function mat4IsometricView(out) {
    const yaw = Math.PI / 4;
    const pitch = Math.atan(1 / Math.sqrt(2));
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const dist = 80;
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

export function calculateIsometricFitBounds(roomSize, roomHeight, marginPercent = 0.15) {
    const halfSize = roomSize / 2;
    const corners = [
        [-halfSize, 0, -halfSize], [halfSize, 0, -halfSize],
        [halfSize, 0, halfSize], [-halfSize, 0, halfSize],
        [-halfSize, roomHeight, -halfSize], [halfSize, roomHeight, -halfSize],
        [halfSize, roomHeight, halfSize], [-halfSize, roomHeight, halfSize]
    ];
    const yaw = Math.PI / 4;
    const pitch = Math.atan(1 / Math.sqrt(2));
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const [x, y, z] of corners) {
        const tx = cy * x + sy * z;
        const ty = sy * sp * x + cp * y - cy * sp * z;
        minX = Math.min(minX, tx); maxX = Math.max(maxX, tx);
        minY = Math.min(minY, ty); maxY = Math.max(maxY, ty);
    }
    const margin = 1 + marginPercent;
    return {
        spanX: (maxX - minX) * margin,
        spanY: (maxY - minY) * margin,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
}
