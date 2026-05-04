import { useEffect, useRef, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const ATTACK_TYPES = [
  { type: "DDoS",          color: "#ff4d6d" },
  { type: "Ransomware",    color: "#ff9f1c" },
  { type: "Malware",       color: "#c77dff" },
  { type: "Phishing",      color: "#2ec4b6" },
  { type: "Brute Force",   color: "#4cc9f0" },
  { type: "SQL Injection", color: "#f9c74f" },
];

const US_CITIES = [
  { name: "New York",       lng: -74.006,  lat: 40.713 },
  { name: "Los Angeles",    lng: -118.244, lat: 34.052 },
  { name: "Chicago",        lng: -87.630,  lat: 41.878 },
  { name: "Houston",        lng: -95.370,  lat: 29.760 },
  { name: "Phoenix",        lng: -112.074, lat: 33.448 },
  { name: "Philadelphia",   lng: -75.165,  lat: 39.953 },
  { name: "San Antonio",    lng: -98.494,  lat: 29.424 },
  { name: "San Diego",      lng: -117.161, lat: 32.716 },
  { name: "Dallas",         lng: -96.797,  lat: 32.777 },
  { name: "San Jose",       lng: -121.886, lat: 37.338 },
  { name: "Atlanta",        lng: -84.388,  lat: 33.749 },
  { name: "Austin",         lng: -97.743,  lat: 30.267 },
  { name: "Seattle",        lng: -122.332, lat: 47.606 },
  { name: "Denver",         lng: -104.990, lat: 39.739 },
  { name: "Washington DC",  lng: -77.037,  lat: 38.907 },
  { name: "Nashville",      lng: -86.782,  lat: 36.163 },
  { name: "Miami",          lng: -80.192,  lat: 25.762 },
  { name: "Portland",       lng: -122.676, lat: 45.505 },
  { name: "Las Vegas",      lng: -115.140, lat: 36.170 },
  { name: "Minneapolis",    lng: -93.265,  lat: 44.978 },
  { name: "Boston",         lng: -71.059,  lat: 42.360 },
  { name: "Charlotte",      lng: -80.843,  lat: 35.227 },
  { name: "Detroit",        lng: -83.045,  lat: 42.331 },
  { name: "Kansas City",    lng: -94.578,  lat: 39.100 },
  { name: "Salt Lake City", lng: -111.891, lat: 40.760 },
];


const SECTORS   = ["Healthcare","Finance","Government","Education","Energy","Retail","Defense","Infrastructure"];
const SEV_COLOR = { LOW: "#2ec4b6", MEDIUM: "#f9c74f", HIGH: "#ff9f1c", CRITICAL: "#ff4d6d" };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function makeThreat() {
  const at     = pick(ATTACK_TYPES);
const origin = pick(US_CITIES);
  let target   = pick(US_CITIES);
  let tries    = 0;
  while (tries++ < 10 && target.name === origin.name) target = pick(US_CITIES);
  const r        = Math.random();
  const severity = r > 0.88 ? "CRITICAL" : r > 0.65 ? "HIGH" : r > 0.35 ? "MEDIUM" : "LOW";
  return {
    id: Math.random().toString(36).slice(2) + Date.now(),
    attackType: at.type,
    color: at.color,
    origin, target,
    sector: pick(SECTORS),
    severity,
    ts: new Date(),
  };
}

function bezierPoints(o, t, steps = 100) {
  const mx  = (o.lng + t.lng) / 2;
  const my  = (o.lat + t.lat) / 2;
  const dx  = t.lng - o.lng;
  const dy  = t.lat - o.lat;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [[o.lng, o.lat], [t.lng, t.lat]];
  const lift = Math.min(len * 0.55, 22);
  const cx   = mx + (-dy / len) * lift * 0.15;
  const cy   = my + Math.abs(dx / len) * lift;
  const pts  = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps, ms = 1 - s;
    pts.push([
      ms * ms * o.lng + 2 * ms * s * cx + s * s * t.lng,
      ms * ms * o.lat + 2 * ms * s * cy + s * s * t.lat,
    ]);
  }
  return pts;
}

async function askGroq(msgs) {
  try {
    const system = `You are CyberWatch AI, a sharp SOC analyst embedded in a real-time US cyber threat dashboard.
Live attacks stream in from US cities hitting other US cities. Types: DDoS, ransomware, malware, phishing, brute-force, SQL injection.
Style: direct and authoritative like a seasoned analyst. Reference live data with specific numbers/cities.
Keep responses to 2-4 sentences or tight bullet list with •. Bold key terms with **double asterisks**. Plain text only.`;

    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: system },
          ...msgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        ],
      }),
    });
    const d = await res.json();
    if (d?.choices?.[0]?.message?.content) return d.choices[0].message.content;
    return "No response received.";
  } catch (e) {
    return `Connection error: ${e.message}`;
  }
}

const FEED_W = 280;
const CHAT_W = 280;
function AlertBanner({ alerts }) {
  const [expanded, setExpanded] = useState(false);
  const latest = alerts[0];

  return (
    <div style={{
      position: "absolute", top: 58, left: "50%",
      transform: "translateX(-50%)",
      zIndex: 30, width: 360,
      animation: "alertSlide 0.3s ease-out",
    }}>
      {/* Main alert — always visible */}
      <div style={{
        background: "rgba(10,0,0,0.97)",
        border: "1px solid rgba(255,77,109,0.45)",
        borderRadius: expanded ? "8px 8px 0 0" : 28,
        padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 10,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#ff4d6d", boxShadow: "0 0 8px #ff4d6d",
          flexShrink: 0, animation: "blink 1s infinite",
        }} />
        <div style={{ flex: 1 }}>
 <div style={{ fontSize: 9, color: "#ff4d6d", fontWeight: 700, letterSpacing: "0.1em" }}>
  ⚠ SPIKE — {(latest.sector || "UNKNOWN").toUpperCase()}
</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
            {latest.count} attacks/min · near {latest.city} · {latest.ts.toLocaleTimeString()}
          </div>
        </div>
        {alerts.length > 1 && (
          <button onClick={() => setExpanded(e => !e)} style={{
            background: "rgba(255,77,109,0.1)",
            border: "1px solid rgba(255,77,109,0.25)",
            borderRadius: 4, color: "rgba(255,77,109,0.8)",
            fontSize: 7.5, padding: "3px 8px", cursor: "pointer",
            letterSpacing: "0.08em", whiteSpace: "nowrap",
          }}>
            {expanded ? "see less" : `+${alerts.length - 1} more`}
          </button>
        )}
      </div>

      {/* Expanded list */}
      {expanded && alerts.slice(1).map((a, i) => (
        <div key={a.id} style={{
          background: "rgba(8,0,0,0.97)",
          borderLeft: "3px solid rgba(255,77,109,0.3)",
          borderRight: "1px solid rgba(255,77,109,0.2)",
          borderBottom: i === alerts.length - 2 ? "1px solid rgba(255,77,109,0.2)" : "none",
          borderRadius: i === alerts.length - 2 ? "0 0 8px 8px" : 0,
          padding: "7px 14px",
          display: "flex", alignItems: "center", gap: 10,
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,77,109,0.5)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
 <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
  {a.sectorIsReal === false ? "~" : ""}{a.sector}
</div>
            <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>
              {a.count} attacks/min · {a.city} · {a.ts.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default function App() {
  const mapDiv     = useRef(null);
  const mapRef     = useRef(null);
  const ready      = useRef(false);
  const markersRef = useRef([]);

  const [feed,     setFeed]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [critical, setCritical] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);

  const [msgs, setMsgs] = useState([{
    role: "assistant",
    content: "CyberWatch AI online. I'm watching live attack traffic across US infrastructure. Ask me about current threats, targeted sectors, or defensive strategies.",
  }]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // ── Init 3D globe ──
  useEffect(() => {
    if (mapRef.current) return;
    import("mapbox-gl").then(mod => {
      const mapboxgl = mod.default ?? mod;
    mapboxgl.accessToken = MAPBOX_TOKEN;

      const m = new mapboxgl.Map({
        container:          mapDiv.current,
style: "mapbox://styles/mapbox/navigation-night-v1",
        center:             [-96, 38],
        zoom:               3.1,
        minZoom:            2,
        maxZoom:            8,
        projection:         "globe",
        attributionControl: false,
      });

      m.on("load", () => {
        // Globe atmosphere
        m.setFog({
          color:            "rgb(2, 6, 18)",
          "high-color":     "rgb(6, 20, 55)",
          "horizon-blend":  0.04,
          "space-color":    "rgb(0, 0, 8)",
          "star-intensity": 0.2,
        });

        // Dark water
        try { m.setPaintProperty("water", "fill-color", "#02060f"); } catch {}
// Dim everything outside US
        m.addLayer({
          id: "non-us-dim",
          type: "fill",
          source: { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" },
          "source-layer": "country_boundaries",
          filter: ["!=", ["get", "iso_3166_1_alpha_3"], "USA"],
paint: { "fill-color": "#000000", "fill-opacity": 0.5 },
        });

        // US light pink fill
        m.addLayer({
          id: "us-fill",
          type: "fill",
          source: { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" },
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "USA"],
paint: { "fill-color": "#ff85a1", "fill-opacity": 0.15 },
        });

        // US pink border line
        m.addLayer({
          id: "us-border",
          type: "line",
          source: { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" },
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "USA"],
          paint: { "line-color": "#ff4d8d", "line-width": 2.5, "line-opacity": 1.0 },
        });

        // US outer pink glow
        m.addLayer({
          id: "us-glow",
          type: "line",
          source: { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" },
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "USA"],
          paint: { "line-color": "#ff4d8d", "line-width": 16, "line-opacity": 0.2, "line-blur": 12 },
        });
        ready.current = true;
      });

      mapRef.current = m;
    });

    return () => {
      markersRef.current.forEach(mk => { try { mk.remove(); } catch {} });
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw arc + colored city impact ──
  const drawArc = useCallback((threat) => {
    if (!ready.current || !mapRef.current) return;
    if (isNaN(threat.origin.lat) || isNaN(threat.target.lat)) return;

    const map = mapRef.current;
    const id  = `arc-${threat.id}`;
    const pts = bezierPoints(threat.origin, threat.target);

    try {
      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: pts.slice(0, 2) } },
      });
      map.addLayer({
        id: id + "-glow", type: "line", source: id,
        layout: { "line-cap": "round", "line-join": "round" },
        paint:  { "line-color": threat.color, "line-width": 6, "line-opacity": 0, "line-blur": 5 },
      });
      map.addLayer({
        id, type: "line", source: id,
        layout: { "line-cap": "round", "line-join": "round" },
paint:  { "line-color": threat.color, "line-width": 1.5, "line-opacity": 0 },
      });
    } catch { return; }

    // Animate drawing
    let step = 2;
    const tick = setInterval(() => {
      step = Math.min(step + 2, pts.length);
      try {
        if (!map.getSource(id)) { clearInterval(tick); return; }
        map.getSource(id).setData({
          type: "Feature", geometry: { type: "LineString", coordinates: pts.slice(0, step) },
        });
        const p = step / pts.length;
        map.setPaintProperty(id + "-glow", "line-opacity", Math.min(p * 0.45, 0.35));
        map.setPaintProperty(id,            "line-opacity", Math.min(p * 1.5,  0.92));
      } catch { clearInterval(tick); }
      if (step >= pts.length) clearInterval(tick);
    }, 13);

    const travelMs = (pts.length / 2) * 13;

    // Launch ring at origin
    import("mapbox-gl").then(mod => {
      const mapboxgl = mod.default ?? mod;
      const el = document.createElement("div");
      el.className = "launch-ring";
      const mk = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([threat.origin.lng, threat.origin.lat])
        .addTo(map);
      markersRef.current.push(mk);
      setTimeout(() => { try { mk.remove(); } catch {} }, travelMs + 500);
    });

    // Colored city impact
    setTimeout(() => {
      import("mapbox-gl").then(mod => {
        const mapboxgl = mod.default ?? mod;

        const glowEl = document.createElement("div");
        glowEl.className = "city-glow";
        glowEl.style.setProperty("--c", threat.color);
        const glowMk = new mapboxgl.Marker({ element: glowEl, anchor: "center" })
          .setLngLat([threat.target.lng, threat.target.lat])
          .addTo(map);
        markersRef.current.push(glowMk);

        const dot = document.createElement("div");
        dot.className = "impact-dot";
        dot.style.setProperty("--c", threat.color);
        const dotMk = new mapboxgl.Marker({ element: dot, anchor: "center" })
          .setLngLat([threat.target.lng, threat.target.lat])
          .addTo(map);
        markersRef.current.push(dotMk);

        [0, 300, 600].forEach(delay => {
          const ring = document.createElement("div");
          ring.className = "impact-ring";
          ring.style.setProperty("--c", threat.color);
          ring.style.animationDelay = `${delay}ms`;
          const ringMk = new mapboxgl.Marker({ element: ring, anchor: "center" })
            .setLngLat([threat.target.lng, threat.target.lat])
            .addTo(map);
          markersRef.current.push(ringMk);
          setTimeout(() => { try { ringMk.remove(); } catch {} }, 2400 + delay);
        });

        setTimeout(() => { try { glowMk.remove(); dotMk.remove(); } catch {} }, 3000);
      });
    }, travelMs);

    // Fade + clean up arc
    setTimeout(() => {
      let op = 0.92;
      const fade = setInterval(() => {
        op -= 0.035;
        try {
          map.setPaintProperty(id,           "line-opacity", Math.max(op, 0));
          map.setPaintProperty(id + "-glow", "line-opacity", Math.max(op * 0.35, 0));
        } catch {}
        if (op <= 0) {
          clearInterval(fade);
          try { map.removeLayer(id); map.removeLayer(id + "-glow"); } catch {}
          try { map.removeSource(id); } catch {}
        }
      }, 28);
    }, travelMs + 2000);
  }, []);

  // ── Spawn threats ──
// ── Anomaly detection: rolling baseline per sector ──
  const sectorCounts   = useRef({});
  const sectorBaseline = useRef({});
  const [alerts, setAlerts] = useState([]);

  const checkAnomaly = useCallback((threat) => {
    const s = threat.sector;
    const now = Date.now();

    // Count attacks per sector in last 60 seconds
    if (!sectorCounts.current[s]) sectorCounts.current[s] = [];
    sectorCounts.current[s].push(now);
    sectorCounts.current[s] = sectorCounts.current[s].filter(t => now - t < 60000);

    const recentCount = sectorCounts.current[s].length;

    // Build baseline: average over last 5 minutes (updated every 60s)
    if (!sectorBaseline.current[s]) sectorBaseline.current[s] = recentCount;
    else sectorBaseline.current[s] = sectorBaseline.current[s] * 0.9 + recentCount * 0.1;

    const baseline = sectorBaseline.current[s];

    // Spike = 3x above baseline and at least 5 attacks
if (recentCount >= 2 && recentCount > baseline * 1.2) {
const alert = {
  id:      Date.now(),
  sector:  s,
  sectorIsReal: threat.sectorIsReal,
  count:   recentCount,
  baseline: Math.round(baseline),
  city:    threat.target.name,
  ts:      new Date(),
};
      setAlerts(prev => [alert, ...prev.slice(0, 4)]);
    }
  }, []);

// ── Fetch real threats from backend ──
const threatPoolRef = useRef([]);
const poolIndexRef = useRef(0);

useEffect(() => {
  fetch("http://localhost:5000/api/threats")
    .then(r => r.json())
    .then(data => {
      threatPoolRef.current = data;
      console.log(`Loaded ${data.length} real threats`);
    })
    .catch(err => console.log("Backend unavailable, using mock data:", err));
}, []);

// ── Spawn threats (real data if available, fallback to mock) ──
useEffect(() => {
  const spawn = () => {
    let t;
    const pool = threatPoolRef.current;

    if (pool.length > 0) {
      // Pull from real backend pool, cycling through
      const raw = pool[poolIndexRef.current % pool.length];
      poolIndexRef.current++;

      // Convert backend shape → frontend shape
      const at = ATTACK_TYPES.find(a => a.type === raw.attackType) || ATTACK_TYPES[0];
      const origin = US_CITIES.find(c => c.name === raw.city) || pick(US_CITIES);
      let target = pick(US_CITIES);
      let tries = 0;
      while (tries++ < 10 && target.name === origin.name) target = pick(US_CITIES);

      t = {
        id: Math.random().toString(36).slice(2) + Date.now(),
        attackType: raw.attackType,
        color: at.color,
        origin,
        target,
        sector: raw.sector,
        sectorIsReal: raw.sectorIsReal,
        severity: raw.severity,
        source: raw.source,
        ts: new Date(),
      };
    } else {
      t = makeThreat(); // fallback while backend loads
    }

    agentMemory.addEvent(t);
    checkAnomaly(t);
    setFeed(prev => [t, ...prev.slice(0, 49)]);
    setTotal(n => n + 1);
    if (t.severity === "CRITICAL") setCritical(n => n + 1);
    drawArc(t);
  };

  const boot = setTimeout(() => {
    for (let i = 0; i < 5; i++) setTimeout(spawn, i * 600);
  }, 2500);
  const loop = setInterval(() => {
    spawn();
    if (Math.random() < 0.38) setTimeout(spawn, 700);
  }, 2100);
  return () => { clearTimeout(boot); clearInterval(loop); };
}, [drawArc, checkAnomaly]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const q   = input.trim();
    const ctx = `[LIVE DATA] Total: ${total} attacks. Critical: ${critical}.
Recent: ${feed.slice(0, 5).map(f => `${f.attackType} from ${f.origin.name} → ${f.target.name} (${f.sector}, ${f.severity})`).join(" | ")}
Question: ${q}`;
    setMsgs(prev => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    const reply = await askGroq([...msgs, { role: "user", content: ctx }]);
    setMsgs(prev => [...prev, { role: "assistant", content: reply }]);
    setLoading(false);
  };

const THREAT_COLORS = {
    "DDoS":          { bg: "rgba(255,77,109,0.15)",  border: "rgba(255,77,109,0.4)",  text: "#ff4d6d" },
    "Ransomware":    { bg: "rgba(255,159,28,0.15)",  border: "rgba(255,159,28,0.4)",  text: "#ff9f1c" },
    "Malware":       { bg: "rgba(199,125,255,0.15)", border: "rgba(199,125,255,0.4)", text: "#c77dff" },
    "Phishing":      { bg: "rgba(46,196,182,0.15)",  border: "rgba(46,196,182,0.4)",  text: "#2ec4b6" },
    "Brute Force":   { bg: "rgba(76,201,240,0.15)",  border: "rgba(76,201,240,0.4)",  text: "#4cc9f0" },
    "SQL Injection": { bg: "rgba(249,199,79,0.15)",  border: "rgba(249,199,79,0.4)",  text: "#f9c74f" },
  };

  const renderMd = (t, isUser) => {
    // Wrap threat type names in colored pill badges
    let out = t;
    if (!isUser) {
      Object.entries(THREAT_COLORS).forEach(([name, c]) => {
        out = out.replace(
          new RegExp(`\\b${name}\\b`, "g"),
`<span style="display:inline-block;background:${c.bg};color:${c.text};border-radius:28px;padding:1px 8px;font-size:9px;font-weight:700;letter-spacing:0.05em;">${name}</span>`        );
      });
    }
    return out
      .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${isUser ? '#000' : '#ffffff'};font-weight:700;">$1</strong>`)
      .replace(/`(.*?)`/g, `<code style="background:rgba(255,255,255,0.1);color:#4cc9f0;padding:1px 5px;border-radius:6px;font-size:9px;">$1</code>`)
      .replace(/^- (.*)/gm, `<div style="display:flex;gap:6px;margin:4px 0;align-items:flex-start;"><span style="color:${isUser ? '#999' : '#ff4d8d'};flex-shrink:0;margin-top:1px;">›</span><span>$1</span></div>`)
      .replace(/•/g, `<span style="color:#ff4d8d;margin-right:4px;">•</span>`)
      .replace(/\n/g, "<br/>");
  };

  const QUICK = [
    "What's happening right now?",
    "Which sectors are hit hardest?",
    "How do I defend against ransomware?",
    "Explain current attack patterns",
  ];
// Conversation memory: stores attack summaries the AI has seen
const agentMemory = {
  summaries: [],
  addEvent(threat) {
    this.summaries.push(
      `${threat.attackType} from ${threat.origin.name} → ${threat.target.name} (${threat.sector}, ${threat.severity}) at ${threat.ts.toLocaleTimeString()}`
    );
    if (this.summaries.length > 100) this.summaries.shift(); // keep last 100
  },
  getSummary() {
    if (!this.summaries.length) return "No events recorded yet.";
    const counts = {};
    this.summaries.forEach(s => {
      const type = s.split(" ")[0];
      counts[type] = (counts[type] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3)
      .map(([k,v]) => `${k}(${v})`).join(", ");
    return `${this.summaries.length} events recorded. Top types: ${top}. Recent: ${this.summaries.slice(-5).join(" | ")}`;
  }
};

async function askGroq(msgs) {
  try {
    const res = await fetch("https://api.llm7.io/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-2024-07-18",
        max_tokens: 600,
        messages: [
          {
            role: "system",
 content: `You are CyberWatch AI, a cybersecurity assistant watching live US attack traffic. Be casual and natural — if someone says hi, just say hi back. If they ask how things are going, give a quick chill update. Only go into analyst mode if they actually ask for a summary, report, or threat breakdown. You have memory of recent attacks: ${agentMemory.getSummary()}. Keep replies short unless asked for detail. No forced structure, no bullet lists unless it helps. Talk like a knowledgeable friend, not a report generator. If someone greets you, greet them back warmly and briefly mention you're watching live US cyber traffic and ask what they need — keep it to 1-2 sentences, super casual.`,
},
          ...msgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        ],
      }),
    });
    const d = await res.json();
    if (d?.choices?.[0]?.message?.content) return d.choices[0].message.content;
    return "No response received.";
  } catch (e) {
    return `Connection error: ${e.message}`;
  }
}
  return (
    <div style={{
      position: "relative", width: "100vw", height: "100vh",
      overflow: "hidden", background: "#000810",
      fontFamily: "'Syne Mono', 'Courier New', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=Rajdhani:wght@500;600;700&family=Syne:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }

        .launch-ring {
          width: 14px; height: 14px; border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.75);
          pointer-events: none;
          animation: launch 1s ease-out forwards;
        }
        @keyframes launch {
          0%   { transform: scale(0.2); opacity: 1; }
          100% { transform: scale(3.2); opacity: 0; }
        }

        .city-glow {
          width: 72px; height: 72px; border-radius: 50%;
          background: radial-gradient(circle, var(--c) 0%, transparent 68%);
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0);
          animation: city-bloom 2.8s ease-out forwards;
        }
        @keyframes city-bloom {
          0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0; }
          18%  { opacity: 0.55; }
          65%  { transform: translate(-50%,-50%) scale(1.3); opacity: 0.35; }
          100% { transform: translate(-50%,-50%) scale(2.1); opacity: 0; }
        }

        .impact-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--c);
          box-shadow: 0 0 8px 3px var(--c), 0 0 18px 6px var(--c);
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0.4);
          animation: dot-pulse 2.5s ease-out forwards;
        }
        @keyframes dot-pulse {
          0%   { opacity: 1; transform: translate(-50%,-50%) scale(0.4); }
          18%  { transform: translate(-50%,-50%) scale(1.7); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(0.8); }
        }

        .impact-ring {
          width: 13px; height: 13px; border-radius: 50%;
          border: 1.5px solid var(--c);
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0.2);
          animation: ring-out 2s ease-out forwards;
          opacity: 0;
        }
        @keyframes ring-out {
          0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0.9; }
          100% { transform: translate(-50%,-50%) scale(5.8); opacity: 0; }
        }

        .mapboxgl-ctrl { display: none !important; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }

        .feed-row:hover { background: rgba(255,255,255,0.022) !important; }

        code {
          background: rgba(76,201,240,0.12); color: #4cc9f0;
          padding: 1px 5px; border-radius: 2px;
          font-size: 9.5px; font-family: 'Syne Mono', monospace;
        }
        .bullet { color: #ff4d6d; margin-right: 4px; }

        .chat-input:focus { outline: none; border-color: rgba(255,255,255,0.22) !important; }
        .send-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
        .quick-btn:hover { background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.55) !important; }

@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes alertSlide { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }
                @keyframes thinking {
          0%,80%,100% { transform: scale(0); opacity: 0.3; }
          40%          { transform: scale(1); opacity: 1; }
        }

        /* Chat panel slide */
        .chat-panel {
          transition: transform 0.32s cubic-bezier(0.4,0,0.2,1);
        }
        .chat-panel.closed {
          transform: translateX(calc(100% + 2px));
        }

        /* Toggle tab on right edge */
        .chat-toggle {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 20px; height: 54px;
          background: rgba(0,8,20,0.95);
          border: 1px solid rgba(255,255,255,0.09);
          border-right: none;
          border-radius: 6px 0 0 6px;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px;
          z-index: 15;
          transition: color 0.2s, background 0.2s, border-color 0.2s;
          user-select: none;
        }
        .chat-toggle:hover {
          color: rgba(255,255,255,0.8);
          background: rgba(0,20,60,0.98);
          border-color: rgba(76,201,240,0.35);
        }
      `}</style>

      {/* MAP */}
      <div ref={mapDiv} style={{ position: "absolute", inset: 0 }} />

      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.02) 2px,rgba(0,0,0,0.02) 4px)",
      }} />

      {/* ── TOP BAR ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", zIndex: 20,
        background: "rgba(0,8,16,0.97)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#ffffff",
            boxShadow: "0 0 8px #ffffff", animation: "blink 1.6s ease-in-out infinite",
          }} />
          <span style={{
            fontWeight: 400,
            fontSize: 16, letterSpacing: "0.28em", color: "#f0f0f0",
          }}>CyberWatch</span>
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: 8.5, color: "rgba(255, 255, 255, 0.52)", letterSpacing: "0.12em" }}>US THREAT MAP</span>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {ATTACK_TYPES.map(a => (
            <div key={a.type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 22, height: 1.5, background: `linear-gradient(90deg,transparent,${a.color})`, borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.39)", letterSpacing: "0.05em" }}>{a.type}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 22, color: "rgba(255,255,255,0.85)", lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.18)", letterSpacing: "0.14em", marginTop: 1 }}>DETECTED</div>
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 22, color: "#ff4d6d", lineHeight: 1 }}>{critical}</div>
            <div style={{ fontSize: 7, color: "rgba(255,77,109,0.45)", letterSpacing: "0.14em", marginTop: 1 }}>CRITICAL</div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px",
            border: "1px solid rgba(255,77,109,0.3)",
            borderRadius: 2, background: "rgba(255,77,109,0.06)",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d6d", animation: "blink 1.4s infinite" }} />
            <span style={{ fontSize: 7.5, color: "rgba(255,77,109,0.9)", letterSpacing: "0.16em" }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* ── LEFT PANEL: Feed (always open) ── */}
      <div style={{
        position: "absolute", top: 50, left: 0, width: FEED_W,
        height: "calc(100vh - 50px)", zIndex: 10,
        background: "rgba(0,6,16,0.93)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        backdropFilter: "blur(18px)",
      }}>
        <div style={{
          padding: "13px 16px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", letterSpacing: "0.2em" }}>LIVE THREAT FEED</span>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 14, color: "rgba(255,77,109,0.55)" }}>{feed.length}</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {feed.length === 0 && (
            <div style={{ padding: "20px 16px", fontSize: 8.5, color: "rgba(255,255,255,0.1)", letterSpacing: "0.1em" }}>
              INITIALIZING FEED...
            </div>
          )}
          {feed.map((t, i) => (
            <div key={t.id} className="feed-row" style={{
              padding: "9px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              borderLeft: `2px solid ${t.color}`,
              opacity: Math.max(0.3, 1 - i * 0.014),
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: t.color, fontWeight: 500 }}>{t.attackType}</span>
                <span style={{
                  fontSize: 7, padding: "1.5px 6px", borderRadius: 2,
                  color: SEV_COLOR[t.severity],
                  border: `1px solid ${SEV_COLOR[t.severity]}35`,
                  background: `${SEV_COLOR[t.severity]}0a`,
                  letterSpacing: "0.08em",
                }}>{t.severity}</span>
              </div>
              <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.28)", marginBottom: 2.5, display: "flex", alignItems: "center", gap: 5 }}>
                <span>{t.origin.name}</span>
                <span style={{ color: "rgba(255,77,109,0.45)" }}>→</span>
                <span style={{ color: "rgba(255,255,255,0.45)" }}>{t.target.name}</span>
              </div>
 <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.12)", display: "flex", gap: 8 }}>
  <span>{t.sectorIsReal === false ? "~" : ""}{t.sector}</span>
  <span style={{ opacity: 0.4 }}>·</span>
  <span>{t.ts.toLocaleTimeString()}</span>
</div>
            </div>
          ))}
        </div>
      </div>

{/* ── ANOMALY ALERTS ── */}
      {alerts.length > 0 && (
        <AlertBanner alerts={alerts} />
      )}

      {/* ── CHAT COLLAPSE TAB ── */}
            <div
        className="chat-toggle"
        onClick={() => setChatOpen(o => !o)}
        style={{ right: chatOpen ? CHAT_W : 0 }}
        title={chatOpen ? "Collapse AI chat" : "Open AI chat"}
      >
        {chatOpen ? "›" : "‹"}
      </div>

{/* ── RIGHT PANEL: AI Chat (collapsible) ── */}
      <div
        className={`chat-panel ${chatOpen ? "" : "closed"}`}
        style={{
          position: "absolute", top: 50, right: 0, width: CHAT_W,
          height: "calc(100vh - 50px)", zIndex: 10,
          background: "#0a0a0a",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#ffffff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "#000", fontWeight: 700,
            }}>◈</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em", fontFamily: "'Rajdhani',sans-serif" }}>CYBERWATCH AI</div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginTop: 1 }}>● ONLINE</div>
            </div>
          </div>
          <div style={{
            padding: "3px 8px", borderRadius: 3,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em",
          }}>LLM7</div>
        </div>

        {/* Quick prompts */}
        {msgs.length === 1 && (
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: "0.18em", marginBottom: 8 }}>SUGGESTED</div>
            {QUICK.map(q => (
              <button key={q} onClick={() => setInput(q)} className="quick-btn" style={{
                display: "block", width: "100%", textAlign: "left",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 6, color: "rgba(255,255,255,0.3)",
                fontFamily: "'Syne Mono', monospace",
                fontSize: 8.5, padding: "7px 10px",
                cursor: "pointer", marginBottom: 5,
                transition: "all 0.15s",
              }}>
                <span style={{ color: "rgba(255,255,255,0.2)", marginRight: 6 }}>›</span>{q}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              flexDirection: m.role === "user" ? "row-reverse" : "row",
              alignItems: "flex-end",
              gap: 7,
            }}>
              {/* Avatar */}
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: m.role === "user" ? "#ffffff" : "#1a1a1a",
                border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, color: m.role === "user" ? "#000" : "#fff",
                fontWeight: 700,
              }}>
                {m.role === "user" ? "U" : "◈"}
              </div>

    {/* Bubble */}
              <div
                style={{
                  maxWidth: "78%",
                  fontSize: 10.5, lineHeight: 1.85,
                  borderRadius: m.role === "user" ? "28px 28px 4px 28px" : "28px 28px 28px 4px",
                  padding: "10px 14px",
                  background: m.role === "user" ? "#ffffff" : "#1a1a1a",
                  color: m.role === "user" ? "#111111" : "rgba(255,255,255,0.75)",
                  border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)",
                }}
                dangerouslySetInnerHTML={{ __html: renderMd(m.content, m.role === "user") }}
              />
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 7 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, color: "#fff",
              }}>◈</div>
              <div style={{
                background: "#161616", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "14px 14px 14px 2px", padding: "10px 14px",
                display: "flex", gap: 5, alignItems: "center",
              }}>
                {[0, 0.18, 0.36].map((d, i) => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.4)",
                    animation: `thinking 1.2s ease-in-out ${d}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "10px 12px 14px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 28,
            padding: "4px 4px 4px 14px",
          }}>
            <input
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask anything..."
              style={{
                flex: 1, background: "transparent", border: "none",
                color: "rgba(255,255,255,0.85)", fontFamily: "'Syne Mono', monospace",
                fontSize: 10.5, padding: "5px 0", outline: "none",
              }}
            />
            <button
              className="send-btn"
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: loading || !input.trim() ? "rgba(255,255,255,0.06)" : "#ffffff",
                border: "none",
                color: loading || !input.trim() ? "rgba(255,255,255,0.2)" : "#000000",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >›</button>
          </div>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.1)", textAlign: "center", marginTop: 8, letterSpacing: "0.08em" }}>
            powered by llm7.io
          </div>
        </div>
      </div>
    </div>
  );
}