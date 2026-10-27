// js/units/airforce/attacker/a10c/index.js
export const A10C_DATA = {
    id: "A-10C",
    name: "A-10C Thunderbolt II",
    branch: "airforce",
    category: "JET",
    role: "CLOSE_AIR_SUPPORT",
    speed: { min: 100, cruise: 350, max: 0.56 },
    altitude: { min: 100, cruise: 15000, max: 40000 },
    radar: {
        hasRadar: false, // 基本はターゲティングポッドとEO/IRを使用
        rangeNm: 30,
        fovDegrees: 90,
        lookDownCapable: true
    },
    engagementRange: 15,
    payload: {
        pylons: 11,
        maxWeightKg: 7200,
        compatibleWeapons: [
            "AGM-65 Maverick", "GBU-12 Paveway II", "Hydra 70 Rockets", "30mm GAU-8 Avenger (Gun)"
        ]
    },
    tasks: ["CAS", "ARMOR_DESTRUCTION", "CONVOY_HUNT"],
    behavior: "ground_attack"
};