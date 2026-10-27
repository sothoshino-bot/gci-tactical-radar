function sampleRoute(coordinates, maximumPoints = 60) {
    const stride = Math.max(1, Math.ceil(coordinates.length / maximumPoints));
    const points = coordinates
        .filter((_coordinate, index) => index % stride === 0)
        .map(([lng, lat]) => ({ lat, lng }));
    const [lastLng, lastLat] = coordinates[coordinates.length - 1];
    const last = points[points.length - 1];
    if (!last || last.lat !== lastLat || last.lng !== lastLng) {
        points.push({ lat: lastLat, lng: lastLng });
    }
    return points;
}

export async function getRoadRoute(from, to) {
    const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Road routing service returned HTTP ${response.status}.`);
        const result = await response.json();
        const geometry = result.routes?.[0]?.geometry?.coordinates;
        if (result.code !== 'Ok' || !Array.isArray(geometry) || geometry.length < 2) {
            throw new Error(`Road routing service could not connect ${from.name} to ${to.name}.`);
        }
        return sampleRoute(geometry);
    } finally {
        clearTimeout(timeout);
    }
}
