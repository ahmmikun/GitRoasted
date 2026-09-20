/**
 * Live test script to check:
 * 1. Portfolio/website link in GitHub profile
 * 2. Profile repository named after the username (e.g. ahmmikun/ahmmikun) + README
 */

const USERNAME = "ahmmikun";

async function testProfile() {
  console.log(`\n======================================================`);
  console.log(`  LIVE GITHUB TEST FOR @${USERNAME}`);
  console.log(`======================================================\n`);

  const headers = {
    "User-Agent": "GitRoasted-Profile-Checker",
    Accept: "application/vnd.github+json",
  };

  // 1. Check Portfolio / Website Link
  console.log(`[1] CHECKING PORTFOLIO / WEBSITE LINK...`);
  const userRes = await fetch(`https://api.github.com/users/${USERNAME}`, { headers });
  
  if (!userRes.ok) {
    console.error(`❌ Failed to fetch user profile: HTTP ${userRes.status}`);
    return;
  }

  const user = await userRes.json();
  const portfolio = user.blog ? user.blog.trim() : null;

  console.log(`    • GitHub Login:       ${user.login}`);
  console.log(`    • Full Name:          ${user.name ?? "N/A"}`);
  console.log(`    • Portfolio Link:     ${portfolio ?? "(None)"}`);

  if (portfolio) {
    console.log(`    ✅ RESULT: Portfolio link IS present on profile ("${portfolio}").`);
    const siteUrl = portfolio.startsWith("http") ? portfolio : `https://${portfolio}`;
    try {
      const ping = await fetch(siteUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });
      console.log(`    🌐 Live Website Ping: ${siteUrl} -> HTTP ${ping.status} ${ping.statusText}`);
    } catch (e: unknown) {
      const err = e as Error;
      console.log(`    ⚠️  Could not reach website directly: ${err.message}`);
    }
  } else {
    console.log(`    ❌ RESULT: No portfolio link set on profile.`);
  }

  // 2. Check Profile Repository (username/username)
  console.log(`\n[2] CHECKING PROFILE REPOSITORY (${USERNAME}/${USERNAME})...`);
  const repoRes = await fetch(`https://api.github.com/repos/${USERNAME}/${USERNAME}`, { headers });

  if (repoRes.status === 200) {
    const repo = await repoRes.json();
    console.log(`    • Repository:         ${repo.full_name}`);
    console.log(`    • Description:        ${repo.description ?? "(No description)"}`);
    console.log(`    • Visibility:         ${repo.visibility}`);
    console.log(`    • Default Branch:     ${repo.default_branch}`);
    console.log(`    ✅ RESULT: Profile repository EXISTS.`);

    // Probe the README
    const readmeRes = await fetch(`https://api.github.com/repos/${USERNAME}/${USERNAME}/readme`, { headers });
    if (readmeRes.ok) {
      const readme = await readmeRes.json();
      const content = Buffer.from(readme.content, "base64").toString("utf-8");
      console.log(`    • README File:        ${readme.name} (${readme.size} bytes)`);
      console.log(`    ✅ RESULT: Profile README.md IS present and usable.`);
      console.log(`\n    --- Profile README Preview ---`);
      console.log(`    ${content.split("\n").slice(0, 4).join("\n    ")}`);
    } else {
      console.log(`    ⚠️  Repository exists but README endpoint returned HTTP ${readmeRes.status}`);
    }
  } else if (repoRes.status === 404) {
    console.log(`    ❌ RESULT: Repository "${USERNAME}/${USERNAME}" does NOT exist.`);
  } else {
    console.log(`    ❌ RESULT: Failed to query repository (HTTP ${repoRes.status}).`);
  }

  console.log(`\n======================================================\n`);
}

testProfile().catch(console.error);
