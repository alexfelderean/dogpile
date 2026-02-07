// =============================================================================
// PROCEDURAL SKY BACKGROUND
// =============================================================================

// Sky shader sources
const skyVsSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.999, 1.0);
    }
`;

const skyFsSource = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uResolution;
    
    // Simplex noise functions
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }
    
    // Fractal Brownian Motion for layered clouds
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 5; i++) {
            value += amplitude * snoise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value;
    }
    
    void main() {
        vec2 uv = vUv;
        
        // Aspect ratio correction
        float aspect = uResolution.x / uResolution.y;
        vec2 scaledUv = vec2(uv.x * aspect, uv.y);
        
        // Revolving cloud movement
        float timeScale = uTime * 0.02;
        vec2 cloudUv = scaledUv + vec2(timeScale, timeScale * 0.3);
        
        // Generate cloud layers
        float clouds1 = fbm(cloudUv * 2.0);
        float clouds2 = fbm(cloudUv * 4.0 + vec2(100.0, 50.0));
        
        // Combine cloud layers
        float clouds = clouds1 * 0.6 + clouds2 * 0.4;
        clouds = smoothstep(-0.1, 0.8, clouds);
        
        // Sky gradient (blue at top, lighter at horizon)
        vec3 skyTop = vec3(0.4, 0.6, 0.9);
        vec3 skyBottom = vec3(0.7, 0.85, 1.0);
        vec3 skyColor = mix(skyBottom, skyTop, uv.y);
        
        // Cloud color (white with slight blue tint)
        vec3 cloudColor = vec3(1.0, 1.0, 1.0);
        vec3 cloudShadow = vec3(0.85, 0.88, 0.95);
        vec3 finalCloudColor = mix(cloudShadow, cloudColor, clouds * 0.5 + 0.5);
        
        // Blend sky and clouds
        vec3 finalColor = mix(skyColor, finalCloudColor, clouds * 0.7);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Sky rendering state
let skyProgram = null;
let skyVao = null;
let skyPositionBuffer = null;
let skyUTime = null;
let skyUResolution = null;
let skyAPosition = null;

function initSkyShader(gl) {
    // Compile sky shaders
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Sky shader error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, skyVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, skyFsSource);

    if (!vs || !fs) return false;

    skyProgram = gl.createProgram();
    gl.attachShader(skyProgram, vs);
    gl.attachShader(skyProgram, fs);
    gl.linkProgram(skyProgram);

    if (!gl.getProgramParameter(skyProgram, gl.LINK_STATUS)) {
        console.error('Sky program link error:', gl.getProgramInfoLog(skyProgram));
        return false;
    }

    // Get locations
    skyAPosition = gl.getAttribLocation(skyProgram, 'aPosition');
    skyUTime = gl.getUniformLocation(skyProgram, 'uTime');
    skyUResolution = gl.getUniformLocation(skyProgram, 'uResolution');

    // Create fullscreen quad
    skyPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyPositionBuffer);
    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    console.log('Sky shader initialized');
    return true;
}

function renderSky(gl, time, width, height) {
    if (!skyProgram) return;

    // Use sky shader
    gl.useProgram(skyProgram);

    // Disable depth test for background
    gl.disable(gl.DEPTH_TEST);

    // Set uniforms
    gl.uniform1f(skyUTime, time / 1000.0);
    gl.uniform2f(skyUResolution, width, height);

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, skyPositionBuffer);
    gl.enableVertexAttribArray(skyAPosition);
    gl.vertexAttribPointer(skyAPosition, 2, gl.FLOAT, false, 0, 0);

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Disable the attribute (cleanup)
    gl.disableVertexAttribArray(skyAPosition);

    // Re-enable depth test for scene
    gl.enable(gl.DEPTH_TEST);
}
