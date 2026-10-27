// js/units/airforce/transport/c130j/index.js
export const C130J_DATA = {
    id: "C-130J",
    name: "C-130J Super Hercules",
    branch: "airforce",
    category: "TRANSPORT",
    role: "TACTICAL_TRANSPORT",
    speed: { min: 110, cruise: 350, max: 0.59 },
    altitude: { min: 200, cruise: 25000, max: 33000 },
    radar: { hasRadar: true, rangeNm: 80, fovDegrees: 120, lookDownCapable: true },
    engagementRange: 0,
    payload: {
        pylons: 0,
        cargoCapacity: { personnel: 92, suppliesKg: 19050 }
    },
    tasks: ["LOGISTICS", "AIRDROP", "TROOP_TRANSPORT", "SCAR"],
    behavior: "transport_route"
};