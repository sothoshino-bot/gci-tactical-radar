// js/units/airforce/fighter/f14b/index.js
export const F14B_DATA = {
    id: "F-14B",
    name: "F-14B Tomcat",
    branch: "airforce",
    category: "JET",
    role: "INTERCEPTOR",
    speed: { min: 160, cruise: 530, max: 2.34 },
    altitude: { min: 0, cruise: 32000, max: 53000 },
    radar: {
        hasRadar: true,
        rangeNm: 130,
        fovDegrees: 140,
        lookDownCapable: true
    },
    engagementRange: 85,
    combatRating: { air: 1.45, ground: 0.65 },
    payload: {
        pylons: 10,
        maxWeightKg: 6500,
        compatibleWeapons: [
            "AIM-54C Phoenix", "AIM-7M Sparrow", "AIM-9M Sidewinder",
            "GBU-10 Paveway II", "Mk-82 General Purpose Bombs"
        ]
    },
    tasks: ["CAP", "BARCAP", "INTERCEPT"],
    behavior: "intercept_combat"
};