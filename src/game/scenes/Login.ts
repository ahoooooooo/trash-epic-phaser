import { Scene } from 'phaser';
import { AccountService } from '../services/AccountService';

const W = 1080;
const H = 1920;

const INPUT_CSS =
    'width:560px;height:84px;font-size:36px;padding:0 24px;border:3px solid #8b6020;' +
    'border-radius:10px;background:#241c16;color:#ffe0c0;box-sizing:border-box;outline:none;' +
    'font-family:sans-serif;';

// 登入頁(手遊直式)— 廢土背景 + 帳號/密碼 DOM input + 登入 / 註冊 / 訪客
export class Login extends Scene {
    private userEl!: HTMLInputElement;
    private pwEl!: HTMLInputElement;
    private errText!: Phaser.GameObjects.Text;

    constructor() { super('Login'); }

    create() {
        // 1. 廢土背景
        const bg = this.add.image(W / 2, H / 2, 'map_wasteland_topdown');
        bg.setDisplaySize(W, H);
        bg.setAlpha(0.5);
        this.add.rectangle(W / 2, H / 2, W, H, 0x1a1612, 0.5);

        // 2. Title
        this.add.text(W / 2, 250, '破爛史詩', {
            fontFamily: 'sans-serif', fontSize: 120, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 10
        }).setOrigin(0.5);
        this.add.text(W / 2, 360, 'Trash Epic', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#a05a30'
        }).setOrigin(0.5);

        // 3. 帳密 panel
        const panelY = 1050;
        this.add.rectangle(W / 2, panelY, W - 140, 760, 0x1a1612, 0.82)
            .setStrokeStyle(3, 0x8b6020, 0.9);
        this.add.text(W / 2, panelY - 320, '玩家登入', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5);

        // 帳號 input
        this.add.text(W / 2 - 280, panelY - 210, '帳號', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#b08850'
        }).setOrigin(0, 0.5);
        const userDom = this.add.dom(W / 2, panelY - 150, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.userEl = userDom.node as HTMLInputElement;
        this.userEl.type = 'text';
        this.userEl.placeholder = '帳號 (3-16 字)';
        this.userEl.maxLength = 16;
        this.userEl.autocomplete = 'username';

        // 密碼 input
        this.add.text(W / 2 - 280, panelY - 60, '密碼', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#b08850'
        }).setOrigin(0, 0.5);
        const pwDom = this.add.dom(W / 2, panelY, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.pwEl = pwDom.node as HTMLInputElement;
        this.pwEl.type = 'password';
        this.pwEl.placeholder = '密碼 (4+ 字)';
        this.pwEl.maxLength = 32;
        this.pwEl.autocomplete = 'current-password';

        // 錯誤訊息
        this.errText = this.add.text(W / 2, panelY + 80, '', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#ff6040', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 4. 登入按鈕
        this.makeButton(W / 2, panelY + 200, 560, 110, 0xff8830, '登入', '#1a1612', () => this.doLogin());

        // 5. 註冊 + 訪客(panel 外)
        this.makeButton(W / 2, panelY + 480, 460, 90, 0x4a5d3a, '註冊新帳號', '#ffe0c0', () => {
            this.scene.start('Register');
        });
        this.makeButton(W / 2, panelY + 600, 360, 80, 0x2a2520, '訪客試玩', '#b08850', () => {
            const r = AccountService.loginGuest();
            if (!r.ok) { this.errText.setText(r.error ?? '登入失敗'); return; }
            this.scene.start('MainMenu');
        });

        // Enter 鍵登入
        this.pwEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.doLogin();
        });

        // 版本
        this.add.text(W / 2, H - 30, 'v0.0.2 Phase 4c — Trash Epic', {
            fontFamily: 'monospace', fontSize: 18, color: '#4a5d3a'
        }).setOrigin(0.5);
    }

    private doLogin() {
        const r = AccountService.login(this.userEl.value, this.pwEl.value);
        if (!r.ok) { this.errText.setText(r.error ?? '登入失敗'); return; }
        this.scene.start('MainMenu');
    }

    private makeButton(x: number, y: number, w: number, h: number, color: number, label: string, textColor: string, onClick: () => void) {
        const bg = this.add.rectangle(x, y, w, h, color).setStrokeStyle(4, 0x1a1612)
            .setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => { bg.setScale(0.96); });
        bg.on('pointerup', () => { bg.setScale(1); onClick(); });
        bg.on('pointerout', () => { bg.setScale(1); });
        this.add.text(x, y, label, {
            fontFamily: 'sans-serif', fontSize: Math.round(h * 0.42), color: textColor, fontStyle: 'bold'
        }).setOrigin(0.5);
    }
}
