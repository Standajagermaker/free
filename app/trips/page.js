"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../Map"), { ssr: false });

const inputStyle = { width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10, boxSizing: "border-box" };
const buttonStyle = { padding: "9px 12px", border: 0, borderRadius: 9, background: "#111", color: "white", cursor: "pointer", fontWeight: "bold" };
const smallButton = { padding: "6px 9px", borderRadius: 8, border: "1px solid #ccc", background: "white", color: "#111", cursor: "pointer", textDecoration: "none", fontSize: 13 };
const cardStyle = { border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "white", boxSizing: "border-box", minWidth: 0 };

const FALLBACK_CITY_COORDS = {
  prague: { lat: 50.0755, lng: 14.4378 },
  praha: { lat: 50.0755, lng: 14.4378 },
  brno: { lat: 49.1951, lng: 16.6068 },
  plzen: { lat: 49.7384, lng: 13.3736 },
  "plzeň": { lat: 49.7384, lng: 13.3736 },
  klatovy: { lat: 49.3956, lng: 13.2951 },
  deggendorf: { lat: 48.8418, lng: 12.9607 },
  passau: { lat: 48.5667, lng: 13.4319 },
  regensburg: { lat: 49.0134, lng: 12.1016 },
  munich: { lat: 48.1351, lng: 11.5820 },
  mnichov: { lat: 48.1351, lng: 11.5820 },
  nürnberg: { lat: 49.4521, lng: 11.0767 },
  nuremberg: { lat: 49.4521, lng: 11.0767 },
  berlin: { lat: 52.52, lng: 13.405 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  london: { lat: 51.5072, lng: -0.1276 },
  paris: { lat: 48.8566, lng: 2.3522 }
};

function normalizeCity(city) { return String(city || "").trim().toLowerCase(); }

async function geocodePlace(city, street) {
  const query = [street, city].filter(Boolean).join(", ");
  const key = normalizeCity(city);

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query || city)}`);
    if (res.ok) {
      const data = await res.json();
      if (data[0]) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    }
  } catch {}

  return FALLBACK_CITY_COORDS[key] || { lat: null, lng: null };
}

export default function TripsPage() {
  const [tips, setTips] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function loadTips() {
    setLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/trip_tips?select=*&order=created_at.desc`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
      });
      const data = await res.json();
      setTips(Array.isArray(data) ? data : []);
    } catch {
      setTips([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTips(); }, []);

  const filtered = tips.filter(t => {
    const q = query.toLowerCase();
    return `${t.title || ""} ${t.description || ""} ${t.city || ""} ${t.street || ""}`.toLowerCase().includes(q);
  });

  async function createTip(e) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const city = form.get("city") || "";
    const street = form.get("street") || "";
    setStatus("");

    try {
      const coords = await geocodePlace(city, street);
      const payload = {
        title: form.get("title"),
        description: form.get("description"),
        city,
        street,
        url: form.get("url") || null,
        lat: coords.lat,
        lng: coords.lng
      };

      const res = await fetch(`${supabaseUrl}/rest/v1/trip_tips`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      formEl.reset();
      setStatus("Trip tip added.");
      loadTips();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh", overflowX: "hidden" }}>
      <h1 style={{ marginBottom: 4 }}>trip tips</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Places worth going. No schedule. Just go.</p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 34%) minmax(0, 1fr)", gap: 16, alignItems: "start", width: "100%" }}>
        <aside style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <section style={{ ...cardStyle, overflow: "hidden" }}>
            <Map ads={filtered} />
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Add trip hint</h2>
            <form onSubmit={createTip} style={{ display: "grid", gap: 8 }}>
              <input name="title" placeholder="Place / idea" required style={inputStyle} />
              <textarea name="description" placeholder="Why go there" required rows={4} style={inputStyle} />
              <input name="city" placeholder="City / area" required style={inputStyle} />
              <input name="street" placeholder="Street / exact place" style={inputStyle} />
              <input name="url" placeholder="Link (maps, website, IG...)" style={inputStyle} />
              <button style={buttonStyle}>Add tip</button>
            </form>
            {status && <p style={{ fontSize: 13, color: status.startsWith("Error") ? "#b91c1c" : "#166534" }}>{status}</p>}
          </section>
        </aside>

        <section style={{ ...cardStyle, minWidth: 0, overflow: "hidden" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>Browse trip tips</h2>
          <input
            placeholder="Search title, description, city or street..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          {loading && <p style={{ color: "#777" }}>Loading...</p>}

          <div style={{ display: "grid", gap: 8 }}>
            {!loading && filtered.map(t => (
              <article key={t.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 10, fontSize: 14, background: "#fafafa", minWidth: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <b style={{ overflowWrap: "anywhere" }}>{t.title}</b>
                  <span style={{ color: "#666", whiteSpace: "nowrap" }}>{t.city}</span>
                </div>

                <div style={{ color: "#555", margin: "5px 0", lineHeight: 1.35, overflowWrap: "anywhere" }}>{t.description}</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span style={{ color: "#888", fontSize: 12 }}>
                    {t.street ? `${t.street} · ` : ""}{t.lat && t.lng ? `${Number(t.lat).toFixed(4)}, ${Number(t.lng).toFixed(4)}` : "city-level location"}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {t.url && <a href={t.url} target="_blank" rel="noreferrer" style={smallButton}>Open</a>}
                  </div>
                </div>
              </article>
            ))}
            {!loading && !filtered.length && <p style={{ color: "#777" }}>No trip tips found.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
