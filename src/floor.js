import { getLevelGridSize, getLevelCellSize, getCurrentLevel } from './room.js';

const floorVsSource = `attribute vec4 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelMatrix;uniform mat4 uViewMatrix;uniform mat4 uProjectionMatrix;varying vec2 vMsg;varying vec3 vWorldPos;void main(){vec4 worldPos=uModelMatrix*aPosition;gl_Position=uProjectionMatrix*uViewMatrix*worldPos;vWorldPos=worldPos.xyz;vMsg=aTexCoord;}`;

const floorFsSource = `precision highp float;uniform float uTime;varying vec3 vWorldPos;
#define BLADES_SPACING 0.1
#define JITTER_MAX 0.08
#define LOOKUP_DIST 2
#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031,.1030,.0973)
#define PI 3.14159265359
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*HASHSCALE1);p3+=dot(p3,p3.yzx+19.19);return fract((p3.x+p3.y)*p3.z);}
vec3 hash32(vec2 p){vec3 p3=fract(vec3(p.xyx)*HASHSCALE3);p3+=dot(p3,p3.yxz+19.19);return fract((p3.xxy+p3.yzz)*p3.zyx);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*HASHSCALE3);p3+=dot(p3,p3.yzx+19.19);return fract((p3.xx+p3.yz)*p3.zy);}
vec3 getGrassColor(float x){vec3 a=vec3(0.2,0.4,0.3);vec3 b=vec3(0.3,0.5,0.2);vec3 c=vec3(0.2,0.4,0.2);vec3 d=vec3(0.66,0.77,0.33);return a+b*cos(2.*PI*(c*x+d));}
float getGrassBlade(in vec2 position,in vec2 grassPos,out vec4 color){vec3 grassVector3=hash32(grassPos*123.41)*2.0-vec3(1);grassVector3.z=grassVector3.z*0.2+0.2;vec2 grassVector2=normalize(grassVector3.xy);float wind=sin(uTime*1.5+grassPos.x*0.5+grassPos.y*0.5)*0.4;grassVector2.x+=wind*0.5;grassVector2.y+=wind*0.5;grassVector2=normalize(grassVector2);float grassLength=hash12(grassPos*102.7)*0.2+0.25;vec2 gv=position-grassPos;float gx=dot(grassVector2,gv);float gy=dot(vec2(-grassVector2.y,grassVector2.x),gv);float gxn=gx/grassLength;if(gxn>=0.0&&gxn<=1.0&&abs(gy)<=0.04*(1.-gxn*gxn)){vec3 thisGrassColor=getGrassColor(hash12(grassPos*26.6));color=vec4(thisGrassColor*(0.2+0.8*gxn),1.0);return grassVector3.z*gxn;}else{color=vec4(0.,0.,0.,1.);return -1.0;}}
float getPoint(in vec2 position,out vec4 color){float scale=1.0;vec2 scaledPos=position*scale;int ox=int(floor(scaledPos.x/BLADES_SPACING));int oy=int(floor(scaledPos.y/BLADES_SPACING));float maxz=0.0;vec4 bgColor=vec4(0.15,0.12,0.1,1.0);color=bgColor;for(int i=-LOOKUP_DIST;i<=LOOKUP_DIST;++i){for(int j=-LOOKUP_DIST;j<=LOOKUP_DIST;++j){vec2 upos=vec2(float(ox+i),float(oy+j));vec2 grassPos=(upos*BLADES_SPACING+hash22(upos)*JITTER_MAX);vec4 tempColor;float z=getGrassBlade(scaledPos,grassPos,tempColor);if(z>maxz){maxz=z;color=tempColor;}}}return maxz;}
void main(void){vec4 color;float z=getPoint(vWorldPos.xz,color);gl_FragColor=color;}`;

let floorProgram = null, floorPositionBuffer = null, floorIndexBuffer = null, floorIndexCount = 0;
let floorUModelMatrix = null, floorUViewMatrix = null, floorUProjectionMatrix = null, floorUTime = null;
let floorAPosition = null;

export function initFloorShader(gl) {
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
        return shader;
    }
    const vs = compileShader(gl.VERTEX_SHADER, floorVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, floorFsSource);
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
