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

  // === ADMIN PASSWORD (GANTI INI) ===
  const ADMIN_PASSWORD = "12345";

  // ================= HELPERS =================
  const pad2 = (n) => String(n).padStart(2, "0");
  const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const fmtKg = (x) => (Number.isFinite(x) ? x.toFixed(2) : "0.00");
  const fmtRp = (x) => Math.round(x || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const normalizeVeg = (s) => (s || "").trim().replace(/\s+/g, " ");
  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function totals(records) {
    let kg = 0;
    for (const r of records) kg += Number(r.kg) || 0;
    return { kg, rp: kg * RATE_PER_KG };
  }

  function groupBy(arr, keyFn) {
    const m = new Map();
    for (const x of arr) {
      const k = keyFn(x);
      const a = m.get(k) || [];
      a.push(x);
      m.set(k, a);
    }
    return m;
  }

  // key aman untuk dataset (tanpa __ yang rawan)
  const packKey = (date, veg, supplier) =>
    `${encodeURIComponent(date)}|${encodeURIComponent(veg)}|${encodeURIComponent(supplier)}`;
  const unpackKey = (k) => {
    const [a, b, c] = String(k || "").split("|");
    return [decodeURIComponent(a || ""), decodeURIComponent(b || ""), decodeURIComponent(c || "")];
  };

  // ================= STORAGE =================
  const keyDraft = (ym) => `rekap_draft:${ym}`;
  const keyFinal = (ym) => `rekap_final:${ym}`; // final per bulan

  function loadDraft(ym) {
    try { return JSON.parse(localStorage.getItem(keyDraft(ym)) || "[]"); } catch { return []; }
  }
  function saveDraft(ym, records) {
    localStorage.setItem(keyDraft(ym), JSON.stringify(records));
  }
  function loadFinal(ym) {
    try { return JSON.parse(localStorage.getItem(keyFinal(ym)) || "[]"); } catch { return []; }
  }
  function saveFinal(ym, records) {
    localStorage.setItem(keyFinal(ym), JSON.stringify(records));
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
  const dateVegHead = document.getElementById("dateVegHead");

  const rateLabel = document.getElementById("rateLabel");
  const globalStatusPill = document.getElementById("globalStatusPill");
  const allHeaderPill = document.getElementById("allHeaderPill");
  const allDetailTitle = document.getElementById("allDetailTitle");
  const allDetailSub = document.getElementById("allDetailSub");

  // modal edit draft
  const editModal = document.getElementById("editModal");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnSaveEdit = document.getElementById("btnSaveEdit");
  const editInfo = document.getElementById("editInfo");
  const editDate = document.getElementById("editDate");
  const editVeg = document.getElementById("editVeg");
  const editSupplier = document.getElementById("editSupplier");
  const editDistrict = document.getElementById("editDistrict");
  const editKg = document.getElementById("editKg");

  // export
  const btnExportExcel = document.getElementById("btnExportExcel");
  const btnExportPDF = document.getElementById("btnExportPDF");

  // admin
  const btnAdmin = document.getElementById("btnAdmin");
  const adminPill = document.getElementById("adminPill");

  // ================= NAV =================
  const menuBtns = Array.from(document.querySelectorAll(".menuBtn"));
  function showPage(id) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
  }
  menuBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      menuBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showPage(btn.dataset.page);
      renderAll();
    });
  });

  // ================= DEFAULT =================
  function getDefaultMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }
  function getDefaultDate() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function ensureDateMatchesMonth(ym) {
    if (!ym) return;
    if (!dateInput.value) {
      dateInput.value = `${ym}-01`;
      return;
    }
    if (dateInput.value.slice(0, 7) !== ym) {
      dateInput.value = `${ym}-01`;
    }
  }

  // ================= FILL SELECTS =================
  function fillSelect(el, items) {
    if (!el) return;
    el.innerHTML = "";
    for (const s of items) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      el.appendChild(o);
    }
  }

  // ================= ADMIN =================
  let isAdmin = sessionStorage.getItem("rekap_admin") === "1";
  function setAdmin(val) {
    isAdmin = !!val;
    sessionStorage.setItem("rekap_admin", isAdmin ? "1" : "0");
    if (adminPill) adminPill.textContent = isAdmin ? "ADMIN: ON" : "ADMIN: OFF";
    if (btnAdmin) btnAdmin.textContent = isAdmin ? "Admin (Logout)" : "Admin (Login)";
    renderAll(); // refresh aksi columns
  }

  // ================= DRAFT RENDER =================
  function renderDashboard() {
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
      records.length === 0 ? `Belum ada data draft bulan ${ym}.` : `${records.length} data draft bulan ${ym}.`;

    recentTbody.innerHTML = "";

    const sorted = records.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const r of sorted) {
      const kg = Number(r.kg) || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${escapeHtml(r.veg)}</td>
        <td>${escapeHtml(r.supplier)}</td>
        <td>${escapeHtml(r.district)}</td>
        <td class="num">${fmtKg(kg)}</td>
        <td class="num">Rp ${fmtRp(kg * RATE_PER_KG)}</td>
        <td class="num">
          <button class="ghost" data-act="edit" data-id="${r.id}">✏️</button>
          <button class="danger" data-act="del" data-id="${r.id}">🗑</button>
        </td>
      `;
      recentTbody.appendChild(tr);
    }

    recentTbody.onclick = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (!id) return;
      if (act === "del") deleteDraft(id);
      if (act === "edit") openEditModal(id);
    };
  }

  // ================= DRAFT CRUD =================
  function validateDraftInput() {
    const ym = monthInput.value;
    if (!ym) return "Bulan wajib diisi.";
    if (!dateInput.value) return "Tanggal wajib diisi.";
    if (dateInput.value.slice(0, 7) !== ym) return `Tanggal harus berada di bulan ${ym}.`;

    const veg = vegInput.value.trim();
    if (!veg) return "Nama sayur wajib diisi.";
    if (!supplierInput.value) return "Supplier wajib dipilih.";
    if (!districtInput.value) return "Kecamatan wajib dipilih.";

    const kg = Number(kgOrderInput.value);
    if (!Number.isFinite(kg) || kg <= 0) return "Kg harus angka > 0.";
    return null;
  }

  function addRecord() {
    const err = validateDraftInput();
    if (err) return alert(err);

    const ym = monthInput.value;
    const records = loadDraft(ym);

    records.push({
      id: uid(),
      month: ym,
      date: dateInput.value,
      veg: normalizeVeg(vegInput.value),
      supplier: supplierInput.value,
      district: districtInput.value,
      kg: Number(kgOrderInput.value),
      createdAt: new Date().toISOString(),
    });

    saveDraft(ym, records);
    vegInput.value = "";
    kgOrderInput.value = "";
    renderAll();
  }

  function deleteDraft(id) {
    const ym = monthInput.value;
    const records = loadDraft(ym).filter((r) => r.id !== id);
    saveDraft(ym, records);
    renderAll();
  }

  function clearDraft() {
    const ym = monthInput.value;
    if (confirm(`Hapus draft bulan ${ym}?`)) {
      localStorage.removeItem(keyDraft(ym));
      renderAll();
    }
  }

  function saveMonthFinal() {
    const ym = monthInput.value;
    const draft = loadDraft(ym);
    if (draft.length === 0) return alert("Draft kosong.");

    // FINAL bulan ini ditimpa agar rapi
    saveFinal(ym, draft.map((d) => ({ ...d, month: ym })));
    localStorage.removeItem(keyDraft(ym));

    alert(`Data bulan ${ym} disimpan ke FINAL.`);
    renderAll();
  }

  // ================= EDIT MODAL (DRAFT) =================
  let editingId = null;

  function openEditModal(id) {
    if (!editModal) return alert("Modal edit tidak ada di HTML.");
    const ym = monthInput.value;
    const records = loadDraft(ym);
    const r = records.find((x) => x.id === id);
    if (!r) return;

    editingId = id;
    editInfo.textContent = "";

    editDate.value = r.date;
    editVeg.value = r.veg || "";
    fillSelect(editSupplier, SUPPLIERS);
    fillSelect(editDistrict, DISTRICTS);
    editSupplier.value = r.supplier || SUPPLIERS[0];
    editDistrict.value = r.district || DISTRICTS[0];
    editKg.value = Number(r.kg || 0);

    editModal.style.display = "flex";
  }

  function closeEditModal() {
    if (!editModal) return;
    editModal.style.display = "none";
    editingId = null;
  }

  function saveEdit() {
    const ym = monthInput.value;
    if (!ym || !editingId) return;

    if (!editDate.value) return (editInfo.textContent = "Tanggal wajib diisi.");
    if (editDate.value.slice(0, 7) !== ym) return (editInfo.textContent = `Tanggal harus di bulan ${ym}.`);

    const kg = Number(editKg.value);
    if (!Number.isFinite(kg) || kg <= 0) return (editInfo.textContent = "Kg harus > 0.");

    const veg = editVeg.value.trim();
    if (!veg) return (editInfo.textContent = "Nama sayur wajib.");

    const records = loadDraft(ym);
    const idx = records.findIndex((r) => r.id === editingId);
    if (idx < 0) return;

    records[idx] = {
      ...records[idx],
      date: editDate.value,
      veg: normalizeVeg(veg),
      supplier: editSupplier.value,
      district: editDistrict.value,
      kg: kg,
    };

    saveDraft(ym, records);
    closeEditModal();
    renderAll();
  }

  // ================= FINAL RENDER (SEMUA DATA) =================
  let activeDistrict = DISTRICTS[0];

  function renderDistrictChips() {
    if (!districtButtons) return;
    districtButtons.innerHTML = "";
    for (const d of DISTRICTS) {
      const chip = document.createElement("button");
      chip.className = "chip" + (activeDistrict === d ? " active" : "");
      chip.textContent = d;
      chip.onclick = () => {
        activeDistrict = d;
        renderDistrictChips();
        renderAllDistrictDetail();
      };
      districtButtons.appendChild(chip);
    }
  }

  function renderAllDistrictDetail() {
    const ym = monthInput.value;
    const final = loadFinal(ym);

    if (allHeaderPill) allHeaderPill.textContent = `Bulan aktif: ${ym}`;
    if (allDetailTitle) allDetailTitle.textContent = `Rincian Kecamatan: ${activeDistrict}`;
    if (allDetailSub) allDetailSub.textContent = `Data FINAL bulan ${ym} untuk kecamatan ${activeDistrict}.`;

    const distRecords = final.filter((r) => r.district === activeDistrict);
    const t = totals(distRecords);
    if (allTotalsPill) allTotalsPill.textContent = `Total: ${fmtKg(t.kg)} kg → Rp ${fmtRp(t.rp)}`;

    // === ringkasan per sayur
    vegSummaryTbody.innerHTML = "";
    const byVeg = groupBy(distRecords, (r) => r.veg);
    const vegs = Array.from(byVeg.keys()).sort((a, b) => a.localeCompare(b));

    if (distRecords.length === 0) {
      vegSummaryTbody.innerHTML = `<tr><td colspan="3" class="muted">Belum ada FINAL untuk kecamatan ini.</td></tr>`;
    } else {
      for (const v of vegs) {
        const list = byVeg.get(v) || [];
        let kg = 0;
        for (const it of list) kg += Number(it.kg) || 0;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(v)}</td>
          <td class="num">${fmtKg(kg)}</td>
          <td class="num">Rp ${fmtRp(kg * RATE_PER_KG)}</td>
        `;
        vegSummaryTbody.appendChild(tr);
      }
    }

    // === detail per tanggal+sayur+supplier (digabung)
    dateVegTbody.innerHTML = "";

    // header: admin ON tambah kolom aksi
    if (dateVegHead) {
      dateVegHead.innerHTML = `
        <th>Tanggal</th>
        <th>Sayur</th>
        <th>Supplier</th>
        <th class="num">Kg</th>
        <th class="num">Nominal</th>
        ${isAdmin ? `<th class="num">Aksi</th>` : ``}
      `;
    }

    if (distRecords.length === 0) {
      dateVegTbody.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}" class="muted">Belum ada FINAL untuk kecamatan ini.</td></tr>`;
      dateVegTbody.onclick = null;
      return;
    }

    const byKey = new Map();
    for (const r of distRecords) {
      const key = packKey(r.date, r.veg, r.supplier);
      byKey.set(key, (byKey.get(key) || 0) + (Number(r.kg) || 0));
    }

    const rows = Array.from(byKey.entries())
      .map(([k, kg]) => {
        const [date, veg, supplier] = unpackKey(k);
        return { key: k, date, veg, supplier, kg };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.veg.localeCompare(b.veg) || a.supplier.localeCompare(b.supplier));

    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${escapeHtml(row.veg)}</td>
        <td>${escapeHtml(row.supplier)}</td>
        <td class="num">${fmtKg(row.kg)}</td>
        <td class="num">Rp ${fmtRp(row.kg * RATE_PER_KG)}</td>
        ${isAdmin ? `
          <td class="num">
            <button class="ghost" data-act="fedit" data-key="${row.key}">✏️</button>
            <button class="danger" data-act="fdel" data-key="${row.key}">🗑</button>
          </td>
        ` : ``}
      `;
      dateVegTbody.appendChild(tr);
    }

    // klik aksi final
    if (isAdmin) {
      dateVegTbody.onclick = (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const act = btn.dataset.act;
        const key = btn.dataset.key;
        if (!act || !key) return;
        if (act === "fdel") deleteFinalGroup(key);
        if (act === "fedit") editFinalGroup(key);
      };
    } else {
      dateVegTbody.onclick = null;
    }
  }

  // ================= FINAL ADMIN ACTIONS =================
  function deleteFinalGroup(key) {
    const ym = monthInput.value;
    const final = loadFinal(ym);
    const [date, veg, supplier] = unpackKey(key);

    const ok = confirm(`Hapus FINAL?\n${date} | ${veg} | ${supplier}\nKecamatan: ${activeDistrict}`);
    if (!ok) return;

    const filtered = final.filter(
      (r) => !(r.month === ym && r.district === activeDistrict && r.date === date && r.veg === veg && r.supplier === supplier)
    );

    saveFinal(ym, filtered);
    renderAll();
  }

  function editFinalGroup(key) {
    const ym = monthInput.value;
    const final = loadFinal(ym);
    const [date, veg, supplier] = unpackKey(key);

    const group = final.filter(
      (r) => (r.month === ym && r.district === activeDistrict && r.date === date && r.veg === veg && r.supplier === supplier)
    );
    if (group.length === 0) return;

    const totalKg = group.reduce((a, b) => a + (Number(b.kg) || 0), 0);

    const newKgStr = prompt(
      `Edit KG FINAL:\n${date} | ${veg} | ${supplier}\nKecamatan: ${activeDistrict}\n\nKg sekarang: ${fmtKg(totalKg)}\nIsi Kg baru:`,
      fmtKg(totalKg)
    );
    if (newKgStr === null) return;

    const newKg = Number(newKgStr);
    if (!Number.isFinite(newKg) || newKg <= 0) {
      alert("Kg harus angka > 0.");
      return;
    }

    // hapus group lama, masukin 1 record gabungan
    const filtered = final.filter(
      (r) => !(r.month === ym && r.district === activeDistrict && r.date === date && r.veg === veg && r.supplier === supplier)
    );

    filtered.push({
      id: uid(),
      month: ym,
      date,
      veg,
      supplier,
      district: activeDistrict,
      kg: newKg,
      createdAt: new Date().toISOString(),
    });

    saveFinal(ym, filtered);
    renderAll();
  }

  // ================= EXPORT (FINAL) =================
  function exportExcelFinal() {
    const ym = monthInput.value;
    const records = loadFinal(ym);

    const rows = records.map((r) => {
      const kg = Number(r.kg) || 0;
      return {
        Bulan: ym,
        Tanggal: r.date,
        Kecamatan: r.district,
        Sayur: r.veg,
        Supplier: r.supplier,
        Kg: kg,
        Tarif: RATE_PER_KG,
        "Nominal (Rp)": kg * RATE_PER_KG,
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
      "Nominal (Rp)": t.rp,
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Rekap FINAL");
    XLSX.writeFile(wb, `rekap-sayur-final-${ym}.xlsx`);
  }

  function exportPDFFinal() {
    const ym = monthInput.value;
    const records = loadFinal(ym);
    const t = totals(records);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    doc.setFontSize(16);
    doc.text(`Rekap Sayur FINAL - ${ym}`, 40, 44);
    doc.setFontSize(11);
    doc.text(`Tarif: Rp ${fmtRp(RATE_PER_KG)} / Kg`, 40, 66);
    doc.text(`Total Kg: ${fmtKg(t.kg)} | Total Rp: Rp ${fmtRp(t.rp)}`, 40, 84);

    const head = [["Tanggal", "Kecamatan", "Sayur", "Supplier", "Kg", "Nominal"]];
    const body = records
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((r) => {
        const kg = Number(r.kg) || 0;
        return [r.date, r.district, r.veg, r.supplier, fmtKg(kg), `Rp ${fmtRp(kg * RATE_PER_KG)}`];
      });

    doc.autoTable({
      head,
      body,
      startY: 105,
      styles: { fontSize: 9, cellPadding: 4 },
      theme: "grid",
      margin: { left: 40, right: 40 },
    });

    doc.save(`rekap-sayur-final-${ym}.pdf`);
  }

  // ================= INIT =================
  function init() {
    monthInput.value = monthInput.value || getDefaultMonth();
    dateInput.value = dateInput.value || getDefaultDate();
    ensureDateMatchesMonth(monthInput.value);

    fillSelect(supplierInput, SUPPLIERS);
    fillSelect(districtInput, DISTRICTS);
    supplierInput.value = SUPPLIERS[0];
    districtInput.value = DISTRICTS[0];

    if (rateLabel) rateLabel.textContent = `Rp ${fmtRp(RATE_PER_KG)}`;
    if (globalStatusPill) globalStatusPill.textContent = `DRAFT/FINAL • ${monthInput.value}`;

    monthInput.addEventListener("change", () => {
      ensureDateMatchesMonth(monthInput.value);
      if (globalStatusPill) globalStatusPill.textContent = `DRAFT/FINAL • ${monthInput.value}`;
      renderAll();
    });

    dateInput.addEventListener("change", () => {
      ensureDateMatchesMonth(monthInput.value);
      renderAll();
    });

    btnAdd.onclick = addRecord;
    btnReset.onclick = () => {
      vegInput.value = "";
      kgOrderInput.value = "";
      supplierInput.value = SUPPLIERS[0];
      districtInput.value = DISTRICTS[0];
    };

    btnSaveMonth.onclick = saveMonthFinal;
    btnClearMonth.onclick = clearDraft;

    // modal draft
    if (btnCloseModal) btnCloseModal.onclick = closeEditModal;
    if (btnSaveEdit) btnSaveEdit.onclick = saveEdit;
    if (editModal) editModal.addEventListener("click", (e) => { if (e.target === editModal) closeEditModal(); });

    // export
    if (btnExportExcel) btnExportExcel.onclick = exportExcelFinal;
    if (btnExportPDF) btnExportPDF.onclick = exportPDFFinal;

    // admin
    if (btnAdmin) {
      btnAdmin.onclick = () => {
        if (isAdmin) return setAdmin(false);
        const pass = prompt("Masukkan password admin:");
        if (pass === null) return;
        if (pass === ADMIN_PASSWORD) setAdmin(true);
        else alert("Password salah.");
      };
    }
    setAdmin(isAdmin); // set awal

    activeDistrict = DISTRICTS[0];

    renderAll();
    showPage("pageDashboard");
  }

  function renderAll() {
    renderDashboard();
    renderDistrictChips();
    renderAllDistrictDetail();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
