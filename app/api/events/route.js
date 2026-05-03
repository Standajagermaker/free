export async function GET() {
  const token = process.env.EVENTBRITE_TOKEN;

  const url = "https://www.eventbriteapi.com/v3/events/search/?location.address=Prague&expand=venue";

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    const events = (data.events || []).map((e) => ({
      id: e.id,
      title: e.name?.text,
      city: e.venue?.address?.city || "Unknown",
      event_date: e.start?.local?.slice(0, 10),
      event_time: e.start?.local?.slice(11, 16),
      category: "event",
      source: "Eventbrite",
    }));

    return Response.json(events);
  } catch (err) {
    return Response.json({ error: "API failed" }, { status: 500 });
  }
}
