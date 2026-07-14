import fs from "fs";
import path from "path";

const seedFilePath = path.join(process.cwd(), "src/data/vocabulary-seed.json");
const data = JSON.parse(fs.readFileSync(seedFilePath, "utf8"));

let placeholders = 0;
let emptyIpa = 0;
let dottedIpa = 0;

data.forEach(item => {
  if (item.meaning_vi && item.meaning_vi.includes("từ học thuật")) {
    placeholders++;
  }
  if (!item.ipa) {
    emptyIpa++;
  } else if (item.ipa.includes("...")) {
    dottedIpa++;
  }
});

console.log(`Total words: ${data.length}`);
console.log(`Placeholders ("từ học thuật"): ${placeholders}`);
console.log(`Empty IPA: ${emptyIpa}`);
console.log(`Dotted IPA (like /c.../): ${dottedIpa}`);
