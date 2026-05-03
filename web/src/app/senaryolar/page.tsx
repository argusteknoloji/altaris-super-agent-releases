import { detectLocale, t } from "@/lib/i18n";
import SenaryolarClient from "./Client";

export default async function SenaryolarPage() {
  const locale = await detectLocale();
  const d = t(locale);

  // marshal only what the client needs
  const clientDict = {
    scenes: {
      sectionHead: d.scenes.sectionHead,
      livePreview: d.scenes.livePreview,
      pageTitleA: d.scenes.pageTitleA,
      pageTitleGrad: d.scenes.pageTitleGrad,
      pageTitleC: d.scenes.pageTitleC,
      pageLede: d.scenes.pageLede,
      nowPlaying: d.scenes.nowPlaying,
      watch: d.scenes.watch,
      playing: d.scenes.playing,
      fallbackPause: d.scenes.fallbackPause,
      keyNav: d.scenes.keyNav,
      keyPlay: d.scenes.keyPlay,
      keySound: d.scenes.keySound,
      keyFs: d.scenes.keyFs,
      fullscreen: d.scenes.fullscreen,
      backHome: d.scenes.backHome,
      chapter: d.scenes.chapter,
    },
    nav: { altaris: d.nav.altaris, home: d.nav.home, scenes: d.nav.scenes },
    start: { head: d.start.head, requestDemo: d.start.requestDemo },
    footer: { copy: d.footer.copy },
  };

  return (
    <SenaryolarClient
      scenes={d.scenes.list}
      d={clientDict}
      locale={locale}
    />
  );
}
