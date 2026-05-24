const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const rootDir = path.resolve(__dirname, '..')
const publicDir = path.join(rootDir, 'public')
const sourceDir = path.join(rootDir, 'assets', 'source-images')

const imageTargets = [
  { source: 'aichat-icon/icon-1.png', output: 'aichat-icon/icon-1.webp', width: 512, quality: 86 },
  { source: 'aichat-icon/icon-2.png', output: 'aichat-icon/icon-2.webp', width: 512, quality: 86 },
  { source: 'aichat-icon/icon-3.png', output: 'aichat-icon/icon-3.webp', width: 512, quality: 86 },
  { source: 'aichat-icon/icon-4.png', output: 'aichat-icon/icon-4.webp', width: 512, quality: 86 },
  { source: 'ai-bot.png', output: 'ai-bot.webp', width: 720, quality: 86 },
  { source: 'dashboard-icons/iocn-1.png', output: 'dashboard-icons/iocn-1.webp', width: 384, quality: 86 },
  { source: 'dashboard-icons/icon-2.png', output: 'dashboard-icons/icon-2.webp', width: 384, quality: 86 },
  { source: 'dashboard-icons/icon-3.png', output: 'dashboard-icons/icon-3.webp', width: 384, quality: 86 },
  { source: 'dashboard-icons/icon-4.png', output: 'dashboard-icons/icon-4.webp', width: 384, quality: 86 },
  { source: 'questionbank-icons/QBicon1.png', output: 'questionbank-icons/QBicon1.webp', width: 256, quality: 86 },
  { source: 'questionbank-icons/QBicon2.png', output: 'questionbank-icons/QBicon2.webp', width: 256, quality: 86 },
  { source: 'questionbank-icons/QBicon3.png', output: 'questionbank-icons/QBicon3.webp', width: 256, quality: 86 },
  { source: 'questionbank-icons/QBicon4.png', output: 'questionbank-icons/QBicon4.webp', width: 256, quality: 86 },
  { source: 'questionbank-icons/QBicon5.png', output: 'questionbank-icons/QBicon5.webp', width: 256, quality: 86 },
  { source: 'questionbank-icons/QBicon6.png', output: 'questionbank-icons/QBicon6.webp', width: 256, quality: 86 },
  { source: 'questionbank-icons/QBicon7.png', output: 'questionbank-icons/QBicon7.webp', width: 256, quality: 86 },
  { source: 'jiexi-icon.png', output: 'jiexi-icon.webp', width: 256, quality: 86 },
  { source: 'cuoti-icon.png', output: 'cuoti-icon.webp', width: 256, quality: 86 },
]

const formatSize = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true })
}

const findSource = (relativePath) => {
  const archived = path.join(sourceDir, relativePath)
  if (fs.existsSync(archived)) return archived

  const currentPublic = path.join(publicDir, relativePath)
  if (fs.existsSync(currentPublic)) return currentPublic

  throw new Error(`找不到源图片：${relativePath}`)
}

async function optimizeSvgFiles() {
  if (!fs.existsSync(sourceDir)) return []

  const { optimize } = await import('svgo')
  const outputs = []
  const stack = [sourceDir]

  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.svg')) continue

      const relative = path.relative(sourceDir, fullPath)
      const output = path.join(publicDir, relative)
      const sourceText = fs.readFileSync(fullPath, 'utf8')
      const result = optimize(sourceText, { path: fullPath })
      ensureDir(path.dirname(output))
      fs.writeFileSync(output, result.data, 'utf8')
      outputs.push({ source: relative, output: relative, before: Buffer.byteLength(sourceText), after: Buffer.byteLength(result.data) })
    }
  }

  return outputs
}

async function optimizeImages() {
  let beforeTotal = 0
  let afterTotal = 0

  for (const target of imageTargets) {
    const sourcePath = findSource(target.source)
    const outputPath = path.join(publicDir, target.output)
    const sourceStat = fs.statSync(sourcePath)

    ensureDir(path.dirname(outputPath))

    await sharp(sourcePath)
      .resize({
        width: target.width,
        height: target.height,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: target.quality,
        effort: 6,
        smartSubsample: true,
      })
      .toFile(outputPath)

    const outputStat = fs.statSync(outputPath)
    beforeTotal += sourceStat.size
    afterTotal += outputStat.size
    console.log(`${target.output}: ${formatSize(sourceStat.size)} -> ${formatSize(outputStat.size)}`)
  }

  const svgOutputs = await optimizeSvgFiles()
  for (const item of svgOutputs) {
    beforeTotal += item.before
    afterTotal += item.after
    console.log(`${item.output}: ${formatSize(item.before)} -> ${formatSize(item.after)}`)
  }

  console.log(`总计: ${formatSize(beforeTotal)} -> ${formatSize(afterTotal)}`)
}

optimizeImages().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
