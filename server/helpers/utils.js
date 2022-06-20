
const {resolve} = require("path");
const {readdir} = require("fs").promises;

async function* getFiles(dir) {
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = resolve(dir, file.name);
      if (file.isDirectory()) {
        yield* getFiles(filePath);
      } else {
        yield filePath;
      }
    }
  }

module.exports.getFiles = getFiles;