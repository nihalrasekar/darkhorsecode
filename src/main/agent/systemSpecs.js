import os from 'os'
import { execSync } from 'child_process'

let cached = null

function detectGpu() {
  // NVIDIA's own tool gives an accurate VRAM figure when present.
  try {
    const out = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', {
      timeout: 3000
    })
      .toString()
      .trim()
    const [name, vramMB] = out.split('\n')[0].split(',').map((s) => s.trim())
    if (name && vramMB) return { name, vramGB: Math.round(Number(vramMB) / 1024) }
  } catch {}

  // Fall back to WMIC on Windows — AdapterRAM is sometimes wrong/capped on
  // older 32-bit drivers, but it's the best signal available without nvidia-smi.
  if (process.platform === 'win32') {
    try {
      const out = execSync('wmic path win32_VideoController get Name,AdapterRAM /format:csv', {
        timeout: 3000
      })
        .toString()
        .trim()
      const lines = out.split('\n').map((l) => l.trim()).filter(Boolean)
      const header = lines[0].split(',')
      const ramIdx = header.indexOf('AdapterRAM')
      const nameIdx = header.indexOf('Name')
      let best = null
      for (const line of lines.slice(1)) {
        const cols = line.split(',')
        const ram = Number(cols[ramIdx])
        if (ram > 0 && (!best || ram > best.vramBytes)) {
          best = { name: cols[nameIdx], vramBytes: ram }
        }
      }
      if (best) return { name: best.name, vramGB: Math.round(best.vramBytes / 1024 ** 3) }
    } catch {}
  }
  return null
}

export function getSystemSpecs() {
  if (cached) return cached
  const ramGB = Math.round(os.totalmem() / 1024 ** 3)
  const gpu = detectGpu()
  // Rough Q4-quantization rule of thumb: ~1GB of VRAM per 1B params, minus a
  // little headroom for context/OS overhead. Without a dedicated GPU, models
  // still run on CPU via RAM — much slower, so budget only half of it.
  const maxModelB = gpu?.vramGB ? Math.max(1, gpu.vramGB - 1) : Math.max(1, Math.floor(ramGB * 0.5))
  cached = { ramGB, gpu, maxModelB }
  return cached
}
