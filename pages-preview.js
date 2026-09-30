(() => {
  const style = document.createElement('style');
  style.textContent = '.pql-pages-notice{position:sticky;top:0;z-index:2500;padding:9px 12px;background:#edf4de;color:#274219;border-bottom:1px solid #b8d29c;text-align:center;font:600 12px/1.5 system-ui,-apple-system,sans-serif} .pql-pages-notice strong{font-weight:900} .pql-pages-notice span{font-weight:400} @media(max-width:600px){.pql-pages-notice{font-size:11px}}';
  document.head.appendChild(style);
  const note = document.createElement('aside');
  note.className = 'pql-pages-notice';
  note.setAttribute('role', 'note');
  note.innerHTML = '<strong>GIAO DIỆN XEM THỬ</strong> · <span>Prototype tĩnh, không phải bản React Router mới. Giá, vị trí và trạng thái chỉ minh họa. Chưa thể đặt chỗ hoặc thanh toán.</span>';
  document.body.prepend(note);
  if (location.pathname.endsWith('/bookings.html')) {
    document.querySelectorAll('.status-pill').forEach((pill) => {
      pill.textContent = 'Mẫu giao diện';
      pill.classList.remove('confirmed', 'is-upcoming');
    });
    const b = document.getElementById('bookingBanner');
    if (b) b.hidden = true;
  }
})();