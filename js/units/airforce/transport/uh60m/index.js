// js/units/airforce/transport/uh60m/index.js
export const UH60M_DATA = {
    id: "UH-60M",
    name: "UH-60M Black Hawk",
    branch: "airforce",
    category: "HELI",
    role: "UTILITY_HELI",
    speed: { min: 0, cruise: 150, max: 159 },
    altitude: { min: 50, cruise: 12000, max: 19000 },
    radar: { hasRadar: false, rangeNm: 15, fovDegrees: 90, lookDownCapable: false },
    engagementRange: 0,
    payload: {
        cargoCapacity: { personnel: 11, suppliesKg: 4100 }
    },
    tasks: ["TROOP_TRANSPORT", "MEDEVAC", "ASSAULT", "LOGISTICS", "CSAR", "SCAR"],
    behavior: "heli_transport"
};