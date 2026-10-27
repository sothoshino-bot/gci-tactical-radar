export const F15E_DATA = {
    id: 'F-15E',
    name: 'F-15E Strike Eagle',
    branch: 'airforce',
    category: 'JET',
    role: 'MULTIROLE_STRIKE_FIGHTER',
    speed: { min: 130, cruise: 520, max: 2.5 },
    altitude: { min: 0, cruise: 35000, max: 60000 },
    radar: { hasRadar: true, rangeNm: 80, fovDegrees: 120, lookDownCapable: true },
    engagementRange: 65,
    payload: {
        pylons: 15,
        maxWeightKg: 11100,
        cargoCapacity: { personnel: 0, suppliesKg: 0 },
        compatibleWeapons: [
            'AIM-120 AMRAAM', 'AIM-9X Sidewinder', 'AGM-158 JASSM',
            'GBU-31 JDAM', 'GBU-12 Paveway II', 'AGM-88 HARM'
        ]
    },
    combatRating: { air: 1.15, ground: 1.15 },
    tasks: ['CAP', 'CAS', 'STRIKE', 'SEAD', 'SWEEP', 'INTERCEPT'],
    behavior: 'multirole_combat'
};
