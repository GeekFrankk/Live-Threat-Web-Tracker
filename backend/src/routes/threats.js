const express = require("express");
const router = express.Router();

// ✅ correct import
const { getThreats } = require("../api/threats");

router.get("/", async (req, res) => {
  try {
    const threats = await getThreats();
    res.json(threats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch threats" });
  }
});

module.exports = router;