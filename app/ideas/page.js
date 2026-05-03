"use client";

import { useEffect, useMemo, useState } from "react";

const card = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 14,
  background: "white",
  boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
};

const input = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "white",
};

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function isWeekend(date) {
  if (!date) return false;
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

function groupEvents(events) {
  const today = todayISO(0);
  const tomorrow = todayISO(1);
  return {
    Today: events.filter(e => e.event_date === today),
    Tomorrow: events.filter(e => e.event_date === tomorrow),
    Weekend: events.filter(e => e.event_date !== today && e.event_date !== tomorrow && isWeekend(e.event_date)),
    Later: events.filter(e => e.event_date !== today && e.event_date !== tomorrow && !isWeekend(e.event_date)),
  };
}

export default function Ideas() {
  const [events, setEvents] = useState([]);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return events
      .filter(e => (city ? e.city === city : true))
      .filter(e => (category ? e.category === category : true))
      .sort((a, b) => `${a.event_date || ""} ${a.event_time || ""}`.localeCompare(`${b.event_date || ""} ${b.event_time || ""}`));
  }, [events, city, category]);

  const cities = [...new Set(events.map(e => e.city).filter(Boolean))].sort();
  const categories = [...new Set(events.map(e => e.category).filter(Boolean))].sort();
  const groups = groupEvents(filtered);

  return (
    <main style={{ padding: 28, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 44 }}>ideas</h1>
          <p style={{ color: "#555", fontSize: 18, marginTop: 6 }}>Don’t know what to do? Pick a city, find a vibe, go outside.</p>
        </div>
        <button onClick={loadEvents} style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: "#111", color: "white", fontWeight: "bold", cursor: "pointer" }}>
          Refresh
        </button>
      </header>

      <section style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={city} onChange={e => setCity(e.target.value)} style={input}>
            <option value="">All cities</option>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>

          <select value={category} onChange={e => setCategory(e.target.value)} style={input}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>

          <span style={{ color: "#777", fontSize: 13 }}>{filtered.length} ideas found</span>
        </div>
      </section>

      {loading && <p style={{ color: "#777" }}>Loading ideas...</p>}

      {!loading && Object.entries(groups).map(([label, list]) => (
        <section key={label} style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>{label}</h2>
          {list.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {list.map(e => (
                <article key={e.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 17 }}>{e.title || "Untitled event"}</div>
                      <div style={{ color: "#555", marginTop: 4 }}>{e.city || "Unknown"} · {e.event_date || "date TBA"} · {e.event_time || "time TBA"}</div>
                      <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>{e.category || "event"} · {e.source || "external"}</div>
                    </div>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noreferrer" style={{ color: "#111", fontWeight: "bold", textDecoration: "none", whiteSpace: "nowrap" }}>
                        Open →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ color: "#999", marginTop: 0 }}>Nothing here.</p>
          )}
        </section>
      ))}
    </main>
  );
}
