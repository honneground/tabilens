# Ideas

One folder per prototype. The combined product should borrow from these, so make each one easy to learn from.

Each prototype folder should have:

- `README.md`: what it does, what works, how to run it, known gaps
- the code, with no secrets (`.env` stays local) and no cached Redpine content (`.cache/`)
- optionally a `PROPOSAL.md` with the pitch

| Folder | Idea | Data used |
|---|---|---|
| [tabilens-oskar](tabilens-oskar/) | Leaflet map of magazine day-trip spots with Tobu trains; Claude extracts places, free geocoding | ADDIX, Tobu |
| [tabilens-jonas](tabilens-jonas/) | Mood prompt to itinerary: magazine spot with photo, Tobu rail and bus timetable, Chronicle audio for the ride; Google Maps route, mock mode for zero-credit demos | ADDIX, Tobu, Chronicle |
