"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), { ssr: false });

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid #ddd",
  borderRadius: 10,
  boxSizing: "border-box",
};

const buttonStyle = {
  padding: "9px 12px",
  border: 0,
  borderRadius: 9,
  background: "#111",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 12,
  background: "white",
};

const FALLBACK_CITY_COORDS = {
  prague: { lat: 50.0755, lng: 14.4378 },
  praha: { lat: 50.0755, lng: 14.4378 },
  brno: { lat: 49.1951, lng: 16.6068 },
  berlin: { lat: 52.52, lng: 13.405 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  london: { lat: 51.5072, lng: -0.1276 },
  paris: { lat: 48.8566, lng: 2.3522 },
};

function normalizeCity(city) {
  return String(city || "").trim().toLowerCase();
}

function answersLabel(count) {
  if (!count) return "0 answers";
  if (count === 1) return "1 answer";
  return `${count} answers`;
}

function timeLabel(ad) {
  const from = ad.event_from || ad.time_from || "";
  const to = ad.event_to || ad.time_to || "";
  if (from && to) return `${from} - ${to}`;
  if (from) return `from ${from}`;
  if (to) return `until ${to}`;
  return String(ad.created_at || "").slice(0, 10);
}

async function geocodeCity(city) {
  const key = normalizeCity(city);
  if (FALLBACK_CITY_COORDS[key]) return FALLBACK_CITY_COORDS[key];

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    return null;
  }
}

export default function Page() {
  const [ads, setAds] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({});
  const [visits, setVisits] = useState(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const authHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  async function loadAds() {
    const res = await fetch(`${supabaseUrl}/rest/v1/ads?select=*&order=created_at.desc`, {
      headers: authHeaders,
    });
    const data = await res.json();
    setAds(Array.isArray(data) ? data : []);
  }

  async function loadCounts() {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/responses?select=ad_id`, {
        headers: authHeaders,
      });
      const data = await res.json();
      const map = {};
      (Array.isArray(data) ? data : []).forEach((row) => {
        map[row.ad_id] = (map[row.ad_id] || 0) + 1;
      });
      setCounts(map);
    } catch {
      setCounts({});
    }
  }

  async function trackVisit() {
    try {
      await fetch(`${supabaseUrl}/rest/v1/site_visits`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ page: "home" }),
      });
      const res = await fetch(`${supabaseUrl}/rest/v1/site_visits?select=id`, {
        headers: { ...authHeaders, Prefer: "count=exact" },
      });
      const range = res.headers.get("content-range") || "";
      const count = range.includes("/") ? Number(range.split("/").pop()) : null;
      if (Number.isFinite(count)) setVisits(count);
    } catch {
      const local = Number(localStorage.getItem("feelfree_visits") || "0") + 1;
      localStorage.setItem("feelfree_visits", String(local));
      setVisits(local);
    }
  }

  async function refreshAll() {
    await loadAds();
    await loadCounts();
  }

  useEffect(() => {
    refreshAll();
    trackVisit();
  }, []);

  async function uploadImage(file) {
    if (!file || file.size === 0) return "";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${Date.now()}-${safeName}`;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/ads/${filePath}`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });
    if (!res.ok) throw new Error(await res.text());
    return `${supabaseUrl}/storage/v1/object/public/ads/${filePath}`;
  }

  async function createAd(event) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setLoading(true);
    setStatus("");

    try {
      const city = form.get("city") || "Unknown";
      const coords = await geocodeCity(city);
      const imageUrl = await uploadImage(form.get("image"));
      const payload = {
        title: form.get("title") || "Untitled",
        description: form.get("description") || "",
        city,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        event_from: form.get("event_from") || null,
        event_to: form.get("event_to") || null,
        password: form.get("password") || "",
        image_url: imageUrl,
      };

      if (!payload.password || payload.password.length < 3) throw new Error("Password must have at least 3 characters.");

      const res = await fetch(`${supabaseUrl}/rest/v1/ads`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      formEl.reset();
      setStatus("Ad created.");
      await refreshAll();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const filtered = ads.filter((ad) => {
    const q = query.toLowerCase();
    const haystack = `${ad.title || ""} ${ad.description || ""} ${ad.city || ""}`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <main style={{ padding: 20, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>feelfree</h1>
          <p style={{ color: "#555", marginTop: 4 }}>Anonymous classifieds. City-level location only.</p>
        </div>
        <div style={{ ...cardStyle, padding: "8px 12px", textAlign: "right", minWidth: 110 }}>
          <div style={{ color: "#777", fontSize: 12 }}>visits</div>
          <strong>{visits === null ? "-" : visits}</strong>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.85fr) minmax(420px, 2.15fr)", gap: 16, alignItems: "start" }}>
        <aside style={{ display: "grid", gap: 12 }}>
          <section style={cardStyle}>
            <Map ads={filtered} />
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Add ad</h2>
            <form onSubmit={createAd} style={{ display: "grid", gap: 8 }}>
              <input name="title" placeholder="Title" required style={inputStyle} />
              <textarea name="description" placeholder="Description" required rows={4} style={inputStyle} />
              <input name="city" placeholder="City only" required style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input name="event_from" type="datetime-local" title="From" style={inputStyle} />
                <input name="event_to" type="datetime-local" title="To" style={inputStyle} />
              </div>
              <input name="password" placeholder="Password to read replies" required style={inputStyle} />
              <input name="image" type="file" accept="image/*" style={inputStyle} />
              <button disabled={loading} style={buttonStyle}>{loading ? "Posting..." : "Post"}</button>
            </form>
            {status && <p style={{ fontSize: 13, color: status.startsWith("Error") ? "#b91c1c" : "#166534" }}>{status}</p>}
          </section>
        </aside>

        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Browse ads</h2>
            <button onClick={refreshAll} style={{ ...buttonStyle, padding: "8px 10px", background: "#333" }}>Refresh</button>
          </div>

          <input placeholder="Search title, description or city..." value={query} onChange={e => setQuery(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />

          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map(ad => {
              const answerCount = counts[ad.id] || 0;
              return (
                <article key={ad.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 10, fontSize: 14, background: "#fafafa" }}>
                  <div style={{ display: "grid", gridTemplateColumns: ad.image_url ? "96px 1fr" : "1fr", gap: 10 }}>
                    {ad.image_url && <img src={ad.image_url} alt="Ad image" style={{ width: 96, height: 74, objectFit: "cover", borderRadius: 8 }} />}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <b>{ad.title}</b>
                        <span style={{ color: "#666", whiteSpace: "nowrap" }}>{ad.city}</span>
                      </div>
                      <div style={{ color: "#555", margin: "5px 0", lineHeight: 1.35 }}>{ad.description}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <span style={{ color: "#888", fontSize: 12 }}>{timeLabel(ad)} · {answersLabel(answerCount)}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid #ccc", background: "white", cursor: "pointer" }}>{answerCount ? "Reply" : "Reply now"}</button>
                          <button style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid #ccc", background: "white", cursor: "pointer" }}>Read</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {!filtered.length && <p style={{ color: "#777" }}>No ads found.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
