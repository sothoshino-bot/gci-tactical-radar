export class MissionPanel {
    constructor(missionManager, callbacks) {
        this.manager = missionManager;
        this.callbacks = callbacks;
        this.currentAirfield = null;
        this.currentUnit = null;
        this.currentForwardBase = null;
        this.airUnits = [];
        this.createUI();
    }

    createUI() {
        const panel = document.createElement('section');
        panel.id = 'tactical-mission-panel';
        panel.className = 'mission-panel';
        panel.hidden = true;
        panel.innerHTML = `
            <header class="mission-header">
                <strong>// COMMAND & LOGISTICS</strong>
                <button type="button" id="close-mission-panel" aria-label="Close command panel">[X]</button>
            </header>
            <h2 id="panel-entity-name"></h2>
            <p id="panel-entity-status" class="mission-status"></p>
            <div id="mission-controls">
                <label>Aircraft / helicopter<select id="pm-aircraft"></select></label>
                <label>Mission type<select id="pm-type"></select></label>
                <label><span id="pm-target-label">Target</span><select id="pm-target"></select></label>
                <label>Package size<select id="pm-count">
                    <option value="1" selected>1 aircraft</option>
                    <option value="2">2 aircraft</option>
                    <option value="4">4 aircraft</option>
                </select></label>
                <label id="multi-base-option" class="inline-option">
                    <input type="checkbox" id="pm-multi-base">
                    Coordinate this mission from other friendly bases
                </label>
                <label id="escort-support-option" class="inline-option" hidden>
                    <input type="checkbox" id="pm-escort-support">
                    Launch a fighter escort with this bomber package
                </label>
                <button type="button" id="pm-pick-area" class="secondary-button" hidden>PICK TARGET ON MAP</button>
                <fieldset id="cargo-controls" hidden>
                    <legend>DELIVERY CARGO</legend>
                    <label>Supplies (kg)<input id="pm-supplies" type="number" min="0" step="100" value="1000"></label>
                    <label>Fuel<input id="pm-fuel" type="number" min="0" step="100" value="0"></label>
                    <label>Airframes<input id="pm-airframes" type="number" min="0" step="1" value="0"></label>
                    <label>Spare parts<input id="pm-spare-parts" type="number" min="0" step="10" value="0"></label>
                    <label>Personnel<input id="pm-personnel" type="number" min="0" step="1" value="0"></label>
                    <p class="cargo-note">Deliveries can launch from friendly bases with available stock. Cargo capacity is aircraft-specific.</p>
                </fieldset>
                <button type="button" id="pm-launch-btn" class="launch-button">LAUNCH MISSION</button>
                <p id="mission-feedback" role="status" aria-live="polite"></p>
            </div>
            <div id="forward-base-controls" hidden>
                <fieldset>
                    <legend>FORWARD BASE FORCE MANAGEMENT</legend>
                    <p id="fob-force-summary" class="cargo-note"></p>
                    <label>Send platoons to attack
                        <input id="fob-attack-count" type="range" min="0" max="0" value="0">
                    </label>
                    <p id="fob-force-allocation" class="cargo-note"></p>
                    <label>Attack destination<select id="fob-attack-target"></select></label>
                    <button type="button" id="fob-attack-btn" class="launch-button">ORDER ATTACK</button>
                    <p id="fob-feedback" role="status" aria-live="polite"></p>
                </fieldset>
            </div>
            <div id="unit-controls" hidden>
                <label>Ground / naval order<select id="pm-unit-command"></select></label>
                <p class="cargo-note">For MOVE / SAIL, issue the order, then click a destination on the map.</p>
                <fieldset id="ground-group-controls" hidden>
                    <legend>GROUND FORCE GROUP</legend>
                    <label class="inline-option">
                        <input type="checkbox" id="pm-same-fob-group">
                        Include all friendly units at this FOB
                    </label>
                    <p id="ground-group-summary" class="cargo-note"></p>
                </fieldset>
                <button type="button" id="pm-repair-sam" class="launch-button" hidden>REPAIR AIR DEFENSE SITE</button>
                <button type="button" id="pm-issue-command" class="launch-button">ISSUE ORDER</button>
            </div>
            <div id="air-command-controls" hidden>
                <p class="cargo-note">Direct flight commands</p>
                <button type="button" id="pm-air-rtb" class="launch-button">RTB // NEAREST FRIENDLY BASE</button>
                <button type="button" id="pm-air-attack" class="secondary-button">ATTACK TARGET // PICK ON MAP</button>
                <button type="button" id="pm-air-refuel" class="secondary-button">REQUEST AERIAL REFUELING</button>
                <fieldset id="flight-control-console">
                    <legend>FLIGHT CONTROL CONSOLE</legend>
                    <label>Command altitude (ft)<input id="pm-flight-altitude" type="number" step="1000"></label>
                    <button type="button" id="pm-set-altitude" class="secondary-button">SET ALTITUDE</button>
                    <button type="button" id="pm-pick-route" class="secondary-button">SET ROUTE WAYPOINT // MAP</button>
                </fieldset>
            </div>
            <div id="signal-controls" hidden>
                <p id="signal-description" class="mission-status"></p>
                <label>Departure airfield<select id="signal-base"></select></label>
                <label>Response aircraft<select id="signal-aircraft"></select></label>
                <button type="button" id="signal-dispatch" class="launch-button">DISPATCH RESPONSE</button>
                <p id="signal-feedback" role="status" aria-live="polite"></p>
            </div>
            <p id="unit-readonly" class="cargo-note" hidden>Air packages are following their assigned mission route.</p>`;
        panel.querySelector('#unit-readonly').insertAdjacentHTML('beforebegin', '<p id="unit-details" class="unit-details" hidden></p>');
        document.body.appendChild(panel);

        panel.querySelector('#close-mission-panel').addEventListener('click', () => this.hide());
        panel.querySelector('#pm-aircraft').addEventListener('change', () => this.refreshMissionOptions());
        panel.querySelector('#pm-type').addEventListener('change', () => this.refreshTargets());
        panel.querySelector('#pm-pick-area').addEventListener('click', () => {
            this.waitingForMapTarget = true;
            this.showFeedback('Click a map location or visible entity to select the mission destination.');
        });
        panel.querySelector('#pm-launch-btn').addEventListener('click', () => this.handleLaunch());
        panel.querySelector('#pm-issue-command').addEventListener('click', () => this.handleUnitCommand());
        panel.querySelector('#fob-attack-count').addEventListener('input', () => this.updateFobForceAllocation());
        panel.querySelector('#fob-attack-btn').addEventListener('click', () => this.handleFobAttack());
        panel.querySelector('#pm-repair-sam').addEventListener('click', () => this.handleUnitCommand());
        panel.querySelector('#pm-air-rtb').addEventListener('click', () => this.issueAirCommand('RTB'));
        panel.querySelector('#pm-air-attack').addEventListener('click', () => {
            this.waitingForMapTarget = true;
            this.pendingUnitCommand = 'ATTACK';
            this.showFeedback('Click an opposing aircraft, ground unit, or air-defense site.');
        });
        panel.querySelector('#pm-air-refuel').addEventListener('click', () => this.issueAirCommand('REFUEL'));
        panel.querySelector('#pm-set-altitude').addEventListener('click', () => {
            const altitude = Number(document.getElementById('pm-flight-altitude').value);
            const success = this.callbacks.onAltitudeCommand?.(this.currentUnit, altitude);
            this.showFeedback(success
                ? `Altitude command set for ${this.currentUnit.id}.`
                : 'Unable to set the requested altitude.', !success);
        });
        panel.querySelector('#pm-pick-route').addEventListener('click', () => {
            this.waitingForMapTarget = true;
            this.pendingUnitCommand = 'ROUTE';
            this.showFeedback('Click the map to set a waypoint; the flight will then return to base.');
        });
        panel.querySelector('#signal-dispatch').addEventListener('click', () => this.handleSignalDispatch());
        panel.querySelector('#signal-base').addEventListener('change', () => this.updateSignalAircraftOptions());
    }

    showAirfield(airfield, airUnits = []) {
        this.currentAirfield = airfield;
        this.currentUnit = null;
        this.currentForwardBase = null;
        this.waitingForMapTarget = false;
        this.mapTarget = null;
        this.airUnits = airUnits;
        this.callbacks.onSelectionChange?.(airfield);

        const state = this.manager.getState(airfield.id);
        document.getElementById('panel-entity-name').textContent = `BASE: ${airfield.name}`;
        document.getElementById('panel-entity-status').textContent =
            `SIDE: ${state.owner.toUpperCase()} // AIRFRAMES READY / MAINT: ${state.stock.airframesReady}/${state.stock.airframesMaintenance}` +
            ` // STOCK: ${this.formatStock(state.stock)}`;
        document.getElementById('unit-details').hidden = true;
        document.getElementById('base-aircraft-roster')?.remove();
        document.getElementById('pm-repair-sam').hidden = true;
        document.getElementById('multi-base-option').hidden =
            airfield.category === 'CARRIER' || airfield.id === 'UGTB';
        document.getElementById('pm-multi-base').checked = false;
        document.getElementById('pm-target-label').textContent = 'Target';
        this.setControlMode('mission');
        this.populateAircraft(state.owner);
        this.refreshMissionOptions();
        const roster = (this.manager.getAircraftRoster?.(airfield.id, state.owner) || [])
            .filter(aircraft => airfield.id !== 'UGTB' ||
                ['LOGISTICS', 'TROOP_TRANSPORT'].some(mission =>
                    this.manager.getMissionTypes(aircraft).includes(mission)
                ));
        const table = document.createElement('table');
        table.id = 'base-aircraft-roster';
        table.className = 'base-aircraft-roster';
        const head = document.createElement('thead');
        const header = document.createElement('tr');
        for (const label of ['Aircraft', 'Ready', 'Maint.']) {
            const cell = document.createElement('th');
            cell.textContent = label;
            header.append(cell);
        }
        head.append(header);
        const body = document.createElement('tbody');
        for (const aircraft of roster) {
            const row = document.createElement('tr');
            for (const value of [
                aircraft.name,
                aircraft.ready === Infinity ? '∞' : String(aircraft.ready),
                aircraft.maintenance === Infinity ? '∞' : String(aircraft.maintenance)
            ]) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            body.append(row);
        }
        table.append(head, body);
        document.getElementById('panel-entity-status').after(table);
        document.getElementById('mission-feedback').textContent = '';
        this.show();
    }

    showUnit(unit) {
        this.currentAirfield = null;
        this.currentUnit = unit;
        this.currentForwardBase = null;
        this.waitingForMapTarget = false;
        this.callbacks.onSelectionChange?.(unit);

        document.getElementById('panel-entity-name').textContent = `UNIT: ${unit.name || unit.id}`;
        document.getElementById('panel-entity-status').textContent =
            `${unit.id} // ${unit.side.toUpperCase()} // ${unit.order?.type || unit.mission?.type || 'READY'}`;
        document.getElementById('base-aircraft-roster')?.remove();
        const detail = document.getElementById('unit-details');
        const readonlyText = unit.branch === 'survivor'
            ? 'Survivor awaiting recovery; dispatch a CSAR-capable helicopter.'
            : unit.side !== 'blue'
                ? 'Opposing unit // read-only intelligence.'
                : 'Air package is following its assigned mission route.';
        document.getElementById('unit-readonly').textContent = readonlyText;
        document.getElementById('pm-repair-sam').hidden = unit.branch !== 'sam' ||
            unit.side !== 'blue' || unit.operational;
        const groupControls = document.getElementById('ground-group-controls');
        const sameFobGroup = unit.branch === 'army' && unit.side === 'blue' && Boolean(unit.fobId);
        const groupForces = sameFobGroup
            ? this.airUnits.filter(candidate =>
                candidate.branch === 'army' && candidate.side === unit.side &&
                candidate.fobId === unit.fobId
            )
            : [];
        groupControls.hidden = !sameFobGroup;
        document.getElementById('pm-same-fob-group').checked = false;
        document.getElementById('ground-group-summary').textContent = sameFobGroup
            ? `${unit.fobId} // ${groupForces.length} units // ` +
                `${groupForces.reduce((total, force) => total + (force.personnelStrength || 0), 0).toLocaleString()} personnel // ` +
                `${groupForces.reduce((total, force) => total + (force.vehicleStrength || 0), 0).toLocaleString()} vehicles`
            : '';
        document.getElementById('multi-base-option').hidden = true;
        document.getElementById('pm-pick-area').hidden = true;
        detail.textContent = this.getUnitDetails(unit);
        detail.hidden = false;
        const altitudeInput = document.getElementById('pm-flight-altitude');
        const aircraftAltitude = unit.branch === 'airforce'
            ? this.manager.getAircraftType(unit.side, unit.aircraft)?.altitude
            : null;
        altitudeInput.min = aircraftAltitude?.min ?? 0;
        altitudeInput.max = aircraftAltitude?.max ?? 60000;
        altitudeInput.value = Math.round(unit.currentAltitudeFt || unit.altitude?.cruise || 0);
        altitudeInput.disabled = !aircraftAltitude;
        document.getElementById('pm-set-altitude').disabled = !aircraftAltitude;
        document.getElementById('pm-pick-route').disabled = !unit.mission?.departureId ||
            ['TANKER', 'EARLY_WARNING', 'RTB', 'AAR_RENDEZVOUS'].includes(unit.mission?.type);
        document.getElementById('pm-target-label').textContent = 'Target';
        const commandSelect = document.getElementById('pm-unit-command');
        const choices = unit.side !== 'blue' ? [] : unit.branch === 'navy'
            ? [['MOVE', 'SAIL TO WAYPOINT'], ['DEFEND', 'HOLD POSITION']]
            : unit.branch === 'army'
                ? [['MOVE', 'MOVE TO WAYPOINT'], ['DEFEND', 'DEFEND POSITION']]
                : [];
        commandSelect.replaceChildren(...choices.map(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            return option;
        }));
        this.setControlMode(
            unit.branch === 'sam' && unit.side === 'blue' ? 'unit' :
                unit.side !== 'blue' || unit.branch === 'airforce' ||
                unit.branch === 'survivor' || unit.branch === 'sam' ? 'readonly' : 'unit'
        );
        if (unit.branch === 'sam' && unit.side === 'blue') {
            const select = document.getElementById('pm-unit-command');
            const option = document.createElement('option');
            option.value = 'REPAIR';
            option.textContent = 'REPAIR SITE // SPARE PARTS';
            select.replaceChildren(option);
            document.getElementById('unit-controls').hidden = false;
            document.getElementById('pm-issue-command').hidden = true;
            document.getElementById('pm-repair-sam').hidden = unit.operational;
        } else {
            document.getElementById('pm-issue-command').hidden = false;
        }
        this.show();
    }

    showForwardBase(base, units) {
        this.currentAirfield = null;
        this.currentUnit = null;
        this.currentForwardBase = base;
        this.currentSignal = null;
        this.airUnits = units;
        this.waitingForMapTarget = false;
        this.callbacks.onSelectionChange?.(null);
        document.getElementById('base-aircraft-roster')?.remove();
        document.getElementById('unit-details').hidden = true;
        document.getElementById('panel-entity-name').textContent = `FOB: ${base.name}`;
        this.setControlMode('forward-base');
        this.refreshForwardBase(units, this.manager.getForwardBaseState(base.id));
        document.getElementById('fob-feedback').textContent = '';
        this.show();
    }

    refreshForwardBase(units = this.airUnits, state = this.manager.getForwardBaseState(this.currentForwardBase.id)) {
        if (!this.currentForwardBase) return;
        const base = this.currentForwardBase;
        const stationed = units.filter(unit =>
            unit.branch === 'army' && unit.fobId === base.id &&
            Math.hypot(unit.lat - base.lat, (unit.lng - base.lng) *
                Math.cos(base.lat * Math.PI / 180)) * 111.32 <= 12 &&
            unit.condition > 0 && !unit.route?.length && !unit.routePending
        );
        const personnel = stationed.reduce((total, unit) => total + (unit.personnelStrength || 0), 0);
        const vehicles = stationed.reduce((total, unit) => total + (unit.vehicleStrength || 0), 0);
        const blueStock = state.stockBySide?.blue || {};
        const redStock = state.stockBySide?.red || {};
        const targetSelect = document.getElementById('fob-attack-target');
        const selectedTargetId = targetSelect.value;
        const targets = this.callbacks.getGroundTargets?.(base) || [];
        targetSelect.replaceChildren(...targets.map(target => {
            const option = document.createElement('option');
            option.value = target.id;
            option.textContent = `${target.name} [${target.side.toUpperCase()}]`;
            option.dataset.kind = target.kind || 'AIRFIELD';
            return option;
        }));
        if (targets.some(target => target.id === selectedTargetId)) targetSelect.value = selectedTargetId;
        document.getElementById('panel-entity-status').textContent =
            `OWNER: ${state.owner.toUpperCase()} // GROUND UNITS: ${stationed.length}`;
        document.getElementById('fob-force-summary').textContent =
            `${stationed.length} ready platoon(s) // ${personnel.toLocaleString()} personnel // ` +
            `${vehicles.toLocaleString()} vehicles // BLUE STOCK: ${blueStock.personnel || 0} personnel / ` +
            `${blueStock.supplies || 0} supplies / ${blueStock.fuel || 0} fuel // ` +
            `RED STOCK: ${redStock.personnel || 0} personnel / ${redStock.supplies || 0} supplies`;
        const countInput = document.getElementById('fob-attack-count');
        countInput.max = String(stationed.length);
        countInput.disabled = state.owner !== 'blue' || stationed.length === 0;
        if (Number(countInput.value) > stationed.length) countInput.value = String(stationed.length);
        this.updateFobForceAllocation(stationed.length);
        document.getElementById('fob-attack-btn').disabled =
            state.owner !== 'blue' || stationed.length === 0 || targets.length === 0;
    }

    updateFobForceAllocation(available) {
        const countInput = document.getElementById('fob-attack-count');
        const maximum = available ?? Number(countInput.max);
        const attacking = Math.min(maximum, Number(countInput.value) || 0);
        countInput.value = String(attacking);
        document.getElementById('fob-force-allocation').textContent =
            `${maximum - attacking} platoon(s) remain at this FOB // ${attacking} platoon(s) assigned to attack.`;
        document.getElementById('fob-attack-btn').disabled =
            !this.currentForwardBase ||
            this.manager.getForwardBaseState(this.currentForwardBase.id).owner !== 'blue' ||
            maximum === 0 || attacking === 0 ||
            !document.getElementById('fob-attack-target').options.length;
    }

    handleFobAttack() {
        if (!this.currentForwardBase) return;
        const select = document.getElementById('fob-attack-target');
        const target = (this.callbacks.getGroundTargets?.(this.currentForwardBase) || [])
            .find(item => item.id === select.value);
        const result = this.callbacks.onFobAttack?.(
            this.currentForwardBase,
            target,
            Number(document.getElementById('fob-attack-count').value)
        );
        document.getElementById('fob-feedback').textContent =
            result?.message || 'Attack order could not be assigned.';
        if (result?.success) {
            document.getElementById('fob-attack-count').value = '0';
            this.refreshForwardBase();
        }
    }

    getUnitDetails(unit) {
        const type = unit.branch === 'airforce' ? this.manager.getAircraftType(unit.side, unit.aircraft) : null;
        const weapons = type?.payload?.compatibleWeapons?.join(', ') || 'N/A';
        const groundStrength = unit.branch === 'army'
            ? `PERSONNEL: ${(unit.personnelStrength || 0).toLocaleString()} // VEHICLES: ${(unit.vehicleStrength || 0).toLocaleString()} // ` +
                `TANKS: ${unit.vehicleManifest?.tanks || 0} / APC: ${unit.vehicleManifest?.infantryCarriers || 0} / ` +
                `ARTILLERY: ${unit.vehicleManifest?.selfPropelledArtillery || 0} / SUPPORT: ${unit.vehicleManifest?.supportVehicles || 0}`
            : null;
        return [
            `TYPE: ${unit.aircraft || unit.name || unit.branch.toUpperCase()}`,
            `MISSION: ${unit.mission?.type || unit.order?.type || 'HOLD'}`,
            `FORMATION: ${unit.formationSize || 1}`,
            ...(groundStrength ? [groundStrength] : []),
            `ALTITUDE: ${Math.round(unit.currentAltitudeFt || 0).toLocaleString()} ft`,
            `FUEL: ${Math.round(unit.fuel || 0)}% // AMMUNITION: ${unit.ammo || 0}`,
            `COUNTERMEASURES: CHAFF ${unit.countermeasures?.chaff ?? 0} / FLARES ${unit.countermeasures?.flares ?? 0}`,
            `CONDITION: ${Math.round(unit.condition || 0)}%`,
            `AVAILABLE WEAPONS: ${weapons}`
        ].join(' | ');
    }

    refreshSelectedUnit() {
        if (this.currentUnit?.branch !== 'airforce') return;
        document.getElementById('unit-details').textContent = this.getUnitDetails(this.currentUnit);
        if (document.activeElement !== document.getElementById('pm-flight-altitude')) {
            document.getElementById('pm-flight-altitude').value =
                Math.round(this.currentUnit.currentAltitudeFt || 0);
        }
    }

    populateAircraft(side) {
        const select = document.getElementById('pm-aircraft');
        const previous = select.value;
        const roster = this.manager.getAircraftRoster?.(this.currentAirfield.id, side) || [];
        const aircraft = roster
            .filter(unit => unit.ready > 0) || this.callbacks.getAircraft(side, this.currentAirfield);
        const available = aircraft.filter(unit => this.currentAirfield.id !== 'UGTB' ||
            ['LOGISTICS', 'TROOP_TRANSPORT'].some(mission =>
                this.manager.getMissionTypes(unit).includes(mission)
            ));
        select.replaceChildren(...available.map(unit => {
            const option = document.createElement('option');
            option.value = unit.typeId;
            option.textContent = `${unit.name} [${unit.branch.toUpperCase()}]`;
            return option;
        }));
        if (available.some(unit => unit.typeId === previous)) select.value = previous;
    }

    refreshMissionOptions() {
        const side = this.manager.getState(this.currentAirfield.id).owner;
        const aircraft = this.callbacks.getAircraft(side, this.currentAirfield).find(unit =>
            unit.typeId === document.getElementById('pm-aircraft').value
        );
        const select = document.getElementById('pm-type');
        const previous = select.value;
        let missionTypes = aircraft ? this.manager.getMissionTypes(aircraft) : [];
        if (this.currentAirfield.id === 'UGTB') {
            missionTypes = missionTypes.filter(type => ['LOGISTICS', 'TROOP_TRANSPORT'].includes(type));
        }
        select.replaceChildren(...missionTypes.map(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.replaceAll('_', ' ');
            return option;
        }));
        if (missionTypes.includes(previous)) select.value = previous;
        this.refreshTargets();
        this.updateCargoControls(aircraft);
        const missionType = document.getElementById('pm-type').value;
        const requiresEscort = missionType === 'STRIKE' &&
            aircraft?.tasks?.some(task => [
                'STRATEGIC_BOMBING', 'CARPET_BOMBING', 'STEALTH_BOMBING', 'DEEP_STRIKE'
            ].includes(task));
        document.getElementById('escort-support-option').hidden = !requiresEscort;
        if (!requiresEscort) document.getElementById('pm-escort-support').checked = false;
        document.getElementById('pm-pick-area').hidden =
            ['LOGISTICS', 'TROOP_TRANSPORT', 'TRANSPORT', 'EARLY_WARNING', 'TANKER'].includes(missionType) || !missionType;
        document.getElementById('multi-base-option').hidden =
            this.currentAirfield.id === 'UGTB' || this.currentAirfield.category === 'CARRIER' ||
            ['LOGISTICS', 'TROOP_TRANSPORT'].includes(missionType);
    }

    refreshTargets() {
        if (!this.currentAirfield) return;
        const side = this.manager.getState(this.currentAirfield.id).owner;
        const targets = this.manager.getTargets(
            this.currentAirfield.id,
            document.getElementById('pm-type').value,
            side,
            this.airUnits
        );
        if (this.mapTarget &&
            !['LOGISTICS', 'TROOP_TRANSPORT', 'TRANSPORT', 'EARLY_WARNING', 'TANKER'].includes(document.getElementById('pm-type').value)) {
            targets.push(this.mapTarget);
        }
        const select = document.getElementById('pm-target');
        document.getElementById('pm-target-label').textContent =
            ['LOGISTICS', 'TROOP_TRANSPORT', 'TRANSPORT'].includes(document.getElementById('pm-type').value)
                ? 'Destination'
                : 'Target';
        const previous = select.value;
        select.replaceChildren(...targets.map(target => {
            const option = document.createElement('option');
            option.value = target.id;
            option.textContent = `${target.name} [${target.side.toUpperCase()}]`;
            return option;
        }));
        if (targets.some(target => target.id === previous)) select.value = previous;
    }

    updateCargoControls(aircraft) {
        const type = document.getElementById('pm-type').value;
        const cargoControls = document.getElementById('cargo-controls');
        const isLogistics = type === 'LOGISTICS' || type === 'TROOP_TRANSPORT';
        cargoControls.hidden = !isLogistics;
        document.getElementById('pm-supplies').disabled =
            !aircraft?.payload?.cargoCapacity?.suppliesKg || type === 'TROOP_TRANSPORT';
        for (const id of ['pm-fuel', 'pm-airframes', 'pm-spare-parts']) {
            document.getElementById(id).disabled =
                !aircraft?.payload?.cargoCapacity?.suppliesKg || type === 'TROOP_TRANSPORT';
        }

        document.getElementById('pm-personnel').disabled =
            !aircraft?.payload?.cargoCapacity?.personnel || type === 'LOGISTICS';
        document.getElementById('pm-count').disabled = Boolean(isLogistics);
        if (isLogistics) document.getElementById('pm-count').value = '1';
    }

    setMapTarget(target) {
        this.waitingForMapTarget = false;
        const missionType = document.getElementById('pm-type').value;
        const targetId = ['CAP', 'SWEEP_CAP', 'CAS', 'TANKER'].includes(missionType)
            ? `AREA:CUSTOM:${Date.now()}`
            : `MAP:CUSTOM:${Date.now()}`;
        this.mapTarget = Number.isFinite(target.lat) && Number.isFinite(target.lng)
            ? {
                id: target.id || targetId,
                name: target.name || `Map point ${target.lat.toFixed(2)}, ${target.lng.toFixed(2)}`,
                lat: target.lat,
                lng: target.lng,
                side: target.side || 'contested',
                unit: target.unit
            }
            : null;
        if (!this.mapTarget) {
            this.showFeedback('ERROR: Selected map target has no valid coordinates.', true);
            return;
        }
        if (this.pendingUnitCommand === 'ATTACK') {
            const selectedTarget = this.mapTarget;
            this.pendingUnitCommand = null;
            this.waitingForMapTarget = false;
            const success = this.callbacks.onAirCommand?.(this.currentUnit, 'ATTACK', selectedTarget);
            this.showFeedback(success
                ? `Attack order assigned to ${this.currentUnit.id}.`
                : `Unable to assign an attack order to ${this.currentUnit.id}.`, !success);
            return;
        }
        if (this.pendingUnitCommand === 'ROUTE') {
            this.pendingUnitCommand = null;
            const success = this.callbacks.onAirRoute?.(this.currentUnit, this.mapTarget);
            this.showFeedback(success
                ? `Waypoint assigned to ${this.currentUnit.id}.`
                : `Unable to assign a waypoint to ${this.currentUnit.id}.`, !success);
            return;
        }
        this.refreshTargets();
        document.getElementById('pm-target').value = this.mapTarget.id;
        this.showFeedback(`Mission destination selected: ${this.mapTarget.name}`);
    }

    setAirUnits(units) {
        this.airUnits = units;
        if (this.currentAirfield) this.refreshTargets();
    }

    async handleLaunch() {
        if (!this.currentAirfield) return;
        const aircraft = document.getElementById('pm-aircraft').value;
        const missionType = document.getElementById('pm-type').value;
        const targetId = document.getElementById('pm-target').value;
        const target = [
            ...this.manager.getTargets(
            this.currentAirfield.id,
            missionType,
            this.manager.getState(this.currentAirfield.id).owner,
            this.airUnits
            ),
            ...(this.mapTarget &&
                !['LOGISTICS', 'TROOP_TRANSPORT', 'EARLY_WARNING'].includes(missionType)
                ? [this.mapTarget]
                : [])
        ].find(item => item.id === targetId);
        if (!target) {
            this.showFeedback('ERROR: Select a valid target for this mission.', true);
            return;
        }

        const result = await this.callbacks.onLaunch({
            aircraft,
            missionType,
            count: document.getElementById('pm-count').value,
            target,
            airUnits: this.airUnits,
            multiBase: document.getElementById('pm-multi-base').checked,
            escortSupport: document.getElementById('pm-escort-support').checked,
            cargo: {
                supplies: missionType === 'LOGISTICS' ? document.getElementById('pm-supplies').value : 0,
                personnel: missionType === 'TROOP_TRANSPORT' ? document.getElementById('pm-personnel').value : 0,
                fuel: missionType === 'LOGISTICS' ? document.getElementById('pm-fuel').value : 0,
                airframes: missionType === 'LOGISTICS' ? document.getElementById('pm-airframes').value : 0,
                spareParts: missionType === 'LOGISTICS' ? document.getElementById('pm-spare-parts').value : 0
            }
        });
        this.showFeedback(result.message, !result.success);
        if (result.success) this.hide();
    }

    handleUnitCommand() {
        if (!this.currentUnit) return;
        const command = document.getElementById('pm-unit-command').value;
        if (command === 'REPAIR') {
            const result = this.callbacks.onRepairSAM?.(this.currentUnit);
            this.showFeedback(result?.message || 'SAM repair failed.', !result?.success);
            if (result?.success) this.showUnit(this.currentUnit);
            return;
        }
        this.currentUnit.order = { type: command, issuedAt: Date.now() };
        const group = this.callbacks.onUnitCommand?.(
            this.currentUnit,
            command,
            document.getElementById('pm-same-fob-group').checked
        );
        const controlledCount = Array.isArray(group) ? group.length : 1;
        if (command !== 'MOVE') {
            this.showFeedback(`${command} order assigned to ${controlledCount} unit(s) at ${this.currentUnit.fobId || 'selected position'}.`);
        } else {
            this.showFeedback(`MOVE selected for ${controlledCount} unit(s). Click a map destination.`);
        }
        document.getElementById('panel-entity-status').textContent =
            `${this.currentUnit.id} // ${this.currentUnit.side.toUpperCase()} // ${command}`;
    }

    issueAirCommand(command) {
        const success = this.callbacks.onAirCommand?.(this.currentUnit, command);
        this.showFeedback(success
            ? `${command} order assigned to ${this.currentUnit.id}.`
            : `${command} request could not be completed.`, !success);
    }

    showSignal(signal, bases, aircraft) {
        this.currentSignal = signal;
        this.currentAirfield = null;
        this.currentUnit = null;
        this.currentForwardBase = null;
        this.waitingForMapTarget = false;
        this.callbacks.onSelectionChange?.(null);
        document.getElementById('panel-entity-name').textContent =
            signal.type === 'CAS' ? 'CAS SUPPORT REQUEST' : 'DISTRESS / CSAR SIGNAL';
        document.getElementById('panel-entity-status').textContent =
            `${signal.side.toUpperCase()} // ${signal.lat.toFixed(2)}, ${signal.lng.toFixed(2)}`;
        document.getElementById('signal-description').textContent =
            signal.type === 'CAS'
                ? 'Select an A-10C or AH-64E and a friendly departure base.'
                : 'Select a CSAR-capable aircraft and a friendly departure base.';
        const baseSelect = document.getElementById('signal-base');
        baseSelect.replaceChildren(...bases.map(base => {
            const option = document.createElement('option');
            option.value = base.id;
            option.textContent = base.name;
            return option;
        }));
        const missionType = signal.type === 'CAS' ? 'CAS' : 'CSAR';
        this.signalAircraftTypes = aircraft.filter(type =>
            this.manager.getMissionTypes(type).includes(missionType) &&
            (signal.type !== 'CAS' || ['A-10C', 'AH-64E'].includes(type.typeId))
        );
        this.updateSignalAircraftOptions();
        document.getElementById('signal-dispatch').disabled = bases.length === 0;
        this.setControlMode('signal');
        this.show();
    }

    updateSignalAircraftOptions() {
        if (!this.currentSignal) return;
        const baseId = document.getElementById('signal-base').value;
        const side = baseId ? this.manager.getState(baseId).owner : 'blue';
        const roster = baseId ? this.manager.getAircraftRoster?.(baseId, side) || [] : [];
        const readyIds = new Set(
            roster
                .filter(type => type.ready > 0)
                .map(type => type.typeId) || []
        );
        const available = (this.signalAircraftTypes || []).filter(type => readyIds.has(type.typeId));
        const aircraftSelect = document.getElementById('signal-aircraft');
        aircraftSelect.replaceChildren(...available.map(type => {
            const option = document.createElement('option');
            option.value = type.typeId;
            option.textContent = type.name;
            return option;
        }));
        document.getElementById('signal-dispatch').disabled = !baseId || available.length === 0;
    }

    handleSignalDispatch() {
        if (!this.currentSignal || !document.getElementById('signal-base').value ||
            !document.getElementById('signal-aircraft').value) return;
        const missionType = this.currentSignal.type === 'CAS' ? 'CAS' : 'CSAR';
        const unit = this.airUnits.find(candidate => candidate.id === this.currentSignal.unitId);
        const target = missionType === 'CSAR'
            ? unit && {
                id: unit.id,
                name: unit.name,
                lat: unit.lat,
                lng: unit.lng,
                side: unit.side,
                unit
            }
            : {
                id: `AREA:CUSTOM:${this.currentSignal.id}`,
                name: `CAS REQUEST // ${this.currentSignal.unitId}`,
                lat: this.currentSignal.lat,
                lng: this.currentSignal.lng,
                side: 'contested'
            };
        if (!target) {
            document.getElementById('signal-feedback').textContent =
                'The survivor is no longer available.';
            return;
        }
        const result = this.callbacks.onQuickLaunch?.({
            departureId: document.getElementById('signal-base').value,
            aircraft: document.getElementById('signal-aircraft').value,
            missionType,
            target,
            signalUnitId: this.currentSignal.unitId,
            signalId: this.currentSignal.id,
            count: 1
        });
        document.getElementById('signal-feedback').textContent =
            result?.message || 'Launch request failed.';
        if (result?.success) this.hide();
    }

    setControlMode(mode) {
        document.getElementById('mission-controls').hidden = mode !== 'mission';
        document.getElementById('unit-controls').hidden = mode !== 'unit';
        document.getElementById('unit-readonly').hidden = mode !== 'readonly';
        document.getElementById('air-command-controls').hidden =
            mode !== 'readonly' || !this.currentUnit ||
            this.currentUnit.branch !== 'airforce' || this.currentUnit.side !== 'blue' ||
            !this.currentUnit.mission?.departureId;
        document.getElementById('signal-controls').hidden = mode !== 'signal';
        document.getElementById('forward-base-controls').hidden = mode !== 'forward-base';
    }

    formatStock(stock) {
        const supplies = Number.isFinite(stock.supplies) ? stock.supplies.toLocaleString() : '∞';
        const personnel = Number.isFinite(stock.personnel) ? stock.personnel.toLocaleString() : '∞';
        const fuel = Number.isFinite(stock.fuel) ? stock.fuel.toLocaleString() : '∞';
        const airframes = Number.isFinite(stock.airframes) ? stock.airframes.toLocaleString() : '∞';
        const parts = Number.isFinite(stock.spareParts) ? stock.spareParts.toLocaleString() : '∞';
        return `${supplies} SUPPLIES / ${personnel} PERSONNEL / ${fuel} FUEL / ${airframes} AIRFRAMES / ${parts} PARTS`;
    }

    showFeedback(message, isError = false) {
        const feedback = document.getElementById('mission-feedback');
        feedback.textContent = message;
        feedback.dataset.error = String(isError);
    }

    show() {
        const panel = document.getElementById('tactical-mission-panel');
        panel.hidden = false;
        panel.classList.add('visible');
    }

    hide() {
        const panel = document.getElementById('tactical-mission-panel');
        panel.hidden = true;
        panel.classList.remove('visible');
        this.currentAirfield = null;
        this.currentUnit = null;
        this.currentForwardBase = null;
        this.currentSignal = null;
        this.waitingForMapTarget = false;
        this.pendingUnitCommand = null;
        this.callbacks.onSelectionChange?.(null);
    }
}
