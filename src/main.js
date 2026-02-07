import { mat4Orthographic, mat4IsometricView, mat4Identity, calculateIsometricFitBounds, _viewMatrix, _projMatrix, compileShader } from './math.js';
import { player, setupPlayerInput, updatePlayer, getPlayerPosition, getPlayerYaw, hasPlayerInput, isPlayerActive, resetPlayer } from './player.js';
import { startTimeLoop, isWaitingForInput, isTimeLoopRunning, setTimeLoopRunning, updateTimeLoop, recordFrame, handleGhostCollisions, getGhosts, getGhostFrame, getGhostModelMatrix, getGhostModelMatrixForFrame, getGhostOpacity, clearGhosts, createGhostGeometry, createPlayerGeometry, createShadowGeometry, createGhostLegGeometry, createPlayerLegGeometry, LEG_POSITIONS, LEG_PIVOT_Y, DOG_VISUAL_SCALE } from './ghost.js';
import { updatePressurePlates } from './pressureplate.js';
import { updatePistons, handlePistonCollisions } from './piston.js';
import { loadLevel, createRoomGeometry, createArrowGeometry, createWallGeometry, handleLevelTileCollisions, updateDoorCollision, updateDoorLockState, GRID_SIZE, CELL_SIZE, ROOM_HEIGHT } from './room.js';
import { initFloorShader, createFloorGeometry, updateFloorBuffers, renderFloor } from './floor.js';
import { initWallShader, updateWallBuffers, renderWalls } from './wall.js';
import { initSkyShader, renderSky } from './sky.js';

const vsSource = `attribute vec4 aPosition;attribute vec3 aNormal;attribute vec4 aColor;attribute vec2 aTexCoord;uniform mat4 uModelMatrix;uniform mat4 uViewMatrix;uniform mat4 uProjectionMatrix;varying lowp vec4 vColor;varying highp vec3 vNormal;varying highp vec3 vWorldPos;varying highp vec2 vTexCoord;void main(){vec4 worldPos=uModelMatrix*aPosition;gl_Position=uProjectionMatrix*uViewMatrix*worldPos;vColor=aColor;vTexCoord=aTexCoord;vNormal=mat3(uModelMatrix)*aNormal;vWorldPos=worldPos.xyz;}`;

const fsSource = `precision highp float;varying lowp vec4 vColor;varying highp vec3 vNormal;varying highp vec3 vWorldPos;varying highp vec2 vTexCoord;uniform vec3 uLightDir;uniform vec3 uAmbientColor;uniform vec3 uLightColor;uniform sampler2D uTexture;uniform bool uUseTexture;uniform float u_globalAlpha;void main(){vec3 normal=normalize(vNormal);float diff=max(dot(normal,uLightDir),0.0);vec4 baseColor=uUseTexture?texture2D(uTexture,vTexCoord):vColor;vec3 ambient=uAmbientColor*baseColor.rgb;vec3 diffuse=uLightColor*diff*baseColor.rgb;vec3 finalColor=ambient+diffuse;gl_FragColor=vec4(finalColor,baseColor.a*u_globalAlpha);}`;

async function main() {
    await loadLevel('levels/l1.bin');
    const canvas = document.getElementById('c');
    let lastWidth = 0, lastHeight = 0;
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) { alert('WebGL not supported'); return; }
    initSkyShader(gl);
    initWallShader(gl);
    initFloorShader(gl);

    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    let room = createRoomGeometry(), arrow = createArrowGeometry(), wallGeom = createWallGeometry();
    const ghostGeom = createGhostGeometry(), playerGeom = createPlayerGeometry(), shadowGeom = createShadowGeometry();
    let indexCount = room.indexCount, arrowIndexCount = arrow.indexCount;
    updateWallBuffers(gl, wallGeom);
    let floorGeom = createFloorGeometry();
    updateFloorBuffers(gl, floorGeom);
    const posBuf = gl.createBuffer(), colBuf = gl.createBuffer(), idxBuf = gl.createBuffer();
    let levelTransitionY = -40, targetLevelTransitionY = 0, transitionCallback = null, transitionVelocity = 0;
    function transitionLevelOut(callback) {
        targetLevelTransitionY = 40;
        transitionCallback = callback;
        transitionVelocity = 0.2;
    }
    window.transitionLevelOut = transitionLevelOut;
    function updateRoomBuffers() {
        room = createRoomGeometry();
        arrow = createArrowGeometry();
        wallGeom = createWallGeometry();
        indexCount = room.indexCount;
        arrowIndexCount = arrow.indexCount;
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowPosBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arrow.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowColBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arrow.colors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowNormBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arrow.normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arrowIdxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrow.indices, gl.STATIC_DRAW);
        updateWallBuffers(gl, wallGeom);
        floorGeom = createFloorGeometry();
        updateFloorBuffers(gl, floorGeom);
        levelTransitionY = -40;
        targetLevelTransitionY = 0;
        transitionCallback = null;
        transitionVelocity = 0;
    }
    function refreshRoomBuffers() {
        room = createRoomGeometry();
        indexCount = room.indexCount;
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, room.normals, gl.STATIC_DRAW);
    }
    window.rebuildRoomGeometry = updateRoomBuffers;
    window.refreshRoomBuffers = refreshRoomBuffers;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);
    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, room.normals, gl.STATIC_DRAW);
    const arrowPosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arrow.positions, gl.STATIC_DRAW);
    const arrowColBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arrow.colors, gl.STATIC_DRAW);
    const arrowNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arrow.normals, gl.STATIC_DRAW);
    const arrowIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arrowIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrow.indices, gl.STATIC_DRAW);
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
    // Leg geometry for ghosts
    const ghostLegGeom = createGhostLegGeometry();
    const ghostLegPosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostLegPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ghostLegGeom.positions, gl.STATIC_DRAW);
    const ghostLegColBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostLegColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ghostLegGeom.colors, gl.STATIC_DRAW);
    const ghostLegNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostLegNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ghostLegGeom.normals, gl.STATIC_DRAW);
    const ghostLegIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostLegIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ghostLegGeom.indices, gl.STATIC_DRAW);
    const ghostLegIndexCount = ghostLegGeom.indexCount;
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
    // Leg geometry for player
    const playerLegGeom = createPlayerLegGeometry();
    const playerLegPosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, playerLegPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, playerLegGeom.positions, gl.STATIC_DRAW);
    const playerLegColBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, playerLegColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, playerLegGeom.colors, gl.STATIC_DRAW);
    const playerLegNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, playerLegNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, playerLegGeom.normals, gl.STATIC_DRAW);
    const playerLegIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerLegIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, playerLegGeom.indices, gl.STATIC_DRAW);
    const playerLegIndexCount = playerLegGeom.indexCount;
    // Animation state
    let playerLegPhase = 0, lastPlayerPos = [0, 0, 0];
    const shadowPosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, shadowGeom.positions, gl.STATIC_DRAW);
    const shadowColBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, shadowGeom.colors, gl.STATIC_DRAW);
    const shadowNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, shadowGeom.normals, gl.STATIC_DRAW);
    const shadowIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shadowIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, shadowGeom.indices, gl.STATIC_DRAW);
    const shadowIndexCount = shadowGeom.indexCount;
    const playerTexture = gl.createTexture();
    const playerTextureImg = new Image();
    playerTextureImg.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, playerTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, playerTextureImg);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    playerTextureImg.src = 'textures/scott.jpg';
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aNormal = gl.getAttribLocation(program, 'aNormal');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
    const uModelMatrix = gl.getUniformLocation(program, 'uModelMatrix');
    const uViewMatrix = gl.getUniformLocation(program, 'uViewMatrix');
    const uProjection = gl.getUniformLocation(program, 'uProjectionMatrix');
    const uLightDir = gl.getUniformLocation(program, 'uLightDir');
    const uAmbientColor = gl.getUniformLocation(program, 'uAmbientColor');
    const uLightColor = gl.getUniformLocation(program, 'uLightColor');
    const uTexture = gl.getUniformLocation(program, 'uTexture');
    const uUseTexture = gl.getUniformLocation(program, 'uUseTexture');
    const u_globalAlpha = gl.getUniformLocation(program, 'u_globalAlpha');
    const identityMatrix = new Float32Array(16);
    mat4Identity(identityMatrix);
    const characterModelMatrix = new Float32Array(16);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.useProgram(program);
    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aNormal);
    gl.enableVertexAttribArray(aColor);
    const lightDirX = 0.5, lightDirY = 0.7, lightDirZ = 0.5;
    const lightLen = Math.sqrt(lightDirX * lightDirX + lightDirY * lightDirY + lightDirZ * lightDirZ);
    gl.uniform3f(uLightDir, lightDirX / lightLen, lightDirY / lightLen, lightDirZ / lightLen);
    gl.uniform3f(uAmbientColor, 0.5, 0.5, 0.55);
    gl.uniform3f(uLightColor, 0.6, 0.58, 0.5);
    gl.uniform1f(u_globalAlpha, 1.0);
    const ghostIndexCount = ghostGeom.indexCount;
    const playerIndexCount = playerGeom.indexCount;
    setupPlayerInput(canvas, () => { if (isWaitingForInput()) { startTimeLoop(performance.now()); return true; } return false; });
    const roomModelMatrix = new Float32Array(16);
    function render(timestamp) {
        if (targetLevelTransitionY > 20) {
            transitionVelocity *= 1.15;
            levelTransitionY += transitionVelocity;
            if (levelTransitionY >= targetLevelTransitionY) {
                levelTransitionY = targetLevelTransitionY;
                if (transitionCallback) { transitionCallback(); transitionCallback = null; }
            }
        } else {
            levelTransitionY += (targetLevelTransitionY - levelTransitionY) * 0.1;
            if (Math.abs(levelTransitionY) < 0.01) levelTransitionY = 0;
        }
        if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
            lastWidth = canvas.width;
            lastHeight = canvas.height;
            gl.viewport(0, 0, lastWidth, lastHeight);
            const aspect = lastWidth / lastHeight;
            const roomSize = GRID_SIZE * CELL_SIZE;
            const bounds = calculateIsometricFitBounds(roomSize, ROOM_HEIGHT, 0.15);
            const verticalSize = bounds.spanY / 2;
            const horizontalSize = bounds.spanX / 2;
            let viewSize = horizontalSize / aspect > verticalSize ? horizontalSize / aspect : verticalSize;
            const halfHeight = viewSize;
            const halfWidth = viewSize * aspect;
            mat4Orthographic(_projMatrix, bounds.centerX - halfWidth, bounds.centerX + halfWidth, bounds.centerY - halfHeight, bounds.centerY + halfHeight, -100.0, 100.0);
            gl.uniformMatrix4fv(uProjection, false, _projMatrix);
        }
        updateTimeLoop(timestamp);
        if (isPlayerActive() && isWaitingForInput() && hasPlayerInput()) startTimeLoop(timestamp);
        if (isPlayerActive() && !isWaitingForInput()) {
            updatePlayer();
            handleGhostCollisions(timestamp);
            handleLevelTileCollisions();
            recordFrame(timestamp);
            updatePressurePlates();
            updatePistons();
            handlePistonCollisions();
            updateDoorLockState();
            updateDoorCollision();
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderSky(gl, timestamp, canvas.width, canvas.height);
        mat4Identity(roomModelMatrix);
        roomModelMatrix[13] = levelTransitionY;
        renderWalls(gl, roomModelMatrix, _viewMatrix, _projMatrix);
        renderFloor(gl, roomModelMatrix, _viewMatrix, _projMatrix, timestamp / 1000.0);
        gl.useProgram(program);
        gl.enableVertexAttribArray(aPosition);
        gl.enableVertexAttribArray(aNormal);
        gl.enableVertexAttribArray(aColor);
        mat4IsometricView(_viewMatrix);
        gl.uniformMatrix4fv(uViewMatrix, false, _viewMatrix);
        gl.uniform1f(u_globalAlpha, 1.0);
        mat4Identity(roomModelMatrix);
        roomModelMatrix[13] = levelTransitionY;
        gl.uniformMatrix4fv(uModelMatrix, false, roomModelMatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
        if (arrowIndexCount > 0) {
            const bobOffset = Math.sin(timestamp * 0.003) * 0.3;
            mat4Identity(roomModelMatrix);
            roomModelMatrix[13] = levelTransitionY + bobOffset;
            gl.uniformMatrix4fv(uModelMatrix, false, roomModelMatrix);
            gl.bindBuffer(gl.ARRAY_BUFFER, arrowPosBuf);
            gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, arrowNormBuf);
            gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, arrowColBuf);
            gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arrowIdxBuf);
            gl.drawElements(gl.TRIANGLES, arrowIndexCount, gl.UNSIGNED_SHORT, 0);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(u_globalAlpha, 1.0);
        const playerPos = getPlayerPosition();

        // --- SHADOW PASS ---
        gl.uniform1i(uUseTexture, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, shadowPosBuf);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, shadowNormBuf);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, shadowColBuf);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shadowIdxBuf);
        // Player shadow
        getGhostModelMatrix(characterModelMatrix, playerPos[0], 0, playerPos[2], 0);
        characterModelMatrix[13] += levelTransitionY;
        gl.uniformMatrix4fv(uModelMatrix, false, characterModelMatrix);
        gl.drawElements(gl.TRIANGLES, shadowIndexCount, gl.UNSIGNED_SHORT, 0);
        // Ghost shadows
        const ghostListForShadows = getGhosts();
        for (const ghost of ghostListForShadows) {
            const frame = getGhostFrame(ghost);
            if (frame) {
                getGhostModelMatrix(characterModelMatrix, frame.x, 0, frame.z, 0);
                characterModelMatrix[13] += levelTransitionY;
                gl.uniformMatrix4fv(uModelMatrix, false, characterModelMatrix);
                gl.drawElements(gl.TRIANGLES, shadowIndexCount, gl.UNSIGNED_SHORT, 0);
            }
        }
        // ---------------------------

        gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuf);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerNormBuf);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

        // --- PLAYER OUTLINE PASS ---
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);    // Draw only back faces
        gl.disableVertexAttribArray(aColor);
        gl.vertexAttrib4f(aColor, 1.0, 1.0, 0.0, 1.0); // Yellow
        gl.uniform1i(uUseTexture, 0); // No texture

        getGhostModelMatrix(characterModelMatrix, playerPos[0], playerPos[1], playerPos[2], getPlayerYaw());
        characterModelMatrix[13] += levelTransitionY;
        const outlineScale = 1.1;
        const outlineMatrix = new Float32Array(characterModelMatrix);
        outlineMatrix[0] *= outlineScale; outlineMatrix[1] *= outlineScale; outlineMatrix[2] *= outlineScale;
        outlineMatrix[4] *= outlineScale; outlineMatrix[5] *= outlineScale; outlineMatrix[6] *= outlineScale;
        outlineMatrix[8] *= outlineScale; outlineMatrix[9] *= outlineScale; outlineMatrix[10] *= outlineScale;

        gl.uniformMatrix4fv(uModelMatrix, false, outlineMatrix);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf);
        gl.drawElements(gl.TRIANGLES, playerIndexCount, gl.UNSIGNED_SHORT, 0);

        gl.disable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.enableVertexAttribArray(aColor);
        // ---------------------------

        // Helper to render legs
        function renderLegs(pos, yaw, legPhase, isGhost, opacity = 1.0) {
            const legGeomIndexCount = isGhost ? ghostLegIndexCount : playerLegIndexCount;
            const legBufs = isGhost ? 
                { pos: ghostLegPosBuf, norm: ghostLegNormBuf, col: ghostLegColBuf, idx: ghostLegIdxBuf } :
                { pos: playerLegPosBuf, norm: playerLegNormBuf, col: playerLegColBuf, idx: playerLegIdxBuf };

            gl.bindBuffer(gl.ARRAY_BUFFER, legBufs.pos);
            gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, legBufs.norm);
            gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, legBufs.col);
            gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, legBufs.idx);

            if (isGhost) gl.uniform1f(u_globalAlpha, opacity);

            for (const leg of LEG_POSITIONS) {
                const legMatrix = new Float32Array(16);
                mat4Identity(legMatrix);
                
                // 1. Translation to position (x, y, z)
                // 2. Rotation (yaw)
                // 3. Leg offset (relative to body center)
                // 4. Leg swing rotation (around pivot)
                
                // We'll construct this by combining transforms:
                // Global = Translate(pos) * Rotate(yaw) * Translate(legOffset) * Translate(0, pivotY, 0) * Rotate(swing) * Translate(0, -pivotY, 0)
                
                // But since we have a simple hierarchy, we can do it step-by-step or use a matrix stack. 
                // Let's use getGhostModelMatrix as a base for body transform (pos + yaw).
                getGhostModelMatrix(legMatrix, pos[0], pos[1], pos[2], yaw);
                legMatrix[13] += levelTransitionY;

                // Apply leg offset relative to body
                // We need to rotate the offset by the yaw to get world space offset
                const c = Math.cos(yaw), s = Math.sin(yaw);
                const wx = leg.x * c - leg.z * s;
                const wz = leg.x * s + leg.z * c;
                
                legMatrix[12] += wx;
                legMatrix[14] += wz;

                // Calculate swing angle
                const swingAmplitude = 0.6;
                const swingAngle = Math.sin(legPhase + leg.phase) * swingAmplitude;
                
                // Apply swing rotation around X axis (local leg space)
                // Since leg geometry is axis-aligned, we can rotate around the local X axis relative to the leg pivot
                // Pivot is at LEG_PIVOT_Y relative to ground (0)
                
                // We need to rotate around the pivot point. 
                // M = M * Translate(0, pivot, 0) * RotateX(angle) * Translate(0, -pivot, 0)
                
                // To avoid complex matrix math, let's just create a rotation matrix and multiply
                // But we are in a simple engine.
                
                // Let's manually apply the rotation to the matrix
                // The current matrix M puts us at the leg's top attachment point (approximately)
                // Let's adjust the indices directly? No, that's hard with the rotation.
                
                // Create a local rotation matrix for the leg swing
                const swingMatrix = new Float32Array(16);
                mat4Identity(swingMatrix);
                
                // Translate to pivot
                swingMatrix[13] = LEG_PIVOT_Y;
                
                // Rotate X
                const sc = Math.cos(swingAngle), ss = Math.sin(swingAngle);
                const rotMatrix = new Float32Array(16);
                mat4Identity(rotMatrix);
                rotMatrix[5] = sc; rotMatrix[6] = ss;
                rotMatrix[9] = -ss; rotMatrix[10] = sc;
                
                // Translate back
                const transBack = new Float32Array(16);
                mat4Identity(transBack);
                transBack[13] = -LEG_PIVOT_Y;
                
                // Combine: Swing * Rot * Back
                // Since we want to apply this TO the existing transform:
                // Final = BodyTransform * OffsetTransform * SwingTransform
                
                // Simplified approach:
                // The leg geometry is centered at (0, -height/2, 0) relative to its origin? 
                // No, createLegGeometry creates it with offset X/Z but centered Y?
                // Actually createLegGeometry applies the offset X/Z and puts Y from -height/2 to +height/2 ? 
                // No, check ghost.js: 
                // addBoxToArrays(..., offsetX, -legHeight / 2, offsetZ, ...)
                // So it's already offset in X/Z and centered vertically at -height/2 relative to origin 0.
                // Wait, createLegGeometry uses offsets passed to it?
                // createLegGeometry([..], 0, 0) -> offsets are 0.
                // So the geometry is a box from -w/2 to w/2 in X/Z, and -h to 0 in Y?
                // addBoxToArrays(..., 0, -legHeight/2, 0, ...) -> box center is at y = -legHeight/2. Size is legHeight.
                // So y ranges from -legHeight to 0. Correct.
                // So the geometry origin (0,0,0) is the top of the leg (pivot point).
                
                // So we just need to:
                // 1. Translate to body position + body rotation
                // 2. Translate by leg offset (rotated by body yaw)
                // 3. Rotate by swing angle (X axis)
                // 4. Draw
                
                // Construct matrix:
                // We have legMatrix which is at Body Pos + rotated offset.
                // Now just rotate X local.
                
                // To rotate X local (which is axis perpendicular to direction facing? No, yaw rotates Y)
                // If yaw is 0, dog faces -Z. X is right.
                // Leg swing is around X axis.
                // So we just rotate around global X? No, local X.
                // Since we applied yaw, the local X is rotated.
                // The matrix already has the rotation. We can just multiply a rotation matrix?
                
                // If M is the model matrix so far (Pos * RotY), then M * RotX will rotate around the *local* X axis?
                // Yes, if we multiply on the right.
                
                // M_new = M * RotX(swing)
                
                // Manual multiplication of M * RotX
                // RotX: 
                // 1  0  0  0
                // 0  c  s  0
                // 0 -s  c  0
                // 0  0  0  1
                
                // Col 0: M[0], M[1], M[2], M[3] (unchanged)
                // Col 1: M[4]*c + M[8]*-s, ...
                // Col 2: M[4]*s + M[8]*c, ...
                // Col 3: M[12]... (unchanged)
                
                const m = legMatrix;
                const m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
                const m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
                
                // Rotate around pivot Y (which is the origin of the geometry)
                // But wait, the geometry is at (0, -h/2, 0) relative to 0? 
                // Yes, 0 is the top. So standard RotX works perfect.
                
                // Apply rotation
                m[4] = m4 * sc + m8 * ss;
                m[5] = m5 * sc + m9 * ss;
                m[6] = m6 * sc + m10 * ss;
                m[7] = m7 * sc + m11 * ss;
                
                m[8] = m4 * -ss + m8 * sc;
                m[9] = m5 * -ss + m9 * sc;
                m[10] = m6 * -ss + m10 * sc;
                m[11] = m7 * -ss + m11 * sc;
                
                // Now translate Y up to the pivot point in world space?
                // The body render puts the body at `pos`.
                // `pos` is the bottom center of the collision box? 
                // No, player.position is ... looks like floor level?
                // In ghost.js createDogBodyGeometry: bodyY = groundY + legHeight + bodyHeight/2.
                // So body is elevated.
                // The leg geometry origin is the top of the leg.
                // The leg top should be at groundY + legHeight.
                // So we need to translate up by LEG_PIVOT_Y.
                // But we already included that in the geometry?
                // No, created geometry is local.
                // We simply need to translate the leg up to the pivot height relative to the ground.
                m[13] += LEG_PIVOT_Y; 
                
                gl.uniformMatrix4fv(uModelMatrix, false, m);
                gl.drawElements(gl.TRIANGLES, legGeomIndexCount, gl.UNSIGNED_SHORT, 0);
            }
        }

        // Setup player legs
        gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuf);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerNormBuf);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerColBuf);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf);

        // Update player leg animation
        const px = playerPos[0], py = playerPos[1], pz = playerPos[2];
        const distMoved = Math.hypot(px - lastPlayerPos[0], pz - lastPlayerPos[2]);
        if (distMoved > 0.001) {
            playerLegPhase += distMoved * 4.5;
        } else {
            // Return to neutral
            playerLegPhase = playerLegPhase % (Math.PI * 2);
            if (playerLegPhase > Math.PI) playerLegPhase += (2 * Math.PI - playerLegPhase) * 0.1;
            else playerLegPhase -= playerLegPhase * 0.1;
        }
        lastPlayerPos = [px, py, pz];

        // Player Body
        gl.uniform1i(uUseTexture, 0);
        getGhostModelMatrix(characterModelMatrix, px, py, pz, getPlayerYaw());
        characterModelMatrix[13] += levelTransitionY;
        gl.uniformMatrix4fv(uModelMatrix, false, characterModelMatrix);
        gl.drawElements(gl.TRIANGLES, playerIndexCount, gl.UNSIGNED_SHORT, 0);
        
        // Player Legs
        renderLegs(playerPos, getPlayerYaw(), playerLegPhase, false);

        // Ghosts
        const ghostList = getGhosts();
        if (ghostList.length > 0) {
            // Ghost Bodies
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf);
            gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostNormBuf);
            gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf);
            gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf);
            
            gl.uniform1i(uUseTexture, 0);
            
            for (const ghost of ghostList) {
                const opacity = getGhostOpacity(timestamp);
                gl.uniform1f(u_globalAlpha, opacity);
                
                const frame = getGhostFrame(ghost);
                if (frame) {
                    // Update ghost leg phase
                    if (!ghost.legPhase) ghost.legPhase = 0;
                    if (ghost.lastX !== undefined) {
                        const dist = Math.hypot(frame.x - ghost.lastX, frame.z - ghost.lastZ);
                        if (dist > 0.001) ghost.legPhase += dist * 4.5;
                    }
                    ghost.lastX = frame.x; ghost.lastZ = frame.z;

                    const modelMatrix = getGhostModelMatrixForFrame(frame);
                    modelMatrix[13] += levelTransitionY;
                    gl.uniformMatrix4fv(uModelMatrix, false, modelMatrix);
                    gl.drawElements(gl.TRIANGLES, ghostIndexCount, gl.UNSIGNED_SHORT, 0);
                    
                    // Ghost Legs
                    renderLegs([frame.x, frame.y, frame.z], frame.yaw, ghost.legPhase, true, opacity);
                    
                    // Restore buffers for next ghost body (renderLegs changes them)
                    gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf);
                    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
                    gl.bindBuffer(gl.ARRAY_BUFFER, ghostNormBuf);
                    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
                    gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf);
                    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf);
                }
            }
        }
        gl.disable(gl.BLEND);
        requestAnimationFrame(render);
    }
    setTimeLoopRunning(true);
    render(performance.now());
}
main();
