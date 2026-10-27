// js/units/airforce/fighter/fa18c/index.js
export const FA18C_DATA = {
    id: "F/A-18C",
    name: "F/A-18C Hornet",
    branch: "airforce",
    category: "JET",
    role: "STRIKE_FIGHTER",
    speed: { min: 120, cruise: 480, max: 1.8 },
    altitude: { min: 0, cruise: 28000, max: 50000 },
    radar: {
        hasRadar: true,
        rangeNm: 60, // AN/APG-73
        fovDegrees: 120,
        lookDownCapable: true
    },
    engagementRange: 45,
    tasks: ["CAP", "CAS", "STRIKE", "ANTI_SHIP"],
    behavior: "multirole_combat"
};