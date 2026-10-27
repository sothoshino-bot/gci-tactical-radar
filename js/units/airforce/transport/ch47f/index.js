// js/units/airforce/transport/ch47f/index.js
export const CH47F_DATA = {
    id: "CH-47F",
    name: "CH-47F Chinook",
    branch: "airforce",
    category: "HELI",
    role: "HEAVY_LIFT_HELI",
    speed: { min: 0, cruise: 160, max: 170 }, // ノット (KTAS)
    altitude: { min: 50, cruise: 10000, max: 20000 },
    radar: { hasRadar: false, rangeNm: 20, fovDegrees: 90, lookDownCapable: false },
    engagementRange: 0,
    payload: {
        cargoCapacity: { personnel: 55, suppliesKg: 10886 }
    },
    tasks: ["HEAVY_LIFT", "TROOP_TRANSPORT", "LOGISTICS", "MEDEVAC", "CSAR", "SCAR"],
    behavior: "heli_transport"
};