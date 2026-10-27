import { FORWARD_BASES, StrategicMap } from './map.js';
import { MissionManager } from './mission/missionManager.js';
import { MissionPanel } from './mission/missionPanel.js';
import { CAUCASUS_AIRFIELDS } from './airfields.js/index.js';
import { ALL_UNITS, getFactionAircraft, getFactionUnits } from './units/index.js';
import { GameClock } from './systems/gameClock.js';
import { SimulationEngine } from './systems/simulationEngine.js';
import { StrategicAI } from './systems/strategicAI.js';
import { CampaignStore } from './systems/campaignStore.js';
import { SAM_DEPLOYMENTS } from './airfields.js/samRegistry.js';

function showStartupError(error) {
    console.error('[CRITICAL_ERROR] Initialization error:', error);
    const errorElement = document.getElementById('startup-error');
    if (errorElement) {
        errorElement.textContent = `SYSTEM INITIALIZATION FAILED: ${error.message || error}`;
        errorElement.hidden = false;
    }
}

function formatTime(seconds) {
    const wholeSeconds = Math.floor(seconds);
    const hours = String(Math.floor(wholeSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((wholeSeconds % 3600) / 60)).padStart(2, '0');
    const remainingSeconds = String(wholeSeconds % 60).padStart(2, '0');
    return `TIME // ${hours}:${minutes}:${remainingSeconds}`;
}

function createScenarioScreen() {
    const airfieldList = document.getElementById('scenario-airfields');
    const homeSelect = document.getElementById('scenario-home');
    const eligibleBases = CAUCASUS_AIRFIELDS.filter(airfield => airfield.side !== 'red');

    eligibleBases.forEach(airfield => {
        const label = document.createElement('label');
        label.className = 'scenario-airfield';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = airfield.id;
        checkbox.checked = airfield.side === 'blue';
        checkbox.disabled = airfield.id === 'UGTB';
        checkbox.addEventListener('change', updateHomeBases);
        const name = document.createElement('span');
        name.textContent = `${airfield.name} [${airfield.side.toUpperCase()}]${airfield.id === 'UGTB' ? ' // SUPPLY HQ' : ''}`;
        label.append(checkbox, name);
        airfieldList.appendChild(label);
    });

    function updateHomeBases() {
        const ownedIds = [...airfieldList.querySelectorAll('input:checked')].map(input => input.value);
        const oldHome = homeSelect.value;
        const options = ownedIds
            .filter(id => id !== 'UGTB')
            .map(id => CAUCASUS_AIRFIELDS.find(airfield => airfield.id === id));
        homeSelect.replaceChildren(...options.map(airfield => {
            const option = document.createElement('option');
            option.value = airfield.id;
            option.textContent = airfield.name;
            return option;
        }));
        if (options.some(airfield => airfield.id === oldHome)) homeSelect.value = oldHome;
        document.getElementById('start-campaign').disabled = options.length === 0;
    }

    updateHomeBases();
    return {
        homeSelect,
        startButton: document.getElementById('start-campaign'),
        getOwnedAirfields: () => [...airfieldList.querySelectorAll('input:checked')].map(input => input.value),
        hide: () => {
            document.getElementById('scenario-screen').hidden = true;
        }
    };
}

function initialize() {
    try {
        const map = new StrategicMap('map');
        const missionManager = new MissionManager();
        let selectedEntity = null;
        let selectedGroundGroup = [];
        let messageTimeout = null;

        const showMessage = message => {
            const messageElement = document.getElementById('game-message');
            messageElement.textContent = message;
            messageElement.hidden = false;
            window.clearTimeout(messageTimeout);
            messageTimeout = window.setTimeout(() => {
                messageElement.hidden = true;
            }, 5000);
            console.info(`[OPERATIONS] ${message}`);
        };

        const simulation = new SimulationEngine(
            map,
            missionManager,
            showMessage,
            unit => console.info(`[RECOVERY] ${unit.id} returned to base.`)
        );
        const getStationedForces = base => [...simulation.units.values()].filter(unit =>
            unit.branch === 'army' && unit.side === 'blue' && unit.fobId === base.id &&
            Math.hypot(unit.lat - base.lat, (unit.lng - base.lng) *
                Math.cos(base.lat * Math.PI / 180)) * 111.32 <= 12 &&
            unit.condition > 0 && !unit.route?.length && !unit.routePending
        );
        let lastSavedAt = 0;
        let lastAirspaceUpdate = -10;
        const saveButton = document.getElementById('save-campaign');
        const loadButton = document.getElementById('load-campaign');
        const resumeButton = document.getElementById('resume-campaign');
        const showCampaignControls = () => {
            saveButton.hidden = false;
            loadButton.hidden = false;
        };
        const saveCampaign = () => {
            try {
                CampaignStore.save({
                    missionManager: missionManager.serialize(),
                    simulation: simulation.serialize(),
                    ai: ai.serialize(),
                    clock: clock.serialize()
                });
                showMessage('Campaign saved locally.');
            } catch (error) {
                showMessage(error.message);
                console.error('[SAVE_ERROR]', error);
            }
        };
        const restoreCampaign = snapshot => {
            simulation.enableRWRAlerts();
            missionManager.restore(snapshot.missionManager);
            simulation.restore(snapshot.simulation);
            ai.restore(snapshot.ai || {});
            map.setAirfieldOwners(missionManager.airfieldStates);
            map.setForwardBaseOwners(missionManager.forwardBaseStates);
            map.updateAirspaceControl(simulation.getAirspaceControl());
            clock.restore(snapshot.clock);
            scenario.hide();
            showCampaignControls();
            lastSavedAt = clock.elapsedSeconds;
            map.resize();
            clock.start();
            showMessage('Saved campaign restored.');
        };
        const ai = new StrategicAI(missionManager, simulation, showMessage);
        const panel = new MissionPanel(missionManager, {
            getAircraft: (side, airfield) => {
                let aircraft = missionManager.getAircraftForSide(side);
                aircraft = airfield?.category === 'CARRIER'
                    ? aircraft.filter(unit => unit.branch === 'navy')
                    : aircraft.filter(unit => unit.branch !== 'navy');
                return airfield?.id === 'UGTB'
                    ? aircraft.filter(unit => ['LOGISTICS', 'TROOP_TRANSPORT'].some(mission =>
                        missionManager.getMissionTypes(unit).includes(mission)
                    ))
                    : aircraft;
            },
            onSelectionChange: entity => {
                selectedEntity = entity;
                map.selectedEntity = entity;
                selectedGroundGroup = entity?.branch === 'army' ? [entity] : [];
            },
            getGroundTargets: base => [
                ...CAUCASUS_AIRFIELDS.filter(airfield =>
                    missionManager.getState(airfield.id).owner !== 'blue'
                ).map(airfield => ({
                    ...airfield,
                    side: missionManager.getState(airfield.id).owner,
                    kind: 'AIRFIELD'
                })),
                ...FORWARD_BASES.filter(candidate =>
                    candidate.id !== base.id &&
                    missionManager.getForwardBaseState(candidate.id).owner !== 'blue'
                ).map(candidate => ({
                    ...candidate,
                    side: missionManager.getForwardBaseState(candidate.id).owner,
                    kind: 'FOB'
                }))
            ],
            onFobAttack: (base, target, platoonCount) => {
                if (!target || target.side === 'blue') {
                    return { success: false, message: 'Select a hostile airfield or FOB.' };
                }
                const available = getStationedForces(base);
                if (!Number.isInteger(platoonCount) || platoonCount < 1 || platoonCount > available.length) {
                    return { success: false, message: `Choose between 1 and ${available.length} available platoons.` };
                }
                const attackForce = available.slice(0, platoonCount);
                void simulation.issueGroundGroupRoute(attackForce, {
                    name: target.name,
                    lat: target.lat,
                    lng: target.lng
                }, {
                    type: 'GROUND_ASSAULT',
                    targetId: target.id,
                    targetKind: target.kind,
                    targetName: target.name
                });
                return {
                    success: true,
                    message: `${platoonCount} platoon(s) assigned to attack ${target.name}; ` +
                        `${available.length - platoonCount} remain at ${base.name}.`
                };
            },
            onLaunch: packageData => {
                const side = missionManager.getState(panel.currentAirfield.id).owner;
                const departureIds = packageData.multiBase
                    ? CAUCASUS_AIRFIELDS.filter(base =>
                        base.id !== panel.currentAirfield.id &&
                        missionManager.getState(base.id).owner === side
                    ).map(base => base.id)
                    : [];
                const results = [];
                for (const departureId of [panel.currentAirfield.id, ...departureIds]) {
                    if (packageData.escortSupport) {
                        const escortAircraft = missionManager.getAircraftRoster(departureId, side)
                            .filter(type => type.ready > 0 &&
                                missionManager.getMissionTypes(type).includes('ESCORT'))
                            .sort((first, second) =>
                                (second.combatRating?.air || 0) - (first.combatRating?.air || 0)
                            )[0];
                        if (!escortAircraft) {
                            results.push({
                                success: false,
                                message: `${departureId}: no ready fighter is available for escort.`
                            });
                            continue;
                        }
                        const escort = missionManager.launchMission(departureId, {
                            side,
                            aircraft: escortAircraft.typeId,
                            missionType: 'ESCORT',
                            count: 1,
                            target: packageData.target,
                            escortTarget: true,
                            airUnits: [...simulation.units.values()]
                        });
                        if (!escort.success) {
                            results.push(escort);
                            continue;
                        }
                        simulation.addAirPackage(escort.package);
                    }
                    const result = missionManager.launchMission(departureId, {
                        ...packageData,
                        side,
                        escortSupport: packageData.escortSupport,
                        count: packageData.multiBase ? 1 : packageData.count,
                        airUnits: [...simulation.units.values()]
                    });
                    results.push(result);
                    if (result.success) simulation.addAirPackage(result.package);
                }
                const launched = results.filter(result => result.success);
                const failures = results.filter(result => !result.success);
                const message = launched.length
                    ? `${launched.length} base(s) launched ${packageData.missionType} sorties.` +
                        (failures.length ? ` ${failures.length} sortie(s) could not launch.` : '')
                    : failures.map(result => result.message).join(' ');
                if (launched.length) showMessage(message);
                return { success: launched.length > 0, message };
            },
            onQuickLaunch: packageData => {
                const result = missionManager.launchMission(packageData.departureId, {
                    ...packageData,
                    side: 'blue',
                    airUnits: [...simulation.units.values()]
                });
                if (!result.success) return result;
                result.package.signalUnitId = packageData.signalUnitId;
                result.package.signalId = packageData.signalId;
                simulation.addAirPackage(result.package);
                map.removeSignal(packageData.signalId);
                showMessage(`${packageData.missionType} response launched from ${result.package.departure.name}.`);
                return result;
            },
            onRepairSAM: site => missionManager.repairSAM(site, 'blue'),
            onAirCommand: (unit, command, target) =>
                simulation.issueAirCommand(unit, command, target?.unit || target),
            onAltitudeCommand: (unit, altitudeFt) =>
                simulation.setAircraftAltitude(unit, altitudeFt),
            onAirRoute: (unit, waypoint) =>
                simulation.issueAirRoute(unit, waypoint),
            onUnitCommand: (unit, command, sameFobGroup) => {
                selectedGroundGroup = sameFobGroup && unit.fobId
                    ? [...simulation.units.values()].filter(candidate =>
                        candidate.branch === 'army' && candidate.side === unit.side &&
                        candidate.fobId === unit.fobId
                    )
                    : [unit];
                if (command === 'DEFEND') {
                    for (const force of selectedGroundGroup) {
                        simulation.issueRoute(force, [], { type: command });
                    }
                }
                return selectedGroundGroup;
            }
        });

        map.onAirfieldClick = airfield => {
            if (panel.waitingForMapTarget) {
                panel.setMapTarget(airfield);
                return;
            }
            if (missionManager.getState(airfield.id).owner !== 'blue') {
                showMessage(`${airfield.name} is not under Blue Force control.`);
                return;
            }
            panel.showAirfield(airfield, [...simulation.units.values()]);
        };
        map.onForwardBaseClick = base => {
            if (panel.waitingForMapTarget) {
                panel.setMapTarget({
                    ...base,
                    side: missionManager.getForwardBaseState(base.id).owner
                });
                return;
            }
            panel.showForwardBase(base, [...simulation.units.values()]);
        };
        map.onUnitClick = unit => {
            if (panel.waitingForMapTarget) {
                panel.setMapTarget({
                    id: unit.id,
                    name: unit.name || unit.id,
                    lat: unit.lat,
                    lng: unit.lng,
                    side: unit.side,
                    unit
                });
                return;
            }
            if (unit.category === 'CARRIER' && unit.side === 'blue') {
                panel.showAirfield(unit, [...simulation.units.values()]);
                return;
            }
            panel.showUnit(unit);
        };
        map.onSignalClick = signal => {
            const bases = CAUCASUS_AIRFIELDS.filter(base =>
                base.id !== 'UGTB' && missionManager.getState(base.id).owner === 'blue'
            );
            panel.setAirUnits([...simulation.units.values()]);
            panel.showSignal(signal, bases, getFactionAircraft('blue'));
        };
        map.onMapClick = latlng => {
            if (panel.waitingForMapTarget) {
                panel.setMapTarget({
                    lat: latlng.lat,
                    lng: latlng.lng,
                    name: `Map point ${latlng.lat.toFixed(2)}, ${latlng.lng.toFixed(2)}`
                });
                return;
            }
            if (!selectedEntity || !['army', 'navy'].includes(selectedEntity.branch) ||
                selectedEntity.order?.type !== 'MOVE') return;
            const group = selectedEntity.branch === 'army' && selectedGroundGroup.length
                ? selectedGroundGroup
                : [selectedEntity];
            const waypoint = {
                name: 'PLAYER WAYPOINT',
                lat: latlng.lat,
                lng: latlng.lng
            };
            if (group.length > 1 && selectedEntity.branch === 'army') {
                void simulation.issueGroundGroupRoute(group, waypoint, { type: 'MOVE' });
                showMessage(`${group.length} ground units are routing together to the selected waypoint.`);
                return;
            }
            for (const unit of group) {
                void simulation.issueRoute(unit, [waypoint], { type: 'MOVE' });
            }
            showMessage(`${group.length} ground unit(s) moving to the selected waypoint.`);
        };
        window.addEventListener('resize', () => map.resize());

        const scenario = createScenarioScreen();
        const clock = new GameClock(
            (gameSeconds, elapsedSeconds) => {
                simulation.update(gameSeconds);
                ai.update(elapsedSeconds);
                panel.setAirUnits([...simulation.units.values()]);
                panel.refreshSelectedUnit();
                if (panel.currentForwardBase) {
                    panel.refreshForwardBase(
                        [...simulation.units.values()],
                        missionManager.getForwardBaseState(panel.currentForwardBase.id)
                    );
                }
                if (elapsedSeconds - lastAirspaceUpdate >= 10) {
                    map.updateAirspaceControl(simulation.getAirspaceControl());
                    lastAirspaceUpdate = elapsedSeconds;
                }
                const blueScore = missionManager.scores.blue;
                const redScore = missionManager.scores.red;
                document.getElementById('campaign-score').textContent =
                    `BLUE ${missionManager.getCampaignScore('blue')} [VALUE ${blueScore.missionValue} / COST ${blueScore.cost}] | RED ${missionManager.getCampaignScore('red')} [VALUE ${redScore.missionValue} / COST ${redScore.cost}]`;
                if (elapsedSeconds - lastSavedAt >= 60) {
                    saveCampaign();
                    lastSavedAt = elapsedSeconds;
                }
            },
            (elapsedSeconds, scale, paused) => {
                document.getElementById('game-timer').textContent = formatTime(elapsedSeconds);
                const pauseButton = document.getElementById('pause-game');
                pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
                pauseButton.setAttribute('aria-pressed', String(paused));
                document.querySelectorAll('[data-time-scale]').forEach(button => {
                    button.setAttribute('aria-pressed', String(Number(button.dataset.timeScale) === scale));
                });
            }
        );

        document.querySelectorAll('[data-time-scale]').forEach(button => {
            button.addEventListener('click', () => clock.setTimeScale(Number(button.dataset.timeScale)));
        });
        document.getElementById('pause-game').addEventListener('click', () => clock.setPaused(!clock.paused));
        saveButton.addEventListener('click', saveCampaign);
        loadButton.addEventListener('click', () => {
            try {
                const snapshot = CampaignStore.load();
                if (!snapshot) {
                    showMessage('No saved campaign was found.');
                    return;
                }
                restoreCampaign(snapshot);
            } catch (error) {
                showMessage(error.message);
                console.error('[LOAD_ERROR]', error);
            }
        });
        resumeButton.addEventListener('click', () => {
            try {
                const snapshot = CampaignStore.load();
                if (!snapshot) throw new Error('No saved campaign was found.');
                restoreCampaign(snapshot);
            } catch (error) {
                showMessage(error.message);
                console.error('[LOAD_ERROR]', error);
            }
        });
        try {
            resumeButton.hidden = !CampaignStore.load();
        } catch (error) {
            showMessage(error.message);
            console.error('[LOAD_ERROR]', error);
        }
        scenario.startButton.addEventListener('click', () => {
            const ownedAirfields = scenario.getOwnedAirfields();
            if (!ownedAirfields.includes('UGTB')) {
                showMessage('Tbilisi (UGTB) must remain under Blue Force control as the strategic supply hub.');
                return;
            }
            missionManager.setOwnership(ownedAirfields);
            map.setAirfieldOwners(missionManager.airfieldStates);
            map.setForwardBaseOwners(missionManager.forwardBaseStates);
            ai.setHomeAirfield(scenario.homeSelect.value);

            const home = CAUCASUS_AIRFIELDS.find(airfield => airfield.id === scenario.homeSelect.value);
            simulation.deploy({
                ...ALL_UNITS['DDG-51_F3'],
                id: 'BLUE-DDG-01',
                side: 'blue',
                lat: 43.18,
                lng: 39.05
            });
            simulation.deploy({
                ...ALL_UNITS['CVN-78'],
                id: 'BLUE-CVN-78',
                side: 'blue',
                lat: 42.75,
                lng: 38.3
            });
            const redFrigate = getFactionUnits('red', 'navy').find(unit => unit.id === 'ADMIRAL_GORSHKOV');
            const redSubmarine = getFactionUnits('red', 'navy').find(unit => unit.id === 'KILO_636');
            if (!redFrigate || !redSubmarine) {
                throw new Error('Russian naval order of battle is incomplete.');
            }
            simulation.deploy({ ...redFrigate, id: 'RED-FRIGATE-01', side: 'red', lat: 43.5, lng: 37.2 });
            simulation.deploy({ ...redSubmarine, id: 'RED-SUB-01', side: 'red', lat: 42.9, lng: 36.8 });

            const blueGround = ALL_UNITS.M1A2_SEPv3;
            const redGround = ALL_UNITS['T-90A'];
            for (const fob of FORWARD_BASES) {
                const side = fob.owner;
                const source = side === 'blue' ? blueGround : redGround;
                for (let platoon = 0; platoon < 6; platoon++) {
                    const row = Math.floor(platoon / 3);
                    const column = platoon % 3;
                    simulation.deploy({
                        ...source,
                        id: `${side.toUpperCase()}-${fob.id}-${platoon + 1}`,
                        name: `${fob.name} Combined Platoon ${platoon + 1}`,
                        side,
                        lat: fob.lat + (row - 0.5) * 0.055,
                        lng: fob.lng + (column - 1) * 0.055,
                        fobId: fob.id,
                        jtac: { callsign: `${side.toUpperCase()}-${fob.id}-JTAC-${platoon + 1}` },
                        personnelStrength: 120,
                        vehicleStrength: 18,
                        vehicleManifest: {
                            tanks: 4,
                            infantryCarriers: 8,
                            selfPropelledArtillery: 2,
                            supportVehicles: 4
                        },
                        teamComposition: { infantry: 3, armor: 2, transport: 2, support: 1 }
                    });
                }
            }
            for (const deployment of SAM_DEPLOYMENTS) {
                const baseState = missionManager.airfieldStates[deployment.baseId];
                if (!baseState || !['blue', 'red'].includes(baseState.owner)) continue;
                const site = simulation.deploy({
                    id: `SAM-${deployment.id || deployment.baseId}`,
                    name: `${deployment.baseName} air-defense site`,
                    branch: 'sam',
                    category: 'SAM',
                    system: deployment.system,
                    baseId: deployment.baseId,
                    side: baseState.owner,
                    lat: deployment.lat,
                    lng: deployment.lng,
                    condition: 100,
                    ammo: 6,
                    fuel: 0,
                    operational: true,
                    engagementRangeKm: deployment.gameCoverageKm ||
                        (deployment.system.includes('Patriot') ? 45 : 30),
                    repairCost: 120,
                    nextShotAt: 0,
                    speed: { maxKmh: 0 }
                });
                missionManager.samSites.push(site.id);
            }

            scenario.hide();
            showCampaignControls();
            map.updateAirspaceControl(simulation.getAirspaceControl());
            lastAirspaceUpdate = 0;
            map.resize();
            simulation.enableRWRAlerts();
            clock.start();
            showMessage(`Blue Force deployed from ${home.name}. All Blue Force operations are manual.`);
        });

        console.log(`[AI_CORE] Map initialized with ${map.airfields.length} airfields. Select your starting territory.`);
    } catch (error) {
        showStartupError(error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
    initialize();
}
