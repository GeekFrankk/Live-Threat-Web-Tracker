const axios = require("axios");

async function getThreats() {
  const response = await axios.get(
    "https://api.abuseipdb.com/api/v2/blacklist",
    {
      headers: {
        Key: process.env.ABUSEIPDB_API_KEY,
        Accept: "application/json"
      },
      params: {
        confidenceMinimum: 75
      }
    }
  );

  return response.data.data.map((item, index) => ({
    id: index,
    ip: item.ipAddress,
    city: "Unknown",
    state: "Unknown",
    severity: item.abuseConfidenceScore > 80 ? "high" : "medium",
    type: "Abuse Report",
    lat: 37.0902,
    lng: -95.7129
  }));
}

module.exports = getThreats;