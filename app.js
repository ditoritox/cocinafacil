'use strict';

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   STATE
ââââââââââââââââââââââââââââââââââââââââââââââ */
var state = {
  ingredients: [],   // [{ id, name, qty }]
  recipes:     [],
  cache:       new Map(),
  detailCache: new Map(),
  loading:     false,
  currentModal: null,
  pendingName:  ''
};

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   CONSTANTS
ââââââââââââââââââââââââââââââââââââââââââââââ */
var API_BASE = 'https://www.themealdb.com/api/json/v1/1';
var LS_KEY   = 'cocinafacil_v2';

/* Spanish -> English translation so TheMealDB API finds results */
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
  'pimiento':'pepper','chile':'chili pepper','jalapeÃ±o':'jalapeno',
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

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   DOM REFERENCES (initialised in initDom)
ââââââââââââââââââââââââââââââââââââââââââââââ */
var dom = {};

function $el(sel) { return document.querySelector(sel); }

function initDom() {
  dom.input          = $el('#ingredient-input');
  dom.addBtn         = $el('#add-btn');
  dom.searchBtn      = $el('#search-btn');
  dom.ingredientsList= $el('#ingredients-list');
  dom.emptyHint      = $el('#empty-hint');
  dom.clearAllBtn    = $el('#clear-all-btn');
  dom.cameraBtn      = $el('#camera-btn');
  dom.ocrInput       = $el('#ocr-input');
  dom.ocrProgress    = $el('#ocr-progress');
  dom.progressBar    = $el('#progress-bar');
  dom.ocrStatus      = $el('#ocr-status');
  dom.resultsSection = $el('#results-section');
  dom.recipesGrid    = $el('#recipes-grid');
  dom.resultCount    = $el('#result-count');
  dom.modalOverlay   = $el('#modal-overlay');
  dom.modalContent   = $el('#modal-content');
  dom.qtyOverlay     = $el('#qty-overlay');
  dom.qtyIngName     = $el('#qty-ingredient-name');
  dom.qtyInput       = $el('#qty-input');
  dom.qtySkip        = $el('#qty-skip');
  dom.qtyConfirm     = $el('#qty-confirm');
  dom.toast          = $el('#toast');
  dom.installBanner  = $el('#install-banner');
  dom.installBtn     = $el('#install-btn');
  dom.dismissInstall = $el('#dismiss-install');
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   PERSISTENCE
ââââââââââââââââââââââââââââââââââââââââââââââ */
function saveIngredients() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.ingredients)); } catch(e) {}
}

function loadSavedIngredients() {
  try {
    var saved = localStorage.getItem(LS_KEY);
    if (!saved) return;
    var list = JSON.parse(saved);
    if (Array.isArray(list)) {
      state.ingredients = list.filter(function(i) { return i && i.name; });
    }
  } catch(e) {}
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   INGREDIENT HELPERS
ââââââââââââââââââââââââââââââââââââââââââââââ */
function norm(str) { return String(str).trim().toLowerCase().replace(/\s+/g,' '); }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function translate(name) {
  var clean = name.normalize('NFD').replace(/[Ì-Í¯]/g,'');
  return ES_EN[clean] || ES_EN[name] || name;
}

/* ââ Quantity sheet ââ */
function openQtySheet(name) {
  state.pendingName = name;
  dom.qtyIngName.textContent = name;
  dom.qtyInput.value = '';
  dom.qtyOverlay.classList.add('open');
  dom.qtyOverlay.removeAttribute('aria-hidden');
  setTimeout(function() { dom.qtyInput.focus(); }, 350);
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
  var exists = state.ingredients.some(function(i) { return norm(i.name) === n; });
  if (exists) {
    showToast('"' + n + '" ya estÃ¡ en la lista');
    closeQtySheet();
    return;
  }
  state.ingredients.push({ id: genId(), name: n, qty: qty || '' });
  renderIngredients();
  saveIngredients();
  closeQtySheet();
  showToast('â ' + n + (qty ? ' â ' + qty : '') + ' aÃ±adido');
}

function removeIngredient(id) {
  state.ingredients = state.ingredients.filter(function(i) { return i.id !== id; });
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

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   RENDER INGREDIENTS
ââââââââââââââââââââââââââââââââââââââââââââââ */
var ING_ICONS = [
  'ð¥©','ð','ð§','ð¥¦','ð¥',
  'ð§','ð«','ð¥','ð¥','ð',
  'ð¥','ð§','ð½','ð','ð¥',
  'ð§','ð¦','ð¥'
];

function pickIcon(name) {
  var h = 0;
  for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return ING_ICONS[Math.abs(h) % ING_ICONS.length];
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
    var li = document.createElement('li');
    li.className = 'ingredient-item';

    var iconEl = document.createElement('span');
    iconEl.className = 'ing-icon';
    iconEl.setAttribute('aria-hidden','true');
    iconEl.textContent = pickIcon(ing.name);

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
    delBtn.textContent = 'Ã';

    li.appendChild(iconEl);
    li.appendChild(infoEl);
    li.appendChild(delBtn);
    dom.ingredientsList.appendChild(li);
  });
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   API â TheMealDB
ââââââââââââââââââââââââââââââââââââââââââââââ */
function fetchByIngredient(rawName) {
  var apiName = translate(norm(rawName));
  if (state.cache.has(apiName)) return Promise.resolve(state.cache.get(apiName));
  return fetch(API_BASE + '/filter.php?i=' + encodeURIComponent(apiName))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var meals = d.meals || [];
      state.cache.set(apiName, meals);
      return meals;
    })
    .catch(function() { state.cache.set(apiName, []); return []; });
}

function fetchDetails(mealId) {
  if (state.detailCache.has(mealId)) return Promise.resolve(state.detailCache.get(mealId));
  return fetch(API_BASE + '/lookup.php?i=' + mealId)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var meal = d.meals ? d.meals[0] : null;
      state.detailCache.set(mealId, meal);
      return meal;
    })
    .catch(function() { return null; });
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

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   SEARCH & SCORING
ââââââââââââââââââââââââââââââââââââââââââââââ */
function searchRecipes() {
  if (!state.ingredients.length) { showToast('AÃ±ade al menos un ingrediente'); return; }
  if (state.loading) return;

  state.loading = true;
  dom.searchBtn.disabled = true;
  showLoadingState();

  var names = state.ingredients.map(function(i) { return i.name; });
  var mealMap = new Map();

  Promise.all(names.map(function(n) { return fetchByIngredient(n); }))
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
          idMeal: v.stub.idMeal,
          strMeal: v.stub.strMeal,
          strMealThumb: v.stub.strMealThumb,
          matchCount: v.count,
          matchPct: Math.round((v.count / names.length) * 100)
        });
      });
      scored.sort(function(a,b) {
        return b.matchCount - a.matchCount || a.strMeal.localeCompare(b.strMeal);
      });
      state.recipes = scored;
      renderRecipes();
    })
    .catch(function(err) {
      console.error('[CF] search error', err);
      showErrorState();
    })
    .then(function() {
      state.loading = false;
      dom.searchBtn.disabled = !state.ingredients.length;
    });
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   RENDER RECIPES
ââââââââââââââââââââââââââââââââââââââââââââââ */
function showLoadingState() {
  dom.resultsSection.style.display = 'block';
  dom.resultCount.textContent = '';
  dom.recipesGrid.innerHTML = '<div class="state-ph"><div class="spinner"></div><p>Buscando recetasâ¦</p></div>';
}

function showErrorState() {
  dom.recipesGrid.innerHTML = '<div class="state-ph">' +
    '<div class="state-icon">ðµ</div>' +
    '<h3>Error de conexiÃ³n</h3>' +
    '<p>Revisa tu internet e intÃ©ntalo de nuevo.</p></div>';
}

function renderRecipes() {
  dom.resultsSection.style.display = 'block';
  if (!state.recipes.length) {
    dom.resultCount.textContent = '0 recetas';
    dom.recipesGrid.innerHTML = '<div class="state-ph">' +
      '<div class="state-icon">ð</div>' +
      '<h3>Sin resultados</h3>' +
      '<p>Prueba con otros ingredientes. Los nombres de ingredientes en inglÃ©s funcionan mejor (ej. chicken, tomato).</p></div>';
    return;
  }
  dom.resultCount.textContent = state.recipes.length + ' receta' + (state.recipes.length !== 1 ? 's' : '');
  dom.recipesGrid.innerHTML = '';
  state.recipes.forEach(function(r, i) { dom.recipesGrid.appendChild(buildCard(r, i)); });
}

function buildCard(recipe, idx) {
  var bClass = recipe.matchPct >= 60 ? 'match-high' : (recipe.matchPct >= 30 ? 'match-mid' : 'match-low');
  var card = document.createElement('div');
  card.className = 'recipe-card';
  card.style.animationDelay = Math.min(idx * 45, 400) + 'ms';
  card.setAttribute('role','button');
  card.setAttribute('tabindex','0');
  card.setAttribute('aria-label', recipe.strMeal);

  var imgWrap = document.createElement('div');
  imgWrap.className = 'card-img';

  var img = document.createElement('img');
  img.src = recipe.strMealThumb + '/preview';
  img.alt = recipe.strMeal;
  img.loading = 'lazy';

  var badge = document.createElement('span');
  badge.className = 'match-badge ' + bClass;
  badge.textContent = recipe.matchPct + '% coincide';

  imgWrap.appendChild(img);
  imgWrap.appendChild(badge);

  var body = document.createElement('div');
  body.className = 'card-body';

  var title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = recipe.strMeal;

  var meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.textContent = recipe.matchCount + ' de ' + state.ingredients.length +
    ' ingrediente' + (state.ingredients.length !== 1 ? 's' : '');

  body.appendChild(title);
  body.appendChild(meta);
  card.appendChild(imgWrap);
  card.appendChild(body);

  function openModal() { openRecipeModal(recipe.idMeal); }
  card.addEventListener('click', openModal);
  card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') openModal(); });
  return card;
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   MODAL
ââââââââââââââââââââââââââââââââââââââââââââââ */
function openRecipeModal(mealId) {
  state.currentModal = mealId;
  dom.modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  dom.modalContent.innerHTML =
    '<div class="modal-skeleton"></div>' +
    '<div class="modal-body"><div class="spinner"></div><p class="loading-txt">Cargando recetaâ¦</p></div>';

  fetchDetails(mealId).then(function(meal) {
    if (state.currentModal !== mealId) return;
    if (!meal) {
      dom.modalContent.innerHTML =
        '<div class="modal-body">' +
        '<button class="modal-close" id="mc-close" style="position:static;margin-bottom:12px">Ã Cerrar</button>' +
        '<p class="error-txt">No se pudo cargar esta receta.</p></div>';
      document.getElementById('mc-close').addEventListener('click', closeModal);
      return;
    }
    renderModal(meal);
  });
}

function renderModal(meal) {
  var mealIngs = getMealIngredients(meal);
  var userNames = state.ingredients.map(function(i) { return norm(i.name); });

  var chipsHtml = mealIngs.map(function(ing) {
    var n = ing.name.toLowerCase();
    var matched = userNames.some(function(u) {
      return n.includes(u) || u.includes(n) ||
        translate(u).toLowerCase() === n ||
        n.includes(translate(u).toLowerCase());
    });
    var label = ing.measure ? (ing.measure + ' ' + ing.name) : ing.name;
    return '<span class="m-ing' + (matched ? ' matched' : '') + '">' +
      (matched ? 'â ' : '') + escHtml(label) + '</span>';
  }).join('');

  var steps = (meal.strInstructions || '').split(/\r?\n/)
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 10 && !/^step\s*\d+/i.test(s); })
    .slice(0, 20);

  var stepsHtml = (steps.length ? steps : [meal.strInstructions || 'Sin instrucciones.'])
    .map(function(s) { return '<li>' + escHtml(s) + '</li>'; }).join('');

  var matchedCount = mealIngs.filter(function(ing) {
    var n = ing.name.toLowerCase();
    return userNames.some(function(u) {
      return n.includes(u) || u.includes(n) ||
        translate(u).toLowerCase() === n ||
        n.includes(translate(u).toLowerCase());
    });
  }).length;

  var ytBtn = meal.strYoutube
    ? '<a class="yt-btn" href="' + escHtml(meal.strYoutube) + '" target="_blank" rel="noopener">â¶ Ver en YouTube</a>'
    : '';

  dom.modalContent.innerHTML =
    '<div class="modal-hero">' +
    '<img src="' + escHtml(meal.strMealThumb) + '" alt="' + escHtml(meal.strMeal) + '" loading="lazy">' +
    '<button class="modal-close" id="mc-close" aria-label="Cerrar">Ã</button>' +
    '</div>' +
    '<div class="modal-body">' +
    '<h2 class="modal-title">' + escHtml(meal.strMeal) + '</h2>' +
    '<p class="modal-meta">' +
    escHtml(meal.strArea || 'Internacional') + ' Â· ' +
    escHtml(meal.strCategory || 'General') + ' Â· ' +
    matchedCount + '/' + mealIngs.length + ' ingredientes coinciden' +
    '</p>' +
    '<div class="modal-section">Ingredientes</div>' +
    '<div class="m-ings">' + chipsHtml + '</div>' +
    '<div class="modal-section">Instrucciones</div>' +
    '<ol class="m-steps">' + stepsHtml + '</ol>' +
    ytBtn +
    '</div>';

  document.getElementById('mc-close').addEventListener('click', closeModal);
}

function closeModal() {
  state.currentModal = null;
  dom.modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   OCR â Tesseract.js
ââââââââââââââââââââââââââââââââââââââââââââââ */
function processOCR(file) {
  if (!window.Tesseract) { showToast('OCR aÃºn cargando, espera un momento'); return; }

  dom.ocrProgress.classList.add('active');
  dom.progressBar.style.width = '0%';
  dom.ocrStatus.textContent = 'Analizando imagenâ¦';

  Tesseract.recognize(file, 'spa+eng', {
    logger: function(m) {
      if (m.status === 'recognizing text') {
        var pct = Math.round((m.progress || 0) * 100);
        dom.progressBar.style.width = pct + '%';
        dom.ocrStatus.textContent = 'Procesando ' + pct + '%';
      }
    }
  }).then(function(r) {
    var words = extractWords(r.data.text);
    if (!words.length) { showToast('No se detectaron ingredientes en la imagen'); return; }
    var added = 0;
    words.forEach(function(w) {
      var n = norm(w);
      if (n.length < 2) return;
      var exists = state.ingredients.some(function(i) { return norm(i.name) === n; });
      if (!exists) {
        state.ingredients.push({ id: genId(), name: n, qty: '' });
        added++;
      }
    });
    renderIngredients();
    saveIngredients();
    showToast(added > 0
      ? 'â ' + added + ' ingrediente' + (added !== 1 ? 's' : '') + ' detectado' + (added !== 1 ? 's' : '')
      : 'Esos ingredientes ya estaban en la lista');
  }).catch(function(err) {
    console.error('[OCR]', err);
    showToast('Error al procesar la imagen. IntÃ©ntalo de nuevo.');
  }).then(function() {
    dom.ocrProgress.classList.remove('active');
    dom.progressBar.style.width = '0%';
    dom.ocrStatus.textContent = '';
  });
}

function extractWords(text) {
  var tokens = text.toLowerCase()
    .split(/[\s,;:.|()\[\]{}"'!\n\r\t\/\\]+/)
    .map(function(t) { return t.replace(/[^a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]/gi,'').trim(); })
    .filter(function(t) { return t.length >= 3 && !/^\d+$/.test(t) && !STOP_WORDS.has(t); });
  return Array.from(new Set(tokens));
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   TOAST
ââââââââââââââââââââââââââââââââââââââââââââââ */
var toastTimer = null;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { dom.toast.classList.remove('show'); }, 2800);
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   PWA INSTALL BANNER
ââââââââââââââââââââââââââââââââââââââââââââââ */
var deferredPrompt = null;
function initInstallBanner() {
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    dom.installBanner.classList.add('visible');
  });
  dom.installBtn.addEventListener('click', function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(r) {
      if (r.outcome === 'accepted') {
        showToast('â CocinaFÃ¡cil instalada');
        dom.installBanner.classList.remove('visible');
      }
      deferredPrompt = null;
    });
  });
  dom.dismissInstall.addEventListener('click', function() {
    dom.installBanner.classList.remove('visible');
  });
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   UTILITY
ââââââââââââââââââââââââââââââââââââââââââââââ */
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   EVENT WIRING
ââââââââââââââââââââââââââââââââââââââââââââââ */
function wireEvents() {
  /* Add ingredient */
  dom.addBtn.addEventListener('click', function() {
    var val = norm(dom.input.value);
    if (val.length >= 2) { openQtySheet(val); dom.input.value = ''; }
    else dom.input.focus();
  });
  dom.input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var val = norm(dom.input.value);
      if (val.length >= 2) { openQtySheet(val); dom.input.value = ''; }
    }
  });

  /* Remove ingredient */
  dom.ingredientsList.addEventListener('click', function(e) {
    var btn = e.target.closest('.ing-remove');
    if (btn && btn.dataset.id) removeIngredient(btn.dataset.id);
  });

  /* Clear all */
  dom.clearAllBtn.addEventListener('click', function() {
    if (state.ingredients.length) clearAll();
  });

  /* Search */
  dom.searchBtn.addEventListener('click', searchRecipes);

  /* Camera / OCR */
  dom.cameraBtn.addEventListener('click', function() { dom.ocrInput.click(); });
  dom.ocrInput.addEventListener('change', function(e) {
    var f = e.target.files && e.target.files[0];
    if (f) processOCR(f);
    dom.ocrInput.value = '';
  });

  /* Quantity sheet */
  dom.qtyConfirm.addEventListener('click', function() { confirmIngredient(norm(dom.qtyInput.value)); });
  dom.qtySkip.addEventListener('click', function() { confirmIngredient(''); });
  dom.qtyInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') confirmIngredient(norm(dom.qtyInput.value));
  });
  dom.qtyOverlay.addEventListener('click', function(e) {
    if (e.target === dom.qtyOverlay) closeQtySheet();
  });

  /* Modal */
  dom.modalOverlay.addEventListener('click', function(e) {
    if (e.target === dom.modalOverlay) closeModal();
  });

  /* Keyboard shortcuts */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (state.currentModal) closeModal();
      else if (state.pendingName) closeQtySheet();
    }
  });
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   SERVICE WORKER
ââââââââââââââââââââââââââââââââââââââââââââââ */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('/cocinafacil/sw.js', { scope: '/cocinafacil/' })
    .then(function(r) { console.log('[SW]', r.scope); })
    .catch(function(e) { console.warn('[SW]', e); });
}

/* ââââââââââââââââââââââââââââââââââââââââââââââ
   INIT
ââââââââââââââââââââââââââââââââââââââââââââââ */
function init() {
  initDom();
  loadSavedIngredients();
  renderIngredients();
  wireEvents();
  initInstallBanner();
  registerSW();
  console.log('[CocinaFÃ¡cil] v2 ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
