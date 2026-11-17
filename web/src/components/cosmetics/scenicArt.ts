/**
 * Procedural scenery for the "Nền" cosmetics.
 *
 * The shop cards want landscape thumbnails, and the equipped plate paints the
 * same scenery behind the profile blocks. The project ships no photo assets and
 * the rest of the cosmetic catalogue is drawn in code, so each scene is a small
 * self-contained SVG encoded as a data URI. That keeps both usages sharp at any
 * size, works in light and dark themes, and needs no network request.
 */
export type ScenicScene = 'plain' | 'slate' | 'sky' | 'sunset' | 'forest' | 'royal'

function svg(inner: string): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid slice">${inner}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`
}

/** A flat, cartoony cloud built from four overlapping ellipses. */
function cloud(x: number, y: number, scale: number, opacity: number, fill = '#FFFFFF'): string {
  return `<g fill="${fill}" opacity="${opacity}" transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="0" rx="92" ry="34"/>
    <ellipse cx="-64" cy="18" rx="58" ry="26"/>
    <ellipse cx="66" cy="16" rx="64" ry="28"/>
    <ellipse cx="10" cy="-24" rx="52" ry="30"/>
  </g>`
}

function birds(x: number, y: number, scale: number, color: string): string {
  return `<g fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" opacity=".55" transform="translate(${x} ${y}) scale(${scale})">
    <path d="M0 0q13-11 26 0q13-11 26 0"/>
    <path d="M72 34q10-8 20 0q10-8 20 0"/>
    <path d="M28 62q8-7 16 0q8-7 16 0"/>
  </g>`
}

const SCENES: Record<ScenicScene, string> = {
  /* A quiet, almost blank paper landscape for the free default: enough scenery
     to read as a card, not enough to compete with the paid plates. */
  plain: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FBFAF4"/>
        <stop offset=".62" stop-color="#EFF6F7"/>
        <stop offset="1" stop-color="#E3EFF1"/>
      </linearGradient>
      <radialGradient id="sun">
        <stop offset="0" stop-color="#FFE9A8" stop-opacity=".8"/>
        <stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <circle cx="970" cy="170" r="170" fill="url(#sun)"/>
    <circle cx="970" cy="170" r="42" fill="#FFF2C6"/>
    ${cloud(300, 150, 0.8, 0.7)}
    ${cloud(720, 240, 0.55, 0.45)}
    <path d="M0 480q220-52 430 4t410-2 360 4v189H0z" fill="#D9E8EA"/>
    <path d="M0 560q250-46 520 10t680-8v113H0z" fill="#C4DADF"/>
    <path d="M0 628q300-38 600 8t600-6v45H0z" fill="#B5CED5"/>
    ${birds(190, 260, 0.7, '#7D9DA6')}
  `,

  slate: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7D99AE"/>
        <stop offset=".54" stop-color="#C5D7E0"/>
        <stop offset="1" stop-color="#EFF5F6"/>
      </linearGradient>
      <radialGradient id="sun">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity=".72"/>
        <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <circle cx="910" cy="145" r="160" fill="url(#sun)"/>
    <circle cx="910" cy="145" r="38" fill="#F7FBFD" opacity=".82"/>
    ${cloud(230, 120, 0.95, 0.4)}
    ${cloud(640, 205, 0.6, 0.3)}
    <path d="M0 455 120 335l96 66 128-142 108 146 108-82 116 104 128-136 118 108 110-96 68 56v315H0z" fill="#92AABD" opacity=".72"/>
    <path d="M0 525 140 420l94 58 130-120 104 136 112-74 120 100 126-116 116 96 108-78 50 44v209H0z" fill="#708BA1"/>
    <rect y="398" width="1200" height="132" fill="#E8F1F4" opacity=".2"/>
    <path d="M0 590q250-58 500-6t700-14v105H0z" fill="#526C81"/>
    <path d="M0 641q280-40 560 6t640-4v32H0z" fill="#3A5164"/>
    <g fill="#334B5C" opacity=".9">
      <path d="M150 596l-26 78h52z"/>
      <path d="M188 620l-20 58h40z"/>
      <path d="M1032 590l-28 84h56z"/>
      <path d="M1074 618l-21 60h42z"/>
    </g>
  `,

  sky: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2E9FE6"/>
        <stop offset=".54" stop-color="#8BD5FB"/>
        <stop offset="1" stop-color="#EAF9FF"/>
      </linearGradient>
      <radialGradient id="sun">
        <stop offset="0" stop-color="#FFF6C4" stop-opacity=".92"/>
        <stop offset="1" stop-color="#FFF6C4" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <circle cx="958" cy="146" r="190" fill="url(#sun)"/>
    <circle cx="958" cy="146" r="56" fill="#FFF8D9"/>
    ${cloud(250, 152, 1.1, 0.92)}
    ${cloud(548, 92, 0.72, 0.7)}
    ${cloud(788, 236, 0.56, 0.58)}
    ${cloud(1080, 300, 0.82, 0.48)}
    ${birds(170, 250, 0.8, '#3D6F8E')}
    <path d="M0 470q180-58 360-2t360-6 480 4v209H0z" fill="#BCE6B8"/>
    <path d="M0 522q220-52 470 4t370-2 360 4v147H0z" fill="#82CF8A"/>
    <path d="M0 588q250-44 540 8t660-6v85H0z" fill="#5CB26C"/>
    <path d="M560 675c42-58 92-82 142-110 46-26 66-54 58-90" fill="none" stroke="#E8D6A1" stroke-width="30" stroke-linecap="round" opacity=".9"/>
    <g stroke="#3F8F57" stroke-width="5" stroke-linecap="round" opacity=".78">
      <path d="M92 662q5-20 12-29"/><path d="M122 667q-3-22 3-33"/>
      <path d="M1010 664q4-18 11-27"/><path d="M1042 670q-3-23 4-34"/>
      <path d="M338 656q3-15 9-23"/><path d="M846 658q5-17 12-26"/>
    </g>
  `,

  sunset: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFB067"/>
        <stop offset=".48" stop-color="#FF7E7E"/>
        <stop offset="1" stop-color="#7E4674"/>
      </linearGradient>
      <radialGradient id="sun">
        <stop offset="0" stop-color="#FFF1B8" stop-opacity="1"/>
        <stop offset=".48" stop-color="#FFE29A" stop-opacity=".5"/>
        <stop offset="1" stop-color="#FFCF83" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <circle cx="720" cy="410" r="270" fill="url(#sun)"/>
    <circle cx="720" cy="410" r="82" fill="#FFF0BE"/>
    ${cloud(245, 142, 1.05, 0.5, '#FFD3B0')}
    ${cloud(880, 105, 0.72, 0.4, '#FFC7A8')}
    ${cloud(540, 236, 0.6, 0.34, '#7A4268')}
    ${birds(250, 300, 0.9, '#5D3152')}
    <path d="M0 438q210-56 420 0t390-4 390 2v239H0z" fill="#B36B83"/>
    <path d="M0 500q230-46 470 6t370-8 360 6v171H0z" fill="#864E70"/>
    <path d="M0 568q270-42 540 10t660-4v101H0z" fill="#5B3459"/>
    <path d="M0 632q300-30 600 8t600-6v41H0z" fill="#38233F"/>
    <g fill="#2C1934" opacity=".92">
      <path d="M84 675q3-52 14-78 4 42 14 78z"/>
      <path d="M154 675q-1-40 8-62 5 34 11 62z"/>
      <path d="M1016 675q2-46 12-70 5 38 12 70z"/>
      <path d="M1094 675q-2-36 7-56 5 30 10 56z"/>
    </g>
  `,

  forest: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#D8F3D9"/>
        <stop offset=".55" stop-color="#A7DDB4"/>
        <stop offset="1" stop-color="#6DBF8B"/>
      </linearGradient>
      <linearGradient id="stream" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#D7F8F8"/>
        <stop offset="1" stop-color="#80CFD9"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <g fill="#FFF8CE" opacity=".2">
      <path d="M520 0h120L900 675H740z"/>
      <path d="M700 0h84l300 675h-104z"/>
    </g>
    <path d="M0 405q150-58 300-4t300-10 300 12 300-4v276H0z" fill="#7FC99A"/>
    <g fill="#4E9E72">
      <ellipse cx="120" cy="410" rx="180" ry="72"/>
      <ellipse cx="390" cy="392" rx="150" ry="58"/>
      <ellipse cx="690" cy="410" rx="180" ry="64"/>
      <ellipse cx="980" cy="394" rx="170" ry="60"/>
      <ellipse cx="1180" cy="414" rx="160" ry="66"/>
    </g>
    <g fill="#2F6B50">
      <rect x="42" y="0" width="92" height="675" rx="18"/>
      <rect x="178" y="40" width="54" height="635" rx="14"/>
      <rect x="1008" y="0" width="78" height="675" rx="18"/>
      <rect x="1122" y="52" width="50" height="623" rx="14"/>
    </g>
    <g fill="#235B43" opacity=".96">
      <ellipse cx="120" cy="70" rx="230" ry="130"/>
      <ellipse cx="1120" cy="96" rx="250" ry="140"/>
      <ellipse cx="760" cy="38" rx="180" ry="104"/>
    </g>
    <path d="M0 552q250-50 500 4t420-4 280 6v172H0z" fill="#3F8E60"/>
    <path d="M520 675c42-72 92-98 150-124 42-19 62-46 58-82 0 0 8 46 30 70 32 34 20 74 6 136z" fill="url(#stream)"/>
    <path d="M600 675c36-52 70-74 106-88 28-11 44-30 48-52" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".5"/>
    <g fill="#6E8F6B" opacity=".75">
      <ellipse cx="470" cy="640" rx="34" ry="18"/>
      <ellipse cx="512" cy="660" rx="24" ry="13"/>
      <ellipse cx="790" cy="648" rx="30" ry="15"/>
    </g>
    <g fill="#FFE9A3" opacity=".8">
      <circle cx="360" cy="360" r="4"/><circle cx="860" cy="330" r="3.4"/>
      <circle cx="930" cy="420" r="4.2"/><circle cx="280" cy="452" r="3.2"/>
    </g>
  `,

  royal: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#060B22"/>
        <stop offset=".58" stop-color="#151C45"/>
        <stop offset="1" stop-color="#2C2752"/>
      </linearGradient>
      <radialGradient id="moon">
        <stop offset="0" stop-color="#FFF4C2" stop-opacity=".5"/>
        <stop offset="1" stop-color="#FFF4C2" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="palace">
        <stop offset="0" stop-color="#F7D98B" stop-opacity=".28"/>
        <stop offset="1" stop-color="#F7D98B" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <g fill="#F7F2D7" opacity=".9">
      <circle cx="70" cy="66" r="2.2"/><circle cx="142" cy="132" r="1.5"/>
      <circle cx="226" cy="84" r="2.6"/><circle cx="310" cy="152" r="1.4"/>
      <circle cx="392" cy="62" r="2"/><circle cx="468" cy="118" r="1.6"/>
      <circle cx="552" cy="56" r="2.4"/><circle cx="640" cy="148" r="1.4"/>
      <circle cx="722" cy="74" r="1.8"/><circle cx="812" cy="130" r="2.2"/>
      <circle cx="906" cy="62" r="1.5"/><circle cx="1010" cy="120" r="2.4"/>
      <circle cx="1102" cy="68" r="1.7"/><circle cx="1170" cy="140" r="2.1"/>
      <circle cx="104" cy="230" r="1.5"/><circle cx="486" cy="248" r="1.8"/>
      <circle cx="884" cy="238" r="1.4"/><circle cx="1140" cy="252" r="1.7"/>
      <circle cx="300" cy="310" r="1.3"/><circle cx="1010" cy="316" r="1.5"/>
    </g>
    <path d="M-60 300C170 128 348 354 610 194 830 60 1010 268 1268 112" fill="none" stroke="#6FE7C8" stroke-width="54" stroke-linecap="round" opacity=".15"/>
    <path d="M-80 366C160 236 360 420 640 286 860 180 1040 340 1270 228" fill="none" stroke="#F5D98B" stroke-width="30" stroke-linecap="round" opacity=".11"/>
    <circle cx="928" cy="142" r="150" fill="url(#moon)"/>
    <circle cx="928" cy="142" r="46" fill="#F8E8B4"/>
    <circle cx="944" cy="128" r="40" fill="#151C45" opacity=".22"/>
    <circle cx="720" cy="482" r="220" fill="url(#palace)"/>
    <path d="M0 520q280-66 560-6t640-12v173H0z" fill="#0B102A"/>
    <g fill="#050814">
      <rect x="636" y="446" width="188" height="84" rx="4"/>
      <rect x="650" y="404" width="44" height="58"/>
      <path d="M650 404l22-38 22 38z"/>
      <rect x="766" y="394" width="40" height="68"/>
      <path d="M766 394l20-42 20 42z"/>
      <rect x="708" y="376" width="34" height="86"/>
      <path d="M708 376l17-44 17 44z"/>
      <rect x="700" y="458" width="60" height="26" rx="3"/>
    </g>
    <g fill="#FFD979" opacity=".92">
      <rect x="662" y="458" width="8" height="15" rx="1"/>
      <rect x="682" y="458" width="8" height="15" rx="1"/>
      <rect x="716" y="430" width="8" height="14" rx="1"/>
      <rect x="732" y="430" width="8" height="14" rx="1"/>
      <rect x="774" y="448" width="8" height="15" rx="1"/>
      <rect x="794" y="448" width="8" height="15" rx="1"/>
      <rect x="720" y="494" width="14" height="24" rx="2"/>
    </g>
    <path d="M0 592q260-48 520 0t680-10v93H0z" fill="#070B1D"/>
    <path d="M0 646q300-30 600 4t600-2v27H0z" fill="#040713"/>
  `,
}

export const SCENIC_ART: Record<ScenicScene, string> = {
  plain: svg(SCENES.plain),
  slate: svg(SCENES.slate),
  sky: svg(SCENES.sky),
  sunset: svg(SCENES.sunset),
  forest: svg(SCENES.forest),
  royal: svg(SCENES.royal),
}

/**
 * Full plate background: scenery plus a dark scrim so the profile text keeps
 * its contrast over busy parts of the illustration.
 */
export function plateScene(scene: ScenicScene, scrim: string): string {
  return `linear-gradient(${scrim}, ${scrim}), ${SCENIC_ART[scene]} center / cover no-repeat`
}
