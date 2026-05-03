const CITIES = [
  "Deggendorf", "Passau", "Regensburg", "Munich", "Mnichov", "Nuremberg", "Nurnberg", "Nürnberg",
  "Prague", "Praha", "Brno", "Plzen", "Plzeň", "Klatovy", "Ceske Budejovice", "České Budějovice",
  "Karlovy Vary", "Liberec", "Olomouc", "Ostrava", "Hradec Kralove", "Hradec Králové", "Pardubice",
  "Jihlava", "Zlin", "Zlín", "Tabor", "Tábor", "Pisek", "Písek", "Domazlice", "Domažlice",
  "Berlin", "Dresden", "Leipzig", "Hamburg", "Cologne", "Frankfurt", "Stuttgart", "Augsburg",
  "Salzburg", "Vienna", "Linz", "Graz", "Innsbruck", "Zurich", "Basel", "Bern",
  "Bratislava", "Kosice", "Budapest", "Warsaw", "Krakow", "Wroclaw", "Poznan", "Amsterdam",
  "Brussels", "Paris", "London", "Copenhagen", "Stockholm", "Rome", "Milan", "Barcelona", "Madrid"
];

const TEMPLATES = [
  { category: "concert", title: "Live music night", time: "20:00", source: "curated music" },
  { category: "cinema", title: "Indie film screening", time: "18:30", source: "curated cinema" },
  { category: "theatre", title: "Small theatre evening", time: "19:00", source: "curated theatre" },
  { category: "meetup", title: "Open community meetup", time: "18:00", source: "curated meetup" },
  { category: "sport", title: "Local match night", time: "19:30", source: "curated sport" },
  { category: "culture", title: "Museum and culture walk", time: "16:00", source: "curated culture" },
  { category: "food", title: "Food market walk", time: "11:00", source: "curated food" }
];

function isoDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function keyOf(event) {
  return [event.title, event.city, event.event_date, event.event_time]
    .map((x) => String(x || "").trim().toLowerCase())
    .join("|");
}

function buildCandidateEvents() {
  const events = [];
  CITIES.forEach((city, cityIndex) => {
    TEMPLATES.forEach((template, templateIndex) => {
      const offset = ((cityIndex + templateIndex) % 21) + 1;
      events.push({
        title: `${template.title} in ${city}`,
        city,
        category: template.category,
        event_date: isoDate(offset),
        event_time: template.time,
        source: template.source,
        url: `https://www.google.com/search?q=${encodeURIComponent(city + " " + template.title + " events")}`
      });
    });
  });
  return events;
}

async function fetchExistingEvents(supabaseUrl, anonKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/events?select=title,city,event_date,event_time`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    },
    cache: "no-store"
  });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function insertEvents(supabaseUrl, anonKey, events) {
  if (!events.length) return { ok: true, status: 200, text: "nothing to insert" };

  const res = await fetch(`${supabaseUrl}/rest/v1/events`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(events)
  });

  return { ok: res.ok, status: res.status, text: await res.text() };
}

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return Response.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const existing = await fetchExistingEvents(supabaseUrl, anonKey);
  const existingKeys = new Set(existing.map(keyOf));
  const candidates = buildCandidateEvents();
  const unique = [];
  const seen = new Set(existingKeys);

  candidates.forEach((event) => {
    const key = keyOf(event);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  });

  const result = await insertEvents(supabaseUrl, anonKey, unique);

  if (!result.ok) {
    return Response.json({ error: "Import failed", status: result.status, detail: result.text }, { status: 500 });
  }

  return Response.json({
    cities: CITIES.length,
    candidates: candidates.length,
    existing: existing.length,
    inserted: unique.length,
    skipped_duplicates: candidates.length - unique.length
  });
}
