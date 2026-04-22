require("dotenv").config(); 

const express = require("express");
const cors = require("cors");
const threatRoutes = require("./src/routes/threats");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "CyberWatch backend is running" });
});

app.use("/api/threats", threatRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});