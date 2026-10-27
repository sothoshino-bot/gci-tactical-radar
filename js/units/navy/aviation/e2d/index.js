// js/units/navy/aviation/e2d/index.js
export const E2D_DATA = {
    id: "E-2D",
    name: "E-2D Advanced Hawkeye",
    branch: "navy",
    category: "SUPPORT",
    role: "CARRIER_AEW",
    speed: { min: 100, cruise: 300, max: 0.6 },
    altitude: { min: 500, cruise: 25000, max: 37000 },
    radar: { 
        hasRadar: true, 
        rangeNm: 220, // 圧倒的な艦載レーダー索敵範囲
        fovDegrees: 360, 
        lookDownCapable: true 
    },
    engagementRange: 0,
    payload: { pylons: 0, maxWeightKg: 0, compatibleWeapons: [] },
    tasks: ["EARLY_WARNING", "CARRIER_GCI", "AIR_CONTROL"],
    behavior: "carrier_orbit"
};