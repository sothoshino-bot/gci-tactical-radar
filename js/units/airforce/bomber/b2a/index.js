// js/units/airforce/bomber/b2a/index.js
export const B2A_DATA = {
    id: "B-2A",
    name: "B-2A Spirit",
    branch: "airforce",
    category: "JET",
    role: "STEALTH_STRATEGIC_BOMBER",
    speed: { min: 150, cruise: 480, max: 0.95 },
    altitude: { min: 500, cruise: 40000, max: 50000 },
    radar: {
        hasRadar: true,
        rangeNm: 100,
        fovDegrees: 120,
        lookDownCapable: true,
        stealthFactor: 0.02 // 極めて高いステルス係数（レーダーにほぼ映らない）
    },
    engagementRange: 75,
    payload: {
        pylons: 2, // 内部ロータリーランチャー（ウェポンベイ）
        maxWeightKg: 18000,
        compatibleWeapons: [
            "GBU-31 JDAM", "GBU-57 MOP (Massive Ordnance Penetrator)", 
            "AGM-158 JASSM", "B61 Nuclear Bomb"
        ]
    },
    tasks: ["DEEP_STRIKE", "STRATEGIC_BOMBING", "STEALTH_BOMBING"],
    behavior: "stealth_strategic_strike"
};