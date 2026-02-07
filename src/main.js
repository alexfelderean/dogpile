// =============================================================================
// MAIN ENTRY POINT
// =============================================================================
// Shader Sources
const vsSource = `
  attribute vec4 aPosition;
  attribute vec3 aNormal;
  attribute vec4 aColor;
  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;
  varying lowp vec4 vColor;
  varying highp vec3 vNormal;
  varying highp vec3 vWorldPos;
  void main() {
    vec4 worldPos = uModelMatrix * aPosition;
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    vColor = aColor;
    // Transform normal to world space (for uniform scale, this works)
    vNormal = mat3(uModelMatrix) * aNormal;
    vWorldPos = worldPos.xyz;
  }
`;

const fsSource = `
  precision highp float;
  varying lowp vec4 vColor;
  varying highp vec3 vNormal;
  varying highp vec3 vWorldPos;
  uniform vec3 uLightDir;
  uniform vec3 uAmbientColor;
  uniform vec3 uLightColor;
  
  void main() {
    // Normalize interpolated normal
    vec3 normal = normalize(vNormal);
    
    // Diffuse lighting
    float diff = max(dot(normal, uLightDir), 0.0);
    
    // Combine ambient and diffuse
    vec3 ambient = uAmbientColor * vColor.rgb;
    vec3 diffuse = uLightColor * diff * vColor.rgb;
    
    vec3 finalColor = ambient + diffuse;
    
    gl_FragColor = vec4(finalColor, vColor.a);
  }
`;

// =============================================================================
// GAME INITIALIZATION
// =============================================================================
async function main() {
    // Load level first
    await loadLevel('levels/level1.json');

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

    // Create geometry (level must be loaded first)
    let room = createRoomGeometry();
    const ghostGeom = createGhostGeometry();
    const playerGeom = createPlayerGeometry();

    // Track room index count (can change per level)
    let indexCount = room.indexCount;

    // Room buffers
    const posBuf = gl.createBuffer();
    const colBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer();

    // Level transition state
    let levelTransitionY = -40; // Start below screen
    let targetLevelTransitionY = 0;
    let transitionCallback = null;
    let transitionVelocity = 0;

    // Function to trigger level exit animation
    function transitionLevelOut(callback) {
        targetLevelTransitionY = 40; // Animate up/out (must match render threshold)
        transitionCallback = callback;
        transitionVelocity = 0.2; // Start slow
    }
    window.transitionLevelOut = transitionLevelOut;

    // Function to update room buffers (called when level changes)
    function updateRoomBuffers() {
        room = createRoomGeometry();
        indexCount = room.indexCount;

        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);

        // Reset transition to animate up from below
        levelTransitionY = -40;
        targetLevelTransitionY = 0;
        transitionCallback = null;
        transitionVelocity = 0;

        console.log('Room buffers updated for new level');
    }

    // Make rebuildRoom available globally for level transitions
    window.rebuildRoomGeometry = updateRoomBuffers;

    // Initial buffer upload
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);

    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.normals, gl.STATIC_DRAW);

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

    const ghostNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ghostGeom.normals, gl.STATIC_DRAW);

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

    const playerNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, playerNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, playerGeom.normals, gl.STATIC_DRAW);

    // Attribute & uniform locations
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aNormal = gl.getAttribLocation(program, 'aNormal');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const uModelMatrix = gl.getUniformLocation(program, 'uModelMatrix');
    const uViewMatrix = gl.getUniformLocation(program, 'uViewMatrix');
    const uProjection = gl.getUniformLocation(program, 'uProjectionMatrix');
    const uLightDir = gl.getUniformLocation(program, 'uLightDir');
    const uAmbientColor = gl.getUniformLocation(program, 'uAmbientColor');
    const uLightColor = gl.getUniformLocation(program, 'uLightColor');

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
    gl.enableVertexAttribArray(aNormal);
    gl.enableVertexAttribArray(aColor);

    // Set up lighting - light coming from upper-left-front (isometric friendly)
    // Normalized direction vector pointing FROM light TO scene
    const lightDirX = 0.5, lightDirY = 0.7, lightDirZ = 0.5;
    const lightLen = Math.sqrt(lightDirX * lightDirX + lightDirY * lightDirY + lightDirZ * lightDirZ);
    gl.uniform3f(uLightDir, lightDirX / lightLen, lightDirY / lightLen, lightDirZ / lightLen);
    gl.uniform3f(uAmbientColor, 0.5, 0.5, 0.55);  // Brighter ambient
    gl.uniform3f(uLightColor, 0.6, 0.58, 0.5);   // Warm directional light

    // indexCount is defined above and updated when level changes
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
    // Room model matrix (with transition)
    const roomModelMatrix = new Float32Array(16);

    // =============================================================================
    // RENDER LOOP
    // =============================================================================
    function render(timestamp) {
        // Animate level transition
        // Animate level transition
        if (targetLevelTransitionY > 20) {
            // Exit: Accelerate up
            transitionVelocity *= 1.15;
            levelTransitionY += transitionVelocity;

            // Check if we passed the target
            if (levelTransitionY >= targetLevelTransitionY) {
                levelTransitionY = targetLevelTransitionY;
                if (transitionCallback) {
                    transitionCallback();
                    transitionCallback = null;
                }
            }
        } else {
            // Entry: Ease out (decay)
            levelTransitionY += (targetLevelTransitionY - levelTransitionY) * 0.1;

            // Snap to zero
            if (Math.abs(levelTransitionY) < 0.01) levelTransitionY = 0;
        }

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
            handleLevelTileCollisions();
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

        // Draw room (moved by transition)
        mat4Identity(roomModelMatrix);
        roomModelMatrix[13] = levelTransitionY; // Apply Y translation
        gl.uniformMatrix4fv(uModelMatrix, false, roomModelMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
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
        gl.bindBuffer(gl.ARRAY_BUFFER, playerNormBuf);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerColBuf);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf);
        getGhostModelMatrix(characterModelMatrix, playerPos[0], playerPos[1], playerPos[2], 0);
        // Apply transition to player
        characterModelMatrix[13] += levelTransitionY;
        gl.uniformMatrix4fv(uModelMatrix, false, characterModelMatrix);
        gl.drawElements(gl.TRIANGLES, playerIndexCount, gl.UNSIGNED_SHORT, 0);

        // Draw ghosts (blue)
        const ghostList = getGhosts();
        if (ghostList.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf);
            gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostNormBuf);
            gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf);
            gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf);

            for (const ghost of ghostList) {
                const frame = getGhostFrame(ghost);
                if (frame) {
                    const modelMatrix = getGhostModelMatrixForFrame(frame);
                    // Apply transition to ghost
                    modelMatrix[13] += levelTransitionY;
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
