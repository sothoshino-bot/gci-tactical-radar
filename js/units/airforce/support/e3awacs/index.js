// js/units/airforce/support/e3awacs/index.js
export const E3AWACS_DATA = {
    id: "E-3C",
    name: "E-3C Sentry AWACS",
    branch: "airforce",
    category: "SUPPORT",
    role: "EARLY_WARNING",
    speed: { min: 180, cruise: 450, max: 0.78 },
    altitude: { min: 1000, cruise: 30000, max: 40000 },
    radar: {
        hasRadar: true,
        rangeNm: 200,        // 圧倒的な超長距離索敵範囲
        fovDegrees: 360,     // 全周360度カバー
        lookDownCapable: true
    },
    engagementRange: 0,
    payload: { pylons: 0, maxWeightKg: 0, compatibleWeapons: [] },
    tasks: ["EARLY_WARNING", "GCI_SUPPORT", "AIRSPACE_CONTROL"],
    behavior: "orbit" // 周回待機挙動
};