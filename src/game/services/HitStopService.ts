// HitStop / Time Slow service for MapleStory-style hit feel.
// per reference-hitstop-pattern-phaser memory(Codex review lesson 2026-05-28):
//   - 不寫死 timeScale=1,要存 _previousScale 還原
//   - Phaser 4 sub-system timescale 全 sync(time/physics/tweens/anims)
//   - pause/cutscene 走獨立 controller 不走 HitStop
import { Scene } from 'phaser';

export class HitStopService {
    private static _instance: HitStopService | null = null;
    private _scene: Scene | null = null;
    private _activeUntilMs = -1;
    private _previousScale = 1;
    private _active = false;
    private _resetEvent: Phaser.Time.TimerEvent | null = null;

    static get instance(): HitStopService {
        if (!this._instance) this._instance = new HitStopService();
        return this._instance;
    }

    attach(scene: Scene): void {
        this._scene = scene;
    }

    trigger(durationMs = 60, scale = 0.05): void {
        const scene = this._scene;
        if (!scene) return;
        const now = performance.now();
        if (now < this._activeUntilMs) return; // throttle

        this._activeUntilMs = now + durationMs;
        if (!this._active) {
            this._previousScale = scene.time.timeScale;
            this._active = true;
        }
        scene.time.timeScale = scale;
        scene.tweens.timeScale = scale;
        scene.anims.globalTimeScale = scale;

        if (this._resetEvent) this._resetEvent.destroy();
        // Phaser timer 已被 clock timeScale 影響,用 event-level timeScale 反向抵消 一次
        // per Codex review 2026-05-28(durationMs/scale 會雙重縮放跑 24s 才回)
        this._resetEvent = scene.time.addEvent({
            delay: durationMs,
            callback: this._reset,
            callbackScope: this,
            timeScale: 1 / scale
        });
    }

    private _reset(): void {
        const scene = this._scene;
        if (!scene) return;
        scene.time.timeScale = this._previousScale;
        scene.tweens.timeScale = this._previousScale;
        scene.anims.globalTimeScale = this._previousScale;
        this._active = false;
        this._resetEvent = null;
    }
}
