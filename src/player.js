import { isPlayerOnGhost } from './ghost.js';
import { playBark } from './audio.js';

export const player = {
    position: [0, 0, 0], speed: 0.12, velocityY: 0, isJumping: false,
    jumpForce: 0.25, gravity: 0.015, yaw: 0, targetYaw: 0
};
const DIR_POS_Z = 0, DIR_POS_X = -Math.PI / 2, DIR_NEG_Z = Math.PI, DIR_NEG_X = Math.PI / 2;
const ROTATION_LERP_SPEED = 0.12;

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

function lerpAngle(from, to, t) {
    return from + normalizeAngle(to - from) * t;
}

const ROOM_HALF_SIZE = 8.7;
export const PLAYER_RADIUS = 0.7;
const keys = {};
let gameActive = true;

const joystick = { id: null, active: false, vector: { x: 0, y: 0 }, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 }, radius: 50 };
const jumpButton = { id: null, pressed: false };
let spawnPosition = null;

export function setPlayerSpawn(x, y, z) { spawnPosition = [x, y, z]; }

export function resetPlayer() {
    player.position[0] = spawnPosition[0];
    player.position[1] = spawnPosition[1];
    player.position[2] = spawnPosition[2];
}

export function getPlayerPosition() { return player.position; }
export function getPlayerYaw() { return player.yaw; }

export function setupPlayerInput(canvas, onFirstInput) {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (gameActive && onFirstInput) onFirstInput();
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    const timerBar = document.getElementById('t');
    const ghostCount = document.getElementById('gc');
    const joystickZone = document.getElementById('jz');
    const joystickKnob = document.getElementById('jk');
    const jumpBtn = document.getElementById('jp');

    timerBar.classList.remove('h');
    ghostCount.classList.remove('h');
    joystickZone.classList.remove('h');
    jumpBtn.classList.remove('h');

    function updateJoystickVisual() {
        let dx = joystick.current.x - joystick.origin.x;
        let dy = joystick.current.y - joystick.origin.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = joystick.radius;
        if (dist > maxDist) { const ratio = maxDist / dist; dx *= ratio; dy *= ratio; }
        joystick.vector.x = dx / maxDist;
        joystick.vector.y = dy / maxDist;
        joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    jumpBtn.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        e.preventDefault();
        jumpButton.pressed = true;
        jumpButton.id = e.changedTouches[0].identifier;
        jumpBtn.classList.add('pr');
    }, { passive: false });

    jumpBtn.addEventListener('touchend', (e) => {
        if (!gameActive) return;
        e.preventDefault();
        jumpButton.pressed = false;
        jumpButton.id = null;
        jumpBtn.classList.remove('pr');
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const x = t.clientX, y = t.clientY;
            const rect = joystickZone.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            if (Math.hypot(x - centerX, y - centerY) < 100 && !joystick.active) {
                joystick.id = t.identifier;
                joystick.active = true;
                joystick.origin.x = x;
                joystick.origin.y = y;
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

export function hasPlayerInput() {
    return keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
        keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] ||
        keys['Space'] || jumpButton.pressed ||
        Math.abs(joystick.vector.x) > 0.1 || Math.abs(joystick.vector.y) > 0.1;
}

export function updatePlayer() {
    if (!isPlayerActive()) return false;
    const speed = player.speed;
    let moveFwd = 0, moveRight = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveFwd += 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveFwd -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveRight -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveRight += 1;
    moveRight += joystick.vector.x;
    moveFwd -= joystick.vector.y;
    if (moveFwd !== 0 || moveRight !== 0) {
        const moveX = (moveRight + moveFwd) * 0.7071;
        const moveZ = (moveRight - moveFwd) * 0.7071;
        player.position[0] += moveX * speed;
        player.position[2] += moveZ * speed;
        if (moveX !== 0 || moveZ !== 0) {
            player.targetYaw = Math.atan2(-moveX, moveZ);
        }
    }
    player.yaw = lerpAngle(player.yaw, player.targetYaw, ROTATION_LERP_SPEED);
    if ((keys['Space'] || jumpButton.pressed) && (!player.isJumping || isPlayerOnGhost())) {
        player.velocityY = player.jumpForce;
        player.isJumping = true;
        playBark();
    }
    player.velocityY -= player.gravity;
    player.position[1] += player.velocityY;
    if (player.position[1] <= 0) {
        player.position[1] = 0;
        player.velocityY = 0;
        player.isJumping = false;
    }
    clampPlayerToRoom();
    return true;
}

export function clampPlayerToRoom() {
    const playerHalf = 0.7;
    const maxPos = ROOM_HALF_SIZE - playerHalf;
    if (player.position[0] > maxPos) player.position[0] = maxPos;
    else if (player.position[0] < -maxPos) player.position[0] = -maxPos;
    if (player.position[2] > maxPos) player.position[2] = maxPos;
    else if (player.position[2] < -maxPos) player.position[2] = -maxPos;
}

export function getPlayerState() {
    return { x: player.position[0], y: player.position[1], z: player.position[2], yaw: player.yaw, pitch: 0 };
}

export function isPlayerActive() { return gameActive; }
