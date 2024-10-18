//    ____                   _                                                     
//   | __ )  ___  __ _  __ _| | ___     ***           ****                         
//   |  _ \ / _ \/ _` |/ _` | |/ _ \   *   ***********    *                        
//   | |_) |  __/ (_| | (_| | |  __/   ***               *                         
//   |____/ \___|\__,_|\__, |_|\___|  *    ***********    *                        
//                     |___/           ****           ****                         

let staleBones = {}

onmessage = (m) => {
    // console.info(`beagle-message-received`, m)
    let newBones = getBones(m.data.inputData)

    // update bones
    let newBoneNames = new Set(Object.keys(newBones))
    let staleBoneNames = new Set(Object.keys(staleBones))
    let bonesToAdd = newBoneNames.difference(staleBoneNames)
    let bonesToDelete = staleBoneNames.difference(newBoneNames)

    for (let b of bonesToAdd) {
        postMessage({
            type: 'beagle-bone-add',
            name: newBones[b].name,
            severity: newBones[b].severity,
            citation: newBones[b].citation,
        })
    }
    for (let b of bonesToDelete) {
        postMessage({
            type: 'beagle-bone-delete',
            name: staleBones[b].name,
        })
    }

    // update suggestions
    for (let nb_key in newBones) {
        let nb = newBones[nb_key]

        let staleSuggestions = staleBones[nb_key]?.suggestions || new Set()

        let suggestionsToDelete = staleSuggestions.difference(nb?.suggestions)
        let suggestionsToAdd = nb?.suggestions?.difference(staleSuggestions)

        for (let s of suggestionsToAdd) {
            postMessage({
                type: 'beagle-suggestion-add',
                bone: nb.name,
                suggestion: s,
            })
        }

        for (let s of suggestionsToDelete) {
            postMessage({
                type: 'beagle-suggestion-delete',
                bone: nb.name,
                suggestion: s,
            })
        }
    }

    // save state
    staleBones = newBones
}

// takes data, returns bones
function getBones(inputData) {
    let newBones = {}
    for (b of bones) {
        let boneDoesMatch = b.test(inputData)
        if (boneDoesMatch == true) {
            let conditionalSuggestions = b.getConditionalSuggestions(inputData)
            let allSuggestions = b.defaultSuggestions.concat(conditionalSuggestions)
            let foundBone = {
                name: b.name,
                citation: b.citation,
                severity: b.getSeverity(inputData) || 'default',
                suggestions: new Set(allSuggestions),
            }
            newBones[b.name] = foundBone
        }
    }
    return newBones
}

function runRule(rule, inputData) {
    try {
        if (rule(inputData) == true) return true
    } catch {
        return false
    }
    return false
}

function diagnosisExists(inputData, diagnosis) {
    return Object.keys(inputData).some( (k) => k.includes(diagnosis))
}

class Bone {
    constructor(name, citation, matchStrategy, matchRules, defaultSuggestions, conditionalSuggestions, severityGrades) {
        this.name = name
        this.citation = citation
        this.matchStrategy = matchStrategy
        this.matchRules = matchRules
        this.defaultSuggestions = defaultSuggestions
        this.conditionalSuggestions = conditionalSuggestions
        this.severityGrades = severityGrades
    }
    
    test(inputData) {
        if (this.matchStrategy == "all") {
            if (this.matchRules.every( (r) => runRule(r, inputData) )) return true
        } else {
            if (this.matchRules.some( (r) => runRule(r, inputData) )) return true
        }
        return false
    }

    getSeverity(inputData) {
        if (!this.severityGrades) return null
        
        for (let severityGrade of this.severityGrades) {
            if (severityGrade?.matchStrategy == "all") {
                if (severityGrade.matchRules.every( (r) => runRule(r, inputData) )) return severityGrade.name
            } else {
                if (severityGrade.matchRules.some( (r) => runRule(r, inputData) )) return severityGrade.name
            }
        }
        return null
    }
    
    getConditionalSuggestions(inputData) {
        let conditionalSuggestions = []
        for (let conditionalGroup of this.conditionalSuggestions) {
            if (conditionalGroup?.matchStrategy == "all") {
                if (conditionalGroup.matchRules.every( (r) => runRule(r, inputData) )) {
                    conditionalSuggestions = conditionalSuggestions.concat(conditionalGroup.suggestions)
                }
            } else {
                if (conditionalGroup.matchRules.some( (r) => runRule(r, inputData) )) {
                    conditionalSuggestions = conditionalSuggestions.concat(conditionalGroup.suggestions)
                }
            }
        }
        return conditionalSuggestions
    }
}

let boneData = [
    {
        name: "anonymous",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => true,
        ],
        defaultSuggestions: [
            // "foobar",
        ],
        conditionalSuggestions: [
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => parseFloat(inputData['sort-score']) > 1.5,
                ],
                suggestions: [
                    "Admit to HDU/ICU bed",
                ],
            },
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => {
                        let sort = parseFloat(inputData['sort-score'])
                        if (0.80 <= sort && sort <= 1.5) return true
                    },
                ],
                suggestions: [
                    "Admit to monitored bed",
                ],
            },
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => {
                        let age = parseInt(inputData['age'])
                        let risk = inputData['operation-risk']
                        // high risk surgery and over-45
                        if (age > 45 && risk == 'high') return true
                    },
                ],
                suggestions: [
                    "Consider pre-operative cardiac biomarker testing (troponin, BNP)",
                    "Pre-operative ECG",
                ],
            },
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => {
                        let age = parseInt(inputData['age'])
                        let risk = inputData['operation-risk']
                        // high risk surgery and over-45
                        if (age > 45 && risk == 'high') return true
                        // intermediate risk surgery and over-65
                        if (age >= 65 && risk == 'intermediate') return true
                        // intermediate risk surgery and CVD risk factors
                        let riskFactorCount = 0
                        let riskyDiagnoses = [
                            'diagnosis-t1dm',
                            'diagnosis-t2dm',
                            'diagnosis-hypertension',
                            'diagnosis-dyslipidaemia',
                        ]
                        for (let d of riskyDiagnoses) {
                            if (diagnosisExists(inputData, d)) riskFactorCount += 1
                        }
                        if (inputData['smoking'] == 'active smoker') riskFactorCount += 1

                        if (risk == 'intermediate' && riskFactorCount >= 3) return true
                        if (risk == 'intermediate' && diagnosisExists(inputData, 'diagnosis-ihd')) return true
                        if (risk == 'intermediate' && diagnosisExists(inputData, 'diagnosis-ccf')) return true
                    },
                ],
                suggestions: [
                    "Consider pre-operative cardiac biomarker testing (troponin, BNP)",
                    "Pre-operative ECG",
                    "Consider pre-operative cardiac functional testing (e.g. MPS, stress TTE)",
                ],
            },
        ],
        severityGrades: [
        ],
    },
    {
        name: "PONV",
        citation: "https://www.ashp.org/-/media/assets/policy-guidelines/docs/endorsed-documents/endorsed-documents-fourth-consensus-guidelines-postop-nausea-vomiting.pdf",
        matchStrategy: "any",
        matchRules: [
            (inputData) => parseInt(inputData['apfel-score']) > 0,
        ],
        defaultSuggestions: [
            // "Minimise use of nitrous oxide, volatile anaesthetics, and high-dose neostigmine",
            // "Utilise regional anaesthesia if possible",
            "Maximise opioid-sparing analgesia",
        ],
        conditionalSuggestions: [
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => [1,2].includes(parseInt(inputData['apfel-score'])),
                ],
                suggestions: [
                    "Give two anti-emetics",
                ],
            },
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => [3,4].includes(parseInt(inputData['apfel-score'])),
                ],
                suggestions: [
                    "Give 3-4 anti-emetics",
                ],
            },
        ],
        // 0 1 low
        // 2 medium
        // 3 high
        severityGrades: [
            {
                name: "high risk",
                matchStrategy: "any",
                matchRules: [
                    (inputData) => [3,4].includes(parseInt(inputData['apfel-score'])),
                ],
            },
            {
                name: "medium risk",
                matchStrategy: "any",
                matchRules: [
                    (inputData) => [2].includes(parseInt(inputData['apfel-score'])),
                ],
            },
            {
                name: "low risk",
                matchStrategy: "any",
                matchRules: [
                    (inputData) => [0,1].includes(parseInt(inputData['apfel-score'])),
                ],
            },
        ],
    },
    {
        name: "T2DM",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-t2dm'),
            // (inputData) => /sulin|metf|iclaz|glipin|glargine|janu|floz|xig|jardia/i.test(inputData['rx']),
            // (inputData) => inputData['rcri-insulin'] == true,
        ],
        defaultSuggestions: [
            // "Default suggestion for diabetic patients",
            "BSL on arrival",
        ],
        conditionalSuggestions: [
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => parseFloat(inputData['hba1c']) >= 9.1,
                ],
                suggestions: [
                    "Consider endocrinology referral for pre-operative optimisation",
                ],
            },
        ],
        severityGrades: [
        ],
    },
    {
        name: "T1DM",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-t1dm'),
            // (inputData) => Object.keys(inputData).some( (k) => k.includes('diagnosis-t1dm') ),
            // (inputData) => /sulin|metf|iclaz|glipin|glargine|janu|floz|xig|jardia/i.test(inputData['rx']),
            // (inputData) => inputData['rcri-insulin'] == true,
        ],
        defaultSuggestions: [
            // "Default suggestion for diabetic patients",
            "BSL and ketones on arrival",
        ],
        conditionalSuggestions: [
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => parseFloat(inputData['hba1c']) >= 9.1,
                ],
                suggestions: [
                    "Consider endocrinology referral for pre-operative optimisation",
                ],
            },
        ],
        severityGrades: [
        ],
    },
    {
        name: "SGTL2i in use",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /floz|xig|jard/i.test(inputData['rx']),
        ],
        defaultSuggestions: [
            // "Default suggestion for patients on SGLT2i",
        ],
        conditionalSuggestions: [
        ],
    },
    {
        name: "Potentially challenging airway",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => parseInt(inputData['mallampati']) >= 3,
            (inputData) => parseInt(inputData['mouth-opening']) <= 3,
            (inputData) => parseInt(inputData['tmd']) <= 6,
            (inputData) => inputData['jaw-protrusion'].toLowerCase() == "c",
            (inputData) => /diff|2|two|gued|opa|npa|naso|oro|fail/i.test(inputData['bvm']),
            (inputData) => /diff|seal|poor|fail/i.test(inputData['lma']),
            (inputData) => /diff|3|4|AFO|CICO|FONA|fail/i.test(inputData['ett']),
            (inputData) => /moderate|severe|immobile/i.test(inputData['neckrom']),
            (inputData) => /won/i.test(inputData['beard']),
            (inputData) => /y/i.test(inputData['diagnosis-rheumatoid-arthritis']['C-Spine involvement'])
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Possible difficult FONA",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /diff|impalpable/i.test(inputData['cricothyroid']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
    },
    {
        name: "Known analphylaxis",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-anaphylaxis'),
            (inputData) => /anaph|(?<!pro.+)ylaxis|(?<!pro.+)ylact/i.test([inputData['pmhx'], inputData['rx'], inputData['allergies']].join(' ')),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Antibiotic allergy",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /cilli|illin|cefa|cepha|mycin|ocin/i.test(inputData['allergies']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Obesity",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => parseFloat(inputData['bmi']) >= 30,
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "GORD",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-gord'),
            (inputData) => /yes/i.test(inputData['gord']),
            (inputData) => /prazol|somac|nexium|pariet|esopre|sozol/i.test(inputData['rx']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Diagnosed OSA",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-osa'),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "OSA Risk Factors",
        citation: "",
        matchStrategy: "all",
        matchRules: [
            // do *not* match when OSA has already been diagnosed
            (inputData) => !diagnosisExists(inputData, 'diagnosis-osa'),
            (inputData) => {
                // Rule 1: score ≥ 5
                if (parseInt(inputData['stopbang-score']) >= 5) return true

                // Rule 2: any of the BNG criteria + ≥ 2 of the STOP criteria
                let stopCriteria = [inputData['snorer'], inputData['daytime-tiredness'], inputData['observed-apnoea'], inputData['hypertensive']]
                let highRiskCriteria = [inputData['stopbang-bmi-35'], inputData['stopbang-neck'], inputData['stopbang-sex']] // BANG criteria minus age
                stopCriteria = stopCriteria.filter((v) => v == true)
                highRiskCriteria = highRiskCriteria.filter((v) => v == true)
                if (stopCriteria.length >= 2 && highRiskCriteria.length >= 1) return true
                
                // otherwise return false
                return false
            },
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Impaired renal function",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-ckd'),
            (inputData) => /\d{3}/i.test(inputData['uec']),
            (inputData) => inputData['rcri-creatinine'] == true,
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Active smoker",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /active/i.test(inputData['smoking']),
        ],
        defaultSuggestions: [
            "Advise to cease smoking before surgery",
            "Referral for assistance with smoking cessation",
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Anticoagulated",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /y/i.test(inputData['diagnosis-atrial-fibrillation']['Anticoagulated']),
            (inputData) => /xab|atran|warf|couma|eliq|xera|pradax/i.test(inputData['rx']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Poor cardiorespiratory fitness",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /less/i.test(inputData['mets']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Unable to lay flat",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /not/i.test(inputData['flat']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Opioid tolerance",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /morph|trama|tapen|lexi|bupr|adone|targin|oxyc/i.test(inputData['rx']),
            (inputData) => /y/i.test(inputData['diagnosis-chronic-pain']['Opioid tolerance']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Chronic pain",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /morph|trama|tapen|lexi|bupr|adone|targin|oxyc/i.test(inputData['rx']),
            (inputData) => diagnosisExists(inputData, 'diagnosis-chronic-pain'),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Ischaemic heart disease",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-ihd'),
            (inputData) => inputData['rcri-ihd'] == true,
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Heart failure",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            // (inputData) => /hf|hfref|hfpef|heart failure|ccf|chf/i.test(inputData['pmhx']),
            (inputData) => diagnosisExists(inputData, 'diagnosis-ccf'),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Recent illness",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /y/i.test(inputData['recently-ill']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "NSAID-Reactive Asthma",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /y/i.test(inputData['diagnosis-asthma']['NSAID reactive']),
        ],
        defaultSuggestions: [
            "Avoid NSAIDs",
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "Suboptimal Asthma Control",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => {
                if (/y/i.test(inputData['diagnosis-asthma']['Daytime symptoms'])) return true
                if (/y/i.test(inputData['diagnosis-asthma']['Night symptoms'])) return true
                if (/y/i.test(inputData['diagnosis-asthma']['Heavy reliever use'])) return true
                if (/y/i.test(inputData['diagnosis-asthma']['Activity limitation'])) return true
                return false
            },
        ],
        defaultSuggestions: [
            "Consider referral for optimisation of asthma control"
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        name: "ICD in situ",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-icd'),
        ],
    },
    {
        name: "Pacemaker in situ",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-pacemaker'),
        ],
    },
    {
        name: "Immune Suppressed",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /y/i.test(inputData['diagnosis-rheumatoid-arthritis']['Immune suppressed'])
        ],
    },
    {
        name: "COPD",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-copd')
        ],
    },
    {
        name: "Aortic Stenosis",
        citation: "",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-aortic-stenosis')
        ],
    },
    // {
    //     name: "Cardiovascular Disease",
    //     citation: "https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines",
    //     matchStrategy: "any",
    //     matchRules: [
    //         (inputData) => true,
    //     ],
    //     defaultSuggestions: [
    //         // "foobar",
    //     ],
    //     conditionalSuggestions: [
    //         {
    //             matchStrategy: "all",
    //             matchRules: [
    //                 (inputData) => inputData['operation-risk'] == 'high',
    //                 (inputData) => parseInt(inputData['age']) > 45,
    //             ],
    //             suggestions: [
    //                 "Recommendations: over 45 and high risk",
    //             ],
    //         },
    //     ],
    //     severityGrades: [
    //     ],
    // },
]

let bones = []
for (b of boneData) {
    // provide default empty array from non-essential items
    bones.push(new Bone(b.name, b.citation, b.matchStrategy, b.matchRules, b.defaultSuggestions || [], b.conditionalSuggestions || [], b.severityGrades || []))
}