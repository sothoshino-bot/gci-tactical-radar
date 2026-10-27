// js/weapons/aircraft.js
export const AIRCRAFT_WEAPONS = {
    // 1. 空対空ミサイル (AAM)
    BVR_MISSILE: {
        name: "中長距離空対空ミサイル (AIM-120等)",
        type: "MISSILE",
        guidance: "ACTIVE_RADAR", // アクティブ・レーダー誘導
        rangeNm: 40,             // 射程 (海里)
        speed: 4.5,              // マッハ数
        trajectory: "high_altitude_cruise", // 高高度巡航からターミナル誘導
        damage: 80
    },
    WVR_MISSILE: {
        name: "短距離赤外線ミサイル (AIM-9X等)",
        type: "MISSILE",
        guidance: "INFRARED",     // 赤外線画像誘導
        rangeNm: 8,
        speed: 3.0,
        trajectory: "dogfight_seeker", // 高機動・オフボレサイト追尾
        damage: 60
    },

    // 2. 対地・対艦ミサイル (AGM / ARM)
    ANTI_RADIATION_MISSILE: {
        name: "対レーダーミサイル (AGM-88 HARM)",
        type: "MISSILE",
        guidance: "PASSIVE_RADAR", // 敵レーダー電波源追尾
        rangeNm: 50,
        speed: 3.2,
        trajectory: "ballistic_to_lock", // 発射後高弾道で進み電波元へ急降下
        damage: 90
    },
    ANTI_SHIP_MISSILE_AIR: {
        name: "空対艦ミサイル (Harpoon / Kh-35)",
        type: "MISSILE",
        guidance: "ACTIVE_RADAR_ALT", // アクティブ・レーダー ＋ 電波高度計
        rangeNm: 65,
        speed: 0.9,
        trajectory: "sea_skimming",   // 海面すれすれを低空飛行（シースキミング）
        damage: 120
    },

    // 3. 航空機関砲
    AIRCRAFT_GUN: {
        name: "20mm/30mm 機関砲弾",
        type: "BULLET",
        guidance: "NONE",
        rangeNm: 1.2,
        speed: 8.0,
        trajectory: "direct_ballistic", // 直線弾道
        damage: 25
    }
};