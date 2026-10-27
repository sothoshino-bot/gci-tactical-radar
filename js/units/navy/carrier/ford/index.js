// js/units/navy/carrier/ford/index.js
export const FORD_CARRIER_DATA = {
    id: "CVN-78",
    name: "USS Gerald R. Ford (CVN-78)",
    branch: "navy",
    category: "CARRIER",
    role: "AIRCRAFT_CARRIER",
    speed: { maxSpeed: 0.3, maxKmh: 56 }, // 約30ノット
    armorRating: "Heavy",
    radar: { hasRadar: true, rangeNm: 150, fovDegrees: 360, lookDownCapable: true },
    payload: {
        aircraftCapacity: 75, // 搭載可能な艦載機の総数
        defensiveWeapons: ["Evolved SeaSparrow (ESSM)", "RIM-116 RAM", "Phalanx CIWS"]
    },
    tasks: ["MOBILE_AIRBASE", "POWER_PROJECTION"],
    behavior: "naval_patrol"
};