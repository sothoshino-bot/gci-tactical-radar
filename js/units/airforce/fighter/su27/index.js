export const SU27_DATA = {
    id: 'Su-27',
    name: 'Su-27 Flanker',
    branch: 'airforce',
    category: 'JET',
    role: 'AIR_SUPERIORITY',
    speed: { min: 150, cruise: 520, max: 2.35 },
    altitude: { min: 0, cruise: 36000, max: 59000 },
    radar: { hasRadar: true, rangeNm: 65, fovDegrees: 120, lookDownCapable: true },
    engagementRange: 55,
    tasks: ['CAP', 'SWEEP', 'INTERCEPT', 'STRIKE'],
    behavior: 'air_combat'
};
