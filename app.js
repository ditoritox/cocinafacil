'use strict';

/* ══════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════ */
var SPOON_KEY  = '25090e97877142bca933ad480c2cb1cf';
var SPOON_BASE = 'https://api.spoonacular.com';
var LS_KEY     = 'cocinafacil_v3';
var LS_FAV     = 'cocinafacil_favoritas';
var LS_DSP     = 'cocinafacil_despensa';
var ICON_COLORS = ['#16a34a','#ea580c','#2563eb','#9333ea','#dc2626',
                   '#0891b2','#b45309','#0f766e','#7c3aed','#c2410c','#0369a1','#15803d'];

/* ══════════════════════════════════════════════════════
   ES → EN translation map
══════════════════════════════════════════════════════ */
var ES_EN = {
  'pollo':'chicken','pechuga de pollo':'chicken breast','muslo de pollo':'chicken thigh',
  'carne':'beef','carne molida':'ground beef','cerdo':'pork','lomo de cerdo':'pork loin',
  'pescado':'fish','salmon':'salmon','atun':'tuna','camarones':'shrimp','gambas':'shrimp',
  'tomate':'tomato','tomates':'tomatoes','jitomate':'tomato','cebolla':'onion',
  'cebolla morada':'red onion','ajo':'garlic','papa':'potato','papas':'potatoes',
  'patata':'potato','zanahoria':'carrot','pimiento':'bell pepper','chile':'chili',
  'jalapeño':'jalapeno','arroz':'rice','pasta':'pasta','fideos':'noodles',
  'macarrones':'macaroni','espagueti':'spaghetti','frijoles':'beans','lentejas':'lentils',
  'garbanzos':'chickpeas','huevo':'egg','huevos':'eggs','leche':'milk','queso':'cheese',
  'mantequilla':'butter','crema':'cream','yogur':'yogurt','harina':'flour',
  'azucar':'sugar','sal':'salt','pimienta':'black pepper','aceite':'oil',
  'aceite de oliva':'olive oil','limon':'lemon','naranja':'orange','manzana':'apple',
  'platano':'banana','fresa':'strawberry','espinaca':'spinach','lechuga':'lettuce',
  'pepino':'cucumber','calabacin':'zucchini','berenjena':'eggplant','brocoli':'broccoli',
  'coliflor':'cauliflower','champiñones':'mushrooms','champinones':'mushrooms',
  'jamon':'ham','tocino':'bacon','chorizo':'chorizo','salchicha':'sausage','pavo':'turkey',
  'cordero':'lamb','coco':'coconut','jengibre':'ginger','canela':'cinnamon',
  'chocolate':'chocolate','miel':'honey','vinagre':'vinegar','mostaza':'mustard',
  'salsa de tomate':'tomato sauce','salsa de soya':'soy sauce','salsa soya':'soy sauce',
  'salsa de pescado':'fish sauce','cous cous':'couscous','couscous':'couscous',
  'quinoa':'quinoa','avena':'oats','aguacate':'avocado','palta':'avocado',
  'maiz':'corn','elote':'corn','cilantro':'cilantro','perejil':'parsley',
  'albahaca':'basil','oregano':'oregano','tomillo':'thyme','romero':'rosemary',
  'comino':'cumin','paprika':'paprika','curry':'curry','pimiento rojo':'red pepper',
  'pimiento verde':'green pepper','cebolla blanca':'white onion','atún':'tuna',
  'salmón':'salmon','jalapeño':'jalapeno','maíz':'corn','orégano':'oregano',
  'cúrcuma':'turmeric','azúcar':'sugar','limón':'lemon','plátano':'banana'
};

function translate(s) {
  return ES_EN[s] || ES_EN[s.replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
    .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n')] || s;
}

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
var state = {
  ingredients:    [],
  recipes:        [],
  searchCache:    new Map(),
  detailCache:    new Map(),
  loading:        false,
  currentModal:   null,
  pendingName:    '',
  currentTab:     'buscar',
  favoritas:      [],
  despensa:       [],
  dspPendingName: '',
  dspLoading:     false,
  dspRecipes:     [],
  dupQueue:       [],
  dupIdx:         0,
  ocrTarget:      ''
};

/* ══════════════════════════════════════════════════════
   LOCALSTORAGE
══════════════════════════════════════════════════════ */
function saveIngredients(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state.ingredients)); }catch(e){} }
function loadIngredients(){ try{ var d=localStorage.getItem(LS_KEY); if(d) state.ingredients=JSON.parse(d); }catch(e){} }
function saveFavoritas(){   try{ localStorage.setItem(LS_FAV, JSON.stringify(state.favoritas)); }catch(e){} }
function loadFavoritas(){   try{ var d=localStorage.getItem(LS_FAV); if(d) state.favoritas=JSON.parse(d); }catch(e){} }
function saveDespensa(){    try{ localStorage.setItem(LS_DSP, JSON.stringify(state.despensa)); }catch(e){} }
function loadDespensa(){    try{ var d=localStorage.getItem(LS_DSP); if(d) state.despensa=JSON.parse(d); }catch(e){} }

/* ══════════════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════════════ */
var dom = {};
function initDom() {
  dom.searchInput       = document.getElementById('ingredient-input');
  dom.addBtn            = document.getElementById('add-btn');
  dom.ingList           = document.getElementById('ingredients-list');
  dom.emptyHint         = document.getElementById('empty-hint');
  dom.clearAllBtn       = document.getElementById('clear-all-btn');
  dom.searchBtn         = document.getElementById('search-btn');
  dom.cameraBtn         = document.getElementById('camera-btn');
  dom.ocrInput          = document.getElementById('ocr-input');
  dom.ocrProgress       = document.getElementById('ocr-progress');
  dom.progressBar       = document.getElementById('progress-bar');
  dom.ocrStatus         = document.getElementById('ocr-status');
  dom.resultsSection    = document.getElementById('results-section');
  dom.recipesGrid       = document.getElementById('recipes-grid');
  dom.resultCount       = document.getElementById('result-count');
  dom.favGrid           = document.getElementById('fav-grid');
  dom.favEmpty          = document.getElementById('fav-empty');
  dom.favCount          = document.getElementById('fav-count');
  dom.dspCameraBtn      = document.getElementById('dsp-camera-btn');
  dom.dspOcrInput       = document.getElementById('dsp-ocr-input');
  dom.dspOcrProgress    = document.getElementById('dsp-ocr-progress');
  dom.dspProgressBar    = document.getElementById('dsp-progress-bar');
  dom.dspOcrStatus      = document.getElementById('dsp-ocr-status');
  dom.dspClearBtn       = document.getElementById('dsp-clear-btn');
  dom.dspInput          = document.getElementById('dsp-input');
  dom.dspAddBtn         = document.getElementById('dsp-add-btn');
  dom.despensaList      = document.getElementById('despensa-list');
  dom.dspEmptyHint      = document.getElementById('dsp-empty-hint');
  dom.dspSearchBtn      = document.getElementById('dsp-search-btn');
  dom.dspResultsSection = document.getElementById('dsp-results-section');
  dom.dspRecipesGrid    = document.getElementById('dsp-recipes-grid');
  dom.dspResultCount    = document.getElementById('dsp-result-count');
  dom.qtyOverlay        = document.getElementById('qty-overlay');
  dom.qtyIngName        = document.getElementById('qty-ingredient-name');
  dom.qtyInput          = document.getElementById('qty-input');
  dom.qtyCancel         = document.getElementById('qty-cancel');
  dom.qtySkip           = document.getElementById('qty-skip');
  dom.qtyConfirm        = document.getElementById('qty-confirm');
  dom.dspQtyOverlay     = document.getElementById('dsp-qty-overlay');
  dom.dspQtyName        = document.getElementById('dsp-qty-name');
  dom.dspQtyInput       = document.getElementById('dsp-qty-input');
  dom.dspQtyCancel      = document.getElementById('dsp-qty-cancel');
  dom.dspQtySkip        = document.getElementById('dsp-qty-skip');
  dom.dspQtyConfirm     = document.getElementById('dsp-qty-confirm');
  dom.ocrReviewOverlay  = document.getElementById('ocr-review-overlay');
  dom.ocrReviewList     = document.getElementById('ocr-review-list');
  dom.ocrReviewConfirm  = document.getElementById('ocr-review-confirm');
  dom.ocrReviewCancel   = document.getElementById('ocr-review-cancel');
  dom.dupOverlay        = document.getElementById('dup-overlay');
  dom.dupName           = document.getElementById('dup-name');
  dom.dupCurrent        = document.getElementById('dup-current');
  dom.dupDetected       = document.getElementById('dup-detected');
  dom.dupSkip           = document.getElementById('dup-skip');
  dom.dupAdd            = document.getElementById('dup-add');
  dom.dupUpdate         = document.getElementById('dup-update');
  dom.dupCurrentIdx     = document.getElementById('dup-current-idx');
  dom.dupTotal          = document.getElementById('dup-total');
  dom.modalOverlay      = document.getElementById('modal-overlay');
  dom.modalContent      = document.getElementById('modal-content');
}

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function norm(s){ return s.trim().toLowerCase().replace(/\s+/g,' '); }

function ingColor(name){
  var h=0;
  for(var i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff;
  return ICON_COLORS[h%ICON_COLORS.length];
}

function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); },2800);
}

/* ══════════════════════════════════════════════════════
   INGREDIENT ITEM UI
══════════════════════════════════════════════════════ */
function makeIngItem(ing, onRemove){
  var li=document.createElement('li');
  li.className='ing-item';
  var letter=(ing.name||'?')[0].toUpperCase();
  var color=ingColor(ing.name);
  li.innerHTML=
    '<span class="ing-icon" style="background:'+color+'">'+letter+'</span>'+
    '<span class="ing-text">'+
      '<span class="ing-name">'+ing.name+'</span>'+
      (ing.qty?'<span class="ing-qty">'+ing.qty+'</span>':'')+
    '</span>'+
    '<button class="ing-remove" aria-label="Eliminar">×</button>';
  li.querySelector('.ing-remove').addEventListener('click',function(){ onRemove(ing.id); });
  return li;
}

/* ══════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════ */
function initTabs(){
  document.querySelectorAll('.nav-btn').forEach(function(btn){
    btn.addEventListener('click',function(){ switchTab(btn.dataset.tab); });
  });
}

function switchTab(tab){
  state.currentTab=tab;
  document.querySelectorAll('.tab-content').forEach(function(el){
    el.classList.toggle('active',el.id==='tab-'+tab);
  });
  document.querySelectorAll('.nav-btn').forEach(function(btn){
    btn.classList.toggle('active',btn.dataset.tab===tab);
  });
}

/* ══════════════════════════════════════════════════════
   BUSCAR TAB
══════════════════════════════════════════════════════ */
function initBuscar(){
  dom.addBtn.addEventListener('click',tryAddIngredient);
  dom.searchInput.addEventListener('keydown',function(e){ if(e.key==='Enter') tryAddIngredient(); });
  dom.clearAllBtn.addEventListener('click',clearIngredients);
  dom.searchBtn.addEventListener('click',searchRecipes);
  dom.qtySkip.addEventListener('click',confirmQty);
  dom.qtyCancel.addEventListener('click',closeQtySheet);
  dom.qtyOverlay.addEventListener('click',function(e){ if(e.target===dom.qtyOverlay) closeQtySheet(); });
  dom.qtyConfirm.addEventListener('click',confirmQty);
  dom.qtyInput.addEventListener('keydown',function(e){ if(e.key==='Enter') confirmQty(); });
  dom.cameraBtn.addEventListener('click',function(){ dom.ocrInput.click(); });
  dom.ocrInput.addEventListener('change',function(e){
    var f=e.target.files[0]; if(f) processScanFile(f,'buscar'); dom.ocrInput.value='';
  });
}

function tryAddIngredient(){
  var raw=dom.searchInput.value.trim(); if(!raw) return;
  dom.searchInput.value=''; state.pendingName=raw; openQtySheet(raw);
}

function openQtySheet(name){
  dom.qtyIngName.textContent=name; dom.qtyInput.value='';
  dom.qtyOverlay.classList.add('open'); dom.qtyOverlay.removeAttribute('aria-hidden');
  setTimeout(function(){ dom.qtyInput.focus(); },100);
}

function closeQtySheet(){
  dom.qtyOverlay.classList.remove('open'); dom.qtyOverlay.setAttribute('aria-hidden','true');
  state.pendingName='';
}

function confirmQty(){
  var name=state.pendingName; var qty=dom.qtyInput.value.trim(); if(!name) return;
  var n=norm(name);
  if(state.ingredients.some(function(i){ return norm(i.name)===n; })){
    showToast('"'+n+'" ya está en tu lista'); closeQtySheet(); return;
  }
  state.ingredients.push({id:genId(),name:n,qty:qty});
  renderIngredients(); saveIngredients(); closeQtySheet();
  showToast('✓ '+n+(qty?' – '+qty:'')+' añadido');
}

function removeIngredient(id){
  state.ingredients=state.ingredients.filter(function(i){ return i.id!==id; });
  renderIngredients(); saveIngredients();
}

function clearIngredients(){
  state.ingredients=[]; state.recipes=[];
  renderIngredients(); saveIngredients(); dom.resultsSection.style.display='none';
}

function renderIngredients(){
  dom.ingList.innerHTML='';
  if(!state.ingredients.length){
    dom.emptyHint.style.display='block'; dom.searchBtn.disabled=true; return;
  }
  dom.emptyHint.style.display='none'; dom.searchBtn.disabled=false;
  state.ingredients.forEach(function(ing){ dom.ingList.appendChild(makeIngItem(ing,removeIngredient)); });
}

/* ══════════════════════════════════════════════════════
   FAVORITAS
══════════════════════════════════════════════════════ */
function isFavorita(id){ return state.favoritas.some(function(f){ return f.id===id; }); }

function toggleFavorita(recipe){
  var idx=state.favoritas.findIndex(function(f){ return f.id===recipe.id; });
  if(idx>=0){ state.favoritas.splice(idx,1); showToast('Eliminado de favoritos'); }
  else{ state.favoritas.push({id:recipe.id,title:recipe.title,image:recipe.image}); showToast('❤️ Guardado en favoritos'); }
  saveFavoritas(); renderFavoritas();
}

function renderFavoritas(){
  dom.favGrid.innerHTML='';
  var count=state.favoritas.length;
  dom.favCount.textContent=count?count+' receta'+(count!==1?'s':''):'';
  if(!count){ dom.favEmpty.style.display='block'; return; }
  dom.favEmpty.style.display='none';
  state.favoritas.forEach(function(fav,i){ dom.favGrid.appendChild(buildCard(fav,1,i,true)); });
}

/* ══════════════════════════════════════════════════════
   DESPENSA
══════════════════════════════════════════════════════ */
function initDespensa(){
  dom.dspAddBtn.addEventListener('click',tryAddDespensa);
  dom.dspInput.addEventListener('keydown',function(e){ if(e.key==='Enter') tryAddDespensa(); });
  dom.dspClearBtn.addEventListener('click',clearDespensa);
  dom.dspSearchBtn.addEventListener('click',buscarConDespensa);
  dom.dspQtySkip.addEventListener('click',confirmDspQty);
  dom.dspQtyConfirm.addEventListener('click',confirmDspQty);
  dom.dspQtyCancel.addEventListener('click',closeDspQtySheet);
  dom.dspQtyOverlay.addEventListener('click',function(e){ if(e.target===dom.dspQtyOverlay) closeDspQtySheet(); });
  dom.ocrReviewConfirm.addEventListener('click',confirmOcrReview);
  dom.ocrReviewCancel.addEventListener('click',closeOcrReview);
  dom.ocrReviewOverlay.addEventListener('click',function(e){ if(e.target===dom.ocrReviewOverlay) closeOcrReview(); });
  dom.dspQtyInput.addEventListener('keydown',function(e){ if(e.key==='Enter') confirmDspQty(); });
  dom.dupAdd.addEventListener('click',handleDupAdd);
  dom.dupUpdate.addEventListener('click',handleDupUpdate);
  dom.dupSkip.addEventListener('click',handleDupSkip);
  dom.dspCameraBtn.addEventListener('click',function(){ dom.dspOcrInput.click(); });
  dom.dspOcrInput.addEventListener('change',function(e){
    var f=e.target.files[0]; if(f) processScanFile(f,'despensa'); dom.dspOcrInput.value='';
  });
}

function tryAddDespensa(){
  var raw=dom.dspInput.value.trim(); if(!raw) return;
  dom.dspInput.value=''; state.dspPendingName=raw; openDspQtySheet(raw);
}

function openDspQtySheet(name){
  state.dspPendingName=name; dom.dspQtyName.textContent=name; dom.dspQtyInput.value='';
  dom.dspQtyOverlay.classList.add('open'); dom.dspQtyOverlay.removeAttribute('aria-hidden');
  setTimeout(function(){ dom.dspQtyInput.focus(); },100);
}

function closeDspQtySheet(){
  dom.dspQtyOverlay.classList.remove('open'); dom.dspQtyOverlay.setAttribute('aria-hidden','true');
  state.dspPendingName='';
}

function confirmDspQty(){
  var name=state.dspPendingName; var qty=dom.dspQtyInput.value.trim(); if(!name) return;
  var n=norm(name);
  if(state.despensa.some(function(i){ return norm(i.name)===n; })){
    showToast('"'+n+'" ya está en tu despensa'); closeDspQtySheet(); return;
  }
  state.despensa.push({id:genId(),name:n,qty:qty});
  renderDespensa(); saveDespensa(); closeDspQtySheet();
  showToast('✓ '+n+(qty?' – '+qty:'')+' añadido a despensa');
}

function removeDespensa(id){
  state.despensa=state.despensa.filter(function(i){ return i.id!==id; });
  renderDespensa(); saveDespensa();
}

function clearDespensa(){
  state.despensa=[]; state.dspRecipes=[];
  renderDespensa(); saveDespensa(); dom.dspResultsSection.style.display='none';
}

function renderDespensa(){
  dom.despensaList.innerHTML='';
  if(!state.despensa.length){ dom.dspEmptyHint.style.display='block'; dom.dspSearchBtn.disabled=true; return; }
  dom.dspEmptyHint.style.display='none'; dom.dspSearchBtn.disabled=false;
  state.despensa.forEach(function(ing){ dom.despensaList.appendChild(makeIngItem(ing,removeDespensa)); });
}

/* ══════════════════════════════════════════════════════
   DUPLICATE DETECTION
══════════════════════════════════════════════════════ */
function showNextDup(){
  if(state.dupIdx>=state.dupQueue.length){ closeDupOverlay(); showToast('Despensa actualizada'); return; }
  var dup=state.dupQueue[state.dupIdx];
  dom.dupName.textContent=dup.name;
  dom.dupCurrent.textContent=dup.existing.qty||'Sin cantidad especificada';
  dom.dupDetected.textContent=dup.detectedQty||'No especificado';
  dom.dupCurrentIdx.textContent=state.dupIdx+1;
  dom.dupTotal.textContent=state.dupQueue.length;
  dom.dupOverlay.classList.add('open'); dom.dupOverlay.removeAttribute('aria-hidden');
}

function closeDupOverlay(){
  dom.dupOverlay.classList.remove('open'); dom.dupOverlay.setAttribute('aria-hidden','true');
}

function handleDupAdd(){
  var dup=state.dupQueue[state.dupIdx];
  if(dup.detectedQty) dup.existing.qty=dup.existing.qty?dup.existing.qty+' + '+dup.detectedQty:dup.detectedQty;
  saveDespensa(); renderDespensa(); state.dupIdx++; showNextDup();
}

function handleDupUpdate(){
  var dup=state.dupQueue[state.dupIdx];
  if(dup.detectedQty){ dup.existing.qty=dup.detectedQty; saveDespensa(); renderDespensa(); }
  state.dupIdx++; showNextDup();
}

function handleDupSkip(){ state.dupIdx++; showNextDup(); }

/* ══════════════════════════════════════════════════════
   OCR
══════════════════════════════════════════════════════ */
function processScanFile(file,target){
  var progressEl=target==='buscar'?dom.ocrProgress:dom.dspOcrProgress;
  var barEl=target==='buscar'?dom.progressBar:dom.dspProgressBar;
  var statusEl=target==='buscar'?dom.ocrStatus:dom.dspOcrStatus;
  progressEl.style.display='block'; statusEl.textContent='Analizando imagen…'; barEl.style.width='10%';
  var reader=new FileReader();
  reader.onload=function(e){
    var dataUrl=e.target.result;
    function runOcr(){
      Tesseract.recognize(dataUrl,'spa+eng',{
        logger:function(m){ if(m.status==='recognizing text') barEl.style.width=Math.round(m.progress*100)+'%'; }
      }).then(function(result){
        barEl.style.width='100%'; statusEl.textContent='Listo';
        setTimeout(function(){ progressEl.style.display='none'; },1000);
        var words=result.data.text.split(/[\s,;:\n\r\t()\[\]{}|\/\\]+/)
          .map(function(w){ return w.replace(/[^a-zA-Zà-ø]/g,'').trim().toLowerCase(); })
          .filter(function(w){ return w.length>3; });
        var unique=[];
        words.forEach(function(w){ if(unique.indexOf(w)<0) unique.push(w); });
        if(!unique.length){ showToast('No se detectaron ingredientes'); return; }
        showOcrReview(unique, target);
      }).catch(function(){ progressEl.style.display='none'; showToast('Error al analizar la imagen'); });
    }
    if(typeof Tesseract==='undefined'){
      var s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload=runOcr; document.head.appendChild(s);
    } else { runOcr(); }
  };
  reader.readAsDataURL(file);
}

function processScanResultsBuscar(words){
  var added=0;
  words.forEach(function(w){
    var n=norm(w);
    if(!state.ingredients.some(function(i){ return norm(i.name)===n; })){
      state.ingredients.push({id:genId(),name:n,qty:''}); added++;
    }
  });
  renderIngredients(); saveIngredients();
  showToast(added?'✓ '+added+' ingrediente(s) detectado(s)':'Sin ingredientes nuevos');
}

function processScanResultsDespensa(words){
  var newItems=[],dups=[];
  words.forEach(function(w){
    var n=norm(w);
    var existing=state.despensa.find(function(i){ return norm(i.name)===n; });
    if(existing) dups.push({name:n,existing:existing,detectedQty:''});
    else newItems.push(n);
  });
  newItems.forEach(function(n){ state.despensa.push({id:genId(),name:n,qty:''}); });
  renderDespensa(); saveDespensa();
  if(newItems.length) showToast('✓ '+newItems.length+' nuevo(s) añadido(s)');
  if(dups.length){ state.dupQueue=dups; state.dupIdx=0; showNextDup(); }
}

function showOcrReview(words,target){
  state.ocrTarget=target;
  dom.ocrReviewList.innerHTML='';
  words.forEach(function(w){
    var label=document.createElement('label'); label.className='ocr-word-row';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=true; cb.value=w;
    var span=document.createElement('span'); span.textContent=w;
    label.appendChild(cb); label.appendChild(span);
    dom.ocrReviewList.appendChild(label);
  });
  dom.ocrReviewOverlay.classList.add('open');
  dom.ocrReviewOverlay.removeAttribute('aria-hidden');
}
function closeOcrReview(){
  dom.ocrReviewOverlay.classList.remove('open');
  dom.ocrReviewOverlay.setAttribute('aria-hidden','true');
}
function confirmOcrReview(){
  var selected=Array.from(dom.ocrReviewList.querySelectorAll('input:checked')).map(function(cb){ return cb.value; });
  closeOcrReview();
  if(!selected.length){ showToast('Sin ingredientes seleccionados'); return; }
  if(state.ocrTarget==='buscar') processScanResultsBuscar(selected);
  else processScanResultsDespensa(selected);
}

/* ══════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════ */
function initModal(){
  dom.modalOverlay.addEventListener('click',function(e){ if(e.target===dom.modalOverlay) closeModal(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&state.currentModal) closeModal(); });
}

function openModal(id){
  state.currentModal=id;
  dom.modalContent.innerHTML=
    '<button class="modal-close" onclick="closeModal()" aria-label="Cerrar">×</button>'+
    '<div class="state-ph"><div class="spinner"></div><p>Cargando receta…</p></div>';
  dom.modalOverlay.classList.add('open'); dom.modalOverlay.removeAttribute('aria-hidden');
  document.body.style.overflow='hidden';
  fetchDetails(id).then(function(r){
    if(!r||r.status==='failure'){
      dom.modalContent.innerHTML='<button class="modal-close" onclick="closeModal()">×</button><p style="padding:2rem">Error cargando receta.</p>';
      return;
    }
    renderModal(r);
  });
}

function closeModal(){
  state.currentModal=null;
  dom.modalOverlay.classList.remove('open'); dom.modalOverlay.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}

function renderModal(r){
  var isFav=isFavorita(r.id);
  var ingsHtml='';
  if(r.extendedIngredients&&r.extendedIngredients.length){
    ingsHtml='<ul class="modal-ings">'+r.extendedIngredients.map(function(ing){
      var amt=ing.amount?(Math.round(ing.amount*100)/100)+' '+(ing.unit||'')+' ':'';
      return '<li>'+amt+ing.name+'</li>';
    }).join('')+'</ul>';
  }
  var instrHtml='';
  if(r.analyzedInstructions&&r.analyzedInstructions.length&&r.analyzedInstructions[0].steps&&r.analyzedInstructions[0].steps.length){
    instrHtml='<ol class="modal-steps">'+r.analyzedInstructions[0].steps.map(function(s){ return '<li>'+s.step+'</li>'; }).join('')+'</ol>';
  } else if(r.instructions){
    instrHtml='<p class="modal-plain-instr">'+r.instructions.replace(/<[^>]+>/g,'')+'</p>';
  }
  var meta=[];
  if(r.readyInMinutes) meta.push('⏱ '+r.readyInMinutes+' min');
  if(r.servings) meta.push('🍽 '+r.servings+' porciones');

  dom.modalContent.innerHTML=
    '<button class="modal-close" onclick="closeModal()" aria-label="Cerrar">×</button>'+
    (r.image?'<img class="modal-img" src="'+r.image+'" alt="'+r.title+'">':'')+
    '<div class="modal-body">'+
      '<div class="modal-title-row">'+
        '<h2 class="modal-title">'+r.title+'</h2>'+
        '<button class="card-fav-btn'+(isFav?' active':'')+'" id="mfav">'+(isFav?'❤️':'🤍')+'</button>'+
      '</div>'+
      (meta.length?'<div class="modal-meta">'+meta.map(function(m){ return '<span>'+m+'</span>'; }).join('')+'</div>':'')+
      (ingsHtml?'<h3 class="modal-section-title">Ingredientes</h3>'+ingsHtml:'')+
      (instrHtml?'<h3 class="modal-section-title">Preparación</h3>'+instrHtml:'')+
      (r.sourceUrl?'<a href="'+r.sourceUrl+'" target="_blank" rel="noopener" class="modal-source-link">Ver receta completa →</a>':'')+
    '</div>';

  document.getElementById('mfav').addEventListener('click',function(){
    toggleFavorita({id:r.id,title:r.title,image:r.image});
    var btn=document.getElementById('mfav');
    if(btn){ var f=isFavorita(r.id); btn.textContent=f?'❤️':'🤍'; btn.classList.toggle('active',f); }
  });
}

/* ══════════════════════════════════════════════════════
   API – Spoonacular
══════════════════════════════════════════════════════ */
function fetchByIngredients(ingList){
  var names=ingList.map(function(i){ return translate(norm(i.name)); }).join(',');
  if(state.searchCache.has(names)) return Promise.resolve(state.searchCache.get(names));
  var url=SPOON_BASE+'/recipes/findByIngredients?apiKey='+SPOON_KEY+
    '&ingredients='+encodeURIComponent(names)+'&number=50&ranking=1&ignorePantry=true';
  return fetch(url).then(function(r){ return r.json(); })
    .then(function(d){ var res=Array.isArray(d)?d:[]; state.searchCache.set(names,res); return res; })
    .catch(function(){ return []; });
}

function fetchDetails(id){
  if(state.detailCache.has(id)) return Promise.resolve(state.detailCache.get(id));
  var url=SPOON_BASE+'/recipes/'+id+'/information?apiKey='+SPOON_KEY+'&includeNutrition=false';
  return fetch(url).then(function(r){ return r.json(); })
    .then(function(d){ state.detailCache.set(id,d); return d; })
    .catch(function(){ return null; });
}

/* ══════════════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════════════ */
function searchRecipes(){
  if(!state.ingredients.length){ showToast('Añade al menos un ingrediente'); return; }
  if(state.loading) return;
  state.loading=true; dom.searchBtn.disabled=true;
  showLoadingState(dom.recipesGrid,dom.resultCount);
  dom.resultsSection.style.display='block';
  fetchByIngredients(state.ingredients)
    .then(function(r){ state.recipes=r; renderRecipeCards(r,state.ingredients.length,dom.recipesGrid,dom.resultCount); })
    .catch(function(){ showErrorState(dom.recipesGrid); })
    .then(function(){ state.loading=false; dom.searchBtn.disabled=!state.ingredients.length; });
}

function buscarConDespensa(){
  if(!state.despensa.length){ showToast('Añade ingredientes a tu despensa primero'); return; }
  if(state.dspLoading) return;
  state.dspLoading=true; dom.dspSearchBtn.disabled=true;
  showLoadingState(dom.dspRecipesGrid,dom.dspResultCount);
  dom.dspResultsSection.style.display='block';
  fetchByIngredients(state.despensa)
    .then(function(r){ state.dspRecipes=r; renderRecipeCards(r,state.despensa.length,dom.dspRecipesGrid,dom.dspResultCount); })
    .catch(function(){ showErrorState(dom.dspRecipesGrid); })
    .then(function(){ state.dspLoading=false; dom.dspSearchBtn.disabled=!state.despensa.length; });
}

/* ══════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════ */
function showLoadingState(grid,counter){
  counter.textContent='';
  grid.innerHTML='<div class="state-ph"><div class="spinner"></div><p>Buscando recetas…</p></div>';
}

function showErrorState(grid){
  grid.innerHTML='<div class="state-ph"><div class="state-icon">😕</div><h3>Error de conexión</h3><p>Revisa tu internet e inténtalo de nuevo.</p></div>';
}

function renderRecipeCards(recipes,totalIng,grid,counter){
  if(!recipes.length){
    counter.textContent='0 recetas';
    grid.innerHTML='<div class="state-ph"><div class="state-icon">🔍</div><h3>Sin resultados</h3><p>Prueba con otros ingredientes o en inglés (chicken, tomato…).</p></div>';
    return;
  }
  counter.textContent=recipes.length+' receta'+(recipes.length!==1?'s':'');
  grid.innerHTML='';
  recipes.forEach(function(r,i){ grid.appendChild(buildCard(r,totalIng,i,false)); });
}

function buildCard(recipe,totalIng,idx,isFavCard){
  var used=recipe.usedIngredientCount!==undefined?recipe.usedIngredientCount:1;
  var missed=recipe.missedIngredientCount!==undefined?recipe.missedIngredientCount:0;
  var matchPct=totalIng>0?Math.round((used/totalIng)*100):100;
  var bClass=matchPct>=60?'match-high':(matchPct>=30?'match-mid':'match-low');
  var isFav=isFavorita(recipe.id);

  var card=document.createElement('div');
  card.className='recipe-card';
  card.style.animationDelay=Math.min(idx*40,400)+'ms';
  card.setAttribute('role','button'); card.setAttribute('tabindex','0');
  card.setAttribute('aria-label',recipe.title);

  var imgWrap=document.createElement('div');
  imgWrap.className='card-img-wrap';
  var img=document.createElement('img');
  img.src=recipe.image||''; img.alt=recipe.title; img.loading='lazy';
  imgWrap.appendChild(img);

  if(!isFavCard){
    var badge=document.createElement('span');
    badge.className='match-badge '+bClass;
    badge.textContent=used+'/'+totalIng+' ingr.';
    imgWrap.appendChild(badge);
  }

  var body=document.createElement('div'); body.className='card-body';
  var title=document.createElement('h3'); title.className='card-title'; title.textContent=recipe.title;
  var favBtn=document.createElement('button');
  favBtn.className='card-fav-btn'+(isFav?' active':'');
  favBtn.textContent=isFav?'❤️':'🤍';
  favBtn.addEventListener('click',function(e){
    e.stopPropagation();
    toggleFavorita({id:recipe.id,title:recipe.title,image:recipe.image});
    var f=isFavorita(recipe.id); favBtn.textContent=f?'❤️':'🤍'; favBtn.classList.toggle('active',f);
  });

  body.appendChild(title);
  if(!isFavCard&&missed>0){
    var missedEl=document.createElement('p'); missedEl.className='card-missed';
    missedEl.textContent='Te faltan '+missed+' ingrediente'+(missed!==1?'s':'');
    body.appendChild(missedEl);
  }
  body.appendChild(favBtn);
  card.appendChild(imgWrap); card.appendChild(body);
  card.addEventListener('click',function(){ openModal(recipe.id); });
  card.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' ') openModal(recipe.id); });
  return card;
}

/* ══════════════════════════════════════════════════════
   PWA + SW
══════════════════════════════════════════════════════ */
var deferredPrompt=null;
function initPwa(){
  var banner=document.getElementById('install-banner');
  var installBtn=document.getElementById('install-btn');
  var dismiss=document.getElementById('dismiss-install');
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); deferredPrompt=e; if(banner) banner.style.display='flex';
  });
  if(installBtn) installBtn.addEventListener('click',function(){
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(){ deferredPrompt=null; if(banner) banner.style.display='none'; });
  });
  if(dismiss) dismiss.addEventListener('click',function(){ if(banner) banner.style.display='none'; });
}

function initSW(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(function(reg){
    reg.addEventListener('updatefound',function(){
      var sw=reg.installing;
      sw.addEventListener('statechange',function(){
        if(sw.state==='installed'&&navigator.serviceWorker.controller) showToast('Nueva versión disponible — recarga la página');
      });
    });
  });
}

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',function(){
  initDom();
  loadIngredients(); loadFavoritas(); loadDespensa();
  initTabs(); initBuscar(); initDespensa(); initModal(); initPwa(); initSW();
  renderIngredients(); renderFavoritas(); renderDespensa();
});
