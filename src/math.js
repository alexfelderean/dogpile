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

export function mat4Translate(out, x, y, z) {
    out[12] += out[0] * x + out[4] * y + out[8] * z;
    out[13] += out[1] * x + out[5] * y + out[9] * z;
    out[14] += out[2] * x + out[6] * y + out[10] * z;
    out[15] += out[3] * x + out[7] * y + out[11] * z;
}

export function mat4RotateY(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const a00 = out[0], a01 = out[1], a02 = out[2], a03 = out[3];
    const a20 = out[8], a21 = out[9], a22 = out[10], a23 = out[11];
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
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
// objHeight is the height of the object, baseY is the world Y position of its base
export function aabbCollision(px, py, pz, playerRadius, objX, objZ, objHalf, objHeight, player, baseY = 0) {
    const minX = objX - objHalf - playerRadius, maxX = objX + objHalf + playerRadius;
    const minZ = objZ - objHalf - playerRadius, maxZ = objZ + objHalf + playerRadius;
    const topY = baseY + objHeight; // Absolute Y position of the object's top
    if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
        // Standing on top check
        if (py >= topY - 0.3 && py <= topY + 0.5 && player.velocityY <= 0) {
            const strictMinX = objX - objHalf - playerRadius * 0.8;
            const strictMaxX = objX + objHalf + playerRadius * 0.8;
            const strictMinZ = objZ - objHalf - playerRadius * 0.8;
            const strictMaxZ = objZ + objHalf + playerRadius * 0.8;
            if (px > strictMinX && px < strictMaxX && pz > strictMinZ && pz < strictMaxZ) {
                return { type: 'top', height: topY };
            }
        }
        // Check if player is being pushed up from below (piston extending)
        // If player is within the object's XZ bounds and below the top, push up
        const strictMinX = objX - objHalf - playerRadius * 0.8;
        const strictMaxX = objX + objHalf + playerRadius * 0.8;
        const strictMinZ = objZ - objHalf - playerRadius * 0.8;
        const strictMaxZ = objZ + objHalf + playerRadius * 0.8;
        if (py < topY && py > baseY && px > strictMinX && px < strictMaxX && pz > strictMinZ && pz < strictMaxZ) {
            return { type: 'top', height: topY };
        }
        // Side collision - only push sideways if player is clearly below AND outside the strict bounds
        if (py < topY - 0.1 && py > baseY) {
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
