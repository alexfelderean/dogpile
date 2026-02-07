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

// Shared shader compilation
export function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
}

// Shared AABB collision helper - returns push direction or null
export function aabbCollision(px, py, pz, playerRadius, objX, objZ, objHalf, objHeight, player) {
    const minX = objX - objHalf - playerRadius, maxX = objX + objHalf + playerRadius;
    const minZ = objZ - objHalf - playerRadius, maxZ = objZ + objHalf + playerRadius;
    if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
        // Standing on top check
        if (py >= objHeight - 0.3 && py <= objHeight + 0.5 && player.velocityY <= 0) {
            const strictMinX = objX - objHalf - playerRadius * 0.8;
            const strictMaxX = objX + objHalf + playerRadius * 0.8;
            const strictMinZ = objZ - objHalf - playerRadius * 0.8;
            const strictMaxZ = objZ + objHalf + playerRadius * 0.8;
            if (px > strictMinX && px < strictMaxX && pz > strictMinZ && pz < strictMaxZ) {
                return { type: 'top', height: objHeight };
            }
        }
        // Side collision
        if (py < objHeight - 0.1) {
            const overlapLeft = maxX - px, overlapRight = px - minX;
            const overlapBack = maxZ - pz, overlapFront = pz - minZ;
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapBack, overlapFront);
            if (minOverlap === overlapLeft) return { type: 'side', axis: 'x', value: maxX };
            if (minOverlap === overlapRight) return { type: 'side', axis: 'x', value: minX };
            if (minOverlap === overlapBack) return { type: 'side', axis: 'z', value: maxZ };
            if (minOverlap === overlapFront) return { type: 'side', axis: 'z', value: minZ };
        }
    }
    return null;
}
