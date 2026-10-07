> 과거 작업 기록입니다. 현재 구현은 [현행 사양](../spec.md), 재개 절차는 [작업 인계](../handoff.md)를 확인하세요.

# 생성 이미지 디자인

현행 디자인과 에셋·정확한 생성 프롬프트는 [길드 디자인](design-history.md)에 기록한다.
아래는 앞선 두 디자인 단계의 제작 이력이다. 현행 UI는 전체 생성 시안과 여섯 생성 로고를 사용한다.

2026-10-06, 내장 `image_gen`으로 장소 삽화와 메뉴 아이콘을 제작했다. API/외부 다운로드는 사용하지 않았다.
모바일 가독성 개선에서 새 아이콘 atlas를 다시 생성했으며, 화면의 문구와 타이틀은 모두 HTML 텍스트다.
이미지는 장식이며 클릭 좌표를 결정하지 않는다.

## 현재 저장과 적용

배포 파일은 `images/theme/`, 테마는 `styles/fantasy-theme.css`다. PNG 생성 원본은 도구 출력 디렉터리에 보존했다.
Pillow로 비율을 유지해 축소하고 WebP quality 85로 저장했다. 아이콘의 실제 알파 채널을 유지했다.
현재 총 5개, 1,220,398 bytes다. 기존 8개/2,100,644 bytes 구성에서 약 42% 줄었다.

| 파일                | 크기           |  bytes | 적용                          |
| ------------------- | -------------- | -----: | ----------------------------- |
| academy.webp        | 960×1440       | 309212 | 메인 배경, 채도·불투명도 축소 |
| library.webp        | 1200×800       | 257530 | 연습 배경, 어두운 오버레이    |
| courtyard.webp      | 1200×800       | 265076 | 배틀 배경, 어두운 오버레이    |
| dragon-tower.webp   | 1200×800       | 260422 | 전체 단어 도전 배경           |
| mobile-emblems.webp | 1024×512, RGBA | 128158 | 간결한 4×2 모바일 메뉴 아이콘 |

타이틀은 HTML h1과 작은 RPG 표기로 구성한다. 시작·학습에서 제목으로 돌아올 때 여섯 순열 중 하나를 고르며
직전 제목은 반복하지 않는다. 화면 제목과 브라우저 document.title을 함께 바꾼다.
메인은 큰 연습 버튼, 두 보조 모드, 하단 게임 메뉴로 배치한다. 메뉴 창은 작은 아이콘·단순한 헤더와 본문·닫기 버튼을 사용한다.
기존 화려한 로고·아이콘·프레임·상점 삽화 4개는 배포 폴더에서 삭제했다. 생성 원본과 아래 프롬프트는 보존했다.
atlas의 CSS background-position은 장식 아이콘을 고르는 용도이며 실제 조작은 native button과 Grid/Flex를 사용한다.
창은 native dialog/top layer를 유지한다. 기존 캐릭터·몬스터를 사용한다.

## 생성 프롬프트

1~8은 최초 제작 프롬프트다. 5~8은 현재 배포하지 않는다. 9는 모바일 아이콘 재제작 프롬프트다.
6·8·9는 `transparent_background: true`, 나머지는 false다.

### 1. academy.webp

Use case: stylized-concept. Asset type: production background illustration for a Korean fantasy vocabulary RPG, portrait 2:3 composition. Create a lavish hand-painted fantasy game key art: an enchanted academy castle floating above a luminous teal lake, a winding path, luminous ancient books and golden magical glyphs without legible writing, a friendly small cloaked young adventurer seen from behind at the lower left looking toward the castle. Rich painterly detail, charming premium JRPG storybook aesthetic, deep midnight indigo and turquoise with warm antique gold light. Composition for a mobile game's main menu: castle and magical sky concentrated in the upper half, a visually quiet atmospheric dark blue foreground in the bottom half behind HTML buttons, darker corners, elegant depth and atmospheric mist. This is artwork only, not a screenshot: absolutely no text, no logos, no UI, no buttons, no borders, no watermark. Full-bleed high-quality illustration with crisp readable silhouettes.

### 2. library.webp

Create one production fantasy RPG illustration asset, a wide 3:2 landscape panoramic view of an enchanted academy library. Premium hand-painted JRPG storybook key-art style, matching deep midnight indigo, luminous teal and antique gold. At left an open magical book on a carved oak reading desk, floating golden light and tiny stars, bookcases with gilded ancient tomes receding through pointed arch windows, warm hanging lanterns. Right side quieter and darker with elegant deep blue atmosphere, suitable beneath readable HTML UI. High-quality rich environmental painting, crisp painterly detail. No characters necessary, no text, no writing, no logo, no UI, no buttons, no watermark. Full bleed.

### 3. courtyard.webp

Create one production fantasy RPG illustration asset, wide 3:2 landscape panoramic view of an ancient enchanted dueling courtyard at twilight. Premium hand-painted JRPG storybook key-art style in deep midnight indigo, luminous teal and antique gold with subtle crimson sparks. At left a beautifully engraved sword embedded in a stone altar, magical blue runes with no legible lettering, soaring stone archways, mountains and a moonlit castle in the distance. Plenty of open flat floor for character sprites in the middle, darker calmer space on the right for overlaid HTML UI. Rich painterly game environment detail, exciting and adventurous, age-friendly, no violence. Absolutely no text, logo, UI, buttons, border, or watermark.

### 4. dragon-tower.webp

Use case: stylized-concept. Production fantasy RPG illustration asset. Wide 3:2 landscape. A majestic sapphire dragon guards an ancient magical gateway atop a castle tower under a violet starry sky. The dragon is on the LEFT side, curved wings and clear elegant silhouette, impressive but friendly enough for a middle-school vocabulary learning game, no scary gore. Portal shines violet and antique gold, floating stone steps and tiny magical stars, misty distant castle architecture on the RIGHT with quieter shadowed atmosphere suitable beneath HTML UI. Premium highly detailed hand-painted JRPG storybook art. Palette deep midnight indigo, violet, antique gold with teal jewel accents. Full bleed, no written words, no logos, no UI, no buttons, no watermark.

### 5. workshop.webp

Use case: stylized-concept. Production fantasy RPG menu illustration. Wide 3:2 landscape composition. A cozy enchanted merchant and equipment workshop inside an academy castle, carved oak counters, open ornate treasure chest with gold coins, a polished silver-and-gold shield and beautifully crafted adventurer gear hanging at left, glass potion bottles with teal glow, warm amber lanterns, blue velvet and gilded carved decorations. Upper left has the rich main objects, right side shows quieter dark shelves and an arched window to a moonlit city. No people. Premium hand-painted JRPG storybook aesthetic matching midnight indigo, teal and antique gold. This will decorate shop, inventory and settings screens beneath HTML controls. Full-bleed environmental painting only. No text, written labels, logos, UI, buttons or watermark.

### 6. menu-emblems.webp

Use case: stylized-concept. Asset type: ONE transparent fantasy RPG menu icon atlas. Create an exactly uniform 4-column by 2-row grid on a wide 2:1 canvas, 2048 by 1024 pixels, containing eight separate centered hand-painted game emblems. All eight cells exactly equal size, generous equal padding, each emblem fits entirely within its cell, no overlaps. Reading order: row 1 column 1 open magical blue book with gold sparkles; row 1 column 2 crossed silver swords with blue sapphire; row 1 column 3 elegant sapphire dragon head; row 1 column 4 open gold treasure chest. Row 2 column 1 silver and gold shield with blue gem; row 2 column 2 golden laurel trophy with a star; row 2 column 3 antique brass gear and teal magical crystal; row 2 column 4 feather quill and rolled parchment. Cohesive luxurious painted JRPG storybook style, midnight blue, antique gold, teal jewel accents, crisp recognizable compact silhouettes, subtle soft glow contained within each cell. Real transparent background and transparent gaps, NOT checkerboard, no solid backdrop, no text, no labels, no cell borders, no UI button plates, no watermark.

### 7. panel.webp

Use case: stylized-concept. Asset type: a reusable ornamental background skin for fantasy RPG menu panels. Portrait 2:3 image. Front-facing perfectly rectangular deep midnight blue leather and velvet panel with a subtle quiet fine fabric texture across its entire center. Slim richly sculpted antique gold brass edging, elegant engraved corner flourishes, small teal gemstones exactly at the four corners, fine restrained gilded celestial ornament along the outside edges. Luxury hand-painted JRPG fantasy inventory / story dialog material, straight orthographic view, crisp detailed edges. Keep 85 percent of the interior VERY dark, uniform and visually calm to support white HTML text, no central subjects or ornaments. The edge decoration must be slim and continuous, not big scrolls protruding into content. Completely rectangular full bleed image, NO text, no symbols resembling writing, no logo, no buttons, no watermark. This is only a background texture and decorative edge, not a rendered UI screenshot.

### 8. title-crest.webp

Use case: logo-brand, raster fantasy game title artwork. Create a premium hand-painted JRPG title crest on a truly transparent background. Wide 3:2 canvas with generous transparent margins. The exact Korean title must read "킹왕짱" in three bold beautifully readable gold sculpted letters across the top, and the exact English letters "RPG" below in slightly smaller luminous silver-teal lettering. Korean characters in order: 킹, 왕, 짱. Do NOT substitute or reverse letters. Combine readable typography with a delicate antique gold celestial crest, a small sapphire crystal and an open book behind the lower title; restrained wisps of teal magic and gold sparks. Deep blue enamel shadows, warm metallic highlights, sophisticated fantasy academy aesthetic that matches midnight blue, turquoise and gold painted game art. Text stays the dominant subject, logo fits completely inside the canvas, no solid plate or background behind it. Only the two text lines "킹왕짱" and "RPG". No slogans, no extra text, no watermark. Preserve actual background alpha, not a checkerboard.

### 9. mobile-emblems.webp

Use case: style-transfer. Edit target: existing fantasy RPG menu icon atlas. Redesign all eight icons for a readable MOBILE GAME UI. Preserve exact 4-column by 2-row equal-cell grid, wide 2:1 canvas, and reading-order identities: open book, crossed swords, blue dragon head, treasure chest; shield, trophy, gear, quill parchment. Replace ornate painterly microdetail with clean chunky 3D cartoon mobile-RPG inventory icons: broad smooth shapes, bold clear silhouettes, restrained navy/teal/warm muted gold, soft simple shading, slight dark contour. Each icon recognizable at 32 pixels. Remove ALL filigree, sparks, particles, magical wisps, elaborate jewels, surrounding glow, busy textures, and laurel branches. Each icon occupies at most 70 percent of its equal cell with consistent centered size and generous transparent gaps. One clearly legible object per cell (crossed swords allowed pair; quill with paper allowed). Gear a plain brass cog; trophy simple gold cup; shield simple blue shield with gold rim. NO words, lettering, labels, backgrounds, frames, UI button plates, watermark or checkerboard. Keep actual transparent alpha throughout background. Deliver one atlas only.
