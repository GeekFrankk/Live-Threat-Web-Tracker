import { useEffect, useState } from "react";

function App() {
  const [threats, setThreats] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/threats")
      .then(res => res.json())
      .then(data => setThreats(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h1>Threat Data</h1>

      {threats.map(threat => (
        <div key={threat.id} style={{ border: "1px solid black", margin: "10px", padding: "10px" }}>
          <p><b>IP:</b> {threat.ip}</p>
          <p><b>Location:</b> {threat.city}, {threat.state}</p>
          <p><b>Severity:</b> {threat.severity}</p>
          <p><b>Type:</b> {threat.type}</p>
        </div>
      ))}
    </div>
  );
}

export default App;
