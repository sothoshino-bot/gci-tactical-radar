import { CAUCASUS_AIRFIELDS } from '../airfields.js/index.js';
import { FORWARD_BASES } from '../map.js';
import { getFactionAircraft, getFactionUnits } from '../units/index.js';

const AREA_TARGETS = [
    { id: 'AREA:WEST', name: 'Caucasus West Airspace', lat: 44.1, lng: 39.3, side: 'contested' },
    { id: 'AREA:EAST', name: 'Caucasus East Airspace', lat: 43.1, lng: 43.6, side: 'contested' }
];
const REAR_AREAS = {
    blue: { id: 'AREA:REAR:BLUE', name: 'Blue rear warning orbit', lat: 42.25, lng: 44.25, side: 'blue' },
    red: { id: 'AREA:REAR:RED', name: 'Red rear warning orbit', lat: 44.8, lng: 38.8, side: 'red' }
};
const AIRCRAFT_SERVICE_SECONDS = 4 * 60 * 60;
const MIN_AIRFRAMES_PER_TYPE = 20;
const AIRCRAFT_ROSTER_VERSION = 2;

function getReadyAirframeLimit(totalAirframes) {
    return Math.floor(totalAirframes * 0.3);
}

function distanceBetween(first, second) {
    const latitudeScale = Math.cos(((first.lat + second.lat) / 2) * Math.PI / 180);
    return Math.hypot(
        (first.lat - second.lat) * 111.32,
        (first.lng - second.lng) * 111.32 * latitudeScale
    );
}

function getBvrStandoffPoint(from, target) {
    const distance = distanceBetween(from, target);
    if (distance <= 65) return { lat: from.lat, lng: from.lng };
    const fraction = 65 / distance;
    return {
        lat: target.lat + (from.lat - target.lat) * fraction,
        lng: target.lng + (from.lng - target.lng) * fraction
    };
}

const MISSION_TASKS = {
    CAP: ['CAP', 'BARCAP', 'AIR_SUPERIORITY', 'INTERCEPT'],
    SWEEP_CAP: ['SWEEP', 'AIR_SUPERIORITY', 'CAP'],
    ESCORT: ['ESCORT', 'CAP', 'INTERCEPT'],
    LOGISTICS_ESCORT: ['LOGISTICS_ESCORT'],
    EARLY_WARNING: ['EARLY_WARNING', 'GCI_SUPPORT', 'AIRSPACE_CONTROL', 'CARRIER_GCI'],
    TANKER: ['AIR_REFUELING', 'REFUEL_BOOM', 'REFUEL_DROGUE'],
    CAS: ['CAS'],
    STRIKE: ['STRIKE', 'CAS', 'DEEP_STRIKE', 'GROUND_ATTACK', 'ARMOR_DESTRUCTION',
        'STRATEGIC_BOMBING', 'CARPET_BOMBING', 'STEALTH_BOMBING'],
    ANTI_SHIP: ['ANTI_SHIP'],
    SEAD: ['SEAD'],
    INTERCEPT: ['INTERCEPT', 'CAP', 'SWEEP', 'AIR_SUPERIORITY'],
    RECON: ['RECON', 'ISR', 'AWACS'],
    LOGISTICS: ['LOGISTICS', 'AIRDROP'],
    TROOP_TRANSPORT: ['TROOP_TRANSPORT', 'LOGISTICS'],
    CSAR: ['CSAR', 'MEDEVAC'],
    SCAR: ['SCAR']
};

export class MissionManager {
    constructor() {
        this.scores = this.createScores();
        this.currentGameTime = 0;
        this.samSites = [];
        this.mobileBases = {};
        this.forwardBaseStates = Object.fromEntries(FORWARD_BASES.map(base => [
            base.id,
            {
                owner: base.owner,
                stockBySide: {
                    blue: { supplies: 0, personnel: 0, fuel: 0, airframes: 0, spareParts: 0 },
                    red: { supplies: 0, personnel: 0, fuel: 0, airframes: 0, spareParts: 0 }
                }
            }
        ]));
        this.airfieldStates = Object.fromEntries(CAUCASUS_AIRFIELDS.map(airfield => [
            airfield.id,
            {
                stock: {
                    supplies: this.isHeadquarters(airfield) ? Infinity : 120,
                    personnel: this.isHeadquarters(airfield) ? Infinity : 300,
                    fuel: this.isHeadquarters(airfield) ? Infinity : 100000,
                    airframes: 10,
                    airframesReady: 10,
                    airframesMaintenance: 30,
                    aircraftByType: null,
                    aircraftInitialStockExpanded: false,
                    spareParts: this.isHeadquarters(airfield) ? Infinity : 250,
                    totalAirframes: 40
                },
                owner: airfield.side,
                activePackages: [],
                serviceQueue: [],
                sortiesToday: 0,
                sortiesByType: {},
                sortieDay: 0,
                samRepairCost: 0
            }
        ]));
        for (const airfield of CAUCASUS_AIRFIELDS) {
            const side = this.getState(airfield.id).owner;
            if (side === 'blue' || side === 'red') this.getAircraftRoster(airfield.id, side);
        }
    }

    isHeadquarters(airfield) {
        return airfield.id === 'UGTB' || Boolean(airfield.hqFixed?.startsWith('RED CMD'));
    }

    registerMobileBase(unit) {
        if (unit.category !== 'CARRIER') return;
        const total = unit.payload?.aircraftCapacity || 60;
        const ready = getReadyAirframeLimit(total);
        const fixed = this.mobileBases[unit.id];
        this.mobileBases[unit.id] = {
            id: unit.id,
            name: unit.name,
            lat: unit.lat,
            lng: unit.lng,
            side: unit.side,
            category: 'CARRIER',
            stock: fixed?.stock || {
                supplies: 0,
                personnel: 0,
                fuel: Infinity,
                airframes: ready,
                airframesReady: ready,
                airframesMaintenance: total - ready,
                spareParts: Infinity,
                totalAirframes: total
            },
            owner: unit.side,
            carrierId: unit.id,
            serviceQueue: fixed?.serviceQueue || [],
            sortiesToday: fixed?.sortiesToday || 0,
            sortiesByType: fixed?.sortiesByType || {},
            sortieDay: fixed?.sortieDay || 0,
            activePackages: fixed?.activePackages || []
        };
        this.airfieldStates[unit.id] = this.mobileBases[unit.id];
    }

    setOwnership(airfieldIds) {
        const ownedIds = new Set(airfieldIds);
        for (const airfield of CAUCASUS_AIRFIELDS) {
            const state = this.airfieldStates[airfield.id];
            const owner = ownedIds.has(airfield.id)
                ? 'blue'
                : airfield.side === 'blue' ? 'red' : airfield.side;
            if (state.owner !== owner) {
                state.stock.aircraftByType = null;
                state.stock.aircraftRosterSide = null;
                state.stock.aircraftRosterVersion = 0;
                state.stock.aircraftInitialStockExpanded = false;
            }
            state.owner = owner;
        }
        for (const airfield of CAUCASUS_AIRFIELDS) {
            const state = this.getState(airfield.id);
            if (state.owner === 'blue' || state.owner === 'red') {
                this.getAircraftRoster(airfield.id, state.owner);
            }
            state.stock.aircraftInitialStockExpanded = true;
        }
    }

    getState(airfieldId) {
        const state = this.airfieldStates[airfieldId];
        if (!state) throw new Error(`Unknown airfield: ${airfieldId}`);
        return state;
    }

    getForwardBaseState(baseId) {
        const state = this.forwardBaseStates[baseId];
        if (!state) throw new Error(`Unknown forward base: ${baseId}`);
        return state;
    }

    captureForwardBase(baseId, side) {
        if (!['blue', 'red'].includes(side)) {
            throw new Error(`Invalid faction for forward-base capture: ${side}`);
        }
        const state = this.getForwardBaseState(baseId);
        state.owner = side;
        return state;
    }

    getDeparture(departureId) {
        const airfield = CAUCASUS_AIRFIELDS.find(item => item.id === departureId);
        const carrier = this.mobileBases[departureId];
        if (!airfield && !carrier) return null;
        if (carrier) {
            const liveCarrier = this.mobileBases[departureId];
            liveCarrier.lat = carrier.lat;
            liveCarrier.lng = carrier.lng;
            return liveCarrier;
        }
        return airfield;
    }

    advanceTime(gameTime) {
        this.currentGameTime = gameTime;
        const day = Math.floor(gameTime / 86400);
        for (const state of Object.values(this.airfieldStates)) {
            if (state.sortieDay !== day) {
                state.sortieDay = day;
                state.sortiesToday = 0;
                state.sortiesByType = {};
            }
            const ready = [];
            state.serviceQueue = (state.serviceQueue || []).filter(item => {
                if (item.dueAt > gameTime) return true;
                ready.push(item);
                return false;
            });
            for (const item of ready) {
                state.stock.airframesMaintenance = Math.max(0, state.stock.airframesMaintenance - item.count);
                state.stock.airframesReady = Math.min(
                    getReadyAirframeLimit(state.stock.totalAirframes),
                    state.stock.airframesReady + item.count
                );
                const typeInventory = item.aircraftTypeId
                    ? state.stock.aircraftByType?.[item.aircraftTypeId]
                    : null;
                if (typeInventory) {
                    typeInventory.maintenance = Math.max(0, typeInventory.maintenance - item.count);
                    typeInventory.ready += item.count;
                }
            }
            state.stock.airframes = state.stock.airframesReady;
        }
    }

    getAircraftForSide(side) {
        const aircraft = [
            ...getFactionAircraft(side),
            ...getFactionUnits(side, 'navy')
                .filter(unit => unit.category === 'JET')
        ];
        return [...new Map(aircraft.map(unit => [unit.typeId, unit])).values()];
    }

    getAircraftType(side, typeId) {
        return this.getAircraftForSide(side).find(unit => unit.typeId === typeId) || null;
    }

    getAircraftRoster(airfieldId, side) {
        const state = this.getState(airfieldId);
        let aircraft = this.getAircraftForSide(side).filter(unit =>
            state.category === 'CARRIER' ? unit.branch === 'navy' : unit.branch !== 'navy'
        );
        if (airfieldId === 'UGTB') {
            aircraft = aircraft.filter(unit =>
                ['LOGISTICS', 'TROOP_TRANSPORT'].some(mission =>
                    this.getMissionTypes(unit).includes(mission)
                )
            );
        }
        const stock = state.stock;
        if (!stock.aircraftByType || stock.aircraftRosterSide !== side) {
            stock.aircraftByType = {};
            stock.aircraftRosterSide = side;
            if (!Number.isFinite(stock.totalAirframes)) {
                for (const unit of aircraft) {
                    stock.aircraftByType[unit.typeId] = { ready: Infinity, maintenance: Infinity };
                }
            } else if (state.category !== 'CARRIER' && !stock.aircraftInitialStockExpanded) {
                for (const unit of aircraft) {
                    const ready = Math.floor(MIN_AIRFRAMES_PER_TYPE * 0.3);
                    stock.aircraftByType[unit.typeId] = {
                        ready,
                        maintenance: MIN_AIRFRAMES_PER_TYPE - ready
                    };
                }
                stock.aircraftRosterVersion = AIRCRAFT_ROSTER_VERSION;
                stock.aircraftInitialStockExpanded = true;
                this.updateAircraftStockTotals(stock);
            } else {
                const total = Math.max(0, Math.floor(stock.totalAirframes));
                const ready = Math.max(0, Math.min(total, Math.floor(stock.airframesReady)));
                const priority = [...aircraft].sort((first, second) =>
                    this.aircraftReadinessPriority(second) - this.aircraftReadinessPriority(first) ||
                    first.typeId.localeCompare(second.typeId)
                );
                const countByType = new Map(aircraft.map(unit => [
                    unit.typeId,
                    Math.floor(total / Math.max(1, aircraft.length))
                ]));
                for (let index = 0; index < total % Math.max(1, aircraft.length); index++) {
                    countByType.set(priority[index].typeId, countByType.get(priority[index].typeId) + 1);
                }
                let readyRemaining = ready;
                const readyByType = new Map(aircraft.map(unit => [unit.typeId, 0]));
                while (readyRemaining > 0) {
                    let assigned = false;
                    for (const unit of priority) {
                        const readyCount = readyByType.get(unit.typeId);
                        if (readyCount >= (countByType.get(unit.typeId) || 0)) continue;
                        readyByType.set(unit.typeId, readyCount + 1);
                        readyRemaining--;
                        assigned = true;
                        if (readyRemaining === 0) break;
                    }
                    if (!assigned) break;
                }
                for (const unit of aircraft) {
                    const count = countByType.get(unit.typeId) || 0;
                    stock.aircraftByType[unit.typeId] = {
                        ready: readyByType.get(unit.typeId) || 0,
                        maintenance: count - (readyByType.get(unit.typeId) || 0)
                    };
                }
                stock.aircraftRosterVersion = AIRCRAFT_ROSTER_VERSION;
            }
        } else if (state.category !== 'CARRIER' &&
            (stock.aircraftRosterVersion || 0) < AIRCRAFT_ROSTER_VERSION) {
            const previousTypeTotal = Object.values(stock.aircraftByType)
                .reduce((total, inventory) => total + inventory.ready + inventory.maintenance, 0);
            const additionalUnassigned = Math.max(0, stock.totalAirframes - previousTypeTotal);
            const additionalMaintenance = Math.max(
                0,
                stock.airframesMaintenance -
                    Object.values(stock.aircraftByType)
                        .reduce((total, inventory) => total + inventory.maintenance, 0)
            );
            for (const unit of aircraft) {
                const inventory = stock.aircraftByType[unit.typeId] || { ready: 0, maintenance: 0 };
                const currentTotal = inventory.ready + inventory.maintenance;
                const total = Math.max(MIN_AIRFRAMES_PER_TYPE, currentTotal);
                const ready = Math.min(
                    total,
                    Math.max(inventory.ready, Math.floor(total * 0.3))
                );
                stock.aircraftByType[unit.typeId] = {
                    ready,
                    maintenance: total - ready
                };
            }
            stock.aircraftRosterVersion = AIRCRAFT_ROSTER_VERSION;
            stock.aircraftInitialStockExpanded = true;
            this.updateAircraftStockTotals(stock, additionalUnassigned, additionalMaintenance);
        }
        for (const unit of aircraft) {
            stock.aircraftByType[unit.typeId] ||= { ready: 0, maintenance: 0 };
        }
        return aircraft.map(unit => ({
            ...unit,
            ...stock.aircraftByType[unit.typeId]
        }));
    }

    updateAircraftStockTotals(stock, additionalAirframes = 0, additionalMaintenance = 0) {
        const inventories = Object.values(stock.aircraftByType);
        stock.totalAirframes = inventories.reduce(
            (total, inventory) => total + inventory.ready + inventory.maintenance,
            additionalAirframes
        );
        stock.airframesReady = inventories.reduce((total, inventory) => total + inventory.ready, 0);
        stock.airframesMaintenance = inventories.reduce(
            (total, inventory) => total + inventory.maintenance,
            additionalMaintenance
        );
        stock.airframes = stock.airframesReady;
    }

    aircraftReadinessPriority(unit) {
        const preferred = ['F-15C', 'F-16C', 'A-10C', 'AH-64E', 'KC-135'];
        const index = preferred.indexOf(unit.typeId);
        if (index >= 0) return 20 - index;
        if (unit.tasks?.includes('CAP')) return 10;
        if (unit.tasks?.includes('CSAR') || unit.tasks?.includes('LOGISTICS')) return 5;
        return 0;
    }

    getTargets(currentAirfieldId, missionType, side, airUnits = []) {
        if (missionType === 'TRANSPORT') {
            return CAUCASUS_AIRFIELDS.filter(airfield =>
                airfield.id !== currentAirfieldId &&
                airfield.id !== 'UGTB' &&
                this.airfieldStates[airfield.id].owner === side
            ).map(airfield => ({
                ...airfield,
                side: this.airfieldStates[airfield.id].owner
            }));
        }

        if (missionType === 'INTERCEPT') {
            return airUnits
                .filter(unit => unit.branch === 'airforce' && unit.side !== side &&
                    unit.mission?.type !== 'EARLY_WARNING' &&
                    unit.mission && unit.route.length > 0)
                .map(unit => ({
                    id: unit.id,
                    name: `${unit.id} // ${unit.aircraft}`,
                    lat: unit.lat,
                    lng: unit.lng,
                    side: unit.side,
                    unit
                }));
        }

        if (missionType === 'CSAR') {
            return (airUnits || [])
                .filter(unit => unit.branch === 'survivor' && !unit.rescued && !unit.captured)
                .map(unit => ({
                    id: unit.id,
                    name: `${unit.survivorType}: ${unit.name}`,
                    lat: unit.lat,
                    lng: unit.lng,
                    side: unit.side,
                    unit
                }));
        }

        if (missionType === 'CAS' || missionType === 'SCAR') {
            return (airUnits || [])
                .filter(unit => unit.branch === 'army' && unit.side !== side && unit.condition > 0)
                .map(unit => ({
                    id: unit.id,
                    name: `${unit.id} // GROUND CONTACT`,
                    lat: unit.lat,
                    lng: unit.lng,
                    side: unit.side,
                    unit
                }));
        }

        if (missionType === 'CAP') {
            return [...AREA_TARGETS];
        }

        if (missionType === 'SWEEP_CAP') {
            return [...AREA_TARGETS];
        }

        if (missionType === 'EARLY_WARNING') {
            return [REAR_AREAS[side]];
        }

        if (missionType === 'TANKER') {
            return [REAR_AREAS[side]];
        }

        if (missionType === 'ANTI_SHIP') {
            return (airUnits || [])
                .filter(unit => unit.branch === 'navy' && unit.side !== side)
                .map(unit => ({
                    id: unit.id,
                    name: `${unit.id} // SURFACE CONTACT`,
                    lat: unit.lat,
                    lng: unit.lng,
                    side: unit.side,
                    unit
                }));
        }

        if (missionType === 'ESCORT' || missionType === 'LOGISTICS_ESCORT') {
            const supportedMissions = missionType === 'LOGISTICS_ESCORT'
                ? ['LOGISTICS', 'TROOP_TRANSPORT']
                : ['STRIKE', 'SEAD', 'RECON'];
            return (airUnits || [])
                .filter(unit => unit.branch === 'airforce' && unit.side === side &&
                    unit.mission && supportedMissions.includes(unit.mission.type))
                .map(unit => ({
                    id: unit.id,
                    name: `${unit.id} // ESCORT`,
                    lat: unit.lat,
                    lng: unit.lng,
                    side: unit.side,
                    unit
                }));
        }

        if (missionType === 'SEAD') {
            return [
                ...(airUnits || []).filter(unit => unit.branch === 'sam' && unit.side !== side && unit.operational)
                    .map(unit => ({
                        id: unit.id, name: `${unit.system} // ${unit.name}`,
                        lat: unit.lat, lng: unit.lng, side: unit.side, unit
                    })),
                ...CAUCASUS_AIRFIELDS.filter(airfield =>
                    airfield.id !== currentAirfieldId && this.airfieldStates[airfield.id].owner !== side
                )
            ];
        }

        if (missionType === 'LOGISTICS' || missionType === 'TROOP_TRANSPORT') {
            const airfields = CAUCASUS_AIRFIELDS.filter(airfield =>
                airfield.id !== currentAirfieldId &&
                airfield.id !== 'UGTB'
            ).map(airfield => ({
                ...airfield,
                side: this.airfieldStates[airfield.id].owner
            }));
            const forwardBases = FORWARD_BASES.filter(base => base.id !== currentAirfieldId)
                .map(base => ({
                    ...base,
                    side: this.getForwardBaseState(base.id).owner,
                    kind: 'FOB'
                }));
            return [...airfields, ...forwardBases];
        }

        const enemySide = side === 'blue' ? 'red' : 'blue';
        const enemyAirfields = CAUCASUS_AIRFIELDS.filter(airfield =>
            airfield.id !== currentAirfieldId &&
            this.airfieldStates[airfield.id].owner === enemySide
        );
        if (missionType === 'RECON') return [...enemyAirfields, ...AREA_TARGETS];
        return enemyAirfields;
    }

    getMissionTypes(unit) {
        const missions = Object.entries(MISSION_TASKS)
            .filter(([, tasks]) => tasks.some(task => unit.tasks?.includes(task)))
            .map(([type]) => type);
        if (unit.category === 'JET' &&
            unit.tasks?.some(task => ['CAP', 'AIR_SUPERIORITY', 'INTERCEPT', 'SWEEP'].includes(task))) {
            missions.push('TRANSPORT');
        }
        return missions;
    }

    generateOptimalRoute(departure, target, missionType) {
        const route = [];
        if (missionType !== 'INTERCEPT') {
            route.push({
                name: departure.category === 'CARRIER' ? 'CATAPULT / LAUNCH' : 'CLIMB / STAGING',
                lat: departure.lat + 0.04,
                lng: departure.lng + 0.04,
                alt: 5000
            });
        }
        if (missionType === 'EARLY_WARNING' || missionType === 'TANKER') {
            route.push(...[
                [0.12, 0],
                [0, 0.16],
                [-0.12, 0],
                [0, -0.16],
                [0.12, 0]
            ].map(([lat, lng], index) => ({
                name: `${missionType} ORBIT // LEG ${index + 1}`,
                lat: target.lat + lat,
                lng: target.lng + lng,
                alt: 8000
            })));
            return route;
        }
        if (missionType === 'TRANSPORT') {
            route.push({
                name: `TRANSPORT // ${target.name}`,
                lat: target.lat,
                lng: target.lng,
                alt: 7000
            });
            return route;
        }
        if (missionType === 'INTERCEPT') {
            route.push({
                name: `BVR INTERCEPT // ${target.name}`,
                ...getBvrStandoffPoint(departure, target),
                alt: 8000
            });
        } else if (missionType === 'CAP' || missionType === 'SWEEP_CAP') {
            const patrolPoints = [
                { lat: 0.08, lng: 0 },
                { lat: 0, lng: 0.12 },
                { lat: -0.08, lng: 0 },
                { lat: 0, lng: -0.12 },
                { lat: 0.08, lng: 0 }
            ];
            route.push(...patrolPoints.map((offset, index) => ({
                name: `${missionType} // ${target.name} // LEG ${index + 1}`,
                lat: target.lat + offset.lat,
                lng: target.lng + offset.lng,
                alt: 7000
            })));
        } else {
            route.push({
                name: `${missionType} // ${target.name}`,
                lat: target.lat,
                lng: target.lng,
                alt: missionType === 'STRIKE' ? 2000 : 7000
            });
        }
        route.push({
            name: departure.category === 'CARRIER' ? 'CARRIER RECOVERY / APPROACH' : 'RTB // APPROACH',
            lat: departure.lat + 0.04,
            lng: departure.lng + 0.04,
            alt: 3000
        });
        route.push({
            name: departure.category === 'CARRIER' ? 'ARRESTED CARRIER LANDING' : 'LANDING',
            lat: departure.lat,
            lng: departure.lng,
            alt: 0
        });
        return route;
    }

    launchMission(departureId, packageData) {
        const departure = this.getDeparture(departureId);
        const state = this.getState(departureId);
        const side = packageData.side || state.owner;
        const typeId = packageData.aircraft;
        const unitType = this.getAircraftForSide(side).find(unit => unit.typeId === typeId);
        const target = packageData.target;
        const missionType = packageData.missionType;
        const count = Number(packageData.count);

        if (state.owner !== side) return { success: false, message: 'ERROR: This airfield is not under your control.' };
        if (!departure) return { success: false, message: 'ERROR: Departure airfield not found.' };
        if (departureId === 'UGTB' && !['LOGISTICS', 'TROOP_TRANSPORT'].includes(missionType)) {
            return { success: false, message: 'ERROR: Tbilisi is a logistics-only airfield.' };
        }
        if (!unitType) return { success: false, message: `ERROR: ${typeId} is not available to the ${side} faction.` };
        if (!this.getMissionTypes(unitType).includes(missionType)) {
            return { success: false, message: `ERROR: ${unitType.name} cannot perform ${missionType}.` };
        }
        if (!Number.isInteger(count) || count < 1 || count > 4) {
            return { success: false, message: 'ERROR: Package size must be between 1 and 4 aircraft.' };
        }
        if (departure.category === 'CARRIER' && unitType.branch !== 'navy') {
            return { success: false, message: 'ERROR: Carrier air operations require embarked naval aircraft.' };
        }
        if (departure.category !== 'CARRIER' && unitType.branch === 'navy') {
            return { success: false, message: 'ERROR: Naval aircraft must launch from a carrier.' };
        }
        if (state.stock.airframesReady < count) {
            return { success: false, message: 'ERROR: Not enough ready airframes at this airfield.' };
        }
        const aircraftInventory = this.getAircraftRoster(departureId, side)
            .find(item => item.typeId === typeId);
        if (!aircraftInventory || aircraftInventory.ready < count) {
            return { success: false, message: `ERROR: ${unitType.name} has no ready airframes at this base.` };
        }
        const typeAirframes = aircraftInventory.ready + aircraftInventory.maintenance;
        const typeSortieLimit = Number.isFinite(typeAirframes)
            ? Math.max(1, typeAirframes * 2)
            : Infinity;
        if ((state.sortiesByType?.[typeId] || 0) + count > typeSortieLimit) {
            return { success: false, message: 'ERROR: This aircraft type has reached its two-sorties-per-airframe daily limit.' };
        }
        if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
            return { success: false, message: 'ERROR: Select a valid mission target.' };
        }
        if (!this.getTargets(departureId, missionType, side, packageData.airUnits || [])
            .some(candidate => candidate.id === target.id) &&
            !(['CAP', 'SWEEP_CAP', 'EARLY_WARNING', 'CAS', 'TANKER'].includes(missionType) &&
                target.id.startsWith('AREA:CUSTOM:')) &&
            !(missionType === 'ESCORT' && packageData.escortTarget &&
                Number.isFinite(target.lat) && Number.isFinite(target.lng)) &&
            !(target.id.startsWith('MAP:CUSTOM:') &&
                !['LOGISTICS', 'TROOP_TRANSPORT', 'CSAR'].includes(missionType))) {
            return { success: false, message: 'ERROR: Target is not valid for this mission or faction.' };
        }
        if (['CAP', 'SWEEP_CAP', 'TANKER'].includes(missionType) &&
            !target.id.startsWith('AREA:')) {
            return { success: false, message: `ERROR: ${missionType} must patrol a designated airspace area.` };
        }
        if (missionType === 'EARLY_WARNING' && target.id !== REAR_AREAS[side].id) {
            return { success: false, message: 'ERROR: Early warning must remain in a designated friendly patrol area.' };
        }
        if (missionType === 'TRANSPORT' &&
            (target.id === 'UGTB' || this.airfieldStates[target.id]?.owner !== side)) {
            return { success: false, message: 'ERROR: Aircraft transport requires another friendly operating airfield.' };
        }

        const requiresEscort = missionType === 'STRIKE' &&
            unitType.tasks?.some(task => [
                'STRATEGIC_BOMBING', 'CARPET_BOMBING', 'STEALTH_BOMBING', 'DEEP_STRIKE'
            ].includes(task));
        if (requiresEscort && !packageData.escortSupport) {
            const escortInSupport = (packageData.airUnits || []).some(unit =>
                unit.branch === 'airforce' && unit.side === side &&
                unit.mission?.type === 'ESCORT' && distanceBetween(unit, departure) <= 80
            );
            if (!escortInSupport) {
                return { success: false, message: 'ERROR: This bomber requires an active escort package.' };
            }
        }

        const cargoCapacity = unitType.payload?.cargoCapacity || {};
        const cargo = {
            supplies: Math.max(0, Math.floor(Number(packageData.cargo?.supplies) || 0)),
            personnel: Math.max(0, Math.floor(Number(packageData.cargo?.personnel) || 0)),
            fuel: Math.max(0, Math.floor(Number(packageData.cargo?.fuel) || 0)),
            airframes: Math.max(0, Math.floor(Number(packageData.cargo?.airframes) || 0)),
            spareParts: Math.max(0, Math.floor(Number(packageData.cargo?.spareParts) || 0))
        };
        if (missionType === 'LOGISTICS' || missionType === 'TROOP_TRANSPORT') {
            if (missionType === 'LOGISTICS' && (!cargoCapacity.suppliesKg ||
                cargo.supplies + cargo.fuel + cargo.spareParts + cargo.airframes < 1)) {
                return { success: false, message: 'ERROR: This aircraft cannot carry the requested supplies.' };
            }
            if (missionType === 'TROOP_TRANSPORT' && (!cargoCapacity.personnel || cargo.personnel < 1)) {
                return { success: false, message: 'ERROR: This aircraft cannot transport personnel.' };
            }
            const totalCargoWeight = cargo.supplies + cargo.fuel + cargo.spareParts * 100 + cargo.airframes * 5000;
            if (totalCargoWeight > (cargoCapacity.suppliesKg || 0) || cargo.personnel > (cargoCapacity.personnel || 0)) {
                return { success: false, message: 'ERROR: Cargo exceeds this aircraft capacity.' };
            }
            if (cargo.supplies > state.stock.supplies || cargo.personnel > state.stock.personnel ||
                cargo.fuel > state.stock.fuel || cargo.airframes > state.stock.airframes ||
                cargo.spareParts > state.stock.spareParts) {
                return { success: false, message: 'ERROR: Tbilisi stock is insufficient.' };
            }
        }

        const route = this.generateOptimalRoute(departure, target, missionType);
        const routeKm = route.reduce((distance, point, index) => {
            if (index === 0) return distance;
            const previous = route[index - 1];
            const latitudeScale = Math.cos(((previous.lat + point.lat) / 2) * Math.PI / 180);
            return distance + Math.hypot(
                (point.lat - previous.lat) * 111.32,
                (point.lng - previous.lng) * 111.32 * latitudeScale
            );
        }, Math.hypot((route[0].lat - departure.lat) * 111.32, (route[0].lng - departure.lng) * 82));
        const fuelCost = Math.ceil(routeKm * count * (missionType === 'LOGISTICS' || missionType === 'TROOP_TRANSPORT' || unitType.category === 'HELI' ? 8 : 5));
        const airframeCost = count;
        const partsCost = Math.max(1, Math.ceil(count * routeKm / 1000));
        if (state.stock.airframesReady < airframeCost || state.stock.fuel < fuelCost || state.stock.spareParts < partsCost) {
            return { success: false, message: 'ERROR: Insufficient airframes, fuel, or spare parts at this airfield.' };
        }
        state.stock.airframesReady -= airframeCost;
        state.stock.airframes = state.stock.airframesReady;
        if (Number.isFinite(aircraftInventory.ready)) {
            state.stock.aircraftByType[typeId].ready -= airframeCost;
        }
        state.stock.fuel -= fuelCost;
        state.stock.spareParts -= partsCost;
        state.sortiesToday += count;
        state.sortiesByType ||= {};
        state.sortiesByType[typeId] = (state.sortiesByType[typeId] || 0) + count;
        if (missionType === 'LOGISTICS' || missionType === 'TROOP_TRANSPORT') {
            state.stock.supplies -= cargo.supplies;
            state.stock.personnel -= cargo.personnel;
            state.stock.fuel -= cargo.fuel;
            state.stock.airframes -= cargo.airframes;
            state.stock.spareParts -= cargo.spareParts;
        }

        const mission = {
            type: missionType,
            targetId: target.id,
            aircraft: typeId,
            count,
            cargo,
            fuelCost,
            partsCost,
            departureId,
            routeKm,
            scoreValue: Math.max(1, Math.round(routeKm * count)),
            cost: fuelCost + partsCost * 100 + count * 500
        };
        this.recordMissionCost(side, mission.cost);
        state.activePackages.push(mission);

        return {
            success: true,
            message: `PACKAGE LAUNCHED: ${unitType.name} (${count} aircraft) -> ${target.name} [${missionType}]`,
            route,
            package: {
                ...mission,
                side,
                departure,
                target,
                unitType,
                route: this.generateOptimalRoute(departure, target, missionType),
                launchRecord: mission
            }
        };
    }

    deliverSupplies(destinationId, cargo, side = 'blue') {
        const airfield = CAUCASUS_AIRFIELDS.find(base => base.id === destinationId);
        if (!airfield) {
            const state = this.getForwardBaseState(destinationId);
            const stock = state.stockBySide[side];
            stock.supplies += cargo.supplies || 0;
            stock.personnel += cargo.personnel || 0;
            stock.fuel += cargo.fuel || 0;
            stock.airframes += cargo.airframes || 0;
            stock.spareParts += cargo.spareParts || 0;
            return { name: FORWARD_BASES.find(base => base.id === destinationId).name, ...cargo };
        }
        const state = this.getState(destinationId);
        if (state.owner === side) {
            state.stock.supplies += cargo.supplies;
            state.stock.personnel += cargo.personnel;
            state.stock.fuel += cargo.fuel || 0;
            if (cargo.airframes > 0) {
                state.stock.totalAirframes += cargo.airframes;
                state.stock.airframesMaintenance += cargo.airframes;
                state.serviceQueue.push({
                    count: cargo.airframes,
                    dueAt: this.currentGameTime + AIRCRAFT_SERVICE_SECONDS
                });
            }
            state.stock.spareParts += cargo.spareParts || 0;
        } else {
            state.deliveredCargoBySide ||= {
                blue: { supplies: 0, personnel: 0, fuel: 0, airframes: 0, spareParts: 0 },
                red: { supplies: 0, personnel: 0, fuel: 0, airframes: 0, spareParts: 0 }
            };
            const stock = state.deliveredCargoBySide[side];
            for (const key of ['supplies', 'personnel', 'fuel', 'airframes', 'spareParts']) {
                stock[key] += cargo[key] || 0;
            }
        }
        return { name: airfield.name, ...cargo };
    }

    deliverTroops(destinationId, cargo, side = 'blue') {
        const airfield = CAUCASUS_AIRFIELDS.find(base => base.id === destinationId);
        if (!airfield) {
            const state = this.getForwardBaseState(destinationId);
            state.stockBySide[side].personnel += cargo.personnel;
            return {
                name: FORWARD_BASES.find(base => base.id === destinationId).name,
                personnel: cargo.personnel
            };
        }
        const state = this.getState(destinationId);
        if (state.owner === side) {
            state.stock.personnel += cargo.personnel;
        } else {
            state.deliveredCargoBySide ||= {
                blue: { supplies: 0, personnel: 0, fuel: 0, airframes: 0, spareParts: 0 },
                red: { supplies: 0, personnel: 0, fuel: 0, airframes: 0, spareParts: 0 }
            };
            state.deliveredCargoBySide[side].personnel += cargo.personnel;
        }
        return { name: airfield.name, personnel: cargo.personnel };
    }

    recoverAircraft(airfieldId, mission) {
        const state = this.getState(airfieldId);
        state.stock.airframesMaintenance += mission.count;
        state.serviceQueue.push({
            count: mission.count,
            aircraftTypeId: mission.aircraft,
            dueAt: this.currentGameTime + AIRCRAFT_SERVICE_SECONDS
        });
        const aircraftInventory = state.stock.aircraftByType?.[mission.aircraft];
        if (aircraftInventory && Number.isFinite(aircraftInventory.maintenance)) {
            aircraftInventory.maintenance += mission.count;
        }
        state.stock.fuel += Math.floor(mission.fuelCost * 0.15);
        state.stock.spareParts += Math.floor(mission.partsCost * 0.25);
        const index = state.activePackages.findIndex(packageRecord =>
            packageRecord === mission ||
            (packageRecord.aircraft === mission.aircraft &&
                packageRecord.targetId === mission.targetId &&
                packageRecord.departureId === mission.departureId)
        );
        if (index >= 0) state.activePackages.splice(index, 1);
    }

    loseAircraft(airfieldId, mission) {
        const state = this.getState(airfieldId);
        const losses = Math.min(state.stock.totalAirframes, mission.count);
        state.stock.totalAirframes -= losses;
        state.stock.airframesReady = Math.min(
            state.stock.airframesReady,
            getReadyAirframeLimit(state.stock.totalAirframes)
        );
        state.stock.airframes = state.stock.airframesReady;
    }

    captureAirfield(airfieldId, side) {
        const state = this.getState(airfieldId);
        if (state.owner !== side) {
            state.stock.aircraftByType = null;
            state.stock.aircraftRosterSide = null;
        }
        state.owner = side;
        state.activePackages = [];
    }

    transferAircraft(departureId, destinationId, mission) {
        const origin = this.getState(departureId);
        const destination = this.getState(destinationId);
        if (destination.owner !== origin.owner || destinationId === 'UGTB') {
            return { success: false, message: 'Transport destination is no longer a friendly operating airfield.' };
        }
        const count = mission.count;
        if (Number.isFinite(origin.stock.totalAirframes)) {
            origin.stock.totalAirframes = Math.max(0, origin.stock.totalAirframes - count);
        }
        const originMissionIndex = origin.activePackages.indexOf(mission);
        if (originMissionIndex >= 0) origin.activePackages.splice(originMissionIndex, 1);

        this.getAircraftRoster(destinationId, destination.owner);
        if (Number.isFinite(destination.stock.totalAirframes)) {
            destination.stock.totalAirframes += count;
        }
        if (Number.isFinite(destination.stock.airframesMaintenance)) {
            destination.stock.airframesMaintenance += count;
        }
        const destinationType = destination.stock.aircraftByType?.[mission.aircraft];
        if (destinationType && Number.isFinite(destinationType.maintenance)) {
            destinationType.maintenance += count;
        }
        destination.serviceQueue.push({
            count,
            aircraftTypeId: mission.aircraft,
            dueAt: this.currentGameTime + AIRCRAFT_SERVICE_SECONDS
        });
        return { success: true };
    }

    recordMissionOutcome(side, missionType, unitType, enemyUnitType, count) {
        const ownRating = unitType?.combatRating?.air || (missionType === 'CAP' || missionType === 'INTERCEPT' ? 1 : 0.85);
        const enemyRating = enemyUnitType?.combatRating?.air || 1;
        const effectiveness = Math.max(0.35, Math.min(1.75, ownRating / enemyRating));
        const value = Math.max(1, Math.round(count * 100 * effectiveness));
        this.scores[side].cost += value;
        this.scores[side].missionValue += Math.round(value * effectiveness);
        this.scores[side].losses += Math.max(0, Math.round(count * (1 - effectiveness) * 0.35));
        this.scores[side].victories += effectiveness >= 1 ? 1 : 0;
        return { effectiveness, value };
    }

    recordMissionCost(side, cost) {
        this.scores[side].cost += cost;
    }

    launchCoordinatedMissions(departureIds, packageData) {
        const results = [];
        for (const departureId of departureIds) {
            results.push({
                departureId,
                ...this.launchMission(departureId, packageData)
            });
        }
        return results;
    }

    repairSAM(site, side) {
        const state = this.getState(site.baseId);
        if (state.owner !== side || site.operational) {
            return { success: false, message: 'Repair unavailable: control this disabled air-defense site.' };
        }
        const partCost = site.repairCost || 120;
        const creditCost = 25000;
        if (state.stock.spareParts < partCost || state.owner !== side) {
            return { success: false, message: `Repair requires ${partCost} spare parts and control of the site. ` +
                'Deliver spare parts from a command headquarters first.' };
        }
        state.stock.spareParts -= partCost;
        this.scores[side].cost += creditCost;
        site.condition = 100;
        site.ammo = 6;
        site.operational = true;
        site.side = side;
        return { success: true, message: `${site.name} repaired // ${partCost} spare parts and ${creditCost} credits.` };
    }

    getCampaignScore(side) {
        const score = this.scores[side];
        const controlledBases = Object.values(this.airfieldStates)
            .filter(state => state.owner === side).length;
        return score.missionValue + score.victories * 500 + controlledBases * 1000 +
            score.rescued * 100 - Math.round(score.cost / 100);
    }

    serialize() {
        return {
            airfieldStates: this.airfieldStates,
            forwardBaseStates: this.forwardBaseStates,
            mobileBases: this.mobileBases,
            scores: this.scores,
            currentGameTime: this.currentGameTime,
            samSites: this.samSites
        };
    }

    restore(snapshot) {
        for (const base of FORWARD_BASES) {
            this.forwardBaseStates[base.id] = {
                ...this.getForwardBaseState(base.id),
                ...snapshot.forwardBaseStates?.[base.id],
                stockBySide: {
                    ...this.getForwardBaseState(base.id).stockBySide,
                    ...snapshot.forwardBaseStates?.[base.id]?.stockBySide
                }
            };
        }
        for (const airfield of CAUCASUS_AIRFIELDS) {
            const state = snapshot.airfieldStates?.[airfield.id];
            if (!state) continue;
            this.airfieldStates[airfield.id] = {
                ...this.getState(airfield.id),
                ...state,
                stock: {
                    ...this.getState(airfield.id).stock,
                    ...state.stock,
                    supplies: state.stock.supplies === 'Infinity' ? Infinity : state.stock.supplies,
                    personnel: state.stock.personnel === 'Infinity' ? Infinity : state.stock.personnel,
                    fuel: state.stock.fuel === 'Infinity' ? Infinity : state.stock.fuel,
                    airframes: state.stock.airframes === 'Infinity' ? Infinity : state.stock.airframes,
                    airframesReady: state.stock.airframesReady === 'Infinity' ? Infinity : state.stock.airframesReady,
                    airframesMaintenance: state.stock.airframesMaintenance === 'Infinity' ? Infinity : state.stock.airframesMaintenance,
                    spareParts: state.stock.spareParts === 'Infinity' ? Infinity : state.stock.spareParts,
                    totalAirframes: state.stock.totalAirframes === 'Infinity'
                        ? Infinity
                        : state.stock.totalAirframes,
                    aircraftByType: state.stock.aircraftByType
                        ? Object.fromEntries(Object.entries(state.stock.aircraftByType).map(([typeId, inventory]) => [
                            typeId,
                            Object.fromEntries(Object.entries(inventory).map(([key, value]) => [
                                key,
                                value === 'Infinity' ? Infinity : value
                            ]))
                        ]))
                        : null
                }
            };
            const restoredState = this.airfieldStates[airfield.id];
            const stock = restoredState.stock;
            if (state.stock.aircraftRosterVersion === undefined) {
                stock.aircraftRosterVersion = 0;
            }
            if (!Number.isFinite(stock.totalAirframes)) {
                stock.totalAirframes = 40;
                stock.aircraftByType = null;
                stock.aircraftRosterSide = null;
                stock.aircraftInitialStockExpanded = false;
            } else if (state.stock.aircraftInitialStockExpanded === undefined) {
                stock.aircraftInitialStockExpanded = Boolean(stock.aircraftByType);
            }
            if (!Number.isFinite(stock.airframesReady)) {
                stock.airframesReady = Math.floor(stock.totalAirframes * 0.25);
            }
            if (!Number.isFinite(stock.airframesMaintenance)) {
                stock.airframesMaintenance = Math.max(0, stock.totalAirframes - stock.airframesReady);
            }
            stock.airframes = stock.airframesReady;
            restoredState.sortiesByType ||= {};
        }
        this.mobileBases = snapshot.mobileBases || {};
        for (const [id, state] of Object.entries(this.mobileBases)) {
            this.airfieldStates[id] = this.airfieldStates[id] || state;
            this.airfieldStates[id] = {
                ...state,
                stock: Object.fromEntries(Object.entries(state.stock).map(([key, value]) =>
                    [key, value === 'Infinity' ? Infinity : value]
                ))
            };
            this.mobileBases[id] = this.airfieldStates[id];
        }
        this.currentGameTime = snapshot.currentGameTime || 0;
        this.samSites = snapshot.samSites || [];
        const defaults = this.createScores();
        this.scores = {
            blue: { ...defaults.blue, ...snapshot.scores?.blue },
            red: { ...defaults.red, ...snapshot.scores?.red }
        };
        for (const airfield of CAUCASUS_AIRFIELDS) {
            const side = this.getState(airfield.id).owner;
            if (side === 'blue' || side === 'red') this.getAircraftRoster(airfield.id, side);
        }
    }

    createScores() {
        return {
            blue: { cost: 0, missionValue: 0, losses: 0, victories: 0, rescued: 0 },
            red: { cost: 0, missionValue: 0, losses: 0, victories: 0, rescued: 0 }
        };
    }
}
