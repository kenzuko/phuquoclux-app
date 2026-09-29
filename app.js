(() => {
  const LOCATIONS = [
    { id:'duong-dong', name:'Dương Đông', subtitle:'Trung tâm · dịch vụ', lat:10.2172, lng:103.9593, category:'place', icon:'⌂' },
    { id:'an-thoi', name:'An Thới', subtitle:'Tour đảo · bến tàu', lat:10.0191, lng:104.0150, category:'tour', icon:'🛥' },
    { id:'ganh-dau', name:'Gành Dầu', subtitle:'Bắc đảo · khám phá', lat:10.3759, lng:103.9000, category:'ticket', icon:'🎟' },
    { id:'airport-demo', name:'Sân bay PQC', subtitle:'Transfer · demo UI', lat:10.1698, lng:103.9931, category:'transfer', icon:'🚗' }
  ];

  const maps = [];
  let activeCategory = 'all';

  function pinIcon(item) {
    return L.divIcon({
      className:'',
      html:`<div class="pql-pin ${item.category}"><span>${item.icon}</span></div>`,
      iconSize:[40,40], iconAnchor:[20,38], popupAnchor:[0,-36]
    });
  }

  function createMap(id, zoom=10.2) {
    const el = document.getElementById(id);
    if (!el || typeof L === 'undefined') return null;
    const map = L.map(id, { zoomControl:true, attributionControl:true, scrollWheelZoom:id !== 'homeMap' }).setView([10.205,103.965], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    maps.push({ map, layer, id });
    renderMarkers({map, layer, id});
    if (id === 'homeMap') map.on('focus', () => map.scrollWheelZoom.enable());
    return map;
  }

  function renderMarkers(holder) {
    holder.layer.clearLayers();
    LOCATIONS.filter(x => activeCategory === 'all' || x.category === activeCategory).forEach(item => {
      const marker = L.marker([item.lat,item.lng], { icon:pinIcon(item) });
      marker.bindPopup(`<div class="pql-popup"><strong>${item.name}</strong><span>${item.subtitle}</span></div>`);
      marker.addTo(holder.layer);
    });
  }

  function rerender() { maps.forEach(renderMarkers); }

  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(x => x.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeCategory = btn.dataset.category;
      rerender();
      document.querySelectorAll('.product-card').forEach(card => {
        card.style.display = activeCategory === 'all' || card.dataset.category === activeCategory ? '' : 'none';
      });
    });
  });

  const modal = document.getElementById('mapModal');
  let fullMap;
  function openFullMap() {
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    if (!fullMap) fullMap = createMap('fullMap', 10.4); else setTimeout(() => fullMap.invalidateSize(), 40);
  }
  function closeFullMap() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  ['expandMap','desktopExpand'].forEach(id => document.getElementById(id)?.addEventListener('click', openFullMap));
  document.getElementById('closeMap')?.addEventListener('click', closeFullMap);
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') closeFullMap();
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
  });

  const searchInput = document.getElementById('searchInput');
  function runSearch() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    if (!q) return;
    let target = null;
    if (q.includes('3 đảo') || q.includes('tour') || q.includes('cano')) target = LOCATIONS.find(x=>x.id==='an-thoi');
    else if (q.includes('sân bay') || q.includes('xe') || q.includes('airport')) target = LOCATIONS.find(x=>x.id==='airport-demo');
    else if (q.includes('gành') || q.includes('bắc')) target = LOCATIONS.find(x=>x.id==='ganh-dau');
    else target = LOCATIONS.find(x=>x.id==='duong-dong');
    maps.forEach(({map}) => map.flyTo([target.lat,target.lng], 13, {duration:.7}));
    document.querySelector('.mobile-map-wrap')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  document.getElementById('searchButton')?.addEventListener('click', runSearch);
  searchInput?.addEventListener('keydown', e => { if(e.key==='Enter') runSearch(); });

  document.getElementById('searchAreaButton')?.addEventListener('click', e => {
    e.currentTarget.textContent = '✓ Đã cập nhật khu vực';
    setTimeout(()=>e.currentTarget.textContent='⌕ Tìm trong khu vực này',1400);
  });
  document.getElementById('desktopSearchArea')?.addEventListener('click', e => {
    e.currentTarget.textContent = 'Đã cập nhật';
    setTimeout(()=>e.currentTarget.textContent='Tìm khu vực này',1400);
  });

  createMap('homeMap', 10.05);
  createMap('desktopMap', 10.35);
})();