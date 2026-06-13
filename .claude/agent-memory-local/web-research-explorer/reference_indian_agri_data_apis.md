---
name: reference-indian-agri-data-apis
description: Verified endpoints/auth for Indian agri data — Agmarknet (data.gov.in), CEDA, Bhashini, Sarvam, AI4Bharat, IMD, Open-Meteo, WDRA. Tested 2026-06-13.
metadata:
  type: reference
---

Verified 2026-06-13 (knowledge cutoff Jan 2026; re-check before relying).

**Agmarknet mandi prices (data.gov.in):** resource id `9ef84268-d588-465a-a308-a864a43d0070`. Base: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=KEY&format=json&limit=N&offset=M`. Filters via `filters[state]=`, `filters[commodity]=`, etc. Public sample key documented on platform: `579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b`. Get own key: register at data.gov.in -> My Account -> Generate API key. CAVEAT: on 2026-06-13 both api.data.gov.in (502 Bad Gateway, nginx) and www.data.gov.in (timeout) were DOWN while Open-Meteo worked from same network — gateway is flaky/intermittent. MUST cache, never call live in a demo.

**CEDA Ashoka Agmarknet mirror:** has a REAL API (not just downloads). Base `https://api.ceda.ashoka.edu.in/`, Swagger at `https://api.ceda.ashoka.edu.in/documentation/`. Portal `agmarknet.ceda.ashoka.edu.in`. 300+ commodities, 2700+ mandis, 2000-present, updated MONTHLY (not daily). Non-commercial use free. Cleaned data; good for historical/backfill but monthly cadence = not real-time.

**Bhashini (ULCA/Dhruva):** Pipeline config endpoint `https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline` with headers `userID`, `ulcaApiKey`. Inference endpoint `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` with `Authorization` header (inference key from config response). Common public pipelineId `64392f96daac500b55c543cd`. taskTypes: asr, translation, tts. Free for govt-backed use but flaky/poorly documented.

**Sarvam AI:** base `https://api.sarvam.ai`. Endpoints: `/speech-to-text`, `/text-to-speech`, `/translate`, `/speech-to-text-translate`. Auth header `api-subscription-key`. Models: saaras:v3 (ASR), bulbul (TTS), mayura (translate). ₹1,000 free credits on signup. 60 req/min/key general. MOST demo-safe vernacular option.

**AI4Bharat:** IndicTrans2 (NMT, 22 langs), IndicConformer (ASR). Open weights on HuggingFace/GitHub; self-host or HF inference. No turnkey free hosted API.

**IMD:** `https://api.imd.gov.in` requires IP whitelisting + registration; not turnkey. Use Open-Meteo as fallback.

**Open-Meteo:** `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=precipitation_sum,temperature_2m_max&timezone=auto`. No key, no limits (non-commercial). Tested 200 in ~1.4s. DEMO-SAFE.

**WDRA warehouses:** No public API. PDF list at wdra.gov.in (Registered Warehouses section) + searchable web portal; must scrape/manual. eNWR repositories: NeRL (NCDEX) and CCRL (CDSL). Performance dataset on dataful.in.

**eNWR pledge loan economics:** LTV ~70% (SBI 75%); interest cap MCLR+3% banks / avg-1% coops; small/marginal farmers ~7% p.a. under interest subvention; tenure up to 12 months. CGS-NPF credit guarantee scheme launched 2024-12-16. Storage ~₹15-30/quintal/month realistic (CWC tariff revised FY24-25, 30% farmer rebate); exact per-quintal rate buried in CWC PDFs.
