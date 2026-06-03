const state = {
  products: [],
  category: 'Все',
  fabrics: new Set(),
  color: '',
  search: '',
  sort: 'popular'
};

const categoryOrder = ['Все', 'Страйп', 'Евро', '1,5 спальные', '2х спальные', 'Семейные'];
const colorMap = {
  белый: '#f8f8f6',
  черный: '#171717',
  серый: '#969696',
  бежевый: '#d9c8b5',
  коричневый: '#8a6048',
  зеленый: '#8ea37f',
  желтый: '#e5c96d',
  синий: '#4d6f9f',
  голубой: '#a8c9de',
  розовый: '#e7b8c0',
  красный: '#c95d55',
  фиолетовый: '#9a81b9'
};

const els = {
  grid: document.querySelector('#product-grid'),
  empty: document.querySelector('#empty-state'),
  count: document.querySelector('#product-count'),
  range: document.querySelector('#price-range'),
  tabs: document.querySelector('#category-tabs'),
  fabrics: document.querySelector('#fabric-filters'),
  colors: document.querySelector('#color-filters'),
  search: document.querySelector('#search-input'),
  sort: document.querySelector('#sort-select'),
  reset: document.querySelector('#reset-filters'),
  heroImage: document.querySelector('#hero-image'),
  dialog: document.querySelector('#product-dialog'),
  dialogClose: document.querySelector('#dialog-close'),
  dialogImage: document.querySelector('#dialog-image'),
  dialogThumbs: document.querySelector('#dialog-thumbs'),
  dialogCategory: document.querySelector('#dialog-category'),
  dialogTitle: document.querySelector('#dialog-title'),
  dialogPrice: document.querySelector('#dialog-price'),
  dialogOldPrice: document.querySelector('#dialog-old-price'),
  dialogSpecs: document.querySelector('#dialog-specs'),
  dialogWb: document.querySelector('#dialog-wb')
};

init();

async function init() {
  try {
    if (Array.isArray(window.CATALOG_PRODUCTS)) {
      state.products = window.CATALOG_PRODUCTS;
    } else {
      const response = await fetch('catalog-data/products.json');
      state.products = await response.json();
    }
    state.products = state.products.map(normalizeProduct);
    buildControls();
    bindEvents();
    render();
  } catch (error) {
    els.empty.hidden = false;
    els.empty.textContent = 'Не удалось загрузить каталог. Откройте сайт через локальный сервер.';
  }
}

function normalizeProduct(product) {
  const imageFolder = getImageFolder(product);
  return {
    ...product,
    priceRub: Number(product.priceRub || 0),
    oldPriceRub: Number(product.oldPriceRub || 0),
    rating: Number(product.rating || 0),
    reviews: Number(product.reviews || 0),
    photoCount: Number(product.photoCount || 1),
    imageFolder,
    mainImage: `${imageFolder}/01.webp`
  };
}

function getImageFolder(product) {
  if (product.wbBasket) {
    const id = String(product.id);
    const vol = Math.floor(Number(id) / 100000);
    const part = Math.floor(Number(id) / 1000);
    return `https://${product.wbBasket}.wbbasket.ru/vol${vol}/part${part}/${id}/images/big`;
  }
  return product.imageFolder;
}

function buildControls() {
  const counts = new Map();
  categoryOrder.forEach((category) => counts.set(category, category === 'Все' ? state.products.length : 0));
  state.products.forEach((product) => {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
  });

  els.tabs.innerHTML = categoryOrder.map((category) => {
    const count = counts.get(category) || 0;
    return `<button class="tab-button" type="button" data-category="${category}" ${category === 'Все' ? 'aria-selected="true"' : ''}>${category} · ${count}</button>`;
  }).join('');

  const fabrics = [...new Set(state.products.map((product) => product.fabric).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  els.fabrics.innerHTML = fabrics.map((fabric) => `
    <label>
      <input type="checkbox" value="${escapeHtml(fabric)}">
      <span>${escapeHtml(fabric)}</span>
    </label>
  `).join('');

  const colors = [...new Set(state.products.flatMap((product) => splitValues(product.colors)))].sort((a, b) => a.localeCompare(b, 'ru'));
  els.colors.innerHTML = colors.map((color) => {
    const swatch = colorMap[color.toLowerCase()] || '#d8d8d8';
    const border = color.toLowerCase() === 'белый' ? 'box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 4px #d0d0d0;' : '';
    return `<button class="swatch" type="button" title="${escapeHtml(color)}" aria-label="${escapeHtml(color)}" data-color="${escapeHtml(color)}" style="background:${swatch}; ${border}"></button>`;
  }).join('');
}

function bindEvents() {
  els.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    render();
  });

  els.fabrics.addEventListener('change', (event) => {
    if (event.target.type !== 'checkbox') return;
    if (event.target.checked) state.fabrics.add(event.target.value);
    else state.fabrics.delete(event.target.value);
    render();
  });

  els.colors.addEventListener('click', (event) => {
    const button = event.target.closest('[data-color]');
    if (!button) return;
    state.color = state.color === button.dataset.color ? '' : button.dataset.color;
    render();
  });

  els.search.addEventListener('input', () => {
    state.search = els.search.value.trim().toLowerCase();
    render();
  });

  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    render();
  });

  els.reset.addEventListener('click', () => {
    state.category = 'Все';
    state.fabrics.clear();
    state.color = '';
    state.search = '';
    state.sort = 'popular';
    els.search.value = '';
    els.sort.value = 'popular';
    els.fabrics.querySelectorAll('input').forEach((input) => {
      input.checked = false;
    });
    render();
  });

  els.grid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-id]');
    const action = event.target.closest('[data-action]');
    if (!card || !action) return;
    const product = state.products.find((item) => item.id === card.dataset.id);
    if (!product) return;
    if (action.dataset.action === 'details') showDetails(product);
  });

  els.dialogClose.addEventListener('click', () => els.dialog.close());
  els.dialog.addEventListener('click', (event) => {
    if (event.target === els.dialog) els.dialog.close();
  });
}

function render() {
  const products = getFilteredProducts();
  updateActiveControls();
  renderSummary(products);
  renderProducts(products);
}

function getFilteredProducts() {
  let products = [...state.products];

  if (state.category !== 'Все') {
    products = products.filter((product) => product.category === state.category);
  }

  if (state.fabrics.size) {
    products = products.filter((product) => state.fabrics.has(product.fabric));
  }

  if (state.color) {
    products = products.filter((product) => splitValues(product.colors).includes(state.color));
  }

  if (state.search) {
    products = products.filter((product) => {
      const haystack = [
        product.name,
        product.category,
        product.colors,
        product.fabric,
        product.beddingSize,
        product.composition,
        product.density
      ].join(' ').toLowerCase();
      return haystack.includes(state.search);
    });
  }

  products.sort((a, b) => {
    if (state.sort === 'price-asc') return a.priceRub - b.priceRub;
    if (state.sort === 'price-desc') return b.priceRub - a.priceRub;
    if (state.sort === 'rating') return b.rating - a.rating || b.reviews - a.reviews;
    return b.reviews - a.reviews || b.rating - a.rating;
  });

  return products;
}

function updateActiveControls() {
  els.tabs.querySelectorAll('[data-category]').forEach((button) => {
    const active = button.dataset.category === state.category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  els.colors.querySelectorAll('[data-color]').forEach((button) => {
    button.classList.toggle('active', button.dataset.color === state.color);
  });
}

function renderSummary(products) {
  els.count.textContent = formatCount(products.length);
  if (!products.length) {
    els.range.textContent = '';
    return;
  }
  const prices = products.map((product) => product.priceRub).filter(Boolean);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  els.range.textContent = `${formatPrice(min)} - ${formatPrice(max)}`;
}

function renderProducts(products) {
  els.empty.hidden = products.length > 0;
  els.grid.innerHTML = products.map((product) => `
    <article class="product-card" data-id="${product.id}">
      <button class="product-image" type="button" data-action="details" aria-label="Открыть ${escapeHtml(product.name)}">
        <img src="${escapeHtml(product.mainImage)}" alt="${escapeHtml(product.name)}" loading="lazy">
        <span class="badge">${escapeHtml(product.category)}</span>
      </button>
      <div class="product-meta">
        <h2 class="product-name">${escapeHtml(product.name)}</h2>
        <div class="product-facts">${escapeHtml(compactFacts(product))}</div>
        <div class="price-row">
          <span>${formatPrice(product.priceRub)}</span>
          ${product.oldPriceRub ? `<del>${formatPrice(product.oldPriceRub)}</del>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <a class="primary-button" href="${escapeHtml(product.wbUrl)}" target="_blank" rel="noreferrer">Купить</a>
        <button class="ghost-button" type="button" data-action="details" aria-label="Подробнее">i</button>
      </div>
    </article>
  `).join('');
}

function showDetails(product) {
  const images = Array.from({ length: Math.min(product.photoCount, 8) }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return `${product.imageFolder}/${number}.webp`;
  });

  els.dialogImage.src = images[0] || product.mainImage;
  els.dialogImage.alt = product.name;
  els.dialogCategory.textContent = product.category;
  els.dialogTitle.textContent = product.name;
  els.dialogPrice.textContent = formatPrice(product.priceRub);
  els.dialogOldPrice.textContent = product.oldPriceRub ? formatPrice(product.oldPriceRub) : '';
  els.dialogWb.href = product.wbUrl;

  const specs = [
    ['Размер', product.beddingSize],
    ['Ткань', product.fabric],
    ['Состав', product.composition],
    ['Плотность', product.density],
    ['Простыня', product.sheetSize],
    ['Пододеяльник', product.duvetSize],
    ['Наволочки', product.pillowcaseSize],
    ['Цвет', product.colors],
    ['Остаток', product.inStock ? `${product.inStock} шт.` : 'уточнить на WB'],
    ['Рейтинг', product.rating ? `${product.rating} / ${product.reviews} отзывов` : 'нет данных']
  ].filter(([, value]) => value);

  els.dialogSpecs.innerHTML = specs.map(([label, value]) => `
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(value)}</dd>
  `).join('');

  els.dialogThumbs.innerHTML = images.map((src, index) => `
    <button type="button" class="${index === 0 ? 'active' : ''}" aria-label="Фото ${index + 1}">
      <img src="${escapeHtml(src)}" alt="">
    </button>
  `).join('');

  els.dialogThumbs.querySelectorAll('button').forEach((button, index) => {
    button.addEventListener('click', () => {
      els.dialogImage.src = images[index];
      els.dialogThumbs.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });

  els.dialog.showModal();
}

function compactFacts(product) {
  return [product.colors, product.fabric, product.beddingSize].filter(Boolean).join(' · ');
}

function splitValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatPrice(value) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function formatCount(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} товара`;
  return `${count} товаров`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
