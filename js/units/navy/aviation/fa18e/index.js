// js/units/navy/aviation/fa18e/index.js
export const FA18E_DATA = {
    id: "F/A-18E",
    name: "F/A-18E Super Hornet",
    branch: "navy",
    category: "JET",
    role: "CARRIER_STRIKE_FIGHTER",
    speed: { min: 120, cruise: 490, max: 1.6 },
    altitude: { min: 0, cruise: 30000, max: 50000 },
    radar: { hasRadar: true, rangeNm: 75, fovDegrees: 120, lookDownCapable: true },
    engagementRange: 50,
    payload: {
        pylons: 11,
        maxWeightKg: 8050,
        compatibleWeapons: [
            "AIM-120D AMRAAM", "AIM-9X Sidewinder", "AGM-84 Harpoon", "GBU-31 JDAM"
        ]
    },
    tasks: ["CAP", "CAS", "STRIKE", "ANTI_SHIP"],
    behavior: "carrier_multirole"
};