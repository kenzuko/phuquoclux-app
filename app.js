(() => {
  const LOCATIONS = [
    { id:'duong-dong', name:'Dương Đông', subtitle:'Trung tâm · dịch vụ', lat:10.2172, lng:103.9593, category:'place', icon:'⌂', kicker:'KHU VỰC', copy:'Ăn uống, dịch vụ hằng ngày và các điểm quanh trung tâm.', action:'Khám phá khu vực', href:'#' },
    { id:'an-thoi', name:'An Thới', subtitle:'Tour đảo · bến tàu', lat:10.0191, lng:104.0150, category:'tour', icon:'🛥', kicker:'TOUR · NAM ĐẢO', copy:'Điểm xuất phát chính cho trải nghiệm đảo và cano phía Nam.', action:'Xem Tour 3 đảo', href:'./product.html?type=tour' },
    { id:'ganh-dau', name:'Gành Dầu', subtitle:'Bắc đảo · khám phá', lat:10.3759, lng:103.9000, category:'ticket', icon:'🎟', kicker:'BẮC ĐẢO', copy:'Khu vực tham quan phía Bắc. Ticket sẽ được gắn theo đúng địa điểm và offer.', action:'Xem vé', href:'./product.html?type=ticket' },
    { id:'airport-demo', name:'Sân bay PQC', subtitle:'Transfer · demo UI', lat:10.1698, lng:103.9931, category:'transfer', icon:'🚗', kicker:'TRANSFER', copy:'Đặt xe riêng từ sân bay đến khách sạn với thông tin đón rõ ràng.', action:'Đặt xe', href:'./product.html?type=transfer' }
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
      marker.on('click', () => showMapEntity(item));
      marker.addTo(holder.layer);
    });
  }

  function showMapEntity(item) {
    document.querySelectorAll('[data-map-sheet]').forEach(sheet => {
      sheet.hidden = false;
      sheet.querySelector('[data-entity-kicker]').textContent = item.kicker || 'TRÊN BẢN ĐỒ';
      sheet.querySelector('[data-entity-title]').textContent = item.name;
      sheet.querySelector('[data-entity-copy]').textContent = item.copy || item.subtitle;
      const action = sheet.querySelector('[data-entity-action]');
      action.textContent = item.action || 'Xem lựa chọn';
      action.href = item.href || '#';
    });
  }

  function hideMapEntity() {
    document.querySelectorAll('[data-map-sheet]').forEach(sheet => { sheet.hidden = true; });
  }

  document.querySelectorAll('.entity-sheet-close').forEach(btn => btn.addEventListener('click', hideMapEntity));

  function rerender() { maps.forEach(renderMarkers); hideMapEntity(); }

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
  ['expandMap','desktopExpand','bottomMapLink'].forEach(id => document.getElementById(id)?.addEventListener('click', e => {
    if (id === 'bottomMapLink') e.preventDefault();
    openFullMap();
  }));
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