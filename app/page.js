"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), { ssr: false });

const inputStyle = { width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10, boxSizing: "border-box" };
const buttonStyle = { padding: "9px 12px", border: 0, borderRadius: 9, background: "#111", color: "white", cursor: "pointer", fontWeight: "bold" };
const smallButton = { padding: "6px 9px", borderRadius: 8, border: "1px solid #ccc", background: "white", cursor: "pointer" };
const cardStyle = { border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "white", boxSizing: "border-box", minWidth: 0 };

const FALLBACK_CITY_COORDS = {
  prague: { lat: 50.0755, lng: 14.4378 },
  praha: { lat: 50.0755, lng: 14.4378 },
  brno: { lat: 49.1951, lng: 16.6068 },
  berlin: { lat: 52.52, lng: 13.405 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  london: { lat: 51.5072, lng: -0.1276 },
  paris: { lat: 48.8566, lng: 2.3522 }
};

function normalizeCity(city) { return String(city || "").trim().toLowerCase(); }
function answersLabel(count) { return count === 1 ? "1 answer" : `${count || 0} answers`; }
function eventLabel(ad) {
  const date = ad.event_date || ad.event_when || "";
  const time = ad.event_time || ad.time_range || "";
  if (date && time) return `${date} · ${time}`;
  if (date) return date;
  if (time) return time;
  return String(ad.created_at || "").slice(0, 10);
}
function isPublicAd(ad) { return ad.response_mode === "public" || ad.is_public_contact === true; }

async function geocodeCity(city) {
  const key = normalizeCity(city);
  if (FALLBACK_CITY_COORDS[key]) return FALLBACK_CITY_COORDS[key];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch { return null; }
}

export default function Page() {
  const [ads, setAds] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({});
  const [visits, setVisits] = useState(null);
  const [openReply, setOpenReply] = useState(null);
  const [openRead, setOpenRead] = useState(null);
  const [readPasswords, setReadPasswords] = useState({});
  const [openedReplies, setOpenedReplies] = useState({});
  const [responseMode, setResponseMode] = useState("secret");
  const [prefill, setPrefill] = useState({ title: "", city: "", event_date: "", event_time: "" });
  const passwordRef = useRef(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  async function loadAds() {
    const res = await fetch(`${supabaseUrl}/rest/v1/ads?select=*&order=created_at.desc`, { headers: authHeaders });
    const data = await res.json();
    setAds(Array.isArray(data) ? data : []);
  }

  async function loadCounts() {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/responses?select=ad_id`, { headers: authHeaders });
      const data = await res.json();
      const map = {};
      (Array.isArray(data) ? data : []).forEach((row) => { map[row.ad_id] = (map[row.ad_id] || 0) + 1; });
      setCounts(map);
    } catch { setCounts({}); }
  }

  async function trackVisit() {
    try {
      await fetch(`${supabaseUrl}/rest/v1/site_visits`, { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ page: "home" }) });
      const res = await fetch(`${supabaseUrl}/rest/v1/site_visits?select=id`, { headers: { ...authHeaders, Prefer: "count=exact" } });
      const range = res.headers.get("content-range") || "";
      const count = range.includes("/") ? Number(range.split("/").pop()) : null;
      if (Number.isFinite(count)) setVisits(count);
    } catch {
      const local = Number(localStorage.getItem("feelfree_visits") || "0") + 1;
      localStorage.setItem("feelfree_visits", String(local));
      setVisits(local);
    }
  }

  async function refreshAll() { await loadAds(); await loadCounts(); }

  useEffect(() => {
    refreshAll();
    trackVisit();

    const params = new URLSearchParams(window.location.search);
    const nextPrefill = {
      title: params.get("title") || "",
      city: params.get("city") || "",
      event_date: params.get("event_date") || "",
      event_time: params.get("event_time") || ""
    };
    setPrefill(nextPrefill);

    if (nextPrefill.title || nextPrefill.city || nextPrefill.event_date) {
      setStatus("Invite draft loaded. Choose public contact or secret replies. If secret, set a password before posting.");
      setTimeout(() => passwordRef.current?.focus(), 350);
    }
  }, []);

  async function uploadImage(file) {
    if (!file || file.size === 0) return "";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${Date.now()}-${safeName}`;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/ads/${filePath}`, { method: "POST", headers: { ...authHeaders, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
    if (!res.ok) throw new Error(await res.text());
    return `${supabaseUrl}/storage/v1/object/public/ads/${filePath}`;
  }

  async function createAd(event) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setLoading(true); setStatus("");
    try {
      const city = form.get("city") || "Unknown";
      const mode = form.get("response_mode") || "secret";
      const password = form.get("password") || "";
      const coords = await geocodeCity(city);
      const imageUrl = await uploadImage(form.get("image"));
      const payload = {
        title: form.get("title") || "Untitled",
        description: form.get("description") || "",
        city,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        event_date: form.get("event_date") || null,
        event_time: form.get("event_time") || null,
        response_mode: mode,
        public_contact: form.get("public_contact") || null,
        password: mode === "secret" ? password : "",
        image_url: imageUrl
      };
      if (mode === "secret" && (!payload.password || payload.password.length < 3)) throw new Error("Secret replies need a password with at least 3 characters.");
      if (mode === "public" && !payload.public_contact) throw new Error("Public mode needs a public contact or meeting note.");
      const res = await fetch(`${supabaseUrl}/rest/v1/ads`, { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      formEl.reset(); setPrefill({ title: "", city: "", event_date: "", event_time: "" }); setResponseMode("secret"); setStatus("Ad created."); await refreshAll();
    } catch (error) { setStatus(`Error: ${error.message}`); }
    finally { setLoading(false); }
  }

  async function sendReply(event, ad) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setStatus("");
    try {
      const payload = { ad_id: ad.id, message: form.get("message") || "", contact: form.get("contact") || "" };
      const res = await fetch(`${supabaseUrl}/rest/v1/responses`, { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      formEl.reset(); setOpenReply(null); setStatus("Reply sent."); await loadCounts();
    } catch (error) { setStatus(`Error: ${error.message}`); }
  }

  async function readReplies(ad) {
    setStatus("");
    if (!isPublicAd(ad)) {
      const password = readPasswords[ad.id] || "";
      if (password !== ad.password) { setStatus("Wrong password for this ad."); return; }
    }
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/responses?ad_id=eq.${ad.id}&select=*&order=created_at.desc`, { headers: authHeaders });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOpenedReplies({ ...openedReplies, [ad.id]: data });
    } catch (error) { setStatus(`Error: ${error.message}`); }
  }

  const filtered = ads.filter((ad) => {
    const q = query.toLowerCase();
    const haystack = `${ad.title || ""} ${ad.description || ""} ${ad.city || ""}`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <main style={{ padding: 20, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh", overflowX: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>feel free 2</h1>
          <p style={{ color: "#555", marginTop: 4 }}>Anonymous. Free announce, free your mind, feel free to enjoy, offer, share, invite, organize ...</p>
        </div>
        <div style={{ ...cardStyle, padding: "8px 12px", textAlign: "right", minWidth: 110 }}><div style={{ color: "#777", fontSize: 12 }}>visits</div><strong>{visits === null ? "-" : visits}</strong></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 34%) minmax(0, 1fr)", gap: 16, alignItems: "start", marginTop: 16, width: "100%" }}>
        <aside style={{ display: "grid", gap: 12, minWidth: 0, maxWidth: "100%" }}>
          <section style={{ ...cardStyle, overflow: "hidden" }}><div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}><Map ads={filtered} /></div></section>
          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Add ad</h2>
            <form onSubmit={createAd} style={{ display: "grid", gap: 8 }}>
              <input name="title" placeholder="Title" required style={inputStyle} value={prefill.title} onChange={(e) => setPrefill({ ...prefill, title: e.target.value })} />
              <textarea name="description" placeholder="Description" required rows={4} style={inputStyle} defaultValue={prefill.title ? `Hey, who wants to join me for ${prefill.title}?` : ""} />
              <input name="city" placeholder="City only" required style={inputStyle} value={prefill.city} onChange={(e) => setPrefill({ ...prefill, city: e.target.value })} />
              <input name="event_date" placeholder="Date / period, e.g. today, tomorrow, 01.01.2026 or May-June 2027" style={inputStyle} value={prefill.event_date} onChange={(e) => setPrefill({ ...prefill, event_date: e.target.value })} />
              <input name="event_time" placeholder="Time, e.g. 10:00-18:00, evening, all day" style={inputStyle} value={prefill.event_time} onChange={(e) => setPrefill({ ...prefill, event_time: e.target.value })} />

              <div style={{ display: "grid", gap: 6, background: "#fafafa", border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="radio" name="response_mode" value="secret" checked={responseMode === "secret"} onChange={() => setResponseMode("secret")} />
                  Secret replies - read with password
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="radio" name="response_mode" value="public" checked={responseMode === "public"} onChange={() => setResponseMode("public")} />
                  Public contact - no password needed
                </label>
              </div>

              {responseMode === "public" && <input name="public_contact" placeholder="Public contact / meeting note, e.g. Telegram @name or meet at entrance" style={inputStyle} />}

              {responseMode === "secret" && (
                <>
                  <input ref={passwordRef} name="password" type="password" placeholder="Password to read replies - do not forget this" autoComplete="new-password" required style={{ ...inputStyle, border: prefill.title ? "2px solid #111" : "1px solid #ddd" }} />
                  <p style={{ margin: 0, color: "#777", fontSize: 12 }}>Tip: your browser/password manager may offer to save it, but this is not a normal login. Keep it somewhere safe.</p>
                </>
              )}

              <input name="image" type="file" accept="image/*" style={inputStyle} />
              <button disabled={loading} style={buttonStyle}>{loading ? "Posting..." : "Post"}</button>
            </form>
            {status && <p style={{ fontSize: 13, color: status.startsWith("Error") || status.startsWith("Wrong") ? "#b91c1c" : "#166534" }}>{status}</p>}
          </section>
        </aside>

        <section style={{ ...cardStyle, minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 20 }}>Browse ads</h2><button onClick={refreshAll} style={{ ...buttonStyle, padding: "8px 10px", background: "#333" }}>Refresh</button></div>
          <input placeholder="Search title, description or city..." value={query} onChange={e => setQuery(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            {filtered.map(ad => {
              const answerCount = counts[ad.id] || 0;
              const publicMode = isPublicAd(ad);
              return (
                <article key={ad.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 10, fontSize: 14, background: "#fafafa", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: ad.image_url ? "72px minmax(0, 1fr)" : "1fr", gap: 10, minWidth: 0 }}>
                    {ad.image_url && <img src={ad.image_url} alt="Ad image" style={{ width: 72, height: 64, objectFit: "cover", borderRadius: 8 }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b style={{ overflowWrap: "anywhere" }}>{ad.title}</b><span style={{ color: "#666", whiteSpace: "nowrap" }}>{ad.city}</span></div>
                      <div style={{ color: "#555", margin: "5px 0", lineHeight: 1.35, overflowWrap: "anywhere" }}>{ad.description}</div>
                      {publicMode && ad.public_contact && <div style={{ color: "#166534", margin: "5px 0", fontSize: 13, overflowWrap: "anywhere" }}><b>Public contact:</b> {ad.public_contact}</div>}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <span style={{ color: "#888", fontSize: 12 }}>{eventLabel(ad)} · {answersLabel(answerCount)} · {publicMode ? "public" : "secret"}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setOpenReply(openReply === ad.id ? null : ad.id)} style={smallButton}>{answerCount ? "Reply" : "Reply now"}</button>
                          <button onClick={() => { setOpenRead(openRead === ad.id ? null : ad.id); if (publicMode) readReplies(ad); }} style={smallButton}>Read</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {openReply === ad.id && (
                    <form onSubmit={(event) => sendReply(event, ad)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginTop: 10 }}>
                      <input name="message" placeholder="Message" required style={inputStyle} />
                      <input name="contact" placeholder="Contact" required style={inputStyle} />
                      <button style={buttonStyle}>Send</button>
                    </form>
                  )}

                  {openRead === ad.id && (
                    <div style={{ marginTop: 10 }}>
                      {!publicMode && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                          <input value={readPasswords[ad.id] || ""} onChange={(event) => setReadPasswords({ ...readPasswords, [ad.id]: event.target.value })} placeholder="Password" style={inputStyle} />
                          <button onClick={() => readReplies(ad)} style={buttonStyle}>Open</button>
                        </div>
                      )}
                      {openedReplies[ad.id] && (
                        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                          {openedReplies[ad.id].length ? openedReplies[ad.id].map(reply => (
                            <div key={reply.id} style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: 8 }}><div>{reply.message}</div><div style={{ color: "#666", fontSize: 12 }}>{reply.contact}</div></div>
                          )) : <p style={{ color: "#777" }}>No replies yet.</p>}
                        </div>
                      )}
                    </div>
                  )}
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
