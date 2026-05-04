"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../Map"), { ssr: false });

const inputStyle = { width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10, boxSizing: "border-box" };
const buttonStyle = { padding: "9px 12px", border: 0, borderRadius: 9, background: "#111", color: "white", cursor: "pointer", fontWeight: "bold" };
const smallButton = { padding: "6px 9px", borderRadius: 8, border: "1px solid #ccc", background: "white", color: "#111", cursor: "pointer", textDecoration: "none", fontSize: 13 };
const primaryButton = { ...smallButton, background: "#111", color: "white" };
const cardStyle = { border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "white", boxSizing: "border-box", minWidth: 0 };

function inviteUrl(t){
  const title = encodeURIComponent(`Anyone for ${t.title}?`);
  const city = encodeURIComponent(t.city || "");
  return `/?title=${title}&city=${city}`;
}

export default function TripsPage() {
  const [tips, setTips] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <main style={{ padding: 20, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh", overflowX: "hidden" }}>
      {/* odstraněn duplikovaný H1 */}

      <p style={{ color: "#555", marginTop: 0 }}>Places worth going. No schedule. Just go.</p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 34%) minmax(0, 1fr)", gap: 16 }}>
        <aside style={{ display: "grid", gap: 12 }}>
          <section style={{ ...cardStyle, overflow: "hidden" }}>
            <Map ads={filtered} />
          </section>
        </aside>

        <section style={{ ...cardStyle }}>
          <h2 style={{ margin: "0 0 10px" }}>Browse trip tips</h2>
          <input
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map(t => (
              <article key={t.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 10, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{t.title}</b>
                  <span style={{ color: "#666" }}>{t.city}</span>
                </div>

                <div style={{ color: "#555", margin: "5px 0" }}>{t.description}</div>

                <div style={{ display: "flex", gap: 6 }}>
                  <a href={inviteUrl(t)} style={primaryButton}>Invite someone</a>
                  {t.url && <a href={t.url} target="_blank" rel="noreferrer" style={smallButton}>Open</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
