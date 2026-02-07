import { getLevelGridSize, getLevelCellSize, getCurrentLevel } from './room.js';
import { compileShader } from './math.js';

const floorVsSource = `attribute vec4 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelMatrix;uniform mat4 uViewMatrix;uniform mat4 uProjectionMatrix;varying vec2 vMsg;varying vec3 vWorldPos;void main(){vec4 worldPos=uModelMatrix*aPosition;gl_Position=uProjectionMatrix*uViewMatrix*worldPos;vWorldPos=worldPos.xyz;vMsg=aTexCoord;}`;

const floorFsSource = `precision highp float;uniform float uTime;varying vec3 vWorldPos;
#define BLADES_SPACING 0.1
#define JITTER_MAX 0.08
#define LOOKUP_DIST 2
#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031,.1030,.0973)
#define PI 3.14159265359
float v(vec2 v){vec3 f=fract(vec3(v.xyx)*HASHSCALE1);f+=dot(f,f.yzx+19.19);return fract((f.x+f.y)*f.z);}vec3 t(vec2 v){vec3 f=fract(vec3(v.xyx)*HASHSCALE3);f+=dot(f,f.yxz+19.19);return fract((f.xxy+f.yzz)*f.zyx);}vec2 f(vec2 v){vec3 f=fract(vec3(v.xyx)*HASHSCALE3);f+=dot(f,f.yzx+19.19);return fract((f.xx+f.yz)*f.zy);}vec3 f(float v){return vec3(.2,.4,.3)+vec3(.3,.5,.2)*cos(2.*PI*(vec3(.2,.4,.2)*v+vec3(.66,.77,.33)));}float f(vec2 u,vec2 m,out vec4 r){vec3 i=t(m*123.41)*2.-vec3(1);i.z=i.z*.2+.2;vec2 y=normalize(i.xy);float x=sin(uTime*1.5+m.x*.5+m.y*.5)*.4;y.x+=x*.5;y.y+=x*.5;y=normalize(y);x=v(m*102.7)*.2+.25;vec2 z=u-m;float d=dot(y,z),s=dot(vec2(-y.y,y),z);x=d/x;if(x>=0.&&x<=1.&&abs(s)<=.04*(1.-x*x)){vec3 u=f(v(m*26.6));r=vec4(u*(.2+.8*x),1);return i.z*x;}return r=vec4(0,0,0,1),-1.;}float f(vec2 v,out vec4 r){vec2 m=v;int x=int(floor(m.x/BLADES_SPACING)),y=int(floor(m.y/BLADES_SPACING));float z=0.;r=vec4(.15,.12,.1,1);for(int v=-LOOKUP_DIST;v<=LOOKUP_DIST;++v)for(int u=-LOOKUP_DIST;u<=LOOKUP_DIST;++u){vec2 i=vec2(float(x+v),float(y+u));i=i*BLADES_SPACING+f(i)*JITTER_MAX;vec4 d;float s=f(m,i,d);if(s>z)z=s,r=d;}return z;}void main(){vec4 v;float r=f(vWorldPos.xz,v);gl_FragColor=v;}`;

let floorProgram = null, floorPositionBuffer = null, floorIndexBuffer = null, floorIndexCount = 0;
let floorUModelMatrix = null, floorUViewMatrix = null, floorUProjectionMatrix = null, floorUTime = null;
let floorAPosition = null;

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
    floorUModelMatrix = gl.getUniformLocation(floorProgram, 'uModelMatrix');
    floorUViewMatrix = gl.getUniformLocation(floorProgram, 'uViewMatrix');
    floorUProjectionMatrix = gl.getUniformLocation(floorProgram, 'uProjectionMatrix');
    floorUTime = gl.getUniformLocation(floorProgram, 'uTime');
    floorPositionBuffer = gl.createBuffer();
    floorIndexBuffer = gl.createBuffer();
    return true;
}

export function createFloorGeometry() {
    const positions = [], indices = [];
    let vertexOffset = 0;
    const gridSize = getLevelGridSize(), cellSize = getLevelCellSize();
    const roomHalf = (gridSize * cellSize) / 2;
    const levelHeightMap = getCurrentLevel() ? getCurrentLevel().height : null;
    function addQuad(x1, z1, x2, z2, y) {
        positions.push(x1, y, z1, x2, y, z1, x2, y, z2, x1, y, z2);
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
        vertexOffset += 4;
    }
    addQuad(-roomHalf, -roomHalf, roomHalf, roomHalf, 0);
    if (levelHeightMap) {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const h = levelHeightMap[row][col];
                if (h > 0) {
                    const worldX = (col * cellSize) - roomHalf, worldZ = (row * cellSize) - roomHalf;
                    addQuad(worldX, worldZ, worldX + cellSize, worldZ + cellSize, h * cellSize);
                }
            }
        }
    }
    return { positions: new Float32Array(positions), indices: new Uint16Array(indices), indexCount: indices.length };
}

export function updateFloorBuffers(gl, floorGeom) {
    gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, floorGeom.positions, gl.STATIC_DRAW);
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
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer);
    gl.drawElements(gl.TRIANGLES, floorIndexCount, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(floorAPosition);
}
