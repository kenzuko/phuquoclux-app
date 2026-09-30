(() => {
  const DATA = {
    tour:{title:'Tour 3 đảo bằng cano',price:850000,unit:'khách',usageHeading:'Điểm đón / ghi chú',usageLabel:'Khách sạn / nơi lưu trú',options:{shared:['Ghép đoàn',1],private:['Cano riêng',5.2]}},
    ticket:{title:'Vé cáp treo Hòn Thơm',price:700000,unit:'vé',usageHeading:'Người sử dụng / ghi chú',usageLabel:'Tên khách chính (nếu khác người đặt)',options:{adult:['Người lớn',1],child:['Trẻ em',.72]}},
    transfer:{title:'Xe riêng sân bay → khách sạn',price:250000,unit:'xe',usageHeading:'Thông tin chuyến đi',usageLabel:'Khách sạn / điểm đến và số hiệu chuyến bay',options:{sedan:['Sedan 4 chỗ',1],suv:['SUV 7 chỗ',1.45],van:['Van 16 chỗ',2.2]}}
  };
  const q = new URLSearchParams(location.search);
  const type = DATA[q.get('type')] ? q.get('type') : 'tour';
  const d = DATA[type];
  const pax = Math.max(1, Number(q.get('pax'))||2);
  const optionKey = d.options[q.get('option')] ? q.get('option') : Object.keys(d.options)[0];
  const opt = d.options[optionKey];
  const qty = type==='transfer' ? 1 : pax;
  const total = d.price * opt[1] * qty;
  const money = n => new Intl.NumberFormat('vi-VN').format(Math.round(n))+'đ';

  document.getElementById('orderTitle').textContent = d.title;
  document.getElementById('orderMeta').innerHTML = `<div><span>Lựa chọn</span><b>${opt[0]}</b></div><div><span>Số khách</span><b>${pax}</b></div>`;
  document.getElementById('orderSubtotal').textContent = money(total);
  document.getElementById('orderTotal').textContent = money(total);
  document.getElementById('usageHeading').textContent = d.usageHeading;
  document.getElementById('usageLabel').textContent = d.usageLabel;
  document.getElementById('checkoutBack').href = './product.html?type='+type+'&pax='+pax;

  document.querySelectorAll('.payment-option input').forEach(input => input.addEventListener('change',()=>{
    document.querySelectorAll('.payment-option').forEach(x=>x.classList.remove('is-selected'));
    input.closest('.payment-option').classList.add('is-selected');
  }));

  document.getElementById('checkoutForm').addEventListener('submit', e => {
    e.preventDefault();
    if(!e.currentTarget.reportValidity()) return;
    const next = new URLSearchParams({demo:'confirmed',type,pax:String(pax),option:optionKey,total:String(Math.round(total))});
    location.href = './bookings.html?' + next.toString();
  });
})();