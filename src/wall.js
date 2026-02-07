import { compileShader } from './math.js';

// Simple white shader with basic lighting
const fenceVsSource = `
attribute vec4 aPosition;
attribute vec3 aNormal;
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
    vec4 worldPos = uModelMatrix * aPosition;
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    vNormal = mat3(uModelMatrix) * aNormal;
    vWorldPos = worldPos.xyz;
}`;

const fenceFsSource = `
precision highp float;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    vec3 norm = normalize(vNormal);
    float diff = max(dot(norm, lightDir), 0.0) * 0.4 + 0.6;
    // White paint with slight cream tint
    vec3 baseColor = vec3(0.97, 0.96, 0.93);
    gl_FragColor = vec4(baseColor * diff, 1.0);
}`;

let fenceProgram = null, fencePositionBuffer = null, fenceNormalBuffer = null, fenceIndexBuffer = null, fenceIndexCount = 0;
let fenceUModelMatrix = null, fenceUViewMatrix = null, fenceUProjectionMatrix = null;
let fenceAPosition = null, fenceANormal = null;

export function initWallShader(gl) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, fenceVsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fenceFsSource);
    if (!vs || !fs) return false;
    fenceProgram = gl.createProgram();
    gl.attachShader(fenceProgram, vs);
    gl.attachShader(fenceProgram, fs);
    gl.linkProgram(fenceProgram);
    if (!gl.getProgramParameter(fenceProgram, gl.LINK_STATUS)) return false;
    fenceAPosition = gl.getAttribLocation(fenceProgram, 'aPosition');
    fenceANormal = gl.getAttribLocation(fenceProgram, 'aNormal');
    fenceUModelMatrix = gl.getUniformLocation(fenceProgram, 'uModelMatrix');
    fenceUViewMatrix = gl.getUniformLocation(fenceProgram, 'uViewMatrix');
    fenceUProjectionMatrix = gl.getUniformLocation(fenceProgram, 'uProjectionMatrix');
    fencePositionBuffer = gl.createBuffer();
    fenceNormalBuffer = gl.createBuffer();
    fenceIndexBuffer = gl.createBuffer();
    return true;
}

export function updateWallBuffers(gl, fenceGeom) {
    gl.bindBuffer(gl.ARRAY_BUFFER, fencePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fenceGeom.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, fenceNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fenceGeom.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fenceIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, fenceGeom.indices, gl.STATIC_DRAW);
    fenceIndexCount = fenceGeom.indexCount;
}

export function renderWalls(gl, modelMatrix, viewMatrix, projectionMatrix) {
    if (!fenceProgram || fenceIndexCount === 0) return;
    gl.useProgram(fenceProgram);
    gl.uniformMatrix4fv(fenceUModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(fenceUViewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(fenceUProjectionMatrix, false, projectionMatrix);
    // Disable unused attribs
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.bindBuffer(gl.ARRAY_BUFFER, fencePositionBuffer);
    gl.enableVertexAttribArray(fenceAPosition);
    gl.vertexAttribPointer(fenceAPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, fenceNormalBuffer);
    gl.enableVertexAttribArray(fenceANormal);
    gl.vertexAttribPointer(fenceANormal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fenceIndexBuffer);
    gl.drawElements(gl.TRIANGLES, fenceIndexCount, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(fenceAPosition);
    gl.disableVertexAttribArray(fenceANormal);
}
