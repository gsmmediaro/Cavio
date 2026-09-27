const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = "C:/Users/shado/Desktop/Cavio/web/frontend/design-shots";
const BOX = "C:/Users/shado/AppData/Local/Temp/cavio-design-shots-box"; // also copy later
const BASE = "http://127.0.0.1:5173";
const EMAIL = "meuze-sec-01@agentmail.to";
const PASS = "CavioDesign2026!";
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.waitForTimeout(700);
  await page.screenshot({ path: file, fullPage: false });
  console.log("SAVED", name, fs.statSync(file).size);
}

async function login(page) {
  await page.goto(BASE + "/analyze", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  const loginBtn = page.getByRole("button", { name: /log in|conectare/i });
  if (await loginBtn.count()) {
    await loginBtn.first().click();
    await page.waitForTimeout(800);
  }
  const emailBtn = page.getByRole("button", { name: /email/i });
  if (await emailBtn.count()) {
    await emailBtn.first().click();
    await page.waitForTimeout(500);
  }
  const email = page.locator('input[type="email"]');
  const pass = page.locator('input[type="password"]');
  if (await email.count()) {
    await email.first().fill(EMAIL);
    await pass.first().fill(PASS);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(4000);
  }
}

async function clickNav(page, label) {
  const btn = page.locator("nav button", { hasText: new RegExp("^" + label + "$", "i") });
  if (await btn.count()) {
    await btn.first().click();
    return true;
  }
  const any = page.getByRole("button", { name: new RegExp("^" + label + "$", "i") });
  if (await any.count()) {
    await any.first().click();
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text());
  });

  await login(page);
  await page.goto(BASE + "/settings#billing", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  if (!(await clickNav(page, "Plans"))) {
    // hash may already open billing
    console.log("Plans nav miss — body snippet:");
    console.log((await page.locator("body").innerText()).slice(0, 600));
  }
  await page.waitForTimeout(1200);
  console.log("BODY", (await page.locator("body").innerText()).slice(0, 1200));
  await shot(page, "80-settings-plans-multi-tier-desktop.png");

  // Close-up of plan cards grid if present
  const grid = page.locator("#plans").locator("..").locator("..");
  if (await page.locator("text=Starter").count()) {
    await page.locator("text=Starter").first().scrollIntoViewIfNeeded().catch(() => {});
  }
  await shot(page, "81-settings-plans-cards-grid-desktop.png");

  const openPaywall = page.getByRole("button", { name: /open paywall/i });
  if (await openPaywall.count()) {
    await openPaywall.first().click();
    await page.waitForTimeout(1200);
    await shot(page, "82-paywall-three-packs-desktop.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  if (await clickNav(page, "Credits")) {
    await page.waitForTimeout(800);
    const topup = page.getByRole("button", { name: /top up/i });
    if (await topup.count()) {
      await topup.first().click();
      await page.waitForTimeout(1000);
      await shot(page, "83-credit-topup-presets-desktop.png");
      await page.keyboard.press("Escape");
    }
  }

  // Mobile plans
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  await login(mpage);
  await mpage.goto(BASE + "/settings#billing", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await mpage.waitForTimeout(1500);
  await clickNav(mpage, "Plans");
  await mpage.waitForTimeout(900);
  await shot(mpage, "84-settings-plans-multi-tier-mobile.png");

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
