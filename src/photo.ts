import type { ElementInfo } from './data/elements'

interface PhotoInfo {
  name: string
  brawler: string
  gPower: number
  element: ElementInfo
}

/** Adds a title card to a raw scene capture and downloads it as a PNG. */
export async function savePhoto(sceneUrl: string, info: PhotoInfo) {
  const img = new Image()
  img.src = sceneUrl
  await img.decode()

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const g = canvas.getContext('2d')!
  const s = canvas.height / 900
  g.drawImage(img, 0, 0)

  const fade = g.createLinearGradient(0, canvas.height * 0.6, 0, canvas.height)
  fade.addColorStop(0, 'rgba(5,6,10,0)')
  fade.addColorStop(1, 'rgba(5,6,10,0.9)')
  g.fillStyle = fade
  g.fillRect(0, 0, canvas.width, canvas.height)

  const pad = 48 * s
  g.textBaseline = 'alphabetic'
  g.fillStyle = info.element.color
  g.font = `700 ${20 * s}px Orbitron, sans-serif`
  g.fillText(`${info.element.name.toUpperCase()} · ${info.brawler.toUpperCase()}`, pad, canvas.height - pad - 70 * s)
  g.fillStyle = '#ffffff'
  g.font = `900 ${64 * s}px Orbitron, sans-serif`
  g.fillText(info.name.toUpperCase(), pad, canvas.height - pad)

  g.textAlign = 'right'
  g.fillStyle = info.element.color
  g.shadowColor = info.element.color
  g.shadowBlur = 24 * s
  g.font = `900 ${72 * s}px Orbitron, sans-serif`
  g.fillText(`${info.gPower}G`, canvas.width - pad, canvas.height - pad)
  g.shadowBlur = 0
  g.fillStyle = 'rgba(255,255,255,0.45)'
  g.font = `600 ${14 * s}px Orbitron, sans-serif`
  g.fillText('BAKUGAN BRAWL VAULT', canvas.width - pad, pad + 14 * s)

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `${info.name.toLowerCase().replace(/\s+/g, '-')}-${info.gPower}G.png`
  a.click()
}
