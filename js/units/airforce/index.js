// js/units/airforce/index.js
import { FIGHTER_TYPES } from './fighter/index.js';
import { BOMBER_TYPES } from './bomber/index.js';
import { ATTACKER_TYPES } from './attacker/index.js';
import { SUPPORT_TYPES } from './support/index.js';
import { TRANSPORT_TYPES } from './transport/index.js';

export const AIRFORCE_TYPES = {
    ...FIGHTER_TYPES,
    ...BOMBER_TYPES,
    ...ATTACKER_TYPES,
    ...SUPPORT_TYPES,
    ...TRANSPORT_TYPES
};

export function updateAirforceBehavior(unit, dt) {
    // 飛行体の共通移動・周回ロジック
    if (unit.behavior === "orbit") {
        unit.orbitAngle = (unit.orbitAngle || 0) + 0.005;
        unit.x += Math.cos(unit.orbitAngle) * 0.2;
        unit.y += Math.sin(unit.orbitAngle) * 0.2;
    } else {
        const dx = unit.tx - unit.x;
        const dy = unit.ty - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            unit.x += (dx / dist) * (unit.speed?.cruise ? unit.speed.cruise / 100 : 1);
            unit.y += (dy / dist) * (unit.speed?.cruise ? unit.speed.cruise / 100 : 1);
        }
    }
}