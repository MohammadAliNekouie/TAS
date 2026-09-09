const buffer = [];

function push(message) {
  buffer.unshift({ message: String(message), time: new Date().toISOString() });
  if (buffer.length > 20) buffer.length = 20;
}

function recent(n = 3) {
  return buffer.slice(0, n);
}

module.exports = { push, recent };
