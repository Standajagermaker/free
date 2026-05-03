"use client";

import { useEffect, useMemo, useState } from "react";

export default function Ideas() {
  const [events, setEvents] = useState([]);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    }
  }

  const filtered = useMemo(() => {
    return events
      .filter(e => (city ? e.city === city : true))
      .filter(e => (category ? e.category === category : true))
      .sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""));
  }, [events, city, category]);

  const cities = [...new Set(events.map(e => e.city).filter(Boolean))];
  const categories = [...new Set(events.map(e => e.category).filter(Boolean))];

  return (
    <main style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>ideas</h1>
      <p style={{ color: "#666" }}>Don’t know what to do? Get inspired.</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select value={city} onChange={e => setCity(e.target.value)}>
          <option value="">All cities</option>
          {cities.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map(e => (
          <div key={e.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <b>{e.title || "Untitled"}</b>
            <div style={{ color: "#555" }}>
              {(e.city || "Unknown")} · {(e.event_date || "")} · {(e.event_time || "")}
            </div>
            <div style={{ fontSize: 12, color: "#777" }}>
              {(e.category || "other")} · {(e.source || "external")}
            </div>
          </div>
        ))}

        {!filtered.length && (
          <p style={{ color: "#999" }}>No events found</p>
        )}
      </div>
    </main>
  );
}
