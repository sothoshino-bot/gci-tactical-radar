// js/units/airforce/fighter/f35a/index.js
export const F35A_DATA = {
    id: "F-35A",
    name: "F-35A Lightning II",
    branch: "airforce",
    category: "JET",
    role: "STEALTH_MULTIROLE",
    speed: { min: 120, cruise: 480, max: 1.6 },
    altitude: { min: 0, cruise: 30000, max: 50000 },
    radar: {
        hasRadar: true,
        rangeNm: 110,
        fovDegrees: 140,
        lookDownCapable: true,
        stealthFactor: 0.05
    },
    engagementRange: 75,
    payload: {
        pylons: 6, // 内部ベイ2 + 外部4
        maxWeightKg: 8100,
        compatibleWeapons: [
            "AIM-120C/D AMRAAM", "AIM-9X Sidewinder", "GBU-31/32 JDAM", "SDB (Small Diameter Bomb)"
        ]
    },
    tasks: ["CAP", "CAS", "SEAD", "STRIKE"],
    behavior: "stealth_multirole"
};