// js/units/airforce/bomber/b1b/index.js
export const B1B_DATA = {
    id: "B-1B",
    name: "B-1B Lancer",
    branch: "airforce",
    category: "JET",
    role: "STRATEGIC_BOMBER",
    speed: { min: 180, cruise: 550, max: 1.25 },
    altitude: { min: 200, cruise: 30000, max: 60000 },
    radar: {
        hasRadar: true,
        rangeNm: 100,
        fovDegrees: 120,
        lookDownCapable: true
    },
    engagementRange: 80,
    payload: {
        pylons: 8, // 内部ベイ3 + 外部ハードポイント（運用時）
        maxWeightKg: 34000,
        compatibleWeapons: [
            "AGM-86 ALCM", "AGM-158 JASSM", "GBU-31 JDAM", "Mk-82 General Purpose Bombs"
        ]
    },
    tasks: ["STRATEGIC_BOMBING", "DEEP_STRIKE", "ANTI_SHIP"],
    behavior: "strategic_strike"
};