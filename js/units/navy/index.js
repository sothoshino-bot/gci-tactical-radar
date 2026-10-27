// js/units/navy/index.js
import { CARRIER_TYPES } from './carrier/index.js';
import { SURFACE_TYPES } from './surface/index.js';
import { SUBMARINE_TYPES } from './submarine/index.js';
import { NAVY_AVIATION_TYPES } from './aviation/index.js';

export const NAVY_TYPES = {
    ...CARRIER_TYPES,
    ...SURFACE_TYPES,
    ...SUBMARINE_TYPES,
    ...NAVY_AVIATION_TYPES
};

export function updateNavyBehavior(unit, dt) {
    const dx = unit.tx - unit.x;
    const dy = unit.ty - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
        unit.x += (dx / dist) * (unit.speed?.maxSpeed || 0.3);
        unit.y += (dy / dist) * (unit.speed?.maxSpeed || 0.3);
    }
}