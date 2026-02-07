const skyVsSource = `attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*0.5+0.5;gl_Position=vec4(aPosition,0.999,1.0);}`;

const skyFsSource = `precision highp float;varying vec2 vUv;uniform float uTime;uniform vec2 uResolution;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}
float fbm(vec2 p){float value=0.0;float amplitude=0.5;float frequency=1.0;for(int i=0;i<5;i++){value+=amplitude*snoise(p*frequency);amplitude*=0.5;frequency*=2.0;}return value;}
void main(){vec2 uv=vUv;float aspect=uResolution.x/uResolution.y;vec2 scaledUv=vec2(uv.x*aspect,uv.y);float timeScale=uTime*0.02;vec2 cloudUv=scaledUv+vec2(timeScale,timeScale*0.3);float clouds1=fbm(cloudUv*2.0);float clouds2=fbm(cloudUv*4.0+vec2(100.0,50.0));float clouds=clouds1*0.6+clouds2*0.4;clouds=smoothstep(-0.1,0.8,clouds);vec3 skyTop=vec3(0.4,0.6,0.9);vec3 skyBottom=vec3(0.7,0.85,1.0);vec3 skyColor=mix(skyBottom,skyTop,uv.y);vec3 cloudColor=vec3(1.0,1.0,1.0);vec3 cloudShadow=vec3(0.85,0.88,0.95);vec3 finalCloudColor=mix(cloudShadow,cloudColor,clouds*0.5+0.5);vec3 finalColor=mix(skyColor,finalCloudColor,clouds*0.7);gl_FragColor=vec4(finalColor,1.0);}`;

let skyProgram = null, skyPositionBuffer = null, skyUTime = null, skyUResolution = null, skyAPosition = null;

export function initSkyShader(gl) {
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
        return shader;
    }
    const vs = compileShader(gl.VERTEX_SHADER, skyVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, skyFsSource);
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
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(skyAPosition);
    gl.enable(gl.DEPTH_TEST);
}
