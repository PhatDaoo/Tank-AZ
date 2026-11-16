// Host WebRTC (PeerJS) Manager & QR Code Lobby for AZ Tank 4P

import { inputManager, KEYBOARD_PRESETS } from './input.js';
import { TANK_COLORS } from './tank.js';

export class HostNetworkManager {
    constructor(callbacks = {}) {
        this.onSlotsChanged = callbacks.onSlotsChanged || (() => {});
        this.getSlotConfigs = callbacks.getSlotConfigs || (() => []);

        this.peer = null;
        this.hostId = null;
        this.connections = [];
        this.playerMap = {}; // peerId -> slotNum (1..4)
    }

    init() {
        const connectInfoEl = document.getElementById('lobby-note');
        if (typeof window.Peer === 'undefined') {
            if (connectInfoEl) {
                connectInfoEl.innerText = '⚠ PeerJS not loaded (offline mode)';
            }
            return;
        }

        try {
            this.peer = new window.Peer();
        } catch (err) {
            if (connectInfoEl) {
                connectInfoEl.innerText = '⚠ WebRTC init failed';
            }
            return;
        }

        this.peer.on('open', (id) => {
            this.hostId = id;
            const basePath = window.location.pathname.replace(/index\.html$/, '');
            const baseOrigin = window.location.origin + (basePath.endsWith('/') ? basePath : basePath + '/');
            const controllerUrl = `${baseOrigin}controller.html?host=${encodeURIComponent(id)}`;

            if (connectInfoEl) {
                connectInfoEl.innerHTML = `✅ Scan QR or <a href="${controllerUrl}" target="_blank" style="color:#4fc3f7;text-decoration:underline;">open controller tab</a>`;
            }

            const qrContainer = document.getElementById('qr-container');
            const qrCodeEl = document.getElementById('qrcode');
            if (qrContainer && qrCodeEl && typeof window.QRCode !== 'undefined') {
                qrContainer.style.display = 'flex';
                qrCodeEl.innerHTML = '';
                new window.QRCode(qrCodeEl, {
                    text: controllerUrl,
                    width: 92,
                    height: 92,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.L
                });
            }

            this.updateLobbyUI();
        });

        this.peer.on('connection', (conn) => {
            this.handleNewConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.warn('PeerJS Host error:', err);
            if (connectInfoEl) {
                connectInfoEl.innerText = `⚠ P2P Error: ${err.type || 'connection'}`;
            }
        });
    }

    getTakenSlots() {
        return Object.values(this.playerMap);
    }

    getSlotMetaList() {
        const configs = this.getSlotConfigs();
        return configs.map((c) => ({
            slot: c.slot,
            name: c.name,
            color: TANK_COLORS[c.colorIndex]?.fill || '#4caf50'
        }));
    }

    broadcast(data) {
        for (const conn of this.connections) {
            if (conn && conn.open) {
                conn.send(data);
            }
        }
    }

    broadcastPlayersUpdate() {
        this.broadcast({
            type: 'playersUpdate',
            taken: this.getTakenSlots(),
            meta: this.getSlotMetaList()
        });
    }

    sendHapticToSlot(slotNum, pattern = [40, 30, 80]) {
        for (const conn of this.connections) {
            if (conn && conn.open && this.playerMap[conn.peer] === slotNum) {
                conn.send({ type: 'haptic', pattern });
            }
        }
    }

    sendWeaponToSlot(slotNum, weapon) {
        for (const conn of this.connections) {
            if (conn && conn.open && this.playerMap[conn.peer] === slotNum) {
                conn.send({
                    type: 'weaponUpdate',
                    weapon: weapon
                        ? { name: weapon.name, short: weapon.short, color: weapon.color, ammo: weapon.ammo }
                        : null
                });
            }
        }
    }

    handleNewConnection(conn) {
        this.connections.push(conn);

        conn.on('open', () => {
            conn.send({
                type: 'playersUpdate',
                taken: this.getTakenSlots(),
                meta: this.getSlotMetaList()
            });
        });

        conn.on('data', (data) => {
            if (!data || typeof data !== 'object') return;

            if (data.type === 'requestPlayer') {
                const slotNum = Number(data.num);
                if (slotNum < 1 || slotNum > 4) return;

                const taken = this.getTakenSlots();
                const currentSlotOfThisPeer = this.playerMap[conn.peer];

                if (taken.includes(slotNum) && currentSlotOfThisPeer !== slotNum) {
                    conn.send({
                        type: 'requestPlayerResponse',
                        success: false,
                        message: `Slot ${slotNum} is already taken!`
                    });
                    return;
                }

                // Release old slot if this phone is switching slots
                if (currentSlotOfThisPeer && currentSlotOfThisPeer !== slotNum) {
                    inputManager.resetPhoneSlot(currentSlotOfThisPeer);
                    inputManager.phoneState[currentSlotOfThisPeer].connected = false;
                }

                this.playerMap[conn.peer] = slotNum;
                inputManager.phoneState[slotNum].connected = true;
                inputManager.resetPhoneSlot(slotNum);

                // Auto-enable slot as HUMAN PLAYER in Setup if it was Empty or AI
                const configs = this.getSlotConfigs();
                const slotCfg = configs.find((s) => s.slot === slotNum);
                if (slotCfg && slotCfg.type !== 'human') {
                    slotCfg.type = 'human';
                    if (slotCfg.name.startsWith('Bot ')) {
                        slotCfg.name = `Player ${slotNum}`;
                    }
                }

                const colorFill = slotCfg ? TANK_COLORS[slotCfg.colorIndex].fill : '#4caf50';
                conn.send({
                    type: 'requestPlayerResponse',
                    success: true,
                    num: slotNum,
                    name: slotCfg ? slotCfg.name : `Player ${slotNum}`,
                    color: colorFill
                });

                this.broadcastPlayersUpdate();
                this.updateLobbyUI();
                this.onSlotsChanged();
            } else if (data.type === 'leaveSlot') {
                this.releaseConnectionSlot(conn.peer);
            } else if (data.type === 'action') {
                const slotNum = this.playerMap[conn.peer];
                if (slotNum && data.player === slotNum) {
                    inputManager.phoneState[slotNum].steerMode = 'classic';
                    inputManager.setPhoneAction(slotNum, data.action, data.state === 'pressed');
                }
            } else if (data.type === 'joystickVector') {
                const slotNum = this.playerMap[conn.peer];
                if (slotNum && data.player === slotNum) {
                    if (data.mode === 'direct') {
                        inputManager.setPhoneVector(slotNum, Number(data.vx) || 0, Number(data.vy) || 0);
                    } else {
                        inputManager.phoneState[slotNum].steerMode = 'classic';
                        inputManager.phoneState[slotNum].vecX = 0;
                        inputManager.phoneState[slotNum].vecY = 0;
                    }
                }
            }
        });

        const handleDisconnect = () => {
            this.releaseConnectionSlot(conn.peer);
            this.connections = this.connections.filter((c) => c.peer !== conn.peer);
        };

        conn.on('close', handleDisconnect);
        conn.on('error', handleDisconnect);
    }

    releaseConnectionSlot(peerId) {
        const slotNum = this.playerMap[peerId];
        if (slotNum) {
            delete this.playerMap[peerId];
            // Immediately release all held inputs so the tank never gets stuck moving/firing!
            inputManager.resetPhoneSlot(slotNum);
            inputManager.phoneState[slotNum].connected = false;

            this.broadcastPlayersUpdate();
            this.updateLobbyUI();
            this.onSlotsChanged();
        }
    }

    updateLobbyUI() {
        if (typeof document === 'undefined') return;
        const takenSlots = this.getTakenSlots();
        const miniList = [];

        for (let i = 1; i <= 4; i++) {
            const rowEl = document.getElementById(`lobby-slot-${i}`);
            if (!rowEl) continue;
            const kbLabel = KEYBOARD_PRESETS[i].label;
            if (takenSlots.includes(i)) {
                rowEl.classList.add('connected');
                rowEl.innerHTML = `<div class="lobby-dot"></div> Player ${i} — PHONE CONNECTED 📱`;
                miniList.push(`P${i}`);
            } else {
                rowEl.classList.remove('connected');
                rowEl.innerHTML = `<div class="lobby-dot"></div> Player ${i} (${kbLabel})`;
            }
        }

        const miniStatusEl = document.getElementById('mini-lobby-status');
        if (miniStatusEl) {
            if (miniList.length > 0) {
                miniStatusEl.innerHTML = `🎮 Phone Active: <span style="color:#76d63e">${miniList.join(', ')}</span>`;
            } else {
                miniStatusEl.innerHTML = `⏳ No phone controller`;
            }
        }
    }
}
