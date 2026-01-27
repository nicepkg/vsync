const pkgRoot = process.env.SEMREL_PKG_ROOT || "cli";
const pkgName = process.env.SEMREL_PKG_NAME || "@nicepkg/vsync";
const changelogFile = "CHANGELOG.md";
const assets = [`${pkgRoot}/package.json`, changelogFile];

module.exports = {
  branches: ["main"],
  tagFormat: `${pkgName}@\${version}`,
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    ["@semantic-release/changelog", { changelogFile }],
    ["@semantic-release/npm", { pkgRoot, npmPublish: true }],
    [
      "@semantic-release/git",
      {
        assets,
        message:
          `chore(release): ${pkgName} \${nextRelease.version} [skip ci]\n\n\${nextRelease.notes}`,
      },
    ],
    "@semantic-release/github",
  ],
};
