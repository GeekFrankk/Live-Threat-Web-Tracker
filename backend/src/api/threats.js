const axios = require("axios");

let cache = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getThreats() {
  // use cache if fresh
  if (cache && Date.now() - lastFetch < CACHE_DURATION) {
    console.log("Using cached data");
    return cache;
  }

  console.log("Fetching new data from API");

  const res = await axios.get(
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

  const threats = res.data.data; // ❗ removed slice here

  const enriched = await Promise.all(
    threats.map(async (item, index) => {
      try {
        const geoRes = await axios.get(
          "https://api.ipgeolocation.io/ipgeo",
          {
            params: {
              apiKey: process.env.GEO_API_KEY,
              ip: item.ipAddress
            }
          }
        );

        return {
          id: index,
          ip: item.ipAddress,
          city: geoRes.data.city,
          state: geoRes.data.state_prov,
          country: geoRes.data.country_name,
          lat: geoRes.data.latitude,
          lng: geoRes.data.longitude,
          isp: geoRes.data.isp,
          severity:
            item.abuseConfidenceScore > 80 ? "high" : "medium",
          type: "Abuse Report"
        };
      } catch {
        return null; // skip failed ones
      }
    })
  );

  // FILTERING AND LIMITING TO THE U.S
  const usOnly = enriched
    .filter(item => item && item.country === "United States")
    .slice(0, 10);

  // cache it
  cache = usOnly;
  lastFetch = Date.now();

  return usOnly;
}

module.exports = { getThreats };

