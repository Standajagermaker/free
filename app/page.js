"use client";

import { useEffect, useMemo, useState } from "react";

const FALLBACK_CITY_COORDS = {
  prague: { lat: 50.0755, lng: 14.4378 },
  praha: { lat: 50.0755, lng: 14.4378 },
  brno: { lat: 49.1951, lng: 16.6068 },
  ostrava: { lat: 49.8209, lng: 18.2625 },
  plzen: { lat: 49.7384, lng: 13.3736 },
  pilsen: { lat: 49.7384, lng: 13.3736 },
  olomouc: { lat: 49.5938, lng: 17.2509 },
  liberec: { lat: 50.7663, lng: 15.0543 },
  berlin: { lat: 52.52, lng: 13.405 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  wien: { lat: 48.2082, lng: 16.3738 },
  london: { lat: 51.5072, lng: -0.1276 },
  paris: { lat: 48.8566, lng: 2.3522 },
};

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: 16,
  padding: 18,
  background: "white",
  boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
};

const inputStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ccc",
  fontSize: 15,
  boxSizing: "border-box",
};

const buttonStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: 0,
  background: "#111",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

function normalizeCity(city) {
  return String(city || "").trim().toLowerCase();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function geocodeCity(city) {
  const key = normalizeCity(city);
  if (FALLBACK_CITY_COORDS[key]) return FALLBACK_CITY_COORDS[key];

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data[0]) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function cityGroups(ads) {
  const groups = new Map();
  ads.forEach((ad) => {
    const rawCity = ad.city || "Unknown";
    const key = normalizeCity(rawCity);
    const lat = toNumber(ad.lat);
    const lng = toNumber(ad.lng);
    const fallback = FALLBACK_CITY_COORDS[key] || null;
    const coords = lat !== null && lng !== null ? { lat, lng } : fallback;

    if (!groups.has(key)) groups.set(key, { city: rawCity, count: 0, ads: [], coords });
    const group = groups.get(key);
    group.count += 1;
    group.ads.push(ad);
    if (!group.coords && coords) group.coords = coords;
  });
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

function AnonymousCityMap({ ads }) {
  const groups = cityGroups(ads).filter((group) => group.coords);

  if (!groups.length) {
    return (
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>City map</h2>
        <p style={{ color: "#777" }}>No mapped city locations yet. Add an ad with a city name.</p>
      </div>
    );
  }

  const lats = groups.map((group) => group.coords.lat);
  const lngs = groups.map((group) => group.coords.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);

  function pointStyle(group) {
    const x = 8 + ((group.coords.lng - minLng) / lngSpan) * 84;
    const y = 92 - ((group.coords.lat - minLat) / latSpan) * 84;
    const size = Math.min(34 + group.count * 12, 104);
    return {
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
    };
  }

  return (
    <div style={{ ...cardStyle, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>City map</h2>
        <span style={{ color: "#777", fontSize: 13 }}>Approximate city-level areas only</span>
      </div>
      <div style={{ position: "relative", height: 280, marginTop: 14, borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg, #e9f0e5, #d9e5ef)", border: "1px solid #d5d5d5" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        {groups.map((group) => (
          <div key={group.key} title={`${group.city}: ${group.count} ads`} style={{ position: "absolute", borderRadius: "999px", border: "3px solid #111", background: "rgba(17, 17, 17, 0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", ...pointStyle(group) }}>
            <div style={{ background: "white", border: "1px solid #ddd", borderRadius: 999, padding: "5px 8px", fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}>
              {group.city} · {group.count}
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: "#777", fontSize: 13, lineHeight: 1.5 }}>
        Circles show only the city area, never a street or exact position. Coordinates are saved only at city level.
      </p>
    </div>
  );
}

export default function Page() {
  const [ads, setAds] = useState([]);
  const [responseCounts, setResponseCounts] = useState({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedAd, setSelectedAd] = useState(null);
  const [replyPasswords, setReplyPasswords] = useState({});

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const headers = useMemo(
    () => ({
      apikey: anonKey || "",
      Authorization: `Bearer ${anonKey || ""}`,
      "Content-Type": "application/json",
    }),
    [anonKey]
  );

  async function api(path, options = {}) {
    if (!supabaseUrl || !anonKey) throw new Error("Missing Supabase environment variables.");
    return fetch(`${supabaseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
  }

  async function uploadImage(file) {
    if (!file || file.size === 0) return "";

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${Date.now()}-${safeName}`;
    const response = await fetch(`${supabaseUrl}/storage/v1/object/ads/${filePath}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });

    if (!response.ok) throw new Error(await response.text());
    return `${supabaseUrl}/storage/v1/object/public/ads/${filePath}`;
  }

  async function loadAds() {
    try {
      const response = await api("/rest/v1/ads?select=*&order=created_at.desc&limit=100");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setAds(data);
    } catch (error) {
      setStatus(`Error loading ads: ${error.message}`);
    }
  }

  async function loadResponseCounts() {
    try {
      const response = await api("/rest/v1/responses?select=ad_id");
      if (!response.ok) return;
      const data = await response.json();
      const counts = data.reduce((acc, item) => {
        acc[item.ad_id] = (acc[item.ad_id] || 0) + 1;
        return acc;
      }, {});
      setResponseCounts(counts);
    } catch {
      setResponseCounts({});
    }
  }

  async function refreshAll() {
    await loadAds();
    await loadResponseCounts();
  }

  useEffect(() => {
    refreshAll();
  }, []);

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
        password: form.get("password") || "",
        image_url: imageUrl,
      };

      if (!payload.password || payload.password.length < 3) {
        throw new Error("Password must have at least 3 characters.");
      }

      const response = await api("/rest/v1/ads", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());

      formEl.reset();
      setStatus("Ad created. City coordinates and image were saved.");
      await refreshAll();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(event, ad) {
    event.preventDefault();

    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    setStatus("");

    const payload = {
      ad_id: ad.id,
      message: form.get("message") || "",
      contact: form.get("contact") || "",
    };

    try {
      const response = await api("/rest/v1/responses", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      formEl.reset();
      setStatus("Reply sent anonymously.");
      await loadResponseCounts();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  }

  async function readReplies(ad) {
    setStatus("");
    const password = replyPasswords[ad.id] || "";

    if (password !== ad.password) {
      setStatus("Wrong password for this ad.");
      return;
    }

    try {
      const response = await api(`/rest/v1/responses?ad_id=eq.${ad.id}&select=*&order=created_at.desc`);
      if (!response.ok) throw new Error(await response.text());
      const replies = await response.json();
      setSelectedAd({ ...ad, replies });
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  }

  const filteredAds = ads.filter((ad) => {
    const haystack = `${ad.title || ""} ${ad.description || ""} ${ad.city || ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <main style={{ minHeight: "100vh", background: "#f5f5f0", color: "#111", fontFamily: "Arial, sans-serif", padding: 30 }}>
      <section style={{ maxWidth: 1050, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <p style={{ fontWeight: "bold", color: "#666", margin: 0 }}>Anonymous classifieds</p>
          <h1 style={{ fontSize: 58, margin: "8px 0" }}>feelfree</h1>
          <p style={{ fontSize: 19, lineHeight: 1.5, color: "#444" }}>
            Post anything legal. Stay anonymous. Replies are hidden and can be read only with the ad password.
          </p>
          <p style={{ background: "#fff7d6", padding: 14, borderRadius: 12, border: "1px solid #ead48a", color: "#6b5500" }}>
            Safety rule: do not post illegal goods, weapons, drugs, explicit content, personal data, threats, harassment, or scams.
          </p>
        </header>

        <AnonymousCityMap ads={filteredAds} />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) 1fr", gap: 22, alignItems: "start", marginTop: 22 }}>
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Create ad</h2>

            <form onSubmit={createAd} style={{ display: "grid", gap: 12 }}>
              <input name="title" placeholder="Title" required style={inputStyle} />
              <textarea name="description" placeholder="What are you offering / looking for?" required rows={7} style={inputStyle} />
              <input name="city" placeholder="City only, e.g. Prague" required style={inputStyle} />
              <input name="password" placeholder="Your secret password" required style={inputStyle} />
              <input name="image" type="file" accept="image/*" style={inputStyle} />
              <button disabled={loading} style={buttonStyle}>{loading ? "Posting..." : "Post anonymously"}</button>
            </form>

            <p style={{ color: "#777", fontSize: 13, lineHeight: 1.5 }}>
              Keep the password. City is converted to approximate coordinates only. Exact location is never stored.
            </p>
          </section>

          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>Browse ads</h2>
              <button onClick={refreshAll} style={{ ...buttonStyle, background: "#333" }}>Refresh</button>
            </div>

            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, text or city..." style={{ ...inputStyle, marginTop: 14 }} />

            {status && <p style={{ color: status.startsWith("Error") || status.startsWith("Wrong") ? "#b91c1c" : "#166534" }}>{status}</p>}

            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {filteredAds.map((ad) => (
                <article key={ad.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: "#fafafa" }}>
                  {ad.image_url && <img src={ad.image_url} alt="Ad image" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />}

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <h3 style={{ margin: 0 }}>{ad.title}</h3>
                    <span style={{ color: "#666" }}>{responseCounts[ad.id] || 0} replies</span>
                  </div>

                  <p style={{ color: "#555" }}>{ad.city}</p>
                  <p style={{ lineHeight: 1.55 }}>{ad.description}</p>
                  <p style={{ color: "#777", fontSize: 13 }}>
                    Posted: {String(ad.created_at || "").slice(0, 10)} · city-level location only · expires after 30 days
                  </p>

                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Reply to this ad</summary>
                    <form onSubmit={(event) => sendReply(event, ad)} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <textarea name="message" placeholder="Your message" required rows={3} style={inputStyle} />
                      <input name="contact" placeholder="Your contact, e.g. email/phone/Telegram" required style={inputStyle} />
                      <button style={buttonStyle}>Send reply</button>
                    </form>
                  </details>

                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Read replies with password</summary>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <input
                        value={replyPasswords[ad.id] || ""}
                        onChange={(event) => setReplyPasswords({ ...replyPasswords, [ad.id]: event.target.value })}
                        placeholder="Ad password"
                        style={inputStyle}
                      />
                      <button type="button" onClick={() => readReplies(ad)} style={buttonStyle}>Open</button>
                    </div>
                  </details>
                </article>
              ))}
              {!filteredAds.length && <p style={{ color: "#777" }}>No ads found.</p>}
            </div>
          </section>
        </div>

        {selectedAd && (
          <section style={{ ...cardStyle, marginTop: 22 }}>
            <h2>Replies for: {selectedAd.title}</h2>
            {selectedAd.replies?.length ? selectedAd.replies.map((reply) => (
              <article key={reply.id} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                <p>{reply.message}</p>
                <p><strong>Contact:</strong> {reply.contact}</p>
              </article>
            )) : <p>No replies yet.</p>}
          </section>
        )}
      </section>
    </main>
  );
}
