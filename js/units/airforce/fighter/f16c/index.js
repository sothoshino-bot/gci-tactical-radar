// js/units/airforce/fighter/f16c/index.js
export const F16C_DATA = {
    id: "F-16C",
    name: "F-16C Fighting Falcon",
    branch: "airforce",
    category: "JET",
    role: "MULTIROLE",
    speed: { min: 130, cruise: 500, max: 2.0 },
    altitude: { min: 0, cruise: 30000, max: 50000 },
    radar: {
        hasRadar: true,
        rangeNm: 60,
        fovDegrees: 120,
        lookDownCapable: true
    },
    engagementRange: 50,
    payload: {
        pylons: 9,
        maxWeightKg: 7700,
        compatibleWeapons: [
            "AIM-120C AMRAAM", "AIM-9M/X Sidewinder", "AGM-88C HARM",
            "AGM-65 Maverick", "GBU-12 Paveway II", "Mk-82/84"
        ]
    },
    tasks: ["CAP", "CAS", "SEAD", "SWEEP"],
    behavior: "multirole_combat"
};