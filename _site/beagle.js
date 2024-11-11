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
    let newBoneIDs = new Set(Object.keys(newBones))
    let staleBoneIDs = new Set(Object.keys(staleBones))
    let bonesToAdd = newBoneIDs.difference(staleBoneIDs)
    let bonesToDelete = staleBoneIDs.difference(newBoneIDs)
    let bonesToUpdate = [...staleBoneIDs.intersection(newBoneIDs)]
        bonesToUpdate = bonesToUpdate.filter((b) => staleBones[b].name != newBones[b].name )

    // console.info('bonesToAdd', bonesToAdd)
    // console.info('bonesToDelete', bonesToDelete)
    // console.info('bonesToUpdate', bonesToUpdate)

    // ADD
    for (let b of bonesToAdd) {
        postMessage({
            type: 'beagle-bone-add',
            name: newBones[b].name,
            id: newBones[b].id,
            citation: newBones[b].citation,
            auto_hide: newBones[b].auto_hide,
        })
    }
    // DELETE
    for (let b of bonesToDelete) {
        postMessage({
            type: 'beagle-bone-delete',
            id: staleBones[b].id,
            name: staleBones[b].name,
        })
    }
    // UPDATE
    for (let b of bonesToUpdate) {
        postMessage({
            type: 'beagle-bone-update',
            id: newBones[b].id,
            name: newBones[b].name,
        })
    }


    // suggestions
    for (let nb_key in newBones) {
        let nb = newBones[nb_key]

        let staleSuggestions = staleBones[nb_key]?.suggestions || new Set()

        let suggestionsToDelete = staleSuggestions.difference(nb?.suggestions)
        let suggestionsToAdd = nb?.suggestions?.difference(staleSuggestions)

        for (let s of suggestionsToAdd) {
            postMessage({
                type: 'beagle-suggestion-add',
                bone: nb.id,
                suggestion: s.name,
                citation: s.citation,
            })
        }

        for (let s of suggestionsToDelete) {
            postMessage({
                type: 'beagle-suggestion-delete',
                bone: nb.id,
                suggestion: s.name,
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
            let name
            name = b.static_name
            try {
                name = b.dynamic_name(inputData)
            } catch (e) {
                console.info(`Failed to execute dynamic_name for "${b.id}" (function may have failed or be non-existent). Assigning static_name.`, e)
            }

            let foundBone = {
                name: name,
                id: b.id,
                citation: b.citation,
                suggestions: new Set(allSuggestions),
                auto_hide: b.auto_hide,
            }
            newBones[b.id] = foundBone
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

function gradeOSA(inputData) {
    let score = inputData['stopbang-score']
    let risk
    if (score >= 0 && score <=2) risk = 'low'
    if (score >= 3 && score <=4) risk = 'intermediate'
    if (score >= 5) risk = 'high'


    let stopCriteria = [inputData['snorer'], inputData['daytime-tiredness'], inputData['observed-apnoea'], inputData['hypertensive']]
    let highRiskCriteria = [inputData['stopbang-bmi-35'], inputData['stopbang-neck'], inputData['stopbang-sex']] // BANG criteria minus age
    stopCriteria = stopCriteria.filter((v) => v == true)
    highRiskCriteria = highRiskCriteria.filter((v) => v == true)
    if (stopCriteria.length >= 2 && highRiskCriteria.length >= 1) risk = 'high'

    return risk
}

class Bone {
    constructor(dynamic_name, static_name, id, auto_hide, matchStrategy, matchRules, defaultSuggestions, conditionalSuggestions, severityGrades) {
        this.dynamic_name = dynamic_name
        this.static_name = static_name
        this.id = id
        this.auto_hide = auto_hide == true
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
        static_name: "Additional Suggestions",
		id: "beagle-anonymous",
        auto_hide: true,
        matchStrategy: "any",
        matchRules: [
            (inputData) => true,
        ],
        defaultSuggestions: [
            // {
            //     'name': "foobar",
            // }
        ],
        conditionalSuggestions: [
            // {
            //     matchStrategy: "any",
            //     matchRules: [
            //         (inputData) => parseFloat(inputData['sort-score']) > 1.5,
            //     ],
            //     suggestions: [
            //         {
            //             name: "Generic suggestion",
            //         }
            //     ],
            // },
        ],
        severityGrades: [
        ],
    },
    {
        // name: "High predicted mortality",
        dynamic_name: (inputData) => {
            let sort = parseFloat(inputData['sort-score']).toFixed(2)
            return `High predicted mortality (SORT ${sort}%)`
        },
        static_name: "High predicted mortality",
		id: "sort-high",
        matchStrategy: "any",
        matchRules: [
            (inputData) => parseFloat(inputData['sort-score']) >= 0.80,
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
                    {
                        name: "Admit to HDU/ICU bed",
                    }
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
                    {
                        name: "Admit to monitored bed",
                    }
                ],
            },
        ],
        severityGrades: [
        ],
    },
    {
        static_name: "High MACE risk",
		id: "beagle-mace-risk",
        auto_hide: true,
        matchStrategy: "any",
        matchRules: [
            (inputData) => true,
        ],
        defaultSuggestions: [
            // "foobar",
        ],
        conditionalSuggestions: [
            // {
            //     matchStrategy: "any",
            //     matchRules: [
            //         (inputData) => {
            //             let age = parseInt(inputData['age'])
            //             let risk = inputData['operation-risk']
            //             // high risk surgery and over-45
            //             if (age > 45 && risk == 'high') return true
            //         },
            //     ],
            //     suggestions: [
            //         {
            //             name: "Pre-operative cardiac biomarker testing (troponin, BNP)",
            //             citation: 'esc-2022',
            //         },
            //         {
            //             name: "Pre-operative screening ECG",
            //             citation: 'esc-2022',
            //         }
            //     ],
            // },
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
                    {
                        name: "Consider pre-operative cardiac biomarker testing (troponin, BNP)",
                        citation: 'esc-2022',
                    },
                    {
                        name: "Pre-operative ECG",
                        citation: 'esc-2022',
                    },
                    {
                        name: "Consider pre-operative cardiac functional testing (e.g. MPS, stress TTE)",
                        citation: 'esc-2022',
                    },
                ],
            },

        ]
    },
    {
        static_name: "High PONV risk",
        dynamic_name: (inputData) => {
            return `High PONV risk (Apfel ${parseInt(inputData['apfel-score'])}/4)`
        },
		id: "beagle-ponv",
        citation: "https://www.ashp.org/-/media/assets/policy-guidelines/docs/endorsed-documents/endorsed-documents-fourth-consensus-guidelines-postop-nausea-vomiting.pdf",
        matchStrategy: "any",
        matchRules: [
            (inputData) => parseInt(inputData['apfel-score']) > 2,
        ],
        defaultSuggestions: [
            // "Minimise use of nitrous oxide, volatile anaesthetics, and high-dose neostigmine",
            // "Utilise regional anaesthesia if possible",
            {
                name: "Maximise opioid-sparing analgesia",
                citation: 'apfel-interpretation',
            },
        ],
        conditionalSuggestions: [
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => [1,2].includes(parseInt(inputData['apfel-score'])),
                ],
                suggestions: [
                    {
                        name: "Give two anti-emetics",
                        citation: 'apfel-interpretation',
                    },
                ],
            },
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => [3,4].includes(parseInt(inputData['apfel-score'])),
                ],
                suggestions: [
                    {
                        name: "Give 3-4 anti-emetics",
                        citation: 'apfel-interpretation',
                    },
                ],
            },
        ],
        severityGrades: [],
    },
    {
        static_name: "T2DM",
		id: "beagle-t2dm",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-t2dm'),
            // (inputData) => /sulin|metf|iclaz|glipin|glargine|janu|floz|xig|jardia/i.test(inputData['rx']),
            // (inputData) => inputData['rcri-insulin'] == true,
        ],
        defaultSuggestions: [
            // "Default suggestion for diabetic patients",
            {
                name: "Check BSL on arrival",
                citation: 'ads-anzca-2022',
            },
        ],
        conditionalSuggestions: [
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => parseFloat(inputData['hba1c']) >= 9.1,
                ],
                suggestions: [
                    {
                        name: "Consider endocrinology referral for pre-operative optimisation",
                        citation: 'ads-anzca-2022',
                    },
                ],
            },
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => {
                        if (inputData['hba1c'] == '' || inputData['hba1c'] == undefined) {
                            return true 
                        } else {
                            return false
                        }
                    },
                ],
                suggestions: [
                    {
                        name: "Check HbA1c",
                    },
                ],
            },
        ],
        severityGrades: [
        ],
    },
    {
        static_name: "T1DM",
		id: "beagle-t1dm",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-t1dm'),
        ],
        defaultSuggestions: [
            {
                name: "Check BSL and ketones on arrival",
                citation: 'ads-anzca-2022',
            },
        ],
        conditionalSuggestions: [
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => parseFloat(inputData['hba1c']) >= 9.1,
                ],
                suggestions: [
                    {
                        name: "Consider endocrinology referral for pre-operative optimisation",
                        citation: 'ads-anzca-2022',
                    },
                ],
            },
            {
                matchStrategy: "any",
                matchRules: [
                    (inputData) => {
                        if (inputData['hba1c'] == '' || inputData['hba1c'] == undefined) {
                            return true 
                        } else {
                            return false
                        }
                    },
                ],
                suggestions: [
                    {
                        name: "Check HbA1c",
                    },
                ],
            },
        ],
        severityGrades: [
        ],
    },
    {
        static_name: "SGTL2i in use",
		id: "beagle-flozin",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /floz|xig|jard/i.test(inputData['rx']),
        ],
        defaultSuggestions: [
            // "Default suggestion for patients on SGLT2i",
            {
                name: "Check ketones on arrival",
                citation: 'ads-anzca-2022',
            },
        ],
        conditionalSuggestions: [
        ],
    },
    {
        static_name: "Potentially challenging airway",
		id: "beagle-difficult-airway",
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
        static_name: "Possible difficult FONA",
		id: "beagle-difficult-fona",
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
        static_name: "Known analphylaxis",
		id: "beagle-analphylaxis",
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
        static_name: "Antibiotic allergy",
		id: "beagle-antibiotic-allergy",
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
        static_name: "Obesity",
		id: "beagle-obesity",
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
        static_name: "GORD",
		id: "beagle-gord",
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
        static_name: "OSA",
        dynamic_name: (inputData) => {
            if (diagnosisExists(inputData, 'diagnosis-osa')) {
                if (/y/i.test(inputData['diagnosis-osa']['CPAP'])) {
                    return "Diagnosed OSA (on CPAP)"
                } else {
                    return "Diagnosed OSA (not on CPAP)"
                }
            }
            let risk = gradeOSA(inputData)
            return `${risk.charAt(0).toUpperCase() + risk.slice(1)} OSA risk`
        },
		id: "beagle-osa-stopabang-risk",
        matchStrategy: "any",
        matchRules: [
            (inputData) => {
                let risk = gradeOSA(inputData)
                if (risk == 'intermediate' || risk == 'high') return true
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
        static_name: "Impaired renal function",
		id: "beagle-renal-function",
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
        static_name: "Active smoker",
		id: "beagle-active-smoker",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /active/i.test(inputData['smoking']),
        ],
        defaultSuggestions: [
            {
                name: "Advise to cease smoking before surgery",
            },
            {
                name: "Referral for assistance with smoking cessation",
            },
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        static_name: "Anticoagulated",
		id: "beagle-anticoagulated",
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
        static_name: "Poor cardiorespiratory fitness",
		id: "beagle-unfit",
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
        static_name: "Unable to lay flat",
		id: "beagle-noflat",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /unable/i.test(inputData['flat']),
        ],
        defaultSuggestions: [
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        static_name: "Opioid tolerance",
		id: "beagle-opioid-tolerance",
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
        static_name: "Chronic pain",
		id: "beagle-chronic-pain",
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
        static_name: "Ischaemic heart disease",
		id: "beagle-ihd",
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
        static_name: "Heart failure",
		id: "beagle-heart-failure",
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
        static_name: "Recent illness",
		id: "beagle-recent-illness",
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
        static_name: "NSAID-reactive asthma",
		id: "beagle-asthma-nsaids",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /y/i.test(inputData['diagnosis-asthma']['NSAID reactive']),
        ],
        defaultSuggestions: [
            {
                name: "Avoid NSAIDs",
            },
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        static_name: "Suboptimal asthma control",
		id: "beagle-asthma-control",
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
            {
                name: "Consider referral for optimisation of asthma control",
            },
        ],
        conditionalSuggestions: [
        ],
        severityGrades: [
        ],
    },
    {
        static_name: "ICD in situ",
		id: "beagle-icd",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-icd'),
        ],
    },
    {
        static_name: "Pacemaker in situ",
		id: "beagle-pacemaker",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-pacemaker'),
        ],
    },
    {
        static_name: "Immune-suppressed",
		id: "beagle-immune-suppressed",
        matchStrategy: "any",
        matchRules: [
            (inputData) => /y/i.test(inputData['diagnosis-rheumatoid-arthritis']['Immune suppressed'])
        ],
    },
    {
        static_name: "COPD",
		id: "beagle-copd",
        matchStrategy: "any",
        matchRules: [
            (inputData) => diagnosisExists(inputData, 'diagnosis-copd')
        ],
    },
    {
        static_name: "Aortic stenosis",
		id: "beagle-aortic-stenosis",
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
    bones.push(new Bone(b.dynamic_name, b.static_name, b.id, b.auto_hide, b.matchStrategy, b.matchRules, b.defaultSuggestions || [], b.conditionalSuggestions || [], b.severityGrades || []))
}