// Loads the browser modules into Node so the pure logic can be unit tested without a browser.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
module.exports = function load(files) {
  files.forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../../src', f), 'utf8'), { filename: f }));
  return global.AvatarKit;
};
