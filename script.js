/* =========================================================
   МеталлОбработка — landing: логика калькулятора, каталог,
   корзина, анимации, формы
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CONTACT = {
    phone: '+7 (495) 120-45-67',
    phoneRaw: '+74951204567',
    email: 'zakaz@metall-obrabotka.ru'
  };

  /* =========================================================
     ТАБЛИЦА ЗАЯВОК (Google Sheets через Apps Script)

     1. Откройте таблицу заявок → «Расширения» → «Apps Script»
     2. Вставьте код из файла apps-script/Code.gs, сохраните
     3. «Развернуть» → «Новое веб-приложение»
        — Выполнять как: **Я (ваш аккаунт)**
        — Доступ: **Любой**
     4. Скопируйте ссылку вида https://script.google.com/macros/s/XXXX/exec
        и вставьте её в поле endpoint ниже.
     Пока endpoint не заполнен — заявки уходят письмом на CONTACT.email
     (старое поведение), всё остальное работает как раньше.
     ========================================================= */
  var LEADS = {
    endpoint: 'https://script.google.com/macros/s/AKfycbzXnW2kz7mdeXJnxS3991vEAP1QvTPRM9IvTLydsVSrX5sTvh4e64nma65Md1o5T2zA/exec',
    fallbackEmail: CONTACT.email,
    utm: readUTM()
  };

  function readUTM() {
    var q = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var out = keys.map(function (k) {
      var v = q.get(k);
      return v ? k.replace('utm_', '') + ':' + v : '';
    }).filter(Boolean);
    return out.join(' ');
  }

  /* текст заявки — используется и для письма, и для таблицы */
  function clean(v) { return v == null ? '' : String(v).replace(/\u00a0/g, ' ').trim(); }

  function leadText(type, d) {
    var L = [];
    L.push('Тип: ' + type);
    if (d.name) L.push('Имя: ' + d.name);
    if (d.phone) L.push('Телефон: ' + d.phone);
    if (d.email) L.push('E-mail: ' + d.email);
    if (d.topic) L.push('Тема: ' + d.topic);
    if (d.message) L.push('Комментарий: ' + d.message);
    if (d.address) L.push('Доставка: ' + d.address);
    if (d.calc) L.push('', 'Расчёт:', d.calc);
    if (d.items) L.push('', 'Позиции:', d.items);
    if (d.total) L.push('', 'Сумма: ' + d.total);
    L.push('', 'Страница: ' + (d.page || location.href));
    if (d.utm) L.push('UTM: ' + d.utm);
    return L.join('\n');
  }

  function leadMailto(type, d) {
    return 'mailto:' + LEADS.fallbackEmail +
      '?subject=' + encodeURIComponent(type + ' — ' + clean(d.topic || d.total) || 'сайт') +
      '&body=' + encodeURIComponent(leadText(type, d));
  }

  /* Отправка заявки: в таблицу, при недоступности — письмом.
     mode:'no-cors' — Google не требует CORS-заголовков, preflight не нужен. */
  function submitLead(type, d, done) {
    var payload = {
      type: type,
      ts: new Date().toISOString(),
      page: clean(location.href),
      utm: LEADS.utm,
      ua: (navigator.userAgent || '').slice(0, 180),
      name: clean(d.name), phone: clean(d.phone), email: clean(d.email),
      topic: clean(d.topic), message: clean(d.message), address: clean(d.address),
      calc: clean(d.calc), items: clean(d.items), total: clean(d.total)
    };

    if (!LEADS.endpoint || LEADS.endpoint.indexOf('PASTE') === 0) {
      window.location.href = leadMailto(type, d);
      if (done) done('mailto');
      return;
    }

    fetch(LEADS.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(function () {
      if (done) done('sheet');
    }).catch(function () {
      /* сеть или скрипт недоступны — не теряем заявку, отправляем письмом */
      window.location.href = leadMailto(type, d);
      if (done) done('mailto');
    });
  }

  /* ---------------- утилиты ---------------- */
  function money(v, dec) {
    var n = Math.round(v);
    return n.toLocaleString('ru-RU') + ' ₽';
  }
  function num(v) { return Number(String(v).replace(/\s/g, '')) || 0; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function toast(msg, type) {
    var box = $('#toasts');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast' + (type === 'err' ? ' toast--err' : '');
    t.innerHTML = '<i>' + (type === 'err' ? '!' : '✓') + '</i><span></span>';
    $('span', t).textContent = msg;
    box.appendChild(t);
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { t.remove(); }, 400);
    }, 4200);
  }

  /* ---------------- появление блоков ---------------- */
  function initReveal() {
    var items = $$('[data-anim]');
    items.forEach(function (el) {
      el.style.setProperty('--d', (el.getAttribute('data-delay') || 0) + 'ms');
    });
    if (!('IntersectionObserver' in window) || reduce) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- параллакс ---------------- */
  function initParallax() {
    var nodes = $$('[data-parallax]');
    if (!nodes.length) return;
    if (reduce) return;
    var vh = window.innerHeight;
    var ticking = false;
    function frame() {
      var y = window.pageYOffset;
      nodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var k = parseFloat(n.getAttribute('data-parallax')) || 0.08;
        var prog = (r.top + r.height / 2 - vh / 2) / vh; /* -1..1 */
        n.style.transform = 'translate3d(0,' + (-prog * k * 220).toFixed(2) + 'px,0)';
      });
      ticking = false;
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    frame();
  }

  /* ---------------- счётчики ---------------- */
  function initCounters() {
    var els = $$('[data-count]');
    if (!els.length) return;
    var fmt = function (v, dec, prefix, suffix) {
      return (prefix || '') + v.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (suffix || '');
    };
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduce) { el.textContent = fmt(target, dec, prefix, suffix); return; }
      var dur = 1500, t0 = null;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = clamp((ts - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e, dec, prefix, suffix);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- хедер, навигация, прогресс ---------------- */
  function initHeader() {
    var header = $('#header');
    var progress = $('#scrollProgress');
    var burger = $('[data-burger]');
    var nav = $('#nav');
    var mcta = $('#mcta');
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset;
        var h = document.documentElement.scrollHeight - window.innerHeight;
        header.classList.toggle('is-stuck', y > 12);
        progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
        if (mcta) mcta.classList.toggle('is-on', y > 700);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
      });
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
      });
    }

    var year = $('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* ---------------- spotlight + tilt ---------------- */
  function initPointerFX() {
    $$('[data-spotlight]').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });

    if (reduce) return;
    $$('[data-tilt]').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(1200px) rotateX(' + (-py * 4).toFixed(2) + 'deg) rotateY(' + (px * 5).toFixed(2) + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });
  }

  /* ---------------- аккордеон FAQ ---------------- */
  function initFaq() {
    var acc = $('#faqAcc');
    if (!acc) return;
    acc.addEventListener('click', function (e) {
      var btn = e.target.closest('.acc__btn');
      if (!btn) return;
      var item = btn.parentElement;
      var open = item.classList.contains('is-open');
      $$('.acc__item', acc).forEach(function (i) { i.classList.remove('is-open'); });
      if (!open) item.classList.add('is-open');
    });
  }

  /* =======================================================
     КАЛЬКУЛЯТОР
     ======================================================= */
  var MAT = {
    st3:   { name: 'Ст3 (обычная)',        density: 7.85, kg: 76,   cut: 'carbon',  factor: 1 },
    '09g2s': { name: '09Г2С (высокопрочная)', density: 7.85, kg: 92, cut: 'carbon', factor: 1.08 },
    '304': { name: 'Нержавейка AISI 304',   density: 7.93, kg: 385,  cut: 'inox',    factor: 1.35 },
    '430': { name: 'Нержавейка AISI 430',   density: 7.90, kg: 235,  cut: 'inox',    factor: 1.2 }
  };
  var THICK = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20];
  var MACHINE = 2600; /* ₽/час работы станка */

  var calc = {
    form: $('#calcForm'),
    material: $('#calcMaterial'),
    thickness: $('#calcThickness'),
    length: $('#calcLength'),
    width: $('#calcWidth'),
    qty: $('#calcQty'),
    cut: $('#calcCut'),
    bends: $('#calcBends'),
    rush: $('#calcRush'),
    total: $('#calcTotal'),
    breakdown: $('#calcBreakdown'),
    file: null
  };

  function fillThickness() {
    if (!calc.thickness) return;
    var m = calc.material ? calc.material.value : 'st3';
    var max = (m === '304' || m === '430') ? 12 : 20;
    calc.thickness.innerHTML = '';
    THICK.filter(function (t) { return t <= max; }).forEach(function (t) {
      var o = document.createElement('option');
      o.value = String(t);
      o.textContent = t + ' мм' + (t === 3 ? ' · ходовой' : '');
      if (t === 3) o.selected = true;
      calc.thickness.appendChild(o);
    });
  }

  function ops() {
    if (!calc.form) return {};
    var o = { laser: false, plasma: false, bend: false };
    $$('input[name="op"]', calc.form).forEach(function (i) { o[i.value] = i.checked; });
    return o;
  }

  /* оценка длины реза по периметру детали */
  function autoCut(L, W) {
    return Math.round((2 * (L + W)) * 1.25 / 10) * 10; /* +25% на внутренние элементы */
  }

  function calcState() {
    var L = clamp(num(calc.length.value), 10, 6000);
    var W = clamp(num(calc.width.value), 10, 3000);
    var qty = clamp(num(calc.qty.value), 1, 5000);
    var t = num(calc.thickness.value) || 3;
    var mat = MAT[calc.material.value] || MAT.st3;
    var o = ops();
    var cutMm = Math.max(0, num(calc.cut.value));
    var bends = clamp(num(calc.bends.value), 0, 64);
    var rush = num(calc.rush.value) / 100;

    /* материал */
    var areaM2 = (L * W) / 1e6;
    var kg = areaM2 * t * mat.density;
    var materialCost = kg * mat.kg;

    /* рез: скорость зависит от толщины и типа */
    var cutCost = 0;
    var rates = [];
    if (o.laser) {
      var speed = Math.max(0.8, 14 - 1.05 * t) / mat.factor;   /* м/мин */
      var minutes = (cutMm / 1000) * qty / speed;
      cutCost += minutes / 60 * MACHINE;
      rates.push('от ' + Math.round(340 + 120 * t) + ' ₽/м');
    }
    if (o.plasma) {
      var speedP = Math.max(1.2, 9 - 0.55 * t);
      var minP = (cutMm / 1000) * qty / speedP;
      cutCost += minP / 60 * MACHINE * 0.78;
      rates.push('от ' + Math.round(210 + 62 * t) + ' ₽/м');
    }

    /* гибка */
    var bendCost = o.bend ? (bends * qty * 340 + qty * 240) : 0;
    if (o.bend) rates.push('340 ₽/гиб');

    /* наладка + подготовка + контроль */
    var setup = 2200 + (o.laser ? 900 : 0) + (o.plasma ? 600 : 0) + (o.bend ? 1400 : 0);
    if (qty > 50) setup += 600;
    var control = 180 * Math.ceil(qty / 20);

    var sum = materialCost + cutCost + bendCost + setup + control;
    var rushCost = sum * rush;
    var total = Math.round((sum + rushCost) / 10) * 10;
    var unit = Math.round(total / qty);

    return {
      L: L, W: W, qty: qty, t: t, mat: mat, o: o, cutMm: cutMm, bends: bends, rush: rush,
      kg: kg, material: materialCost, cut: cutCost, bend: bendCost,
      setup: setup, control: control, rushCost: rushCost, total: total, unit: unit,
      rates: rates,
      area: areaM2
    };
  }

  var lastTotal = null;
  function renderCalc() {
    if (!calc.form) return;
    var s = calcState();
    var rows = [
      { k: 'Материал · ' + s.mat.name + ' ' + s.t + ' мм', v: money(s.material) },
      { k: 'Рез · ' + (s.cutMm * s.qty / 1000).toLocaleString('ru-RU') + ' м', v: money(s.cut), opt: true },
      { k: 'Гибка · ' + (s.bends * s.qty) + ' гибов', v: money(s.bend), opt: true },
      { k: 'Наладка, раскрой и контроль', v: money(s.setup + s.control), opt: true },
      { k: 'Срочность ' + (s.rush * 100) + '%', v: money(s.rushCost), opt: true }
    ];
    calc.breakdown.innerHTML = '';
    rows.forEach(function (r, i) {
      if (r.v === '0 ₽' && i > 0) return;
      var d = document.createElement('div');
      d.className = 'bd' + (r.opt ? ' bd--opt' : '');
      d.style.animationDelay = i * 45 + 'ms';
      var a = document.createElement('span'); a.textContent = r.k;
      var b = document.createElement('b'); b.textContent = r.v;
      d.appendChild(a); d.appendChild(b);
      calc.breakdown.appendChild(d);
    });

    calc.total.textContent = money(s.total);
    if (lastTotal !== null && lastTotal !== s.total) {
      calc.total.classList.add('bump');
      setTimeout(function () { calc.total.classList.remove('bump'); }, 220);
    }
    lastTotal = s.total;
    $('[data-qty]').textContent = String(s.qty);

    var lr = $('[data-rate="laser"]'), pr = $('[data-rate="plasma"]'), br = $('[data-rate="bend"]');
    if (lr) lr.textContent = 'от ' + Math.round(340 + 120 * s.t) + ' ₽/м';
    if (pr) pr.textContent = 'от ' + Math.round(210 + 62 * s.t) + ' ₽/м';
    if (br) br.textContent = '340 ₽/гиб';

    calc._state = s;
  }

  function initCalc() {
    if (!calc.form) return;
    fillThickness();
    renderCalc();

    calc.material.addEventListener('change', function () { fillThickness(); renderCalc(); });
    ['thickness', 'rush'].forEach(function (k) {
      calc[k].addEventListener('change', renderCalc);
    });
    [calc.length, calc.width, calc.qty, calc.bends].forEach(function (el) {
      el.addEventListener('input', function () {
        /* авто-подстановка длины реза по периметру, пока поле не меняли руками */
        if (!calc.cut.isManualCut) {
          calc.cut.value = autoCut(clamp(num(calc.length.value), 10, 6000), clamp(num(calc.width.value), 10, 3000));
        }
        renderCalc();
      });
    });
    calc.cut.addEventListener('input', function () { this.isManualCut = true; renderCalc(); });
    $$('input[name="op"]', calc.form).forEach(function (i) {
      var sw = i.closest('.switch');
      function sync() { sw.classList.toggle('is-on', i.checked); }
      sync();
      i.addEventListener('change', function () { sync(); renderCalc(); });
    });
    calc.cut.value = autoCut(num(calc.length.value), num(calc.width.value));

    /* drag & drop чертежа */
    var drop = $('#calcDrop'), file = $('#calcFile'), fname = $('#calcFileName');
    if (drop && file) {
      drop.addEventListener('click', function () { file.click(); });
      drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
      file.addEventListener('change', function () { setFile(file.files && file.files[0]); });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
      });
      drop.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        setFile(f);
      });
    }
    function setFile(f) {
      calc.file = f || null;
      if (!f) { if (fname) { fname.hidden = true; fname.textContent = ''; } return; }
      if (fname) {
        fname.hidden = false;
        fname.textContent = f.name + ' · ' + (Math.round(f.size / 1024) || 1) + ' КБ';
      }
      toast('Чертёж прикреплён: ' + f.name);
    }

    /* PDF-смета */
    calc.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = calc._state || calcState();
      var email = $('#calcEmail').value.trim();
      var valid = /^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(email);
      $('#calcEmail').closest('.field').classList.toggle('is-bad', !valid);
      if (!valid) {
        toast('Укажите почту — смета придёт на неё', 'err');
        $('#calcEmail').focus();
        return;
      }
      var btn = $('#calcSubmit');
      btn.classList.add('is-sent');
      var old = btn.innerHTML;
      btn.innerHTML = 'Готовим PDF-смету…';
      setTimeout(function () {
        btn.innerHTML = old;
        btn.classList.remove('is-sent');
        printEstimate(s, email);
        submitLead('Расчёт из калькулятора', {
          phone: $('#calcPhone') ? $('#calcPhone').value : '',
          email: email,
          topic: s.mat.name + ' ' + s.t + ' мм, ' + s.L + '×' + s.W + ' мм × ' + s.qty + ' шт, ' + opList(s),
          calc: [
            'Материал: ' + s.mat.name + ', ' + s.t + ' мм',
            'Размер: ' + s.L + ' × ' + s.W + ' мм (' + s.area.toFixed(3) + ' м²)',
            'Количество: ' + s.qty + ' шт',
            'Масса: ' + s.kg.toFixed(2) + ' кг/шт',
            'Операции: ' + opList(s),
            'Длина реза: ' + (s.cutMm / 1000) + ' м/шт, гибов: ' + s.bends,
            'Чертёж: ' + (calc.file ? calc.file.name : 'не приложен'),
            'Бюджет: ' + money(s.material) + ' + ' + money(s.cut) + ' + ' + money(s.bend) +
              ' + ' + money(s.setup + s.control) + ' + ' + money(s.rushCost)
          ].join('\n'),
          total: money(s.total) + ' (' + money(s.unit) + '/шт)'
        }, function (via) {
          toast(via === 'sheet'
            ? 'Заявка в таблице. Цена зафиксирована: ' + money(s.total)
            : 'PDF-смета готова. Отправьте письмо на почту');
        });
      }, 850);
    });
  }

  function opList(s) {
    var l = [];
    if (s.o.laser) l.push('лазер');
    if (s.o.plasma) l.push('плазма');
    if (s.o.bend) l.push('гибка');
    return l.length ? l.join(' + ') : 'без операций';
  }

  /* PDF-смета: генерируем документ и отдаём в печать «Сохранить как PDF» */
  function printEstimate(s, email) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(f);
    var doc = f.contentDocument;
    var rows = [
      ['Материал', s.mat.name + ', ' + s.t + ' мм'],
      ['Размер детали', s.L + ' × ' + s.W + ' мм (' + s.area.toFixed(3) + ' м²)'],
      ['Количество', s.qty + ' шт'],
      ['Масса', s.kg.toFixed(2) + ' кг на деталь'],
      ['Операции', opList(s) + ', длина реза ' + ((s.cutMm * s.qty) / 1000).toFixed(2) + ' м'],
      ['Гибов на деталь', String(s.bends)],
      ['Чертёж', calc.file ? calc.file.name : 'не приложен'],
      ['', ''],
      ['Стоимость материала', money(s.material)],
      ['Стоимость реза', money(s.cut)],
      ['Стоимость гибки', money(s.bend)],
      ['Наладка, раскрой, контроль', money(s.setup + s.control)],
      ['Срочность ' + (s.rush * 100) + '%', money(s.rushCost)]
    ];
    var html = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Смета_МеталлОбработка_' +
      String(s.total).replace(/\D/g, '') + '_rub.pdf</title><style>' +
      '@page{size:A4;margin:16mm}' +
      'body{font:13px/1.55 "Segoe UI",Arial,sans-serif;color:#16181c;margin:0}' +
      'h1{font-size:22px;margin:0 0 4px}' +
      '.sub{color:#666;font-size:12px;margin-bottom:16px}' +
      'table{width:100%;border-collapse:collapse;margin:8px 0 14px}' +
      'td{padding:7px 6px;border-bottom:1px solid #e2e4e8;font-size:12.5px}' +
      'td:last-child{text-align:right;font-weight:600;white-space:nowrap}' +
      '.total td{font-size:16px;font-weight:800;border-bottom:2px solid #ff6a00;padding-top:12px}' +
      '.note{font-size:11px;color:#777;background:#f6f7f9;padding:12px;border-radius:8px;margin-top:14px}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #ff6a00;padding-bottom:10px}' +
      '.brand{font-weight:800;font-size:15px}' +
      '.ok{color:#1d7a44;font-weight:700}' +
      '</style></head><body>' +
      '<div class="head"><div class="brand">МеталлОбработка · цех и склад</div><div style="font-size:11px;color:#666">' +
      new Date().toLocaleDateString('ru-RU') + '</div></div>' +
      '<h1 style="margin-top:14px">Смета на металлообработку</h1>' +
      '<div class="sub">Расчёт для: ' + escapeHtml(email || '—') + ' · валюта: ₽ · цена фиксируется в момент оплаты</div>' +
      '<table>' + rows.map(function (r) {
        return '<tr><td>' + escapeHtml(r[0]) + '</td><td>' + escapeHtml(String(r[1])) + '</td></tr>';
      }).join('') +
      '<tr class="total"><td>ИТОГО за ' + s.qty + ' шт</td><td>' + money(s.total) + '</td></tr>' +
      '<tr class="total"><td style="font-size:13px">Цена за 1 шт</td><td style="font-size:13px">' + money(s.unit) + '</td></tr>' +
      '</table>' +
      '<div class="note"><span class="ok">Цена зафиксирована.</span> Расчёт учитывает стоимость материала, длину реза, ' +
      'количество ударов гиба и наладку. Скрытых платежей за «сложность» нет. ' +
      'Отгрузка — 2 рабочих дня с момента оплаты. Чертёж проходит проверку технологичности за 15 минут.<br><br>' +
      'МеталлОбработка · ' + CONTACT.phone + ' · ' + CONTACT.email + '</div>' +
      '</body></html>';
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (err) { /* ignore */ }
      setTimeout(function () { f.remove(); }, 60000);
    }, 350);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* =======================================================
     ПРАЙС МЕТАЛЛА
     ======================================================= */
  var PRICE = {
    sheet: [
      ['Ст3 лист 1 мм', '1 мм', 76, '12,4 т'],
      ['Ст3 лист 2 мм', '2 мм', 76, '9,1 т'],
      ['Ст3 лист 3 мм', '3 мм', 76, '4,2 т'],
      ['Ст3 лист 5 мм', '5 мм', 79, '7,6 т'],
      ['Ст3 лист 8 мм', '8 мм', 82, '5,3 т'],
      ['Ст3 лист 10 мм', '10 мм', 85, '6,8 т'],
      ['Ст3 лист 12 мм', '12 мм', 88, '4,1 т'],
      ['Ст3 лист 16 мм', '16 мм', 94, '2,7 т'],
      ['Ст3 лист 20 мм', '20 мм', 101, '1,9 т'],
      ['09Г2С лист 3 мм', '3 мм', 92, '3,4 т'],
      ['09Г2С лист 6 мм', '6 мм', 96, '2,8 т'],
      ['09Г2С лист 10 мм', '10 мм', 99, '2,2 т'],
      ['09Г2С лист 14 мм', '14 мм', 106, '1,4 т'],
      ['AISI 304 лист 2 мм', '2 мм', 385, '0,9 т'],
      ['AISI 304 лист 3 мм', '3 мм', 372, '1,1 т'],
      ['AISI 304 лист 5 мм', '5 мм', 358, '0,7 т'],
      ['AISI 430 лист 2 мм', '2 мм', 235, '0,8 т']
    ],
    tube: [
      ['Труба проф. 20×20×2', '2 мм', 88, '2,1 т'],
      ['Труба проф. 40×40×3', '3 мм', 92, '3,6 т'],
      ['Труба проф. 50×50×3', '3 мм', 92, '2,7 т'],
      ['Труба проф. 60×60×4', '4 мм', 95, '2,4 т'],
      ['Труба проф. 80×80×4', '4 мм', 98, '3,2 т'],
      ['Труба проф. 100×100×5', '5 мм', 104, '1,8 т'],
      ['Труба прямоуг. 40×20×2', '2 мм', 90, '1,6 т'],
      ['Труба прямоуг. 80×40×3', '3 мм', 95, '1,4 т'],
      ['Труба круглая оц. 42×3', '3 мм', 112, '2,9 т'],
      ['Труба круглая оц. 60×3', '3 мм', 112, '4,3 т']
    ],
    sort: [
      ['Уголок 25×25×4', '4 мм', 86, '1,9 т'],
      ['Уголок 40×40×5', '5 мм', 89, '2,6 т'],
      ['Уголок 50×50×5', '5 мм', 90, '3,1 т'],
      ['Уголок 75×75×6', '6 мм', 93, '2,2 т'],
      ['Уголок 100×100×8', '8 мм', 97, '1,7 т'],
      ['Швеллер П6', '6 мм', 105, '2,9 т'],
      ['Швеллер П8', '8 мм', 108, '2,1 т'],
      ['Швеллер У10', '10 мм', 112, '1,3 т'],
      ['Двутавр 20Б1', '—', 118, '1,6 т'],
      ['Двутавр 30Б1', '—', 124, '2,3 т']
    ]
  };

  function initPrice() {
    var body = $('#priceBody');
    var tabs = $('#priceTabs');
    if (!body || !tabs) return;

    function paint(tab) {
      body.innerHTML = '';
      PRICE[tab].forEach(function (r) {
        var tr = document.createElement('tr');
        var st = r[3].indexOf(',') > -1 ? num(r[3].replace(',', '.')) : num(r[3]);
        var cls = st < 2 ? 'p-stock--low' : 'p-stock--in';
        tr.innerHTML =
          '<td class="p-name"></td><td></td><td class="p-price"></td>' +
          '<td class="p-stock ' + cls + '"></td>' +
          '<td style="text-align:right"><button type="button" class="p-order">В расчёт</button></td>';
        var td = tr.children;
        td[0].textContent = r[0];
        td[1].textContent = r[1];
        td[2].textContent = money(r[2]) + '/кг';
        td[3].textContent = r[3];
        $('.p-order', tr).addEventListener('click', function () {
          closeModal('#priceModal');
          $('#calculator').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
          setTimeout(function () { $('#calcMaterial').focus(); }, 500);
          toast('Позиция «' + r[0] + '» — вставьте габариты в калькулятор');
        });
        body.appendChild(tr);
      });
    }

    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.ptab');
      if (!b) return;
      $$('.ptab', tabs).forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      paint(b.getAttribute('data-tab'));
    });

    paint('sheet');
    $$('[data-open-price]').forEach(function (b) {
      b.addEventListener('click', function () { openModal('#priceModal'); });
    });
  }

  /* =======================================================
     КАТАЛОГ ЗАПЧАСТЕЙ + КОРЗИНА
     ======================================================= */
  var CATS = [
    { id: 'gates', name: 'Ворота и роллеты' },
    { id: 'build', name: 'Стройка и крепёж' },
    { id: 'vent', name: 'Вентиляция' },
    { id: 'rack', name: 'Стеллажи и склад' },
    { id: 'water', name: 'Водоснабжение' }
  ];

  var TEMPLATES = {
    gates: [
      ['Ролик направляющий', 'от 33 мм', 640],
      ['Кронштейн роликовый', 'Усиленный', 980],
      ['Зубчатая рейка', 'Модуль 3', 1340],
      ['Заглушка профильная', 'Для алюминиевого', 320],
      ['Ролик барабанный', 'С прижимом', 1180],
      ['Петля воротная усиленная', 'Оцинкованная', 1450],
      ['Шайба под ролик', 'Осевая', 180],
      ['Опора направляющая', 'Регулируемая', 1620],
      ['Втулка роликовая', 'Бронзовая', 740],
      ['Механизм тросовый', 'С блокиратором', 1290]
    ],
    build: [
      ['Площадка под анкер', 'Оцинкованная', 890],
      ['Фланец опорный', 'Круглый', 1120],
      ['Пластина опорная', 'С фаской', 620],
      ['Уголок монтажный', 'Усиленный', 540],
      ['База под колонну', 'Фундаментная', 2450],
      ['Шайба резьбовая', 'DIN 125', 45],
      ['Проушина с отверстием', 'Под болт М20', 380],
      ['Косынка жёсткости', 'Угловая', 690],
      ['Стяжка резьбовая', 'М16 × 500', 240],
      ['Комплект крепежа', 'Оцинкованный', 560]
    ],
    vent: [
      ['Фланец круглый', 'Присоед. 315', 1560],
      ['Втулка переходная', 'Концентрическая', 890],
      ['Крышка лючка', 'С уплотнителем', 1040],
      ['Патрубок круглый', 'Оцинкованный', 1180],
      ['Отборка воздуха', 'Регулируемая', 1720],
      ['Дроссель-шибер', 'С приводом', 2260],
      ['Клапан обратный', 'Осевой', 1980],
      ['Уплотнитель по кругу', 'Маслобензостойкий', 420],
      ['Решётка воздухозаборная', 'Межосевое 30 мм', 760],
      ['Люк-лаз', 'Герметичный', 1340]
    ],
    rack: [
      ['Стойка стеллажная', 'Угол 90 × 90', 1980],
      ['Балка стеллажная', 'Оцинкованная', 1640],
      ['Заглушка стеллажная', 'Пластиковая', 160],
      ['Связь диагональная', 'В сборе', 1420],
      ['Подушка стеллажная опорная', 'Металл', 380],
      ['Кронштейн полки', 'Регулируемый', 520],
      ['Плита поддонная', 'Для рохли', 940],
      ['Защита стойки', 'Уголковый', 610]
    ],
    water: [
      ['Фланец плоский', 'Ду80', 1240],
      ['Бобышка под трубу', 'Ø 57', 460],
      ['Втулка резьбовая', 'Ду25', 380],
      ['Кольцо уплотнительное', 'EPDM', 90],
      ['Тройник равнопроходный', 'Ду50', 1120],
      ['Заглушка круглая', 'Ду40', 320],
      ['Штуцер сливной', '½"', 540],
      ['Манометр с гнездом', 'Ду15', 760]
    ]
  };

  var SIZES = ['', ' 60', ' 80', ' 100', ' 120', ' 140', ' 160', ' 180', ' 200', ' 250'];
  var ART = ['MO', 'MC', 'MV', 'MS', 'MW'];

  var CATALOG = [];
  (function buildCatalog() {
    CATS.forEach(function (cat, ci) {
      TEMPLATES[cat.id].forEach(function (t, ti) {
        SIZES.forEach(function (sz, si) {
          var seed = (ci * 977 + ti * 131 + si * 37);
          var rnd = (seed * 9301 + 49297) % 233280 / 233280;
          var price = Math.round(t[2] * (0.85 + rnd * 0.9) * (si ? 1 + si * 0.07 : 1) / 10) * 10;
          var stock = rnd > 0.93 ? 0 : (rnd > 0.78 ? 1 : 2);
          var name = t[0] + (sz ? ' ' + sz.trim() : (si ? ' ' + (40 + si * 10) : ''));
          CATALOG.push({
            id: 'p' + ci + ti + si,
            art: ART[ci] + '-' + (1000 + ci * 100 + ti * 7 + si),
            name: name,
            cat: cat.id,
            catName: cat.name,
            price: price,
            stock: stock,
            pop: Math.round(rnd * 100)
          });
        });
      });
    });
  })();

  var cart = (function () {
    try { return JSON.parse(localStorage.getItem('mo_cart') || '[]'); } catch (e) { return []; }
  })();

  function saveCart() {
    try { localStorage.setItem('mo_cart', JSON.stringify(cart)); } catch (e) { /* noop */ }
  }

  var ART_SVG = [
    '<svg viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="20" cy="22" r="12"/><circle cx="20" cy="22" r="4"/><path d="M40 10h16v24H40z" opacity=".6"/></svg>',
    '<svg viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 34 32 8l24 26"/><path d="M16 34h32" opacity=".6"/></svg>',
    '<svg viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="8" width="44" height="28" rx="4"/><circle cx="32" cy="22" r="7" opacity=".6"/></svg>',
    '<svg viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 36V10h6v26M28 36V10h6v26M44 36V10h6v26" opacity=".6"/></svg>',
    '<svg viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M32 6 12 38h40z"/><path d="M32 20v12" opacity=".6"/></svg>'
  ];

  var repaintCatalog = function () {};

  function initCatalog() {
    var grid = $('#catalogGrid');
    var chips = $('#catalogChips');
    var search = $('#catalogSearch');
    var stockOnly = $('#catalogStock');
    var sort = $('#catalogSort');
    var count = $('[data-catalog-count]');
    var catalogEl = $('#catalog');
    if (!grid || !chips || !catalogEl) return;

    var state = { cat: 'all', q: '', stock: false, sort: 'pop', shown: 24 };
    var PAGE = 24;

    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn btn--ghost catalog__more';
    more.addEventListener('click', function () {
      state.shown += PAGE;
      paint();
      more.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
    more.hidden = true;

    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'chip is-active';
    all.textContent = 'Все ' + CATALOG.length;
    all.setAttribute('data-cat', 'all');
    chips.appendChild(all);
    CATS.forEach(function (c) {
      var n = CATALOG.filter(function (p) { return p.cat === c.id; }).length;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = c.name + ' ' + n;
      b.setAttribute('data-cat', c.id);
      chips.appendChild(b);
    });

    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      $$('.chip', chips).forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      state.cat = b.getAttribute('data-cat');
      state.shown = PAGE;
      paint();
    });
    if (search) search.addEventListener('input', function () { state.q = this.value.toLowerCase().trim(); state.shown = PAGE; paint(); });
    if (stockOnly) {
      var syncStock = function () { stockOnly.closest('.switch').classList.toggle('is-on', stockOnly.checked); };
      syncStock();
      stockOnly.addEventListener('change', function () { state.stock = this.checked; state.shown = PAGE; syncStock(); paint(); });
    }
    if (sort) sort.addEventListener('change', function () { state.sort = this.value; state.shown = PAGE; paint(); });

    function paint() {
      var list = CATALOG.filter(function (p) {
        if (state.cat !== 'all' && p.cat !== state.cat) return false;
        if (state.stock && p.stock === 0) return false;
        if (state.q) {
          var hay = (p.name + ' ' + p.art + ' ' + p.catName).toLowerCase();
          if (hay.indexOf(state.q) === -1) return false;
        }
        return true;
      });
      if (state.sort === 'price-asc') list.sort(function (a, b) { return a.price - b.price; });
      else if (state.sort === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });
      else if (state.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
      else list.sort(function (a, b) { return b.pop - a.pop; });

      var show = list.slice(0, state.shown);
      grid.innerHTML = '';
      if (count) count.textContent = list.length;
      more.hidden = list.length <= state.shown;
      more.textContent = 'Показать ещё ' + Math.min(PAGE, list.length - state.shown) + ' из ' + list.length;

      if (!show.length) {
        var e = document.createElement('div');
        e.className = 'catalog__empty';
        e.textContent = 'Ничего не найдено. Позвоните — найдём на складе или изготовим за 2 дня.';
        grid.appendChild(e);
        return;
      }

      show.forEach(function (p, i) {
        var card = document.createElement('article');
        card.className = 'pcard';
        card.style.animation = 'bdIn .5s var(--ease) both';
        card.style.animationDelay = Math.min(i, 12) * 35 + 'ms';
        var stTxt = p.stock === 2 ? 'В наличии: ' + (3 + (p.pop % 40)) + ' шт' : (p.stock === 1 ? 'Мало: 1–3 шт' : 'Под заказ · 2 дня');
        var stCls = p.stock === 2 ? 'pcard__stock--in' : (p.stock === 1 ? 'pcard__stock--low' : 'pcard__stock--out');
        var inCart = cart.some(function (c) { return c.id === p.id; });
        card.innerHTML =
          '<div class="pcard__art">' + ART_SVG[CATS.findIndex(function (c) { return c.id === p.cat; })] + '</div>' +
          '<span class="pcard__cat"></span>' +
          '<h4 class="pcard__name"></h4>' +
          '<div class="pcard__meta"><span class="pcard__price"></span><span class="pcard__stock ' + stCls + '"></span></div>' +
          '<button type="button" class="pcard__add' + (inCart ? ' is-in' : '') + '"></button>';
        $('.pcard__cat', card).textContent = p.catName + ' · ' + p.art;
        $('.pcard__name', card).textContent = p.name;
        $('.pcard__price', card).innerHTML = money(p.price) + ' <small>/шт</small>';
        $('.pcard__stock', card).textContent = stTxt;
        var add = $('.pcard__add', card);
        add.textContent = inCart ? 'В корзине ✓' : (p.stock ? 'Добавить в корзину' : 'Заказать изготовление');
        add.addEventListener('click', function () { addToCart(p); });
        grid.appendChild(card);
      });
    }

    repaintCatalog = paint;
    if (more.parentElement !== catalogEl) catalogEl.appendChild(more);
    paint();
  }

  function addToCart(p) {
    var line = cart.find(function (c) { return c.id === p.id; });
    if (line) {
      line.qty += 1;
      toast(p.name + ' — уже в корзине, количество ' + line.qty);
    } else {
      cart.push({ id: p.id, name: p.name, art: p.art, cat: p.cat, price: p.price, qty: 1, stock: p.stock });
      toast(p.name + ' добавлен в корзину. Резерв на 24 часа');
    }
    saveCart();
    renderCart();
    repaintCatalog();
  }

  function renderCart() {
    var body = $('#cartBody');
    var total = $('#cartTotal');
    var count = $('[data-cart-count]');
    if (!body) return;

    if (count) {
      var n = cart.reduce(function (s, c) { return s + c.qty; }, 0);
      count.textContent = String(n);
      count.hidden = n === 0;
    }
    if (!cart.length) {
      body.innerHTML = '<div class="drawer__empty"><b>Корзина пуста</b><span>Выберите готовые детали со склада — отправим сегодня.</span></div>';
      if (total) total.textContent = '0 ₽';
      return;
    }
    body.innerHTML = '';
    cart.forEach(function (c) {
      var idx = CATS.findIndex(function (x) { return x.id === c.cat; });
      var row = document.createElement('div');
      row.className = 'citem';
      row.innerHTML =
        '<div class="citem__art">' + ART_SVG[idx < 0 ? 0 : idx] + '</div>' +
        '<div class="citem__info">' +
          '<div class="citem__name"></div>' +
          '<div class="citem__meta">' + escapeHtml(c.art) + ' · ' + money(c.price) + '/шт</div>' +
          '<div class="citem__row">' +
            '<div class="qty"><button type="button" data-dec>−</button><span></span><button type="button" data-inc>+</button></div>' +
            '<b class="citem__price">' + money(c.price * c.qty) + '</b>' +
            '<button type="button" class="citem__del" data-del>удалить</button>' +
          '</div>' +
        '</div>';
      $('.citem__name', row).textContent = c.name;
      $('span', $('.qty', row)).textContent = String(c.qty);
      $('[data-inc]', row).addEventListener('click', function () { c.qty++; saveCart(); renderCart(); });
      $('[data-dec]', row).addEventListener('click', function () {
        c.qty--; if (c.qty <= 0) cart = cart.filter(function (x) { return x.id !== c.id; });
        saveCart(); renderCart();
      });
      $('[data-del]', row).addEventListener('click', function () {
        cart = cart.filter(function (x) { return x.id !== c.id; });
        saveCart(); renderCart(); toast('Позиция удалена из корзины');
      });
      body.appendChild(row);
    });
    if (total) total.textContent = money(cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0));
  }

  function initCart() {
    var drawer = $('#cartDrawer');
    if (!drawer) return;
    $$('[data-open-cart]').forEach(function (b) {
      b.addEventListener('click', function () {
        drawer.hidden = false;
        document.body.classList.add('is-locked');
      });
    });
    $$('[data-close-cart]').forEach(function (b) {
      b.addEventListener('click', function () { drawer.hidden = true; document.body.classList.remove('is-locked'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) { drawer.hidden = true; document.body.classList.remove('is-locked'); }
    });

    var form = $('#cartForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(form)) return;
        var data = Object.fromEntries(new FormData(form).entries());
        var lines = cart.map(function (c) {
          return '• ' + c.name + ' (' + c.art + ') — ' + c.qty + ' шт × ' + money(c.price) + ' = ' + money(c.price * c.qty);
        }).join('\n');
        var sum = cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0);
        submitLead('Заказ запчастей со склада', {
          name: data.name,
          phone: data.phone,
          topic: 'Готовые детали со склада, ' + cart.length + ' позиций',
          address: data.address || 'самовывоз со склада',
          items: lines,
          total: money(sum)
        }, function (via) {
          toast(via === 'sheet'
            ? 'Заказ принят и записан в таблицу. Резерв на 24 часа'
            : 'Заказ отправлен письмом. Резерв на 24 часа');
        });
        cart = []; saveCart(); renderCart();
        drawer.hidden = true;
        document.body.classList.remove('is-locked');
        form.reset();
      });
    }
    renderCart();
  }

  /* =======================================================
     МОДАЛКИ + ФОРМЫ
     ======================================================= */
  function openModal(sel) {
    var m = $(sel);
    if (!m) return;
    m.hidden = false;
    document.body.classList.add('is-locked');
  }
  function closeModal(sel) {
    var m = $(sel);
    if (!m) return;
    m.hidden = true;
    if ($('#cartDrawer').hidden) document.body.classList.remove('is-locked');
  }

  function initModals() {
    $$('.modal [data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.closest('.modal');
        if (m) { m.hidden = true; document.body.classList.remove('is-locked'); }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.modal').forEach(function (m) {
        if (!m.hidden) { m.hidden = true; document.body.classList.remove('is-locked'); }
      });
    });
    $$('.js-callback').forEach(function (b) {
      b.addEventListener('click', function () { openModal('#formModal'); });
    });
    $$('a[href^="#"], a[href="#"]').forEach(function (a) {
      a.addEventListener('click', function () {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        setTimeout(function () { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }, 60);
      });
    });
  }

  /* маска телефона */
  function initMask() {
    $$('[data-mask="phone"]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var d = this.value.replace(/\D/g, '');
        if (d[0] === '8') d = '7' + d.slice(1);
        if (d[0] === '9') d = '7' + d;
        d = d.slice(0, 11);
        var out = '+7';
        if (d.length > 1) out += ' (' + d.slice(1, 4);
        if (d.length >= 4) out += ') ' + d.slice(4, 7);
        if (d.length >= 7) out += '-' + d.slice(7, 9);
        if (d.length >= 9) out += '-' + d.slice(9, 11);
        this.value = d.length <= 1 ? '+7' : out;
      });
      inp.addEventListener('focus', function () { if (!this.value) this.value = '+7 ('; });
      inp.addEventListener('blur', function () { if (this.value.replace(/\D/g, '').length <= 1) this.value = ''; });
    });
  }

  /* валидация форм */
  function validate(form) {
    var ok = true;
    $$('.field', form).forEach(function (f) {
      var input = $('input,select,textarea', f);
      if (!input || !input.required) return;
      var v = input.value.trim();
      var err = '';
      if (!v) err = 'Заполните поле';
      else if (input.type === 'email' && !/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(v)) err = 'Проверьте почту';
      else if (input.type === 'tel' && v.replace(/\D/g, '').length < 11) err = 'Введите номер полностью';
      else if (input.name === 'name' && v.length < 2) err = 'Слишком коротко';
      f.classList.toggle('is-bad', !!err);
      var e = $('.err', f);
      if (e) e.textContent = err;
      if (err) ok = false;
    });
    return ok;
  }

function initForms() {
    /* CTA-форма */
    var cta = $('#ctaForm');
    if (cta) {
      cta.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(cta)) { toast('Проверьте имя и телефон', 'err'); return; }
        var d = Object.fromEntries(new FormData(cta).entries());
        submitLead('Заявка с сайта', {
          name: d.name,
          phone: d.phone,
          topic: d.topic,
          message: 'Прошу зафиксировать цену и перезвонить'
        }, function (via) {
          toast(via === 'sheet'
            ? 'Заявка принята и записана в таблицу. Инженер перезвонит за 3 минуты'
            : 'Заявка принята. Инженер перезвонит за 3 минуты');
        });
        var btn = $('button[type="submit"]', cta);
        var old = btn.innerHTML;
        btn.classList.add('is-sent');
        btn.innerHTML = 'Заявка отправлена ✓';
        setTimeout(function () { btn.innerHTML = old; btn.classList.remove('is-sent'); cta.reset(); }, 3200);
      });
    }

    /* Модалка обратного звонка */
    var mf = $('#modalForm');
    if (mf) {
      mf.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(mf)) { toast('Проверьте имя и телефон', 'err'); return; }
        var d = Object.fromEntries(new FormData(mf).entries());
        submitLead('Обратный звонок', {
          name: d.name,
          phone: d.phone,
          topic: 'Запрос звонка инженера',
          message: d.message || ''
        }, function (via) {
          toast(via === 'sheet' ? 'Запрос записан в таблицу, перезваниваем' : 'Запрос на звонок принят');
        });
        var btn = $('button[type="submit"]', mf);
        var old = btn.innerHTML;
        btn.classList.add('is-sent');
        btn.innerHTML = 'Принято, перезваниваем ✓';
        toast('Запрос на звонок принят');
        setTimeout(function () {
          btn.innerHTML = old; btn.classList.remove('is-sent'); mf.reset();
          closeModal('#formModal');
        }, 2000);
      });
    }

    /* маскабельные снятия ошибки */
    $$('.field input, .field select, .field textarea').forEach(function (el) {
      el.addEventListener('input', function () { el.closest('.field').classList.remove('is-bad'); });
    });
  }

  /* ---------------- запуск ---------------- */
  function boot() {
    initHeader();
    initReveal();
    initParallax();
    initCounters();
    initPointerFX();
    initFaq();
    initCalc();
    initPrice();
    initCatalog();
    initCart();
    initModals();
    initMask();
    initForms();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();