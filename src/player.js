// =============================================================================
// PLAYER CHARACTER
// =============================================================================
// Camera/player state
const player = {
    position: [0, 0, 0],  // Ground level
    speed: 0.08
};

// Room bounds for collision (9x9 grid * 2 cell size = 18 units wide, half = 9, with margin)
const ROOM_HALF_SIZE = 8.7;
const PLAYER_RADIUS = 0.3;

// Input state
const keys = {};
let gameActive = false;
let isTouchMode = false;

// Touch controls state
const joystick = { 
    id: null, 
    active: false, 
    vector: { x: 0, y: 0 }, 
    origin: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    radius: 50 // Max drag radius
};

// Reset player to starting position
function resetPlayer() {
    player.position[0] = 0;
    player.position[1] = 0;
    player.position[2] = 0;
}

// Get player position for rendering
function getPlayerPosition() {
    return player.position;
}

// Setup keyboard and mouse input
function setupPlayerInput(canvas, onFirstInput) {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        // Prevent scrolling for game keys
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
        // Start game on any movement key
        if (gameActive && onFirstInput) {
            onFirstInput();
        }
    });
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // UI Elements
    const overlay = document.getElementById('overlay');
    const timerBar = document.getElementById('timer-bar');
    const ghostCount = document.getElementById('ghost-count');
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');

    // Handle game state visibility
    function setGameActive(active) {
        gameActive = active;
        if (active) {
            overlay.classList.add('hidden');
            timerBar.classList.remove('hidden');
            ghostCount.classList.remove('hidden');
            joystickZone.classList.remove('hidden');
        } else {
            overlay.classList.remove('hidden');
            timerBar.classList.add('hidden');
            ghostCount.classList.add('hidden');
            joystickZone.classList.add('hidden');
        }
    }

    // Click to start (no pointer lock needed for isometric)
    overlay.addEventListener('click', () => {
        setGameActive(true);
        if (onFirstInput) onFirstInput();
    });

    // Touch Start on Overlay
    overlay.addEventListener('touchstart', (e) => {
        isTouchMode = true;
        setGameActive(true);
        if (onFirstInput) onFirstInput();
        e.preventDefault();
    }, { passive: false });

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
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const x = t.clientX;
            const y = t.clientY;

            // Any touch can control the joystick
            const rect = joystickZone.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distToJoystick = Math.hypot(x - centerX, y - centerY);

            if (distToJoystick < 150 && !joystick.active) {
                joystick.id = t.identifier;
                joystick.active = true;
                joystick.origin.x = centerX;
                joystick.origin.y = centerY;
                joystick.current.x = x;
                joystick.current.y = y;
                updateJoystickVisual();
                if (onFirstInput) onFirstInput();
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
                joystickKnob.style.transform = `translate(-50%, -50%)`;
            }
        }
    });
}

// Check if player has any movement input
function hasPlayerInput() {
    return keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
           keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] ||
           Math.abs(joystick.vector.x) > 0.1 || Math.abs(joystick.vector.y) > 0.1;
}

// Update player position based on input (world-relative for isometric)
function updatePlayer() {
    if (!isPlayerActive()) return false;

    const speed = player.speed;

    let moveX = 0;
    let moveZ = 0;

    // Keyboard - world-relative movement
    // In isometric view: W/Up = -Z (away), S/Down = +Z (toward)
    //                    A/Left = -X (left), D/Right = +X (right)
    if (keys['KeyW'] || keys['ArrowUp']) moveZ -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveZ += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

    // Joystick - world-relative
    // joystick.vector.x = left/right = X axis
    // joystick.vector.y = up/down = Z axis (up screen = -Z)
    moveX += joystick.vector.x;
    moveZ += joystick.vector.y;

    if (moveX === 0 && moveZ === 0) return false;

    // Normalize diagonal movement
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 1) {
        moveX /= len;
        moveZ /= len;
    }

    // Apply movement
    player.position[0] += moveX * speed;
    player.position[2] += moveZ * speed;

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
        yaw: 0,   // No rotation in isometric
        pitch: 0
    };
}

// Check if game is active
function isPlayerActive() {
    return gameActive;
}
