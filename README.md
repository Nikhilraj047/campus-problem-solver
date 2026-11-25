# Campus Problem Solver

Campus Problem Solver is a responsive, browser-based complaint management system that helps students report and track campus issues. It provides live AI-style triage, duplicate detection, urgency scoring, ticket routing, photo evidence, SLA monitoring, and an admin dashboard.

## Features

- Submit campus complaints with a name, location, description, and optional photo
- Quickly classify reports into categories such as Electrical, Plumbing, IT / Network, Hostel, Academic, and Security
- Calculate urgency scores and recommended SLA targets
- Detect and merge semantically similar open complaints
- Filter, search, sort, and upvote tickets
- Switch between Student and Admin roles
- Update ticket status, department, priority, and progress notes
- Track ticket timelines and resolved-ticket ratings
- View dashboard KPIs, category trends, department performance, and hotspot locations
- Persist tickets, upvotes, and theme preferences in browser `localStorage`
- Use light and dark themes

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Browser `localStorage`
- No external runtime dependencies

## Getting Started

### Run locally

Because this is a static application, you can open `index.html` directly in a browser.

For a better local development experience, use a simple HTTP server:

```bash
# From the project directory
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Usage

1. Open the **Report** tab.
2. Enter a name and campus location.
3. Describe the issue in plain language or choose a sample complaint.
4. Optionally attach a photo.
5. Submit the complaint to create or merge a ticket.
6. Use the **Tickets** tab to search, filter, upvote, inspect, or manage reports.
7. Switch to **Admin** in the role selector to update status, department, priority, and activity notes.
8. Open **Dashboard** to review KPIs and campus-wide trends.

## Ticket Triage

Each complaint is analyzed in the browser:

- **Category:** Matched against keyword sets for the available departments
- **Urgency:** Calculated from emergency and medium-priority keywords
- **Duplicate detection:** Uses cosine similarity against existing open tickets
- **SLA targets:**
  - High: 24 hours
  - Medium: 72 hours
  - Low: 120 hours

## Demo Data

The app automatically seeds demo tickets on first use. Use **Reset Demo Data** on the Report screen to restore the initial dataset.

## Data Storage

Ticket records, upvotes, and theme preferences are stored locally in the browser. Clearing browser storage removes this data and restores the demo dataset on the next load.

> This project is a frontend demo. It does not include authentication, a backend API, or a server-side database.

## Project Structure

```text
.
├── index.html  # Application markup and modal structure
├── style.css   # Layout, components, responsive styles, and themes
├── app.js      # Triage, ticket management, dashboard, and persistence logic
└── README.md   # Project documentation
```

## Browser Support

Use a modern browser with JavaScript and `localStorage` enabled.

## License

No license has been specified for this repository.
