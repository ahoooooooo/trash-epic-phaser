import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { STAGES } from '../services/TDService';

const W = 1080;
const H = 1920;

// REBOOT v4 premium 主城:全屏插畫 + 美術 UI 資產 + 專用字體,禁 code 矩形/emoji 充當 UI
const FONT_TITLE = '"Noto Serif TC", serif';
const FONT_BODY = '"Noto Sans TC", sans-serif';

export class StageSelect extends Scene {
    constructor() { super('StageSelect'); }

    preload() {
        this.load.setPath('assets');
        const ui = ['home_bg', 'logo', 'panel', 'btn_gold', 'btn_steel', 'star', 'lock', 'pill'];
        for (const k of ui) {
            if (!this.textures.exists(`ui_${k}`)) this.load.image(`ui_${k}`, `ui/${k}.png`);
        }
    }

    create() {
        // webfont 載完才建場(避免 fallback 字型烙印在 Phaser text texture)
        const build = () => this.build();
        if (document.fonts && document.fonts.status !== 'loaded') {
            Promise.all([
                document.fonts.load(`900 64px ${FONT_TITLE}`),
                document.fonts.load(`700 36px ${FONT_BODY}`)
            ]).then(build).catch(build);
        } else {
            build();
        }
    }

    private build() {
        const save = SaveService.instance;
        // 新號 starter:送皮普
        let starterGranted = false;
        if (save.getCollectionCount() === 0) {
            save.addFamiliar('fam_pip');
            save.save();
            starterGranted = true;
        }

        // ── 背景:全屏插畫(cover) ──
        const bg = this.add.image(W / 2, H / 2, 'ui_home_bg');
        bg.setScale(Math.max(W / bg.width, H / bg.height));

        // ── 餘燼粒子(營火氛圍) ──
        for (let i = 0; i < 15; i++) {
            const ex = 200 + Math.random() * 680;
            const ey = 900 + Math.random() * 700;
            const ember = this.add.circle(ex, ey, 2 + Math.random() * 3, 0xffa040, 0.7).setDepth(3);
            this.tweens.add({
                targets: ember,
                y: ey - 300 - Math.random() * 300,
                x: ex + (Math.random() - 0.5) * 120,
                alpha: 0,
                duration: 4000 + Math.random() * 3000,
                delay: Math.random() * 4000,
                repeat: -1,
                onRepeat: () => { ember.y = ey; ember.x = ex; ember.alpha = 0.7; }
            });
        }

        // ── Logo(頂部滑入 + 微呼吸) ──
        const logo = this.add.image(W / 2, -160, 'ui_logo').setDepth(10);
        logo.setScale(700 / logo.width);
        this.tweens.add({ targets: logo, y: 200, duration: 700, ease: 'Back.out', delay: 100 });
        this.tweens.add({ targets: logo, scale: logo.scaleX * 1.015, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 900 });

        // ── 資源列(pill 資產) ──
        const data = save.get();
        const mkPill = (cx: number, label: string, value: string, valueColor: string) => {
            const pill = this.add.image(cx, 392, 'ui_pill').setDepth(10);
            pill.setScale(300 / pill.width);
            this.add.text(cx - 110, 392, label, {
                fontFamily: FONT_BODY, fontSize: 26, color: '#c8a060'
            }).setOrigin(0, 0.5).setDepth(11);
            this.add.text(cx + 120, 392, value, {
                fontFamily: FONT_BODY, fontSize: 30, color: valueColor, fontStyle: 'bold'
            }).setOrigin(1, 0.5).setDepth(11);
        };
        mkPill(W / 2 - 270, '金幣', `${data.gold}`, '#ffd060');
        mkPill(W / 2, '晶體', `${data.crystal}`, '#a0d8ff');
        mkPill(W / 2 + 270, '守軍', `${save.getCollectionCount()}/14`, '#ffe0c0');

        // ── 關卡卡(panel 資產,2 欄 × 3 列,stagger 進場) ──
        STAGES.forEach((st, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            const cx = 292 + col * 496;
            const cy = 660 + row * 350;
            const unlocked = i === 0 || save.getStageStars(STAGES[i - 1].id) > 0;
            const stars = save.getStageStars(st.id);

            const card = this.add.container(cx, cy + 36).setDepth(20).setAlpha(0);
            const panel = this.add.image(0, 0, 'ui_panel');
            panel.setScale(478 / panel.width);
            card.add(panel);

            const thumb = this.add.image(0, -46, st.bgKey);
            thumb.setDisplaySize(366, 142);
            if (!unlocked) thumb.setAlpha(0.28).setTint(0x667788);
            card.add(thumb);

            const name = this.add.text(0, 56, `${i + 1}. ${st.nameZH}`, {
                fontFamily: FONT_TITLE, fontSize: 33, color: unlocked ? '#f5dfb8' : '#7a6a55', fontStyle: 'bold',
                stroke: '#1a1208', strokeThickness: 4
            }).setOrigin(0.5);
            card.add(name);

            if (unlocked) {
                // 星數(star 資產 ×3,未獲灰)
                for (let s = 0; s < 3; s++) {
                    const starImg = this.add.image(-52 + s * 52, 110, 'ui_star');
                    starImg.setScale(44 / starImg.width);
                    if (s >= stars) starImg.setTint(0x3a352c).setAlpha(0.75);
                    card.add(starImg);
                }
                if (stars === 0) {
                    const hint = this.add.text(0, 152, `${st.waveCount} 波防守`, {
                        fontFamily: FONT_BODY, fontSize: 22, color: '#b89868'
                    }).setOrigin(0.5);
                    card.add(hint);
                }
                panel.setInteractive({ useHandCursor: true });
                panel.on('pointerdown', () => {
                    this.tweens.add({
                        targets: card, scale: 0.95, duration: 80, yoyo: true,
                        onComplete: () => this.scene.start('TowerDefense', { stageId: st.id })
                    });
                });
            } else {
                const lockImg = this.add.image(0, -40, 'ui_lock');
                lockImg.setScale(86 / lockImg.width);
                card.add(lockImg);
            }

            this.tweens.add({ targets: card, alpha: 1, y: cy, duration: 420, ease: 'Quad.out', delay: 250 + i * 90 });
        });

        // ── 底部按鈕(btn 資產 + 字疊上) ──
        const mkButton = (cx: number, cy: number, texKey: string, label: string, onTap: () => void) => {
            const c = this.add.container(cx, cy + 30).setDepth(30).setAlpha(0);
            const btn = this.add.image(0, 0, texKey);
            btn.setScale(430 / btn.width);
            const txt = this.add.text(0, -4, label, {
                fontFamily: FONT_TITLE, fontSize: 44, color: texKey === 'ui_btn_gold' ? '#3a2408' : '#dce8f0',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            c.add([btn, txt]);
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                this.tweens.add({ targets: c, scale: 0.93, duration: 70, yoyo: true, onComplete: onTap });
            });
            this.tweens.add({ targets: c, alpha: 1, y: cy, duration: 420, ease: 'Back.out', delay: 850 });
            return c;
        };
        mkButton(W / 2 - 232, H - 180, 'ui_btn_gold', '招募守軍', () => {
            this.scene.pause();
            this.scene.launch('Gacha', { from: 'StageSelect' });
        });
        mkButton(W / 2 + 232, H - 180, 'ui_btn_steel', '守軍營', () => this.scene.start('Barracks'));

        // starter toast
        if (starterGranted) {
            const toast = this.add.text(W / 2, 500, '獲得初始守軍:廢料童子 皮普', {
                fontFamily: FONT_TITLE, fontSize: 38, color: '#ffd060', fontStyle: 'bold',
                stroke: '#1a1208', strokeThickness: 6
            }).setOrigin(0.5).setDepth(2000);
            this.tweens.add({ targets: toast, alpha: 0, y: 450, duration: 2600, delay: 1400, onComplete: () => toast.destroy() });
        }

        // Gacha 關閉 resume 回來 → 重建刷新貨幣/收藏
        this.events.once('resume', () => this.scene.restart());
    }
}
