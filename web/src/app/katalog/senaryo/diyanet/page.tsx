"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 17 — "Diyanet BT Pazartesi"
// Bilgi İşlem Daire Başkanlığı · 09:00 · 4 use-case tek video.
// Mood: precise official, institutional, vakarlı.
// Accent: navy gold #d8b878 → #9a7a48 → #5a3a18
// Süre: 46 sn (uzun format — skill default 22sn değil)
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 46;
const SCENE_TIMINGS = [
  [0, 3],   // 1 açılış
  [3, 4],   // 2 manzara
  [7, 3],   // 3 soru
  [10, 3],  // 4 altaris reveal
  [13, 5],  // 5 fetva asistanı
  [18, 5],  // 6 bt destek ajanı
  [23, 5],  // 7 low-code
  [28, 5],  // 8 güvenlik
  [33, 4],  // 9 egemenlik
  [37, 4],  // 10 sayısal vurgu
  [41, 5],  // 11 CTA
] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // C major institutional pad — vakar, kurumsal
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.C3, NOTES.G3, NOTES.C4], [
    [0, 0],
    [2, 0.022],
    [10, 0.022],
    [13, 0.028],
    [28, 0.028],
    [33, 0.034],
    [40, 0.030],
    [45.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.18, 0.005, TOTAL, t0);

  // Institutional heartbeat — 1.5sn aralık (boardroom calm)
  const beats: number[] = [];
  for (let t = 1.5; t < 41; t += 1.5) beats.push(t);
  beats.forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 4 === 0 ? 0.22 : 0.12);
  });

  // Sahne 1 — açılış: soft bell hint (hint of brand motif: D)
  bell(ctx, master, t0 + 0.4, NOTES.D4, 0.10, 1.6);
  bell(ctx, master, t0 + 1.6, NOTES.A4, 0.08, 1.4);

  // Sahne 2 — manzara: ascending counts (sayılar belirir)
  [3.4, 4.0, 4.6, 5.2, 5.8].forEach((t, i) => {
    const notes = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.E5];
    bell(ctx, master, t0 + t, notes[i], 0.09, 1.0);
  });

  // Sahne 3 — soru: descending C major (concern)
  bell(ctx, master, t0 + 7.3, NOTES.G4, 0.10, 1.4);
  bell(ctx, master, t0 + 8.0, NOTES.E4, 0.10, 1.4);
  bell(ctx, master, t0 + 8.7, NOTES.C4, 0.10, 1.5);

  // Sahne 4 — altaris reveal: rising arpeggio + low D anchor
  bell(ctx, master, t0 + 10.2, NOTES.D3, 0.13, 1.8);
  [10.7, 11.2, 11.7, 12.2].forEach((t, i) => {
    const notes = [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5];
    bell(ctx, master, t0 + t, notes[i], 0.11, 1.4);
  });

  // Sahne 5 — fetva asistanı: gentle scholar bells (E minor → C major)
  [13.3, 14.0, 14.7, 15.4, 16.1, 16.8, 17.4].forEach((t, i) => {
    const notes = [NOTES.C5, NOTES.G4, NOTES.E5, NOTES.C5, NOTES.G4, NOTES.E4, NOTES.C4];
    bell(ctx, master, t0 + t, notes[i], 0.08, 1.2);
  });

  // Sahne 6 — BT destek: rapid ticks (ticket processing)
  for (let t = 18.3; t < 22.5; t += 0.35) {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 60, 0.04, 0.4);
  }
  bell(ctx, master, t0 + 22.6, NOTES.E5, 0.10, 1.3);

  // Sahne 7 — low-code: building chord (cumulative C major)
  bell(ctx, master, t0 + 23.4, NOTES.C4, 0.10, 1.6);
  bell(ctx, master, t0 + 24.4, NOTES.E4, 0.10, 1.6);
  bell(ctx, master, t0 + 25.4, NOTES.G4, 0.10, 1.6);
  bell(ctx, master, t0 + 26.4, NOTES.C5, 0.11, 1.7);
  bell(ctx, master, t0 + 27.2, NOTES.E5, 0.10, 1.4);

  // Sahne 8 — güvenlik: alert + resolve (E minor → E major)
  bell(ctx, master, t0 + 28.3, NOTES.E5, 0.13, 1.0);
  bell(ctx, master, t0 + 28.8, NOTES.B3 * 2, 0.10, 1.0);
  [29.6, 30.4, 31.2, 32.0].forEach((t, i) => {
    const notes = [NOTES.E4, NOTES.G4, NOTES.B3 * 2, NOTES.E5];
    bell(ctx, master, t0 + t, notes[i], 0.09, 1.1);
  });

  // Sahne 9 — egemenlik: low warm sustain (institutional weight)
  bell(ctx, master, t0 + 33.3, NOTES.C3, 0.16, 2.0);
  bell(ctx, master, t0 + 34.5, NOTES.G3, 0.13, 1.8);
  bell(ctx, master, t0 + 35.7, NOTES.C4, 0.12, 1.7);

  // Sahne 10 — sayısal vurgu: rapid metric pings
  [37.2, 37.6, 38.0, 38.4, 38.8, 39.2, 39.6, 40.0].forEach((t, i) => {
    bell(ctx, master, t0 + t, NOTES.C5 + i * 30, 0.06, 0.5);
  });
  bell(ctx, master, t0 + 40.5, NOTES.G5, 0.10, 1.2);

  // Sahne 11 — CTA: D-major pentatonic brand motif (FORTE resolve)
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 41.2 + i * 0.32, f, 0.14, 1.9);
  });

  // Final D drone (brand signature sustain)
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 41);
  finalG.gain.linearRampToValueAtTime(0.052, t0 + 41.6);
  finalG.gain.linearRampToValueAtTime(0.044, t0 + 45);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 46);
  finalOsc.start(t0 + 41);
  finalOsc.stop(t0 + 46.1);
};

export default function SenaryoDiyanetPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris · senaryo 17 · diyanet bt daire başkanlığı"
      timeline={["açılış", "manzara", "soru", "altaris", "fetva", "bt destek", "low-code", "güvenlik", "egemenlik", "kanıt", "pilot"]}
      accentColors={{ from: "#d8b878", via: "#9a7a48", to: "#5a3a18" }}
    >
      {/* SAHNE 1 — Açılış */}
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ ankara · pazartesi · 09:00</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              <span className="text-[#d8b878]">⌘</span> Diyanet İşleri Başkanlığı<br />
              <span className="text-[#7a7166]">Bilgi İşlem Daire Başkanlığı</span>
            </h1>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl">
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8b878]">kullanıcı</div>
                <div className="mt-1 text-base text-[#ddd8d0]">150.000</div>
              </div>
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8b878]">pardus</div>
                <div className="mt-1 text-base text-[#ddd8d0]">12.000</div>
              </div>
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8b878]">iç-kaynak BT</div>
                <div className="mt-1 text-base text-[#ddd8d0]">%90</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 2 — Manzara */}
      <section className="scene s2">
        <div className="stage">
          <div className="max-w-5xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ tek bir hafta · binlerce karar</div>
            <div className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-5">
              {[
                ["12.000", "Pardus istasyonu"],
                ["150.000", "kullanıcı hesabı"],
                ["30.000", "e-posta kutusu"],
                ["13.000", "merkezi yönetim"],
                ["açık kaynak", "PAM · API · DB · low-code"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] px-4 py-3">
                  <div className="text-base font-medium text-[#d8b878]">{v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">{l}</div>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[#bdb4a6]">
              Destek talepleri, mevzuat akışı, fetva danışmaları, güvenlik logları —
              <span className="text-[#ddd8d0]"> hepsi aynı anda, ölçek büyüyor</span>.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 3 — Soru */}
      <section className="scene s3">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(30px,4.6vw,64px)] font-light leading-[1.18] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Hangi yapay zekâ bu yükü taşır<br />
              ve <span className="grad-text font-medium">veriyi yurt içinde tutar</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-8 text-base text-[#7a7166]">
              Yabancı LLM servisleri · veri sınırötesi · KVKK · denetim kayıtları
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 4 — Altaris reveal */}
      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#d8b878] animate-pulse" />
              <span>altaris · agentic ai platform</span>
              <span className="text-[#3a342d]">·</span>
              <span>on-premise · multi-tenant · keycloak</span>
            </div>
            <div className="rounded-md border border-[rgba(216,184,120,0.5)] bg-[#100c08] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#d8b878]">▸</span> altaris init
                <span className="text-[#7a7166]"> --tenant=diyanet</span>
                <span className="text-[#7a7166]"> --on-prem</span>
                <span className="text-[#7a7166]"> --rls --pam --audit</span>
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>.NET 9</span>
                <span>PostgreSQL · RLS</span>
                <span>Keycloak SSO</span>
                <span>Tauri · Bun CLI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 5 — Fetva ve Danışma asistanı */}
      <section className="scene s5">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#d8b878]">/ kullanım 1 · fetva ve danışma asistanı</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">RAG · kaynak gösterimli</div>
            </div>
            <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#9b9285]">soru</p>
              <p className="mt-1 text-base text-[#ddd8d0] italic">
                "Faizsiz finans aracı X için Kurul'un güncel görüşü nedir?"
              </p>
              <div className="my-4 h-px bg-[rgba(216,184,120,0.25)]" />
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#d8b878]">altaris yanıtı · atıflı</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#bdb4a6]">
                Din İşleri Yüksek Kurulu kararı 2024-118 ile … şartlarla caizdir.
                Klasik kaynak <span className="text-[#ddd8d0]">[Mecelle md. 85]</span>,
                geçmiş fetva arşivi <span className="text-[#ddd8d0]">[2019/443]</span>.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                {["Kurul kararı", "Klasik fıkıh", "Fetva arşivi", "Mevzuat"].map((s) => (
                  <span key={s} className="rounded-sm border border-[rgba(216,184,120,0.4)] bg-[#180e08] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[#7a7166]">
              halüsinasyon değil · kaynak gösterimli · nihai yetki Din İşleri Yüksek Kurulu
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 6 — BT Destek Ajanı */}
      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#d8b878]">/ kullanım 2 · BT destek ajanı</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">L1 otomasyon · 150k kullanıcı</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Pardus paketi", "4.200", "ofis · liblibre · paket güncelleme"],
                ["E-posta SSO", "1.800", "yerli e-posta · Keycloak token"],
                ["Mevzuat formu", "980", "doküman + form akışı"],
              ].map(([t, n, d]) => (
                <div key={t} className="relative rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#d8b878]" />
                  <div className="text-base font-medium text-[#d8b878]">{n} talep</div>
                  <div className="mt-1 text-base text-[#ddd8d0]">{t}</div>
                  <p className="mt-2 text-[12px] text-[#9b9285]">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] p-4">
              <p className="text-[13px] leading-relaxed text-[#ddd8d0]">
                <span className="text-[#d8b878]">12.000 talebin %50'si ilk temasta kapatıldı</span> — kalan kısım
                kategorize edilip seviye-2 ekibine yönlendirildi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 7 — Low-code süreç ajanı */}
      <section className="scene s7">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#d8b878]">/ kullanım 3 · low-code süreç ajanı</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">yerli low-code · 150k çalışan</div>
            </div>
            <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#9b9285]">istek</p>
              <p className="mt-1 text-base text-[#ddd8d0] italic">
                "İl müftülerinin yıllık izin onay akışı — 3 kademeli, hafta sonu hariç."
              </p>
              <div className="my-4 h-px bg-[rgba(216,184,120,0.25)]" />
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#d8b878]">altaris üretimi · 4 dakika</p>
              <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] text-[#bdb4a6]">
                <div className="rounded-sm border border-[rgba(216,184,120,0.4)] bg-[#180e08] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#d8b878]">01 · şema</div>
                  <div className="mt-1">talep · onay · iptal</div>
                </div>
                <div className="rounded-sm border border-[rgba(216,184,120,0.4)] bg-[#180e08] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#d8b878]">02 · form</div>
                  <div className="mt-1">3 alan · doğrulama</div>
                </div>
                <div className="rounded-sm border border-[rgba(216,184,120,0.4)] bg-[#180e08] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#d8b878]">03 · akış</div>
                  <div className="mt-1">3 onay kademesi</div>
                </div>
                <div className="rounded-sm border border-[rgba(216,184,120,0.4)] bg-[#180e08] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#d8b878]">04 · yayım</div>
                  <div className="mt-1">tüm il müftülükleri</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 8 — Güvenlik ajanı */}
      <section className="scene s8">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#d8b878]">/ kullanım 4 · güvenlik ajanı</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">açık kaynak izleme + PAM</div>
            </div>
            <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] p-5">
              <div className="flex items-center gap-3">
                <span aria-hidden className="size-2 rounded-full bg-[#ff8060]" />
                <span className="text-[11px] uppercase tracking-[0.28em] text-[#ff8060]">anomali · 03:14</span>
                <span className="text-[10px] text-[#7a7166]">api-gateway · prod-eu-1</span>
              </div>
              <p className="mt-3 text-base text-[#ddd8d0]">
                Yetkisiz erişim girişimi — 14 dakikada 312 başarısız token, sonrasında
                süper kullanıcı eskalasyonu.
              </p>
              <div className="my-4 h-px bg-[rgba(216,184,120,0.25)]" />
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#d8b878]">altaris müdahale önerisi</p>
              <ul className="mt-2 space-y-1 text-[12px] text-[#bdb4a6]">
                <li>· PAM oturumunu izole et · token rotasyonu zorla</li>
                <li>· Açık kaynak izleme paneline kural eklendi</li>
                <li>· Kök neden raporu 6 dakikada hazır</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 9 — Egemenlik kanıtı */}
      <section className="scene s9">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ dijital egemenlik</div>
            <h2 className="mt-6 text-[clamp(28px,4.4vw,60px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="grad-text font-medium">Model · veri · log · denetim</span><br />
              <span className="text-[#bdb4a6]">— hepsi yurt içinde</span>
            </h2>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8b878]">on-premise</div>
                <div className="mt-1 text-[11px] text-[#bdb4a6]">veri merkezinde · sınır dışına çıkmaz</div>
              </div>
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8b878]">KVKK uyumlu</div>
                <div className="mt-1 text-[11px] text-[#bdb4a6]">retention · audit · erişim kontrolü</div>
              </div>
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8b878]">açık kaynak</div>
                <div className="mt-1 text-[11px] text-[#bdb4a6]">denetlenebilir · kilitlenmez</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 10 — Sayısal vurgu */}
      <section className="scene s10">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ ölçek + hız + egemenlik</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">4 kullanım</span> ·
              <span className="grad-text font-medium"> 1 platform</span>
            </h2>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] px-3 py-2">
                <div className="text-base font-medium text-[#d8b878]">6 saat</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">insan analizi</div>
              </div>
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] px-3 py-2">
                <div className="text-base font-medium text-[#d8b878]">14 sn</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">altaris</div>
              </div>
              <div className="rounded-md border border-[rgba(216,184,120,0.45)] bg-[#100c08] px-3 py-2">
                <div className="text-base font-medium text-[#d8b878]">%100</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">yurt içi</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 11 — CTA */}
      <section className="scene s11">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <pre aria-label="Altaris" className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,1.8vw,22px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#d8b878]">
              argus teknoloji · agentic ai for kurumsal türkiye
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#bdb4a6]">
              dijital egemenlik · ekonomik tasarruf · güvenli altyapı
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#d8b878] bg-[#d8b878] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">30 gün on-premise · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-17-diyanet-bt-pazartesi" label="senaryo 17 · diyanet bt pazartesi" />
    </SenaryoStage>
  );
}
