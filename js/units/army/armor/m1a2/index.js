export const M1A2_DATA = {
    id: "M1A2_SEPv3",
    name: "M1A2 SEPv3 Abrams",
    branch: "army",
    category: "TANK",
    speed: { maxSpeed: 0.6, maxKmh: 67 },
    engagementRange: 3.5, // 主砲の有効射程 (約3.5km)
    armorRating: "Very High",
    payload: {
        mainGun: "120mm Smoothbore M256",
        compatibleWeapons: ["M829A4 APFSDS", "M1147 AMP"]
    },
    tasks: ["ARMOR_COMBAT", "BREAKTHROUGH", "FRONT_LINE"],
    behavior: "ground_advance"
};