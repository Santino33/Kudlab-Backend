// Verbatim pure sections, TD-PALABRA-INTRUSA@5ce3bdcca0e2e1bb629b390ea3b6ec681cc23b69 frontend/game.js.
const CONFIG = {
    taskId: "TG-02",
    contractVersion: "1",
    configVersion: 1,
    itemTimeoutMs: 20000,          // tiempo máximo por ítem → "omission" (válido)
    anticipatoryMs: 400,           // TR menor: anticipatorio (cuenta en precisión, no en TR)
    seed: 20262,                   // orden y posiciones fijos para todos
    segmentCount: 3, itemsPerSegment: 6, itemsPerLevelPerSegment: 2,
    maxRun: 2,                     // máx. ítems seguidos con la misma posición de la intrusa o el mismo nivel
    minRtOverall: 5, minRtGroup: 3,
    selectionHoldMs: 250,          // la tarjeta elegida queda marcada (neutra) antes de la transición
    transitionMs: 500,             // transición neutra entre ítems
    practiceMaxRounds: 2,
    testOverrides: {}
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function maxRun(arr) { let m = 0, r = 0; arr.forEach((x, i) => { r = i && x === arr[i - 1] ? r + 1 : 1; m = Math.max(m, r); }); return m; }
function arrange(item, pos, rnd) {          // coloca la intrusa en "pos" y las otras 3 en orden aleatorio
    const target = item.words[item.targetIdx];
    const others = shuffle(item.words.filter((_, i) => i !== item.targetIdx), rnd);
    const words = []; let k = 0;
    for (let i = 0; i < 4; i++) words.push(i === pos ? target : others[k++]);
    return { item, words, targetIdx: pos, targetWord: target };
}
function buildSequence(bank, cfg) {
    const rnd = mulberry32(cfg.seed);
    const byLevel = {};
    [1, 2, 3].forEach((l) => { byLevel[l] = shuffle(bank.items.filter((it) => it.level === l), rnd); });
    const n = cfg.segmentCount * cfg.itemsPerSegment;
    let order, positions, guard = 0;
    do {    // orden: cada segmento lleva 2 ítems de cada nivel
        order = [];
        for (let s = 0; s < cfg.segmentCount; s++) {
            const seg = [].concat(...[1, 2, 3].map((l) => byLevel[l].slice(s * cfg.itemsPerLevelPerSegment, (s + 1) * cfg.itemsPerLevelPerSegment)));
            order = order.concat(shuffle(seg, rnd).map((it) => ({ it, seg: s + 1 })));
        }
    } while (maxRun(order.map((o) => o.it.level)) > cfg.maxRun && ++guard < 5000);
    const extra = shuffle([0, 1, 2, 3], rnd).slice(0, n - 16);           // 18 = 4×4 + 2 posiciones con 5
    const pool = [].concat(...[0, 1, 2, 3].map((p) => Array(4 + (extra.includes(p) ? 1 : 0)).fill(p)));
    guard = 0;
    do { positions = shuffle(pool, rnd); } while (maxRun(positions) > cfg.maxRun && ++guard < 5000);
    const seq = order.map((o, i) => Object.assign(arrange(o.it, positions[i], rnd), { plannedSegment: o.seg }));
    const pr = shuffle([0, 1, 2, 3], rnd);
    const practice = bank.practice.map((it, i) => arrange(it, pr[i], rnd));
    return { seq, practice };
}
function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

/* ---------------------------------------------------------------------
   5. INDICADORES (Fundamento 5.6) — función pura, solo ítems válidos
   ------------------------------------------------------------------- */
function computeIndicators(events, cfg) {
    const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const sdPop = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); }; // √(Σ(x−x̄)²/n)
    const pct = (num, den) => (den > 0 ? r1(num / den * 100) : null);
    function block(evts, minRt) {
        const valid = evts.filter((e) => e.valid && e.result);
        const nCorrect = valid.filter((e) => e.result === "correct").length;
        const nIncorrect = valid.filter((e) => e.result === "incorrect").length;
        const nOmission = valid.filter((e) => e.result === "omission").length;
        const rts = valid.filter((e) => e.result === "correct" && !e.anticipatory && e.rtMs != null).map((e) => e.rtMs);
        const ok = rts.length >= minRt;
        const m = ok ? mean(rts) : null, sd = ok ? sdPop(rts) : null;
        return {
            nPresented: evts.length,
            nValid: valid.length,
            nCorrect, nIncorrect, nOmission,
            nAnticipatory: valid.filter((e) => e.anticipatory).length,
            precisionPct: pct(nCorrect, valid.length),        // correctas / válidos × 100
            errorRatePct: pct(nIncorrect, valid.length),      // incorrectas / válidos × 100
            omissionRatePct: pct(nOmission, valid.length),    // omisiones / válidos × 100
            nRt: rts.length,
            rtMedianMs: ok ? r1(median(rts)) : null,
            rtMeanMs: ok ? r1(m) : null,
            rtSdMs: ok ? r1(sd) : null,
            rtCvPct: ok && m > 0 ? r1(sd / m * 100) : null,
            status: valid.length === 0 ? "insufficient_data" : (ok ? "ok" : "insufficient_rt_data")
        };
    }
    const selectionPositionCounts = [0, 0, 0, 0];
    events.filter((e) => e.valid && e.selectedIdx != null).forEach((e) => { selectionPositionCounts[e.selectedIdx]++; });
    return {
        formulasRef: "Fundamento teórico 5.6.1–5.6.4",
        overall: Object.assign(block(events, cfg.minRtOverall), { selectionPositionCounts }),
        byLevel: [1, 2, 3].map((l) => Object.assign({ level: l }, block(events.filter((e) => e.level === l), cfg.minRtGroup))),
        bySegment: [1, 2, 3].map((s) => Object.assign({ segment: s }, block(events.filter((e) => e.segment === s), cfg.minRtGroup)))
    };
}

/* ---------------------------------------------------------------------
   6. PÁGINA Y KUD
   ------------------------------------------------------------------- */

module.exports = { CONFIG, buildSequence, computeIndicators, hashString };
