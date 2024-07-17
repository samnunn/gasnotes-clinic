importScripts('/fuzzysort.min.js')

let procedures

onmessage = (m) => {
    if (m.data['type'] == 'data_in') {
        procedures = m.data['procedures']
        
    }
    if (m.data['type'] == 'search') {
        let query = m.data['query']
        console.log(`BS: query for "${query}"`)

        let results = search(query)
        postMessage(results)
    }
}

function search(query) {
    if (!procedures) return []

    query = improveQuery(query)

    let results = fuzzysort.go(query, procedures, {
        keys: ['SurgeryProcedure'],
        limit: 10,
        scoreFn: (result) => {
            let fuzz = result.score
            let frequency = parseFloat(result.obj.frequency)
            return fuzz * frequency
        },
    })
    return results
}

function improveQuery(query) {
    for (let s of subs) {
        query = query.replace(s['pattern'], s['replacement'])
    }
    return query
}

let subs = [
    {
        pattern: /\b[LR]?TKR\b/i,
        replacement: 'total knee replacement',
    },
    {
        pattern: /\b[LR]?THR\b/i,
        replacement: 'total hip replacement',
    },
    {
        pattern: 'phaco',
        replacement: 'phako',
    },
    {
        pattern: /\bAAA\b/i,
        replacement: 'abdominal aortic aneurysm',
    },
    {
        pattern: 'cabg',
        replacement: 'coronary artery bypass graft',
    },
]