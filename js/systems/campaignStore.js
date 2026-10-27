const STORAGE_KEY = 'strategic-command-campaign';
const SAVE_VERSION = 1;

export class CampaignStore {
    static save(snapshot) {
        const record = {
            version: SAVE_VERSION,
            savedAt: new Date().toISOString(),
            snapshot
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(record, (_key, value) =>
                value === Infinity ? 'Infinity' : value
            ));
        } catch (error) {
            throw new Error(`Campaign could not be saved: ${error.message}`);
        }
    }

    static load() {
        let serialized;
        try {
            serialized = localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            throw new Error(`Campaign storage is unavailable: ${error.message}`);
        }
        if (!serialized) return null;

        let record;
        try {
            record = JSON.parse(serialized);
        } catch (error) {
            throw new Error(`Saved campaign is corrupted: ${error.message}`);
        }
        if (record.version !== SAVE_VERSION || !record.snapshot?.missionManager ||
            !record.snapshot?.simulation || !Number.isFinite(record.snapshot?.clock?.elapsedSeconds)) {
            throw new Error('Saved campaign version or data is not supported.');
        }
        return record.snapshot;
    }
}
