import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowUpRight,
  CircleDollarSign,
  CalendarDays,
  Search,
  Bell,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock3,
  AlertCircle,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Landmark,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
const API = import.meta.env.VITE_API_URL;
const money = (n) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
const dateLabel = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not scheduled";
async function request(path, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!r.ok) {
    let msg = `Request failed (${r.status})`;
    try {
      const e = await r.json();
      msg = e.message || e.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json();
}
function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
function Field({
  label,
  name,
  type = "text",
  required = true,
  options,
  placeholder,
  form,
  setForm,
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select
          required={required}
          value={form[name] ?? ""}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          required={required}
          type={type}
          min={type === "number" ? "0.01" : undefined}
          step={type === "number" ? "any" : undefined}
          placeholder={placeholder || ""}
          value={form[name] ?? ""}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        />
      )}
    </label>
  );
}
export default function App() {
  const [page, setPage] = useState("Overview"),
    [mobileNav, setMobileNav] = useState(false);

  const [members, setMembers] = useState([]),
    [circles, setCircles] = useState([]),
    [memberships, setMemberships] = useState([]),
    [cycles, setCycles] = useState([]),
    [contributions, setContributions] = useState([]),
    [payouts, setPayouts] = useState([]);

  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState("");

  const [modal, setModal] = useState(""),
    [saving, setSaving] = useState(false),
    [selectedCircle, setSelectedCircle] = useState("all");


  const [form, setForm] = useState({});

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [m, c, ms, cy, co, p] = await Promise.all(
        [
          "members",
          "circles",
          "memberships",
          "cycles",
          "contributions",
          "payouts",
        ].map((x) => request("/" + x)),
      );
      setMembers(m);
      setCircles(c);
      setMemberships(ms);
      setCycles(cy);
      setContributions(co);
      setPayouts(p);
    } catch (e) {
      setError(e.message + " — check that the API and database are running.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const activeMembers = members.filter((m) => m.status !== "inactive").length;
  const paid = contributions.filter((c) => c.payment_status === "paid").length;
  const pending = contributions.filter(
    (c) => c.payment_status === "pending",
  ).length;


//   const totalCollected = contributions
//     .filter((c) => c.payment_status === "already_paid")
//     .reduce((s, c) => s + Number(c.amount || 0), 0);

  const totalCollected = contributions
    .filter((c) => c.payment_status === "paid")
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const nextPayout = useMemo(() => {
    const p = payouts
      .filter((p) => p.status === "pending")
      .sort((a, b) => Number(a.cycle_id) - Number(b.cycle_id))[0];
    if (!p) return null;
    const cycle = cycles.find((c) => Number(c.cycle_id) === Number(p.cycle_id));
    const membership = memberships.find(
      (m) => Number(m.membership_id) === Number(p.membership_id),
    );
    const member = members.find(
      (m) => Number(m.member_id) === Number(membership?.member_id),
    );
    const circle = circles.find(
      (c) => Number(c.circle_id) === Number(cycle?.circle_id),
    );
    return { ...p, cycle, member, circle };
  }, [payouts, cycles, memberships, members, circles]);

  const selectedCircleObj = circles.find(
    (c) => String(c.circle_id) === String(selectedCircle),
  );

  const filteredContributions = contributions.filter((c) => {
    const cy = cycles.find((x) => Number(x.cycle_id) === Number(c.cycle_id));
    return (
      selectedCircle === "all" ||
      String(cy?.circle_id) === String(selectedCircle)
    );
  });

  const visibleMembers = members.filter((m) =>
    `${m.full_name} ${m.email || ""} ${m.phone || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const visibleCircles = circles.filter((c) =>
    `${c.name} ${c.email || ""}`.toLowerCase().includes(query.toLowerCase()),
  );


  const showToast = (s) => setToast(s);
  const openModal = (type) => {
    setForm({ status: "active" });
    setModal(type);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const route = {
        member: "members",
        circle: "circles",
        membership: "memberships",
        contribution: "contributions",
        payout: "payouts",
      }[modal];
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") delete payload[k];
      });
      [
        "member_id",
        "circle_id",
        "rotation_position",
        "cycle_id",
        "membership_id",
      ].forEach((k) => {
        if (payload[k] !== undefined && payload[k] !== "")
          payload[k] = Number(payload[k]);
      });
      if (
        ["contribution", "payout", "circle"].includes(modal) &&
        payload.amount !== undefined
      ) {
        if (modal === "circle")
          payload.contribution_amount = Number(payload.amount);
        else payload.amount = Number(payload.amount);
        delete payload.amount;
        if (modal === "circle") {
        }
      }
      if (modal === "circle" && form.contribution_amount !== undefined)
        payload.contribution_amount = Number(form.contribution_amount);
      if (modal === "contribution") payload.amount = Number(form.amount);
      if (modal === "payout") payload.amount = Number(form.amount);
      await request("/" + route, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setModal("");
      showToast("Record created successfully");
      await refresh();
    } catch (e) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const nav = [
    ["Overview", LayoutDashboard],
    ["Circles", Landmark],
    ["Members", Users],
    ["Contributions", Wallet],
    ["Payouts", CircleDollarSign],
  ];
  const modalTitle = {
    member: "Add a member",
    circle: "Create a circle",
    membership: "Enroll a member",
    contribution: "Record a contribution",
    payout: "Record a payout",
  };
  const renderModalFields = () => {
    switch (modal) {
      case "member":
        return (
          <>
            <Field
              form={form}
              setForm={setForm}
              label="Full name"
              name="full_name"
              placeholder="e.g. Amina Khan"
            />
            <div className="form-grid">
              <Field
                form={form}
                setForm={setForm}
                label="Phone"
                name="phone"
                required={false}
                placeholder="+27…"
              />
              <Field
                form={form}
                setForm={setForm}
                label="Email"
                name="email"
                type="email"
                required={false}
              />
            </div>
          </>
        );

      case "circle":
        return (
          <>
            <Field
              form={form}
              setForm={setForm}
              label="Circle name"
              name="name"
              placeholder="e.g. Sunday Savers"
            />
            <Field
              form={form}
              setForm={setForm}
              label="Contribution amount (ZAR)"
              name="contribution_amount"
              type="number"
              placeholder="1000"
            />
            <Field
              form={form}
              setForm={setForm}
              label="Contact email"
              name="email"
              type="email"
              required={false}
            />
          </>
        );


      case "membership":
        return (
          <>
            <Field
              form={form}
              setForm={setForm}
              label="Member"
              name="member_id"
              options={members.map((m) => ({
                value: m.member_id,
                label: `${m.full_name} · #${m.member_id}`,
              }))}
            />
            <Field
              form={form}
              setForm={setForm}
              label="Circle"
              name="circle_id"
              options={circles.map((c) => ({
                value: c.circle_id,
                label: c.name,
              }))}
            />
            <Field
              form={form}
              setForm={setForm}
              label="Rotation position"
              name="rotation_position"
              type="number"
            />
          </>
        );


      case "contribution":
        return (
          <>
            <Field
              form={form}
              setForm={setForm}
              label="Membership"
              name="membership_id"
              options={memberships.map((m) => ({
                value: m.membership_id,
                label: `Membership #${m.membership_id} · ${members.find((x) => x.member_id === m.member_id)?.full_name || "Member"} (circle #${m.circle_id})`,
              }))}
            />
            <Field
              form={form}
              setForm={setForm}
              label="Cycle"
              name="cycle_id"
              options={cycles.map((c) => ({
                value: c.cycle_id,
                label: `Cycle ${c.cycle_number} · circle #${c.circle_id}`,
              }))}
            />
            <div className="form-grid">
              <Field
                form={form}
                setForm={setForm}
                label="Amount (ZAR)"
                name="amount"
                type="number"
              />
              <Field
                form={form}
                setForm={setForm}
                label="Payment status"
                name="payment_status"
                options={["pending", "paid", "failed", "waived"].map((x) => ({
                  value: x,
                  label: x,
                }))}
              />
            </div>
            <Field
              form={form}
              setForm={setForm}
              label="Contribution date"
              name="contribution_date"
              type="date"
              required={false}
            />
            <Field
              form={form}
              setForm={setForm}
              label="Adjustment note (if amount differs)"
              name="adjustment_note"
              required={false}
            />
          </>
        );


      case "payout":
        return (
          <>
            <Field
              form={form}
              setForm={setForm}
              label="Cycle"
              name="cycle_id"
              options={cycles.map((c) => ({
                value: c.cycle_id,
                label: `Cycle ${c.cycle_number} · circle #${c.circle_id}`,
              }))}
            />
            <Field
              form={form}
              setForm={setForm}
              label="Recipient membership"
              name="membership_id"
              options={memberships.map((m) => ({
                value: m.membership_id,
                label: `${members.find((x) => x.member_id === m.member_id)?.full_name || "Member"} · membership #${m.membership_id}`,
              }))}
            />
            <Field
              form={form}
              setForm={setForm}
              label="Amount (ZAR)"
              name="amount"
              type="number"
            />
            <Field
              form={form}
              setForm={setForm}
              label="Status"
              name="status"
              options={["pending", "paid", "failed"].map((x) => ({
                value: x,
                label: x,
              }))}
            />
            <Field
              form={form}
              setForm={setForm}
              label="Payout date"
              name="payout_date"
              type="date"
              required={false}
            />
          </>
        );

        
      default:
        return null;
    }
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "show" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Landmark size={22} />
          </div>
          <div>
            <b>rosca</b>
            <small>COMMUNITY FINANCE</small>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => {
                setPage(name);
                setMobileNav(false);
              }}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Contributions" && pending > 0 && <em>{pending}</em>}
            </button>
          ))}
        </nav>
      </aside>
      {mobileNav && (
        <div className="scrim" onClick={() => setMobileNav(false)}></div>
      )}
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            <button className="mobile-menu" onClick={() => setMobileNav(true)}>
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <b>{page}</b>
          </div>
         
        </header>
        <div className="content">
          <div className="page-heading">
            <div className="heading-actions">
              <button className="btn btn-light" onClick={refresh}>
                <RefreshCw size={16} /> Refresh
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  openModal(
                    page === "Members"
                      ? "member"
                      : page === "Circles"
                        ? "circle"
                        : page === "Contributions"
                          ? "contribution"
                          : page === "Payouts"
                            ? "payout"
                            : "circle",
                  )
                }
              >
                <Plus size={17} />{" "}
                {page === "Members"
                  ? "Add member"
                  : page === "Circles"
                    ? "New circle"
                    : page === "Contributions"
                      ? "Record payment"
                      : page === "Payouts"
                        ? "Add payout"
                        : "New circle"}
              </button>
            </div>
          </div>
          {error && (
            <div className="error-banner">
              <AlertCircle size={18} />
              <div>
                <b>Couldn’t load your ROSCA data</b>
                <p>{error}</p>
                <span>
                  Docker Compose starts the API and MySQL together. See README
                  for setup.
                </span>
              </div>
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {loading && !error ? (
            <div className="loading">
              <div className="spinner" />
              Loading your workspace…
            </div>
          ) : page === "Overview" ? (
            <>
              <section className="hero-grid">
                <div className="hero-card">
                  <div className="hero-top">
                    <div>
                      <span className="hero-kicker">
                        TOTAL CONTRIBUTIONS COLLECTED
                      </span>
                      <h2>{money(totalCollected)}</h2>
                    </div>
                    <div className="hero-symbol">
                      <Wallet size={23} />
                    </div>
                  </div>
                  <div className="hero-bottom">
                    <div className="hero-progress">
                      <span
                        style={{
                          width: `${contributions.length ? Math.round((paid / contributions.length) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="hero-foot">
                      <span>{paid} payments confirmed</span>
                      <b>
                        {contributions.length
                          ? Math.round((paid / contributions.length) * 100)
                          : 0}
                        %
                      </b>
                    </div>
                  </div>
                  <div className="hero-decoration">R</div>
                </div>
                <div className="payout-card">
                  <div className="payout-card-top">
                    <span className="hero-kicker">UP NEXT</span>
                    <span className="payout-icon">
                      <CalendarDays size={19} />
                    </span>
                  </div>
                  <div className="payout-label">Next payout</div>
                  {nextPayout ? (
                    <>
                      <h3>
                        {nextPayout.member?.full_name ||
                          `Membership #${nextPayout.membership_id}`}
                      </h3>
                      <div className="payout-amount">
                        {money(nextPayout.amount)}
                      </div>
                      <div className="payout-meta">
                        <span>
                          {nextPayout.circle?.name || "Circle"} · Cycle{" "}
                          {nextPayout.cycle?.cycle_number || "—"}
                        </span>
                        <Badge tone="warning">Pending</Badge>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>No payout queued</h3>
                      <div className="payout-amount">—</div>
                      <div className="payout-meta">
                        <span>Generate a circle schedule to begin</span>
                      </div>
                    </>
                  )}
                  <button
                    className="text-link"
                    onClick={() => setPage("Payouts")}
                  >
                    View payout schedule <ArrowRight size={15} />
                  </button>
                </div>
              </section>
              <section className="stats-grid">
                <Stat
                  icon={Users}
                  label="Active members"
                  value={activeMembers}
                  note={`${members.length} total registered`}
                  tone="mint"
                />
                <Stat
                  icon={Landmark}
                  label="Savings circles"
                  value={circles.length}
                  note={`${circles.filter((c) => c.status !== "inactive").length} active circles`}
                  tone="lavender"
                />
                <Stat
                  icon={CheckCircle2}
                  label="Paid contributions"
                  value={paid}
                  note={`${pending} awaiting payment`}
                  tone="peach"
                />
                <Stat
                  icon={CircleDollarSign}
                  label="Pending payouts"
                  value={payouts.filter((p) => p.status === "pending").length}
                  note={`${payouts.filter((p) => p.status === "paid").length} completed`}
                  tone="blue"
                />
              </section>
              <section className="dashboard-grid">
                <div className="panel contribution-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Contribution status</h3>
                      <p>Recent payments across your circles</p>
                    </div>
                  </div>
                  <div className="status-summary">
                    <div>
                      <span className="legend-dot paid-dot" />
                      <span>Paid</span>
                      <b>
                        {
                          filteredContributions.filter(
                            (c) => c.payment_status === "paid",
                          ).length
                        }
                      </b>
                    </div>
                    <div>
                      <span className="legend-dot pending-dot" />
                      <span>Pending</span>
                      <b>
                        {
                          filteredContributions.filter(
                            (c) => c.payment_status === "pending",
                          ).length
                        }
                      </b>
                    </div>
                    <div>
                      <span className="legend-dot failed-dot" />
                      <span>Failed / waived</span>
                      <b>
                        {
                          filteredContributions.filter((c) =>
                            ["failed", "waived"].includes(c.payment_status),
                          ).length
                        }
                      </b>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>MEMBER</th>
                          <th>CYCLE</th>
                          <th>AMOUNT</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContributions.slice(0, 5).map((c) => {
                          const mship = memberships.find(
                            (m) =>
                              Number(m.membership_id) ===
                              Number(c.membership_id),
                          );
                          const mem = members.find(
                            (m) =>
                              Number(m.member_id) === Number(mship?.member_id),
                          );
                          const cy = cycles.find(
                            (x) => Number(x.cycle_id) === Number(c.cycle_id),
                          );
                          return (
                            <tr key={c.contribution_id}>
                              <td>
                                <div className="person-cell">
                                  <div className="mini-avatar">
                                    {(mem?.full_name || "M")
                                      .split(" ")
                                      .map((x) => x[0])
                                      .slice(0, 2)
                                      .join("")}
                                  </div>
                                  <div>
                                    <b>
                                      {mem?.full_name ||
                                        `Member #${mship?.member_id || "—"}`}
                                    </b>
                                    <small>
                                      Contribution #{c.contribution_id}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>Cycle {cy?.cycle_number || "—"}</td>
                              <td className="amount-cell">{money(c.amount)}</td>
                              <td>
                                <Badge
                                  tone={
                                    c.payment_status === "paid"
                                      ? "success"
                                      : c.payment_status === "pending"
                                        ? "warning"
                                        : "danger"
                                  }
                                >
                                  {c.payment_status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!filteredContributions.length && (
                      <Empty text="No contributions yet. Record the first payment to see it here." />
                    )}
                  </div>
                  <button
                    className="panel-link"
                    onClick={() => setPage("Contributions")}
                  >
                    View all contributions <ArrowRight size={15} />
                  </button>
                </div>
                <div className="panel circles-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Your circles</h3>
                      <p>Quick overview of each group</p>
                    </div>
                    <button
                      className="dots-btn"
                      onClick={() => setPage("Circles")}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                  {circles.slice(0, 4).map((c, i) => {
                    const count = memberships.filter(
                      (m) =>
                        Number(m.circle_id) === Number(c.circle_id) &&
                        m.status !== "inactive",
                    ).length;
                    const pool = Number(c.contribution_amount) * count;
                    return (
                      <div className="circle-row" key={c.circle_id}>
                        <div className={`circle-icon c${i % 4}`}>
                          <Landmark size={18} />
                        </div>
                        <div className="circle-info">
                          <b>{c.name}</b>
                          <span>
                            {count} members · {money(c.contribution_amount)} /
                            cycle
                          </span>
                          <div className="tiny-progress">
                            <span
                              style={{ width: `${Math.min(count * 12, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="circle-side">
                          <b>{money(pool)}</b>
                          <small>payout pool</small>
                          <button
                            onClick={() => generate(c.circle_id)}
                            title="Generate fixed rotation schedule"
                          >
                            <RefreshCw size={13} /> Schedule
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!circles.length && (
                    <Empty text="Create a circle to start tracking shared savings." />
                  )}
                  <button
                    className="panel-link"
                    onClick={() => openModal("circle")}
                  >
                    Create a circle <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            </>
          ) : page === "Circles" ? (
            <section className="panel full-panel">
              <div className="panel-head">
                <div>
                  <h3>All circles</h3>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search circles…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="cards-grid">
                {visibleCircles.map((c, i) => {
                  const ms = memberships.filter(
                    (m) =>
                      Number(m.circle_id) === Number(c.circle_id) &&
                      m.status !== "inactive",
                  );
                  const cy = cycles.filter(
                    (x) => Number(x.circle_id) === Number(c.circle_id),
                  );
                  const cp = payouts.filter((p) =>
                    cy.some((x) => Number(x.cycle_id) === Number(p.cycle_id)),
                  );
                  return (
                    <article className="circle-card" key={c.circle_id}>
                      <div className="circle-card-head">
                        <div className={`circle-icon c${i % 4}`}>
                          <Landmark size={20} />
                        </div>
                        <Badge
                          tone={c.status === "inactive" ? "neutral" : "success"}
                        >
                          {c.status || "active"}
                        </Badge>
                      </div>
                      <h3>{c.name}</h3>
                      <p>{c.email || "No contact email added"}</p>
                      <div className="circle-metrics">
                        <div>
                          <span>Contribution</span>
                          <b>{money(c.contribution_amount)}</b>
                        </div>
                        <div>
                          <span>Members</span>
                          <b>{ms.length}</b>
                        </div>
                        <div>
                          <span>Cycles</span>
                          <b>{cy.length}</b>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!visibleCircles.length && (
                  <Empty text="No circles match your search." />
                )}
              </div>
            </section>
          ) : page === "Members" ? (
            <section className="panel full-panel">
              <div className="panel-head">
                <div>
                  <h3>Member directory</h3>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search members…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>MEMBER</th>
                      <th>PHONE</th>
                      <th>EMAIL</th>
                      <th>CIRCLES</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMembers.map((m) => (
                      <tr key={m.member_id}>
                        <td>
                          <div className="person-cell">
                            <div className="mini-avatar">
                              {m.full_name
                                .split(" ")
                                .map((x) => x[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                            <div>
                              <b>{m.full_name}</b>
                              <small>Member #{m.member_id}</small>
                            </div>
                          </div>
                        </td>
                        <td>{m.phone || "—"}</td>
                        <td>{m.email || "—"}</td>
                        <td>
                          {
                            memberships.filter(
                              (x) =>
                                Number(x.member_id) === Number(m.member_id) &&
                                x.status !== "inactive",
                            ).length
                          }
                        </td>
                        <td>
                          <Badge
                            tone={
                              m.status === "inactive" ? "neutral" : "success"
                            }
                          >
                            {m.status || "active"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleMembers.length && (
                  <Empty text="No members found. Add your first member to get started." />
                )}
              </div>
            </section>
          ) : page === "Contributions" ? (
            <section className="panel full-panel">
              <div className="panel-head">
                <div>
                  <h3>All contributions</h3>
                </div>
                <div className="heading-actions">
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      placeholder="Filter by member/status…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => openModal("contribution")}
                  >
                    <Plus size={16} /> Record payment
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>REFERENCE</th>
                      <th>MEMBER</th>
                      <th>CIRCLE / CYCLE</th>
                      <th>DATE</th>
                      <th>AMOUNT</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions
                      .filter((c) => {
                        const ms = memberships.find(
                          (x) =>
                            Number(x.membership_id) === Number(c.membership_id),
                        );
                        const m = members.find(
                          (x) => Number(x.member_id) === Number(ms?.member_id),
                        );
                        return `${m?.full_name || ""} ${c.payment_status}`
                          .toLowerCase()
                          .includes(query.toLowerCase());
                      })
                      .map((c) => {
                        const ms = memberships.find(
                          (x) =>
                            Number(x.membership_id) === Number(c.membership_id),
                        );
                        const m = members.find(
                          (x) => Number(x.member_id) === Number(ms?.member_id),
                        );
                        const cy = cycles.find(
                          (x) => Number(x.cycle_id) === Number(c.cycle_id),
                        );
                        const cir = circles.find(
                          (x) => Number(x.circle_id) === Number(cy?.circle_id),
                        );
                        return (
                          <tr key={c.contribution_id}>
                            <td>#{c.contribution_id}</td>
                            <td>
                              {m?.full_name || `Member #${ms?.member_id}`}
                            </td>
                            <td>
                              {cir?.name || "Circle"} · Cycle{" "}
                              {cy?.cycle_number || "—"}
                            </td>
                            <td>{dateLabel(c.contribution_date)}</td>
                            <td className="amount-cell">{money(c.amount)}</td>
                            <td>
                              <Badge
                                tone={
                                  c.payment_status === "paid"
                                    ? "success"
                                    : c.payment_status === "pending"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {c.payment_status || "pending"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {!contributions.length && (
                  <Empty text="No contributions recorded yet." />
                )}
              </div>
            </section>
          ) : (
            <section className="panel full-panel">
              <div className="panel-head">
                <div>
                  <h3>Payout schedule</h3>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search recipient…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="payout-highlight">
                <div className="payout-highlight-icon">
                  <CalendarDays size={22} />
                </div>
                <div>
                  <span>NEXT RECIPIENT</span>
                  <h3>
                    {nextPayout?.member?.full_name || "No pending payout"}
                  </h3>
                  <p>
                    {nextPayout
                      ? `${nextPayout.circle?.name || "Circle"} · Cycle ${nextPayout.cycle?.cycle_number || "—"}`
                      : "Generate a schedule for a circle to assign recipients."}
                  </p>
                </div>
                <strong>{nextPayout ? money(nextPayout.amount) : "—"}</strong>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>CYCLE</th>
                      <th>CIRCLE</th>
                      <th>RECIPIENT</th>
                      <th>POOL AMOUNT</th>
                      <th>DATE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts
                      .filter((p) => {
                        const ms = memberships.find(
                          (x) =>
                            Number(x.membership_id) === Number(p.membership_id),
                        );
                        const m = members.find(
                          (x) => Number(x.member_id) === Number(ms?.member_id),
                        );
                        return `${m?.full_name || ""} ${p.status || ""}`
                          .toLowerCase()
                          .includes(query.toLowerCase());
                      })
                      .sort((a, b) => Number(a.cycle_id) - Number(b.cycle_id))
                      .map((p) => {
                        const cy = cycles.find(
                          (x) => Number(x.cycle_id) === Number(p.cycle_id),
                        );
                        const c = circles.find(
                          (x) => Number(x.circle_id) === Number(cy?.circle_id),
                        );
                        const ms = memberships.find(
                          (x) =>
                            Number(x.membership_id) === Number(p.membership_id),
                        );
                        const m = members.find(
                          (x) => Number(x.member_id) === Number(ms?.member_id),
                        );
                        return (
                          <tr key={p.payout_id}>
                            <td>
                              <b>Cycle {cy?.cycle_number || "—"}</b>
                              <small className="subcell">
                                Payout #{p.payout_id}
                              </small>
                            </td>
                            <td>{c?.name || "—"}</td>
                            <td>
                              <div className="person-cell">
                                <div className="mini-avatar">
                                  {(m?.full_name || "M")
                                    .split(" ")
                                    .map((x) => x[0])
                                    .slice(0, 2)
                                    .join("")}
                                </div>
                                <b>
                                  {m?.full_name ||
                                    `Membership #${p.membership_id}`}
                                </b>
                              </div>
                            </td>
                            <td className="amount-cell">{money(p.amount)}</td>
                            <td>{dateLabel(p.payout_date)}</td>
                            <td>
                              <Badge
                                tone={
                                  p.status === "paid"
                                    ? "success"
                                    : p.status === "pending"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {p.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {!payouts.length && (
                  <Empty text="No payouts yet. Generate a fixed rotation schedule from a circle." />
                )}
              </div>
            </section>
          )}
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal("");
          }}
        >
          <form className="modal" onSubmit={save}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">ROSCA WORKSPACE</span>
                <h2>{modalTitle[modal]}</h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setModal("")}
              >
                <X size={18} />
              </button>
            </div>
            <p className="modal-intro">
              Enter the details below. Your record will be saved through the D4
              API.
            </p>
            {renderModalFields()}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setModal("")}
              >
                Cancel
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save record"} <ArrowUpRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Stat({ icon: Icon, label, value, note, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={19} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}
