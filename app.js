'use strict';

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
var state = {
  ingredients:  [],   // buscar tab  [{id,name,qty}]
  recipes:      [],
  cache:        new Map(),
  detailCache:  new Map(),
  loading:      false,
  currentModal: null,   // mealId string or null
  pendingName:  '',     // buscar qty pending
  currentTab:   'buscar',
  favoritas:    [],     // [{idMeal,strMeal,strMealThumb}]
  despensa:     [],     // [{id,name,qty}]
  dspPendingName: '',
  dspLoading:   false,
  dspRecipes:   [],
  dupQueue:     [],     // [{name, detectedQty, existing}]
  dupIdx:       0
};

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
var API_BASE  = 'https://www.themealdb.com/api/json/v1/1';
var LS_KEY    = 'cocinafacil_v2';
var LS_FAV    = 'cocinafacil_favoritas';
var LS_DSP    = 'cocinafacil_despensa';

var ICON_COLORS = [
  '#16a34a','#ea580c','#2563eb','#9333ea',
  '#dc2626','#0891b2','#b45309','#0f766e',
  '#7c3aed','#c2410c','#0369a1','#15803d'
];

/* Spanish -> English for TheMealDB */
var ES_EN = {
  'pollo':'chicken','pechuga':'chicken breast','muslo':'chicken thigh',
  'carne':'beef','carne molida':'ground beef','res':'beef',
  'cerdo':'pork','ternera':'veal','cordero':'lamb','pavo':'turkey',
  'salmon':'salmon','atun':'tuna','bacalao':'cod',
  'camaron':'shrimp','camarones':'shrimp','langostino':'prawn',
  'mejillon':'mussel','pulpo':'octopus',
  'tomate':'tomato','jitomate':'tomato',
  'cebolla':'onion','cebolleta':'spring onion','cebollino':'chives',
  'ajo':'garlic','jengibre':'ginger',
  'patata':'potato','papa':'potato','papas':'potato','patatas':'potato',
  'zanahoria':'carrot','zanahorias':'carrot',
  'pimiento':'pepper','chile':'chili pepper','jalapeño':'jalapeno',
  'pepino':'cucumber','calabacin':'zucchini','calabaza':'pumpkin',
  'berenjena':'eggplant','brocoli':'broccoli','coliflor':'cauliflower',
  'espinaca':'spinach','espinacas':'spinach','lechuga':'lettuce',
  'apio':'celery','puerro':'leek','nabo':'turnip',
  'champinon':'mushroom','seta':'mushroom','hongos':'mushroom',
  'maiz':'corn','elote':'corn','guisantes':'peas','arveja':'pea',
  'frijol':'beans','frijoles':'beans','lentejas':'lentils','garbanzos':'chickpeas',
  'aguacate':'avocado','palta':'avocado',
  'limon':'lemon','lima':'lime','naranja':'orange','manzana':'apple',
  'platano':'banana','pina':'pineapple','mango':'mango',
  'fresa':'strawberry','frambuesa':'raspberry','sandia':'watermelon',
  'huevo':'egg','huevos':'egg',
  'leche':'milk','crema':'cream','nata':'cream',
  'queso':'cheese','mantequilla':'butter','margarina':'margarine','yogur':'yogurt',
  'jamon':'ham','tocino':'bacon','chorizo':'chorizo','salchicha':'sausage',
  'arroz':'rice','pasta':'pasta','fideos':'noodles','macarrones':'macaroni',
  'harina':'flour','pan':'bread','pan rallado':'breadcrumbs',
  'azucar':'sugar','sal':'salt','aceite':'oil','aceite de oliva':'olive oil',
  'vinagre':'vinegar','mostaza':'mustard','mayonesa':'mayonnaise',
  'ketchup':'ketchup','salsa':'sauce',
  'cilantro':'coriander','perejil':'parsley','albahaca':'basil',
  'oregano':'oregano','tomillo':'thyme','romero':'rosemary',
  'comino':'cumin','paprika':'paprika','canela':'cinnamon',
  'pimienta':'black pepper','curry':'curry','curcuma':'turmeric',
  'caldo':'stock','vino':'wine','cerveza':'beer'
};

var STOP_WORDS = new Set([
  'de','la','el','los','las','un','una','y','o','con','sin','del','al',
  'en','por','para','que','como','ml','gr','mg','kg','litros','lts',
  'porciones','fecha','caducidad','ingredientes','elaborado','fabricado',
  'conservar','consumir','antes','lote','exp','best','before','the','and',
  'or','with','from','contains','may','use','by','per','each'
]);

/* ══════════════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════════════ */
var dom = {};
function $el(sel) { return document.querySelector(sel); }

function initDom() {
  dom.pageTitle       = $el('#page-title');
  /* buscar tab */
  dom.input           = $el('#ingredient-input');
  dom.addBtn          = $el('#add-btn');
  dom.searchBtn       = $el('#search-btn');
  dom.ingredientsList = $el('#ingredients-list');
  dom.emptyHint       = $el('#empty-hint');
  dom.clearAllBtn     = $el('#clear-all-btn');
  dom.cameraBtn       = $el('#camera-btn');
  dom.ocrInput        = $el('#ocr-input');
  dom.ocrProgress     = $el('#ocr-progress');
  dom.progressBar     = $el('#progress-bar');
  dom.ocrStatus       = $el('#ocr-status');
  dom.resultsSection  = $el('#results-section');
  dom.recipesGrid     = $el('#recipes-grid');
  dom.resultCount     = $el('#result-count');
  /* favoritas tab */
  dom.favGrid         = $el('#fav-grid');
  dom.favEmpty        = $el('#fav-empty');
  dom.favCount        = $el('#fav-count');
  /* despensa tab */
  dom.dspInput        = $el('#dsp-input');
  dom.dspAddBtn       = $el('#dsp-add-btn');
  dom.dspCameraBtn    = $el('#dsp-camera-btn');
  dom.dspOcrInput     = $el('#dsp-ocr-input');
  dom.dspOcrProgress  = $el('#dsp-ocr-progress');
  dom.dspProgressBar  = $el('#dsp-progress-bar');
  dom.dspOcrStatus    = $el('#dsp-ocr-status');
  dom.despensaList    = $el('#despensa-list');
  dom.dspEmptyHint    = $el('#dsp-empty-hint');
  dom.dspClearBtn     = $el('#dsp-clear-btn');
  dom.dspSearchBtn    = $el('#dsp-search-btn');
  dom.dspResultsSection = $el('#dsp-results-section');
  dom.dspRecipesGrid  = $el('#dsp-recipes-grid');
  dom.dspResultCount  = $el('#dsp-result-count');
  /* overlays */
  dom.modalOverlay    = $el('#modal-overlay');
  dom.modalContent    = $el('#modal-content');
  dom.qtyOverlay      = $el('#qty-overlay');
  dom.qtyIngName      = $el('#qty-ingredient-name');
  dom.qtyInput        = $el('#qty-input');
  dom.qtySkip         = $el('#qty-skip');
  dom.qtyConfirm      = $el('#qty-confirm');
  dom.dspQtyOverlay   = $el('#dsp-qty-overlay');
  dom.dspQtyName      = $el('#dsp-qty-name');
  dom.dspQtyInput     = $el('#dsp-qty-input');
  dom.dspQtySkip      = $el('#dsp-qty-skip');
  dom.dspQtyConfirm   = $el('#dsp-qty-confirm');
  dom.dupOverlay      = $el('#dup-overlay');
  dom.dupName         = $el('#dup-name');
  dom.dupCurrent      = $el('#dup-current');
  dom.dupDetected     = $el('#dup-detected');
  dom.dupCurrentIdx   = $el('#dup-current-idx');
  dom.dupTotal        = $el('#dup-total');
  dom.dupSkip         = $el('#dup-skip');
  dom.dupAdd          = $el('#dup-add');
  dom.dupUpdate       = $el('#dup-update');
  dom.toast           = $el('#toast');
  dom.installBanner   = $el('#install-banner');
  dom.installBtn      = $el('#install-btn');
  dom.dismissInstall  = $el('#dismiss-install');
}

/* ══════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════ */
function norm(str) { return String(str).trim().toLowerCase().replace(/\s+/g,' '); }
function genId()   { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function translate(name) {
  var clean = name.normalize('NFD').replace(/[̀-ͯ]/g,'');
  return ES_EN[clean] || ES_EN[name] || name;
}
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ══════════════════════════════════════════════
   ICON — colored letter circle
══════════════════════════════════════════════ */
function makeIconEl(name) {
  var letter = name && name[0] ? name[0].toUpperCase() : '?';
  var h = 0;
  for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  var color = ICON_COLORS[Math.abs(h) % ICON_COLORS.length];
  var el = document.createElement('span');
  el.className = 'ing-icon';
  el.style.backgroundColor = color;
  el.textContent = letter;
  el.setAttribute('aria-hidden','true');
  return el;
}

/* ══════════════════════════════════════════════
   BUILD INGREDIENT LIST ITEM (shared)
══════════════════════════════════════════════ */
function makeIngItem(ing, onRemove) {
  var li = document.createElement('li');
  li.className = 'ingredient-item';

  li.appendChild(makeIconEl(ing.name));

  var infoEl = document.createElement('div');
  infoEl.className = 'ing-info';
  var nameEl = document.createElement('div');
  nameEl.className = 'ing-name';
  nameEl.textContent = ing.name;
  infoEl.appendChild(nameEl);
  if (ing.qty) {
    var qtyEl = document.createElement('div');
    qtyEl.className = 'ing-qty';
    qtyEl.textContent = ing.qty;
    infoEl.appendChild(qtyEl);
  }

  var delBtn = document.createElement('button');
  delBtn.className = 'ing-remove';
  delBtn.setAttribute('aria-label', 'Eliminar ' + ing.name);
  delBtn.dataset.id = ing.id;
  delBtn.innerHTML = '&times;';
  delBtn.addEventListener('click', function() { onRemove(ing.id); });

  li.appendChild(infoEl);
  li.appendChild(delBtn);
  return li;
}

/* ══════════════════════════════════════════════
   TAB SYSTEM
══════════════════════════════════════════════ */
var TAB_TITLES = {
  buscar:    'CocinaFácil',
  favoritas: 'Mis Favoritas',
  despensa:  'Tu Despensa'
};

function switchTab(tabName) {
  if (state.currentTab === tabName) return;
  state.currentTab = tabName;
  document.querySelectorAll('.tab-content').forEach(function(el) {
    el.classList.remove('active');
  });
  document.getElementById('tab-' + tabName).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    var active = btn.dataset.tab === tabName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  dom.pageTitle.textContent = TAB_TITLES[tabName] || 'CocinaFácil';
}

/* ══════════════════════════════════════════════
   PERSISTENCE
══════════════════════════════════════════════ */
function saveIngredients() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.ingredients)); } catch(e) {}
}
function loadIngredients() {
  try {
    var saved = localStorage.getItem(LS_KEY);
    if (!saved) return;
    var list = JSON.parse(saved);
    if (Array.isArray(list)) state.ingredients = list.filter(function(i){ return i && i.name; });
  } catch(e) {}
}
function saveFavoritas() {
  try { localStorage.setItem(LS_FAV, JSON.stringify(state.favoritas)); } catch(e) {}
}
function loadFavoritas() {
  try {
    var saved = localStorage.getItem(LS_FAV);
    if (!saved) return;
    var list = JSON.parse(saved);
    if (Array.isArray(list)) state.favoritas = list;
  } catch(e) {}
}
function saveDespensa() {
  try { localStorage.setItem(LS_DSP, JSON.stringify(state.despensa)); } catch(e) {}
}
function loadDespensa() {
  try {
    var saved = localStorage.getItem(LS_DSP);
    if (!saved) return;
    var list = JSON.parse(saved);
    if (Array.isArray(list)) state.despensa = list.filter(function(i){ return i && i.name; });
  } catch(e) {}
}

/* ══════════════════════════════════════════════
   BUSCAR — ingredients
══════════════════════════════════════════════ */
function openQtySheet(name) {
  state.pendingName = name;
  dom.qtyIngName.textContent = name;
  dom.qtyInput.value = '';
  dom.qtyOverlay.classList.add('open');
  dom.qtyOverlay.removeAttribute('aria-hidden');
  setTimeout(function(){ dom.qtyInput.focus(); }, 350);
}
function closeQtySheet() {
  dom.qtyOverlay.classList.remove('open');
  dom.qtyOverlay.setAttribute('aria-hidden','true');
  state.pendingName = '';
}
function confirmIngredient(qty) {
  var name = state.pendingName;
  if (!name) return;
  var n = norm(name);
  if (state.ingredients.some(function(i){ return norm(i.name) === n; })) {
    showToast('"' + n + '" ya está en la lista');
    closeQtySheet(); return;
  }
  state.ingredients.push({ id: genId(), name: n, qty: qty || '' });
  renderIngredients();
  saveIngredients();
  closeQtySheet();
  showToast('✓ ' + n + (qty ? ' — ' + qty : '') + ' añadido');
}
function removeIngredient(id) {
  state.ingredients = state.ingredients.filter(function(i){ return i.id !== id; });
  renderIngredients();
  saveIngredients();
}
function clearAll() {
  state.ingredients = [];
  state.recipes = [];
  renderIngredients();
  saveIngredients();
  dom.resultsSection.style.display = 'none';
}
function renderIngredients() {
  dom.ingredientsList.innerHTML = '';
  if (!state.ingredients.length) {
    dom.emptyHint.style.display = 'block';
    dom.searchBtn.disabled = true;
    return;
  }
  dom.emptyHint.style.display = 'none';
  dom.searchBtn.disabled = false;
  state.ingredients.forEach(function(ing) {
    dom.ingredientsList.appendChild(makeIngItem(ing, removeIngredient));
  });
}

/* ══════════════════════════════════════════════
   FAVORITAS
══════════════════════════════════════════════ */
function isFavorita(mealId) {
  return state.favoritas.some(function(f){ return f.idMeal === mealId; });
}
function addToFavoritas(recipe) {
  if (isFavorita(recipe.idMeal)) return;
  state.favoritas.unshift({
    idMeal:       recipe.idMeal,
    strMeal:      recipe.strMeal,
    strMealThumb: recipe.strMealThumb
  });
  saveFavoritas();
  renderFavoritas();
}
function removeFromFavoritas(mealId) {
  state.favoritas = state.favoritas.filter(function(f){ return f.idMeal !== mealId; });
  saveFavoritas();
  renderFavoritas();
}
function toggleFavorita(recipe) {
  if (isFavorita(recipe.idMeal)) {
    removeFromFavoritas(recipe.idMeal);
    showToast('Eliminada de favoritas');
    return false;
  } else {
    addToFavoritas(recipe);
    showToast('❤️ Guardada en favoritas');
    return true;
  }
}
function renderFavoritas() {
  dom.favGrid.innerHTML = '';
  if (!state.favoritas.length) {
    dom.favEmpty.style.display = 'block';
    dom.favCount.textContent = '';
    return;
  }
  dom.favEmpty.style.display = 'none';
  dom.favCount.textContent = state.favoritas.length + ' receta' + (state.favoritas.length !== 1 ? 's' : '');
  state.favoritas.forEach(function(f, i) { dom.favGrid.appendChild(buildFavCard(f, i)); });
}
function buildFavCard(recipe, idx) {
  var card = document.createElement('div');
  card.className = 'recipe-card';
  card.style.animationDelay = Math.min(idx * 40, 300) + 'ms';
  card.setAttribute('role','button');
  card.setAttribute('tabindex','0');
  card.setAttribute('aria-label', recipe.strMeal);

  var imgWrap = document.createElement('div');
  imgWrap.className = 'card-img';
  var img = document.createElement('img');
  img.src = recipe.strMealThumb + '/preview';
  img.alt = recipe.strMeal;
  img.loading = 'lazy';
  imgWrap.appendChild(img);

  var body = document.createElement('div');
  body.className = 'card-body';
  var title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = recipe.strMeal;
  body.appendChild(title);

  var favBtn = document.createElement('button');
  favBtn.className = 'card-fav-btn is-fav';
  favBtn.setAttribute('aria-label', 'Quitar de favoritas');
  favBtn.innerHTML = '❤️';
  favBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    removeFromFavoritas(recipe.idMeal);
    showToast('Eliminada de favoritas');
  });

  card.appendChild(imgWrap);
  card.appendChild(body);
  card.appendChild(favBtn);

  function openModal() { openRecipeModal(recipe.idMeal, recipe); }
  card.addEventListener('click', openModal);
  card.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') openModal(); });
  return card;
}

/* ══════════════════════════════════════════════
   DESPENSA
══════════════════════════════════════════════ */
function openDspQtySheet(name) {
  state.dspPendingName = name;
  dom.dspQtyName.textContent = name;
  dom.dspQtyInput.value = '';
  dom.dspQtyOverlay.classList.add('open');
  dom.dspQtyOverlay.removeAttribute('aria-hidden');
  setTimeout(function(){ dom.dspQtyInput.focus(); }, 350);
}
function closeDspQtySheet() {
  dom.dspQtyOverlay.classList.remove('open');
  dom.dspQtyOverlay.setAttribute('aria-hidden','true');
  state.dspPendingName = '';
}
function confirmDespensa(qty) {
  var name = state.dspPendingName;
  if (!name) return;
  var n = norm(name);
  if (state.despensa.some(function(i){ return norm(i.name) === n; })) {
    showToast('"' + n + '" ya está en tu despensa');
    closeDspQtySheet(); return;
  }
  state.despensa.push({ id: genId(), name: n, qty: qty || '' });
  renderDespensa();
  saveDespensa();
  closeDspQtySheet();
  showToast('✓ ' + n + (qty ? ' — ' + qty : '') + ' añadido a despensa');
}
function removeDespensa(id) {
  state.despensa = state.despensa.filter(function(i){ return i.id !== id; });
  renderDespensa();
  saveDespensa();
}
function clearDespensa() {
  state.despensa = [];
  state.dspRecipes = [];
  renderDespensa();
  saveDespensa();
  dom.dspResultsSection.style.display = 'none';
}
function renderDespensa() {
  dom.despensaList.innerHTML = '';
  if (!state.despensa.length) {
    dom.dspEmptyHint.style.display = 'block';
    dom.dspSearchBtn.disabled = true;
    return;
  }
  dom.dspEmptyHint.style.display = 'none';
  dom.dspSearchBtn.disabled = false;
  state.despensa.forEach(function(ing) {
    dom.despensaList.appendChild(makeIngItem(ing, removeDespensa));
  });
}

/* ══════════════════════════════════════════════
   DESPENSA — duplicate detection overlay
══════════════════════════════════════════════ */
function showNextDup() {
  if (state.dupIdx >= state.dupQueue.length) {
    closeDupOverlay();
    showToast('Despensa actualizada');
    return;
  }
  var dup = state.dupQueue[state.dupIdx];
  dom.dupName.textContent = dup.name;
  dom.dupCurrent.textContent  = dup.existing.qty  || 'Sin cantidad especificada';
  dom.dupDetected.textContent = dup.detectedQty   || 'No especificado';
  dom.dupCurrentIdx.textContent = state.dupIdx + 1;
  dom.dupTotal.textContent      = state.dupQueue.length;
  dom.dupOverlay.classList.add('open');
  dom.dupOverlay.removeAttribute('aria-hidden');
}
function closeDupOverlay() {
  dom.dupOverlay.classList.remove('open');
  dom.dupOverlay.setAttribute('aria-hidden','true');
}
function handleDupAdd() {
  var dup = state.dupQueue[state.dupIdx];
  if (dup.detectedQty && dup.detectedQty !== 'No especificado') {
    dup.existing.qty = dup.existing.qty
      ? dup.existing.qty + ' + ' + dup.detectedQty
      : dup.detectedQty;
  }
  saveDespensa(); renderDespensa();
  state.dupIdx++; showNextDup();
}
function handleDupUpdate() {
  var dup = state.dupQueue[state.dupIdx];
  if (dup.detectedQty && dup.detectedQty !== 'No especificado') {
    dup.existing.qty = dup.detectedQty;
    saveDespensa(); renderDespensa();
  }
  state.dupIdx++; showNextDup();
}
function handleDupSkip() {
  state.dupIdx++; showNextDup();
}

/* ══════════════════════════════════════════════
   API — TheMealDB
══════════════════════════════════════════════ */
function fetchByIngredient(rawName) {
  var apiName = translate(norm(rawName));
  if (state.cache.has(apiName)) return Promise.resolve(state.cache.get(apiName));
  return fetch(API_BASE + '/filter.php?i=' + encodeURIComponent(apiName))
    .then(function(r){ return r.json(); })
    .then(function(d){
      var meals = d.meals || [];
      state.cache.set(apiName, meals);
      return meals;
    })
    .catch(function(){ state.cache.set(apiName, []); return []; });
}
function fetchDetails(mealId) {
  if (state.detailCache.has(mealId)) return Promise.resolve(state.detailCache.get(mealId));
  return fetch(API_BASE + '/lookup.php?i=' + mealId)
    .then(function(r){ return r.json(); })
    .then(function(d){
      var meal = d.meals ? d.meals[0] : null;
      state.detailCache.set(mealId, meal);
      return meal;
    })
    .catch(function(){ return null; });
}
function getMealIngredients(meal) {
  var list = [];
  for (var i = 1; i <= 20; i++) {
    var n = meal['strIngredient' + i];
    var m = meal['strMeasure' + i];
    if (n && n.trim()) list.push({ name: n.trim(), measure: (m || '').trim() });
  }
  return list;
}

/* ══════════════════════════════════════════════
   SEARCH — buscar tab
══════════════════════════════════════════════ */
function searchRecipes() {
  if (!state.ingredients.length) { showToast('Añade al menos un ingrediente'); return; }
  if (state.loading) return;
  state.loading = true;
  dom.searchBtn.disabled = true;
  showLoadingState(dom.recipesGrid, dom.resultCount);
  dom.resultsSection.style.display = 'block';

  runSearch(state.ingredients, function(scored) {
    state.recipes = scored;
    renderRecipeCards(scored, state.ingredients.length, dom.recipesGrid, dom.resultCount);
  }, function() {
    showErrorState(dom.recipesGrid);
  }, function() {
    state.loading = false;
    dom.searchBtn.disabled = !state.ingredients.length;
  });
}

/* ══════════════════════════════════════════════
   SEARCH — despensa tab
══════════════════════════════════════════════ */
function buscarConDespensa() {
  if (!state.despensa.length) { showToast('Añade ingredientes a tu despensa primero'); return; }
  if (state.dspLoading) return;
  state.dspLoading = true;
  dom.dspSearchBtn.disabled = true;
  showLoadingState(dom.dspRecipesGrid, dom.dspResultCount);
  dom.dspResultsSection.style.display = 'block';

  runSearch(state.despensa, function(scored) {
    state.dspRecipes = scored;
    renderRecipeCards(scored, state.despensa.length, dom.dspRecipesGrid, dom.dspResultCount);
  }, function() {
    showErrorState(dom.dspRecipesGrid);
  }, function() {
    state.dspLoading = false;
    dom.dspSearchBtn.disabled = !state.despensa.length;
  });
}

function runSearch(ingredientList, onSuccess, onError, onFinally) {
  var names = ingredientList.map(function(i){ return i.name; });
  var mealMap = new Map();
  Promise.all(names.map(function(n){ return fetchByIngredient(n); }))
    .then(function(results) {
      results.forEach(function(meals) {
        meals.forEach(function(meal) {
          var id = meal.idMeal;
          if (!mealMap.has(id)) mealMap.set(id, { count: 0, stub: meal });
          mealMap.get(id).count += 1;
        });
      });
      var scored = [];
      mealMap.forEach(function(v) {
        scored.push({
          idMeal:       v.stub.idMeal,
          strMeal:      v.stub.strMeal,
          strMealThumb: v.stub.strMealThumb,
          matchCount:   v.count,
          matchPct:     Math.round((v.count / names.length) * 100)
        });
      });
      scored.sort(function(a,b){
        return b.matchCount - a.matchCount || a.strMeal.localeCompare(b.strMeal);
      });
      onSuccess(scored);
    })
    .catch(function(err) { console.error('[CF]', err); onError(); })
    .then(function() { onFinally(); });
}

/* ══════════════════════════════════════════════
   RENDER RECIPES
══════════════════════════════════════════════ */
function showLoadingState(grid, counter) {
  counter.textContent = '';
  grid.innerHTML = '<div class="state-ph"><div class="spinner"></div><p>Buscando recetas…</p></div>';
}
function showErrorState(grid) {
  grid.innerHTML = '<div class="state-ph">' +
    '<div class="state-icon">😵</div>' +
    '<h3>Error de conexión</h3>' +
    '<p>Revisa tu internet e inténtalo de nuevo.</p></div>';
}
function renderRecipeCards(recipes, totalIngredients, grid, counter) {
  if (!recipes.length) {
    counter.textContent = '0 recetas';
    grid.innerHTML = '<div class="state-ph">' +
      '<div class="state-icon">🔍</div>' +
      '<h3>Sin resultados</h3>' +
      '<p>Prueba con otros ingredientes. Los nombres en inglés funcionan mejor (chicken, tomato, rice…).</p></div>';
    return;
  }
  counter.textContent = recipes.length + ' receta' + (recipes.length !== 1 ? 's' : '');
  grid.innerHTML = '';
  recipes.forEach(function(r, i) { grid.appendChild(buildCard(r, totalIngredients, i)); });
}
function buildCard(recipe, totalIngredients, idx) {
  var bClass = recipe.matchPct >= 60 ? 'match-high' : (recipe.matchPct >= 30 ? 'match-mid' : 'match-low');
  var card = document.createElement('div');
  card.className = 'recipe-card';
  card.style.animationDelay = Math.min(idx * 45, 400) + 'ms';
  card.setAttribute('role','button');
  card.setAttribute('tabindex','0');
  card.setAttribute('aria-label', recipe.strMeal);

  var imgWrap = document.createElement('div');
  imgWrap.c
