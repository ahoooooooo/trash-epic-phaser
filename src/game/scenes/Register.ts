import { Scene } from 'phaser';
import { AccountService } from '../services/AccountService';

const W = 1080;
const H = 1920;

const INPUT_CSS =
    'width:560px;height:84px;font-size:36px;padding:0 24px;border:3px solid #8b6020;' +
    'border-radius:10px;background:#241c16;color:#ffe0c0;box-sizing:border-box;outline:none;' +
    'font-family:sans-serif;';

// 註冊頁(手遊直式)— 帳號 / 密碼 / 確認密碼 + 註冊 / 返回登入
export class Register extends Scene {
    private userEl!: HTMLInputElement;
    private pwEl!: HTMLInputElement;
    private pw2El!: HTMLInputElement;
    private errText!: Phaser.GameObjects.Text;

    constructor() { super('Register'); }

    create() {
        const bg = this.add.image(W / 2, H / 2, 'map_wasteland_topdown');
        bg.setDisplaySize(W, H);
        bg.setAlpha(0.5);
        this.add.rectangle(W / 2, H / 2, W, H, 0x1a1612, 0.5);

        this.add.text(W / 2, 250, '破爛史詩', {
            fontFamily: 'sans-serif', fontSize: 110, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 10
        }).setOrigin(0.5);

        const panelY = 1080;
        this.add.rectangle(W / 2, panelY, W - 140, 900, 0x1a1612, 0.82)
            .setStrokeStyle(3, 0x8b6020, 0.9);
        this.add.text(W / 2, panelY - 390, '建立新帳號', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5);

        // 帳號
        this.add.text(W / 2 - 280, panelY - 290, '帳號', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#b08850'
        }).setOrigin(0, 0.5);
        const userDom = this.add.dom(W / 2, panelY - 230, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.userEl = userDom.node as HTMLInputElement;
        this.userEl.type = 'text';
        this.userEl.placeholder = '帳號 (3-16 字)';
        this.userEl.maxLength = 16;

        // 密碼
        this.add.text(W / 2 - 280, panelY - 140, '密碼', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#b08850'
        }).setOrigin(0, 0.5);
        const pwDom = this.add.dom(W / 2, panelY - 80, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.pwEl = pwDom.node as HTMLInputElement;
        this.pwEl.type = 'password';
        this.pwEl.placeholder = '密碼 (4-32 字)';
        this.pwEl.maxLength = 32;

        // 確認密碼
        this.add.text(W / 2 - 280, panelY + 10, '確認密碼', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#b08850'
        }).setOrigin(0, 0.5);
        const pw2Dom = this.add.dom(W / 2, panelY + 70, 'input', INPUT_CSS) as Phaser.GameObjects.DOMElement;
        this.pw2El = pw2Dom.node as HTMLInputElement;
        this.pw2El.type = 'password';
        this.pw2El.placeholder = '再輸入一次密碼';
        this.pw2El.maxLength = 32;

        this.errText = this.add.text(W / 2, panelY + 150, '', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ff6040', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.makeButton(W / 2, panelY + 260, 560, 110, 0xff8830, '註冊並進入', '#1a1612', () => this.doRegister());
        this.makeButton(W / 2, panelY + 520, 360, 80, 0x2a2520, '← 返回登入', '#b08850', () => {
            this.scene.start('Login');
        });
    }

    private doRegister() {
        if (this.pwEl.value !== this.pw2El.value) { this.errText.setText('兩次密碼不一致'); return; }
        const r = AccountService.register(this.userEl.value, this.pwEl.value);
        if (!r.ok) { this.errText.setText(r.error ?? '註冊失敗'); return; }
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
