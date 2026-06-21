/* =========================================================
   سجل المكتب — منطق التطبيق
   تخزين محلي بالكامل (localStorage) — لا حاجة لإنترنت
   ========================================================= */

const STORAGE_KEY = "printshop_data_v1";
const ARABIC_DIGITS = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];

const WEEKDAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const DEFAULT_SALE_CATS = [
  {id:"copy_bw", name:"تصوير عادي", icon:"⚫"},
  {id:"copy_color", name:"تصوير ملون", icon:"🎨"},
  {id:"print", name:"طباعة", icon:"🖨️"},
  {id:"design", name:"تصميم", icon:"🖌️"},
  {id:"other_sale", name:"أخرى", icon:"📦"},
];

const DEFAULT_EXPENSE_CATS = [
  {id:"materials", name:"مواد", icon:"📦"},
  {id:"salary", name:"مرتب موظف", icon:"👤"},
  {id:"rent", name:"إيجار", icon:"🏬"},
  {id:"other_exp", name:"أخرى", icon:"🧾"},
];

const EXP_COLORS = {
  materials:{bg:"#D3ECE3", fg:"#0E9C82"},
  salary:{bg:"#FBDACB", fg:"#E5432A"},
  rent:{bg:"#F8E0A6", fg:"#A9740A"},
  other_exp:{bg:"#ECE3D1", fg:"#4B5A6B"},
};
function colorForExpenseCat(id){
  return EXP_COLORS[id] || {bg:"#ECE3D1", fg:"#4B5A6B"};
}
function colorForSaleCat(idx){
  const palette = [
    {bg:"#D3ECE3", fg:"#0E9C82"},
    {bg:"#FBDACB", fg:"#E5432A"},
    {bg:"#F8E0A6", fg:"#A9740A"},
    {bg:"#DBE1F5", fg:"#2F4FC2"},
    {bg:"#F0D9EC", fg:"#A12F94"},
  ];
  return palette[idx % palette.length];
}

let DB = null;

function loadDB(){
  let raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ DB = JSON.parse(raw); }catch(e){ DB = null; }
  }
  if(!DB){
    DB = {
      shopName: "الشبعاني لخدمات الطباعة والتصميم",
      currency: "د.ل",
      saleCats: DEFAULT_SALE_CATS.slice(),
      expenseCats: DEFAULT_EXPENSE_CATS.slice(),
      days: {},      // "2026-06-21": { morning:{items:[{cat,amount}], notes:""}, evening:{...} }
      expenses: []   // {id, date:"2026-06-21", cat, amount, desc}
    };
    saveDB();
  }
  // migrate missing fields
  if(!DB.saleCats) DB.saleCats = DEFAULT_SALE_CATS.slice();
  if(!DB.expenseCats) DB.expenseCats = DEFAULT_EXPENSE_CATS.slice();
  if(!DB.days) DB.days = {};
  if(!DB.expenses) DB.expenses = [];
  if(!DB.currency) DB.currency = "د.ل";
  if(!DB.shopName) DB.shopName = "الشبعاني لخدمات الطباعة والتصميم";
}

function saveDB(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

/* ---------- date helpers ---------- */
function pad2(n){ return n<10 ? "0"+n : ""+n; }
function fmtDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function toNumStr(n){
  // format number with thousands separators, Western digits (clearer for money on small screens)
  n = Math.round(n*100)/100;
  let isNeg = n < 0;
  n = Math.abs(n);
  let parts = n.toFixed(n % 1 === 0 ? 0 : 2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (isNeg?"-":"") + parts.join(".");
}
function money(n){ return toNumStr(n); }

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let activeTab = "home";

function daysInMonth(year, month){ return new Date(year, month+1, 0).getDate(); }

function monthKeyRange(year, month){
  const dim = daysInMonth(year, month);
  const start = `${year}-${pad2(month+1)}-01`;
  const end = `${year}-${pad2(month+1)}-${pad2(dim)}`;
  return {start, end, dim};
}

function isDateInMonth(dateStr, year, month){
  const d = new Date(dateStr+"T00:00:00");
  return d.getFullYear()===year && d.getMonth()===month;
}

/* =========================================================
   RENDER: HOME (Today)
   ========================================================= */
function renderHome(){
  const today = new Date();
  const todayKey = fmtDate(today);
  document.getElementById("todayDateLabel").textContent =
    `${WEEKDAYS_AR[today.getDay()]} ${today.getDate()} ${MONTHS_AR[today.getMonth()]}`;

  const dayData = DB.days[todayKey] || {};
  const card = document.getElementById("todayCard");
  card.innerHTML = renderDayCardHTML(todayKey, today, true);

  // month list (all days this calendar month that currently is, excluding today, most recent first)
  const listEl = document.getElementById("monthDaysList");
  const {dim} = monthKeyRange(today.getFullYear(), today.getMonth());
  let html = "";
  let any = false;
  for(let day=dim; day>=1; day--){
    if(day === today.getDate()) continue;
    const dateObj = new Date(today.getFullYear(), today.getMonth(), day);
    if(dateObj > today) continue;
    const key = fmtDate(dateObj);
    if(!DB.days[key]) continue;
    any = true;
    html += renderDayCardHTML(key, dateObj, false);
  }
  if(!any){
    html = `<div class="empty-state"><div class="ic">🗓️</div><p>لم تُسجَّل أيام أخرى لهذا الشهر بعد.<br>سجل مبيعات اليوم من البطاقة أعلاه.</p></div>`;
  }
  listEl.innerHTML = html;
}

function renderDayCardHTML(dateKey, dateObj, isToday){
  const dayData = DB.days[dateKey] || {};
  const morning = dayData.morning;
  const evening = dayData.evening;
  const mTotal = shiftTotal(morning);
  const eTotal = shiftTotal(evening);
  const dayTotal = mTotal + eTotal;

  return `
    <div class="day-card-head">
      <div>
        <div class="date-big">${WEEKDAYS_AR[dateObj.getDay()]} ${dateObj.getDate()} ${MONTHS_AR[dateObj.getMonth()]}</div>
        <div class="date-sub">${dateKey}</div>
      </div>
      ${isToday ? `<span class="today-pill">اليوم</span>` : ""}
    </div>
    <div class="shift-row">
      <div class="shift-box morning ${morning ? "filled":""}" onclick="openSaleSheet('${dateKey}','morning')">
        <div class="lbl"><span class="dot"></span>الفترة الصباحية</div>
        ${morning ? `<div class="amt">${money(mTotal)}</div><div class="cnt">${morning.items.length} عملية</div>`
                  : `<div class="amt empty">+ تسجيل</div>`}
      </div>
      <div class="shift-box evening ${evening ? "filled":""}" onclick="openSaleSheet('${dateKey}','evening')">
        <div class="lbl"><span class="dot"></span>الفترة المسائية</div>
        ${evening ? `<div class="amt">${money(eTotal)}</div><div class="cnt">${evening.items.length} عملية</div>`
                  : `<div class="amt empty">+ تسجيل</div>`}
      </div>
    </div>
    <div class="day-total">
      <div class="t-lbl">إجمالي اليوم</div>
      <div class="t-val">${money(dayTotal)} ${DB.currency}</div>
    </div>
  `;
}

function shiftTotal(shift){
  if(!shift || !shift.items) return 0;
  return shift.items.reduce((s,i)=>s+Number(i.amount||0), 0);
}

/* =========================================================
   RENDER: REPORT (Monthly)
   ========================================================= */
function renderReport(){
  document.getElementById("reportMonthLabel").textContent = `${MONTHS_AR[currentMonth]} ${currentYear}`;
  const {start,end,dim} = monthKeyRange(currentYear, currentMonth);
  document.getElementById("reportMonthRange").textContent = `من 1 إلى ${dim} — يبدأ كل شهر تلقائياً يوم 1`;

  // aggregate sales
  let totalIncome=0, morningTotal=0, eveningTotal=0;
  let saleCatTotals = {}; // catId -> {amount, count}
  for(const key in DB.days){
    if(!isDateInMonth(key, currentYear, currentMonth)) continue;
    const d = DB.days[key];
    ["morning","evening"].forEach(shiftName=>{
      const shift = d[shiftName];
      if(!shift) return;
      shift.items.forEach(it=>{
        const amt = Number(it.amount||0);
        totalIncome += amt;
        if(shiftName==="morning") morningTotal += amt; else eveningTotal += amt;
        if(!saleCatTotals[it.cat]) saleCatTotals[it.cat] = {amount:0,count:0};
        saleCatTotals[it.cat].amount += amt;
        saleCatTotals[it.cat].count += 1;
      });
    });
  }

  // aggregate expenses
  let totalExpense=0;
  let expCatTotals = {};
  let salaryTotal=0, rentTotal=0, materialsTotal=0, otherExpTotal=0;
  DB.expenses.forEach(e=>{
    if(!isDateInMonth(e.date, currentYear, currentMonth)) return;
    const amt = Number(e.amount||0);
    totalExpense += amt;
    if(!expCatTotals[e.cat]) expCatTotals[e.cat] = {amount:0,count:0};
    expCatTotals[e.cat].amount += amt;
    expCatTotals[e.cat].count += 1;
    if(e.cat==="salary") salaryTotal+=amt;
    else if(e.cat==="rent") rentTotal+=amt;
    else if(e.cat==="materials") materialsTotal+=amt;
    else otherExpTotal+=amt;
  });

  const profit = totalIncome - totalExpense;

  document.getElementById("repIncome").textContent = `${money(totalIncome)} ${DB.currency}`;
  document.getElementById("repExpense").textContent = `${money(totalExpense)} ${DB.currency}`;
  document.getElementById("repProfit").textContent = `${money(profit)} ${DB.currency}`;
  const profitCard = document.getElementById("repProfitCard");
  profitCard.classList.toggle("negative", profit < 0);
  document.getElementById("repProfitSub").textContent = profit >= 0 ? "📈 المكتب يحقق ربحاً هذا الشهر" : "📉 المصروفات تجاوزت المبيعات";

  // sales breakdown
  const sb = document.getElementById("salesBreakdown");
  const catsList = DB.saleCats.filter(c=>saleCatTotals[c.id]);
  if(catsList.length===0){
    sb.innerHTML = `<div class="empty-state"><div class="ic">🧾</div><p>لا توجد مبيعات مسجلة لهذا الشهر بعد.</p></div>`;
  }else{
    sb.innerHTML = catsList
      .sort((a,b)=> saleCatTotals[b.id].amount - saleCatTotals[a.id].amount)
      .map((c,idx)=>{
        const col = colorForSaleCat(DB.saleCats.findIndex(x=>x.id===c.id));
        const t = saleCatTotals[c.id];
        return `<div class="bd-row">
          <div class="left">
            <div class="bd-icon" style="background:${col.bg};color:${col.fg};">${c.icon}</div>
            <div><div class="bd-name">${c.name}</div><div class="bd-count">${t.count} عملية</div></div>
          </div>
          <div class="bd-amt">${money(t.amount)} ${DB.currency}</div>
        </div>`;
      }).join("");
  }

  // expense breakdown
  const eb = document.getElementById("expenseBreakdown");
  const ecatsList = DB.expenseCats.filter(c=>expCatTotals[c.id]);
  if(ecatsList.length===0){
    eb.innerHTML = `<div class="empty-state"><div class="ic">📭</div><p>لا توجد مصروفات مسجلة لهذا الشهر بعد.</p></div>`;
  }else{
    eb.innerHTML = ecatsList
      .sort((a,b)=> expCatTotals[b.id].amount - expCatTotals[a.id].amount)
      .map(c=>{
        const col = colorForExpenseCat(c.id);
        const t = expCatTotals[c.id];
        return `<div class="bd-row">
          <div class="left">
            <div class="bd-icon" style="background:${col.bg};color:${col.fg};">${c.icon}</div>
            <div><div class="bd-name">${c.name}</div><div class="bd-count">${t.count} عملية</div></div>
          </div>
          <div class="bd-amt">${money(t.amount)} ${DB.currency}</div>
        </div>`;
      }).join("");
  }

  // receipt summary
  document.getElementById("receiptShopName").textContent = DB.shopName;
  document.getElementById("receiptMonth").textContent = `تقرير شهر ${MONTHS_AR[currentMonth]} ${currentYear}`;
  document.getElementById("rMorning").textContent = `${money(morningTotal)} ${DB.currency}`;
  document.getElementById("rEvening").textContent = `${money(eveningTotal)} ${DB.currency}`;
  document.getElementById("rIncome").textContent = `${money(totalIncome)} ${DB.currency}`;
  document.getElementById("rSalary").textContent = `${money(salaryTotal)} ${DB.currency}`;
  document.getElementById("rRent").textContent = `${money(rentTotal)} ${DB.currency}`;
  document.getElementById("rMaterials").textContent = `${money(materialsTotal+otherExpTotal)} ${DB.currency}`;
  document.getElementById("rExpense").textContent = `${money(totalExpense)} ${DB.currency}`;
  document.getElementById("rNet").textContent = `${money(profit)} ${DB.currency}`;
}

/* =========================================================
   RENDER: EXPENSES LIST
   ========================================================= */
function renderExpensesView(){
  document.getElementById("expMonthLabel").textContent = `${MONTHS_AR[currentMonth]} ${currentYear}`;
  const {dim} = monthKeyRange(currentYear, currentMonth);
  document.getElementById("expMonthRange").textContent = `من 1 إلى ${dim}`;

  const list = DB.expenses
    .filter(e=> isDateInMonth(e.date, currentYear, currentMonth))
    .sort((a,b)=> b.date.localeCompare(a.date) || b.id - a.id);

  const el = document.getElementById("expensesList");
  if(list.length===0){
    el.innerHTML = `<div class="empty-state"><div class="ic">🧾</div><p>لا توجد مصروفات مسجلة هذا الشهر.<br>اضغط على زر + لإضافة مصروف.</p></div>`;
    return;
  }
  el.innerHTML = list.map(e=>{
    const cat = DB.expenseCats.find(c=>c.id===e.cat) || {name:"أخرى", icon:"🧾"};
    const col = colorForExpenseCat(e.cat);
    const d = new Date(e.date+"T00:00:00");
    const dateLabel = `${d.getDate()} ${MONTHS_AR[d.getMonth()]}`;
    return `<div class="bd-row" onclick="openExpenseSheet(${e.id})" style="cursor:pointer;">
      <div class="left">
        <div class="bd-icon" style="background:${col.bg};color:${col.fg};">${cat.icon}</div>
        <div>
          <div class="bd-name">${cat.name}${e.desc ? " — "+escapeHTML(e.desc) : ""}</div>
          <div class="bd-count">${dateLabel}</div>
        </div>
      </div>
      <div class="bd-amt">${money(e.amount)} ${DB.currency}</div>
    </div>`;
  }).join("");
}

function escapeHTML(s){
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/* =========================================================
   TAB SWITCHING
   ========================================================= */
function switchTab(name){
  activeTab = name;
  document.querySelectorAll(".tab").forEach(t=> t.classList.toggle("active", t.dataset.view===name));
  document.querySelectorAll(".nav-item").forEach(t=> t.classList.toggle("active", t.dataset.view===name));
  document.querySelectorAll(".view").forEach(v=> v.classList.add("hidden"));
  document.getElementById("view-"+name).classList.remove("hidden");
  document.getElementById("fabBtn").classList.toggle("show", name==="expenses");

  if(name==="home") renderHome();
  if(name==="report") renderReport();
  if(name==="expenses") renderExpensesView();
}

function changeMonth(delta){
  currentMonth += delta;
  if(currentMonth < 0){ currentMonth = 11; currentYear--; }
  if(currentMonth > 11){ currentMonth = 0; currentYear++; }
  if(activeTab==="report") renderReport();
  if(activeTab==="expenses") renderExpensesView();
}

function openBackdateSale(){
  const todayKey = fmtDate(new Date());
  const wantsEvening = confirm("اضغط 'موافق' لتسجيل الفترة المسائية، أو 'إلغاء' لتسجيل الفترة الصباحية.");
  const shift = wantsEvening ? "evening" : "morning";
  saleSheetState.shift = shift;
  document.getElementById("saleSheetTitle").textContent =
    shift === "morning" ? "مبيعات الفترة الصباحية" : "مبيعات الفترة المسائية";
  // default to yesterday since this button is mainly for backdating
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate()-1);
  const defaultKey = fmtDate(yesterday);
  document.getElementById("saleDateInput").value = defaultKey;
  document.getElementById("saleDateInput").max = todayKey;
  loadSaleSheetForDate(defaultKey);
  populateSaleCatSelect();
  openSheet("sheetSale");
}

/* =========================================================
   SALE SHEET LOGIC
   ========================================================= */
let saleSheetState = { dateKey:null, shift:null, items:[] };

function openSaleSheet(dateKey, shift){
  saleSheetState.shift = shift;
  document.getElementById("saleSheetTitle").textContent =
    shift === "morning" ? "مبيعات الفترة الصباحية" : "مبيعات الفترة المسائية";
  document.getElementById("saleDateInput").value = dateKey;
  document.getElementById("saleDateInput").max = fmtDate(new Date());
  loadSaleSheetForDate(dateKey);
  populateSaleCatSelect();
  openSheet("sheetSale");
}

function loadSaleSheetForDate(dateKey){
  const shift = saleSheetState.shift;
  saleSheetState.dateKey = dateKey;
  const existing = (DB.days[dateKey] && DB.days[dateKey][shift]) || {items:[], notes:""};
  saleSheetState.items = existing.items.map(i=>({...i}));
  document.getElementById("saleNotes").value = existing.notes || "";

  const todayKey = fmtDate(new Date());
  const d = new Date(dateKey+"T00:00:00");
  const dayLabel = `${WEEKDAYS_AR[d.getDay()]} ${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
  const hint = document.getElementById("saleDateHint");
  if(dateKey === todayKey){
    hint.textContent = "📅 اليوم";
    hint.classList.remove("is-past");
  }else{
    hint.textContent = `📅 ${dayLabel} — لست تسجل ليوم اليوم`;
    hint.classList.add("is-past");
  }
  renderSaleItemList();
}

function onSaleDateChanged(){
  const newDate = document.getElementById("saleDateInput").value;
  if(!newDate) return;
  // warn if switching away unsaved items
  if(saleSheetState.items.length>0){
    const ok = confirm("لديك عمليات بيع لم تُحفظ بعد لهذا التاريخ. تغيير التاريخ سيُلغيها إن لم تحفظ أولاً. هل تريد المتابعة؟");
    if(!ok){
      document.getElementById("saleDateInput").value = saleSheetState.dateKey;
      return;
    }
  }
  loadSaleSheetForDate(newDate);
}

function populateSaleCatSelect(){
  const sel = document.getElementById("saleCatSelect");
  sel.innerHTML = DB.saleCats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
}

function renderSaleItemList(){
  const el = document.getElementById("saleItemList");
  if(saleSheetState.items.length===0){
    el.innerHTML = `<div class="empty-state" style="padding:24px 10px;"><p>لم تُضف أي عملية بيع بعد لهذه الفترة.<br>اختر النوع، أدخل المبلغ، واضغط +</p></div>`;
  }else{
    el.innerHTML = saleSheetState.items.map((it,idx)=>{
      const cat = DB.saleCats.find(c=>c.id===it.cat) || {name:it.cat, icon:"📦"};
      const colIdx = DB.saleCats.findIndex(c=>c.id===it.cat);
      const col = colorForSaleCat(colIdx<0?0:colIdx);
      return `<div class="item-row">
        <div class="ic" style="background:${col.bg};color:${col.fg};">${cat.icon}</div>
        <div class="nm">${cat.name}</div>
        <div class="am">${money(it.amount)}</div>
        <div class="del" onclick="removeSaleItem(${idx})">✕</div>
      </div>`;
    }).join("");
  }
  const total = saleSheetState.items.reduce((s,i)=>s+Number(i.amount||0),0);
  document.getElementById("saleShiftTotal").textContent = `${money(total)} ${DB.currency}`;
}

function addSaleItem(){
  const cat = document.getElementById("saleCatSelect").value;
  const amtInput = document.getElementById("saleAmtInput");
  const amt = parseFloat(amtInput.value);
  if(!amt || amt<=0){
    showToast("أدخل مبلغاً صحيحاً أولاً");
    amtInput.focus();
    return;
  }
  saleSheetState.items.push({cat, amount: amt});
  amtInput.value = "";
  renderSaleItemList();
}

function removeSaleItem(idx){
  saleSheetState.items.splice(idx,1);
  renderSaleItemList();
}

function saveSaleShift(){
  const {dateKey, shift, items} = saleSheetState;
  if(items.length===0){
    // if nothing entered, treat as clearing the shift
    if(DB.days[dateKey]) delete DB.days[dateKey][shift];
    if(DB.days[dateKey] && !DB.days[dateKey].morning && !DB.days[dateKey].evening){
      delete DB.days[dateKey];
    }
  }else{
    if(!DB.days[dateKey]) DB.days[dateKey] = {};
    DB.days[dateKey][shift] = {
      items: items,
      notes: document.getElementById("saleNotes").value.trim()
    };
  }
  saveDB();
  closeAllSheets();
  showToast("تم حفظ مبيعات الفترة ✓");
  if(activeTab==="home") renderHome();
  if(activeTab==="report") renderReport();
  if(activeTab==="expenses") renderExpensesView();
}

/* =========================================================
   EXPENSE SHEET LOGIC
   ========================================================= */
let editingExpenseId = null;

function openExpenseSheet(idOrNothing){
  const today = fmtDate(new Date());
  document.getElementById("expDate").value = today;
  document.getElementById("expDesc").value = "";
  document.getElementById("expAmount").value = "";
  document.getElementById("expCurLabel").textContent = DB.currency;
  document.getElementById("expDeleteBtn").classList.add("hidden");
  editingExpenseId = null;

  populateExpenseChips(DB.expenseCats[0].id);

  if(typeof idOrNothing === "number"){
    const e = DB.expenses.find(x=>x.id===idOrNothing);
    if(e){
      editingExpenseId = e.id;
      document.getElementById("expDate").value = e.date;
      document.getElementById("expAmount").value = e.amount;
      document.getElementById("expDesc").value = e.desc || "";
      populateExpenseChips(e.cat);
      document.getElementById("expDeleteBtn").classList.remove("hidden");
    }
  }
  openSheet("sheetExpense");
}

function populateExpenseChips(activeId){
  const el = document.getElementById("expCatChips");
  el.innerHTML = DB.expenseCats.map(c=>
    `<div class="chip ${c.id===activeId?"active":""}" data-cat="${c.id}" onclick="selectExpenseChip('${c.id}')">${c.icon} ${c.name}</div>`
  ).join("") + `<div class="chip add-new" onclick="promptNewCategory('expense')">+ بند جديد</div>`;
}

function selectExpenseChip(catId){
  document.querySelectorAll("#expCatChips .chip[data-cat]").forEach(c=>{
    c.classList.toggle("active", c.dataset.cat===catId);
  });
}

function saveExpense(){
  const date = document.getElementById("expDate").value;
  const activeChip = document.querySelector("#expCatChips .chip.active");
  const cat = activeChip ? activeChip.dataset.cat : DB.expenseCats[0].id;
  const amount = parseFloat(document.getElementById("expAmount").value);
  const desc = document.getElementById("expDesc").value.trim();

  if(!date){ showToast("اختر التاريخ"); return; }
  if(!amount || amount<=0){ showToast("أدخل مبلغاً صحيحاً"); return; }

  if(editingExpenseId){
    const e = DB.expenses.find(x=>x.id===editingExpenseId);
    e.date=date; e.cat=cat; e.amount=amount; e.desc=desc;
  }else{
    DB.expenses.push({ id: Date.now(), date, cat, amount, desc });
  }
  saveDB();
  closeAllSheets();
  showToast("تم حفظ المصروف ✓");
  if(activeTab==="expenses") renderExpensesView();
  if(activeTab==="report") renderReport();
}

function deleteCurrentExpense(){
  if(!editingExpenseId) return;
  DB.expenses = DB.expenses.filter(x=>x.id!==editingExpenseId);
  saveDB();
  closeAllSheets();
  showToast("تم حذف المصروف");
  if(activeTab==="expenses") renderExpensesView();
  if(activeTab==="report") renderReport();
}

/* =========================================================
   CATEGORY MANAGEMENT
   ========================================================= */
function promptNewCategory(kind){
  const name = prompt(kind==="sale" ? "اسم نوع المبيعات الجديد:" : "اسم بند المصروف الجديد:");
  if(!name || !name.trim()) return;
  const id = "c_" + Date.now();
  const icon = kind==="sale" ? "📦" : "🧾";
  if(kind==="sale"){
    DB.saleCats.push({id, name:name.trim(), icon});
    saveDB();
    populateSaleCatSelect();
    document.getElementById("saleCatSelect").value = id;
  }else{
    DB.expenseCats.push({id, name:name.trim(), icon});
    saveDB();
    populateExpenseChips(id);
  }
}

/* =========================================================
   SETTINGS
   ========================================================= */
function openSettings(){
  document.getElementById("settingShopName").value = DB.shopName;
  document.getElementById("settingCurrency").value = DB.currency;
  renderManageCats();
  openSheet("sheetSettings");
}

function renderManageCats(){
  const sEl = document.getElementById("manageSaleCats");
  sEl.innerHTML = DB.saleCats.map(c=>
    `<div class="chip">${c.icon} ${c.name} <span onclick="deleteCategory('sale','${c.id}')" style="margin-right:2px;color:var(--stamp);">✕</span></div>`
  ).join("") + `<div class="chip add-new" onclick="promptNewCategory('sale'); renderManageCats();">+ إضافة</div>`;

  const eEl = document.getElementById("manageExpenseCats");
  eEl.innerHTML = DB.expenseCats.map(c=>
    `<div class="chip">${c.icon} ${c.name} <span onclick="deleteCategory('expense','${c.id}')" style="margin-right:2px;color:var(--stamp);">✕</span></div>`
  ).join("") + `<div class="chip add-new" onclick="promptNewCategory('expense'); renderManageCats();">+ إضافة</div>`;
}

function deleteCategory(kind, id){
  if(kind==="sale"){
    if(DB.saleCats.length<=1){ showToast("يجب وجود نوع مبيعات واحد على الأقل"); return; }
    DB.saleCats = DB.saleCats.filter(c=>c.id!==id);
  }else{
    if(DB.expenseCats.length<=1){ showToast("يجب وجود بند مصروف واحد على الأقل"); return; }
    DB.expenseCats = DB.expenseCats.filter(c=>c.id!==id);
  }
  saveDB();
  renderManageCats();
}

function saveSettings(){
  DB.shopName = document.getElementById("settingShopName").value.trim() || "سجل المكتب";
  DB.currency = document.getElementById("settingCurrency").value.trim() || "ر.س";
  saveDB();
  document.getElementById("shopName").textContent = DB.shopName;
  closeAllSheets();
  showToast("تم حفظ الإعدادات ✓");
  if(activeTab==="home") renderHome();
  if(activeTab==="report") renderReport();
  if(activeTab==="expenses") renderExpensesView();
}

/* =========================================================
   BACKUP / RESTORE
   ========================================================= */
function exportBackup(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = fmtDate(new Date());
  a.href = url;
  a.download = `نسخة-احتياطية-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("تم تصدير النسخة الاحتياطية");
}

function importBackup(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = JSON.parse(e.target.result);
      if(!data.days || !data.expenses){ throw new Error("invalid"); }
      if(confirm("سيتم استبدال جميع البيانات الحالية بهذه النسخة الاحتياطية. هل تريد الاستمرار؟")){
        DB = data;
        saveDB();
        document.getElementById("shopName").textContent = DB.shopName;
        closeAllSheets();
        showToast("تم استيراد النسخة الاحتياطية ✓");
        switchTab(activeTab);
      }
    }catch(err){
      alert("ملف غير صالح. تأكد من اختيار ملف النسخة الاحتياطية الصحيح.");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

/* =========================================================
   SHEET / OVERLAY HELPERS
   ========================================================= */
function openSheet(id){
  document.getElementById("overlay").classList.add("show");
  document.getElementById(id).classList.add("show");
}
function closeAllSheets(){
  document.getElementById("overlay").classList.remove("show");
  document.querySelectorAll(".sheet").forEach(s=>s.classList.remove("show"));
}
function openExpenseSheetWrapper(){ openExpenseSheet(); }

let toastTimer = null;
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove("show"), 2200);
}

/* expose for inline onclick in expenses fab when on expenses tab vs elsewhere */
function openExpenseSheetFromFab(){ openExpenseSheet(); }

/* =========================================================
   INIT
   ========================================================= */
function init(){
  loadDB();
  document.getElementById("shopName").textContent = DB.shopName;
  document.getElementById("expCurLabel").textContent = DB.currency;
  switchTab("home");
}

document.addEventListener("DOMContentLoaded", init);

/* تسجيل Service Worker لتفعيل العمل دون إنترنت (مطلوب لمتطلبات PWA) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
