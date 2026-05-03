const CITIES = ["Prague", "Berlin", "Vienna"];
const SEARCH_TERMS = ["music", "party", "concert", "theatre", "film"];

function normalizeEvent(e, fallbackCity, fallbackCategory) {
  const start = e.start?.local || "";
  return {
    id: e.id,
    title: e.name?.text || "Untitled event",
    city: e.venue?.address?.city || fallbackCity,
    event_date: start.slice(0, 10),
    event_time: start.slice(11, 16),
    category: fallbackCategory || "event",
    source: "Eventbrite",
    url: e.url || "",
  };
}

async function searchEventbrite(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 1800 },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.events || [];
}

async function fetchCityEvents(city, token) {
  const all = [];

  for (const term of SEARCH_TERMS) {
    const url = `https://www.eventbriteapi.com/v3/events/search/?location.address=${encodeURIComponent(city)}&expand=venue&sort_by=date&q=${encodeURIComponent(term)}`;
    const events = await searchEventbrite(url, token);
    all.push(...events.map((e) => normalizeEvent(e, city, term)));
  }

  return all;
}

export async function GET() {
  const token = process.env.EVENTBRITE_TOKEN;

  if (!token) {
    return Response.json({ error: "Missing EVENTBRITE_TOKEN" }, { status: 500 });
  }

  try {
    const batches = await Promise.all(CITIES.map((city) => fetchCityEvents(city, token)));

    const byId = new Map();
    batches.flat().forEach((event) => {
      if (event.id && !byId.has(event.id)) byId.set(event.id, event);
    });

    const events = [...byId.values()]
      .filter((event) => event.title)
      .sort((a, b) => `${a.event_date || ""} ${a.event_time || ""}`.localeCompare(`${b.event_date || ""} ${b.event_time || ""}`))
      .slice(0, 80);

    return Response.json(events);
  } catch (err) {
    return Response.json({ error: "API failed" }, { status: 500 });
  }
}
