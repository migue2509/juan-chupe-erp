const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_HEAT_JS = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'

let leafletReady = null
let heatReady = null

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(script => script.src === src)
    if (existing?.dataset.loaded === 'true') {
      resolve()
      return
    }
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(script)
  })
}

export async function loadLeaflet({ heat = false } = {}) {
  loadStylesheet(LEAFLET_CSS)

  if (!leafletReady) {
    leafletReady = window.L
      ? Promise.resolve(window.L)
      : loadScript(LEAFLET_JS).then(() => window.L)
  }

  const L = await leafletReady
  if (!L) throw new Error('Leaflet no disponible')

  if (heat && !L.heatLayer) {
    if (!heatReady) {
      heatReady = loadScript(LEAFLET_HEAT_JS).catch((error) => {
        console.warn('Leaflet.heat no disponible, se mostraran solo marcadores.', error)
        return null
      })
    }
    await heatReady
  }

  return window.L
}
