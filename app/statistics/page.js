"use client";

import { useEffect, useState } from "react";

export default function Statistics() {
  const [ads, setAds] = useState([]);
  const [counts, setCounts] = useState({});
  const [visits, setVisits] = useState(0);
  const [importResult, setImportResult] = useState(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`
  };

  async function loadAll() {
    const adsRes = await fetch(`${supabaseUrl}/rest/v1/ads?select=*`, { headers });
    const adsData = await adsRes.json();

    const respRes = await fetch(`${supabaseUrl}/rest/v1/responses?select=ad_id`, { headers });
    const respData = await respRes.json();

    const visitRes = await fetch(`${supabaseUrl}/rest/v1/site_visits?select=id`, { headers: { ...headers, Prefer: "count=exact" } });
    const range = visitRes.headers.get("content-range") || "";
    const visitCount = range.includes("/") ? Number(range.split("/").pop()) : 0;

    const map = {};
    (respData || []).forEach(r => {
      map[r.ad_id] = (map[r.ad_id] || 0) + 1;
    });

    setAds(adsData || []);
    setCounts(map);
    setVisits(visitCount);
  }

  async function runImport() {
    setImportResult("running...");
    const res = await fetch("/api/import-events", { method: "POST" });
    const data = await res.json();
    setImportResult(JSON.stringify(data, null, 2));
  }

  useEffect(() => { loadAll(); }, []);

  const totalAnswers = Object.values(counts).reduce((a, b) => a + b, 0);

  const cities = {};
  ads.forEach(a => {
    const c = a.city || "unknown";
    cities[c] = (cities[c] || 0) + 1;
  });

  const topCities = Object.entries(cities).sort((a,b)=>b[1]-a[1]).slice(0,10);

  return (
    <main style={{padding:30,fontFamily:"Arial"}}>
      <h1>statistics</h1>

      <button onClick={runImport} style={{marginBottom:20,padding:10,borderRadius:8,background:"black",color:"white"}}>
        Import events (50+ cities)
      </button>

      {importResult && (
        <pre style={{background:"#111",color:"#0f0",padding:10,fontSize:12}}>
          {importResult}
        </pre>
      )}

      <p>visits: <b>{visits}</b></p>
      <p>ads: <b>{ads.length}</b></p>
      <p>answers: <b>{totalAnswers}</b></p>

      <h3>top cities</h3>
      {topCities.map(([c,n]) => (
        <div key={c}>{c}: {n}</div>
      ))}

    </main>
  );
}
