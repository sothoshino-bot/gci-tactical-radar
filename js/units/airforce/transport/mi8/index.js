export const MI8_DATA = {
    id: 'Mi-8MTV2',
    name: 'Mi-8MTV2 Hip',
    branch: 'airforce',
    category: 'HELI',
    role: 'CSAR_TRANSPORT',
    speed: { min: 35, cruise: 120, max: 0.13 },
    altitude: { min: 0, cruise: 6500, max: 19700 },
    radar: { hasRadar: false, rangeNm: 0, fovDegrees: 0, lookDownCapable: false },
    engagementRange: 0,
    payload: {
        pylons: 6,
        maxWeightKg: 4000,
        cargoCapacity: { personnel: 24, suppliesKg: 4000 },
        compatibleWeapons: []
    },
    combatRating: { air: 0.1, ground: 0.25 },
    tasks: ['CSAR', 'MEDEVAC', 'TROOP_TRANSPORT', 'LOGISTICS'],
    behavior: 'transport_route'
};
