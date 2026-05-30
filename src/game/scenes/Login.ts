import { Scene } from 'phaser';
import { AccountService } from '../services/AccountService';
import {
    INPUT_CSS, wireInputFocus, buildBackground, buildDecals, buildTitle, buildPanel,
    buildHeader, fieldLabel, buildButton, PAL
} from './authUi';

const W = 1080;
const H = 1920;

// 登入頁(手遊直式)— 廢土背景 + 主角立繪 + 鏽蝕金屬帳密卡 + 主 CTA
export class Login extends Scene {
    private userEl!: HTMLInputElement;
    private pwEl!: HTMLInputElement;
    private errText!: Phaser.GameObjects.Text;

    constructor() { super('Login'); }

    create() {
        // 1. 背景(painted 廢土 + vignette + 暖光 + 廢土裝飾)
        buildBackground(this, W, H);
        buildDecals(this, W);

        // 2. 標題(厚重 + 微呼吸)
        buildTitle(this, W, 286, 132);

        // 3. 主角立繪當視覺主體(地面陰影 + 立繪 + 油燈光暈)
        this.buildHero(W / 2, 660);

        // 4. 帳密卡(鏽蝕金屬面板)
        const panelY = 1230;
        const panelH = 660;
        buildPanel(this, W / 2, panelY, W - 130, panelH);
        buildHeader(this, W / 2, panelY - panelH / 2 + 12, '玩家登入');

        const inX = W / 2;
        const labelX = W / 2 - 278;

        // 帳號
        fieldLabel(this, labelX, panelY - 168, '帳號');
        const userDom = this.add.dom(inX, panelY - 110, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.userEl = userDom.node as HTMLInputElement;
        this.userEl.type = 'text';
        this.userEl.placeholder = '帳號 (3-16 字)';
        this.userEl.maxLength = 16;
        this.userEl.autocomplete = 'username';
        wireInputFocus(this.userEl);

        // 密碼
        fieldLabel(this, labelX, panelY - 14, '密碼');
        const pwDom = this.add.dom(inX, panelY + 44, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.pwEl = pwDom.node as HTMLInputElement;
        this.pwEl.type = 'password';
        this.pwEl.placeholder = '密碼 (4+ 字)';
        this.pwEl.maxLength = 32;
        this.pwEl.autocomplete = 'current-password';
        wireInputFocus(this.pwEl);

        // 錯誤訊息
        this.errText = this.add.text(W / 2, panelY + 120, '', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#ff7a4a', fontStyle: 'bold',
            stroke: '#1a0d05', strokeThickness: 4
        }).setOrigin(0.5);

        // 登入 CTA
        buildButton(this, W / 2, panelY + 218, 580, 114, '登 入', 'primary', () => this.doLogin());

        // 5. 註冊 + 訪客
        buildButton(this, W / 2, panelY + 420, 480, 92, '註冊新帳號', 'secondary', () => {
            this.scene.start('Register');
        });
        buildButton(this, W / 2, panelY + 530, 380, 80, '訪客試玩', 'ghost', () => {
            const r = AccountService.loginGuest();
            if (!r.ok) { this.errText.setText(r.error ?? '登入失敗'); return; }
            this.scene.start('MainMenu');
        });

        // Enter 鍵登入
        this.pwEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.doLogin();
        });
        this.userEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.pwEl.focus();
        });

        // 版本浮水印
        this.add.text(W / 2, H - 36, 'v0.0.2 · PHASE 4c · TRASH EPIC', {
            fontFamily: 'monospace', fontSize: 20, color: '#6b5234'
        }).setOrigin(0.5).setAlpha(0.8);
    }

    // 主角立繪 + 腳下陰影 + 背後油燈光暈
    private buildHero(x: number, y: number): void {
        // 背後暖光暈(多環淡出,模擬柔和 radial)
        const glow = this.add.graphics();
        const rings: [number, number][] = [
            [120, 0.16], [170, 0.11], [220, 0.075], [280, 0.045], [350, 0.025]
        ];
        for (const [r, a] of rings) {
            glow.fillStyle(PAL.warmOrange, a);
            glow.fillCircle(x, y - 20, r);
        }

        // 腳下橢圓陰影
        const sh = this.add.graphics();
        sh.fillStyle(0x000000, 0.4);
        sh.fillEllipse(x, y + 168, 280, 56);

        const hero = this.add.image(x, y, 'player_idle');
        // 等比縮放至高約 360px
        const target = 360;
        const s = target / hero.height;
        hero.setScale(s);
        hero.setOrigin(0.5, 0.5);

        // 立繪呼吸
        this.tweens.add({
            targets: hero,
            y: y - 10,
            duration: 2400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private doLogin() {
        const r = AccountService.login(this.userEl.value, this.pwEl.value);
        if (!r.ok) { this.errText.setText(r.error ?? '登入失敗'); return; }
        this.scene.start('MainMenu');
    }
}
