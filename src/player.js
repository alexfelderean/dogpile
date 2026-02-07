// =============================================================================
// PLAYER CHARACTER
// =============================================================================
// Camera/player state
const player = {
    position: [0, 0, 0],  // Ground level
    speed: 0.08,
    velocityY: 0,
    isJumping: false,
    jumpForce: 0.25,
    gravity: 0.015
};

// Room bounds for collision (9x9 grid * 2 cell size = 18 units wide, half = 9, with margin)
const ROOM_HALF_SIZE = 8.7;
const PLAYER_RADIUS = 0.7;

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

const jumpButton = {
    id: null,
    pressed: false
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
    const jumpBtn = document.getElementById('jump-button');

    // Handle game state visibility
    function setGameActive(active) {
        gameActive = active;
        if (active) {
            overlay.classList.add('hidden');
            timerBar.classList.remove('hidden');
            ghostCount.classList.remove('hidden');
            joystickZone.classList.remove('hidden');
            jumpBtn.classList.remove('hidden');
        } else {
            overlay.classList.remove('hidden');
            timerBar.classList.add('hidden');
            ghostCount.classList.add('hidden');
            joystickZone.classList.add('hidden');
            jumpBtn.classList.add('hidden');
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

    // Jump button touch handling
    jumpBtn.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        e.preventDefault();
        jumpButton.pressed = true;
        jumpButton.id = e.changedTouches[0].identifier;
        jumpBtn.classList.add('pressed');
    }, { passive: false });

    jumpBtn.addEventListener('touchend', (e) => {
        if (!gameActive) return;
        e.preventDefault();
        jumpButton.pressed = false;
        jumpButton.id = null;
        jumpBtn.classList.remove('pressed');
    }, { passive: false });

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
        keys['Space'] || jumpButton.pressed ||
        Math.abs(joystick.vector.x) > 0.1 || Math.abs(joystick.vector.y) > 0.1;
}

// Update player position based on input (isometric-aligned movement)
function updatePlayer() {
    if (!isPlayerActive()) return false;

    const speed = player.speed;

    let moveFwd = 0;  // Forward/back in screen space
    let moveRight = 0; // Left/right in screen space

    // Keyboard - isometric-aligned movement
    // W = toward back corner, S = toward front corner
    // A = toward left corner, D = toward right corner
    if (keys['KeyW'] || keys['ArrowUp']) moveFwd += 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveFwd -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveRight -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveRight += 1;

    // Joystick - isometric-aligned
    moveRight += joystick.vector.x;
    moveFwd -= joystick.vector.y; // Invert Y for natural control

    // Apply horizontal movement only if there's input
    if (moveFwd !== 0 || moveRight !== 0) {
        // Convert isometric screen space to world space (45-degree rotation)
        // W (forward) should go toward back corner, S (back) toward front corner
        // D (right) should go toward right corner, A (left) toward left corner
        const moveX = (moveRight + moveFwd) * 0.7071; // cos(45°) ≈ 0.7071
        const moveZ = (moveRight - moveFwd) * 0.7071;

        // Apply movement
        player.position[0] += moveX * speed;
        player.position[2] += moveZ * speed;
    }

    // Handle jumping (always check, regardless of movement)
    if ((keys['Space'] || jumpButton.pressed) && !player.isJumping) {
        player.velocityY = player.jumpForce;
        player.isJumping = true;
    }

    // Apply gravity and vertical movement (always runs)
    player.velocityY -= player.gravity;
    player.position[1] += player.velocityY;

    // Ground collision
    if (player.position[1] <= 0) {
        player.position[1] = 0;
        player.velocityY = 0;
        player.isJumping = false;
    }

    // Clamp position to room bounds
    clampPlayerToRoom();

    return true;
}

// Clamp player position to room bounds (accounting for player cube size)
function clampPlayerToRoom() {
    const playerHalf = 0.7;  // Half of player cube size (1.4 / 2)
    const maxPos = ROOM_HALF_SIZE - playerHalf;

    if (player.position[0] > maxPos) player.position[0] = maxPos;
    else if (player.position[0] < -maxPos) player.position[0] = -maxPos;
    if (player.position[2] > maxPos) player.position[2] = maxPos;
    else if (player.position[2] < -maxPos) player.position[2] = -maxPos;
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
