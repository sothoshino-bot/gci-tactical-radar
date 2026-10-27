// js/units/airforce/fighter/f15c/index.js
export const F15C_DATA = {
    id: "F-15C",
    name: "F-15C Eagle",
    branch: "airforce",
    category: "JET",
    role: "AIR_SUPERIORITY",
    speed: { min: 150, cruise: 570, max: 2.5 },
    altitude: { min: 0, cruise: 35000, max: 65000 },
    radar: {
        hasRadar: true,
        rangeNm: 100,
        fovDegrees: 120,
        lookDownCapable: true
    },
    engagementRange: 70,
    combatRating: { air: 1.4, ground: 0.55 },
    payload: {
        pylons: 8,
        maxWeightKg: 7300,
        compatibleWeapons: [
            "AIM-120C AMRAAM", "AIM-7M Sparrow", "AIM-9M/X Sidewinder"
        ]
    },
    tasks: ["CAP", "BARCAP", "SWEEP", "INTERCEPT"],
    behavior: "air_combat"
};