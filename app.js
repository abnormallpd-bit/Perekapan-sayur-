(() => {
  const DISTRICTS = ["krai", "bades", "kunir", "wonorejo", "randuagung", "petahunan"];
  const SUPPLIERS = [
    "ud kabinet maju bersama",
    "rasyad sayur",
    "ud bah karim",
    "aneka sayur",
    "ifan sayur",
  ];
  const RATE_PER_KG = 300;

  // ===== Helpers =====
  const pad2 = (n)=>String(n).padStart(2,"0");
  const fmtKg = (x)=> (Number.isFinite(x) ? x.toFixed(2) : "0.00");
  const fmtRp = (x)=> {
    if(!Number.isFinite(x)) return "0";
    return Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
  const uid = ()=> `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const normalizeVeg = (s)=> (s||"").trim().replace(/\s+/g," ");
  const escapeHtml = (s)=> String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  // key storage (final5)
  const monthKey = (ym)=> `rekap_sayur_final5:${ym}`;
  const lockKey  = (ym)=> `rekap_sayur_final5_lock:${ym}`;

  function loadMonth(ym){
    const raw = localStorage.getItem(monthKey(ym));
    try{ return raw ? JSON.parse(raw) : []; }catch{ return []; }
  }
  function saveMonth(ym, records){
    localStorage.setItem(monthKey(ym), JSON.stringify(records));
  }
  function isLocked(ym){ return localStorage.getItem(lockKey(ym)) === "1"; }
  function setLocked(ym, locked){ localStorage.setItem(lockKey(ym), locked ? "1" : "0"); }

  function totals(records){
    let kg=0;
    for(const r of records) kg += (Number(r.kg)||0);
    return { kg, rp: kg * RATE_PER_KG };
  }

  function groupBy(arr, keyFn){
    const m = new Map();
    for(const x of arr){
      const k = keyFn(x);
      const a = m.get(k) || [];
      a.push(x);
      m.set(k, a);
    }
    return m;
  }

  // ===== NAV =====
  const menuBtns = Array.from(document.querySelectorAll(".menuBtn"));
  function showPage(id){
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
  }
  menuBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      menuBtns.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      showPage(btn.dataset.page);
      renderAll();
    });
  });

  // ===== DOM =====
  const monthInput = document.getElementById("monthInput");
  const dateInput = document.getElementById("dateInput");

  const btnLockMonth = document.getElementById("btnLockMonth");
  const btnUnlockMonth = document.getElementById("btnUnlockMonth");
  const monthStatus = document.getElementById("monthStatus");
  const globalStatusPill = document.getElementById("globalStatusPill");
  const rateLabel = document.getElementById("rateLabel");

  const vegInput = document.getElementById("vegInput");
  const supplierInput = document.getElementById("supplierInput");
  const districtInput = document.getElementById("districtInput");
  const kgOrderInput = document.getElementById("kgOrderInput");
  const btnAdd = document.getElementById("btnAdd");
  const btnReset = document.getElementById("btnReset");
  const formInfo = document.getElementById("formInfo");

  const stats = document.getElementById("stats");
  const recordCount = document.getElementById("recordCount");
  const btnClearMonth = document.getElementById("btnClearMonth");
  const recentTbody = document.querySelector("#recentTable tbody");

  const districtButtons = document.getElementById("districtButtons");
  const allHeaderPill = document.getElementById("allHeaderPill");
  const allDetailTitle = document.getElementById("allDetailTitle");
  const allDetailSub = document.getElementById("allDetailSub");
  const allTotalsPill = document.getElementById("allTotalsPill");
  const vegSummaryTbody = document.querySelector("#vegSummaryTable tbody");
  const dateVegTbody = document.querySelector("#dateVegTable tbody");

  const btnExportExcel = document.getElementById("btnExportExcel");
  const btnExportPDF = document.getElementById("btnExportPDF");

  // modal edit
  const editModal = document.getElementById("editModal");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnSaveEdit = document.getElementById("btnSaveEdit");
  const editInfo = document.getElementById("editInfo");
  const editDate = document.getElementById("editDate");
  const editVeg = document.getElementById("editVeg");
  const editSupplier = document.getElementById("editSupplier");
  const editDistrict = document.getElementById("editDistrict");
  const editKg = document.getElementById("editKg");

  // ===== Guard (biar gak blank kalau ada id salah) =====
  function guardDom(){
    const must = {monthInput,dateInput,supplierInput,districtInput,vegInput,kgOrderInput,recentTbody};
    for(const [k,v] of Object.entries(must)){
      if(!v){
        console.error("DOM missing:", k);
        alert("Ada elemen HTML yang tidak ketemu. Cek id di index.html.");
        return false;
      }
    }
    return true;
  }

  // ===== Dropdown fillers =====
  function fillSupplierOptions(){
    supplierInput.innerHTML = "";
    for(const s of SUPPLIERS){
      const o = document.createElement("option");
      o.value=s; o.textContent=s;
      supplierInput.appendChild(o);
    }
  }
  function fillDistrictOptions(){
    districtInput.innerHTML = "";
    for(const d of DISTRICTS){
      const o = document.createElement("option");
      o.value=d; o.textContent=d;
      districtInput.appendChild(o);
    }
  }
  function fillEditOptions(){
    editSupplier.innerHTML = "";
    for(const s of SUPPLIERS){
      const o = document.createElement("option");
      o.value=s; o.textContent=s;
      editSupplier.appendChild(o);
    }
    editDistrict.innerHTML = "";
    for(const d of DISTRICTS){
      const o = document.createElement("option");
      o.value=d; o.textContent=d;
      editDistrict.appendChild(o);
    }
  }

  // ===== State =====
  let activeDistrict = DISTRICTS[0];
  let editingId = null;

  // ===== Defaults =====
  function getDefaultMonth(){
    const n = new Date();
    return `${n.getFullYear()}-${pad2(n.getMonth()+1)}`;
  }
  function getDefaultDate(){
    const n = new Date();
    return `${n.getFullYear()}-${pad2(n.getMonth()+1)}-${pad2(n.getDate())}`;
  }

  function ensureDateMatchesMonth(monthValue){
    if(!monthValue) return;
    if(!dateInput.value){
      dateInput.value = `${monthValue}-01`;
      return;
    }
    if(dateInput.value.slice(0,7) !== monthValue){
      dateInput.value = `${monthValue}-01`;
    }
  }

  function setMessage(msg, type="muted"){
    formInfo.textContent = msg || "";
    if(type==="good") formInfo.style.color = "var(--good)";
    else if(type==="warn") formInfo.style.color = "var(--warn)";
    else formInfo.style.color = "var(--muted)";
  }

  // ===== Validation =====
  function validateInput(){
    const ym = monthInput.value;
    if(!ym) return "Bulan wajib diisi.";
    if(isLocked(ym)) return "Bulan terkunci. Buka kunci dulu.";
    if(!dateInput.value) return "Tanggal wajib diisi.";
    if(dateInput.value.slice(0,7) !== ym) return `Tanggal harus berada di bulan ${ym}.`;

    if(!vegInput.value.trim()) return "Nama sayur wajib diisi.";
    if(!supplierInput.value) return "Supplier wajib dipilih.";
    if(!districtInput.value) return "Kecamatan wajib dipilih.";

    const kg = Number(kgOrderInput.value);
    if(!Number.isFinite(kg) || kg<=0) return "Kg harus angka > 0.";
    return null;
  }

  // ===== Render =====
  function renderHeaderStatus(){
    const ym = monthInput.value;
    rateLabel.textContent = `Rp ${fmtRp(RATE_PER_KG)}`;

    if(!ym){
      monthStatus.innerHTML = `Isi bulan dulu.`;
      globalStatusPill.textContent = "Bulan belum diisi";
      return;
    }

    const locked = isLocked(ym);
    monthStatus.innerHTML = locked
      ? `Status: <b style="color:var(--warn)">TERKUNCI</b> — data bulan ${ym} tidak bisa diubah.`
      : `Status: <b style="color:var(--good)">TERBUKA</b> — data bulan ${ym} bisa ditambah/edit/hapus.`;

    globalStatusPill.textContent = locked ? `TERKUNCI • ${ym}` : `TERBUKA • ${ym}`;
    btnAdd.disabled = locked;
    btnClearMonth.disabled = locked;
  }

  function renderDashboard(){
    const ym = monthInput.value || getDefaultMonth();
    const records = loadMonth(ym);

    const t = totals(records);
    stats.innerHTML = `
      <div class="stat"><div class="k">Total Kg</div><div class="v">${fmtKg(t.kg)}</div></div>
      <div class="stat"><div class="k">Total Rp</div><div class="v">Rp ${fmtRp(t.rp)}</div></div>
      <div class="stat"><div class="k">Tarif</div><div class="v">Rp ${fmtRp(RATE_PER_KG)}/Kg</div></div>
      <div class="stat"><div class="k">Jumlah Baris</div><div class="v">${records.length}</div></div>
    `;

    recordCount.textContent = `${records.length} baris data tersimpan di bulan ${ym}. Menampilkan 20 data terakhir.`;

    const sorted = records.slice().sort((a,b)=>
      (b.date||"").localeCompare(a.date||"") ||
      (b.createdAt||"").localeCompare(a.createdAt||"")
    );
    const recent = sorted.slice(0,20);

    recentTbody.innerHTML = "";
    for(const r of recent){
      const kg = Number(r.kg)||0;
      const nominal = kg * RATE_PER_KG;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${escapeHtml(r.veg)}</td>
        <td>${escapeHtml(r.supplier || "-")}</td>
        <td>${escapeHtml(r.district)}</td>
        <td class="num">${fmtKg(kg)}</td>
        <td class="num">Rp ${fmtRp(nominal)}</td>
        <td class="num">
          <button class="ghost" data-act="edit" data-id="${r.id}">✏️</button>
          <button class="danger" data-act="del" data-id="${r.id}">🗑</button>
        </td>
      `;
      recentTbody.appendChild(tr);
    }

    // event delegation (sekali aja)
    recentTbody.onclick = (e)=>{
      const btn = e.target.closest("button");
      if(!btn) return;
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      if(!id || !act) return;

      if(act==="edit") openEditModal(id);
      if(act==="del") deleteRecord(id);
    };
  }

  function renderDistrictChips(){
    districtButtons.innerHTML = "";
    for(const d of DISTRICTS){
      const chip = document.createElement("button");
      chip.className = "chip" + (activeDistrict===d ? " active" : "");
      chip.textContent = d;
      chip.addEventListener("click", ()=>{
        activeDistrict = d;
        renderDistrictChips();
        renderAllDistrictDetail();
      });
      districtButtons.appendChild(chip);
    }
  }

  function renderAllDistrictDetail(){
    const ym = monthInput.value || getDefaultMonth();
    const records = loadMonth(ym);

    allHeaderPill.textContent = `Bulan aktif: ${ym}`;
    allDetailTitle.textContent = `Rincian Kecamatan: ${activeDistrict}`;
    allDetailSub.textContent = `Menampilkan semua tanggal & semua sayur untuk ${activeDistrict} (bulan ${ym}).`;

    const distRecords = records.filter(r=>r.district===activeDistrict);

    const t = totals(distRecords);
    allTotalsPill.textContent = `Total: ${fmtKg(t.kg)} kg → Rp ${fmtRp(t.rp)}`;

    // ringkasan per sayur
    const byVeg = groupBy(distRecords, r=>r.veg);
    const vegs = Array.from(byVeg.keys()).sort((a,b)=>a.localeCompare(b));

    vegSummaryTbody.innerHTML = "";
    for(const v of vegs){
      const list = byVeg.get(v) || [];
      let kg = 0;
      for(const it of list) kg += (Number(it.kg)||0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(v)}</td>
        <td class="num">${fmtKg(kg)}</td>
        <td class="num">Rp ${fmtRp(kg * RATE_PER_KG)}</td>
      `;
      vegSummaryTbody.appendChild(tr);
    }

    // detail: date + veg + supplier
    const byKey = new Map();
    for(const r of distRecords){
      const sup = r.supplier || "-";
      const key = `${r.date}__${r.veg}__${sup}`;
      byKey.set(key, (byKey.get(key)||0) + (Number(r.kg)||0));
    }

    const rows = Array.from(byKey.entries()).map(([key,kg])=>{
      const [date,veg,supplier] = key.split("__");
      return {date,veg,supplier,kg};
    }).sort((a,b)=>
      a.date.localeCompare(b.date) ||
      a.veg.localeCompare(b.veg) ||
      a.supplier.localeCompare(b.supplier)
    );

    dateVegTbody.innerHTML = "";
    for(const row of rows){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${escapeHtml(row.veg)}</td>
        <td>${escapeHtml(row.supplier)}</td>
        <td class="num">${fmtKg(row.kg)}</td>
        <td class="num">Rp ${fmtRp(row.kg * RATE_PER_KG)}</td>
      `;
      dateVegTbody.appendChild(tr);
    }

    if(distRecords.length === 0){
      vegSummaryTbody.innerHTML = `<tr><td colspan="3" class="muted">Belum ada data untuk kecamatan ini.</td></tr>`;
      dateVegTbody.innerHTML = `<tr><td colspan="5" class="muted">Belum ada data untuk kecamatan ini.</td></tr>`;
    }
  }

  function renderAll(){
    renderHeaderStatus();
    renderDashboard();
    renderDistrictChips();
    renderAllDistrictDetail();
  }

  // ===== CRUD =====
  function addRecord(){
    const err = validateInput();
    if(err) return setMessage(err, "warn");

    const ym = monthInput.value;
    const records = loadMonth(ym);

    const district = districtInput.value;

    records.push({
      id: uid(),
      date: dateInput.value,
      district,
      veg: normalizeVeg(vegInput.value),
      supplier: supplierInput.value,
      kg: Number(kgOrderInput.value),
      createdAt: new Date().toISOString()
    });

    saveMonth(ym, records);
    setMessage("Data ditambahkan.", "good");

    activeDistrict = district;
    renderAll();

    vegInput.value = "";
    kgOrderInput.value = "";
    vegInput.focus();
  }

  function resetForm(){
    vegInput.value = "";
    kgOrderInput.value = "";
    supplierInput.value = SUPPLIERS[0];
    districtInput.value = DISTRICTS[0];
    setMessage("");
  }

  function clearMonth(){
    const ym = monthInput.value;
    if(!ym) return;
    if(isLocked(ym)) return;

    const ok = confirm(`Yakin hapus semua data bulan ${ym}?`);
    if(!ok) return;

    saveMonth(ym, []);
    renderAll();
  }

  function deleteRecord(id){
    const ym = monthInput.value;
    if(!ym) return;
    if(isLocked(ym)) return alert("Bulan terkunci. Tidak bisa hapus.");

    const records = loadMonth(ym);
    const idx = records.findIndex(r=>r.id===id);
    if(idx < 0) return;

    const ok = confirm("Yakin hapus baris ini?");
    if(!ok) return;

    records.splice(idx, 1);
    saveMonth(ym, records);
    renderAll();
  }

  function openEditModal(id){
    const ym = monthInput.value;
    if(!ym) return;
    if(isLocked(ym)) return alert("Bulan terkunci. Tidak bisa edit.");

    const records = loadMonth(ym);
    const r = records.find(x=>x.id===id);
    if(!r) return;

    editingId = id;
    editInfo.textContent = "";

    editDate.value = r.date;
    editVeg.value = r.veg || "";
    editSupplier.value = r.supplier || SUPPLIERS[0];
    editDistrict.value = r.district || DISTRICTS[0];
    editKg.value = Number(r.kg || 0);

    editModal.style.display = "flex";
  }

  function closeEditModal(){
    editModal.style.display = "none";
    editingId = null;
  }

  function saveEdit(){
    const ym = monthInput.value;
    if(!ym || !editingId) return;

    if(!editDate.value){
      editInfo.textContent = "Tanggal wajib diisi.";
      editInfo.style.color = "var(--warn)";
      return;
    }
    if(editDate.value.slice(0,7) !== ym){
      editInfo.textContent = `Tanggal harus berada di bulan ${ym}.`;
      editInfo.style.color = "var(--warn)";
      return;
    }

    const kg = Number(editKg.value);
    if(!Number.isFinite(kg) || kg<=0){
      editInfo.textContent = "Kg harus angka > 0.";
      editInfo.style.color = "var(--warn)";
      return;
    }

    const veg = editVeg.value.trim();
    if(!veg){
      editInfo.textContent = "Nama sayur wajib diisi.";
      editInfo.style.color = "var(--warn)";
      return;
    }

    const records = loadMonth(ym);
    const idx = records.findIndex(r=>r.id===editingId);
    if(idx < 0) return;

    records[idx] = {
      ...records[idx],
      date: editDate.value,
      veg: normalizeVeg(veg),
      supplier: editSupplier.value,
      district: editDistrict.value,
      kg: kg
    };

    saveMonth(ym, records);
    closeEditModal();
    renderAll();
  }

  // ===== Lock/Unlock =====
  function lockMonth(){
    const ym = monthInput.value;
    if(!ym) return alert("Isi bulan dulu.");
    const ok = confirm(`Kunci bulan ${ym}? Setelah dikunci, data tidak bisa diubah.`);
    if(!ok) return;
    setLocked(ym, true);
    renderHeaderStatus();
  }

  function unlockMonth(){
    const ym = monthInput.value;
    if(!ym) return alert("Isi bulan dulu.");
    const ok = confirm(`Buka kunci bulan ${ym}?`);
    if(!ok) return;
    setLocked(ym, false);
    renderHeaderStatus();
  }

  // ===== Export =====
  function exportExcel(){
    const ym = monthInput.value;
    if(!ym) return alert("Pilih bulan dulu di Beranda/Input.");

    const records = loadMonth(ym).slice().sort((a,b)=>
      (a.date||"").localeCompare(b.date||"") ||
      (a.district||"").localeCompare(b.district||"") ||
      (a.veg||"").localeCompare(b.veg||"") ||
      ((a.supplier||"").localeCompare(b.supplier||""))
    );

    const rows = records.map(r=>{
      const kg = Number(r.kg)||0;
      return {
        Bulan: ym,
        Tanggal: r.date,
        Kecamatan: r.district,
        Sayur: r.veg,
        Supplier: r.supplier || "-",
        Kg: kg,
        Tarif: RATE_PER_KG,
        "Nominal (Rp)": kg * RATE_PER_KG
      };
    });

    const t = totals(records);
    rows.push({
      Bulan: ym,
      Tanggal: "",
      Kecamatan: "TOTAL",
      Sayur: "",
      Supplier: "",
      Kg: t.kg,
      Tarif: RATE_PER_KG,
      "Nominal (Rp)": t.rp
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, `rekap-sayur-${ym}.xlsx`);
  }

  function exportPDF(){
    const ym = monthInput.value;
    if(!ym) return alert("Pilih bulan dulu di Beranda/Input.");

    const records = loadMonth(ym).slice().sort((a,b)=>
      (a.date||"").localeCompare(b.date||"") ||
      (a.district||"").localeCompare(b.district||"") ||
      (a.veg||"").localeCompare(b.veg||"") ||
      ((a.supplier||"").localeCompare(b.supplier||""))
    );
    const t = totals(records);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:"portrait", unit:"pt", format:"a4" });

    doc.setFontSize(16);
    doc.text(`Rekap Sayur Bulanan - ${ym}`, 40, 44);
    doc.setFontSize(11);
    doc.text(`Tarif: Rp ${fmtRp(RATE_PER_KG)} / Kg`, 40, 66);
    doc.text(`Total Kg: ${fmtKg(t.kg)} | Total Rp: Rp ${fmtRp(t.rp)}`, 40, 84);

    const head = [["Tanggal","Kecamatan","Sayur","Supplier","Kg","Nominal (Rp)"]];
    const body = records.map(r=>{
      const kg = Number(r.kg)||0;
      return [r.date, r.district, r.veg, (r.supplier||"-"), fmtKg(kg), fmtRp(kg * RATE_PER_KG)];
    });

    doc.autoTable({
      head,
      body,
      startY:105,
      styles:{ fontSize:9, cellPadding:4 },
      theme:"grid",
      margin:{ left:40, right:40 }
    });

    doc.autoTable({
      head:[["TOTAL","","","","Total Kg","Total Rp"]],
      body:[["","","","", fmtKg(t.kg), fmtRp(t.rp)]],
      startY: doc.lastAutoTable.finalY + 14,
      styles:{ fontSize:10, cellPadding:4 },
      theme:"grid",
      margin:{ left:40, right:40 }
    });

    doc.save(`rekap-sayur-${ym}.pdf`);
  }

  // ===== Init =====
  function init(){
    if(!guardDom()) return;

    rateLabel.textContent = `Rp ${fmtRp(RATE_PER_KG)}`;

    fillSupplierOptions();
    fillDistrictOptions();
    fillEditOptions();

    // defaults yang selalu jalan
    const m = getDefaultMonth();
    const d = getDefaultDate();
    monthInput.value = m;
    dateInput.value = d;
    ensureDateMatchesMonth(monthInput.value);

    supplierInput.value = SUPPLIERS[0];
    districtInput.value = DISTRICTS[0];
    activeDistrict = DISTRICTS[0];

    monthInput.addEventListener("change", ()=>{
      ensureDateMatchesMonth(monthInput.value);
      renderAll();
    });
    dateInput.addEventListener("change", ()=>{
      ensureDateMatchesMonth(monthInput.value);
      renderAll();
    });

    btnAdd.addEventListener("click", addRecord);
    btnReset.addEventListener("click", resetForm);
    btnClearMonth.addEventListener("click", clearMonth);

    btnLockMonth.addEventListener("click", lockMonth);
    btnUnlockMonth.addEventListener("click", unlockMonth);

    btnExportExcel.addEventListener("click", exportExcel);
    btnExportPDF.addEventListener("click", exportPDF);

    btnCloseModal.addEventListener("click", closeEditModal);
    btnSaveEdit.addEventListener("click", saveEdit);
    editModal.addEventListener("click", (e)=>{ if(e.target===editModal) closeEditModal(); });

    renderAll();
    showPage("pageDashboard");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
