export const GORSHKOV_FRIGATE_DATA = {
    id: 'ADMIRAL_GORSHKOV',
    name: 'Admiral Gorshkov-class Frigate',
    branch: 'navy',
    category: 'SURFACE',
    role: 'GUIDED_MISSILE_FRIGATE',
    speed: { maxSpeed: 30, maxKmh: 56 },
    radar: { hasRadar: true, rangeNm: 120, fovDegrees: 360, lookDownCapable: true },
    payload: { vlsCells: 32, compatibleWeapons: ['Kalibr', 'S-350 naval variant'] },
    tasks: ['FLEET_AIR_DEFENSE', 'STRIKE', 'ANTI_SUBMARINE'],
    behavior: 'naval_patrol'
};
