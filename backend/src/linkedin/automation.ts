import { chromium, Browser, BrowserContext, Page } from 'playwright';

const LINKEDIN_LOGIN = 'https://www.linkedin.com/login';
const LINKEDIN_MESSAGING = 'https://www.linkedin.com/messaging/';

export type BotStatus = 'idle' | 'logging_in' | 'ready' | 'error';

export interface ConversationSummary {
  id: string;
  name: string;
  preview: string;
  unread: boolean;
}

export interface BotState {
  status: BotStatus;
  error?: string;
  conversations: ConversationSummary[];
}

export interface RefreshDiagnostics {
  raceWinner: 'api' | 'skeleton';
  apiUrl?: string;
  rawApiResponse?: unknown;
  rawApiTopKeys?: string[];
  rawApiStructure?: string;
  parsePathUsed?: string;
  parsedCount: number;
  domSummary?: {
    threadLinks: number;
    messagingLinks: number;
    inboxLinks: number;
    hasSkeleton: boolean;
    hasMessagingHeader: boolean;
    linkInfo?: Array<{ href: string | null; text: string; parentTag: string | undefined; parentClass: string | undefined }>;
  };
  voyagerUrlsSeen?: string[];
}

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let headlessMode = false;
let state: BotState = {
  status: 'idle',
  conversations: [],
};

export function getState(): BotState {
  return { ...state };
}

export function getDiagnostics(): RefreshDiagnostics {
  return { ...lastRefreshDiagnostics };
}

export function getPage(): Page | null {
  return page;
}

export async function startBrowser(headless = false): Promise<void> {
  if (browser) return;
  state.status = 'logging_in';
  state.error = undefined;
  headlessMode = headless;
  const slowMo = !headless ? 100 : 0;
  console.log('[LinkedIn Bot] Launching browser, headless:', headless);
  browser = await chromium.launch({
    headless,
    slowMo,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    bypassCSP: true,
    javaScriptEnabled: true,
  });
  page = await context!.newPage();
  await page.setDefaultTimeout(60000);
}

export async function login(email: string, password: string, headless = false): Promise<void> {
  await startBrowser(headless);
  if (!page) throw new Error('Page not ready');

  await page.goto(LINKEDIN_LOGIN, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name="session_key"]', { timeout: 10000 });
  await page.fill('input[name="session_key"]', email);
  await page.fill('input[name="session_password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30000 }).catch(() => {
    const hasError = page?.locator('.form__error, #error-for-password').first();
    if (hasError) throw new Error('Login failed: check email and password');
    throw new Error('Login timed out');
  });

  state.status = 'ready';
  state.error = undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function describeStructure(obj: unknown, depth: number): string {
  if (depth <= 0 || obj == null) return String(typeof obj);
  if (Array.isArray(obj)) return `Array(${obj.length})[${obj.slice(0, 2).map((i) => describeStructure(i, depth - 1)).join(', ')}]`;
  if (typeof obj !== 'object') return String(typeof obj);
  const keys = Object.keys(obj as object);
  const parts = keys.slice(0, 8).map((k) => {
    const v = (obj as Record<string, unknown>)[k];
    if (Array.isArray(v)) return `${k}:Array(${v.length})`;
    if (v && typeof v === 'object') return `${k}:{${Object.keys(v as object).slice(0, 4).join(',')}}`;
    return `${k}:${typeof v}`;
  });
  return `{${parts.join(', ')}}`;
}

// Parsed conversations from API (populated when we intercept the response)
let cachedApiConversations: ConversationSummary[] | null = null;
// Diagnostics from last refresh (for frontend display)
let lastRefreshDiagnostics: RefreshDiagnostics = { raceWinner: 'skeleton', parsedCount: 0 };

// Enable DEBUG when HEADLESS=false (visible browser) or when DEBUG=1 explicitly
const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1' || process.env.HEADLESS === 'false';

export async function goToMessaging(): Promise<void> {
  if (!page) throw new Error('Not logged in');
  cachedApiConversations = null;

  // DEBUG: Log all Voyager URLs seen during navigation
  const voyagerUrlsSeen: string[] = [];
  if (DEBUG) {
    page.on('response', (resp) => {
      const url = resp.url();
      if (url.includes('/voyager/')) {
        voyagerUrlsSeen.push(`${resp.status()} ${url}`);
      }
    });
  }

  // Wait for conversations API - LinkedIn uses voyagerMessagingDashMessagingDashConversations or similar
  const conversationsApiPromise = page.waitForResponse(
    (resp) => {
      const url = resp.url().toLowerCase();
      return (
        url.includes('/voyager/') &&
        (url.includes('messaging') && url.includes('conversation') || url.includes('voyagermessaging')) &&
        resp.status() === 200
      );
    },
    { timeout: 60000 }
  );

  console.log('[LinkedIn Bot] Navigating to messaging...');
  await page.goto(LINKEDIN_MESSAGING, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for skeleton to disappear (SPA has rendered)
  const skeletonPromise = page.waitForSelector('#app-boot-bg-loader', { state: 'detached', timeout: 45000 }).then(() => true).catch(() => false);

  // Race: API response vs skeleton - either proves page is ready
  const apiOrSkeleton = Promise.race([
    conversationsApiPromise.then((r) => ({ type: 'api' as const, response: r })),
    skeletonPromise.then(() => ({ type: 'skeleton' as const, response: null })),
  ]);

  const result = await apiOrSkeleton;
  console.log('[DEBUG] Race winner:', result.type, result.type === 'api' ? result.response?.url() : '');
  if (result.type === 'skeleton') {
    console.log('[LinkedIn Bot] Loading skeleton disappeared');
  }

  if (DEBUG && voyagerUrlsSeen.length > 0) {
    console.log('[DEBUG] Voyager URLs seen (' + voyagerUrlsSeen.length + '):');
    voyagerUrlsSeen.filter((u) => u.toLowerCase().includes('messaging') || u.toLowerCase().includes('conversation')).forEach((u) => console.log('[DEBUG]  ', u));
  }

  await delay(1500);  // Reduced from 3000ms

  // If we got API response, parse it
  if (result.type === 'api' && result.response) {
    try {
      const raw = (await result.response.json()) as Record<string, unknown>;
      const { list: parsed, pathUsed } = parseConversationsFromApi(raw);
      lastRefreshDiagnostics = {
        raceWinner: 'api',
        apiUrl: result.response.url(),
        rawApiResponse: raw,
        rawApiTopKeys: Object.keys(raw),
        rawApiStructure: describeStructure(raw, 2),
        parsePathUsed: pathUsed,
        parsedCount: parsed.length,
        voyagerUrlsSeen: voyagerUrlsSeen,
      };
      if (parsed.length > 0) {
        cachedApiConversations = parsed;
        console.log('[LinkedIn Bot] Parsed', parsed.length, 'conversations from API (path:', pathUsed, ')');
        // API only gives ~20, continue to DOM parsing to get more
        if (parsed.length < 30) {
          console.log('[LinkedIn Bot] API returned < 30, will augment with DOM parsing');
        } else {
          return;
        }
      } else {
        console.log('[LinkedIn Bot] API parsed 0 conversations. Top keys:', Object.keys(raw).join(', '), '| path:', pathUsed);
      }
    } catch (e) {
      lastRefreshDiagnostics.raceWinner = 'api';
      lastRefreshDiagnostics.apiUrl = result.response.url();
      lastRefreshDiagnostics.rawApiTopKeys = ['parse error'];
      lastRefreshDiagnostics.parsePathUsed = String(e instanceof Error ? e.message : e);
      lastRefreshDiagnostics.parsedCount = 0;
      console.log('[LinkedIn Bot] API parse error:', e instanceof Error ? e.message : String(e));
    }
  } else {
    lastRefreshDiagnostics = { raceWinner: 'skeleton', parsedCount: 0, voyagerUrlsSeen: voyagerUrlsSeen };
  }

  // Poll for conversation links in DOM (reduced wait time for speed)
  const maxWaitMs = 10000;  // Reduced from 20000ms
  const pollIntervalMs = 1000;
  let elapsed = 0;
  while (elapsed < maxWaitMs) {
    const linkCount = await page.locator('a[href*="/messaging/thread/"]').count();
    if (DEBUG && elapsed % 5000 === 0 && elapsed > 0) {
      console.log('[DEBUG] DOM poll at', elapsed, 'ms - linkCount:', linkCount);
    }
    if (linkCount > 0) {
      await delay(1500);
      return;
    }
    await delay(pollIntervalMs);
    elapsed += pollIntervalMs;
  }
  console.log('[LinkedIn Bot] No conversation links after', maxWaitMs, 'ms');
}

type ParseResult = { list: ConversationSummary[]; pathUsed: string };

/** Parse messengerConversationsBySyncToken schema: data.messengerConversationsBySyncToken.elements */
function parseMessengerConversationsBySyncToken(elements: Array<Record<string, unknown>>, path: string): ConversationSummary[] {
  const list: ConversationSummary[] = [];
  for (const el of elements.slice(0, 30)) {
    const backendUrn = (el.backendUrn as string) || '';
    const conversationUrl = (el.conversationUrl as string) || '';
    const threadMatch = backendUrn.match(/messagingThread:([\w\-=_]+)/) || conversationUrl.match(/\/messaging\/thread\/([^/?]+)/);
    const id = threadMatch ? threadMatch[1] : '';
    if (!id) continue;

    // Name from conversationParticipants - exclude SELF (distance: "SELF")
    const participants = (el.conversationParticipants as Array<Record<string, unknown>>) || [];
    const names = participants
      .map((p) => {
        const pt = p.participantType as Record<string, unknown> | undefined;
        if (!pt) return null;
        const member = pt.member as Record<string, unknown> | undefined;
        const org = pt.organization as Record<string, unknown> | undefined;
        if (member) {
          const fn = (member.firstName as Record<string, string>)?.text || '';
          const ln = (member.lastName as Record<string, string>)?.text || '';
          return fn || ln ? `${fn} ${ln}`.trim() : null;
        }
        if (org) {
          return ((org.name as Record<string, string>)?.text || '') || null;
        }
        return null;
      })
      .filter(Boolean) as string[];
    const name = [...new Set(names)].filter(Boolean).join(', ') || 'Unknown';

    // Preview from messages.elements[last].body.text
    let preview = '';
    const messages = el.messages as Record<string, unknown> | undefined;
    const msgElements = messages?.elements as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(msgElements) && msgElements.length > 0) {
      const lastMsg = msgElements[msgElements.length - 1];
      const body = lastMsg?.body as Record<string, string> | undefined;
      preview = body?.text || '';
    }

    const unreadCount = (el.unreadCount as number) ?? 0;
    list.push({ id, name: String(name).slice(0, 80), preview: String(preview).slice(0, 120), unread: unreadCount > 0 });
  }
  return list;
}

/** Legacy parser for older API shapes */
function tryLegacyElements(elements: unknown[], included: Array<Record<string, unknown>> | undefined, path: string): ConversationSummary[] {
  const list: ConversationSummary[] = [];
  const profileMap = new Map<string, string>();
  if (Array.isArray(included)) {
    for (const inc of included) {
      const urn = inc.entityUrn as string;
      const fn = (inc.firstName as string) || '';
      const ln = (inc.lastName as string) || '';
      const n = (inc.name as string) || (fn && ln ? `${fn} ${ln}` : '');
      if (urn && n) profileMap.set(urn, n);
    }
  }
  for (const el of (elements as Array<Record<string, unknown>>).slice(0, 30)) {
    const entityUrn = (el.entityUrn as string) || '';
    const backendUrn = (el.backendUrn as string) || '';
    const threadMatch = (entityUrn || backendUrn).match(/messagingThread:([\w\-]+)/);
    const id = threadMatch ? threadMatch[1] : '';
    if (!id) continue;
    const participants = (el.participants as Array<Record<string, unknown>>) || [];
    const names = participants
      .map((p) => {
        const urn = p.entityUrn as string;
        if (urn && profileMap.has(urn)) return profileMap.get(urn);
        return (p.name as string) || ((p.firstName && p.lastName) ? `${p.firstName} ${p.lastName}` : null);
      })
      .filter(Boolean) as string[];
    const name = [...new Set(names)].join(', ') || 'Unknown';
    const events = (el.events as Array<Record<string, unknown>>) || [];
    const lastEvent = events[events.length - 1] as Record<string, unknown> | undefined;
    const eventContent = lastEvent?.eventContent as Record<string, unknown> | undefined;
    const attributedBody = eventContent?.attributedBody as Record<string, unknown> | undefined;
    const preview = (attributedBody?.text as string) || (eventContent?.text as string) || '';
    const unreadCount = (el.unreadCount as number) || 0;
    list.push({ id, name: String(name).slice(0, 80), preview: String(preview).slice(0, 120), unread: unreadCount > 0 });
  }
  return list;
}

function parseConversationsFromApi(raw: Record<string, unknown>): ParseResult {
  // Schema: data.messengerConversationsBySyncToken.elements
  const data = raw.data as Record<string, unknown> | undefined;
  if (data) {
    const sync = data.messengerConversationsBySyncToken as Record<string, unknown> | undefined;
    const elements = sync?.elements as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(elements) && elements.length > 0) {
      const list = parseMessengerConversationsBySyncToken(elements, 'data.messengerConversationsBySyncToken.elements');
      if (list.length > 0) return { list, pathUsed: 'data.messengerConversationsBySyncToken.elements' };
    }
  }

  // Legacy GraphQL: data.*.elements or data.* array
  if (data) {
    const included = (raw.included as Array<Record<string, unknown>>) || undefined;
    const keys = Object.keys(data);
    for (const k of keys) {
      const val = data[k];
      if (Array.isArray(val) && val.length > 0) {
        const list = tryLegacyElements(val, included, `data.${k}`);
        if (list.length > 0) return { list, pathUsed: `data.${k}` };
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const inner = val as Record<string, unknown>;
        const elements = (inner.elements ?? inner.conversations ?? inner.data ?? inner.items) as Array<Record<string, unknown>> | undefined;
        const inc = (inner.included as Array<Record<string, unknown>>) || included;
        if (Array.isArray(elements) && elements.length > 0) {
          const list = tryLegacyElements(elements, inc, `data.${k}.elements`);
          if (list.length > 0) return { list, pathUsed: `data.${k}.elements` };
        }
      }
    }
  }

  // REST / legacy: top-level elements
  const elements = raw.elements as Array<Record<string, unknown>> | undefined;
  const included = raw.included as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(elements) && elements.length > 0) {
    const list = tryLegacyElements(elements, included, 'elements');
    if (list.length > 0) return { list, pathUsed: 'elements' };
  }

  const found = deepFindMessagingThreads(raw, []);
  if (found.list.length > 0) return found;

  return { list: [], pathUsed: 'none' };
}

function extractConversationFromObject(o: Record<string, unknown>): ConversationSummary | null {
  const entityUrn = (o.entityUrn ?? o.backendUrn ?? '') as string;
  const conversationUrl = o.conversationUrl as string | undefined;
  const threadMatch = entityUrn.match(/messagingThread:([\w\-=_]+)/) || (conversationUrl && conversationUrl.match(/\/messaging\/thread\/([^/?]+)/));
  if (!threadMatch) return null;
  const id = threadMatch[1];

  let name = 'Unknown';
  const participants = (o.conversationParticipants ?? o.participants) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(participants)) {
    const names = participants.map((p) => {
      const pt = p.participantType as Record<string, unknown> | undefined;
      if (pt) {
        const m = pt.member as Record<string, unknown> | undefined;
        const org = pt.organization as Record<string, unknown> | undefined;
        if (m) {
          const fn = (m.firstName as Record<string, string>)?.text || '';
          const ln = (m.lastName as Record<string, string>)?.text || '';
          return fn || ln ? `${fn} ${ln}`.trim() : null;
        }
        if (org) return ((org.name as Record<string, string>)?.text || '') || null;
      }
      return (p.name as string) || ((p.firstName && p.lastName) ? `${p.firstName} ${p.lastName}` : null);
    }).filter(Boolean) as string[];
    name = [...new Set(names)].filter(Boolean).join(', ') || 'Unknown';
  }

  let preview = '';
  const messages = o.messages as Record<string, unknown> | undefined;
  const msgElements = messages?.elements as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(msgElements) && msgElements.length > 0) {
    const lastMsg = msgElements[msgElements.length - 1];
    const body = lastMsg?.body as Record<string, string> | undefined;
    preview = body?.text || '';
  }
  if (!preview) {
    const events = (o.events as Array<Record<string, unknown>>) || [];
    const lastEvent = events[events.length - 1] as Record<string, unknown> | undefined;
    const ec = lastEvent?.eventContent as Record<string, unknown> | undefined;
    preview = (ec?.attributedBody as Record<string, string>)?.text || (ec?.text as string) || '';
  }

  const unread = ((o.unreadCount as number) || 0) > 0;
  return { id, name: String(name).slice(0, 80), preview: String(preview).slice(0, 120), unread };
}

function deepFindMessagingThreads(obj: unknown, path: string[], depth = 0): ParseResult {
  if (depth > 5 || obj == null) return { list: [], pathUsed: 'none' };
  if (Array.isArray(obj)) {
    const list: ConversationSummary[] = [];
    for (const item of obj) {
      if (item && typeof item === 'object') {
        const s = extractConversationFromObject(item as Record<string, unknown>);
        if (s) list.push(s);
      }
    }
    if (list.length > 0) return { list, pathUsed: path.join('.') || 'deep' };
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj as object)) {
      const v = (obj as Record<string, unknown>)[k];
      const res = deepFindMessagingThreads(v, [...path, k], depth + 1);
      if (res.list.length > 0) return res;
    }
  }
  return { list: [], pathUsed: 'none' };
}

export async function refreshConversations(): Promise<ConversationSummary[]> {
  console.log('[DEBUG] refreshConversations start');
  await goToMessaging();
  if (!page) return [];

  // Merge API + DOM results to get up to 50
  let apiConversations: ConversationSummary[] = [];
  if (cachedApiConversations && cachedApiConversations.length > 0) {
    console.log('[DEBUG] Using cached API conversations:', cachedApiConversations.length);
    apiConversations = cachedApiConversations;
  }

  // If we have >= 20 from API, return now (optimized for speed)
  if (apiConversations.length >= 20) {
    state.conversations = apiConversations;
    return apiConversations;
  }

  console.log('[DEBUG] Falling back to DOM parsing to augment API results (target: 20 conversations)');
  
  // Wait for the messaging UI to load - reduced for speed
  await page.waitForTimeout(1000);  // Reduced from 3000ms
  
  // Try to find and scroll the conversation list container
  const scrollResult = await page.evaluate(() => {
    // Find the conversation list container
    const containerSelectors = [
      '[class*="msg-conversations-container"]',
      '[class*="msg-s-message-list-container"]',
      'aside[class*="msg"]',
      'aside[class*="messaging"]',
      '[role="navigation"][class*="msg"]',
      'div[class*="scaffold-layout__list"]',
      'div[class*="msg-overlay-list-bubble"]',
    ];
    
    let container: HTMLElement | null = null;
    for (const sel of containerSelectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        container = el;
        console.log('[DOM] Found container:', sel);
        break;
      }
    }
    
    if (!container) {
      // Try to find any scrollable element with conversation-like content
      const allElements = document.querySelectorAll('[class*="msg"], [class*="messaging"], aside, nav');
      for (const el of Array.from(allElements)) {
        const html = el as HTMLElement;
        if (html.scrollHeight > html.clientHeight + 100) {
          container = html;
          console.log('[DOM] Found scrollable container:', el.className?.slice(0, 60));
          break;
        }
      }
    }
    
    return {
      found: !!container,
      className: container?.className?.slice(0, 100) || '',
      scrollHeight: container?.scrollHeight || 0,
      clientHeight: container?.clientHeight || 0,
    };
  });
  
  console.log('[DEBUG] Container search result:', scrollResult);
  
  // Scroll the conversation list to load more (LinkedIn lazy-loads) - optimized for speed
  for (let i = 0; i < 10; i++) {  // Reduced from 20 iterations
    const scrolled = await page.evaluate(() => {
      const selectors = [
        '[class*="msg-conversations-container"]',
        '[class*="msg-s-message-list-container"]',
        'aside[class*="msg"]',
        'aside[class*="messaging"]',
        '[role="navigation"][class*="msg"]',
        'div[class*="scaffold-layout__list"]',
        'div[class*="msg-overlay-list-bubble"]',
        '[class*="msg-s-conversations-list"]',
        '[class*="msg-form__conversations"]',
        '[class*="conversation-list"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el || el.scrollHeight <= el.clientHeight + 20) continue;
        const before = el.scrollTop;
        el.scrollTop = el.scrollTop + 500;
        const after = el.scrollTop;
        if (after > before) return { scrolled: true, selector: sel, scrollTop: after };
      }
      // Fallback: try all scrollable elements
      const scrollables = document.querySelectorAll('aside, nav, [class*="msg"], [class*="conversation"]');
      for (const node of Array.from(scrollables)) {
        const el = node as HTMLElement;
        if (el.scrollHeight > el.clientHeight + 50) {
          const before = el.scrollTop;
          el.scrollTop = el.scrollTop + 500;
          if (el.scrollTop > before) return { scrolled: true, selector: el.className?.slice(0, 40), scrollTop: el.scrollTop };
        }
      }
      return { scrolled: false, selector: null, scrollTop: 0 };
    });
    
    if (!scrolled.scrolled) {
      console.log('[DEBUG] Scroll stopped at iteration', i);
      break;
    }
    if (i % 10 === 0) {
      console.log(`[DEBUG] Scroll progress: iteration ${i}, scrollTop: ${scrolled.scrollTop}`);
    }
    await page.waitForTimeout(500);  // Reduced from 1000ms
  }

  // Fall back to DOM parsing - gather extra debug info and wait for content
  await page.waitForTimeout(1000);  // Reduced from 2000ms
  
  const domInfo = await page.evaluate(() => {
    const threadLinks = document.querySelectorAll('a[href*="/messaging/thread/"]');
    const anyMessagingLinks = document.querySelectorAll('a[href*="/messaging/"]');
    const anyInboxLinks = document.querySelectorAll('a[href*="/inbox/"]');
    const linkInfo = Array.from(threadLinks).slice(0, 10).map((a) => ({
      href: a.getAttribute('href'),
      text: a.textContent?.slice(0, 60),
      parentTag: a.parentElement?.tagName,
      parentClass: a.parentElement?.className?.slice(0, 80),
    }));
    const bodySnippet = document.body.innerHTML.slice(0, 3000);
    const hasSkeleton = !!document.getElementById('app-boot-bg-loader');
    const hasMessagingHeader = !!document.querySelector('[aria-label*="Messaging"], .msg-overlay-bubble-header, [class*="messaging"]');
    return {
      linkCount: threadLinks.length,
      messagingLinkCount: anyMessagingLinks.length,
      inboxLinkCount: anyInboxLinks.length,
      linkInfo,
      bodySnippet,
      hasSkeleton,
      hasMessagingHeader,
    };
  });

  lastRefreshDiagnostics.domSummary = {
    threadLinks: domInfo.linkCount,
    messagingLinks: domInfo.messagingLinkCount,
    inboxLinks: domInfo.inboxLinkCount,
    hasSkeleton: domInfo.hasSkeleton,
    hasMessagingHeader: domInfo.hasMessagingHeader,
    linkInfo: domInfo.linkInfo,
  };
  lastRefreshDiagnostics.parsedCount = 0;

  console.log('[DEBUG] DOM summary:', {
    threadLinks: domInfo.linkCount,
    messagingLinks: domInfo.messagingLinkCount,
    inboxLinks: domInfo.inboxLinkCount,
    hasSkeleton: domInfo.hasSkeleton,
    hasMessagingHeader: domInfo.hasMessagingHeader,
  });
  if (domInfo.linkInfo.length > 0) {
    console.log('[DEBUG] Sample links:', JSON.stringify(domInfo.linkInfo.slice(0, 3), null, 2));
  }
  if (domInfo.linkCount === 0) {
    console.log('[LinkedIn DOM] No conversation links found.');
    console.log('[LinkedIn DOM] bodySnippet (first 400 chars):', domInfo.bodySnippet.slice(0, 400).replace(/\s+/g, ' '));
    const screenshotPath = 'debug-screenshot.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});
    console.log('[LinkedIn DOM] Screenshot saved to', screenshotPath);
  } else {
    console.log('[LinkedIn DOM] linkCount:', domInfo.linkCount);
  }

  const list: ConversationSummary[] = [];
  const seenIds = new Set<string>();

  try {
    // Wait for conversation list to be present
    await page.waitForSelector('a[href*="/messaging/"], li, [role="listitem"]', { timeout: 5000 }).catch(() => {
      console.log('[LinkedIn DOM] No list elements found after wait');
    });
    
    // Find rows that contain conversation links (li or listitem)
    const rowSelectors = [
      'li:has(a[href*="/messaging/thread/"])',
      '[role="listitem"]:has(a[href*="/messaging/thread/"])',
      '[data-list-item-id]:has(a[href*="/messaging/thread/"])',
      'li[class*="msg"]',
      'li[class*="conversation"]',
      '[role="listitem"][class*="msg"]',
      'div[class*="msg-conversation-listitem"]',
    ];

    let rows = page.locator(rowSelectors[0]);
    let foundSelector = '';
    for (const sel of rowSelectors) {
      const loc = page.locator(sel);
      const cnt = await loc.count();
      if (cnt > 0) {
        rows = loc;
        foundSelector = sel;
        console.log(`[LinkedIn DOM] Found ${cnt} rows using selector: ${sel}`);
        break;
      }
    }

    // Fallback: get links directly if no row containers found
    const useLinks = (await rows.count()) === 0;
    if (useLinks) {
      console.log('[LinkedIn DOM] No row containers found, using direct link approach');
    }
    const links = useLinks ? page.locator('a[href*="/messaging/thread/"], a[href*="/messaging/"]') : null;
    const count = useLinks ? await links!.count() : await rows.count();
    
    console.log(`[LinkedIn DOM] Found ${count} items to process (useLinks: ${useLinks})`);

    // Process up to 20 conversations (optimized for speed)
    const targetCount = Math.min(count, 20);  // Reduced from 30
    console.log(`[LinkedIn DOM] Will process ${targetCount} items`);

    for (let i = 0; i < targetCount; i++) {
      try {
        if (i % 5 === 0 && i > 0) {
          console.log(`[LinkedIn DOM] Processing item ${i}/${targetCount}...`);
        }

        const row = useLinks ? links!.nth(i) : rows.nth(i);
        const link = useLinks ? row : row.locator('a[href*="/messaging/thread/"]').first();

        const href = await Promise.race([
          link.getAttribute('href'),
          new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
        ]).catch(() => '');

        // Extract thread ID from href (e.g. /messaging/thread/2-ABC123/ or /messaging/thread/ABC123/)
        const match = href?.match(/\/messaging\/thread\/([^/?]+)/);
        const rawId = match ? match[1] : '';
        const id = rawId.replace(/[^a-zA-Z0-9-]/g, '') || `conv-${i}`;

        if (!rawId || seenIds.has(id)) continue;
        seenIds.add(id);

        // Name: link text, or first span in row, or first line of row text
        let name = await Promise.race([
          link.textContent(),
          new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
        ]).catch(() => '');
        
        if (!name?.trim()) {
          name = await Promise.race([
            row.locator('span').first().textContent(),
            new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
          ]).catch(() => '');
        }
        
        if (!name?.trim()) {
          const fullText = await Promise.race([
            row.textContent(),
            new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
          ]).catch(() => '');
          name = fullText?.split(/\n/)[0]?.trim() || 'Unknown';
        }

        // Preview: snippet/preview class, or second line of row text
        let preview = await Promise.race([
          row.locator('[class*="snippet"], [class*="preview"], [class*="message-snippet"]').first().textContent(),
          new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
        ]).catch(() => '');
        
        if (!preview?.trim()) {
          const fullText = await Promise.race([
            row.textContent(),
            new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
          ]).catch(() => '');
          const lines = fullText?.split(/\n/).map((s) => s.trim()).filter(Boolean) || [];
          preview = lines.length > 1 ? lines[1] : '';
        }

        // Unread: row has unread indicator
        const rowClass = await Promise.race([
          row.getAttribute('class'),
          new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
        ]).catch(() => '');
        
        const hasUnreadClass = (rowClass || '').toLowerCase().includes('unread');
        const unreadCount = await Promise.race([
          row.locator('[class*="unread"]').count(),
          new Promise<number>((resolve) => setTimeout(() => resolve(0), 5000))
        ]).catch(() => 0);
        const hasUnreadChild = unreadCount > 0;
        const unread = hasUnreadClass || hasUnreadChild;

        list.push({
          id,
          name: (name || 'Unknown').trim().slice(0, 80),
          preview: (preview || '').trim().slice(0, 120),
          unread,
        });
      } catch (error) {
        console.log(`[LinkedIn DOM] Error processing item ${i}:`, error instanceof Error ? error.message : String(error));
        // Skip this item and continue with next one
        continue;
      }
    }
  } catch (e) {
    state.error = e instanceof Error ? e.message : 'Failed to parse conversations';
  }

  // Merge API + DOM results, preferring API items but adding DOM-only items (target: 20)
  const apiIds = new Set(apiConversations.map((c) => c.id));
  const mergedList = [...apiConversations];
  for (const domConv of list) {
    if (!apiIds.has(domConv.id) && mergedList.length < 20) {  // Reduced from 30
      mergedList.push(domConv);
    }
  }

  state.conversations = mergedList;
  lastRefreshDiagnostics.parsedCount = mergedList.length;
  console.log('[LinkedIn Bot] Total conversations after merge:', mergedList.length, `(API: ${apiConversations.length}, DOM: ${list.length})`);
  return mergedList;
}

export async function openConversation(threadIdOrIndex: string): Promise<boolean> {
  if (!page) return false;
  await goToMessaging();
  const directUrl = `https://www.linkedin.com/messaging/thread/${threadIdOrIndex}/`;
  await page.goto(directUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  return true;
}

export async function sendMessage(text: string): Promise<boolean> {
  if (!page) return false;
  try {
    const inputSelectors = [
      '[contenteditable="true"][role="textbox"]',
      '.msg-form__contenteditable',
      '[data-placeholder*="message"]',
      'div[contenteditable="true"]',
    ];
    for (const sel of inputSelectors) {
      const input = page.locator(sel).first();
      if (await input.count() > 0) {
        await input.click();
        await input.fill('');
        await input.fill(text);
        await page.waitForTimeout(500);
        const sendBtn = page.locator('button[type="submit"], button.msg-form__send-button, button[aria-label*="Send"]').first();
        if (await sendBtn.count() > 0) {
          await sendBtn.click();
          await page.waitForTimeout(1500);
          return true;
        }
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/** Scroll the message list upward to trigger lazy-loading of older messages */
async function scrollMessageListToTop(): Promise<void> {
  if (!page) return;
  const maxScrolls = 40;
  const scrollStep = 500;
  const scrollDelayMs = 700;

  for (let i = 0; i < maxScrolls; i++) {
    const result = await page.evaluate((step) => {
      const containers = [
        '[class*="msg-s-message-list"]',
        '[class*="msg-form__message-list-wrapper"]',
        '[class*="conversation__message-list"]',
        '[class*="msg-s-event-list"]',
        '[class*="scroller"][class*="msg"]',
        '[role="log"]',
        'main [class*="msg"]',
      ];
      for (const sel of containers) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el || el.scrollHeight <= el.clientHeight) continue;
        const before = el.scrollTop;
        el.scrollTop = Math.max(0, el.scrollTop - step);
        const after = el.scrollTop;
        if (before === 0 && after === 0) return 2;
        return after < before ? 1 : 0;
      }
      const scrollables = document.querySelectorAll('[class*="msg"], [class*="message"]');
      for (const el of Array.from(scrollables)) {
        const html = el as HTMLElement;
        if (html.scrollHeight > html.clientHeight + 50) {
          const before = html.scrollTop;
          html.scrollTop = Math.max(0, html.scrollTop - step);
          const after = html.scrollTop;
          if (before === 0 && after === 0) return 2;
          return after < before ? 1 : 0;
        }
      }
      return 0;
    }, scrollStep);

    if (result === 2) break;
    if (result === 0 && i > 2) break;
    await page.waitForTimeout(scrollDelayMs);
  }
}

export interface ThreadMessage {
  text: string;
  timestamp?: string;
  fromMe?: boolean;
}

export async function getLastMessages(count: number): Promise<ThreadMessage[]> {
  if (!page) return [];
  try {
    await page.waitForTimeout(1500);
    await scrollMessageListToTop();
    await page.waitForTimeout(600);

    const messages = await page.evaluate((maxCount) => {
      const itemSelectors = [
        '[class*="msg-s-event-listitem"]',
        '[data-templatename="message"]',
        '[class*="msg-s-message-list"] li',
        '[role="log"] > div',
        '[role="listitem"][class*="msg"]',
      ];
      const bodySelectors = [
        '.msg-s-event-listitem__body',
        '[class*="message-body"]',
        '[class*="msg-s-event-listitem__body"]',
      ];
      const timeSelectors = [
        '[class*="msg-s-event-listitem__meta"]',
        '[class*="timestamp"]',
        '[class*="time-stamp"]',
        '[class*="timeStamp"]',
        '[class*="time-stamp"]',
        'time[datetime]',
        'time',
        '[aria-label*="time"]',
        '[aria-label*="date"]',
        '[class*="date"]',
        '[class*="meta"]',
        '[class*="msg-s-event-listitem__footer"]',
        '[class*="footer"]',
        '[data-timestamp]',
        '[datetime]',
      ];
      const seen = new Set<string>();
      const results: Array<{ text: string; timestamp?: string; fromMe?: boolean }> = [];

      const isSentByMe = (item: Element): boolean => {
        const el = item as HTMLElement;
        const cls = (el.className || '') + ' ' + (el.closest('[class*="msg"]')?.className || '');
        if (/outbound|sent|outgoing|from-self|fromme/i.test(cls)) return true;
        
        // Check for "Joseph Beyer" in sender/metadata elements
        const senderSelectors = [
          '[class*="sender"]',
          '[class*="author"]',
          '[class*="from"]',
          '[class*="meta"]',
          '[class*="header"]',
          '[class*="name"]',
        ];
        
        for (const sel of senderSelectors) {
          const senderEl = el.querySelector(sel) || el.closest('[class*="msg"], li, [role="listitem"]')?.querySelector(sel);
          if (senderEl && /Joseph\s+Beyer/i.test(senderEl.textContent || '')) {
            return true;
          }
        }
        
        // Fallback: check if "Joseph Beyer" appears near timestamp in the item
        const parent = el.closest('[class*="msg"], li, [role="listitem"]');
        if (parent) {
          const allText = parent.textContent || '';
          // If "Joseph Beyer" appears within 100 chars of a time indicator, likely it's the sender
          if (/Joseph\s+Beyer.{0,100}(?:\d{1,2}:\d{2}|AM|PM|ago)/i.test(allText) || 
              /(?:\d{1,2}:\d{2}|AM|PM|ago).{0,100}Joseph\s+Beyer/i.test(allText)) {
            return true;
          }
        }
        
        return false;
      };

      const addMessage = (text: string, timestamp?: string, fromMe?: boolean) => {
        const t = text.trim();
        if (!t || t.length > 5000) return;
        const key = results.length + '|' + t.slice(0, 100);
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ text: t, timestamp: timestamp || undefined, fromMe: fromMe ?? false });
      };

      const extractTime = (item: Element): string | undefined => {
        for (const sel of timeSelectors) {
          const el = item.querySelector(sel);
          if (el) {
            const dt = el.getAttribute('datetime');
            if (dt) return formatIsoTimestamp(dt);
            const ts = el.getAttribute('data-timestamp');
            if (ts) return formatIsoTimestamp(ts);
            const aria = el.getAttribute('aria-label');
            if (aria && /\d|am|pm|today|yesterday|minute|hour|day|week|month/i.test(aria)) return aria;
            const t = (el.textContent || '').trim();
            if (t && /\d|am|pm|today|yesterday|minute|hour|ago/i.test(t) && t.length < 80) return t;
          }
        }
        const parent = item.parentElement;
        if (parent) {
          for (const child of Array.from(parent.children)) {
            if (child === item) continue;
            const t = (child.getAttribute('datetime') || child.getAttribute('data-timestamp') || child.textContent || '').trim();
            if (t && (child.getAttribute('datetime') || child.getAttribute('data-timestamp') || /\d|am|pm|ago/i.test(t))) {
              return child.getAttribute('datetime') || child.getAttribute('data-timestamp') ? formatIsoTimestamp(t) : t;
            }
          }
        }
        const allText = item.textContent || '';
        const patterns = [
          /\d{1,2}:\d{2}\s*(?:AM|PM)?/i,
          /\d{1,2}\/\d{1,2}\/\d{2,4}/,
          /\d{4}-\d{2}-\d{2}/,
          /\w{3,9}\s+\d{1,2},?\s+\d{4}/,
          /\d+\s*(?:min|hr|h|m|hour|minute)s?\s*ago/i,
          /today|yesterday|last\s+week/i,
        ];
        for (const re of patterns) {
          const m = allText.match(re);
          if (m) return m[0].trim();
        }
        return undefined;
      };

      const formatIsoTimestamp = (s: string): string => {
        try {
          const d = new Date(s);
          if (isNaN(d.getTime())) return s;
          return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
        } catch {
          return s;
        }
      };

      for (const itemSel of itemSelectors) {
        const items = document.querySelectorAll(itemSel);
        if (items.length === 0) continue;

        for (const item of Array.from(items)) {
          let text = '';
          for (const bodySel of bodySelectors) {
            const body = item.querySelector(bodySel);
            if (body) {
              text = (body.textContent || '').trim();
              break;
            }
          }
          if (!text) text = (item.textContent || '').trim();
          const timestamp = extractTime(item);
          const fromMe = isSentByMe(item);
          addMessage(text, timestamp, fromMe);
        }
        if (results.length > 0) break;
      }

      if (results.length === 0) {
        for (const bodySel of bodySelectors) {
          const els = document.querySelectorAll(bodySel);
          for (const el of Array.from(els)) {
            const parent = el.closest('[class*="msg"], [class*="message"], li, [role="listitem"]');
            const timestamp = parent ? extractTime(parent) : undefined;
            const fromMe = parent ? isSentByMe(parent) : false;
            addMessage((el.textContent || '').trim(), timestamp, fromMe);
          }
          if (results.length > 0) break;
        }
      }
      return results.slice(-maxCount);
    }, count);
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

export async function stopBrowser(): Promise<void> {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  browser = null;
  context = null;
  page = null;
  state = { status: 'idle', conversations: [] };
}
