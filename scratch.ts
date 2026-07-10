import { parseYamlSource, detectAnnotations } from "./src/annotation/detect.js";
import { parseAnnotation } from "./src/annotation/parse.js";
import type { AnnotationCandidate } from "./src/annotation/detect.js";

const source = `
build-job:
  stage: build
  script:
    - echo "starting build"
    - "@aws-login(region: \\"eu-west-1\\", profile: \\"default\\")"
    - npm run build
    - "@docker-build-push()"

deploy-job:
  stage: deploy
  script:
    - echo "deploying, referencing @aws-login mid-string should NOT match"
    - "@kubectl-apply(cluster: \\"prod\\", namespace: \\"default\\")"
`;

const { doc, lineCounter } = parseYamlSource(source);
const candidates = detectAnnotations(doc, lineCounter);

// Hand-written malformed candidate to exercise the trailing-comma path.
// We fake a location since we're not pulling this one from real YAML.
const malformed: AnnotationCandidate = {
  raw: '@aws-login(region: "eu-west-1",)',
  location: { line: 999, col: 1, path: ["fake"] },
};

const allToTest = [...candidates, malformed];

for (const c of allToTest) {
  const result = parseAnnotation(c);
  console.log(`--- raw: ${c.raw}`);
  console.log(JSON.stringify(result, null, 2));
  console.log();
}
