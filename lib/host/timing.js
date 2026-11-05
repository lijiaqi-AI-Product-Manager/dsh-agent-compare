export function sessionTiming(events) {
    const steps = new Map(), calls = new Map();
    const seenSteps = new Set(), seenCalls = new Set();
    const stepIntervals = [], toolIntervals = [];
    const tools = new Map();
    let incomplete = 0;
    const validTime = (time) => typeof time === 'number' && Number.isSafeInteger(time) && time >= 0;
    const keyOf = (data) => Number.isSafeInteger(data?.turn) && data.turn >= 0 && Number.isSafeInteger(data?.step) && data.step >= 0 ? `${data.turn}/${data.step}` : undefined;
    for (const event of events) {
        if (!['step/start', 'step/end', 'tool/call', 'tool/result'].includes(event.type))
            continue;
        if (!validTime(event.time)) {
            incomplete++;
            continue;
        }
        const data = event.data;
        if (event.type.startsWith('step/')) {
            const key = keyOf(data);
            if (!key) {
                incomplete++;
                continue;
            }
            if (event.type === 'step/start') {
                if (seenSteps.has(key)) {
                    incomplete++;
                    continue;
                }
                seenSteps.add(key);
                steps.set(key, event.time);
            }
            else {
                const start = steps.get(key);
                if (start === undefined || event.time < start) {
                    incomplete++;
                    continue;
                }
                stepIntervals.push([start, event.time]);
                steps.delete(key);
            }
        }
        else if (event.type === 'tool/call') {
            const id = data?.callId;
            if (typeof id !== 'string' || !id || seenCalls.has(id) || typeof data.name !== 'string' || !data.name || data.name.length > 200) {
                incomplete++;
                continue;
            }
            seenCalls.add(id);
            calls.set(id, { at: event.time, name: data.name });
            const summary = tools.get(data.name) ?? { calls: 0, completed: 0, intervals: [] };
            summary.calls++;
            tools.set(data.name, summary);
        }
        else {
            const id = data?.message?.toolCallId, start = calls.get(id);
            if (!start || event.time < start.at) {
                incomplete++;
                continue;
            }
            const interval = [start.at, event.time], summary = tools.get(start.name);
            toolIntervals.push(interval);
            summary.completed++;
            summary.intervals.push(interval);
            calls.delete(id);
        }
    }
    incomplete += steps.size + calls.size;
    const measured = union(stepIntervals), toolsMeasured = union(toolIntervals);
    const stepMs = duration(measured), toolMs = duration(toolsMeasured);
    let overlapMs = 0, i = 0, j = 0;
    while (i < measured.length && j < toolsMeasured.length) {
        const [a, b] = measured[i], [c, d] = toolsMeasured[j];
        overlapMs += Math.max(0, Math.min(b, d) - Math.max(a, c));
        if (b <= d)
            i++;
        else
            j++;
    }
    return {
        ...(stepIntervals.length ? { stepMs, otherStepMs: stepMs - overlapMs } : {}),
        ...(toolIntervals.length || (stepIntervals.length && !incomplete && !seenCalls.size) ? { toolMs } : {}),
        completedSteps: stepIntervals.length, completedCalls: toolIntervals.length, incomplete,
        tools: [...tools].map(([name, value]) => ({ name, calls: value.calls, completed: value.completed, ...(value.completed ? { wallMs: duration(union(value.intervals)) } : {}) })),
    };
}
function union(intervals) {
    const result = [];
    for (const [a, b] of [...intervals].sort((a, b) => a[0] - b[0])) {
        const last = result.at(-1);
        if (last && a <= last[1])
            last[1] = Math.max(last[1], b);
        else
            result.push([a, b]);
    }
    return result;
}
function duration(intervals) { return intervals.reduce((sum, [a, b]) => sum + b - a, 0); }
