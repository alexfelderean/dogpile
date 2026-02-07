// =============================================================================
// PLAYER CHARACTER
// =============================================================================
// Camera/player state
const player = {
    position: [0, 1.6, 0],  // Eye height
    yaw: 0,                  // Horizontal rotation (radians)
    pitch: 0,                // Vertical rotation (radians)
    speed: 0.08,
    sensitivity: 0.002
};

// Room bounds for collision (9x9 grid = 9 units wide, half = 4.5, with margin)
const ROOM_HALF_SIZE = 4.2;
const PLAYER_RADIUS = 0.3;

// Input state
const keys = {};
let isPointerLocked = false;

// Build camera view matrix
function getPlayerViewMatrix(out) {
    mat4Identity(out);
    mat4RotateX(out, -player.pitch);
    mat4RotateY(out, -player.yaw);
    _tempVec3[0] = -player.position[0];
    _tempVec3[1] = -player.position[1];
    _tempVec3[2] = -player.position[2];
    mat4Translate(out, _tempVec3);
}

// Reset player to starting position
function resetPlayer() {
    player.position[0] = 0;
    player.position[1] = 1.6;
    player.position[2] = 0;
    player.yaw = 0;
    player.pitch = 0;
}

// Setup keyboard and mouse input
function setupPlayerInput(canvas, onFirstInput) {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked) return;

        // Callback for first input
        if (onFirstInput && onFirstInput()) {
            // First input handled
        }

        player.yaw -= e.movementX * player.sensitivity;
        player.pitch -= e.movementY * player.sensitivity;

        // Clamp pitch to prevent flipping
        if (player.pitch > 1.57) player.pitch = 1.57;
        else if (player.pitch < -1.57) player.pitch = -1.57;
    });

    // Pointer lock
    const overlay = document.getElementById('overlay');
    const crosshair = document.getElementById('crosshair');
    const timerBar = document.getElementById('timer-bar');
    const ghostCount = document.getElementById('ghost-count');

    overlay.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
        overlay.classList.toggle('hidden', isPointerLocked);
        crosshair.classList.toggle('hidden', !isPointerLocked);
        timerBar.classList.toggle('hidden', !isPointerLocked);
        ghostCount.classList.toggle('hidden', !isPointerLocked);
    });
}

// Check if player has any movement input
function hasPlayerInput() {
    return keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
}

// Update player position based on input
function updatePlayer() {
    if (!isPointerLocked) return false;

    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);
    const speed = player.speed;

    // WASD movement
    if (keys['KeyW']) {
        player.position[0] -= sinYaw * speed;
        player.position[2] -= cosYaw * speed;
    }
    if (keys['KeyS']) {
        player.position[0] += sinYaw * speed;
        player.position[2] += cosYaw * speed;
    }
    if (keys['KeyA']) {
        player.position[0] -= cosYaw * speed;
        player.position[2] += sinYaw * speed;
    }
    if (keys['KeyD']) {
        player.position[0] += cosYaw * speed;
        player.position[2] -= sinYaw * speed;
    }

    // Clamp position to room bounds
    clampPlayerToRoom();

    return true;
}

// Clamp player position to room bounds
function clampPlayerToRoom() {
    if (player.position[0] > ROOM_HALF_SIZE) player.position[0] = ROOM_HALF_SIZE;
    else if (player.position[0] < -ROOM_HALF_SIZE) player.position[0] = -ROOM_HALF_SIZE;
    if (player.position[2] > ROOM_HALF_SIZE) player.position[2] = ROOM_HALF_SIZE;
    else if (player.position[2] < -ROOM_HALF_SIZE) player.position[2] = -ROOM_HALF_SIZE;
}

// Get current player state for recording
function getPlayerState() {
    return {
        x: player.position[0],
        y: player.position[1],
        z: player.position[2],
        yaw: player.yaw,
        pitch: player.pitch
    };
}

// Check if pointer is locked
function isPlayerActive() {
    return isPointerLocked;
}
