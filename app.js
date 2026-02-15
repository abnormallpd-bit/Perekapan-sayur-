(() => {
  const RATE = 300;
  const SUPPLIERS = ["ud kabinet maju bersama","rasyad sayur","ud bah karim","aneka sayur","ifan sayur"];
  const DISTRICTS = ["krai","bades","kunir","wonorejo","randuagung","petahunan"];

  const $ = id => document.getElementById(id);
  const uid = () => Date.now()+"_"+Math.random().toString(16).slice(2);

  const loadDraft = ym => JSON.parse(localStorage.getItem("draft:"+ym) || "[]");
  const saveDraft = (ym,d) => localStorage.setItem("draft:"+ym, JSON.stringify(d));
  const loadFinal = () => JSON.parse(localStorage.getItem("final") || "[]");
  const saveFinal = d => localStorage.setItem("final", JSON.stringify(d));

  function totals(arr){
    const kg = arr.reduce((s,r)=>s+Number(r.kg||0),0);
    return {kg, rp:kg*RATE};
  }

  function renderDashboard(){
    const ym = $("monthInput").value;
    const data = loadDraft(ym);
    const t = totals(data);

    $("stats").innerHTML = `
      <div class="stat"><div class="k">Total Kg</div><div class="v">${t.kg.toFixed(2)}</div></div>
      <div class="stat"><div class="k">Total Rp</div><div class="v">Rp ${t.rp.toLocaleString()}</div></div>
      <div class="stat"><div class="k">Tarif</div><div class="v">Rp ${RATE}/Kg</div></div>
      <div class="stat"><div class="k">Jumlah Baris</div><div class="v">${data.length}</div></div>
    `;

    $("recordCount").textContent =
      data.length ? `${data.length} data draft` : "Belum ada data";

    const tb = $("recentTable").querySelector("tbody");
    tb.innerHTML = "";
    data.forEach(r=>{
      tb.innerHTML += `
        <tr>
          <td>${r.date}</td>
          <td>${r.veg}</td>
          <td>${r.supplier}</td>
          <td>${r.district}</td>
          <td class="num">${r.kg}</td>
          <td class="num">Rp ${(r.kg*RATE).toLocaleString()}</td>
          <td class="num"><button data-id="${r.id}">🗑</button></td>
        </tr>`;
    });

    tb.onclick = e=>{
      if(!e.target.dataset.id) return;
      saveDraft(ym, data.filter(x=>x.id!==e.target.dataset.id));
      renderAll();
    };
  }

  function renderAllData(){
    const tb = $("allTable").querySelector("tbody");
    tb.innerHTML = "";
    loadFinal().forEach(r=>{
      tb.innerHTML += `
        <tr>
          <td>${r.month}</td>
          <td>${r.date}</td>
          <td>${r.veg}</td>
          <td>${r.supplier}</td>
          <td>${r.district}</td>
          <td class="num">${r.kg}</td>
          <td class="num">Rp ${(r.kg*RATE).toLocaleString()}</td>
        </tr>`;
    });
  }

  function renderAll(){
    renderDashboard();
    renderAllData();
  }

  function init(){
    const d=new Date();
    $("monthInput").value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    $("dateInput").value=d.toISOString().slice(0,10);

    SUPPLIERS.forEach(s=>$("supplierInput").append(new Option(s,s)));
    DISTRICTS.forEach(d=>$("districtInput").append(new Option(d,d)));

    $("btnAdd").onclick=()=>{
      const ym=$("monthInput").value;
      const data=loadDraft(ym);
      data.push({
        id:uid(),
        date:$("dateInput").value,
        veg:$("vegInput").value,
        supplier:$("supplierInput").value,
        district:$("districtInput").value,
        kg:Number($("kgOrderInput").value)
      });
      saveDraft(ym,data);
      renderAll();
    };

    $("btnSaveMonth").onclick=()=>{
      const ym=$("monthInput").value;
      const draft=loadDraft(ym);
      if(!draft.length) return alert("Draft kosong");
      const final=loadFinal();
      draft.forEach(d=>final.push({...d,month:ym}));
      saveFinal(final);
      localStorage.removeItem("draft:"+ym);
      renderAll();
    };

    $("btnClearMonth").onclick=()=>{
      if(confirm("Hapus draft?")){
        localStorage.removeItem("draft:"+$("monthInput").value);
        renderAll();
      }
    };

    // NAV
    document.querySelectorAll(".menuBtn").forEach(btn=>{
      btn.onclick=()=>{
        document.querySelectorAll(".menuBtn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
        document.getElementById(btn.dataset.page).classList.add("active");
      };
    });

    renderAll();
  }

  document.addEventListener("DOMContentLoaded",init);
})();
