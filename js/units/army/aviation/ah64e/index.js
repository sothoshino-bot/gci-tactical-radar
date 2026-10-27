export const AH64E_DATA = {
    id: "AH-64E",
    name: "AH-64E Apache Guardian",
    branch: "army",
    category: "HELI",
    role: "ATTACK_HELICOPTER",
    speed: { min: 0, cruise: 145, max: 164 },
    altitude: { min: 20, cruise: 5000, max: 21000 },
    radar: { hasRadar: true, rangeNm: 8, fovDegrees: 360, lookDownCapable: true },
    engagementRange: 8,
    payload: {
        pylons: 4,
        compatibleWeapons: ["AGM-114 Hellfire", "Hydra 70 Rockets", "30mm Chain Gun"]
    },
    tasks: ["CAS", "LOGISTICS_ESCORT"],
    behavior: "heli_strike"
};