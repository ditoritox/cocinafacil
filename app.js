'use strict';

const state = { ingredients: new Set(), recipes: [], cache: new Map(), detailCache: new Map(), loading: false, currentModal: null };
const API_BASE = 'https://www.themealdb.com/api/json/v1/1';
const LS_KEY = 'cocinafacil_ingredients';
const STOP_WORDS = new Set(['de','la','el','los','las','un','una','y','o','con','sin','del','al','en','por','para','que','como','agua','ml','gr','kg','litros','ingredientes','elaborado','conservar','lote','exp','best','before','of','the','and','or','with','from','contains','may','trace','allergens']);

const $ = (sel) => document.querySelector(sel);
const dom = {
  input: $('#ingredient-input'), addBtn: $('#add-btn'), searchBtn: $('#search-btn'),
  tagsContainer: $('#tags-container'), resultsSection: $('#results-section'),
  recipesGrid: $('#recipes-grid'), resultCount: $('#result-count'),
  ocrFileInput: $('#ocr-file-input'), ocrDropArea: $('#ocr-drop-area'),
  ocrProgress: $('#ocr-progress'), progressBar: $('#progress-bar'), ocrStatus: $('#ocr-status'),
  modalOverlay: $('#modal-overlay'), modalContent: $('#modal-content'),
  toast: $('#toast'), installBanner: $('#install-banner'),
  installBtn: $('#install-btn'), dismissInstall: $('#dismiss-install'),
};

function saveIngredients() { try { localStorage.setItem(LS_KEY, JSON.stringify([...state.ingredients])); } catch {} }
function loadSavedIngredients() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) return;
    const list = JSON.parse(saved);
    if (Array.isArray(list)) list.forEach((ing) => state.ingredients.add(normaliseIngredient(ing)));
  } catch {}
}
function normaliseIngredient(str) { return str.trim().toLowerCase().replace(/\s+/g, ' '); }

function escHtml(str) {
  return String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function addIngredient(raw) {
  const name = normaliseIngredient(raw);
  if (!name || name.length < 2) return false;
  if (state.ingredients.has(name)) { showToast('"' + name + '" ya esta en la lista'); return false; }
  state.ingredients.add(name);
  renderTags();
  saveIngredients();
  return true;
}
function removeIngredient(name) { state.ingredients.delete(name); renderTags(); saveIngredients(); }

function renderTags() {
  const container = dom.tagsContainer;
  container.innerHTML = '';
  if (state.ingredients.size === 0) {
    container.innerHTML = '<span class="tags-empty">Añade ingredientes arriba o usa el escáner</span>';
    dom.searchBtn.disabled = true;
    return;
  }
  dom.searchBtn.disabled = false;
  state.ingredients.forEach((ing) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = escHtml(ing) + '<button class="tag-remove" data-ing="' + escHtml(ing) + '">×</button>';
    container.appendChild(tag);
  });
}

async function fetchMealsByIngredient(ingredient) {
  if (state.cache.has(ingredient)) return state.cache.get(ingredient);
  try {
    const res = await fetch(API_BASE + '/filter.php?i=' + encodeURIComponent(ingredient));
    const data = await res.json();
    const meals = data.meals || [];
    state.cache.set(ingredient, meals);
    return meals;
  } catch { state.cache.set(ingredient, []); return []; }
}

async function fetchMealDetails(mealId) {
  if (state.detailCache.has(mealId)) return state.detailCache.get(mealId);
  try {
    const res = await fetch(API_BASE + '/lookup.php?i=' + mealId);
    const data = await res.json();
    const meal = data.meals ? data.meals[0] : null;
    state.detailCache.set(mealId, meal);
    return meal;
  } catch { return null; }
}

function extractMealIngredients(meal) {
  const list = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal['strIngredient' + i], measure = meal['strMeasure' + i];
    if (name && name.trim()) list.push({ name: name.trim(), measure: (measure || '').trim() });
  }
  return list;
}

async function searchRecipes() {
  if (state.ingredients.size === 0) { showToast('Añade al menos un ingrediente'); return; }
  if (state.loading) return;
  state.loading = true;
  dom.searchBtn.disabled = true;
  showLoadingState();
  const userIngredients = [...state.ingredients];
  const mealMatchCount = new Map();
  try {
    const results = await Promise.all(userIngredients.map((ing) => fetchMealsByIngredient(ing)));
    results.forEach((meals) => {
      meals.forEach((meal) => {
        const id = meal.idMeal;
        if (!mealMatchCount.has(id)) mealMatchCount.set(id, { count: 0, stub: meal });
        mealMatchCount.get(id).count += 1;
      });
    });
    const scored = [...mealMatchCount.values()].map(({ count, stub }) => ({
      ...stub, matchCount: count, matchPercentage: Math.round((count / userIngredients.length) * 100),
    }));
    scored.sort((a, b) => b.matchCount - a.matchCount || a.strMeal.localeCompare(b.strMeal));
    state.recipes = scored;
    renderRecipes();
  } catch (err) { console.error(err); showErrorState(); }
  finally { state.loading = false; dom.searchBtn.disabled = false; }
}

function showLoadingState() {
  dom.resultsSection.style.display = 'block';
  dom.recipesGrid.innerHTML = '<div class="state-placeholder" style="grid-column:1/-1"><div class="spinner"></div><p>Buscando recetas...</p></div>';
  dom.resultCount.textContent = '';
}
function showErrorState() {
  dom.recipesGrid.innerHTML = '<div class="state-placeholder" style="grid-column:1/-1"><h3>Error de conexion</h3><p>Revisa tu internet e intentalo de nuevo.</p></div>';
}

function renderRecipes() {
  dom.resultsSection.style.display = 'block';
  if (state.recipes.length === 0) {
    dom.resultCount.textContent = '0 recetas';
    dom.recipesGrid.innerHTML = '<div class="state-placeholder" style="grid-column:1/-1"><h3>Sin resultados</h3><p>Prueba con otros ingredientes.</p></div>';
    return;
  }
  dom.resultCount.textContent = state.recipes.length + ' receta' + (state.recipes.length !== 1 ? 's' : '');
  dom.recipesGrid.innerHTML = '';
  state.recipes.forEach((recipe, idx) => dom.recipesGrid.appendChild(buildRecipeCard(recipe, idx)));
}

function buildRecipeCard(recipe, idx) {
  const pct = recipe.matchPercentage, cnt = recipe.matchCount;
  const cls = pct >= 60 ? 'match-high' : pct >= 30 ? 'match-mid' : 'match-low';
  const card = document.createElement('div');
  card.className = 'recipe-card card';
  card.style.animationDelay = Math.min(idx * 40, 400) + 'ms';
  card.setAttribute('role','button'); card.setAttribute('tabindex','0');
  card.dataset.mealId = recipe.idMeal;
  card.innerHTML = '<div class="recipe-card-img">' +
    '<img src="' + escHtml(recipe.strMealThumb) + '/preview" alt="' + escHtml(recipe.strMeal) + '" loading="lazy">' +
    '<span class="match-badge ' + cls + '">' + pct + '% match</span></div>' +
    '<div class="recipe-card-body"><div class="recipe-card-title">' + escHtml(recipe.strMeal) + '</div>' +
    '<div class="recipe-card-meta">' + cnt + ' de ' + state.ingredients.size + ' ingrediente' + (state.ingredients.size !== 1 ? 's' : '') + '</div></div>';
  card.addEventListener('click', () => openRecipeModal(recipe.idMeal));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openRecipeModal(recipe.idMeal); });
  return card;
}

async function openRecipeModal(mealId) {
  state.currentModal = mealId;
  dom.modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  dom.modalContent.innerHTML = '<div class="modal-body"><div class="spinner" style="margin-top:2rem"></div><p style="text-align:center">Cargando receta...</p></div>';
  const meal = await fetchMealDetails(mealId);
  if (state.currentModal !== mealId) return;
  if (!meal) {
    dom.modalContent.innerHTML = '<button class="modal-close" id="modal-close-btn">x</button><div class="modal-body"><p>No se pudo cargar.</p></div>';
    document.getElementById('modal-close-btn').addEventListener('click', closeRecipeModal);
    return;
  }
  renderModalContent(meal);
}

function renderModalContent(meal) {
  const mealIngredients = extractMealIngredients(meal);
  const userSet = new Set([...state.ingredients].map((s) => s.toLowerCase()));
  const chips = mealIngredients.map(function(item) {
    const name = item.name, measure = item.measure;
    const matched = userSet.has(name.toLowerCase()) || [...userSet].some((u) => name.toLowerCase().includes(u) || u.includes(name.toLowerCase()));
    return '<span class="modal-ingredient' + (matched ? ' matched' : '') + '">' +
      (matched ? '<span class="match-check">&#10003;</span>' : '') +
      escHtml(measure ? measure + ' ' + name : name) + '</span>';
  }).join('');
  const steps = (meal.strInstructions || '').split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 10).slice(0, 20);
  const stepItems = steps.length ? steps.map((s) => '<li>' + escHtml(s) + '</li>').join('') : '<li>' + escHtml(meal.strInstructions || 'Sin instrucciones.') + '</li>';
  const ytLink = meal.strYoutube ? '<a class="yt-link" href="' + escHtml(meal.strYoutube) + '" target="_blank" rel="noopener">&#9654; Ver en YouTube</a>' : '';
  const matchedCount = mealIngredients.filter(function(i) { return userSet.has(i.name.toLowerCase()) || [...userSet].some((u) => i.name.toLowerCase().includes(u) || u.includes(i.name.toLowerCase())); }).length;
  dom.modalContent.innerHTML =
    '<div class="modal-hero"><img src="' + escHtml(meal.strMealThumb) + '" alt="' + escHtml(meal.strMeal) + '">' +
    '<button class="modal-close" id="modal-close-btn" aria-label="Cerrar">&#215;</button></div>' +
    '<div class="modal-body"><h2 class="modal-title">' + escHtml(meal.strMeal) + '</h2>' +
    '<p class="modal-area">' + escHtml(meal.strArea || 'Internacional') + ' &middot; ' + escHtml(meal.strCategory || 'Sin categoria') + ' &middot; ' + matchedCount + '/' + mealIngredients.length + ' ingredientes</p>' +
    '<div class="modal-section-title">Ingredientes</div><div class="modal-ingredients">' + chips + '</div>' +
    '<div class="modal-section-title">Instrucciones</div><div class="modal-instructions"><ol>' + stepItems + '</ol></div>' + ytLink + '</div>';
  document.getElementById('modal-close-btn').addEventListener('click', closeRecipeModal);
}

function closeRecipeModal() { state.currentModal = null; dom.modalOverlay.classList.remove('open'); document.body.style.overflow = ''; }

async function processImageOCR(file) {
  if (!window.Tesseract) { showToast('El escaner OCR aun no esta listo'); return; }
  dom.ocrProgress.classList.add('active');
  dom.progressBar.style.width = '0%';
  dom.ocrStatus.textContent = 'Iniciando reconocimiento...';
  try {
    const result = await Tesseract.recognize(file, 'spa+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          dom.progressBar.style.width = pct + '%';
          dom.ocrStatus.textContent = 'Analizando... ' + pct + '%';
        }
      },
    });
    const words = extractIngredients(result.data.text);
    if (!words.length) { showToast('No se encontraron ingredientes'); return; }
    let added = 0;
    words.forEach((w) => { if (addIngredient(w)) added++; });
    showToast(added > 0 ? added + ' ingrediente' + (added !== 1 ? 's' : '') + ' añadido' + (added !== 1 ? 's' : '') : 'Los ingredientes ya estaban en la lista');
  } catch (err) { console.error('[OCR]', err); showToast('Error al procesar la imagen.'); }
  finally { dom.ocrProgress.classList.remove('active'); dom.progressBar.style.width = '0%'; dom.ocrStatus.textContent = ''; }
}

function extractIngredients(rawText) {
  const tokens = rawText.toLowerCase().split(/[\s,;:.|()"'!?\n\r\t\/\\]+/)
    .map((t) => t.replace(/[^a-z\u00e0-\u024f]/gi, '').trim())
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP_WORDS.has(t));
  return [...new Set(tokens)];
}

let toastTimer = null;
function showToast(msg, dur) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), dur || 2800);
}

let deferredInstallPrompt = null;
function initInstallBanner() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstallPrompt = e; dom.installBanner.classList.add('visible'); });
  dom.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const c = await deferredInstallPrompt.userChoice;
    if (c.outcome === 'accepted') { showToast('CocinaFacil instalada!'); dom.installBanner.classList.remove('visible'); }
    deferredInstallPrompt = null;
  });
  dom.dismissInstall.addEventListener('click', () => dom.installBanner.classList.remove('visible'));
}

function wireEvents() {
  dom.addBtn.addEventListener('click', () => { if (addIngredient(dom.input.value)) dom.input.value = ''; dom.input.focus(); });
  dom.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && addIngredient(dom.input.value)) dom.input.value = ''; });
  dom.tagsContainer.addEventListener('click', (e) => { const b = e.target.closest('.tag-remove'); if (b) removeIngredient(b.dataset.ing); });
  dom.searchBtn.adapp.jsdEventListener('click', searchRecipes);
  dom.ocrFileInput.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) processImageOCR(f); dom.ocrFileInput.value = ''; });
  dom.ocrDropArea.addEventListener('click', () => dom.ocrFileInput.click());
  dom.ocrDropArea.addEventListener('dragover', (e) => { e.preventDefault(); dom.ocrDropArea.classList.add('drag-over'); });
  dom.ocrDropArea.addEventListener('dragleave', () => dom.ocrDropArea.classList.remove('drag-over'));
  dom.ocrDropArea.addEventListener('drop', (e) => {
    e.preventDefault(); dom.ocrDropArea.classList.remove('drag-over');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) processImageOCR(f); else showToast('Por favor sube una imagen');
  });
  dom.modalOverlay.addEventListener('click', (e) => { if (e.target === dom.modalOverlay) closeRecipeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.currentModal) closeRecipeModal(); });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/cocinafacil/sw.js', { scope: '/cocinafacil/' })
    .then((r) => console.log('[SW] scope:', r.scope)).catch((e) => console.warn('[SW]', e));
}

function init() { loadSavedIngredients(); renderTags(); wireEvents(); initInstallBanner(); registerSW(); console.log('[CocinaFacil] Ready!'); }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
