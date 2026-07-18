export function formatScore(value, { alwaysSign = true } = {}) {
  const rounded = Math.abs(value) < 0.05 ? 0 : Math.round(value * 10) / 10;
  const magnitude = Number.isInteger(Math.abs(rounded))
    ? Math.abs(rounded).toFixed(0)
    : Math.abs(rounded).toFixed(1);
  if (rounded < 0) return `−${magnitude}`;
  if (rounded > 0 && alwaysSign) return `+${magnitude}`;
  return magnitude;
}

export function formatPercent(probability) {
  const percent = Math.round(probability * 1000) / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

export function formatRange(low, high) {
  return low === high
    ? formatScore(low)
    : `${formatScore(low)} to ${formatScore(high)}`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
