const fs = require("fs");
const path = require("path");
const XmlStream = require("xml-stream");

const pathToEnex = process.argv[2];

const notebookPath = path.join("out", path.basename(pathToEnex, ".enex"));
fs.mkdirSync(notebookPath, { recursive: true });

console.log(notebookPath);

const textStream = fs.createReadStream(pathToEnex);
const xmlStream = new XmlStream(textStream);

var note = {};

xmlStream.on("startElement: note", (el) => {
  note = {};
});

xmlStream.on("endElement: title", (el) => {
  // console.log(JSON.stringify(el, null, 4));
  note.title = el.$text;
});

xmlStream.on("endElement: data", (el) => {
  // console.log(JSON.stringify(el, null, 4));
  note.data = el.$text;
});

xmlStream.on("endElement: file-name", (el) => {
  // console.log(JSON.stringify(el, null, 4));
  if (el.$text) {
    note.fileName = el.$text;
  } else {
    note.fileName = note.title + ".pdf";
  }
});

xmlStream.on("endElement: mime", (el) => {
  // console.log(JSON.stringify(el, null, 4));
  note.mime = el.$text;
});

xmlStream.on("endElement: note", (el) => {
  if (note.mime === "application/pdf") {
    const outputPath = makeOutputPath();
    console.log("dumping " + outputPath);
    const buffer = Buffer.from(note.data, "base64");
    fs.writeFile(outputPath, buffer, function (err) {});
  }
});

function makeOutputPath() {
  var ext = path.extname(note.fileName);
  if (!ext) {
    // console.log("adding pdf to " + note.fileName);
    ext = ".pdf";
  }
  const name = path.basename(note.fileName, ext);

  var result = path.join(notebookPath, name + ext);
  var cnt = 1;
  while (fs.existsSync(result)) {
    // console.log("*** deconflicting file ***");
    result = path.join(notebookPath, name + " (" + cnt + ")" + ext);
  }

  return result;
}

// if (data.pdfs && data.pdfs.pdf) {
//   data.pdfs.pdf.forEach((element) => {
//     const pdfPath = path.join(pdfDir, element.name); //todo deal with repeat filenames
//     const buffer = Buffer.from(element.data, "base64");
//     fs.writeFile(pdfPath, buffer, function (err) {});
//     console.log("wrote " + pdfPath);
//   });
// }
