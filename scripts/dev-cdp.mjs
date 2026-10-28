/* Dev-only CDP helper: evaluate expressions and capture screenshots from the running app. */
import fs from 'node:fs'

const [, , command, ...args] = process.argv

const port = process.env.CDP_PORT || '9222'
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const target = targets.find((entry) => entry.type === 'page')
if (!target) throw new Error('No page target found')

const ws = new WebSocket(target.webSocketDebuggerUrl)
let nextId = 1
const pending = new Map()

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  }
})

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

function send(method, params = {}) {
  const id = nextId++
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  })
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails
    throw new Error(detail.exception?.description || detail.text)
  }
  return result.result?.value
}

async function screenshot(file) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  return file
}

try {
  if (command === 'eval') {
    const expression = args.join(' ')
    console.log(JSON.stringify(await evaluate(expression), null, 2))
  } else if (command === 'shot') {
    const file = args[0] || 'screenshot.png'
    console.log(await screenshot(file))
  } else if (command === 'click') {
    const x = Number(args[0])
    const y = Number(args[1])
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    console.log('clicked', x, y)
  } else if (command === 'move') {
    const x = Number(args[0])
    const y = Number(args[1])
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    console.log('moved', x, y)
  } else if (command === 'key') {
    const key = args[0]
    const code = args[1] || key
    const extra = { key, code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 }
    if (args.includes('ctrl')) extra.modifiers = (extra.modifiers ?? 0) | 2
    if (args.includes('shift')) extra.modifiers = (extra.modifiers ?? 0) | 8
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...extra, text: key.length === 1 ? key : undefined })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...extra })
    console.log('key', key)
  } else if (command === 'sequence') {
    const steps = JSON.parse(fs.readFileSync(args[0], 'utf8'))
    for (const step of steps) {
      if (step.mouse) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: step.mouse[0], y: step.mouse[1] })
        console.log(step.name ?? 'mouse', step.mouse.join(','))
      }
      if (step.click) {
        const [x, y] = step.click
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
        console.log(step.name ?? 'click', `${x},${y}`)
      }
      if (step.key) {
        const [key, code = key] = step.key.split(':')
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: 0 })
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: 0 })
        console.log(step.name ?? 'key', key)
      }
      if (step.eval) {
        const value = await evaluate(step.eval)
        if (value !== undefined) console.log(step.name ?? 'eval', JSON.stringify(value))
      }
      if (step.wait) await new Promise((resolve) => setTimeout(resolve, step.wait))
      if (step.shot) console.log('shot', await screenshot(step.shot))
    }
  } else {
    throw new Error('Usage: node scripts/dev-cdp.mjs eval <expression> | shot <file> | sequence <json>')
  }
} finally {
  ws.close()
}
