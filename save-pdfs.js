const fs = require("fs");
const path = require("path");

const dataFilePath = process.argv[2];
const data = JSON.parse(fs.readFileSync(dataFilePath));

const pdfDir = path.dirname(dataFilePath);

if (data.pdfs && data.pdfs.pdf) {
  data.pdfs.pdf.forEach((element) => {
    const pdfPath = path.join(pdfDir, element.name); //todo deal with repeat filenames
    const buffer = Buffer.from(element.data, "base64");
    fs.writeFile(pdfPath, buffer, function (err) {});
    console.log("wrote " + pdfPath);
  });
}
