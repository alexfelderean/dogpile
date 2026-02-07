import { compileShader } from './math.js';

const skyVsSource = `attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*0.5+0.5;gl_Position=vec4(aPosition,0.999,1.0);}`;

const skyFsSource = `precision highp float;varying vec2 vUv;uniform float uTime;uniform vec2 uResolution;vec3 f(vec3 v){return v-floor(v*(1./289.))*289.;}vec2 f(vec2 v){return v-floor(v*(1./289.))*289.;}vec3 t(vec3 v){return f((v*34.+1.)*v);}float r(vec2 v){const vec4 u=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);vec2 y=floor(v+dot(v,u.yy)),x=v-y+dot(y,u.xx);v=x.x>x.y?vec2(1,0):vec2(0,1);vec4 r=x.xyxy+u.xxzz;r.xy-=v;y=f(y);vec3 i=t(t(y.y+vec3(0,v.y,1))+y.x+vec3(0,v.x,1)),m=max(.5-vec3(dot(x,x),dot(r.xy,r.xy),dot(r.zw,r.zw)),0.);m*=m;m*=m;i=2.*fract(i*u.www)-1.;vec3 z=abs(i)-.5;i-=floor(i+.5);m*=1.79284291400159-.85373472095314*(i*i+z*z);vec3 d;d.x=i.x*x.x+z.x*x.y;d.yz=i.yz*r.xz+z.yz*r.yw;return 130.*dot(m,d);}float u(vec2 v){float f=0.,x=.5,z=1.;for(int u=0;u<5;u++)f+=x*r(v*z),x*=.5,z*=2.;return f;}void main(){vec2 v=vUv;float f=uTime*.02;vec2 m=vec2(v.x*(uResolution.x/uResolution.y),v.y)+vec2(f,f*.3);f=u(m*2.);float x=u(m*4.+vec2(100,50));f=smoothstep(-.1,.8,f*.6+x*.4);gl_FragColor=vec4(mix(mix(vec3(.7,.85,1),vec3(.4,.6,.9),v.y),mix(vec3(.85,.88,.95),vec3(1),f*.5+.5),f*.7),1);}`;

let skyProgram = null, skyPositionBuffer = null, skyUTime = null, skyUResolution = null, skyAPosition = null;

export function initSkyShader(gl) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, skyVsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, skyFsSource);
    if (!vs || !fs) return false;
    skyProgram = gl.createProgram();
    gl.attachShader(skyProgram, vs);
    gl.attachShader(skyProgram, fs);
    gl.linkProgram(skyProgram);
    if (!gl.getProgramParameter(skyProgram, gl.LINK_STATUS)) return false;
    skyAPosition = gl.getAttribLocation(skyProgram, 'aPosition');
    skyUTime = gl.getUniformLocation(skyProgram, 'uTime');
    skyUResolution = gl.getUniformLocation(skyProgram, 'uResolution');
    skyPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    return true;
}

export function renderSky(gl, time, width, height) {
    if (!skyProgram) return;
    gl.useProgram(skyProgram);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(skyUTime, time / 1000.0);
    gl.uniform2f(skyUResolution, width, height);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyPositionBuffer);
    gl.enableVertexAttribArray(skyAPosition);
    gl.vertexAttribPointer(skyAPosition, 2, gl.FLOAT, false, 0, 0);
    // Disable other attribs that may be globally enabled but unused by sky shader
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(skyAPosition);
    gl.enable(gl.DEPTH_TEST);
}
