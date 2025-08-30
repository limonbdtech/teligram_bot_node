function log(type, msg) {
  const time = new Date().toISOString();
  console.log(`[${time}] [${type}] ${msg}`);
}

module.exports = {
  info: (msg) => log("INFO", msg),
  warn: (msg) => log("WARN", msg),
  error: (msg) => log("ERROR", msg),
};