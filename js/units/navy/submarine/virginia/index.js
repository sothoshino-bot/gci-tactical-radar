// js/units/navy/submarine/virginia/index.js
export const VIRGINIA_SSN_DATA = {
    id: "SSN-774",
    name: "Virginia-class Block V (SSN)",
    branch: "navy",
    category: "SUBMARINE",
    role: "ATTACK_SUBMARINE",
    speed: { maxSpeed: 0.4, maxKmh: 46 }, // 水中高速
    armorRating: "Submerged (Stealth)",
    radar: { 
        hasRadar: false, // ソナー（音響探知）を使用
        rangeNm: 40, 
        fovDegrees: 360, 
        lookDownCapable: false 
    },
    engagementRange: 50,
    payload: {
        vlsTubes: 40, // バージニア・ペイロード・モジュール(VPM)による多数のトマホーク搭載
        compatibleWeapons: [
            "Tomahawk Cruise Missiles", "Mk-48 Heavyweight Torpedoes"
        ]
    },
    tasks: ["STEALTH_STRIKE", "ANTI_SUBMARINE", "INTELLIGENCE"],
    behavior: "subsurface_patrol"
};