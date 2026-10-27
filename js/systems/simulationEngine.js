import { getRoadRoute } from './roadRouter.js';
import { FORWARD_BASES } from '../map.js';

const KM_PER_LATITUDE_DEGREE = 111.32;
const AIR_ENGAGEMENT_MIN_GAME_KM = 55.56;
const AIR_ENGAGEMENT_MAX_GAME_KM = 74.08;

function distanceKm(from, to) {
    const latitudeScale = Math.cos(((from.lat + to.lat) / 2) * Math.PI / 180);
    const north = (to.lat - from.lat) * KM_PER_LATITUDE_DEGREE;
    const east = (to.lng - from.lng) * KM_PER_LATITUDE_DEGREE * latitudeScale;
    return Math.hypot(north, east);
}

function getStandoffPoint(from, target, separationKm = 65) {
    const distance = distanceKm(from, target);
    if (distance <= separationKm) return { lat: from.lat, lng: from.lng };
    const fraction = separationKm / distance;
    return {
        lat: target.lat + (from.lat - target.lat) * fraction,
        lng: target.lng + (from.lng - target.lng) * fraction
    };
}

export class SimulationEngine {
    constructor(map, missionManager, onMessage, onPackageComplete) {
        this.map = map;
        this.missionManager = missionManager;
        this.onMessage = onMessage;
        this.onPackageComplete = onPackageComplete;
        this.units = new Map();
        this.nextUnitNumber = 1;
        this.combatElapsed = 0;
        this.simulationTime = 0;
        this.rescuedPersonnel = { blue: 0, red: 0 };
        this.audioContext = null;
        this.lastRwrToneAt = 0;
    }

    enableRWRAlerts() {
        const AudioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextConstructor) {
            this.onMessage?.('RWR AUDIO UNAVAILABLE // browser audio is not supported.');
            return;
        }
        this.audioContext ||= new AudioContextConstructor();
        void this.audioContext.resume().catch(error => {
            this.onMessage?.(`RWR AUDIO UNAVAILABLE // ${error.message}`);
            console.error('[RWR_AUDIO_ERROR]', error);
        });
    }

    playRWRAlert() {
        if (!this.audioContext || this.audioContext.state !== 'running' ||
            this.simulationTime - this.lastRwrToneAt < 2) return;
        const oscillator = this.audioContext.createOscillator();
        const volume = this.audioContext.createGain();
        const now = this.audioContext.currentTime;
        oscillator.frequency.value = 880;
        volume.gain.setValueAtTime(0.06, now);
        volume.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        oscillator.connect(volume);
        volume.connect(this.audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.18);
        this.lastRwrToneAt = this.simulationTime;
    }

    deploy(unitData) {
        const unit = {
            ...unitData,
            route: unitData.route || [],
            routeIndex: unitData.routeIndex || 0,
            order: unitData.order || null,
            condition: unitData.condition ?? 100,
            fuel: unitData.fuel ?? 100,
            ammo: unitData.ammo ?? Math.max(2, (unitData.formationSize || 1) * 4),
            altitudeBand: unitData.altitudeBand ?? Math.floor(Math.random() * 5),
            energyBand: unitData.energyBand ?? Math.floor(Math.random() * 5),
            rescued: unitData.rescued ?? false
        };
        unit.marker = this.map.addUnit(unit.lat, unit.lng, unit);
        this.units.set(unit.id, unit);
        this.map.setUnitRoute?.(unit);
        if (unit.branch === 'survivor') {
            unit.signalId ||= `SIGNAL-${unit.id}`;
            this.map.addSignal?.({
                id: unit.signalId,
                type: 'CSAR',
                lat: unit.lat,
                lng: unit.lng,
                unitId: unit.id,
                side: unit.side
            });
        } else if (unit.casSignalId) {
            this.map.addSignal?.({
                id: unit.casSignalId,
                type: 'CAS',
                lat: unit.lat,
                lng: unit.lng,
                unitId: unit.id,
                side: unit.side
            });
        }
        if (unit.category === 'CARRIER') this.missionManager.registerMobileBase(unit);
        return unit;
    }

    issueRoute(unit, waypoints, mission = {}) {
        const orderType = mission.type || 'MOVE';
        unit.route = [];
        unit.routeIndex = 0;
        unit.mission = mission;
        unit.missionComplete = false;
        unit.order = { type: orderType };
        if (unit.branch === 'army' && waypoints.length === 1) {
            unit.routeRequestId = (unit.routeRequestId || 0) + 1;
            unit.routePending = true;
            void this.issueRoadRoute(unit, waypoints[0], mission, unit.routeRequestId);
            this.map.setUnitRoute?.(unit);
            return;
        }
        unit.route = waypoints.map(point => ({ ...point }));
        this.map.setUnitRoute?.(unit);
    }

    async issueRoadRoute(unit, destination, mission, requestId) {
        try {
            const route = await getRoadRoute(unit, destination);
            if (unit.routeRequestId !== requestId || !this.units.has(unit.id)) return;
            unit.route = route.map((point, index) => ({
                name: `ROAD ROUTE ${index + 1}`,
                ...point
            }));
            unit.route[unit.route.length - 1].name = destination.name || 'ROAD DESTINATION';
            unit.routePending = false;
            this.map.setUnitRoute?.(unit);
        } catch (error) {
            if (unit.routeRequestId === requestId) {
                unit.routePending = false;
                unit.order = { type: 'HOLD' };
                this.onMessage?.(`ROAD ROUTE UNAVAILABLE for ${unit.id}: ${error.message}`);
                console.error('[ROAD_ROUTE_ERROR]', error);
            }
        }
    }

    async issueGroundGroupRoute(units, destination, mission = { type: 'MOVE' }) {
        const group = units.filter(unit =>
            unit.branch === 'army' && this.units.has(unit.id)
        );
        if (group.length < 2) {
            if (group[0]) this.issueRoute(group[0], [destination], mission);
            return;
        }

        const leadUnit = group[0];
        const requestIds = new Map(group.map(unit => {
            unit.routeRequestId = (unit.routeRequestId || 0) + 1;
            unit.routePending = true;
            unit.mission = mission;
            unit.order = { type: mission.type || 'MOVE' };
            return [unit.id, unit.routeRequestId];
        }));
        this.map.setUnitRoute?.(leadUnit);
        try {
            const route = await getRoadRoute(leadUnit, destination);
            for (const unit of group) {
                if (unit.routeRequestId !== requestIds.get(unit.id) || !this.units.has(unit.id)) continue;
                unit.route = route.map((point, index) => ({
                    name: `GROUP ROAD ROUTE ${index + 1}`,
                    ...point
                }));
                unit.route[unit.route.length - 1].name = destination.name || 'GROUP ROAD DESTINATION';
                unit.routeIndex = 0;
                unit.routePending = false;
                this.map.setUnitRoute?.(unit);
            }
        } catch (error) {
            for (const unit of group) {
                if (unit.routeRequestId !== requestIds.get(unit.id)) continue;
                unit.routePending = false;
                unit.order = { type: 'HOLD' };
                this.onMessage?.(`ROAD ROUTE UNAVAILABLE for ${unit.id}: ${error.message}`);
            }
            console.error('[ROAD_ROUTE_ERROR]', error);
        }
    }

    update(gameSeconds) {
        if (gameSeconds <= 0) return;
        for (const unit of this.units.values()) {
            this.moveUnit(unit, gameSeconds);
        }
        this.updateRefueling(gameSeconds);
        this.combatElapsed += gameSeconds;
        this.simulationTime += gameSeconds;
        this.missionManager.advanceTime(this.simulationTime);
        if (this.combatElapsed >= 10) {
            this.combatElapsed %= 10;
            this.resolveAirCombat();
            this.resolveGroundCombat();
        }
    }

    getAirspaceControl() {
        const airfields = this.map.airfields;
        const units = [...this.units.values()].filter(unit =>
            ['airforce', 'army', 'navy', 'sam'].includes(unit.branch) &&
            ['blue', 'red'].includes(unit.side)
        );
        return Object.fromEntries(airfields.map(base => {
            const control = { blue: 0, red: 0 };
            for (const unit of units) {
                if (distanceKm(unit, base) > 52) continue;
                const weight = unit.branch === 'airforce'
                    ? (unit.mission?.type === 'EARLY_WARNING' ? 0.7 : 1)
                    : unit.branch === 'sam' ? 0.6
                        : unit.branch === 'army' ? 0.8 : 0.35;
                control[unit.side] += weight * (unit.condition || 0) / 100 *
                    Math.max(1, unit.formationSize || 1);
            }
            const total = control.blue + control.red;
            return [base.id, {
                blue: total ? control.blue / total * 100 : 50,
                red: total ? control.red / total * 100 : 50
            }];
        }));
    }

    getDetectionRangeKm(side) {
        const hasAWACS = [...this.units.values()].some(unit =>
            unit.side === side && unit.branch === 'airforce' &&
            unit.mission?.type === 'EARLY_WARNING' && unit.condition > 0
        );
        return hasAWACS ? 250 : 185.2;
    }

    returnToNearestBase(unit) {
        const bases = [
            ...this.map.airfields.filter(base =>
                base.id !== 'UGTB' && this.missionManager.getState(base.id).owner === unit.side
            ),
            ...Object.values(this.missionManager.mobileBases).filter(base => base.side === unit.side)
        ].sort((first, second) => distanceKm(unit, first) - distanceKm(unit, second));
        const base = bases[0];
        if (!base) return false;
        const mission = {
            ...unit.mission,
            returningFromMissionType: unit.mission?.type === 'RTB'
                ? unit.mission.returningFromMissionType
                : unit.mission?.type,
            type: 'RTB',
            recoveryAirfieldId: base.id
        };
        this.issueRoute(unit, [
            { name: 'RTB / APPROACH', lat: base.lat + 0.04, lng: base.lng + 0.04 },
            { name: 'LANDING', lat: base.lat, lng: base.lng }
        ], mission);
        unit.fuel = Math.max(unit.fuel || 0, 1);
        this.onMessage?.(`${unit.id} RTB // nearest friendly base ${base.name}.`);
        return true;
    }

    issueAirCommand(unit, command, target = null) {
        if (unit.branch !== 'airforce' || unit.side !== 'blue') return false;
        if (command === 'RTB') return this.returnToNearestBase(unit);
        if (command === 'REFUEL') return this.requestAirRefueling(unit);
        if (command !== 'ATTACK' || !target || target.side === unit.side) return false;
        const isAirfield = Boolean(this.missionManager.airfieldStates[target.id]);
        const missionType = target.branch === 'sam'
            ? 'SEAD'
            : target.branch === 'army'
                ? 'CAS'
                : target.branch === 'navy'
                    ? 'ANTI_SHIP'
                    : isAirfield ? 'STRIKE' : 'INTERCEPT';
        const aircraftType = this.missionManager.getAircraftType(unit.side, unit.aircraft);
        if (!aircraftType || !this.missionManager.getMissionTypes(aircraftType).includes(missionType)) {
            this.onMessage?.(`${unit.id} cannot perform ${missionType} with ${unit.aircraft}.`);
            return false;
        }
        const base = this.missionManager.getDeparture(unit.mission?.departureId);
        if (!base || !unit.mission?.launchRecord) {
            this.onMessage?.(`${unit.id} cannot accept a direct attack order without a recovery base assignment.`);
            return false;
        }
        const route = [{
            name: `${missionType} // ${target.name || target.id}`,
            lat: target.lat,
            lng: target.lng
        }, {
            name: 'RTB / APPROACH',
            lat: base.lat + 0.04,
            lng: base.lng + 0.04
        }, {
            name: 'LANDING',
            lat: base.lat,
            lng: base.lng
        }];
        this.issueRoute(unit, route, {
            ...unit.mission,
            type: missionType,
            targetId: target.id,
            targetName: target.name || target.id,
            targetLat: target.lat,
            targetLng: target.lng,
            weaponReleased: false,
            weaponLaunchesThisMission: false
        });
        this.onMessage?.(`${unit.id} direct attack order assigned against ${target.name || target.id}.`);
        return true;
    }

    setAircraftAltitude(unit, altitudeFt) {
        if (unit.branch !== 'airforce' || unit.side !== 'blue' || !Number.isFinite(altitudeFt)) return false;
        const type = this.missionManager.getAircraftType(unit.side, unit.aircraft);
        if (!type?.altitude) return false;
        unit.desiredAltitudeFt = Math.max(type.altitude.min, Math.min(type.altitude.max, altitudeFt));
        this.onMessage?.(`${unit.id} altitude command // ${Math.round(unit.desiredAltitudeFt).toLocaleString()} ft.`);
        return true;
    }

    issueAirRoute(unit, waypoint) {
        if (unit.branch !== 'airforce' || unit.side !== 'blue' || !unit.mission?.departureId ||
            !Number.isFinite(waypoint.lat) || !Number.isFinite(waypoint.lng) ||
            ['TANKER', 'EARLY_WARNING', 'RTB', 'AAR_RENDEZVOUS'].includes(unit.mission.type)) return false;
        const base = this.missionManager.getDeparture(
            unit.mission.recoveryAirfieldId || unit.mission.departureId
        );
        if (!base) return false;
        const route = [
            { name: waypoint.name || 'PLAYER ROUTE WAYPOINT', lat: waypoint.lat, lng: waypoint.lng, alt: unit.desiredAltitudeFt || unit.currentAltitudeFt },
            { name: 'RTB / APPROACH', lat: base.lat + 0.04, lng: base.lng + 0.04, alt: 3000 },
            { name: 'LANDING', lat: base.lat, lng: base.lng, alt: 0 }
        ];
        const routeKm = route.reduce((distance, point, index) =>
            distance + distanceKm(index ? route[index - 1] : unit, point), 0);
        this.issueRoute(unit, route, { ...unit.mission, routeKm });
        this.onMessage?.(`${unit.id} route updated // waypoint then RTB to ${base.name}.`);
        return true;
    }

    requestAirRefueling(unit) {
        if (unit.branch !== 'airforce' || unit.side !== 'blue' ||
            unit.mission?.type === 'TANKER' || unit.refuelingPlan) return false;
        const tanker = [...this.units.values()].filter(candidate =>
            candidate.branch === 'airforce' && candidate.side === unit.side &&
            candidate.mission?.type === 'TANKER' && candidate.fuel > 5
        ).sort((first, second) => distanceKm(unit, first) - distanceKm(unit, second))[0];
        if (!tanker) {
            if (this.simulationTime - (unit.lastRefuelRequestAt || -Infinity) >= 30) {
                unit.lastRefuelRequestAt = this.simulationTime;
                this.onMessage?.('AAR REQUEST DENIED // No available friendly tanker is airborne.');
            }
            return false;
        }
        unit.lastRefuelRequestAt = this.simulationTime;
        unit.refuelingPlan = {
            mission: unit.mission ? { ...unit.mission } : null,
            order: unit.order ? { ...unit.order } : null,
            route: unit.route.map(point => ({ ...point })),
            routeIndex: unit.routeIndex
        };
        this.issueRoute(unit, [{
            name: `AAR RENDEZVOUS // ${tanker.id}`,
            lat: tanker.lat,
            lng: tanker.lng
        }], { type: 'AAR_RENDEZVOUS', tankerId: tanker.id });
        this.onMessage?.(`${unit.id} AAR requested // rendezvous with ${tanker.id}.`);
        return true;
    }

    updateRefueling(gameSeconds) {
        for (const unit of this.units.values()) {
            if (!unit.refuelingPlan) continue;
            const tanker = this.units.get(unit.mission?.tankerId);
            if (!tanker || tanker.mission?.type !== 'TANKER' || tanker.fuel <= 1) {
                unit.refuelingPlan = null;
                this.onMessage?.(`${unit.id} AAR aborted // tanker unavailable.`);
                if (!this.returnToNearestBase(unit)) this.sendAircraftHome(unit);
                continue;
            }
            if (distanceKm(unit, tanker) > 3) continue;
            const transfer = Math.min(5 * gameSeconds, 100 - unit.fuel, tanker.fuel);
            if (transfer <= 0) continue;
            unit.fuel += transfer;
            tanker.fuel -= transfer;
            if (unit.fuel >= 99 || tanker.fuel <= 1) {
                const plan = unit.refuelingPlan;
                unit.refuelingPlan = null;
                unit.fuel = Math.min(100, unit.fuel);
                unit.mission = plan.mission;
                unit.order = plan.order;
                unit.route = plan.route;
                unit.routeIndex = plan.routeIndex;
                this.map.setUnitRoute?.(unit);
                this.onMessage?.(`${unit.id} AAR complete // fuel ${Math.round(unit.fuel)}%.`);
            }
        }
    }

    resolveCAS(unit) {
        const targets = [...this.units.values()].filter(target =>
            target.branch === 'army' && target.side !== unit.side &&
            distanceKm(target, unit) <= 8 && target.condition > 0
        );
        for (const target of targets) {
            target.condition = Math.max(0, target.condition - (20 + Math.random() * 15));
            if (target.condition <= 0) this.destroyUnit(target);
        }
        const signal = [...this.units.values()].find(target =>
            target.casSignalId === unit.mission.signalId
        );
        if (signal) {
            signal.casSignalId = null;
            this.map.removeSignal?.(unit.mission.targetId);
        }
        this.missionManager.scores[unit.side].missionValue += targets.length * 50;
        this.onMessage?.(`CAS COMPLETE // ${unit.id} supported ${targets.length} opposing ground unit(s); package remains under survival-first rules.`);
    }

    acquireCAPContacts() {
        const patrols = [...this.units.values()].filter(unit =>
            unit.branch === 'airforce' && unit.side &&
            ['CAP', 'SWEEP_CAP'].includes(unit.mission?.type) &&
            !unit.capEngagedTargetId && unit.route[unit.routeIndex]
        );
        for (const patrol of patrols) {
            const waypoint = patrol.route[patrol.routeIndex];
            const direction = {
                lat: waypoint.lat - patrol.lat,
                lng: (waypoint.lng - patrol.lng) * Math.cos(patrol.lat * Math.PI / 180)
            };
            const directionLength = Math.hypot(direction.lat, direction.lng);
            if (!directionLength) continue;
            const detectionRange = this.getDetectionRangeKm(patrol.side);
            const target = [...this.units.values()].find(candidate => {
                if (candidate.branch !== 'airforce' || candidate.side === patrol.side ||
                    !candidate.mission || candidate.mission.type === 'EARLY_WARNING') return false;
                const distance = distanceKm(patrol, candidate);
                if (distance > detectionRange || distance < 1) return false;
                const bearing = {
                    lat: candidate.lat - patrol.lat,
                    lng: (candidate.lng - patrol.lng) * Math.cos(patrol.lat * Math.PI / 180)
                };
                const bearingLength = Math.hypot(bearing.lat, bearing.lng);
                const cosine = (direction.lat * bearing.lat + direction.lng * bearing.lng) /
                    (directionLength * bearingLength);
                return cosine >= Math.cos(40 * Math.PI / 180);
            });
            if (!target) continue;
            patrol.capRouteBackup = patrol.route;
            patrol.capEngagedTargetId = target.id;
            patrol.route = [{
                name: `CAP CONTACT // ${target.id}`,
                ...getStandoffPoint(patrol, target)
            }];
            patrol.routeIndex = 0;
            this.map.setUnitRoute?.(patrol);
            this.onMessage?.(`${patrol.id} CAP CONTACT // threat detected with friendly ${patrol.side.toUpperCase()} surveillance support.`);
        }
    }

    moveUnit(unit, gameSeconds) {
        if (['missile', 'munition'].includes(unit.branch)) {
            const target = this.units.get(unit.targetUnitId);
            if (target && unit.route[unit.routeIndex]) {
                unit.route[unit.routeIndex].lat = target.lat;
                unit.route[unit.routeIndex].lng = target.lng;
            }
        }
        if (unit.mission?.type === 'AAR_RENDEZVOUS' && unit.route[unit.routeIndex]) {
            const tanker = this.units.get(unit.mission.tankerId);
            if (tanker) {
                unit.route[unit.routeIndex].lat = tanker.lat;
                unit.route[unit.routeIndex].lng = tanker.lng;
            }
        }
        if (unit.capEngagedTargetId && unit.route[unit.routeIndex]) {
            const target = this.units.get(unit.capEngagedTargetId);
            if (target) {
                Object.assign(unit.route[unit.routeIndex], getStandoffPoint(unit, target));
            } else {
                unit.capEngagedTargetId = null;
                if (unit.capRouteBackup) {
                    unit.route = unit.capRouteBackup;
                    unit.routeIndex = 0;
                    unit.capRouteBackup = null;
                }
            }
        }
        if (unit.branch === 'airforce' && unit.mission?.departureId) {
            const departure = this.missionManager.getDeparture(unit.mission.departureId);
            if (departure?.category === 'CARRIER' && unit.route.length >= 2) {
                const approach = unit.route[unit.route.length - 2];
                const landing = unit.route[unit.route.length - 1];
                approach.lat = departure.lat + 0.04;
                approach.lng = departure.lng + 0.04;
                landing.lat = departure.lat;
                landing.lng = departure.lng;
            }
        }
        const speedKmh = unit.branch === 'airforce'
            ? (unit.speed?.cruise || 250) * 1.852
            : unit.speed?.maxKmh || (unit.speed?.max || 90) * 1.852;
        const variability = 0.97 + Math.random() * 0.06;
        let travelKm = speedKmh * variability * gameSeconds / 3600;
        const distanceTravelled = travelKm;

        while (travelKm > 0 && unit.routeIndex < unit.route.length) {
            const waypoint = unit.route[unit.routeIndex];
            if (unit.branch === 'airforce') {
                const targetAltitude = unit.desiredAltitudeFt ?? waypoint.alt ?? unit.currentAltitudeFt ?? 0;
                const altitudeChange = Math.max(-60, Math.min(60, targetAltitude - (unit.currentAltitudeFt || 0))) *
                    gameSeconds;
                unit.currentAltitudeFt = Math.max(0, (unit.currentAltitudeFt || 0) + altitudeChange);
            }
            const remainingKm = distanceKm(unit, waypoint);
            if (remainingKm <= travelKm || remainingKm < 0.02) {
                unit.lat = waypoint.lat;
                unit.lng = waypoint.lng;
                travelKm -= remainingKm;
                unit.routeIndex++;
                if (unit.mission && ['LOGISTICS', 'TROOP_TRANSPORT'].includes(unit.mission.type) &&
                    !unit.mission.cargoDelivered &&
                    waypoint.name.startsWith(`${unit.mission.type} //`)) {
                    this.deliverMissionCargo(unit);
                }
                if (unit.mission?.type === 'CSAR' && waypoint.name.startsWith('CSAR //')) {
                    this.claimSurvivor(this.units.get(unit.mission.targetId), unit);
                }
                if (unit.mission?.type === 'CAS' && waypoint.name.startsWith('CAS //')) {
                    this.resolveCAS(unit);
                }
                if (unit.branch === 'airforce' &&
                    ['STRIKE', 'ANTI_SHIP', 'SEAD'].includes(unit.mission?.type) &&
                    waypoint.name.startsWith(`${unit.mission.type} //`)) {
                    this.launchStrikeMunition(unit, waypoint);
                }
                continue;
            }

            const fraction = travelKm / remainingKm;
            unit.lat += (waypoint.lat - unit.lat) * fraction;
            unit.lng += (waypoint.lng - unit.lng) * fraction;
            travelKm = 0;
        }

        unit.marker.setLatLng([unit.lat, unit.lng]);
        if (unit.casSignalId) this.map.moveSignal?.(unit.casSignalId, unit.lat, unit.lng);
        this.map.setUnitRoute?.(unit);
        if (unit.category === 'CARRIER') this.missionManager.registerMobileBase(unit);
        if (unit.branch === 'airforce' && unit.mission && unit.mission.routeKm > 0 &&
            !['TANKER', 'AAR_RENDEZVOUS'].includes(unit.mission.type)) {
            unit.fuel = Math.max(0, unit.fuel - distanceTravelled / unit.mission.routeKm * 100);
            if (unit.fuel <= 20 && unit.mission.departureId &&
                !['RTB', 'AAR_RENDEZVOUS'].includes(unit.mission.type)) {
                if (!this.requestAirRefueling(unit) && unit.fuel <= 10) this.sendAircraftHome(unit);
            }
        }

        if (unit.routeIndex >= unit.route.length && unit.route.length > 0) {
            if (['EARLY_WARNING', 'TANKER'].includes(unit.mission?.type)) {
                unit.routeIndex = 1;
                this.map.setUnitRoute?.(unit);
                return;
            }
            if (unit.mission?.type === 'AAR_RENDEZVOUS' && unit.refuelingPlan) {
                unit.route = [];
                unit.routeIndex = 0;
                this.map.removeUnitRoute?.(unit.id);
                return;
            }
            unit.route = [];
            unit.routeIndex = 0;
            if (unit.branch === 'missile' || unit.branch === 'munition') {
                this.resolveMissileImpact(unit);
                return;
            }
            this.completeMission(unit);
            this.map.removeUnitRoute?.(unit.id);
        }
    }

    completeMission(unit) {
        const mission = unit.mission;
        if (!mission || unit.missionComplete) return;
        unit.missionComplete = true;

        if (mission.type === 'TRANSPORT' && mission.departureId && mission.launchRecord) {
            const result = this.missionManager.transferAircraft(
                mission.departureId,
                mission.targetId,
                mission.launchRecord
            );
            if (!result.success) {
                this.onMessage?.(`TRANSPORT ABORTED // ${result.message}`);
                unit.missionComplete = false;
                this.returnToNearestBase(unit);
                return;
            }
            this.onMessage?.(`${unit.aircraft} transferred to ${mission.targetName}; maintenance cycle started.`);
            this.map.removeUnitRoute?.(unit.id);
            unit.marker.remove();
            this.units.delete(unit.id);
            this.onPackageComplete?.(unit);
            return;
        }

        if (['LOGISTICS', 'TROOP_TRANSPORT'].includes(mission.type) && !mission.cargoDelivered) {
            this.deliverMissionCargo(unit);
        } else if (mission.type === 'INTERCEPT') {
            this.onMessage?.(`${unit.id}: returned after completing its intercept route.`);
        } else if (mission.type === 'CSAR') {
            this.claimSurvivor(this.units.get(mission.targetId), unit);
        } else if (mission.type === 'SEAD') {
            const target = this.units.get(mission.targetId);
            if (target?.branch === 'sam') {
                target.condition = 0;
                target.operational = false;
                target.ammo = 0;
                this.onMessage?.(`${target.system} at ${target.name} disabled. Repair requires spare parts and credits.`);
            }
        } else if (mission.type === 'AI') {
            this.onMessage?.(`${unit.side.toUpperCase()} AI package completed its assigned route.`);
        }
        if (mission.departureId && mission.launchRecord) {
            this.map.removeUnitRoute?.(unit.id);
            const recoveryId = mission.recoveryAirfieldId || mission.departureId;
            this.missionManager.recoverAircraft(recoveryId, mission.launchRecord);
            this.onPackageComplete?.(unit);
            unit.marker.remove();
            this.units.delete(unit.id);
            return;
        }

        unit.mission = null;
        if (unit.order?.type === 'GROUND_ASSAULT' && mission.targetId) {
            const target = mission.targetKind === 'FOB'
                ? FORWARD_BASES.find(base => base.id === mission.targetId)
                : this.missionManager.getDeparture(mission.targetId);
            const defendersNearby = [...this.units.values()].some(force =>
                force.branch === 'army' && force.side !== unit.side &&
                distanceKm(force, target || unit) <= 8
            );
            if (target && !defendersNearby) {
                if (mission.targetKind === 'FOB') {
                    const state = this.missionManager.getForwardBaseState(mission.targetId);
                    const newlyCaptured = state.owner !== unit.side;
                    this.missionManager.captureForwardBase(mission.targetId, unit.side);
                    this.map.setForwardBaseOwners?.(this.missionManager.forwardBaseStates);
                    unit.fobId = mission.targetId;
                    if (newlyCaptured) {
                        this.onMessage?.(`${unit.side.toUpperCase()} ground force captured ${mission.targetName || mission.targetId}.`);
                    }
                } else {
                    const state = this.missionManager.getState(mission.targetId);
                    if (state.owner !== unit.side) {
                        this.missionManager.captureAirfield(mission.targetId, unit.side);
                        this.map.setAirfieldOwners(this.missionManager.airfieldStates);
                        this.onMessage?.(`${unit.side.toUpperCase()} ground force captured ${mission.targetName || mission.targetId}.`);
                    }
                }
            } else if (target) {
                this.onMessage?.(`${unit.id} reached ${mission.targetName || mission.targetId}; opposing defenders prevent capture.`);
            }
        }
        if (unit.order?.type === 'AI_ADVANCE' && mission.targetId) {
            this.missionManager.captureAirfield(mission.targetId, unit.side);
            this.map.setAirfieldOwners(this.missionManager.airfieldStates);
            this.onMessage?.(`${unit.side.toUpperCase()} forces captured ${mission.targetId}.`);
        }
        if (unit.order?.type === 'MOVE') unit.order = { type: 'HOLD' };
        if (unit.order?.type === 'RETREAT') unit.order = { type: 'HOLD' };
    }

    deliverMissionCargo(unit) {
        const mission = unit.mission;
        if (!mission || mission.cargoDelivered) return;
        if (mission.type === 'LOGISTICS') {
            const delivered = this.missionManager.deliverSupplies(mission.targetId, mission.cargo, unit.side);
            this.onMessage?.(`LOGISTICS ARRIVED: ${delivered.supplies} supplies / ${delivered.fuel} fuel delivered to ${delivered.name}.`);
        } else if (mission.type === 'TROOP_TRANSPORT') {
            const delivered = this.missionManager.deliverTroops(mission.targetId, mission.cargo, unit.side);
            const forwardBase = FORWARD_BASES.find(base => base.id === mission.targetId);
            if (forwardBase && delivered.personnel > 0) {
                const stock = this.missionManager.getForwardBaseState(forwardBase.id).stockBySide[unit.side];
                stock.personnel = Math.max(0, stock.personnel - delivered.personnel);
                this.deploy({
                    id: `${unit.side.toUpperCase()}-AIR-INSERTION-${String(this.nextUnitNumber++).padStart(3, '0')}`,
                    name: `${forwardBase.name} Air Assault`,
                    typeId: 'AIR_ASSAULT',
                    branch: 'army',
                    side: unit.side,
                    lat: forwardBase.lat,
                    lng: forwardBase.lng,
                    fobId: forwardBase.id,
                    personnelStrength: delivered.personnel,
                    vehicleStrength: 0,
                    vehicleManifest: { tanks: 0, infantryCarriers: 0, selfPropelledArtillery: 0, supportVehicles: 0 },
                    speed: { maxKmh: 35 },
                    condition: 100,
                    ammo: 4
                });
            }
            this.onMessage?.(`TROOP TRANSPORT ARRIVED: ${delivered.personnel} personnel delivered to ${delivered.name}.`);
        }
        mission.cargoDelivered = true;
    }

    addAirPackage(packageData) {
        const missionType = packageData.missionType || packageData.type;
        const id = `${packageData.side.toUpperCase()}-${missionType}-${String(this.nextUnitNumber++).padStart(3, '0')}`;
        const unit = this.deploy({
            ...packageData.unitType,
            id,
            side: packageData.side,
            branch: 'airforce',
            aircraft: packageData.aircraft,
            lat: packageData.departure.lat,
            lng: packageData.departure.lng,
            speed: { ...packageData.unitType.speed },
            formationSize: packageData.count
        });
        this.issueRoute(unit, packageData.route, {
            type: missionType,
            targetId: packageData.target.id,
            cargo: packageData.cargo,
            count: packageData.count,
            departureId: packageData.departure.id,
            targetAirfieldId: this.missionManager.airfieldStates[packageData.target.id]
                ? packageData.target.id
                : null,
            targetName: packageData.target.name,
            targetLat: packageData.target.lat,
            targetLng: packageData.target.lng,
            signalUnitId: packageData.signalUnitId,
            signalId: packageData.signalId,
            launchRecord: packageData.launchRecord,
            routeKm: packageData.routeKm
        });
        unit.fuel = 100;
        unit.currentAltitudeFt = packageData.route[0]?.alt ?? packageData.unitType.altitude?.cruise ?? 0;
        unit.ammo = Math.max(2, packageData.count * 4);
        unit.countermeasures = packageData.countermeasures || { chaff: 4, flares: 4 };
        unit.cost = packageData.cost;
        return unit;
    }

    getEnemyAirPackages(side) {
        return [...this.units.values()].filter(unit =>
            unit.branch === 'airforce' && unit.mission?.type !== 'EARLY_WARNING' &&
            unit.side !== side && unit.mission && unit.route.length > 0
        );
    }

    resolveAirCombat() {
        this.resolveSAMThreats();
        this.resolveMissiles();
        this.acquireCAPContacts();
        const aircraft = [...this.units.values()].filter(unit =>
            unit.branch === 'airforce' && unit.mission && unit.route.length &&
            ['CAP', 'SWEEP_CAP', 'ESCORT', 'LOGISTICS_ESCORT', 'INTERCEPT'].includes(unit.mission.type) &&
            unit.ammo > 0 && unit.condition > 0
        );
        for (let index = 0; index < aircraft.length; index++) {
            const first = aircraft[index];
            const second = aircraft.slice(index + 1).find(unit =>
                unit.side !== first.side &&
                distanceKm(first, unit) <= AIR_ENGAGEMENT_MAX_GAME_KM
            );
            if (!second || first.nextEngagementAt > this.simulationTime ||
                second.nextEngagementAt > this.simulationTime) continue;
            first.nextEngagementAt = this.simulationTime + 90 + Math.random() * 60;
            second.nextEngagementAt = this.simulationTime + 90 + Math.random() * 60;
            const separation = distanceKm(first, second);
            if (separation < AIR_ENGAGEMENT_MIN_GAME_KM) {
                this.sendAircraftHome(first);
                this.sendAircraftHome(second);
                this.onMessage?.('AIR PATROL: close-contact limit reached; both packages disengaged.');
                break;
            }
            const firstType = this.missionManager.getAircraftType(first.side, first.aircraft);
            const secondType = this.missionManager.getAircraftType(second.side, second.aircraft);
            const firstRating = firstType?.combatRating?.air || 1;
            const secondRating = secondType?.combatRating?.air || 1;
            const firstDisengages = this.hasDisengagedAdvantage(first, second, firstRating, secondRating);
            const secondDisengages = this.hasDisengagedAdvantage(second, first, secondRating, firstRating);
            if (firstDisengages || secondDisengages) {
                this.sendAircraftHome(first);
                this.sendAircraftHome(second);
                this.onMessage?.('AIR PATROL: survival-first doctrine // both packages broke contact.');
                continue;
            }
            const firstAdvantage = this.getAirCombatAdvantage(first, second, firstRating, secondRating);
            const secondAdvantage = this.getAirCombatAdvantage(second, first, secondRating, firstRating);
            const shooter = firstAdvantage >= secondAdvantage ? first : second;
            const target = shooter === first ? second : first;
            const rating = shooter === first ? firstRating : secondRating;
            this.launchAirMissile(shooter, target, rating, Math.max(firstAdvantage, secondAdvantage));
            this.sendAircraftHome(first);
            this.sendAircraftHome(second);
            this.onMessage?.('AIR PATROL: one simulated shot, then immediate disengagement.');
            break;
        }
    }

    hasDisengagedAdvantage(unit, opponent, rating, opponentRating) {
        const nearbyFriendly = [...this.units.values()].filter(candidate =>
            candidate.branch === 'airforce' && candidate.side === unit.side &&
            distanceKm(candidate, unit) <= 50
        ).reduce((count, candidate) => count + (candidate.formationSize || 1), 0);
        const nearbyOpponents = [...this.units.values()].filter(candidate =>
            candidate.branch === 'airforce' && candidate.side !== unit.side &&
            distanceKm(candidate, unit) <= 50
        ).reduce((count, candidate) => count + (candidate.formationSize || 1), 0);
        const outnumbered = nearbyOpponents > nearbyFriendly;
        const outclassed = opponentRating > rating * (1.2 + Math.random() * 0.15);
        const lowResources = unit.fuel <= 20 || unit.ammo <= 1 || unit.condition <= 45;
        return lowResources || outnumbered || outclassed;
    }

    getAirCombatAdvantage(source, target, rating, opponentRating) {
        const platformQuality = Math.max(-1, Math.min(1, rating - opponentRating));
        const altitudeAdvantage = ((source.currentAltitudeFt || 0) - (target.currentAltitudeFt || 0)) / 20000;
        const energyAdvantage = ((source.energyBand || 0) - (target.energyBand || 0)) * 0.08;
        return Math.max(0, Math.min(1,
            0.5 + platformQuality * 0.12 + altitudeAdvantage * 0.14 + energyAdvantage
        ));
    }

    launchAirMissile(source, target, rating, advantage) {
        const activeMissiles = [...this.units.values()].filter(unit => unit.branch === 'missile');
        if (activeMissiles.length >= 6 || activeMissiles.filter(unit => unit.side === source.side).length >= 3 ||
            source.ammo <= 0 || source.nextShotAt > this.simulationTime ||
            source.mission?.weaponLaunchesThisMission) return;
        source.ammo--;
        source.mission.weaponLaunchesThisMission = true;
        source.nextShotAt = this.simulationTime + 15 + Math.random() * 25;
        this.onMessage?.(`RWR: ${target.id} // opposing patrol acquired; evasive action and countermeasures available.`);
        this.playRWRAlert();
        const avoided = this.deployCountermeasure(target, 'chaff', 0.32);
        this.deploy({
            id: `AAM-${String(this.nextUnitNumber++).padStart(3, '0')}`,
            name: 'Air-to-air missile',
            side: source.side,
            branch: 'missile',
            missileType: 'AIR INTERCEPTOR',
            targetUnitId: target.id,
            sourceUnitId: source.id,
            lat: source.lat,
            lng: source.lng,
            speed: { maxKmh: 900 + Math.random() * 200 },
            condition: 100,
            fuel: 1,
            ammo: 0,
            impactChance: Math.max(0.08, Math.min(0.68, 0.08 + advantage * 0.52 + rating * 0.04)) *
                (avoided ? 0.35 : 1),
            route: [{
                name: `INTERCEPT // ${target.id}`,
                lat: target.lat,
                lng: target.lng
            }]
        });
        this.onMessage?.(`${source.id} launched a simulated interceptor toward ${target.id}.`);
    }

    resolveSAMThreats() {
        const batteries = [...this.units.values()].filter(unit =>
            unit.branch === 'sam' && unit.operational && unit.ammo > 0
        );
        for (const battery of batteries) {
            const owner = this.missionManager.getState(battery.baseId).owner;
            if (!['blue', 'red'].includes(owner)) continue;
            battery.side = owner;
            battery.engagements ||= {};
            for (const targetId of Object.keys(battery.engagements)) {
                if (!this.units.has(targetId)) delete battery.engagements[targetId];
            }
            const target = [...this.units.values()].find(unit =>
                unit.branch === 'airforce' && unit.mission?.type !== 'EARLY_WARNING' &&
                unit.side !== owner && unit.mission &&
                distanceKm(unit, battery) <= battery.engagementRangeKm &&
                !battery.engagements[unit.id]?.resolved &&
                (!battery.engagements[unit.id] ||
                    battery.engagements[unit.id].missilesInSalvo < 3 ||
                    (battery.engagements[unit.id].pending === 0 &&
                        battery.engagements[unit.id].misses === 3)) &&
                battery.nextShotAt <= this.simulationTime
            );
            if (!target) continue;
            const engagement = battery.engagements[target.id] ||= {
                missilesInSalvo: 0,
                pending: 0,
                misses: 0,
                resolved: false
            };
            if (engagement.missilesInSalvo === 3 &&
                engagement.pending === 0 && engagement.misses === 3) {
                engagement.missilesInSalvo = 0;
                engagement.misses = 0;
                this.onMessage?.(`${battery.system} // all three interceptors missed ${target.id}; authorizing a new salvo.`);
            }
            battery.nextShotAt = this.simulationTime + 4 + Math.random() * 2;
            battery.ammo--;
            engagement.missilesInSalvo++;
            engagement.pending++;
            target.rwrStatus = `${battery.system} TRACK`;
            this.onMessage?.(`RWR: ${target.id} // simulated air-defense tracking warning.`);
            this.playRWRAlert();
            const countered = this.deployCountermeasure(target, 'chaff', 0.45);
            const missile = this.deploy({
                id: `SAM-MSL-${String(this.nextUnitNumber++).padStart(3, '0')}`,
                name: `${battery.system} interceptor`,
                side: battery.side,
                branch: 'missile',
                missileType: 'AIR DEFENSE INTERCEPTOR',
                targetUnitId: target.id,
                sourceUnitId: battery.id,
                samTargetId: target.id,
                lat: battery.lat,
                lng: battery.lng,
                speed: { maxKmh: 750 + Math.random() * 150 },
                condition: 100,
                fuel: 1,
                ammo: 0,
                impactChance: Math.min(0.9, (countered ? 0.55 : 0.78) + Math.random() * 0.1),
                route: [{ name: `INTERCEPT // ${target.id}`, lat: target.lat, lng: target.lng }]
            });
        }
    }

    deployCountermeasure(unit, type, effectiveness) {
        unit.countermeasures ||= { chaff: 4, flares: 4 };
        if (unit.countermeasures[type] <= 0) return false;
        unit.countermeasures[type]--;
        unit.evasiveUntil = this.simulationTime + 8 + Math.random() * 8;
        unit.evasiveMode = Math.random() < 0.5 ? 'BREAK CONTACT' : 'DISPLACE';
        this.onMessage?.(`${unit.id} RWR // ${unit.evasiveMode}; ${type.toUpperCase()} dispensed (${unit.countermeasures[type]} remaining).`);
        return Math.random() < effectiveness;
    }

    resolveMissiles() {
        for (const missile of [...this.units.values()].filter(unit =>
            unit.branch === 'missile' || unit.branch === 'munition'
        )) {
            const target = this.units.get(missile.targetUnitId);
            if (!missile.targetAirfieldId && (!target || !['airforce', 'navy', 'sam'].includes(target.branch))) {
                this.destroyMissile(missile);
                continue;
            }
            if (target && distanceKm(missile, target) < 2) this.resolveMissileImpact(missile);
        }
    }

    resolveMissileImpact(missile) {
        const target = this.units.get(missile.targetUnitId);
        if (target && ['airforce', 'navy'].includes(target.branch)) {
            const hit = Math.random() < (missile.impactChance || 0.4);
            if (hit) {
                target.condition = Math.max(0, target.condition - (missile.branch === 'munition'
                    ? 35 + Math.random() * 45
                    : 20 + Math.random() * 30));
                this.onMessage?.(`${missile.id} impact // ${target.id} condition ${Math.round(target.condition)}%.`);
                this.recordSAMInterceptorOutcome(missile, true);
                if (target.condition <= 0) this.destroyUnit(target);
                else if (target.branch === 'airforce' && (target.condition <= 45 || target.ammo <= 1)) {
                    this.sendAircraftHome(target);
                }
            } else {
                this.onMessage?.(`${missile.id} missed ${target.id}; contact broken.`);
                this.recordSAMInterceptorOutcome(missile, false);
            }
        } else if (target?.branch === 'sam') {
            target.condition = 0;
            target.operational = false;
            target.ammo = 0;
            this.onMessage?.(`${target.system} at ${target.name} destroyed. Repair requires spare parts and credits.`);
        } else if (missile.targetAirfieldId) {
            const state = this.missionManager.getState(missile.targetAirfieldId);
            const hit = Math.random() < (missile.impactChance || 0.4);
            if (hit) {
                state.strikeDamage = Math.min(1, (state.strikeDamage || 0) + 0.2 + Math.random() * 0.15);
                this.missionManager.scores[missile.side].missionValue += 150;
                this.onMessage?.(`STRIKE: simulated ordnance impacted ${missile.targetName || missile.targetAirfieldId}.`);
            } else {
                this.onMessage?.(`STRIKE: simulated ordnance missed ${missile.targetName || missile.targetAirfieldId}.`);
            }
        }
        this.destroyMissile(missile);
    }

    launchStrikeMunition(source, waypoint) {
        if (source.mission.weaponReleased) return;
        const target = this.units.get(source.mission.targetId);
        const targetAirfieldId = source.mission.targetAirfieldId ||
            (this.missionManager.airfieldStates[source.mission.targetId] ? source.mission.targetId : null);
        const destination = target
            ? { lat: target.lat, lng: target.lng }
            : {
                lat: source.mission.targetLat ?? waypoint.lat,
                lng: source.mission.targetLng ?? waypoint.lng
            };
        source.mission.weaponReleased = true;
        const targetIsShip = target?.branch === 'navy';
        const munition = this.deploy({
            id: `MUN-${String(this.nextUnitNumber++).padStart(3, '0')}`,
            name: 'SIMULATED STRIKE ORDNANCE',
            side: source.side,
            branch: 'munition',
            munitionType: targetIsShip ? 'SIMULATED GUIDED' : 'SIMULATED BOMB',
            targetUnitId: target?.id || null,
            targetAirfieldId: target ? null : targetAirfieldId,
            lat: source.lat,
            lng: source.lng,
            speed: { maxKmh: 900 + Math.random() * 200 },
            impactChance: 0.45 + Math.random() * 0.25,
            route: [{ ...destination, name: 'SIMULATED WEAPON IMPACT' }]
        });
        this.map.setUnitRoute?.(munition);
    }

    destroyMissile(missile) {
        missile.marker.remove();
        this.units.delete(missile.id);
        this.map.removeUnitRoute?.(missile.id);
    }

    recordSAMInterceptorOutcome(missile, hit) {
        if (!missile.samTargetId || !missile.sourceUnitId) return;
        const battery = this.units.get(missile.sourceUnitId);
        const engagement = battery?.engagements?.[missile.samTargetId];
        if (!engagement) return;
        engagement.pending = Math.max(0, engagement.pending - 1);
        if (hit) {
            engagement.resolved = true;
            return;
        }
        engagement.misses++;
        if (engagement.missilesInSalvo === 3 &&
            engagement.pending === 0 && engagement.misses === 3) {
            this.onMessage?.(`${battery.system} // three interceptors evaded by ${missile.samTargetId}; re-engagement permitted.`);
        }
    }

    repairSAM(site) {
        const result = this.missionManager.repairSAM(site, 'blue');
        if (result.success) this.onMessage?.(`${site.name} repaired and returned to service.`);
        return result;
    }

    resolveGroundCombat() {
        const forces = [...this.units.values()].filter(unit => unit.branch === 'army' && unit.condition > 0);
        for (let index = 0; index < forces.length; index++) {
            const first = forces[index];
            const second = forces.slice(index + 1).find(unit =>
                unit.side !== first.side && distanceKm(first, unit) <= 8
            );
            if (!second || first.lastGroundCombatAt === this.simulationTime || second.lastGroundCombatAt === this.simulationTime) continue;
            first.lastGroundCombatAt = this.simulationTime;
            second.lastGroundCombatAt = this.simulationTime;
            for (const force of [first, second]) {
                if (force.side === 'blue' && force.jtac && !force.casSignalId) {
                    force.casSignalId = `CAS-${force.id}-${Math.floor(this.simulationTime)}`;
                    this.map.addSignal?.({
                        id: force.casSignalId,
                        type: 'CAS',
                        lat: force.lat,
                        lng: force.lng,
                        unitId: force.id,
                        jtacCallsign: force.jtac.callsign,
                        side: force.side
                    });
                    this.onMessage?.(`JTAC ${force.jtac.callsign} // CAS REQUEST: ${force.id} is engaged. Tap the signal to dispatch support.`);
                }
            }
            first.condition = Math.max(0, first.condition - (8 + Math.random() * 10));
            second.condition = Math.max(0, second.condition - (8 + Math.random() * 10));
            this.onMessage?.(`GROUND CONTACT: ${first.name} and ${second.name} exchanging fire.`);
            for (const unit of [first, second]) {
                if (unit.condition <= 0) this.destroyUnit(unit);
                else if (unit.condition < 35 && unit.branch === 'army') this.retreatGroundForce(unit);
            }
        }
    }

    retreatGroundForce(unit) {
        const friendlyBase = this.map.airfields
            .filter(base => this.missionManager.getState(base.id).owner === unit.side)
            .sort((first, second) => distanceKm(unit, first) - distanceKm(unit, second))[0];
        if (!friendlyBase) {
            unit.order = { type: 'RETREAT' };
            return;
        }
        this.issueRoute(unit, [{
            name: 'COMBAT WITHDRAWAL',
            lat: friendlyBase.lat,
            lng: friendlyBase.lng
        }], { type: 'RETREAT', targetId: friendlyBase.id });
        this.onMessage?.(`${unit.id} is withdrawing to ${friendlyBase.name} after heavy losses.`);
    }

    sendAircraftHome(unit) {
        if (!unit.mission || unit.mission.type === 'RTB') return;
        this.returnToNearestBase(unit);
    }

    destroyUnit(unit) {
        if (!this.units.has(unit.id)) return;
        unit.marker.remove();
        this.map.removeUnitRoute?.(unit.id);
        this.units.delete(unit.id);
        if (unit.branch === 'airforce') {
            if (unit.mission?.departureId) {
                this.missionManager.loseAircraft(unit.mission.departureId, {
                    ...unit.mission.launchRecord,
                    count: unit.formationSize || 1
                });
            }
            this.missionManager.scores[unit.side].losses++;
            this.spawnSurvivor(unit, 'PILOT');
        } else if (unit.branch === 'army') {
            this.missionManager.scores[unit.side].losses++;
            this.spawnSurvivor(unit, 'SOLDIER');
        }
        this.onMessage?.(`${unit.id} destroyed / combat ineffective.`);
    }

    spawnSurvivor(unit, survivorType) {
        if (Math.random() > 0.2) return null;
        const survivor = this.deploy({
            id: `SURVIVOR-${String(this.nextUnitNumber++).padStart(3, '0')}`,
            name: survivorType === 'PILOT' ? `Downed pilot (${unit.aircraft})` : 'Stranded soldiers',
            side: unit.side,
            branch: 'survivor',
            survivorType,
            personnel: survivorType === 'PILOT' ? 1 : Math.max(1, Math.ceil((unit.personnel || 4) * 0.2)),
            lat: unit.lat,
            lng: unit.lng,
            condition: 100,
            fuel: 0,
            ammo: 0,
            captured: false
        });
        this.onMessage?.(`${survivor.name} transmitting distress signal // tap the map marker to dispatch CSAR.`);
        return survivor;
    }

    claimSurvivor(survivor, rescuer) {
        if (!survivor || survivor.branch !== 'survivor' || survivor.captured || survivor.rescued) return false;
        survivor.captured = true;
        survivor.rescued = true;
        if (rescuer.side === survivor.side) {
            this.rescuedPersonnel[rescuer.side] += survivor.personnel || 1;
            this.missionManager.scores[rescuer.side].rescued++;
            this.onMessage?.(`CSAR: ${survivor.name} recovered by ${rescuer.id}.`);
        } else {
            this.missionManager.scores[rescuer.side].prisoners =
                (this.missionManager.scores[rescuer.side].prisoners || 0) + (survivor.personnel || 1);
            this.onMessage?.(`CAPTURE: ${survivor.name} taken prisoner by ${rescuer.side.toUpperCase()} forces.`);
        }
        survivor.marker.remove();
        this.map.removeSignal?.(survivor.signalId);
        this.units.delete(survivor.id);
        return true;
    }

    serialize() {
        return {
            nextUnitNumber: this.nextUnitNumber,
            combatElapsed: this.combatElapsed,
            simulationTime: this.simulationTime,
            rescuedPersonnel: this.rescuedPersonnel,
            lastRwrToneAt: this.lastRwrToneAt,
            missionManager: this.missionManager.serialize(),
            units: [...this.units.values()].map(({ marker, ...unit }) => unit)
        };
    }

    restore(snapshot) {
        this.map.clearUnits?.();
        if (!this.map.clearUnits) {
            for (const unit of this.units.values()) unit.marker.remove();
        }
        this.units.clear();
        this.nextUnitNumber = snapshot.nextUnitNumber || 1;
        this.combatElapsed = snapshot.combatElapsed || 0;
        this.simulationTime = snapshot.simulationTime || 0;
        this.rescuedPersonnel = snapshot.rescuedPersonnel || { blue: 0, red: 0 };
        this.lastRwrToneAt = snapshot.lastRwrToneAt || 0;
        if (snapshot.missionManager) this.missionManager.restore(snapshot.missionManager);
        for (const unit of snapshot.units || []) this.deploy(unit);
    }
}
