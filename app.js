(() => {
  // ================= CONFIG =================
  const DISTRICTS = ["krai", "bades", "kunir", "wonorejo", "randuagung", "petahunan"];
  const SUPPLIERS = [
    "ud kabinet maju bersama",
    "rasyad sayur",
    "ud bah karim",
    "aneka sayur",
    "ifan sayur",
  ];
  const RATE_PER_KG = 300;

  // ================= HELPERS =================
  const pad2 = n => String(n).padStart(2, "0");
  const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const fmtKg = x => Number.isFinite(x) ? x.toFixed(2) : "0.00";
  const fmtRp = x => Math.round(x || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const normalizeVeg = s => (s || "").trim().replace(/\s+/g, " ");
  const escapeHtml = s => String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  function totals(records){
    let kg = 0;
    records.forEach(r => kg += Number(r.kg) || 0);
    return { kg, rp: kg * RATE_PER_KG };
  }

  // ================= STORAGE =================
  function loadDraft(ym){
    return JSON.parse(localStorage.getItem(`rekap_draft:${ym}`) || "[]");
  }
  function saveDraft(ym, records){
    localStorage.setItem(`rekap_draft:${ym}`, JSON.stringify(records));
  }

  function loadFinal(){
    return JSON.parse(localStorage.getItem("rekap_final") || "[]");
  }
  function saveFinal(records){
    localStorage.setItem("rekap_final", JSON.stringify(records));
  }

  // ================= DOM =================
  const monthInput = document.getElementById("monthInput");
  const dateInput = document.getElementById("dateInput");
  const vegInput = document.getElementById("vegInput");
  const supplierInput = document.getElementById("supplierInput");
  const districtInput = document.getElementById("districtInput");
  const kgOrderInput = document.getElementById("kgOrderInput");

  const btnAdd = document.getElementById("btnAdd");
  const btnReset = document.getElementById("btnReset");
  const btnSaveMonth = document.getElementById("btnSaveMonth");
  const btnClearMonth = document.getElementById("btnClearMonth");

  const stats = document.getElementById("stats");
  const recordCount = document.getElementById("recordCount");
  const recentTbody = document.querySelector("#recentTable tbody");

  const districtButtons = document.getElementById("districtButtons");
  const allTotalsPill = document.getElementById("allTotalsPill");
  const vegSummaryTbody = document.querySelector("#vegSummaryTable tbody");
  const dateVegTbody = document.querySelector("#dateVegTable tbody");

  // ================= DEFAULT =================
  function getDefaultMonth(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  }

  function getDefaultDate(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  // ================= RENDER DASHBOARD (DRAFT) =================
  function renderDashboard(){
    const ym = monthInput.value;
    const records = loadDraft(ym);
    const t = totals(records);

    stats.innerHTML = `
      <div class="stat"><div class="k">Total Kg</div><div class="v">${fmtKg(t.kg)}</div></div>
      <div class="stat"><div class="k">Total Rp</div><div class="v">Rp ${fmtRp(t.rp)}</div></div>
      <div class="stat"><div class="k">Tarif</div><div class="v">Rp ${fmtRp(RATE_PER_KG)}/Kg</div></div>
      <div class="stat"><div class="k">Jumlah Baris</div><div class="v">${records.length}</div></div>
    `;

    recordCount.textContent =
      records.length === 0
        ? `Belum ada data draft bulan ${ym}.`
        : `${records.length} data draft bulan ${ym}.`;

    recentTbody.innerHTML = "";
    records.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${escapeHtml(r.veg)}</td>
        <td>${escapeHtml(r.supplier)}</td>
        <td>${escapeHtml(r.district)}</td>
        <td class="num">${fmtKg(r.kg)}</td>
        <td class="num">Rp ${fmtRp(r.kg * RATE_PER_KG)}</td>
        <td class="num">
          <button class="danger" data-id="${r.id}">🗑</button>
        </td>
      `;
      recentTbody.appendChild(tr);
    });

    recentTbody.onclick = e => {
      const btn = e.target.closest("button");
      if(!btn) return;
      deleteDraft(btn.dataset.id);
    };
  }

  // ================= CRUD DRAFT =================
  function addRecord(){
    const ym = monthInput.value;
    const records = loadDraft(ym);

    records.push({
      id: uid(),
      date: dateInput.value,
      veg: normalizeVeg(vegInput.value),
      supplier: supplierInput.value,
      district: districtInput.value,
      kg: Number(kgOrderInput.value)
    });

    saveDraft(ym, records);
    renderAll();
    vegInput.value = "";
    kgOrderInput.value = "";
  }

  function deleteDraft(id){
    const ym = monthInput.value;
    const records = loadDraft(ym).filter(r => r.id !== id);
    saveDraft(ym, records);
    renderAll();
  }

  function saveMonthFinal(){
    const ym = monthInput.value;
    const draft = loadDraft(ym);
    if(draft.length === 0) return alert("Draft kosong.");

    const final = loadFinal();
    draft.forEach(d => final.push({ ...d, month: ym }));
    saveFinal(final);
    localStorage.removeItem(`rekap_draft:${ym}`);

    alert(`Data bulan ${ym} disimpan.`);
    renderAll();
  }

  function clearDraft(){
    const ym = monthInput.value;
    if(confirm(`Hapus draft bulan ${ym}?`)){
      localStorage.removeItem(`rekap_draft:${ym}`);
      renderAll();
    }
  }

  // ================= RENDER FINAL =================
  function renderAllDistrictDetail(){
    const ym = monthInput.value;
    const records = loadFinal().filter(r => r.month === ym);
    const t = totals(records);
    allTotalsPill.textContent = `Total: ${fmtKg(t.kg)} kg → Rp ${fmtRp(t.rp)}`;

    vegSummaryTbody.innerHTML = "";
    dateVegTbody.innerHTML = "";

    records.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${escapeHtml(r.veg)}</td>
        <td>${escapeHtml(r.supplier)}</td>
        <td class="num">${fmtKg(r.kg)}</td>
        <td class="num">Rp ${fmtRp(r.kg * RATE_PER_KG)}</td>
      `;
      dateVegTbody.appendChild(tr);
    });
  }

  function renderAll(){
    renderDashboard();
    renderAllDistrictDetail();
  }

  // ================= INIT =================
  function init(){
    monthInput.value = getDefaultMonth();
    dateInput.value = getDefaultDate();

    SUPPLIERS.forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s;
      supplierInput.appendChild(o);
    });
    DISTRICTS.forEach(d => {
      const o = document.createElement("option");
      o.value = d; o.textContent = d;
      districtInput.appendChild(o);
    });

    btnAdd.onclick = addRecord;
    btnReset.onclick = () => { vegInput.value=""; kgOrderInput.value=""; };
    btnSaveMonth.onclick = saveMonthFinal;
    btnClearMonth.onclick = clearDraft;

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
