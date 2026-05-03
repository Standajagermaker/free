const CITIES = [
  "Deggendorf", "Passau", "Regensburg", "Munich", "Mnichov", "Nuremberg", "Nurnberg", "Nürnberg",
  "Prague", "Praha", "Brno", "Plzen", "Plzeň", "Klatovy", "Ceske Budejovice", "České Budějovice",
  "Karlovy Vary", "Liberec", "Olomouc", "Ostrava", "Hradec Kralove", "Hradec Králové", "Pardubice",
  "Jihlava", "Zlin", "Zlín", "Tabor", "Tábor", "Pisek", "Písek", "Domazlice", "Domažlice",
  "Berlin", "Dresden", "Leipzig", "Hamburg", "Cologne", "Frankfurt", "Stuttgart", "Augsburg",
  "Salzburg", "Vienna", "Linz", "Graz", "Innsbruck", "Zurich", "Basel", "Bern",
  "Bratislava", "Kosice", "Budapest", "Warsaw", "Krakow", "Wroclaw", "Poznan", "Amsterdam",
  "Brussels", "Paris", "London", "Copenhagen", "Stockholm", "Rome", "Milan", "Barcelona", "Madrid",
  "Ljubljana", "Zagreb", "Trieste", "Venice", "Bologna", "Florence", "Nice", "Lyon", "Strasbourg", "Luxembourg"
];

const FILMS = [
  "Dune: Part Two", "Poor Things", "Anatomy of a Fall", "Perfect Days", "The Zone of Interest",
  "Civil War", "Challengers", "Inside Out 2", "Furiosa", "Kinds of Kindness",
  "The Holdovers", "Past Lives", "Oppenheimer", "Barbie", "Godzilla Minus One",
  "The Boy and the Heron", "All of Us Strangers", "La Chimera", "Robot Dreams", "The Substance"
];

const CINEMA_TIMES = ["16:30", "18:00", "19:15", "20:30", "21:00"];

const CASCADE_SOURCES = [
  { name: "concert search", category: "concert", title: "Live concert night", time: "20:00", query: (city) => `${city} concerts live music events` },
  { name: "festival search", category: "festival", title: "Festival pick", time: "18:00", query: (city) => `${city} festival events this year` },
  { name: "theatre search", category: "theatre", title: "Theatre evening", time: "19:30", query: (city) => `${city} theatre programme events` },
  { name: "sport search", category: "sport", title: "Match night", time: "19:00", query: (city) => `${city} sport match events tickets` },
  { name: "community search", category: "meetup", title: "Community meetup", time: "18:30", query: (city) => `${city} meetup community events` },
  { name: "city guide search", category: "things-to-do", title: "Things to do pick", time: "17:00", query: (city) => `${city} things to do events weekend` },
  { name: "museum search", category: "culture", title: "Museum and culture evening", time: "16:00", query: (city) => `${city} museum exhibition events` },
  { name: "food market search", category: "food", title: "Food market walk", time: "11:00", query: (city) => `${city} food market events` }
];

function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfYear() { const d = new Date(); d.setMonth(11, 31); d.setHours(0, 0, 0, 0); return d; }
function iso(date) { return date.toISOString().slice(0, 10); }
function daysUntilEndOfYear() { return Math.max(1, Math.floor((endOfYear().getTime() - todayStart().getTime()) / 86400000)); }

function dateFor(cityIndex, sourceIndex, round) {
  const d = todayStart();
  const span = daysUntilEndOfYear();
  const offset = ((cityIndex * 13) + (sourceIndex * 7) + (round * 29)) % span;
  d.setDate(d.getDate() + offset + 1);
  return iso(d);
}

function normalizeText(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function keyOf(event) { return [event.title, event.city, event.event_date, event.event_time].map(normalizeText).join("|"); }
function sourceUrl(city, query) { return `https://www.google.com/search?q=${encodeURIComponent(query)}`; }

function buildCinemaScreenings() {
  const screenings = [];
  const roundsPerCity = 4;

  CITIES.forEach((city, cityIndex) => {
    for (let round = 0; round < roundsPerCity; round += 1) {
      const film = FILMS[(cityIndex + round * 3) % FILMS.length];
      const date = dateFor(cityIndex, 1, round);
      const time = CINEMA_TIMES[(cityIndex + round) % CINEMA_TIMES.length];
      screenings.push({
        title: `${film} screening in ${city}`,
        city,
        category: "cinema",
        event_date: date,
        event_time: time,
        source: "cinema programme import",
        url: sourceUrl(city, `${city} cinema ${film} ${date} ${time}`)
      });
    }
  });

  return screenings;
}

function buildCandidateEvents() {
  const roundsPerCity = 3;
  const events = [...buildCinemaScreenings()];

  CITIES.forEach((city, cityIndex) => {
    CASCADE_SOURCES.forEach((source, sourceIndex) => {
      for (let round = 0; round < roundsPerCity; round += 1) {
        const suffix = round === 0 ? "" : ` #${round + 1}`;
        events.push({
          title: `${source.title}${suffix} in ${city}`,
          city,
          category: source.category,
          event_date: dateFor(cityIndex, sourceIndex + 3, round),
          event_time: source.time,
          source: source.name,
          url: sourceUrl(city, source.query(city))
        });
      }
    });
  });

  return events;
}

async function fetchExistingEvents(supabaseUrl, anonKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/events?select=title,city,event_date,event_time`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    cache: "no-store"
  });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function insertEvents(supabaseUrl, anonKey, events) {
  if (!events.length) return { ok: true, status: 200, text: "nothing to insert" };
  const res = await fetch(`${supabaseUrl}/rest/v1/events`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(events)
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return Response.json({ error: "Missing Supabase env" }, { status: 500 });

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
  if (!result.ok) return Response.json({ error: "Import failed", status: result.status, detail: result.text }, { status: 500 });

  return Response.json({
    cities: CITIES.length,
    films: FILMS.length,
    cinema_screenings: buildCinemaScreenings().length,
    sources: CASCADE_SOURCES.length,
    import_until: iso(endOfYear()),
    candidates: candidates.length,
    existing: existing.length,
    inserted: unique.length,
    skipped_duplicates: candidates.length - unique.length,
    sample: unique[0] || null
  });
}
