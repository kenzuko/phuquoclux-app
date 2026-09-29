(() => {
  const PRODUCTS = {
    tour: {
      title:'Tour 3 đảo bằng cano',
      kicker:'NAM ĐẢO · 7 GIỜ',
      lead:'Một ngày đi đảo gọn, rõ lịch trình và biết trước điểm đón.',
      visual:'AN THỚI → 3 ĐẢO',
      color:'#6f8d46',
      price:850000,
      unit:'/ khách',
      optionLabel:'Hình thức',
      options:[['shared','Ghép đoàn',1],['private','Cano riêng',5.2]],
      chips:['Đón khách sạn','Ăn trưa','Lặn ngắm san hô'],
      summaryTitle:'Một ngày đi đảo dễ hiểu',
      summary:'Xuất phát từ Nam đảo, đi các điểm đảo theo tuyến vận hành trong ngày. JoTrip hiển thị rõ điểm đón, thời lượng và những phần đã gồm trước khi khách thanh toán.',
      facts:[['Thời lượng','Khoảng 7 giờ'],['Khởi hành','Khu vực An Thới'],['Phù hợp','Nhóm bạn · gia đình'],['Voucher','Trên điện thoại']],
      included:['Cano theo lựa chọn đã đặt','Host / hướng dẫn theo sản phẩm','Thiết bị lặn cơ bản theo chương trình','Bữa trưa theo mô tả sản phẩm','Thông tin điểm đón trước giờ khởi hành'],
      mapTitle:'An Thới và tuyến đảo',
      mapSubtitle:'Bản đồ là preview không gian. Tuyến thực tế phụ thuộc chương trình và điều kiện vận hành.',
      map:{center:[10.035,104.005],zoom:11.2,points:[[10.0191,104.0150,'An Thới'],[10.027,103.949,'Khu vực đảo 1'],[10.046,103.982,'Khu vực đảo 2']]},
      policies:[['Thời tiết & biển','Nếu điều kiện vận hành thay đổi, JoTrip cần hiển thị trạng thái và phương án xử lý rõ ràng.'],['Trẻ em','Quy tắc tuổi/chiều cao phải lấy từ từng offer, không dùng một luật chung cho mọi tour.'],['Đổi / huỷ','Chính sách phải hiển thị trước thanh toán và gắn với offer đã chọn.']]
    },
    ticket: {
      title:'Vé cáp treo Hòn Thơm',
      kicker:'HÒN THƠM · VÉ ĐIỆN TỬ',
      lead:'Chọn ngày, nhận voucher và đi thẳng đến điểm đổi/soát vé theo hướng dẫn.',
      visual:'SUNSET TOWN → HÒN THƠM',
      color:'#c8892c',
      price:700000,
      unit:'/ vé',
      optionLabel:'Loại vé',
      options:[['adult','Người lớn',1],['child','Trẻ em',0.72]],
      chips:['Voucher điện tử','Chọn ngày','Hướng dẫn sử dụng'],
      summaryTitle:'Vé rõ điều kiện sử dụng',
      summary:'Trang vé ưu tiên ngày sử dụng, đối tượng áp dụng, điều kiện đổi/soát và voucher. Không trộn thông tin điểm đến với điều kiện của ticket.',
      facts:[['Loại','Vé điện tử'],['Khu vực','Nam đảo'],['Sử dụng','Theo ngày đã chọn'],['Nhận vé','Trong booking']],
      included:['Voucher / mã vé sau khi xác nhận','Hướng dẫn điểm sử dụng vé','Điều kiện áp dụng theo loại vé','Thông tin hỗ trợ nếu voucher gặp vấn đề'],
      mapTitle:'Ga cáp treo và Hòn Thơm',
      mapSubtitle:'Map giúp khách hiểu vị trí trước khi mua, không thay thế điều kiện sử dụng trên voucher.',
      map:{center:[10.000,104.015],zoom:11.5,points:[[10.008,104.017,'Ga đi'],[9.957,104.013,'Hòn Thơm']]},
      policies:[['Ngày sử dụng','Một số loại vé gắn chặt với ngày. Phải kiểm tra offer trước khi phát hành.'],['Người lớn / trẻ em','Điều kiện phân loại phải lấy từ nhà cung cấp ở thời điểm bán.'],['Hoàn / huỷ','Không mặc định mọi ticket có cùng chính sách.']]
    },
    transfer: {
      title:'Xe riêng sân bay → khách sạn',
      kicker:'PQC · PRIVATE TRANSFER',
      lead:'Đón theo chuyến bay, xe riêng và biết trước điểm gặp tài xế.',
      visual:'PQC → KHÁCH SẠN',
      color:'#527b89',
      price:250000,
      unit:'/ xe',
      optionLabel:'Loại xe',
      options:[['sedan','Sedan 4 chỗ',1],['suv','SUV 7 chỗ',1.45],['van','Van 16 chỗ',2.2]],
      chips:['Xe riêng','Theo chuyến bay','Hỗ trợ hành lý'],
      summaryTitle:'Transfer nên cực ít bước',
      summary:'Khách chỉ cần nơi đón, nơi đến, thời gian/chuyến bay, số khách và hành lý. Giá và loại xe phải rõ trước checkout.',
      facts:[['Điểm đón','Sân bay PQC'],['Hình thức','Xe riêng'],['Theo dõi','Theo thông tin chuyến bay'],['Hỗ trợ','Điểm gặp tài xế']],
      included:['Xe theo hạng đã chọn','Đón tại điểm hẹn đã xác nhận','Thông tin tài xế / vận hành khi sẵn sàng','Hỗ trợ hành lý trong giới hạn loại xe'],
      mapTitle:'Từ sân bay đến khách sạn',
      mapSubtitle:'Route preview giúp khách hình dung quãng đường. Thời gian thực tế phụ thuộc điểm đến và giao thông.',
      map:{center:[10.195,103.982],zoom:11.2,points:[[10.1698,103.9931,'Sân bay PQC'],[10.225,103.950,'Khu vực khách sạn']]},
      policies:[['Chuyến bay','Cần lưu flight number khi có để phối hợp giờ đón.'],['Hành lý','Số vali lớn ảnh hưởng loại xe phù hợp.'],['Chờ / đổi giờ','Quy tắc chờ và đổi giờ phải thuộc offer/booking, không viết chung chung.']]
    }
  };

  const params = new URLSearchParams(location.search);
  const type = PRODUCTS[params.get('type')] ? params.get('type') : 'tour';
  const p = PRODUCTS[type];
  let pax = Math.max(1, Number(params.get('pax')) || 2);
  let selected = p.options[0];

  const money = value => new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ';
  const $ = id => document.getElementById(id);

  document.title = p.title + ' — PhuQuocLux';
  $('detailTitle').textContent = p.title;
  $('detailKicker').textContent = p.kicker;
  $('detailLead').textContent = p.lead;
  $('heroVisualLabel').textContent = p.visual;
  $('heroVisual').style.setProperty('--product-color', p.color);
  $('basePrice').textContent = money(p.price);
  $('priceUnit').textContent = p.unit;
  $('optionLabel').textContent = p.optionLabel;
  $('summaryTitle').textContent = p.summaryTitle;
  $('summaryText').textContent = p.summary;
  $('mapTitle').textContent = p.mapTitle;
  $('mapSubtitle').textContent = p.mapSubtitle;

  $('detailChips').innerHTML = p.chips.map(x => `<span>${x}</span>`).join('');
  $('factGrid').innerHTML = p.facts.map(([a,b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('');
  $('includedList').innerHTML = p.included.map(x => `<li><span>✓</span>${x}</li>`).join('');
  $('policyList').innerHTML = p.policies.map(([a,b]) => `<div><b>${a}</b><p>${b}</p></div>`).join('');
  $('optionList').innerHTML = p.options.map((opt,i) => `<button type="button" class="option-button ${i===0?'is-selected':''}" data-id="${opt[0]}"><b>${opt[1]}</b></button>`).join('');

  function total(){
    const multiplier = selected[2];
    const quantity = type === 'transfer' ? 1 : pax;
    return p.price * multiplier * quantity;
  }
  function sync(){
    $('paxValue').textContent = pax;
    $('totalPrice').textContent = money(total());
    const qs = new URLSearchParams({type,pax:String(pax),option:selected[0]});
    $('bookingCta').href = './checkout.html?' + qs.toString();
  }
  $('minusPax').addEventListener('click',()=>{pax=Math.max(1,pax-1);sync()});
  $('plusPax').addEventListener('click',()=>{pax=Math.min(20,pax+1);sync()});
  document.querySelectorAll('.option-button').forEach(btn => btn.addEventListener('click',()=>{
    document.querySelectorAll('.option-button').forEach(x=>x.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    selected = p.options.find(x=>x[0]===btn.dataset.id) || p.options[0];
    sync();
  }));

  const date = new Date();
  date.setDate(date.getDate()+1);
  $('bookingDate').value = date.toISOString().slice(0,10);
  $('bookingDate').min = new Date().toISOString().slice(0,10);
  sync();

  if (typeof L !== 'undefined') {
    const map = L.map('productMap',{scrollWheelZoom:false}).setView(p.map.center,p.map.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    p.map.points.forEach(([lat,lng,label])=>{
      L.circleMarker([lat,lng],{radius:8,color:p.color,fillColor:'#fff',fillOpacity:1,weight:4}).bindPopup(label).addTo(map);
    });
    if(p.map.points.length>1){
      L.polyline(p.map.points.map(x=>[x[0],x[1]]),{color:p.color,weight:4,opacity:.65,dashArray:type==='tour'?'7 7':null}).addTo(map);
    }
  }
})();