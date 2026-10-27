// js/weapons/navy.js
export const NAVY_WEAPONS = {
    SSM_CRUISE: {
        name: "艦対艦/巡航ミサイル (Tomahawk / Kalibr)",
        type: "MISSILE",
        guidance: "INERTIAL_GPS_TERCOM", // 慣性航法＋GPS＋地形照合
        rangeNm: 150,
        speed: 0.85,
        trajectory: "terrain_following", // 地形に沿って低空を長距離巡航
        damage: 150
    },
    NAVAL_SAM: {
        name: "艦対空ミサイル (Standard Missile / RIM-66)",
        type: "MISSILE",
        guidance: "SEMI_ACTIVE_RADAR", // 艦艇からの照射波受動誘導
        rangeNm: 80,
        speed: 3.5,
        trajectory: "semi_ballistic_intercept", // 迎撃用高速放物線軌道
        damage: 85
    },
    NAVAL_SHELL: {
        name: "5インチ / 76mm 艦砲弾",
        type: "SHELL",
        guidance: "NONE",
        rangeNm: 12.0, // 約20km
        speed: 2.0,
        trajectory: "naval_ballistic", // 高初速の弾道射撃
        damage: 40
    },
    TORPEDO: {
        name: "重魚雷 (Mk.48 / 53mm魚雷)",
        type: "TORPEDO",
        guidance: "ACOUSTIC_HOMING", // 音響ホーミング（水中）
        rangeNm: 20,
        speed: 0.3,
        trajectory: "underwater_homing", // 水中を直進・旋回して艦底を狙う
        damage: 200
    }
};