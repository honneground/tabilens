# Project Proposal: TabiLens (旅レンズ)

### *Autonomous Editorial Day-Trip & Transit Copilot*

**Redpine × NordicNinja × KDDI Tokyo Hackathon 2026**  
**Team 19**

---

Planning steps

- How should the homepage look like?  
  - A map  
- How should the users interact with our features  
  - Starting point is a map (starting point your current position), where you can start researching  
  -   
- Confirm that the data is available for our idea  
  - Is there magazine or article about certain districts, etc  
  -   
- Features  
  - Research your interest (step 1\)  
  - Link graph, like wikipedia.   
    - Being able to get suggestions about what to read about next and   
    - to search based on your current position about next thing  
  - Create an itinerary, and a comprehensible document for your trip (step 2\)  
    - What should the format be? Document/PDF/MD? Slides?   
  - Remembers your interaction. Personalized suggestions (after MVP)

## Sources of Inspiration

- Google Map, Gemini for Maps  
- Trip Advisor, Get Your Guide, Viator  
- 

## 1\. Executive Summary

**TabiLens** is an autonomous travel intelligence engine that unlocks Japan's premium, paywalled outdoor magazines (*PEAKS*, *Randonnée*, *BiCYCLE CLUB*, *EVEN*) and pairs them seamlessly with real-time **Tobu Railway & Bus transit APIs** and **Chronicle podcast audio**.

It transforms fragmented, Japanese-only print editorial guides into an interactive, zero-hallucination day-trip copilot that anyone—from Tokyo urbanites to international inbound travelers—can use to plan and embark on outdoor escapes in seconds.

```` ```mermaid ````  
`flowchart LR`  
    `A["User Prompt / Mood<br>(e.g. 'Scenic autumn hike near Nikko')"] --> B["Redpine MCP Agent"]`  
    `B --> C["ADDIX Magazines<br>(Curated trails + authentic photos)"]`  
    `B --> D["Tobu Live Transit API<br>(Live train + bus schedules)"]`  
    `B --> E["Chronicle News Connect<br>(Commute audio playback)"]`  
    `C & D & E --> F["TabiLens Interactive Experience<br>(Visual guide, exact timetable, audio briefing)"]`  
```` ``` ````

---

## 2\. The Problem: The "Overcrowded Tokyo vs. Inaccessible Suburbs" Paradox

### For the Traveler (Inbound Tourists & Tokyo Residents)

1. **Overtourism in Tokyo Core**: 30+ million tourists and 37 million locals are packed into Shibuya, Asakusa, and Shinjuku. Everyone wants nature and day trips, but:  
2. **The "Paywalled Japanese" Barrier**: The truly remarkable spots (hidden viewpoints in Nikko, riverside cycling trails along Arakawa, quiet highland onsen) are documented almost exclusively in Japanese print/subscription lifestyle magazines. English guides and SEO-farmed blogs repeat the same generic tourist traps.  
3. **The Last-Mile Logistics Nightmare**: Even if a traveler discovers a trailhead or viewpoint, connecting a train (e.g. Tobu Spacia X) with rural connecting buses (Tobu Bus) is stressful and error-prone. Standard LLMs hallucinate non-existent train times.

### For the Content & Transit Providers

* **ADDIX**: Incredible archives of professional photography, vetted route difficulty, and expert reviews trapped inside static PDFs.  
* **Tobu Railway**: World-class railway infrastructure connecting Tokyo to world heritage nature (Nikko, Kinugawa, Chichibu), yet underutilized by tourists who don't know where to get off.

---

## 3\. The Solution: TabiLens

TabiLens solves this end-to-end with a 3-step autonomous pipeline:

1. **Editorial Spot Extraction**: Searches **ADDIX** collection (*PEAKS*, *Randonnée*, *BiCYCLE CLUB*, *EVEN*) via Redpine to retrieve vetted spots, difficulty ratings, and **actual magazine photos** (`include_figures=true`).  
2. **Zero-Hallucination Transit Routing**: Uses **Tobu Railway tools** (`tobu--find_stop`, `tobu--rail_departures`, `tobu--station_bus_links`) to construct an executable timetable from Tokyo to the destination and back.  
3. **Commute Entertainment**: Embeds a matching 2-minute **Chronicle News Connect** audio segment (`include_audio=true`) or **The Telegraph** feature for the rider to listen to during the train ride.

---

## 4\. Why Public Data & Generic LLMs Cannot Replicate This (The Moat)

| Feature | Standard AI (ChatGPT / Google Maps) | TabiLens (Powered by Redpine MCP) |
| :---- | :---- | :---- |
| **Trail & Route Quality** | Scrapes generic SEO blogs, TripAdvisor, or unverified Reddit posts. | **Verified Editorial Authority**: Vetted by professional alpine guides and cycling editors (*PEAKS*, *Randonnée*). |
| **Visual Scenery** | User-submitted low-res selfies or broken stock photo links. | **Authentic Magazine Photography**: High-res editorial photos extracted directly via `include_figures=true`. |
| **Transit Accuracy** | LLMs hallucinate departure times and imaginary direct routes. | **Live Ground-Truth APIs**: Real Tobu train numbers, departure times, and verified station-to-bus links. |
| **Audio Companionship** | Text-only or robotic synthetic TTS voices. | **Playable Licensed Audio**: Authentic podcast discussions from *Chronicle News Connect*. |

---

## 5\. Technical Architecture

```` ```mermaid ````  
`sequenceDiagram`  
    `autonumber`  
    `actor User as User / Traveler`  
    `participant App as TabiLens Frontend (Web UI)`  
    `participant Agent as Agent / MCP Orchestrator`  
    `participant Redpine as Redpine MCP Endpoint`  
    `participant Tobu as Tobu Transit Engine`

    `User->>App: "I want an easy scenic nature walk with autumn leaves near Tokyo"`  
    `App->>Agent: Query intent + origin station (e.g., Asakusa)`  
    `Agent->>Redpine: preview(search: "ADDIX Magazines", query: "日光 紅葉 ハイキング 絶景")`  
    `Redpine-->>Agent: Returns snippets, relevance scores, and cost`  
    `Agent->>Redpine: confirm(queryId, include_figures=true)`  
    `Redpine-->>Agent: Full editorial passage + Photo figures`  
    `Agent->>Tobu: tobu--find_stop("Tobu-Nikko")`  
    `Tobu-->>Agent: station_id: "TN-25"`  
    `Agent->>Tobu: tobu--rail_departures(from: "Asakusa", to: "TN-25")`  
    `Tobu-->>Agent: Next Limited Express Spacia X departure & arrival times`  
    `Agent->>Tobu: tobu--station_bus_links("Tobu-Nikko")`  
    `Tobu-->>Agent: Connecting bus stops & destinations`  
    `Agent->>Redpine: confirm(Chronicle podcast clip for ride duration)`  
    `Agent-->>App: Unified JSON Payload`  
    `App-->>User: Renders Itinerary Card + Photos + Live Train Times + Audio Player`  
```` ``` ````

---

## 6\. Target Audience & Business Impact

### Target Personas

1. **Inbound Global Tourists (30M+ annually)**: Crave authentic rural/nature experiences outside Tokyo but lack Japanese language skills to read specialist magazines or navigate regional buses.  
2. **Tokyo Urbanites & Families (37M residents)**: Want weekend micro-escapes without spending 3 hours researching routes on disparate blogs.  
3. **Active Lifestyle Enthusiasts**: Cyclists, hikers, and golfers who require exact logistics (elevation, gear checklist, bike train rules).

### Monetization & Commercial Model

* **Freemium Micro-Pass**: Free search previews; premium booking/unlocked detailed GPS waypoints & discount Tobu transit passes.  
* **Tobu Ticket Affiliate Integration**: Direct deep-links to purchase Tobu Limited Express reserved seats (*Spacia X*).  
* **Magazine Subscription Lead-Gen**: "Read the full issue on ADDIX" button driving direct digital magazine sales.

---

## 7\. The 3-Minute Live Demo Pitch (16:00 Demo Plan)

> **Hackathon Format**: 3 min presentation \+ 2 min Q\&A. Strictly live demo, no slides needed.

| Timing | Segment | Speaker Script & Action |
| :---- | :---- | :---- |
| **0:00 \- 0:30**`<br>`(30s) | **The Problem** | *"Millions of people in Tokyo want to escape into nature this weekend. But if you search Google in English, you get the same 3 overcrowded tourist spots. Japan's best nature secrets are locked in Japanese print magazines, and connecting trains to rural buses is a headache. Today, we built TabiLens."* |
| **0:30 \- 2:30**`<br>`(2 mins) | **Live Demo** | **Action 1**: Type in: *"Beginner hike with scenic lake views and onsen from Asakusa"*. `<br>`**Action 2**: Show Redpine calling ADDIX *Randonnée* — see the actual editorial photo appear on screen. `<br>`**Action 3**: Show the live Tobu schedule populated automatically (*Spacia X departure at 08:00, arrival 09:50, transfer to Tobu bus at Pole 2*). `<br>`**Action 4**: Hit play on the Chronicle audio snippet embedded for the train ride. |
| **2:30 \- 3:00**`<br>`(30s) | **The Impact** | *"TabiLens turns paywalled magazine archives into active mobility revenue for railways, and gives every traveler the confidence to explore deeper Japan. It's real, it's live, and it runs on Redpine MCP."* |

---

## 8\. Jury Alignment Matrix

| Judge | What They Care About | How TabiLens Wins Their Vote |
| :---- | :---- | :---- |
| **Yuko Takeda**`<br>`(General Manager, **KDDI**) | Regional revitalization, telecom/mobility synergy, smart city tech. | Drives high-yield tourism to regional stations along transit corridors; combines digital content with physical mobility. |
| **Shinya Shiokawa**`<br>`(Director, **ADDIX**) | Monetizing magazine content (*PEAKS, Randonnée, EVEN, Bicycle Club*). | Transforms static editorial archives into an active, actionable recommendation engine with real photography credit. |
| **Marek Kiisa**`<br>`(GP, **NordicNinja VC**) | Scalability, product-market fit, global applicability. | Massive addressable market (inbound Japan travel boom \+ local Tokyo residents); clear monetization through transit & subscriptions. |
| **Anders Hammarbäck**`<br>`(CEO, **Redpine**) | Exploiting full capabilities of Redpine MCP. | Utilizes all Redpine features: hybrid search, citation transparency, image extraction (`include_figures`), and live tool execution (`tobu--`). |

---

## 9\. Hackathon Build Sprint (12:00 \- 15:30)

- [x] **Redpine MCP Connection Verified** (Live Key active, \$48.56 credits remaining).  
- [ ] **Backend Service**: Light Node/Python API or direct frontend wrapper calling Redpine MCP tools (`preview`, `confirm`, `tobu--find_stop`, `tobu--rail_departures`).  
- [ ] **Interactive Frontend**: Modern React/Tailwind web app with:  
      * Query input (prompts for nature/hiking, cycling, or golf escapes).  
      * Spot Card with ADDIX editorial citations & magazine figures.  
      * Tobu Timetable Widget showing real train times & bus connections.  
      * Audio snippet player for Chronicle podcast.  
- [ ] **Backup Video Recording** (completed before 15:30 Discord submission).