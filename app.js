/* 가락 인사이트 — 프런트 로직 (바닐라 JS)
   site/data/*.json 을 읽어 렌더한다. predict_daily.py 가 매일 갱신. */

const GREEN = '#0f6e64', RED = '#c0392b', INK = '#1c1b18', INK3 = '#8a867c', LINE = '#d9d3c6';
const $ = s => document.querySelector(s);
const won = n => n.toLocaleString('ko-KR');
const ton = kg => Math.round(kg / 1000);

async function j(path, fallback) {
  try { const r = await fetch(path, { cache: 'no-store' }); if (!r.ok) throw 0; return await r.json(); }
  catch (e) { return fallback; }
}

function fmtWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${w})`;
}

/* ---------------- A. 히어로 ---------------- */
async function renderHero() {
  const L = await j('data/latest.json', null);
  const H = await j('data/headline.json', {});
  if (!L) { $('#cards').innerHTML = '<p style="color:var(--ink-3)">예측 데이터를 불러오지 못했습니다.</p>'; return; }

  const partial = L.status !== 'ok';
  $('#chip-stamp').textContent = `게시 ${fmtWhen(L.generated_at)}`;
  $('#stamp').innerHTML =
    `<div class="fresh"><span class="pulse"></span> ${partial ? '당일 데이터 지연' : '경매 시작 전 게시'}</div>
     <div>대상: <b>${dayLabel(L.target_session)} 경매</b></div>
     <div>경매 시작 <b>${L.auction_starts ? L.auction_starts.slice(-5) : '19:30'}</b> · 게시 ${fmtWhen(L.generated_at)}</div>`;

  $('#band').innerHTML = [
    ['예측 활성 품목', `${L.items.length}<small>개</small>`],
    ['익일 총 반입 예측', `${won(ton(L.total_point))}<small>톤</small>`],
    ['검증 개선폭 (거래액가중)', `+${H.improve ?? '—'}<small>%</small>`],
    ['구간 적중률 (검증)', `${H.coverage ?? '—'}<small>%</small>`],
  ].map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');

  const cards = [...L.items].sort((a, b) => b.point - a.point);
  $('#cards').innerHTML = cards.map((it, i) => {
    const d = (it.point - it.prev) / it.prev * 100;
    const cls = d > 1.5 ? 'up' : d < -1.5 ? 'down' : 'flat';
    const arrow = d > 1.5 ? '▲' : d < -1.5 ? '▼' : '·';
    const lo = ton(it.lo), hi = ton(it.hi), mid = ton(it.point);
    const span = Math.max(hi - lo, 1);
    const midPct = Math.min(100, Math.max(0, (mid - lo) / span * 100));
    return `<div class="card" style="animation-delay:${i * 45}ms">
      <div class="name">${it.item}</div>
      <div class="point">${won(mid)}<span class="unit">톤</span></div>
      <div class="delta ${cls}">${arrow} 직전 ${won(ton(it.prev))}톤 대비 ${d >= 0 ? '+' : ''}${d.toFixed(0)}%</div>
      <div class="range">
        <div class="track">
          <div class="fill" style="left:0;right:0"></div>
          <div class="mid" style="left:${midPct}%"></div>
        </div>
        <div class="lab"><span>${won(lo)}</span><span>80% 구간</span><span>${won(hi)}</span></div>
      </div>
    </div>`;
  }).join('');
}

/* ---------------- B. 전향 기록 ---------------- */
async function renderRecord() {
  const S = await j('data/summary.json', { n_days: 0 });
  const T = await j('data/track.json', []);

  if (!S.n_days) {
    $('#track-stats').innerHTML = '';
    $('#ledger-wrap').innerHTML =
      `<div class="empty-note"><span class="n">D+${T.length}</span>
        <div><b>가동 초기입니다.</b> 첫 예측이 게시되었고, 실제 반입량과의 대조는 다음 영업일부터 누적됩니다.
        전향 기록은 표본이 쌓이기 전까지 아래 <b>과거 검증(5.5년, 1만 건)</b>과 함께 보시는 것을 권합니다.</div></div>`;
    return;
  }

  const impGood = S.improve > 0;
  $('#track-stats').innerHTML = [
    ['가동 일수', `${S.n_days}<small style="font-size:14px;color:var(--ink-3)">일</small>`, ''],
    ['구간 적중률', `${S.coverage}%`, `목표 80% · 예측 ${S.n_items}건`, 'green'],
    ['전일가 대비 개선', `${impGood ? '+' : ''}${S.improve}%`, `모델 ${S.mape_model}% vs 전일 ${S.mape_naive}%`, impGood ? 'green' : ''],
  ].map(([k, v, sub, c]) =>
    `<div class="stat"><div class="k">${k}</div><div class="v ${c || ''}">${v}</div><div class="sub">${sub}</div></div>`).join('');

  const scored = T.filter(r => r.scored).slice(-14).reverse();
  const rows = scored.map(r => {
    const badge = `<span class="badge ${r.hit >= r.miss ? 'hit' : 'miss'}">${r.hit}/${r.hit + r.miss} 적중</span>`;
    return `<tr>
      <td>${dayLabel(r.target_session)}</td>
      <td class="num">${won(ton(r.items.reduce((s, i) => s + (i.actual || 0), 0)))}</td>
      <td class="num">${won(ton(r.items.reduce((s, i) => s + i.point, 0)))}</td>
      <td>${badge}</td>
      <td style="color:var(--ink-3);font-family:var(--mono);font-size:12px">${fmtWhen(r.published_at).slice(5)}</td>
    </tr>`;
  }).join('');
  $('#ledger-wrap').innerHTML = `<table class="ledger">
    <thead><tr><th>대상 세션</th><th style="text-align:right">실제(톤)</th><th style="text-align:right">예측(톤)</th><th>구간 적중</th><th>게시시각</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

/* ---------------- C. 품목 상세 차트 ---------------- */
let chart;
async function renderDetail() {
  const M = await j('data/meta.json', { items: [] });
  if (!M.items.length) return;
  const chips = $('#item-chips');
  chips.innerHTML = M.items.map((m, i) =>
    `<button class="chip ${i === 0 ? 'active' : ''}" data-slug="${m.slug}">${m.item}</button>`).join('');
  chips.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    chips.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    drawItem(c.dataset.slug);
  }));
  drawItem(M.items[0].slug);
}

async function drawItem(slug) {
  const D = await j(`data/items/${slug}.json`, null);
  if (!D) return;
  $('#chart-title').textContent = D.item;
  $('#chart-metrics').innerHTML =
    `<span>전일가 대비 <b>${D.improve >= 0 ? '+' : ''}${D.improve}%</b></span>
     <span>거래액 <b>${won(D.amount_eok)}억</b></span>`;
  const labels = D.series.map(p => p.d.slice(5));
  const data = {
    labels,
    datasets: [
      { label: '상한', data: D.series.map(p => p.hi), borderColor: 'transparent', backgroundColor: 'rgba(15,110,100,.12)', pointRadius: 0, fill: '+1', tension: .25 },
      { label: '하한', data: D.series.map(p => p.lo), borderColor: 'transparent', backgroundColor: 'rgba(15,110,100,.12)', pointRadius: 0, fill: false, tension: .25 },
      { label: '실제', data: D.series.map(p => p.actual), borderColor: INK, borderWidth: 1.6, pointRadius: 0, tension: .2,
        pointHoverRadius: 4, pointHoverBackgroundColor: INK },
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1b18', padding: 11, cornerRadius: 8, titleFont: { family: 'IBM Plex Mono', size: 11 },
        bodyFont: { family: 'IBM Plex Mono', size: 12 },
        callbacks: {
          title: c => D.series[c[0].dataIndex].d,
          label: c => {
            const p = D.series[c.dataIndex];
            if (c.datasetIndex === 2) return `  실제  ${p.actual}톤`;
            if (c.datasetIndex === 0) return `  구간  ${p.lo}~${p.hi}톤`;
            return null;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: INK3, font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 9 } },
      y: { grid: { color: 'rgba(217,211,198,.5)' }, ticks: { color: INK3, font: { family: 'IBM Plex Mono', size: 10 }, callback: v => v + '톤' }, title: { display: false } },
    },
  };
  if (chart) chart.destroy();
  chart = new Chart($('#chart'), { type: 'line', data, options: opts });
}

/* ---------------- D. 신뢰 지표 ---------------- */
async function renderTrust() {
  const H = await j('data/headline.json', {});
  $('#trust-grid').innerHTML = [
    ['데이터 기간', `${H.years ?? '12.5'}<small style="font-size:14px">년</small>`, `거래 ${won((H.n_rows / 1e4 | 0) / 100)}백만 건`],
    ['공식 정산 대조', `100<small style="font-size:14px">%</small>`, '2,593일 오차 0.0000%'],
    ['개선폭 (거래액가중)', `+${H.improve ?? '—'}<small style="font-size:14px">%</small>`, '전일가 대비, 검증구간'],
    ['통계 검정', `p<10⁻¹³`, `${H.dm_sig}/${H.dm_total}품목 유의`],
  ].map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v green">${v}</div><div class="sub">${s}</div></div>`).join('');
}

/* ---------------- Footer stamp ---------------- */
async function renderFoot() {
  const L = await j('data/latest.json', null);
  if (L) $('#foot-stamp').textContent = `최종 갱신 ${fmtWhen(L.generated_at)} (KST) · 매일 15:00 자동 갱신`;
}

/* ---------------- 진입 애니메이션 ---------------- */
function observeReveal() {
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

(async function () {
  observeReveal();
  await Promise.all([renderHero(), renderRecord(), renderDetail(), renderTrust(), renderFoot()]);
})();
