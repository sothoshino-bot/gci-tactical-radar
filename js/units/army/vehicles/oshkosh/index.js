export const HEMTT_DATA = {
    id: "HEMTT_SUPPLY",
    name: "HEMTT 8輪重補給トラック",
    branch: "army",
    category: "LOGISTICS",
    speed: { maxSpeed: 0.75, maxKmh: 100 },
    engagementRange: 0,
    payload: { suppliesKg: 10000, fuelLitert: 9500 },
    tasks: ["SUPPLY", "REARM", "LOGISTICS"],
    behavior: "supply_run"
};