const wallVsSource = `attribute vec4 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelMatrix;uniform mat4 uViewMatrix;uniform mat4 uProjectionMatrix;varying vec2 vUV;void main(){vec4 worldPos=uModelMatrix*aPosition;gl_Position=uProjectionMatrix*uViewMatrix*worldPos;vUV=aTexCoord;}`;

const wallFsSource = `precision highp float;varying vec2 vUV;uniform float uNumberOfBricksHeight;uniform float uNumberOfBricksWidth;uniform vec3 uBrickColor;uniform vec3 uJointColor;
float random(in vec2 st){return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);}
float noise(in vec2 st){vec2 i=floor(st);vec2 f=fract(st);float a=random(i);float b=random(i+vec2(1.0,0.0));float c=random(i+vec2(0.0,1.0));float d=random(i+vec2(1.0,1.0));vec2 u=f*f*(3.0-2.0*f);return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}
float fbm(in vec2 st){float value=0.0;float amplitud=.5;for(int i=0;i<6;i++){value+=amplitud*noise(st);st*=2.;amplitud*=.5;}return value;}
void main(void){vec2 u_resolution=vec2(uNumberOfBricksWidth,uNumberOfBricksHeight);vec2 st=vUV*u_resolution/4.0;float v0=smoothstep(-1.0,1.0,sin(st.x*14.0+fbm(st.xx*vec2(100.0,12.0))*8.0));float v1=random(st);float v2=noise(st*vec2(20.0,1.4))-noise(st*vec2(100.0,6.4));vec3 col=vec3(0.860,0.806,0.574);col=mix(col,vec3(0.390,0.265,0.192),v0);col=mix(col,vec3(0.930,0.493,0.502),v1*0.5);col-=v2*0.2;gl_FragColor=vec4(col,1.0);}`;

let wallProgram = null, wallPositionBuffer = null, wallTexCoordBuffer = null, wallIndexBuffer = null, wallIndexCount = 0;
let wallUModelMatrix = null, wallUViewMatrix = null, wallUProjectionMatrix = null;
let wallUBricksHeight = null, wallUBricksWidth = null, wallUBrickColor = null, wallUJointColor = null;
let wallAPosition = null, wallATexCoord = null;

export function initWallShader(gl) {
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
        return shader;
    }
    const vs = compileShader(gl.VERTEX_SHADER, wallVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, wallFsSource);
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
