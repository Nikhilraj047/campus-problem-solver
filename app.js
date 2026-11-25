var CATS = {
  Electrical: { d: "Electrical Dept", k: "light fan switch wire wiring sparking spark socket power electric bulb shock tubelight ac" },
  Plumbing: { d: "Plumbing and Water", k: "water leak leaking tap pipe flush toilet drain geyser washroom bathroom flood" },
  "IT / Network": { d: "IT Services", k: "wifi internet network router lab computer projector server portal login" },
  "Mess / Food": { d: "Mess Committee", k: "mess food hygiene canteen meal dinner lunch breakfast cockroach stale hair" },
  Hostel: { d: "Hostel Warden", k: "hostel room warden bed mattress curfew roommate" },
  Academic: { d: "Academic Office", k: "timetable class exam marks faculty attendance syllabus schedule clash" },
  Infrastructure: { d: "Civil and Maintenance", k: "bench door window road roof wall lift ceiling crack broken stairs" },
  Security: { d: "Security Office", k: "theft stolen harass harassment fight ragging unsafe cctv stranger" }
};

var HIGH = "spark sparking fire shock smoke gas ragging harass harassment injured injury flood collapse emergency urgent stolen unsafe bleeding".split(" ");
var MED = "broken leak leaking outage dirty stale cockroach down jammed stuck failed".split(" ");
var STOP = "the a an is are was were in on at of to for and or my our it this that with not no from be has have had very".split(" ");
var SLA = { High: 24, Medium: 72, Low: 120 };

var SAMPLES = [
  { label: "⚡ Sparking Wire (High)", text: "Sparking exposed wire near the water cooler on the 1st floor corridor", loc: "Academic Block A" },
  { label: "📶 Duplicate Wi-Fi Issue", text: "Wifi is down in the CSE lab, internet not working at all", loc: "CSE Block, Lab 2" },
  { label: "🚰 Broken Washroom Tap", text: "Washroom tap is leaking continuously and floor is slippery", loc: "Hostel C, Ground Floor" },
  { label: "🛡️ Security / CCTV", text: "Main gate side street light is off and CCTV camera looks broken, feels unsafe", loc: "North Gate" }
];

var tickets = [];
var role = "Student";
var view = "report";
var last = null;
var pendingPhoto = null;
var activeTicketId = null;
var upvotedIds = {};
var filters = { q: "", cat: "All", status: "All", sort: "newest" };

function tok(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(function (w) {
    return w && STOP.indexOf(w) < 0;
  });
}

function classify(text) {
  var t = tok(text), best = "Infrastructure", bs = 0;
  Object.keys(CATS).forEach(function (c) {
    var ks = CATS[c].k.split(" "), s = 0;
    t.forEach(function (w) { if (ks.indexOf(w) >= 0) s++; });
    if (s > bs) { bs = s; best = c; }
  });
  return { cat: best, conf: bs ? Math.min(98, 55 + bs * 15) : 40 };
}

function urgency(text, cat) {
  var t = tok(text), s = 20;
  t.forEach(function (w) {
    if (HIGH.indexOf(w) >= 0) s += 30;
    else if (MED.indexOf(w) >= 0) s += 12;
  });
  if (cat === "Security") s += 15;
  if (/\b(since|for)\s+\d+\s+(days|weeks)/i.test(text)) s += 10;
  s = Math.min(100, s);
  return { score: s, label: s >= 60 ? "High" : s >= 35 ? "Medium" : "Low" };
}

function vec(text) {
  var v = {};
  tok(text).forEach(function (w) { v[w] = (v[w] || 0) + 1; });
  return v;
}

function cos(a, b) {
  var d = 0, na = 0, nb = 0, k;
  for (k in a) { na += a[k] * a[k]; if (b[k]) d += a[k] * b[k]; }
  for (k in b) nb += b[k] * b[k];
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

function findDuplicate(text, cat) {
  var v = vec(text), dup = null, bestSim = 0;
  tickets.forEach(function (t) {
    if (t.status === "Resolved" || t.cat !== cat) return;
    var sim = cos(v, vec(t.text));
    if (sim > 0.45 && sim > bestSim) { bestSim = sim; dup = t; }
  });
  return dup ? { dup: dup, sim: bestSim } : null;
}

function summary(text, cat, loc) {
  var s = text.trim().replace(/\s+/g, " ");
  if (s.length > 90) s = s.slice(0, 87) + "…";
  return cat + " issue at " + (loc || "unspecified location") + ": " + s;
}

function toast(msg, type) {
  var c = document.getElementById("toast-container");
  var el = document.createElement("div");
  el.className = "toast " + (type || "");
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(function () {
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    el.style.transition = "all 0.2s ease";
    setTimeout(function () { el.remove(); }, 220);
  }, 3200);
}

function save() {
  try {
    localStorage.setItem("cps_tickets", JSON.stringify(tickets));
    localStorage.setItem("cps_upvotes", JSON.stringify(upvotedIds));
  } catch (e) {
    toast("Storage limit reached (likely large photo). Ticket kept in session.", "warn");
  }
  updateNavBadge();
}

function load() {
  try {
    var u = localStorage.getItem("cps_upvotes");
    if (u) upvotedIds = JSON.parse(u);
    var r = localStorage.getItem("cps_tickets");
    if (r) { tickets = JSON.parse(r); updateNavBadge(); return; }
  } catch (e) {}
  seed();
}

function seed() {
  var H = 3600000, n = Date.now();
  var s = [
    ["Fan in room 214 is not working since 3 days", "Hostel B, Room 214", 30],
    ["Sparking wire near the switch board in the library reading hall", "Library", 5],
    ["Wifi is down in the CSE lab, internet not working", "CSE Block, Lab 2", 50],
    ["Mess food was stale and cockroach found in dinner", "Mess 1", 20],
    ["Water leaking from tap in washroom, floor is flooded", "Hostel A, 2nd floor", 10],
    ["Timetable clash between DBMS and CN classes on Thursday", "CSE 7th Sem", 60]
  ];
  tickets = [];
  upvotedIds = {};
  s.forEach(function (x, i) { add(x[0], x[1], "Student " + (i + 1), n - x[2] * H, true, null); });
  tickets[4].status = "Resolved";
  tickets[4].resolvedAt = n - 2 * H;
  tickets[4].log.push("Marked Resolved by Plumbing and Water");
  save();
}

function add(text, loc, who, time, quiet, photo) {
  var c = classify(text), u = urgency(text, c.cat);
  var match = findDuplicate(text, c.cat);
  if (match) {
    var dup = match.dup;
    dup.count++;
    dup.urg = Math.min(100, dup.urg + 8);
    dup.label = dup.urg >= 60 ? "High" : dup.urg >= 35 ? "Medium" : "Low";
    dup.log.push("Duplicate report merged (" + Math.round(match.sim * 100) + "% similar) by " + who);
    if (photo && !dup.photo) dup.photo = photo;
    save();
    return { dup: dup, sim: match.sim };
  }
  var t = {
    id: "CPS-" + (1000 + tickets.length + 1),
    text: text,
    loc: loc,
    who: who,
    cat: c.cat,
    conf: c.conf,
    urg: u.score,
    label: u.label,
    dept: CATS[c.cat].d,
    status: "Open",
    count: 1,
    created: time || Date.now(),
    summary: summary(text, c.cat, loc),
    log: ["Created by " + who + " and routed to " + CATS[c.cat].d],
    rating: null,
    photo: photo || null
  };
  tickets.unshift(t);
  if (quiet) { tickets.sort(function (a, b) { return b.created - a.created; }); }
  save();
  return { t: t };
}

function age(t) { return (Date.now() - t.created) / 3600000; }
function overdue(t) { return t.status !== "Resolved" && age(t) > SLA[t.label]; }
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function ago(h) { return h < 1 ? "just now" : h < 48 ? Math.round(h) + "h ago" : Math.round(h / 24) + "d ago"; }

function updateNavBadge() {
  var openCount = tickets.filter(function (t) { return t.status !== "Resolved"; }).length;
  var el = document.getElementById("nav-count");
  if (el) el.textContent = openCount;
}

function render() {
  document.querySelectorAll(".tab").forEach(function (b) {
    b.classList.toggle("on", b.dataset.v === view);
  });
  var a = document.getElementById("app");
  if (view === "report") {
    a.innerHTML = rReport();
    bindReport();
  } else if (view === "tickets") {
    a.innerHTML = rTickets();
    bindTickets();
  } else {
    a.innerHTML = rDash();
    bindDash();
  }
}

/* ==================== REPORT VIEW ==================== */
function rReport() {
  var sampleHtml = SAMPLES.map(function (s, idx) {
    return '<button type="button" class="chip" data-sample="' + idx + '">' + esc(s.label) + '</button>';
  }).join("");

  var photoHtml = pendingPhoto
    ? '<div class="photo-preview-wrap"><img src="' + pendingPhoto + '" class="thumb" data-zoom="' + pendingPhoto + '" alt="Preview">' +
      '<span class="mu">Photo attached</span> <button type="button" class="btn sm danger" id="rm-photo">Remove</button></div>'
    : "";

  var h = '<div class="card"><div class="t"><h2 style="margin:0;font-size:17px">Report a Campus Issue</h2>' +
    '<button type="button" class="btn sm" id="rst">↻ Reset Demo Data</button></div>' +
    '<div class="mu" style="margin-top:4px">Quick-fill an example to test live AI triage:</div>' +
    '<div class="chips">' + sampleHtml + '</div>' +
    '<div class="row"><div><label for="nm">Your Name</label><input id="nm" value="Nikhil"></div>' +
    '<div><label for="lc">Location (Block / Room)</label><input id="lc" placeholder="e.g. Hostel B, Room 214"></div></div>' +
    '<label for="tx">Describe the problem in plain language</label>' +
    '<textarea id="tx" rows="3" placeholder="e.g. Wifi is not working in the CSE lab since morning..."></textarea>' +
    '<div id="live-ai"></div>' +
    '<label for="ph">Attach Photo Evidence (optional)</label>' +
    '<input type="file" id="ph" accept="image/*">' + photoHtml +
    '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button type="button" class="btn p" id="sub">🚀 Submit Complaint</button>' +
    '</div></div>';

  if (last) {
    if (last.dup) {
      h += '<div class="card" style="border-color:var(--md)"><b>♻ Duplicate Detected & Merged</b>' +
        '<div class="ai">Matched existing open ticket <b>' + last.dup.id + '</b> (' + Math.round(last.sim * 100) + '% semantic match). ' +
        'Your report was merged to boost its priority instead of creating clutter.<br>' +
        '<b>Total Reports:</b> ' + last.dup.count + ' · <b>Updated Urgency:</b> <span class="pill ' + last.dup.label + '">' + last.dup.label + '</span> ' +
        '<button type="button" class="btn sm" data-open-id="' + last.dup.id + '" style="margin-left:6px">View Ticket →</button></div></div>';
    } else {
      var t = last.t;
      h += '<div class="card" style="border-color:var(--lo)"><b>✅ Ticket ' + t.id + ' Created & Routed</b><div class="ai">' +
        '<b>Category:</b> ' + t.cat + ' (AI confidence ' + t.conf + '%)<br>' +
        '<b>Urgency:</b> <span class="pill ' + t.label + '">' + t.label + '</span> score ' + t.urg + '/100<br>' +
        '<b>Routed to:</b> ' + t.dept + ' · <b>SLA Target:</b> ' + SLA[t.label] + ' hours<br>' +
        '<b>Auto-Summary:</b> ' + esc(t.summary) + ' ' +
        '<button type="button" class="btn sm" data-open-id="' + t.id + '" style="margin-left:6px">Open Ticket →</button></div></div>';
    }
  }
  return h;
}

function updateLivePreview() {
  var box = document.getElementById("live-ai");
  var txEl = document.getElementById("tx");
  if (!box || !txEl) return;
  var text = txEl.value.trim();
  if (text.length < 4) {
    box.innerHTML = "";
    return;
  }
  var c = classify(text);
  var u = urgency(text, c.cat);
  var match = findDuplicate(text, c.cat);

  if (match) {
    box.innerHTML = '<div class="ai-preview dup-warn">' +
      '<b>⚠️ Live AI Triage — Similar Open Issue Found (' + Math.round(match.sim * 100) + '% match)</b>' +
      '<div class="mu" style="margin-top:4px">Submitting will automatically upvote & merge into <b>' + match.dup.id + '</b>: "' + esc(match.dup.text) + '"</div>' +
      '</div>';
  } else {
    box.innerHTML = '<div class="ai-preview">' +
      '<b>✨ Live AI Triage Preview</b>' +
      '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<span class="pill">📂 ' + c.cat + ' (' + c.conf + '%)</span>' +
      '<span class="pill ' + u.label + '">🔥 ' + u.label + ' (' + u.score + '/100)</span>' +
      '<span class="pill">🏢 ' + CATS[c.cat].d + '</span>' +
      '<span class="pill">⏱️ SLA: ' + SLA[u.label] + 'h</span>' +
      '</div></div>';
  }
}

function bindReport() {
  var tx = document.getElementById("tx");
  var lc = document.getElementById("lc");
  var ph = document.getElementById("ph");

  tx.addEventListener("input", updateLivePreview);

  document.querySelectorAll("[data-sample]").forEach(function (btn) {
    btn.onclick = function () {
      var s = SAMPLES[+btn.dataset.sample];
      tx.value = s.text;
      lc.value = s.loc;
      updateLivePreview();
      toast("Sample loaded — check the Live AI Triage preview!", "ok");
    };
  });

  if (ph) {
    ph.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        pendingPhoto = ev.target.result;
        var curTx = tx.value, curLc = lc.value, curNm = document.getElementById("nm").value;
        render();
        document.getElementById("tx").value = curTx;
        document.getElementById("lc").value = curLc;
        document.getElementById("nm").value = curNm;
        updateLivePreview();
        toast("Photo attached", "ok");
      };
      reader.readAsDataURL(file);
    };
  }

  var rmBtn = document.getElementById("rm-photo");
  if (rmBtn) {
    rmBtn.onclick = function () {
      var curTx = tx.value, curLc = lc.value, curNm = document.getElementById("nm").value;
      pendingPhoto = null;
      render();
      document.getElementById("tx").value = curTx;
      document.getElementById("lc").value = curLc;
      document.getElementById("nm").value = curNm;
      updateLivePreview();
    };
  }

  document.getElementById("sub").onclick = function () {
    var text = tx.value.trim();
    if (text.length < 8) {
      toast("Please describe the problem in at least 8 characters.", "err");
      tx.focus();
      return;
    }
    var loc = lc.value.trim();
    var who = document.getElementById("nm").value.trim() || "Student";
    last = add(text, loc, who, Date.now(), false, pendingPhoto);
    pendingPhoto = null;
    toast(last.dup ? "Merged with existing ticket " + last.dup.id : "Ticket " + last.t.id + " submitted!", "ok");
    render();
  };

  document.getElementById("rst").onclick = function () {
    last = null;
    pendingPhoto = null;
    seed();
    toast("Demo dataset restored", "ok");
    render();
  };
}

/* ==================== TICKETS VIEW ==================== */
function rTickets() {
  var cats = ["All"].concat(Object.keys(CATS));
  var statuses = ["All", "Open", "In Progress", "Resolved", "Escalated"];

  var toolbar = '<div class="toolbar">' +
    '<input id="f-q" type="search" placeholder="🔍 Search tickets, IDs, locations..." value="' + esc(filters.q) + '">' +
    '<select id="f-cat">' + cats.map(function (c) {
      return '<option value="' + c + '"' + (filters.cat === c ? " selected" : "") + '>' + (c === "All" ? "All Categories" : c) + '</option>';
    }).join("") + '</select>' +
    '<select id="f-st">' + statuses.map(function (s) {
      return '<option value="' + s + '"' + (filters.status === s ? " selected" : "") + '>' + (s === "All" ? "All Statuses" : s) + '</option>';
    }).join("") + '</select>' +
    '<select id="f-sort">' +
    '<option value="newest"' + (filters.sort === "newest" ? " selected" : "") + '>Sort: Newest</option>' +
    '<option value="urgency"' + (filters.sort === "urgency" ? " selected" : "") + '>Sort: Highest Urgency</option>' +
    '<option value="reports"' + (filters.sort === "reports" ? " selected" : "") + '>Sort: Most Reported</option>' +
    '</select></div>';

  var filtered = tickets.filter(function (t) {
    if (filters.cat !== "All" && t.cat !== filters.cat) return false;
    if (filters.status === "Escalated") { if (!overdue(t)) return false; }
    else if (filters.status !== "All" && t.status !== filters.status) return false;
    if (filters.q) {
      var q = filters.q.toLowerCase();
      var hay = (t.id + " " + t.text + " " + t.loc + " " + t.cat + " " + t.dept).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  filtered.sort(function (a, b) {
    if (filters.sort === "urgency") return b.urg - a.urg;
    if (filters.sort === "reports") return b.count - a.count;
    return b.created - a.created;
  });

  var headerInfo = '<div class="t" style="margin-bottom:10px">' +
    '<div class="mu">Showing <b>' + filtered.length + '</b> of ' + tickets.length + ' tickets · Role: <b>' + role + '</b></div>' +
    ((filters.q || filters.cat !== "All" || filters.status !== "All")
      ? '<button type="button" class="btn sm" id="clear-filters">Clear Filters</button>' : '') +
    '</div>';

  if (!filtered.length) {
    return toolbar + headerInfo + '<div class="card">No matching tickets found. Try adjusting your filters.</div>';
  }

  var cards = filtered.map(function (t) {
    var od = overdue(t);
    var stClass = "status-" + t.status.replace(/\s+/g, "");
    var upvoted = !!upvotedIds[t.id];

    var actions = '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
    actions += '<button type="button" class="btn sm" data-open-id="' + t.id + '">🔍 Inspect & Timeline</button>';

    if (t.status !== "Resolved") {
      actions += '<button type="button" class="btn sm ' + (upvoted ? "p" : "") + '" data-upvote="' + t.id + '">' +
        (upvoted ? "👍 Upvoted (" + t.count + ")" : "👍 +1 Me Too (" + t.count + ")") + '</button>';
    }

    if (role === "Admin" && t.status !== "Resolved") {
      if (t.status === "Open") {
        actions += '<button type="button" class="btn sm" data-act="prog" data-id="' + t.id + '">▶ Start Progress</button>';
      }
      actions += '<button type="button" class="btn sm p" data-act="res" data-id="' + t.id + '">✓ Resolve</button>';
    }
    actions += '</div>';

    var feedback = "";
    if (t.status === "Resolved") {
      feedback = t.rating
        ? '<div class="mu" style="margin-top:8px">Reporter feedback: ' + "★".repeat(t.rating) + "☆".repeat(5 - t.rating) + '</div>'
        : '<div class="mu" style="margin-top:8px">Rate resolution: ' +
          [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" class="btn sm" data-act="rate" data-id="' + t.id + '" data-n="' + n + '">' + n + '★</button>';
          }).join(" ") +
          ' <button type="button" class="btn sm danger" data-act="reopen" data-id="' + t.id + '">Reopen</button></div>';
    }

    return '<div class="card interactive">' +
      '<div class="t"><div>' +
      '<b>' + t.id + '</b> · <span class="pill">' + t.cat + '</span>' +
      '<span class="pill ' + t.label + '">' + t.label + ' (' + t.urg + ')</span>' +
      '<span class="pill ' + stClass + '">' + t.status + '</span>' +
      (od ? ' <span class="esc">⚠ SLA Breached</span>' : '') +
      '</div><div class="mu">' + ago(age(t)) + '</div></div>' +
      '<div style="margin:8px 0;display:flex;gap:12px;align-items:flex-start">' +
      (t.photo ? '<img src="' + t.photo + '" class="thumb" data-zoom="' + t.photo + '" alt="Issue photo">' : '') +
      '<div><div>' + esc(t.text) + '</div>' +
      '<div class="mu" style="margin-top:4px">📍 ' + esc(t.loc || "Unspecified") + ' · 🏢 ' + t.dept + ' · 👤 ' + esc(t.who) + '</div></div>' +
      '</div>' + actions + feedback + '</div>';
  }).join("");

  return toolbar + headerInfo + cards;
}

function bindTickets() {
  var fq = document.getElementById("f-q");
  var fcat = document.getElementById("f-cat");
  var fst = document.getElementById("f-st");
  var fsort = document.getElementById("f-sort");
  var clr = document.getElementById("clear-filters");

  if (fq) fq.oninput = function () { filters.q = fq.value; render(); document.getElementById("f-q").focus(); };
  if (fcat) fcat.onchange = function () { filters.cat = fcat.value; render(); };
  if (fst) fst.onchange = function () { filters.status = fst.value; render(); };
  if (fsort) fsort.onchange = function () { filters.sort = fsort.value; render(); };
  if (clr) clr.onclick = function () { filters = { q: "", cat: "All", status: "All", sort: "newest" }; render(); };
}

/* ==================== DASHBOARD VIEW ==================== */
function rDash() {
  var tot = tickets.length;
  var res = tickets.filter(function (t) { return t.status === "Resolved"; });
  var op = tot - res.length;
  var od = tickets.filter(overdue).length;
  var dups = tickets.reduce(function (s, t) { return s + t.count - 1; }, 0);
  var avg = res.length ? (res.reduce(function (s, t) { return s + ((t.resolvedAt || Date.now()) - t.created) / 3600000; }, 0) / res.length).toFixed(1) : "–";
  var rated = tickets.filter(function (t) { return t.rating; });
  var sat = rated.length ? (rated.reduce(function (s, t) { return s + t.rating; }, 0) / rated.length).toFixed(1) : "–";

  var kpis = [
    { label: "Total Tickets", val: tot, filterStatus: "All" },
    { label: "Open / Active", val: op, filterStatus: "Open" },
    { label: "SLA Breached", val: od, filterStatus: "Escalated", alert: od > 0 },
    { label: "Duplicates Merged", val: dups, filterStatus: "All" },
    { label: "Avg Resolution (h)", val: avg, filterStatus: "Resolved" },
    { label: "Satisfaction / 5", val: sat, filterStatus: "Resolved" }
  ];

  var h = '<div class="mu" style="margin-bottom:10px">Click any KPI card or category bar to jump directly to filtered tickets.</div>';
  h += '<div class="grid">' + kpis.map(function (k) {
    return '<div class="card kpi clickable" data-jump-status="' + k.filterStatus + '">' +
      '<span class="mu">' + k.label + '</span>' +
      '<b style="' + (k.alert ? "color:var(--hi)" : "") + '">' + k.val + '</b></div>';
  }).join("") + '</div>';

  var cc = {}, dd = {};
  tickets.forEach(function (t) {
    cc[t.cat] = (cc[t.cat] || 0) + t.count;
    dd[t.dept] = dd[t.dept] || { o: 0, r: 0 };
    dd[t.dept][t.status === "Resolved" ? "r" : "o"]++;
  });
  var mx = Math.max.apply(null, Object.keys(cc).map(function (k) { return cc[k]; }).concat([1]));

  h += '<div class="card"><b>Complaints by Category (including merged duplicates)</b><div style="margin-top:8px">' +
    Object.keys(cc).sort(function (a, b) { return cc[b] - cc[a]; }).map(function (k) {
      var pct = Math.round((cc[k] / mx) * 100);
      return '<div class="bar-row" data-jump-cat="' + k + '">' +
        '<span class="bar-label">' + k + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<b>' + cc[k] + '</b></div>';
    }).join("") + '</div></div>';

  h += '<div class="card scroll"><b>Department SLA & Resolution Performance</b>' +
    '<table><thead><tr class="mu"><th>Department</th><th>Active</th><th>Resolved</th><th>Resolution Rate</th></tr></thead><tbody>' +
    Object.keys(dd).map(function (k) {
      var totalDept = dd[k].o + dd[k].r;
      var rate = totalDept ? Math.round((dd[k].r / totalDept) * 100) : 0;
      return '<tr><td><b>' + k + '</b></td><td>' + dd[k].o + '</td><td>' + dd[k].r + '</td><td>' + rate + '%</td></tr>';
    }).join("") + '</tbody></table></div>';

  var hot = {};
  tickets.forEach(function (t) { var l = t.loc || "Unspecified"; hot[l] = (hot[l] || 0) + t.count; });
  h += '<div class="card"><b>Campus Hotspot Locations</b><div class="chips" style="margin-top:8px">' +
    Object.keys(hot).sort(function (a, b) { return hot[b] - hot[a]; }).slice(0, 6).map(function (k) {
      return '<span class="chip" data-jump-q="' + esc(k) + '">📍 ' + esc(k) + ' (' + hot[k] + ')</span>';
    }).join("") + '</div></div>';

  return h;
}

function bindDash() {
  document.querySelectorAll("[data-jump-status]").forEach(function (el) {
    el.onclick = function () {
      filters = { q: "", cat: "All", status: el.dataset.jumpStatus, sort: "newest" };
      view = "tickets";
      render();
    };
  });
  document.querySelectorAll("[data-jump-cat]").forEach(function (el) {
    el.onclick = function () {
      filters = { q: "", cat: el.dataset.jumpCat, status: "All", sort: "newest" };
      view = "tickets";
      render();
    };
  });
  document.querySelectorAll("[data-jump-q]").forEach(function (el) {
    el.onclick = function () {
      filters = { q: el.dataset.jumpQ, cat: "All", status: "All", sort: "newest" };
      view = "tickets";
      render();
    };
  });
}

/* ==================== MODAL & INTERACTIONS ==================== */
function openTicketModal(id) {
  var t = tickets.find(function (x) { return x.id === id; });
  if (!t) return;
  activeTicketId = id;
  var modal = document.getElementById("modal-backdrop");
  var body = document.getElementById("modal-body");
  document.getElementById("modal-title").textContent = t.id + " · " + t.cat;

  var adminControls = "";
  if (role === "Admin") {
    var deptOptions = Object.keys(CATS).map(function (c) {
      var d = CATS[c].d;
      return '<option value="' + d + '"' + (t.dept === d ? " selected" : "") + '>' + d + '</option>';
    }).join("");

    adminControls = '<div class="card" style="background:var(--bg);margin-top:12px">' +
      '<b>🛠️ Admin Triage & Actions</b>' +
      '<div class="row" style="margin-top:6px">' +
      '<div><label>Status</label><select id="m-status">' +
      ['Open', 'In Progress', 'Resolved'].map(function (s) {
        return '<option value="' + s + '"' + (t.status === s ? " selected" : "") + '>' + s + '</option>';
      }).join("") + '</select></div>' +
      '<div><label>Assigned Department</label><select id="m-dept">' + deptOptions + '</select></div>' +
      '</div>' +
      '<label>Priority Override</label><select id="m-urg">' +
      ['High', 'Medium', 'Low'].map(function (l) {
        return '<option value="' + l + '"' + (t.label === l ? " selected" : "") + '>' + l + '</option>';
      }).join("") + '</select>' +
      '<label>Add Officer / Progress Note</label>' +
      '<div style="display:flex;gap:8px"><input id="m-note" placeholder="e.g. Technician dispatched to site...">' +
      '<button type="button" class="btn p" id="m-save">Save</button></div>' +
      '</div>';
  }

  body.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' +
    '<span class="pill ' + t.label + '">' + t.label + ' (' + t.urg + '/100)</span>' +
    '<span class="pill">' + t.status + '</span>' +
    '<span class="pill">👥 ' + t.count + ' report(s)</span>' +
    '<span class="pill">🏢 ' + t.dept + '</span>' +
    '</div>' +
    '<p style="margin:8px 0;font-size:15px">' + esc(t.text) + '</p>' +
    '<div class="mu">📍 <b>Location:</b> ' + esc(t.loc || "Unspecified") + ' · 👤 <b>Reported by:</b> ' + esc(t.who) + ' (' + ago(age(t)) + ')</div>' +
    (t.photo ? '<div style="margin-top:10px"><img src="' + t.photo + '" class="thumb" style="width:110px;height:110px" data-zoom="' + t.photo + '" alt="Evidence"></div>' : '') +
    adminControls +
    '<div style="margin-top:16px"><b>📜 Audit & Activity Timeline</b>' +
    '<div class="timeline">' + t.log.map(function (entry) {
      return '<div class="timeline-item">' + esc(entry) + '</div>';
    }).join("") + '</div></div>';

  modal.classList.remove("hidden");

  if (role === "Admin") {
    document.getElementById("m-save").onclick = function () {
      var newSt = document.getElementById("m-status").value;
      var newDept = document.getElementById("m-dept").value;
      var newUrg = document.getElementById("m-urg").value;
      var note = document.getElementById("m-note").value.trim();

      if (newSt !== t.status) {
        t.status = newSt;
        if (newSt === "Resolved") t.resolvedAt = Date.now();
        t.log.push("Status changed to " + newSt + " by Admin");
      }
      if (newDept !== t.dept) {
        t.dept = newDept;
        t.log.push("Reassigned to " + newDept + " by Admin");
      }
      if (newUrg !== t.label) {
        t.label = newUrg;
        t.urg = newUrg === "High" ? 80 : newUrg === "Medium" ? 50 : 25;
        t.log.push("Priority overridden to " + newUrg + " by Admin");
      }
      if (note) {
        t.log.push("Admin note: " + note);
      }
      save();
      render();
      openTicketModal(id);
      toast("Ticket " + t.id + " updated", "ok");
    };
  }
}

function closeModals() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("lightbox").classList.add("hidden");
  activeTicketId = null;
}

document.addEventListener("click", function (e) {
  var zoomImg = e.target.closest("[data-zoom]");
  if (zoomImg) {
    document.getElementById("lightbox-img").src = zoomImg.dataset.zoom;
    document.getElementById("lightbox").classList.remove("hidden");
    return;
  }

  var openBtn = e.target.closest("[data-open-id]");
  if (openBtn) {
    openTicketModal(openBtn.dataset.openId);
    return;
  }

  var upBtn = e.target.closest("[data-upvote]");
  if (upBtn) {
    var id = upBtn.dataset.upvote;
    var tk = tickets.find(function (x) { return x.id === id; });
    if (!tk) return;
    if (upvotedIds[id]) {
      toast("You already upvoted " + id, "warn");
      return;
    }
    upvotedIds[id] = true;
    tk.count++;
    tk.urg = Math.min(100, tk.urg + 6);
    tk.label = tk.urg >= 60 ? "High" : tk.urg >= 35 ? "Medium" : "Low";
    tk.log.push("Upvoted (+1 Me Too) by a student");
    save();
    render();
    toast("Upvoted " + id + " — priority score boosted!", "ok");
    return;
  }

  var actBtn = e.target.closest("[data-act]");
  if (actBtn) {
    var t = tickets.find(function (x) { return x.id === actBtn.dataset.id; });
    if (!t) return;
    var a = actBtn.dataset.act;
    if (a === "prog") {
      t.status = "In Progress";
      t.log.push("Marked In Progress by Admin");
      toast(t.id + " marked In Progress", "ok");
    } else if (a === "res") {
      t.status = "Resolved";
      t.resolvedAt = Date.now();
      t.log.push("Marked Resolved by Admin");
      toast(t.id + " marked Resolved", "ok");
    } else if (a === "rate") {
      t.rating = +actBtn.dataset.n;
      t.log.push("Reporter rated resolution: " + t.rating + "/5");
      toast("Thank you for your " + t.rating + "★ feedback!", "ok");
    } else if (a === "reopen") {
      t.status = "Open";
      t.created = Date.now();
      t.urg = Math.min(100, t.urg + 15);
      t.label = t.urg >= 60 ? "High" : t.urg >= 35 ? "Medium" : "Low";
      t.log.push("Reopened by reporter (issue persisted)");
      toast(t.id + " reopened with escalated priority", "warn");
    }
    save();
    render();
    return;
  }

  var tb = e.target.closest(".tab");
  if (tb) {
    view = tb.dataset.v;
    render();
  }
});

document.getElementById("modal-close").onclick = closeModals;
document.getElementById("lightbox-close").onclick = closeModals;
document.getElementById("modal-backdrop").onclick = function (e) {
  if (e.target.id === "modal-backdrop") closeModals();
};
document.getElementById("lightbox").onclick = function (e) {
  if (e.target.id === "lightbox") closeModals();
};
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeModals();
});

document.getElementById("role").onchange = function () {
  role = this.value;
  toast("Switched to " + role + " view", "ok");
  render();
  if (activeTicketId) openTicketModal(activeTicketId);
};

/* Theme Toggle */
(function initTheme() {
  var savedTheme = localStorage.getItem("cps_theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  document.getElementById("theme-btn").onclick = function () {
    var cur = document.documentElement.getAttribute("data-theme");
    var isDark = cur === "dark" || (!cur && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("cps_theme", next);
    toast("Switched to " + next + " mode", "ok");
  };
})();

load();
render();
