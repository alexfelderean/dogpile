// --- Shader Sources ---
const vsSource = `
  attribute vec4 aPosition;
  attribute vec4 aColor;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;
  varying lowp vec4 vColor;
  void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * aPosition;
    vColor = aColor;
  }
`;

const fsSource = `
  varying lowp vec4 vColor;
  void main() {
    gl_FragColor = vColor;
  }
`;

// --- Matrix Utilities ---
// Pre-allocated matrices to avoid per-frame allocations
const _viewMatrix = new Float32Array(16);
const _projMatrix = new Float32Array(16);
const _tempVec3 = new Float32Array(3);

function mat4Perspective(out, fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
}

function mat4Identity(out) {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
}

function mat4Translate(out, v) {
    out[12] += out[0] * v[0] + out[4] * v[1] + out[8] * v[2];
    out[13] += out[1] * v[0] + out[5] * v[1] + out[9] * v[2];
    out[14] += out[2] * v[0] + out[6] * v[1] + out[10] * v[2];
    out[15] += out[3] * v[0] + out[7] * v[1] + out[11] * v[2];
}

function mat4RotateX(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const a10 = out[4], a11 = out[5], a12 = out[6], a13 = out[7];
    const a20 = out[8], a21 = out[9], a22 = out[10], a23 = out[11];
    out[4] = a10 * c + a20 * s; out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s; out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s; out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s; out[11] = a23 * c - a13 * s;
}

function mat4RotateY(out, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const a00 = out[0], a01 = out[1], a02 = out[2], a03 = out[3];
    const a20 = out[8], a21 = out[9], a22 = out[10], a23 = out[11];
    out[0] = a00 * c - a20 * s; out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s; out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c; out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c; out[11] = a03 * s + a23 * c;
}

// --- Camera ---
const camera = {
    position: [0, 1.6, 0],  // Eye height
    yaw: 0,                  // Horizontal rotation (radians)
    pitch: 0,                // Vertical rotation (radians)
    speed: 0.08,
    sensitivity: 0.002
};

// Build camera view matrix into pre-allocated array
function getCameraViewMatrix(out) {
    mat4Identity(out);

    // First rotate, then translate (inverse of camera transform)
    mat4RotateX(out, -camera.pitch);
    mat4RotateY(out, -camera.yaw);

    // Reuse temp vector for translation
    _tempVec3[0] = -camera.position[0];
    _tempVec3[1] = -camera.position[1];
    _tempVec3[2] = -camera.position[2];
    mat4Translate(out, _tempVec3);
}

// --- Input Handling ---
const keys = {};
let isPointerLocked = false;

function setupInput(canvas) {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked) return;

        camera.yaw -= e.movementX * camera.sensitivity;
        camera.pitch -= e.movementY * camera.sensitivity;

        // Clamp pitch to prevent flipping
        if (camera.pitch > 1.57) camera.pitch = 1.57;
        else if (camera.pitch < -1.57) camera.pitch = -1.57;
    });

    // Pointer lock
    const overlay = document.getElementById('overlay');
    const crosshair = document.getElementById('crosshair');

    overlay.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
        overlay.classList.toggle('hidden', isPointerLocked);
        crosshair.classList.toggle('hidden', !isPointerLocked);
    });
}

// Pre-calculated sin/cos for movement
function updateCamera() {
    if (!isPointerLocked) return;

    const sinYaw = Math.sin(camera.yaw);
    const cosYaw = Math.cos(camera.yaw);
    const speed = camera.speed;

    // WASD movement
    if (keys['KeyW']) {
        camera.position[0] -= sinYaw * speed;
        camera.position[2] -= cosYaw * speed;
    }
    if (keys['KeyS']) {
        camera.position[0] += sinYaw * speed;
        camera.position[2] += cosYaw * speed;
    }
    if (keys['KeyA']) {
        camera.position[0] -= cosYaw * speed;
        camera.position[2] += sinYaw * speed;
    }
    if (keys['KeyD']) {
        camera.position[0] += cosYaw * speed;
        camera.position[2] -= sinYaw * speed;
    }

    // Clamp position to room bounds
    const roomHalfSize = 4.5;
    if (camera.position[0] > roomHalfSize) camera.position[0] = roomHalfSize;
    else if (camera.position[0] < -roomHalfSize) camera.position[0] = -roomHalfSize;
    if (camera.position[2] > roomHalfSize) camera.position[2] = roomHalfSize;
    else if (camera.position[2] < -roomHalfSize) camera.position[2] = -roomHalfSize;
}

// --- Room Geometry ---
function createRoomGeometry() {
    const size = 5;      // Half-size of room
    const height = 3;    // Room height

    // Positions for each face (floor, ceiling, 4 walls)
    const positions = [];
    const colors = [];
    const indices = [];
    let vertexOffset = 0;

    // Helper to add a quad
    function addQuad(p1, p2, p3, p4, color) {
        positions.push(...p1, ...p2, ...p3, ...p4);
        for (let i = 0; i < 4; i++) {
            colors.push(...color);
        }
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

    // Right wall with door cutout (two parts)
    // Right wall - top part above door
    addQuad(
        [size, 2.2, -1],
        [size, height, -1],
        [size, height, 1],
        [size, 2.2, 1],
        [0.32, 0.34, 0.38, 1.0]
    );

    // Right wall - left of door
    addQuad(
        [size, 0, size],
        [size, height, size],
        [size, height, 1],
        [size, 0, 1],
        [0.32, 0.34, 0.38, 1.0]
    );

    // Right wall - right of door
    addQuad(
        [size, 0, -1],
        [size, height, -1],
        [size, height, -size],
        [size, 0, -size],
        [0.32, 0.34, 0.38, 1.0]
    );

    // Exit door (vibrant green-cyan) - inset slightly
    const doorInset = 0.02;
    addQuad(
        [size - doorInset, 0, -1],
        [size - doorInset, 2.2, -1],
        [size - doorInset, 2.2, 1],
        [size - doorInset, 0, 1],
        [0.2, 0.8, 0.6, 1.0]
    );

    // Door frame (darker)
    const frameWidth = 0.08;
    // Left frame
    addQuad(
        [size - doorInset + 0.01, 0, 1],
        [size - doorInset + 0.01, 2.2, 1],
        [size - doorInset + 0.01, 2.2, 1 + frameWidth],
        [size - doorInset + 0.01, 0, 1 + frameWidth],
        [0.1, 0.1, 0.12, 1.0]
    );
    // Right frame
    addQuad(
        [size - doorInset + 0.01, 0, -1 - frameWidth],
        [size - doorInset + 0.01, 2.2, -1 - frameWidth],
        [size - doorInset + 0.01, 2.2, -1],
        [size - doorInset + 0.01, 0, -1],
        [0.1, 0.1, 0.12, 1.0]
    );
    // Top frame
    addQuad(
        [size - doorInset + 0.01, 2.2, -1],
        [size - doorInset + 0.01, 2.2 + frameWidth, -1],
        [size - doorInset + 0.01, 2.2 + frameWidth, 1],
        [size - doorInset + 0.01, 2.2, 1],
        [0.1, 0.1, 0.12, 1.0]
    );

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices),
        indexCount: indices.length
    };
}

// --- Main ---
function main() {
    const canvas = document.getElementById('glCanvas');

    // Track if projection needs update
    let projectionDirty = true;
    let lastWidth = 0;
    let lastHeight = 0;

    // Set canvas to full window size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        projectionDirty = true;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gl = canvas.getContext('webgl', {
        antialias: false,  // Disable antialiasing for better performance
        powerPreference: 'high-performance'
    });
    if (!gl) { alert('WebGL not supported'); return; }

    // Compile shaders
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return;
    }

    // Create room geometry
    const room = createRoomGeometry();

    // Create buffers
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);

    const colBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);

    // Attribute & uniform locations
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const uViewMatrix = gl.getUniformLocation(program, 'uViewMatrix');
    const uProjection = gl.getUniformLocation(program, 'uProjectionMatrix');

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Set clear color once
    gl.clearColor(0.05, 0.05, 0.08, 1.0);

    // Use program once (we only have one)
    gl.useProgram(program);

    // Set up vertex attributes once (they don't change)
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);

    // Setup input handling
    setupInput(canvas);

    // Cache index count
    const indexCount = room.indexCount;

    function render() {
        // Only update projection if canvas size changed
        if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
            lastWidth = canvas.width;
            lastHeight = canvas.height;
            gl.viewport(0, 0, lastWidth, lastHeight);
            mat4Perspective(_projMatrix, 70 * Math.PI / 180, lastWidth / lastHeight, 0.1, 100.0);
            gl.uniformMatrix4fv(uProjection, false, _projMatrix);
        }

        // Update camera based on input
        updateCamera();

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // View matrix from camera (writes to pre-allocated _viewMatrix)
        getCameraViewMatrix(_viewMatrix);
        gl.uniformMatrix4fv(uViewMatrix, false, _viewMatrix);

        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(render);
    }

    render();
}

main();
