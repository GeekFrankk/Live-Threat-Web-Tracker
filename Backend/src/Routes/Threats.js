const express = require("express");
const router = express.Router();
const { getThreats } = require("../Api/threats");

router.get("/", async (req, res) => {
  try {
    const threats = await getThreats();
    res.json(threats);
  } catch (err) {
    console.error("Route error:", err.message);
    res.status(500).json({ error: "Failed to fetch threats" });
  }
});

module.exports = router;