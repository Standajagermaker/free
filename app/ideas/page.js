"use client";

import { useEffect, useMemo, useState } from "react";

const card = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 12,
  background: "white",
  boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
};

const input = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "white",
};

const smallButton = {
  padding: "6px 9px",
  borderRadius: 8,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 13,
};

const primarySmallButton = {
  ...smallButton,
  background: "#111",
  color: "white",
  border: "1px solid #111",
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

function teaserFor(event) {
  const title = event.title || "this event";
  const city = event.city || "the city";
  const category = event.category || "event";

  if (category.includes("cinema")) return `Movie vibe: ${title} sounds like a good reason to stop scrolling and ask who wants to join.`;
  if (category.includes("concert") || category.includes("festival")) return `Good excuse to gather people: music, atmosphere and a clear plan in ${city}.`;
  if (category.includes("theatre") || category.includes("culture")) return `Culture pick: ideal for a calm evening and an easy invitation to someone new.`;
  if (category.includes("sport")) return `Match energy: simple plan, clear time, easy to invite a small group.`;
  if (category.includes("food")) return `Low-pressure idea: walk, taste something, talk, and see where the day goes.`;
  return `Idea starter: use this as a reason to write “hey, who wants to join me?”`;
}

function inviteUrl(event) {
  const title = encodeURIComponent(`Anyone for ${event.title || "this event"}?`);
  const city = encodeURIComponent(event.city || "");
  const date = encodeURIComponent(event.event_date || "");
  const time = encodeURIComponent(event.event_time || "");
  return `/?title=${title}&city=${city}&event_date=${date}&event_time=${time}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
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
    const q = query.toLowerCase().trim();
    return events
      .filter(e => (city ? e.city === city : true))
      .filter(e => (category ? e.category === category : true))
      .filter(e => {
        if (!q) return true;
        const haystack = `${e.title || ""} ${e.city || ""} ${e.category || ""} ${e.source || ""} ${e.event_date || ""} ${e.event_time || ""} ${teaserFor(e)}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => `${a.event_date || ""} ${a.event_time || ""}`.localeCompare(`${b.event_date || ""} ${b.event_time || ""}`));
  }, [events, city, category, query]);

  const cities = [...new Set(events.map(e => e.city).filter(Boolean))].sort();
  const categories = [...new Set(events.map(e => e.category).filter(Boolean))].sort();
  const groups = groupEvents(filtered);

  return (
    <main style={{ padding: 28, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Go to events</h1>
          <p style={{ color: "#555", fontSize: 18, marginTop: 6 }}>Find what is happening, then invite someone to join.</p>
        </div>
        <button onClick={loadEvents} style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: "#111", color: "white", fontWeight: "bold", cursor: "pointer" }}>Refresh</button>
      </header>

      <section style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "center" }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Fulltext search: film, concert, city, source..." style={input} />
          <select value={city} onChange={e => setCity(e.target.value)} style={input}><option value="">All cities</option>{cities.map(c => <option key={c}>{c}</option>)}</select>
          <select value={category} onChange={e => setCategory(e.target.value)} style={input}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
          <span style={{ color: "#777", fontSize: 13, whiteSpace: "nowrap" }}>{filtered.length} events</span>
        </div>
      </section>

      {loading && <p style={{ color: "#777" }}>Loading events...</p>}

      {!loading && Object.entries(groups).map(([label, list]) => (
        <section key={label} style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>{label}</h2>
          {list.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {list.map(e => (
                <article key={e.id} style={{ ...card, fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                    <b style={{ fontSize: 16 }}>{e.title || "Untitled event"}</b>
                    <span style={{ color: "#666", whiteSpace: "nowrap" }}>{e.city || "Unknown"}</span>
                  </div>
                  <div style={{ color: "#555", margin: "6px 0", lineHeight: 1.35 }}>{teaserFor(e)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ color: "#888", fontSize: 12 }}>{e.event_date || "date TBA"} {e.event_time || "time TBA"} · {e.category || "event"} · {e.source || "external"}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a href={inviteUrl(e)} style={primarySmallButton}>Invite someone</a>
                      {e.url && <a href={e.url} target="_blank" rel="noreferrer" style={smallButton}>Open</a>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : <p style={{ color: "#999", marginTop: 0 }}>Nothing here.</p>}
        </section>
      ))}
    </main>
  );
}
