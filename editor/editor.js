// Level Editor for Dogpile
// 9x9 grid, 162 bytes (81 height + 81 entity)

class LevelEditor {
    constructor() {
        this.gridSize = 9;
        this.cellSize = 60;
        this.heights = new Array(81).fill(0);
        this.entities = new Array(81).fill(0);
        this.selectedCell = null;
        this.mode = 'height'; // 'height' or 'entity'

        this.canvas = document.getElementById('gridCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.initializeUI();
        this.draw();
    }

    initializeUI() {
        // Mode buttons
        document.getElementById('modeHeight').addEventListener('click', () => {
            this.mode = 'height';
            this.updateModeUI();
        });

        document.getElementById('modeEntity').addEventListener('click', () => {
            this.mode = 'entity';
            this.updateModeUI();
        });

        // Height controls
        const heightSlider = document.getElementById('heightSlider');
        const heightInput = document.getElementById('heightInput');

        heightSlider.addEventListener('input', (e) => {
            heightInput.value = e.target.value;
        });

        heightInput.addEventListener('input', (e) => {
            let val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
            heightInput.value = val;
            heightSlider.value = Math.min(15, val);
        });

        // Entity controls
        const entityType = document.getElementById('entityType');
        entityType.addEventListener('change', () => {
            const needsChannel = ['p', 'd', 'i'].includes(entityType.value);
            document.getElementById('channelControl').style.display = needsChannel ? 'block' : 'none';
        });

        // Canvas interactions
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));

        // Action buttons
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadBinary());
        document.getElementById('exportCmdBtn').addEventListener('click', () => this.exportCommand());
        document.getElementById('copyCmd').addEventListener('click', () => this.copyCommand());

        // File input
        document.getElementById('fileInput').addEventListener('change', (e) => this.loadFile(e));
    }

    updateModeUI() {
        // Update button states
        document.getElementById('modeHeight').classList.toggle('active', this.mode === 'height');
        document.getElementById('modeEntity').classList.toggle('active', this.mode === 'entity');

        // Show/hide controls
        document.getElementById('heightControls').style.display = this.mode === 'height' ? 'flex' : 'none';
        document.getElementById('entityControls').style.display = this.mode === 'entity' ? 'flex' : 'none';
    }

    getCellFromMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);

        if (col >= 0 && col < this.gridSize && row >= 0 && row < this.gridSize) {
            return row * this.gridSize + col;
        }
        return null;
    }

    handleClick(e) {
        const cell = this.getCellFromMouse(e);
        if (cell === null) return;

        if (this.mode === 'height') {
            const height = parseInt(document.getElementById('heightInput').value) || 0;
            this.heights[cell] = height;
        } else {
            const entityType = document.getElementById('entityType').value;
            if (entityType === '0') {
                this.entities[cell] = 0;
            } else {
                this.entities[cell] = this.encodeEntity(entityType);
            }
        }

        this.selectedCell = cell;
        this.draw();
        this.updateCellInfo();
        this.updateLevelSummary();
    }

    handleHover(e) {
        const cell = this.getCellFromMouse(e);
        if (cell !== null) {
            this.draw(cell);
        }
    }

    encodeEntity(typeStr) {
        if (typeStr === 's') return 1;
        if (typeStr === 'a') return 32;

        const channel = parseInt(document.getElementById('channelInput').value) || 0;

        if (typeStr === 'p') return 16 + channel;
        if (typeStr === 'd') return 128 + channel;
        if (typeStr === 'i') return 144 + channel;

        return 0;
    }

    decodeEntity(value) {
        if (value === 0) return { type: 'none', channel: 0 };
        if (value >= 1 && value <= 15) return { type: 'spawn', channel: 0 };
        if (value === 32) return { type: 'arrow', channel: 0 };
        if (value >= 16 && value <= 31) return { type: 'plate', channel: value - 16 };
        if (value >= 128 && value <= 143) return { type: 'door', channel: value - 128 };
        if (value >= 144 && value <= 159) return { type: 'piston', channel: value - 144 };
        return { type: 'unknown', channel: 0 };
    }

    draw(hoverCell = null) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < 81; i++) {
            const row = Math.floor(i / this.gridSize);
            const col = i % this.gridSize;
            const x = col * this.cellSize;
            const y = row * this.cellSize;

            // Draw height (as background intensity)
            const heightRatio = this.heights[i] / 15;
            const brightness = 255 - (heightRatio * 100);
            this.ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

            // Draw entity
            const entity = this.decodeEntity(this.entities[i]);
            if (entity.type !== 'none') {
                const colors = {
                    spawn: '#4ade80',
                    arrow: '#e43b3b',
                    plate: '#fbbf24',
                    door: '#f87171',
                    piston: '#60a5fa'
                };

                this.ctx.fillStyle = colors[entity.type] || '#888';
                this.ctx.fillRect(x + 5, y + 5, this.cellSize - 10, this.cellSize - 10);

                // Draw channel number
                if (entity.type !== 'spawn' && entity.type !== 'arrow') {
                    this.ctx.fillStyle = '#000';
                    this.ctx.font = 'bold 14px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(entity.channel.toString(16).toUpperCase(), x + this.cellSize / 2, y + this.cellSize / 2);
                }
            }

            // Draw height number (if no entity or transparent)
            if (this.heights[i] > 0) {
                this.ctx.fillStyle = entity.type === 'none' ? '#000' : 'rgba(0,0,0,0.3)';
                this.ctx.font = '10px sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'top';
                this.ctx.fillText(this.heights[i], x + 2, y + 2);
            }

            // Draw grid lines
            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);

            // Highlight selected cell
            if (i === this.selectedCell) {
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
            }

            // Highlight hover cell
            if (i === hoverCell && i !== this.selectedCell) {
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
            }

            // Draw cell index
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.font = '9px sans-serif';
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(i, x + this.cellSize - 2, y + this.cellSize - 2);
        }
    }

    updateCellInfo() {
        if (this.selectedCell === null) return;

        const entity = this.decodeEntity(this.entities[this.selectedCell]);
        const height = this.heights[this.selectedCell];

        const row = Math.floor(this.selectedCell / this.gridSize);
        const col = this.selectedCell % this.gridSize;

        let entityStr = 'None';
        if (entity.type === 'spawn') entityStr = 'Spawn Point';
        else if (entity.type === 'arrow') entityStr = 'Red Arrow';
        else if (entity.type === 'plate') entityStr = `Pressure Plate (Ch ${entity.channel})`;
        else if (entity.type === 'door') entityStr = `Door (Ch ${entity.channel})`;
        else if (entity.type === 'piston') entityStr = `Piston (Ch ${entity.channel})`;

        document.getElementById('cellInfo').innerHTML = `
            <p><strong>Index:</strong> ${this.selectedCell}</p>
            <p><strong>Position:</strong> (${col}, ${row})</p>
            <p><strong>Height:</strong> ${height}</p>
            <p><strong>Entity:</strong> ${entityStr}</p>
        `;
    }

    updateLevelSummary() {
        const entityCount = this.entities.filter(e => e > 0).length;
        const maxHeight = Math.max(...this.heights);

        document.getElementById('levelSummary').innerHTML = `
            <p><strong>Entities:</strong> ${entityCount}</p>
            <p><strong>Max Height:</strong> ${maxHeight}</p>
        `;
    }

    clearAll() {
        if (confirm('Clear all heights and entities?')) {
            this.heights.fill(0);
            this.entities.fill(0);
            this.selectedCell = null;
            this.draw();
            this.updateLevelSummary();
            document.getElementById('cellInfo').innerHTML = '<p>Click a cell to select</p>';
        }
    }

    downloadBinary() {
        const data = new Uint8Array(162);

        // Copy heights (first 81 bytes)
        for (let i = 0; i < 81; i++) {
            data[i] = this.heights[i];
        }

        // Copy entities (next 81 bytes)
        for (let i = 0; i < 81; i++) {
            data[81 + i] = this.entities[i];
        }

        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'level.bin';
        a.click();
        URL.revokeObjectURL(url);
    }

    exportCommand() {
        // Generate height hex string
        let heightHex = '';
        let allZero = true;
        for (let i = 0; i < 81; i++) {
            const h = this.heights[i];
            heightHex += h.toString(16).padStart(2, '0');
            if (h !== 0) allZero = false;
        }

        const heightArg = allZero ? 'z' : heightHex;

        // Generate entity string
        let entityParts = [];
        for (let i = 0; i < 81; i++) {
            const e = this.entities[i];
            if (e === 0) continue;

            const entity = this.decodeEntity(e);
            const idx = i.toString().padStart(2, '0');

            if (entity.type === 'spawn') {
                entityParts.push(`${idx}s`);
            } else if (entity.type === 'arrow') {
                entityParts.push(`${idx}a`);
            } else if (entity.type === 'plate') {
                entityParts.push(`${idx}p${entity.channel.toString(16)}`);
            } else if (entity.type === 'door') {
                entityParts.push(`${idx}d${entity.channel.toString(16)}`);
            } else if (entity.type === 'piston') {
                entityParts.push(`${idx}i${entity.channel.toString(16)}`);
            }
        }

        const entityArg = entityParts.join(' ');
        const cmd = `python hex_to_bin.py ${heightArg} "${entityArg}" output_level`;

        document.getElementById('commandText').textContent = cmd;
        document.getElementById('commandOutput').style.display = 'block';
    }

    copyCommand() {
        const text = document.getElementById('commandText').textContent;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copyCmd');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
        });
    }

    loadFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = new Uint8Array(ev.target.result);

            if (data.length !== 162) {
                alert('Invalid file: must be exactly 162 bytes');
                return;
            }

            // Load heights
            for (let i = 0; i < 81; i++) {
                this.heights[i] = data[i];
            }

            // Load entities
            for (let i = 0; i < 81; i++) {
                this.entities[i] = data[81 + i];
            }

            this.selectedCell = null;
            this.draw();
            this.updateLevelSummary();
            document.getElementById('cellInfo').innerHTML = '<p>Level loaded!</p>';
        };

        reader.readAsArrayBuffer(file);
    }
}

// Initialize editor when page loads
window.addEventListener('DOMContentLoaded', () => {
    new LevelEditor();
});