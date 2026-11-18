'use strict';
/* global IPET, api */
// Agent AI pracujący w tle: dla każdego ucznia kolejno
//  1) od razu tworzy wersje wzorcowe wszystkich potrzebnych dokumentów (bez internetu),
//  2) analizuje zanonimizowane orzeczenie,
//  3) wyszukuje aktualną wiedzę specjalistyczną w internecie,
//  4) opracowuje każdy dokument z pomocą AI i wstawia lokalnie dane osobowe.
(function () {
  const { privacy, catalog, prompts, text: T } = IPET;

  const Agent = {
    queue: [],
    current: null, // { studentId, step, done, total, label }
    onChange: () => {},
    getSettings: () => ({}),
    getStudent: () => null,
    saveStudent: async (s) => s,
    lock: Promise.resolve(),

    // Bezpieczna aktualizacja ucznia: odczyt najnowszej wersji → zmiana → zapis, po kolei
    // (agent pracuje równolegle nad kilkoma dokumentami, a nauczyciel może w tym czasie edytować).
    update(id, fn) {
      const p = this.lock.then(async () => {
        const s = this.getStudent(id);
        if (!s) return null;
        if ((await fn(s)) === false) return s;
        return this.saveStudent(s);
      });
      this.lock = p.catch(() => {});
      return p;
    },

    ctx(s) {
      const st = this.getSettings();
      return {
        codes: s.codes || [],
        plec: s.personal.plec,
        wiek: T.ageAt(s.personal.dataUrodzenia),
        etap: s.etap || s.personal.etap,
        etapLabel: s.etapLabel || s.personal.etapLabel,
        klasa: s.personal.klasa,
        anonText: s.anonText || '',
        profile: s.profile || null,
        research: s.research || null,
        team: st.team || []
      };
    },

    fillCtx() {
      const st = this.getSettings();
      return { szkola: st.school.nazwa, rokSzkolny: st.school.rokSzkolny, dyrektor: st.school.dyrektor, miejscowosc: st.school.miejscowosc };
    },

    fillDoc(s, doc, source) {
      return {
        type: doc.type,
        title: doc.title,
        source,
        updatedAt: new Date().toISOString(),
        sections: doc.sections.map((x) => ({ ...x, content: privacy.fill(x.content, s, this.fillCtx()) }))
      };
    },

    proposals(s) { return catalog.proposals(this.ctx(s)); },

    // wersje wzorcowe – natychmiast, lokalnie
    ensureDrafts(s, ids) {
      s.documents = s.documents || {};
      const want = ids || this.proposals(s).filter((p) => p.auto).map((p) => p.id);
      let added = 0;
      for (const id of want) {
        if (s.documents[id]) continue;
        s.documents[id] = this.fillDoc(s, catalog.offlineDocument(id, this.ctx(s)), 'offline');
        added++;
      }
      return added;
    },

    status(studentId) {
      if (this.current && this.current.studentId === studentId) return this.current;
      const q = this.queue.findIndex((j) => j.studentId === studentId);
      return q >= 0 ? { studentId, step: 'queued', label: 'W kolejce' } : null;
    },

    busyDocs(studentId) {
      return (this.current && this.current.studentId === studentId && this.current.docs) || {};
    },

    enqueue(studentId, opts = {}) {
      const existing = this.queue.find((j) => j.studentId === studentId);
      if (existing) Object.assign(existing.opts, opts);
      else if (!(this.current && this.current.studentId === studentId && !opts.docs)) this.queue.push({ studentId, opts });
      this.onChange();
      this.pump();
    },

    async pump() {
      if (this.current || !this.queue.length) return;
      const job = this.queue.shift();
      try { await this.run(job); } catch (e) { console.error(e); }
      this.current = null;
      this.onChange();
      setTimeout(() => this.pump(), 50);
    },

    async ask(s, req) {
      const r = await api.aiRun({ ...req, studentId: s.id });
      return prompts.extractJson(r.text);
    },

    async run({ studentId, opts }) {
      const settings = this.getSettings();
      let s = this.getStudent(studentId);
      if (!s) return;
      const offline = settings.ai.provider === 'offline';
      this.current = { studentId, step: 'drafts', label: 'Tworzę wersje wzorcowe…', done: 0, total: 0, docs: {} };
      this.onChange();
      s = await this.update(studentId, (x) => { x.agent = { status: offline ? 'done' : 'running', startedAt: new Date().toISOString(), errors: [] }; this.ensureDrafts(x); });
      if (offline || !s) return;

      const errors = [];
      const fail = (step, e) => { errors.push(`${step}: ${e.message || e}`); if (/Strażnik prywatności/.test(e.message || '')) throw e; };

      try {
        // 1. analiza
        if ((settings.agent.autoAnalyze && !s.profile) || opts.reanalyze) {
          this.current = { ...this.current, step: 'analyze', label: 'Analizuję orzeczenie…' }; this.onChange();
          try {
            const prof = prompts.normalizeAnalysis(await this.ask(s, prompts.analyze(this.ctx(s))));
            s = await this.update(studentId, (x) => {
              x.profile = { ...prof, at: new Date().toISOString() };
              const extra = prof.niepelnosprawnosci.filter((c) => !(x.codes || []).includes(c));
              if (extra.length && !x.codesLocked) x.codes = [...(x.codes || []), ...extra];
            });
          } catch (e) { fail('Analiza', e); }
        }
        // 2. wiedza z internetu
        if (settings.ai.useWebSearch && ((settings.agent.autoResearch && !s.research) || opts.research)) {
          this.current = { ...this.current, step: 'research', label: 'Szukam aktualnej wiedzy w internecie…' }; this.onChange();
          try {
            const r = prompts.normalizeResearch(await this.ask(s, prompts.research(this.ctx(s))));
            s = await this.update(studentId, (x) => { x.research = r; });
          } catch (e) { fail('Wyszukiwanie', e); }
        }
        // 3. dokumenty
        if (settings.agent.autoGenerate || opts.docs) {
          const props = this.proposals(s);
          let ids = opts.docs || props.filter((p) => p.auto).map((p) => p.id);
          ids = ids.filter((id) => !catalog.byId(id).noAi && (opts.docs || !s.documents[id] || s.documents[id].source !== 'ai' || opts.regenerate));
          s = await this.update(studentId, (x) => { this.ensureDrafts(x, ids); });
          this.current = { ...this.current, step: 'docs', label: 'Opracowuję dokumenty…', done: 0, total: ids.length, docs: Object.fromEntries(ids.map((i) => [i, 'queued'])) };
          this.onChange();
          let next = 0;
          const worker = async () => {
            while (next < ids.length) {
              const id = ids[next++];
              this.current.docs[id] = 'running'; this.onChange();
              try {
                const cur = this.getStudent(studentId) || s;
                const ctx = this.ctx(cur);
                const doc = prompts.normalizeDocument(id, await this.ask(cur, prompts.generate(id, ctx)), ctx);
                await this.update(studentId, (x) => {
                  x.documents = x.documents || {};
                  const prev = x.documents[id];
                  if (prev && prev.edited && !opts.docs) return false; // nie nadpisuj ręcznych zmian nauczyciela
                  x.documents[id] = this.fillDoc(x, doc, 'ai');
                });
                this.current.docs[id] = 'done';
              } catch (e) { this.current.docs[id] = 'error'; fail(catalog.byId(id).short, e); }
              this.current.done++;
              this.onChange();
            }
          };
          await Promise.all([worker(), worker()]);
        }
      } catch (e) { errors.push(e.message || String(e)); }

      s = await this.update(studentId, (x) => { x.agent = { status: errors.length ? 'error' : 'done', finishedAt: new Date().toISOString(), errors }; });
      if (!s) return;
      const name = [s.personal.imie, s.personal.nazwisko].filter(Boolean).join(' ');
      api.notify('Dokumenty gotowe', errors.length ? `${name}: część zadań nie powiodła się (${errors.length}).` : `${name}: agent przygotował dokumenty do weryfikacji.`).catch(() => {});
    }
  };

  window.Agent = Agent;
})();
