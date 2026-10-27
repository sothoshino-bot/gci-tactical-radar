// js/units/airforce/bomber/b52h/index.js
export const B52H_DATA = {
    id: "B-52H",
    name: "B-52H Stratofortress",
    branch: "airforce",
    category: "JET",
    role: "HEAVY_BOMBER",
    speed: { min: 200, cruise: 450, max: 0.86 },
    altitude: { min: 500, cruise: 32000, max: 50000 },
    radar: {
        hasRadar: true,
        rangeNm: 90,
        fovDegrees: 90,
        lookDownCapable: true
    },
    engagementRange: 120, // 巡航ミサイルによる超遠隔攻撃
    payload: {
        pylons: 12, // 内部ロータリーランチャー + 外部パイロン
        maxWeightKg: 31500,
        compatibleWeapons: [
            "AGM-86 ALCM", "AGM-158 JASSM", "GBU-31 JDAM", "CBU-87 Cluster Bombs"
        ]
    },
    tasks: ["STRATEGIC_BOMBING", "CARPET_BOMBING"],
    behavior: "heavy_bombardment"
};