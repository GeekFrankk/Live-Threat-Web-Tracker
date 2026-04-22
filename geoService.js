const stateCoords = {
  NY: { lat: 40.7128, lng: -74.0060 },
  CA: { lat: 34.0522, lng: -118.2437 },
  TX: { lat: 32.7767, lng: -96.7970 },
  FL: { lat: 25.7617, lng: -80.1918 },
  IL: { lat: 41.8781, lng: -87.6298 },
  WA: { lat: 47.6062, lng: -122.3321 },
};

function attachCoordinates(threat) {
  const coords = stateCoords[threat.state] || { lat: 39.8283, lng: -98.5795 };
  return {
    ...threat,
    lat: coords.lat,
    lng: coords.lng,
  };
}

module.exports = { attachCoordinates };