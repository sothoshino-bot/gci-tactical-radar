// js/units/airforce/transport/c17/index.js
export const C17_DATA = {
    id: "C-17",
    name: "C-17 Globemaster III",
    branch: "airforce",
    category: "TRANSPORT",
    role: "STRATEGIC_TRANSPORT",
    speed: { min: 150, cruise: 450, max: 0.76 },
    altitude: { min: 500, cruise: 30000, max: 45000 },
    radar: { hasRadar: true, rangeNm: 100, fovDegrees: 120, lookDownCapable: true },
    engagementRange: 0,
    payload: {
        pylons: 0,
        cargoCapacity: { personnel: 102, suppliesKg: 77500 }
    },
    tasks: ["HEAVY_AIRLIFT", "STRATEGIC_LOGISTICS", "PARATROOP_DROP", "LOGISTICS", "TROOP_TRANSPORT", "SCAR"],
    behavior: "transport_route"
};