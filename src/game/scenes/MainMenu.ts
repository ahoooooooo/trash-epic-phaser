import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';

const W = 1080;
const H = 1920;

// Phase 4b-14 登入頁 — 廢土 painted 背景 + 角色卡 + 進入 / 新角色
export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        // per user 2026-05-29 bug 報告:死後重進不了 — starting flag 是 instance field,
        // scene 第二次進來時還是 true 卡住。每次 create() reset。
        this.starting = false;
        // 1. painted 廢土背景(沿用 wasteland map 當 ambience)
        const bg = this.add.image(W / 2, H / 2, 'map_wasteland_topdown');
        bg.setDisplaySize(W, H);
        bg.setAlpha(0.55);
        // 暗 overlay 確保 UI 易讀
        this.add.rectangle(W / 2, H / 2, W, H, 0x1a1612, 0.45);

        // 2. Title block — 廢土風大字 + 副標
        this.add.text(W / 2, 220, '破爛史詩', {
            fontFamily: 'sans-serif', fontSize: 120, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 10,
            align: 'center'
        }).setOrigin(0.5);
        this.add.text(W / 2, 320, 'Trash Epic', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#a05a30',
            align: 'center'
        }).setOrigin(0.5);
        this.add.text(W / 2, 370, '— 廢土生存 ARPG —', {
            fontFamily: 'monospace', fontSize: 22, color: '#6a5a4a'
        }).setOrigin(0.5);

        // 3. 主角立繪
        const sprite = this.add.image(W / 2, 700, 'player_idle').setScale(0.55);
        // 輕微 hover idle 動畫(只在 menu,Game scene 用真 frame anim)
        this.tweens.add({
            targets: sprite, y: sprite.y - 10, duration: 1500,
            yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });

        // 4. 角色卡 panel — Lv / playtime / kills / 上次登入
        const save = SaveService.instance.get();
        const playtimeHr = Math.floor(save.playtimeSec / 3600);
        const playtimeMin = Math.floor((save.playtimeSec % 3600) / 60);
        const lastLoginStr = save.lastSavedAt > 0
            ? new Date(save.lastSavedAt).toLocaleString('zh-TW', { hour12: false }).slice(5, 16)
            : '— 新角色 —';
        const hasSave = save.lastSavedAt > 0;

        const panelY = 1080;
        const panelH = 380;
        this.add.rectangle(W / 2, panelY + panelH / 2, W - 120, panelH, 0x2a2520, 0.88)
            .setStrokeStyle(3, 0x8b6020, 0.9);

        this.add.text(W / 2, panelY + 40, hasSave ? '◤ 拾荒少年 ◢' : '◤ 新拾荒少年 ◢', {
            fontFamily: 'sans-serif', fontSize: 36, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 數據行
        const rowX1 = 120, rowX2 = W - 120;
        const rowY = panelY + 110;
        const rowGap = 56;
        const labelStyle = { fontFamily: 'monospace', fontSize: 24, color: '#a05a30' } as const;
        const valueStyle = { fontFamily: 'monospace', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold' } as const;

        this.add.text(rowX1, rowY + 0 * rowGap, '等級', labelStyle).setOrigin(0, 0.5);
        this.add.text(rowX2, rowY + 0 * rowGap, `Lv ${save.level}`, valueStyle).setOrigin(1, 0.5);

        this.add.text(rowX1, rowY + 1 * rowGap, '遊玩時間', labelStyle).setOrigin(0, 0.5);
        this.add.text(rowX2, rowY + 1 * rowGap, `${playtimeHr}h ${playtimeMin}m`, valueStyle).setOrigin(1, 0.5);

        this.add.text(rowX1, rowY + 2 * rowGap, '累積擊殺', labelStyle).setOrigin(0, 0.5);
        this.add.text(rowX2, rowY + 2 * rowGap, `${save.totalKills}`, valueStyle).setOrigin(1, 0.5);

        this.add.text(rowX1, rowY + 3 * rowGap, '上次登入', labelStyle).setOrigin(0, 0.5);
        this.add.text(rowX2, rowY + 3 * rowGap, lastLoginStr, valueStyle).setOrigin(1, 0.5);

        this.add.text(rowX1, rowY + 4 * rowGap, '現在地圖', labelStyle).setOrigin(0, 0.5);
        const mapLabel = save.currentMapId === 'guild_hall' ? '公會本部' : '廢土外圍';
        this.add.text(rowX2, rowY + 4 * rowGap, mapLabel, valueStyle).setOrigin(1, 0.5);

        // 5. 兩個 button — 進入 / 新角色(若無存檔只顯示「開始」)
        // Phase 4b-16 fix:用 rectangle 當 hit area(Phaser 4 Text + padding 的 hit area
        // 有時不包含 padding 導致 click 沒接到)
        const btnY = 1610;
        const enterLabel = hasSave ? '▶ 繼續廢土' : '▶ 開始刷怪';
        const enterBg = this.add.rectangle(W / 2, btnY, 600, 130, 0xff8830)
            .setStrokeStyle(4, 0x1a1612)
            .setInteractive({ useHandCursor: true });
        enterBg.on('pointerdown', () => {
            console.log('[MainMenu] 繼續廢土 clicked, starting Game...');
            this.startGame();
        });
        this.add.text(W / 2, btnY, enterLabel, {
            fontFamily: 'sans-serif', fontSize: 64, color: '#1a1612', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5);

        if (hasSave) {
            const newBg = this.add.rectangle(W / 2, btnY + 130, 500, 70, 0x2a2520)
                .setStrokeStyle(2, 0x4a3018)
                .setInteractive({ useHandCursor: true });
            newBg.on('pointerdown', () => this.confirmReset());
            this.add.text(W / 2, btnY + 130, '✕ 砍掉重練(新角色)', {
                fontFamily: 'sans-serif', fontSize: 28, color: '#a05a30',
                stroke: '#1a1612', strokeThickness: 2
            }).setOrigin(0.5);
        }

        // 6. 版本標示
        this.add.text(W / 2, H - 30, 'v0.0.2 Phase 4b — Trash Epic', {
            fontFamily: 'monospace', fontSize: 18, color: '#4a5d3a'
        }).setOrigin(0.5);
    }

    private starting = false;
    private startGame() {
        console.log('[MainMenu] startGame() — starting flag:', this.starting);
        if (this.starting) return;
        this.starting = true;
        console.log('[MainMenu] calling scene.start(Game)');
        this.scene.start('Game');
    }

    private confirmReset() {
        // confirm modal — 廢土風暗 panel
        const modal = this.add.container(W / 2, H / 2).setDepth(3000);
        const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.7)
            .setInteractive(); // 攔截背景 click 不漏進底下 enter button
        const box = this.add.rectangle(0, 0, W - 200, 500, 0x2a2520, 0.98)
            .setStrokeStyle(3, 0xc23a1a, 0.9);
        const msg = this.add.text(0, -120, '砍掉重練?', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#c23a1a', fontStyle: 'bold'
        }).setOrigin(0.5);
        const sub = this.add.text(0, -40, '所有進度將清除\n等級 / 武器 / 素材 / 金幣 / quest 全砍', {
            fontFamily: 'sans-serif', fontSize: 26, color: '#ffe0c0', align: 'center'
        }).setOrigin(0.5);
        const yes = this.add.text(-180, 130, '確定砍掉', {
            fontFamily: 'sans-serif', fontSize: 36, color: '#ffe0c0', fontStyle: 'bold',
            backgroundColor: '#c23a1a', padding: { x: 32, y: 14 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const no = this.add.text(180, 130, '取消', {
            fontFamily: 'sans-serif', fontSize: 36, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#b08850', padding: { x: 32, y: 14 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        modal.add([dim, box, msg, sub, yes, no]);
        yes.on('pointerdown', () => {
            SaveService.instance.reset();
            modal.destroy();
            this.scene.restart();
        });
        no.on('pointerdown', () => modal.destroy());
    }
}
