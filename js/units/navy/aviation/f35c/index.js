// js/units/navy/aviation/f35c/index.js
export const F35C_DATA = {
    id: "F-35C",
    name: "F-35C Lightning II (Carrier)",
    branch: "navy",
    category: "JET",
    role: "STEALTH_CARRIER_FIGHTER",
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
        pylons: 6,
        maxWeightKg: 8100,
        compatibleWeapons: [
            "AIM-120C/D AMRAAM", "AIM-9X Sidewinder", "GBU-31 JDAM"
        ]
    },
    tasks: ["CAP", "STEALTH_STRIKE", "SEAD"],
    behavior: "stealth_carrier_combat"
};