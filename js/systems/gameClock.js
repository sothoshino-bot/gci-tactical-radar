export class GameClock {
    constructor(onTick, onTimeChange) {
        this.onTick = onTick;
        this.onTimeChange = onTimeChange;
        this.elapsedSeconds = 0;
        this.timeScale = 1;
        this.paused = false;
        this.lastFrame = null;
        this.frameId = null;
    }

    start() {
        if (this.frameId !== null) return;
        this.lastFrame = null;
        this.frameId = requestAnimationFrame(timestamp => this.tick(timestamp));
    }

    tick(timestamp) {
        if (this.lastFrame !== null && !this.paused) {
            const realDelta = Math.min((timestamp - this.lastFrame) / 1000, 0.25);
            const gameDelta = realDelta * this.timeScale;
            this.elapsedSeconds += gameDelta;
            this.onTick?.(gameDelta, this.elapsedSeconds);
        }

        this.lastFrame = timestamp;
        this.onTimeChange?.(this.elapsedSeconds, this.timeScale, this.paused);
        this.frameId = requestAnimationFrame(nextTimestamp => this.tick(nextTimestamp));
    }

    setTimeScale(value) {
        if (![1, 2, 4].includes(value)) {
            throw new RangeError(`Unsupported game time scale: ${value}`);
        }
        this.timeScale = value;
        this.onTimeChange?.(this.elapsedSeconds, this.timeScale, this.paused);
    }

    setPaused(paused) {
        this.paused = Boolean(paused);
        this.onTimeChange?.(this.elapsedSeconds, this.timeScale, this.paused);
    }

    stop() {
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    restore(snapshot) {
        this.elapsedSeconds = snapshot.elapsedSeconds;
        this.timeScale = [1, 2, 4].includes(snapshot.timeScale) ? snapshot.timeScale : 1;
        this.paused = Boolean(snapshot.paused);
        this.lastFrame = null;
        this.onTimeChange?.(this.elapsedSeconds, this.timeScale, this.paused);
    }

    serialize() {
        return {
            elapsedSeconds: this.elapsedSeconds,
            timeScale: this.timeScale,
            paused: this.paused
        };
    }
}
