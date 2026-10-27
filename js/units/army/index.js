// js/units/army/index.js
import { INFANTRY_TYPES } from './infantry/index.js';
import { ARMOR_TYPES } from './armor/index.js';
import { ARTILLERY_TYPES } from './artillery/index.js';
import { VEHICLE_TYPES } from './vehicles/index.js';
import { ARMY_AVIATION_TYPES } from './aviation/index.js';

export const ARMY_TYPES = {
    ...INFANTRY_TYPES,
    ...ARMOR_TYPES,
    ...ARTILLERY_TYPES,
    ...VEHICLE_TYPES,
    ...ARMY_AVIATION_TYPES
};

export function updateArmyBehavior(unit, dt) {
    const dx = unit.tx - unit.x;
    const dy = unit.ty - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
        unit.x += (dx / dist) * (unit.speed?.maxSpeed || 0.5);
        unit.y += (dy / dist) * (unit.speed?.maxSpeed || 0.5);
    }
}