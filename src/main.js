// Main entry point
import './math.js';
import './room.js';
import './player.js';
import './ghost.js';
import './pressureplate.js';
import './piston.js';

const vsSource = `attribute vec4 aPosition;attribute vec3 aNormal;attribute vec4 aColor;uniform mat4 uModelMatrix;uniform mat4 uViewMatrix;uniform mat4 uProjectionMatrix;varying lowp vec4 vColor;varying highp vec3 vNormal;varying highp vec3 vWorldPos;void main(){vec4 worldPos=uModelMatrix*aPosition;gl_Position=uProjectionMatrix*uViewMatrix*worldPos;vColor=aColor;vNormal=mat3(uModelMatrix)*aNormal;vWorldPos=worldPos.xyz;}`;
const fsSource = `precision highp float;varying lowp vec4 vColor;varying highp vec3 vNormal;varying highp vec3 vWorldPos;uniform vec3 uLightDir;uniform vec3 uAmbientColor;uniform vec3 uLightColor;void main(){vec3 normal=normalize(vNormal);float diff=max(dot(normal,uLightDir),0.0);vec3 ambient=uAmbientColor*vColor.rgb;vec3 diffuse=uLightColor*diff*vColor.rgb;gl_FragColor=vec4(ambient+diffuse,vColor.a);}`;

async function main() {
    await loadLevel('levels/l1.bin');
    const canvas = document.getElementById('glCanvas');
    let lastW = 0, lastH = 0;
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) { alert('WebGL not supported'); return; }

    function compileShader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    let room = createRoomGeometry(), arrow = createArrowGeometry();
    const ghostGeom = createGhostGeometry(), playerGeom = createPlayerGeometry();
    let indexCount = room.indexCount, arrowIndexCount = arrow.indexCount;

    const posBuf = gl.createBuffer(), colBuf = gl.createBuffer(), idxBuf = gl.createBuffer(), normBuf = gl.createBuffer();
    const arrowPosBuf = gl.createBuffer(), arrowColBuf = gl.createBuffer(), arrowNormBuf = gl.createBuffer(), arrowIdxBuf = gl.createBuffer();
    const ghostPosBuf = gl.createBuffer(), ghostColBuf = gl.createBuffer(), ghostIdxBuf = gl.createBuffer(), ghostNormBuf = gl.createBuffer();
    const playerPosBuf = gl.createBuffer(), playerColBuf = gl.createBuffer(), playerIdxBuf = gl.createBuffer(), playerNormBuf = gl.createBuffer();

    let levelTransitionY = -40, targetLevelTransitionY = 0, transitionCallback = null, transitionVelocity = 0;

    function transitionLevelOut(cb) { targetLevelTransitionY = 40; transitionCallback = cb; transitionVelocity = 0.2; }
    window.transitionLevelOut = transitionLevelOut;

    function updateRoomBuffers() {
        room = createRoomGeometry(); arrow = createArrowGeometry();
        indexCount = room.indexCount; arrowIndexCount = arrow.indexCount;
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf); gl.bufferData(gl.ARRAY_BUFFER, room.normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowPosBuf); gl.bufferData(gl.ARRAY_BUFFER, arrow.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowColBuf); gl.bufferData(gl.ARRAY_BUFFER, arrow.colors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowNormBuf); gl.bufferData(gl.ARRAY_BUFFER, arrow.normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arrowIdxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrow.indices, gl.STATIC_DRAW);
        levelTransitionY = -40; targetLevelTransitionY = 0; transitionCallback = null; transitionVelocity = 0;
    }

    function refreshRoomBuffers() {
        room = createRoomGeometry(); indexCount = room.indexCount;
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);
    }

    window.rebuildRoomGeometry = updateRoomBuffers;
    window.refreshRoomBuffers = refreshRoomBuffers;

    // Initial upload
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, room.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.bufferData(gl.ARRAY_BUFFER, room.colors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, room.indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf); gl.bufferData(gl.ARRAY_BUFFER, room.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowPosBuf); gl.bufferData(gl.ARRAY_BUFFER, arrow.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowColBuf); gl.bufferData(gl.ARRAY_BUFFER, arrow.colors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowNormBuf); gl.bufferData(gl.ARRAY_BUFFER, arrow.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arrowIdxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrow.indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf); gl.bufferData(gl.ARRAY_BUFFER, ghostGeom.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf); gl.bufferData(gl.ARRAY_BUFFER, ghostGeom.colors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ghostGeom.indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ghostNormBuf); gl.bufferData(gl.ARRAY_BUFFER, ghostGeom.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuf); gl.bufferData(gl.ARRAY_BUFFER, playerGeom.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, playerColBuf); gl.bufferData(gl.ARRAY_BUFFER, playerGeom.colors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, playerGeom.indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, playerNormBuf); gl.bufferData(gl.ARRAY_BUFFER, playerGeom.normals, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aNormal = gl.getAttribLocation(program, 'aNormal');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const uModelMatrix = gl.getUniformLocation(program, 'uModelMatrix');
    const uViewMatrix = gl.getUniformLocation(program, 'uViewMatrix');
    const uProjection = gl.getUniformLocation(program, 'uProjectionMatrix');
    const uLightDir = gl.getUniformLocation(program, 'uLightDir');
    const uAmbientColor = gl.getUniformLocation(program, 'uAmbientColor');
    const uLightColor = gl.getUniformLocation(program, 'uLightColor');

    const identityMatrix = new Float32Array(16);
    mat4Identity(identityMatrix);
    const characterModelMatrix = new Float32Array(16);
    const roomModelMatrix = new Float32Array(16);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.useProgram(program);
    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aNormal);
    gl.enableVertexAttribArray(aColor);

    const lx = 0.5, ly = 0.7, lz = 0.5, ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    gl.uniform3f(uLightDir, lx / ll, ly / ll, lz / ll);
    gl.uniform3f(uAmbientColor, 0.5, 0.5, 0.55);
    gl.uniform3f(uLightColor, 0.6, 0.58, 0.5);

    const ghostIndexCount = ghostGeom.indexCount, playerIndexCount = playerGeom.indexCount;

    setupPlayerInput(canvas, () => { if (isWaitingForInput()) { startTimeLoop(performance.now()); return true; } return false; });

    function render(ts) {
        if (targetLevelTransitionY > 20) {
            transitionVelocity *= 1.15; levelTransitionY += transitionVelocity;
            if (levelTransitionY >= targetLevelTransitionY) { levelTransitionY = targetLevelTransitionY; if (transitionCallback) { transitionCallback(); transitionCallback = null; } }
        } else { levelTransitionY += (targetLevelTransitionY - levelTransitionY) * 0.1; if (Math.abs(levelTransitionY) < 0.01) levelTransitionY = 0; }

        if (canvas.width !== lastW || canvas.height !== lastH) {
            lastW = canvas.width; lastH = canvas.height;
            gl.viewport(0, 0, lastW, lastH);
            const aspect = lastW / lastH;
            const roomSize = GRID_SIZE * CELL_SIZE;
            const bounds = calculateIsometricFitBounds(roomSize, ROOM_HEIGHT, 0.15);
            const vSize = bounds.spanY / 2, hSize = bounds.spanX / 2;
            const viewSize = hSize / aspect > vSize ? hSize / aspect : vSize;
            const halfH = viewSize, halfW = viewSize * aspect;
            mat4Orthographic(_projMatrix, bounds.centerX - halfW, bounds.centerX + halfW, bounds.centerY - halfH, bounds.centerY + halfH, -100.0, 100.0);
            gl.uniformMatrix4fv(uProjection, false, _projMatrix);
        }

        updateTimeLoop(ts);
        if (isPlayerActive() && isWaitingForInput() && hasPlayerInput()) startTimeLoop(ts);
        if (isPlayerActive() && !isWaitingForInput()) {
            updatePlayer(); handleGhostCollisions(ts); handleLevelTileCollisions(); recordFrame(ts);
            updatePressurePlates(); updatePistons(); handlePistonCollisions(); updateDoorLockState(); updateDoorCollision();
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        mat4IsometricView(_viewMatrix);
        gl.uniformMatrix4fv(uViewMatrix, false, _viewMatrix);

        mat4Identity(roomModelMatrix); roomModelMatrix[13] = levelTransitionY;
        gl.uniformMatrix4fv(uModelMatrix, false, roomModelMatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf); gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

        if (arrowIndexCount > 0) {
            mat4Identity(roomModelMatrix); roomModelMatrix[13] = levelTransitionY + Math.sin(ts * 0.003) * 0.3;
            gl.uniformMatrix4fv(uModelMatrix, false, roomModelMatrix);
            gl.bindBuffer(gl.ARRAY_BUFFER, arrowPosBuf); gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, arrowNormBuf); gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, arrowColBuf); gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arrowIdxBuf);
            gl.drawElements(gl.TRIANGLES, arrowIndexCount, gl.UNSIGNED_SHORT, 0);
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        const pp = getPlayerPosition();
        gl.bindBuffer(gl.ARRAY_BUFFER, playerPosBuf); gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerNormBuf); gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, playerColBuf); gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, playerIdxBuf);
        getGhostModelMatrix(characterModelMatrix, pp[0], pp[1], pp[2], 0);
        characterModelMatrix[13] += levelTransitionY;
        gl.uniformMatrix4fv(uModelMatrix, false, characterModelMatrix);
        gl.drawElements(gl.TRIANGLES, playerIndexCount, gl.UNSIGNED_SHORT, 0);

        const gList = getGhosts();
        if (gList.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostPosBuf); gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostNormBuf); gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, ghostColBuf); gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ghostIdxBuf);
            for (const g of gList) {
                const f = getGhostFrame(g);
                if (f) { const m = getGhostModelMatrixForFrame(f); m[13] += levelTransitionY; gl.uniformMatrix4fv(uModelMatrix, false, m); gl.drawElements(gl.TRIANGLES, ghostIndexCount, gl.UNSIGNED_SHORT, 0); }
            }
        }
        gl.disable(gl.BLEND);
        requestAnimationFrame(render);
    }

    setTimeLoopRunning(true);
    render(performance.now());
}

main();
