const BLANK_PATTERN = /_{1,}|＿+|（\s*）|\(\s*\)/g

function countFillBlanks(content) {
  return (String(content || '').match(BLANK_PATTERN) || []).length
}

module.exports = {
  BLANK_PATTERN,
  countFillBlanks
}
