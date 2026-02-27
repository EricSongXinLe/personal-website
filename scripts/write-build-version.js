const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitCommit() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 12);
  }

  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (error) {
    return 'unknown';
  }
}

function main() {
  const buildDir = path.resolve(__dirname, '..', 'build');
  const outputPath = path.join(buildDir, 'version.json');

  if (!fs.existsSync(buildDir)) {
    console.error('Build directory does not exist. Run "npm run build" first.');
    process.exit(1);
  }

  const payload = {
    commit: getGitCommit(),
    buildTimeUtc: new Date().toISOString(),
    source: 'personal-website',
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main();
