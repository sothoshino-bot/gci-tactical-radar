export const PALADIN_DATA = {
    id: "M109A7",
    name: "M109A7 Paladin 155mm自走砲",
    branch: "army",
    category: "ARTILLERY",
    speed: { maxSpeed: 0.45, maxKmh: 56 },
    engagementRange: 22, // 射程 約22km (M982 Excaliburなら最大40km)
    payload: {
        mainGun: "155mm Howitzer",
        compatibleWeapons: ["M795 High Explosive", "M982 Excalibur (GPS-guided)"]
    },
    tasks: ["FIRE_SUPPORT", "BOMBARDMENT", "COUNTER_BATTERY"],
    behavior: "artillery_support"
};