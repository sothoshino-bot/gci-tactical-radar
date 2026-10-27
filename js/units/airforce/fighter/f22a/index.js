// js/units/airforce/fighter/f22a/index.js
export const F22A_DATA = {
    id: "F-22A",
    name: "F-22A Raptor",
    branch: "airforce",
    category: "JET",
    role: "STEALTH_SUPERIORITY",
    speed: { min: 140, cruise: 600, max: 2.25 },
    altitude: { min: 0, cruise: 40000, max: 65000 },
    radar: {
        hasRadar: true,
        rangeNm: 120,
        fovDegrees: 140,
        lookDownCapable: true,
        stealthFactor: 0.1
    },
    engagementRange: 90,
    payload: {
        pylons: 4, // 内部ベイ + 外部ハードポイント（仮）
        maxWeightKg: 9000,
        compatibleWeapons: [
            "AIM-120D AMRAAM", "AIM-9X Sidewinder", "JDAM (Internal)"
        ]
    },
    tasks: ["SWEEP", "CAP", "DEEP_STRIKE"],
    behavior: "stealth_combat"
};