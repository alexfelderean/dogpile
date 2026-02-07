// Player character
const player = { position: [0, 0, 0], speed: 0.16, velocityY: 0, isJumping: false, jumpForce: 0.25, gravity: 0.015 };
const ROOM_HALF_SIZE = 8.7;
const keys = {};
let gameActive = true;
const joystick = { id: null, active: false, vector: { x: 0, y: 0 }, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 }, radius: 50 };
const jumpButton = { id: null, pressed: false };
let spawnPosition = null;

function setPlayerSpawn(x, y, z) { spawnPosition = [x, y, z]; }
function resetPlayer() { player.position[0] = spawnPosition[0]; player.position[1] = spawnPosition[1]; player.position[2] = spawnPosition[2]; }
function getPlayerPosition() { return player.position; }

function setupPlayerInput(canvas, onFirstInput) {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (gameActive && onFirstInput) onFirstInput();
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    const jumpBtn = document.getElementById('jump-button');

    document.getElementById('timer-bar').classList.remove('hidden');
    document.getElementById('ghost-count').classList.remove('hidden');
    joystickZone.classList.remove('hidden');
    jumpBtn.classList.remove('hidden');

    function updateJoystickVisual() {
        let dx = joystick.current.x - joystick.origin.x, dy = joystick.current.y - joystick.origin.y;
        const dist = Math.hypot(dx, dy);
        if (dist > joystick.radius) { const r = joystick.radius / dist; dx *= r; dy *= r; }
        joystick.vector.x = dx / joystick.radius;
        joystick.vector.y = dy / joystick.radius;
        joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    jumpBtn.addEventListener('touchstart', (e) => { if (!gameActive) return; e.preventDefault(); jumpButton.pressed = true; jumpButton.id = e.changedTouches[0].identifier; jumpBtn.classList.add('pressed'); }, { passive: false });
    jumpBtn.addEventListener('touchend', (e) => { if (!gameActive) return; e.preventDefault(); jumpButton.pressed = false; jumpButton.id = null; jumpBtn.classList.remove('pressed'); }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        if (!gameActive) return; e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i], x = t.clientX, y = t.clientY;
            const rect = joystickZone.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            if (Math.hypot(x - cx, y - cy) < 150 && !joystick.active) {
                joystick.id = t.identifier; joystick.active = true;
                joystick.origin.x = cx; joystick.origin.y = cy;
                joystick.current.x = x; joystick.current.y = y;
                updateJoystickVisual();
                if (onFirstInput) onFirstInput();
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!gameActive) return; e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === joystick.id) { joystick.current.x = t.clientX; joystick.current.y = t.clientY; updateJoystickVisual(); }
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!gameActive) return; e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === joystick.id) { joystick.active = false; joystick.id = null; joystick.vector.x = 0; joystick.vector.y = 0; joystickKnob.style.transform = 'translate(-50%, -50%)'; }
        }
    });
}

function hasPlayerInput() {
    return keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] || keys['Space'] || jumpButton.pressed || Math.abs(joystick.vector.x) > 0.1 || Math.abs(joystick.vector.y) > 0.1;
}

function updatePlayer() {
    if (!isPlayerActive()) return false;
    let moveFwd = 0, moveRight = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveFwd += 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveFwd -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveRight -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveRight += 1;
    moveRight += joystick.vector.x;
    moveFwd -= joystick.vector.y;
    if (moveFwd !== 0 || moveRight !== 0) {
        const moveX = (moveRight + moveFwd) * 0.7071, moveZ = (moveRight - moveFwd) * 0.7071;
        player.position[0] += moveX * player.speed;
        player.position[2] += moveZ * player.speed;
    }
    if ((keys['Space'] || jumpButton.pressed) && !player.isJumping) { player.velocityY = player.jumpForce; player.isJumping = true; }
    player.velocityY -= player.gravity;
    player.position[1] += player.velocityY;
    if (player.position[1] <= 0) { player.position[1] = 0; player.velocityY = 0; player.isJumping = false; }
    clampPlayerToRoom();
    return true;
}

function clampPlayerToRoom() {
    const maxPos = ROOM_HALF_SIZE - 0.7;
    if (player.position[0] > maxPos) player.position[0] = maxPos;
    else if (player.position[0] < -maxPos) player.position[0] = -maxPos;
    if (player.position[2] > maxPos) player.position[2] = maxPos;
    else if (player.position[2] < -maxPos) player.position[2] = -maxPos;
}

function getPlayerState() { return { x: player.position[0], y: player.position[1], z: player.position[2], yaw: 0, pitch: 0 }; }
function isPlayerActive() { return gameActive; }

window.player = player;
window.setPlayerSpawn = setPlayerSpawn;
window.resetPlayer = resetPlayer;
window.getPlayerPosition = getPlayerPosition;
window.setupPlayerInput = setupPlayerInput;
window.hasPlayerInput = hasPlayerInput;
window.updatePlayer = updatePlayer;
window.clampPlayerToRoom = clampPlayerToRoom;
window.getPlayerState = getPlayerState;
window.isPlayerActive = isPlayerActive;
