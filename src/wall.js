// =============================================================================
// PROCEDURAL BRICK WALL SHADER
// =============================================================================

// Wall shader sources
const wallVsSource = `
    attribute vec4 aPosition;
    attribute vec2 aTexCoord;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec2 vUV;
    void main() {
        vec4 worldPos = uModelMatrix * aPosition;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
        vUV = aTexCoord;
    }
`;

const wallFsSource = `
    precision highp float;
    varying vec2 vUV;
    
    uniform float uNumberOfBricksHeight; // Used as vertical resolution scale
    uniform float uNumberOfBricksWidth;  // Used as horizontal resolution scale
    // uBrickColor and uJointColor can be used to tint the wood if needed
    uniform vec3 uBrickColor;
    uniform vec3 uJointColor;
    
    // --- noise functions ---
    float random(in vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise(in vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);

        // Four corners in 2D of a tile
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));

        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(a, b, u.x) +
                (c - a)* u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
    }

    #define OCTAVES 6
    float fbm(in vec2 st) {
        // Initial values
        float value = 0.0;
        float amplitud = .5;
        
        // Loop of octaves
        for (int i = 0; i < OCTAVES; i++) {
            value += amplitud * noise(st);
            st *= 2.;
            amplitud *= .5;
        }
        return value;
    }

    void main(void) {
        // Use uniform scales to adjust texture density
        vec2 u_resolution = vec2(uNumberOfBricksWidth, uNumberOfBricksHeight);
        
        // Scale UVs by resolution to get world-like coordinates
        vec2 st = vUV * u_resolution / 4.0; // Divide by 4 to scale it down a bit (make grain larger)
        
        // Wood grain pattern
        float v0 = smoothstep(-1.0, 1.0, sin(st.x * 14.0 + fbm(st.xx * vec2(100.0, 12.0)) * 8.0));
        float v1 = random(st);
        float v2 = noise(st * vec2(20.0, 1.4)) - noise(st * vec2(100.0, 6.4)); // Adjusted scales for wall UVs

        // Base wood colors
        vec3 col = vec3(0.860, 0.806, 0.574);
        col = mix(col, vec3(0.390, 0.265, 0.192), v0);
        col = mix(col, vec3(0.930, 0.493, 0.502), v1 * 0.5);
        col -= v2 * 0.2;
        
        // Apply tint from uniforms (optional, but good for flexibility)
        // mix with uBrickColor to allow external tinting
        // col = mix(col, uBrickColor, 0.2); 

        gl_FragColor = vec4(col, 1.0);
    }
`;

// Wall rendering state
let wallProgram = null;
let wallPositionBuffer = null;
let wallTexCoordBuffer = null;
let wallIndexBuffer = null;
let wallIndexCount = 0;

// Uniform locations
let wallUModelMatrix = null;
let wallUViewMatrix = null;
let wallUProjectionMatrix = null;
let wallUBricksHeight = null;
let wallUBricksWidth = null;
let wallUBrickColor = null;
let wallUJointColor = null;

// Attribute locations
let wallAPosition = null;
let wallATexCoord = null;

function initWallShader(gl) {
    // Compile wall shaders
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Wall shader error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, wallVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, wallFsSource);

    if (!vs || !fs) return false;

    wallProgram = gl.createProgram();
    gl.attachShader(wallProgram, vs);
    gl.attachShader(wallProgram, fs);
    gl.linkProgram(wallProgram);

    if (!gl.getProgramParameter(wallProgram, gl.LINK_STATUS)) {
        console.error('Wall program link error:', gl.getProgramInfoLog(wallProgram));
        return false;
    }

    // Get attribute locations
    wallAPosition = gl.getAttribLocation(wallProgram, 'aPosition');
    wallATexCoord = gl.getAttribLocation(wallProgram, 'aTexCoord');

    // Get uniform locations
    wallUModelMatrix = gl.getUniformLocation(wallProgram, 'uModelMatrix');
    wallUViewMatrix = gl.getUniformLocation(wallProgram, 'uViewMatrix');
    wallUProjectionMatrix = gl.getUniformLocation(wallProgram, 'uProjectionMatrix');
    wallUBricksHeight = gl.getUniformLocation(wallProgram, 'uNumberOfBricksHeight');
    wallUBricksWidth = gl.getUniformLocation(wallProgram, 'uNumberOfBricksWidth');
    wallUBrickColor = gl.getUniformLocation(wallProgram, 'uBrickColor');
    wallUJointColor = gl.getUniformLocation(wallProgram, 'uJointColor');

    // Create buffers
    wallPositionBuffer = gl.createBuffer();
    wallTexCoordBuffer = gl.createBuffer();
    wallIndexBuffer = gl.createBuffer();

    console.log('Wall shader initialized');
    return true;
}

function updateWallBuffers(gl, wallGeom) {
    gl.bindBuffer(gl.ARRAY_BUFFER, wallPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wallGeom.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, wallTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wallGeom.texCoords, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wallIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wallGeom.indices, gl.STATIC_DRAW);

    wallIndexCount = wallGeom.indexCount;
}

function renderWalls(gl, modelMatrix, viewMatrix, projectionMatrix) {
    if (!wallProgram || wallIndexCount === 0) return;

    gl.useProgram(wallProgram);

    // Set matrices
    gl.uniformMatrix4fv(wallUModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(wallUViewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(wallUProjectionMatrix, false, projectionMatrix);

    // Set brick parameters
    gl.uniform1f(wallUBricksHeight, 18.0);  // Rows of bricks (based on wall height)
    gl.uniform1f(wallUBricksWidth, 18.0);   // Columns of bricks (based on wall width)
    // gl.uniform3f(wallUBrickColor, 0.6, 0.45, 0.35);  // Warm brick color
    // gl.uniform3f(wallUJointColor, 0.35, 0.32, 0.3);  // Dark mortar

    // gl.uniform3f(wallUBrickColor, 0.7, 0.3, 0.25);   // Red brick
    // gl.uniform3f(wallUJointColor, 0.8, 0.78, 0.75);  // Light gray mortar

    gl.uniform3f(wallUBrickColor, 0.85, 0.8, 0.7);   // Cream stone
    gl.uniform3f(wallUJointColor, 0.5, 0.48, 0.45);  // Gray mortar

    //     gl.uniform3f(wallUBrickColor, 0.55, 0.55, 0.6);  // Gray-blue brick
    // gl.uniform3f(wallUJointColor, 0.3, 0.3, 0.32);   // Dark mortar

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, wallPositionBuffer);
    gl.enableVertexAttribArray(wallAPosition);
    gl.vertexAttribPointer(wallAPosition, 3, gl.FLOAT, false, 0, 0);

    // Bind texcoord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, wallTexCoordBuffer);
    gl.enableVertexAttribArray(wallATexCoord);
    gl.vertexAttribPointer(wallATexCoord, 2, gl.FLOAT, false, 0, 0);

    // Bind index buffer and draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wallIndexBuffer);
    gl.drawElements(gl.TRIANGLES, wallIndexCount, gl.UNSIGNED_SHORT, 0);

    // Cleanup
    gl.disableVertexAttribArray(wallAPosition);
    gl.disableVertexAttribArray(wallATexCoord);
}
