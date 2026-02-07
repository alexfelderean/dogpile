import { mat4Orthographic, mat4IsometricView, mat4Identity, calculateIsometricFitBounds, _viewMatrix, _projMatrix, compileShader } from './math.js';
import { player, setupPlayerInput, updatePlayer, getPlayerPosition, getPlayerYaw, hasPlayerInput, isPlayerActive, resetPlayer } from './player.js';
import { startTimeLoop, isWaitingForInput, isTimeLoopRunning, setTimeLoopRunning, updateTimeLoop, recordFrame, handleGhostCollisions, getGhosts, getGhostFrame, getGhostModelMatrix, getGhostModelMatrixForFrame, getGhostOpacity, clearGhosts, createGhostGeometry, createPlayerGeometry } from './ghost.js';
import { updatePressurePlates } from './pressureplate.js';
import { updatePistons, handlePistonCollisions, isPistonAnimating } from './piston.js';
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
    const ghostGeom = createGhostGeometry(), playerGeom = createPlayerGeometry();
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
    const ghostTexCoordBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostTexCoordBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ghostGeom.texCoords, gl.STATIC_DRAW);
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
    const playerTexCoordBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, playerTexCoordBuf);
    gl.bufferData(gl.ARRAY_BUFFER, playerGeom.texCoords, gl.STATIC_DRAW);
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
            if (isPistonAnimating()) refreshRoomBuffers();
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

        gl.bindBuffer(gl.ARRAY_BUFFER, playerColBuf);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aTexCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerTexCoordBuf);
        gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, playerTexture);
        gl.uniform1i(uTexture, 0);
        gl.uniform1i(uUseTexture, 1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf);
        getGhostModelMatrix(characterModelMatrix, playerPos[0], playerPos[1], playerPos[2], getPlayerYaw());
        characterModelMatrix[13] += levelTransitionY;
        gl.uniformMatrix4fv(uModelMatrix, false, characterModelMatrix);
        gl.drawElements(gl.TRIANGLES, playerIndexCount, gl.UNSIGNED_SHORT, 0);
        gl.uniform1i(uUseTexture, 0);
        gl.disableVertexAttribArray(aTexCoord);
        const ghostList = getGhosts();
        if (ghostList.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf);
            gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostNormBuf);
            gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf);
            gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(aTexCoord);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostTexCoordBuf);
            gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, playerTexture);
            gl.uniform1i(uTexture, 0);
            gl.uniform1i(uUseTexture, 1);
            gl.uniform1f(u_globalAlpha, getGhostOpacity(timestamp));
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf);
            for (const ghost of ghostList) {
                const frame = getGhostFrame(ghost);
                if (frame) {
                    const modelMatrix = getGhostModelMatrixForFrame(frame);
                    modelMatrix[13] += levelTransitionY;
                    gl.uniformMatrix4fv(uModelMatrix, false, modelMatrix);
                    gl.drawElements(gl.TRIANGLES, ghostIndexCount, gl.UNSIGNED_SHORT, 0);
                }
            }
            gl.uniform1i(uUseTexture, 0);
            gl.disableVertexAttribArray(aTexCoord);
        }
        gl.disable(gl.BLEND);
        requestAnimationFrame(render);
    }
    setTimeLoopRunning(true);
    render(performance.now());
}
main();
