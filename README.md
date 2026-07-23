# Arthur — Learning Companion for Strathmore University

Built by Tech Mindset Africa. Based on the Arthur product specification.

## Deploy to Vercel

```bash
git init && git add . && git commit -m "Arthur v2.0"
git remote add origin https://github.com/MuriithiEric/demo-tool.git
git push -u origin main --force
```

Then in Vercel → Settings → Environment Variables:
- ANTHROPIC_API_KEY = your key from console.anthropic.com

## Three modules

| Role | Features |
|---|---|
| Student | Live AI companion (S1–S13), topic progress, gap detection, study path, flag to lecturer |
| Lecturer | Class heatmap, session brief, per-student drill-down, content approval, Q&A inbox (L1–L12) |
| Head of Department | Cross-course overview, at-risk monitoring, CUE compliance, fairness & privacy audit (H1–H10) |
