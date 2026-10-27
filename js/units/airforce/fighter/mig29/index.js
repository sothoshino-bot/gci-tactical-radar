export const MIG29_DATA = {
    id: 'MiG-29',
    name: 'MiG-29 Fulcrum',
    branch: 'airforce',
    category: 'JET',
    role: 'INTERCEPTOR',
    speed: { min: 140, cruise: 470, max: 2.25 },
    altitude: { min: 0, cruise: 30000, max: 59000 },
    radar: { hasRadar: true, rangeNm: 45, fovDegrees: 120, lookDownCapable: true },
    engagementRange: 35,
    tasks: ['CAP', 'INTERCEPT', 'SWEEP', 'STRIKE'],
    behavior: 'intercept_combat'
};
