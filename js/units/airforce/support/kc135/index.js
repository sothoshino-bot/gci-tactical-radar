// js/units/airforce/support/kc135/index.js
export const KC135_DATA = {
    id: "KC-135",
    name: "KC-135 Stratotanker",
    branch: "airforce",
    category: "SUPPORT",
    role: "TANKER_BOOM",
    refuelSystem: "BOOM",
    speed: { min: 200, cruise: 480, max: 0.85 },
    altitude: { min: 1000, cruise: 32000, max: 45000 },
    radar: { hasRadar: false, rangeNm: 50, fovDegrees: 90, lookDownCapable: false },
    engagementRange: 0,
    payload: { pylons: 0, maxWeightKg: 90000, fuelCapacityKg: 90700 }, // 燃料搭載量
    tasks: ["REFUEL_BOOM", "AIR_REFUELING"],
    behavior: "orbit"
};