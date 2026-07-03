import { loadSnippetFile } from "./load.js";

console.log("--- valid file ---");
console.log(loadSnippetFile("src/snippets/manual-check-fixture.yaml"));

console.log("--- missing file ---");
console.log(loadSnippetFile("src/snippets/does-not-exist.yaml"));

console.log("--- broken yaml ---");
console.log(loadSnippetFile("src/snippets/manual-check-broken.yaml"));
