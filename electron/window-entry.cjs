const path = require('path')

function resolveWindowEntry({ isPackaged, env = process.env, dirname = __dirname }) {
  const devUrl = env.ELECTRON_RENDERER_URL || (env.npm_lifecycle_event === 'electron:dev' ? 'http://localhost:5173' : '')

  if (!isPackaged && devUrl) {
    return {
      type: 'url',
      value: devUrl,
      openDevTools: true,
    }
  }

  return {
    type: 'file',
    value: path.join(dirname, '../dist/index.html'),
    openDevTools: false,
  }
}

module.exports = {
  resolveWindowEntry,
}
