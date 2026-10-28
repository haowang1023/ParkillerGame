// Reported directly, again, with a screenshot: "Sigue sin cargar los tableros al abrir" - board art,
// track squares *and* the dice's canvas-drawn pips all blank on the client's own machine, while the
// same build renders fine everywhere it can be tested (2-6p, Chromium and WebKit, forced WebGL
// context loss with and without restore). Blank canvas-drawn textures rule out the network, so the
// cause lives in that machine's own browser/GPU - which can only be read from that machine. This
// collects what's needed into a plain-text report the player can copy and send. Deliberately free
// of three.js (the scene layer reports into it instead), so it stays in the small main bundle.

const MAX_EVENTS = 40
const events: string[] = []
const textureStatus = new Map<string, string>()
let errorListenersInstalled = false

export function recordDiagnosticEvent(text: string): void {
  events.push(`${new Date().toISOString().slice(11, 19)} ${text}`)
  if (events.length > MAX_EVENTS) events.shift()
}

export function recordTextureStatus(url: string, status: string): void {
  textureStatus.set(url, status)
}

export function textureStatusOf(url: string): string | undefined {
  return textureStatus.get(url)
}

export function installErrorListeners(): void {
  if (errorListenersInstalled) return
  errorListenersInstalled = true
  window.addEventListener('error', (e) => recordDiagnosticEvent(`error: ${e.message}`))
  window.addEventListener('unhandledrejection', (e) => recordDiagnosticEvent(`unhandled: ${String(e.reason).slice(0, 160)}`))
}

export interface WebGLProbe {
  supported: boolean
  version?: string
  vendor?: string
  renderer?: string
  maxTextureSize?: number
  // Whether a texture uploaded to the GPU actually reads back with its real color - the exact
  // thing that fails when board art and dice pips both come out blank.
  textureUploadWorks?: boolean
  canvasReadbackWorks?: boolean
}

// Draws a 2x2 red canvas, uploads it as a texture, renders it into a framebuffer and reads one
// pixel back. A fresh, throwaway context, released straight after so it never competes with the
// game's own.
export function probeWebGL(): WebGLProbe {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const gl = canvas.getContext('webgl2')
  if (!gl) return { supported: false }
  const result: WebGLProbe = { supported: true, version: gl.getParameter(gl.VERSION) as string }
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  result.vendor = String(gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR))
  result.renderer = String(gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number

  const source = document.createElement('canvas')
  source.width = 2
  source.height = 2
  const ctx = source.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 2, 2)
    const px = ctx.getImageData(0, 0, 1, 1).data
    result.canvasReadbackWorks = px[0] > 200 && px[1] < 50 && px[2] < 50
  }

  try {
    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, src)
      gl.compileShader(shader)
      return shader
    }
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;out vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}'))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision mediump float;in vec2 uv;uniform sampler2D t;out vec4 c;void main(){c=texture(t,uv);}'))
    gl.linkProgram(program)
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.viewport(0, 0, 2, 2)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const pixel = new Uint8Array(4)
    gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    result.textureUploadWorks = pixel[0] > 200 && pixel[1] < 50 && pixel[2] < 50
  } catch {
    result.textureUploadWorks = false
  }
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return result
}

export function buildDiagnosticReport(boardImage?: string): string {
  const probe = probeWebGL()
  const lines = [
    `Parkiller - informe técnico ${new Date().toISOString()}`,
    `Navegador: ${navigator.userAgent}`,
    `Pantalla: ${window.screen.width}x${window.screen.height} @${window.devicePixelRatio}x, ventana ${window.innerWidth}x${window.innerHeight}`,
    `Conexión: ${navigator.onLine ? 'en línea' : 'sin conexión'}; service worker: ${navigator.serviceWorker?.controller ? 'activo' : 'no'}`,
    `WebGL2: ${probe.supported ? `sí (${probe.version})` : 'NO'}`,
  ]
  if (probe.supported) {
    lines.push(`GPU: ${probe.vendor} / ${probe.renderer}`)
    lines.push(`Textura máxima: ${probe.maxTextureSize}`)
    lines.push(`Prueba de textura en GPU: ${probe.textureUploadWorks ? 'OK' : 'FALLA'}`)
    lines.push(`Lectura de canvas: ${probe.canvasReadbackWorks ? 'OK' : 'FALLA'}`)
  }
  if (boardImage) lines.push(`Imagen del tablero (${boardImage}): ${textureStatus.get(boardImage) ?? 'sin intentos todavía'}`)
  for (const [url, status] of textureStatus) if (url !== boardImage) lines.push(`${url}: ${status}`)
  lines.push('Eventos recientes:')
  lines.push(...(events.length > 0 ? events.map((e) => `  ${e}`) : ['  (ninguno)']))
  return lines.join('\n')
}
