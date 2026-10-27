// js/airfields/samRegistry.js

// 1. 各空港（基地）に配備されたSAMの詳細データベース
export const SAM_DEPLOYMENTS = [
    {
        baseId: "URKA", baseName: "Anapa", side: "red",
        system: "S-300PS (SA-10)",
        lat: 45.035, lng: 37.380, range: 75000, // 射程 75km
        radarPower: 0.95,       // レーダー出力・索敵感度
        ecmResistance: 0.85,    // 敵のECM（ジャミング）に対する耐性
        chaffResistance: 0.80,  // チャフ（対レーダー欺瞞）への耐性
        lethality: 0.90         // 迎撃ミサイルの基本命中精度
    },
    {
        baseId: "URKW", baseName: "Krymsk", side: "red",
        system: "S-300PS (SA-10)",
        lat: 44.945, lng: 37.980, range: 75000,
        radarPower: 0.95, ecmResistance: 0.85, chaffResistance: 0.80, lethality: 0.90
    },
    {
        baseId: "URKG", baseName: "Gelendzhik", side: "red",
        system: "Buk-M1 (SA-11)",
        lat: 44.590, lng: 37.990, range: 40000, // 射程 40km
        radarPower: 0.80, ecmResistance: 0.70, chaffResistance: 0.75, lethality: 0.82
    },
    {
        baseId: "URKN", baseName: "Novorossiysk", side: "red",
        system: "Pantsir-S1 (SA-22)",
        lat: 44.675, lng: 37.790, range: 20000, // 射程 20km
        radarPower: 0.85, ecmResistance: 0.75, chaffResistance: 0.80, lethality: 0.88
    },
    {
        baseId: "URKK", baseName: "Krasnodar-Pashkovsky", side: "red",
        system: "S-300PS (SA-10)",
        lat: 45.060, lng: 39.240, range: 75000,
        radarPower: 0.95, ecmResistance: 0.85, chaffResistance: 0.80, lethality: 0.90
    },
    {
        baseId: "UGKS", baseName: "Senaki-Kolkhi", side: "blue",
        system: "Patriot PAC-2",
        lat: 42.210, lng: 42.010, range: 80000, // 射程 80km
        radarPower: 0.96, ecmResistance: 0.90, chaffResistance: 0.85, lethality: 0.92
    },
    {
        baseId: "UGKO", baseName: "Kutaisi", side: "blue",
        system: "Patriot PAC-3",
        lat: 42.500, lng: 42.520, range: 70000, // 射程 70km
        radarPower: 0.98, ecmResistance: 0.92, chaffResistance: 0.88, lethality: 0.95
    },
    {
        baseId: "UGSB", baseName: "Batumi", side: "blue",
        system: "NASAMS",
        lat: 41.635, lng: 41.615, range: 35000, // 射程 35km
        radarPower: 0.88, ecmResistance: 0.80, chaffResistance: 0.82, lethality: 0.85
    },
    {
        baseId: "XRMF", baseName: "Mozdok", side: "red",
        system: "S-300PS (SA-10)",
        lat: 43.820, lng: 44.610, range: 75000,
        radarPower: 0.95, ecmResistance: 0.85, chaffResistance: 0.80, lethality: 0.90
    },
    {
        baseId: "UGTB", baseName: "Tbilisi", side: "blue",
        system: "Patriot PAC-3",
        lat: 41.710, lng: 44.980, range: 70000,
        radarPower: 0.98, ecmResistance: 0.92, chaffResistance: 0.88, lethality: 0.95
    },
    {
        baseId: "UG27", baseName: "Vaziani", side: "blue",
        system: "Patriot PAC-2",
        lat: 41.590, lng: 45.000, range: 80000,
        radarPower: 0.96, ecmResistance: 0.90, chaffResistance: 0.85, lethality: 0.92
    },
    {
        id: "UGTB-POINT", baseId: "UGTB", baseName: "Tbilisi",
        system: "SHORT-RANGE POINT DEFENSE", gameCoverageKm: 9,
        lat: 41.700, lng: 44.960
    },
    {
        id: "UGKO-POINT", baseId: "UGKO", baseName: "Kutaisi",
        system: "SHORT-RANGE POINT DEFENSE", gameCoverageKm: 9,
        lat: 42.485, lng: 42.505
    },
    {
        id: "UGKS-POINT", baseId: "UGKS", baseName: "Senaki-Kolkhi",
        system: "SHORT-RANGE POINT DEFENSE", gameCoverageKm: 9,
        lat: 42.195, lng: 41.995
    },
    {
        id: "URKN-POINT", baseId: "URKN", baseName: "Novorossiysk",
        system: "SHORT-RANGE POINT DEFENSE", gameCoverageKm: 9,
        lat: 44.660, lng: 37.805
    }
];

// 2. 【SEAD・生存判定ロジック】
// 航空機がSAMの脅威圏内に入ったとき、被弾・撃墜されるかを確率計算する関数
export function evaluateSAMEngagement(unit, samSite) {
    // 簡易的な距離計算（緯度・経度からメートル換算）
    const latDiff = unit.lat - samSite.lat;
    const lngDiff = unit.lng - samSite.lng;
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // ざっくりm換算

    // 射程外なら生存（脅威なし）
    if (distance > samSite.range) {
        return { engaged: false, hit: false, message: "Out of range" };
    }

    // 機体が使用している対抗手段（ジャミング・チャフなど）の影響を考慮
    let hitProbability = samSite.lethality;

    // 敵機がECM（電子戦妨害）を行っている場合
    if (unit.isECMActive) {
        hitProbability *= (1.0 - samSite.ecmResistance);
    }
    // 敵機がチャフを散布している場合
    if (unit.isChaffActive) {
        hitProbability *= (1.0 - samSite.chaffResistance);
    }

    // 乱数による被弾判定
    const roll = Math.random();
    const isHit = roll < hitProbability;

    return {
        engaged: true,
        hit: isHit,
        samSystem: samSite.system,
        distanceMeters: Math.round(distance),
        probability: Math.round(hitProbability * 100)
    };
}