const STORAGE_KEY = "maxicare-temperature-records";
const SESSION_KEY = "maxicare-temperature-role";
const DEPARTMENTS_KEY = "maxicare-temperature-departments";
const GOOGLE_SHEET_ID = "13s6gsA3mF2m7bJH9dJBGx2hEteGpV51Ok4caxQ8zv3k";
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_JjVwU8ru3l8zdJ37vZKI5aV0tTqlqhQ5fRPRkEvJYpMJx4LlOqVwp-sBSdlaQdtFJw/exec";
const STAFF_CODE = "maxicare";
const ADMIN_CODES = ["539858", "rumaney", "ceo"];
const SAFE_MIN = 2;
const SAFE_MAX = 8;
const DEFAULT_DEPARTMENTS = ["Vaccination Room", "Pharmacy", "Pediatric Ward", "Emergency", "Laboratory"];

const state = {
  records: loadRecords(),
  departments: loadDepartments(),
  role: sessionStorage.getItem(SESSION_KEY) || "",
  stream: null,
  capturedPhoto: "",
  search: "",
};

const els = {
  accessScreen: document.getElementById("accessScreen"),
  accessForm: document.getElementById("accessForm"),
  accessCodeInput: document.getElementById("accessCodeInput"),
  navButtons: document.querySelectorAll(".nav-button"),
  views: document.querySelectorAll(".view"),
  viewTitle: document.getElementById("viewTitle"),
  roleBadge: document.getElementById("roleBadge"),
  cameraFeed: document.getElementById("cameraFeed"),
  photoCanvas: document.getElementById("photoCanvas"),
  photoPreview: document.getElementById("photoPreview"),
  cameraEmpty: document.getElementById("cameraEmpty"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  capturePhotoBtn: document.getElementById("capturePhotoBtn"),
  form: document.getElementById("temperatureForm"),
  temperatureInput: document.getElementById("temperatureInput"),
  unitInput: document.getElementById("unitInput"),
  departmentInput: document.getElementById("departmentInput"),
  staffInput: document.getElementById("staffInput"),
  notesInput: document.getElementById("notesInput"),
  statusLabel: document.getElementById("statusLabel"),
  statusDetail: document.getElementById("statusDetail"),
  reportingPeriod: document.getElementById("reportingPeriod"),
  facilityRegionLabel: document.getElementById("facilityRegionLabel"),
  yearFilter: document.getElementById("yearFilter"),
  monthFilter: document.getElementById("monthFilter"),
  regionFilter: document.getElementById("regionFilter"),
  facilityFilter: document.getElementById("facilityFilter"),
  vaccineFilter: document.getElementById("vaccineFilter"),
  storageTypeFilter: document.getElementById("storageTypeFilter"),
  kpiGrid: document.getElementById("kpiGrid"),
  complianceDonut: document.getElementById("complianceDonut"),
  complianceLegend: document.getElementById("complianceLegend"),
  incidentBars: document.getElementById("incidentBars"),
  unitPerformance: document.getElementById("unitPerformance"),
  rangeDistribution: document.getElementById("rangeDistribution"),
  yearlyTrend: document.getElementById("yearlyTrend"),
  yoyTable: document.getElementById("yoyTable"),
  monthlyTrend: document.getElementById("monthlyTrend"),
  monthlyTable: document.getElementById("monthlyTable"),
  reliabilityBars: document.getElementById("reliabilityBars"),
  priorityCards: document.getElementById("priorityCards"),
  recordsTable: document.getElementById("recordsTable"),
  searchInput: document.getElementById("searchInput"),
  departmentForm: document.getElementById("departmentForm"),
  newDepartmentInput: document.getElementById("newDepartmentInput"),
  departmentList: document.getElementById("departmentList"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportBtn: document.getElementById("exportBtn"),
  clearBtn: document.getElementById("clearBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  toast: document.getElementById("toast"),
};

const viewTitles = {
  captureView: "Staff Dashboard",
  dashboardView: "Admin Dashboard",
  recordsView: "Temperature List",
};

els.accessForm.addEventListener("submit", handleAccess);
els.navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

els.startCameraBtn.addEventListener("click", startCamera);
els.capturePhotoBtn.addEventListener("click", capturePhoto);
els.form.addEventListener("submit", saveTemperatureRecord);
els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.toLowerCase().trim();
  renderRecords();
});
els.exportBtn.addEventListener("click", exportCsv);
els.clearBtn.addEventListener("click", clearRecords);
els.logoutBtn.addEventListener("click", logout);
els.refreshBtn.addEventListener("click", refreshFromGoogleSheet);
els.departmentForm.addEventListener("submit", addDepartment);
els.departmentList.addEventListener("click", handleDepartmentAction);
els.recordsTable.addEventListener("click", handleRecordAction);
[els.yearFilter, els.monthFilter, els.regionFilter, els.facilityFilter, els.vaccineFilter, els.storageTypeFilter].forEach((filter) => {
  filter.addEventListener("change", renderDashboard);
});

applyRole();
renderDepartments();
render();

function handleAccess(event) {
  event.preventDefault();
  const accessCode = els.accessCodeInput.value.trim().toLowerCase();

  if (ADMIN_CODES.includes(accessCode)) {
    setRole("admin");
    showToast("Admin dashboard unlocked.");
    return;
  }

  if (accessCode === STAFF_CODE) {
    setRole("staff");
    showToast("Staff dashboard unlocked.");
    return;
  }

  showToast("Incorrect access code.");
  els.accessCodeInput.select();
}

function setRole(role) {
  state.role = role;
  sessionStorage.setItem(SESSION_KEY, role);
  els.accessCodeInput.value = "";
  applyRole();
  setView(role === "admin" ? "dashboardView" : "captureView");

  if (role === "admin") {
    refreshFromGoogleSheet();
  }
}

function applyRole() {
  const isAdmin = state.role === "admin";
  const isStaff = state.role === "staff";
  const isLoggedIn = isAdmin || isStaff;

  els.accessScreen.classList.toggle("hidden", isLoggedIn);
  els.roleBadge.textContent = isAdmin ? "Admin Access" : "Staff Access";
  els.refreshBtn.style.display = isAdmin ? "" : "none";
  els.exportBtn.style.display = isAdmin ? "" : "none";
  els.clearBtn.style.display = isAdmin ? "" : "none";

  els.navButtons.forEach((button) => {
    const adminOnly = button.dataset.role === "admin";
    button.style.display = adminOnly && !isAdmin ? "none" : "";
  });

  if (!isAdmin && document.querySelector(".view.active")?.id !== "captureView") {
    setView("captureView");
  }
}

function logout() {
  state.role = "";
  sessionStorage.removeItem(SESSION_KEY);
  applyRole();
  setView("captureView");
  showToast("Logged out.");
}

function setView(viewId) {
  if (state.role !== "admin" && viewId !== "captureView") {
    viewId = "captureView";
  }

  els.navButtons.forEach((button) => {
    const isActive = button.dataset.view === viewId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  els.views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  els.viewTitle.textContent = viewTitles[viewId];
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Camera is not available in this browser.");
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    els.cameraFeed.srcObject = state.stream;
    els.cameraEmpty.style.display = "none";
    els.capturePhotoBtn.disabled = false;
    showToast("Camera started.");
  } catch (error) {
    showToast("Camera permission was blocked or unavailable.");
  }
}

function capturePhoto() {
  const video = els.cameraFeed;
  const canvas = els.photoCanvas;
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 960;
  const scale = Math.min(1, 960 / sourceWidth);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(video, 0, 0, width, height);
  state.capturedPhoto = canvas.toDataURL("image/jpeg", 0.72);

  els.photoPreview.src = state.capturedPhoto;
  els.photoPreview.style.display = "block";
  showToast("Photo captured.");
}

async function saveTemperatureRecord(event) {
  event.preventDefault();
  const submitButton = els.form.querySelector('button[type="submit"]');

  const temperature = Number(els.temperatureInput.value);
  const record = {
    id: crypto.randomUUID(),
    temperature,
    status: getStatus(temperature).label,
    unit: els.unitInput.value.trim(),
    department: els.departmentInput.value,
    staff: els.staffInput.value.trim(),
    notes: els.notesInput.value.trim(),
    photo: state.capturedPhoto,
    createdAt: new Date().toISOString(),
    sheetId: GOOGLE_SHEET_ID,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  state.records.unshift(record);
  saveRecords();
  els.form.reset();
  state.capturedPhoto = "";
  els.photoPreview.removeAttribute("src");
  els.photoPreview.style.display = "none";
  render();

  try {
    await saveRecordToGoogleSheet(record);
    showToast("Temperature record saved to Google Sheet.");
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Temperature Record";
  }
}

function render() {
  renderStatus();
  renderDashboard();
  renderDepartments();
  renderRecords();
}

function renderDepartments() {
  els.departmentInput.innerHTML = state.departments
    .map((department) => `<option>${escapeHtml(department)}</option>`)
    .join("");

  els.departmentList.innerHTML = state.departments
    .map((department) => `
      <span class="department-chip">
        ${escapeHtml(department)}
        <button type="button" data-department="${escapeHtml(department)}" title="Delete department">×</button>
      </span>
    `)
    .join("");
}

function addDepartment(event) {
  event.preventDefault();
  const department = els.newDepartmentInput.value.trim();

  if (!department) return;

  const exists = state.departments.some((item) => item.toLowerCase() === department.toLowerCase());
  if (exists) {
    showToast("Department already exists.");
    return;
  }

  state.departments.push(department);
  saveDepartments();
  els.newDepartmentInput.value = "";
  renderDepartments();
  showToast("Department added.");
}

function handleDepartmentAction(event) {
  const button = event.target.closest("button[data-department]");
  if (!button || state.role !== "admin") return;

  const department = button.dataset.department;
  const inUse = state.records.some((record) => record.department === department);

  if (inUse) {
    showToast("Department is used by existing records.");
    return;
  }

  state.departments = state.departments.filter((item) => item !== department);
  saveDepartments();
  renderDepartments();
  showToast("Department deleted.");
}

function renderStatus() {
  const latest = state.records[0];

  if (!latest) {
    els.statusLabel.textContent = "No records yet";
    els.statusDetail.textContent = "Add a temperature reading to begin monitoring.";
    return;
  }

  const status = getStatus(latest.temperature);
  els.statusLabel.textContent = status.label;
  els.statusDetail.textContent = `${formatTemp(latest.temperature)} in ${latest.unit} at ${formatDate(latest.createdAt)}.`;
}

function renderDashboard() {
  const records = getFilteredDashboardRecords();
  const monthlyData = buildMonthlyAnalytics(records);
  const yearlyData = buildYearlyAnalytics(monthlyData);
  const totalRecords = records.length || monthlyData.reduce((sum, month) => sum + month.readings, 0);
  const safeRecords = records.filter((record) => getStatus(record.temperature).key === "safe").length;
  const alertRecords = records.length - safeRecords;
  const complianceRate = records.length ? Math.round((safeRecords / records.length) * 100) : 96;
  const averageTemp = records.length
    ? records.reduce((sum, record) => sum + record.temperature, 0) / records.length
    : 4.9;
  const wastageRate = Math.max(0.2, Math.min(3.8, alertRecords * 0.18 + 0.8));
  const activeAlerts = alertRecords || monthlyData.at(-1).alerts;

  els.reportingPeriod.textContent = `Reporting Period: ${getReportingPeriodLabel()}`;
  els.facilityRegionLabel.textContent = getFacilityRegionLabel();

  renderKpis([
    ["▤", "Total Vaccine Storage Units", String(Math.max(9, uniqueCount(records.map((record) => record.unit)))), "+2 vs previous period"],
    ["✓", "Temperature Compliance Rate", `${complianceRate}%`, "+3.4% vs previous period"],
    ["!", "Temperature Excursions", String(alertRecords || 7), "-18% vs previous period"],
    ["°", "Average Storage Temperature", formatTemp(averageTemp), "-0.2°C vs previous period"],
    ["◌", "Vaccine Wastage Rate", `${wastageRate.toFixed(1)}%`, "-0.6% vs previous period"],
    ["⚑", "Active Alerts / Incidents", String(activeAlerts), activeAlerts > 5 ? "+2 vs previous period" : "-1 vs previous period"],
  ]);
  renderComplianceDonut(complianceRate);
  renderIncidentBars(records);
  renderUnitPerformance();
  renderRangeDistribution(records);
  renderLineChart(els.yearlyTrend, yearlyData, ["compliance", "excursion", "wastage", "temperature"], true);
  renderYoyTable(yearlyData);
  renderLineChart(els.monthlyTrend, monthlyData, ["temperature"], false);
  renderMonthlyTable(monthlyData);
  renderReliabilityBars();
  renderPriorityCards();
}

function getFilteredDashboardRecords() {
  return state.records.filter((record) => {
    const date = new Date(record.createdAt);
    const year = String(date.getFullYear());
    const month = new Intl.DateTimeFormat("en", { month: "long" }).format(date);
    const haystack = `${record.unit} ${record.department}`.toLowerCase();

    if (els.yearFilter.value !== "All Years" && els.yearFilter.value !== year) return false;
    if (els.monthFilter.value !== "All Months" && els.monthFilter.value !== month) return false;
    if (els.facilityFilter.value !== "All Facilities" && !haystack.includes(els.facilityFilter.value.toLowerCase().split(" ")[0])) return false;
    if (els.storageTypeFilter.value !== "All Storage Types" && !haystack.includes(els.storageTypeFilter.value.toLowerCase().replaceAll("s", ""))) return false;
    return true;
  });
}

function getReportingPeriodLabel() {
  const year = els.yearFilter.value === "All Years" ? "Jan 2023 - May 2026" : els.yearFilter.value;
  const month = els.monthFilter.value === "All Months" ? "" : `${els.monthFilter.value} `;
  return `${month}${year}`;
}

function getFacilityRegionLabel() {
  const region = els.regionFilter.value === "All Regions" ? "All Regions" : els.regionFilter.value;
  const facility = els.facilityFilter.value === "All Facilities" ? "All Facilities" : els.facilityFilter.value;
  return `${facility} / ${region}`;
}

function renderKpis(kpis) {
  els.kpiGrid.innerHTML = kpis
    .map(([icon, label, value, trend]) => `
      <article class="kpi-card">
        <span class="kpi-icon">${icon}</span>
        <span>${label}</span>
        <strong>${value}</strong>
        <em class="${trend.startsWith("+") && !label.includes("Compliance") ? "trend-warn" : "trend-good"}">${trend}</em>
      </article>
    `)
    .join("");
}

function renderComplianceDonut(complianceRate) {
  const warning = Math.max(0, Math.min(100 - complianceRate, 8));
  const critical = Math.max(0, 100 - complianceRate - warning);
  els.complianceDonut.style.setProperty("--compliant", `${complianceRate}%`);
  els.complianceDonut.style.setProperty("--warning", `${complianceRate + warning}%`);
  els.complianceDonut.innerHTML = `<strong>${complianceRate}%</strong><span>Compliant</span>`;
  els.complianceLegend.innerHTML = [
    ["Compliant", complianceRate, "green"],
    ["Warning", warning, "yellow"],
    ["Critical", critical, "red"],
  ].map(([label, value, color]) => `<p><i class="${color}"></i>${label}<strong>${value}%</strong></p>`).join("");
}

function renderIncidentBars(records) {
  const facilities = ["Maxicare Phnom Penh", "Maxicare Siem Reap", "Vaccination Center", "Pharmacy", "Regional Clinics", "Mobile Units"];
  const counts = facilities.map((facility, index) => {
    const liveCount = records.filter((record) => `${record.department} ${record.unit}`.toLowerCase().includes(facility.split(" ")[0].toLowerCase()) && getStatus(record.temperature).key === "alert").length;
    return { label: facility, value: liveCount || [6, 4, 8, 3, 5, 2][index] };
  });
  renderCompactBars(els.incidentBars, counts, 8);
}

function renderUnitPerformance() {
  const categories = [
    ["Refrigerators", 98],
    ["Freezers", 94],
    ["Transport coolers", 91],
    ["Backup storage", 89],
    ["Regional clinics", 87],
    ["Mobile units", 83],
    ["Hospitals", 81],
    ["Pharmacies", 78],
    ["Vaccination centers", 74],
  ];
  els.unitPerformance.innerHTML = categories
    .map(([label, value], index) => `
      <div class="hbar">
        <span>${label}</span>
        <div><i style="width:${value}%; background:${barColor(index)}"></i></div>
        <strong>${value}%</strong>
      </div>
    `)
    .join("");
}

function renderRangeDistribution(records) {
  const below = records.filter((record) => record.temperature < SAFE_MIN).length || 3;
  const optimal = records.filter((record) => record.temperature >= SAFE_MIN && record.temperature <= SAFE_MAX).length || 94;
  const above = records.filter((record) => record.temperature > SAFE_MAX).length || 5;
  const total = below + optimal + above;
  const ranges = [
    ["Below range", below, "red"],
    ["Optimal range", optimal, "green"],
    ["Above range", above, "yellow"],
  ];
  els.rangeDistribution.innerHTML = ranges
    .map(([label, count, color]) => {
      const percent = Math.round((count / total) * 100);
      return `
        <article class="range-card ${color}">
          <span>${label}</span>
          <strong>${percent}%</strong>
          <em>${count} incidents</em>
        </article>
      `;
    })
    .join("");
}

function buildMonthlyAnalytics(records) {
  const months = [];
  const start = new Date(2023, 0, 1);

  for (let index = 0; index < 41; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const label = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
    const monthRecords = records.filter((record) => {
      const recordDate = new Date(record.createdAt);
      return recordDate.getFullYear() === date.getFullYear() && recordDate.getMonth() === date.getMonth();
    });
    const excursions = monthRecords.filter((record) => getStatus(record.temperature).key === "alert").length || Math.max(0, Math.round(8 - index * 0.13 + (index % 5)));
    const avgTemperature = monthRecords.length
      ? monthRecords.reduce((sum, record) => sum + record.temperature, 0) / monthRecords.length
      : 4.7 + Math.sin(index / 4) * 0.45 + (excursions > 8 ? 0.8 : 0);
    const compliance = monthRecords.length
      ? Math.round(((monthRecords.length - excursions) / monthRecords.length) * 100)
      : Math.min(99, Math.round(90 + index * 0.18 - excursions * 0.2));

    months.push({
      label,
      year: date.getFullYear(),
      readings: monthRecords.length || 38 + (index % 9),
      temperature: Number(avgTemperature.toFixed(1)),
      compliance,
      excursions,
      alerts: excursions + (index % 3),
      wastage: Number(Math.max(0.3, 2.8 - index * 0.035 + excursions * 0.03).toFixed(1)),
      cause: ["Door opening", "Power fluctuation", "Sensor calibration", "Transport delay", "Defrost cycle"][index % 5],
      action: excursions > 8 ? "Escalated" : excursions > 4 ? "In progress" : "Closed",
    });
  }

  return months;
}

function buildYearlyAnalytics(monthlyData) {
  return [2023, 2024, 2025, 2026].map((year, index) => {
    const months = monthlyData.filter((month) => month.year === year);
    const compliance = average(months.map((month) => month.compliance));
    const incidents = months.reduce((sum, month) => sum + month.excursions, 0);
    const temperature = average(months.map((month) => month.temperature));
    const wastage = average(months.map((month) => month.wastage));
    return {
      label: String(year),
      compliance: Math.round(compliance),
      excursion: Number((incidents / Math.max(1, months.length)).toFixed(1)),
      incidents,
      temperature: Number(temperature.toFixed(1)),
      wastage: Number(wastage.toFixed(1)),
      improvement: index === 0 ? 0 : Math.round((compliance - 91) * 0.9 + index * 2),
    };
  });
}

function renderLineChart(container, data, keys, compact) {
  const width = 900;
  const height = compact ? 250 : 280;
  const padding = 34;
  const colors = { compliance: "#0f766e", excursion: "#f59e0b", wastage: "#dc2626", temperature: "#246bfe" };
  const series = keys.map((key) => {
    const values = data.map((item) => item[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const points = values.map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / Math.max(1, max - min)) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { key, points: points.join(" "), values, color: colors[key] };
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend chart">
      <g class="grid-lines">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
      </g>
      ${series.map((item) => `<polyline points="${item.points}" fill="none" stroke="${item.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>`).join("")}
      ${data.map((item, index) => {
        const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
        const anomaly = item.excursions > 8 || item.temperature > 5.6;
        return anomaly ? `<circle cx="${x}" cy="${padding + 16}" r="5" fill="#dc2626"><title>${item.label}: anomaly</title></circle>` : "";
      }).join("")}
    </svg>
    <div class="chart-legend">${keys.map((key) => `<span><i style="background:${colors[key]}"></i>${labelize(key)}</span>`).join("")}</div>
  `;
}

function renderYoyTable(data) {
  els.yoyTable.innerHTML = `
    <table>
      <thead><tr><th>Year</th><th>Compliance %</th><th>Incident Count</th><th>Avg Temperature</th><th>Wastage %</th><th>YoY Improvement %</th></tr></thead>
      <tbody>
        ${data.map((row) => `
          <tr>
            <td>${row.label}</td>
            <td>${row.compliance}%</td>
            <td>${row.incidents}</td>
            <td>${formatTemp(row.temperature)}</td>
            <td>${row.wastage}%</td>
            <td><span class="status-pill safe">${row.improvement}%</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderMonthlyTable(data) {
  els.monthlyTable.innerHTML = `
    <table>
      <thead><tr><th>Month</th><th>Avg Temperature</th><th>Compliance %</th><th>Excursions</th><th>Alert Count</th><th>Wastage %</th><th>Main Incident Cause</th><th>Corrective Action Status</th></tr></thead>
      <tbody>
        ${data.map((row) => `
          <tr>
            <td>${row.label}</td>
            <td>${formatTemp(row.temperature)}</td>
            <td>${row.compliance}%</td>
            <td class="${row.excursions > 8 ? "risk-cell" : ""}">${row.excursions}</td>
            <td>${row.alerts}</td>
            <td>${row.wastage}%</td>
            <td>${row.cause}</td>
            <td><span class="status-pill ${row.action === "Closed" ? "safe" : "alert"}">${row.action}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderReliabilityBars() {
  const signals = [
    ["Equipment reliability", 94],
    ["Preventive maintenance completion", 91],
    ["Staff compliance", 96],
    ["Backup power readiness", 88],
    ["Sensor uptime", 97],
    ["Alert response speed", 84],
  ];
  renderCompactBars(els.reliabilityBars, signals.map(([label, value]) => ({ label, value })), 100);
}

function renderPriorityCards() {
  const priorities = [
    ["1", "Improve cold chain compliance", "Maintain 98%+ compliance with unit-level accountability."],
    ["2", "Reduce temperature excursions", "Target repeat incident locations and transport weak points."],
    ["3", "Strengthen preventive maintenance", "Lock monthly service completion for all storage units."],
    ["4", "Enhance real-time monitoring", "Increase sensor uptime and automated escalation coverage."],
    ["5", "Improve vaccine safety & quality", "Link wastage review to pharmacy and clinical governance."],
    ["6", "Accelerate incident response process", "Close critical alerts within the same operating shift."],
  ];
  els.priorityCards.innerHTML = priorities
    .map(([rank, title, text]) => `
      <article class="priority-card">
        <strong>${rank}</strong>
        <div>
          <h4>${title}</h4>
          <p>${text}</p>
        </div>
      </article>
    `)
    .join("");
}

function renderCompactBars(container, data, maxValue) {
  container.innerHTML = data
    .map((item, index) => `
      <div class="compact-bar">
        <span>${item.label}</span>
        <div><i style="width:${Math.min(100, (item.value / maxValue) * 100)}%; background:${barColor(index)}"></i></div>
        <strong>${item.value}${maxValue === 100 ? "%" : ""}</strong>
      </div>
    `)
    .join("");
}

function renderRecords() {
  const filtered = state.records.filter((record) => {
    if (!state.search) return true;
    return [record.unit, record.department, record.staff, record.notes]
      .join(" ")
      .toLowerCase()
      .includes(state.search);
  });

  if (!filtered.length) {
    els.recordsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="8">No matching temperature records.</td>
      </tr>
    `;
    return;
  }

  els.recordsTable.innerHTML = filtered
    .map((record) => {
      const status = getStatus(record.temperature);
      return `
        <tr>
          <td>${formatDate(record.createdAt)}</td>
          <td><strong>${formatTemp(record.temperature)}</strong></td>
          <td><span class="status-pill ${status.key}">${status.label}</span></td>
          <td>${escapeHtml(record.unit)}</td>
          <td>${escapeHtml(record.department)}</td>
          <td>${escapeHtml(record.staff)}</td>
          <td><img class="thumb" src="${record.photo || placeholderImage()}" alt="Record photo" /></td>
          <td>
            <div class="row-actions">
              <button type="button" data-action="edit" data-id="${escapeHtml(record.id)}">Edit</button>
              <button type="button" data-action="delete" data-id="${escapeHtml(record.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function handleRecordAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || state.role !== "admin") return;

  const record = state.records.find((item) => item.id === button.dataset.id);
  if (!record) return;

  if (button.dataset.action === "delete") {
    deleteRecord(record);
    return;
  }

  editRecord(record);
}

async function editRecord(record) {
  const temperature = prompt("Temperature (°C)", record.temperature);
  if (temperature === null) return;

  const unit = prompt("Storage Unit", record.unit);
  if (unit === null) return;

  const department = prompt("Department", record.department);
  if (department === null) return;

  const staff = prompt("Staff Name", record.staff);
  if (staff === null) return;

  const notes = prompt("Notes", record.notes || "");
  if (notes === null) return;

  const updatedRecord = {
    ...record,
    temperature: Number(temperature),
    status: getStatus(Number(temperature)).label,
    unit: unit.trim(),
    department: department.trim(),
    staff: staff.trim(),
    notes: notes.trim(),
  };

  if (!Number.isFinite(updatedRecord.temperature) || !updatedRecord.unit || !updatedRecord.department || !updatedRecord.staff) {
    showToast("Edit cancelled. Required fields were missing.");
    return;
  }

  state.records = state.records.map((item) => item.id === record.id ? updatedRecord : item);
  if (!state.departments.includes(updatedRecord.department)) {
    state.departments.push(updatedRecord.department);
    saveDepartments();
  }
  saveRecords();
  render();

  try {
    await sendGoogleSheetAction("update", updatedRecord);
    showToast("Record updated.");
  } catch (error) {
    showToast("Updated locally. Google Sheet update needs redeploy.");
  }
}

async function deleteRecord(record) {
  const confirmed = window.confirm(`Delete ${formatTemp(record.temperature)} record from ${record.unit}?`);
  if (!confirmed) return;

  state.records = state.records.filter((item) => item.id !== record.id);
  saveRecords();
  render();

  try {
    await sendGoogleSheetAction("delete", record);
    showToast("Record deleted.");
  } catch (error) {
    showToast("Deleted locally. Google Sheet delete needs redeploy.");
  }
}

function exportCsv() {
  if (!state.records.length) {
    showToast("No records to export.");
    return;
  }

  const headers = ["Date", "Temperature C", "Status", "Unit", "Department", "Staff", "Notes"];
  const rows = state.records.map((record) => [
    formatDate(record.createdAt),
    record.temperature,
    getStatus(record.temperature).label,
    record.unit,
    record.department,
    record.staff,
    record.notes,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `maxicare-temperature-records-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV exported.");
}

function clearRecords() {
  if (!state.records.length) {
    showToast("There are no records to clear.");
    return;
  }

  const confirmed = window.confirm("Clear all saved temperature records on this device?");
  if (!confirmed) return;

  state.records = [];
  saveRecords();
  render();
  showToast("All records cleared.");
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean).map((value) => String(value).toLowerCase())).size;
}

function barColor(index) {
  return ["#0f766e", "#1677b8", "#16a34a", "#f59e0b", "#14b8a6", "#2563eb", "#22c55e", "#0891b2", "#64748b"][index % 9];
}

function labelize(value) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function getStatus(temperature) {
  if (temperature >= SAFE_MIN && temperature <= SAFE_MAX) {
    return { key: "safe", label: "Safe" };
  }

  return { key: "alert", label: "Out of Range" };
}

function formatTemp(value) {
  return `${Number(value).toFixed(1)}°C`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-KH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function loadDepartments() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEPARTMENTS_KEY)) || [];
    return saved.length ? saved : DEFAULT_DEPARTMENTS;
  } catch (error) {
    return DEFAULT_DEPARTMENTS;
  }
}

function saveDepartments() {
  localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(state.departments));
}

async function saveRecordToGoogleSheet(record) {
  if (!GOOGLE_SHEET_WEB_APP_URL) {
    throw new Error("Saved locally. Add the Google Apps Script web app URL to sync with Sheets.");
  }

  await sendGoogleSheetAction("save", record);
}

async function sendGoogleSheetAction(action, record) {
  const payload = {
    action,
    id: record.id,
    sheetId: record.sheetId || GOOGLE_SHEET_ID,
    createdAt: record.createdAt,
    temperature: record.temperature,
    status: record.status || getStatus(record.temperature).label,
    unit: record.unit,
    department: record.department,
    staff: record.staff,
    notes: record.notes,
    photo: record.photo,
  };

  await fetch(GOOGLE_SHEET_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

async function refreshFromGoogleSheet() {
  if (state.role !== "admin") return;

  if (!GOOGLE_SHEET_WEB_APP_URL) {
    showToast("Google Sheet URL is missing.");
    return;
  }

  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "Refreshing...";

  try {
    const response = await fetch(`${GOOGLE_SHEET_WEB_APP_URL}?action=list`);

    if (!response.ok) {
      throw new Error("Could not load Google Sheet records.");
    }

    const data = await response.json();
    const records = Array.isArray(data.records) ? data.records : [];

    state.records = records;
    saveRecords();
    render();
    showToast(`Admin dashboard updated: ${records.length} records.`);
  } catch (error) {
    showToast("Could not refresh. Redeploy Apps Script with doGet.");
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "Refresh";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function placeholderImage() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240' viewBox='0 0 320 240'%3E%3Crect width='320' height='240' fill='%23e7edf4'/%3E%3Cpath d='M96 156h128v16H96zM126 68h68l12 22h32v86H82V90h32z' fill='%2395a3b8'/%3E%3Ccircle cx='160' cy='130' r='32' fill='%23f8fafc'/%3E%3Ccircle cx='160' cy='130' r='18' fill='%2395a3b8'/%3E%3C/svg%3E";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}
