function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const sample = Number(random());
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError('Curiosity randomness must be at least 0 and less than 1');
    }
    const swapIndex = Math.floor(sample * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createCuriosityBag(appIds, { random = Math.random } = {}) {
  if (!Array.isArray(appIds)) throw new TypeError('Curiosity app ids must be an array');
  if (typeof random !== 'function') throw new TypeError('Curiosity randomness must be a function');

  const ids = appIds.map(id => String(id));
  if (new Set(ids).size !== ids.length) throw new Error('Curiosity app ids must be unique');
  let bag = [];

  return Object.freeze({
    next(currentId = null) {
      const candidates = ids.filter(id => id !== currentId);
      if (!candidates.length) return null;

      const candidateIds = new Set(candidates);
      bag = bag.filter(id => candidateIds.has(id));
      if (!bag.length) bag = shuffled(candidates, random);
      return bag.shift() || null;
    }
  });
}
