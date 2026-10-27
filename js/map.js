import { CAUCASUS_AIRFIELDS } from './airfields.js/index.js';

export const FORWARD_BASES = [
    { id: 'FOB-WEST', name: 'West Ridge FOB', lat: 43.56, lng: 40.55, owner: 'red' },
    { id: 'FOB-CENTER', name: 'Central Pass FOB', lat: 43.02, lng: 42.24, owner: 'blue' },
    { id: 'FOB-EAST', name: 'East Valley FOB', lat: 42.56, lng: 43.78, owner: 'blue' },
    { id: 'FOB-NORTH', name: 'North Ridge FOB', lat: 44.12, lng: 41.06, owner: 'red' },
    { id: 'FOB-SOUTH', name: 'South Ridge FOB', lat: 42.72, lng: 40.82, owner: 'blue' },
    { id: 'FOB-UPPER-PASS', name: 'Upper Pass FOB', lat: 43.78, lng: 42.02, owner: 'red' },
    { id: 'FOB-KUTAISI', name: 'Kutaisi Approach FOB', lat: 42.18, lng: 42.58, owner: 'blue' },
    { id: 'FOB-TBILISI', name: 'Tbilisi Approach FOB', lat: 42.02, lng: 44.28, owner: 'blue' },
    { id: 'FOB-EAST-RIDGE', name: 'East Ridge FOB', lat: 42.92, lng: 43.28, owner: 'red' }
];

export class StrategicMap {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`[MAP_ERROR] Container #${containerId} not found.`);
        }

        this.leaflet = globalThis.L;
        if (!this.leaflet) {
            throw new Error('[MAP_ERROR] Leaflet failed to load.');
        }

        this.map = this.leaflet.map(containerId, {
            center: [43.8, 41.5],
            zoom: 7,
            zoomControl: true,
            attributionControl: true
        });

        const status = document.getElementById('map-status');
        const tileLayer = this.leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abc'
        }).addTo(this.map);
        tileLayer.on('loading', () => {
            if (status) {
                status.hidden = false;
                status.textContent = 'LOADING MAP TILES...';
            }
        });
        tileLayer.on('load', () => {
            if (status) status.hidden = true;
        });
        tileLayer.on('tileerror', () => {
            if (status) {
                status.hidden = false;
                status.textContent = 'MAP TILES UNAVAILABLE - CHECK INTERNET CONNECTION';
            }
        });

        this.layerGroup = this.leaflet.layerGroup().addTo(this.map);
        this.routeLayer = this.leaflet.layerGroup().addTo(this.map);
        this.unitLayer = this.leaflet.layerGroup().addTo(this.map);
        this.airspaceLayer = this.leaflet.layerGroup().addTo(this.map);
        this.signalLayer = this.leaflet.layerGroup().addTo(this.map);
        this.unitRoutes = new Map();
        this.signals = new Map();
        this.airfields = CAUCASUS_AIRFIELDS;

        this.onAirfieldClick = null;
        this.onForwardBaseClick = null;
        this.onUnitClick = null;
        this.onMapClick = null;
        this.onSignalClick = null;
        this.selectedEntity = null;
        this.map.on('click', event => this.onMapClick?.(event.latlng));
        this.map.on('zoomend', () => this.updateUnitScale());
        this.renderMapElements();
        this.updateUnitScale();

        setTimeout(() => {
            this.map.invalidateSize();
        }, 150);
    }

    resize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }

    setAirfieldOwners(states) {
        this.airfields.forEach(airfield => {
            airfield.owner = states[airfield.id].owner;
        });
        this.renderMapElements();
    }

    renderMapElements() {
        if (!this.layerGroup) return;
        this.layerGroup.clearLayers();

        this.airfields.forEach(af => {
            const afHtml = `
                <div style="
                    position: relative;
                    width: 8px;
                    height: 8px;
                    background: #030712;
                    border: 2px solid ${(af.owner || af.side) === 'red' ? '#ef4444' : (af.owner || af.side) === 'neutral' ? '#facc15' : '#38bdf8'};
                    border-radius: 50%;
                    box-shadow: 0 0 6px ${(af.owner || af.side) === 'red' ? 'rgba(239, 68, 68, 0.6)' : (af.owner || af.side) === 'neutral' ? 'rgba(250, 204, 21, 0.6)' : 'rgba(56, 189, 248, 0.6)'};
                    cursor: pointer;
                ">
                    <span aria-hidden="true" style="
                        position: absolute;
                        left: 14px;
                        top: -2px;
                        white-space: nowrap;
                        pointer-events: none;
                        font-family: 'Courier New', monospace;
                        font-size: 10px;
                        color: #94a3b8;
                        text-shadow: 0 0 3px #000, 0 0 3px #000;
                    ">${af.name}</span>
                </div>
            `;

            const afIcon = this.leaflet.divIcon({
                className: 'airfield-node-icon',
                html: afHtml,
                iconSize: [8, 8],
                iconAnchor: [4, 4]
            });

            const marker = this.leaflet.marker([af.lat, af.lng], {
                icon: afIcon,
                title: af.name,
                alt: af.name,
                zIndexOffset: 300
            });
            
            // 空港クリック時にミッションパネルを開くコールバック
            marker.on('click', () => {
                this.onAirfieldClick?.(af);
            });

            this.layerGroup.addLayer(marker);

            if (af.hqFixed) {
                const color = af.side === 'red' ? '#ef4444' : '#3b82f6';
                this.addHQMarker(af.lat, af.lng, af.hqFixed, color);
            }
        });
        this.renderForwardBases();
    }

    renderForwardBases() {
        FORWARD_BASES.forEach(base => {
            const icon = this.leaflet.divIcon({
                className: 'fob-marker',
                html: `<div class="fob-label" title="${base.name}" style="--fob-color:${base.owner === 'red' ? '#ef4444' : '#38bdf8'}">FOB</div>`,
                iconSize: [24, 16],
                iconAnchor: [12, 8]
            });
            const marker = this.leaflet.marker([base.lat, base.lng], {
                icon,
                title: `${base.name} // ground-force staging`,
                alt: base.name,
                zIndexOffset: 350
            });
            marker.on('click', () => this.onForwardBaseClick?.(base));
            this.layerGroup.addLayer(marker);
        });
    }

    setForwardBaseOwners(states) {
        FORWARD_BASES.forEach(base => {
            if (states[base.id]) base.owner = states[base.id].owner;
        });
        this.renderMapElements();
    }

    updateAirspaceControl(controls) {
        this.airspaceLayer.clearLayers();
        for (const [airfieldId, control] of Object.entries(controls)) {
            const airfield = this.airfields.find(base => base.id === airfieldId);
            if (!airfield) continue;
            const blue = control.blue || 0;
            const red = control.red || 0;
            const color = blue > red ? '#38bdf8' : red > blue ? '#ef4444' : '#facc15';
            this.airspaceLayer.addLayer(this.leaflet.circle([airfield.lat, airfield.lng], {
                radius: 52000,
                color,
                weight: 1,
                opacity: 0.4,
                fillColor: color,
                fillOpacity: 0.07,
                interactive: false
            }));
            const label = this.leaflet.divIcon({
                className: 'airspace-control-label',
                html: `<span style="--airspace-color:${color}">${airfield.id}<br>B ${Math.round(blue)}% / R ${Math.round(red)}%</span>`,
                iconSize: [64, 24],
                iconAnchor: [32, -10]
            });
            this.airspaceLayer.addLayer(this.leaflet.marker([airfield.lat, airfield.lng], {
                icon: label,
                interactive: false,
                keyboard: false
            }));
        }
    }

    addSignal(signal) {
        this.removeSignal(signal.id);
        const color = signal.type === 'CAS' ? '#facc15' : '#fb7185';
        const icon = this.leaflet.divIcon({
            className: `operation-signal operation-signal-${signal.type.toLowerCase()}`,
            html: `<span aria-hidden="true">${signal.type === 'CAS' ? 'CAS' : 'SOS'}</span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });
        const marker = this.leaflet.marker([signal.lat, signal.lng], {
            icon,
            title: signal.type === 'CAS' ? 'CAS support requested' : 'Survivor rescue signal',
            alt: signal.type === 'CAS' ? 'CAS request' : 'Rescue signal',
            zIndexOffset: 1200
        });
        marker.on('click', () => this.onSignalClick?.(signal));
        this.signalLayer.addLayer(marker);
        this.signals.set(signal.id, marker);
        return marker;
    }

    removeSignal(signalId) {
        const marker = this.signals.get(signalId);
        if (!marker) return;
        this.signalLayer.removeLayer(marker);
        this.signals.delete(signalId);
    }

    moveSignal(signalId, lat, lng) {
        this.signals.get(signalId)?.setLatLng([lat, lng]);
    }

    updateUnitScale() {
        const zoomedIn = this.map.getZoom() >= 9;
        const container = this.map.getContainer();
        container.classList.toggle('unit-zoomed-in', zoomedIn);
        container.querySelectorAll('.custom-military-marker').forEach(marker => {
            marker.style.width = zoomedIn ? '70px' : '14px';
            marker.style.height = zoomedIn ? '24px' : '14px';
        });
    }

    addHQMarker(lat, lng, label, color) {
        const hqHtml = `
            <div style="
                background: #030712;
                border: 2px solid ${color};
                color: #fff;
                padding: 6px 10px;
                font-family: 'Courier New', Courier, monospace;
                font-size: 11px;
                font-weight: bold;
                border-radius: 4px;
                box-shadow: 0 0 15px ${color}88;
                text-align: center;
                white-space: nowrap;
            ">
                <div style="font-size: 9px; color: ${color}; letter-spacing: 1px;">HQ // FIXED</div>
                ${label}
            </div>
        `;

        const hqIcon = this.leaflet.divIcon({
            className: 'hq-marker',
            html: hqHtml,
            iconSize: [120, 40],
            iconAnchor: [60, 20]
        });

        const marker = this.leaflet.marker([lat, lng], {
            icon: hqIcon,
            interactive: false
        });
        this.layerGroup.addLayer(marker);
    }

    addUnit(lat, lng, unitData, onClickCallback) {
        const borderColor = unitData.side === 'red' ? '#ef4444' :
                            unitData.branch === 'sam' ? '#f59e0b' :
                            unitData.branch === 'missile' ? '#f97316' :
                            unitData.branch === 'airforce' ? '#38bdf8' :
                            unitData.branch === 'navy' ? '#3b82f6' : '#10b981';

        const silhouette = ['missile', 'munition'].includes(unitData.branch)
            ? '<path d="M3 16l28-6-4 6 4 6z"/><path d="M13 13l-4-7h4l7 6z"/>'
            : unitData.branch === 'sam'
                ? '<path d="M5 25h30v4H5zM10 22l6-14h4l6 14zM23 18l6-10 3 2-5 10z"/>'
                : unitData.branch === 'airforce'
            ? '<path d="M20 2l3 9 10 5v3l-10-2-2 7h-3l-2-7-10 2v-3l10-5 3-9z"/>'
            : unitData.branch === 'navy'
                ? '<path d="M3 17h34l-6 7H10zM15 5h10v10H15zM12 12h16v3H12z"/>'
                : unitData.branch === 'survivor'
                    ? '<circle cx="20" cy="8" r="5"/><path d="M12 28l2-12h12l2 12h-5l-2-7-2 7z"/>'
                    : '<path d="M5 14h23l6 5-6 5H5zM10 10h13v4H10zM12 24h4v5h-4zM25 24h4v5h-4z"/>';
        const displayName = ['missile', 'munition'].includes(unitData.branch)
            ? unitData.missileType || unitData.munitionType || 'WEAPON'
            : unitData.branch === 'sam'
                ? `${unitData.system || 'SAM'}${unitData.operational ? '' : ' // OFFLINE'}`
            : unitData.branch === 'survivor'
            ? 'CSAR // SURVIVOR'
            : unitData.aircraft || unitData.typeId || unitData.name || unitData.id;
        const iconHtml = `
            <div class="unit-map-label" style="--unit-color:${borderColor}" title="${displayName}">
                <svg class="unit-silhouette" viewBox="0 0 40 32" aria-hidden="true">${silhouette}</svg>
                <span>${displayName}</span>
            </div>
        `;

        const customIcon = this.leaflet.divIcon({
            className: 'custom-military-marker',
            html: iconHtml,
            iconSize: [70, 24],
            iconAnchor: [9, 12]
        });

        const marker = this.leaflet.marker([lat, lng], { icon: customIcon, zIndexOffset: -100 });
        
        marker.on('click', () => {
            if (onClickCallback) {
                onClickCallback(unitData);
            } else if (this.onUnitClick) {
                this.onUnitClick(unitData);
            }
        });

        this.unitLayer.addLayer(marker);
        const zoomedIn = this.map.getZoom() >= 9;
        const element = marker.getElement();
        if (element) {
            element.style.width = zoomedIn ? '70px' : '14px';
            element.style.height = zoomedIn ? '24px' : '14px';
        }
        return marker;
    }

    setUnitRoute(unit) {
        const previous = this.unitRoutes.get(unit.id);
        if (previous) {
            this.routeLayer.removeLayer(previous);
            this.unitRoutes.delete(unit.id);
        }
        if (unit.side !== 'blue' || !unit.route?.length ||
            !['airforce', 'army', 'navy'].includes(unit.branch)) return;
        const points = [
            [unit.lat, unit.lng],
            ...unit.route.slice(unit.routeIndex || 0).map(point => [point.lat, point.lng])
        ];
        if (points.length < 2) return;
        const route = this.leaflet.polyline(points, {
            color: unit.branch === 'airforce' ? '#7dd3fc' : '#86efac',
            weight: 1,
            opacity: 0.45,
            dashArray: '2 6',
            interactive: false
        });
        this.routeLayer.addLayer(route);
        this.unitRoutes.set(unit.id, route);
    }

    removeUnitRoute(unitId) {
        const route = this.unitRoutes.get(unitId);
        if (!route) return;
        this.routeLayer.removeLayer(route);
        this.unitRoutes.delete(unitId);
    }

    clearUnits() {
        this.unitLayer.clearLayers();
        this.routeLayer.clearLayers();
        this.signalLayer.clearLayers();
        this.unitRoutes.clear();
        this.signals.clear();
    }
}