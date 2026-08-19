/* =========================================================
   POTLUCK
   Everyone brings a time. The meeting appears.

   You should not need to edit this file. All settings live
   in config.js.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. STORE — talks to Supabase, or falls back to demo mode
     --------------------------------------------------------- */

  var CFG = window.POTLUCK_CONFIG || {};
  var LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  var sb = null;

  if (LIVE) {
    try {
      sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    } catch (e) {
      LIVE = false;
      console.warn("Potluck: could not reach Supabase, running in demo mode.", e);
    }
  }

  var DEMO_KEY = "potluck.demo";

  function demoRead() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '{"polls":{},"votes":{}}'); }
    catch (e) { return { polls: {}, votes: {} }; }
  }
  function demoWrite(db) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(db));
  }

  var Store = {
    createPoll: function (poll) {
      if (!LIVE) {
        var db = demoRead();
        db.polls[poll.id] = poll;
        db.votes[poll.id] = [];
        demoWrite(db);
        return Promise.resolve(poll);
      }
      return sb.from("polls").insert(poll).select().single().then(function (r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    getPoll: function (id) {
      if (!LIVE) {
        var db = demoRead();
        return Promise.resolve(db.polls[id] || null);
      }
      return sb.from("polls").select("*").eq("id", id).maybeSingle().then(function (r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    getVotes: function (pollId) {
      if (!LIVE) {
        var db = demoRead();
        return Promise.resolve(db.votes[pollId] || []);
      }
      return sb.from("votes").select("*").eq("poll_id", pollId)
        .order("created_at", { ascending: true }).then(function (r) {
          if (r.error) throw r.error;
          return r.data || [];
        });
    },

    addVote: function (vote) {
      if (!LIVE) {
        var db = demoRead();
        vote.id = "v" + Date.now();
        db.votes[vote.poll_id] = db.votes[vote.poll_id] || [];
        db.votes[vote.poll_id].push(vote);
        demoWrite(db);
        return Promise.resolve(vote);
      }
      return sb.from("votes").insert(vote).select().single().then(function (r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    updateVote: function (id, patch) {
      if (!LIVE) {
        var db = demoRead();
        Object.keys(db.votes).forEach(function (pid) {
          db.votes[pid] = db.votes[pid].map(function (v) {
            return v.id === id ? Object.assign({}, v, patch) : v;
          });
        });
        demoWrite(db);
        return Promise.resolve();
      }
      return sb.from("votes").update(patch).eq("id", id).then(function (r) {
        if (r.error) throw r.error;
      });
    },

    deleteVote: function (id) {
      if (!LIVE) {
        var db = demoRead();
        Object.keys(db.votes).forEach(function (pid) {
          db.votes[pid] = db.votes[pid].filter(function (v) { return v.id !== id; });
        });
        demoWrite(db);
        return Promise.resolve();
      }
      return sb.from("votes").delete().eq("id", id).then(function (r) {
        if (r.error) throw r.error;
      });
    }
  };

  /* ---------------------------------------------------------
     2. LITTLE HELPERS
     --------------------------------------------------------- */

  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["January", "February", "March", "April", "May", "June",
             "July", "August", "September", "October", "November", "December"];

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
           "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseYmd(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function prettyDate(s) {
    var d = parseYmd(s);
    return DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()].slice(0, 3);
  }
  function longDate(s) {
    var d = parseYmd(s);
    return DOW[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
  }
  function pretty12(t) {
    var p = t.split(":"), h = +p[0], m = p[1];
    var ap = h >= 12 ? "pm" : "am";
    var hh = h % 12 || 12;
    return hh + (m === "00" ? "" : ":" + m) + ap;
  }
  function addMinutes(t, mins) {
    var p = t.split(":"), total = (+p[0]) * 60 + (+p[1]) + mins;
    total = ((total % 1440) + 1440) % 1440;
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" +
           String(total % 60).padStart(2, "0");
  }
  function slotKey(s) { return s.d + "|" + s.t; }
  function newId() {
    var abc = "abcdefghijkmnopqrstuvwxyz23456789", out = "";
    for (var i = 0; i < 8; i++) out += abc[Math.floor(Math.random() * abc.length)];
    return out;
  }
  function durLabel(m) {
    if (m % 60 === 0) return (m / 60) + (m === 60 ? " hour" : " hours");
    if (m < 120) return m + " min";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }
  function shareUrl(id) {
    return location.origin + location.pathname + "#/p/" + id;
  }

  /* ---------------------------------------------------------
     3. ROUTER
     --------------------------------------------------------- */

  function route() {
    var h = location.hash || "#/";
    var m = h.match(/^#\/p\/([a-z0-9]+)/i);
    if (m) return viewPoll(m[1]);
    if (h.indexOf("#/done/") === 0) return viewShare(h.slice(7));
    return viewCreate();
  }

  window.addEventListener("hashchange", route);

  /* ---------------------------------------------------------
     4. CREATE A POLL
     --------------------------------------------------------- */

  var draft = {
    title: "",
    organizer: "",
    location: "",
    notes: "",
    duration: 30,
    days: {},              // { "2026-08-20": ["09:00","14:00"] }
    calMonth: new Date()
  };

  var QUICK = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  function viewCreate() {
    draft.calMonth = new Date(draft.calMonth.getFullYear(), draft.calMonth.getMonth(), 1);

    el("app").innerHTML =
      '<h1>Everyone brings a time.</h1>' +
      '<p class="sub">Nobody plans a potluck &mdash; everyone shows up with what they\'ve got and dinner appears. ' +
      'Same idea here. Put out the times, send one link, watch the meeting cook itself.</p>' +

      '<div class="card">' +
        '<div class="step-label"><span class="step-num">1</span> What\'s the meeting?</div>' +
        '<div class="field"><label class="f" for="fTitle">Title</label>' +
          '<input type="text" id="fTitle" placeholder="e.g. Q4 kickoff, coffee catch-up, board sync" maxlength="120"></div>' +
        '<div class="row">' +
          '<div class="field"><label class="f" for="fOrg">Your name</label>' +
            '<input type="text" id="fOrg" placeholder="Emily" maxlength="60"></div>' +
          '<div class="field"><label class="f" for="fLoc">Where <span style="color:var(--muted);font-weight:400">(optional)</span></label>' +
            '<input type="text" id="fLoc" placeholder="Zoom, the office, a pub" maxlength="120"></div>' +
        '</div>' +
        '<div class="field"><label class="f" for="fNotes">Anything to add <span style="color:var(--muted);font-weight:400">(optional)</span></label>' +
          '<textarea id="fNotes" placeholder="Agenda, dial-in details, bring your laptop&hellip;" maxlength="600"></textarea></div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="step-label"><span class="step-num">2</span> How long?</div>' +
        '<div class="durations" id="durs"></div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="step-label"><span class="step-num">3</span> Pick your days</div>' +
        '<p class="hint" style="margin:0 0 14px">Tap any day to add it. Tap again to remove it. Add as many as you like &mdash; there\'s no limit.</p>' +
        '<div id="cal"></div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="step-label"><span class="step-num">4</span> Add times to each day</div>' +
        '<div id="daylist" class="daylist"></div>' +
      '</div>' +

      '<div id="createErr"></div>' +
      '<button class="btn btn-lg" id="btnCreate">Create &amp; get the link &rarr;</button>' +
      '<p class="hint" style="text-align:center;margin-top:10px">No accounts. No sign-ups. Just a link.</p>';

    // restore anything typed earlier
    el("fTitle").value = draft.title;
    el("fOrg").value = draft.organizer;
    el("fLoc").value = draft.location;
    el("fNotes").value = draft.notes;

    ["fTitle:title", "fOrg:organizer", "fLoc:location", "fNotes:notes"].forEach(function (pair) {
      var p = pair.split(":");
      el(p[0]).addEventListener("input", function (e) { draft[p[1]] = e.target.value; });
    });

    el("btnCreate").addEventListener("click", submitPoll);

    renderDurations();
    renderCalendar();
    renderDayList();
  }

  function renderDurations() {
    var preset = [15, 30, 60, 90], box = el("durs");
    var isCustom = preset.indexOf(draft.duration) === -1;

    box.innerHTML = preset.map(function (m) {
      return '<button class="dur' + (draft.duration === m ? " on" : "") +
             '" data-m="' + m + '">' + durLabel(m) + "</button>";
    }).join("") +
    '<span class="dur-custom' + (isCustom ? " on" : "") + '">' +
      '<input type="text" inputmode="numeric" id="durCustom" placeholder="&hellip;" value="' +
      (isCustom ? draft.duration : "") + '"><span>min</span></span>';

    box.querySelectorAll(".dur").forEach(function (b) {
      b.addEventListener("click", function () {
        draft.duration = +b.dataset.m;
        renderDurations(); renderDayList();
      });
    });
    el("durCustom").addEventListener("input", function (e) {
      var n = parseInt(e.target.value.replace(/\D/g, ""), 10);
      if (n > 0 && n <= 1440) { draft.duration = n; renderDayList(); }
      el("durs").querySelectorAll(".dur").forEach(function (b) { b.classList.remove("on"); });
      e.target.parentNode.classList.add("on");
    });
  }

  function renderCalendar() {
    var y = draft.calMonth.getFullYear(), mo = draft.calMonth.getMonth();
    var first = new Date(y, mo, 1);
    var daysIn = new Date(y, mo + 1, 0).getDate();
    var pad = first.getDay();
    var today = new Date(); today.setHours(0, 0, 0, 0);

    var cells = "";
    for (var i = 0; i < pad; i++) cells += '<div class="cal-day empty"></div>';
    for (var d = 1; d <= daysIn; d++) {
      var date = new Date(y, mo, d);
      var key = ymd(date);
      var past = date < today;
      cells += '<button class="cal-day' +
        (draft.days[key] ? " picked" : "") +
        (key === ymd(today) ? " today" : "") +
        '" data-d="' + key + '"' + (past ? " disabled" : "") + ">" + d + "</button>";
    }

    el("cal").innerHTML =
      '<div class="cal-head">' +
        '<div class="cal-month">' + MON[mo] + " " + y + "</div>" +
        '<div class="cal-nav"><button id="calPrev">&#8249;</button><button id="calNext">&#8250;</button></div>' +
      "</div>" +
      '<div class="cal-grid">' +
        DOW.map(function (n) { return '<div class="cal-dow">' + n[0] + n[1] + "</div>"; }).join("") +
        cells +
      "</div>";

    el("calPrev").addEventListener("click", function () {
      draft.calMonth = new Date(y, mo - 1, 1); renderCalendar();
    });
    el("calNext").addEventListener("click", function () {
      draft.calMonth = new Date(y, mo + 1, 1); renderCalendar();
    });
    el("cal").querySelectorAll(".cal-day[data-d]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.d;
        if (draft.days[k]) delete draft.days[k];
        else draft.days[k] = [];
        renderCalendar(); renderDayList();
      });
    });
  }

  function renderDayList() {
    var keys = Object.keys(draft.days).sort();
    var box = el("daylist");

    if (!keys.length) {
      box.innerHTML = '<div class="empty-note">Pick a day above and it\'ll show up here, ready for times.</div>';
      return;
    }

    box.innerHTML = keys.map(function (k) {
      var times = draft.days[k].slice().sort();
      return '<div class="dayblock" data-d="' + k + '">' +
        '<div class="dayblock-head">' +
          '<span class="dayblock-date">' + longDate(k) + "</span>" +
          '<button class="x" data-rmday="' + k + '" title="Remove this day">&times;</button>' +
        "</div>" +
        '<div class="timechips">' +
          (times.length
            ? times.map(function (t) {
                return '<span class="timechip">' + pretty12(t) +
                  ' <span style="color:var(--muted);font-weight:400">&ndash; ' +
                  pretty12(addMinutes(t, draft.duration)) + "</span>" +
                  '<button class="x" data-rmtime="' + k + "|" + t + '">&times;</button></span>';
              }).join("")
            : '<span style="color:var(--muted);font-size:13.5px">No times yet</span>') +
        "</div>" +
        '<div class="addtime">' +
          '<input type="time" data-timein="' + k + '" step="900">' +
          '<button class="btn btn-sm btn-ghost" data-addtime="' + k + '">+ Add time</button>' +
          (keys.length > 1 ? '<button class="btn btn-sm btn-ghost" data-copyall="' + k + '">Copy to all days</button>' : "") +
        "</div>" +
        '<div class="quick">' +
          QUICK.map(function (t) {
            return '<button class="quickbtn" data-quick="' + k + "|" + t + '">' + pretty12(t) + "</button>";
          }).join("") +
        "</div>" +
      "</div>";
    }).join("");

    box.querySelectorAll("[data-rmday]").forEach(function (b) {
      b.addEventListener("click", function () {
        delete draft.days[b.dataset.rmday]; renderCalendar(); renderDayList();
      });
    });
    box.querySelectorAll("[data-rmtime]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.dataset.rmtime.split("|");
        draft.days[p[0]] = draft.days[p[0]].filter(function (t) { return t !== p[1]; });
        renderDayList();
      });
    });
    box.querySelectorAll("[data-quick]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.dataset.quick.split("|");
        pushTime(p[0], p[1]); renderDayList();
      });
    });
    box.querySelectorAll("[data-addtime]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.addtime;
        var input = box.querySelector('[data-timein="' + k + '"]');
        if (input && input.value) { pushTime(k, input.value); input.value = ""; renderDayList(); }
      });
    });
    box.querySelectorAll("[data-timein]").forEach(function (inp) {
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && inp.value) {
          pushTime(inp.dataset.timein, inp.value); inp.value = ""; renderDayList();
        }
      });
    });
    box.querySelectorAll("[data-copyall]").forEach(function (b) {
      b.addEventListener("click", function () {
        var src = draft.days[b.dataset.copyall];
        Object.keys(draft.days).forEach(function (k) {
          src.forEach(function (t) { pushTime(k, t); });
        });
        renderDayList();
      });
    });
  }

  function pushTime(day, t) {
    t = t.slice(0, 5);
    draft.days[day] = draft.days[day] || [];
    if (draft.days[day].indexOf(t) === -1) draft.days[day].push(t);
    draft.days[day].sort();
  }

  function draftSlots() {
    var out = [];
    Object.keys(draft.days).sort().forEach(function (d) {
      draft.days[d].slice().sort().forEach(function (t) { out.push({ d: d, t: t }); });
    });
    return out;
  }

  function submitPoll() {
    var errBox = el("createErr");
    errBox.innerHTML = "";

    var slots = draftSlots();
    var problem =
      !draft.title.trim() ? "Give your potluck a title so people know what they're saying yes to." :
      !draft.organizer.trim() ? "Add your name — people like knowing who's asking." :
      !slots.length ? "Add at least one time. Pick a day above, then tap a time." : null;

    if (problem) {
      errBox.innerHTML = '<div class="banner bad">' + esc(problem) + "</div>";
      errBox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    var btn = el("btnCreate");
    btn.disabled = true;
    btn.textContent = "Setting the table…";

    var poll = {
      id: newId(),
      title: draft.title.trim(),
      organizer: draft.organizer.trim(),
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
      duration: draft.duration,
      slots: slots
    };

    Store.createPoll(poll).then(function () {
      try { localStorage.setItem("potluck.owner." + poll.id, "1"); } catch (e) {}
      draft = { title: "", organizer: draft.organizer, location: "", notes: "",
                duration: 30, days: {}, calMonth: new Date() };
      location.hash = "#/done/" + poll.id;
    }).catch(function (e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = "Create &amp; get the link &rarr;";
      errBox.innerHTML = '<div class="banner bad"><strong>Couldn\'t save that.</strong> ' +
        esc(e.message || "Check your Supabase settings in config.js.") + "</div>";
    });
  }

  /* ---------------------------------------------------------
     5. SHARE SCREEN
     --------------------------------------------------------- */

  function viewShare(id) {
    var url = shareUrl(id);
    el("app").innerHTML =
      '<div class="card share-hero">' +
        '<div class="share-emoji">🥘</div>' +
        "<h1>The table's set.</h1>" +
        '<p class="sub" style="margin-bottom:0">Send this link to everyone. They pick what works, ' +
        "you watch the answers land. No sign-up on their end either.</p>" +
        '<div class="linkbox"><input type="text" id="shareLink" readonly value="' + esc(url) + '">' +
        '<button class="btn" id="btnCopy">Copy</button></div>' +
        '<div id="copyMsg" style="height:20px"></div>' +
        '<a class="btn btn-ghost" href="#/p/' + esc(id) + '" style="margin-top:6px">Open the poll &rarr;</a>' +
      "</div>" +
      '<p class="hint" style="text-align:center">' +
      '<a href="#/" style="color:var(--muted)">Start another one</a></p>';

    el("shareLink").addEventListener("click", function () { this.select(); });
    el("btnCopy").addEventListener("click", function () {
      var inp = el("shareLink");
      inp.select();
      var done = function () { el("copyMsg").innerHTML = '<span class="copied">Copied. Go paste it somewhere.</span>'; };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {
        document.execCommand("copy"); done();
      });
      else { document.execCommand("copy"); done(); }
    });
  }

  /* ---------------------------------------------------------
     6. THE POLL PAGE (vote + results)
     --------------------------------------------------------- */

  function viewPoll(id) {
    voteState = null; // fresh start whenever the page is (re)loaded
    el("app").innerHTML = '<div class="loading">Laying out the dishes…</div>';

    Promise.all([Store.getPoll(id), Store.getVotes(id)]).then(function (res) {
      var poll = res[0], votes = res[1];
      if (!poll) {
        el("app").innerHTML =
          '<div class="card"><h1>Nothing here</h1>' +
          '<p class="sub">That link doesn\'t point at a poll. It may have been mistyped, or ' +
          (LIVE ? "the poll was removed." : "it was created in demo mode on a different device.") +
          '</p><a class="btn" href="#/">Start a new one</a></div>';
        return;
      }
      renderPoll(poll, votes);
    }).catch(function (e) {
      console.error(e);
      el("app").innerHTML = '<div class="banner bad"><strong>Couldn\'t load that poll.</strong> ' +
        esc(e.message || "") + "</div>";
    });
  }

  var voteState = null; // { name, choices, editingId }

  function renderPoll(poll, votes) {
    var slots = poll.slots || [];
    var myVoteId = null;
    try { myVoteId = localStorage.getItem("potluck.vote." + poll.id); } catch (e) {}
    var mine = votes.filter(function (v) { return v.id === myVoteId; })[0] || null;

    if (!voteState) {
      voteState = {
        name: mine ? mine.name : "",
        choices: mine ? Object.assign({}, mine.choices) : {},
        editingId: mine ? mine.id : null
      };
    }

    // tally
    var tally = slots.map(function (s) {
      var k = slotKey(s), y = 0, m = 0;
      votes.forEach(function (v) {
        if (v.id === voteState.editingId) return;
        var c = (v.choices || {})[k];
        if (c === "y") y++; else if (c === "m") m++;
      });
      var mc = voteState.choices[k];
      if (mc === "y") y++; else if (mc === "m") m++;
      return { y: y, m: m, score: y * 2 + m };
    });
    var top = Math.max.apply(null, tally.map(function (t) { return t.score; }).concat([0]));
    var bestIdx = tally.map(function (t, i) { return t.score === top && top > 0 ? i : -1; })
                       .filter(function (i) { return i >= 0; });

    var others = votes.filter(function (v) { return v.id !== voteState.editingId; });

    /* ---- header ---- */
    var html =
      '<h1>' + esc(poll.title) + "</h1>" +
      '<p class="sub" style="margin-bottom:12px">' + esc(poll.organizer) + " is asking</p>" +
      '<div class="pollmeta">' +
        '<span class="tag">' + durLabel(poll.duration) + "</span>" +
        '<span class="tag plain">' + slots.length + " option" + (slots.length === 1 ? "" : "s") + "</span>" +
        (poll.location ? '<span class="tag plain">' + esc(poll.location) + "</span>" : "") +
        '<span class="tag plain">' + votes.length + " " +
          (votes.length === 1 ? "person has" : "people have") + " answered</span>" +
      "</div>" +
      (poll.notes ? '<div class="card" style="margin-top:18px"><p style="margin:0;white-space:pre-wrap">' +
        esc(poll.notes) + "</p></div>" : "<div style='height:18px'></div>");

    /* ---- winner ---- */
    if (top > 0 && bestIdx.length) {
      var b = slots[bestIdx[0]], bt = tally[bestIdx[0]];
      html += '<div class="winner"><div class="k">Leading so far</div>' +
        '<div class="v">' + longDate(b.d) + " &middot; " + pretty12(b.t) +
        " &ndash; " + pretty12(addMinutes(b.t, poll.duration)) + "</div>" +
        '<div class="n">' + bt.y + " yes" + (bt.m ? ", " + bt.m + " if need be" : "") +
        (bestIdx.length > 1 ? " &middot; tied with " + (bestIdx.length - 1) + " other" +
          (bestIdx.length > 2 ? "s" : "") : "") + "</div></div>";
    }

    /* ---- table ---- */
    html += '<div class="card"><h2>Who can make it</h2>' +
      '<p class="hint" style="margin:0 0 16px">Tick the times that work for you, add your name, and you\'re done.</p>' +
      '<div class="gridscroll"><table class="votes"><thead><tr><th class="who"></th>' +
      slots.map(function (s, i) {
        var best = bestIdx.indexOf(i) >= 0 && top > 0;
        var d = parseYmd(s.d);
        return '<th class="slot' + (best ? " best" : "") + '">' +
          '<span class="d">' + DOW[d.getDay()] + " " + MON[d.getMonth()].slice(0, 3) + "</span>" +
          '<span class="n">' + d.getDate() + "</span>" +
          '<span class="t">' + pretty12(s.t) + "</span></th>";
      }).join("") + "</tr></thead><tbody>";

    others.forEach(function (v) {
      html += "<tr><td class='who'>" + esc(v.name) +
        (v.comment ? '<div style="font-weight:400;color:var(--muted);font-size:12px">' +
          esc(v.comment) + "</div>" : "") + "</td>" +
        slots.map(function (s) {
          var c = (v.choices || {})[slotKey(s)] || "n";
          var sym = c === "y" ? "&#10003;" : c === "m" ? "(&#10003;)" : "&ndash;";
          return '<td class="cell ' + c + '"><span class="mark ' + c + '">' + sym + "</span></td>";
        }).join("") + "</tr>";
    });

    // my row
    html += '<tr class="me"><td class="who"><input type="text" id="myName" placeholder="Your name" value="' +
      esc(voteState.name) + '" maxlength="60" style="font-size:14px;padding:8px 10px"></td>' +
      slots.map(function (s) {
        var k = slotKey(s), c = voteState.choices[k] || "";
        return '<td><div class="vcell">' +
          '<button class="vbtn y' + (c === "y" ? " on" : "") + '" data-k="' + k + '" data-v="y" title="Works for me">&#10003;</button>' +
          '<button class="vbtn m' + (c === "m" ? " on" : "") + '" data-k="' + k + '" data-v="m" title="If need be">~</button>' +
          '<button class="vbtn n' + (c === "n" ? " on" : "") + '" data-k="' + k + '" data-v="n" title="Can\'t do it">&times;</button>' +
          "</div></td>";
      }).join("") + "</tr>";

    // tally row
    html += '<tr class="tally"><td class="who">Yes votes</td>' +
      tally.map(function (t, i) {
        return '<td class="count' + (bestIdx.indexOf(i) >= 0 && top > 0 ? " best" : "") + '">' +
          t.y + (t.m ? '<span style="color:var(--maybe);font-size:12px"> +' + t.m + "</span>" : "") + "</td>";
      }).join("") + "</tr>";

    html += "</tbody></table></div>" +
      '<div class="legend">' +
        '<span><span class="mark y">&#10003;</span> works</span>' +
        '<span><span class="mark m">(&#10003;)</span> if need be</span>' +
        '<span><span class="mark n">&ndash;</span> can\'t</span>' +
      "</div>" +
      '<div class="field" style="margin-top:18px"><input type="text" id="myComment" placeholder="Add a note (optional) — e.g. can\'t do mornings" maxlength="140"></div>' +
      '<div id="voteErr"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">' +
        '<button class="btn" id="btnVote">' + (voteState.editingId ? "Update my answer" : "Send my answer") + "</button>" +
        (voteState.editingId ? '<button class="btn btn-ghost" id="btnUnvote">Remove my answer</button>' : "") +
        '<button class="btn btn-ghost" id="btnShare">Copy share link</button>' +
      "</div></div>" +
      '<p class="hint" style="text-align:center"><a href="#/" style="color:var(--muted)">Start your own potluck</a></p>';

    el("app").innerHTML = html;

    if (mine) el("myComment").value = mine.comment || "";

    el("myName").addEventListener("input", function (e) { voteState.name = e.target.value; });

    el("app").querySelectorAll(".vbtn").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.k, v = b.dataset.v;
        voteState.choices[k] = voteState.choices[k] === v ? "" : v;
        voteState.name = el("myName").value;
        var note = el("myComment").value;
        renderPoll(poll, votes);
        el("myComment").value = note;
      });
    });

    el("btnShare").addEventListener("click", function () {
      var u = shareUrl(poll.id);
      if (navigator.clipboard) navigator.clipboard.writeText(u);
      this.textContent = "Copied!";
      var self = this;
      setTimeout(function () { self.textContent = "Copy share link"; }, 1600);
    });

    if (el("btnUnvote")) {
      el("btnUnvote").addEventListener("click", function () {
        Store.deleteVote(voteState.editingId).then(function () {
          try { localStorage.removeItem("potluck.vote." + poll.id); } catch (e) {}
          voteState = null;
          viewPoll(poll.id);
        });
      });
    }

    el("btnVote").addEventListener("click", function () {
      var name = el("myName").value.trim();
      var picked = Object.keys(voteState.choices).some(function (k) { return voteState.choices[k]; });
      if (!name) {
        el("voteErr").innerHTML = '<div class="banner bad">Pop your name in so people know who you are.</div>';
        return;
      }
      if (!picked) {
        el("voteErr").innerHTML = '<div class="banner bad">Tick at least one time — even a &ldquo;can\'t do it&rdquo; helps.</div>';
        return;
      }

      var btn = this;
      btn.disabled = true;
      btn.textContent = "Saving…";

      var clean = {};
      Object.keys(voteState.choices).forEach(function (k) {
        if (voteState.choices[k]) clean[k] = voteState.choices[k];
      });

      var payload = { name: name, choices: clean, comment: el("myComment").value.trim() || null };

      var job = voteState.editingId
        ? Store.updateVote(voteState.editingId, payload)
        : Store.addVote(Object.assign({ poll_id: poll.id }, payload)).then(function (v) {
            try { localStorage.setItem("potluck.vote." + poll.id, v.id); } catch (e) {}
          });

      job.then(function () {
        voteState = null;
        viewPoll(poll.id);
      }).catch(function (e) {
        console.error(e);
        btn.disabled = false;
        btn.textContent = "Send my answer";
        el("voteErr").innerHTML = '<div class="banner bad">Couldn\'t save: ' + esc(e.message || "") + "</div>";
      });
    });
  }

  /* ---------------------------------------------------------
     7. GO
     --------------------------------------------------------- */

  if (!LIVE) {
    el("modeBadge").innerHTML =
      '<span class="pill-mode">Demo mode &mdash; polls save in this browser only. ' +
      "Add your Supabase keys to config.js to make links work for everyone.</span>";
  } else {
    el("modeBadge").textContent = "Potluck — everyone brings a time.";
  }

  route();
})();
