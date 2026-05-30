import { Scene } from 'phaser';
import { AccountService } from '../services/AccountService';
import {
    INPUT_CSS, wireInputFocus, buildBackground, buildDecals, buildTitle, buildPanel,
    buildHeader, fieldLabel, buildButton
} from './authUi';

const W = 1080;
const H = 1920;

// 註冊頁(手遊直式)— 鏽蝕金屬卡 帳號 / 密碼 / 確認密碼 + 註冊 / 返回登入
export class Register extends Scene {
    private userEl!: HTMLInputElement;
    private pwEl!: HTMLInputElement;
    private pw2El!: HTMLInputElement;
    private errText!: Phaser.GameObjects.Text;

    constructor() { super('Register'); }

    create() {
        buildBackground(this, W, H);
        buildDecals(this, W);
        buildTitle(this, W, 270, 116);

        const panelY = 1170;
        const panelH = 880;
        buildPanel(this, W / 2, panelY, W - 130, panelH);
        buildHeader(this, W / 2, panelY - panelH / 2 + 12, '建立新帳號');

        const inX = W / 2;
        const labelX = W / 2 - 278;

        // 帳號
        fieldLabel(this, labelX, panelY - 244, '帳號');
        const userDom = this.add.dom(inX, panelY - 186, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.userEl = userDom.node as HTMLInputElement;
        this.userEl.type = 'text';
        this.userEl.placeholder = '帳號 (3-16 字)';
        this.userEl.maxLength = 16;
        wireInputFocus(this.userEl);

        // 密碼
        fieldLabel(this, labelX, panelY - 96, '密碼');
        const pwDom = this.add.dom(inX, panelY - 38, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.pwEl = pwDom.node as HTMLInputElement;
        this.pwEl.type = 'password';
        this.pwEl.placeholder = '密碼 (4-32 字)';
        this.pwEl.maxLength = 32;
        wireInputFocus(this.pwEl);

        // 確認密碼
        fieldLabel(this, labelX, panelY + 52, '確認密碼');
        const pw2Dom = this.add.dom(inX, panelY + 110, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.pw2El = pw2Dom.node as HTMLInputElement;
        this.pw2El.type = 'password';
        this.pw2El.placeholder = '再輸入一次密碼';
        this.pw2El.maxLength = 32;
        wireInputFocus(this.pw2El);

        this.errText = this.add.text(W / 2, panelY + 184, '', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ff7a4a', fontStyle: 'bold',
            stroke: '#1a0d05', strokeThickness: 4
        }).setOrigin(0.5);

        buildButton(this, W / 2, panelY + 288, 580, 114, '註冊並進入', 'primary', () => this.doRegister());
        buildButton(this, W / 2, panelY + 470, 380, 80, '← 返回登入', 'ghost', () => {
            this.scene.start('Login');
        });

        // Enter 鍵串接
        this.userEl.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') this.pwEl.focus(); });
        this.pwEl.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') this.pw2El.focus(); });
        this.pw2El.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') this.doRegister(); });

        this.add.text(W / 2, H - 36, 'v0.0.2 · PHASE 4c · TRASH EPIC', {
            fontFamily: 'monospace', fontSize: 20, color: '#6b5234'
        }).setOrigin(0.5).setAlpha(0.8);
    }

    private doRegister() {
        if (this.pwEl.value !== this.pw2El.value) { this.errText.setText('兩次密碼不一致'); return; }
        const r = AccountService.register(this.userEl.value, this.pwEl.value);
        if (!r.ok) { this.errText.setText(r.error ?? '註冊失敗'); return; }
        this.scene.start('MainMenu');
    }
}
