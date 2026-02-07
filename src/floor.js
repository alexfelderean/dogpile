import { getLevelGridSize, getLevelCellSize, getCurrentLevel } from './room.js';
import { compileShader } from './math.js';

const floorVsSource = `attribute vec4 aPosition;attribute vec3 aNormal;uniform mat4 uModelMatrix;uniform mat4 uViewMatrix;uniform mat4 uProjectionMatrix;varying vec3 vWorldPos;varying vec3 vNormal;void main(){vec4 worldPos=uModelMatrix*aPosition;gl_Position=uProjectionMatrix*uViewMatrix*worldPos;vWorldPos=worldPos.xyz;vNormal=aNormal;}`;

const floorFsSource = `precision highp float;uniform float uTime;varying vec3 vWorldPos;varying vec3 vNormal;
#define BLADES_SPACING 0.14
#define JITTER_MAX 0.08
#define LOOKUP_DIST 2
#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031,.1030,.0973)
#define PI 3.14159265359
float v(vec2 v){vec3 f=fract(vec3(v.xyx)*HASHSCALE1);f+=dot(f,f.yzx+19.19);return fract((f.x+f.y)*f.z);}vec3 t(vec2 v){vec3 f=fract(vec3(v.xyx)*HASHSCALE3);f+=dot(f,f.yxz+19.19);return fract((f.xxy+f.yzz)*f.zyx);}vec2 f(vec2 v){vec3 f=fract(vec3(v.xyx)*HASHSCALE3);f+=dot(f,f.yzx+19.19);return fract((f.xx+f.yz)*f.zy);}vec3 f(float v){return vec3(.22,.38,.28)+vec3(.12,.2,.08)*cos(2.*PI*(vec3(.2,.4,.2)*v+vec3(.66,.77,.33)));}float f(vec2 u,vec2 m,out vec4 r){vec3 i=t(m*123.41)*2.-vec3(1);i.z=i.z*.2+.2;vec2 y=normalize(i.xy);float x=sin(uTime*1.5+m.x*.5+m.y*.5)*.4;y.x+=x*.5;y.y+=x*.5;y=normalize(y);x=v(m*102.7)*.2+.25;vec2 z=u-m;float d=dot(y,z),s=dot(vec2(-y.y,y),z);x=d/x;if(x>=0.&&x<=1.&&abs(s)<=.04*(1.-x*x)){vec3 u=f(v(m*26.6));r=vec4(u*(.5+.5*x),1);return i.z*x;}return r=vec4(0,0,0,1),-1.;}float f(vec2 v,out vec4 r){vec2 m=v;int x=int(floor(m.x/BLADES_SPACING)),y=int(floor(m.y/BLADES_SPACING));float z=0.;r=vec4(.16,.22,.14,1);for(int v=-LOOKUP_DIST;v<=LOOKUP_DIST;++v)for(int u=-LOOKUP_DIST;u<=LOOKUP_DIST;++u){vec2 i=vec2(float(x+v),float(y+u));i=i*BLADES_SPACING+f(i)*JITTER_MAX;vec4 d;float s=f(m,i,d);if(s>z)z=s,r=d;}return z;}void main(){vec4 v;float r=f(vWorldPos.xz,v);float shade=1.0;if(abs(vNormal.x+1.0)<0.1)shade=0.65;gl_FragColor=vec4(v.rgb*shade,v.a);}`;

let floorProgram = null, floorPositionBuffer = null, floorNormalBuffer = null, floorIndexBuffer = null, floorIndexCount = 0;
let floorUModelMatrix = null, floorUViewMatrix = null, floorUProjectionMatrix = null, floorUTime = null;
let floorAPosition = null, floorANormal = null;

export function initFloorShader(gl) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, floorVsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, floorFsSource);
    if (!vs || !fs) return false;
    floorProgram = gl.createProgram();
    gl.attachShader(floorProgram, vs);
    gl.attachShader(floorProgram, fs);
    gl.linkProgram(floorProgram);
    if (!gl.getProgramParameter(floorProgram, gl.LINK_STATUS)) return false;
    floorAPosition = gl.getAttribLocation(floorProgram, 'aPosition');
    floorANormal = gl.getAttribLocation(floorProgram, 'aNormal');
    floorUModelMatrix = gl.getUniformLocation(floorProgram, 'uModelMatrix');
    floorUViewMatrix = gl.getUniformLocation(floorProgram, 'uViewMatrix');
    floorUProjectionMatrix = gl.getUniformLocation(floorProgram, 'uProjectionMatrix');
    floorUTime = gl.getUniformLocation(floorProgram, 'uTime');
    floorPositionBuffer = gl.createBuffer();
    floorNormalBuffer = gl.createBuffer();
    floorIndexBuffer = gl.createBuffer();
    return true;
}

export function createFloorGeometry() {
    const positions = [], normals = [], indices = [];
    let vertexOffset = 0;
    const gridSize = getLevelGridSize(), cellSize = getLevelCellSize();
    const roomHalf = (gridSize * cellSize) / 2;
    const levelHeightMap = getCurrentLevel() ? getCurrentLevel().height : null;
    const wrapDepth = 0.15; // How far down the grass wraps
    const wrapWidth = 0.20; // How far inward the grass wraps on walls

    function addQuad(x1, z1, x2, z2, y) {
        positions.push(x1, y, z1, x2, y, z1, x2, y, z2, x1, y, z2);
        for (let i = 0; i < 4; i++) normals.push(0, 1, 0);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
        vertexOffset += 4;
    }

    function addVerticalQuad(x1, y1, z1, x2, y2, z2, nx, ny, nz) {
        positions.push(x1, y1, z1, x2, y1, z2, x2, y2, z2, x1, y2, z1);
        for (let i = 0; i < 4; i++) normals.push(nx, ny, nz);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
        vertexOffset += 4;
    }

    addQuad(-roomHalf, -roomHalf, roomHalf, roomHalf, 0);

    // Add grass wrap on the front wall planes
    addQuad(-roomHalf, roomHalf - wrapWidth, roomHalf, roomHalf, 0);  // z+ wall top edge
    addQuad(-roomHalf, -roomHalf, -roomHalf + wrapWidth, roomHalf, 0);  // x- wall top edge

    // Add grass wrap edges at ground level (room perimeter) - only where no elevated terrain
    if (levelHeightMap) {
        // z+ edge (front) - check if any cells at the front edge have height
        for (let col = 0; col < gridSize; col++) {
            const h = levelHeightMap[gridSize - 1][col];
            if (h === 0) {
                const worldX = (col * cellSize) - roomHalf;
                addVerticalQuad(worldX, -wrapDepth, roomHalf, worldX + cellSize, 0, roomHalf, 0, 0, 1);
            }
        }
        // x- edge (left) - check if any cells at the left edge have height
        for (let row = 0; row < gridSize; row++) {
            const h = levelHeightMap[row][0];
            if (h === 0) {
                const worldZ = (row * cellSize) - roomHalf;
                addVerticalQuad(-roomHalf, 0, worldZ, -roomHalf, -wrapDepth, worldZ + cellSize, -1, 0, 0);
            }
        }
    }

    if (levelHeightMap) {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const h = levelHeightMap[row][col];
                if (h >= 0) {
                    const worldX = (col * cellSize) - roomHalf, worldZ = (row * cellSize) - roomHalf;
                    const topY = h * cellSize;

                    // Top surface
                    addQuad(worldX, worldZ, worldX + cellSize, worldZ + cellSize, topY);

                    // Edge wraps - only on exposed edges (where neighbor is lower or out of bounds)
                    if (h > 0) {
                        const hFront = (row + 1 < gridSize) ? levelHeightMap[row + 1][col] : -1;
                        const hBack = (row - 1 >= 0) ? levelHeightMap[row - 1][col] : -1;
                        const hLeft = (col - 1 >= 0) ? levelHeightMap[row][col - 1] : -1;
                        const hRight = (col + 1 < gridSize) ? levelHeightMap[row][col + 1] : -1;

                        if (hFront < h) addVerticalQuad(worldX, topY - wrapDepth, worldZ + cellSize, worldX + cellSize, topY, worldZ + cellSize, 0, 0, 1); // Front edge
                        if (hBack < h) addVerticalQuad(worldX, topY - wrapDepth, worldZ, worldX + cellSize, topY, worldZ, 0, 0, -1); // Back edge
                        if (hLeft < h) addVerticalQuad(worldX, topY, worldZ, worldX, topY - wrapDepth, worldZ + cellSize, -1, 0, 0); // Left edge
                        if (hRight < h) addVerticalQuad(worldX + cellSize, topY - wrapDepth, worldZ, worldX + cellSize, topY, worldZ + cellSize, 1, 0, 0); // Right edge
                    }
                }
            }
        }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices), indexCount: indices.length };
}

export function updateFloorBuffers(gl, floorGeom) {
    gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, floorGeom.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, floorNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, floorGeom.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, floorGeom.indices, gl.STATIC_DRAW);
    floorIndexCount = floorGeom.indexCount;
}

export function renderFloor(gl, modelMatrix, viewMatrix, projectionMatrix, time) {
    if (!floorProgram || floorIndexCount === 0) return;
    gl.useProgram(floorProgram);
    gl.uniformMatrix4fv(floorUModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(floorUViewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(floorUProjectionMatrix, false, projectionMatrix);
    gl.uniform1f(floorUTime, time);
    gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer);
    gl.enableVertexAttribArray(floorAPosition);
    gl.vertexAttribPointer(floorAPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, floorNormalBuffer);
    gl.enableVertexAttribArray(floorANormal);
    gl.vertexAttribPointer(floorANormal, 3, gl.FLOAT, false, 0, 0);
    // Disable other attribs that may be globally enabled but unused by floor shader
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer);
    gl.drawElements(gl.TRIANGLES, floorIndexCount, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(floorAPosition);
    gl.disableVertexAttribArray(floorANormal);
}
