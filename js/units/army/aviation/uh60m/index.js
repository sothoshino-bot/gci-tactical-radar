// js/units/army/aviation/uh60m/index.js
export const UH60M_DATA = {
    id: "UH-60M",
    name: "UH-60M Black Hawk",
    branch: "army",
    category: "HELI",
    role: "UTILITY_HELI",
    speed: { 
        min: 0, 
        cruise: 150, // 巡航速度 (ノット)
        max: 159     // 最高速度 (ノット)
    },
    altitude: { 
        min: 20, 
        cruise: 12000, 
        max: 19000   // 実用上昇限度 (feet)
    },
    radar: { 
        hasRadar: false, 
        rangeNm: 15, 
        fovDegrees: 90, 
        lookDownCapable: false 
    },
    engagementRange: 0, // 主に対地・人員輸送メイン
    payload: {
        pylons: 2, // 外部増槽やESSSによる武装懸架（オプション）
        maxWeightKg: 4100,
        cargoCapacity: { 
            personnel: 11,       // 搭乗兵員
            suppliesKg: 4100 
        },
        compatibleWeapons: [
            "M240H 7.62mm Machine Guns (Door Guns)", 
            "Hydra 70 Rockets (ESSS option)"
        ]
    },
    tasks: ["TROOP_TRANSPORT", "MEDEVAC", "ASSAULT", "LOGISTICS", "CSAR"],
    behavior: "heli_transport"
};