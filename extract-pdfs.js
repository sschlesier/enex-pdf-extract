const fs = require("fs");
const path = require("path");
const sax = require("sax");

//run this on many enex files using a command like
//parallel node extract-pdfs.js {} ::: $DESKTOP/export/done/*.enex

const pathToEnex = process.argv[2];

const notebookPath = path.join("out", path.basename(pathToEnex, ".enex"));
fs.mkdirSync(notebookPath, { recursive: true });

console.log(notebookPath);

const textStream = fs.createReadStream(pathToEnex);
const parser = sax.createStream(true, { trim: true });

var note = {};
var currentElement = null;
var elementStack = [];
var currentText = "";

parser.on("opentag", (node) => {
  elementStack.push(node.name);
  currentElement = node.name;
  currentText = "";

  if (node.name === "note") {
    note = {};
  }
});

parser.on("text", (text) => {
  currentText += text;
});

parser.on("closetag", (tagName) => {
  if (tagName === "note") {
    if (note.mime === "application/pdf") {
      const buffer = Buffer.from(note.data, "base64");
      const outputPath = makeOutputPath(buffer.length);

      if (outputPath === null) {
        // File already exists with matching size, skip
        note = {};
        return;
      }

      console.log("dumping " + outputPath);
      fs.writeFile(outputPath, buffer, function (err) {});
    }
    note = {};
  } else if (tagName === "title") {
    note.title = currentText;
  } else if (tagName === "data") {
    note.data = currentText;
  } else if (tagName === "file-name") {
    if (currentText) {
      note.fileName = currentText;
    } else {
      note.fileName = note.title + ".pdf";
    }
  } else if (tagName === "mime") {
    note.mime = currentText;
  }

  elementStack.pop();
  currentElement = elementStack.length > 0 ? elementStack[elementStack.length - 1] : null;
  currentText = "";
});

textStream.pipe(parser);

function makeOutputPath(bufferSize) {
  var ext = path.extname(note.fileName);
  if (!ext) {
    // console.log("adding pdf to " + note.fileName);
    ext = ".pdf";
  }
  const name = path.basename(note.fileName, ext);

  var result = path.join(notebookPath, name + ext);

  // Check if base path exists with matching size
  if (fs.existsSync(result)) {
    const stats = fs.statSync(result);
    if (stats.size === bufferSize) {
      console.log("skipping " + result + " (already exists with matching size)");
      return null;
    }
    // Base path exists but size doesn't match, need to find alternative
    var cnt = 1;
    result = path.join(notebookPath, name + " (" + cnt + ")" + ext);
    while (fs.existsSync(result)) {
      // Check if this conflicted path has matching size
      const stats = fs.statSync(result);
      if (stats.size === bufferSize) {
        console.log("skipping " + result + " (already exists with matching size)");
        return null;
      }
      // console.log("*** deconflicting file ***");
      cnt++;
      result = path.join(notebookPath, name + " (" + cnt + ")" + ext);
    }
  }

  return result;
}
