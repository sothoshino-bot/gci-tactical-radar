export const INFANTRY_PLATOON_DATA = {
    id: "INFANTRY_PLATOON",
    name: "歩兵小隊 (Infantry Platoon)",
    branch: "army",
    category: "INF",
    speed: { maxSpeed: 0.2 },
    engagementRange: 0.3, // 約500m (小火器)
    payload: { personnel: 30, weapons: ["M4A1 Carbine", "M249 SAW", "FGM-148 Javelin"] },
    tasks: ["FRONT_LINE", "BASE_DEFENSE", "URBAN_COMBAT"],
    behavior: "ground_advance"
};