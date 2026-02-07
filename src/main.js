// =============================================================================
// MAIN ENTRY POINT
// =============================================================================
// Shader Sources
const vsSource = `
  attribute vec4 aPosition;
  attribute vec4 aColor;
  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;
  varying lowp vec4 vColor;
  void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;
    vColor = aColor;
  }
`;

const fsSource = `
  varying lowp vec4 vColor;
  void main() {
    gl_FragColor = vColor;
  }
`;

// =============================================================================
// GAME INITIALIZATION
// =============================================================================
function main() {
    const canvas = document.getElementById('glCanvas');

    let lastWidth = 0;
    let lastHeight = 0;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gl = canvas.getContext('webgl', {
        antialias: false,
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

    // Create geometry
    const room = createRoomGeometry();
    const ghostGeom = createGhostGeometry();
    const playerGeom = createPlayerGeometry();

    // Room buffers
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);

    const colBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);

    // Ghost buffers
    const ghostPosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ghostGeom.positions, gl.STATIC_DRAW);

    const ghostColBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ghostGeom.colors, gl.STATIC_DRAW);

    const ghostIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ghostGeom.indices, gl.STATIC_DRAW);

    // Player buffers
    const playerPosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, playerGeom.positions, gl.STATIC_DRAW);

    const playerColBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, playerColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, playerGeom.colors, gl.STATIC_DRAW);

    const playerIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, playerGeom.indices, gl.STATIC_DRAW);

    // Attribute & uniform locations
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const uModelMatrix = gl.getUniformLocation(program, 'uModelMatrix');
    const uViewMatrix = gl.getUniformLocation(program, 'uViewMatrix');
    const uProjection = gl.getUniformLocation(program, 'uProjectionMatrix');

    // Identity matrix for room
    const identityMatrix = new Float32Array(16);
    mat4Identity(identityMatrix);

    // Character model matrix (reused for player and ghosts)
    const characterModelMatrix = new Float32Array(16);

    // WebGL state
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.useProgram(program);

    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aColor);

    const indexCount = room.indexCount;
    const ghostIndexCount = ghostGeom.indexCount;
    const playerIndexCount = playerGeom.indexCount;

    // Setup input with callback for first input
    setupPlayerInput(canvas, () => {
        if (isWaitingForInput()) {
            startTimeLoop(performance.now());
            return true;
        }
        return false;
    });

    // Also handle keyboard starting the loop
    const originalUpdatePlayer = updatePlayer;

    // =============================================================================
    // RENDER LOOP
    // =============================================================================
    function render(timestamp) {
        // Update projection on resize
        if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
            lastWidth = canvas.width;
            lastHeight = canvas.height;
            gl.viewport(0, 0, lastWidth, lastHeight);
            
            // Calculate proper bounds to fit isometric room
            const aspect = lastWidth / lastHeight;
            const roomSize = GRID_SIZE * CELL_SIZE; // 18 units
            const bounds = calculateIsometricFitBounds(roomSize, ROOM_HEIGHT, 0.15);
            
            // Determine view size based on aspect ratio
            // We want to fit the room with margin in both dimensions
            const verticalSize = bounds.spanY / 2;
            const horizontalSize = bounds.spanX / 2;
            
            // Choose the limiting dimension
            let viewSize;
            if (horizontalSize / aspect > verticalSize) {
                // Width is the limiting factor
                viewSize = horizontalSize / aspect;
            } else {
                // Height is the limiting factor
                viewSize = verticalSize;
            }
            
            // Calculate window bounds with offset to center the room
            const halfHeight = viewSize;
            const halfWidth = viewSize * aspect;
            
            mat4Orthographic(_projMatrix, 
                bounds.centerX - halfWidth, bounds.centerX + halfWidth,   // left, right
                bounds.centerY - halfHeight, bounds.centerY + halfHeight, // bottom, top
                -100.0, 100.0);                          // near, far (increased range to ensure nothing is clipped)
            gl.uniformMatrix4fv(uProjection, false, _projMatrix);
        }

        // Time loop logic
        updateTimeLoop(timestamp);

        // Handle first input starting the loop
        if (isPlayerActive() && isWaitingForInput() && hasPlayerInput()) {
            startTimeLoop(timestamp);
        }

        // Update player (only moves if loop has started)
        if (isPlayerActive() && !isWaitingForInput()) {
            updatePlayer();
            handleGhostCollisions(timestamp);
            recordFrame(timestamp);

            // Update pressure plates
            updatePressurePlates();

            // Check door collision
            updateDoorCollision();
        }

        // Clear and render
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Isometric view matrix (fixed camera angle)
        mat4IsometricView(_viewMatrix);
        gl.uniformMatrix4fv(uViewMatrix, false, _viewMatrix);

        // Draw room
        gl.uniformMatrix4fv(uModelMatrix, false, identityMatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

        // Enable blending for semi-transparent characters
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Draw player (yellow/gold)
        const playerPos = getPlayerPosition();
        gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuf);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerColBuf);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf);
        getGhostModelMatrix(characterModelMatrix, playerPos[0], playerPos[1], playerPos[2], 0);
        gl.uniformMatrix4fv(uModelMatrix, false, characterModelMatrix);
        gl.drawElements(gl.TRIANGLES, playerIndexCount, gl.UNSIGNED_SHORT, 0);

        // Draw ghosts (blue)
        const ghostList = getGhosts();
        if (ghostList.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf);
            gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf);
            gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf);

            for (const ghost of ghostList) {
                const frame = getGhostFrame(ghost);
                if (frame) {
                    const modelMatrix = getGhostModelMatrixForFrame(frame);
                    gl.uniformMatrix4fv(uModelMatrix, false, modelMatrix);
                    gl.drawElements(gl.TRIANGLES, ghostIndexCount, gl.UNSIGNED_SHORT, 0);
                }
            }
        }

        gl.disable(gl.BLEND);

        requestAnimationFrame(render);
    }

    // Start time loop when game becomes active
    setTimeLoopRunning(true);

    render(performance.now());
}

main();
