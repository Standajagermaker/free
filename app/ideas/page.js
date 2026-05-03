"use client";
async function loadEvents() {
  try {
    const res = await fetch("/api/events");
    const data = await res.json();
    setEvents(data || []);
  } catch {
    setEvents([]);
  }
}
