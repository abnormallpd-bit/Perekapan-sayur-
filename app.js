(() => {

const DISTRICTS = ["krai","bades","kunir","wonorejo","randuagung","petahunan"];
const SUPPLIERS = [
"ud kabinet maju bersama",
"rasyad sayur",
"ud bah karim",
"aneka sayur",
"ifan sayur"
];
const RATE = 300;

const $ = id => document.getElementById(id);

function fmtKg(x){ return Number(x||0).toFixed(2); }
function fmtRp(x){ return "Rp "+Math.round(x||0).toLocaleString(); }
function uid(){ return Date.now()+"_"+Math.random().toString(16).slice(2); }

function loadDraft(m){ return JSON.parse(localStorage.getItem("draft_"+m)||"[]"); }
function saveDraft(m,d){ localStorage.setItem("draft_"+m,JSON.stringify(d)); }

function loadFinal(){ return JSON.parse(localStorage.getItem("final_data")||"[]"); }
function saveFinal(d){ localStorage.setItem("final_data",JSON.stringify(d)); }

function renderDraft(){
const m=$("monthInput").value;
const data=loadDraft(m);
const tb=$("draftTable");
tb.innerHTML="";
let total=0;

data.forEach(r=>{
total+=Number(r.kg)||0;
tb.innerHTML+=`
<tr>
<td>${r.date}</td>
<td>${r.veg}</td>
<td>${r.supplier}</td>
<td>${r.district}</td>
<td class="num">${fmtKg(r.kg)}</td>
<td class="num">${fmtRp(r.kg*RATE)}</td>
<td><button data-id="${r.id}">❌</button></td>
</tr>`;
});

$("draftInfo").textContent=data.length
? `${data.length} data | ${fmtKg(total)} Kg`
: "Belum ada data.";
}

function renderFinal(){
const tb=$("finalTable");
tb.innerHTML="";
$("finalTotal").textContent="Pilih kecamatan";
}

let activeDistrict=null;

function renderFinalFiltered(){
const data=loadFinal().filter(r=>r.district===activeDistrict);
const tb=$("finalTable");
tb.innerHTML="";
let total=0;

data.forEach(r=>{
total+=Number(r.kg)||0;
tb.innerHTML+=`
<tr>
<td>${r.date}</td>
<td>${r.veg}</td>
<td>${r.supplier}</td>
<td>${r.district}</td>
<td class="num">${fmtKg(r.kg)}</td>
<td class="num">${fmtRp(r.kg*RATE)}</td>
</tr>`;
});

$("finalTotal").textContent=
`Kecamatan ${activeDistrict} | ${fmtKg(total)} Kg | ${fmtRp(total*RATE)}`;
}

function renderDistrictButtons(){
const wrap=$("districtButtons");
wrap.innerHTML="";
DISTRICTS.forEach(d=>{
const b=document.createElement("button");
b.className="chip"+(activeDistrict===d?" active":"");
b.textContent=d;
b.onclick=()=>{
activeDistrict=d;
renderDistrictButtons();
renderFinalFiltered();
};
wrap.appendChild(b);
});
}

function init(){
const now=new Date();
$("monthInput").value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
$("dateInput").value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

SUPPLIERS.forEach(s=>{
const o=document.createElement("option");
o.value=s;o.textContent=s;
$("supplierInput").appendChild(o);
});

DISTRICTS.forEach(d=>{
const o=document.createElement("option");
o.value=d;o.textContent=d;
$("districtInput").appendChild(o);
});

$("btnAdd").onclick=()=>{
const m=$("monthInput").value;
const data=loadDraft(m);
data.push({
id:uid(),
date:$("dateInput").value,
veg:$("vegInput").value,
supplier:$("supplierInput").value,
district:$("districtInput").value,
kg:Number($("kgInput").value)
});
saveDraft(m,data);
renderDraft();
};

$("draftTable").onclick=e=>{
if(e.target.tagName==="BUTTON"){
const m=$("monthInput").value;
const id=e.target.dataset.id;
const data=loadDraft(m).filter(r=>r.id!==id);
saveDraft(m,data);
renderDraft();
}
};

$("btnSaveMonth").onclick=()=>{
const m=$("monthInput").value;
const draft=loadDraft(m);
if(!draft.length) return alert("Draft kosong");
const final=loadFinal();
draft.forEach(d=>final.push({...d,month:m}));
saveFinal(final);
localStorage.removeItem("draft_"+m);
renderDraft();
};

document.querySelectorAll(".menuBtn").forEach(btn=>{
btn.onclick=()=>{
document.querySelectorAll(".menuBtn").forEach(b=>b.classList.remove("active"));
btn.classList.add("active");
document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
document.getElementById(btn.dataset.page).classList.add("active");
};
});

renderDraft();
renderDistrictButtons();
renderFinal();
}

document.addEventListener("DOMContentLoaded",init);
})();
