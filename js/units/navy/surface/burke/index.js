// js/units/navy/surface/burke/index.js
export const BURKE_DDG_DATA = {
    id: "DDG-51_F3",
    name: "Arleigh Burke Flight III (DDG)",
    branch: "navy",
    category: "SURFACE",
    role: "GUIDED_MISSILE_DESTROYER",
    speed: { maxSpeed: 0.35, maxKmh: 56 },
    armorRating: "Medium",
    radar: { 
        hasRadar: true, 
        rangeNm: 180, // AN/SPY-6防空レーダーの超長距離索敵
        fovDegrees: 360, 
        lookDownCapable: true 
    },
    engagementRange: 90, // SM-6等の迎撃・対地射程
    payload: {
        vlsCells: 96, // 垂直発射セル数
        compatibleWeapons: [
            "Standard Missile 6 (SM-6)", "Tomahawk Cruise Missiles", 
            "ESSM", "Harpoon Anti-Ship Missiles"
        ]
    },
    tasks: ["FLEET_AIR_DEFENSE", "STRIKE", "ANTI_SUBMARINE"],
    behavior: "naval_escort"
};