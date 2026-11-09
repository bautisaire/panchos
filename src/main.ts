import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Option = { id: string; name: string; note: string; color: string; image?: string; sachet?: string };
const sauces: Option[] = [
  { id: 'cheddar', name: 'Cheddar', note: 'Suave y cremoso', color: '#efa623', image: '/cheddar.png' },
  { id: 'barbacoa', name: 'Salsa barbacoa', note: 'Un toque ahumado', color: '#783c28', image: '/barbacoa.png' },
  { id: 'blanca', name: 'Salsa blanca', note: 'Suave y cremosa', color: '#eee4c8', image: '/salsa-blanca.png' },
  { id: 'verde', name: 'Salsa verde', note: 'Un toque de hierbas', color: '#688522', image: '/salsa-verde.png' },
  { id: 'criolla', name: 'Criolla', note: 'Fresca y bien nuestra', color: '#c25a3a', image: '/salsa-criolla.png' },
  { id: 'jamon-queso', name: 'Jamón y queso', note: 'Cremoso y con todo el sabor', color: '#edcd79', image: '/jamon-queso.png' },
  { id: 'picante', name: 'Picante', note: 'Para subir el fuego', color: '#dc3928', image: '/picante.png' },
];
const dressings: Option[] = [
  { id: 'ketchup', name: 'Ketchup', note: '', color: '#c93323', sachet: '/sobre-ketchup.png' },
  { id: 'mostaza', name: 'Mostaza', note: '', color: '#dab128', sachet: '/sobre-mostaza.png' },
  { id: 'mayonesa', name: 'Mayonesa', note: '', color: '#f0e5c9', sachet: '/sobre-mayonesa.png' },
];
// Agregá más gaseosas aquí: se elige una sola y cae detrás del producto.
const drinks: Option[] = [
  { id: 'coca-zero', name: 'Coca-Cola Zero', note: 'Sin azúcar, bien fría', color: '#c8102e', image: '/coca-zero.png' },
];
// Agregá nuevos productos aquí: el carrusel habilita navegación automáticamente.
const products = [
  { id: 'pancho', name: 'Pancho', image: '/pancho.png' },
  { id: 'hamburguesa', name: 'Hamburguesa', image: '/hamburguesa.png' },
];
// Stock (prototipo): lo que figura acá está agotado. Se guarda en este navegador y se edita desde el panel de administración.
const STOCK_KEY = 'flama-agotados';
const soldOut = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(STOCK_KEY) || '[]'); } catch { return []; } })());
const inStock = (key: string) => !soldOut.has(key);
function saveStock() { try { localStorage.setItem(STOCK_KEY, JSON.stringify([...soldOut])); } catch { /* sin almacenamiento: el cambio dura mientras la página esté abierta */ } }
type ThemeChoice = 'light' | 'dark' | 'auto';
const themes: { id: ThemeChoice; name: string }[] = [
  { id: 'light', name: 'Claro' },
  { id: 'dark', name: 'Nocturno' },
  { id: 'auto', name: 'Automático' },
];
const THEME_KEY = 'flama-tema';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let themeChoice: ThemeChoice = (() => { try { const v = localStorage.getItem(THEME_KEY); return v === 'dark' || v === 'auto' ? v : 'light'; } catch { return 'light'; } })();
function applyTheme() {
  const dark = themeChoice === 'dark' || (themeChoice === 'auto' && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16140f' : '#f8c638');
}
applyTheme();
products.forEach(product => { const image = new Image(); image.src = product.image; });
let current = 0;
// Cada pancho tiene sus propias salsas. Aderezos y gaseosa son globales del pedido.
const MAX_PANCHOS = 4;
const MAX_DRESSING = 5;
type Pancho = { sauces: Set<string>; el: HTMLButtonElement };
const panchos: Pancho[] = [];
let selectedIdx = 0;
let focusMode: 'pancho' | 'order' = 'pancho';
const dressingQty: Record<string, number> = Object.fromEntries(dressings.map(d => [d.id, 0]));
const cur = () => panchos[selectedIdx];
let selectedDrink: string | null = null;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="header"><a class="brand" href="#" aria-label="Flama, inicio"><img class="brand-logo" src="/flama-logo.png" alt="" width="50" height="50"/>flama</a><span class="header-note">SIMPLE · RICO · BARATO</span></header>
  <main>
    <section class="home" id="home" aria-label="Elegí tu producto">
      <div class="carousel" role="region" aria-roledescription="carrusel" aria-label="Productos" tabindex="0">
        <span class="product-watermark" aria-hidden="true">PANCHO</span>
        <button class="carousel-arrow previous" aria-label="Producto anterior">←</button>
        <div class="product-stage"><img class="hero-pancho" src="/pancho.png" alt="Pancho clásico con pan dorado y salchicha" draggable="false"/><div class="pancho-shadow"></div></div>
        <button class="carousel-arrow next" aria-label="Producto siguiente">→</button>
      </div>
      <div class="product-info"><h1 id="product-name" aria-live="polite">Pancho</h1><button class="primary" id="build">Armar pancho <span aria-hidden="true">↗</span></button><div class="pagination" aria-label="Producto 1 de 2"><span class="active"></span><span></span></div></div>
    </section>
    <section class="builder" id="builder" hidden aria-labelledby="builder-title">
      <button class="back" id="back">← Volver al menú</button>
      <div class="builder-layout"><div class="builder-preview"><span class="eyebrow">EL CLÁSICO · A TU MANERA</span><h1 id="builder-title" tabindex="-1">Dale tu <br><em>toque.</em></h1><div class="pancho-composition">${drinks.map(d => `<img class="drink-layer" data-drink="${d.id}" src="${d.image}" alt="" aria-hidden="true" draggable="false" hidden/>`).join('')}${dressings.map(d => Array.from({ length: MAX_DRESSING }, (_, j) => `<img class="sachet-layer" data-sachet="${d.id}" data-copy="${j}" src="${d.sachet}" alt="" aria-hidden="true" draggable="false" hidden/>`).join('')).join('')}</div><div class="pancho-tabs" id="pancho-tabs" role="group" aria-label="Panchos del pedido"></div><div class="preview-caption"><span>La base está.<br><strong>La magia la ponés vos.</strong></span><span aria-hidden="true">✳</span></div></div>
      <div class="options-panel"><fieldset id="sauce-fieldset"><legend><span class="step">01</span> <span id="sauce-title">Elegí tus salsas</span> <span class="counter" id="sauce-counter">0 / 2</span></legend><p class="hint" id="sauce-hint" aria-live="polite">Podés elegir hasta 2. También vale sin salsa.</p><div class="sauce-grid">${sauces.map(o => option(o, 'sauce')).join('')}</div></fieldset>
      <fieldset><legend><span class="step">02</span> Sumá aderezos <span class="counter">hasta 5 de cada uno</span></legend><p class="hint hint-more">Valen para todo el pedido.</p><div class="dressing-grid">${dressings.map(stepper).join('')}</div></fieldset>
      <fieldset><legend><span class="step">03</span> Sumá una gaseosa <span class="counter" id="drink-counter">0 / 1</span></legend><p class="hint hint-more">Una para todo el pedido. Mirá cómo cae detrás.</p><div class="drink-grid">${drinks.map(o => option(o, 'drink')).join('')}</div></fieldset>
      <div class="summary"><span class="eyebrow">TU COMBINACIÓN</span><p id="combination" aria-live="polite">El clásico, así de simple.</p></div><button class="primary finish" id="finish">Listo, así me gusta <span aria-hidden="true">✓</span></button><p class="local-note">Por ahora, probá tu combinación. Los pedidos llegan pronto.</p><div id="confirmation" class="confirmation" role="status" hidden></div></div></div>
    </section>
    <section class="order-flow" id="order-flow" hidden aria-label="Finalizar pedido">
      <p class="order-status" role="status" tabindex="-1">Preparando tu pedido…</p>
      <div class="packing-scene" aria-hidden="true">
        <div class="packing-parcel">
          <div class="packing-food"></div>
          <img class="packing-box packing-front" src="/caja-flama.png" alt=""/>
          <img class="packing-box packing-lid" src="/caja-flama.png" alt=""/>
        </div>
      </div>
      <div class="order-success" hidden>
        <h1 tabindex="-1"><span class="typed-line">Pedido</span><br><span class="typed-line line-2">realizado</span></h1>
        <p class="local-note">Demostración: no se envió un pedido real.</p>
        <button class="primary" id="new-order">Volver al menú <span aria-hidden="true">↗</span></button>
      </div>
    </section>
  </main>
`;
function option(o: Option, kind: string) {
  const swatch = o.image
    ? `<span class="swatch" style="--swatch:${o.color}"><img src="${o.image}" alt="" draggable="false"/></span>`
    : `<span class="swatch" style="--swatch:${o.color}"></span>`;
  return `<label class="option ${kind}"><input type="checkbox" value="${o.id}" data-kind="${kind}" ${kind === 'sauce' ? 'aria-describedby="sauce-hint"' : ''}/>${swatch}<span class="option-copy"><strong>${o.name}</strong>${o.note ? `<small>${o.note}</small>` : ''}</span><em class="sold-tag">Agotado</em><span class="check" aria-hidden="true">✓</span></label>`;
}
// Aderezo con cantidad (0 a 5): botones − y +.
function stepper(o: Option) {
  const n = o.name.toLowerCase();
  return `<div class="option dressing stepper" data-dressing="${o.id}"><span class="stepper-name"><span class="swatch" style="--swatch:${o.color}"></span><strong>${o.name}</strong></span><span class="qty-controls"><button type="button" class="qty-btn" data-act="minus" aria-label="Quitar ${n}">−</button><output class="qty" aria-label="Cantidad de ${n}">0</output><button type="button" class="qty-btn" data-act="plus" aria-label="Agregar ${n}">+</button></span><em class="sold-tag">Agotado</em></div>`;
}
const home = document.querySelector<HTMLElement>('#home')!;
const builder = document.querySelector<HTMLElement>('#builder')!;
const scene = document.querySelector<HTMLElement>('.builder-preview .pancho-composition')!;
const tabs = document.querySelector<HTMLElement>('#pancho-tabs')!;
function ordinal(n: number) {
  const fem = products[current].name.toLowerCase().endsWith('a');
  return `${n}.${fem ? 'ª' : n === 1 || n === 3 ? 'er' : 'º'}`;
}
function panchoName(k: number) { return panchos.length > 1 ? `${ordinal(k + 1)} ${products[current].name.toLowerCase()}` : products[current].name; }
function makePancho(): Pancho {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'pancho-item';
  el.innerHTML = `<img class="pancho-base" src="${products[current].image}" alt="" width="1672" height="941" draggable="false"/>${sauces.filter(o => o.image).map(o => `<img class="topping-layer" data-topping="${o.id}" src="${o.image}" alt="" aria-hidden="true" width="1672" height="941" hidden/>`).join('')}<span class="pancho-tag" aria-hidden="true"></span>`;
  const pancho: Pancho = { sauces: new Set(), el };
  el.addEventListener('click', () => { const k = panchos.indexOf(pancho); if (k >= 0) { setFocus('pancho'); selectPancho(k); } });
  return pancho;
}
function addPancho() {
  if (panchos.length >= MAX_PANCHOS) return;
  const pancho = makePancho();
  panchos.push(pancho);
  scene.append(pancho.el);
  selectedIdx = panchos.length - 1;
  setFocus('pancho', false);
  refreshPanchos();
  if (panchos.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pancho.el.animate([{ opacity: 0, translate: '0 -35%' }, { opacity: 1, translate: '0 0' }], { duration: 450, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  }
}
function removePancho(k: number) {
  if (panchos.length < 2) return;
  panchos[k].el.remove();
  panchos.splice(k, 1);
  selectedIdx = Math.min(Math.max(0, selectedIdx > k ? selectedIdx - 1 : selectedIdx), panchos.length - 1);
  if (panchos.length < 2) focusMode = 'pancho';
  refreshPanchos();
}
function selectPancho(k: number) { selectedIdx = k; refreshPanchos(); }
function setFocus(mode: 'pancho' | 'order', apply = true) {
  focusMode = mode;
  if (apply) applyFocus();
}
// El pancho elegido se ve a color y los demás grisáceos; al pasar a otras opciones, todos a color.
function applyFocus() {
  scene.classList.toggle('focus-pancho', focusMode === 'pancho' && panchos.length > 1);
  panchos.forEach((p, k) => p.el.classList.toggle('selected', k === selectedIdx));
}
function layoutPanchos() {
  const n = panchos.length;
  scene.style.setProperty('--n', String(n));
  scene.style.setProperty('--step', String(n === 2 ? 24 : n === 3 ? 20 : 17));
  panchos.forEach((p, k) => {
    p.el.style.setProperty('--k', String(k));
    p.el.style.zIndex = String(k === selectedIdx ? 6 : k + 1);
    p.el.setAttribute('aria-pressed', String(k === selectedIdx));
    p.el.setAttribute('aria-label', `${panchoName(k)}${n > 1 ? (k === selectedIdx ? ', elegido' : ', tocar para elegir') : ''}`);
    p.el.disabled = n === 1;
    (p.el.querySelector('.pancho-tag') as HTMLElement).textContent = n > 1 ? String(k + 1) : '';
  });
}
function renderTabs() {
  tabs.innerHTML = panchos.map((_, k) => `<span class="chip-wrap${k === selectedIdx ? ' on' : ''}"><button type="button" class="chip" data-pick="${k}" aria-pressed="${k === selectedIdx}" aria-label="${panchoName(k)}">${panchos.length > 2 ? ordinal(k + 1) : panchoName(k)}</button>${panchos.length > 1 ? `<button type="button" class="chip-x" data-del="${k}" aria-label="Quitar ${panchoName(k)}">×</button>` : ''}</span>`).join('')
    + `<button type="button" class="chip add" data-add ${panchos.length >= MAX_PANCHOS ? 'disabled' : ''}>${panchos.length >= MAX_PANCHOS ? 'Máx. 4' : panchos.length > 2 ? '+ Agregar' : '+ Agregar pancho'}</button>`;
}
tabs.addEventListener('click', e => {
  const target = (e.target as Element).closest<HTMLElement>('button');
  if (!target) return;
  if (target.hasAttribute('data-add')) { addPancho(); focusTab('[data-add]'); }
  else if (target.dataset.del) { removePancho(Number(target.dataset.del)); focusTab('.chip'); }
  else if (target.dataset.pick) { setFocus('pancho'); selectPancho(Number(target.dataset.pick)); focusTab(`[data-pick="${target.dataset.pick}"]`); }
});
function focusTab(selector: string) { tabs.querySelector<HTMLElement>(`${selector}:not(:disabled)`)?.focus({ preventScroll: true }); }
function refreshPanchos() {
  layoutPanchos();
  renderTabs();
  applyFocus();
  updateToppings();
  syncSauceChecks();
  updateSauceUi();
  syncOptions();
  updateSummary();
}
function showBuilder(show: boolean) {
  cancelOrderAnimation();
  if (show) {
    panchos.forEach(p => { p.el.querySelector<HTMLImageElement>('.pancho-base')!.src = products[current].image; });
    document.querySelector('.builder-preview .eyebrow')!.textContent = products[current].name.toUpperCase();
    refreshPanchos();
    updateSachets(false);
    updateDrinks(false);
  }
  home.hidden = show; builder.hidden = !show;
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector<HTMLElement>(show ? '#builder-title' : '#build')!.focus({ preventScroll: true });
}
document.querySelector('#build')!.addEventListener('click', () => showBuilder(true));
document.querySelector('#back')!.addEventListener('click', () => showBuilder(false));
document.querySelector('.brand')!.addEventListener('click', e => { e.preventDefault(); showBuilder(false); });
function sauceNames(p: Pancho) { return sauces.filter(o => p.sauces.has(o.id)).map(o => o.name); }
function updateToppings() {
  panchos.forEach((p, k) => {
    const visible = sauces.filter(o => o.image && p.sauces.has(o.id));
    p.el.querySelectorAll<HTMLImageElement>('[data-topping]').forEach(layer => {
      const index = visible.findIndex(o => o.id === layer.dataset.topping);
      layer.hidden = index < 0;
      // Dos franjas superpuestas conservan visibles ambas texturas, sin transparencias artificiales.
      layer.classList.toggle('topping-back', visible.length === 2 && index === 0);
      layer.classList.toggle('topping-front', visible.length === 2 && index === 1);
    });
    p.el.querySelector<HTMLImageElement>('.pancho-base')!.alt = visible.length
      ? `${panchoName(k)} con ${visible.map(o => o.name.toLowerCase()).join(' y ')} encima`
      : panchoName(k);
  });
}
function updateSummary() {
  const each = panchos.map((p, k) => { const s = sauceNames(p); return `${panchoName(k)} ${s.length ? `con ${s.join(' y ')}` : 'sin salsas'}`; });
  const shared = [
    ...dressings.filter(d => dressingQty[d.id] > 0).map(d => `${dressingQty[d.id]} × ${d.name}`),
    ...drinks.filter(o => o.id === selectedDrink).map(o => o.name),
  ];
  document.querySelector('#combination')!.textContent = each.join('; ') + (shared.length ? `. Para todo el pedido: ${shared.join(', ')}.` : '.');
  document.querySelector<HTMLElement>('#confirmation')!.hidden = true;
}
function updateSachets(animate: boolean) {
  const order = dressings.filter(d => dressingQty[d.id] > 0);
  scene.classList.toggle('has-dressing', order.length > 0);
  document.querySelectorAll<HTMLImageElement>('[data-sachet]').forEach(layer => {
    const index = order.findIndex(d => d.id === layer.dataset.sachet);
    const copy = Number(layer.dataset.copy);
    if (index < 0 || copy >= dressingQty[order[index].id]) { layer.hidden = true; layer.classList.remove('drop'); return; }
    layer.style.setProperty('--i', String(index));
    layer.style.setProperty('--j', String(copy));
    // Los sobres se entrecruzan: los pares quedan encima de los impares.
    layer.style.setProperty('--x', String(index % 2));
    layer.style.zIndex = index % 2 ? '8' : '9';
    if (layer.hidden) {
      layer.hidden = false;
      layer.classList.remove('drop');
      void layer.offsetWidth;
      if (animate) layer.classList.add('drop');
    }
  });
}
function syncDressings() {
  document.querySelectorAll<HTMLElement>('[data-dressing]').forEach(row => {
    const id = row.dataset.dressing!;
    const qty = dressingQty[id];
    const out = !inStock(`dressing:${id}`);
    row.querySelector('.qty')!.textContent = String(qty);
    row.classList.toggle('has-qty', qty > 0);
    row.classList.toggle('sold-out', out);
    row.querySelector<HTMLButtonElement>('[data-act="minus"]')!.disabled = qty === 0;
    row.querySelector<HTMLButtonElement>('[data-act="plus"]')!.disabled = out || qty >= MAX_DRESSING;
  });
}
document.querySelector('.dressing-grid')!.addEventListener('click', e => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-act]');
  if (!btn || btn.disabled) return;
  const id = btn.closest<HTMLElement>('[data-dressing]')!.dataset.dressing!;
  dressingQty[id] = Math.max(0, Math.min(MAX_DRESSING, dressingQty[id] + (btn.dataset.act === 'plus' ? 1 : -1)));
  syncDressings();
  updateSachets(true);
  updateSummary();
});
function updateDrinks(animate: boolean) {
  document.querySelectorAll<HTMLImageElement>('[data-drink]').forEach(layer => {
    const active = layer.dataset.drink === selectedDrink;
    if (active && layer.hidden) {
      layer.hidden = false;
      // Reinicia la caída cada vez que se elige la gaseosa.
      layer.classList.remove('drop');
      void layer.offsetWidth;
      if (animate) layer.classList.add('drop');
    } else if (!active) { layer.hidden = true; layer.classList.remove('drop'); }
  });
  scene.classList.toggle('has-drink', !!selectedDrink);
  document.querySelectorAll<HTMLInputElement>('[data-kind="drink"]').forEach(el => { el.checked = el.value === selectedDrink; });
  document.querySelector('#drink-counter')!.textContent = `${selectedDrink ? 1 : 0} / 1`;
  updateSummary();
}
document.querySelectorAll<HTMLInputElement>('.option input').forEach(input => input.addEventListener('change', () => {
  if (input.dataset.kind === 'drink') { selectedDrink = input.checked ? input.value : null; updateDrinks(true); return; }
  const selection = cur().sauces;
  if (input.checked && selection.size >= 2) input.checked = false;
  if (input.checked) selection.add(input.value); else selection.delete(input.value);
  updateToppings();
  syncOptions();
  updateSauceUi();
  updateSummary();
}));
// Salsas: mostrar a color el pancho elegido; cualquier otra opción vuelve a mostrarlos todos.
const optionsPanel = document.querySelector<HTMLElement>('.options-panel')!;
['focusin', 'click'].forEach(type => optionsPanel.addEventListener(type, e => {
  setFocus((e.target as Element).closest('#sauce-fieldset') ? 'pancho' : 'order');
}));
function syncSauceChecks() {
  document.querySelectorAll<HTMLInputElement>('[data-kind="sauce"]').forEach(el => { el.checked = cur().sauces.has(el.value); });
}
function updateSauceUi() {
  document.querySelector('#sauce-title')!.textContent = panchos.length > 1 ? `Salsas del ${panchoName(selectedIdx)}` : 'Elegí tus salsas';
  document.querySelector('#sauce-counter')!.textContent = `${cur().sauces.size} / 2`;
  document.querySelector('#sauce-hint')!.textContent = cur().sauces.size === 2 ? 'Ya tiene 2 salsas. Quitá una para cambiarla.' : 'Hasta 2 por pancho. También vale sin salsa.';
}
function syncOptions() {
  document.querySelectorAll<HTMLInputElement>('.option input').forEach(el => {
    const out = !inStock(`${el.dataset.kind}:${el.value}`);
    el.disabled = out || (el.dataset.kind === 'sauce' && cur().sauces.size >= 2 && !el.checked);
    el.closest('.option')!.classList.toggle('sold-out', out);
  });
  syncDressings();
}
function updateProductAvailability() {
  const out = !inStock(`product:${products[current].id}`);
  const build = document.querySelector<HTMLButtonElement>('#build')!;
  build.disabled = out;
  build.innerHTML = out ? 'Agotado por ahora' : `Armar ${products[current].name.toLowerCase()} <span aria-hidden="true">↗</span>`;
  document.querySelector('.product-stage')!.classList.toggle('sold-out', out);
}
function applyStock() {
  panchos.forEach(p => p.sauces.forEach(id => { if (!inStock(`sauce:${id}`)) p.sauces.delete(id); }));
  dressings.forEach(d => { if (!inStock(`dressing:${d.id}`)) dressingQty[d.id] = 0; });
  if (selectedDrink && !inStock(`drink:${selectedDrink}`)) selectedDrink = null;
  syncSauceChecks();
  updateToppings();
  updateSachets(false);
  updateDrinks(false);
  updateSauceUi();
  syncOptions();
  updateProductAvailability();
  if (!builder.hidden && !inStock(`product:${products[current].id}`)) showBuilder(false);
}
const orderFlow = document.querySelector<HTMLElement>('#order-flow')!;
const packingScene = document.querySelector<HTMLElement>('.packing-scene')!;
const parcel = document.querySelector<HTMLElement>('.packing-parcel')!;
const packingFood = document.querySelector<HTMLElement>('.packing-food')!;
const lid = document.querySelector<HTMLElement>('.packing-lid')!;
const orderSuccess = document.querySelector<HTMLElement>('.order-success')!;
const orderStatus = document.querySelector<HTMLElement>('.order-status')!;
let orderRun = 0;
let orderAnimations: Animation[] = [];
let movingProduct: HTMLElement | null = null;
let productPlaceholder: Comment | null = null;
function restoreProduct() {
  if (movingProduct && productPlaceholder) {
    movingProduct.style.removeProperty('animation');
    movingProduct.style.removeProperty('transform');
    productPlaceholder.replaceWith(movingProduct);
  }
  movingProduct = null;
  productPlaceholder = null;
  packingFood.removeAttribute('style');
}
function cancelOrderAnimation() {
  orderRun++;
  orderAnimations.forEach(animation => animation.cancel());
  orderAnimations = [];
  restoreProduct();
  orderFlow.classList.remove('packing-active');
  orderFlow.hidden = true;
}
function animateOrder(element: HTMLElement, frames: Keyframe[], duration: number, delay = 0) {
  const animation = element.animate(frames, { duration, delay, fill: 'both', easing: 'cubic-bezier(.4,0,.2,1)' });
  orderAnimations.push(animation);
  return animation.finished;
}
function restartTypedAnimation() {
  // Reinicia el efecto de "escritura" cada vez que se confirma un pedido.
  const elements = orderSuccess.querySelectorAll<HTMLElement>('.typed-line');
  elements.forEach(el => { el.style.animation = 'none'; });
  void orderSuccess.offsetWidth;
  elements.forEach(el => { el.style.removeProperty('animation'); });
}
async function runOrder() {
  if (!orderFlow.hidden) return;
  setFocus('order');
  cancelOrderAnimation();
  const run = orderRun;
  const food = scene;
  // Conservamos el mismo nodo y la pose exacta de su animación flotante.
  const bounds = food.getBoundingClientRect();
  const width = food.offsetWidth;
  const height = food.offsetHeight;
  const frozenTransform = getComputedStyle(food).transform;
  const matrix = new DOMMatrixReadOnly(frozenTransform);
  const originalX = bounds.left + bounds.width / 2 - width / 2 - matrix.e;
  const originalY = bounds.top + bounds.height / 2 - height / 2 - matrix.f;
  movingProduct = food;
  productPlaceholder = document.createComment('Lugar del producto durante el empaque');
  food.before(productPlaceholder);
  food.style.animation = 'none';
  food.style.transform = frozenTransform;
  packingFood.replaceChildren(food);
  builder.hidden = true;
  home.hidden = true;
  orderFlow.hidden = false;
  orderFlow.classList.add('packing-active');
  orderSuccess.hidden = true;
  packingScene.hidden = false;
  orderStatus.hidden = false;
  // No desplazamos la página: el producto empieza donde el cliente lo estaba viendo.
  const sceneBounds = parcel.getBoundingClientRect();
  const startX = originalX - sceneBounds.left;
  const startY = originalY - sceneBounds.top;
  Object.assign(packingFood.style, { width: `${width}px`, left: `${startX}px`, top: `${startY}px` });
  const scale = Math.min(1, sceneBounds.width * .46 / width);
  const targetX = sceneBounds.width * .5 - width * scale / 2;
  const targetY = sceneBounds.height * .43;
  const approachY = sceneBounds.height * .19;
  const dx = targetX - startX;
  const approach = `translate(${dx}px, ${approachY - startY}px) scale(${scale})`;
  const inside = `translate(${dx}px, ${targetY - startY}px) scale(${scale * .85})`;
  orderStatus.focus({ preventScroll: true });
  const boxFront = document.querySelector<HTMLElement>('.packing-front')!;
  boxFront.style.opacity = '0';
  lid.style.opacity = '0';
  try {
    await document.querySelector<HTMLImageElement>('.packing-front')!.decode();
    if (run !== orderRun) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Primero queda solo el producto; luego aparece la caja abierta.
      await Promise.all([
        animateOrder(boxFront, [{ opacity: 0 }, { opacity: 1 }], 300, 350),
        animateOrder(lid, [{ opacity: 0, transform: 'translateY(-18%)' }, { opacity: 1, transform: 'translateY(-18%)' }], 300, 350),
      ]);
      await Promise.all([
        animateOrder(food, [{ transform: frozenTransform }, { transform: 'none' }], 750),
        animateOrder(packingFood, [
          { transform: 'translate(0, 0) scale(1)' },
          { transform: approach },
        ], 750),
      ]);
      await animateOrder(packingFood, [
        { transform: approach, opacity: 1 },
        { transform: inside, opacity: 1, offset: .85 },
        { transform: inside, opacity: 0 },
      ], 450);
      await animateOrder(lid, [{ opacity: 1, transform: 'translateY(-18%)' }, { opacity: 1, transform: 'translateY(0)' }], 250);
      await animateOrder(parcel, [
        { transform: 'translateX(0) rotate(0)', opacity: 1 },
        { transform: 'translateX(-3%) rotate(-3deg)', opacity: 1, offset: .18 },
        { transform: 'translateX(110vw) rotate(8deg)', opacity: 1 },
      ], 550, 100);
    }
  } catch {
    // La navegación cancela la secuencia; un error de imagen no bloquea el cierre.
    if (run !== orderRun) return;
  }
  if (run !== orderRun) return;
  orderAnimations.forEach(animation => animation.cancel());
  orderAnimations = [];
  restoreProduct();
  boxFront.style.removeProperty('opacity');
  lid.style.removeProperty('opacity');
  orderFlow.classList.remove('packing-active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  packingScene.hidden = true;
  orderStatus.hidden = true;
  restartTypedAnimation();
  startTracking();
  orderSuccess.hidden = false;
  orderSuccess.querySelector('h1')!.focus({ preventScroll: true });
}
document.querySelector('#new-order')!.addEventListener('click', () => showBuilder(false));
function navigate(direction: number) {
  if (products.length < 2) return;
  current = (current + direction + products.length) % products.length;
  const p = products[current];
  document.querySelector<HTMLImageElement>('.hero-pancho')!.src = p.image;
  document.querySelector<HTMLImageElement>('.hero-pancho')!.alt = p.name;
  document.querySelector('#product-name')!.textContent = p.name;
  document.querySelector('.product-watermark')!.textContent = p.name.toUpperCase();
  document.querySelector('.product-watermark')!.classList.toggle('long-name', p.name.length > 8);
  updateProductAvailability();
  document.querySelector('.pagination')!.setAttribute('aria-label', `Producto ${current + 1} de ${products.length}`);
  document.querySelectorAll('.pagination span').forEach((dot, index) => dot.classList.toggle('active', index === current));
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.getAnimations().forEach(animation => animation.cancel());
    stage.animate([{ transform: `translateX(${direction * 90}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 300, easing: 'ease-out' });
  }
}
document.querySelectorAll<HTMLButtonElement>('.carousel-arrow').forEach(button => {
  button.disabled = products.length < 2;
  button.addEventListener('click', () => navigate(button.classList.contains('next') ? 1 : -1));
});
const carousel = document.querySelector<HTMLElement>('.carousel')!;
carousel.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); navigate(e.key === 'ArrowRight' ? 1 : -1); } });
const stage = document.querySelector<HTMLElement>('.product-stage')!;
let drag: { id: number; x: number; y: number } | null = null;
carousel.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0 || (e.target as Element).closest('button')) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  carousel.setPointerCapture(e.pointerId);
  carousel.classList.add('dragging');
});
carousel.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > Math.abs(e.clientY - drag.y)) stage.style.transform = `translateX(${Math.max(-160, Math.min(160, dx))}px)`;
});
function endDrag(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag = null;
  stage.style.transform = '';
  carousel.classList.remove('dragging');
  if (carousel.hasPointerCapture(e.pointerId)) carousel.releasePointerCapture(e.pointerId);
  if (e.type === 'pointerup' && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1);
}
carousel.addEventListener('pointerup', endDrag);
carousel.addEventListener('pointercancel', endDrag);
carousel.addEventListener('lostpointercapture', endDrag);

// ---- Panel de administración (prototipo): acceso con el botón ⚙ de la esquina o con #admin ----
const adminGroups: { title: string; kind: string; items: { id: string; name: string }[] }[] = [
  { title: 'Productos', kind: 'product', items: products },
  { title: 'Salsas', kind: 'sauce', items: sauces },
  { title: 'Aderezos', kind: 'dressing', items: dressings },
  { title: 'Bebidas', kind: 'drink', items: drinks },
];
document.body.insertAdjacentHTML('beforeend', `
  <button class="admin-fab" id="admin-open" aria-label="Configuración" title="Configuración">⚙</button>
  <dialog class="admin" id="admin" aria-labelledby="admin-title">
    <div class="admin-head"><h2 id="admin-title">Configuración</h2><button class="admin-close" id="admin-close" aria-label="Cerrar">✕</button></div>
    <p class="admin-hint">Prototipo: los cambios se aplican al instante y quedan guardados en este navegador.</p>
    <div class="admin-body"><section><h3>Apariencia</h3><div class="theme-picker" role="radiogroup" aria-label="Tema de color">${themes.map(o => `<label class="theme-opt"><input type="radio" name="theme" value="${o.id}"/><span class="theme-chip theme-${o.id}" aria-hidden="true"></span><span>${o.name}</span></label>`).join('')}</div></section>${adminGroups.map(g => `<section><h3>${g.title}</h3>${g.items.map(i => `<label class="admin-row"><span>${i.name}</span><span class="admin-state" data-state="${g.kind}:${i.id}"></span><input type="checkbox" role="switch" data-stock="${g.kind}:${i.id}"/><span class="switch" aria-hidden="true"></span></label>`).join('')}</section>`).join('')}</div>
    <section class="admin-local" id="admin-local"><div class="admin-local-head"><h3>Ubicación del local</h3><button class="admin-reset" id="admin-map-full">Pantalla completa</button></div><p class="admin-hint">Tocá el mapa para mover el local.</p><div class="map" id="admin-map"></div><p class="admin-coords" id="admin-coords"></p></section>
    <div class="admin-foot"><button class="admin-reset" id="admin-all">Todo con stock</button><button class="admin-reset" id="admin-none">Todo sin stock</button></div>
  </dialog>`);
const adminDialog = document.querySelector<HTMLDialogElement>('#admin')!;
function syncAdmin() {
  document.querySelectorAll<HTMLInputElement>('[data-stock]').forEach(el => {
    el.checked = inStock(el.dataset.stock!);
    document.querySelector(`[data-state="${el.dataset.stock}"]`)!.textContent = el.checked ? 'Con stock' : 'Sin stock';
  });
}
function openAdmin() { syncAdmin(); if (!adminDialog.open) adminDialog.showModal(); setTimeout(initAdminMap, 0); }
document.querySelector('#admin-open')!.addEventListener('click', openAdmin);
document.querySelector('#admin-close')!.addEventListener('click', () => adminDialog.close());
adminDialog.addEventListener('click', e => { if (e.target === adminDialog) adminDialog.close(); });
adminDialog.addEventListener('change', e => {
  const el = e.target as HTMLInputElement;
  if (!el.dataset.stock) return;
  if (el.checked) soldOut.delete(el.dataset.stock); else soldOut.add(el.dataset.stock);
  saveStock(); syncAdmin(); applyStock();
});
function setAll(available: boolean) {
  adminGroups.forEach(g => g.items.forEach(i => { if (available) soldOut.delete(`${g.kind}:${i.id}`); else soldOut.add(`${g.kind}:${i.id}`); }));
  saveStock(); syncAdmin(); applyStock();
}
document.querySelector('#admin-all')!.addEventListener('click', () => setAll(true));
document.querySelector('#admin-none')!.addEventListener('click', () => setAll(false));
window.addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });
if (location.hash === '#admin') openAdmin();
packingScene.inert = true;
addPancho();
applyStock();

// ---- Tema de color: claro, oscuro (nocturno) o automático según el sistema ----
function syncThemeUi() {
  document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach(el => { el.checked = el.value === themeChoice; });
}
document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach(el => el.addEventListener('change', () => {
  if (!el.checked) return;
  themeChoice = el.value as ThemeChoice;
  try { localStorage.setItem(THEME_KEY, themeChoice); } catch { /* sin almacenamiento: dura mientras la página esté abierta */ }
  applyTheme();
}));
darkQuery.addEventListener('change', () => { if (themeChoice === 'auto') applyTheme(); });
syncThemeUi();

// ---- Mapa: ubicación del local (admin) y del cliente (antes de confirmar el pedido) ----
type Point = { lat: number; lng: number };
const TOWN: Point = { lat: -32.5833, lng: -61.5833 }; // San Martín de las Escobas, Santa Fe
const LOCAL_KEY = 'flama-local';
function loadLocal(): Point {
  try { const p = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); if (p && isFinite(p.lat) && isFinite(p.lng)) return p; } catch { /* usa la ubicación por defecto */ }
  return TOWN;
}
let localPoint = loadLocal();
function makeMap(el: HTMLElement) {
  const map = L.map(el, { center: [TOWN.lat, TOWN.lng], zoom: 15, minZoom: 3, worldCopyJump: true, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  return map;
}
const localIcon = L.divIcon({ className: 'pin pin-local', html: '<img src="/flama-logo.png" alt="" draggable="false"/>', iconSize: [40, 40], iconAnchor: [20, 20] });
const clientIcon = L.divIcon({ className: 'pin pin-client', html: '<span></span>', iconSize: [30, 40], iconAnchor: [15, 40] });

// Admin
let adminMap: L.Map | null = null;
let adminMarker: L.Marker | null = null;
function showAdminCoords() { document.querySelector('#admin-coords')!.textContent = `Local: ${localPoint.lat.toFixed(5)}, ${localPoint.lng.toFixed(5)}`; }
function initAdminMap() {
  if (!adminMap) {
    adminMap = makeMap(document.querySelector<HTMLElement>('#admin-map')!);
    adminMarker = L.marker([localPoint.lat, localPoint.lng], { icon: localIcon, draggable: true }).addTo(adminMap);
    const set = (p: L.LatLng) => {
      localPoint = { lat: p.lat, lng: p.lng };
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(localPoint)); } catch { /* solo en memoria */ }
      adminMarker!.setLatLng(p); showAdminCoords();
    };
    adminMap.on('click', e => set(e.latlng));
    adminMarker.on('dragend', () => set(adminMarker!.getLatLng()));
  }
  adminMap.invalidateSize();
  adminMap.setView([localPoint.lat, localPoint.lng], adminMap.getZoom());
  showAdminCoords();
}

// Cliente
document.body.insertAdjacentHTML('beforeend', `
  <dialog class="locate" id="locate" aria-labelledby="locate-title">
    <div class="admin-head"><h2 id="locate-title">¿A dónde llevamos tu pancho?</h2><button class="admin-close" id="locate-close" aria-label="Cerrar">✕</button></div>
    <p class="admin-hint" id="locate-hint">Tocá el mapa para marcar tu ubicación. Podés mover el puntero. San Martín de las Escobas, Santa Fe.</p>
    <div class="map-wrap"><div class="map" id="client-map"></div><div class="route-info" id="route-info" role="status" hidden></div></div>
    <div class="locate-actions"><button class="admin-reset" id="locate-gps">Usar mi ubicación</button><button class="primary" id="locate-confirm" disabled>Confirmar pedido <span aria-hidden="true">✓</span></button></div>
  </dialog>`);
const locateDialog = document.querySelector<HTMLDialogElement>('#locate')!;
const locateConfirm = document.querySelector<HTMLButtonElement>('#locate-confirm')!;
let clientMap: L.Map | null = null;
let clientMarker: L.Marker | null = null;
let localMarker: L.Marker | null = null;
let clientPoint: Point | null = null;
// Zona de entrega: hasta 5 km del local. Envío: $2.000 de base + $1.000 por km.
const RADIUS_KM = 2, BASE_FEE = 2000, PER_KM = 1000;
// El repartidor tarda 5 min en salir (retirar el pedido, saludar al local y subirse a la moto) antes del viaje.
const DEPARTURE_MIN = 5, FALLBACK_KMH = 30;
let zoneCircle: L.Circle | null = null;
const inZone = (p: L.LatLng) => L.latLng(localPoint.lat, localPoint.lng).distanceTo(p) <= RADIUS_KM * 1000;
const money = (n: number) => '$' + n.toLocaleString('es-AR');
const kmText = (km: number) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
const feeFor = (km: number) => Math.round((BASE_FEE + PER_KM * km) / 50) * 50;
function showOutOfZone() {
  setBubble(`<span class="chip warn">📍 <b>Fuera de zona</b> · solo entregamos hasta ${RADIUS_KM} km del local</span>`);
}
function placeClient(p: L.LatLng) {
  if (!inZone(p)) { showOutOfZone(); if (clientMarker && clientPoint) clientMarker.setLatLng([clientPoint.lat, clientPoint.lng]); return; }
  clientPoint = { lat: p.lat, lng: p.lng };
  if (!clientMarker) {
    clientMarker = L.marker(p, { icon: clientIcon, draggable: true, zIndexOffset: 500 }).addTo(clientMap!);
    clientMarker.on('dragend', () => placeClient(clientMarker!.getLatLng()));
  } else clientMarker.setLatLng(p);
  locateConfirm.disabled = false;
  void drawRoute();
}
function openLocate() {
  locateDialog.showModal();
  setTimeout(() => {
    if (!clientMap) {
      clientMap = makeMap(document.querySelector<HTMLElement>('#client-map')!);
      clientMap.on('click', e => placeClient(e.latlng));
    }
    clientMap.invalidateSize();
    if (localMarker) localMarker.setLatLng([localPoint.lat, localPoint.lng]);
    else localMarker = L.marker([localPoint.lat, localPoint.lng], { icon: localIcon, interactive: false, keyboard: false }).addTo(clientMap);
    const center: L.LatLngExpression = [localPoint.lat, localPoint.lng];
    if (zoneCircle) zoneCircle.setLatLng(center);
    else zoneCircle = L.circle(center, { radius: RADIUS_KM * 1000, color: '#a43b25', weight: 2, dashArray: '6 8', fillColor: '#f8c638', fillOpacity: .12, interactive: false }).addTo(clientMap);
    if (clientPoint && !inZone(L.latLng(clientPoint.lat, clientPoint.lng))) { // el local se movió y el cliente quedó afuera
      clientPoint = null; clientMarker?.remove(); clientMarker = null; routeLayer?.remove(); routeLayer = null; locateConfirm.disabled = true;
    }
    if (clientPoint) { clientMap.setView([clientPoint.lat, clientPoint.lng], 15); void drawRoute(); }
    else { clientMap.fitBounds(zoneCircle.getBounds(), { padding: [20, 20] }); setBubble(`<span class="chip km">🛵 <b>Hasta ${RADIUS_KM} km</b></span><span class="chip fee">💵 <b>${money(BASE_FEE)}</b> + ${money(PER_KM)} por km</span>`); }
  }, 0);
}
document.querySelector('#finish')!.addEventListener('click', () => { if (orderFlow.hidden) openLocate(); });
document.querySelector('#locate-close')!.addEventListener('click', () => locateDialog.close());
locateConfirm.addEventListener('click', () => {
  pendingTrip = lastTrip ?? straightTrip();
  locateDialog.close(); void runOrder();
});
document.querySelector('#locate-gps')!.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => { const p = L.latLng(pos.coords.latitude, pos.coords.longitude); placeClient(p); clientMap!.setView(p, 16); },
    () => { document.querySelector('#locate-hint')!.textContent = 'No pudimos obtener tu ubicación. Tocá el mapa para marcarla.'; },
    { timeout: 8000 });
});

// Mapa del admin a pantalla completa.
const adminLocal = document.querySelector<HTMLElement>('#admin-local')!;
const adminFullBtn = document.querySelector<HTMLButtonElement>('#admin-map-full')!;
function setAdminFull(full: boolean) {
  adminLocal.classList.toggle('full', full);
  adminFullBtn.textContent = full ? 'Listo, volver' : 'Pantalla completa';
  setTimeout(() => { adminMap?.invalidateSize(); adminMap?.setView([localPoint.lat, localPoint.lng], adminMap.getZoom()); }, 0);
}
adminFullBtn.addEventListener('click', () => setAdminFull(!adminLocal.classList.contains('full')));
adminDialog.addEventListener('cancel', e => { if (adminLocal.classList.contains('full')) { e.preventDefault(); setAdminFull(false); } });
adminDialog.addEventListener('close', () => setAdminFull(false));

// Mejor ruta en auto entre el local y el cliente (OSRM público; si falla, línea recta punteada).
let routeLayer: L.FeatureGroup | null = null;
let routeRun = 0;
const routeInfo = document.querySelector<HTMLElement>('#route-info')!;
const bubbleStats = (km: number, time: string, fee: number) =>
  `<span class="chip km">🛵 <b>${kmText(km)}</b></span><span class="chip min">⏱️ <b>${time}</b></span><span class="chip fee">💵 <b>${money(fee)}</b></span>`;
function setBubble(html: string) { routeInfo.innerHTML = html; routeInfo.hidden = false; }
function showRoute(points: L.LatLngExpression[], dashed: boolean, text: string) {
  routeLayer?.remove();
  const line = L.polyline(points, dashed ? { color: '#29271e', weight: 4, dashArray: '8 10', opacity: .8 } : { color: '#c93323', weight: 6, opacity: .9, lineJoin: 'round' });
  const group = L.featureGroup([line]);
  if (!dashed) {
    // Tramos punteados desde cada puntero hasta el camino más cercano.
    const dash = { color: '#29271e', weight: 3, dashArray: '4 8', opacity: .7 };
    group.addLayer(L.polyline([[localPoint.lat, localPoint.lng], points[0]], dash));
    group.addLayer(L.polyline([points[points.length - 1], [clientPoint!.lat, clientPoint!.lng]], dash));
  }
  routeLayer = group.addTo(clientMap!);
  const bounds = group.getBounds().extend([localPoint.lat, localPoint.lng]).extend([clientPoint!.lat, clientPoint!.lng]);
  clientMap!.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
  setBubble(text);
}
async function drawRoute() {
  if (!clientPoint || !clientMap) return;
  const run = ++routeRun;
  const a = localPoint, b = clientPoint;
  lastTrip = null;
  setBubble('<span class="chip">🔎 Buscando la mejor ruta…</span>');
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (run !== routeRun) return;
    const r = data.routes?.[0];
    if (!r) throw new Error('sin ruta');
    const km = r.distance / 1000, min = Math.max(1, Math.round(r.duration / 60)) + DEPARTURE_MIN;
    const pts: [number, number][] = r.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
    lastTrip = { pts: [[a.lat, a.lng], ...pts, [b.lat, b.lng]], km, min, fee: feeFor(km) };
    showRoute(pts, false, bubbleStats(km, `${min} min`, feeFor(km)));
  } catch {
    if (run !== routeRun) return;
    const km = L.latLng(a.lat, a.lng).distanceTo(L.latLng(b.lat, b.lng)) / 1000;
    const min = Math.max(1, Math.round(km / FALLBACK_KMH * 60)) + DEPARTURE_MIN;
    lastTrip = { pts: [[a.lat, a.lng], [b.lat, b.lng]], km, min, fee: feeFor(km) };
    showRoute([[a.lat, a.lng], [b.lat, b.lng]], true, bubbleStats(km, `${min} min`, feeFor(km)));
  }
}

// ---- Seguimiento simulado del pedido: la moto recorre la ruta en 20 s (en vez de los minutos reales) ----
type Trip = { pts: [number, number][]; km: number; min: number; fee: number };
const SIM_MS = 20000;
let lastTrip: Trip | null = null;
let pendingTrip: Trip | null = null;
function straightTrip(): Trip {
  const a = localPoint, b = clientPoint!;
  const km = L.latLng(a.lat, a.lng).distanceTo(L.latLng(b.lat, b.lng)) / 1000;
  return { pts: [[a.lat, a.lng], [b.lat, b.lng]], km, min: Math.max(1, Math.round(km / FALLBACK_KMH * 60)) + DEPARTURE_MIN, fee: feeFor(km) };
}
const STEPS = [['📦', 'Recibido'], ['👨‍🍳', 'Preparando'], ['🛵', 'En camino'], ['✅', 'Entregado']];
document.body.insertAdjacentHTML('beforeend', `
  <button class="track-fab" id="track-open" hidden aria-label="Mi pedido"><span aria-hidden="true">🛵</span> Mi pedido <small id="track-fab-state"></small></button>
  <dialog class="locate" id="track" aria-labelledby="track-title">
    <div class="admin-head"><h2 id="track-title">Mi pedido</h2><button class="admin-close" id="track-close" aria-label="Cerrar">✕</button></div>
    <p class="admin-hint">Simulación: el recorrido real se acelera para durar 20 segundos.</p>
    <div class="map-wrap"><div class="map" id="track-map"></div><div class="route-info track-info" id="track-info" role="status"></div></div>
  </dialog>`);
const trackDialog = document.querySelector<HTMLDialogElement>('#track')!;
const trackFab = document.querySelector<HTMLButtonElement>('#track-open')!;
const trackInfo = document.querySelector<HTMLElement>('#track-info')!;
let trip: Trip | null = null, tripCum: number[] = [], tripStart = 0, tripRaf = 0, tripClient: Point | null = null, tripLocal: Point | null = null;
let trackMap: L.Map | null = null, trackLayers: L.LayerGroup | null = null, motoMarker: L.Marker | null = null, trackDrawn = false;
let motoPos: [number, number] = [0, 0], tripState = 0, tripT = 0;
const motoIcon = L.divIcon({ className: 'pin pin-moto', html: '<span>🛵</span>', iconSize: [44, 44], iconAnchor: [22, 22] });
function pointAt(frac: number): [number, number] {
  const target = frac * tripCum[tripCum.length - 1];
  let i = 1;
  while (i < tripCum.length - 1 && tripCum[i] < target) i++;
  const seg = tripCum[i] - tripCum[i - 1] || 1, f = Math.min(1, Math.max(0, (target - tripCum[i - 1]) / seg));
  const p = trip!.pts[i - 1], q = trip!.pts[i];
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
}
function startTracking() {
  if (!pendingTrip || !clientPoint) return;
  cancelAnimationFrame(tripRaf);
  trip = pendingTrip; tripClient = { ...clientPoint }; tripLocal = { ...localPoint };
  tripCum = [0];
  for (let i = 1; i < trip.pts.length; i++) tripCum.push(tripCum[i - 1] + L.latLng(trip.pts[i - 1]).distanceTo(L.latLng(trip.pts[i])));
  tripStart = performance.now(); trackDrawn = false; motoPos = trip.pts[0];
  trackFab.hidden = false; trackFab.classList.add('pulse');
  tripRaf = requestAnimationFrame(tick);
}
function tick(now: number) {
  if (!trip) return;
  tripT = Math.min(1, (now - tripStart) / SIM_MS);
  const dep = Math.min(.4, DEPARTURE_MIN / trip.min); // la salida del repartidor ocupa su parte proporcional de los 20 s
  tripState = tripT >= 1 ? 3 : tripT < dep * .4 ? 0 : tripT < dep ? 1 : 2;
  motoPos = tripT < dep ? trip.pts[0] : pointAt((tripT - dep) / (1 - dep));
  motoMarker?.setLatLng(motoPos);
  renderTrack();
  if (tripT < 1) tripRaf = requestAnimationFrame(tick);
}
let lastRender = '';
function renderTrack() {
  const eta = Math.max(1, Math.ceil(trip!.min * (1 - tripT)));
  const stateName = STEPS[tripState][1];
  const html = `<div class="steps">${STEPS.map((s, i) => `<span class="step-chip${i < tripState || tripState === 3 ? ' done' : i === tripState ? ' now' : ''}"><i aria-hidden="true">${s[0]}</i>${s[1]}</span>`).join('')}</div>` +
    `<div class="track-meta">${tripState === 3 ? '<span class="chip fee">🎉 <b>¡Tu pedido llegó!</b></span>' : `<span class="chip min">⏱️ <b>Llega en ${eta} min</b></span>`}<span class="chip km">🛵 <b>${kmText(trip!.km)}</b></span><span class="chip fee">💵 <b>${money(trip!.fee)}</b></span></div>`;
  if (html !== lastRender) { lastRender = html; trackInfo.innerHTML = html; }
  document.querySelector('#track-fab-state')!.textContent = tripState === 3 ? '· Entregado' : `· ${stateName}`;
}
function drawTrack() {
  trackLayers?.clearLayers();
  trackLayers = trackLayers ?? L.layerGroup().addTo(trackMap!);
  const line = L.polyline(trip!.pts, { color: '#c93323', weight: 6, opacity: .85, lineJoin: 'round' }).addTo(trackLayers);
  L.marker([tripLocal!.lat, tripLocal!.lng], { icon: localIcon, interactive: false, keyboard: false }).addTo(trackLayers);
  L.marker([tripClient!.lat, tripClient!.lng], { icon: clientIcon, interactive: false, keyboard: false }).addTo(trackLayers);
  motoMarker = L.marker(motoPos, { icon: motoIcon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(trackLayers);
  trackMap!.fitBounds(line.getBounds().pad(.35), { maxZoom: 17 });
  trackDrawn = true;
}
trackFab.addEventListener('click', () => {
  if (!trip) return;
  trackFab.classList.remove('pulse');
  trackDialog.showModal();
  setTimeout(() => {
    if (!trackMap) trackMap = makeMap(document.querySelector<HTMLElement>('#track-map')!);
    trackMap.invalidateSize();
    if (!trackDrawn) drawTrack(); else motoMarker?.setLatLng(motoPos);
    lastRender = ''; renderTrack();
  }, 0);
});
document.querySelector('#track-close')!.addEventListener('click', () => trackDialog.close());
