// Read a private session export without printing prompts, arguments or paths.
import { readFile, stat } from 'node:fs/promises'
import { sessionTiming } from '../lib/host/timing.js'
const file = process.argv[2]
if (!file) throw new Error('Provide a session event JSON array or a JSONL export')
if ((await stat(file)).size > 64 * 1024 * 1024) throw new Error('Session export exceeds the 64 MiB read limit')
const text = await readFile(file, 'utf8')
let events
try { const value = JSON.parse(text); events = Array.isArray(value) ? value : value.events }
catch { events = text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)) }
if (!Array.isArray(events) || events.some(event => !event || typeof event.type !== 'string')) throw new Error('Invalid session event export')
console.log(JSON.stringify({ schema: 'agentcompare.session-timing/v1', ...sessionTiming(events), note: 'Intervals use recorded event timestamps and unions for overlapping calls. Other step time includes model, queue and host work; it is not pure model waiting. Incomplete events remain explicitly unmeasured.' }, null, 2))
