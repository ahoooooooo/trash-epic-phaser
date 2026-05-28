import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor () { super('Boot'); }

    preload ()
    {
        // 沒有 boot asset 要載入,直接跳 Preloader
    }

    create ()
    {
        this.scene.start('Preloader');
    }
}
