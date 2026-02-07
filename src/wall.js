import { compileShader } from './math.js';

const wallVsSource = `attribute vec4 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelMatrix;uniform mat4 uViewMatrix;uniform mat4 uProjectionMatrix;varying vec2 vUV;void main(){vec4 worldPos=uModelMatrix*aPosition;gl_Position=uProjectionMatrix*uViewMatrix*worldPos;vUV=aTexCoord;}`;

const wallFsSource = `precision highp float;varying vec2 vUV;uniform float uNumberOfBricksHeight,uNumberOfBricksWidth;uniform vec3 uBrickColor,uJointColor;float m(vec2 v){return fract(sin(dot(v.xy,vec2(12.9898,78.233)))*43758.5453123);}float x(vec2 v){vec2 f=floor(v),x=fract(v);float y=m(f),z=m(f+vec2(1,0));x=x*x*(3.-2.*x);return mix(y,z,x.x)+(m(f+vec2(0,1))-y)*x.y*(1.-x.x)+(m(f+vec2(1))-z)*x.x*x.y;}float u(vec2 v){float f=0.,z=.5;for(int u=0;u<6;u++)f+=z*x(v),v*=2.,z*=.5;return f;}void main(){vec2 v=vUV*vec2(uNumberOfBricksWidth,uNumberOfBricksHeight)/4.;gl_FragColor=vec4(mix(mix(vec3(.86,.806,.574),vec3(.39,.265,.192),smoothstep(-1.,1.,sin(v.x*14.+u(v.xx*vec2(100,12))*8.))),vec3(.93,.493,.502),m(v)*.5)-(x(v*vec2(20,1.4))-x(v*vec2(100,6.4)))*.2,1);}`;

let wallProgram = null, wallPositionBuffer = null, wallTexCoordBuffer = null, wallIndexBuffer = null, wallIndexCount = 0;
let wallUModelMatrix = null, wallUViewMatrix = null, wallUProjectionMatrix = null;
let wallUBricksHeight = null, wallUBricksWidth = null, wallUBrickColor = null, wallUJointColor = null;
let wallAPosition = null, wallATexCoord = null;

export function initWallShader(gl) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, wallVsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, wallFsSource);
    if (!vs || !fs) return false;
    wallProgram = gl.createProgram();
    gl.attachShader(wallProgram, vs);
    gl.attachShader(wallProgram, fs);
    gl.linkProgram(wallProgram);
    if (!gl.getProgramParameter(wallProgram, gl.LINK_STATUS)) return false;
    wallAPosition = gl.getAttribLocation(wallProgram, 'aPosition');
    wallATexCoord = gl.getAttribLocation(wallProgram, 'aTexCoord');
    wallUModelMatrix = gl.getUniformLocation(wallProgram, 'uModelMatrix');
    wallUViewMatrix = gl.getUniformLocation(wallProgram, 'uViewMatrix');
    wallUProjectionMatrix = gl.getUniformLocation(wallProgram, 'uProjectionMatrix');
    wallUBricksHeight = gl.getUniformLocation(wallProgram, 'uNumberOfBricksHeight');
    wallUBricksWidth = gl.getUniformLocation(wallProgram, 'uNumberOfBricksWidth');
    wallUBrickColor = gl.getUniformLocation(wallProgram, 'uBrickColor');
    wallUJointColor = gl.getUniformLocation(wallProgram, 'uJointColor');
    wallPositionBuffer = gl.createBuffer();
    wallTexCoordBuffer = gl.createBuffer();
    wallIndexBuffer = gl.createBuffer();
    return true;
}

export function updateWallBuffers(gl, wallGeom) {
    gl.bindBuffer(gl.ARRAY_BUFFER, wallPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wallGeom.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, wallTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wallGeom.texCoords, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wallIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wallGeom.indices, gl.STATIC_DRAW);
    wallIndexCount = wallGeom.indexCount;
}

export function renderWalls(gl, modelMatrix, viewMatrix, projectionMatrix) {
    if (!wallProgram || wallIndexCount === 0) return;
    gl.useProgram(wallProgram);
    gl.uniformMatrix4fv(wallUModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(wallUViewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(wallUProjectionMatrix, false, projectionMatrix);
    gl.uniform1f(wallUBricksHeight, 18.0);
    gl.uniform1f(wallUBricksWidth, 18.0);
    gl.uniform3f(wallUBrickColor, 0.85, 0.8, 0.7);
    gl.uniform3f(wallUJointColor, 0.5, 0.48, 0.45);
    // Disable attribs that may be globally enabled but unused by wall shader
    // Wall uses aPosition (0) and aTexCoord (1), so disable 2 and 3
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.bindBuffer(gl.ARRAY_BUFFER, wallPositionBuffer);
    gl.enableVertexAttribArray(wallAPosition);
    gl.vertexAttribPointer(wallAPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, wallTexCoordBuffer);
    gl.enableVertexAttribArray(wallATexCoord);
    gl.vertexAttribPointer(wallATexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wallIndexBuffer);
    gl.drawElements(gl.TRIANGLES, wallIndexCount, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(wallAPosition);
    gl.disableVertexAttribArray(wallATexCoord);
}
