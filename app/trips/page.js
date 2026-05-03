"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../Map"), { ssr: false });

export default function TripsPage() {
  const [tips, setTips] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function loadTips() {
    setLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/trip_tips?select=*`, {
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
    return `${t.title} ${t.description} ${t.city}`.toLowerCase().includes(q);
  });

  async function createTip(e) {
    e.preventDefault();
    const form = new FormData(e.target);

    const payload = {
      title: form.get("title"),
      description: form.get("description"),
      city: form.get("city")
    };

    await fetch(`${supabaseUrl}/rest/v1/trip_tips`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    e.target.reset();
    loadTips();
  }

  return (
    <main style={{ padding: 20, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh" }}>
      <h1>trip tips</h1>
      <p>Places worth going. No schedule. Just go.</p>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        <div>
          <div style={{ marginBottom: 10 }}>
            <Map ads={filtered} />
          </div>

          <form onSubmit={createTip} style={{ display: "grid", gap: 8, background: "white", padding: 12, borderRadius: 12 }}>
            <input name="title" placeholder="Place / idea" required />
            <textarea name="description" placeholder="Why go there" required />
            <input name="city" placeholder="City / area" required />
            <button style={{ background: "black", color: "white", padding: 8 }}>Add tip</button>
          </form>
        </div>

        <div>
          <input
            placeholder="Search tips..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ marginBottom: 10, width: "100%", padding: 8 }}
          />

          {loading && <p>Loading...</p>}

          {!loading && filtered.map(t => (
            <div key={t.id} style={{ background: "white", padding: 10, marginBottom: 8, borderRadius: 10 }}>
              <b>{t.title}</b>
              <div style={{ color: "#555" }}>{t.description}</div>
              <div style={{ fontSize: 12, color: "#777" }}>{t.city}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
