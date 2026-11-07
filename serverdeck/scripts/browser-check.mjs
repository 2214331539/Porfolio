import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";

const origin = process.env.DECK_PREVIEW_URL || "http://127.0.0.1:5173";
const knownBrowser = path.join(
  os.homedir(),
  "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe",
);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(knownBrowser) ? { executablePath: knownBrowser } : {}),
  });
} catch {
  browser = await chromium.launch({ headless: true, channel: "msedge" });
}
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  permissions: ["clipboard-read", "clipboard-write"],
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const password = readFileSync(".local/dashboard-login.txt", "utf8")
  .split("\n")[1]
  .trim();
const output = ".local/qa";
mkdirSync(output, { recursive: true });
try {
  await page.goto(origin);
  await page.getByLabel("管理口令").fill(password);
  await page.getByRole("button", { name: "打开工作台", exact: true }).click();
  await page
    .getByRole("heading", { name: "服务器", exact: false })
    .first()
    .waitFor();
  await page.locator(".machine").first().waitFor();
  assert.equal(await page.locator(".machine").count(), 3);
  const state = await page.evaluate(() =>
    fetch("/api/state").then((r) => r.json()),
  );
  assert.equal(
    state.servers.some((server) =>
      server.accounts.some(
        (account) => "password" in account || "keyPath" in account,
      ),
    ),
    false,
  );
  await page.getByRole("button", { name: "Tencent Big，查看连接信息" }).click();
  await page.getByRole("button", { name: "显示密码", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".secret-value")?.textContent !== "••••••••",
  );
  await page.getByRole("button", { name: "隐藏密码", exact: true }).click();
  assert.equal(await page.locator(".secret-value").textContent(), "••••••••");
  await page.getByRole("button", { name: "复制 IP", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "124.221.115.83",
  );
  await page.getByRole("button", { name: "查看部署", exact: true }).click();
  await page
    .getByRole("heading", { name: "Tencent Big", exact: true })
    .last()
    .waitFor();
  assert.equal(
    await page
      .locator(".project-name")
      .filter({ hasText: "Impromptu" })
      .count(),
    1,
  );
  await page.getByRole("button", { name: "Impromptu", exact: true }).click();
  assert.equal(await page.locator(".service-row").count(), 3);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "整理并确认", exact: true }).click();
  await page.getByRole("dialog", { name: "整理项目" }).waitFor();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "添加服务器", exact: true }).click();
  await page.getByRole("dialog", { name: "添加服务器" }).waitFor();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Aliyun，查看连接信息" }).click();
  const sheet = await page.locator(".connection-panel").boundingBox();
  assert.ok(sheet && sheet.x >= 0 && sheet.x + sheet.width <= 390);
  await page.getByRole("button", { name: "关闭连接信息", exact: true }).click();
  await page.getByRole("button", { name: "Porfolio", exact: true }).click();
  await page.locator(".registration-detail").waitFor();
  assert.equal(await page.locator(".registration-detail").count(), 1);
  assert.match(
    await page.locator(".registration-detail").textContent(),
    /2027-08-19/,
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: `${output}/desktop-domain.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 720 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: `${output}/mobile-320.png`, fullPage: true });
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await page.getByLabel("管理口令").waitFor();
  const protectedStatus = await page.evaluate(() =>
    fetch("/api/state").then((response) => response.status),
  );
  assert.equal(protectedStatus, 401);
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: login, three real servers, masked credentials, copy, project grouping, dialogs, 390px/320px layout, logout.",
  );
} finally {
  await browser.close();
}
