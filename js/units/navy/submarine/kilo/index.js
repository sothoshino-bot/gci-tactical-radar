export const KILO_SUBMARINE_DATA = {
    id: 'KILO_636',
    name: 'Project 636.3 Kilo-class Submarine',
    branch: 'navy',
    category: 'SUBMARINE',
    role: 'ATTACK_SUBMARINE',
    speed: { maxSpeed: 20, maxKmh: 37 },
    radar: { hasRadar: false, rangeNm: 15, fovDegrees: 360, lookDownCapable: false },
    payload: { compatibleWeapons: ['Kalibr', '533mm torpedoes'] },
    tasks: ['ANTI_SHIP', 'ANTI_SUBMARINE'],
    behavior: 'submarine_patrol'
};
