import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Inventory } from './scenes/Inventory';
import { Gacha } from './scenes/Gacha';
import { Storage } from './scenes/Storage';
import { Shop } from './scenes/Shop';
import { Talent } from './scenes/Talent';
import { WorldMap } from './scenes/WorldMap';
import { Coachmark } from './scenes/Coachmark';
import { DailyReward } from './scenes/DailyReward';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/Preloader';

// Trash Epic — 廢土風 mobile 直式 ARPG
// per GAME_SPEC_V3 §二:1080×1920 portrait
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1612', // 廢土炭黑(per docs/design/v2/README.md global palette)
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: 1080,
        height: 1920
    },
    pixelArt: false, // user 拍板:不要像素風,走 BiRefNet 廢土手繪
    // 4G 弱網單檔卡住會讓 loader 永遠卡在載入頁 → 每檔 30s timeout,逾時當錯誤繼續(不無限等)
    loader: { timeout: 30000 },
    // per Codex review 2026-05-28:手機左手 joystick + 右手 dash 同時觸控,需 2+ pointer
    input: { activePointers: 3 },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        MainGame,
        Inventory,
        Gacha,
        Storage,
        Shop,
        Talent,
        WorldMap,
        Coachmark,
        DailyReward,
        GameOver
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
