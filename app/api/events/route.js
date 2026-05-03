const CURATED_EVENTS = [
  { id: "goout-prague-jazz", title: "Jazz evening in Prague", city: "Prague", event_date: "today", event_time: "20:00", category: "concert", source: "GoOut style", url: "https://goout.net/" },
  { id: "goout-prague-theatre", title: "Small theatre night", city: "Prague", event_date: "tomorrow", event_time: "19:30", category: "theatre", source: "Prague culture", url: "https://goout.net/" },
  { id: "kino-prague", title: "Indie film screening", city: "Prague", event_date: "this week", event_time: "18:00", category: "cinema", source: "Cinema tips", url: "https://www.kinoatlaspraha.cz/" },
  { id: "meetup-prague", title: "Open meetup for makers", city: "Prague", event_date: "this week", event_time: "18:30", category: "meetup", source: "Community", url: "https://www.meetup.com/" },
  { id: "berlin-music", title: "Live music in Kreuzberg", city: "Berlin", event_date: "today", event_time: "21:00", category: "concert", source: "Berlin music", url: "https://www.visitberlin.de/" },
  { id: "berlin-gallery", title: "Gallery opening", city: "Berlin", event_date: "tomorrow", event_time: "18:00", category: "art", source: "Berlin culture", url: "https://www.visitberlin.de/" },
  { id: "berlin-club", title: "Electronic night", city: "Berlin", event_date: "weekend", event_time: "23:00", category: "party", source: "Berlin nightlife", url: "https://www.visitberlin.de/" },
  { id: "vienna-classical", title: "Classical concert", city: "Vienna", event_date: "today", event_time: "19:00", category: "concert", source: "Vienna culture", url: "https://www.wien.info/" },
  { id: "vienna-museum", title: "Museum evening", city: "Vienna", event_date: "tomorrow", event_time: "17:00", category: "culture", source: "Vienna museums", url: "https://www.wien.info/" },
  { id: "vienna-food", title: "Food market walk", city: "Vienna", event_date: "weekend", event_time: "11:00", category: "food", source: "City guide", url: "https://www.wien.info/" },
  { id: "london-comedy", title: "Stand-up comedy night", city: "London", event_date: "this week", event_time: "20:00", category: "comedy", source: "London picks", url: "https://www.timeout.com/london" },
  { id: "paris-film", title: "French cinema night", city: "Paris", event_date: "this week", event_time: "19:00", category: "cinema", source: "Paris picks", url: "https://www.timeout.com/paris" }
];

function normalizeEventbriteEvent(e) {
  const start = e.start?.local || e.start?.utc || "";
  return {
    id: e.id,
    title: e.name?.text || e.name?.html || "Untitled event",
    city: e.online_event ? "Online" : (e.venue?.address?.city || "Unknown"),
    event_date: start.slice(0, 10),
    event_time: start.slice(11, 16),
    category: "event",
    source: "Eventbrite",
    url: e.url || "",
  };
}

function normalizeSupabaseEvent(e) {
  return {
    id: e.id,
    title: e.title || "Untitled event",
    city: e.city || "Unknown",
    event_date: e.event_date || "",
    event_time: e.event_time || "",
    category: e.category || "event",
    source: e.source || "Supabase",
    url: e.url || "",
  };
}

async function ebGet(path, token) {
  const res = await fetch(`https://www.eventbriteapi.com/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, path, data };
}

async function fetchEventbriteOwnedEvents(token) {
  const orgsResult = await ebGet("/users/me/organizations/", token);
  const organizations = orgsResult.data?.organizations || [];
  const eventResults = [];
  for (const org of organizations) {
    const orgId = org.id;
    const eventsResult = await ebGet(`/organizations/${orgId}/events/?status=live&expand=venue`, token);
    eventResults.push({ organization: org.name || orgId, organization_id: orgId, ...eventsResult });
  }
  const events = eventResults.flatMap((result) => result.data?.events || []).map(normalizeEventbriteEvent);
  return { orgsResult, organizations, eventResults, events };
}

async function fetchSupabaseEvents() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { ok: false, status: 0, events: [], error: "Missing Supabase env" };
  const res = await fetch(`${supabaseUrl}/rest/v1/events?select=*&order=event_date.asc`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  return { ok: res.ok, status: res.status, events: Array.isArray(data) ? data.map(normalizeSupabaseEvent) : [], error: Array.isArray(data) ? null : data };
}

function sortEvents(events) {
  return events.filter((event) => event.title).sort((a, b) => `${a.event_date || ""} ${a.event_time || ""}`.localeCompare(`${b.event_date || ""} ${b.event_time || ""}`)).slice(0, 120);
}

export async function GET(request) {
  const token = process.env.EVENTBRITE_TOKEN;
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";
  let eventbrite = null;
  let supabase = null;
  let sourceUsed = "curated";
  let events = [];

  try {
    if (token) {
      eventbrite = await fetchEventbriteOwnedEvents(token);
      events = sortEvents(eventbrite.events);
      if (events.length) sourceUsed = "eventbrite";
    }
    if (!events.length) {
      supabase = await fetchSupabaseEvents();
      events = sortEvents(supabase.events);
      if (events.length) sourceUsed = "supabase";
    }
    if (!events.length) {
      events = sortEvents(CURATED_EVENTS);
      sourceUsed = "curated";
    }
    if (debug) {
      return Response.json({
        token_present: Boolean(token),
        source_used: sourceUsed,
        eventbrite_orgs_status: eventbrite?.orgsResult?.status || null,
        eventbrite_orgs_count: eventbrite?.organizations?.length || 0,
        eventbrite_event_results: (eventbrite?.eventResults || []).map((result) => ({ organization: result.organization, organization_id: result.organization_id, status: result.status, ok: result.ok, count: result.data?.events?.length || 0, error: result.data?.error || result.data?.error_description || null })),
        supabase_status: supabase?.status || null,
        supabase_count: supabase?.events?.length || 0,
        curated_count: CURATED_EVENTS.length,
        final_count: events.length,
        sample: events[0] || null,
      });
    }
    return Response.json(events);
  } catch (err) {
    return Response.json({ error: "API failed", detail: String(err?.message || err) }, { status: 500 });
  }
}
