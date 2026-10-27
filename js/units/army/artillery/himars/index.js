export const HIMARS_DATA = {
    id: "M142_HIMARS",
    name: "M142 HIMARS 高機動ロケット砲",
    branch: "army",
    category: "ARTILLERY",
    speed: { maxSpeed: 0.8, maxKmh: 85 },
    engagementRange: 45, // GMLRSで最大70〜80km
    payload: {
        compatibleWeapons: ["GMLRS (GPS Rockets)", "ATACMS (Tactical Missiles)"]
    },
    tasks: ["STRATEGIC_BOMBARDMENT", "DEEP_STRIKE", "COUNTER_BATTERY"],
    behavior: "artillery_support"
};