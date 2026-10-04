// Renders model views and pastes them next to reference images.
// SHOTS='[["out.png","az=-0.6&el=0.1&d=3.85","ref.png"]]' node tools/preview/shoot.cjs
const { chromium } = require('playwright')
;(async () => {
  const shots = JSON.parse(process.env.SHOTS)
  const base = process.env.BASE ?? 'http://localhost:5199/tools/preview/'
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage({ viewport: { width: 960, height: 540 } })
  p.on('pageerror', (e) => console.log('pageerror', String(e)))
  for (const [out, qs] of shots) {
    await p.goto(`${base}?${qs}`)
    await p.waitForTimeout(6000)
    await p.screenshot({ path: out })
  }
  await b.close()
})()
