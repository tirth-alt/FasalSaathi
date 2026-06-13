# Agri Market Fairness — Deep Brainstorm (research-backed)

*Research date: 2026-06-10. Built from live web research; sources at bottom.*

---

## 1. The core finding: India's agri problem is NOT missing data

Every piece of information your idea wants to give farmers **already exists in a government system**:

| Need | Existing system | Why it fails the farmer |
|---|---|---|
| Today's fair price | Agmarknet (daily min/max/modal prices, 200+ commodities, public API on data.gov.in) | Farmer doesn't know it exists; it's a portal in English; quotes mandi price, not his *net* price after transport/commission; patchy mandi coverage |
| Sell at a fair venue | eNAM (online inter-mandi auctions) | Only ~23% of APMCs connected; remote buyers won't bid without trusted quality assaying; arhatiyas resist; inter-state trade actually **declined** in FY25 |
| Price floor | MSP | Only ~6% of farmers benefit from MSP procurement (NSO SAS); only 23.5% of farmers are even **aware** MSP exists |
| Store instead of distress-sell | WDRA warehouses + eNWR pledge loans | Warehouse-receipt finance is ~0.5% of warehouse capacity; IIM-B (2022): main users are **traders, not farmers** |
| Scientific fertilizer use | Soil Health Cards (issued at scale) | Only ~41% of recipients follow recommendations. IDinsight RCT: farmer **comprehension** of the card was 0.5%; a redesigned card raised it to 33%. The data was right; the communication failed |
| Weather-based crop advisories | IMD Agromet (district advisories, Meghdoot app) | Dissemination is SMS/PDF bulletins; generic per-district, not per-farmer; low awareness |

**The system's missing layer is comprehension + integration + timing — not data.**
That's precisely what an LLM is good at. This reframing is the foundation of the idea.

## 2. Why farmers actually get unfair prices (root causes, ranked)

1. **They can't wait.** Harvest = cash crunch (loan repayments, next season's inputs). Everyone sells in the same 2–3 week glut window, prices crater, traders know it. This is *distress selling* — the #1 mechanism of exploitation.
2. **They can't walk away.** The arhatiya (commission agent) is often also the farmer's informal lender. Debt-tied farmers must sell through *their* agent at *his* mandi. No outside option = no negotiating power.
3. **They don't know the number.** Without today's modal price, a farmer can't tell a fair quote from a lowball. (A J-PAL study found SMS price info measurably improved farmers' *negotiation* outcomes — information works, but only at the moment of negotiation.)
4. **Grading is opaque.** "Your wheat has moisture, 20% cut" — quality disputes are settled by eye, by the buyer's man. The farmer has no evidence to push back.
5. **Cartel/ring bidding at mandis.** Traders coordinate; eNAM was supposed to fix this with remote bidders but stalled on assaying trust.

## 3. What a hackathon product CANNOT fix (be honest in the pitch)

- **The arhatiya credit-lock.** Breaking it needs alternative credit at scale (that's Arya.ag's, Samunnati's, and the eNWR rail's job, over years).
- **APMC/state politics & cartels.** eNAM stalled for institutional reasons; an app won't de-cartel a mandi.
- **MSP policy.** Legislative.

## 4. What it CAN fix — and the wedge

**The single highest-leverage moment is the post-harvest decision:**
> *"Crop is ready. Do I sell today? At which mandi? Or store it — where, at what cost — and borrow against it for the cash I need right now?"*

Today a farmer would need five portals, in English, plus a loan officer, to answer this. Nobody — government or startup — has packaged that **one decision** into one vernacular conversation. That's the product.

### The idea: **FasalSaathi** — a vernacular voice agent for the post-harvest decision
*(works on PayBazaar or Open track; also defensible as MarketWatch "market intelligence for the smallest SMB there is — the farmer")*

**Module 1 — Bhav Check (fair-price compass, the daily-use hook)**
- Voice: *"Soyabean ka bhav kya hai?"* → modal prices at the 5 nearest mandis (Agmarknet API), **transport-adjusted to a net-in-hand figure per quintal**.
- Negotiation mode: *"Vyapari 4,200 bol raha hai"* → *"Aaj Dewas mandi ka bhav 4,650 hai. Ye offer 10% kam hai. Itna bolo..."* — the J-PAL-validated mechanism: information delivered **at the moment of negotiation**.
- 7/30-day trend + simple seasonal pattern ("prices typically rise 8% in the 4 weeks after harvest glut").

**Module 2 — Bech ya Rakh? (sell-or-store decision engine, the differentiator)**
- Inputs: crop + quantity (voice), current mandi prices + trend, IMD district forecast (rain coming → quality risk if stored open / price spike signal), nearby WDRA/PACS warehouse + storage cost, eNWR pledge-loan math, and crucially the farmer's **cash need**: *"Kitna paisa abhi chahiye?"*
- Output, in dialect, with arithmetic shown: *"Mandi aaj ₹4,650. Godown 6km (Khargone PACS), ₹9/quintal/month. Pledge loan se ₹35,000 abhi mil sakta hai — aapki zaroorat ₹30,000 hai. 3 hafte ruko: anumaanit faayda ₹6,800. Risk: agar bhav gire to..."*
- This directly attacks **distress selling** — the #1 exploitation mechanism — and it's the module nobody else will build, because it requires composing four data sources into one decision.

**Module 3 — Samjhao (comprehension layer for what already exists)**
- Photograph your Soil Health Card → explained in dialect with a concrete shopping list ("is baar DAP 1 bori kam, urea ki jagah..."). The IDinsight RCT proves comprehension is the broken link (0.5% → 33% with mere redesign; an LLM conversation goes further).
- IMD agromet advisory for your district, read out as a conversation, not a PDF.
- *"MSP kya hai, mujhe mil sakta hai?"* — scheme awareness (recall: 76.5% of farmers don't know MSP exists).

**Why this respects your "minimal change to the current system" constraint**
- It does **not** ask anyone to change behavior except the farmer pressing one button. No new marketplace, no bypassing mandis or agents, no regulatory approval.
- It **rides the rails the government is currently building**: Agmarknet (data), WDRA/eNWR (storage+credit), the 70-MMT PACS godown plan (73,492 PACS sanctioned as of mid-2025 — a distribution network being born), AgriStack farmer IDs, Bhashini (vernacular voice).
- Long-run integration story: distribute **through PACS/FPOs** (the trust node; DeHaat's lesson — last mile needs a human institution), and as PACS godowns come online, FasalSaathi is the demand-side app that fills them.

**Why it isn't RML (the canonical failed price-info app)**
RML proved farmers won't pay for *information they can't act on*. FasalSaathi differs on all three failure axes: (1) it's voice-vernacular, not SMS-text; (2) it converts info into a *decision with the cash problem addressed* (pledge-loan path), not just a number; (3) monetization is via FPO/PACS/bank channel (lead-gen for pledge loans, storage utilization), never the farmer's pocket.

## 5. Honest risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Agmarknet data is patchy/stale for some mandis | High | Demo with 3–4 commodities in districts with reliable reporting (soybean–MP, onion–Maharashtra, wheat–MP/UP); show data-age labels in UI |
| Vernacular ASR quality | Med | Bhashini/AI4Bharat APIs online; constrain grammar; on-device Whisper-small for offline fallback |
| Sell-or-store advice can be wrong → trust damage | Med | Always show the arithmetic + ranges, never a bare command; frame as "calculation, not prediction" |
| WDRA warehouse directory has no clean API | Med | Scrape/cache the registered-warehouse list for demo districts |
| "Farmers don't have smartphones" objection | Low | 500M+ smartphones; target the household's young member + FPO/PACS operator as proxy users — that's how real adoption works anyway |

## 6. Hackathon fit (iQOO rubric)

- **Phone-first (25%):** voice-first vernacular UI; mic is the interface; on-device LLM answers over *cached* price/advisory data **offline** — rural connectivity makes this justification genuine, not theatrical. Airplane-mode demo: ask price trend + sell-or-store in Hindi, get a full reasoned answer.
- **On-device + cloud hybrid:** on-device model (Gemma 3 1B int4) for Q&A over cached data and SHC explanation; cloud only for nightly data refresh. Privacy/cost story is clean.
- **OfficeKit (25%):** FPO/PACS operator dashboard on laptop — district price trends, member-wise storage positions, weekly vernacular brief generation.
- **AI-native (20%):** the product IS the agent — multi-source reasoning (price+weather+storage+credit) composed into one decision; prompt-engineering depth is showable.
- **Problem fit (20%):** "real Indian SMB/farmer" — literally the brief. The 6%-MSP and 0.5%-comprehension numbers make a devastating pitch open.
- **MarketWatch framing if you choose that track:** Price Agent (Agmarknet), Weather Agent (IMD), Storage Agent (WDRA/PACS), Strategy Agent (the decision synthesis) — a legitimate four-agent system with a unified mobile surface.

## 7. The alternative issue worth considering (you asked)

**Quality-grading opacity** — exploitation vector #4. A photo-based grain-grading second opinion ("FasalLens"): farmer photographs his wheat/soybean sample; vision model estimates grade-relevant features (foreign matter, shrivelled grain, moisture proxy); produces a shareable "evidence card" to contest arbitrary deductions. Pairs beautifully with FasalSaathi as a stretch module, and assaying-trust is exactly what stalled eNAM. Riskier as the *core* product (vision model accuracy in 30h; calibration), but as Module 4 it's a judge-wower.

## 8. Sources

- [Rau's IAS — Inter-state trade on e-NAM declined in FY25](https://compass.rauias.com/current-affairs/inter-state-trade-electronic-national-agriculture-market-e-nam-declined-fy25/)
- [NAARM — Strengthening e-NAM in India (assaying, arhatiya resistance)](https://naarm.org.in/wp-content/uploads/2021/07/2020_eNAM_Report.pdf)
- [Foundation for Agrarian Studies — SAS on MSP & procurement (~6% benefit)](https://fas.org.in/what-does-the-situation-assessment-survey-say-about-msp-and-procurement-operations/)
- [Down To Earth — NSO survey: most farmers sell in local markets](https://www.downtoearth.org.in/agriculture/nso-survey-most-farmers-selling-in-local-markets-government-agencies-procure-the-least-79005)
- [The Wire — Scaling up warehousing finance (eNWR at ~0.5% of capacity; IIM-B trader finding)](https://m.thewire.in/article/agriculture/scaling-up-warehousing-finance-can-empower-farmers-in-the-long-run/amp)
- [IMPRI — Warehousing finance as catalyst for farmer empowerment](https://www.impriindia.com/insights/warehousing-finance-farmer-empowerment/)
- [CSISA/IDinsight — Evaluation of Soil Health Card from users' perspectives (comprehension RCT)](https://csisa.org/wp-content/uploads/sites/2/2018/05/SHC-Research-Note-12.pdf)
- [Springer — Farmers' response to SHC recommendations (~41% adoption)](https://link.springer.com/article/10.1007/s10705-025-10445-1)
- [Ministry of Cooperation — World's largest grain storage plan (PACS)](https://www.cooperation.gov.in/worlds-largest-grain-storage-plan-cooperative-sector-0)
- [PIB — Grain storage plan progress (73,492 PACS sanctioned)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2146718)
- [data.gov.in — Current daily mandi prices dataset/API](https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi)
- [CEDA Ashoka — cleaned Agmarknet data mirror](https://agmarknet.ceda.ashoka.edu.in/)
- [J-PAL — SMS price info improves farmer negotiations](https://www.povertyactionlab.org/evaluation/improving-price-negotiations-and-profits-through-sms-based-agricultural-information)
- [Reuters Market Light — Wikipedia (history of the canonical price-info app)](https://en.wikipedia.org/wiki/Reuters_Market_Light)
- [Bhashini APIs — developer docs (ASR/TTS, 22 languages, free tier)](https://bhashini.gitbook.io/bhashini-apis)
- [Agri Stack — farmer registry status](https://agristack.gov.in/)
- [Vajiram — AgriStack overview & criticism](https://vajiramandravi.com/current-affairs/agristack/)
