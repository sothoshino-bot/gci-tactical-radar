// js/units/index.js
import { AIRFORCE_TYPES, updateAirforceBehavior } from './airforce/index.js';
import { ARMY_TYPES, updateArmyBehavior } from './army/index.js';
import { ARMY_AVIATION_TYPES } from './army/aviation/index.js';
import { NAVY_TYPES, updateNavyBehavior } from './navy/index.js';

// すべての軍種のユニットデータを一元化
export const ALL_UNITS = {
    ...AIRFORCE_TYPES,
    ...ARMY_TYPES,
    ...NAVY_TYPES
};

const RED_FACTION_UNIT_IDS = new Set(['Su-27', 'MiG-29', 'Mi-8MTV2', 'T-90A', 'ADMIRAL_GORSHKOV', 'KILO_636']);

export function getUnitFaction(unitTypeId) {
    if (RED_FACTION_UNIT_IDS.has(unitTypeId)) return 'red';
    if (AIRFORCE_TYPES[unitTypeId] || ALL_UNITS[unitTypeId]) return 'blue';
    return null;
}

export function getFactionAircraft(side) {
    return [
        ...Object.entries(AIRFORCE_TYPES)
            .filter(([typeId]) => getUnitFaction(typeId) === side)
            .map(([typeId, unit]) => ({ ...unit, faction: side, typeId })),
        ...Object.entries(ARMY_AVIATION_TYPES)
            .filter(([typeId]) => getUnitFaction(typeId) === side)
            .map(([typeId, unit]) => ({ ...unit, faction: side, typeId }))
    ];
}

export function getFactionUnits(side, branch) {
    return Object.entries(ALL_UNITS)
        .filter(([typeId, unit]) =>
            (!branch || unit.branch === branch) && getUnitFaction(typeId) === side
        )
        .map(([typeId, unit]) => ({ ...unit, faction: side, typeId }));
}

// ユニットの所属（branch）や種類に応じて適切な挙動関数にルーティングする親関数
export function updateUnitBehavior(unit, dt) {
    if (unit.branch === "airforce" || AIRFORCE_TYPES[unit.id]) {
        updateAirforceBehavior(unit, dt);
    } else if (unit.branch === "army" || ARMY_TYPES[unit.id]) {
        updateArmyBehavior(unit, dt);
    } else if (unit.branch === "navy" || NAVY_TYPES[unit.id]) {
        updateNavyBehavior(unit, dt);
    }
}