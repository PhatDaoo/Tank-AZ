// Unified Input Manager for 4 Players (Keyboard + Phone Console WebRTC)

export const KEYBOARD_PRESETS = {
    1: {
        label: 'Arrows + M',
        up: ['ArrowUp'],
        down: ['ArrowDown'],
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
        shoot: ['KeyM', 'Slash']
    },
    2: {
        label: 'WASD + Q/Space',
        up: ['KeyW'],
        down: ['KeyS'],
        left: ['KeyA'],
        right: ['KeyD'],
        shoot: ['KeyQ', 'Space']
    },
    3: {
        label: 'IJKL + P/U',
        up: ['KeyI'],
        down: ['KeyK'],
        left: ['KeyJ'],
        right: ['KeyL'],
        shoot: ['KeyP', 'KeyU']
    },
    4: {
        label: 'Numpad 8546 + 0',
        up: ['Numpad8'],
        down: ['Numpad5'],
        left: ['Numpad4'],
        right: ['Numpad6'],
        shoot: ['Numpad0', 'Numpad1', 'NumpadEnter']
    }
};

class InputManager {
    constructor() {
        this.pressedCodes = new Set();

        // Phone console state per slot (1..4)
        this.phoneState = {};
        for (let i = 1; i <= 4; i++) {
            this.phoneState[i] = {
                connected: false,
                up: false,
                down: false,
                left: false,
                right: false,
                shoot: false,
                // Optional Direct Steer vector (dx, dy in [-1, 1]) for Phase 2 Phone Console
                steerMode: 'classic', // 'classic' | 'direct'
                vecX: 0,
                vecY: 0
            };
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (e) => {
                // Do not hijack typing when editing player names in setup screen
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
                    return;
                }
                this.pressedCodes.add(e.code);
            });

            window.addEventListener('keyup', (e) => {
                this.pressedCodes.delete(e.code);
            });

            window.addEventListener('blur', () => {
                this.pressedCodes.clear();
            });
        }
    }

    isAnyCodePressed(codes) {
        for (let i = 0; i < codes.length; i++) {
            if (this.pressedCodes.has(codes[i])) return true;
        }
        return false;
    }

    // Called by Phone Console WebRTC handler in Phase 2
    setPhoneAction(slot, action, isPressed) {
        const ps = this.phoneState[slot];
        if (!ps) return;
        if (action in ps) {
            ps[action] = Boolean(isPressed);
        }
    }

    setPhoneVector(slot, vx, vy) {
        const ps = this.phoneState[slot];
        if (!ps) return;
        ps.steerMode = 'direct';
        ps.vecX = vx;
        ps.vecY = vy;
    }

    resetPhoneSlot(slot) {
        const ps = this.phoneState[slot];
        if (!ps) return;
        ps.up = false;
        ps.down = false;
        ps.left = false;
        ps.right = false;
        ps.shoot = false;
        ps.vecX = 0;
        ps.vecY = 0;
    }

    resetRoundInputs() {
        for (let i = 1; i <= 4; i++) {
            const preset = KEYBOARD_PRESETS[i];
            if (preset && preset.shoot) {
                for (const code of preset.shoot) {
                    this.pressedCodes.delete(code);
                }
            }
            if (this.phoneState[i]) {
                this.phoneState[i].shoot = false;
            }
        }
    }

    getTankInput(slot) {
        const preset = KEYBOARD_PRESETS[slot];
        const ps = this.phoneState[slot];

        const kbUp = preset ? this.isAnyCodePressed(preset.up) : false;
        const kbDown = preset ? this.isAnyCodePressed(preset.down) : false;
        const kbLeft = preset ? this.isAnyCodePressed(preset.left) : false;
        const kbRight = preset ? this.isAnyCodePressed(preset.right) : false;
        const kbShoot = preset ? this.isAnyCodePressed(preset.shoot) : false;

        return {
            up: kbUp || (ps ? ps.up : false),
            down: kbDown || (ps ? ps.down : false),
            left: kbLeft || (ps ? ps.left : false),
            right: kbRight || (ps ? ps.right : false),
            shoot: kbShoot || (ps ? ps.shoot : false),
            steerMode: ps && ps.steerMode === 'direct' && (Math.hypot(ps.vecX, ps.vecY) > 0.15) ? 'direct' : 'classic',
            vecX: ps ? ps.vecX : 0,
            vecY: ps ? ps.vecY : 0
        };
    }
}

export const inputManager = new InputManager();
