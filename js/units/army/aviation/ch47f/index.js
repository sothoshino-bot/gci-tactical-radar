// js/units/army/aviation/ch47f/index.js
export const CH47F_DATA = {
    id: "CH-47F",
    name: "CH-47F Chinook",
    branch: "army",
    category: "HELI",
    role: "HEAVY_LIFT_HELI",
    speed: { 
        min: 0, 
        cruise: 140, // 巡航速度 (ノット)
        max: 170     // 最高速度 (ノット)
    },
    altitude: { 
        min: 20, 
        cruise: 10000, 
        max: 20000   // 実用上昇限度 (feet)
    },
    radar: { 
        hasRadar: false, 
        rangeNm: 20, 
        fovDegrees: 90, 
        lookDownCapable: false 
    },
    engagementRange: 0, // 武装による直接交戦は基本なし（自衛用ドアガン等を除く）
    payload: {
        pylons: 0,
        maxWeightKg: 10886, // 吊り下げ・内部積載の最大重量
        cargoCapacity: { 
            personnel: 55,       // 完全武装兵員
            suppliesKg: 10886    // 物資・車両など
        },
        compatibleWeapons: [
            "M134 Minigun (Door Guns)"
        ]
    },
    tasks: ["HEAVY_LIFT", "TROOP_TRANSPORT", "LOGISTICS", "MEDEVAC", "CSAR"],
    behavior: "heli_transport"
};