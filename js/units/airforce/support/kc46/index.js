// js/units/airforce/support/kc46/index.js
export const KC46_DATA = {
    id: "KC-46A",
    name: "KC-46A Pegasus",
    branch: "airforce",
    category: "SUPPORT",
    role: "TANKER_MULTIROLE",
    refuelSystem: "BOOM_AND_DROGUE",
    speed: { min: 180, cruise: 480, max: 0.86 },
    altitude: { min: 1000, cruise: 34000, max: 42000 },
    radar: { hasRadar: false, rangeNm: 60, fovDegrees: 90, lookDownCapable: false },
    engagementRange: 0,
    payload: {
        pylons: 0,
        cargoCapacity: { personnel: 58, suppliesKg: 29500 },
        fuelCapacityKg: 96293
    },
    tasks: ["REFUEL_BOOM", "REFUEL_DROGUE", "CARGO_TRANSPORT"],
    behavior: "orbit"
};