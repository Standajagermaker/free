const CITIES = ["Prague", "Berlin", "Vienna"];
const SEARCH_TERMS = ["music", "party", "concert", "theatre", "film", "workshop", "festival"];

function normalizeEvent(e, fallbackCity, fallbackCategory) {
  const start = e.start?.local || "";
  const city = e.venue?.address?.city || fallbackCity || "Online / Unknown";
  return {
    id: e.id,
    title: e.name?.text || "Untitled event",
    city,
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
    cache: "no-store",
  });

  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    url,
    count: Array.isArray(data.events) ? data.events.length : 0,
    events: data.events || [],
    error: data.error || data.error_description || data.message || null,
    sample: data.events?.[0]?.name?.text || null,
  };
}

async function fetchCityEvents(city, token) {
  const results = [];

  for (const term of SEARCH_TERMS) {
    const url = `https://www.eventbriteapi.com/v3/events/search/?location.address=${encodeURIComponent(city)}&expand=venue&sort_by=date&q=${encodeURIComponent(term)}`;
    const result = await searchEventbrite(url, token);
    results.push({ city, term, ...result });
  }

  return results;
}

async function fetchGlobalEvents(token) {
  const results = [];

  for (const term of SEARCH_TERMS) {
    const url = `https://www.eventbriteapi.com/v3/events/search/?expand=venue&sort_by=date&q=${encodeURIComponent(term)}`;
    const result = await searchEventbrite(url, token);
    results.push({ city: "global", term, ...result });
  }

  return results;
}

function flattenResults(results) {
  const byId = new Map();

  results.forEach((result) => {
    (result.events || []).forEach((e) => {
      const event = normalizeEvent(e, result.city === "global" ? null : result.city, result.term);
      if (event.id && !byId.has(event.id)) byId.set(event.id, event);
    });
  });

  return [...byId.values()]
    .filter((event) => event.title)
    .sort((a, b) => `${a.event_date || ""} ${a.event_time || ""}`.localeCompare(`${b.event_date || ""} ${b.event_time || ""}`))
    .slice(0, 80);
}

export async function GET(request) {
  const token = process.env.EVENTBRITE_TOKEN;
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  if (!token) {
    return Response.json({ error: "Missing EVENTBRITE_TOKEN" }, { status: 500 });
  }

  try {
    const cityResults = (await Promise.all(CITIES.map((city) => fetchCityEvents(city, token)))).flat();
    let events = flattenResults(cityResults);
    let globalResults = [];

    if (!events.length) {
      globalResults = await fetchGlobalEvents(token);
      events = flattenResults(globalResults);
    }

    if (debug) {
      return Response.json({
        token_present: Boolean(token),
        city_results: cityResults.map(({ events, ...rest }) => rest),
        global_results: globalResults.map(({ events, ...rest }) => rest),
        final_count: events.length,
        sample: events[0] || null,
      });
    }

    return Response.json(events);
  } catch (err) {
    return Response.json({ error: "API failed", detail: String(err?.message || err) }, { status: 500 });
  }
}
