const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const events = [
  { title: "Jazz Night", city: "Prague", category: "concert", event_date: "2026-05-05", event_time: "20:00", source: "seed", url: "https://goout.net/" },
  { title: "Berlin Club Night", city: "Berlin", category: "party", event_date: "2026-05-06", event_time: "23:00", source: "seed", url: "https://visitberlin.de/" },
  { title: "Vienna Opera", city: "Vienna", category: "culture", event_date: "2026-05-07", event_time: "19:00", source: "seed", url: "https://wien.info/" }
];

async function run() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase env");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(events)
  });

  const data = await res.text();
  console.log("IMPORT RESULT:", data);
}

run();
