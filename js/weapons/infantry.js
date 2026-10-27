// js/weapons/infantry.js
export const INFANTRY_WEAPONS = {
    RIFLE_BULLET: {
        name: "5.56mm / 7.62mm 小銃弾",
        type: "BULLET",
        guidance: "NONE",
        rangeNm: 0.3, // 約500m
        speed: 1.0,
        trajectory: "direct_fire",
        damage: 10
    },
    ATGM: {
        name: "携帯/車載対戦車ミサイル (Javelin / Kornet)",
        type: "MISSILE",
        guidance: "WIRE_OR_IR", // 有線誘導 / 赤外線トップアタック
        rangeNm: 2.5,
        speed: 0.8,
        trajectory: "top_attack", // 上空から戦車の弱点（上面）へ急降下
        damage: 100
    },
    MORTAR_SHELL: {
        name: "81mm / 120mm 迫撃砲弾",
        type: "SHELL",
        guidance: "NONE",
        rangeNm: 4.0, // 約7km
        speed: 0.5,
        trajectory: "high_arc_ballistic", // 巨大な放物線を描く曲射弾道
        damage: 50
    }
};