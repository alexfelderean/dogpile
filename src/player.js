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

// Room bounds for collision
const ROOM_HALF_SIZE = 4.5;
const PLAYER_RADIUS = 0.3;

// Input state
const keys = {};
let isPointerLocked = false;
let isTouchMode = false;
let gameActive = false;

// Touch controls state
const joystick = { 
    id: null, 
    active: false, 
    vector: { x: 0, y: 0 }, 
    origin: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    radius: 50 // Max drag radius
};
const touchLook = { 
    id: null, 
    active: false, 
    lastX: 0, 
    lastY: 0 
};

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
        // Prevent scrolling for game keys
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    });
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    const clampPitch = () => {
         if (player.pitch > 1.57) player.pitch = 1.57;
        else if (player.pitch < -1.57) player.pitch = -1.57;
    };

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked) return;

        // Callback for first input
        if (onFirstInput && onFirstInput()) {
            // First input handled
        }

        player.yaw -= e.movementX * player.sensitivity;
        player.pitch -= e.movementY * player.sensitivity;
        clampPitch();
    });

    // Pointer lock & UI Elements
    const overlay = document.getElementById('overlay');
    const crosshair = document.getElementById('crosshair');
    const timerBar = document.getElementById('timer-bar');
    const ghostCount = document.getElementById('ghost-count');
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');

    // Handle game state visibility
    function setGameActive(active) {
        gameActive = active;
        if (active) {
            overlay.classList.add('hidden');
            crosshair.classList.remove('hidden');
            timerBar.classList.remove('hidden');
            ghostCount.classList.remove('hidden');
            // Show joystick if in touch mode
            if (isTouchMode) {
                joystickZone.classList.remove('hidden');
            }
        } else {
            overlay.classList.remove('hidden');
            crosshair.classList.add('hidden');
            timerBar.classList.add('hidden');
            ghostCount.classList.add('hidden');
            joystickZone.classList.add('hidden');
        }
    }

    // Desktop Click
    overlay.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    // Touch Start on Overlay
    overlay.addEventListener('touchstart', (e) => {
        isTouchMode = true;
        // Initial touch often doesn't allow immediate pointer lock or fullscreen
        // but we can start the game logic
        setGameActive(true);
        if (onFirstInput) onFirstInput();
        e.preventDefault();
    }, { passive: false });

    // Pointer lock state changes
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
        if (isPointerLocked) {
            isTouchMode = false;
            setGameActive(true);
        } else {
            // Only pause if we werent in touch mode
            if (!isTouchMode) {
                setGameActive(false);
            }
        }
    });

    // -------------------------------------------------------------------------
    // TOUCH CONTROLS
    // -------------------------------------------------------------------------

    function updateJoystickVisual() {
        let dx = joystick.current.x - joystick.origin.x;
        let dy = joystick.current.y - joystick.origin.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = joystick.radius;
        
        // Clamp distance
        if (dist > maxDist) {
            const ratio = maxDist / dist;
            dx *= ratio;
            dy *= ratio;
        }
        
        // Update normalized vector
        joystick.vector.x = dx / maxDist;
        joystick.vector.y = dy / maxDist;
        
        // Move knob
        joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    canvas.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        e.preventDefault(); // Prevent scrolling

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const x = t.clientX;
            const y = t.clientY;

            // Simple zone logic: Left half = move | Right half = look
            // Better: Check valid hit on joystick area?
            // Let's use left half for dynamic joystick logic or strict joystick 
            // The user asked for "joystick on the left", "panning finger on right".
            // We have a visible joystick. Let's make it so you have to grab near it.
            
            const rect = joystickZone.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distToJoystick = Math.hypot(x - centerX, y - centerY);

            if (distToJoystick < 100) { // Hit near joystick
                if (!joystick.active) {
                    joystick.id = t.identifier;
                    joystick.active = true;
                    joystick.origin.x = centerX;
                    joystick.origin.y = centerY;
                    joystick.current.x = x;
                    joystick.current.y = y;
                    updateJoystickVisual();
                }
            } else if (x > window.innerWidth / 2) {
                // Right side look
                if (!touchLook.active) {
                    touchLook.id = t.identifier;
                    touchLook.active = true;
                    touchLook.lastX = x;
                    touchLook.lastY = y;
                }
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!gameActive) return;
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            
            if (t.identifier === joystick.id) {
                joystick.current.x = t.clientX;
                joystick.current.y = t.clientY;
                updateJoystickVisual();
            }
            else if (t.identifier === touchLook.id) {
                const dx = t.clientX - touchLook.lastX;
                const dy = t.clientY - touchLook.lastY;
                
                // Adjust sensitivity for touch
                const touchSens = player.sensitivity * 3.0; // Faster than mouse usually needed
                player.yaw -= dx * touchSens;
                player.pitch -= dy * touchSens;
                clampPitch();
                
                touchLook.lastX = t.clientX;
                touchLook.lastY = t.clientY;
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!gameActive) return;
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            
            if (t.identifier === joystick.id) {
                joystick.active = false;
                joystick.id = null;
                joystick.vector.x = 0;
                joystick.vector.y = 0;
                // Reset visual
                joystickKnob.style.transform = `translate(-50%, -50%)`;
            }
            else if (t.identifier === touchLook.id) {
                touchLook.active = false;
                touchLook.id = null;
            }
        }
    });
}

// Check if player has any movement input
function hasPlayerInput() {
    return keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
           Math.abs(joystick.vector.x) > 0.1 || Math.abs(joystick.vector.y) > 0.1;
}

// Update player position based on input
function updatePlayer() {
    if (!isPlayerActive()) return false;

    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);
    const speed = player.speed;

    let moveFwd = 0;
    let moveRight = 0;

    // Keyboard
    if (keys['KeyW']) moveFwd += 1;
    if (keys['KeyS']) moveFwd -= 1;
    if (keys['KeyA']) moveRight -= 1;
    if (keys['KeyD']) moveRight += 1;

    // Joystick
    moveRight += joystick.vector.x;
    moveFwd -= joystick.vector.y; // Up onscreen (-y) means move forward (+fwd)

    if (moveFwd === 0 && moveRight === 0) return false;

    // Apply movement
    // X = -sin(yaw)*fwd + cos(yaw)*right
    // Z = -cos(yaw)*fwd - sin(yaw)*right
    player.position[0] += (moveRight * cosYaw - moveFwd * sinYaw) * speed;
    player.position[2] += (moveRight * (-sinYaw) - moveFwd * cosYaw) * speed;

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
    return gameActive;
}
