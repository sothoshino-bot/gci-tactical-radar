export const BRADLEY_DATA = {
    id: "M2A3_BRADLEY",
    name: "M2A3 Bradley IFV",
    branch: "army",
    category: "IFV",
    speed: { maxSpeed: 0.65, maxKmh: 66 },
    engagementRange: 3.0,
    armorRating: "Medium",
    payload: {
        personnel: 6, // 兵員輸送能力
        compatibleWeapons: ["25mm Chain Gun", "TOW Anti-Tank Missiles"]
    },
    tasks: ["INFANTRY_SUPPORT", "ANTI_ARMOR", "FRONT_LINE"],
    behavior: "ground_advance"
};