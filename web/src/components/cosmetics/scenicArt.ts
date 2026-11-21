/**
 * Procedural scenery for the "Nền" cosmetics.
 *
 * The shop cards want landscape thumbnails, and the equipped plate paints the
 * same scenery behind the profile blocks. The project ships no photo assets and
 * the rest of the cosmetic catalogue is drawn in code, so each scene is a small
 * self-contained SVG encoded as a data URI. That keeps both usages sharp at any
 * size, works in light and dark themes, and needs no network request.
 */
export type ScenicScene =
  | 'plain'
  | 'slate'
  | 'sky'
  | 'sunset'
  | 'forest'
  | 'royal'
  | 'desert'
  | 'space'
  | 'sakura'
  | 'ocean'
  | 'aurora'

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

/** Five-petal blossom used by the sakura scene. */
function blossom(x: number, y: number, scale: number, petal: string, core: string): string {
  const petals = [0, 72, 144, 216, 288]
    .map((angle) => `<ellipse cx="0" cy="-10" rx="6" ry="10" transform="rotate(${angle})" fill="${petal}"/>`)
    .join('')
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    ${petals}
    <circle r="4" fill="${core}"/>
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

  desert: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2E2450"/>
        <stop offset=".42" stop-color="#944A72"/>
        <stop offset=".72" stop-color="#E9836A"/>
        <stop offset="1" stop-color="#F8D09C"/>
      </linearGradient>
      <radialGradient id="sun">
        <stop offset="0" stop-color="#FFF4C9" stop-opacity=".95"/>
        <stop offset=".55" stop-color="#FFE3A0" stop-opacity=".45"/>
        <stop offset="1" stop-color="#FFD98D" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <g fill="#FFF1D0" opacity=".72">
      <circle cx="86" cy="66" r="2"/><circle cx="174" cy="112" r="1.4"/>
      <circle cx="268" cy="58" r="2.3"/><circle cx="362" cy="132" r="1.5"/>
      <circle cx="470" cy="74" r="1.8"/><circle cx="566" cy="44" r="2.2"/>
      <circle cx="660" cy="122" r="1.3"/><circle cx="764" cy="62" r="2"/>
      <circle cx="872" cy="96" r="1.5"/><circle cx="972" cy="52" r="2.4"/>
      <circle cx="1084" cy="118" r="1.6"/><circle cx="1158" cy="70" r="2"/>
    </g>
    <circle cx="292" cy="306" r="196" fill="url(#sun)"/>
    <circle cx="292" cy="306" r="88" fill="#FFF1BE"/>
    ${cloud(862, 156, 0.84, 0.28, '#FFD2B4')}
    ${cloud(1044, 236, 0.52, 0.2, '#FFC6A9')}
    <g>
      <path d="M596 548 764 246l168 302z" fill="#A8615A"/>
      <path d="M764 246 932 548H764z" fill="#7E4450" opacity=".92"/>
      <path d="M900 566 1022 342l122 224z" fill="#B16A5E"/>
      <path d="M1022 342 1144 566h-122z" fill="#874553" opacity=".9"/>
      <path d="M436 570 534 412l98 158z" fill="#AE6A5C" opacity=".85"/>
    </g>
    <path d="M0 500q180-60 360-2t360 4 480-10v183H0z" fill="#D9925B"/>
    <path d="M0 568q220-50 470 6t370-6 360 6v107H0z" fill="#B96A46"/>
    <path d="M0 628q300-38 600 8t600-6v45H0z" fill="#7E4352"/>
    <g fill="#3A2333" opacity=".92">
      <path d="M126 616q9-72 22-108 7 38 5 108z"/>
      <path d="M148 508q-50-30-76-13 38-1 72 24z"/>
      <path d="M148 508q-14-48-42-58 24 27 38 66z"/>
      <path d="M148 508q30-44 60-40-30 15-52 50z"/>
      <path d="M148 508q46-16 64 6-32-6-58 10z"/>
    </g>
    <g fill="#4A2B34" opacity=".8">
      <ellipse cx="884" cy="588" rx="22" ry="9"/>
      <path d="M866 592l-10 12M874 596l-4 14M894 596l4 14M902 592l10 12"/>
      <ellipse cx="944" cy="602" rx="17" ry="7"/>
      <path d="M930 606l-8 10M938 608l-3 12M952 608l3 12M958 606l8 10"/>
    </g>
  `,

  space: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#030616"/>
        <stop offset=".5" stop-color="#0B1233"/>
        <stop offset="1" stop-color="#241747"/>
      </linearGradient>
      <radialGradient id="nebula1">
        <stop offset="0" stop-color="#7A4BD6" stop-opacity=".55"/>
        <stop offset="1" stop-color="#7A4BD6" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="nebula2">
        <stop offset="0" stop-color="#2FB9D6" stop-opacity=".4"/>
        <stop offset="1" stop-color="#2FB9D6" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="planet" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F6C273"/>
        <stop offset=".5" stop-color="#D96B7A"/>
        <stop offset="1" stop-color="#5A438F"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <ellipse cx="780" cy="330" rx="520" ry="260" fill="url(#nebula1)"/>
    <ellipse cx="260" cy="480" rx="380" ry="220" fill="url(#nebula2)"/>
    <g fill="#F6FBFF">
      <circle cx="64" cy="54" r="2.2"/><circle cx="126" cy="150" r="1.3"/>
      <circle cx="187" cy="88" r="1.8"/><circle cx="246" cy="206" r="1.2"/>
      <circle cx="318" cy="62" r="2.4"/><circle cx="382" cy="158" r="1.5"/>
      <circle cx="446" cy="106" r="1.9"/><circle cx="512" cy="228" r="1.3"/>
      <circle cx="578" cy="70" r="2.1"/><circle cx="638" cy="184" r="1.4"/>
      <circle cx="708" cy="112" r="1.7"/><circle cx="772" cy="44" r="2.3"/>
      <circle cx="846" cy="172" r="1.3"/><circle cx="912" cy="102" r="1.9"/>
      <circle cx="982" cy="228" r="1.4"/><circle cx="1042" cy="66" r="2.2"/>
      <circle cx="1112" cy="150" r="1.5"/><circle cx="1168" cy="94" r="1.8"/>
      <circle cx="96" cy="318" r="1.5"/><circle cx="170" cy="402" r="1.2"/>
      <circle cx="262" cy="356" r="1.7"/><circle cx="340" cy="466" r="1.3"/>
      <circle cx="422" cy="386" r="1.5"/><circle cx="512" cy="548" r="1.2"/>
      <circle cx="604" cy="446" r="1.6"/><circle cx="698" cy="566" r="1.3"/>
      <circle cx="790" cy="476" r="1.5"/><circle cx="882" cy="584" r="1.2"/>
      <circle cx="984" cy="506" r="1.7"/><circle cx="1088" cy="590" r="1.3"/>
      <circle cx="1146" cy="382" r="1.4"/>
    </g>
    <g fill="#BFE8FF" opacity=".9">
      <path d="M304 118l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/>
      <path d="M1020 292l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/>
      <path d="M146 476l2.6 8 8 2.6-8 2.6-2.6 8-2.6-8-8-2.6 8-2.6z"/>
    </g>
    <g transform="translate(884 266) rotate(-17)">
      <ellipse rx="232" ry="62" fill="none" stroke="#B9A6F2" stroke-width="18" opacity=".26"/>
      <circle r="126" fill="url(#planet)"/>
      <path d="M-126-34a126 126 0 0 0 252 0" fill="#FFE0B0" opacity=".18"/>
      <path d="M-118 26a126 126 0 0 0 236 0" fill="#2A1A4F" opacity=".18"/>
      <ellipse rx="232" ry="62" fill="none" stroke="#E8DEFF" stroke-width="4" opacity=".55"/>
    </g>
    <circle cx="212" cy="178" r="42" fill="#D9E4FF" opacity=".9"/>
    <g fill="#AEBEDF" opacity=".55">
      <circle cx="200" cy="166" r="8"/><circle cx="228" cy="188" r="5"/>
      <circle cx="198" cy="196" r="4"/>
    </g>
    <path d="M430 84l92 42-92-8z" fill="#C9F2FF" opacity=".35"/>
    <path d="M522 126l-38 2 46-12z" fill="#FFFFFF" opacity=".8"/>
    <path d="M0 636q260-58 520-8t680-22v69H0z" fill="#050818" opacity=".8"/>
  `,

  sakura: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFE5EF"/>
        <stop offset=".52" stop-color="#FFC2D8"/>
        <stop offset="1" stop-color="#F496B9"/>
      </linearGradient>
      <radialGradient id="sun">
        <stop offset="0" stop-color="#FFF8D8" stop-opacity=".95"/>
        <stop offset="1" stop-color="#FFEFC0" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="fuji" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8494BC"/>
        <stop offset="1" stop-color="#5E6F9C"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <circle cx="952" cy="166" r="176" fill="url(#sun)"/>
    <circle cx="952" cy="166" r="52" fill="#FFF7DE"/>
    ${cloud(252, 150, 0.9, 0.72, '#FFF4F8')}
    ${cloud(722, 108, 0.56, 0.55, '#FFEAF3')}
    ${cloud(1072, 268, 0.7, 0.4, '#FFE2EE')}
    <path d="M336 568 646 244l310 324z" fill="url(#fuji)"/>
    <path d="M646 244 704 312 674 338 646 318 618 342 586 310z" fill="#F7F9FF"/>
    <path d="M250 590q180-92 396-54t304 0v139H0V610q126-54 250-20z" fill="#EFA9C2"/>
    <path d="M0 622q230-58 470 2t430-8 300 4v55H0z" fill="#D986A8"/>
    <g fill="#B23B58">
      <rect x="154" y="420" width="18" height="158" rx="4"/>
      <rect x="292" y="420" width="18" height="158" rx="4"/>
      <rect x="124" y="398" width="216" height="18" rx="5"/>
      <path d="M100 388h264l-18 20H118z"/>
      <rect x="172" y="442" width="120" height="12" rx="4"/>
    </g>
    <g fill="none" stroke="#6E3B4A" stroke-width="9" stroke-linecap="round">
      <path d="M-20 54q154 10 238 92"/>
      <path d="M1220 84q-154 8-224 84"/>
      <path d="M92 34q56 46 84 100"/>
    </g>
    ${blossom(204, 146, 1.5, '#FFD5E4', '#E58AA8')}
    ${blossom(266, 210, 1.2, '#FFE1EC', '#E58AA8')}
    ${blossom(150, 232, 1.1, '#FFC9DD', '#D9789A')}
    ${blossom(1004, 178, 1.4, '#FFD5E4', '#E58AA8')}
    ${blossom(944, 244, 1.1, '#FFE1EC', '#D9789A')}
    ${blossom(1064, 276, 1.2, '#FFC9DD', '#E58AA8')}
    <g fill="#FFD5E4">
      <ellipse cx="360" cy="184" rx="7" ry="4" transform="rotate(-24 360 184)"/>
      <ellipse cx="430" cy="270" rx="6" ry="3.5" transform="rotate(18 430 270)"/>
      <ellipse cx="792" cy="202" rx="7" ry="4" transform="rotate(-12 792 202)"/>
      <ellipse cx="708" cy="332" rx="5" ry="3" transform="rotate(30 708 332)"/>
      <ellipse cx="1108" cy="360" rx="6" ry="3.5" transform="rotate(-18 1108 360)"/>
      <ellipse cx="228" cy="354" rx="5" ry="3" transform="rotate(12 228 354)"/>
    </g>
  `,

  ocean: `
    <defs>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0B6480"/>
        <stop offset=".48" stop-color="#0B4766"/>
        <stop offset="1" stop-color="#032234"/>
      </linearGradient>
      <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#C8F7FF" stop-opacity=".4"/>
        <stop offset="1" stop-color="#C8F7FF" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#water)"/>
    <g fill="url(#ray)">
      <path d="M420 0h78L392 675h-54z"/>
      <path d="M600 0h52L500 675h-38z"/>
      <path d="M760 0h64L864 675h-48z"/>
    </g>
    <g fill="none" stroke="#BDF3FF" stroke-width="3" opacity=".34">
      <circle cx="196" cy="174" r="12"/><circle cx="232" cy="126" r="6"/>
      <circle cx="264" cy="196" r="4"/><circle cx="1022" cy="146" r="9"/>
      <circle cx="1064" cy="206" r="5"/><circle cx="984" cy="242" r="3.4"/>
      <circle cx="764" cy="94" r="5"/><circle cx="708" cy="150" r="3"/>
    </g>
    <g fill="#0A2C3F" opacity=".62">
      <g transform="translate(824 216)">
        <path d="M0 0c26-20 70-18 92 2-24 22-66 24-92 8z"/>
        <path d="M-16 8l-26-18v34z"/>
      </g>
      <g transform="translate(160 302) scale(.72)">
        <path d="M0 0c26-20 70-18 92 2-24 22-66 24-92 8z"/>
        <path d="M-16 8l-26-18v34z"/>
      </g>
      <g transform="translate(1000 372) scale(.56)">
        <path d="M0 0c26-20 70-18 92 2-24 22-66 24-92 8z"/>
        <path d="M-16 8l-26-18v34z"/>
      </g>
    </g>
    <g fill="#E37C8E">
      <path d="M96 675q-4-80 24-128 6 44 22 62 2-56 34-92 6 62 30 86 12-34 40-42-10 52 16 114z"/>
      <path d="M806 675q-2-66 22-102 8 36 24 54 2-46 30-74 8 50 26 68 10-24 32-30-8 46 14 84z" opacity=".9"/>
      <path d="M420 675q-4-44 14-70 6 24 16 34 2-30 18-48 4 34 16 46 8-18 20-22-6 30 10 60z" fill="#F1A0A8"/>
    </g>
    <g fill="none" stroke="#1E7A63" stroke-width="10" stroke-linecap="round">
      <path d="M190 675q-18-68 12-118"/>
      <path d="M216 675q16-54-4-96"/>
      <path d="M726 675q-12-60 14-102"/>
      <path d="M756 675q18-44 2-82"/>
      <path d="M1102 675q-14-56 10-96"/>
    </g>
    <g fill="#C9A36B">
      <path d="M0 606q220-50 470 8t370-10 360 8v63H0z"/>
      <ellipse cx="300" cy="640" rx="54" ry="18" fill="#B58C57"/>
      <ellipse cx="930" cy="656" rx="70" ry="20" fill="#B58C57"/>
    </g>
    <g fill="#8DE1F0" opacity=".7">
      <circle cx="350" cy="220" r="4"/><circle cx="374" cy="192" r="2.4"/>
      <circle cx="404" cy="236" r="3"/><circle cx="930" cy="336" r="3.4"/>
      <circle cx="956" cy="306" r="2.2"/><circle cx="602" cy="266" r="2.6"/>
    </g>
  `,

  aurora: `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#03081A"/>
        <stop offset=".55" stop-color="#092241"/>
        <stop offset="1" stop-color="#0F3A56"/>
      </linearGradient>
      <linearGradient id="auroraA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8CFFD2" stop-opacity="0"/>
        <stop offset=".28" stop-color="#7CF7C4" stop-opacity=".85"/>
        <stop offset=".62" stop-color="#4DB8FF" stop-opacity=".45"/>
        <stop offset="1" stop-color="#4DB8FF" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="auroraB" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#D78CFF" stop-opacity="0"/>
        <stop offset=".35" stop-color="#C07CFF" stop-opacity=".55"/>
        <stop offset=".7" stop-color="#63E6FF" stop-opacity=".35"/>
        <stop offset="1" stop-color="#63E6FF" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F4FBFF"/>
        <stop offset="1" stop-color="#A7CFE9"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#sky)"/>
    <g fill="#EAF6FF">
      <circle cx="70" cy="58" r="2"/><circle cx="132" cy="142" r="1.3"/>
      <circle cx="196" cy="80" r="1.7"/><circle cx="258" cy="188" r="1.1"/>
      <circle cx="322" cy="52" r="2.2"/><circle cx="388" cy="128" r="1.4"/>
      <circle cx="452" cy="98" r="1.8"/><circle cx="516" cy="214" r="1.2"/>
      <circle cx="584" cy="66" r="2"/><circle cx="648" cy="156" r="1.3"/>
      <circle cx="712" cy="104" r="1.7"/><circle cx="780" cy="42" r="2.3"/>
      <circle cx="846" cy="168" r="1.2"/><circle cx="912" cy="96" r="1.8"/>
      <circle cx="978" cy="214" r="1.4"/><circle cx="1046" cy="62" r="2.1"/>
      <circle cx="1112" cy="146" r="1.5"/><circle cx="1166" cy="88" r="1.8"/>
      <circle cx="104" cy="330" r="1.4"/><circle cx="184" cy="402" r="1.1"/>
      <circle cx="284" cy="352" r="1.6"/><circle cx="372" cy="458" r="1.2"/>
      <circle cx="462" cy="384" r="1.4"/><circle cx="556" cy="470" r="1.1"/>
      <circle cx="668" cy="398" r="1.5"/><circle cx="762" cy="486" r="1.2"/>
      <circle cx="874" cy="402" r="1.4"/><circle cx="986" cy="476" r="1.1"/>
      <circle cx="1094" cy="386" r="1.6"/><circle cx="1160" cy="466" r="1.2"/>
    </g>
    <g fill="none" stroke-linecap="round">
      <path d="M-40 190C150 70 262 260 430 118S742 30 920 168s202 20 320-36" stroke="url(#auroraA)" stroke-width="66" opacity=".55"/>
      <path d="M-20 238C176 128 292 302 464 168S772 92 952 218s180 30 288-22" stroke="url(#auroraA)" stroke-width="30" opacity=".8"/>
      <path d="M120 58C270 160 372 24 520 112s248 16 380-52" stroke="url(#auroraB)" stroke-width="44" opacity=".4"/>
      <path d="M240 314C386 216 492 356 638 256s258-36 414 40" stroke="url(#auroraB)" stroke-width="18" opacity=".5"/>
    </g>
    <circle cx="984" cy="104" r="40" fill="#F1F7FF" opacity=".92"/>
    <circle cx="970" cy="94" r="39" fill="#07162C" opacity=".9"/>
    <g>
      <path d="M0 536 186 322 302 442 452 292 626 536Z" fill="#0A1930"/>
      <path d="M520 562 744 300 884 436 1032 318 1200 562Z" fill="#0B1D36"/>
      <path d="M186 322 244 388 210 402 186 374 160 398 132 380Z" fill="url(#snow)"/>
      <path d="M744 300 800 366 768 380 744 352 720 378 694 358Z" fill="url(#snow)"/>
      <path d="M1032 318 1082 374 1054 386 1032 362 1010 386 986 368Z" fill="url(#snow)"/>
    </g>
    <path d="M0 548q240-56 470 6t430-8 300 10v119H0z" fill="#07182C"/>
    <g fill="#04101F">
      <path d="M76 610q6-66 16-96 6 34 5 96z"/>
      <path d="M76 548l-42-30 38 10 14-34 8 40 36-22-30 38z"/>
      <path d="M176 620q5-56 14-82 5 30 4 82z"/>
      <path d="M176 566l-34-24 30 8 12-28 6 32 30-18-24 32z"/>
      <path d="M1064 610q6-64 15-92 6 32 5 92z"/>
      <path d="M1064 550l-38-28 34 10 12-32 8 36 34-20-28 34z"/>
    </g>
    <path d="M0 624q280-40 600 4t600-6v53H0z" fill="#0D2C44"/>
    <g opacity=".28" fill="none" stroke="#7CF7C4" stroke-width="10" stroke-linecap="round">
      <path d="M280 648q120-18 240 0t240-2"/>
      <path d="M620 666q140-14 280 0"/>
    </g>
  `,
}

export const SCENIC_ART: Record<ScenicScene, string> = {
  plain: svg(SCENES.plain),
  slate: svg(SCENES.slate),
  sky: svg(SCENES.sky),
  sunset: svg(SCENES.sunset),
  forest: svg(SCENES.forest),
  royal: svg(SCENES.royal),
  desert: svg(SCENES.desert),
  space: svg(SCENES.space),
  sakura: svg(SCENES.sakura),
  ocean: svg(SCENES.ocean),
  aurora: svg(SCENES.aurora),
}

/**
 * Full plate background: scenery plus a dark scrim so the profile text keeps
 * its contrast over busy parts of the illustration.
 */
export function plateScene(scene: ScenicScene, scrim: string, art?: string): string {
  return `linear-gradient(${scrim}, ${scrim}), ${art ?? SCENIC_ART[scene]} center / cover no-repeat`
}
