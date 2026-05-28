---
name: openbrowser
description: Sets up and runs the Open Browser tool (ntegrals/openbrowser) — an AI-powered autonomous web browsing agent. Use this skill when the user asks to install, set up, or use Open Browser, browse the web, navigate a website, extract data from a page, automate a web task, analyze/scan/check/inspect/audit/review/test a site or URL. Handles installing Bun, open-browser CLI, Playwright Chromium, and API key configuration.
---

# Open Browser Skill

Set up and use the Open Browser CLI — an AI agent that navigates the web autonomously via Playwright + LLMs (OpenAI, Anthropic, Google).

---

## How It Works

1. You give the agent a natural-language task
2. The LLM (GPT, Claude, Gemini) decides what actions to take
3. Playwright executes those actions in a real Chromium browser
4. The agent loops until the task is complete

---

## Prerequisites Check

Before installing, check what's already present:

```bash
# Check if Bun is installed
which bun && bun --version

# Check if open-browser is installed
which openbrowser

# Check if Chromium is already available for Playwright
npx playwright install chromium --dry-run 2>/dev/null || echo "Chromium not installed"
```

---

## Step 1: Install Bun (if missing)

Bun is the recommended runtime. If `bun` is not in the PATH:

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```
Then reload the shell:
```bash
exec $SHELL
```

**Verify:**
```bash
bun --version
```

---

## Step 2: Install Open Browser

```bash
bun install -g open-browser
```

Verify:
```bash
openbrowser --help
```

---

## Step 3: Install Playwright Chromium

Open Browser uses Playwright to control the browser. Chromium must be installed:

```bash
npx playwright install chromium
```

No need to install `@playwright/test` — just the browser binary.

---

## Step 4: API Key Setup

Open Browser needs an LLM API key to think. Pick one provider and export its key:

**Anthropic (Claude) — recommended:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**OpenAI (GPT):**
```bash
export OPENAI_API_KEY="sk-..."
```

**Google (Gemini):**
```bash
export GOOGLE_AI_API_KEY="..."
```

Or create a `.env` file in the working directory:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Step 5: Using Open Browser

### One-shot task (single command, get result)
```bash
openbrowser "go to <url> and <do something>"
```

If using Anthropic's Claude model:
```bash
openbrowser --model anthropic:claude-sonnet-4-6 "go to github.com/trending and tell me the top 3 repos"
```

### Interactive REPL (live browser control)
```bash
openbrowser interactive
```
Then type commands like:
```
> goto https://example.com
> click "Sign In"
> type "hello@email.com" into email field
> extract the page content
> screenshot
```

### Common options
| Flag | Purpose |
|---|---|
| `--model <model>` | Choose LLM (default: `gpt-4o`). Use `anthropic:claude-sonnet-4-6` for Claude |
| `--headless` | Run without visible browser window (default: `true`) |
| `--step-limit <n>` | Max steps per task (default: `100`) |
| `--allowed-urls <urls>` | Whitelist domains |
| `--blocked-urls <urls>` | Blacklist domains |

---

## Step 6: Verify Everything Works

Run a quick smoke test:
```bash
openbrowser "go to example.com and tell me what the page title is"
```

If the agent navigates, reads the page, and returns "Example Domain", everything is working.

---

## Built-in Commands (Interactive Mode)

```
goto <url>                    Navigate to a URL
click <selector>              Click an element
type <text> into <selector>   Type into an input
scroll down / scroll up       Scroll the page
extract                       Extract page content as markdown
screenshot                    Take a screenshot
press key <key>               Press a keyboard key
hover <selector>              Hover over an element
wait <ms>                     Wait in milliseconds
eval <js expression>          Run JavaScript on the page
```

---

## Site Analysis & Scanning

Use these pre-built prompts to analyze, scan, audit, or inspect any website. Replace `<url>` with the target site.

### Security & Technical Scan
```bash
openbrowser "go to <url> and perform a security scan. Check: (1) Is HTTPS enforced or does HTTP redirect to HTTPS? (2) Does the site load any external scripts from third-party domains? List them. (3) Are there any visible form inputs — if so, note whether they have autocomplete=off or any CSRF-looking tokens. (4) Does the page have a Content-Security-Policy meta tag? (5) Check the console for any errors or warnings. (6) Look at all links on the page and count how many are external vs internal. Report everything in a structured format."
```

### SEO & Meta Audit
```bash
openbrowser "go to <url> and do a full SEO audit. Check: (1) Title tag content and length. (2) Meta description content and length. (3) All meta tags present (og:title, og:description, og:image, twitter:card, robots, viewport). (4) Heading structure — list all h1, h2, h3 tags and their text. (5) Does the page have structured data (JSON-LD, microdata)? (6) Are images missing alt text? List them. (7) Canonical URL. (8) Are there any broken links? Test a sample of 5-10 by checking their href attributes. Report everything in a structured format."
```

### Accessibility Check
```bash
openbrowser "go to <url> and do an accessibility analysis. Check: (1) Are all images missing alt attributes? List them. (2) Do all form inputs have associated labels? Check using the 'for' attribute or nesting. (3) Is there a 'skip to main content' link? (4) What is the color contrast situation — note any text that appears low-contrast (light gray on white, etc). (5) Are ARIA roles used? List them. (6) Can you navigate the page using Tab — are focus styles visible? (7) What is the lang attribute on the html element? (8) Are there any empty links or buttons? (9) Check heading hierarchy — are levels skipped (h1 to h3 with no h2)? Report everything in a structured format."
```

### Technology Stack Detection
```bash
openbrowser "go to <url> and detect the technology stack. Check: (1) What JavaScript framework is used? Look for React __REACT_DEVTOOLS_GLOBAL_HOOK__, Vue __vue__, Angular ng-version, or Next.js __NEXT_DATA__ in the page source and global window object. (2) What CSS framework or library? Check for Tailwind classes, Bootstrap classes, or CSS-in-JS style tags. (3) Check for analytics/tracking scripts — Google Analytics (gtag, ga), Facebook Pixel, Hotjar, etc. (4) Look at the Server header, X-Powered-By, and any generator meta tags. (5) Check for CDN usage (Cloudflare, Vercel, Netlify headers). (6) Is there a web font service (Google Fonts, Adobe Fonts)? Report everything in a structured format."
```

### Content & Structure Analysis
```bash
openbrowser "go to <url> and analyze the content and structure. Report: (1) Total word count. (2) Number of images, videos, and iframes. (3) Number of internal links vs external links. (4) Number of buttons and forms. (5) Is there a navigation menu? How many items? (6) Is there a footer? What sections does it have? (7) Does the page have a cookie consent banner? (8) Is there a search bar? (9) Does it have a responsive/mobile menu (hamburger icon)? (10) List all major sections/landmarks of the page."
```

### Full Site Audit (comprehensive)
```bash
openbrowser "go to <url> and do a comprehensive site audit covering 4 areas. SECURITY: check HTTPS, mixed content warnings in console, exposed email addresses in the page source, external scripts loaded. SEO: title, meta description, heading structure, missing alt texts, canonical URL. ACCESSIBILITY: missing labels on inputs, heading hierarchy, lang attribute, ARIA usage, focus indicators. TECH STACK: detect framework, analytics scripts, CDN, server headers. Report everything in a well-organized structured format with sections for each area."
```

### Form & Input Inspection
```bash
openbrowser "go to <url> and inspect every form on the page. For each form report: (1) The form action URL. (2) The method (GET/POST). (3) Every input field — name, type, whether it's required, and its label text. (4) Whether the form has a CSRF token hidden input. (5) Whether autocomplete is on or off. (6) Is there client-side validation? Look for 'required', 'pattern', 'minlength' attributes. (7) Check if the submit button is disabled by default. (8) Are passwords fields using autocomplete='new-password' or 'current-password'? Report everything in a structured format."
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `bun: command not found` | Re-run the Bun install script, then `exec $SHELL` |
| `openbrowser: command not found` | `bun install -g open-browser` |
| `No API key found` | `export ANTHROPIC_API_KEY=...` or create `.env` |
| `browser not found` | `npx playwright install chromium` |
| Task hangs or times out | Increase `--timeout`, reduce `--step-limit`, or try `--headless=false` to see what's happening |
| `relaxedSecurity` is off and page breaks | Some sites block headless browsers. Try adding `--headless=false` |

---

## Cost Awareness

The LLM makes an API call **per step**. A simple task (3-5 steps) costs roughly:
- GPT-4o: ~$0.01–$0.05
- Claude Sonnet: ~$0.01–$0.05

Longer tasks with many steps can reach $0.10–$0.50. The tool itself is free and MIT-licensed.

---

## How to Use This Skill

1. **Check prerequisites** — run the check commands to see what's already installed
2. **Install missing pieces** — run the install steps as bash commands (not just printed instructions)
3. **Guide API key setup** — if no key is set, tell the user where to get one (platform.openai.com, console.anthropic.com, aistudio.google.com) and ask them to provide it. Never ask the user to paste their key into the chat — instruct them to `export` it in their terminal or write to `.env`
4. **Verify the install** — run the smoke test
5. **Execute the user's task** — once set up, use the Bash tool to run `openbrowser` commands directly
