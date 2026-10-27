import { getFactionAircraft, getFactionUnits } from '../units/index.js';

const MAX_ACTIVE_ENEMY_AIR_PACKAGES = 2;
const ENEMY_INTERCEPT_RANGE_KM = 220;
const ENEMY_COMBAT_MISSIONS = new Set([
    'CAP', 'SWEEP_CAP', 'ESCORT', 'INTERCEPT', 'STRIKE', 'SEAD', 'ANTI_SHIP', 'CAS'
]);
const ENEMY_LIMITED_AIR_MISSIONS = new Set([
    ...ENEMY_COMBAT_MISSIONS, 'LOGISTICS', 'TROOP_TRANSPORT', 'CSAR', 'SCAR'
]);

function distanceKm(first, second) {
    const latitudeScale = Math.cos(((first.lat + second.lat) / 2) * Math.PI / 180);
    return Math.hypot(
        (first.lat - second.lat) * 111.32,
        (first.lng - second.lng) * 111.32 * latitudeScale
    );
}

export class StrategicAI {
    constructor(missionManager, simulation, onMessage) {
        this.missionManager = missionManager;
        this.simulation = simulation;
        this.onMessage = onMessage;
        this.nextEnemyOperation = 300 + Math.random() * 300;
        this.nextEnemyIntercept = 30;
        this.homeAirfieldId = 'UGTB';
        this.assignedEnemyIntercepts = new Set();
        this.assignedRescueTargets = new Set();
        this.nextGroundOperation = 60;
        this.nextRescueCheck = 30;
        this.nextEnemySupply = 900;
        this.nextSAMRepairCheck = 180;
        this.nextFleetSpawn = 150;
        this.fleetSequence = 1;
    }

    setHomeAirfield(airfieldId) {
        this.homeAirfieldId = airfieldId;
    }

    update(gameTime) {
        if (gameTime >= this.nextEnemyOperation) {
            this.launchEnemyOperation();
            this.nextEnemyOperation = gameTime + 600 + Math.random() * 1200;
        }

        if (gameTime >= this.nextEnemyIntercept) {
            this.launchEnemyIntercept();
            this.nextEnemyIntercept = gameTime + 90 + Math.random() * 60;
        }

        if (gameTime >= this.nextGroundOperation) {
            this.advanceGroundForces();
            this.nextGroundOperation = gameTime + 50 + Math.random() * 25;
        }
        if (gameTime >= this.nextRescueCheck) {
            this.dispatchCSAR('red');
            this.nextRescueCheck = gameTime + 25 + Math.random() * 15;
        }
        if (gameTime >= this.nextEnemySupply) {
            this.launchEnemyResupply();
            this.nextEnemySupply = gameTime + 900 + Math.random() * 600;
        }
        if (gameTime >= this.nextSAMRepairCheck) {
            this.repairDamagedSAMs('red');
            this.nextSAMRepairCheck = gameTime + 120 + Math.random() * 60;
        }
        if (gameTime >= this.nextFleetSpawn) {
            this.spawnTaskForce();
            this.nextFleetSpawn = gameTime + 180 + Math.random() * 180;
        }
    }

    launchEnemyOperation() {
        if (this.getActiveEnemyAirPackageCount() >= MAX_ACTIVE_ENEMY_AIR_PACKAGES) return;
        const redBases = this.simulation.map.airfields.filter(base =>
            this.missionManager.getState(base.id).owner === 'red'
        );
        if (!redBases.length) return;
        const enemyTargets = redBases.flatMap(base =>
            this.missionManager.getTargets(base.id, 'STRIKE', 'red')
        );
        if (!enemyTargets.length) return;

        const target = enemyTargets[Math.floor(Math.random() * enemyTargets.length)];
        const redBase = this.getNearestBase('red', target, 2);
        if (!redBase) return;
        const aircraft = getFactionAircraft('red').find(unit =>
            unit.role !== 'EARLY_WARNING' &&
            this.missionManager.getMissionTypes(unit).includes('STRIKE')
        );
        if (!aircraft) {
            console.error('[AI_ERROR] No red-faction strike aircraft are registered.');
            return;
        }

        const mission = {
            side: 'red',
            aircraft: aircraft.typeId,
            missionType: 'STRIKE',
            count: 2,
            target,
            airUnits: [...this.simulation.units.values()]
        };
        const result = this.missionManager.launchMission(redBase.id, mission);
        if (!result.success) {
            this.onMessage?.(`ENEMY AI: ${result.message}`);
            return;
        }

        this.simulation.addAirPackage(result.package);
        this.onMessage?.(`ENEMY ALERT: ${aircraft.name} package inbound toward ${target.name}.`);

        if (this.getActiveEnemyAirPackageCount() >= MAX_ACTIVE_ENEMY_AIR_PACKAGES) return;
        const capAircraft = getFactionAircraft('red')
            .filter(unit => this.missionManager.getMissionTypes(unit).includes('CAP'))
            .sort((first, second) => this.capPriority(second) - this.capPriority(first))[0];
        const capBase = capAircraft && this.getNearestBase('red', target, 2);
        if (!capBase) return;
        const patrolTarget = {
            id: `AREA:CUSTOM:HOTSPOT:${target.id}:${Math.floor(this.missionManager.currentGameTime)}`,
            name: `Raid package // ${target.name}`,
            lat: (redBase.lat + target.lat) / 2,
            lng: (redBase.lng + target.lng) / 2,
            side: 'contested'
        };
        const patrolResult = this.missionManager.launchMission(capBase.id, {
            side: 'red',
            aircraft: capAircraft.typeId,
            missionType: 'CAP',
            count: 2,
            target: patrolTarget,
            airUnits: [...this.simulation.units.values()]
        });
        if (patrolResult.success) {
            this.simulation.addAirPackage(patrolResult.package);
            this.onMessage?.(`ENEMY HOTSPOT: ${capAircraft.name} CAP section supporting the raid on ${target.name}.`);
        }
    }

    spawnTaskForce() {
        const sides = ['red'];
        for (const side of sides) {
            const activeCount = [...this.simulation.units.values()].filter(unit =>
                unit.branch === 'navy' && unit.side === side && unit.dynamicFleet
            ).length;
            if (activeCount >= 3) continue;
            const availableShips = getFactionUnits(side, 'navy')
                .filter(unit => unit.category === 'SURFACE');
            if (!availableShips.length) continue;
            const shipType = availableShips[Math.floor(Math.random() * availableShips.length)];
            const port = side === 'blue'
                ? { lat: 41.55, lng: 41.65 }
                : { lat: 44.9, lng: 37.3 };
            const unit = this.simulation.deploy({
                ...shipType,
                id: `${side.toUpperCase()}-TF-${String(this.fleetSequence++).padStart(3, '0')}`,
                side,
                dynamicFleet: true,
                lat: port.lat + (Math.random() - 0.5) * 0.08,
                lng: port.lng + (Math.random() - 0.5) * 0.08
            });
            const destination = side === 'blue'
                ? { lat: 43.1 + Math.random() * 0.35, lng: 38.3 + Math.random() * 0.4 }
                : { lat: 43 + Math.random() * 0.35, lng: 39.5 + Math.random() * 0.4 };
            this.simulation.issueRoute(unit, [
                { name: 'PORT DEPARTURE', lat: unit.lat + 0.1, lng: unit.lng + 0.1 },
                { name: 'TASK FORCE PATROL', ...destination }
            ], { type: 'FLEET_PATROL' });
            this.onMessage?.(`${side.toUpperCase()} task force departed port // ${shipType.name}.`);
            return;
        }
    }

    launchEnemyIntercept() {
        if (this.getActiveEnemyAirPackageCount() >= MAX_ACTIVE_ENEMY_AIR_PACKAGES) return;
        const redBases = this.simulation.map.airfields.filter(base =>
            this.missionManager.getState(base.id).owner === 'red'
        );
        const bluePackages = this.simulation.getEnemyAirPackages('red').filter(unit =>
            ENEMY_COMBAT_MISSIONS.has(unit.mission.type) &&
            redBases.some(base => distanceKm(base, unit) <= ENEMY_INTERCEPT_RANGE_KM)
        );
        const activeTargets = new Set(bluePackages.map(unit => unit.id));
        this.assignedEnemyIntercepts = new Set(
            [...this.assignedEnemyIntercepts].filter(id => activeTargets.has(id))
        );
        const targetUnit = bluePackages.find(unit => !this.assignedEnemyIntercepts.has(unit.id));
        if (!targetUnit) return;

        this.launchScramble('red', targetUnit, this.assignedEnemyIntercepts);
    }

    getActiveEnemyAirPackageCount() {
        return [...this.simulation.units.values()].filter(unit =>
            unit.branch === 'airforce' && unit.side === 'red' &&
            !unit.missionComplete && unit.mission?.departureId &&
            ENEMY_LIMITED_AIR_MISSIONS.has(
                unit.mission.type === 'RTB'
                    ? unit.mission.returningFromMissionType
                    : unit.mission.type
            )
        ).length;
    }

    launchEnemyResupply() {
        if (this.getActiveEnemyAirPackageCount() > 0) return;
        const headquarters = this.simulation.map.airfields.find(base => base.id === 'URKA');
        if (!headquarters || this.missionManager.getState(headquarters.id).owner !== 'red') return;
        const helicopter = getFactionAircraft('red').find(unit =>
            this.missionManager.getMissionTypes(unit).includes('LOGISTICS')
        );
        if (!helicopter) return;
        const destinations = this.missionManager.getTargets(
            headquarters.id,
            'LOGISTICS',
            'red'
        ).filter(base => {
            const stock = this.missionManager.getState(base.id).stock;
            return stock.supplies < 5000 || stock.fuel < 20000 || stock.spareParts < 120;
        }).sort((first, second) => {
            const firstStock = this.missionManager.getState(first.id).stock;
            const secondStock = this.missionManager.getState(second.id).stock;
            return firstStock.supplies + firstStock.fuel / 10 + firstStock.spareParts * 10 -
                (secondStock.supplies + secondStock.fuel / 10 + secondStock.spareParts * 10);
        });
        const target = destinations[0];
        if (!target) return;
        const result = this.missionManager.launchMission(headquarters.id, {
            side: 'red',
            aircraft: helicopter.typeId,
            missionType: 'LOGISTICS',
            count: 1,
            target,
            cargo: { supplies: 2000, fuel: 500, spareParts: 5 },
            airUnits: [...this.simulation.units.values()]
        });
        if (!result.success) {
            this.onMessage?.(`ENEMY LOGISTICS: ${result.message}`);
            return;
        }
        this.simulation.addAirPackage(result.package);
        this.onMessage?.(`ENEMY LOGISTICS: ${helicopter.name} resupply flight bound for ${target.name}.`);
    }

    repairDamagedSAMs(side) {
        for (const id of this.missionManager.samSites) {
            const site = this.simulation.units.get(id);
            if (!site || site.operational || this.missionManager.getState(site.baseId).owner !== side) continue;
            const result = this.missionManager.repairSAM(site, side);
            if (result.success) this.onMessage?.(`${side.toUpperCase()} AI: ${result.message}`);
        }
    }

    dispatchCSAR(side) {
        if (side === 'red' &&
            this.getActiveEnemyAirPackageCount() >= MAX_ACTIVE_ENEMY_AIR_PACKAGES) return false;
        const activeSurvivors = [...this.simulation.units.values()].filter(unit =>
            unit.branch === 'survivor' && unit.side === side
        );
        const activeIds = new Set(activeSurvivors.map(unit => unit.id));
        this.assignedRescueTargets = new Set(
            [...this.assignedRescueTargets].filter(id => activeIds.has(id))
        );
        const survivor = activeSurvivors.find(unit =>
            !unit.rescued && !this.assignedRescueTargets.has(unit.id)
        );
        if (!survivor) return false;
        const base = this.getNearestBase(side, survivor, 1);
        const helicopter = getFactionAircraft(side).find(unit =>
            this.missionManager.getMissionTypes(unit).includes('CSAR')
        );
        if (!base || !helicopter) return false;
        const target = {
            id: survivor.id,
            name: `${survivor.survivorType}: ${survivor.name}`,
            lat: survivor.lat,
            lng: survivor.lng,
            side: survivor.side,
            unit: survivor
        };
        const result = this.missionManager.launchMission(base.id, {
            side,
            aircraft: helicopter.typeId,
            missionType: 'CSAR',
            count: 1,
            target,
            airUnits: [...this.simulation.units.values()]
        });
        if (!result.success) {
            this.onMessage?.(`${side.toUpperCase()} CSAR: ${result.message}`);
            return false;
        }
        this.simulation.addAirPackage(result.package);
        this.assignedRescueTargets.add(survivor.id);
        this.onMessage?.(`${side.toUpperCase()} CSAR: ${helicopter.name} dispatched for ${survivor.name}.`);
        return true;
    }

    getNearestBase(side, target, aircraftCount = 2) {
        return this.simulation.map.airfields
            .filter(base => {
                const state = this.missionManager.getState(base.id);
                return state.owner === side &&
                    state.stock.airframesReady >= aircraftCount && state.stock.spareParts > 0;
            })
            .sort((first, second) =>
                distanceKm(first, target) - distanceKm(second, target)
            )[0] || null;
    }

    launchScramble(side, targetUnit, assignedTargets) {
        const interceptors = getFactionAircraft(side)
            .filter(unit => this.missionManager.getMissionTypes(unit).includes('CAP'))
            .sort((first, second) => this.capPriority(second) - this.capPriority(first));
        if (!interceptors.length) {
            console.error(`[AI_ERROR] No ${side} CAP aircraft are available.`);
            return false;
        }
        const bases = this.simulation.map.airfields
            .filter(base => {
                const state = this.missionManager.getState(base.id);
                return state.owner === side &&
                    state.stock.airframesReady >= 2;
            })
            .sort((first, second) => distanceKm(first, targetUnit) - distanceKm(second, targetUnit));
        const base = bases.find(candidate => interceptors.some(type =>
            this.missionManager.getAircraftRoster(candidate.id, side)
                .some(item => item.typeId === type.typeId && item.ready >= 2)
        ));
        if (!base) return false;
        const availableInterceptors = interceptors.filter(type =>
            this.missionManager.getAircraftRoster(base.id, side)
                .some(item => item.typeId === type.typeId && item.ready >= 2)
        );
        if (!availableInterceptors.length) return false;
        const target = {
            id: `AREA:CUSTOM:AI:${targetUnit.id}`,
            name: `Alert grid // ${targetUnit.aircraft || targetUnit.id}`,
            lat: targetUnit.lat,
            lng: targetUnit.lng,
            side: targetUnit.side,
            unit: targetUnit
        };
        const result = this.missionManager.launchMission(base.id, {
            side,
            aircraft: availableInterceptors[0].typeId,
            missionType: 'CAP',
            count: 2,
            target,
            airUnits: [...this.simulation.units.values()]
        });
        if (!result.success) {
            this.onMessage?.(`ENEMY AI: ${result.message}`);
            return false;
        }
        this.simulation.addAirPackage(result.package);
        assignedTargets.add(targetUnit.id);
        this.onMessage?.(`ENEMY SCRAMBLE: 2 ${availableInterceptors[0].name} aircraft launched from ${base.name}.`);
        return true;
    }

    capPriority(unit) {
        const priority = { 'F-14B': 3, 'F-15C': 3, 'F-15E': 2, 'F-16C': 1 };
        return priority[unit.typeId] || 0;
    }

    advanceGroundForces() {
        const units = [...this.simulation.units.values()].filter(unit =>
            unit.branch === 'army' && unit.side === 'red' && unit.condition > 0 &&
            !unit.routePending &&
            (!unit.order || unit.order.type === 'HOLD' || unit.order.type === 'AI_ADVANCE' || unit.order.type === 'RETREAT')
        );
        for (const unit of units) {
            const friendlyBases = this.simulation.map.airfields.filter(base =>
                this.missionManager.getState(base.id).owner === unit.side
            );
            const hostileBases = this.simulation.map.airfields.filter(base =>
                this.missionManager.getState(base.id).owner !== unit.side
            );
            if (!friendlyBases.length || !hostileBases.length) continue;

            if (unit.condition < 35) {
                const retreatBase = friendlyBases.sort((a, b) =>
                    distanceKm(unit, a) - distanceKm(unit, b)
                )[0];
                this.simulation.issueRoute(unit, [{
                    name: 'FALLBACK / FRIENDLY BASE',
                    lat: retreatBase.lat,
                    lng: retreatBase.lng
                }], { type: 'RETREAT', targetId: retreatBase.id });
                continue;
            }
            if (unit.order?.type === 'AI_ADVANCE' && (unit.route.length || unit.routePending)) continue;
            const target = hostileBases.sort((a, b) =>
                distanceKm(unit, a) - distanceKm(unit, b)
            )[0];
            if (!this.hasAirCover(unit.side, unit, target)) continue;
            this.simulation.issueRoute(unit, [{
                name: 'AI GROUND ADVANCE',
                lat: target.lat,
                lng: target.lng
            }], { type: 'AI_ADVANCE', targetId: target.id });
            this.onMessage?.(`${unit.side.toUpperCase()} ground force advancing toward ${target.name}.`);
        }
    }

    hasAirCover(side, unit, target) {
        const radiusKm = 100;
        const hostileAircraft = [...this.simulation.units.values()].filter(candidate =>
            candidate.branch === 'airforce' && candidate.side !== side &&
            candidate.mission && candidate.route.length &&
            Math.min(distanceKm(candidate, unit), distanceKm(candidate, target)) <= radiusKm
        );
        if (hostileAircraft.length === 0) return true;
        const friendlyPatrols = [...this.simulation.units.values()].filter(candidate =>
            candidate.branch === 'airforce' && candidate.side === side &&
            candidate.mission && candidate.route.length &&
            ['CAP', 'SWEEP_CAP', 'INTERCEPT', 'ESCORT', 'LOGISTICS_ESCORT'].includes(candidate.mission.type) &&
            Math.min(distanceKm(candidate, unit), distanceKm(candidate, target)) <= radiusKm
        );
        return friendlyPatrols.length >= hostileAircraft.length;
    }

    serialize() {
        return {
            nextEnemyOperation: this.nextEnemyOperation,
            nextEnemyIntercept: this.nextEnemyIntercept,
            nextGroundOperation: this.nextGroundOperation,
            nextRescueCheck: this.nextRescueCheck,
            nextEnemySupply: this.nextEnemySupply,
            nextSAMRepairCheck: this.nextSAMRepairCheck,
            nextFleetSpawn: this.nextFleetSpawn,
            fleetSequence: this.fleetSequence,
            homeAirfieldId: this.homeAirfieldId,
            assignedEnemyIntercepts: [...this.assignedEnemyIntercepts],
            assignedRescueTargets: [...this.assignedRescueTargets]
        };
    }

    restore(snapshot) {
        Object.assign(this, {
            ...snapshot,
            nextRescueCheck: snapshot.nextRescueCheck || 30,
            nextEnemySupply: snapshot.nextEnemySupply || 900,
            nextSAMRepairCheck: snapshot.nextSAMRepairCheck || 180,
            nextFleetSpawn: snapshot.nextFleetSpawn || 150,
            fleetSequence: snapshot.fleetSequence || 1,
            assignedEnemyIntercepts: new Set(snapshot.assignedEnemyIntercepts || []),
            assignedRescueTargets: new Set(snapshot.assignedRescueTargets || [])
        });
    }
}
