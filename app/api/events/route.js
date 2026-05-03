function normalizeEventbriteEvent(e) {
  const start = e.start?.local || e.start?.utc || "";
  return {
    id: e.id,
    title: e.name?.text || e.name?.html || "Untitled event",
    city: e.venue?.address?.city || e.online_event ? "Online" : "Unknown",
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
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

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

  const events = eventResults
    .flatMap((result) => result.data?.events || [])
    .map(normalizeEventbriteEvent);

  return { orgsResult, organizations, eventResults, events };
}

async function fetchSupabaseEvents() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return { ok: false, status: 0, events: [], error: "Missing Supabase env" };

  const res = await fetch(`${supabaseUrl}/rest/v1/events?select=*&order=event_date.asc`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => []);
  return {
    ok: res.ok,
    status: res.status,
    events: Array.isArray(data) ? data.map(normalizeSupabaseEvent) : [],
    error: Array.isArray(data) ? null : data,
  };
}

function sortEvents(events) {
  return events
    .filter((event) => event.title)
    .sort((a, b) => `${a.event_date || ""} ${a.event_time || ""}`.localeCompare(`${b.event_date || ""} ${b.event_time || ""}`))
    .slice(0, 120);
}

export async function GET(request) {
  const token = process.env.EVENTBRITE_TOKEN;
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  let eventbrite = null;
  let supabase = null;
  let events = [];

  try {
    if (token) {
      eventbrite = await fetchEventbriteOwnedEvents(token);
      events = sortEvents(eventbrite.events);
    }

    if (!events.length) {
      supabase = await fetchSupabaseEvents();
      events = sortEvents(supabase.events);
    }

    if (debug) {
      return Response.json({
        token_present: Boolean(token),
        eventbrite_orgs_status: eventbrite?.orgsResult?.status || null,
        eventbrite_orgs_count: eventbrite?.organizations?.length || 0,
        eventbrite_event_results: (eventbrite?.eventResults || []).map((result) => ({
          organization: result.organization,
          organization_id: result.organization_id,
          status: result.status,
          ok: result.ok,
          count: result.data?.events?.length || 0,
          error: result.data?.error || result.data?.error_description || null,
        })),
        supabase_status: supabase?.status || null,
        supabase_count: supabase?.events?.length || 0,
        final_count: events.length,
        sample: events[0] || null,
      });
    }

    return Response.json(events);
  } catch (err) {
    return Response.json({ error: "API failed", detail: String(err?.message || err) }, { status: 500 });
  }
}
