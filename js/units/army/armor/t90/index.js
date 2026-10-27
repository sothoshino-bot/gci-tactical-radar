export const T90A_DATA = {
    id: 'T-90A',
    name: 'T-90A Main Battle Tank',
    branch: 'army',
    category: 'TANK',
    faction: 'red',
    speed: { maxSpeed: 0.55, maxKmh: 60 },
    engagementRange: 4.0,
    armorRating: 'High',
    payload: {
        mainGun: '125mm 2A46M smoothbore',
        compatibleWeapons: ['3BM-60 APFSDS', '9M119M Refleks']
    },
    tasks: ['ARMOR_COMBAT', 'BREAKTHROUGH', 'FRONT_LINE'],
    behavior: 'ground_advance'
};
