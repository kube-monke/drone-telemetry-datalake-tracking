const AWS = require('aws-sdk');

const STREAM_NAME = <"STREAM-NAME">;   // enter kinesis stream name
const REGION = "us-east-1";  //change region if necessary

AWS.config.update({ region: REGION });
const kinesis = new AWS.Kinesis();

// Initial drone state
const droneStates = {
  cobra: { chargeLevel: 100, lat: 12.935, lon: 77.614, landed: false },
  hunter: { chargeLevel: 100, lat: 12.936, lon: 77.616, landed: false },
  ninja: { chargeLevel: 100, lat: 12.934, lon: 77.618, landed: false }
};

// Haversine distance in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getRandomDelta() {
  return (Math.random() - 0.5) * 0.002;
}

function getDroneTelemetry(droneId) {
  const state = droneStates[droneId];
  let speed, newLat, newLon;

  if (state.chargeLevel < 5 || state.landed) {
    state.landed = true;
    speed = 0;
    newLat = state.lat;
    newLon = state.lon;
    state.chargeLevel = Math.min(100, state.chargeLevel + 5);
    if (state.chargeLevel >= 100) state.landed = false;
  } else {
    speed = Math.floor(Math.random() * 301); // 0 to 300 km/h
    newLat = state.lat + getRandomDelta();
    newLon = state.lon + getRandomDelta();
    const dist = calculateDistance(state.lat, state.lon, newLat, newLon); // in meters
    const drain = (dist / 1000) * (speed / 100); // battery drain based on speed & distance
    state.chargeLevel = Math.max(0, state.chargeLevel - drain);
  }

  state.lat = newLat;
  state.lon = newLon;

  const altitude = parseFloat((Math.random() * 600).toFixed(1)); // up to 600m

  return {
    droneId,
    timestamp: new Date().toISOString(),
    speed,
    chargeLevel: parseFloat(state.chargeLevel.toFixed(2)),
    batteryWarning: state.chargeLevel < 20,
    latitude: parseFloat(newLat.toFixed(6)),
    longitude: parseFloat(newLon.toFixed(6)),
    altitude,
    landed: state.landed,
    errorCodes: Math.random() < 0.1 ? ["E001"] : []
  };
}

function sendData(droneId) {
  const data = getDroneTelemetry(droneId);

  const payload = {
    Data: JSON.stringify(data),
    PartitionKey: droneId,
    StreamName: STREAM_NAME
  };

  kinesis.putRecord(payload, (err, res) => {
    if (err) {
      console.error(`❌ ${droneId}`, err);
    } else {
      console.log(`✅ ${droneId}`, JSON.stringify(data));
    }
  });
}

// Send telemetry every 5 seconds for each drone
Object.keys(droneStates).forEach(droneId => {
  setInterval(() => sendData(droneId), 5000);
});
