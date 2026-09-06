/* =========================================================
   BAZAR CENTRAL — script compartido
   ========================================================= */

/* ---------- 1) Animaciones de entrada (bento / editorial / subcategorías) ---------- */
(function () {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('in-view');
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.bento-card, .ed-photos, .subcat-card')
    .forEach((el) => io.observe(el));
})();

/* ---------- 2) Menú mobile (hamburguesa) + acordeón de subcategorías ---------- */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const navlinks = document.querySelector('#navlinks');
  if (!toggle || !navlinks) return;

  toggle.addEventListener('click', () => {
    const isOpen = navlinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // En mobile, tocar el nombre de la categoría abre/cierra su lista de subcategorías
  // en vez de navegar directo (así el usuario puede elegir subcategoría sin salir del menú).
  document.querySelectorAll('.navitem').forEach((item) => {
    const link = item.querySelector('a');
    link.addEventListener('click', (e) => {
      if (window.innerWidth > 720) return; // en desktop, comportamiento normal (hover)
      const alreadyOpen = item.classList.contains('mobile-open');
      if (!alreadyOpen) {
        e.preventDefault();
        document.querySelectorAll('.navitem').forEach((i) => i.classList.remove('mobile-open'));
        item.classList.add('mobile-open');
      }
      // si ya estaba abierto, el segundo toque sí navega normalmente
    });
  });
})();

/* ---------- 2.5) Filtros de productos (muestran SOLO la subcategoría elegida) ----------
   Se puede activar un filtro de 3 formas:
   a) Tocando un botón de la barra de filtros (arriba de "Productos").
   b) Tocando una foto de subcategoría (arriba de la página): lleva directo a la sección
      de Productos ya filtrada por esa subcategoría.
   c) Llegando desde el menú de navegación de otra página, ej: cocina.html#filtro-ollas-y-sartenes
      (en ese caso además se hace scroll automático hasta los productos ya filtrados).
========================================================= */
(function () {
  function activarFiltro(valorFiltro, opciones) {
    opciones = opciones || {};
    document.querySelectorAll('.filter-bar[data-filter-group]').forEach((bar) => {
      const grid = bar.parentElement.querySelector('.product-grid');
      if (!grid) return;

      const chipObjetivo = bar.querySelector(`[data-filter="${valorFiltro}"]`);
      if (!chipObjetivo) return; // esta página no tiene esa subcategoría, no se toca

      bar.querySelectorAll('[data-filter]').forEach((c) => c.classList.remove('active'));
      chipObjetivo.classList.add('active');

      let visibles = 0;
      grid.querySelectorAll('.product-card').forEach((card) => {
        const coincide = valorFiltro === 'all' || card.dataset.subcat === valorFiltro;
        card.hidden = !coincide;
        if (coincide) visibles++;
      });

      let vacio = grid.querySelector('.filter-empty');
      if (visibles === 0) {
        if (!vacio) {
          vacio = document.createElement('div');
          vacio.className = 'filter-empty';
          vacio.textContent = 'Todavía no hay productos cargados en esta subcategoría.';
          grid.appendChild(vacio);
        }
      } else if (vacio) {
        vacio.remove();
      }

      if (opciones.scrollTo) {
        setTimeout(() => bar.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    });
  }

  // a) Botones de la barra de filtros: tocar de nuevo el que ya está activo vuelve a "Todos"
  document.querySelectorAll('.filter-bar[data-filter-group] [data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const yaActivo = chip.classList.contains('active');
      activarFiltro(yaActivo ? 'all' : chip.dataset.filter);
    });
  });

  // b) Fotos de subcategoría: tocarlas filtra los productos y baja directo a esa sección
  document.querySelectorAll('.subcat-card[data-filter-target]').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      activarFiltro(card.dataset.filterTarget, { scrollTo: true });
    });
  });

  // c) Llegada desde el menú de navegación con #filtro-xxxxx en la URL
  const hash = window.location.hash;
  if (hash.indexOf('#filtro-') === 0) {
    activarFiltro(hash.replace('#filtro-', ''), { scrollTo: true });
  }
})();

/* ---------- 4) Productos desde Airtable ----------
   PASOS PARA CONECTAR (Sebastián / Felipe):
   1. Crear una cuenta gratis en airtable.com y una base con una tabla "Productos"
      con estos campos: Nombre (texto), Categoria (texto: Cocina/Juguetes/Juegos de mesa),
      Subcategoria (texto), Foto (adjunto de imagen), SinStock (casilla / checkbox).
   2. En Airtable: Account > Developer hub > Personal access token.
      Crear un token de SOLO LECTURA (scope: data.records:read) limitado a esta base.
      ¡No usar un token con permiso de escritura acá! queda visible en el código fuente.
   3. Completar BASE_ID, TABLE_NAME y API_KEY abajo.
   4. Opcional: para que Felipe cargue productos sin entrar a Airtable directamente,
      Airtable tiene una vista de tipo "Formulario" que se puede compartir como link
      o embeber en admin.html (ver ese archivo).
========================================================= */
const AIRTABLE_CONFIG = {
  baseId: 'TU_BASE_ID_AQUI',     // ej: appXXXXXXXXXXXXXX
  tableName: 'Productos',
  apiKey: 'TU_API_KEY_AQUI',     // Personal Access Token de SOLO LECTURA
};

async function cargarProductos() {
  const grids = document.querySelectorAll('.product-grid');
  if (!grids.length) return;

  const configured = AIRTABLE_CONFIG.baseId !== 'TU_BASE_ID_AQUI'
    && AIRTABLE_CONFIG.apiKey !== 'TU_API_KEY_AQUI';

  if (!configured) return; // deja el mensaje placeholder que ya está en el HTML

  for (const grid of grids) {
    const categoria = grid.dataset.category;
    try {
      const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.tableName)}?filterByFormula=${encodeURIComponent(`{Categoria}='${categoria}'`)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` },
      });
      if (!res.ok) throw new Error('Airtable respondio ' + res.status);
      const data = await res.json();

      if (!data.records || !data.records.length) {
        grid.innerHTML = '<div class="product-empty">Todavia no hay productos cargados en esta categoria.</div>';
        continue;
      }

      grid.innerHTML = data.records.map((r) => {
        const f = r.fields || {};
        const foto = (f.Foto && f.Foto[0] && f.Foto[0].url) || '';
        const sinStock = !!f.SinStock;
        return `
          <div class="product-card ${sinStock ? 'out-of-stock' : ''}">
            ${sinStock ? '<div class="ribbon">Sin stock</div>' : ''}
            <div class="photo">${foto ? `<img src="${foto}" alt="${f.Nombre || ''}">` : ''}</div>
            <div class="body">
              <h4>${f.Nombre || 'Producto'}</h4>
              <div class="subtag">${f.Subcategoria || ''}</div>
            </div>
          </div>`;
      }).join('');
    } catch (err) {
      grid.innerHTML = '<div class="product-empty">No se pudieron cargar los productos. Revisa la conexion con Airtable.</div>';
      console.error(err);
    }
  }
}

document.addEventListener('DOMContentLoaded', cargarProductos);
